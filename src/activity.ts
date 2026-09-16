import type { DatabaseSync } from 'node:sqlite';
import { transaction } from './db.ts';

export class ActivityError extends Error {
  status: number;
  constructor(message:string,status=400) {super(message);this.status=status;}
}
function requireValue(ok:any,message:string,status=400):asserts ok {if(!ok)throw new ActivityError(message,status);}
const dayMs=86400000;
const fields='assignment_id,user_id,item_kind,item_index,activity_date,timezone,notes,effort,completed_at';
function calendarDate(value:any,name:string) {
  requireValue(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value)),`Enter a valid ${name}.`);
  requireValue(new Date(value).toISOString().slice(0,10)===value,`Enter a valid ${name}.`);
  return value;
}
function shiftDate(value:string,days:number) {return new Date(Date.parse(value)+days*dayMs).toISOString().slice(0,10);}
export function localDate(timezone:string,now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(name:string)=>parts.find(p=>p.type===name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function activityRange(params:URLSearchParams,now=new Date()) {
  const today=now.toISOString().slice(0,10);
  const to=calendarDate(params.get('to')??today,'end date');
  const from=calendarDate(params.get('from')??shiftDate(to,-6),'start date');
  requireValue(from<=to,'End date must follow start date.');
  requireValue((Date.parse(to)-Date.parse(from))/dayMs<90,'Choose a range of at most 90 calendar dates.');
  return {from,to};
}
export function clientActivity(db:DatabaseSync,userId:string,range?:{from:string,to:string}) {
  return db.prepare(`SELECT ${fields} FROM plan_activity WHERE user_id=?${range?' AND activity_date BETWEEN ? AND ?':''} ORDER BY activity_date DESC,completed_at DESC,assignment_id,item_kind,item_index`).all(userId,...(range?[range.from,range.to]:[]));
}
export function saveActivity(db:DatabaseSync,userId:string,assignmentId:string,input:any,now=new Date()) {
  return transaction(db,()=>{
    const assignment=db.prepare('SELECT a.*,r.active,r.user_id request_owner FROM assignments a JOIN requests r ON r.id=a.request_id WHERE a.id=? AND a.user_id=?').get(assignmentId,userId) as any;
    requireValue(assignment&&assignment.request_owner===userId,'Plan not found.',404);
    const latest=db.prepare('SELECT id FROM assignments WHERE request_id=? AND kind=? ORDER BY version DESC,rowid DESC LIMIT 1').get(assignment.request_id,assignment.kind) as any;
    requireValue(assignment.active&&latest?.id===assignment.id,'This plan is read-only. Track the latest plan while your service is active.',409);
    requireValue(input.item_kind==='workout'||input.item_kind==='meal','Choose a workout or meal.');
    requireValue((input.item_kind==='workout'&&assignment.kind==='training')||(input.item_kind==='meal'&&assignment.kind==='meal'),'This item does not belong to this plan.');
    const snapshot=JSON.parse(assignment.snapshot),items=input.item_kind==='workout'?snapshot.workouts:snapshot.meals;
    requireValue(Number.isSafeInteger(input.item_index)&&input.item_index>=0&&Array.isArray(items)&&input.item_index<items.length,'Choose an item from this published plan.');
    requireValue(typeof input.completed==='boolean','Choose completed or not completed.');
    const activityDate=calendarDate(input.activity_date,'activity date');
    requireValue(typeof input.timezone==='string'&&input.timezone.length<=100&&/^[A-Za-z][A-Za-z0-9_+\/-]*$/.test(input.timezone),'Enter a valid IANA time zone, such as Europe/London.');
    let today:string;
    try {today=localDate(input.timezone,now);}catch {throw new ActivityError('Enter a valid IANA time zone, such as Europe/London.');}
    requireValue(activityDate<=today,'Activity cannot be logged for a future date.');
    requireValue(activityDate>=shiftDate(today,-90),'Activity can be logged for today or the previous 90 days.');
    const publishedAt=new Date(assignment.created_at.replace(' ','T')+'Z');
    requireValue(activityDate>=localDate(input.timezone,publishedAt),'Activity cannot be logged before this plan was published.');
    const notes=input.notes??'',effort=input.effort??null;
    requireValue(typeof notes==='string'&&notes.trim().length<=2000,'Notes must be text of at most 2000 characters.');
    requireValue(effort===null||(input.item_kind==='workout'&&Number.isSafeInteger(effort)&&effort>=1&&effort<=5),'Effort is optional and must be from 1 to 5 for workouts only.');
    if(!input.completed) {
      db.prepare('DELETE FROM plan_activity WHERE assignment_id=? AND user_id=? AND item_kind=? AND item_index=? AND activity_date=?').run(assignmentId,userId,input.item_kind,input.item_index,activityDate);
      return {entry:null};
    }
    db.prepare(`INSERT INTO plan_activity(assignment_id,user_id,item_kind,item_index,activity_date,timezone,notes,effort) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(assignment_id,item_kind,item_index,activity_date) DO UPDATE SET timezone=excluded.timezone,notes=excluded.notes,effort=excluded.effort WHERE plan_activity.user_id=excluded.user_id`).run(assignmentId,userId,input.item_kind,input.item_index,activityDate,input.timezone,notes.trim(),effort);
    const entry=db.prepare(`SELECT ${fields} FROM plan_activity WHERE assignment_id=? AND user_id=? AND item_kind=? AND item_index=? AND activity_date=?`).get(assignmentId,userId,input.item_kind,input.item_index,activityDate);
    return {entry};
  });
}
export function adminActivity(db:DatabaseSync,range:{from:string,to:string}) {
  const entries=db.prepare(`SELECT ${fields.split(',').map(f=>'p.'+f).join(',')},u.name client_name,a.title plan_title,a.snapshot
    FROM plan_activity p JOIN assignments a ON a.id=p.assignment_id JOIN users u ON u.id=p.user_id
    WHERE p.activity_date BETWEEN ? AND ? ORDER BY p.activity_date DESC,p.completed_at DESC,u.name,p.assignment_id,p.item_index`).all(range.from,range.to).map((row:any)=>{
      const {snapshot,...entry}=row,plan=JSON.parse(snapshot);
      const item=row.item_kind==='workout'?plan.workouts?.[row.item_index]:plan.meals?.[row.item_index];
      return {...entry,item_title:row.item_kind==='workout'?(item?.name??'Workout'):[item?.slot,item?.recipe?.title].filter(Boolean).join(' · ')||'Meal'};
    });
  const summary=db.prepare(`SELECT u.id user_id,u.name client_name,
    SUM(CASE WHEN p.item_kind='workout' THEN 1 ELSE 0 END) workouts_completed,
    SUM(CASE WHEN p.item_kind='meal' THEN 1 ELSE 0 END) meals_prepared,
    MAX(p.activity_date) last_activity
    FROM users u LEFT JOIN plan_activity p ON p.user_id=u.id AND p.activity_date BETWEEN ? AND ?
    WHERE u.role='client' GROUP BY u.id ORDER BY u.name,u.id`).all(range.from,range.to);
  return {entries,summary,...range};
}
