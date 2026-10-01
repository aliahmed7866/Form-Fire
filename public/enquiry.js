'use strict';

// All panels belong to one form: Back and authentication never discard answers.
function enquiryFlow(chef,d,sid){
 const kind=chef?'chef':'coaching',step=Math.max(0,Math.min(2,Number(d._step)||0));
 const options=services.filter(s=>s.kind!=='chef').map(s=>[s.id,s.title]);
 const support=options.some(([id])=>id===sid)?sid:'';
 const first=chef?
  field('date','Preferred date',d.date||'','date','required')+field('location','Town or event location',d.location||'','text','required maxlength="500"')+field('occasion','What’s the occasion?',d.occasion||'','text','required maxlength="300"'):
  select('service_id','What would you like support with?',[['','Choose your support'],...options],support).replace('<select name="service_id">','<select name="service_id" required>')+`<label>What would you like to work towards?<span class="field-hint">A sentence is enough. For example, feeling stronger or finding a food routine you enjoy.</span><textarea name="goals" required maxlength="4000" rows="3">${esc(d.goals||'')}</textarea></label>`;
 const second=chef?
  `<div class="form-grid">${field('guests','Number of guests',d.guests||'','number','required min="1" max="1000" step="1"')}${field('budget','Indicative total budget',d.budget||'','number','required min="0" step="0.01"')}</div><details class="enquiry-extra"><summary>Currency, time zone & dietary details</summary><div class="form-grid">${field('currency','Currency',d.currency||'GBP','text','required pattern="[A-Z]{3}" maxlength="3"')}${field('timezone','Event time zone',d.timezone||'Europe/London','text','required maxlength="80"')}</div>${area('dietary','Dietary requirements (optional)',d.dietary||'',false)}${area('notes','Anything else? (optional)',d.notes||'',false)}</details><input type="hidden" name="service_id" value="chef">`:
  `<p>Share what you know, or continue and work it out with Alex. You can add details later in your conversation.</p><label>What could fit into your week? (optional)<span class="field-hint">For example, two short sessions or help with weekday dinners.</span><textarea name="availability" maxlength="2000" rows="3">${esc(d.availability||'')}</textarea></label><details class="enquiry-extra"><summary>Add experience, equipment or food preferences (optional)</summary>${area('experience','Your experience so far (optional)',d.experience||'',false)}${area('equipment','Equipment or spaces you can use (optional)',d.equipment||'',false)}${area('preferences','Food you enjoy or prefer to avoid (optional)',d.preferences||'',false)}</details>`;
 const names=chef?['Your gathering','A few practical details','Review your enquiry']:['Your starting point','Your routine (optional)','Review your request'];
 return `<form data-form="enquiry-${kind}" data-enquiry-flow data-enquiry-step="${step}" novalidate>
  <input type="hidden" name="idempotency_key" value="${esc(d.idempotency_key||crypto.randomUUID())}">
  <p class="enquiry-progress" data-enquiry-progress aria-live="polite">Step ${step+1} of 3 · ${names[step]}</p>
  <div class="error" role="alert" tabindex="-1" data-enquiry-error></div>
  ${[first,second,'<div data-enquiry-review></div><p class="micro">This starts a conversation. Alex will agree the package, price and any booking details with you separately.</p>'].map((content,i)=>`<section data-enquiry-panel="${i}" ${i===step?'':'hidden'} aria-labelledby="enquiry-${kind}-${i}"><h2 id="enquiry-${kind}-${i}" tabindex="-1">${names[i]}</h2>${content}</section>`).join('')}
  <div class="enquiry-controls"><button type="button" class="secondary" data-enquiry-back ${step===0?'hidden':''}>Back</button><button type="button" data-enquiry-next ${step===2?'hidden':''}>${step===0?'Continue':'Review request'} →</button><button type="submit" ${step===2?'':'hidden'}>${session.user?.verified?'Send your request':'Continue to account'} ↗</button></div>
  <p class="micro enquiry-draft-note" data-enquiry-draft>Draft kept in this browser tab. Nothing is sent until you choose Send your request.</p>
 </form>`;
}

