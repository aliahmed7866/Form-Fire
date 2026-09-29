import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext,runInContext } from 'node:vm';
import { createApp } from '../src/server.ts';
import { passwordHash } from '../src/auth.ts';
import { userToday,weekStart } from '../src/rhythm.ts';

test('Everyday meal planning, habits and history are private and persistent',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-rhythm-')),origin='http://127.0.0.1:8085',app=createApp({dataDir:dir,origin});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const port=(app.server.address() as any).port;
 class Client{cookie='';csrf='';async call(path:string,method='GET',body?:any,csrf=this.csrf){return new Promise<any>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':csrf,...(body===undefined?{}:{'Content-Length':Buffer.byteLength(JSON.stringify(body))})}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];const data=JSON.parse(raw);if(data.csrf)this.csrf=data.csrf;resolve({status:res.statusCode,data});});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});}}
 const admin=new Client(),alice=new Client(),bob=new Client(),anon=new Client(),pw='A fictional testing password',aid=randomUUID(),bid=randomUUID();
 for(const [id,email,role] of [[randomUUID(),'alex@rhythm.test','admin'],[aid,'alice@rhythm.test','client'],[bid,'bob@rhythm.test','client']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(id,email,email,passwordHash(pw),role);
 for(const [client,email] of [[admin,'alex@rhythm.test'],[alice,'alice@rhythm.test'],[bob,'bob@rhythm.test']] as const)assert.equal((await client.call('/auth/login','POST',{email,password:pw})).status,200);
 let recipe:any,meal:any,diaryId:string,today=userToday(app.db,aid),week=weekStart(today);
 try{
 await t.test('Search filters time and literal ingredient terms while respecting private recipes',async()=>{
  const quick=(await alice.call('/nutrition/recipes?max_minutes=15&sort=fastest&limit=100')).data;assert.ok(quick.total>0);assert.ok(quick.recipes.every((r:any)=>r.prep_minutes<=15));assert.ok(quick.recipes.every((r:any,i:number)=>i===0||r.prep_minutes>=quick.recipes[i-1].prep_minutes));
  const filtered=(await alice.call('/nutrition/recipes?exclude=milk,almond&limit=100')).data;assert.ok(filtered.recipes.every((r:any)=>!/milk|almond/i.test(r.ingredients)));
  const protein=(await alice.call('/nutrition/recipes?sort=protein')).data.recipes;assert.ok(protein.every((r:any,i:number)=>i===0||(r.nutrition?.protein_g??-1)<=(protein[i-1].nutrition?.protein_g??-1)));
  assert.equal((await alice.call('/nutrition/recipes?max_minutes=-3')).status,400);assert.equal((await alice.call('/nutrition/recipes?sort=weight_loss')).status,400);
  recipe=quick.recipes.find((r:any)=>r.nutrition);
 });
 await t.test('Meal planning retries, ownership, validation and stale edits',async()=>{
  const personal=(await admin.call('/admin/recipes','POST',{...recipe,id:undefined,title:'Bob private kitchen meal',client_id:bid}));assert.equal(personal.status,200);
  assert.equal((await alice.call('/planner','POST',{recipe_id:personal.data.id,quantity:1,day:today,slot:'lunch',idempotency_key:randomUUID()})).status,404);
  assert.equal((await alice.call('/nutrition/recipes?q=Bob%20private')).data.total,0);
  assert.equal((await alice.call('/planner','POST',{quantity:1,day:today,slot:'lunch',idempotency_key:randomUUID()})).status,400);
  const body={recipe_id:recipe.id,quantity:1.5,day:today,slot:'dinner',idempotency_key:randomUUID()};const res=await alice.call('/planner','POST',body);assert.equal(res.status,201);meal=res.data;
  assert.equal((await alice.call('/planner','POST',body)).data.id,meal.id);assert.equal((await alice.call('/planner','POST',{...body,quantity:2})).status,409);
  assert.equal((await anon.call('/planner')).status,401);assert.equal((await admin.call('/planner')).status,403);assert.equal((await alice.call('/planner','POST',{...body,idempotency_key:randomUUID()},'')).status,403);
  assert.equal((await bob.call('/planner?day='+today)).data.entries.length,0);assert.equal((await bob.call('/planner/'+meal.id,'PUT',{...body,version:1})).status,404);
  assert.equal((await alice.call('/planner','POST',{...body,quantity:0,idempotency_key:randomUUID()})).status,400);assert.equal((await alice.call('/planner','POST',{...body,day:'2026-02-30',idempotency_key:randomUUID()})).status,400);
  assert.equal((await alice.call('/planner/'+meal.id,'PUT',{day:today,slot:'lunch',quantity:2,version:1})).status,200);assert.equal((await alice.call('/planner/'+meal.id,'PUT',{day:today,slot:'lunch',quantity:2,version:1})).status,409);
 });
 await t.test('Shopping uses recipe yield, persists ticks and invalidates changed amounts',async()=>{
  const data=(await alice.call('/planner?day='+today)).data,item=data.shopping.find((i:any)=>i.food_id===recipe.ingredient_items[0].food_id);assert.equal(item.grams,Math.round(recipe.ingredient_items[0].grams*2/recipe.yield_servings*100)/100);
  const body={week,food_id:item.food_id,quantity:item.grams,version:0,purchased:true};assert.equal((await alice.call('/planner/shopping','PUT',body)).status,200);assert.equal((await alice.call('/planner/shopping','PUT',body)).status,409);
  assert.equal((await alice.call('/planner?day='+today)).data.shopping.find((i:any)=>i.food_id===item.food_id).purchased,true);
  assert.equal((await bob.call('/planner/shopping','PUT',body)).status,409);
  await alice.call('/planner/'+meal.id,'PUT',{day:today,slot:'lunch',quantity:3,version:2});const changed=(await alice.call('/planner?day='+today)).data.shopping.find((i:any)=>i.food_id===item.food_id);assert.equal(changed.purchased,false);
  assert.equal((await alice.call('/planner/shopping','PUT',{...body,version:1})).status,409);
 });
 await t.test('Recipe edits and archive do not change planned snapshots or eaten quantities; future log is blocked',async()=>{
  const before=(await alice.call('/planner?day='+today)).data.entries[0];assert.equal(before.quantity,3);
  const altered=await admin.call('/admin/recipes/'+recipe.id,'PUT',{...recipe,title:'Edited after planning',archived:true,ingredient_items:recipe.ingredient_items.map((i:any)=>({...i,grams:i.grams*2}))});assert.equal(altered.status,200);
  assert.deepEqual((await alice.call('/planner?day='+today)).data.entries[0].snapshot,before.snapshot);
  const log=await alice.call('/planner/'+meal.id+'/log','POST',{version:3});assert.equal(log.status,200);diaryId=log.data.id;
  assert.equal((await alice.call('/planner/'+meal.id+'/log','POST',{version:3})).data.id,diaryId);assert.equal((await alice.call('/nutrition/diary?day='+today)).data.entries.length,1);
  const diary=(await alice.call('/nutrition/diary?day='+today)).data.entries[0];assert.deepEqual(diary.snapshot.nutrition,recipe.nutrition);assert.equal(diary.quantity,3);
  assert.equal((await alice.call('/planner/'+meal.id,'PUT',{day:today,quantity:1,slot:'dinner',version:4})).status,409);
  assert.equal((await alice.call('/planner?day='+today)).data.shopping.length,0);
  const future='2099-01-01',other=(await alice.call('/nutrition/recipes?limit=100')).data.recipes.find((r:any)=>r.nutrition);const planned=(await alice.call('/planner','POST',{recipe_id:other.id,quantity:1,day:future,slot:'lunch',idempotency_key:randomUUID()})).data;
  assert.equal((await alice.call('/planner/'+planned.id+'/log','POST',{version:1})).status,409);assert.equal((await bob.call('/planner/'+planned.id+'/log','POST',{version:1})).status,404);
 });
 await t.test('Recent meals repeat immutable diary estimates, validate retries and isolate clients',async()=>{
  const recent=(await alice.call('/nutrition/recent')).data.entries;assert.equal(recent.length,1);assert.equal((await bob.call('/nutrition/recent')).data.entries.length,0);
  const body={source_entry_id:diaryId,day:today,slot:'snack',quantity:0.5,idempotency_key:randomUUID()},repeated=await alice.call('/nutrition/repeat','POST',body);assert.equal(repeated.status,201);
  assert.equal((await alice.call('/nutrition/repeat','POST',body)).data.id,repeated.data.id);assert.equal((await alice.call('/nutrition/repeat','POST',{...body,quantity:2})).status,409);assert.equal((await bob.call('/nutrition/repeat','POST',body)).status,404);
  assert.deepEqual((await alice.call('/nutrition/diary?day='+today)).data.entries[1].snapshot.nutrition,recipe.nutrition);
  await alice.call('/nutrition/diary/'+diaryId,'DELETE',{version:1});assert.equal((await alice.call('/planner/'+meal.id+'/log','POST',{version:4})).status,409);
 });
 await t.test('Habit corrections, preference choices, historical summaries and timezone boundaries',async()=>{
  const body={day:today,habit:'move',completed:true,version:0};assert.equal((await alice.call('/rhythm/habits','PUT',body)).status,200);assert.equal((await alice.call('/rhythm/habits','PUT',body)).status,409);
  assert.equal((await alice.call('/rhythm?day='+today)).data.summary.habit_moments,1);assert.equal((await bob.call('/rhythm?day='+today)).data.summary.habit_moments,0);
  assert.equal((await alice.call('/rhythm/habits','PUT',{...body,completed:false,version:1})).status,200);assert.equal((await alice.call('/rhythm?day='+today)).data.summary.habit_moments,0);
  assert.equal((await alice.call('/rhythm/habits','PUT',{...body,day:'2099-01-01'})).status,400);assert.equal((await alice.call('/rhythm/habits','PUT',{...body,habit:'burn_calories'})).status,400);
  const user=(await alice.call('/session')).data.user;assert.equal((await alice.call('/profile','PUT',{name:'Alice',profile_version:user.profile_version,habit_keys:[]})).status,200);assert.deepEqual((await alice.call('/rhythm?day='+today)).data.keys,[]);
  assert.equal((await alice.call('/profile','PUT',{name:'Alice',habit_keys:['unknown']})).status,400);
  app.db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify({timezone:'America/Los_Angeles'}),aid);assert.equal(userToday(app.db,aid,new Date('2026-09-29T00:30:00Z')),'2026-09-28');assert.equal(weekStart('2026-09-27'),'2026-09-21');
 });
 await t.test('Alex can read client weeks, exports include records, and deletion cascades',async()=>{
  assert.equal((await alice.call('/admin/rhythm/'+bid)).status,403);const report=await admin.call('/admin/rhythm/'+aid+'?day='+today);assert.equal(report.status,200);assert.equal(report.data.planner.entries.length,1);
  const exported=(await alice.call('/export')).data.rhythm;assert.equal(exported.planned_meals.length,2);assert.equal(exported.habits.length,1);assert.equal(exported.shopping.length,1);
  assert.equal((await alice.call('/planner/'+meal.id,'DELETE',{version:4})).status,200);assert.equal((await alice.call('/nutrition/diary?day='+today)).data.entries.length,1);
  app.db.prepare('DELETE FROM sessions WHERE user_id=?').run(aid);app.db.prepare('DELETE FROM users WHERE id=?').run(aid);for(const table of ['planned_meals','habit_logs','planner_shopping'])assert.equal(app.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`).get(aid)?.n,0);
 });
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Cooking view scales by yield, preserves full method and shows rice-specific handling',()=>{
 const c=createContext({document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/portal/cook?id=recipe'},URLSearchParams,crypto:{randomUUID},clearTimeout,setTimeout});
 for(const file of ['nutrition.js','rhythm.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 runInContext("session={user:{id:'client'}}",c);c.recipe={id:'recipe',yield_servings:4,ingredient_items:[{name:'Rice, cooked',grams:400}],preparation:'Stir carefully. Serve while hot.\nCheck the middle.',substitutions:'<script>unsafe</script>',nutrition:{kcal:100,protein_g:10,carbs_g:10,fat_g:1,fibre_g:null}};
 runInContext('cookingState(recipe).servings=2',c);const html=runInContext('cookingBody(recipe)',c);assert.ok(html.includes('200g'));assert.ok(html.includes('200</dd>'));assert.ok(html.includes('Unknown'));assert.ok(html.includes('24 hours'));assert.ok(html.includes('one hour'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.equal(runInContext('cookingSteps(recipe.preparation).length',c),3);
 assert.ok(runInContext("cookingSafety({...recipe,ingredient_items:[{name:'Oats'}]})",c).includes('48 hours'));
});
