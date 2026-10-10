// Real HTTP/SQLite checks for recipe discovery and in-place favourite saves.
// Optional: FF_JSDOM_MODULE points to a jsdom installation outside this repository.
import assert from 'node:assert/strict';
import {runInContext} from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.ts';
import {setupAdminTest} from '../src/admin-test.ts';
import {passwordHash} from '../src/auth.ts';

const {JSDOM}=await import(process.env.FF_JSDOM_MODULE?pathToFileURL(resolve(process.env.FF_JSDOM_MODULE)).href:'jsdom');
const dir=mkdtempSync(join(tmpdir(),'ff-recipe-usability-')),port=Number(process.env.FF_NUTRITION_TEST_PORT||8116),origin=`http://127.0.0.1:${port}`;
const app=createApp({dataDir:dir,origin,requireVerification:true}),admin=setupAdminTest(app.db);
const user=app.db.prepare("SELECT * FROM users WHERE email='example-sam@form-fire.example'").get(),password='Recipe usability fixture password';
app.db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(password),user.id);
const otherUser=app.db.prepare("SELECT * FROM users WHERE email='example-jamie@form-fire.example'").get();app.db.prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash(password),otherUser.id);
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:origin,runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,evaluate=code=>runInContext(code,dom.getInternalVMContext());let cookie='',loseFavouriteResponse=false,holdFavourite=null,favouriteCalls=0,cateringPreviewCalls=0,failRecipeRead=false,holdDiary=null,diaryCalls=0,failDiary=false,loseDiaryResponse=false,holdDiaryRead=null,diaryReads=0,switchAccountOnSession=false;const recipeReads=[];
w.AbortController=AbortController;w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;w.confirm=()=>true;
w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
w.fetch=async(path,options={})=>{
 if(path==='/api/session'&&switchAccountOnSession){switchAccountOnSession=false;const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':evaluate('session.csrf')},body:JSON.stringify({email:otherUser.email,password})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];}

 if(/^\/api\/nutrition\/recipes\/[^/]+$/.test(path)){recipeReads.push(path);if(failRecipeRead)throw Error('Simulated recipe transport failure');}
 if(path==='/api/nutrition/catering-preview')cateringPreviewCalls++;
 if(path.startsWith('/api/nutrition/diary?')){diaryReads++;if(holdDiaryRead)await holdDiaryRead;}
 const diaryWrite=path.startsWith('/api/nutrition/diary')&&['POST','PUT'].includes(options.method);if(diaryWrite){diaryCalls++;if(holdDiary)await holdDiary;if(failDiary)throw Error('Simulated diary connection failure');}
 const favourite=path.includes('/favourite');if(favourite){favouriteCalls++;if(holdFavourite)await holdFavourite;}
 const headers={...options.headers,Cookie:cookie};if(options.method&&options.method!=='GET')headers.Origin=origin;
 const response=await fetch(origin+path,{...options,headers});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
 if(diaryWrite&&loseDiaryResponse){loseDiaryResponse=false;throw Error('Simulated lost diary response');}
 if(favourite&&loseFavouriteResponse){loseFavouriteResponse=false;throw Error('Simulated lost response');}return response;
};
const query=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)];
const until=async predicate=>{const end=Date.now()+5000;while(!predicate()){if(Date.now()>end)throw Error('Expected recipe state did not appear');await new Promise(resolve=>setTimeout(resolve,10));}};
const go=async path=>{w.history.replaceState(null,'','#'+path);await evaluate('render()');assert.equal(query('#main [data-error-code]'),null,'Route should render: '+path);};
const saved=id=>app.db.prepare('SELECT COUNT(*) n FROM recipe_favourites WHERE user_id=? AND recipe_id=?').get(user.id,id).n;
const submit=f=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{w.document.removeEventListener('ff:form-result',listener);reject(Error('Form submission timed out'));},5000);const listener=e=>{if(e.detail.form===f){clearTimeout(timeout);w.document.removeEventListener('ff:form-result',listener);resolve(e.detail);}};w.document.addEventListener('ff:form-result',listener);f.requestSubmit();});