function enquiryReview(f){
 const data=Object.fromEntries(new FormData(f)),chef=f.dataset.form==='enquiry-chef';
 const groups=chef?[
  [['Preferred date',data.date],['Event location',data.location],['Occasion',data.occasion]],
  [['Guests',data.guests],['Indicative total budget',`${data.currency} ${data.budget}`],['Time zone',data.timezone],['Dietary requirements',data.dietary],['Anything else',data.notes]]
 ]:[
  [['Support',services.find(s=>s.id===data.service_id)?.title||data.service_id],['Your goal',data.goals]],
  [['Your routine',data.availability],['Experience',data.experience],['Equipment / spaces',data.equipment],['Food preferences',data.preferences]]
 ];
 f.querySelector('[data-enquiry-review]').innerHTML=groups.map((rows,i)=>`<div class="enquiry-review-group"><dl>${rows.map(([name,value])=>`<dt>${esc(name)}</dt><dd>${value?esc(value):'<span class="muted">Not added — discuss with Alex</span>'}</dd>`).join('')}</dl><button type="button" class="secondary small" data-enquiry-edit="${i}">Edit ${i===0?(chef?'gathering':'starting point'):(chef?'practical details':'routine')}</button></div>`).join('');
}

function enquiryShowStep(f,step,focus=true){
 step=Math.max(0,Math.min(2,step));f.dataset.enquiryStep=String(step);
 f.querySelectorAll('[data-enquiry-panel]').forEach((panel,i)=>{panel.hidden=i!==step;});
 f.querySelector('[data-enquiry-back]').hidden=step===0;
 f.querySelector('[data-enquiry-next]').hidden=step===2;
 f.querySelector('[data-enquiry-next]').textContent=(step===0?'Continue':'Review request')+' →';
 f.querySelector('[type=submit]').hidden=step!==2;
 const heading=f.querySelector(`[data-enquiry-panel="${step}"] h2`);
 f.querySelector('[data-enquiry-progress]').textContent=`Step ${step+1} of 3 · ${heading.textContent}`;
 f.querySelector('.error').textContent='';
 if(step===2)enquiryReview(f);
 draftSave(f);
 if(focus){heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'auto'});}
}

function enquiryValidate(f,all=false){
 const panels=all?[...f.querySelectorAll('[data-enquiry-panel]')]:[f.querySelector(`[data-enquiry-panel="${f.dataset.enquiryStep}"]`)];
 const controls=panels.flatMap(panel=>[...panel.querySelectorAll('input,select,textarea')]);
 for(const control of controls){control.removeAttribute('aria-invalid');control.removeAttribute('aria-describedby');if(control.required&&control.type!=='hidden')control.setCustomValidity(control.value.trim()?'':'Please add an answer.');}
 const invalid=controls.find(control=>!control.checkValidity());
 if(!invalid)return true;
 const panel=invalid.closest('[data-enquiry-panel]');
 enquiryShowStep(f,Number(panel.dataset.enquiryPanel),false);
 const details=invalid.closest('details');if(details)details.open=true;
 const error=f.querySelector('.error');error.id=f.dataset.form+'-error';
 const title=invalid.closest('label')?.childNodes[0]?.textContent.trim()||'This answer';
 error.textContent=`${title}: ${invalid.validationMessage}`;
 invalid.setAttribute('aria-invalid','true');invalid.setAttribute('aria-describedby',error.id);
 invalid.focus({preventScroll:true});invalid.scrollIntoView({block:'center',behavior:'auto'});
 return false;
}

function enquiryReadyToSubmit(f){
 if(f.querySelector('[type=submit]').disabled)return false;
 if(Number(f.dataset.enquiryStep)<2){if(enquiryValidate(f))enquiryShowStep(f,Number(f.dataset.enquiryStep)+1);return false;}
 return enquiryValidate(f,true);
}

function initEnquiryForms(){
 document.querySelectorAll('[data-enquiry-flow]').forEach(f=>{
  // Bound all optional answers to the API limits too.
  f.querySelectorAll('textarea').forEach(control=>{control.maxLength=control.name==='goals'?4000:(f.dataset.form==='enquiry-chef'?3000:2000);});
  enquiryShowStep(f,Number(f.dataset.enquiryStep),false);
 });
}

document.addEventListener('click',e=>{
 const control=e.target.closest('[data-enquiry-back],[data-enquiry-next],[data-enquiry-edit]');
 if(!control)return;const f=control.closest('[data-enquiry-flow]');if(!f||f.querySelector('[type=submit]').disabled)return;
 if(control.hasAttribute('data-enquiry-back'))enquiryShowStep(f,Number(f.dataset.enquiryStep)-1);
 else if(control.hasAttribute('data-enquiry-edit'))enquiryShowStep(f,Number(control.dataset.enquiryEdit));
 else if(enquiryValidate(f))enquiryShowStep(f,Number(f.dataset.enquiryStep)+1);
});
document.addEventListener('input',e=>{
 const control=e.target;if(!control.form?.hasAttribute('data-enquiry-flow'))return;
 control.setCustomValidity('');control.removeAttribute('aria-invalid');control.removeAttribute('aria-describedby');
});
