import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtempSync,rmSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createContext,runInContext } from 'node:vm';
import { createApp } from '../src/server.ts';
import { passwordHash } from '../src/auth.ts';
import { recipeAdaptation,cateringPreview,saveCatering } from '../src/recipe-adaptations.ts';
import { decorateRecipe,calculateRecipe } from '../src/nutrition.ts';
import { userToday } from '../src/rhythm.ts';

test('Diet adaptations and mixed group plans keep quantities, ownership and history correct',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-adapt-')),origin='http://127.0.0.1:8085',app=createApp({dataDir:dir,origin});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const port=(app.server.address() as any).port;
 class Client{cookie='';csrf='';async call(path:string,method='GET',body?:any,csrf=this.csrf){return new Promise<any>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':csrf}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];const data=JSON.parse(raw);if(data.csrf)this.csrf=data.csrf;resolve({status:res.statusCode,data});});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});}}
 const alice=new Client(),bob=new Client(),admin=new Client(),anon=new Client(),aid=randomUUID(),bid=randomUUID(),pw='Fictional adaptation testing password';
 for(const [id,email,role] of [[aid,'alice@adapt.test','client'],[bid,'bob@adapt.test','client'],[randomUUID(),'alex@adapt.test','admin']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(id,email,email,passwordHash(pw),role);
 for(const [client,email] of [[alice,'alice@adapt.test'],[bob,'bob@adapt.test'],[admin,'alex@adapt.test']] as const)assert.equal((await client.call('/auth/login','POST',{email,password:pw})).status,200);
 const originals=app.db.prepare("SELECT * FROM recipes WHERE id LIKE 'nutrition-v1-%' OR id LIKE 'kitchen-v2-%'").all().map(decorateRecipe),source=originals.find(r=>r.id==='kitchen-v2-12')!,today=userToday(app.db,aid);
 let savedId='',group:any;
 const body={recipe_id:source.id,source_version:source.version,style:'vegan',protein:'chickpea',idempotency_key:randomUUID()},groupBody={recipe_id:source.id,source_version:1,original:2,vegetarian:3,vegan:4,protein:'lentil',day:today,slot:'dinner',idempotency_key:randomUUID()};
 try{
 await t.test('All 132 recipes support three proteins and both styles with fresh CoFID calculations',()=>{
  assert.equal(originals.length,132);
  for(const r of originals)for(const style of ['vegan','vegetarian'])for(const protein of ['tofu','chickpea','lentil']){
   const a=recipeAdaptation(r,style,protein);assert.equal(a.available,true,r.title);const copy=a.recipe!;
   assert.deepEqual(copy.nutrition,calculateRecipe(copy.ingredient_items,copy.yield_servings).nutrition);
   const prohibited=style==='vegan'?['18-323','16-358','16-416','12-313','12-379','12-550','12-940','11-941']:['18-323','16-358','16-416'];
   assert.ok(copy.ingredient_items.every((i:any)=>!prohibited.includes(i.source_code)),r.title);
   if(a.swaps!.length)assert.ok(copy.preparation.length>40);assert.equal(r.version,1);
  }
 });
 await t.test('Savoury methods use tofu cream, sweets name fruit soya yoghurt, and noodles lose egg instructions',()=>{
  for(const id of ['kitchen-v2-3','kitchen-v2-12']){const a=recipeAdaptation(originals.find(r=>r.id===id),'vegan');assert.ok(a.recipe!.ingredient_items.some((i:any)=>i.source_code==='13-570'));assert.ok(!a.recipe!.ingredient_items.some((i:any)=>i.source_code==='12-609'));assert.match(a.recipe!.preparation,/cream|dressing/);}
  const sweet=recipeAdaptation(originals.find(r=>r.id==='nutrition-v1-76'),'vegan');assert.match(sweet.recipe!.preparation,/fruit-flavoured/);
  const noodles=recipeAdaptation(originals.find(r=>r.id==='kitchen-v2-2'),'vegan');assert.match(noodles.recipe!.preparation,/rice noodles/);assert.doesNotMatch(noodles.recipe!.preparation,/egg noodles/i);
  assert.equal(recipeAdaptation({...source,version:2},'vegan').available,false);assert.equal(recipeAdaptation({...source,id:'custom'},'vegan').available,false);
 });
 await t.test('Preview has signed-in access and rejects unknown styles and protein choices',async()=>{
  assert.equal((await anon.call('/nutrition/recipes/'+source.id+'/adapt?style=vegan')).status,401);
  assert.equal((await alice.call('/nutrition/recipes/'+source.id+'/adapt?style=paleo')).status,400);
  assert.equal((await alice.call('/nutrition/recipes/'+source.id+'/adapt?style=vegan&protein=beef')).status,400);
  const a=await alice.call('/nutrition/recipes/'+source.id+'/adapt?style=vegan&protein=chickpea');assert.equal(a.status,200);assert.equal(a.data.source_version,1);
 });
 await t.test('Saved copies are private, retry-safe and separate from originals',async()=>{
  const result=await alice.call('/nutrition/adaptations','POST',body);assert.equal(result.status,201);savedId=result.data.id;
  assert.equal((await alice.call('/nutrition/adaptations','POST',body)).data.id,savedId);
  assert.equal((await alice.call('/nutrition/adaptations','POST',{...body,protein:'tofu'})).status,409);
  assert.equal((await bob.call('/nutrition/recipes/'+savedId)).status,404);
  assert.equal((await bob.call('/nutrition/recipes/'+savedId+'/adapt?style=vegan')).status,404);
  assert.equal((await admin.call('/nutrition/recipes/'+savedId+'/adapt?style=vegan')).data.available,false);
  assert.equal((await admin.call('/nutrition/adaptations','POST',{...body,idempotency_key:randomUUID()})).status,403);
  assert.equal((await alice.call('/nutrition/adaptations','POST',{...body,idempotency_key:randomUUID()},'')).status,403);
  assert.equal(app.db.prepare('SELECT client_id FROM recipes WHERE id=?').get(savedId)?.client_id,aid);
  assert.equal(app.db.prepare('SELECT version FROM recipes WHERE id=?').get(source.id)?.version,1);
 });
 await t.test('Group quantities respect yield, aggregate shared ingredients and reject invalid counts',async()=>{
  const preview=cateringPreview(source,groupBody);assert.equal(preview.total_servings,9);assert.equal(preview.batches.length,3);
  const tortilla=preview.shopping.find(i=>i.food_id==='cofid-11-925');assert.equal(tortilla?.grams,540);
  assert.equal(preview.shopping.find(i=>i.food_id==='cofid-18-323')?.grams,240);
  assert.equal(preview.shopping.find(i=>i.food_id==='cofid-13-661')?.grams,840);
  assert.equal(preview.shopping.find(i=>i.food_id==='cofid-13-570')?.grams,160);
  const two=originals.find(r=>r.id==='kitchen-v2-1')!;assert.equal(cateringPreview(two,{original:10}).shopping.find(i=>i.food_id==='cofid-18-323')?.grams,1200);
  for(const counts of [{original:0},{original:-1},{original:1.5},{original:101},{original:90,vegan:11},{original:'2'}])assert.equal((await alice.call('/nutrition/catering-preview','POST',{recipe_id:source.id,...counts})).status,400);
 });
 await t.test('Mixed group saves all batches atomically and retries create no extra recipes or meals',async()=>{
  const saved=await alice.call('/nutrition/catering','POST',groupBody);assert.equal(saved.status,201);group=saved.data;assert.equal(group.plan_ids.length,3);
  const n=app.db.prepare('SELECT COUNT(*) n FROM recipes WHERE client_id=?').get(aid)?.n;
  assert.equal((await alice.call('/nutrition/catering','POST',groupBody)).data.id,group.id);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM recipes WHERE client_id=?').get(aid)?.n,n);
  assert.equal((await alice.call('/nutrition/catering','POST',{...groupBody,vegan:5})).status,409);
  assert.equal((await bob.call('/planner?day='+today)).data.entries.length,0);
  assert.equal((await alice.call('/planner?day='+today)).data.entries.length,3);
  app.db.exec("CREATE TRIGGER fail_group BEFORE INSERT ON planned_meals WHEN NEW.quantity=7 BEGIN SELECT RAISE(ABORT,'forced batch failure'); END");
  assert.throws(()=>saveCatering(app.db,aid,{...groupBody,original:1,vegetarian:7,vegan:0,idempotency_key:randomUUID()}),/forced batch failure/);app.db.exec('DROP TRIGGER fail_group');
  assert.equal(app.db.prepare('SELECT COUNT(*) n FROM recipes WHERE client_id=?').get(aid)?.n,n);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM planned_meals WHERE user_id=?').get(aid)?.n,3);
 });
 await t.test('Diary records only the eaten portion even when the prepared batch has 100 servings',async()=>{
  const plan=(await alice.call('/planner','POST',{recipe_id:source.id,quantity:100,day:today,slot:'lunch',idempotency_key:randomUUID()})).data;
  const log=await alice.call('/planner/'+plan.id+'/log','POST',{version:1,quantity:1});assert.equal(log.status,200);
  assert.equal((await alice.call('/planner/'+plan.id+'/log','POST',{version:1,quantity:1})).data.id,log.data.id);
  assert.equal((await alice.call('/planner/'+plan.id+'/log','POST',{version:1,quantity:2})).status,409);
  const diary=(await alice.call('/nutrition/diary?day='+today)).data.entries[0];assert.equal(diary.quantity,1);assert.deepEqual(diary.snapshot.nutrition,source.nutrition);
  assert.equal((await bob.call('/planner/'+plan.id+'/log','POST',{version:1,quantity:1})).status,404);
 });
 await t.test('Source edits cannot silently change saved plans or bypass stale preview checks',async()=>{
  const before=(await alice.call('/planner?day='+today)).data.entries.map((r:any)=>r.snapshot);
  app.db.prepare('UPDATE recipes SET version=2,title=? WHERE id=?').run('Edited by Alex',source.id);
  assert.equal((await alice.call('/nutrition/adaptations','POST',{...body,idempotency_key:randomUUID()})).status,409);
  assert.equal((await alice.call('/nutrition/catering','POST',{...groupBody,idempotency_key:randomUUID()})).status,409);
  assert.equal((await alice.call('/nutrition/adaptations','POST',body)).data.id,savedId);
  assert.equal((await alice.call('/nutrition/catering','POST',groupBody)).data.id,group.id);
  assert.deepEqual((await alice.call('/planner?day='+today)).data.entries.map((r:any)=>r.snapshot),before);
  assert.equal((await alice.call('/nutrition/recipes/'+source.id+'/adapt?style=vegan')).data.available,false);
 });
 await t.test('Exports include private copies and provenance; account deletion removes group records',async()=>{
  const data=(await alice.call('/export')).data.adaptations;assert.equal(data.recipes.length,3);assert.equal(data.provenance.length,3);assert.equal(data.groups.length,1);
  assert.equal((await bob.call('/export')).data.adaptations.recipes.length,0);
  assert.equal((await alice.call('/account/deletion','POST',{})).status,201);
  const deleted=spawnSync(process.execPath,['src/manage.ts','delete-requested-account','alice@adapt.test'],{cwd:new URL('..',import.meta.url),env:{...process.env,FF_MODE:'local-test',FF_DATA_DIR:dir},encoding:'utf8'});assert.equal(deleted.status,0,deleted.stderr);
  assert.equal(app.db.prepare('SELECT id FROM users WHERE id=?').get(aid),undefined);
  assert.equal(app.db.prepare('SELECT title FROM recipes WHERE id=?').get(savedId)?.title,'Archived personal recipe');
  for(const table of ['recipe_adaptations','catering_batches'])assert.equal(app.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user_id=?`).get(aid)?.n,0);
 });
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Recipe and diary dates use the server default timezone until a profile timezone is chosen',()=>{
 const NativeDate=Date;
 class FixedDate extends NativeDate{constructor(...args:any[]){super(args.length?args[0]:'2026-09-29T22:30:00Z');}}
 const c=createContext({Date:FixedDate,Intl:{DateTimeFormat:function(locale:any,options:any){return new Intl.DateTimeFormat(locale,options||{timeZone:'Asia/Dhaka'});}},session:{user:{profile:{}}},document:{addEventListener(){}}});
 runInContext(readFileSync(new URL('../public/nutrition.js',import.meta.url),'utf8'),c);
 assert.equal(runInContext('localNutritionDay()',c),'2026-09-29');
 runInContext("session.user.profile.timezone='Asia/Dhaka'",c);assert.equal(runInContext('localNutritionDay()',c),'2026-09-30');
});
