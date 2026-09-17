import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {createApp} from '../src/server.ts';
import {passwordHash,totpSecret} from '../src/auth.ts';

test('Local default accepts passwords without email or MFA gates; strict mode remains available',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-local-login-')),password='local test password';
 let app=createApp({dataDir:dir,origin:'http://127.0.0.1:8086'});
 const savedSecret=totpSecret();
 app.db.prepare("INSERT INTO users(id,email,name,password,role,verified,totp_secret) VALUES('admin','alex@example.test','Alex',?,'admin',0,?)").run(passwordHash(password),savedSecret);
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 async function call(path:string,method='GET',body?:any,session?:any){return new Promise<any>((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port:(app.server.address() as any).port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8086',Origin:'http://127.0.0.1:8086','Content-Type':'application/json',Cookie:session?.cookie||'','X-CSRF-Token':session?.data.csrf||''}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(text),cookie:res.headers['set-cookie']?.[0].split(';')[0]}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });}
 const close=async()=>{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();};
 try{
  assert.equal((await call('/session')).data.requireVerification,false);
  assert.equal((await call('/auth/login','POST',{email:'alex@example.test',password:'wrong'})).status,401);
  const admin=await call('/auth/login','POST',{email:'alex@example.test',password});assert.equal(admin.status,200);assert.equal((await call('/admin/dashboard','GET',undefined,admin)).status,200);
  const registered=await call('/auth/register','POST',{email:'client@example.test',name:'Client',password,role:'admin'});assert.equal(registered.status,201);assert.equal(registered.data.requireVerification,false);
  assert.equal((app.db.prepare("SELECT COUNT(*) n FROM tokens WHERE kind='verify'").get() as any).n,0);
  const client=await call('/auth/login','POST',{email:'client@example.test',password});assert.equal(client.status,200);assert.equal(client.data.user.role,'client');assert.equal(client.data.user.verified,true);
  assert.equal((await call('/admin/dashboard','GET',undefined,client)).status,403);
  assert.equal((await call('/requests','POST',{service_id:'both',idempotency_key:'first',details:{goals:'Build strength',experience:'Beginner',equipment:'Dumbbells',availability:'Twice weekly',preferences:'Vegetarian'}},client)).status,201);
  assert.equal((app.db.prepare("SELECT verified FROM users WHERE id='admin'").get() as any).verified,0);
  assert.equal((app.db.prepare("SELECT totp_secret FROM users WHERE id='admin'").get() as any).totp_secret,savedSecret);
  await close();app=createApp({dataDir:dir,origin:'http://127.0.0.1:8086',requireVerification:true});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
  assert.equal((await call('/admin/dashboard','GET',undefined,admin)).status,401,'password-only sessions cannot be reused after strict verification is enabled');
  const strict=await call('/auth/login','POST',{email:'alex@example.test',password});assert.equal(strict.status,401);assert.equal(strict.data.code,'authenticator_required');
 }finally{await close();rmSync(dir,{recursive:true,force:true});}
});
