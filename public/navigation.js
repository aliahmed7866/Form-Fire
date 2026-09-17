/* Accessible site navigation, workspace section picker and sign-in diagnostics. */
function setMenu(open,{focus=false}={}) {
  const header=document.querySelector('.site-header'),toggle=document.querySelector('[data-nav-toggle]');
  if(!header||!toggle)return;
  header.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',String(open));
  toggle.querySelector('[data-menu-label]').textContent=open?'Close':'Menu';
  if(focus)toggle.focus();
}
function setSections(open,{focus=false}={}) {
  const nav=document.querySelector('.workspace-nav'),button=document.querySelector('[data-section-toggle]');
  if(!nav||!button)return;
  nav.classList.toggle('sections-open',open);button.setAttribute('aria-expanded',String(open));
  if(focus)button.focus();
}
function workspaceTabs(admin=false) {
  const items=admin?[['','Overview'],['requests','Requests'],['clients','Clients'],['plans','Plan studio'],['checkins','Check-ins'],['progress','Client progress'],['services','Services'],['money','Money'],['audit','Activity'],['setup','Setup & testing']]:[['','Overview'],['today','Today'],['shopping','Shop & prepare'],['feel-good','Feel-good ideas'],['requests','My requests'],['plans','My plans'],['checkins','Check-ins'],['money','Payments'],['profile','My profile']];
  const base=admin?'/admin':'/portal',current=items.find(([p])=>route()===base+(p?'/'+p:''))?.[1]||'Overview';
  return `<aside class="workspace-nav"><button type="button" class="section-toggle" data-section-toggle aria-expanded="false" aria-controls="workspace-links"><span><small>${admin?'Alex’s workspace':'Your space'}</small><strong>${esc(current)}</strong></span><span class="section-toggle-hint">Sections <span aria-hidden="true">⌄</span></span></button><nav id="workspace-links" class="tabs" aria-label="${admin?'Admin':'Client'} sections">${items.map(([p,t])=>{const path=base+(p?'/'+p:'');return `<a href="#${path}" ${route()===path?'class="active" aria-current="page"':''}>${t}<span aria-hidden="true">↗</span></a>`;}).join('')}</nav></aside>`;
}
function syncNavigation() {
  setMenu(false);setSections(false);
  const header=document.querySelector('.site-header');if(header)header.dataset.navReady='true';
  const badge=document.querySelector('[data-workspace-badge]');
  if(badge){badge.textContent=session.instance?.kind==='demo'?'FICTIONAL DEMO':'LOCAL TEST EDITION';}
  const status=document.querySelector('[data-workspace-status]');
  if(status)status.textContent=session.instance?.kind==='demo'?'Separate test accounts · All records are fictional':'Use sample details · Email and online payments are not connected';
  const account=document.querySelector('#account-link');
  if(account){const active=route().startsWith(session.user?.role==='admin'?'/admin':'/portal')||route()==='/login';if(active)account.setAttribute('aria-current','page');else account.removeAttribute('aria-current');}
}
function passwordControl(title,extra='') {
  return `<div class="password-control">${field('password',title,'','password',`id="auth-password" required ${extra}`)}<button type="button" class="password-toggle" data-password-toggle aria-controls="auth-password" aria-pressed="false">Show password</button></div>`;
}
function workspaceIdentity() {
  const port=location.port||'8085';
  return `<div class="workspace-identity"><span class="connection-dot" aria-hidden="true"></span><span>${esc(session.instance?.label||'Your local workspace')} <small>Port ${esc(port)}</small></span></div>`;
}
function loginHelp() {
  const demo=session.instance?.kind==='demo';
  return `<details class="signin-help"><summary>Having trouble signing in?</summary><p>${demo?'This demo has its own accounts. Use the logins from form-fire-demo logins, rather than your main app’s account.':'Use the account created in this workspace. Accounts on another port may belong to a separate database.'}</p><p>${demo?'In Termux, use form-fire-demo status to check the server, or form-fire-demo recover followed by your demo email to get a private recovery code.':'If you changed your password, use the new one or choose Forgot your password.'}</p><button type="button" class="secondary small" data-connection-check>Check connection</button><p class="micro" data-connection-status role="status"></p></details>`;
}
document.addEventListener('click',async e=>{
  if(e.target.closest('a[href="#main"]')){e.preventDefault();const main=document.querySelector('#main');main.focus();main.scrollIntoView({block:'start'});return;}
  const toggle=e.target.closest('[data-nav-toggle]');
  if(toggle){setMenu(toggle.getAttribute('aria-expanded')!=='true');return;}
  const sections=e.target.closest('[data-section-toggle]');
  if(sections){setSections(sections.getAttribute('aria-expanded')!=='true');return;}
  if(e.target.closest('.site-header a'))setMenu(false);
  else if(!e.target.closest('.site-header')&&document.querySelector('.site-header.menu-open'))setMenu(false);
  if(e.target.closest('.workspace-nav a'))setSections(false);
  const password=e.target.closest('[data-password-toggle]');
  if(password){const input=document.querySelector('#auth-password'),show=input.type==='password';input.type=show?'text':'password';password.textContent=show?'Hide password':'Show password';password.setAttribute('aria-pressed',String(show));return;}
  const connection=e.target.closest('[data-connection-check]');if(!connection)return;
  const feedback=connection.closest('details').querySelector('[data-connection-status]');connection.disabled=true;feedback.textContent='Checking this workspace…';
  try{session=await api('/session');feedback.textContent=`Connected to ${session.instance?.label||'FORM & FIRE'} on port ${location.port||'8085'}. Your session is refreshed; try signing in again.`;}
  catch(error){feedback.textContent=error.message;}
  finally{connection.disabled=false;}
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  if(document.querySelector('.site-header.menu-open')){setMenu(false,{focus:true});e.preventDefault();}
  else if(document.querySelector('.workspace-nav.sections-open')){setSections(false,{focus:true});e.preventDefault();}
});
window.addEventListener('resize',()=>{if(window.innerWidth>=1024)setMenu(false);if(window.innerWidth>=1180)setSections(false);});