try{
 for(const el of all('script[src]'))evaluate(readFileSync(new URL('../public/'+el.getAttribute('src').slice(1),import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'));
 await evaluate(`api('/auth/login','POST',{email:${JSON.stringify(user.email)},password:${JSON.stringify(password)}})`);
 await go('/portal/recipes?day=2026-09-28');
 assert.equal(query('.recipe-search-options').open,false,'First visit should lead with search, not advanced controls');
 assert.ok(query('form[data-form="nutrition-search"] input[name="q"]'));
 assert.equal(query('.recipe-active-filters'),null);
 assert.ok(query('.nutrition-recipe details.recipe-estimates'),'Estimates remain available on every recipe');

 await go('/portal/recipes?q=chicken&sort=protein&max_minutes=30&day=2026-09-28&offset=0');
 assert.equal(query('.recipe-search-options').open,true,'Applied refinements should remain discoverable');
 const chips=all('.recipe-active-filters a');assert.equal(chips.length,4);
 const removeTime=chips.find(a=>a.getAttribute('aria-label')==='Remove filter: Up to 30 minutes');
 const removed=new URLSearchParams(removeTime.hash.split('?')[1]);
 assert.equal(removed.get('q'),'chicken');assert.equal(removed.get('sort'),'protein');assert.equal(removed.get('day'),'2026-09-28');assert.equal(removed.has('offset'),false);assert.equal(removed.has('max_minutes'),false);
 const preset=all('.recipe-discovery-links a').find(a=>a.textContent.includes('15 minutes'));
 const presetParams=new URLSearchParams(preset.hash.split('?')[1]);assert.equal(presetParams.get('q'),'chicken');assert.equal(presetParams.get('max_minutes'),'15');assert.equal(presetParams.get('day'),'2026-09-28');
 const recipeLink=query('.nutrition-recipe a[href*="/portal/recipe?"]'),recipeRoute=recipeLink.hash.slice(1);
 assert.ok(recipeRoute.includes('catalogue='));await go(recipeRoute);
 const returnRoute=query('.back').hash.slice(1),backParams=new URLSearchParams(returnRoute.split('?')[1]);
 assert.equal(backParams.get('q'),'chicken');assert.equal(backParams.get('sort'),'protein');assert.equal(backParams.get('max_minutes'),'30');assert.equal(backParams.get('day'),'2026-09-28');
 assert.equal(query('form[data-form="nutrition-log"] input[name="day"]').value,'2026-09-28','Opening details must preserve the intended meal date');
 await go(returnRoute);
 const clear=query('.recipe-clear-filters');assert.deepEqual([...new URLSearchParams(clear.hash.split('?')[1])],[['day','2026-09-28']]);
 console.log('RECIPE DISCOVERY: OPTIONAL FILTERS, REMOVABLE CHIPS, COMBINED PRESETS, CLEAR AND DATE-AWARE BACK NAVIGATION PASSED');

 // Detours through kitchen, swaps and group quantities must return to the same search and day.
 const assertRecipeReturn=async()=>{const back=query('.back');const params=new URLSearchParams(back.hash.slice(back.hash.indexOf('?')+1));assert.equal(params.get('q'),'chicken');assert.equal(params.get('sort'),'protein');assert.equal(params.get('max_minutes'),'30');assert.equal(params.get('day'),'2026-09-28');};
 await go(recipeRoute);let tool=query('a[href*="/portal/cook?"]');assert.ok(tool);await go(tool.hash.slice(1));let backToMeal=query('.back').hash.slice(1);const kitchenPortion=all('[data-cooking-body] a').find(a=>a.textContent.includes('Plan or log'));assert.ok(kitchenPortion);assert.equal(kitchenPortion.hash.slice(1),backToMeal,'Main kitchen action must preserve the same context as Back');assert.equal(new URLSearchParams(backToMeal.split('?')[1]).get('day'),'2026-09-28');await go(backToMeal);await assertRecipeReturn();
 tool=query('.adaptation-launch a[href*="/portal/adapt?"]');assert.ok(tool);await go(tool.hash.slice(1));let swapOptions=query('form[data-form="adapt-options"]');assert.ok(swapOptions.elements.catalogue.value.includes('q=chicken'));swapOptions.elements.protein.value='lentil';assert.equal((await submit(swapOptions)).ok,true);await until(()=>!swapOptions.isConnected);assert.equal(new URLSearchParams(w.location.hash.split('?')[1]).get('protein'),'lentil');
 backToMeal=query('.back').hash.slice(1);await go(backToMeal);await assertRecipeReturn();
 tool=query('.adaptation-launch a[href*="/portal/catering?"]');assert.ok(tool);await go(tool.hash.slice(1));backToMeal=query('.back').hash.slice(1);await go(backToMeal);await assertRecipeReturn();
 // Save a fictional private adaptation; source filters are navigation-only and must not enter its POST.
 tool=query('.adaptation-launch a[href*="/portal/adapt?"]');await go(tool.hash.slice(1));const adaptedSave=query('form[data-form="adapt-save"]');assert.ok(adaptedSave);const previousFetch=w.fetch;let adaptedPayload;
 w.fetch=async(path,options={})=>{if(path==='/api/nutrition/adaptations')adaptedPayload=JSON.parse(options.body);return previousFetch(path,options);};assert.equal((await submit(adaptedSave)).ok,true);await until(()=>!adaptedSave.isConnected);w.fetch=previousFetch;assert.equal(Object.hasOwn(adaptedPayload,'catalogue'),false);assert.equal(query('form[data-form="nutrition-log"]').elements.day.value,'2026-09-28');await assertRecipeReturn();
 const selectedRecipeId=new URLSearchParams(recipeRoute.split('?')[1]).get('id');const planned=await evaluate(`api('/planner','POST',{recipe_id:${JSON.stringify(selectedRecipeId)},day:'2026-09-28',slot:'lunch',quantity:1,idempotency_key:crypto.randomUUID()})`);await go('/portal/cook?planned='+planned.id+'&day=2026-09-28');assert.equal(query('.back').hash,'#/portal/planner?day=2026-09-28','Planned meals still return to their planner');assert.ok(all('[data-cooking-body] a').some(a=>a.hash==='#/portal/planner?day=2026-09-28'));
 await go(returnRoute);
 console.log('RECIPE DETOURS: KITCHEN, SWAP PREVIEW, GROUP QUANTITIES AND SAVED COPY RETAIN SEARCH/FILTERS/DATE WITHOUT SERVER CONTEXT LEAKAGE PASSED');


 const button=query('[data-nutrition-favourite]'),id=button.dataset.nutritionFavourite,card=button.closest('[data-recipe-card]');
 app.db.prepare('DELETE FROM recipe_favourites WHERE user_id=? AND recipe_id=?').run(user.id,id);
 const firstButton=button;button.focus();let release;holdFavourite=new Promise(resolve=>release=resolve);
 button.click();button.click();assert.equal(button.disabled,true);assert.equal(favouriteCalls,1,'Repeated input during a save must not issue another write');
 release();holdFavourite=null;await until(()=>!button.disabled);
 assert.equal(saved(id),1);assert.equal(query('[data-nutrition-favourite]'),firstButton,'Saving must preserve the live card and page');
 assert.equal(w.document.activeElement,button);assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(card.querySelector('[role="status"]').textContent,/Saved to your favourites/);
 loseFavouriteResponse=true;button.click();await until(()=>!button.disabled);
 assert.equal(saved(id),0,'The simulated lost response happens after a real database commit');
 assert.equal(button.getAttribute('aria-pressed'),'true','Unknown result must not be presented as a confirmed save');
 assert.equal(button.dataset.value,'false','Retry must repeat the same desired state');
 assert.match(card.querySelector('[role="alert"]').textContent,/couldn’t confirm/);
 button.click();await until(()=>!button.disabled);assert.equal(saved(id),0);assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(card.querySelector('[role="alert"]').textContent,'');
 button.click();await until(()=>!button.disabled);assert.equal(saved(id),1);
 await go('/portal/recipes?favourites=1&day=2026-09-28');
 const savedButton=all('[data-nutrition-favourite]').find(b=>b.dataset.nutritionFavourite===id);assert.ok(savedButton);savedButton.focus();savedButton.click();await until(()=>!savedButton.disabled);
 assert.equal(saved(id),0);assert.ok(savedButton.isConnected,'Keep a removed recipe available to undo the decision');
 assert.equal(w.document.activeElement,savedButton);const refresh=savedButton.closest('[data-recipe-card]').querySelector('[data-recipe-refresh]');assert.ok(refresh);refresh.click();await until(()=>!refresh.isConnected);
 assert.equal(all('[data-nutrition-favourite]').some(b=>b.dataset.nutritionFavourite===id),false,'Refreshing saved results must reflect the account');
 await go('/portal/recipes');const departing=query('[data-nutrition-favourite]');departing.focus();
 holdFavourite=new Promise(resolve=>release=resolve);departing.click();await go('/portal/profile');
 const profileField=query('form input:not([type="hidden"])');profileField.focus();release();holdFavourite=null;await until(()=>!departing.disabled);
 assert.equal(w.document.activeElement,profileField,'Finishing a save after navigation must not steal focus');
 assert.equal(query('.recipe-save-status'),null,'Finishing a save must not inject the old card into another page');
 console.log('FAVOURITES: CONFIRMED IN-PLACE SAVE, FOCUS, DUPLICATE INPUT, LOST RESPONSE RETRY AND SAVED-LIST REFRESH PASSED');

 // Complete an old write after a newer route has been rendered and edited.
 await go('/portal/recipe?id='+id+'&day=2026-09-28');
 let diaryForm=query('form[data-form="nutrition-log"]'),key=diaryForm.elements.idempotency_key.value;
 let diaryBefore=diaryCalls;holdDiary=new Promise(resolve=>release=resolve);let sending=submit(diaryForm);
 await until(()=>diaryCalls===diaryBefore+1);assert.equal(diaryForm.getAttribute('aria-busy'),'true');assert.equal(diaryForm.elements.quantity.readOnly,true);assert.equal(diaryForm.elements.slot.disabled,true);
 const duplicate=new w.Event('submit',{bubbles:true,cancelable:true});diaryForm.dispatchEvent(duplicate);assert.equal(duplicate.defaultPrevented,true);assert.equal(diaryCalls,diaryBefore+1,'Repeated submit must not write twice');
 await go('/portal/profile');const newerProfile=query('form[data-form="profile"]'),newerName=newerProfile.elements.name;newerName.value='Unsent newer name';newerName.dispatchEvent(new w.Event('input',{bubbles:true}));newerName.focus();
 release();holdDiary=null;assert.equal((await sending).ok,true);
 assert.equal(w.location.hash,'#/portal/profile');assert.equal(query('form[data-form="profile"]'),newerProfile);assert.equal(newerName.value,'Unsent newer name');assert.equal(w.document.activeElement,newerName);
 assert.equal(app.db.prepare('SELECT COUNT(*) n FROM food_diary WHERE user_id=? AND idempotency_key=?').get(user.id,key).n,1,'Write still commits once after navigation');

 // Newer edits on the same rendered page survive, even without changing routes.
 await evaluate(`api('/nutrition/diary','POST',{kind:'recipe',source_id:${JSON.stringify(id)},day:'2026-09-28',slot:'dinner',quantity:1,idempotency_key:crypto.randomUUID()})`);
 await go('/portal/nutrition?day=2026-09-28');let edits=all('form[data-form="nutrition-edit"]');assert.ok(edits.length>=2);
 diaryForm=edits[0];const newerEdit=edits[1],editedId=diaryForm.elements.id.value,otherId=newerEdit.elements.id.value;diaryForm.closest('details').open=true;newerEdit.closest('details').open=true;
 diaryForm.elements.quantity.value='2';diaryForm.elements.quantity.dispatchEvent(new w.Event('input',{bubbles:true}));holdDiary=new Promise(resolve=>release=resolve);diaryBefore=diaryCalls;sending=submit(diaryForm);await until(()=>diaryCalls===diaryBefore+1);
 newerEdit.elements.quantity.value='3';newerEdit.elements.quantity.dispatchEvent(new w.Event('input',{bubbles:true}));newerEdit.elements.quantity.focus();release();holdDiary=null;assert.equal((await sending).ok,true);
 assert.equal(query(`form[data-form="nutrition-edit"] [name="id"][value="${otherId}"]`).form,newerEdit);assert.equal(newerEdit.elements.quantity.value,'3');assert.equal(w.document.activeElement,newerEdit.elements.quantity);
 assert.equal(diaryForm.getAttribute('data-form'),null,'Successful original form cannot submit the same entry again');assert.match(diaryForm.textContent,/other edits are still here/);
 assert.equal(app.db.prepare('SELECT quantity FROM food_diary WHERE id=?').get(editedId).quantity,2);assert.equal(app.db.prepare('SELECT quantity FROM food_diary WHERE id=?').get(otherId).quantity,1,'Typing is not an automatic save');
 assert.equal((await submit(newerEdit)).ok,true);await until(()=>!newerEdit.isConnected);assert.equal(app.db.prepare('SELECT quantity FROM food_diary WHERE id=?').get(otherId).quantity,3);

 // Editing while the follow-up read is pending must also cancel the DOM replacement.
 await go('/portal/nutrition?day=2026-09-28');edits=all('form[data-form="nutrition-edit"]');diaryForm=edits[0];const refreshEdit=edits[1];diaryForm.closest('details').open=true;refreshEdit.closest('details').open=true;
 diaryForm.elements.quantity.value='4';diaryForm.elements.quantity.dispatchEvent(new w.Event('input',{bubbles:true}));let beforeDiaryReads=diaryReads;holdDiaryRead=new Promise(resolve=>release=resolve);sending=submit(diaryForm);await until(()=>diaryReads>beforeDiaryReads);
 refreshEdit.elements.quantity.value='5';refreshEdit.elements.quantity.dispatchEvent(new w.Event('input',{bubbles:true}));refreshEdit.elements.quantity.focus();release();holdDiaryRead=null;assert.equal((await sending).ok,true);
 assert.equal(refreshEdit.isConnected,true);assert.equal(refreshEdit.elements.quantity.value,'5');assert.equal(w.document.activeElement,refreshEdit.elements.quantity);assert.match(diaryForm.textContent,/other edits are still here/);

 // A failed request restores every control and keeps the same retry key and entered data.
 await go('/portal/recipe?id='+id+'&day=2026-09-29');diaryForm=query('form[data-form="nutrition-log"]');key=diaryForm.elements.idempotency_key.value;diaryForm.elements.quantity.value='2';failDiary=true;
 assert.equal((await submit(diaryForm)).ok,false);assert.equal(diaryForm.elements.quantity.value,'2');assert.equal(diaryForm.elements.quantity.readOnly,false);assert.equal(diaryForm.elements.slot.disabled,false);assert.equal(diaryForm.getAttribute('aria-busy'),null);assert.equal(diaryForm.elements.idempotency_key.value,key);
 assert.equal(app.db.prepare('SELECT COUNT(*) n FROM food_diary WHERE idempotency_key=?').get(key).n,0);failDiary=false;loseDiaryResponse=true;
 assert.equal((await submit(diaryForm)).ok,false);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM food_diary WHERE idempotency_key=?').get(key).n,1,'Lost response follows the real commit');
 assert.equal((await submit(diaryForm)).ok,true);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM food_diary WHERE idempotency_key=?').get(key).n,1,'Retry cannot duplicate the saved entry');

 // Failed older saves must not scroll or focus a newly opened form.
 await go('/portal/recipe?id='+id+'&day=2026-09-30');diaryForm=query('form[data-form="nutrition-log"]');holdDiary=new Promise(resolve=>release=resolve);diaryBefore=diaryCalls;failDiary=true;sending=submit(diaryForm);await until(()=>diaryCalls===diaryBefore+1);
 await go('/portal/profile');const failureName=query('form[data-form="profile"]').elements.name;failureName.focus();let oldScroll=0;diaryForm.querySelector('.error').scrollIntoView=()=>{oldScroll++;};release();holdDiary=null;assert.equal((await sending).ok,false);failDiary=false;
 assert.equal(w.location.hash,'#/portal/profile');assert.equal(w.document.activeElement,failureName);assert.equal(oldScroll,0);assert.match(query('#toast').textContent,/wasn’t confirmed/);
 // The session refresh may discover another tab switched accounts after the write.
 await go('/portal/nutrition?day=2026-09-28');diaryForm=query('form[data-form="nutrition-edit"]');const oldAccountId=diaryForm.elements.id.value;diaryForm.closest('details').open=true;diaryForm.elements.quantity.value='6';switchAccountOnSession=true;
 assert.equal((await submit(diaryForm)).ok,true);assert.equal(evaluate('session.user.id'),otherUser.id);assert.equal(diaryForm.isConnected,false,'Old-account inputs must be removed despite the refresh guard');assert.equal(query(`[name="id"][value="${oldAccountId}"]`),null);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM food_diary WHERE user_id=?').get(otherUser.id).n,0);assert.match(query('#toast').textContent,/account changed/);
 await evaluate(`api('/auth/login','POST',{email:${JSON.stringify(user.email)},password:${JSON.stringify(password)}})`);await go('/portal');
 console.log('DIARY SAVES: NEWER ROUTES/EDITS, REPEATED SUBMITS, COMMITTED DATA, FAILURE RECOVERY AND LOST-RESPONSE RETRY PASSED');


 await go('/portal/recipe?id=starter-oats&day=2026-09-28');
 assert.equal(query('.adaptation-launch a[href*="/catering?"]'),null,'An unmeasured recipe must not offer a broken group-quantity action');
 assert.match(query('.adaptation-launch').textContent,/Group quantities need measured ingredients/);
 let beforePreview=cateringPreviewCalls;
 await go('/portal/catering?id=starter-oats&day=2026-09-28');
 assert.equal(cateringPreviewCalls,beforePreview,'Unavailable recipes must not call the failing preview endpoint');
 assert.ok(query('[data-catering-unavailable]'));assert.ok(query('[data-catering-unavailable] a[href="#/portal/requests"]'));
 assert.equal(query('[data-form="adapt-catering-preview"]'),null);assert.equal(evaluate('activeCatering'),null);
 const groupBack=new URLSearchParams(query('.back').hash.split('?')[1]);assert.equal(groupBack.get('id'),'starter-oats');assert.equal(groupBack.get('day'),'2026-09-28');
 w.history.replaceState(null,'','#/portal/catering?id=missing-recipe');
 await assert.rejects(evaluate('recipeCateringPage()'),/Recipe not found/,'A missing recipe must keep the actual server error');
 w.history.replaceState(null,'','#/portal/catering?id=starter-oats');failRecipeRead=true;
 await assert.rejects(evaluate('recipeCateringPage()'),/network|reach|connection|transport/i,'A transport error must not become an unavailable-ingredients message');failRecipeRead=false;

 const available=app.db.prepare("SELECT id FROM recipes WHERE archived=0 AND client_id IS NULL AND nutrition IS NOT NULL AND json_array_length(ingredient_items)>0 LIMIT 1").get();assert.ok(available);
 await go('/portal/catering?id='+available.id+'&day=2026-09-28');assert.ok(query('[data-form="adapt-catering-preview"]'));
 assert.equal(query('[data-catering-unavailable]'),null);assert.ok(query('.catering-ingredient'));
 const quantities=query('[data-form="adapt-catering-preview"]');quantities.elements.original.value='3';assert.equal((await submit(quantities)).ok,true);
 assert.equal(query('[data-form="adapt-catering-save"] [name="original"]').value,'3');assert.equal(query('[data-form="adapt-catering-save"] [name="day"]').value,'2026-09-28');
 console.log('GROUP QUANTITIES: CLEAR UNAVAILABLE HANDOFF, DATE-AWARE BACK, REAL ERRORS AND AVAILABLE BATCH PREVIEW PASSED');

 // A coach can calculate group quantities for a personal recipe, unlike the client-facing recipe GET.
 app.db.prepare('UPDATE recipes SET client_id=? WHERE id=?').run(user.id,available.id);
 await evaluate(`api('/auth/login','POST',${JSON.stringify({email:admin.email,password:admin.password,otp:admin.currentOTP})})`);
 const beforeReads=recipeReads.length;await go('/admin/catering?id='+available.id);
 assert.equal(recipeReads.length,beforeReads,'Admin personal recipes must not use the client-only recipe GET');
 assert.ok(query('[data-form="adapt-catering-preview"]'));assert.ok(query('.catering-ingredient'));
 beforePreview=cateringPreviewCalls;await go('/admin/catering?id=starter-oats');
 assert.equal(cateringPreviewCalls,beforePreview);assert.ok(query('[data-catering-unavailable] a[href="#/admin/plans?view=recipes"]'));
 assert.doesNotMatch(evaluate('adminAdaptationLinks(adminData.recipes.find(r=>r.id==="starter-oats"))'),/href="[^\"]*\/catering\?/);
 w.history.replaceState(null,'','#/admin/catering?id=missing-recipe');await assert.rejects(evaluate('recipeCateringPage(true)'),/Recipe not found/);
 console.log('COACH GROUP QUANTITIES: PRIVATE RECIPE ACCESS, UNAVAILABLE EDITOR HANDOFF AND TRUE MISSING-RECIPE ERRORS PASSED');
}finally{
 dom.window.close();app.server.closeAllConnections?.();await new Promise(resolve=>app.server.close(resolve));app.db.close();rmSync(dir,{recursive:true,force:true});
}
