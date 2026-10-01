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
function workspaceIcon(name) {
  const shapes={
    today:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    train:'<path d="m8 8 8 8M6 10l4-4m4 12 4-4M3 7l4-4m10 18 4-4M3 3l4 4m10 10 4 4"/>',
    eat:'<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M19 3c-3 3-4 6-4 9h4V3Zm0 9v9"/>',
    progress:'<path d="M4 3v17h17M8 14l4-4 4 2 5-7"/><path d="M17 5h4v4"/>',
    account:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
  };
  return `<svg class="workspace-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name]||shapes.today}</svg>`;
}
function clientPrimarySection(path=route()) {
  const section=path.split('?')[0].replace(/\/$/,'').split('/')[2]||'';
  if(['recipes','recipe','foods','nutrition','planner','shopping','cook','adapt','catering'].includes(section))return 'eat';
  if(['plans','movement'].includes(section))return 'train';
  if(section==='progress')return 'progress';
  if(['profile','money'].includes(section))return 'account';
  return 'today';
}
function clientWorkspaceTabs() {
  const primary=[['','Today','today'],['plans','Train','train'],['recipes','Eat','eat'],['progress','Progress','progress'],['profile','Account','account']];
  const groups=[
    ['Your week','☀️',[['today','Daily schedule'],['plans','My plans'],['checkins','Check-ins'],['movement','Move your way'],['rhythm','My rhythm']]],
    ['Food & kitchen','🍽️',[['planner','Meal planner'],['shopping','Shop & prepare'],['nutrition','Food diary']]],
    ['Support & ideas','💬',[['requests','My requests'],['contact','Contact Alex'],['money','Payments'],['learn','Field guide'],['feel-good','Feel-good ideas']]]
  ];
  const path=route().split('?')[0].replace(/\/$/,''),active=clientPrimarySection(path);
  const titles={adapt:'Recipe swaps',catering:'Group quantities',cook:'Kitchen mode',recipe:'Recipe',foods:'Food library'};
  const current=titles[path.split('/')[2]]||groups.flatMap(([, ,links])=>links).find(([p])=>path==='/portal/'+p)?.[1]||primary.find(([p])=>path==='/portal'+(p?'/'+p:''))?.[1]||'Today';
  return `<aside class="workspace-nav client-workspace-nav"><nav class="client-primary-links" aria-label="Your everyday navigation">${primary.map(([p,title,icon])=>{const target='/portal'+(p?'/'+p:''),selected=icon===active;return `<a href="#${target}" class="client-primary-link${selected?' active':''}"${selected?` aria-current="${path===target?'page':'true'}"`:''}${icon==='train'?' title="Training & meal plans"':''}>${workspaceIcon(icon)}<span class="client-primary-label">${title}</span>${icon==='train'?'<small class="client-primary-description">Training & meal plans</small>':''}</a>`;}).join('')}</nav><button type="button" class="section-toggle" data-section-toggle aria-expanded="false" aria-controls="workspace-links"><span><small>More in your space</small><strong>${esc(current)}</strong></span><span class="section-toggle-hint">Shortcuts <span aria-hidden="true">⌄</span></span></button><nav id="workspace-links" class="tabs client-shortcuts" aria-label="More client shortcuts">${groups.map(([title,icon,links],group)=>`<details class="workspace-nav-group client-shortcut-group" role="group" aria-labelledby="workspace-group-${group}"${links.some(([p])=>path==='/portal/'+p)?' open':''}><summary id="workspace-group-${group}"><span aria-hidden="true">${icon}</span> ${esc(title)}</summary><div class="workspace-nav-links">${links.map(([p,title])=>`<a href="#/portal/${p}"${path==='/portal/'+p?' class="active" aria-current="page"':''}>${esc(title)}<span aria-hidden="true">↗</span></a>`).join('')}</div></details>`).join('')}</nav></aside>`;
}
function workspaceTabs(admin=false) {
  if(!admin)return clientWorkspaceTabs();
  const groups=[
    ['Day to day',[['','Overview'],['requests','Requests'],['clients','Clients'],['checkins','Check-ins']]],
    ['Plans & progress',[['plans','Plan studio'],['nutrition','Nutrition'],['rhythm','Client weeks'],['progress','Plan activity'],['fitness','Fitness progress']]],
    ['Your business',[['services','Services'],['money','Money'],['contact','Contact options'],['audit','Activity'],['setup','Setup & testing']]]
  ];
  const items=groups.flatMap(([,links])=>links);
  const base=admin?'/admin':'/portal',current=route().endsWith('/adapt')?'Recipe swaps':route().endsWith('/catering')?'Group quantities':route()==='/portal/cook'?'Kitchen mode':route()==='/portal/recipe'?'Recipe':route()==='/portal/foods'?'Food library':items.find(([p])=>route()===base+(p?'/'+p:''))?.[1]||'Overview';
  return `<aside class="workspace-nav"><button type="button" class="section-toggle" data-section-toggle aria-expanded="false" aria-controls="workspace-links"><span><small>${admin?'Alex’s workspace':'Your space'}</small><strong>${esc(current)}</strong></span><span class="section-toggle-hint">Sections <span aria-hidden="true">⌄</span></span></button><nav id="workspace-links" class="tabs" aria-label="${admin?'Admin':'Client'} sections">${groups.map(([title,links],group)=>`<div class="workspace-nav-group" role="group" aria-labelledby="workspace-group-${group}"><p class="workspace-nav-label" id="workspace-group-${group}">${esc(title)}</p><div class="workspace-nav-links">${links.map(([p,t])=>{const path=base+(p?'/'+p:'');return `<a href="#${path}" ${route()===path?'class="active" aria-current="page"':''}>${t}<span aria-hidden="true">↗</span></a>`;}).join('')}</div></div>`).join('')}</nav></aside>`;
}
function syncNavigation() {
  setMenu(false);setSections(false);
  document.body?.classList.toggle('has-client-navigation',Boolean(document.querySelector('.client-workspace-nav')));
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
