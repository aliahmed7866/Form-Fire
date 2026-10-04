// Optional real HTTP/SQLite UI regression. Supply FF_JSDOM_MODULE for a workspace install.
import assert from 'node:assert/strict';
import {runInContext} from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.ts';
import {passwordHash} from '../src/auth.ts';
import {saveMetric} from '../src/fitness.ts';

const {JSDOM}=await import(process.env.FF_JSDOM_MODULE?pathToFileURL(resolve(process.env.FF_JSDOM_MODULE)).href:'jsdom');
const dir=mkdtempSync(join(tmpdir(),'ff-fitness-dom-')),port=Number(process.env.FF_FITNESS_TEST_PORT||8116),origin=`http://127.0.0.1:${port}`;
const app=createApp({dataDir:dir,origin,requireVerification:true});
const user=randomUUID(),email='fitness-dom@example.test',password='Fictional password for progress DOM checks';
app.db.prepare('INSERT INTO users(id,email,name,password,role,verified,profile) VALUES(?,?,?,?,?,?,?)').run(user,email,'Fictional Rowan',passwordHash(password),'client',1,JSON.stringify({fitness_goal:'strength',units:'imperial',timezone:'UTC'}));
const today=new Date().toISOString().slice(0,10),day=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const fixture=(metric,value,offset,context='',reps=0)=>saveMetric(app.db,user,{day:day(offset),metric,value,unit:metric==='energy'?'/5':'kg',context,reps,notes:'Fictional fixture',idempotency_key:randomUUID()});
fixture('strength_load',50,-7,'squat',5);fixture('strength_load',55,-3,'squat',5);fixture('strength_load',40,-1,'bench press',8);const energyEntry=fixture('energy',2,-2);
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:origin,runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,evaluate=code=>runInContext(code,dom.getInternalVMContext());let cookie='';const errors=[];
w.addEventListener('error',e=>{errors.push(e.error||e.message);e.preventDefault();});
w.AbortController=AbortController;w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;w.confirm=()=>true;
w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
Object.defineProperty(w,'innerWidth',{value:390,writable:true});
w.fetch=async(path,options={})=>{const headers={...options.headers,Cookie:cookie};if(options.method&&options.method!=='GET')headers.Origin=origin;const response=await fetch(origin+path,{...options,headers});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];return response;};
const query=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)];
const go=async path=>{w.history.replaceState(null,'','#'+path);await evaluate('render()');assert.equal(query('#main [data-error-code]'),null,'Route must render: '+path+' '+query('#main [data-error-code]')?.textContent);};
const fill=(f,name,value)=>{const input=f.elements.namedItem(name);assert.ok(input,'Field exists: '+name);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));input.dispatchEvent(new w.Event('change',{bubbles:true}));return input;};
const until=async predicate=>{const end=Date.now()+5000;while(!predicate()){if(Date.now()>end)throw Error('Expected UI state did not appear');await new Promise(resolve=>setTimeout(resolve,10));}};
const submit=f=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{w.document.removeEventListener('ff:form-result',listener);reject(Error('Form submission timed out'));},5000);const listener=e=>{if(e.detail.form===f){clearTimeout(timeout);w.document.removeEventListener('ff:form-result',listener);resolve(e.detail);}};w.document.addEventListener('ff:form-result',listener);f.requestSubmit();});
try{
 for(const el of all('script[src]'))evaluate(readFileSync(new URL('../public/'+el.getAttribute('src').slice(1),import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'));
 await go('/login');let f=query('[data-form="login"]');fill(f,'email',email);fill(f,'password',password);assert.equal((await submit(f)).ok,true);await until(()=>query('.workspace-content'));
 await go('/portal/progress?metric=strength_load&series='+encodeURIComponent('["squat",5]'));
 f=query('[data-form="fitness-log"]');assert.equal(f.elements.metric.value,'strength_load');assert.equal(f.elements.context.value,'squat');assert.equal(f.elements.reps.value,'5');assert.equal(f.elements.value.value,'');assert.equal(f.elements.unit.value,'lb');
 assert.match(f.querySelector('[data-fitness-previous]').textContent,/121\.25 lb/);assert.match(f.querySelector('[data-fitness-previous]').textContent,new RegExp(day(-3)));
 query('[data-fitness-log-jump]').click();assert.equal(w.document.activeElement,query('#fitness-log h3'));
 const filter=query('[data-form="fitness-filter"]');fill(filter,'metric','energy');assert.equal(errors.length,0,'Changing chart metric must not access absent logging controls');assert.equal(f.elements.metric.value,'strength_load','Changing a filter must not discard the unsaved editor');
 assert.equal((await submit(filter)).ok,true);await until(()=>query('[data-form="fitness-log"]')?.elements.metric.value==='energy');
 f=query('[data-form="fitness-log"]');assert.equal(f.elements.value.value,'','Energy starts unanswered');assert.equal(f.elements.value.checkValidity(),false);assert.equal(f.querySelectorAll('[data-fitness-energy][aria-pressed="true"]').length,0);
 f.querySelector('[data-fitness-energy="4"]').click();assert.equal(f.elements.value.value,'4');assert.equal(f.querySelector('[data-fitness-energy="4"]').getAttribute('aria-pressed'),'true');assert.equal(new w.FormData(f).get('value'),'4');assert.equal(f.elements.value.checkValidity(),true);
 const before=app.db.prepare('SELECT COUNT(*) n FROM fitness_metrics WHERE user_id=?').get(user).n;assert.equal(before,4,'Choosing energy does not save');
 assert.equal((await submit(f)).ok,true);assert.equal(app.db.prepare("SELECT value FROM fitness_metrics WHERE user_id=? AND metric='energy' AND day=?").get(user,today).value,4);
 console.log('PROGRESS: FILTER CHANGE, CONTEXT-ALIGNED LOG FORM, EXPLICIT ENERGY AND REAL SAVE PASSED');

 await go('/portal/progress?metric=strength_load&series='+encodeURIComponent('["squat",5]'));f=query('[data-form="fitness-log"]');const key=f.elements.idempotency_key.value;fill(f,'notes','Today’s own note.');fill(f,'value','999');
 const repeat=[...f.querySelectorAll('[data-fitness-repeat]')].find(b=>b.textContent.includes('bench press'));assert.ok(repeat);repeat.click();
 assert.equal(f.elements.context.value,'bench press');assert.equal(f.elements.reps.value,'8');assert.equal(f.elements.value.value,'','Historical load must never become a new result');assert.equal(f.elements.day.value,today);assert.equal(f.elements.notes.value,'Today’s own note.');assert.equal(f.elements.idempotency_key.value,key);assert.equal(f.elements.unit.value,'lb');assert.equal(w.document.activeElement,f.elements.value);assert.match(f.querySelector('[data-fitness-previous]').textContent,/88\.18 lb/);
 assert.equal(app.db.prepare('SELECT COUNT(*) n FROM fitness_metrics WHERE user_id=?').get(user).n,5,'A shortcut does not save');
 fill(f,'day',day(-10));assert.doesNotMatch(f.querySelector('[data-fitness-previous]').textContent,/88\.18/,'Later records cannot be presented as earlier context');fill(f,'day',today);fill(f,'value','90');assert.equal((await submit(f)).ok,true);
 const saved=app.db.prepare("SELECT * FROM fitness_metrics WHERE user_id=? AND day=? AND metric='strength_load'").get(user,today);assert.equal(saved.context,'bench press');assert.equal(saved.reps,8);assert.equal(saved.value,40.8233);assert.equal(saved.notes,'Today’s own note.');
 console.log('PROGRESS: FAMILIAR SERIES, BLANK NEW LOAD, DATE-SCOPED CONTEXT AND CANONICAL UNIT SAVE PASSED');

 await go('/portal/progress?metric=energy');const edit=all('[data-form="fitness-edit"]').find(form=>form.elements.id.value===energyEntry.id);assert.ok(edit);for(let parent=edit.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
 assert.equal(edit.elements.value.value,'2');assert.equal(edit.querySelector('[data-fitness-energy="2"]').getAttribute('aria-pressed'),'true');assert.equal(edit.querySelector('[data-fitness-repeat]'),null);fill(edit,'notes','Corrected fictional note.');assert.equal((await submit(edit)).ok,true);
 assert.equal(app.db.prepare('SELECT value FROM fitness_metrics WHERE id=?').get(energyEntry.id).value,2,'Editing a note preserves the measurement');assert.equal(app.db.prepare('SELECT notes FROM fitness_metrics WHERE id=?').get(energyEntry.id).notes,'Corrected fictional note.');
 f=query('[data-form="fitness-log"]');fill(f,'metric','sleep_hours');assert.equal(f.querySelector('[data-fitness-energy]'),null);fill(f,'value','7.5');fill(f,'metric','energy');assert.equal(f.elements.value.value,'');assert.equal(f.elements.value.min,'1');assert.equal(f.elements.value.max,'5');assert.equal(f.elements.value.step,'1');assert.equal(f.querySelectorAll('[data-fitness-energy]').length,5);assert.equal(errors.length,0);
 console.log('PROGRESS: EDIT PRESERVATION, METRIC SWITCHING AND NO UI SCRIPT ERRORS PASSED');
}finally{w.close();await new Promise(resolve=>app.server.close(resolve));app.db.close();rmSync(dir,{recursive:true,force:true});}
