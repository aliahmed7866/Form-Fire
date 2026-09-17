import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.ts';
import { id } from '../src/db.ts';
import { digest } from '../src/auth.ts';
import { shoppingLines } from '../src/shopping.ts';

test('Shopping keeps quantities, duplicates and unusual characters exactly as published',()=>{
  assert.deepEqual(shoppingLines({shopping_list:' Rice 200g\r\n\nRice 200g\n<tomatoes> & herbs\n'}),['Rice 200g','Rice 200g','<tomatoes> & herbs']);
  assert.deepEqual(shoppingLines({}),[]);
});

test('Shopping lists persist, isolate owners, detect concurrent edits and follow immutable plan versions',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-shopping-')),origin='http://127.0.0.1:8085';
  let app=createApp({dataDir:dir,origin}),port=0;
  const listen=async()=>{await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));port=(app.server.address() as any).port;};
  const close=async()=>{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();};
  await listen();
  const owner=id(),other=id(),admin=id(),unverified=id(),rid=id();
  for(const [uid,role,verified] of [[owner,'client',1],[other,'client',1],[admin,'admin',1],[unverified,'client',0]]) {
    app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,?)').run(uid,uid+'@example.test','Test person','unused',role,verified);
    app.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(String(uid)),uid,'csrf',Date.now()+3600000);
  }
  app.db.prepare("INSERT INTO requests(id,user_id,service_id,kind,details,status,active,idempotency_key) VALUES(?,?,'both','coaching','{}','approved',1,?)").run(rid,owner,id());
  const call=async(who:string,path:string,method='GET',body?:any,headers:any={})=>new Promise<any>((done,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json','X-CSRF-Token':'csrf',Cookie:'ff_session='+who,...headers}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>done({status:res.statusCode,data:JSON.parse(raw)}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  const publish=async(template='starter-meals')=>{const r=await call(admin,'/admin/assignments','POST',{request_id:rid,template_id:template});assert.equal(r.status,201);return r.data.id;};
  let meal='',revision=0;
  const save=(who=owner,patch:any={},headers:any={})=>call(who,'/assignments/'+meal+'/shopping','PUT',{revision,item_index:0,purchased:true,...patch},headers);
  try {
    meal=await publish();
    await t.test('GET and PUT enforce client role, verification, ownership, CSRF and origin',async()=>{
      for(const [who,status] of [['',401],[admin,403],[unverified,403]] as const){assert.equal((await call(who,'/shopping')).status,status);assert.equal((await save(who)).status,status);}
      assert.deepEqual((await call(other,'/shopping')).data.lists,[]);
      assert.equal((await save(other)).status,404);
      assert.equal((await save(owner,{}, {'X-CSRF-Token':''})).status,403);
      assert.equal((await save(owner,{}, {Origin:'https://other.test'})).status,403);
      assert.equal((await call(other,'/assignments/'+meal+'/shopping/reset','POST',{revision})).status,404);
      const data=(await call(owner,'/shopping')).data.lists[0];assert.equal(data.assignment_id,meal);assert.equal(data.revision,0);assert.ok(data.items.length>1);
      for(const patch of [{item_index:-1},{item_index:1.5},{item_index:100000},{item_index:'0'},{purchased:1},{revision:-1},{revision:'0'}])assert.equal((await save(owner,patch)).status,400);
      const training=await publish('starter-training');assert.equal((await call(owner,'/assignments/'+training+'/shopping','PUT',{revision:0,item_index:0,purchased:true})).status,400);
    });
    await t.test('Item writes and reset use revisions to avoid silently losing another tab’s work',async()=>{
      let r=await save(owner,{user_id:other});assert.equal(r.status,200);assert.deepEqual(r.data.purchased,[0]);revision=r.data.revision;
      assert.equal((await save(owner,{revision:0,item_index:1})).status,409);
      assert.equal((await call(owner,'/assignments/'+meal+'/shopping/reset','POST',{revision:0})).status,409);
      r=await save(owner,{item_index:1});revision=r.data.revision;assert.deepEqual(r.data.purchased,[0,1]);
      r=await save(owner,{purchased:false});revision=r.data.revision;assert.deepEqual(r.data.purchased,[1]);
      r=await call(owner,'/assignments/'+meal+'/shopping/reset','POST',{revision});assert.equal(r.status,200);revision=r.data.revision;assert.deepEqual(r.data.purchased,[]);
      r=await save();revision=r.data.revision;
    });
    await t.test('Progress survives restart and exports only to its owner',async()=>{
      await close();app=createApp({dataDir:dir,origin});await listen();
      const list=(await call(owner,'/shopping')).data.lists[0];assert.deepEqual(list.purchased,[0]);assert.equal(list.revision,revision);
      const exported=(await call(owner,'/export')).data;assert.deepEqual(exported.shopping[0].purchased,[0]);assert.equal(exported.shopping[0].assignment_id,meal);
      assert.deepEqual((await call(other,'/export')).data.shopping,[]);
    });
    await t.test('Template edits preserve existing lists, new publication starts fresh, paused services reject writes',async()=>{
      const original=(await call(owner,'/shopping')).data.lists[0].items;
      const template=app.db.prepare("SELECT content FROM templates WHERE id='starter-meals'").get() as any;
      const content={...JSON.parse(template.content),shopping_list:'New ingredient 200g\nAnother ingredient'};
      app.db.prepare("UPDATE templates SET content=? WHERE id='starter-meals'").run(JSON.stringify(content));
      assert.deepEqual((await call(owner,'/shopping')).data.lists[0].items,original);
      const next=await publish();assert.equal((await save()).status,409);
      const current=(await call(owner,'/shopping')).data.lists[0];assert.equal(current.assignment_id,next);assert.deepEqual(current.purchased,[]);assert.deepEqual(current.items,['New ingredient 200g','Another ingredient']);
      assert.equal((await call(owner,'/export')).data.shopping[0].assignment_id,meal);
      meal=next;revision=0;
      app.db.prepare('UPDATE requests SET active=0 WHERE id=?').run(rid);
      assert.deepEqual((await call(owner,'/shopping')).data.lists,[]);assert.equal((await save()).status,409);
      app.db.prepare('UPDATE requests SET active=1 WHERE id=?').run(rid);assert.equal((await save()).status,200);
    });
    await t.test('Removing assignments or an owner removes their checklist records',async()=>{
      app.db.prepare('DELETE FROM assignments WHERE user_id=?').run(owner);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM shopping_progress').get() as any).n,0);
      const next=await publish();meal=next;revision=0;assert.equal((await save()).status,200);
      assert.equal((await call(owner,'/account/deletion','POST',{})).status,201);
      const removed=spawnSync(process.execPath,['src/manage.ts','delete-requested-account',owner+'@example.test'],{cwd:new URL('..',import.meta.url),env:{...process.env,FF_DATA_DIR:dir},encoding:'utf8'});
      assert.equal(removed.status,0,removed.stderr);
      assert.equal(app.db.prepare('SELECT id FROM users WHERE id=?').get(owner),undefined);
      assert.equal((app.db.prepare('SELECT COUNT(*) n FROM shopping_progress').get() as any).n,0);
    });
  }finally{await close();rmSync(dir,{recursive:true,force:true});}
});
