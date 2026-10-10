import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';

function harness(){
 const listeners=new Map<string,any>(),windowListeners=new Map<string,any>(),nodes=new Map<string,any>();
 const element=()=>({dataset:{},attrs:new Map<string,string>(),classes:new Set<string>(),focused:false,textContent:'',setAttribute(k:string,v:string){this.attrs.set(k,v);},getAttribute(k:string){return this.attrs.get(k);},focus(){this.focused=true;},classList:{toggle(_k:string,_v:boolean){}}});
 const header=element(),nav=element(),toggle=element(),section=element(),label=element(),body=element();
 for(const e of [header,nav,body])e.classList.toggle=(k,v)=>{if(v)e.classes.add(k);else e.classes.delete(k);};
 Object.assign(toggle,{querySelector:()=>label});
 nodes.set('.site-header',header);nodes.set('.workspace-nav',nav);nodes.set('[data-nav-toggle]',toggle);nodes.set('[data-section-toggle]',section);
 const c=createContext({document:{body,querySelector(selector:string){if(selector==='.site-header.menu-open')return header.classes.has('menu-open')?header:null;if(selector==='.workspace-nav.sections-open')return nav.classes.has('sections-open')?nav:null;return nodes.get(selector)||null;},addEventListener:(k:string,f:any)=>listeners.set(k,f)},window:{innerWidth:390,addEventListener:(k:string,f:any)=>windowListeners.set(k,f)},location:{port:'8086'},session:{instance:{kind:'demo',label:'Fictional demo'}},route:()=>'/portal/plans',esc:(v:string)=>String(v).replaceAll('<','&lt;'),api:async()=>({instance:{label:'Fictional demo'},csrf:'fresh'})});
 runInContext(readFileSync(new URL('../public/navigation.js',import.meta.url),'utf8'),c);
 const click=(selector:string,target:any)=>listeners.get('click')({target:{closest:(s:string)=>s===selector?target:null}});
 return {c,header,nav,toggle,section,label,body,nodes,listeners,windowListeners,click};
}
test('Phone menus toggle accessibly, close on Escape with focus restored, and reset at desktop widths',async()=>{
 const h=harness();await h.click('[data-nav-toggle]',h.toggle);
 assert.ok(h.header.classes.has('menu-open'));assert.equal(h.toggle.attrs.get('aria-expanded'),'true');assert.equal(h.label.textContent,'Close');
 let prevented=false;h.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;}});
 assert.equal(h.toggle.attrs.get('aria-expanded'),'false');assert.ok(h.toggle.focused);assert.ok(prevented);
 await h.click('[data-section-toggle]',h.section);assert.ok(h.nav.classes.has('sections-open'));assert.equal(h.section.attrs.get('aria-expanded'),'true');
 h.listeners.get('keydown')({key:'Escape',preventDefault(){}});assert.ok(h.section.focused);assert.equal(h.section.attrs.get('aria-expanded'),'false');
 await h.click('[data-nav-toggle]',h.toggle);await h.click('.site-header a',{});assert.equal(h.toggle.attrs.get('aria-expanded'),'false');
 await h.click('[data-section-toggle]',h.section);await h.click('[data-nav-toggle]',h.toggle);h.c.window.innerWidth=1440;h.windowListeners.get('resize')();assert.equal(h.toggle.attrs.get('aria-expanded'),'false');assert.equal(h.section.attrs.get('aria-expanded'),'false');
});
test('Five labelled client destinations simplify the workspace without exposing admin destinations',()=>{
 const h=harness(),client=runInContext('workspaceTabs()',h.c);assert.ok(client.includes('aria-controls="workspace-links"'));assert.ok(client.includes('href="#/portal/plans" class="client-primary-link active" aria-current="page"'));assert.ok(!client.includes('#/admin'));
 const primary=client.match(/<nav class="client-primary-links"[^>]*>(.*?)<\/nav>/s)?.[1]||'';
 assert.deepEqual([...primary.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]),['/portal','/portal/plans','/portal/recipes','/portal/progress','/portal/profile']);
 assert.deepEqual([...primary.matchAll(/class="client-primary-label">([^<]+)</g)].map(m=>m[1]),['Today','Train','Eat','Progress','Account']);
 assert.equal((primary.match(/<svg/g)||[]).length,5);assert.equal((primary.match(/aria-hidden="true" focusable="false"/g)||[]).length,5);
 assert.ok(primary.includes('Training & meal plans'));assert.ok(client.includes('>My plans<span'));
 h.c.route=()=>'/admin/requests';const admin=runInContext('workspaceTabs(true)',h.c);assert.ok(admin.includes('href="#/admin/requests" class="active" aria-current="page"'));assert.ok(admin.includes('#/admin/plans'));assert.ok(!admin.includes('#/portal'));
 assert.ok(!admin.includes('client-primary-links'));
});
test('Expandable client shortcuts preserve every existing destination, and admin groups remain unchanged',()=>{
 const h=harness();
 for(const [admin,expected] of [
  [false,['','today','movement','progress','nutrition','recipes','planner','rhythm','learn','shopping','feel-good','requests','plans','checkins','money','contact','profile']],
  [true,['','requests','clients','plans','nutrition','rhythm','checkins','progress','fitness','services','money','audit','contact','setup']]
 ] as const){
  const html=runInContext(`workspaceTabs(${admin})`,h.c),base=admin?'/admin':'/portal';
  const paths=[...html.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual([...new Set(paths)].sort(),expected.map(p=>base+(p?'/'+p:'')).sort());
  if(admin)assert.equal(paths.length,expected.length);
  else{
   assert.equal((html.match(/<details /g)||[]).length,3);assert.ok(html.includes('aria-label="More client shortcuts"'));
   // The inclusive My plans shortcut remains available alongside the Train primary link.
   assert.equal(paths.filter(p=>p==='/portal/plans').length,2);
   assert.equal((html.match(/<details [^>]* open>/g)||[]).length,1);
  }
  assert.equal((html.match(/role="group"/g)||[]).length,3);
  for(let group=0;group<3;group++)assert.ok(html.includes(`id="workspace-group-${group}"`));
 }
});
test('Related routes highlight the appropriate primary destination while shortcuts identify the exact page',()=>{
 const h=harness();
 for(const [group,paths] of [
  ['today',['/portal','/portal/today','/portal/checkins','/portal/rhythm','/portal/requests','/portal/contact','/portal/learn','/portal/feel-good']],
  ['train',['/portal/plans','/portal/movement']],
  ['eat',['/portal/recipes','/portal/recipe','/portal/foods','/portal/nutrition','/portal/planner','/portal/shopping','/portal/cook','/portal/adapt','/portal/catering']],
  ['progress',['/portal/progress']],['account',['/portal/profile','/portal/money']]
 ] as const){
  for(const path of paths){
   h.c.route=()=>path;assert.equal(runInContext('clientPrimarySection()',h.c),group,path);
   const html=runInContext('workspaceTabs()',h.c),primary=html.match(/<nav class="client-primary-links"[^>]*>(.*?)<\/nav>/s)?.[1]||'';
   assert.equal((primary.match(/client-primary-link active/g)||[]).length,1,path);
   const active=primary.match(/<a href="#([^"]+)" class="client-primary-link active" aria-current="([^"]+)"/);
   assert.equal(active?.[1],({today:'/portal',train:'/portal/plans',eat:'/portal/recipes',progress:'/portal/progress',account:'/portal/profile'})[group],path);
   assert.equal(active?.[2],path===active?.[1]?'page':'true',path);
  }
 }
 h.c.route=()=>'/portal/today';const html=runInContext('workspaceTabs()',h.c);assert.ok(html.includes('href="#/portal/today" class="active" aria-current="page"'));assert.ok(html.includes('<strong>Daily schedule</strong>'));
 h.c.route=()=>'/portal/catering?id=recipe-1';assert.equal(runInContext('clientPrimarySection()',h.c),'eat');assert.ok(runInContext('workspaceTabs()',h.c).includes('<strong>Group quantities</strong>'));
});
test('Client mobile navigation reserves safe-area space and resets when leaving the client workspace',()=>{
 const h=harness();h.nodes.set('.client-workspace-nav',h.nav);runInContext('syncNavigation()',h.c);assert.ok(h.body.classes.has('has-client-navigation'));
 h.nodes.delete('.client-workspace-nav');runInContext('syncNavigation()',h.c);assert.ok(!h.body.classes.has('has-client-navigation'));
 const css=readFileSync(new URL('../public/navigation-experience.css',import.meta.url),'utf8');
 const mobile=css.slice(css.indexOf('@media(max-width:760px)'),css.indexOf('@media(max-width:340px)'));
 assert.match(mobile,/body\.has-client-navigation\{padding-bottom:calc\(82px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(mobile,/\.client-workspace-nav \.client-primary-links\{position:fixed;inset:auto 0 0/);
 assert.match(mobile,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(mobile,/body\.has-client-navigation #toast\{bottom:calc\(88px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(mobile,/scroll-margin-bottom:calc\(94px \+ env\(safe-area-inset-bottom,0px\)\)/);
});
test('Skip to content focuses main without changing the application route',async()=>{
 const h=harness();let focused=false,scrolled=false,prevented=false;
 h.nodes.set('#main',{focus(){focused=true;},scrollIntoView(){scrolled=true;}});
 await h.listeners.get('click')({target:{closest:(selector:string)=>selector==='a[href="#main"]'?{}:null},preventDefault(){prevented=true;}});
 assert.ok(focused&&scrolled&&prevented);assert.equal(h.c.route(),'/portal/plans');
});
test('Password visibility and connection checks preserve entered values and refresh only the session',async()=>{
 const h=harness(),input={type:'password',value:'Keep this exact password'},button={textContent:'Show password',setAttribute(_k:string,v:string){this.pressed=v;},pressed:'false'};
 h.nodes.set('#auth-password',input);await h.click('[data-password-toggle]',button);assert.equal(input.type,'text');assert.equal(button.pressed,'true');await h.click('[data-password-toggle]',button);assert.equal(input.type,'password');assert.equal(input.value,'Keep this exact password');
 const feedback={textContent:''},check={disabled:false,closest:()=>({querySelector:()=>feedback})};let calls=0;
 h.c.api=async(path:string)=>{assert.equal(path,'/session');calls++;return {instance:{label:'Fictional demo'},csrf:'fresh'};};
 await h.click('[data-connection-check]',check);assert.equal(calls,1);assert.equal(check.disabled,false);assert.match(feedback.textContent,/Connected to Fictional demo on port 8086/);assert.equal(h.c.session.csrf,'fresh');assert.equal(input.value,'Keep this exact password');
});
test('Task search matches everyday phrases and stays within the selected role',()=>{
 const h=harness();
 const search=(admin:boolean,term:string)=>JSON.parse(runInContext(`JSON.stringify(workspaceTaskMatches(${admin},${JSON.stringify(term)}))`,h.c));
 assert.ok(search(false,'log food').some((task:any)=>task.href==='/portal/nutrition'));
 assert.ok(search(false,'check in').some((task:any)=>task.href==='/portal/checkins'));
 assert.ok(search(false,'workout').some((task:any)=>task.href==='/portal/today'));
 assert.ok(search(true,'publish').some((task:any)=>task.href==='/admin/plans'));
 assert.ok(search(false,'publish').every((task:any)=>task.href.startsWith('/portal')));
 assert.equal(search(false,'zzzz no task').length,0);
 assert.equal(search(false,'  ').length,0);
 for(const admin of [false,true])for(const task of search(admin,'e'))assert.ok(task.href.startsWith(admin?'/admin':'/portal'));
 assert.equal(search(false,'<script>').length,0);
});
test('Browser titles identify each destination without putting client records in history',()=>{
 const h=harness();
 for(const path of ['/portal/today?date=2026-10-01','/admin/clients','/request/private-client-id','/plan/private-title-id'])assert.equal(runInContext(`pageTitle(${JSON.stringify(path)})`,h.c),'Sign in · FORM & FIRE');
 h.c.session.user={role:'client'};
 for(const [path,title] of [['/portal','Today'],['/portal/today?date=2026-10-01','Daily schedule'],['/portal/nutrition','Food diary'],['/portal/profile','My details'],['/request/private-client-id','Conversation'],['/plan/private-title-id','Published plan'],['/login','Sign in'],['/privacy','Privacy'],['/unknown','Page not found']])assert.equal(runInContext(`pageTitle(${JSON.stringify(path)})`,h.c),title+' · FORM & FIRE');
 assert.equal(runInContext("pageTitle('/google-setup')",h.c),'Your space · FORM & FIRE');
 h.c.session.user={role:'admin'};assert.equal(runInContext("pageTitle('/google-setup')",h.c),'Connection setup · FORM & FIRE');assert.equal(runInContext("pageTitle('/test-admin')",h.c),'Setup & testing · FORM & FIRE');assert.equal(runInContext("pageTitle('/admin/requests?search=Private%20name')",h.c),'Requests · Alex’s admin · FORM & FIRE');
 assert.equal(runInContext("pageTitle('/portal/constructor')",h.c),'Your space · FORM & FIRE');
});
