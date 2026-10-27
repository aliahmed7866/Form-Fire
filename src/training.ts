import type {DatabaseSync} from 'node:sqlite';
import {LibraryError,planContent} from './plan-library.ts';
import {trainingProgrammes,trainingSources,trainingSafety} from './training-programmes.ts';
import {nutritionDate} from './nutrition.ts';
import {userToday} from './rhythm.ts';
import {id,transaction} from './db.ts';
function check(ok:any,message:string,status=400):asserts ok {if(!ok)throw new LibraryError(message,status);}
function programme(id:string){const p=trainingProgrammes.find(p=>p.id===id);check(p,'Programme not found.',404);return p;}
export function trainingExport(db:DatabaseSync,userId:string){return db.prepare('SELECT programme_id,session_id,day,outcome,effort,notes,snapshot,version,created_at,updated_at FROM programme_sessions WHERE user_id=? ORDER BY day DESC,created_at DESC').all(userId).map((r:any)=>({...r,snapshot:JSON.parse(r.snapshot)}));}
export function trainingData(db:DatabaseSync,userId:string){const entries=trainingExport(db,userId);return {programmes:trainingProgrammes,sources:trainingSources,safety:trainingSafety,today:userToday(db,userId),entries,summaries:trainingProgrammes.map(p=>{const completed=new Set(entries.filter(e=>e.programme_id===p.id&&e.outcome==='completed').map(e=>e.session_id));return {id:p.id,completed:completed.size,total:p.sessions.length,next:p.sessions.find((s:any)=>!completed.has(s.id))?.id||null};})};}
export function saveTraining(db:DatabaseSync,userId:string,pid:string,sid:string,b:any,remove=false){
 const p=programme(pid),session=p.sessions.find((s:any)=>s.id===sid);check(session,'Session not found.',404);
 const day=nutritionDate(b.day);check(day<=userToday(db,userId),'Record today or an earlier day; future sessions are not completed activity.');
 check(Number.isSafeInteger(b.version)&&b.version>=0,'Refresh the session record before saving.');
 return transaction(db,()=>{
  const old=db.prepare('SELECT * FROM programme_sessions WHERE user_id=? AND programme_id=? AND session_id=? AND day=?').get(userId,pid,sid,day) as any;
  if(remove){check(old,'Record not found.',404);check(b.version===old.version,'This record changed. Reopen it before removing.',409);db.prepare('DELETE FROM programme_sessions WHERE user_id=? AND programme_id=? AND session_id=? AND day=?').run(userId,pid,sid,day);return {ok:true};}
  check(['completed','partial','skipped'].includes(b.outcome),'Choose completed, part completed or skipped.');
  const effort=b.effort??null;check(effort===null||Number.isSafeInteger(effort)&&effort>=1&&effort<=5,'Effort must be 1–5 or left blank.');
  check(b.notes===undefined||typeof b.notes==='string','Notes must be text.');const notes=(b.notes||'').trim();check(notes.length<=2000,'Keep notes under 2000 characters.');
  // Identical retries are safe even if the first response was lost.
  if(old&&b.version===old.version-1&&old.outcome===b.outcome&&old.effort===effort&&old.notes===notes)return {ok:true,version:old.version,duplicate:true};
  check(b.version===(old?.version||0),'This record changed. Reopen it before saving.',409);
  const snapshot=old?.snapshot||JSON.stringify({programme_id:p.id,programme_version:p.version,programme_title:p.title,session,sources:p.sources.map((key:string)=>(trainingSources as any)[key])});
  db.prepare(`INSERT INTO programme_sessions(user_id,programme_id,session_id,day,outcome,effort,notes,snapshot) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,programme_id,session_id,day) DO UPDATE SET outcome=excluded.outcome,effort=excluded.effort,notes=excluded.notes,version=programme_sessions.version+1,updated_at=CURRENT_TIMESTAMP`).run(userId,pid,sid,day,b.outcome,effort,notes,snapshot);
  return {ok:true,version:(old?.version||0)+1};
 });
}
export function copyTrainingTemplate(db:DatabaseSync,pid:string,actor:string,key:any){
 check(typeof key==='string'&&key.length>0&&key.length<=100,'A submission key is required.');
 const previous=db.prepare('SELECT * FROM programme_template_copies WHERE actor_id=? AND submission_key=?').get(actor,key) as any;if(previous){check(previous.programme_id===pid,'That submission key belongs to another programme.',409);return {id:previous.template_id,duplicate:true};}
 const p=programme(pid);check(p.kind==='strength','Use the running companion for timed running sessions.');
 // Copy the reusable A/B week into the existing review/publish journey. No assignment is created.
 const content=planContent(db,'training',{schedule:'Two non-consecutive sessions per week. Repeat the A/B week and review after six weeks.',guidance:p.evidence+'\n'+p.progression+'\n'+p.recovery+'\nSources: '+p.sources.map((s:string)=>(trainingSources as any)[s].url).join(' '),workouts:p.sessions.slice(0,2).map((s:any)=>({name:s.title,day:'Session '+s.number+' · agree a day',exercises:s.exercises.map((e:any)=>({exercise_id:e.id,sets:e.sets,reps:e.reps,rest_seconds:e.rest_seconds,notes:'Keep roughly 2–3 good reps in reserve. Review technique and load with Alex.'}))}))});
 const templateId=id();transaction(db,()=>{db.prepare("INSERT INTO templates(id,title,kind,content,is_demo) VALUES(?,?,'training',?,0)").run(templateId,p.title+' · review draft',JSON.stringify(content));db.prepare('INSERT INTO audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)').run(id(),actor,'training.template.copy',templateId);db.prepare('INSERT INTO programme_template_copies(actor_id,submission_key,programme_id,template_id) VALUES(?,?,?,?)').run(actor,key,pid,templateId);});return {id:templateId};
}
