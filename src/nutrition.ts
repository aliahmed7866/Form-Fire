import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { LibraryError } from './plan-library.ts';

export const nutritionSource='UK CoFID 2021';
export const foods=JSON.parse(readFileSync(new URL('../data-sources/cofid-2021.json',import.meta.url),'utf8'));
const foodMap=new Map<string,any>(foods.map((f:any)=>[f.id,f]));
export const nutrients=['kcal','protein_g','carbs_g','fat_g','fibre_g'] as const;
function check(ok:any,message:string,status=400):asserts ok {if(!ok)throw new LibraryError(message,status);}
export function amount(v:any,name:string,min=0.01,max=10000) {check(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,`${name} must be between ${min} and ${max}.`);return v;}
function text(v:any,name:string,max=200) {check(typeof v==='string'&&v.trim().length>0&&v.length<=max,`Enter ${name} (up to ${max} characters).`);return v.trim();}
export function nutritionDate(v:any) {check(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Choose a valid diary date.');return v;}
const rounded=(v:number)=>Math.round(v*10)/10;
export function scaleNutrition(n:any,factor:number) {return Object.fromEntries(nutrients.map(k=>[k,n[k]===null?null:rounded(n[k]*factor)]));}
export function calculateRecipe(items:any,yieldServings:any) {
  const servings=amount(yieldServings,'Recipe yield',0.25,100);
  check(Array.isArray(items)&&items.length>0&&items.length<=50,'Add between 1 and 50 ingredients.');
  const resolved=items.map((i:any)=>{check(i&&typeof i==='object','Enter a valid ingredient.');const f=foodMap.get(i.food_id);check(f,'Choose an ingredient from the food library.');return {food_id:f.id,name:f.name,grams:amount(i.grams,'Ingredient grams'),source_code:f.source_code};});
  const total=Object.fromEntries(nutrients.map(k=>[k,resolved.some((i:any)=>foodMap.get(i.food_id)[k]===null)?null:resolved.reduce((sum:number,i:any)=>sum+foodMap.get(i.food_id)[k]*i.grams/100,0)]));
  return {items:resolved,nutrition:{...scaleNutrition(total,1/servings),source:nutritionSource,estimated:true,basis:'per serving'},yield_servings:servings};
}
export function decorateRecipe(r:any) {return {...r,ingredient_items:typeof r.ingredient_items==='string'?JSON.parse(r.ingredient_items):r.ingredient_items||[],nutrition:typeof r.nutrition==='string'?JSON.parse(r.nutrition):r.nutrition||null,tags:typeof r.tags==='string'?JSON.parse(r.tags):r.tags||[]};}
export function recipeNutritionInput(db:DatabaseSync,b:any,old:any) {
  const hasItems=b.ingredient_items!==undefined;
  const items=hasItems?b.ingredient_items:[];
  check(Array.isArray(items),'Recipe ingredients must be a list.');
  const calculated=items.length?calculateRecipe(items,b.yield_servings):null;
  // Legacy free-text edits cannot silently retain now-inaccurate nutrition.
  const unchanged=old&&!hasItems&&b.ingredients===old.ingredients&&b.portions===old.portions;
  const tags=b.tags??(old?JSON.parse(old.tags):[]);
  check(Array.isArray(tags)&&tags.length<=10&&tags.every(t=>typeof t==='string'&&t.length>0&&t.length<=40),'Use at most 10 short recipe tags.');
  const client=b.client_id!==undefined?b.client_id:old?.client_id??null;
  check(client===null||typeof client==='string','Choose a valid client.');
  check(client===null||client===''||!!db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(client),'Choose a valid client.');
  const prep=b.prep_minutes??old?.prep_minutes??20;check(Number.isSafeInteger(prep)&&prep>=1&&prep<=600,'Preparation time must be 1–600 minutes.');
  return {
    ingredient_items:JSON.stringify(calculated?.items??(unchanged?JSON.parse(old.ingredient_items):[])),
    yield_servings:calculated?.yield_servings??(unchanged?old.yield_servings:1),
    nutrition:calculated?JSON.stringify(calculated.nutrition):unchanged?old.nutrition:null,
    ingredients:calculated?calculated.items.map((i:any)=>`${i.grams}g · ${i.name}`).join('\n'):b.ingredients,
    tags:JSON.stringify([...new Set(tags)]),prep_minutes:prep,client_id:client||null
  };
}
export function catalogue(db:DatabaseSync,userId:string,q:URLSearchParams) {
  const term=(q.get('q')||'').trim().toLowerCase();check(term.length<=200,'Search is too long.');
  const tag=q.get('tag')||'',favourites=q.get('favourites')==='1';
  const favouriteIds=new Set(db.prepare('SELECT recipe_id FROM recipe_favourites WHERE user_id=?').all(userId).map((r:any)=>r.recipe_id));
  const recipes=db.prepare('SELECT * FROM recipes WHERE archived=0 AND (client_id IS NULL OR client_id=?) ORDER BY title').all(userId).map(decorateRecipe).filter(r=>(!term||`${r.title} ${r.ingredients} ${r.tags.join(' ')}`.toLowerCase().includes(term))&&(!tag||r.tags.includes(tag))&&(!favourites||favouriteIds.has(r.id))).map(r=>({...r,favourite:favouriteIds.has(r.id)}));
  const offset=Number(q.get('offset')||0),limit=Number(q.get('limit')||24);check(Number.isSafeInteger(offset)&&offset>=0&&Number.isSafeInteger(limit)&&limit>=1&&limit<=100,'Choose a valid recipe page.');
  return {recipes:recipes.slice(offset,offset+limit),total:recipes.length,offset,limit};
}
export function visibleRecipe(db:DatabaseSync,userId:string,recipeId:string) {const r=db.prepare('SELECT * FROM recipes WHERE id=? AND archived=0 AND (client_id IS NULL OR client_id=?)').get(recipeId,userId);check(r,'Recipe not found.',404);return decorateRecipe(r);}
function slot(v:any) {check(['breakfast','lunch','dinner','snack'].includes(v),'Choose breakfast, lunch, dinner or snack.');return v;}
export function saveDiary(db:DatabaseSync,userId:string,b:any) {
  const key=text(b.idempotency_key,'submission key',100),day=nutritionDate(b.day),meal=slot(b.slot),quantity=amount(b.quantity,'Portion or gram quantity',0.01,10000);
  const old=db.prepare('SELECT * FROM food_diary WHERE user_id=? AND idempotency_key=?').get(userId,key) as any;
  if(old){const s=JSON.parse(old.snapshot);check(old.day===day&&old.slot===meal&&old.quantity===quantity&&s.kind===b.kind&&s.source_id===b.source_id,'That submission key already belongs to another diary entry.',409);return {...old,snapshot:s,duplicate:true};}
  let snapshot:any;
  if(b.kind==='recipe') {check(quantity<=100,'Choose at most 100 servings.');const r=visibleRecipe(db,userId,text(b.source_id,'recipe'));check(r.nutrition,'This recipe needs ingredient-based nutrition before it can be logged.',409);snapshot={kind:'recipe',source_id:r.id,title:r.title,recipe_version:r.version,unit:'servings',nutrition:r.nutrition,ingredient_items:r.ingredient_items,preparation:r.preparation,yield_servings:r.yield_servings};}
  else {check(b.kind==='food','Choose a recipe or food.');const f=foodMap.get(b.source_id);check(f,'Food not found.',404);snapshot={kind:'food',source_id:f.id,title:f.name,unit:'grams',nutrition:{...Object.fromEntries(nutrients.map(k=>[k,f[k]===null?null:f[k]/100])),source:nutritionSource,estimated:true,basis:'per gram'},source_code:f.source_code};}
  const entryId=randomUUID();db.prepare('INSERT INTO food_diary(id,user_id,day,slot,quantity,snapshot,idempotency_key) VALUES(?,?,?,?,?,?,?)').run(entryId,userId,day,meal,quantity,JSON.stringify(snapshot),key);
  return {id:entryId,day,slot:meal,quantity,snapshot,version:1};
}
export function updateDiary(db:DatabaseSync,userId:string,entryId:string,b:any,remove=false) {
  const row=db.prepare('SELECT * FROM food_diary WHERE id=? AND user_id=?').get(entryId,userId) as any;check(row,'Diary entry not found.',404);check(b.version===row.version,'This entry changed. Refresh before editing.',409);
  if(remove)db.prepare('DELETE FROM food_diary WHERE id=? AND user_id=?').run(entryId,userId);
  else {const snapshot=JSON.parse(row.snapshot);const quantity=amount(b.quantity,'Quantity',0.01,snapshot.kind==='recipe'?100:10000);db.prepare('UPDATE food_diary SET day=?,slot=?,quantity=?,version=version+1 WHERE id=? AND user_id=?').run(nutritionDate(b.day),slot(b.slot),quantity,entryId,userId);}
  return {ok:true};
}
export function diary(db:DatabaseSync,userId:string,day:string) {
  nutritionDate(day);
  const entries=db.prepare('SELECT * FROM food_diary WHERE user_id=? AND day=? ORDER BY created_at,rowid').all(userId,day).map((r:any)=>{const snapshot=JSON.parse(r.snapshot);return {...r,snapshot,totals:scaleNutrition(snapshot.nutrition,r.quantity)};});
  const totals=Object.fromEntries(nutrients.map(k=>[k,entries.some(e=>e.totals[k]===null)?null:rounded(entries.reduce((sum,e)=>sum+e.totals[k],0))]));
  const target=db.prepare('SELECT * FROM nutrition_targets WHERE user_id=?').get(userId) as any;
  return {day,entries,totals,targets:target?{...JSON.parse(target.targets),version:target.version}:null};
}
export function saveTargets(db:DatabaseSync,userId:string,b:any) {
  check(db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(userId),'Client not found.',404);
  const old=db.prepare('SELECT * FROM nutrition_targets WHERE user_id=?').get(userId) as any;check(b.version===(old?.version??0),'These targets changed. Refresh before saving.',409);
  const targets=Object.fromEntries(nutrients.map(k=>[k,b[k]===null||b[k]===undefined?null:amount(b[k],k,0,k==='kcal'?10000:1000)]));
  const notes=b.notes??'';check(typeof notes==='string'&&notes.length<=2000,'Keep target notes under 2000 characters.');
  db.prepare('INSERT INTO nutrition_targets(user_id,targets) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET targets=excluded.targets,version=nutrition_targets.version+1,updated_at=CURRENT_TIMESTAMP').run(userId,JSON.stringify({...targets,notes}));
  return {ok:true};
}
export function nutritionExport(db:DatabaseSync,userId:string) {return {diary:db.prepare('SELECT * FROM food_diary WHERE user_id=? ORDER BY day').all(userId).map((r:any)=>({...r,snapshot:JSON.parse(r.snapshot)})),favourites:db.prepare('SELECT recipe_id FROM recipe_favourites WHERE user_id=?').all(userId),targets:db.prepare('SELECT * FROM nutrition_targets WHERE user_id=?').all(userId).map((r:any)=>({...r,targets:JSON.parse(r.targets)}))};}
