import { createShowcaseCue } from './showcase-cue.js';

// Operate the app's controls, with time to follow each action and read its result.
export function createShowcaseUI({getSession,request,renderPage,setRoute,wait=ms=>new Promise(r=>setTimeout(r,ms)),gate=async()=>{},pace=()=>1,settle=async()=>{},note=()=>{},preview=()=>{}}) {
 const cue=createShowcaseCue(),navigation={links:0,direct:0};
 const find=selector=>{const el=document.querySelector(selector);if(!el)throw Error('The tour could not find '+selector+'. It has stopped here.');return el;};
 const expose=el=>{document.querySelectorAll('.showcase-focus').forEach(e=>e.classList.remove('showcase-focus'));el.classList.add('showcase-focus');el.scrollIntoView({block:'center',behavior:'instant'});};
 const beat=async(ms=900)=>{await gate();await wait(ms/pace());await gate();};
 const assertPage=()=>{const el=document.querySelector('#main [data-error-code]');if(el){const error=Error(el.textContent);error.code=el.getAttribute('data-error-code');throw error;}};
 const until=async predicate=>{const end=Date.now()+15000;while(Date.now()<end){if(await predicate())return;await wait(80);}throw Error('The saved result did not appear. Playback has stopped; inspect this step before continuing.');};
 async function tap(el,options={}){
  await gate();await settle();const checkpoint=settle.checkpoint?.();expose(el);if(el.disabled)throw Error('The tour control is disabled.');
  note(cue.show(el));
  try{await beat(850);const oldConfirm=window.confirm;if(options.confirm)window.confirm=()=>true;
   try{el.click();}finally{window.confirm=oldConfirm;}
   await wait(120/pace());
  }finally{cue.clear();}
  await settle();settle.throwSince?.(checkpoint);assertPage();
 }
 async function prepare(el,openSelf=false){
  const closed=[];
  for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open&&!(el.tagName==='SUMMARY'&&p===el.parentElement))closed.unshift(p);
  if(openSelf&&el.tagName==='DETAILS'&&!el.open)closed.push(el);
  for(const details of closed){const summary=details.querySelector(':scope > summary');if(summary)await tap(summary);}
  expose(el);
 }
 async function fillElement(el,value){
  await prepare(el);note(cue.show(el,el.type==='checkbox'?(value?'Tick':'Untick'):el.tagName==='SELECT'?'Choose':'Fill'));
  try{
   await beat(450);
   const text=String(value),typed=el.tagName==='TEXTAREA'||['text','search','email','tel','url'].includes(el.type);
   if(typed&&text.length){
    el.value='';const chunk=Math.max(1,Math.ceil(text.length/16));
    for(let n=chunk;n<text.length+chunk;n+=chunk){await gate();el.value=text.slice(0,n);el.dispatchEvent(new Event('input',{bubbles:true}));await beat(65);}
   }else{if(el.type==='checkbox')el.checked=!!value;else el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}));}
   el.dispatchEvent(new Event('change',{bubbles:true}));await beat(450);
  }finally{cue.clear();}
 }
 async function form(key,values={},selector){
  await gate();await settle();assertPage();const f=find(selector||`form[data-form="${key}"]`);await prepare(f);
  if(f.hasAttribute('data-enquiry-flow')){
   // Walk the visible questionnaire in order, including Back for a restored draft.
   while(Number(f.dataset.enquiryStep)>0)await tap(f.querySelector('[data-enquiry-back]'));
   for(let step=0;step<2;step++){
    for(const [name,value]of Object.entries(values)){
     const el=f.elements.namedItem(name);if(!el)throw Error(`Missing field ${name} in ${key}.`);
     if(el.type==='hidden'){if(el.value!==String(value))throw Error('The recording enquiry has an unexpected hidden value.');continue;}
     if(el.closest('[data-enquiry-panel]')?.dataset.enquiryPanel===String(step))await fillElement(el,value);
    }
    await tap(f.querySelector('[data-enquiry-next]'));
    if(Number(f.dataset.enquiryStep)!==step+1)throw Error('The enquiry needs attention before continuing.');
   }
   await prepare(f.querySelector('[data-enquiry-review]'));note('Review the answers before sending.');await beat(1800);
  }else for(const [name,value]of Object.entries(values)){const el=f.elements.namedItem(name);if(!el)throw Error(`Missing field ${name} in ${key}.`);await fillElement(el,value);}
  if(!f.checkValidity()){const bad=[...f.elements].find(e=>e.validity&&!e.validity.valid);throw Error(`The ${key} form needs attention: ${bad?.name||'a field'} — ${bad?.validationMessage||'invalid value'}`);}
  const submitter=[...f.elements].find(el=>el.type==='submit'&&!el.disabled&&!el.hidden);if(!submitter)throw Error('The tour could not find the submit button for '+key+'.');
  expose(submitter);note(cue.show(submitter));
  try{await beat(1000);await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{document.removeEventListener('ff:form-result',listener);reject(Error('Save took too long. Check the result before starting a new recording.'));},25000);
   const listener=e=>{if(e.detail.form!==f)return;clearTimeout(timer);document.removeEventListener('ff:form-result',listener);if(e.detail.ok)resolve();else{const error=Error(e.detail.error);error.code=e.detail.code;reject(error);}};
   document.addEventListener('ff:form-result',listener);
   try{f.requestSubmit(submitter);}catch(error){clearTimeout(timer);document.removeEventListener('ff:form-result',listener);reject(error);}
  });}finally{cue.clear();}
  await wait(80);await settle();assertPage();await beat(1200);
 }
 const routeValue=()=>location.hash.slice(1)||'/';
 const linkFor=path=>[...document.querySelectorAll('a[href^="#/"]')].find(el=>{
  if(el.closest('#showcase-player'))return false;
  const href=el.getAttribute('href').slice(1);if(href===path)return true;
  const a=new URL(href,location.origin),b=new URL(path,location.origin);
  // A recipe link may include today's date even when the requested route omits it.
   return a.pathname===b.pathname&&[...b.searchParams].every(([k,v])=>a.searchParams.get(k)===v)&&[...a.searchParams.keys()].every(k=>b.searchParams.has(k)||k==='day'||(k==='next'&&['/login','/register','/recover'].includes(b.pathname)));
 });
 async function follow(link){
  const menu=link.closest('#main-menu'),sections=link.closest('#workspace-links');
  if(menu&&window.innerWidth<1024&&document.querySelector('[data-nav-toggle]')?.getAttribute('aria-expanded')!=='true')await tap(find('[data-nav-toggle]'));
  if(sections&&window.innerWidth<1180&&document.querySelector('[data-section-toggle]')?.getAttribute('aria-expanded')!=='true')await tap(find('[data-section-toggle]'));
  await prepare(link);await tap(link);navigation.links++;await wait(80);await settle();assertPage();
 }
 async function go(path){
  await gate();cue.clear();await settle();
  if(routeValue()===path&&!document.querySelector('#main [data-error-code]')){await beat(300);return;}
  let link=linkFor(path);
  if(!link){
   // Reach detail screens through the list/workspace a person would use.
   let parent;
   if(path.startsWith('/request/'))parent=(await getSession()).user?.role==='admin'?'/admin/requests':'/portal/requests';
   else if(path.startsWith('/plan/'))parent='/portal/plans';
   else if(path.startsWith('/portal/adapt')||path.startsWith('/portal/catering'))parent='/portal/recipe?id='+new URL(path,location.origin).searchParams.get('id');
   else if(path.startsWith('/admin/adapt')||path.startsWith('/admin/catering'))parent='/admin/plans?view=recipes';
   else if(path.startsWith('/portal/cook'))parent='/portal/planner';
   else if(path.startsWith('/portal/recipe?'))parent='/portal/recipes';
   else if(path.includes('?'))parent=path.split('?')[0];
   else if(path.startsWith('/portal/'))parent='/portal';
   else if(path.startsWith('/admin/'))parent='/admin';
   else if(path==='/register')parent='/login';
   if(parent&&parent!==path&&routeValue()!==parent){await go(parent);link=linkFor(path);}
  }
  if(link)await follow(link);
  else{note('Opening a saved view…');setRoute(path);await renderPage();navigation.direct++;await settle();assertPage();}
  window.scrollTo(0,0);await beat(900);
 }
 const ui={api:request,beat,until,form,note,preview,navigation,clearCue:()=>cue.clear(),go,
  async inspect(selector){await gate();const el=find(selector);await prepare(el,true);await beat(Math.min(3800,Math.max(1600,el.textContent.trim().split(/\s+/).length*35)));},
  async browse(){const nodes=[...document.querySelectorAll('#main h2,#main .card h3,#main .service-card h3')].filter(el=>!el.closest('details:not([open])')).slice(0,3);for(const el of nodes){await prepare(el);await beat(1600);}},
  async fill(selector,value){await gate();await fillElement(find(selector),value);await settle();assertPage();},
  async click(selector,options={}){const el=find(selector);await prepare(el);await tap(el,options);},
  async scene(heading,copy){
   const card=document.createElement('aside');card.className='showcase-scene';card.setAttribute('role','status');
   const title=document.createElement('strong'),description=document.createElement('span');title.textContent=heading;description.textContent=copy;card.append(title,description);document.body.append(card);
   try{await beat(2200);}finally{card.remove();}
  },
  async role(role,config){
   const current=await getSession(),wanted=role==='visitor'?null:config[role].email;
   if(current.user?.email===wanted||(!current.user&&!wanted))return;
   if(current.user){await go(current.user.role==='admin'?'/admin':'/portal');await ui.click('[data-action="logout"]');await getSession();}
   if(!wanted){await go('/');return;}
   await go('/login');await form('login',{email:wanted,password:config[role].password});
   if((await getSession()).user?.email!==wanted)throw Error('Role switch did not sign in to the expected fictional account.');
  }
 };
 return ui;
}
