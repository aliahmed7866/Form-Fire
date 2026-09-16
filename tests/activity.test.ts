import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../src/server.ts';
import { id } from '../src/db.ts';
import { digest } from '../src/auth.ts';
import { activityRange, localDate, saveActivity } from '../src/activity.ts';

const offsetDate=(days:number)=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);

test('Activity calendar dates follow the selected time zone and bounded inclusive ranges',()=>{
  const instant=new Date('2026-09-16T00:30:00Z');
  assert.equal(localDate('America/Los_Angeles',instant),'2026-09-15');
  assert.equal(localDate('Pacific/Kiritimati',instant),'2026-09-16');
  assert.deepEqual(activityRange(new URLSearchParams(),instant),{from:'2026-09-10',to:'2026-09-16'});
  assert.deepEqual(activityRange(new URLSearchParams('from=2026-06-19&to=2026-09-16'),instant),{from:'2026-06-19',to:'2026-09-16'});
  assert.throws(()=>activityRange(new URLSearchParams('from=2026-06-18&to=2026-09-16'),instant));
  assert.throws(()=>activityRange(new URLSearchParams('from=2026-02-30&to=2026-03-01'),instant));
  assert.throws(()=>activityRange(new URLSearchParams('from=2026-09-17&to=2026-09-16'),instant));
});

