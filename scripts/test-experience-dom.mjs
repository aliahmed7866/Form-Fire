// Optional integration check: real HTTP/SQLite saves with the app's current script tags.
// Provide FF_JSDOM_MODULE when jsdom is installed outside this repository.
import assert from 'node:assert/strict';
import {runInContext} from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.ts';
import {setupAdminTest,readAdminTestOTP} from '../src/admin-test.ts';
import {passwordHash} from '../src/auth.ts';

const {JSDOM}=await import(process.env.FF_JSDOM_MODULE?pathToFileURL(resolve(process.env.FF_JSDOM_MODULE)).href:'jsdom');
const dir=mkdtempSync(join(tmpdir(),'ff-experience-')),port=Number(process.env.FF_EXPERIENCE_TEST_PORT||8114),origin=`http://127.0.0.1:${port}`;
const app=createApp({dataDir:dir,origin,requireVerification:true});
const admin=setupAdminTest(app.db),password='Fictional client password for DOM testing';
const sam=app.db.prepare("SELECT * FROM users WHERE email='example-sam@form-fire.example'").get();
const jamie=app.db.prepare("SELECT * FROM users WHERE email='example-jamie@form-fire.example'").get();
app.db.prepare('UPDATE users SET password=?,profile=? WHERE id=?').run(passwordHash(password),JSON.stringify({timezone:'Europe/London',fitness_goal:'strength'}),sam.id);
app.db.prepare("UPDATE requests SET status='approved',active=1,package=? WHERE user_id=?").run(JSON.stringify({description:'Fictional fixture agreement'}),jamie.id);
// Five scheduled items exercise the first-three view and both disclosed groups.
for(const kind of ['training','meal']){
 const assignment=app.db.prepare('SELECT * FROM assignments WHERE user_id=? AND kind=?').get(sam.id,kind),snapshot=JSON.parse(assignment.snapshot);
 if(kind==='training')snapshot.workouts=Array.from({length:2},(_,i)=>({...snapshot.workouts[0],day:'Every day',name:'Fictional workout '+(i+1)}));
 else snapshot.meals=Array.from({length:3},(_,i)=>({...snapshot.meals[0],day:'Every day',slot:'Fictional meal '+(i+1)}));
 app.db.prepare('UPDATE assignments SET snapshot=? WHERE id=?').run(JSON.stringify(snapshot),assignment.id);
}
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:origin,runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,evaluate=code=>runInContext(code,dom.getInternalVMContext());let cookie='';
w.AbortController=AbortController;w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;w.confirm=()=>true;
w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
Object.defineProperty(w,'innerWidth',{value:390,writable:true});
w.fetch=async(path,options={})=>{
 const headers={...options.headers,Cookie:cookie};if(options.method&&options.method!=='GET')headers.Origin=origin;
 const response=await fetch(origin+path,{...options,headers});
 if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 return response;
};
const query=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)];
const go=async path=>{w.history.replaceState(null,'','#'+path);await evaluate('render()');assert.equal(query('#main [data-error-code]'),null,'Route must render without an application error: '+path);};
const fill=(f,name,value)=>{const input=f.elements.namedItem(name);assert.ok(input,'Expected field '+name);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));input.dispatchEvent(new w.Event('change',{bubbles:true}));return input;};
const until=async predicate=>{const end=Date.now()+5000;while(!predicate()){if(Date.now()>end)throw Error('Expected saved UI state did not appear');await new Promise(resolve=>setTimeout(resolve,10));}};
const submit=f=>new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{w.document.removeEventListener('ff:form-result',listener);reject(Error('Form submission timed out'));},5000);
 const listener=e=>{if(e.detail.form===f){clearTimeout(timeout);w.document.removeEventListener('ff:form-result',listener);resolve(e.detail);}};
 w.document.addEventListener('ff:form-result',listener);f.requestSubmit();
});
const signIn=async(email,pw,otp)=>{
 if(await evaluate('Boolean(session.user)')){await evaluate("api('/auth/logout','POST',{})");await evaluate('session={}');}
 await go('/login');let f=query('form[data-form="login"]');fill(f,'email',email);fill(f,'password',pw);
 let response=await submit(f);
 if(otp){assert.equal(response.ok,false);assert.equal(response.code,'authenticator_required');fill(f,'otp',otp());response=await submit(f);}
 assert.equal(response.ok,true,'Fixture account must sign in through normal controls');
 await until(()=>query('.workspace-content'));
};
const closedDisclosure=el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)return p;return null;};

