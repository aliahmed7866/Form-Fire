import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext,runInContext } from 'node:vm';
import { createApp } from '../src/server.ts';
import { passwordHash } from '../src/auth.ts';
import { openDb } from '../src/db.ts';
import { movementData, movementSummary } from '../src/movement.ts';
import { userToday,weekStart,shiftDay } from '../src/rhythm.ts';

test('Movement journal protects ownership, history, retries and account lifecycle',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-movement-')),origin='http://127.0.0.1:8085',app=createApp({dataDir:dir,origin});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const port=(app.server.address() as any).port;
 class Client{cookie='';csrf='';async call(path:string,method='GET',body?:any,csrf=this.csrf){return new Promise<any>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':csrf,...(body===undefined?{}:{'Content-Length':Buffer.byteLength(JSON.stringify(body))})}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];const data=JSON.parse(raw);if(data.csrf)this.csrf=data.csrf;resolve({status:res.statusCode,data});});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});}}
 const admin=new Client(),alice=new Client(),bob=new Client(),anon=new Client(),pw='A fictional testing password',aid=randomUUID(),bid=randomUUID();
 for(const [id,email,role] of [[randomUUID(),'alex@movement.test','admin'],[aid,'alice@movement.test','client'],[bid,'bob@movement.test','client']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(id,email,email,passwordHash(pw),role);
 for(const [client,email] of [[admin,'alex@movement.test'],[alice,'alice@movement.test'],[bob,'bob@movement.test']] as const)assert.equal((await client.call('/auth/login','POST',{email,password:pw})).status,200);
 const today=userToday(app.db,aid),week=weekStart(today),body={day:today,title:'A riverside walk',minutes:30,intensity:'moderate',notes:'Felt good',idempotency_key:randomUUID()};let entryId='';
 try{
 await t.test('Authenticated client ownership and CSRF apply to every write and read',async()=>{
  assert.equal((await anon.call('/movement')).status,401);assert.equal((await admin.call('/movement')).status,403);
  assert.equal((await alice.call('/movement','POST',body,'')).status,403);
  const saved=await alice.call('/movement','POST',{...body,user_id:bid});assert.equal(saved.status,201);entryId=saved.data.id;
  assert.equal((await bob.call('/movement?day='+today)).data.entries.length,0);
  for(const method of ['PUT','DELETE'])assert.equal((await bob.call('/movement/'+entryId,method,{...body,version:1})).status,404);
  assert.equal((await alice.call('/admin/rhythm/'+bid)).status,403);
  assert.equal((await admin.call('/admin/rhythm/'+aid+'?day='+today)).data.movement.entries[0].id,entryId);
 });
 await t.test('Retries cannot duplicate or resurrect records, and stale edits cannot overwrite',async()=>{
  assert.equal((await alice.call('/movement','POST',body)).data.id,entryId);
  assert.equal((await alice.call('/movement','POST',{...body,minutes:40})).status,409);
  assert.equal((await alice.call('/movement/'+entryId,'PUT',{...body,minutes:45,version:1})).status,200);
  assert.equal((await alice.call('/movement/'+entryId,'PUT',{...body,version:1})).status,409);
  assert.equal((await alice.call('/movement/'+entryId,'DELETE',{version:1})).status,409);
  assert.equal((await alice.call('/movement','POST',body)).data.id,entryId);
  assert.equal((await alice.call('/movement?day='+today)).data.entries[0].minutes,45);
 });
 await t.test('Dates, types, lengths, whole minutes and total daily duration are validated',async()=>{
  for(const patch of [{day:'2026-02-30'},{day:shiftDay(today,1)},{title:''},{title:'x'.repeat(101)},{minutes:0},{minutes:1.5},{minutes:1441},{minutes:'30'},{intensity:'__proto__'},{intensity:'burn'},{notes:{}},{notes:'a'.repeat(1001)}])assert.equal((await alice.call('/movement','POST',{...body,...patch,idempotency_key:randomUUID()})).status,400,JSON.stringify(patch));
  assert.equal((await alice.call('/movement?day=bad')).status,400);
  assert.equal((await alice.call('/movement','POST',{...body,minutes:1400,idempotency_key:randomUUID()})).status,400);
  assert.equal((await alice.call('/movement/'+entryId,'PUT',{...body,minutes:1440,version:2})).status,200);
  assert.equal((await alice.call('/movement/'+entryId,'PUT',{...body,minutes:30,version:3})).status,200);
 });
 await t.test('Week aggregation keeps intensities separate, deduplicates strength days and leaves gaps',async()=>{
  for(const [intensity,minutes] of [['vigorous',15],['strength',20],['strength',10],['gentle',12]] as const)assert.equal((await alice.call('/movement','POST',{...body,intensity,minutes,idempotency_key:randomUUID()})).status,201);
  const prior=shiftDay(week,-1);assert.equal((await alice.call('/movement','POST',{...body,day:prior,minutes:25,idempotency_key:randomUUID()})).status,201);
  const d=(await alice.call('/movement?day='+today)).data;
  assert.deepEqual(d.summary,{records:5,recorded_days:1,total_minutes:87,gentle_minutes:12,moderate_minutes:30,vigorous_minutes:15,strength_minutes:30,strength_days:1,equivalent_minutes:60});
  assert.equal(d.weeks.length,8);assert.equal(d.weeks[6].total_minutes,25);assert.equal(d.weeks[0].records,0);
  assert.equal((await alice.call('/movement?day='+prior)).data.summary.total_minutes,25);
  assert.equal((await alice.call('/rhythm?day='+today)).data.summary.workouts,0);
  assert.equal((await alice.call('/nutrition/diary?day='+today)).data.entries.length,0);
  const another=openDb(dir);try{assert.equal(movementData(another,aid,today).summary.total_minutes,87);}finally{another.close();}
 });
 await t.test('Changing a date moves it between weeks; deletion changes totals and export',async()=>{
  assert.equal((await alice.call('/movement/'+entryId,'PUT',{...body,day:shiftDay(week,-2),version:4})).status,200);
  assert.equal((await alice.call('/movement?day='+today)).data.summary.moderate_minutes,0);
  assert.equal((await alice.call('/movement/'+entryId,'DELETE',{version:5})).status,200);
  assert.equal((await alice.call('/movement','POST',body)).status,409);
  assert.equal((await alice.call('/movement/'+entryId,'PUT',{...body,version:6})).status,404);
  const exported=(await alice.call('/export')).data.movement;assert.equal(exported.length,5);assert.ok(!exported.some((e:any)=>e.id===entryId));assert.ok(exported.every((e:any)=>!('original_payload' in e)&&!('idempotency_key' in e)));
  assert.equal(app.db.prepare('SELECT notes FROM movement_entries WHERE id=?').get(entryId)?.notes,'');
 });
 await t.test('Actual requested-account deletion removes active records and retry tombstones',async()=>{
  assert.equal((await bob.call('/movement','POST',body)).status,201);
  assert.equal((await alice.call('/account/deletion','POST',{})).status,201);
  const deleted=spawnSync(process.execPath,['src/manage.ts','delete-requested-account','alice@movement.test'],{cwd:new URL('..',import.meta.url),env:{...process.env,FF_MODE:'local-test',FF_DATA_DIR:dir},encoding:'utf8'});assert.equal(deleted.status,0,deleted.stderr);
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM movement_entries WHERE user_id=?').get(aid)?.n,0);
  assert.equal((await bob.call('/movement?day='+today)).data.summary.total_minutes,30);
 });
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Movement display escapes notes, exposes text equivalents and leaves absent weeks unknown',()=>{
 const c=createContext({document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/portal/movement'},URLSearchParams,crypto:{randomUUID}});
 for(const file of ['rhythm.js','movement.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 const entry={id:'safe',day:'2026-09-30',title:'<script>bad</script>',notes:'<img onerror=bad>',minutes:20,intensity:'strength',version:1};
 c.d={day:'2026-09-30',today:'2026-09-30',week:'2026-09-28',to:'2026-10-04',entries:[entry],summary:movementSummary([entry]),weeks:[{week:'2026-09-21',...movementSummary([])},{week:'2026-09-28',...movementSummary([entry])}]};
 const html=runInContext('movementEntries(d,true)+movementSummaryView(d)+movementHistory(d)',c);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('No records'));assert.ok(html.includes('<caption>'));assert.ok(html.includes('0 moderate-equivalent'));assert.ok(html.includes('Yes, remove activity'));
});
