import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createContext,runInContext} from 'node:vm';
import {createApp} from '../src/server.ts';
import {openDb} from '../src/db.ts';
import {passwordHash} from '../src/auth.ts';
import {trainingProgrammes} from '../src/training-programmes.ts';

test('All 27 running sessions match independently checked NHS interval totals',()=>{
 const p=trainingProgrammes.find(p=>p.kind==='running'),sessions=p.sessions;
 const totals=[1710,1710,1710,1740,1740,1740,1500,1500,1500,1890,1890,1890,1860,1860,1800,2040,1980,2100,2100,2100,2100,2280,2280,2280,2400,2400,2400];
 const running=[480,480,480,540,540,540,540,540,540,960,960,960,900,960,1200,1080,1200,1500,1500,1500,1500,1680,1680,1680,1800,1800,1800];
 assert.equal(sessions.length,27);assert.equal(new Set(sessions.map((s:any)=>s.id)).size,27);
 sessions.forEach((s:any,i:number)=>{assert.equal(s.total_seconds,totals[i]);assert.equal(s.running_seconds,running[i]);assert.deepEqual(s.intervals[0],{kind:'warmup',seconds:300});assert.deepEqual(s.intervals.at(-1),{kind:'cooldown',seconds:300});assert.equal(s.intervals[1].kind,'run');assert.equal(s.intervals.at(-2).kind,'run');assert.ok(s.intervals.every((b:any)=>Number.isSafeInteger(b.seconds)&&b.seconds>0));});
 assert.deepEqual(sessions[13].intervals.slice(1,-1).map((b:any)=>b.seconds),[480,300,480]);
 assert.deepEqual(sessions[16].intervals.slice(1,-1).map((b:any)=>b.seconds),[600,180,600]);
 assert.match(p.progression,/distance varies/);assert.match(p.evidence,/not a guarantee/);
});

