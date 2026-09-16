import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.ts';
import { id } from '../src/db.ts';
import { passwordHash, totpSecret, totp } from '../src/auth.ts';

const dir=mkdtempSync(join(tmpdir(),'form-fire-test-'));
const origin='http://127.0.0.1:8085';
const app=createApp({dataDir:dir,origin});
await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
const port=(app.server.address() as any).port;
class Client {
 cookie='';csrf='';
 async call(path:string,method='GET',body?:any,headers:any={}) {
  return await new Promise<any>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf,...headers}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];const data=JSON.parse(text);if(data.csrf)this.csrf=data.csrf;resolve({status:res.statusCode,data});});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
 }
}
const pw='test password long enough';
const admin=new Client(),alice=new Client(),bob=new Client(),anonymous=new Client();
let aid='',bid='',rid='',tid='',assigned='',chef='',invoice='';
const secret=totpSecret();
app.db.prepare("INSERT INTO users(id,email,name,password,role,verified,totp_secret) VALUES(?,?,?,?,'admin',1,?)").run(id(),'alex@example.test','Alex',passwordHash(pw),secret);
async function register(c:Client,email:string,name:string){assert.equal((await c.call('/auth/register','POST',{email,name,password:pw,role:'admin'})).status,201);const u=app.db.prepare('SELECT * FROM users WHERE email=?').get(email) as any;assert.equal(u.role,'client');const out=app.db.prepare("SELECT token FROM outbox WHERE user_id=? AND kind='verify'").get(u.id) as any;assert.equal((await c.call('/auth/verify','POST',{token:out.token})).status,200);assert.equal((await c.call('/auth/verify','POST',{token:out.token})).status,400);assert.equal((await c.call('/auth/login','POST',{email,password:pw})).status,200);return u.id;}
const details={goals:'Build strength',experience:'Beginner',equipment:'Dumbbells',availability:'Twice weekly',preferences:'Vegetarian'};
await test('FORM & FIRE integration journeys',async t=>{
 try {
 await t.test('Registration is client-only; verification is required; administrator MFA enforced',async()=>{
  assert.equal((await anonymous.call('/admin/dashboard')).status,401);
  assert.equal((await admin.call('/auth/login','POST',{email:'alex@example.test',password:pw})).status,401);
  assert.equal((await admin.call('/auth/login','POST',{email:'alex@example.test',password:pw,otp:totp(secret)})).status,200);
  aid=await register(alice,'alice@example.test','Alice');bid=await register(bob,'bob@example.test','Bob');
  const u=new Client();await u.call('/auth/register','POST',{name:'Unverified',email:'unverified@example.test',password:pw});await u.call('/auth/login','POST',{email:'unverified@example.test',password:pw});assert.equal((await u.call('/requests','POST',{service_id:'both',details,idempotency_key:id()})).status,403);
 });
 await t.test('Reject role escalation, origin forgery, missing CSRF and admin mutations from clients',async()=>{
  assert.equal((await alice.call('/admin/dashboard')).status,403);
  assert.equal((await alice.call('/admin/templates','POST',{})).status,403);
  assert.equal((await alice.call('/profile','PUT',{name:'Alice'},{Origin:'https://evil.test'})).status,403);
  assert.equal((await alice.call('/profile','PUT',{name:'Alice'},{'X-CSRF-Token':''})).status,403);
  assert.equal((await alice.call('/session','GET',undefined,{Host:'evil.test'})).status,403);
 });
 await t.test('Submit persists across sessions and duplicate submit creates only one request',async()=>{
  const key=id();const first=await alice.call('/requests','POST',{service_id:'both',details,idempotency_key:key});assert.equal(first.status,201);rid=first.data.id;
  const again=await alice.call('/requests','POST',{service_id:'both',details,idempotency_key:key});assert.equal(again.data.id,rid);
  assert.equal((await alice.call('/dashboard')).data.requests.length,1);
  assert.equal((await bob.call('/requests/'+rid)).status,404);
  assert.equal((await bob.call('/requests/'+rid+'/reply','POST',{body:'intrusion'})).status,404);
 });
 await t.test('Review transitions and replies; approval alone never activates service',async()=>{
  assert.equal((await admin.call('/requests/'+rid+'/status','POST',{status:'approved'})).status,409);
  assert.equal((await alice.call('/requests/'+rid+'/status','POST',{status:'under_review'})).status,403);
  for(const status of ['under_review','awaiting_client_response'])assert.equal((await admin.call('/requests/'+rid+'/status','POST',{status})).status,200);
  await admin.call('/requests/'+rid+'/reply','POST',{body:'Which two days suit you?'});
  await alice.call('/requests/'+rid+'/reply','POST',{body:'Monday and Thursday.'});
  assert.equal((await admin.call('/requests/'+rid)).data.status,'under_review');
  await admin.call('/requests/'+rid+'/status','POST',{status:'approved'});
  assert.equal((await alice.call('/requests/'+rid)).data.active,0);
  assert.equal((await admin.call('/requests/'+rid+'/activate','POST',{active:true,package:'Agreed local test coaching package'})).status,200);
 });
 await t.test('Recipe/template assignments have stable versions, customisation and direct API isolation',async()=>{
  const recipe=await admin.call('/admin/recipes','POST',{title:'Beans on toast',ingredients:'Beans\nBread',portions:'One portion',preparation:'Warm beans and toast bread.',substitutions:'Choose suitable bread.'});
  const content={schedule:'Monday to Sunday',guidance:'Enjoy your meals.',shopping_list:'Beans\nBread',recipe_ids:[recipe.data.id]};
  const template=await admin.call('/admin/templates','POST',{title:'A simple week',kind:'meal',content});assert.equal(template.status,200);tid=template.data.id;
  const assignment=await admin.call('/admin/assignments','POST',{request_id:rid,template_id:tid,customisation:'Use your preferred bread.'});assert.equal(assignment.status,201);assigned=assignment.data.id;
  assert.equal((await bob.call('/assignments/'+assigned)).status,404);
  assert.equal((await anonymous.call('/assignments/'+assigned)).status,401);
  const first=(await alice.call('/assignments/'+assigned)).data;assert.equal(first.snapshot.recipes[0].title,'Beans on toast');
  await admin.call('/admin/templates/'+tid,'PUT',{title:'Updated week',kind:'meal',version:1,content:{...content,guidance:'Changed template'}});
  const stable=(await alice.call('/assignments/'+assigned)).data;assert.deepEqual(stable,first);
  assert.equal((await admin.call('/admin/templates/'+tid,'PUT',{title:'Stale update',kind:'meal',version:1,content})).status,409);
  const second=await admin.call('/admin/assignments','POST',{request_id:rid,template_id:tid,customisation:''});assert.equal((await alice.call('/assignments/'+second.data.id)).data.version,2);
 });
 await t.test('Weekly check-in and feedback persist; check-ins require active service',async()=>{
  const payload={week:'2026-09-14',progress:'Two sessions done',energy:4,notes:'Feeling good',measurements:''};
  assert.equal((await bob.call('/checkins','POST',payload)).status,409);
  assert.equal((await alice.call('/checkins','POST',payload)).status,201);
  assert.equal((await alice.call('/checkins','POST',payload)).status,409);
  const c=(await alice.call('/dashboard')).data.checkins[0];await admin.call('/admin/checkins/'+c.id,'PUT',{feedback:'Great work finding your rhythm.'});
  assert.equal((await alice.call('/dashboard')).data.checkins[0].feedback,'Great work finding your rhythm.');assert.equal((await bob.call('/dashboard')).data.checkins.length,0);
 });
 await t.test('Private admin notes cannot appear in client dashboard or export',async()=>{
  await admin.call('/admin/clients/'+aid,'PUT',{admin_notes:'ADMIN-SECRET-ONLY'});
  for(const path of ['/dashboard','/export','/requests/'+rid])assert.ok(!JSON.stringify((await alice.call(path)).data).includes('ADMIN-SECRET-ONLY'));
 });
 await t.test('Manual payments are idempotent, bounded, currency separated and refunds distinct',async()=>{
  const inv=await admin.call('/admin/invoices','POST',{request_id:rid,description:'Agreed test package',amount_minor:10000,currency:'GBP'});assert.equal(inv.status,201);invoice=inv.data.id;
  const payment={invoice_id:invoice,kind:'payment',amount_minor:8000,event_key:id(),reference:'TEST-BANK-1'};
  assert.equal((await admin.call('/admin/payments','POST',payment)).status,201);assert.equal((await admin.call('/admin/payments','POST',payment)).data.duplicate,true);
  assert.equal((await admin.call('/admin/payments','POST',{...payment,amount_minor:7000})).status,409);
  assert.equal((await admin.call('/admin/payments','POST',{...payment,event_key:id(),amount_minor:3000})).status,409);
  await admin.call('/admin/payments','POST',{...payment,event_key:id(),kind:'refund',amount_minor:2000});
  assert.equal((await admin.call('/admin/payments','POST',{...payment,event_key:id(),kind:'refund',amount_minor:7000})).status,409);
  const euro=await admin.call('/admin/invoices','POST',{request_id:rid,description:'Separate test currency',amount_minor:5000,currency:'EUR'});await admin.call('/admin/payments','POST',{...payment,invoice_id:euro.data.id,event_key:id(),amount_minor:5000});
  const report=(await admin.call('/admin/earnings?from=2020-01-01&to=2099-12-31')).data;
  assert.equal(report.rows.length,2);const gbp=report.rows.find((x:any)=>x.currency==='GBP');assert.equal(gbp.paid_minor,8000);assert.equal(gbp.refunded_minor,2000);assert.equal(report.outstanding.find((i:any)=>i.id===invoice).outstanding_minor,2000);
  assert.equal((await bob.call('/dashboard')).data.invoices.length,0);
 });
 await t.test('Chef enquiry is not a booking: acceptance and required payment precede confirmation',async()=>{
  const response=await bob.call('/requests','POST',{service_id:'chef',idempotency_key:id(),details:{date:'2026-12-12',timezone:'Europe/London',location:'Test venue',guests:8,occasion:'Birthday',budget_minor:60000,currency:'GBP',dietary:'Vegetarian',notes:''}});assert.equal(response.status,201);chef=response.data.id;assert.equal(response.data.booking_status,'enquiry');
  for(const status of ['under_review','approved'])await admin.call('/requests/'+chef+'/status','POST',{status});
  await admin.call('/requests/'+chef+'/proposal','POST',{description:'Test private dining proposal',amount_minor:60000,currency:'GBP',payment_required:true});
  assert.equal((await admin.call('/requests/'+chef+'/accept','POST',{})).status,403);
  assert.equal((await admin.call('/requests/'+chef+'/confirm','POST',{})).status,409);
  assert.equal((await bob.call('/requests/'+chef+'/accept','POST',{})).status,200);
  assert.equal((await admin.call('/requests/'+chef+'/proposal','POST',{description:'Changed',amount_minor:60001,currency:'GBP'})).status,409);
  assert.equal((await admin.call('/requests/'+chef+'/confirm','POST',{})).status,409);
  const inv=await admin.call('/admin/invoices','POST',{request_id:chef,description:'Accepted chef proposal',amount_minor:60000,currency:'GBP'});
  await admin.call('/admin/payments','POST',{invoice_id:inv.data.id,kind:'payment',amount_minor:60000,event_key:id(),reference:'TEST-CHEF'});
  assert.equal((await admin.call('/requests/'+chef+'/confirm','POST',{})).status,200);assert.equal((await bob.call('/requests/'+chef)).data.booking_status,'confirmed');
 });
 await t.test('Account recovery tokens are single-use and revoke prior sessions',async()=>{
  await bob.call('/auth/recover','POST',{email:'bob@example.test'});const out=app.db.prepare("SELECT token FROM outbox WHERE user_id=? AND kind='reset'").get(bid) as any;
  assert.equal((await anonymous.call('/auth/reset','POST',{token:out.token,password:'a brand new password'})).status,200);
  assert.equal((await bob.call('/dashboard')).status,401);
  assert.equal((await anonymous.call('/auth/reset','POST',{token:out.token,password:'another password'})).status,400);
 });
 await t.test('Restart preserves requests, assignments and payments',async()=>{
  await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();const again=createApp({dataDir:dir,origin});assert.equal((again.db.prepare('SELECT status FROM requests WHERE id=?').get(rid) as any).status,'approved');assert.equal((again.db.prepare('SELECT COUNT(*) n FROM assignments').get() as any).n,2);assert.equal((again.db.prepare('SELECT COUNT(*) n FROM payments').get() as any).n,4);again.db.close();
 });
 }finally {try{app.server.close();app.db.close();}catch{}rmSync(dir,{recursive:true,force:true});}
});
