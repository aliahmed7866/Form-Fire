import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {whatsappNumber,instagramHandle,contactSettings} from '../src/contact.ts';
import {createApp} from '../src/server.ts';
import {openDb} from '../src/db.ts';
import {passwordHash} from '../src/auth.ts';

test('Contact addresses accept canonical profiles and reject unsafe or ambiguous destinations',()=>{
 assert.equal(whatsappNumber('+44 (7700) 900-123'),'+447700900123');
 assert.equal(whatsappNumber('https://wa.me/447700900123/'),'+447700900123');
 assert.equal(instagramHandle('https://www.instagram.com/Demo_Alex/'),'demo_alex');
 assert.equal(instagramHandle('@Demo.Alex'),'demo.alex');
 for(const s of ['javascript:alert(1)','https://wa.me.evil.test/447700900123','https://x@wa.me/447700900123','https://wa.me/447700900123?text=private','https://wa.me/447700900123#x','https://wa.me:8080/447700900123','07700900123','+44/7700900123','+0447700900123','+447700900123 ext4'])assert.throws(()=>whatsappNumber(s),undefined,s);
 for(const s of ['https://instagram.com.evil.test/alex','https://instagram.com@evil.test/alex','https://instagram.com/p/photo/','https://instagram.com/alex?igsh=tracking','https://instagram.com/%61lex/','https://instagram.com/alex/../direct','https://instagram.com\\@evil.test/alex','<img src=x>','a..b','.alex','alex.','a'.repeat(31)])assert.throws(()=>instagramHandle(s),undefined,s);
 assert.equal(whatsappNumber(''),'');assert.equal(instagramHandle(''),'');
});

test('Contact visibility, real authentication, conflict protection, audit and restart persistence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-contact-')),origin='http://127.0.0.1:8102',app=createApp({dataDir:dir,origin,requireVerification:false}),password='fictional contact test password';
 for(const [id,role]of [['alex','admin'],['sam','client'],['robin','client']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,0)').run(id,id+'@example.test',id,passwordHash(password),role);
 await new Promise<void>(r=>app.server.listen(8102,'127.0.0.1',r));
 const sessions:any={};
 async function call(who:string,path:string,method='GET',body?:any,extra:any={}){const response=await fetch(origin+'/api'+path,{method,headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',...(sessions[who]||{}),...extra},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();return {status:response.status,data,response};}
 try{
  assert.deepEqual((await call('','/contact')).data,{channels:[],response_note:''});
  assert.equal((await call('','/admin/contact')).status,401);
  for(const who of ['alex','sam','robin']){const r=await call('','/auth/login','POST',{email:who+'@example.test',password});assert.equal(r.status,200);sessions[who]={Cookie:r.response.headers.get('set-cookie')!.split(';')[0],'X-CSRF-Token':r.data.csrf};assert.equal(r.data.user.email_verified,false);assert.equal(r.data.user.verified,true);}
  let data={version:0,whatsapp_number:'+44 7700 900123',whatsapp_visibility:'clients',instagram_handle:'@demo_alex',instagram_visibility:'public',response_note:'Example hours only'};
  for(const who of ['sam','robin']){assert.equal((await call(who,'/admin/contact')).status,403);assert.equal((await call(who,'/admin/contact','PUT',data)).status,403);}
  assert.equal((await call('alex','/admin/contact','PUT',data,{'X-CSRF-Token':'bad'})).status,403);
  assert.equal((await call('alex','/admin/contact','PUT',data,{Origin:'https://evil.test'})).status,403);
  assert.equal((await call('alex','/admin/contact','PUT',{...data,whatsapp_number:'javascript:alert(1)'})).status,400);
  assert.equal(contactSettings(app.db).version,0);
  assert.equal((await call('alex','/admin/contact','PUT',data)).status,200);
  assert.equal((await call('alex','/admin/contact','PUT',data)).status,409);
  const publicView=(await call('','/contact')).data;assert.equal(publicView.channels.length,1);assert.equal(publicView.channels[0].kind,'instagram');assert.ok(!JSON.stringify(publicView).includes('447700'));
  for(const who of ['sam','robin']){const contact=(await call(who,'/contact')).data;assert.equal(contact.channels.length,2);assert.equal(contact.channels[0].url,'https://wa.me/447700900123');assert.ok(!contact.channels[0].url.includes('?'));}
  const audit=app.db.prepare("SELECT * FROM audit WHERE action='contact.settings'").all();assert.equal(audit.length,1);assert.ok(!JSON.stringify(audit).includes('447700'));assert.equal(audit[0].actor_id,'alex');
  const admin=(await call('alex','/admin/contact')).data;assert.equal(admin.preview.public.channels.length,1);assert.equal(admin.preview.client.channels.length,2);
  assert.equal((await call('alex','/admin/contact','PUT',{...data,version:1,whatsapp_visibility:'hidden',instagram_visibility:'hidden'})).status,200);
  for(const who of ['','sam','robin'])assert.deepEqual((await call(who,'/contact')).data,{channels:[],response_note:''});
  const db=openDb(dir);assert.equal(contactSettings(db).whatsapp_number,'+447700900123');assert.equal(contactSettings(db).version,2);assert.equal((db.prepare('SELECT COUNT(*) n FROM users').get() as any).n,3);db.close();
  assert.equal((await call('alex','/admin/contact','PUT',{...data,version:2,whatsapp_visibility:'public',whatsapp_number:''})).status,400);
  assert.equal((await call('alex','/admin/contact','PUT',{...data,version:2,response_note:'x'.repeat(281)})).status,400);
  assert.equal((await call('alex','/admin/contact','PUT',{...data,version:2,whatsapp_visibility:'hidden',instagram_visibility:'hidden',whatsapp_number:'',instagram_handle:'',response_note:''})).status,200);
  assert.equal(contactSettings(app.db).whatsapp_number,'');
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
