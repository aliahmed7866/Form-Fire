import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { LibraryError } from './plan-library.ts';
import { nutritionDate } from './nutrition.ts';
import { shiftDay, userToday, weekStart } from './rhythm.ts';

function check(ok:any,message:string,status=400):asserts ok { if(!ok)throw new LibraryError(message,status); }
export const movementTypes = {
 gentle:'Gentle movement', moderate:'Moderate aerobic', vigorous:'Vigorous aerobic', strength:'Strength work'
};
function payload(db:DatabaseSync,userId:string,b:any) {
 const day=nutritionDate(b.day);
 check(day<=userToday(db,userId),'Choose today or an earlier date. Future activity is not a completed record.');
 check(typeof b.title==='string'&&b.title.trim().length>0&&b.title.trim().length<=100,'Give your activity a name of up to 100 characters.');
 check(Number.isSafeInteger(b.minutes)&&b.minutes>=1&&b.minutes<=1440,'Enter whole minutes between 1 and 1440.');
 check(typeof b.intensity==='string'&&Object.hasOwn(movementTypes,b.intensity),'Choose an activity type.');
 check(b.notes===undefined||typeof b.notes==='string','Notes must be text.');
 const notes=(b.notes||'').trim();check(notes.length<=1000,'Keep notes to 1000 characters or fewer.');
 return {day,title:b.title.trim(),minutes:b.minutes,intensity:b.intensity,notes};
}
function dailyLimit(db:DatabaseSync,userId:string,p:any,exclude='') {
 const row=db.prepare('SELECT COALESCE(SUM(minutes),0) total FROM movement_entries WHERE user_id=? AND day=? AND deleted_at IS NULL AND id<>?').get(userId,p.day,exclude) as any;
 check(row.total+p.minutes<=1440,'These entries total more than 24 hours for one day. Check for overlapping or duplicate activity.');
}
const fields='id,day,title,minutes,intensity,notes,version,created_at,updated_at';
export function saveMovement(db:DatabaseSync,userId:string,b:any) {
 const p=payload(db,userId,b),serialized=JSON.stringify(p);
 check(typeof b.idempotency_key==='string'&&b.idempotency_key.length>0&&b.idempotency_key.length<=100,'A submission key is required.');
 const existing=db.prepare('SELECT * FROM movement_entries WHERE user_id=? AND idempotency_key=?').get(userId,b.idempotency_key) as any;
 if(existing){check(!existing.deleted_at,'This activity was removed. Start a new record to log it again.',409);check(existing.original_payload===serialized,'That submission key belongs to a different activity.',409);return {id:existing.id,duplicate:true};}
 dailyLimit(db,userId,p);
 const id=randomUUID();
 db.prepare('INSERT INTO movement_entries(id,user_id,day,title,minutes,intensity,notes,idempotency_key,original_payload) VALUES(?,?,?,?,?,?,?,?,?)').run(id,userId,p.day,p.title,p.minutes,p.intensity,p.notes,b.idempotency_key,serialized);
 return {id};
}
export function updateMovement(db:DatabaseSync,userId:string,id:string,b:any,remove=false) {
 const old=db.prepare('SELECT * FROM movement_entries WHERE id=? AND user_id=? AND deleted_at IS NULL').get(id,userId) as any;
 check(old,'Activity not found.',404);check(b.version===old.version,'This activity changed. Reopen it before saving.',409);
 if(remove){
  // Retain only a retry tombstone until account deletion; erase the removed content.
  db.prepare("UPDATE movement_entries SET deleted_at=CURRENT_TIMESTAMP,title='',notes='',original_payload='',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(id,userId);
  return {ok:true};
 }
 const p=payload(db,userId,b);dailyLimit(db,userId,p,id);
 db.prepare('UPDATE movement_entries SET day=?,title=?,minutes=?,intensity=?,notes=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(p.day,p.title,p.minutes,p.intensity,p.notes,id,userId);
 return {ok:true};
}
export function movementSummary(entries:any[]) {
 const minutes=(type:string)=>entries.filter(e=>e.intensity===type).reduce((n,e)=>n+e.minutes,0);
 return {records:entries.length,recorded_days:new Set(entries.map(e=>e.day)).size,total_minutes:entries.reduce((n,e)=>n+e.minutes,0),gentle_minutes:minutes('gentle'),moderate_minutes:minutes('moderate'),vigorous_minutes:minutes('vigorous'),strength_minutes:minutes('strength'),strength_days:new Set(entries.filter(e=>e.intensity==='strength').map(e=>e.day)).size,equivalent_minutes:minutes('moderate')+2*minutes('vigorous')};
}
export function movementData(db:DatabaseSync,userId:string,day:string) {
 const week=weekStart(day),to=shiftDay(week,6),from=shiftDay(week,-49);
 const history=db.prepare(`SELECT ${fields} FROM movement_entries WHERE user_id=? AND deleted_at IS NULL AND day BETWEEN ? AND ? ORDER BY day DESC,created_at DESC,id`).all(userId,from,to) as any[];
 const entries=history.filter(e=>e.day>=week);
 return {day,week,to,today:userToday(db,userId),entries,summary:movementSummary(entries),weeks:Array.from({length:8},(_,i)=>{const start=shiftDay(from,i*7),end=shiftDay(start,6);return {week:start,to:end,...movementSummary(history.filter(e=>e.day>=start&&e.day<=end))};}),types:movementTypes};
}
export function movementExport(db:DatabaseSync,userId:string){return db.prepare(`SELECT ${fields} FROM movement_entries WHERE user_id=? AND deleted_at IS NULL ORDER BY day,id`).all(userId);}
