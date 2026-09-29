import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/server.ts';
import { openDb } from '../src/db.ts';
import { passwordHash } from '../src/auth.ts';
import { calculateRecipe,foods } from '../src/nutrition.ts';

test('Nutrition catalogue, diary, customisation and access controls',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-nutrition-')),origin='http://127.0.0.1:8085',app=createApp({dataDir:dir,origin});
 await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const port=(app.server.address() as any).port;
 class Client {cookie='';csrf='';async call(path:string,method='GET',body?:any,extra={}){return new Promise<any>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:origin,'Content-Type':'application/json',Cookie:this.cookie,'X-CSRF-Token':this.csrf,...(body===undefined?{}:{'Content-Length':Buffer.byteLength(JSON.stringify(body))}),...extra}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];const result=JSON.parse(data);if(result.csrf)this.csrf=result.csrf;resolve({status:res.statusCode,data:result});});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});}}
 const admin=new Client(),alice=new Client(),bob=new Client(),anon=new Client(),pw='long fictional password';
 const aid=randomUUID(),bid=randomUUID();for(const [uid,email,role] of [[randomUUID(),'alex@nutrition.test','admin'],[aid,'alice@nutrition.test','client'],[bid,'bob@nutrition.test','client']])app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(uid,email,email,passwordHash(pw),role);
 for(const [c,email] of [[admin,'alex@nutrition.test'],[alice,'alice@nutrition.test'],[bob,'bob@nutrition.test']] as const)assert.equal((await c.call('/auth/login','POST',{email,password:pw})).status,200);
 let recipe:any,entry:any,personal:any;
 try {
 await t.test('120 prefilled recipes with real ingredient calculations; seeding is idempotent',async()=>{
   assert.equal(app.db.prepare('SELECT COUNT(*) n FROM recipes WHERE nutrition IS NOT NULL').get()?.n,120);
   const second=openDb(dir);assert.equal(second.prepare('SELECT COUNT(*) n FROM recipes WHERE nutrition IS NOT NULL').get()?.n,120);second.close();
   const all=(await alice.call('/nutrition/recipes?limit=100')).data;assert.equal(all.total,123);assert.equal(all.recipes.length,100);
   recipe=all.recipes.find((r:any)=>r.nutrition);assert.ok(recipe);assert.equal(foods.length,2767);
   for(const row of app.db.prepare('SELECT * FROM recipes WHERE nutrition IS NOT NULL').all() as any[]){const n=calculateRecipe(JSON.parse(row.ingredient_items),row.yield_servings);assert.deepEqual(JSON.parse(row.nutrition),n.nutrition);}
   const f=foods.find((f:any)=>f.id==='cofid-14-318'),n=calculateRecipe([{food_id:f.id,grams:200}],4).nutrition;assert.equal(n.protein_g,Math.round(f.protein_g*0.5*10)/10);assert.equal(n.kcal,Math.round(f.kcal*0.5*10)/10);
   assert.throws(()=>calculateRecipe([{food_id:f.id,grams:-1}],1));assert.throws(()=>calculateRecipe([{food_id:f.id,grams:1}],0));const unknown=foods.find((f:any)=>f.fibre_g===null);assert.equal(calculateRecipe([{food_id:unknown.id,grams:100}],1).nutrition.fibre_g,null);
 });
 await t.test('Diary fractions, food gram precision, retries and record ownership',async()=>{
   assert.equal((await anon.call('/nutrition/recipes')).status,401);
   const body={kind:'recipe',source_id:recipe.id,day:'2026-09-29',slot:'lunch',quantity:1.5,idempotency_key:randomUUID()};entry=(await alice.call('/nutrition/diary','POST',body)).data;
   assert.equal((await alice.call('/nutrition/diary','POST',body)).data.id,entry.id);
   assert.equal((await alice.call('/nutrition/diary','POST',{...body,quantity:2})).status,409);
   const diary=(await alice.call('/nutrition/diary?day=2026-09-29')).data;assert.equal(diary.entries.length,1);assert.equal(diary.totals.kcal,Math.round(recipe.nutrition.kcal*1.5*10)/10);
   assert.equal((await bob.call('/nutrition/diary?day=2026-09-29')).data.entries.length,0);
   assert.equal((await bob.call('/nutrition/diary/'+entry.id,'DELETE',{version:1})).status,404);
   assert.equal((await alice.call('/nutrition/diary/'+entry.id,'PUT',{day:'2026-09-29',slot:'dinner',quantity:2,version:1})).status,200);
   assert.equal((await alice.call('/nutrition/diary/'+entry.id,'PUT',{day:'2026-09-29',slot:'dinner',quantity:2,version:1})).status,409);
   const food=foods.find((f:any)=>f.id==='cofid-14-318');await alice.call('/nutrition/diary','POST',{kind:'food',source_id:food.id,day:'2026-09-30',slot:'snack',quantity:100,idempotency_key:randomUUID()});const totals=(await alice.call('/nutrition/diary?day=2026-09-30')).data.totals;assert.equal(totals.protein_g,food.protein_g);assert.equal(totals.kcal,food.kcal);
   assert.equal((await alice.call('/nutrition/diary','POST',{...body,day:'2026-02-30',idempotency_key:randomUUID()})).status,400);
   assert.equal((await alice.call('/nutrition/diary','POST',{...body,quantity:0,idempotency_key:randomUUID()})).status,400);
   assert.equal((await alice.call('/nutrition/diary','POST',{...body,idempotency_key:randomUUID()},{'X-CSRF-Token':''})).status,403);
   assert.equal((await admin.call('/nutrition/diary','POST',body)).status,403);
 });
 await t.test('Alex can tailor recipes privately; macro recalculation and archive preserve diary history',async()=>{
   assert.equal((await alice.call('/admin/recipes','POST',recipe)).status,403);
   const draft={...recipe,id:undefined,client_id:aid,title:'Alice’s own bowl',ingredient_items:recipe.ingredient_items.map((i:any)=>({...i,grams:i.grams*2}))};const response=await admin.call('/admin/recipes','POST',draft);assert.equal(response.status,200);personal=(await alice.call('/nutrition/recipes/'+response.data.id)).data;assert.equal(personal.nutrition.kcal,Math.round(recipe.nutrition.kcal*2*10)/10);
   assert.equal((await bob.call('/nutrition/recipes/'+personal.id)).status,404);
   assert.equal((await bob.call('/nutrition/diary','POST',{kind:'recipe',source_id:personal.id,day:'2026-09-29',slot:'lunch',quantity:1,idempotency_key:randomUUID()})).status,404);
   const req=(await alice.call('/requests','POST',{service_id:'both',idempotency_key:randomUUID(),details:{goals:'Test',experience:'Beginner',equipment:'None',availability:'Weekends'}})).data;
   for(const status of ['under_review','approved'])await admin.call('/requests/'+req.id+'/status','POST',{status});await admin.call('/requests/'+req.id+'/activate','POST',{active:true,package:'Fictional nutrition test'});
   const template=(await admin.call('/admin/templates','POST',{title:'Personal meals',kind:'meal',content:{schedule:'This week',guidance:'Your own recipe',recipe_ids:[personal.id]}})).data;
   const assignment=(await admin.call('/admin/assignments','POST',{request_id:req.id,template_id:template.id})).data;
   const before=(await alice.call('/assignments/'+assignment.id)).data;
   const saved=(await admin.call('/admin/recipes/'+personal.id,'PUT',{...personal,title:'Updated personal bowl',archived:true,client_id:null}));assert.equal(saved.status,200);assert.equal(app.db.prepare('SELECT client_id FROM recipes WHERE id=?').get(personal.id)?.client_id,null);
   assert.deepEqual((await alice.call('/assignments/'+assignment.id)).data,before);
   assert.equal((await alice.call('/nutrition/recipes/'+personal.id)).status,404);
   await admin.call('/admin/recipes/'+recipe.id,'PUT',{...recipe,title:'New recipe name',ingredient_items:recipe.ingredient_items.map((i:any)=>({...i,grams:i.grams*2}))});
   const logged=(await alice.call('/nutrition/diary?day=2026-09-29')).data.entries[0];assert.equal(logged.snapshot.title,recipe.title);assert.deepEqual(logged.snapshot.nutrition,recipe.nutrition);
 });
 await t.test('Favourites, client targets and exports remain private',async()=>{
   await alice.call('/nutrition/recipes/'+recipe.id+'/favourite','PUT',{favourite:true});assert.equal((await alice.call('/nutrition/recipes?favourites=1')).data.total,1);assert.equal((await bob.call('/nutrition/recipes?favourites=1')).data.total,0);
   assert.equal((await alice.call('/admin/nutrition/'+bid)).status,403);
   assert.equal((await admin.call('/admin/nutrition/'+aid,'PUT',{version:0,protein_g:120,notes:'Agreed example target'})).status,200);
   assert.equal((await admin.call('/admin/nutrition/'+aid,'PUT',{version:0,protein_g:130})).status,409);
   assert.equal((await alice.call('/nutrition/diary?day=2026-09-29')).data.targets.protein_g,120);
   assert.equal((await bob.call('/nutrition/diary?day=2026-09-29')).data.targets,null);
   const exported=(await alice.call('/export')).data.nutrition;assert.equal(exported.diary.length,2);assert.equal(exported.favourites.length,1);
   assert.equal((await alice.call('/nutrition/diary/'+entry.id,'DELETE',{version:2})).status,200);assert.equal((await alice.call('/nutrition/diary?day=2026-09-29')).data.entries.length,0);
 });
 }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
