import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {request} from 'node:http';
import {createApp} from '../src/server.ts';

test('Short coaching enquiry saves only needed answers and keeps validation, ownership and duplicate protection',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-short-enquiry-')),origin='http://127.0.0.1:8104',app=createApp({dataDir:dir,origin,requireVerification:false});
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
 const call=(path:string,method='GET',body?:any,session?:any)=>new Promise<any>((ok,no)=>{const req=request({hostname:'127.0.0.1',port:(app.server.address() as any).port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8104',Origin:origin,'Content-Type':'application/json',Cookie:session?.cookie||'','X-CSRF-Token':session?.data.csrf||''}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>ok({status:res.statusCode,data:JSON.parse(text),cookie:res.headers['set-cookie']?.[0].split(';')[0]}));});req.on('error',no);req.end(body?JSON.stringify(body):undefined);});
 try{
  const credentials={email:'short-enquiry@example.test',name:'Sam',password:'fictional test password'};
  await call('/auth/register','POST',credentials);const client=await call('/auth/login','POST',credentials);
  const body={service_id:'both',idempotency_key:'short-enquiry',details:{goals:'Find a routine I enjoy.'}};
  assert.equal((await call('/requests','POST',body)).status,401);
  const saved=await call('/requests','POST',body,client);assert.equal(saved.status,201);assert.deepEqual(saved.data.details,{goals:body.details.goals,experience:'',equipment:'',availability:'',preferences:''});
  assert.equal((await call('/requests','POST',body,client)).data.id,saved.data.id);assert.equal((app.db.prepare('SELECT COUNT(*) n FROM requests').get() as any).n,1);
  for(const details of [{goals:''},{goals:'Help',experience:'x'.repeat(2001)},{goals:'Help',equipment:{invalid:true}}])assert.equal((await call('/requests','POST',{...body,idempotency_key:JSON.stringify(details).slice(0,90),details},client)).status,400);
  assert.equal((await call('/requests','POST',{...body,service_id:'chef',idempotency_key:'chef-missing-details'},client)).status,400,'chef booking requirements stay mandatory');
  const other={...credentials,email:'other-short@example.test'};await call('/auth/register','POST',other);const second=await call('/auth/login','POST',other);assert.equal((await call('/requests/'+saved.data.id,'GET',undefined,second)).status,404);
  assert.equal((await call('/requests/'+saved.data.id,'GET',undefined,client)).data.details.goals,body.details.goals);
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
