import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';

function harness(){
 const listeners=new Map<string,any>(),windowListeners=new Map<string,any>(),nodes=new Map<string,any>();
 const element=()=>({dataset:{},attrs:new Map<string,string>(),classes:new Set<string>(),focused:false,textContent:'',setAttribute(k:string,v:string){this.attrs.set(k,v);},getAttribute(k:string){return this.attrs.get(k);},focus(){this.focused=true;},classList:{toggle(_k:string,_v:boolean){}}});
 const header=element(),nav=element(),toggle=element(),section=element(),label=element();
 for(const e of [header,nav])e.classList.toggle=(k,v)=>{if(v)e.classes.add(k);else e.classes.delete(k);};
 Object.assign(toggle,{querySelector:()=>label});
 nodes.set('.site-header',header);nodes.set('.workspace-nav',nav);nodes.set('[data-nav-toggle]',toggle);nodes.set('[data-section-toggle]',section);
 const c=createContext({document:{querySelector(selector:string){if(selector==='.site-header.menu-open')return header.classes.has('menu-open')?header:null;if(selector==='.workspace-nav.sections-open')return nav.classes.has('sections-open')?nav:null;return nodes.get(selector)||null;},addEventListener:(k:string,f:any)=>listeners.set(k,f)},window:{innerWidth:390,addEventListener:(k:string,f:any)=>windowListeners.set(k,f)},location:{port:'8086'},session:{instance:{kind:'demo',label:'Fictional demo'}},route:()=>'/portal/plans',esc:(v:string)=>String(v).replaceAll('<','&lt;'),api:async()=>({instance:{label:'Fictional demo'},csrf:'fresh'})});
 runInContext(readFileSync(new URL('../public/navigation.js',import.meta.url),'utf8'),c);
 const click=(selector:string,target:any)=>listeners.get('click')({target:{closest:(s:string)=>s===selector?target:null}});
 return {c,header,nav,toggle,section,label,nodes,listeners,windowListeners,click};
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
test('Workspace links keep client/admin destinations separate and identify the current section',()=>{
 const h=harness(),client=runInContext('workspaceTabs()',h.c);assert.ok(client.includes('aria-controls="workspace-links"'));assert.ok(client.includes('href="#/portal/plans" class="active" aria-current="page"'));assert.ok(!client.includes('#/admin'));
 h.c.route=()=>'/admin/requests';const admin=runInContext('workspaceTabs(true)',h.c);assert.ok(admin.includes('href="#/admin/requests" class="active" aria-current="page"'));assert.ok(admin.includes('#/admin/plans'));assert.ok(!admin.includes('#/portal'));
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
