import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createContext,runInContext } from 'node:vm';
import { createApp } from '../src/server.ts';
import { openDb } from '../src/db.ts';
import { passwordHash } from '../src/auth.ts';
import { metricInput,profileInput } from '../src/fitness.ts';

test('Metric validation converts units and rejects invalid measurements',()=>{
 const input={day:'2026-09-29',metric:'weight',value:200,unit:'lb'};assert.equal(metricInput(input).value,90.7185);
 assert.equal(metricInput({...input,metric:'waist',value:30,unit:'in'}).value,76.2);
 assert.equal(metricInput({...input,metric:'distance',value:5,unit:'mi'}).value,8.0467);
 for(const bad of [{...input,value:-1},{...input,unit:'stone'},{...input,day:'2026-02-30'},{...input,metric:'steps',unit:'steps',value:1.2},{...input,metric:'strength_load',unit:'kg',value:50,reps:5},{...input,metric:'energy',unit:'/5',value:6}])assert.throws(()=>metricInput(bad));
 assert.throws(()=>profileInput({fitness_goal:'admin'},{}));assert.throws(()=>profileInput({maintenance_min_kg:90,maintenance_max_kg:80},{}));assert.throws(()=>profileInput({timezone:'made/up'},{}));
 assert.deepEqual(profileInput({goals:'A new goal'}, {units:'imperial',fitness_goal:'strength'}),{units:'imperial',fitness_goal:'strength',goals:'A new goal'});
});
test('Metrics persist, profiles retain goal history, and clients cannot read or mutate each other',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-fitness-')),origin='http://127.0.0.1:8085',app=createApp({origin,dataDir:dir});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const port=(app.server.address() as any).port;
 class Client{cookie='';csrf='';async call(path:string,method='GET',body?:any,extra={}){const data=body===undefined?undefined:JSON.stringify(body);return new Promise<any>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf,...(data===undefined?{}:{'Content-Length':Buffer.byteLength(data)}),...extra}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];const out=JSON.parse(text);if(out.csrf)this.csrf=out.csrf;resolve({status:res.statusCode,data:out});});});req.on('error',reject);req.end(data);});}}
 const alice=new Client(),bob=new Client(),admin=new Client(),anon=new Client(),aid=randomUUID(),bid=randomUUID(),pw='fictional long test password';for(const [uid,email,role] of [[aid,'alice@fitness.test','client'],[bid,'bob@fitness.test','client'],[randomUUID(),'alex@fitness.test','admin']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(uid,email,email,passwordHash(pw),role);for(const [c,email] of [[alice,'alice@fitness.test'],[bob,'bob@fitness.test'],[admin,'alex@fitness.test']] as const)await c.call('/auth/login','POST',{email,password:pw});let entry:any;
 try{
 await t.test('Profiles have configurable goals, preferences, units and optimistic concurrency',async()=>{
   const b={name:'Alice',profile_version:1,fitness_goal:'build_muscle',units:'imperial',avatar:'chef',timezone:'Europe/London',hide_weight:true,height_cm:170,goals:'Feel stronger',goal_notes:'Do my first pull-up',favourite_foods:'Pasta',experience:'Beginner'};assert.equal((await alice.call('/profile','PUT',b)).status,200);assert.equal((await alice.call('/profile','PUT',b)).status,409);
   const user=(await alice.call('/session')).data.user;assert.equal(user.profile.fitness_goal,'build_muscle');assert.equal(user.profile.units,'imperial');assert.equal(user.profile_version,2);
   await alice.call('/profile','PUT',{name:'Alice',fitness_goal:'maintain',maintenance_min_kg:65,maintenance_max_kg:68});const data=(await alice.call('/metrics')).data;assert.equal(data.goals.length,2);assert.equal(data.goals[0].goal,'build_muscle');assert.equal(data.profile.experience,'Beginner');
   assert.equal((await bob.call('/admin/clients/'+aid+'/profile','PUT',{name:'Intrusion',profile_version:3})).status,403);assert.equal((await admin.call('/admin/clients/'+aid+'/profile','PUT',{name:'Alice',profile_version:3,avatar:'leaf',role:'admin'})).status,200);assert.equal((await alice.call('/session')).data.user.role,'client');assert.equal((await admin.call('/admin/clients/'+aid+'/profile','PUT',{name:'Alice',profile_version:3})).status,409);
 });
 await t.test('Logs are private, idempotent, comparable and support correction',async()=>{
   const b={day:'2026-09-29',metric:'strength_load',value:50,unit:'kg',context:'Bench Press',reps:5,notes:'Felt comfortable',idempotency_key:randomUUID(),user_id:bid};const out=await alice.call('/metrics','POST',b);assert.equal(out.status,201);entry=out.data;assert.equal(entry.context,'bench press');assert.equal(entry.goal,'maintain');
   assert.equal((await alice.call('/metrics','POST',b)).data.id,entry.id);assert.equal((await alice.call('/metrics','POST',{...b,value:60})).status,409);assert.equal((await alice.call('/metrics','POST',{...b,idempotency_key:randomUUID()})).status,409);
   assert.equal((await bob.call('/metrics')).data.entries.length,0);assert.equal((await bob.call('/metrics/'+entry.id,'DELETE',{version:1})).status,404);assert.equal((await bob.call('/admin/metrics/'+aid)).status,403);assert.equal((await anon.call('/metrics')).status,401);assert.equal((await admin.call('/metrics','POST',b)).status,403);
   assert.equal((await alice.call('/metrics','POST',{...b,day:'2026-09-28',idempotency_key:randomUUID()},{'X-CSRF-Token':''})).status,403);
   assert.equal((await alice.call('/metrics/'+entry.id,'PUT',{...b,value:55,version:1})).status,200);assert.equal((await alice.call('/metrics/'+entry.id,'PUT',{...b,value:60,version:1})).status,409);
   assert.equal((await alice.call('/metrics','POST',{...b,reps:8,idempotency_key:randomUUID()})).status,201);assert.equal((await admin.call('/admin/metrics/'+aid)).data.entries.length,2);
 });
 await t.test('Export and restart retain data; deletion removes only the owned record',async()=>{
   const data=(await alice.call('/export')).data;assert.equal(data.fitness.entries.length,2);assert.equal(data.fitness.goals.length,2);assert.ok(!JSON.stringify(data).includes('admin_notes'));
   const again=openDb(dir);assert.equal(again.prepare('SELECT COUNT(*) n FROM fitness_metrics WHERE user_id=?').get(aid)?.n,2);again.close();
   assert.equal((await alice.call('/metrics/'+entry.id,'DELETE',{version:2})).status,200);assert.equal((await alice.call('/metrics')).data.entries.length,1);
 });
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('Progress charts use elapsed dates, preserve gaps, escape notes and compare consistent sets',()=>{
 const c=createContext({document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/portal/progress'},URLSearchParams,crypto:{randomUUID}});for(const file of ['nutrition.js','fitness.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 c.rows=[{day:'2026-09-01',value:80,metric:'weight',context:'',reps:0},{day:'2026-09-03',value:82,metric:'weight',context:'',reps:0},{day:'2026-09-20',value:79,metric:'weight',context:'',reps:0}];assert.equal(runInContext('rollingFitnessTrend(rows)[1].value',c),81);assert.equal(runInContext('rollingFitnessTrend(rows)[2].value',c),79);
 const html=runInContext("fitnessChart(rows,{label:'Weight',unit:'kg'}, {fitness_goal:'maintain',maintenance_min_kg:79,maintenance_max_kg:82},'weight')",c);assert.ok(html.includes('viewBox'));assert.ok(html.includes('chart-band'));assert.ok(html.includes('Missing days are not treated as zero'));
 c.entries=[{metric:'strength_load',context:'squat',reps:5,day:'2026-09-01',value:60},{metric:'strength_load',context:'squat',reps:10,day:'2026-09-02',value:50},{metric:'strength_load',context:'bench',reps:5,day:'2026-09-03',value:40}];assert.equal(runInContext("fitnessSeries(entries,'strength_load','squat',5).length",c),1);
 assert.equal(runInContext("displayFitnessValue(100,{unit:'kg'},{units:'imperial'}).value",c),220.46);
});
