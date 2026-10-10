import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(params=new URLSearchParams()){
 const navigation:string[]=[],writes:any[]=[];
 const c=createContext({document:{addEventListener(){}},window:{},URLSearchParams,session:{user:{profile:{timezone:'UTC'}}},query:()=>params,esc:(v:any)=>String(v??'').replace(/[&<>"']/g,(ch:string)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!)),link:(path:string,title:string)=>`<a href="${path}">${title}</a>`,navigate:(path:string)=>navigation.push(path),toast(){},api:async(...args:any[])=>{writes.push(args);return {id:'private-copy'};}});
 for(const file of ['nutrition.js','adaptations.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),c);
 return {c,navigation,writes};
}
test('Recipe-tool routes preserve day and only bounded allowlisted catalogue filters',()=>{
 const catalogue=new URLSearchParams({q:'pasta & "herbs"',tag:'plant-based',max_minutes:'30',sort:'protein',exclude:'milk',favourites:'1',offset:'24',day:'2026-09-01',next:'https://outside.example',private_note:'do not carry'});
 const h=harness(new URLSearchParams({day:'2026-10-01',catalogue:catalogue.toString()}));
 for(const view of ['recipe','cook','adapt','catering']){
  const path=runInContext(`recipeJourneyRoute('${view}','recipe & "one"',{style:'vegan',protein:'lentil'})`,h.c),url=new URL(path,'https://local.example');assert.equal(url.pathname,'/portal/'+view);assert.equal(url.searchParams.get('day'),'2026-10-01');assert.equal(url.searchParams.get('id'),'recipe & "one"');
  const saved=new URLSearchParams(url.searchParams.get('catalogue')!);for(const key of ['q','tag','max_minutes','sort','exclude','favourites','offset'])assert.equal(saved.get(key),catalogue.get(key));assert.equal(saved.get('day'),'2026-10-01');assert.equal(saved.has('next'),false);assert.equal(saved.has('private_note'),false);
 }
 assert.match(runInContext('recipeJourneyField()',h.c),/^<input type="hidden" name="catalogue"/);assert.ok(!runInContext('recipeJourneyField()',h.c).includes('"herbs"'));
});
test('Missing and excessive context stay local and do not invent a catalogue return',()=>{
 for(const catalogue of ['', 'x'.repeat(4001)]){
  const h=harness(new URLSearchParams({day:'2026-10-01',catalogue}));const params=new URLSearchParams(runInContext("recipeJourneyRoute('recipe','one')",h.c).split('?')[1]);assert.equal(params.get('day'),'2026-10-01');assert.equal(params.has('catalogue'),false);
 }
});
test('Swap previews preserve client browse context without changing admin return behavior',async()=>{
 const h=harness(),body={id:'one',style:'vegetarian',protein:'lentil',day:'2026-10-01',catalogue:'q=pasta&offset=24',admin:'0'};h.c.body=body;
 await runInContext("submitAdaptationForm('adapt-options',body)",h.c);let u=new URL(h.navigation[0],'https://local.example');assert.equal(u.pathname,'/portal/adapt');assert.equal(u.searchParams.get('style'),'vegetarian');assert.equal(new URLSearchParams(u.searchParams.get('catalogue')!).get('offset'),'24');assert.equal(h.writes.length,0);
 body.admin='1';await runInContext("submitAdaptationForm('adapt-options',body)",h.c);u=new URL(h.navigation[1],'https://local.example');assert.equal(u.pathname,'/admin/adapt');assert.equal(u.searchParams.has('catalogue'),false);
});
test('Saving a private adapted recipe retains browse context only in the local destination',async()=>{
 const h=harness();h.c.body={recipe_id:'one',source_version:'2',style:'vegan',protein:'tofu',day:'2026-10-01',idempotency_key:'same-submission',catalogue:'q=pasta&max_minutes=30'};
 await runInContext("submitAdaptationForm('adapt-save',body)",h.c);assert.equal(h.writes.length,1);assert.equal(h.writes[0][0],'/nutrition/adaptations');assert.equal(h.writes[0][2].source_version,2);assert.equal('catalogue' in h.writes[0][2],false);assert.equal(h.writes[0][2].idempotency_key,'same-submission');
 const u=new URL(h.navigation[0],'https://local.example');assert.equal(u.pathname,'/portal/recipe');assert.equal(u.searchParams.get('id'),'private-copy');assert.equal(u.searchParams.get('day'),'2026-10-01');assert.equal(new URLSearchParams(u.searchParams.get('catalogue')!).get('q'),'pasta');
});
