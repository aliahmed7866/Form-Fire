/* Everyday client tools and a focused coaching inbox. */
function clientNextStep(d) {
  if(!d.user.verified)return ['Verify your account','Use the verification code from the local test outbox to get started.','/verify'];
  const waiting=d.requests.find(r=>r.status==='awaiting_client_response');
  if(waiting)return ['Alex has a question for you','Pick up your conversation so you can agree the next step.','/request/'+waiting.id];
  if(currentActivePlans(d).length)return ['Make a little time for you.','Your current plans are ready. Start with what fits today.','/portal/today'];
  if(d.requests.some(r=>r.active))return ['A plan is taking shape.','Your service is active. Alex will share your plan here when it is ready.','/portal/requests'];
  if(d.requests.some(r=>!['withdrawn','declined'].includes(r.status)))return ['You’ve made a start.','Follow your request and keep the conversation going with Alex.','/portal/requests'];
  return ['Let’s find your starting point.','Tell Alex what you’re working towards. You don’t need to have it all figured out.','/work'];
}
function clientOverview(d) {
  const plans=currentActivePlans(d),[title,copy,target]=clientNextStep(d);
  return `<div class="stats"><div class="stat"><strong>${d.requests.filter(r=>!['withdrawn','declined'].includes(r.status)).length}</strong><small>Open requests</small></div><div class="stat"><strong>${d.requests.filter(r=>r.active).length}</strong><small>Active services</small></div><div class="stat"><strong>${plans.length}</strong><small>Current plans</small></div></div><div class="card highlight next-step">${artwork('rhythm')}<div class="next-step-copy"><span class="eyebrow">Your next useful step</span><h2>${esc(title)}</h2><p>${esc(copy)}</p>${link(target,'Take the next step ↗','secondary')}</div></div>
  ${d.user.verified?`<div class="everyday-links"><a href="#/portal/today"><span class="eyebrow">01 / Move</span><h3>Your day, your pace.</h3><p>Open your workouts and record how it went.</p><span>Open Today ↗</span></a><a href="#/portal/shopping"><span class="eyebrow">02 / Eat</span><h3>Good food starts here.</h3><p>Your shopping list and recipes, together.</p><span>Shop & prepare ↗</span></a><a href="#/portal/checkins"><span class="eyebrow">03 / Reflect</span><h3>A little catch-up.</h3><p>Tell Alex about the week you actually had.</p><span>Weekly check-in ↗</span></a></div>`:''}<h2>Your requests</h2>${requestCards(d.requests.slice(0,3))}`;
}
function clientPlans(d) {
  const current=currentActivePlans(d),ids=new Set(current.map(a=>a.id)),history=d.assignments.filter(a=>!ids.has(a.id));
  return `<div class="row"><div><h2>Made for your week.</h2><p class="muted">Your latest plans for active services. Each published version stays intact.</p></div>${link('/portal/shopping','Shop & prepare ↗','secondary small')}</div><div class="grid">${planCards(current)}</div>${history.length?`<details class="plan-history"><summary>Previous plans & paused services (${history.length})</summary><p class="micro">Keep these for reference. Today and your shopping list use current plans for active services.</p><div class="grid">${planCards(history,[])}</div></details>`:''}`;
}
function shoppingCard(list) {
  const count=list.purchased.length;
  return `<section class="card shopping-card" data-shopping-card="${esc(list.assignment_id)}" data-revision="${list.revision}"><div class="row"><div><span class="eyebrow">Your meal plan · Version ${list.version}</span><h3>${esc(list.title)}</h3></div>${starterBadge(list.is_demo)}</div><p class="micro">Alex’s list, one item per line. Check the quantities against your agreed servings.</p><p data-shopping-count role="status">${count} of ${list.items.length} picked up</p><div class="error" role="alert"></div>${list.items.length?`<div class="shopping-items">${list.items.map((item,i)=>`<label class="shopping-item ${list.purchased.includes(i)?'picked-up':''}"><input type="checkbox" data-shopping-item="${i}" ${list.purchased.includes(i)?'checked':''}><span>${esc(item)}</span></label>`).join('')}</div><div class="actions"><button type="button" class="secondary small" data-shopping-reset ${count?'':'disabled'}>Start a fresh shop</button><button type="button" class="secondary small" data-shopping-download>Download list</button>${link('/plan/'+list.assignment_id,'Full meal plan ↗','secondary small')}</div>`:empty('The list is still to come.','Open your meal plan for recipes and ask Alex to add a shopping list.',link('/plan/'+list.assignment_id,'Open meal plan','secondary small'))}</section>`;
}
async function shoppingPage(d) {
  if(d.user.role==='admin')return '<div class="notice">Shopping checklists belong to clients. Use Plan studio to prepare their lists.</div>';
  if(!d.user.verified)return '<div class="notice">Verify your account to open your shopping list. <a href="#/verify">Enter your code →</a></div>';
  const {lists}=await api('/shopping');
  const meals=currentActivePlans(d).filter(a=>a.kind==='meal');
  return `<div class="shopping-heading"><div><span class="eyebrow">A little preparation. A lot to enjoy.</span><h2>From the shops<br><span class="serif">to your table.</span></h2><p>Pick up what you need, then make something you’ll look forward to.</p><p class="micro">Ticks save to your account. Start a fresh shop whenever you need; a new plan version gets a new list.</p></div>${artwork('eat','shopping-art')}</div>${lists.length?`<div class="shopping-layout"><div>${lists.map(shoppingCard).join('')}</div><aside class="prep-sidebar"><span class="eyebrow">Make it your own</span><h3>A calmer start<br>in the kitchen.</h3><ol><li>Check what you already have.</li><li>Read your recipe and serving notes.</li><li>Keep any agreed substitutions in view.</li></ol><p>Something doesn’t suit you? Ask Alex through your request before changing your plan.</p>${link('/portal/requests','Ask Alex ↗','secondary small')}</aside></div><section class="prep-recipes"><div class="section-top"><div><span class="eyebrow">Next up / The good bit</span><h2>What’s cooking?</h2></div></div><p class="muted">Your published recipes and personal serving notes, ready when you are.</p>${meals.map(a=>`<h3>${esc(a.title)} · Version ${a.version}</h3>${(a.snapshot.meals||[]).map(m=>`<details><summary>${esc(m.day)} · ${esc(m.slot)} · ${esc(m.recipe.title)}</summary><p><strong>For you:</strong> ${esc(m.servings)}</p>${m.notes?`<p class="pre">${esc(m.notes)}</p>`:''}${recipeView(m.recipe)}</details>`).join('')}${(a.snapshot.recipes||[]).filter(r=>!(a.snapshot.meals||[]).some(m=>m.recipe.id===r.id)).map(r=>`<details><summary>${esc(r.title)}</summary>${recipeView(r)}</details>`).join('')}`).join('')}</section>`:empty('Good food is on the way.','Your shopping list will appear when Alex publishes a meal plan for an active service.',link('/portal/requests','View your requests','secondary small'))}`;
}
function inboxMatches(r,search,status,kind) {
  const needsReview=['submitted','under_review'].includes(r.status);
  return (!search||[r.client_name,r.service_title].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase())))&&(!kind||r.kind===kind)&&(!status||(status==='attention'?needsReview:r.status===status));
}
function adminInbox(d) {
  const requested=query().get('status')||'',statuses=['attention','submitted','under_review','awaiting_client_response','approved','declined','withdrawn'],status=statuses.includes(requested)?requested:'';
  const selected=query().get('kind')||'',kind=['coaching','chef'].includes(selected)?selected:'';
  // Names stay out of URLs; search is local to the signed-in page.
  const rows=d.requests.filter(r=>inboxMatches(r,'',status,kind));
  return `<div class="section-top"><div><span class="eyebrow">The coaching inbox</span><h2>People first.<br><span class="serif">One conversation at a time.</span></h2></div></div><div class="inbox-summary"><a href="#/admin/requests?status=attention"><strong>${d.requests.filter(r=>['submitted','under_review'].includes(r.status)).length}</strong><span>Ready for your review</span></a><a href="#/admin/requests?status=awaiting_client_response"><strong>${d.requests.filter(r=>r.status==='awaiting_client_response').length}</strong><span>Waiting for a client</span></a><a href="#/admin/checkins"><strong>${d.checkins.filter(c=>!c.feedback).length}</strong><span>Check-ins without feedback</span></a></div><div class="card inbox-filters"><label>Find a client or service<input type="search" data-inbox-search placeholder="Search requests" maxlength="200" autocomplete="off"></label>${select('inbox-status','Request status',[['','All statuses'],['attention','Ready for review'],...statuses.filter(s=>s!=='attention').map(s=>[s,label(s)])],status)}${select('inbox-kind','Service type',[['','All services'],['coaching','Coaching'],['chef','Private dining']],kind)}</div><p class="micro" id="inbox-count" role="status">${rows.length} ${rows.length===1?'request':'requests'}</p><div id="inbox-results">${rows.length?requestCards(rows,true):empty('Nothing here right now.','Try a different filter to see more requests.')}</div>`;
}
function refreshInbox() {
  const search=document.querySelector('[data-inbox-search]')?.value||'',status=document.querySelector('[name="inbox-status"]').value,kind=document.querySelector('[name="inbox-kind"]').value;
  const rows=adminData.requests.filter(r=>inboxMatches(r,search,status,kind));
  document.querySelector('#inbox-results').innerHTML=rows.length?requestCards(rows,true):empty('Nothing matches just yet.','Try another name, service or filter.');
  document.querySelector('#inbox-count').textContent=rows.length+' '+(rows.length===1?'request':'requests');
}
function applyShoppingState(card,state) {
  card.dataset.revision=String(state.revision);
  const inputs=[...card.querySelectorAll('[data-shopping-item]')];
  for(const input of inputs){input.checked=state.purchased.includes(Number(input.dataset.shoppingItem));input.closest('label').classList.toggle('picked-up',input.checked);}
  card.querySelector('[data-shopping-count]').textContent=state.purchased.length+' of '+inputs.length+' picked up';
  card.querySelector('[data-shopping-reset]').disabled=!state.purchased.length;
}
async function updateShopping(card,input) {
  if(card.dataset.busy)return;
  card.dataset.busy='true';card.setAttribute('aria-busy','true');
  const error=card.querySelector('.error'),controls=[...card.querySelectorAll('input,button')],focus=document.activeElement;
  error.textContent='';controls.forEach(c=>c.disabled=true);
  let state;
  try {
    const payload=input?{revision:Number(card.dataset.revision),item_index:Number(input.dataset.shoppingItem),purchased:input.checked}:{revision:Number(card.dataset.revision)};
    state=await api('/assignments/'+card.dataset.shoppingCard+'/shopping'+(input?'':'/reset'),input?'PUT':'POST',payload);
  }catch(e){
    // A lost response may have committed. Read back before allowing another write.
    if(input)input.checked=!input.checked;
    error.textContent=e.message;
    try {const fresh=await api('/shopping');state=fresh.lists.find(l=>l.assignment_id===card.dataset.shoppingCard);if(!state){error.textContent+=' Open Shop & prepare again to see your current plan.';card.dataset.stale='true';}}
    catch {error.textContent+=' Reload this page to check what was saved.';card.dataset.stale='true';}
  }finally{
    delete card.dataset.busy;card.removeAttribute('aria-busy');
    if(!card.dataset.stale)controls.forEach(c=>c.disabled=false);
    if(state)applyShoppingState(card,state);
    else card.querySelector('[data-shopping-reset]').disabled=![...card.querySelectorAll('[data-shopping-item]')].some(c=>c.checked);
    if(card.dataset.stale)controls.forEach(c=>c.disabled=true);
    if(focus?.isConnected&&!focus.disabled)focus.focus({preventScroll:true});
  }
}
document.addEventListener('input',e=>{if(e.target.matches('[data-inbox-search]'))refreshInbox();});
document.addEventListener('change',e=>{
  if(e.target.matches('[name="inbox-status"],[name="inbox-kind"]'))refreshInbox();
  if(e.target.matches('[data-shopping-item]'))updateShopping(e.target.closest('[data-shopping-card]'),e.target);
});
document.addEventListener('click',e=>{
  const reset=e.target.closest('[data-shopping-reset]');
  if(reset){if(confirm('Clear these ticks for your next shop? Your meal plan stays the same.'))updateShopping(reset.closest('[data-shopping-card]'));return;}
  const download=e.target.closest('[data-shopping-download]');if(!download)return;
  const card=download.closest('[data-shopping-card]'),lines=[...card.querySelectorAll('[data-shopping-item]')].map(i=>(i.checked?'[x] ':'[ ] ')+i.nextElementSibling.textContent);
  const text=card.querySelector('h3').textContent+'\n'+card.querySelector('.eyebrow').textContent+'\n\n'+lines.join('\n')+'\n\nPrepared by Alex. Check quantities against your agreed servings.\n';
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='form-fire-shopping-list.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
