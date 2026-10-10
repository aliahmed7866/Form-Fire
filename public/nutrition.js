/* Nutrition stays optional: no automatic deficit, food scores or exercise offsets. */
let nutritionFoods=[];
const nutritionLabels={kcal:'kcal',protein_g:'Protein',carbs_g:'Carbs',fat_g:'Fat',fibre_g:'Fibre'};
const localNutritionDay=()=>{const d=new Date(),timezone=session.user?.profile?.timezone;try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone||'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d),value=type=>parts.find(p=>p.type===type).value;return `${value('year')}-${value('month')}-${value('day')}`;}catch{return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}};
async function ensureNutritionFoods(){if(!nutritionFoods.length)nutritionFoods=(await api('/nutrition/foods?all=1')).foods;}
function nutritionMacros(n){return n?`<dl class="nutrition-macros">${Object.entries(nutritionLabels).map(([k,v])=>`<div><dt>${v}</dt><dd>${n[k]===null?'Unknown':esc(n[k])+(k==='kcal'?'':'g')}</dd></div>`).join('')}</dl><p class="micro">Estimated per serving · ${esc(n.source||'UK CoFID 2021')}</p>`:'<p class="micro">Nutrition has not been calculated for this recipe.</p>';}
const nutritionFoodLabel=f=>f.name+' · '+f.source_code;
function nutritionIngredientRow(i={}){return `<div class="nutrition-ingredient"><label>Food (match its raw / cooked state)<input list="nutrition-food-options" data-nutrition-food value="${esc(nutritionFoods.find(f=>f.id===i.food_id)?nutritionFoodLabel(nutritionFoods.find(f=>f.id===i.food_id)):i.name||'')}" required autocomplete="off"></label><label>Grams<input type="number" data-nutrition-grams value="${i.grams??100}" min="0.01" max="10000" step="0.01" required></label><button type="button" class="secondary small" data-nutrition-remove-ingredient>Remove</button></div>`;}
function recipeNutritionFields(r){return `<fieldset><legend>Ingredient-based nutrition</legend><p class="micro">Choose the matching food entry and its edible weight. Macros recalculate when you save. These ingredients replace the free-text ingredient list.</p><datalist id="nutrition-food-options">${nutritionFoods.map(f=>`<option value="${esc(nutritionFoodLabel(f))}"></option>`).join('')}</datalist><div data-nutrition-ingredients>${(r.ingredient_items||[]).map(nutritionIngredientRow).join('')}</div><button type="button" class="secondary small" data-nutrition-add-ingredient>+ Add ingredient</button>${field('yield_servings','Number of servings in the whole recipe',r.yield_servings||1,'number','required min="0.25" max="100" step="0.25"')}${nutritionMacros(r.nutrition)}</fieldset>${field('prep_minutes','Preparation time (minutes)',r.prep_minutes||20,'number','required min="1" max="600"')}${field('tags_text','Tags (comma separated)',(r.tags||[]).join(', '),'text','maxlength="400"')}${select('client_id','Who can browse this recipe?',[['','All clients'],...(adminData?.clients||[]).map(c=>[c.id,c.name+' · personal recipe'])],r.client_id||'')}<p class="micro">For a personal adjustment, duplicate a recipe and choose the client. Their copy can be edited without changing the shared recipe.</p>`;}
function collectRecipeNutrition(f){const rows=[...f.querySelectorAll('.nutrition-ingredient')];return {ingredient_items:rows.map(row=>{const name=row.querySelector('[data-nutrition-food]').value;const food=nutritionFoods.find(f=>nutritionFoodLabel(f)===name);if(!food)throw Error('Choose each ingredient from the food library.');return {food_id:food.id,grams:Number(row.querySelector('[data-nutrition-grams]').value)};}),yield_servings:Number(f.elements.yield_servings.value),prep_minutes:Number(f.elements.prep_minutes.value),tags:f.elements.tags_text.value.split(',').map(t=>t.trim()).filter(Boolean),client_id:f.elements.client_id.value||null};}
function nutritionDateForm(day,kind='nutrition-date'){return form(kind,field('day','Diary date',day,'date','required'),'Show day');}
// Keep recipe browsing context explicit and restricted to catalogue query fields.
function recipeCatalogueParams(source=query()){
 const params=new URLSearchParams();
 for(const key of ['q','tag','max_minutes','sort','exclude','favourites','offset','day']){
  const value=source.get(key);if(value!==null&&value!==''&&value.length<=200)params.set(key,value);
 }
 return params;
}
function recipeCatalogueRoute(params){const value=params.toString();return '/portal/recipes'+(value?'?'+value:'');}
function recipeFilterRoute(key,value,source=query()){
 const params=recipeCatalogueParams(source);params.delete('offset');
 if(value===null||value==='')params.delete(key);else params.set(key,value);
 return recipeCatalogueRoute(params);
}
function recipeClearRoute(){const params=new URLSearchParams();params.set('day',query().get('day')||localNutritionDay());return recipeCatalogueRoute(params);}
function recipeActiveFilters(q){
 const names={q:'Search: '+(q.get('q')||''),tag:label(q.get('tag')||''),max_minutes:'Up to '+(q.get('max_minutes')||'')+' minutes',exclude:'Skip: '+(q.get('exclude')||''),favourites:'Saved recipes',sort:({fastest:'Quickest first',protein:'Protein estimate: most first',fibre:'Fibre estimate: most first'})[q.get('sort')]};
 return Object.entries(names).filter(([key])=>q.get(key)&&(key!=='sort'||q.get(key)!=='title')&&(key!=='favourites'||q.get(key)==='1'));
}
function recipeFilterChips(q){
 const active=recipeActiveFilters(q);return active.length?`<div class="recipe-active-filters" aria-label="Active recipe filters">${active.map(([key,title])=>`<a href="#${esc(recipeFilterRoute(key,null,q))}" aria-label="${esc('Remove filter: '+title)}">${esc(title)} <span aria-hidden="true">×</span></a>`).join('')}${link(recipeClearRoute(),'Clear filters','recipe-clear-filters')}</div>`:'';
}
function recipeFavouriteLabel(saved){return saved?'Saved ♥':'Save recipe ♡';}
function recipeCatalogueCard(r){
 const q=recipeCatalogueParams();q.set('day',q.get('day')||localNutritionDay());
 const route='/portal/recipe?'+new URLSearchParams({id:r.id,day:q.get('day'),catalogue:q.toString()});
 const mark=r.tags.includes('pasta')?'🍝':r.tags.includes('soup')?'🥣':r.tags.includes('breakfast')?'☀️':r.tags.includes('wrap')?'🌯':'🍽️';
 return `<article class="card nutrition-recipe" data-recipe-card="${esc(r.id)}"><div class="recipe-card-heading"><span class="recipe-card-symbol" aria-hidden="true">${mark}</span><div><div class="eyebrow">${esc(r.tags.join(' · '))}</div><h3>${esc(r.title)}</h3></div></div><p class="recipe-card-meta"><span aria-hidden="true">◷</span> ${r.prep_minutes} minutes · ${esc(r.portions)}${r.client_id?' · Tailored for you':''}</p><details class="recipe-estimates"><summary>Nutrition estimates</summary>${nutritionMacros(r.nutrition)}</details><div class="actions">${link(route,'View recipe →','secondary small')}<button type="button" class="secondary small" data-nutrition-favourite="${esc(r.id)}" data-value="${!r.favourite}" aria-pressed="${!!r.favourite}" aria-label="${esc((r.favourite?'Remove saved recipe: ':'Save recipe: ')+r.title)}">${recipeFavouriteLabel(r.favourite)}</button></div><p class="recipe-save-status micro" data-recipe-save-status role="status" aria-live="polite" aria-atomic="true"></p><div class="error" data-recipe-save-error role="alert"></div></article>`;
}
async function nutritionRecipesPage(){
 const q=recipeCatalogueParams(),params=new URLSearchParams(q);params.set('limit','24');
 const d=await api('/nutrition/recipes?'+params),offset=d.offset;
 const pageLink=(n,title)=>{const p=new URLSearchParams(q);p.set('offset',String(n));return link(recipeCatalogueRoute(p),title,'secondary small');};
 const filterCount=recipeActiveFilters(q).filter(([key])=>key!=='q').length;
 const quickLink=(key,value,title)=>`<a class="secondary small" href="#${esc(recipeFilterRoute(key,q.get(key)===value?null:value,q))}" ${q.get(key)===value?'aria-current="true"':''}>${title}</a>`;
 const advanced=select('tag','Meal or style',[['','All recipes'],...['breakfast','lunch','dinner','snack','plant-based','vegetarian','fish','omnivore','bowl','pasta','soup','wrap'].map(t=>[t,label(t)])],q.get('tag')||'')+select('max_minutes','Time in the kitchen',[['','Any time'],['10','Up to 10 minutes'],['15','Up to 15 minutes'],['30','Up to 30 minutes']],q.get('max_minutes')||'')+select('sort','Recipe order',[['title','Name'],['fastest','Quickest first'],['protein','Protein estimate: most first'],['fibre','Fibre estimate: most first']],q.get('sort')||'title')+field('exclude','Skip ingredient words (comma separated)',q.get('exclude')||'','text','maxlength="200"')+'<p class="micro recipe-filter-care">Ingredient searches are a browsing aid, not an allergen check. Read the ingredients and product labels.</p>'+check('favourites','Only my saved recipes',q.get('favourites')==='1');
 return `<div class="nutrition-heading"><div><span class="eyebrow">Good food belongs in the plan</span><h2>What sounds<br><span class="serif">good today?</span></h2><p>Find something you’ll enjoy. Save it for later or head straight to the kitchen.</p></div>${artwork('eat')}</div><div class="card recipe-search-card"><div class="recipe-discovery-links" aria-label="Recipe shortcuts">${quickLink('max_minutes','15','◷ Ready in 15 minutes')}${quickLink('tag','plant-based','🌱 Plant-based ideas')}${quickLink('favourites','1','♥ My favourites')}</div>${form('nutrition-search',`<input type="hidden" name="day" value="${esc(q.get('day')||localNutritionDay())}">`+field('q','Find a recipe or ingredient',q.get('q')||'','search','maxlength="200" placeholder="Try pasta, lentils or breakfast"')+`<details class="recipe-search-options" ${filterCount?'open':''}><summary>Refine your search${filterCount?' · '+filterCount+' active':''}</summary><div class="recipe-filter-fields">${advanced}</div></details>`,'Find recipes')}${recipeFilterChips(q)}</div><div class="recipe-results-heading"><div><h3>Something to look forward to.</h3><p role="status">${d.total} ${d.total===1?'recipe':'recipes'} found${offset?' · showing '+(offset+1)+'–'+Math.min(offset+24,d.total):''}</p></div><div class="actions"><button type="button" class="secondary small" data-recipe-surprise ${d.recipes.length?'':'disabled'}>Pick something for me ↗</button>${link('/portal/planner?day='+encodeURIComponent(q.get('day')||localNutritionDay()),'My meal planner','secondary small')}</div></div><div class="nutrition-grid">${d.recipes.map(recipeCatalogueCard).join('')||empty('Nothing matches yet.','Clear a filter or try another ingredient. Your saved recipes will stay saved.',link(recipeClearRoute(),'Clear filters','secondary small'))}</div><div class="actions">${offset>0?pageLink(Math.max(0,offset-24),'← Previous'):''}${offset+24<d.total?pageLink(offset+24,'Next recipes →'):''}</div>`;
}
function nutritionLogForm(source,day,kind='recipe'){return form('nutrition-log',`<input type="hidden" name="source_id" value="${esc(source.id)}"><input type="hidden" name="kind" value="${kind}"><input type="hidden" name="idempotency_key" value="${crypto.randomUUID()}">`+field('day','Log date',day,'date','required')+select('slot','Meal',[['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['snack','Snack']],'lunch')+field('quantity',kind==='recipe'?'Servings eaten':'Edible weight (grams)',kind==='recipe'?1:100,'number',`required min="0.01" max="${kind==='recipe'?100:10000}" step="0.01"`),'Add to diary');}
async function nutritionRecipePage(){const q=query(),back=recipeCatalogueParams(new URLSearchParams(q.get('catalogue')||''));if(q.get('day'))back.set('day',q.get('day'));const r=await api('/nutrition/recipes/'+encodeURIComponent(query().get('id')||''));return `<a class="back" href="#${esc(recipeCatalogueRoute(back))}">← Back to recipes</a>${recipeView(r)}${adaptationLinks(r)}${session.user?.role==='client'?`<section class="card recipe-tools"><h3>Enjoy it your way.</h3><div class="actions">${link('/portal/cook?id='+encodeURIComponent(r.id)+'&day='+(query().get('day')||localNutritionDay()),'Open kitchen mode ↗','secondary')}</div>${r.nutrition?`<details><summary>Add this meal to my week</summary>${plannerAddForm(r,query().get('day')||localNutritionDay())}</details>`:''}</section>`:''}${r.nutrition?`<div class="card narrow"><h3>Make a note of your meal.</h3>${nutritionLogForm(r,query().get('day')||localNutritionDay())}</div>`:'<div class="notice">Alex needs to add ingredient-based nutrition before this recipe can be logged.</div>'}<p class="micro">Check product labels and your dietary needs. Ingredient calculations do not establish allergen safety.</p>`;}
function diaryEntry(e){return `<article class="card nutrition-entry"><div class="row"><div><span class="eyebrow">${esc(e.slot)}</span><h3>${esc(e.snapshot.title)}</h3><p class="micro">${e.quantity} ${esc(e.snapshot.unit)}${e.snapshot.recipe_version?' · Recipe v'+e.snapshot.recipe_version:''}</p></div></div>${nutritionMacros({...e.totals,source:e.snapshot.nutrition.source}).replace('Estimated per serving','Estimated for logged quantity')}<details><summary>Edit this entry</summary>${form('nutrition-edit',`<input type="hidden" name="id" value="${esc(e.id)}"><input type="hidden" name="version" value="${e.version}">`+field('day','Date',e.day,'date','required')+select('slot','Meal',[['breakfast','Breakfast'],['lunch','Lunch'],['dinner','Dinner'],['snack','Snack']],e.slot)+field('quantity',e.snapshot.unit,e.quantity,'number','required min="0.01" max="10000" step="0.01"'),'Update entry')}<button type="button" class="danger small" data-nutrition-delete="${esc(e.id)}" data-version="${e.version}">Remove entry</button></details></article>`;}
function nutritionSummary(d){return `<div class="nutrition-totals">${Object.entries(nutritionLabels).map(([k,v])=>`<div class="card"><span>${v}</span><strong>${d.totals[k]===null?'Unknown':esc(d.totals[k])+(k==='kcal'?'':'g')}</strong><small>${d.targets?.[k]!=null?'Alex’s target: '+d.targets[k]+(k==='kcal'?' kcal':'g'):'No target set'}</small></div>`).join('')}</div>${d.targets?.notes?`<div class="notice">${esc(d.targets.notes)}</div>`:''}`;}
async function nutritionDiaryPage(){if(session.user?.role!=='client')return '<div class="notice">Use a client account to keep a food diary.</div>';const day=query().get('day')||localNutritionDay(),[d,recent]=await Promise.all([api('/nutrition/diary?day='+day),api('/nutrition/recent')]);return `<div class="nutrition-heading"><div><span class="eyebrow">A little awareness. A little support.</span><h2>Your food,<br><span class="serif">your day.</span></h2><p>Log what you ate, in portions that work for you. Targets are optional and agreed with Alex.</p></div>${artwork('eat')}</div><div class="card narrow">${nutritionDateForm(day)}</div>${nutritionSummary(d)}<div class="actions">${link('/portal/recipes?day='+day,'Browse recipes ↗')}${link('/portal/foods?day='+day,'Log individual foods','secondary')}</div><p class="micro">Totals are estimates. Unknown fibre stays unknown. Logged meals retain the recipe version used at the time.</p><div class="nutrition-grid">${d.entries.map(diaryEntry).join('')||empty('Room for your first meal.','Choose a recipe or log a food to get started.')}</div>${recentMealsView(recent.entries,day)}`;}
async function nutritionFoodsPage(){const q=query(),day=q.get('day')||localNutritionDay();const d=q.get('q')?await api('/nutrition/foods?q='+encodeURIComponent(q.get('q'))):{foods:[]};return `<h2>What did you eat?</h2><p>Find the food entry that matches its raw, cooked or drained state. Weights are edible grams.</p><div class="card">${form('nutrition-food-search',`<input type="hidden" name="day" value="${esc(day)}">`+field('q','Search UK foods',q.get('q')||'','search','required maxlength="200"'),'Search foods')}</div><p class="micro">Showing up to 50 matching foods. Add more words to narrow your search.</p><div class="nutrition-grid">${d.foods.map(f=>`<article class="card"><h3>${esc(f.name)}</h3>${nutritionMacros({...f,source:'UK CoFID 2021'}).replace('Estimated per serving','Estimated per 100g')}<details><summary>Log this food</summary>${nutritionLogForm(f,day,'food')}</details></article>`).join('')||empty('Find something you enjoyed.','Search by food name, then choose the closest matching entry.')}</div>`;}
async function adminNutritionPage(d){const q=query(),client=d.clients.find(c=>c.id===q.get('client'))||d.clients[0];if(!client)return empty('Your nutrition workspace is ready.','Client diaries and optional targets appear once clients join.');const day=q.get('day')||localNutritionDay(),data=await api('/admin/nutrition/'+client.id+'?day='+day),t=data.targets||{};return `<h2>Food that fits <span class="serif">their life.</span></h2><div class="card">${form('nutrition-admin-day',select('client','Client',d.clients.map(c=>[c.id,c.name]),client.id)+field('day','Diary date',day,'date','required'),'View diary')}</div>${nutritionSummary(data)}<div class="split"><div><h3>${esc(client.name)} · ${esc(day)}</h3>${data.entries.map(e=>`<article class="card"><span class="eyebrow">${esc(e.slot)}</span><h3>${esc(e.snapshot.title)}</h3><p>${e.quantity} ${esc(e.snapshot.unit)}</p>${nutritionMacros({...e.totals,source:e.snapshot.nutrition.source}).replace('Estimated per serving','Estimated for logged quantity')}</article>`).join('')||empty('No meals logged on this day.','Choose another date to review their diary.')}</div><div class="card"><h3>Optional daily targets</h3><p class="micro">Agree targets with the client. Leave a field blank to use no target.</p>${form('nutrition-targets',`<input type="hidden" name="client" value="${esc(client.id)}"><input type="hidden" name="version" value="${t.version||0}">`+Object.entries(nutritionLabels).map(([k,v])=>field(k,v+(k==='kcal'?' per day':' (g per day)'),t[k]??'','number','min="0" step="0.1"')).join('')+area('notes','Guidance for this client',t.notes||'',false),'Save targets')}${link('/admin/plans?view=recipes','Edit & tailor recipes ↗','secondary small')}</div></div>`;}
// A saved entry must not take over a newer route or discard another form's edits.
const nutritionPendingSaves=new WeakMap();
let nutritionEditVersion=0;
for(const event of ['input','change'])document.addEventListener(event,()=>{nutritionEditVersion++;});
document.addEventListener('submit',e=>{if(nutritionPendingSaves.has(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
function nutritionSaveView(state){return state.form.isConnected&&state.render===renderVersion&&state.hash===location.hash&&state.owner===session.user?.id;}
async function saveNutritionEntry(kind,body,f){
 if(nutritionPendingSaves.has(f))return;
 nutritionEditVersion++;
 const state={form:f,render:renderVersion,hash:location.hash,owner:session.user?.id,edits:nutritionEditVersion,locked:[]};
 nutritionPendingSaves.set(f,state);f.setAttribute('aria-busy','true');
 // Capture happened before locking. Read-only text remains selectable; choices cannot change mid-save.
 for(const control of f.elements){if(control.type==='hidden')continue;const property=control.tagName==='SELECT'||control.tagName==='BUTTON'||['checkbox','radio'].includes(control.type)?'disabled':'readOnly';state.locked.push([control,property,control[property]]);control[property]=true;}
 try{
  await api('/nutrition/diary'+(kind==='nutrition-edit'?'/'+body.id:''),kind==='nutrition-edit'?'PUT':'POST',{...body,quantity:Number(body.quantity),...(kind==='nutrition-edit'?{version:Number(body.version)}:{})});
  if(state.owner!==session.user?.id)return;
  const sameView=nutritionSaveView(state),untouched=state.edits===nutritionEditVersion;
  toast('Diary entry saved for '+body.day+'.');
  if(sameView&&untouched){
   const destination='/portal/nutrition?day='+body.day;
   if(location.hash==='#'+destination)await render({canCommit:()=>state.owner!==session.user?.id||(state.edits===nutritionEditVersion&&state.hash===location.hash)});
   else{navigate(destination);await render();}
   if(state.owner!==session.user?.id)toast('Your signed-in account changed. Reopen the task in this account.');
  }
  if(f.isConnected&&state.hash===location.hash&&state.owner===session.user?.id&&state.edits!==nutritionEditVersion){
   // Leave all other forms exactly as they are, including typing during a same-page refresh.
   f.removeAttribute('data-form');f.innerHTML=`<p role="status">Your diary entry for ${esc(body.day)} is saved. Your other edits are still here.</p>${link('/portal/nutrition?day='+encodeURIComponent(body.day),'View saved diary','secondary small')}`;
  }
 }catch(error){
  error.preserveFormFocus=!nutritionSaveView(state)||state.edits!==nutritionEditVersion;
  if(state.owner===session.user?.id&&!nutritionSaveView(state))toast('Diary save wasn’t confirmed. Check Food diary before trying again.');
  throw error;
 }finally{
  for(const [control,property,value] of state.locked)control[property]=value;
  f.removeAttribute('aria-busy');nutritionPendingSaves.delete(f);
 }
}
async function submitNutritionForm(k,b,f){if(k==='nutrition-search'){const q=new URLSearchParams({q:b.q,tag:b.tag,max_minutes:b.max_minutes||'',sort:b.sort||'title',exclude:b.exclude||''});if(b.day)q.set('day',b.day);if(new FormData(f).has('favourites'))q.set('favourites','1');navigate('/portal/recipes?'+q);return;}
  if(k==='nutrition-food-search'){navigate('/portal/foods?'+new URLSearchParams({q:b.q,day:b.day}));return;}
  if(k==='nutrition-date'){navigate('/portal/nutrition?day='+b.day);return;}
  if(k==='nutrition-admin-day'){navigate('/admin/nutrition?'+new URLSearchParams({client:b.client,day:b.day}));return;}
  if(k==='nutrition-targets'){await api('/admin/nutrition/'+b.client,'PUT',{...Object.fromEntries(Object.keys(nutritionLabels).map(k=>[k,b[k]===''?null:Number(b[k])])),version:Number(b.version),notes:b.notes});toast('Targets saved.');await render();return;}
  if(k==='nutrition-log'||k==='nutrition-edit')await saveNutritionEntry(k,b,f);
}
async function saveRecipeFavourite(button){
 if(button.disabled)return;
 const card=button.closest('[data-recipe-card]'),status=card.querySelector('[data-recipe-save-status]'),error=card.querySelector('[data-recipe-save-error]');
 const wanted=button.dataset.value==='true',hadFocus=document.activeElement===button;
 button.disabled=true;button.setAttribute('aria-busy','true');error.textContent='';status.textContent=wanted?'Saving recipe…':'Removing saved recipe…';
 try{
  await api('/nutrition/recipes/'+encodeURIComponent(button.dataset.nutritionFavourite)+'/favourite','PUT',{favourite:wanted});
  if(!button.isConnected)return;
  button.dataset.value=String(!wanted);button.setAttribute('aria-pressed',String(wanted));button.textContent=recipeFavouriteLabel(wanted);
  button.setAttribute('aria-label',(wanted?'Remove saved recipe: ':'Save recipe: ')+card.querySelector('h3').textContent);
  status.textContent=wanted?'Saved to your favourites.':'Removed from your favourites. You can save it again here.';
  if(!wanted&&query().get('favourites')==='1')status.insertAdjacentHTML('beforeend',' <button type="button" class="secondary small" data-recipe-refresh>Refresh saved recipes</button>');
 }catch(err){
  if(button.isConnected){status.textContent='';error.textContent=err.message+' We couldn’t confirm the change. Try again to '+(wanted?'save':'remove')+' this recipe.';}
 }finally{
  button.disabled=false;button.removeAttribute('aria-busy');
  if(button.isConnected&&hadFocus&&(document.activeElement===document.body||document.activeElement===button))button.focus({preventScroll:true});
 }
}
document.addEventListener('click',async e=>{
 const refresh=e.target.closest('[data-recipe-refresh]');if(refresh){refresh.disabled=true;await render();const heading=document.querySelector('.recipe-results-heading h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}return;}
 const add=e.target.closest('[data-nutrition-add-ingredient]');if(add){add.form.querySelector('[data-nutrition-ingredients]').insertAdjacentHTML('beforeend',nutritionIngredientRow());return;}
 const remove=e.target.closest('[data-nutrition-remove-ingredient]');if(remove){remove.closest('.nutrition-ingredient').remove();return;}
 const favourite=e.target.closest('[data-nutrition-favourite]');if(favourite){await saveRecipeFavourite(favourite);return;}
 const button=e.target.closest('[data-nutrition-delete]');if(!button)return;
 button.disabled=true;try{await api('/nutrition/diary/'+button.dataset.nutritionDelete,'DELETE',{version:Number(button.dataset.version)});await render();}catch(error){toast(error.message);}finally{button.disabled=false;}
});

function recentMealsView(entries,day){return entries.length?`<section class="card recent-meals"><span class="eyebrow">Something you enjoyed before</span><h3>Same favourite. New day.</h3><p class="micro">Repeat a saved meal with its original nutrition estimate. You can adjust your portion before adding.</p>${entries.map(e=>`<details><summary>${esc(e.snapshot.title)}</summary>${form('rhythm-repeat',`<input type="hidden" name="source_entry_id" value="${esc(e.id)}"><input type="hidden" name="idempotency_key" value="${crypto.randomUUID()}">`+field('day','Log date',day,'date','required')+select('slot','Meal',mealSlots,e.slot)+field('quantity',e.snapshot.unit,e.quantity,'number','required min="0.01" step="0.01"'),'Repeat this meal')}</details>`).join('')}</section>`:'';}
