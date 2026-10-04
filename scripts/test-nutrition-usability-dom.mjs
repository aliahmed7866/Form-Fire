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
await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
const dom=new JSDOM(readFileSync(new URL('../public/index.html',import.meta.url),'utf8'),{url:origin,runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,evaluate=code=>runInContext(code,dom.getInternalVMContext());let cookie='',loseFavouriteResponse=false,holdFavourite=null,favouriteCalls=0,cateringPreviewCalls=0,failRecipeRead=false;const recipeReads=[];
w.AbortController=AbortController;w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;w.confirm=()=>true;
w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};
w.fetch=async(path,options={})=>{
 if(/^\/api\/nutrition\/recipes\/[^/]+$/.test(path)){recipeReads.push(path);if(failRecipeRead)throw Error('Simulated recipe transport failure');}
 if(path==='/api/nutrition/catering-preview')cateringPreviewCalls++;
 const favourite=path.includes('/favourite');if(favourite){favouriteCalls++;if(holdFavourite)await holdFavourite;}
 const headers={...options.headers,Cookie:cookie};if(options.method&&options.method!=='GET')headers.Origin=origin;
 const response=await fetch(origin+path,{...options,headers});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
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