test('Daily plan activity persists with verified owner access and immutable assignment history',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-activity-')),origin='http://127.0.0.1:8085';
  let app=createApp({dataDir:dir,origin});
  let port=0;
  async function listen() {await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));port=(app.server.address() as any).port;}
  await listen();
  const uid=id(),admin=id(),other=id(),unverified=id(),rid=id();
  for(const [key,role,name,verified] of [[uid,'client','Taylor',1],[admin,'admin','Alex',1],[other,'client','Morgan',1],[unverified,'client','Unverified',0]] as const) {
    app.db.prepare('INSERT INTO users(id,email,name,password,role,verified,admin_notes) VALUES(?,?,?,?,?,?,?)').run(key,key+'@example.test',name,'unused',role,verified,'PRIVATE-ADMIN-NOTE');
    app.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(key),key,'csrf',Date.now()+3600000);
  }
  app.db.prepare("INSERT INTO requests(id,user_id,service_id,kind,details,status,active,idempotency_key,package) VALUES(?,?,'both','coaching','{}','approved',1,?,?)").run(rid,uid,id(),JSON.stringify({description:'PRIVATE-PACKAGE'}));
  async function call(who:string,path:string,method='GET',body?:any,headers:any={}) {return new Promise<any>((done,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json','X-CSRF-Token':'csrf',Cookie:'ff_session='+who,...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>done({status:res.statusCode,data:JSON.parse(text)}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });}
  const publish=async(template:string)=>{const r=await call(admin,'/admin/assignments','POST',{request_id:rid,template_id:template});assert.equal(r.status,201);return r.data.id as string;};
  let workout='',meal='',replacement='';
  const payload=()=>({item_kind:'workout',item_index:0,activity_date:offsetDate(0),timezone:'UTC',completed:true,notes:'Made time for myself.',effort:3});
  const put=(who:string,assignment:string,patch:any={},headers:any={})=>call(who,'/assignments/'+assignment+'/activity','PUT',{...payload(),...patch},headers);
  try {
    await t.test('Only a verified client can write their own assigned activity',async()=>{
      workout=await publish('starter-training');meal=await publish('starter-meals');
      assert.equal((await put('',workout)).status,401);
      assert.equal((await put(admin,workout)).status,403);
      assert.equal((await put(other,workout)).status,404);
      assert.equal((await put(uid,'missing')).status,404);
      assert.equal((await put(unverified,workout)).status,403);
      assert.equal((await put(uid,workout,{}, {'X-CSRF-Token':''})).status,403);
      assert.equal((await put(uid,workout,{}, {Origin:'https://other.test'})).status,403);
      assert.equal((await call('','/activity')).status,401);
      assert.equal((await call(admin,'/activity')).status,403);
      assert.equal((await call(unverified,'/activity')).status,403);
      assert.equal((await call(uid,'/admin/activity')).status,403);
      assert.equal((await call('','/admin/activity')).status,401);
      assert.deepEqual((await call(other,'/activity')).data.entries,[]);
    });
    await t.test('Writes validate snapshot item types, dates, time zones, effort and notes',async()=>{
      for(const patch of [
        {item_kind:'recipe'},{item_kind:'meal',effort:null},{item_index:-1},{item_index:0.5},{item_index:999},{item_index:'0'},
        {completed:1},{activity_date:'2026-02-30'},{activity_date:'bad'},{activity_date:offsetDate(1)},{activity_date:offsetDate(-1)},
        {timezone:'Not/A_Zone'},{timezone:'+01:00'},{timezone:''},{notes:42},{notes:'a'.repeat(2001)},{effort:0},{effort:6},{effort:2.5},{effort:'3'}
      ])assert.equal((await put(uid,workout,patch)).status,400,JSON.stringify(patch));
      assert.equal((await put(uid,meal,{item_kind:'meal'})).status,400);
      const original=app.db.prepare('SELECT created_at FROM assignments WHERE id=?').get(workout) as any;
      app.db.prepare('UPDATE assignments SET created_at=? WHERE id=?').run(offsetDate(-120)+' 00:00:00',workout);
      assert.equal((await put(uid,workout,{activity_date:offsetDate(-91)})).status,400);
      assert.equal((await put(uid,workout,{activity_date:offsetDate(-90)})).status,200);
      assert.equal((await put(uid,workout,{activity_date:offsetDate(-90),completed:false})).status,200);
      const simulated=new Date(offsetDate(0)+'T00:30:00Z');
      assert.throws(()=>saveActivity(app.db,uid,workout,{...payload(),timezone:'America/Los_Angeles'},simulated),/future date/);
      assert.ok(saveActivity(app.db,uid,workout,{...payload(),activity_date:offsetDate(-1),timezone:'America/Los_Angeles'},simulated).entry);
      saveActivity(app.db,uid,workout,{...payload(),activity_date:offsetDate(-1),timezone:'America/Los_Angeles',completed:false},simulated);
      app.db.prepare('UPDATE assignments SET created_at=? WHERE id=?').run(original.created_at,workout);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM plan_activity').get() as any).n,0);
    });
    await t.test('Completion is idempotent, supports edits and undo, and rejects identity injection',async()=>{
      const first=await put(uid,workout,{user_id:other});assert.equal(first.status,200);assert.equal(first.data.entry.user_id,uid);
      assert.deepEqual(Object.keys(first.data.entry).sort(),['assignment_id','user_id','item_kind','item_index','activity_date','timezone','notes','effort','completed_at'].sort());
      const duplicate=await put(uid,workout);assert.deepEqual(duplicate.data,first.data);
      const edited=await put(uid,workout,{notes:'A little stronger today.',effort:4});assert.equal(edited.data.entry.notes,'A little stronger today.');assert.equal(edited.data.entry.completed_at,first.data.entry.completed_at);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM plan_activity').get() as any).n,1);
      assert.deepEqual((await put(uid,workout,{completed:false})).data,{entry:null});
      assert.deepEqual((await put(uid,workout,{completed:false})).data,{entry:null});
      assert.equal((await call(uid,'/activity')).data.entries.length,0);
      await put(uid,workout);await put(uid,meal,{item_kind:'meal',effort:null,notes:'Prepared the oats.'});
      const own=(await call(uid,'/activity')).data.entries;
      assert.equal(own.length,2);assert.ok(own.every((e:any)=>e.user_id===uid));
      assert.equal((await call(other,'/activity')).data.entries.length,0);
    });
    await t.test('Admin summaries use snapshot titles without private or financial metadata',async()=>{
      const result=await call(admin,'/admin/activity');assert.equal(result.status,200);
      assert.equal(result.data.entries.length,2);
      const w=result.data.entries.find((x:any)=>x.item_kind==='workout'),m=result.data.entries.find((x:any)=>x.item_kind==='meal');
      assert.equal(w.client_name,'Taylor');assert.equal(w.item_title,'Full body A');assert.ok(w.plan_title);
      assert.equal(m.item_title,'Breakfast · Berry overnight oats');
      assert.deepEqual(result.data.summary.find((x:any)=>x.user_id===uid),{user_id:uid,client_name:'Taylor',workouts_completed:1,meals_prepared:1,last_activity:offsetDate(0)});
      assert.deepEqual(result.data.summary.find((x:any)=>x.user_id===other),{user_id:other,client_name:'Morgan',workouts_completed:0,meals_prepared:0,last_activity:null});
      const text=JSON.stringify(result.data);assert.ok(!text.includes('PRIVATE-'));assert.ok(!text.includes('snapshot'));assert.ok(!text.includes('invoice'));
      for(const path of ['/activity','/admin/activity']) {
        const who=path.startsWith('/admin')?admin:uid;
        assert.equal((await call(who,path+'?from='+offsetDate(-90)+'&to='+offsetDate(0))).status,400);
        assert.equal((await call(who,path+'?from=2026-02-30&to=2026-03-01')).status,400);
        assert.equal((await call(who,path+'?from='+offsetDate(1)+'&to='+offsetDate(7))).status,200);
      }
    });
    await t.test('New plan versions and ended services become read-only while history remains',async()=>{
      replacement=await publish('starter-training');
      assert.equal((await put(uid,workout)).status,409);
      assert.equal((await put(uid,workout,{completed:false})).status,409);
      assert.equal((await put(uid,replacement)).status,200);
      assert.equal((await call(uid,'/activity')).data.entries.length,3);
      app.db.prepare('UPDATE requests SET active=0 WHERE id=?').run(rid);
      assert.equal((await put(uid,replacement)).status,409);
      assert.equal((await put(uid,meal,{item_kind:'meal',effort:null,completed:false})).status,409);
      assert.equal((await call(uid,'/activity')).data.entries.length,3);
      app.db.prepare('UPDATE requests SET active=1 WHERE id=?').run(rid);
      const legacy=id();app.db.prepare("INSERT INTO templates(id,title,kind,content) VALUES(?,'Legacy training','training',?)").run(legacy,JSON.stringify({schedule:'Original',guidance:'Original'}));
      const legacyAssignment=await publish(legacy);
      assert.equal((await put(uid,legacyAssignment)).status,400);
      assert.equal((await call(uid,'/activity')).data.entries.length,3);
    });
    await t.test('Client export includes retained activity and restart preserves it',async()=>{
      // Export deliberately has no 90-day history limit, unlike the interactive list.
      app.db.prepare('UPDATE plan_activity SET activity_date=? WHERE assignment_id=?').run(offsetDate(-120),workout);
      const exported=await call(uid,'/export');assert.equal(exported.status,200);assert.equal(exported.data.activity.length,3);
      assert.equal(exported.data.activity.filter((e:any)=>e.assignment_id===workout).length,1);
      assert.equal((await call(other,'/export')).data.activity.length,0);
      await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();
      app=createApp({dataDir:dir,origin});await listen();
      assert.deepEqual((await call(uid,'/export')).data.activity,exported.data.activity);
      assert.equal((await call(uid,'/activity')).data.entries.length,2);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM migrations').get() as any).n,6);
    });
    await t.test('Requested account deletion removes activity before deleting assignments',async()=>{
      assert.equal((await call(uid,'/account/deletion','POST',{})).status,201);
      const child=spawnSync(process.execPath,['src/manage.ts','delete-requested-account',uid+'@example.test'],{cwd:new URL('..',import.meta.url),env:{...process.env,FF_MODE:'local-test',FF_DATA_DIR:dir},encoding:'utf8'});
      assert.equal(child.status,0,child.stderr);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM plan_activity WHERE user_id=?').get(uid) as any).n,0);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM assignments WHERE user_id=?').get(uid) as any).n,0);
      assert.equal(app.db.prepare('SELECT id FROM users WHERE id=?').get(uid),undefined);
    });
  } finally {await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
