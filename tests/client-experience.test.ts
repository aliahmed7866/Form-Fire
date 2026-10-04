import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

function ui(){
 const c=createContext({document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/portal/checkins'},URLSearchParams,crypto:{randomUUID}});
 for(const file of ['experience.js','exercise-catalog-extra.js','exercise-catalog.js','exercise-motion.js','plan-studio.js','daily-plan.js','enrichment.js','navigation.js','rhythm.js','client-experience.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 c.fixture={user:{id:'one',verified:true,role:'client',profile:{timezone:'Europe/London'}},requests:[{id:'service',kind:'coaching',active:1}],assignments:[],checkins:[]};
 return c;
}
test('Daily focus prioritises remaining training, limits visible items and keeps all saved logs reachable',()=>{
 const c=ui();c.items=Array.from({length:6},(_,index)=>({assignment:{id:'plan'},kind:index===4?'workout':'meal',index}));
 c.entries=[{assignment_id:'plan',item_kind:'meal',item_index:0,activity_date:'2026-09-30'}, {assignment_id:'plan',item_kind:'meal',item_index:1,activity_date:'2026-09-29'}];
 c.options={date:'2026-09-30'};
 const focus=JSON.parse(runInContext('JSON.stringify(dailyFocusItems(items,entries,options))',c));
 assert.deepEqual(focus.first.map(i=>i.index),[4,1,2]);assert.deepEqual(focus.more.map(i=>i.index),[3,5]);assert.deepEqual(focus.logged.map(i=>i.index),[0]);
 assert.equal(focus.first.length+focus.more.length+focus.logged.length,6);
});
test('Coach action reflects saved feedback, keeps unanswered requests first and handles local Sundays correctly',()=>{
 const c=ui();c.fixture.checkins=[{week:'2026-09-28',feedback:''}];
 const action=()=>JSON.parse(runInContext("JSON.stringify(clientCoachAction(fixture,'2026-10-04'))",c));
 assert.equal(action()[1],'Your check-in is saved.');
 c.fixture.checkins[0].feedback='Let’s find a manageable week.';assert.equal(action()[4],'Read feedback');
 c.fixture.requests.push({id:'reply-id',status:'awaiting_client_response'});assert.equal(action()[3],'/request/reply-id');
 c.fixture.requests=[];c.fixture.checkins=[];assert.equal(action()[3],'/portal/requests');
});
test('A saved check-in shows its real feedback and avoids offering a duplicate submission',()=>{
 const c=ui();c.location.hash='#/portal/checkins?week=2026-09-28';
 c.fixture.checkins=[{week:'2026-09-28',progress:'Enjoyed <script>food</script>',energy:3,notes:'<private>',measurements:'',feedback:'Try <a>this</a>'}];
 const html=runInContext('clientCheckinsPage(fixture)',c);
 assert.ok(html.includes('Your check-in is saved.'));assert.ok(!html.includes('data-form="checkin"'));
 assert.ok(html.includes('Try &lt;a&gt;this&lt;/a&gt;'));assert.ok(html.includes('&lt;private&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('/portal/checkins?week=2026-09-21'));assert.ok(html.includes('class="reply"'));
 assert.ok(html.includes('<time datetime="2026-09-28">28 Sept 2026</time>')||html.includes('<time datetime="2026-09-28">28 Sep 2026</time>'));
 assert.ok(html.includes('data-selected-week="true"'));assert.ok(html.includes('Feedback ready'));
});
test('Check-in retains real form fields, offers optional disclosure and explains service activation',()=>{
 const c=ui();c.location.hash='#/portal/checkins?week=2026-09-28';
 const html=runInContext('clientCheckinsPage(fixture)',c);
 for(const name of ['week','progress','energy','notes','measurements'])assert.ok(html.includes(`name="${name}"`));
 assert.ok(html.includes('data-form="checkin"'));assert.ok(html.includes('class="checkin-options"'));
 c.fixture.requests=[];const inactive=runInContext('clientCheckinsPage(fixture)',c);assert.ok(!inactive.includes('data-form="checkin"'));assert.ok(inactive.includes('activates your coaching service'));
 c.location.hash='#/portal/checkins?week=2026-09-29';assert.throws(()=>runInContext('clientCheckinsPage(fixture)',c),/Monday/);
 c.location.hash='#/portal/checkins?week=2026-02-30';assert.throws(()=>runInContext('clientCheckinsPage(fixture)',c),/Monday/);
});
test('Publishing shortcut preselects only an eligible active request and never publishes automatically',()=>{
 const c=ui();c.location.hash='#/admin/plans?view=publish&request=second';
 c.data={requests:[{id:'first',active:1,client_name:'First',service_title:'Training'},{id:'second',active:1,client_name:'Second',service_title:'Meals'},{id:'paused',active:0,client_name:'Paused',service_title:'Training'}],templates:[],assignments:[]};
 let html=runInContext('planStudioPage(data)',c);assert.ok(html.includes('value="second" selected'));assert.ok(html.includes('type="submit"'));assert.ok(!html.includes('value="paused"'));
 c.location.hash='#/admin/plans?view=publish&request=paused';html=runInContext('planStudioPage(data)',c);assert.ok(!html.includes('value="paused"'));assert.ok(!html.includes('value="second" selected'));
});
test('Meal-only clients are invited to everyday movement without promising an assigned training programme',async()=>{
 const c=ui();c.localNutritionDay=()=> '2026-09-30';c.fitnessGoalNames={wellbeing:'General fitness'};
 c.fixture.assignments=[{id:'meal-plan',request_id:'service',kind:'meal',version:1,snapshot:{meals:[]}}];
 runInContext("session={user:fixture.user};api=async path=>path.startsWith('/rhythm')?{keys:[],options:{},logs:[],summary:{workouts:0,diary_days:0,habit_moments:0,energy:null,energy_days:0,sleep:null}}:{entries:[]}",c);
 let html=await runInContext('rhythmHome(fixture)',c);assert.ok(html.includes('Movement that feels like you.'));assert.ok(!html.includes('saved workout notes'));
 const actions=html.match(/<nav class="everyday-links"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||'';
 assert.equal((actions.match(/<a href=/g)||[]).length,3,'The illustrated home still offers only three primary choices');
 assert.equal((actions.match(/focusable="false"/g)||[]).length,3,'Decorative illustrations do not add keyboard stops');
 c.fixture.assignments.push({id:'training-plan',request_id:'service',kind:'training',version:1,snapshot:{workouts:[]}});
 html=await runInContext('rhythmHome(fixture)',c);assert.ok(html.includes('Training that fits today.'));
});
test('Check-in starts with writing, asks for energy explicitly, and keeps older feedback reachable',()=>{
 const c=ui();c.location.hash='#/portal/checkins?week=2026-09-28';
 c.fixture.checkins=Array.from({length:5},(_,i)=>({id:'week'+i,week:['2026-09-21','2026-09-14','2026-09-07','2026-08-31','2026-08-24'][i],progress:'Saved week '+i,energy:3,notes:'',measurements:'',feedback:'Reply '+i}));
 let html=runInContext('clientCheckinsPage(fixture)',c);
 assert.ok(html.indexOf('data-form="checkin"')<html.indexOf('class="card checkin-history"'));
 assert.ok(html.includes('<select name="energy" required>'));
 assert.match(html,/<option value="" selected>Choose how it felt<\/option>/);
 assert.ok(html.includes('More check-ins (2)'));assert.ok(html.includes('Reply 4'));
 c.location.hash='#/portal/checkins?week=2026-08-24';html=runInContext('clientCheckinsPage(fixture)',c);
 assert.ok(!html.includes('data-form="checkin"'));assert.ok(html.indexOf('Reply 4')<html.indexOf('Reply 0'));
 assert.ok(html.includes('Back to this week'));
 assert.equal((html.match(/data-selected-week="true"/g)||[]).length,1,'Only the chosen historical week receives the selected treatment');
 assert.match(html,/<article class="card checkin-history" data-selected-week="true">[\s\S]*?datetime="2026-08-24"/);
});