test('Programme records are private, retry-safe, versioned, persistent and linked to explicit publishing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-training-')),origin='http://127.0.0.1:8132',app=createApp({dataDir:dir,origin,requireVerification:false}),password='fictional training password';
 for(const [id,role] of [['alex','admin'],['sam','client'],['robin','client']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(id,id+'@training.test',id,passwordHash(password),role);
 await new Promise<void>(r=>app.server.listen(8132,'127.0.0.1',r));const sessions:any={};
 async function call(who:string,path:string,method='GET',body?:any){const response=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...sessions[who]},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json(),response};}
 const path='/training/walk-run-9/sessions/w1s1',body={day:'2026-10-01',version:0,outcome:'completed',effort:3,notes:'A manageable start.'};
 try{
  assert.equal((await call('','/training')).status,401);
  for(const who of ['alex','sam','robin']){const r=await call('','/auth/login','POST',{email:who+'@training.test',password});assert.equal(r.status,200);sessions[who]={Cookie:r.response.headers.get('set-cookie')!.split(';')[0],'X-CSRF-Token':r.data.csrf};}
  assert.equal((await call('sam','/training')).data.programmes.length,3);assert.equal((await call('alex','/admin/training')).data.programmes.length,3);assert.equal((await call('sam','/training')).data.entries.length,0);
  assert.equal((await call('sam',path,'PUT',{...body,user_id:'robin'})).status,200);
  assert.equal((await call('sam',path,'PUT',body)).data.duplicate,true);
  assert.equal((await call('sam',path,'PUT',{...body,notes:'Changed stale version'})).status,409);
  assert.equal((await call('sam',path,'PUT',{...body,day:'2999-01-01'})).status,400);
  assert.equal((await call('sam','/training/walk-run-9/sessions/missing','PUT',body)).status,404);
  assert.equal((await call('sam',path,'PUT',{...body,day:'2026-02-30'})).status,400);
  assert.equal((await call('sam',path,'PUT',{...body,effort:6})).status,400);
  assert.equal((await call('sam',path,'PUT',{...body,notes:'x'.repeat(2001)})).status,400);
  assert.equal((await call('alex',path,'PUT',body)).status,403);
  assert.equal((await call('sam','/admin/training?client=robin')).status,403);
  assert.equal((await call('robin','/training?client=sam')).data.entries.length,0);
  assert.equal((await call('robin',path,'DELETE',{day:body.day,version:1})).status,404);
  const saved=app.db.prepare("SELECT snapshot FROM programme_sessions WHERE user_id='sam'").get()?.snapshot;
  assert.equal((await call('sam',path,'PUT',{...body,version:1,outcome:'partial'})).status,200);
  assert.equal((await call('sam','/training')).data.summaries[0].completed,0);
  assert.equal((await call('sam',path,'PUT',{...body,version:2})).status,200);
  assert.equal((await call('sam',path,'PUT',{...body,day:'2026-10-03'})).status,200);
  assert.equal((await call('sam','/training')).data.summaries[0].completed,1,'Repeated attempts must not inflate distinct completion');
  assert.equal((await call('sam','/training')).data.summaries[0].next,'w1s2');
  assert.equal(app.db.prepare("SELECT snapshot FROM programme_sessions WHERE user_id='sam' AND day='2026-10-01'").get()?.snapshot,saved);
  assert.equal((await call('alex','/admin/training?client=sam')).data.entries.length,2);
  assert.equal((await call('sam','/export')).data.training.length,2);assert.equal((await call('robin','/export')).data.training.length,0);
  const second=openDb(dir);assert.equal(second.prepare("SELECT count(*) n FROM programme_sessions WHERE user_id='sam'").get()?.n,2);second.close();
  const copy='/admin/training/strength-home-6/template',payload={idempotency_key:'home-copy'};
  assert.equal((await call('sam',copy,'POST',payload)).status,403);
  const result=await call('alex',copy,'POST',payload);assert.equal(result.status,201);
  assert.equal((await call('alex',copy,'POST',payload)).data.id,result.data.id);
  assert.equal((await call('alex','/admin/training/strength-gym-6/template','POST',payload)).status,409);
  assert.equal(app.db.prepare('SELECT count(*) n FROM assignments').get()?.n,0,'Copy must not publish to a client');
  const template=app.db.prepare('SELECT * FROM templates WHERE id=?').get(result.data.id) as any;const content=JSON.parse(template.content);assert.equal(content.workouts.length,2);assert.equal(content.workouts[0].exercises.length,6);
  const request=(await call('sam','/requests','POST',{service_id:'train',idempotency_key:'training-test',details:{goals:'Learn strength training'}})).data;
  for(const status of ['under_review','approved'])assert.equal((await call('alex','/requests/'+request.id+'/status','POST',{status})).status,200);
  await call('alex','/requests/'+request.id+'/activate','POST',{active:true,package:'Fictional test'});
  const assigned=await call('alex','/admin/assignments','POST',{request_id:request.id,template_id:template.id});assert.equal(assigned.status,201);
  const snapshot=(await call('sam','/assignments/'+assigned.data.id)).data.snapshot;assert.equal(snapshot.workouts.length,2);assert.ok(snapshot.workouts[0].exercises[0].exercise.instructions);
  assert.equal((await call('sam',path,'DELETE',{day:body.day,version:1})).status,409);
  assert.equal((await call('sam',path,'DELETE',{day:body.day,version:3})).status,200);
  assert.equal((await call('sam','/training')).data.entries.length,1);
  const csrf=sessions.sam['X-CSRF-Token'];sessions.sam['X-CSRF-Token']='bad';assert.equal((await call('sam',path,'PUT',body)).status,403);sessions.sam['X-CSRF-Token']=csrf;
  assert.equal((await call('robin',path,'PUT',body)).status,200);
  app.db.prepare("DELETE FROM sessions WHERE user_id='robin'").run();app.db.prepare("DELETE FROM users WHERE id='robin'").run();assert.equal(app.db.prepare("SELECT count(*) n FROM programme_sessions WHERE user_id='robin'").get()?.n,0);
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Training view escapes notes and keeps timer controls separate from session saving',()=>{
 const handlers:any={},c=createContext({document:{addEventListener(type:string,fn:any){handlers[type]=fn;}},window:{addEventListener(){}},setTimeout,clearTimeout,Date,URLSearchParams,query:()=>new URLSearchParams(),session:{user:{id:'sam',role:'client'}},esc:(v:any)=>String(v??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),link:()=>'',form:(kind:string,content:string)=>'<form data-form="'+kind+'">'+content+'</form>',field:()=>'',area:()=>'',select:()=>''});runInContext(readFileSync(new URL('../public/training.js',import.meta.url),'utf8'),c);
 c.p=trainingProgrammes[0];c.s=trainingProgrammes[0].sessions[0];c.d={today:'2026-10-27',entries:[{programme_id:c.p.id,session_id:c.s.id,day:'2026-10-01',outcome:'partial',notes:'<script>no</script>'}]};
 const html=runInContext('trainingSessionView(p,s,d)',c);assert.match(html,/&lt;script>/);assert.doesNotMatch(html,/<script>/);assert.match(html,/never saves a completed session/);assert.match(html,/data-training-clock-action="toggle"/);assert.equal(runInContext('trainingTime(1710)',c),'28:30');
 c.query=()=>new URLSearchParams({day:'"><img src=x>'});const unsafe=runInContext('trainingSessionView(p,s,d)',c);assert.doesNotMatch(unsafe,/<img src=x>/);assert.match(unsafe,/name="day" value="2026-10-27"/);
});

