import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.ts';
import {request} from 'node:http';

test('New experience assets are served as their real files under the existing content policy',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-experience-assets-')),origin='http://127.0.0.1:18018';
 const app=createApp({dataDir:dir,origin,requireVerification:false});
 await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const address='http://127.0.0.1:'+(app.server.address() as any).port;
 const call=(path:string):Promise<Response>=>new Promise((resolve,reject)=>{
  const req=request(address+path,{headers:{Host:new URL(origin).host,Connection:'close'}},res=>{
   const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers as Record<string,string>})));
  });req.on('error',reject);req.end();
 });
 try{
  const index=await(await call('/')).text();
  for(const [filename,type] of [['client-experience.js','text/javascript'],['coach-workspace.js','text/javascript'],['client-experience.css','text/css'],['coach-workspace.css','text/css'],['navigation-experience.css','text/css'],['art-good-day.svg','image/svg+xml']]){
   const response=await call('/'+filename);assert.equal(response.status,200,filename);
   assert.ok(response.headers.get('content-type')?.startsWith(type),filename);
   assert.equal(await response.text(),readFileSync(new URL('../public/'+filename,import.meta.url),'utf8'));
   assert.match(response.headers.get('content-security-policy')||'',/script-src 'self'/);
   if(!filename.endsWith('.svg'))assert.ok(index.includes('/'+filename));
  }
  assert.equal((await call('/api/admin/dashboard')).status,401);
  const session=await(await call('/api/session')).json();assert.equal(session.requireVerification,false);
 }finally{await new Promise<void>(resolve=>app.server.close(()=>resolve()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