try{
 for(const el of all('script[src]'))evaluate(readFileSync(new URL('../public/'+el.getAttribute('src').slice(1),import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'));
 const week=evaluate("checkinMonday('Europe/London')"),previous=evaluate(`dateShift(${JSON.stringify(week)},-7)`);
 app.db.prepare('DELETE FROM checkins WHERE user_id=?').run(sam.id);
 app.db.prepare('INSERT INTO checkins(id,user_id,week,progress,energy,notes,feedback) VALUES(?,?,?,?,3,?,?)').run(randomUUID(),sam.id,previous,'Fictional earlier update','','A saved earlier reply.');
 await signIn(sam.email,password);

 const expected=['','today','movement','progress','nutrition','recipes','planner','rhythm','learn','shopping','feel-good','requests','plans','checkins','money','contact','profile'].map(p=>'#/portal'+(p?'/'+p:''));
 assert.deepEqual(all('.client-primary-label').map(el=>el.textContent),['Today','Train','Eat','Progress','Account']);
 assert.deepEqual([...new Set(all('.workspace-nav a').map(a=>a.getAttribute('href')))].sort(),expected.sort());
 assert.equal(query('.workspace-nav a[href^="#/admin"]'),null,'Client navigation must stay within client destinations');
 query('[data-section-toggle]').click();assert.equal(query('[data-section-toggle]').getAttribute('aria-expanded'),'true');
 for(const group of all('.client-shortcut-group')){
  const summary=group.querySelector(':scope > summary');assert.equal(group.getAttribute('aria-labelledby'),summary.id);
  if(!group.open)summary.click();assert.equal(group.open,true);
  for(const anchor of group.querySelectorAll('a')){anchor.focus();assert.equal(w.document.activeElement,anchor);assert.equal(closedDisclosure(anchor),null);}
 }
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert.equal(query('[data-section-toggle]').getAttribute('aria-expanded'),'false');assert.equal(w.document.activeElement,query('[data-section-toggle]'));
 for(const path of expected){await go(path.slice(1));assert.ok(query('.workspace-content'),'Every retained destination must render');}
 console.log('NAVIGATION: FIVE PRIMARY LINKS, EVERY SECONDARY DESTINATION, DISCLOSURES AND ESCAPE FOCUS PASSED');
 await go('/portal/checkins');const retained=query('form[data-form="checkin"]');fill(retained,'progress','Unsent words stay while finding a task.');
 const taskSearch=query('[data-task-query]');taskSearch.focus();taskSearch.value='log food';taskSearch.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.ok(query('#workspace-task-results a[href="#/portal/nutrition"]'));
 assert.equal(query('#workspace-task-results a[href^="#/admin"]'),null);
 assert.equal(query('form[data-form="checkin"]'),retained);assert.equal(retained.elements.progress.value,'Unsent words stay while finding a task.');assert.equal(w.document.activeElement,taskSearch);
 taskSearch.value='no-such-task-zzz';taskSearch.dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(query('#workspace-task-count').textContent,/No matching shortcut/);
 taskSearch.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(taskSearch.value,'');assert.equal(query('#workspace-task-results').hidden,true);assert.equal(query('.workspace-nav').classList.contains('task-searching'),false);
 console.log('TASK FINDER: RELEVANT ROLE-ONLY LINKS, NO PAGE REPLACEMENT, PRESERVED WORDS AND CLEAR/ESCAPE RECOVERY PASSED');


 await go('/portal/today');
 const front=()=>all('.workspace-content > .daily-grid > .daily-item'),more=query('.daily-extras:not(.daily-recorded)');
 assert.equal(front().length,3);assert.equal(more.querySelectorAll('.daily-item').length,2);assert.equal(more.open,false);
 assert.deepEqual(front().map(card=>card.querySelector('[data-daily-action]').dataset.kind),['workout','workout','meal']);
 const before=query('[data-daily-action]'),key=before.closest('[data-daily-item]').dataset.dailyItem;
 before.focus();before.click();
 await until(()=>query(`[data-daily-item="${key}"].logged`)&&w.document.activeElement.dataset.dailyAction==='toggle');
 const saved=query(`[data-daily-item="${key}"]`),undo=saved.querySelector('[data-daily-action]');
 assert.ok(saved.closest('.daily-recorded'));assert.equal(saved.closest('.daily-recorded').open,true);
 assert.equal(closedDisclosure(undo),null);assert.equal(w.document.activeElement,undo);assert.match(undo.textContent,/Undo log/);
 assert.equal(front().length,3,'Logging should reveal the next remaining item');
 const logged=app.db.prepare('SELECT * FROM plan_activity WHERE user_id=?').all(sam.id);assert.equal(logged.length,1);
 assert.equal(logged[0].activity_date,undo.dataset.date);assert.equal(logged[0].timezone,'Europe/London');
 undo.click();await until(()=>!query(`[data-daily-item="${key}"].logged`)&&w.document.activeElement!==undo&&w.document.activeElement.dataset.dailyAction==='toggle');
 const restored=query(`[data-daily-item="${key}"] [data-daily-action]`);
 assert.equal(w.document.activeElement,restored);assert.equal(closedDisclosure(restored),null);assert.equal(query('.daily-recorded'),null);
 assert.equal(app.db.prepare('SELECT COUNT(*) n FROM plan_activity WHERE user_id=?').get(sam.id).n,0);
 await go('/portal/plans');await go('/portal/today');assert.equal(front().length,3);assert.equal(query('.daily-recorded'),null);
 console.log('TODAY: THREE REMAINING CARDS, SAVED DISCLOSURE, VISIBLE KEYBOARD FOCUS, PERSISTENCE AND UNDO PASSED');

 await go('/portal/checkins');const checkin=query('form[data-form="checkin"]');assert.ok(checkin);assert.equal(checkin.elements.week.value,week);
 fill(checkin,'progress','Fictional week: two comfortable sessions.');fill(checkin,'energy','4');fill(checkin,'notes','Please simplify next week.');
 assert.equal((await submit(checkin)).ok,true);assert.equal(query('form[data-form="checkin"]'),null);assert.ok(query('.checkin-saved'));
 const current=app.db.prepare('SELECT * FROM checkins WHERE user_id=? AND week=?').get(sam.id,week);
 assert.equal(current.progress,'Fictional week: two comfortable sessions.');assert.equal(current.notes,'Please simplify next week.');
 await go('/portal');await go('/portal/checkins');assert.equal(query('form[data-form="checkin"]'),null,'Reopening a saved week must not offer a duplicate submission');
 assert.equal(app.db.prepare('SELECT COUNT(*) n FROM checkins WHERE user_id=? AND week=?').get(sam.id,week).n,1);

 await signIn(admin.email,admin.password,()=>readAdminTestOTP(app.db));
 await go('/admin/checkins');assert.equal(all('.coach-checkin-card').length,1);assert.equal(query('form[data-form="feedback"]').elements.id.value,current.id);
 await go('/admin/checkins?status=all');assert.equal(all('.coach-checkin-card').length,2);
 await go('/admin/checkins?status=pending&client='+encodeURIComponent(sam.id));assert.equal(all('.coach-checkin-card').length,1);
 const feedback=query('form[data-form="feedback"]'),message='Let’s keep two familiar meals. <b>Plain text</b>';
 fill(feedback,'feedback',message);assert.equal((await submit(feedback)).ok,true);
 assert.equal(all('.coach-checkin-card').length,0,'Answered check-ins must leave the pending list');
 assert.equal(app.db.prepare('SELECT feedback FROM checkins WHERE id=?').get(current.id).feedback,message);
 await go('/admin/checkins?status=all&client='+encodeURIComponent(sam.id));assert.equal(all('.coach-checkin-card').length,2);
 assert.equal(all('.coach-checkin-card details').filter(el=>el.querySelector('form[data-form="feedback"]')).every(el=>!el.open),true,'Saved feedback editors should start collapsed');
 console.log('CHECK-INS: ONE SAVED WEEK, PENDING/ALL AND CLIENT FILTERS, FEEDBACK SAVED THROUGH NORMAL CONTROLS PASSED');

 await go('/admin/clients');
 const notes=all('form[data-form="client-notes"]').find(f=>f.elements.id.value===sam.id),card=notes.closest('[data-coach-client-card]'),notesPanel=notes.closest('details');
 notesPanel.open=true;const draft='Unsaved private note stays while filtering.';fill(notes,'admin_notes',draft);
 const search=query('[data-coach-client-search]');search.value=jamie.email;search.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(card.hidden,true);assert.equal(notes.isConnected,true);assert.equal(notes.elements.admin_notes.value,draft);
 search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(card.hidden,false);assert.equal(notes.closest('[data-coach-client-card]'),card);assert.equal(notesPanel.open,true);assert.equal(notes.elements.admin_notes.value,draft);
 assert.notEqual(app.db.prepare('SELECT admin_notes FROM users WHERE id=?').get(sam.id).admin_notes,draft,'Local search must not save a note');
 await go('/admin');const request=app.db.prepare('SELECT id FROM requests WHERE user_id=?').get(jamie.id).id;
 assert.ok(all('.coach-queue a').some(a=>a.getAttribute('href')==='#/admin/plans?view=publish&request='+encodeURIComponent(request)),'Missing plans should link to the relevant coaching request');
 await go('/admin/plans?view=publish');const requests=[...query('form[data-form="assignment"]').elements.request_id.options];assert.ok(requests.length>=2);
 const contextual=requests[1].value;
 await go('/admin/plans?view=publish&request='+encodeURIComponent(contextual));assert.equal(query('form[data-form="assignment"]').elements.request_id.value,contextual,'Contextual publishing must select the requested client, including a nondefault option');
 await go('/admin/plans?view=publish&request='+encodeURIComponent(request));assert.equal(query('form[data-form="assignment"]').elements.request_id.value,request);
 console.log('COACH WORKSPACE: LOCAL SEARCH RETAINS UNSAVED NOTES, QUEUE LINKS AND CONTEXTUAL PUBLISH SELECTION PASSED');

 await signIn(sam.email,password);await go('/portal/checkins');
 assert.equal(query('form[data-form="checkin"]'),null);assert.ok(all('.checkin-history .reply').some(el=>el.textContent.includes(message)));
 assert.equal(query('.checkin-history .reply b'),null,'Feedback markup must remain plain text');
 console.log('CLIENT FEEDBACK: SAVED RESPONSE REOPENED BESIDE THE WEEKLY UPDATE WITHOUT A DUPLICATE FORM PASSED');
}finally{w.close();await new Promise(resolve=>app.server.close(resolve));app.db.close();rmSync(dir,{recursive:true,force:true});}