test('Interval helper pauses when hidden, changes one interval at a time and never saves completion',async()=>{
 const handlers:any={},nodes:any={},intervals=[{kind:'warmup',seconds:300},{kind:'run',seconds:60},{kind:'cooldown',seconds:300}];let now=0,writes=0;
 for(const key of ['[data-training-time]','[data-training-interval-label]','[data-training-clock-status]','[data-training-clock-action="toggle"]','[data-training-clock-action="previous"]','[data-training-clock-action="next"]'])nodes[key]={textContent:'',disabled:false};
 const el={dataset:{intervals:JSON.stringify(intervals)},isConnected:true,querySelector:(s:string)=>nodes[s]};
 const document={hidden:false,querySelector:()=>el,addEventListener:(name:string,fn:any)=>handlers[name]=fn};
 const c=createContext({document,window:{addEventListener:(name:string,fn:any)=>handlers[name]=fn},session:{user:{id:'sam'}},Date:{now:()=>now},setTimeout:()=>1,clearTimeout:()=>{},api:()=>{writes++;}});
 runInContext(readFileSync(new URL('../public/training.js',import.meta.url),'utf8'),c);runInContext('initTrainingTimer()',c);
 const click=async(action:string)=>{const button={hasAttribute:()=>true,dataset:{trainingClockAction:action},closest:()=>el};await handlers.click({target:{closest:()=>button}});};
 assert.equal(nodes['[data-training-time]'].textContent,'5:00');
 await click('toggle');now=6500;runInContext('updateTrainingTimer()',c);assert.equal(nodes['[data-training-time]'].textContent,'4:54');
 document.hidden=true;handlers.visibilitychange();assert.equal(runInContext('trainingTimer.running',c),false);
 await click('next');assert.equal(nodes['[data-training-time]'].textContent,'1:00');assert.equal(runInContext('trainingTimer.index',c),1);
 document.hidden=false;await click('toggle');now+=61000;runInContext('updateTrainingTimer()',c);assert.equal(runInContext('trainingTimer.index',c),1,'An elapsed timer must not auto-advance');assert.equal(runInContext('trainingTimer.running',c),false);
 assert.equal(writes,0);c.session.user.id='other';runInContext('updateTrainingTimer()',c);assert.equal(runInContext('trainingTimer.running',c),false);
});
