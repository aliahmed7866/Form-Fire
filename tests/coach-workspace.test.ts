import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';

function ui(hash='#/admin') {
 const listeners=new Map<string,any[]>(),nodes=new Map<string,any>(),cards:any[]=[];
 const document={addEventListener(type:string,callback:any){listeners.set(type,[...(listeners.get(type)||[]),callback]);},querySelector(selector:string){return nodes.get(selector)||null;},querySelectorAll(selector:string){return selector==='[data-coach-client-card]'?cards:[];}};
 const c=createContext({document,window:{addEventListener(){}},location:{hash},URLSearchParams});
 for(const file of ['coach-workspace.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 return {c,listeners,nodes,cards};
}
function fixture() {
 const request=(id:string,status:string,service_id='train',active=0)=>({id,status,service_id,active,user_id:'client-'+id,client_name:'Client '+id,service_title:'Coaching '+id,kind:'coaching',created_at:'2026-09-28 09:00:00',details:{},booking_status:'enquiry'});
 return {
  services:[{id:'train',kind:'train'},{id:'eat',kind:'eat'},{id:'both',kind:'both'}],
  requests:[request('new','submitted'),request('review','under_review'),request('waiting','awaiting_client_response'),request('onboarding','approved'),request('paused','approved'),request('missing','approved','both',1),request('ready','approved','train',1),request('declined','declined'),request('withdrawn','withdrawn'),{...request('dining','approved'),kind:'chef',booking_status:'proposed'},{...request('accepted','approved'),kind:'chef',booking_status:'accepted'},{...request('gathering','approved'),kind:'chef',booking_status:'confirmed',details:{date:'2099-01-01'}}],
  assignments:[{id:'training-older',request_id:'missing',user_id:'client-missing',kind:'training',version:1},{id:'training-current',request_id:'missing',user_id:'client-missing',kind:'training',version:2},{id:'meal-on-different-request',request_id:'paused',user_id:'client-paused',kind:'meal',version:1},{id:'wrong-owner',request_id:'missing',user_id:'someone-else',kind:'meal',version:1},{id:'ready-plan',request_id:'ready',user_id:'client-ready',kind:'training',version:1}],
  checkins:[{id:'pending',user_id:'client-ready',client_name:'Client ready',week:'2026-09-28',progress:'Found a manageable routine.',energy:4,notes:'Would like simpler prep.',measurements:'',feedback:''},{id:'older',user_id:'client-paused',client_name:'Client paused',week:'2026-09-21',progress:'Need to pause.',energy:2,notes:'',measurements:'',feedback:'   '},{id:'answered',user_id:'client-ready',client_name:'Client ready',week:'2026-09-14',progress:'A good week.',energy:4,notes:'',measurements:'',feedback:'Thanks for checking in.'}],
  clients:[{id:'client-ready',name:'Client ready',email:'ready@example.test',profile:{goals:'Feel stronger',fitness_goal:'strength'},profile_version:1,admin_notes:'PRIVATE note'},{id:'client-paused',name:'Client paused',email:'paused@example.test',profile:{goals:'Move more'},profile_version:1,admin_notes:''}],account_requests:[]
 };
}
test('Coach queue separates actionable work from waiting, paused service review and completed work',()=>{
 const {c}=ui();c.d=fixture();
 const result=JSON.parse(runInContext('JSON.stringify(coachAttention(d))',c));
 assert.deepEqual(result.attention.map((r:any)=>r.id),['older','pending','accepted','new','review','onboarding','paused','missing']);
 assert.deepEqual(result.waiting.map((r:any)=>r.id),['waiting','dining']);
 assert.equal(result.attention.find((r:any)=>r.id==='missing').title,'Prepare their meal plan');
 assert.equal(result.attention.find((r:any)=>r.id==='missing').href,'/admin/plans?view=publish&request=missing');
 assert.match(result.attention.find((r:any)=>r.id==='paused').detail,/agreed pause/);
 const overview=runInContext('coachOverview(d)',c);
 assert.match(overview,/Waiting for clients \(2\)/);assert.match(overview,/More to review \(2\)/);
 assert.ok(overview.includes('Next confirmed gatherings'));assert.ok(overview.includes('2099-01-01'));
 assert.ok(!overview.includes('data-action="status"'));assert.ok(!overview.includes('data-form="activate"'));
});
test('Current plan coverage belongs to the exact request and client; combined services need both kinds',()=>{
 const {c}=ui();c.d=fixture();
 assert.equal(runInContext("coachMissingPlans(d,d.requests.find(r=>r.id==='missing')).join(',')",c),'meal');
 (c.d as any).assignments.push({id:'correct-meal',request_id:'missing',user_id:'client-missing',kind:'meal',version:1});
 assert.equal(runInContext("coachAttention(d).attention.some(r=>r.id==='missing')",c),false);
 (c.d as any).requests.push({id:'custom',user_id:'custom-client',client_name:'Custom client',kind:'coaching',status:'approved',service_id:'unknown-service',active:1,created_at:'2026-09-29 00:00:00'});
 assert.equal(runInContext("coachAttention(d).attention.some(r=>r.id==='custom'&&r.kind==='plan')",c),true);
});
test('Chef proposals wait for clients even before request approval; acceptance still requires coach review',()=>{
 const {c}=ui();c.d=fixture();
 for(const status of ['submitted','under_review','awaiting_client_response','approved']){
  runInContext(`d.requests.find(r=>r.id==='dining').status=${JSON.stringify(status)};d.requests.find(r=>r.id==='accepted').status=${JSON.stringify(status)}`,c);
  const result=JSON.parse(runInContext('JSON.stringify(coachAttention(d))',c));
  assert.equal(result.attention.some((r:any)=>r.id==='dining'),false,status);
  assert.equal(result.waiting.find((r:any)=>r.id==='dining').kind,'proposal');
  const accepted=result.attention.find((r:any)=>r.id==='accepted');assert.equal(accepted.kind,'booking');
  assert.match(accepted.detail,status==='approved'?/check the agreed payment requirements/:/review and approve the request/);
 }
});
test('Pending check-in filters include blank feedback and compose with a client or selected check-in',()=>{
 const {c}=ui('#/admin/checkins');c.d=fixture();
 assert.equal(runInContext('coachHasFeedback(d.checkins[1])',c),false);
 assert.equal(runInContext("coachCheckinMatches(d.checkins[0],'pending','client-ready','pending')",c),true);
 assert.equal(runInContext("coachCheckinMatches(d.checkins[0],'pending','client-paused','pending')",c),false);
 assert.equal(runInContext("coachCheckinMatches(d.checkins[2],'pending')",c),false);
 assert.equal(runInContext("coachCheckinMatches(d.checkins[2],'all')",c),true);
 let html=runInContext('coachCheckinsPage(d)',c);assert.ok(html.includes('name="id" value="pending"'));assert.ok(!html.includes('name="id" value="answered"'));
 (c.location as any).hash='#/admin/checkins?status=all&client=client-ready';
 html=runInContext('coachCheckinsPage(d)',c);assert.ok(html.includes('name="id" value="answered"'));assert.ok(!html.includes('name="id" value="older"'));assert.ok(html.includes('Thanks for checking in.'));
 (c.location as any).hash='#/admin/checkins?status=pending&checkin=pending';html=runInContext('coachCheckinsPage(d)',c);
 assert.ok(html.includes('Showing the selected check-in'));assert.ok(!html.includes('name="id" value="older"'));
 (c.location as any).hash='#/admin/checkins?status=all&client=missing';html=runInContext('coachCheckinsPage(d)',c);assert.ok(!html.includes('data-form="feedback"'));
});
test('Coach views escape names, notes, dates and IDs while keeping feedback explicit and unfilled',()=>{
 const {c}=ui('#/admin/clients');const d=fixture();
 d.clients[0].name='<img src=x onerror=evil()>';d.clients[0].admin_notes='</textarea><script>private</script>';
 d.checkins[0].client_name='<img src=x onerror=evil()>';d.checkins[0].progress='<script>progress</script>';d.checkins[0].notes='<svg onload=evil()>';d.checkins[0].measurements='</p><iframe>';d.checkins[0].week='<script>week</script>';d.checkins[0].id='bad" onclick="evil()';
 c.d=d;
 const clients=runInContext('coachClientsPage(d)',c),checkin=runInContext('coachCheckinCard(d.checkins[0])',c);
 for(const html of [clients,checkin]){assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<svg onload'));assert.ok(html.includes('&lt;'));}
 assert.ok(clients.includes('data-form="client-notes"'));assert.ok(clients.includes('Private admin notes — never shared with the client'));
 assert.ok(checkin.includes('value="bad&quot; onclick=&quot;evil()"'));assert.match(checkin,/<textarea name="feedback" required><\/textarea>/);
 assert.ok(!checkin.includes('private&lt;/script&gt;'));assert.ok(!checkin.includes('PRIVATE note'));
});
test('Searching clients keeps existing cards and unsaved note fields intact',()=>{
 const {c,listeners,nodes,cards}=ui('#/admin/clients');c.d=fixture();
 assert.equal(runInContext("coachClientMatches(d.clients[0],'READY@')",c),true);
 assert.equal(runInContext("coachClientMatches(d.clients[0],' strength ')",c),true);
 assert.equal(runInContext("coachClientMatches(d.clients[0],'private note')",c),false);
 const field={value:'An unsaved private note'};
 cards.push({dataset:{search:'client ready ready@example.test strength'},hidden:false,field},{dataset:{search:'client paused paused@example.test move more'},hidden:false});
 const count={textContent:''},empty={hidden:true};nodes.set('[data-coach-client-count]',count);nodes.set('[data-coach-client-empty]',empty);
 const input={value:'paused',matches:(selector:string)=>selector==='[data-coach-client-search]'};
 for(const callback of listeners.get('input')||[])callback({target:input});
 assert.equal(cards[0].hidden,true);assert.equal(cards[1].hidden,false);assert.equal(count.textContent,'1 client');assert.equal(empty.hidden,true);assert.equal(field.value,'An unsaved private note');
 input.value='no match';for(const callback of listeners.get('input')||[])callback({target:input});assert.equal(empty.hidden,false);
 input.value='';for(const callback of listeners.get('input')||[])callback({target:input});assert.ok(cards.every(card=>!card.hidden));assert.equal(field.value,'An unsaved private note');
});
test('Client deep links select the requested account rather than showing another client',()=>{
 const {c}=ui('#/admin/clients?client=client-paused');c.d=fixture();
 let html=runInContext('coachClientsPage(d)',c);assert.ok(html.includes('name="id" value="client-paused"'));assert.ok(!html.includes('name="id" value="client-ready"'));assert.ok(html.includes('All clients'));
 (c.location as any).hash='#/admin/clients?client=missing';html=runInContext('coachClientsPage(d)',c);assert.ok(html.includes('Client not found.'));assert.ok(!html.includes('data-form="client-notes"'));
});
test('Check-in context selects only this client’s earlier conversation and current active plan versions',()=>{
 const {c}=ui('#/admin/checkins?checkin=pending');const d=fixture();
 d.checkins.push({...d.checkins[0],id:'future',week:'2026-10-05',progress:'FUTURE CONTEXT',feedback:'Later feedback'});
 d.requests.push({...d.requests.find(r=>r.id==='ready')!,id:'same-client-paused',active:0});
 d.assignments.push(
  {id:'ready-current',request_id:'ready',user_id:'client-ready',kind:'training',version:2},
  {id:'another-client-plan',request_id:'ready',user_id:'client-paused',kind:'training',version:9},
  {id:'paused-plan',request_id:'same-client-paused',user_id:'client-ready',kind:'meal',version:9}
 );c.d=d;
 const context=JSON.parse(runInContext('JSON.stringify(coachCheckinContextData(d.checkins[0],d))',c));
 assert.equal(context.client.id,'client-ready');assert.deepEqual(context.active.map((r:any)=>r.id),['ready']);
 assert.deepEqual(context.plans.map((p:any)=>p.id),['ready-current']);assert.equal(context.previous.id,'answered');
 const html=runInContext('coachCheckinCard(d.checkins[0],d)',c);
 assert.ok(html.includes('Feel stronger'));assert.ok(html.includes('Week of 2026-09-14'));assert.ok(html.includes('Thanks for checking in.'));
 assert.ok(html.includes('href="#/plan/ready-current"'));assert.ok(!html.includes('href="#/plan/ready-plan"'));assert.ok(!html.includes('paused-plan'));
 assert.ok(!html.includes('FUTURE CONTEXT'));assert.ok(!html.includes('PRIVATE note'));assert.ok(!html.includes('Need to pause.'));
 // Context stays read-only and cannot silently become feedback to this client.
 assert.match(html,/<textarea name="feedback" required><\/textarea>/);
});
test('Check-in context keeps historical context and missing information explicit, and escapes saved text',()=>{
 const {c}=ui();const d=fixture();c.d=d;
 let html=runInContext('coachCheckinContext(d.checkins[2],d)',c);
 assert.ok(html.includes('No earlier check-in saved.'));assert.ok(!html.includes('Found a manageable routine.'));
 (c.d as any).clients[0].profile.goals='<img src=x onerror=evil()> personal goal';
 (c.d as any).checkins[2].progress='<script>unsafe</script>';
 (c.d as any).checkins[2].feedback='</p><iframe>feedback';
 (c.d as any).assignments.find((a:any)=>a.id==='ready-plan').title='<svg onload=evil()> plan';
 html=runInContext('coachCheckinContext(d.checkins[0],d)',c);
 for(const forbidden of ['<img','<script','<iframe','<svg'])assert.ok(!html.includes(forbidden));
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;unsafe'));assert.ok(html.includes('&lt;/p&gt;&lt;iframe&gt;feedback'));
 c.empty={user_id:'unknown',week:'2026-09-28'};
 html=runInContext('coachCheckinContext(empty,d)',c);
 assert.ok(html.includes('No goal shared in their profile yet.'));assert.ok(html.includes('No active coaching service.'));assert.ok(html.includes('No earlier check-in saved.'));
 assert.ok(!html.includes('href="#/plan/'));assert.ok(!html.includes('Energy undefined'));assert.ok(!html.includes('undefined'));
});
