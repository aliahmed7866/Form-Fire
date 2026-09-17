import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';
function ui() {
  const c=createContext({document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/admin/requests'},URLSearchParams});
  for(const file of ['plan-studio.js','daily-plan.js','enrichment.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
  return c;
}
test('Dashboard directs waiting clients to their conversation and excludes paused/old plans',()=>{
  const c=ui();c.d={user:{verified:true},requests:[{id:'active',active:1,status:'approved'},{id:'paused',active:0,status:'approved'}],assignments:[{id:'old',request_id:'active',kind:'meal',version:1},{id:'current',request_id:'active',kind:'meal',version:2},{id:'paused-plan',request_id:'paused',kind:'training',version:1}]};
  assert.equal(runInContext('currentActivePlans(d).length',c),1);
  assert.equal(runInContext('clientNextStep(d)[2]',c),'/portal/today');
  (c.d as any).requests[0].status='awaiting_client_response';assert.equal(runInContext('clientNextStep(d)[2]',c),'/request/active');
  (c.d as any).requests[0].status='approved';(c.d as any).requests[0].active=0;
  assert.equal(runInContext('clientNextStep(d)[2]',c),'/portal/requests');
  (c.d as any).user.verified=false;assert.equal(runInContext('clientNextStep(d)[2]',c),'/verify');
});
test('Shopping escapes list content, keeps duplicate lines distinct and shows saved state',()=>{
  const c=ui();c.list={assignment_id:'id',title:'<svg onload=evil()>',version:2,items:['<img src=x onerror=evil()>','Rice 200g','Rice 200g'],purchased:[1],revision:3,is_demo:true};
  const html=runInContext('shoppingCard(list)',c);
  assert.ok(!html.includes('<svg'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('1 of 3 picked up'));assert.ok(html.includes('data-shopping-item="1" checked'));assert.ok(html.includes('data-shopping-item="2" '));assert.ok(html.includes('data-revision="3"'));assert.ok(html.includes('Starter example'));
});
test('Inbox composes search and filters without treating awaiting clients or approved requests as ready for review',()=>{
  const c=ui();c.r={client_name:'Taylor <script>',service_title:'Training + good food',status:'under_review',kind:'coaching'};
  assert.equal(runInContext("inboxMatches(r,'tAyLoR','attention','coaching')",c),true);
  assert.equal(runInContext("inboxMatches(r,'FOOD','','')",c),true);
  assert.equal(runInContext("inboxMatches(r,'Taylor','','chef')",c),false);
  assert.equal(runInContext("inboxMatches({...r,status:'awaiting_client_response'},'','attention','')",c),false);
  assert.equal(runInContext("inboxMatches({...r,status:'approved'},'','attention','')",c),false);
  c.d={requests:[{...(c.r as any),created_at:'2026-09-17 10:00:00',id:'request'}],checkins:[{feedback:''},{feedback:'Thanks'}]};
  const html=runInContext('adminInbox(d)',c);assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Find a client or service'));assert.ok(html.includes('Check-ins without feedback'));
});
test('Shopping avoids fetching private lists for admin or unverified accounts',async()=>{
  const c=ui();runInContext("api=async()=>{throw Error('unexpected fetch')}",c);
  assert.match(await runInContext("shoppingPage({user:{role:'admin',verified:true}})",c),/belong to clients/);
  assert.match(await runInContext("shoppingPage({user:{role:'client',verified:false}})",c),/Verify your account/);
});
test('Recipe preparation view preserves servings, personal notes and substitutions',async()=>{
  const c=ui();c.d={user:{role:'client',verified:true},requests:[{id:'r',active:1}],assignments:[{id:'a',request_id:'r',kind:'meal',version:1,title:'Your week',snapshot:{meals:[{day:'Monday',slot:'Lunch',servings:'One bowl',notes:'Your agreed note',recipe:{id:'recipe',title:'Lunch',portions:'Two bowls',ingredients:'Rice',preparation:'Step one\nStep two',substitutions:'Agreed alternative'}}]}}]};
  runInContext("api=async()=>({lists:[{assignment_id:'a',version:1,title:'Your week',items:['Rice'],purchased:[],revision:0}]})",c);
  const html=await runInContext('shoppingPage(d)',c);
  for(const value of ['One bowl','Two bowls','Your agreed note','Agreed alternative','Step one','Step two'])assert.ok(html.includes(value),value);
});
