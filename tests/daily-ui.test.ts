import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

function ui() {
  const context=createContext({document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/portal/today'},URLSearchParams,crypto:{randomUUID}});
  for(const file of ['experience.js','exercise-catalog-extra.js','exercise-catalog.js','exercise-motion.js','plan-studio.js','daily-plan.js','enrichment.js','navigation.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),context);
  return context;
}

test('Calendar helpers respect local date boundaries and validate real calendar dates',()=>{
  const c=ui();
  assert.equal(runInContext("calendarDate('America/Los_Angeles', new Date('2026-09-16T00:30:00Z'))",c),'2026-09-15');
  assert.equal(runInContext("calendarDate('Pacific/Auckland', new Date('2026-09-16T23:30:00Z'))",c),'2026-09-17');
  assert.equal(runInContext("dateShift('2028-02-28',1)",c),'2028-02-29');
  assert.equal(runInContext("dateShift('2026-12-31',1)",c),'2027-01-01');
  for(const value of ['2026-02-30','2026-13-01','2026-1-1','not-a-date'])assert.equal(runInContext(`validCalendarDate(${JSON.stringify(value)})`,c),false);
});

test('Today uses latest active assignments and does not invent dates for flexible labels',()=>{
  const c=ui();c.fixture={requests:[{id:'active',active:1},{id:'paused',active:0}],assignments:[{id:'old',request_id:'active',kind:'training',version:1},{id:'current',request_id:'active',kind:'training',version:3},{id:'middle',request_id:'active',kind:'training',version:2},{id:'meal',request_id:'active',kind:'meal',version:1},{id:'paused',request_id:'paused',kind:'training',version:9}]};
  assert.deepEqual(JSON.parse(runInContext('JSON.stringify(currentActivePlans(fixture).map(a=>a.id))',c)),['current','meal']);
  assert.equal(runInContext("scheduleMatch(' Monday ', '2026-09-14')",c),'scheduled');
  assert.equal(runInContext("scheduleMatch('Monday', '2026-09-15')",c),'other');
  assert.equal(runInContext("scheduleMatch('Every day', '2026-09-15')",c),'scheduled');
  assert.equal(runInContext("scheduleMatch('Week 1 · Monday', '2026-09-14')",c),'flexible');
  assert.equal(runInContext("scheduleMatch('When convenient', '2026-09-14')",c),'flexible');
});

test('Tracking is preview-only outside publication date, today or the backfill window',()=>{
  const c=ui();c.item={assignment:{created_at:'2026-09-16 00:30:00'}};
  assert.equal(runInContext("canRecordItem(item,'2026-09-15','America/Los_Angeles','2026-09-16')",c),true);
  assert.equal(runInContext("canRecordItem(item,'2026-09-15','Europe/London','2026-09-16')",c),false);
  assert.equal(runInContext("canRecordItem(item,'2026-09-17','Europe/London','2026-09-16')",c),false);
  c.item={assignment:{created_at:'2025-01-01 00:00:00'}};
  assert.equal(runInContext("canRecordItem(item,'2026-01-01','UTC','2026-09-16')",c),false);
});

test('Activity identity includes plan version, item kind, index and local date',()=>{
  const c=ui();c.item={assignment:{id:'plan-v2'},kind:'meal',index:0};c.entry={assignment_id:'plan-v2',item_kind:'meal',item_index:0,activity_date:'2026-09-16'};
  assert.equal(runInContext("sameActivity(entry,item,'2026-09-16')",c),true);
  assert.equal(runInContext("sameActivity({...entry,assignment_id:'plan-v1'},item,'2026-09-16')",c),false);
  assert.equal(runInContext("sameActivity({...entry,item_kind:'workout'},item,'2026-09-16')",c),false);
  assert.equal(runInContext("sameActivity({...entry,item_index:1},item,'2026-09-16')",c),false);
  assert.equal(runInContext("sameActivity(entry,item,'2026-09-17')",c),false);
});

test('Daily cards show full workout details, safe client notes and no future action controls',()=>{
  const c=ui();c.item={assignment:{id:'plan',title:'<Test plan>',created_at:'2026-09-16 00:00:00',version:1,snapshot:{is_demo:1}},kind:'workout',index:0,title:'A good start',item:{day:'Wednesday',exercises:[{sets:2,reps:'8',rest_seconds:60,notes:'Keep it comfortable',exercise:{title:'Test exercise',instructions:'Original cues',animation:'squat',video_url:''}}]}};
  c.entries=[{assignment_id:'plan',item_kind:'workout',item_index:0,activity_date:'2026-09-16',notes:'<script>unsafe</script>',effort:3}];c.options={date:'2026-09-16',today:'2026-09-16',timezone:'UTC'};
  const html=runInContext('dailyItemCard(item,entries,options)',c);
  assert.ok(html.includes('Undo log'));assert.ok(html.includes('Original cues'));assert.ok(html.includes('Keep it comfortable'));assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('name="effort"'));assert.ok(html.includes('Show next pose'));
  const future=runInContext("dailyItemCard(item,entries,{...options,date:'2026-09-17'})",c);assert.ok(future.includes('Preview only'));assert.ok(!future.includes('data-daily-action'));
});

test('Today and admin progress pages render fetched logs with named time zones',async()=>{
  const c=ui();c.fixture={user:{role:'client',verified:true},requests:[],assignments:[]};
  runInContext("api=async path=>path.startsWith('/admin/')?{entries:[],summary:[],from:'2026-09-10',to:'2026-09-16'}:{entries:[]}",c);
  (c.location as any).hash='#/portal/today?date=2026-09-16&zone=Europe%2FLondon';
  const today=await runInContext('todayPage(fixture)',c);assert.ok(today.includes('Europe/London'));assert.ok(today.includes('Your next chapter is taking shape.'));assert.ok(today.includes('Days in selected week'));
  (c.location as any).hash='#/admin/progress?from=2026-09-10&to=2026-09-16';
  const admin=await runInContext('adminProgressPage()',c);assert.ok(admin.includes('data-form="progress-range"'));assert.ok(admin.includes('No clients yet.'));
});


test('A rendered completion button keeps its date even after another date response finishes',()=>{
  const c=ui();c.button={dataset:{assignment:'current-plan',kind:'meal',index:'1',date:'2026-09-16',timezone:'Europe/London',completed:'true',note:'A good lunch',effort:''}};
  (c.location as any).hash='#/portal/today?date=2026-09-15&zone=UTC';
  const saved=JSON.parse(runInContext('JSON.stringify(activityFromButton(button))',c));
  assert.equal(saved.payload.activity_date,'2026-09-16');assert.equal(saved.payload.timezone,'Europe/London');assert.equal(saved.payload.item_index,1);assert.equal(saved.payload.notes,'A good lunch');assert.equal(saved.payload.completed,true);
});

test('Restricted Today accounts retain a helpful view without calling the activity endpoint',async()=>{
  const c=ui();runInContext("api=async()=>{throw new Error('Should not fetch activity')}",c);
  assert.ok((await runInContext("todayPage({user:{role:'admin',verified:true}})",c)).includes('Client progress'));
  assert.ok((await runInContext("todayPage({user:{role:'client',verified:false}})",c)).includes('Verify your account'));
});

test('Repeated recipes remain distinguishable by their meal names',()=>{
  const c=ui();c.assignments=[{id:'meal-plan',kind:'meal',snapshot:{meals:[{slot:'Breakfast',recipe:{title:'Oats'}},{slot:'Lunch',recipe:{title:'Oats'}}]}}];
  assert.deepEqual(JSON.parse(runInContext('JSON.stringify(planItems(assignments).map(i=>i.title))',c)),['Breakfast · Oats','Lunch · Oats']);
});
