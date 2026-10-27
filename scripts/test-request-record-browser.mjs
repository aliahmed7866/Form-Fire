// Real Chromium layout + request-record smoke test. Uses a disposable fictional database.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createApp} from '../src/server.ts';
import {passwordHash} from '../src/auth.ts';
const {chromium}=await import(process.env.FF_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FF_PLAYWRIGHT_MODULE)).href:'playwright');
const dir=mkdtempSync(join(tmpdir(),'ff-record-ui-')),origin='http://127.0.0.1:8128';
const app=createApp({dataDir:dir,origin,requireVerification:false});
const password='fictional browser test password';
for(const [id,role] of [['alex','admin'],['sam','client'],['robin','client']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(id,id+'@example.test',id,passwordHash(password),role);
app.db.prepare("UPDATE contact_settings SET whatsapp_number='+447700900123',whatsapp_visibility='clients' WHERE id=1").run();
await new Promise(r=>app.server.listen(8128,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);
 await page.waitForFunction(()=>typeof api==='function');
 await page.evaluate(async password=>{await api('/auth/login','POST',{email:'sam@example.test',password});session=await api('/session');},password);
 const request=await page.evaluate(()=>api('/requests','POST',{service_id:'both',idempotency_key:'browser-request-record',details:{goals:'Build confidence',experience:'Starting out',availability:'Two evenings',preferences:'Easy meals',dietary:'None',notes:''}}));
 assert.ok(request.id,JSON.stringify(request));
 const go=async path=>{await page.evaluate(async path=>{location.hash=path;await render();},path);await page.waitForTimeout(100);};
 await go('/request/'+request.id);
 await page.getByRole('heading',{name:'Request record',exact:true}).waitFor();
 const whatsapp=page.getByRole('link',{name:/Continue on WhatsApp/});
 const url=new URL(await whatsapp.getAttribute('href'));assert.equal(url.host,'wa.me');assert.equal(url.pathname,'/447700900123');assert.ok(!url.href.includes('confidence'));
 assert.equal(await page.locator('.request-update-editor').getAttribute('open'),null);
 await page.getByText('Add a request update',{exact:true}).click();
 await page.getByLabel('Update for the shared record').fill('Agreed on WhatsApp: review the plan next week.');
 await page.getByRole('button',{name:'Save update',exact:false}).click();
 await page.locator('.request-record .reply').filter({hasText:'Agreed on WhatsApp'}).waitFor();
 await page.reload();await page.locator('.request-record .reply').filter({hasText:'Agreed on WhatsApp'}).waitFor();
 const output=process.env.FF_UI_SCREENSHOTS;if(output)mkdirSync(output,{recursive:true});
 for(const width of [320,390,768,1280]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/request/'+request.id,'/portal/requests','/portal','/portal/profile','/portal/contact','/enquire']){
   await go(path);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px overflow at ${path}`);
   const issues=await page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden';};
    const controls=[...document.querySelectorAll('main button,main a.button')].filter(visible);
    const problems=[];
    for(const e of controls){const r=e.getBoundingClientRect();if(r.x<-.5||r.right>innerWidth+.5)problems.push('Outside viewport: '+e.textContent.trim());if(e.scrollWidth>e.clientWidth+2)problems.push('Clipped label: '+e.textContent.trim());}
    for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)problems.push('Overlapping: '+controls[i].textContent.trim()+' / '+controls[j].textContent.trim());}
    return problems;
   });assert.deepEqual(issues,[],`${width}px ${path}`);
   if(output&&path==='/request/'+request.id)await page.screenshot({path:join(output,`request-${width}.png`),fullPage:true});
  }
 }
 // Admin sees the same saved record, and the client cannot read another client's request.
 await page.evaluate(async password=>{await api('/auth/logout','POST',{});await api('/auth/login','POST',{email:'alex@example.test',password});session=await api('/session');},password);
 await go('/request/'+request.id);await page.locator('.request-record .reply').filter({hasText:'Agreed on WhatsApp'}).waitFor();
 assert.equal(await page.getByRole('link',{name:/Continue on WhatsApp/}).count(),0);
 await page.evaluate(async password=>{await api('/auth/logout','POST',{});await api('/auth/login','POST',{email:'robin@example.test',password});session=await api('/session');},password);
 const denied=await page.evaluate(async id=>{const r=await fetch('/api/requests/'+id);return r.status;},request.id);assert.ok([403,404].includes(denied));
 assert.deepEqual(errors,[]);console.log('PASS: WhatsApp destination, shared-update save/reload/admin visibility, ownership, and 24 rendered layout checks.');
}finally{await browser?.close();await new Promise(r=>app.server.close(r));app.db.close();rmSync(dir,{recursive:true,force:true});}
