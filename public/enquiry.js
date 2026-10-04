'use strict';

// Canonical answers stay in one form. Cards never submit or create a request.
const enquiryTimers=new WeakMap();
const enquiryIndex=(value,last)=>Math.max(0,Math.min(last,Math.floor(Number(value)||0)));
const enquiryLastStep=f=>f.querySelectorAll('[data-enquiry-panel]').length-1;
function enquiryChoices(name,choices,value){
 return `<div class="enquiry-choices ${name==='service_id'?'enquiry-choice-grid--support':''}" role="group" aria-label="${({service_id:'Choose your support',goals:'Choose your goal',availability:'Choose a routine',occasion:'Choose the occasion'})[name]}" aria-describedby="enquiry-choice-help">${choices.map(([answer,title,copy,art])=>`<button type="button" class="enquiry-choice" data-enquiry-choice="${name}" ${answer===null?'data-choice-custom':`data-choice-value="${esc(answer)}"`} aria-pressed="${answer!==null&&answer===value}"><span class="enquiry-choice-art">${enquiryArt(art)}</span><span class="enquiry-choice-check" aria-hidden="true">✓</span><strong>${esc(title)}</strong><span class="enquiry-choice-copy">${esc(copy)}</span></button>`).join('')}</div>`;
}
function enquiryOwnAnswer(content,value){
 return `<details class="enquiry-extra" data-enquiry-answer ${value?'open':''}><summary>Add or edit your own answer</summary>${content}</details>`;
}
function enquiryFlow(chef,d,sid){
 const kind=chef?'chef':'coaching',options=services.filter(s=>s.kind!=='chef'),support=options.some(s=>s.id===sid)?sid:'';
 const names=chef?['What’s the occasion?','Where and when?','A few practical details','Review your enquiry']:['What would you like support with?','What would feel like progress?','What could fit into your week?','Anything else for Alex?','Review your request'];
 const shortNames=chef?['Occasion','Gathering','Details','Review']:['Support','Goal','Routine','Details','Review'];
 const last=names.length-1,oldStep=enquiryIndex(d._step,2),step=d._flow_version==='2'?enquiryIndex(d._step,last):(chef?[0,2,3]:[0,2,4])[oldStep];
 const panels=chef?[
  `<p>A dinner, a celebration or something all your own. Pick a starting point.</p>${enquiryChoices('occasion',[
   ['Dinner with friends or family','Dinner together','A good meal and time together.','dinner'],
   ['A celebration','Something to celebrate','A birthday, milestone or just because.','celebrate'],
   ['Dinner for two','Dinner for two','A special meal, just for two.','balance'],
   [null,'Something else','Tell Alex what you have in mind.','custom']
  ],d.occasion||'')}${enquiryOwnAnswer(field('occasion','Your occasion',d.occasion||'','text','required maxlength="300"'),d.occasion)}`,
  field('date','Preferred date',d.date||'','date','required')+field('location','Town or event location',d.location||'','text','required maxlength="500"'),
  `<div class="form-grid">${field('guests','Number of guests',d.guests||'','number','required min="1" max="1000" step="1"')}${field('budget','Indicative total budget',d.budget||'','number','required min="0" step="0.01"')}</div><details class="enquiry-extra"><summary>Currency, time zone & dietary details</summary><div class="form-grid">${field('currency','Currency',d.currency||'GBP','text','required pattern="[A-Z]{3}" maxlength="3"')}${field('timezone','Event time zone',d.timezone||'Europe/London','text','required maxlength="80"')}</div>${area('dietary','Dietary requirements (optional)',d.dietary||'',false)}${area('notes','Anything else? (optional)',d.notes||'',false)}</details><input type="hidden" name="service_id" value="chef">`
 ]:[
  `<p>Choose what interests you. Alex will help you agree the right package.</p>${enquiryChoices('service_id',options.map(s=>[s.id,s.title,({train:'Build strength and find movement you enjoy.',eat:'Find food routines that work for you.',both:'Bring training and food together.'})[s.kind]||s.description,s.kind]),support)}<details class="enquiry-extra"><summary>Prefer to choose from a list?</summary>${select('service_id','Your support',[['','Choose your support'],...options.map(s=>[s.id,s.title])],support).replace('<select name="service_id">','<select name="service_id" required>')}</details>`,
  `<p>Choose the closest fit, or put it in your own words. There’s no perfect answer.</p>${enquiryChoices('goals',[
   ['I’d like to feel stronger and fitter.','Stronger & fitter','Feel more confident in how I move.','strong'],
   ['I’d like an easier food routine I enjoy.','Food that fits my life','Make everyday meals feel easier.','food'],
   ['I’d like a balanced routine for training and food.','Find my balance','Build a routine that feels sustainable.','balance'],
   [null,'My own goal','Start with what matters to me.','custom']
  ],d.goals||'')}${enquiryOwnAnswer(`<label>Your goal<span class="field-hint">A sentence is enough. You can edit a card’s answer too.</span><textarea name="goals" required maxlength="4000" rows="3">${esc(d.goals||'')}</textarea></label>`,d.goals)}`,
  `<p>Optional. A rough idea helps Alex start the conversation. It’s fine to work this out together.</p>${enquiryChoices('availability',[
   ['Small pockets of time would suit me best.','Small pockets of time','A little here and there.','short'],
   ['I can make space for regular time each week.','Regular time each week','Room for a more settled routine.','regular'],
   ['My availability varies from week to week.','Every week is different','Flexibility would help me most.','flexible'],
   [null,'In my own words','Share what could work for me.','custom']
  ],d.availability||'')}${enquiryOwnAnswer(`<label>Your routine (optional)<textarea name="availability" maxlength="2000" rows="3">${esc(d.availability||'')}</textarea></label>`,d.availability)}`,
  `<p>Optional. You’ve shared enough to start. Add any useful detail below, or go straight to review.</p><details class="enquiry-extra" ${d.experience||d.equipment||d.preferences?'open':''}><summary>Add experience, equipment or food preferences</summary>${area('experience','Your experience so far (optional)',d.experience||'',false)}${area('equipment','Equipment or spaces you can use (optional)',d.equipment||'',false)}${area('preferences','Food you enjoy or prefer to avoid (optional)',d.preferences||'',false)}</details>`
 ];
 panels.push('<p>Here’s what Alex will receive. Change anything before you send.</p><div data-enquiry-review></div><p class="micro">This starts a conversation. Alex will agree the package, price and any booking details with you separately.</p>');
 return `<form data-form="enquiry-${kind}" data-enquiry-flow data-enquiry-step="${step}" novalidate>
  <input type="hidden" name="idempotency_key" value="${esc(d.idempotency_key||crypto.randomUUID())}">
  <input type="hidden" name="_entry_service" value="${esc(query().get('service')||d._entry_service||'')}"><input type="hidden" name="_flow_version" value="2"><input type="hidden" name="_furthest_step" value="${Math.max(step,enquiryIndex(d._furthest_step,last))}"><input type="hidden" name="_auto_advance" value="${d._auto_advance==='off'?'off':'on'}">
  <p class="enquiry-progress" data-enquiry-progress aria-live="polite"></p>
  <nav class="enquiry-step-track" aria-label="Questionnaire progress">${shortNames.map((name,i)=>`<button type="button" data-enquiry-jump="${i}" aria-label="Step ${i+1}: ${name}" ${i>step?'disabled':''}><span aria-hidden="true">${i+1}</span><span>${name}</span></button>`).join('')}</nav>
  <label class="enquiry-auto check"><input type="checkbox" data-enquiry-auto ${d._auto_advance==='off'?'':'checked'}> Move on after choosing a card</label>
  <p class="enquiry-choice-hint micro" id="enquiry-choice-help" data-enquiry-choice-help></p>
  <div class="error" role="alert" tabindex="-1" data-enquiry-error></div>
  <div class="enquiry-stage">${panels.map((content,i)=>`<section data-enquiry-panel="${i}" ${i===step?'':'hidden'} aria-labelledby="enquiry-${kind}-${i}"><h2 id="enquiry-${kind}-${i}" tabindex="-1">${names[i]}</h2>${content}</section>`).join('')}</div>
  <p class="enquiry-status micro" role="status" data-enquiry-status></p>
  <div class="enquiry-controls"><button type="button" class="secondary" data-enquiry-back>← Back</button><button type="button" data-enquiry-next>Continue →</button><button type="submit">${session.user?.verified?'Send your request':'Continue to account'} ↗</button></div>
  ${chef?'':'<div class="enquiry-optional-actions"><button type="button" class="secondary small" data-enquiry-review-now>That’s enough for now — review →</button></div>'}
  <p class="enquiry-swipe-hint micro" data-enquiry-swipe>↔ Swipe here to move between questions, or use Back and Continue.</p>
  <p class="micro enquiry-draft-note" data-enquiry-draft>Draft kept in this browser tab. Nothing is sent until you choose Send your request.</p>
 </form>`;
}

