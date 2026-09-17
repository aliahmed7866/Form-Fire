import assert from 'node:assert/strict';
import {test} from 'node:test';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,statSync,symlinkSync,mkdtempSync,rmSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../src/server.ts';
import {totp,passwordHash,passwordOK} from '../src/auth.ts';
test('Complete demo credentials, recovery, preserved records and real client/admin journeys',async()=>{
const cwd=mkdtempSync(join(tmpdir(),'ff-demo-')),root=cwd+'/demo',appDir=fileURLToPath(new URL('../',import.meta.url)),script=appDir+'termux/demo.sh';
try{
const seed=(dir=root,action='seed',email='')=>spawnSync('bash',[script,action,appDir,email],{env:{...process.env,FF_DEMO_ROOT:dir,FF_DEMO_BIN:cwd+'/bin'},encoding:'utf8'});
let result=seed();assert.equal(result.status,0,result.stderr);
let creds=JSON.parse(readFileSync(root+'/demo-logins.json','utf8')).logins;
const db=new DatabaseSync(root+'/form-fire.sqlite');
const counts=()=>JSON.stringify(['users','requests','assignments','checkins','payments','invoices','plan_activity','shopping_progress'].map(t=>db.prepare('SELECT COUNT(*) n FROM '+t).get().n));
const before=counts(),loginsBefore=readFileSync(root+'/demo-logins.json','utf8');
db.prepare("UPDATE users SET admin_notes='PRESERVE MY EDIT' WHERE email='demo-sam@form-fire.example'").run();
result=seed();assert.equal(result.status,0,result.stderr);assert.equal(counts(),before);assert.equal(readFileSync(root+'/demo-logins.json','utf8'),loginsBefore);assert.equal(db.prepare("SELECT admin_notes FROM users WHERE email='demo-sam@form-fire.example'").get().admin_notes,'PRESERVE MY EDIT');
assert.equal(statSync(root+'/demo-logins.json').mode&0o777,0o600);
assert.equal(seed(root,'otp').status,0);assert.equal(seed(root,'codes').status,0);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
assert.equal(db.prepare('SELECT COUNT(*) n FROM assignments a JOIN requests r ON r.id=a.request_id WHERE a.created_at<r.created_at').get().n,0);
const samLogin=creds.find(c=>c.key==='sam'),oldPassword=samLogin.password;
db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash('changed password long enough'),samLogin.id);
result=seed(root,'logins',samLogin.email);assert.equal(result.status,0,result.stderr);assert.ok(!result.stdout.includes(oldPassword));assert.ok(result.stdout.includes('Password changed'));
result=seed(root,'recover',samLogin.email);assert.equal(result.status,0,result.stderr);assert.ok(result.stdout.includes('Private recovery code:'));assert.ok(db.prepare("SELECT token FROM outbox WHERE user_id=? AND kind='reset'").get(samLogin.id));
result=seed(root,'repair-logins','non-demo@example.test');assert.notEqual(result.status,0);
result=seed(root,'repair-logins',samLogin.email);assert.equal(result.status,0,result.stderr);
creds=JSON.parse(readFileSync(root+'/demo-logins.json','utf8')).logins;
assert.notEqual(creds.find(c=>c.key==='sam').password,oldPassword);
assert.ok(passwordOK(creds.find(c=>c.key==='sam').password,db.prepare('SELECT password FROM users WHERE id=?').get(samLogin.id).password));
assert.equal(counts(),before);assert.equal(db.prepare("SELECT admin_notes FROM users WHERE id=?").get(samLogin.id).admin_notes,'PRESERVE MY EDIT');
assert.equal(db.prepare("SELECT COUNT(*) n FROM outbox WHERE user_id=? AND kind='reset'").get(samLogin.id).n,0);
db.close();
mkdirSync(cwd+'/foreign-demo',{recursive:true});writeFileSync(cwd+'/foreign-demo/form-fire.sqlite','DO NOT CHANGE');result=seed(cwd+'/foreign-demo');assert.notEqual(result.status,0);assert.equal(readFileSync(cwd+'/foreign-demo/form-fire.sqlite','utf8'),'DO NOT CHANGE');
symlinkSync(root,cwd+'/symlink-demo','dir');result=seed(cwd+'/symlink-demo');assert.notEqual(result.status,0);
const app=createApp({dataDir:root,origin:'http://127.0.0.1:18086'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:18086',address='http://127.0.0.1:'+app.server.address().port;
function httpFetch(url,options){return new Promise((resolve,reject)=>{const req=request(url,options,res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:{get:()=>res.headers['set-cookie']?.[0]},json:async()=>JSON.parse(body)}));});req.on('error',reject);req.end(options.body);});}
async function login(key){const u=creds.find(c=>c.key===key);const r=await httpFetch(address+'/api/auth/login',{method:'POST',headers:{Host:'127.0.0.1:18086',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:u.password,...(u.secret?{otp:totp(u.secret)}:{})})});assert.equal(r.status,200);const data=await r.json();return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:data.csrf,user:data.user};}
async function call(session,path,method='GET',body){const r=await httpFetch(address+'/api'+path,{method,headers:{Host:'127.0.0.1:18086',Origin:origin,Cookie:session.cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};}
try{
 for(const account of creds)await login(account.key);
 const admin=await login('alex'),sam=await login('sam'),morgan=await login('morgan'),avery=await login('avery'),jordan=await login('jordan');
 const a=(await call(admin,'/admin/dashboard')).data;assert.equal(a.clients.length,9);assert.equal(a.requests.length,15);assert.equal(a.exercises.length,40);assert.equal(new Set(a.requests.map(r=>r.status)).size,6);
 const shopping=(await call(sam,'/shopping')).data.lists;assert.equal(shopping.length,1);assert.deepEqual(shopping[0].purchased,[1,3]);
 const tick=await call(sam,'/assignments/'+shopping[0].assignment_id+'/shopping','PUT',{revision:1,item_index:0,purchased:true});assert.equal(tick.status,200);assert.deepEqual(tick.data.purchased,[0,1,3]);
 assert.equal((await call(morgan,'/assignments/'+shopping[0].assignment_id)).status,404);assert.equal((await call(sam,'/admin/dashboard')).status,403);assert.equal((await call(jordan,'/shopping')).status,403);
 const samData=(await call(sam,'/dashboard')).data;assert.equal(samData.assignments.length,4);assert.equal(samData.checkins.length,3);assert.ok(samData.invoices.some(i=>i.refunded_minor===2000));
 const today=new Date().toISOString().slice(0,10),from=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
 const earnings=(await call(admin,'/admin/earnings?from='+from+'&to='+today)).data;
 assert.ok(earnings.rows.some(r=>r.currency==='EUR'));assert.ok(earnings.rows.some(r=>r.currency==='GBP'));assert.ok(earnings.rows.some(r=>r.refunded_minor>0));
 const chef=(await call(avery,'/dashboard')).data;assert.equal(chef.requests.length,5);const accepted=chef.requests.find(r=>r.booking_status==='accepted'),proposed=chef.requests.find(r=>r.booking_status==='proposed');
 assert.equal((await call(admin,'/requests/'+accepted.id+'/confirm','POST',{})).status,409);
 assert.equal((await call(avery,'/requests/'+proposed.id+'/accept','POST',{})).status,200);
 const casey=await login('casey'),caseyData=(await call(casey,'/dashboard')).data;const waiting=caseyData.requests[0];assert.equal(waiting.status,'awaiting_client_response');
 assert.equal((await call(casey,'/requests/'+waiting.id+'/reply','POST',{body:'DEMO: Tuesday would work.'})).status,201);assert.equal((await call(casey,'/requests/'+waiting.id)).data.status,'under_review');
 const jamie=await login('jamie'),jamieData=(await call(jamie,'/dashboard')).data;const newRequest=jamieData.requests.find(r=>r.status==='submitted');
 for(const status of ['under_review','approved'])assert.equal((await call(admin,'/requests/'+newRequest.id+'/status','POST',{status})).status,200);
 assert.equal((await call(admin,'/requests/'+newRequest.id+'/activate','POST',{active:true,package:'DEMO agreed package'})).status,200);
 const published=await call(admin,'/admin/assignments','POST',{request_id:newRequest.id,template_id:'demo-training',customisation:'DEMO personalised version'});assert.equal(published.status,201);assert.equal((await call(jamie,'/assignments/'+published.data.id)).status,200);
 assert.equal((await call(sam,'/assignments/'+published.data.id)).status,404);
 const verifyRow=app.db.prepare("SELECT token FROM outbox WHERE user_id=? AND kind='verify'").get(jordan.user.id);
 const verified=await call(jordan,'/auth/verify','POST',{token:verifyRow.token});assert.equal(verified.status,200);
 console.log('PASS: repeatability, preserved edits, private credentials, foreign-database/symlink refusal, foreign keys, admin/client login, role and owner isolation, shopping, check-ins, separate-currency earnings, chef payment gate and acceptance, request reply, complete review→activation→assignment→client view, verification.');
}finally{await new Promise(r=>app.server.close(r));app.db.close();}

}finally{rmSync(cwd,{recursive:true,force:true});}
});
