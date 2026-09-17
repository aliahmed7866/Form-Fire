import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.ts';
import {passwordHash} from '../src/auth.ts';
import {instanceCookie} from '../src/instance.ts';

test('Main and demo sessions coexist in a real shared cookie jar; logout and stale CSRF stay isolated',async()=>{
 const root=mkdtempSync(join(tmpdir(),'ff-instances-')),jar=new Map<string,string>();
 const apps=[8085,8086].map(port=>createApp({requireVerification:true,dataDir:join(root,String(port)),origin:`http://127.0.0.1:${port}`}));
 const password='a private test password';
 for(const [i,app] of apps.entries()){
  app.db.prepare("INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,'client',1)").run('user-'+i,'same@example.test','Person '+i,passwordHash(password));
  await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 }
 async function call(i:number,path:string,method='GET',body?:any,csrf=''){
  return new Promise<any>((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port:(apps[i].server.address() as any).port,path,method,headers:{Host:`127.0.0.1:${8085+i}`,Origin:`http://127.0.0.1:${8085+i}`,'Content-Type':'application/json',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),'X-CSRF-Token':csrf}},res=>{
    for(const cookie of res.headers['set-cookie']||[]){const pair=cookie.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}
    let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text)}));
   });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
 }
 try{
  apps[1].db.prepare('INSERT INTO content_packs(id) VALUES(?)').run('form-fire-complete-fictional-demo-v1');
  const sessions=[];
  for(let i=0;i<2;i++){const r=await call(i,'/api/auth/login','POST',{email:'same@example.test',password});assert.equal(r.status,200);sessions.push(r.data);}
  assert.deepEqual([...jar.keys()],['ff_session','ff_session_8086']);
  for(let i=0;i<2;i++)assert.equal((await call(i,'/api/session')).data.user.id,'user-'+i);
  const wrong=await call(1,'/api/profile','PUT',{name:'Must not save'},sessions[0].csrf);
  assert.equal(wrong.status,403);assert.equal(wrong.data.code,'session_changed');
  assert.equal((apps[1].db.prepare('SELECT name FROM users').get() as any).name,'Person 1');
  const refreshed=(await call(1,'/api/session')).data;
  assert.equal((await call(1,'/api/profile','PUT',{name:'Demo only'},refreshed.csrf)).status,200);
  assert.equal((await call(1,'/api/auth/logout','POST',{},refreshed.csrf)).status,200);
  assert.equal((await call(1,'/api/session')).data.user,null);
  assert.equal((await call(0,'/api/session')).data.user.id,'user-0');
  const first=(await call(0,'/health')).data.instance,second=(await call(1,'/health')).data.instance;
  assert.notEqual(first.id,second.id);assert.equal(first.origin,'http://127.0.0.1:8085');assert.equal(second.origin,'http://127.0.0.1:8086');
  assert.notEqual(instanceCookie(first.origin,'ff_google'),instanceCookie(second.origin,'ff_google'));
 }finally{for(const app of apps){await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();}rmSync(root,{recursive:true,force:true});}
});
