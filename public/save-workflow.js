'use strict';
// Save the requested data, but never let an older result take over newer work.
const pendingFormTasks=new WeakMap();
let formEditVersion=0;
for(const event of ['input','change'])document.addEventListener(event,()=>{formEditVersion++;});
document.addEventListener('submit',e=>{if(pendingFormTasks.has(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
function formTaskView(state){return state.form.isConnected&&state.render===renderVersion&&state.hash===location.hash&&state.owner===session.user?.id;}
async function saveFormTask(f,{write,destination,success,confirmation,linkLabel,unconfirmed}){
 if(pendingFormTasks.has(f))return;
 formEditVersion++;
 const state={form:f,render:renderVersion,hash:location.hash,owner:session.user?.id,edits:formEditVersion,locked:[]};
 pendingFormTasks.set(f,state);f.setAttribute('aria-busy','true');
 // Callers captured the payload before locking. Preserve each control's prior state for retry.
 for(const control of f.elements){if(control.type==='hidden')continue;const property=control.tagName==='SELECT'||control.tagName==='BUTTON'||['checkbox','radio'].includes(control.type)?'disabled':'readOnly';state.locked.push([control,property,control[property]]);control[property]=true;}
 try{
  await write();
  if(state.owner!==session.user?.id)return;
  const sameView=formTaskView(state),untouched=state.edits===formEditVersion;
  toast(success);
  const sameDestination=state.hash==='#'+destination;
  if(sameView&&untouched&&sameDestination){
   // Privacy wins over edit preservation if this refresh discovers an account switch.
   await render({canCommit:()=>state.owner!==session.user?.id||(state.edits===formEditVersion&&state.hash===location.hash)});
   if(state.owner!==session.user?.id)toast('Your signed-in account changed. Reopen the task in this account.');
  }
  if(sameView&&f.isConnected&&state.hash===location.hash&&state.owner===session.user?.id&&(!sameDestination||state.edits!==formEditVersion)){
   // Cross-page saves stay here. Explicit navigation avoids racing edits against a new page load.
   const message=state.edits!==formEditVersion?confirmation:success+' You can keep working here or open the saved entry.';
   f.removeAttribute('data-form');f.innerHTML=`<p role="status">${esc(message)}</p><a class="button secondary small" href="#${esc(destination)}">${esc(linkLabel)}</a>`;
  }
 }catch(error){
  error.preserveFormFocus=!formTaskView(state)||state.edits!==formEditVersion;
  if(state.owner===session.user?.id&&!formTaskView(state))toast(unconfirmed);
  throw error;
 }finally{
  for(const [control,property,value] of state.locked)control[property]=value;
  f.removeAttribute('aria-busy');pendingFormTasks.delete(f);
 }
}