function enquiryReview(f){
 const data=Object.fromEntries(new FormData(f)),chef=f.dataset.form==='enquiry-chef';
 const groups=chef?[
  ['occasion',[['Occasion',data.occasion]]],
  ['gathering',[['Preferred date',data.date],['Event location',data.location]]],
  ['practical details',[['Guests',data.guests],['Indicative total budget',`${data.currency} ${data.budget}`],['Time zone',data.timezone],['Dietary requirements',data.dietary],['Anything else',data.notes]]]
 ]:[
  ['support',[['Support',services.find(s=>s.id===data.service_id)?.title||data.service_id]]],
  ['goal',[['Your goal',data.goals]]],
  ['routine',[['Your routine',data.availability]]],
  ['extra details',[['Experience',data.experience],['Equipment / spaces',data.equipment],['Food preferences',data.preferences]]]
 ];
 f.querySelector('[data-enquiry-review]').innerHTML=groups.map(([title,rows],i)=>`<div class="enquiry-review-group"><dl>${rows.map(([name,value])=>`<dt>${esc(name)}</dt><dd>${value?esc(value):'<span class="muted">Not added — discuss with Alex</span>'}</dd>`).join('')}</dl><button type="button" class="secondary small" data-enquiry-edit="${i}">Edit ${title}</button></div>`).join('');
}
function enquiryCancelAdvance(f){
 clearTimeout(enquiryTimers.get(f));enquiryTimers.delete(f);
 f.querySelector('[data-enquiry-status]').textContent='';
}
function enquirySyncChoices(f){
 f.querySelectorAll('[data-enquiry-choice]').forEach(card=>{
  const value=f.elements.namedItem(card.dataset.enquiryChoice)?.value||'';
  const group=card.parentElement,hasMatch=[...group.querySelectorAll('[data-choice-value]')].some(c=>c.dataset.choiceValue===value);
  card.setAttribute('aria-pressed',String(card.hasAttribute('data-choice-custom')?!!value&&!hasMatch:card.dataset.choiceValue===value));
 });
}
function enquiryShowStep(f,step,focus=true){
 enquiryCancelAdvance(f);
 const last=enquiryLastStep(f),previous=Number(f.dataset.enquiryStep);
 step=enquiryIndex(step,last);f.dataset.enquiryStep=String(step);
 const furthest=f.elements.namedItem('_furthest_step');furthest.value=String(Math.max(Number(furthest.value)||0,step));
 f.querySelectorAll('[data-enquiry-panel]').forEach((panel,i)=>{
  panel.hidden=i!==step;panel.classList.remove('enquiry-panel-enter');
  if(i===step&&step!==previous){panel.dataset.direction=step<previous?'back':'forward';void panel.offsetWidth;panel.classList.add('enquiry-panel-enter');}
 });
 f.querySelectorAll('[data-enquiry-jump]').forEach(button=>{
  const index=Number(button.dataset.enquiryJump);button.disabled=index>Number(furthest.value);
  if(index===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
 });
 f.querySelector('[data-enquiry-back]').hidden=step===0;
 const next=f.querySelector('[data-enquiry-next]');next.hidden=step===last;
 next.textContent=(f.dataset.enquiryReturn==='review'?'Back to review':step===last-1?'Review request':f.dataset.form==='enquiry-coaching'&&step===2?'Continue / skip':'Continue')+' →';
 f.querySelector('[type=submit]').hidden=step!==last;
 const reviewNow=f.querySelector('[data-enquiry-review-now]');if(reviewNow)reviewNow.hidden=step<2||step>=last-1;
 const panel=f.querySelector(`[data-enquiry-panel="${step}"]`),heading=panel.querySelector('h2'),hasCards=!!panel.querySelector('[data-enquiry-choice]');
 f.querySelector('[data-enquiry-progress]').textContent=`Step ${step+1} of ${last+1} · ${step===last?'Ready to review':f.dataset.form==='enquiry-coaching'&&step>=2?'Optional details':'Your starting point'}`;
 f.querySelector('.enquiry-auto').hidden=!hasCards;
 const help=f.querySelector('[data-enquiry-choice-help]');help.hidden=!hasCards;
 help.textContent=f.querySelector('[data-enquiry-auto]').checked?'Choosing a card moves you on. You can always go back; your own answer uses Continue.':'Choose a card, then use Continue when you’re ready.';
 f.querySelector('.error').textContent='';
 if(step===last){delete f.dataset.enquiryReturn;enquiryReview(f);}
 enquirySyncChoices(f);draftSave(f);
 if(focus){heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'auto'});}
}
function enquiryValidate(f,all=false){
 const panels=all?[...f.querySelectorAll('[data-enquiry-panel]')]:[f.querySelector(`[data-enquiry-panel="${f.dataset.enquiryStep}"]`)];
 const controls=panels.flatMap(panel=>[...panel.querySelectorAll('input,select,textarea')]);
 for(const control of controls){control.removeAttribute('aria-invalid');control.removeAttribute('aria-describedby');if(control.required&&control.type!=='hidden')control.setCustomValidity(control.value.trim()?'':'Please add an answer.');}
 const invalid=controls.find(control=>!control.checkValidity());
 if(!invalid)return true;
 delete f.dataset.enquiryReturn;
 enquiryShowStep(f,Number(invalid.closest('[data-enquiry-panel]').dataset.enquiryPanel),false);
 const details=invalid.closest('details');if(details)details.open=true;
 const error=f.querySelector('.error');error.id=f.dataset.form+'-error';
 const title=invalid.closest('label')?.childNodes[0]?.textContent.trim()||'This answer';
 error.textContent=`${title}: ${invalid.validationMessage}`;
 invalid.setAttribute('aria-invalid','true');invalid.setAttribute('aria-describedby',error.id);
 invalid.focus({preventScroll:true});invalid.scrollIntoView({block:'center',behavior:'auto'});
 return false;
}
function enquiryForward(f){
 enquiryCancelAdvance(f);
 if(enquiryValidate(f))enquiryShowStep(f,f.dataset.enquiryReturn==='review'?enquiryLastStep(f):Number(f.dataset.enquiryStep)+1);
}
function enquiryReadyToSubmit(f){
 enquiryCancelAdvance(f);
 if(f.querySelector('[type=submit]').disabled)return false;
 if(Number(f.dataset.enquiryStep)<enquiryLastStep(f)){enquiryForward(f);return false;}
 return enquiryValidate(f,true);
}
function initEnquiryForms(){
 document.querySelectorAll('[data-enquiry-flow]').forEach(f=>{
  f.querySelectorAll('textarea').forEach(control=>{control.maxLength=control.name==='goals'?4000:(f.dataset.form==='enquiry-chef'?3000:2000);});
  enquiryShowStep(f,Number(f.dataset.enquiryStep),false);
 });
}

document.addEventListener('click',e=>{
 const control=e.target.closest('[data-enquiry-choice],[data-enquiry-back],[data-enquiry-next],[data-enquiry-edit],[data-enquiry-jump],[data-enquiry-review-now]');
 if(!control)return;
 const f=control.closest('[data-enquiry-flow]');if(!f||control.disabled||f.querySelector('[type=submit]').disabled)return;
 enquiryCancelAdvance(f);
 if(control.hasAttribute('data-enquiry-choice')){
  const answer=f.elements.namedItem(control.dataset.enquiryChoice);
  if(control.hasAttribute('data-choice-custom')){
   answer.closest('details').open=true;
   control.parentElement.querySelectorAll('[data-enquiry-choice]').forEach(c=>c.setAttribute('aria-pressed',String(c===control)));
   answer.focus();return;
  }
  answer.value=control.dataset.choiceValue;
  answer.dispatchEvent(new Event('input',{bubbles:true}));answer.dispatchEvent(new Event('change',{bubbles:true}));
  enquirySyncChoices(f);draftSave(f);
  f.querySelector('[data-enquiry-status]').textContent=f.querySelector('[data-enquiry-auto]').checked?'Selected. Moving on…':'Selected. Continue when you’re ready.';
  if(f.querySelector('[data-enquiry-auto]').checked){
   const step=f.dataset.enquiryStep,routeAtSelection=location.hash;
   enquiryTimers.set(f,setTimeout(()=>{enquiryTimers.delete(f);if(f.isConnected&&location.hash===routeAtSelection&&f.dataset.enquiryStep===step&&!f.querySelector('[type=submit]').disabled)enquiryForward(f);},280));
  }
 }else if(control.hasAttribute('data-enquiry-edit')){
  f.dataset.enquiryReturn='review';enquiryShowStep(f,Number(control.dataset.enquiryEdit));
 }else if(control.hasAttribute('data-enquiry-back')){
  delete f.dataset.enquiryReturn;enquiryShowStep(f,Number(f.dataset.enquiryStep)-1);
 }else if(control.hasAttribute('data-enquiry-jump')){
  delete f.dataset.enquiryReturn;enquiryShowStep(f,Number(control.dataset.enquiryJump));
 }else if(control.hasAttribute('data-enquiry-review-now')){
  if(enquiryValidate(f,true))enquiryShowStep(f,enquiryLastStep(f));
 }else enquiryForward(f);
});
document.addEventListener('input',e=>{
 const control=e.target,f=control.form;if(!f?.hasAttribute('data-enquiry-flow'))return;
 enquiryCancelAdvance(f);control.setCustomValidity('');control.removeAttribute('aria-invalid');control.removeAttribute('aria-describedby');enquirySyncChoices(f);
});
document.addEventListener('change',e=>{
 const control=e.target,f=control.form;if(!f?.hasAttribute('data-enquiry-flow'))return;
 if(control.hasAttribute('data-enquiry-auto')){
  f.elements.namedItem('_auto_advance').value=control.checked?'on':'off';enquiryShowStep(f,Number(f.dataset.enquiryStep),false);
 }else{enquiryCancelAdvance(f);enquirySyncChoices(f);}
});
// A dedicated gesture strip leaves scrolling, text selection and form controls alone.
let enquirySwipe=null;
document.addEventListener('pointerdown',e=>{
 const strip=e.target.closest('[data-enquiry-swipe]');
 if(!strip||e.pointerType==='mouse'||e.isPrimary===false)return;
 const f=strip.closest('[data-enquiry-flow]');if(f.querySelector('[type=submit]').disabled)return;
 enquiryCancelAdvance(f);enquirySwipe={f,strip,id:e.pointerId,x:e.clientX,y:e.clientY};strip.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointerup',e=>{
 const swipe=enquirySwipe;enquirySwipe=null;if(!swipe||swipe.id!==e.pointerId||!swipe.f.isConnected||swipe.f.querySelector('[type=submit]').disabled)return;
 const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy)*1.5)return;
 const f=swipe.f,step=Number(f.dataset.enquiryStep);
 if(dx>0&&step>0){delete f.dataset.enquiryReturn;enquiryShowStep(f,step-1);}
 else if(dx<0&&step<enquiryLastStep(f))enquiryForward(f);
});
document.addEventListener('pointercancel',()=>{enquirySwipe=null;});
window.addEventListener('hashchange',()=>{enquirySwipe=null;document.querySelectorAll('[data-enquiry-flow]').forEach(enquiryCancelAdvance);});
