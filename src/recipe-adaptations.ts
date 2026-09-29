import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { calculateRecipe, decorateRecipe, foods, visibleRecipe, nutritionDate, scaleNutrition, nutrients } from './nutrition.ts';
import { LibraryError } from './plan-library.ts';
import { planMeal } from './rhythm.ts';
const foodMap=new Map<string,any>(foods.map((f:any)=>[f.id,f]));
function check(ok:any,message:string,status=400):asserts ok{if(!ok)throw new LibraryError(message,status);}
function atomic(db:DatabaseSync,fn:()=>any){db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}
export const proteinSwaps={tofu:{code:'13-570',title:'Steamed tofu',note:'Use steamed tofu in its cooked weight. Cut into cubes, slices or mash to suit the dish.'},chickpea:{code:'13-670',title:'Cooked chickpeas',note:'Follow the pack, use the drained, heated weight, and mash lightly for toast or wraps if helpful.'},lentil:{code:'13-661',title:'Cooked lentils',note:'Use boiled lentils in their cooked weight; drain well for bowls and wraps.'}};
const plantCodes=new Set(['13-670','13-570','13-661','13-660','11-869','11-858','11-902','11-1129','13-529','13-504','13-496','13-517','13-521','14-318','14-319','14-325','14-324','14-388','11-788','14-896','11-981','14-892','11-925','13-523','17-038','13-530','13-499','14-277','13-244','13-536','13-505','13-890','13-876','13-318','13-844','13-491','14-386','12-524','12-609','11-725']);
const animalCodes=new Set(['18-323','16-358','16-416','12-313','12-379','12-550','12-940','11-941']);
function family(r:any){const n=r.id.match(/^nutrition-v1-(\d+)$/),k=r.id.match(/^kitchen-v2-(\d+)$/);if(n){const x=Number(n[1]);if(x>=1&&x<=120)return {pack:'nutrition',index:x};}if(k){const x=Number(k[1]);if(x>=1&&x<=12)return {pack:'kitchen',index:x};}return null;}
export function adaptationSource(db:DatabaseSync,userId:string,recipeId:string,admin=false){check(typeof recipeId==='string'&&recipeId.length>0&&recipeId.length<=200,'Choose a recipe.');if(!admin)return visibleRecipe(db,userId,recipeId);const r=db.prepare('SELECT * FROM recipes WHERE id=? AND archived=0').get(recipeId);check(r,'Recipe not found.',404);return decorateRecipe(r);}
function supported(r:any){return !!family(r)&&r.version===1&&r.nutrition&&r.ingredient_items.length&&r.ingredient_items.every((i:any)=>plantCodes.has(i.source_code)||animalCodes.has(i.source_code));}
function titleSwap(title:string,style:string,protein:string){const replacement=proteinSwaps[protein as keyof typeof proteinSwaps].title.replace('Steamed ','').replace('Cooked ','');let t=title.replace(/chicken|salmon|tuna/gi,replacement);if(style==='vegan')t=t.replace(/cottage cheese/gi,'mashed tofu').replace(/egg(?= &| toast)/gi,'tofu').replace(/yoghurt|yogurt/gi,'soya yoghurt');return t+' — '+style+' version';}
function method(r:any,style:string,swaps:any[],protein:string){
 if(!swaps.length)return r.preparation;
 const f=family(r)!,p=proteinSwaps[protein as keyof typeof proteinSwaps].title.toLowerCase();
 if(f.pack==='nutrition'){
  const n=f.index;
  if(n<=30)return `Prepare the cooked or drained protein and cooked grain or sweetcorn in the quantities and states listed. Wash and dice the tomato and cucumber. Combine the measured olive oil with the vegetables and arrange with the protein and grain. If serving warm, heat cooked ingredients until steaming hot throughout. Divide by the recipe yield. ${proteinSwaps[protein as keyof typeof proteinSwaps].note}`;
  if(n<=50)return `Wash and chop raw vegetables where needed. Heat the measured olive oil, add canned tomatoes and vegetables, and simmer until tender. Use broccoli in the steamed state if listed. Stir in the cooked or drained protein and cooked pasta, then heat until steaming hot throughout. Divide by the recipe yield. ${proteinSwaps[protein as keyof typeof proteinSwaps].note}`;
  if(n<=70)return `Wash and chop raw vegetables and onion. Soften onion in the measured oil, add the vegetables and canned tomatoes with 250ml water per original recipe serving, and simmer until tender. Stir in the cooked or drained protein and heat until steaming hot throughout. Serve with the listed wholemeal bread and divide by recipe yield. ${proteinSwaps[protein as keyof typeof proteinSwaps].note}`;
  if(n<=75)return 'Mix the dry oats and the listed fortified unsweetened soya drink with washed or peeled fruit. Cover and refrigerate overnight. Stir before serving. Check the actual soya drink label and use the listed quantities.';
  if(n<=80)return 'Wash or peel and chop the fruit. Spoon over the listed fortified fruit-flavoured soya yoghurt and add the measured oats and almond kernels. The fruit flavour of this substitute differs from the original plain dairy yoghurt. Check the product label.';
  if(n<=85)return 'Toast the listed wholemeal bread. Mash the listed steamed tofu with a little water if needed, spread on the toast and add washed or peeled sliced fruit. Use the edible cooked tofu weight shown; do not treat it as cottage cheese.';
  if(n<=90)return r.preparation;
  if(n<=110)return `Wash and chop raw vegetables. Use steamed broccoli if it is listed. Prepare the cooked or drained ${p} in the listed weight; heat until steaming hot if serving warm. Warm the tortilla briefly in a dry pan. Add the protein, vegetables, cucumber and measured oil, then fold. Check that the tortilla and other packaged foods suit your chosen diet.`;
  if(n%2===1)return 'Wash or peel and chop the fruit. Spoon it over the listed fortified fruit-flavoured soya yoghurt. Add the measured almond kernels just before eating. Check product labels; the soya yoghurt estimate is for the named fruit-flavoured food entry.';
  return r.preparation;
 }
 let m=r.preparation.replace(/chicken|salmon|tuna/gi,p);
 if(f.index===1)return m+' '+proteinSwaps[protein as keyof typeof proteinSwaps].note;
 if(f.index===2)return m.replace(/boiled egg noodles/gi,'boiled rice noodles').replace(/Egg noodles mean this recipe is vegetarian rather than plant-based\./,'This version uses cooked rice noodles; check that the products are suitable for your chosen diet.');
 if(f.index===3&&style==='vegan')return 'Wash the spinach and chop the onion. Blend the listed steamed tofu with a little water to make a spoonable cream. Soften the onion in the measured oil and stir in the curry powder. Add the canned tomatoes and simmer until the onion is tender. Add the drained, heated chickpeas and spinach; stir until the spinach wilts and the mixture is steaming hot. Stir in the tofu cream and warm thoroughly. Divide according to yield with the listed cooked basmati rice. Cool rice promptly and refrigerate for no more than 24 hours.';
 if(f.index===5)return m.replace(/Flake in the cooked [^,]+, checking for bones,/,'Gently fold in the cooked or drained protein,')+' '+proteinSwaps[protein as keyof typeof proteinSwaps].note;
 if(f.index===6)return 'Prepare canned kidney beans and your chosen protein according to the pack. Use the listed cooked or drained edible weights, and cool promptly if serving cold. Wash and dice the cucumber and tomato. Combine with the measured lemon juice and olive oil, then serve with the wholemeal bread. Check storage instructions for opened packs.';
 if(f.index===7&&style==='vegan')return 'Use steamed tofu in the cooked edible weight listed. Wash and slice the tomato. Mash avocado flesh with the measured lemon juice. Toast the wholemeal bread, spread with avocado and add sliced or mashed tofu. Serve tomato alongside. The avocado weight excludes skin and stone.';
 if(f.index===11&&style==='vegan')return m.replace(/milk/gi,'fortified unsweetened soya drink');
 if(f.index===12)return `Wash and slice the tomato and wash the spinach. ${style==='vegan'?'Mash or blend the listed steamed tofu with measured lemon juice and a little water for a spoonable dressing.':'Combine yoghurt with the measured lemon juice.'} Prepare the cooked or drained ${p} in the listed edible weight; if reheating safely stored ingredients, reheat only once until steaming hot throughout. Warm the tortilla briefly in a dry pan. Add the protein, tomato, spinach and dressing, then fold and serve immediately.`;
 return m;
}
export function recipeAdaptation(r:any,style:string,protein='tofu'){
 check(['vegan','vegetarian'].includes(style),'Choose vegan or vegetarian.');check(Object.hasOwn(proteinSwaps,protein),'Choose tofu, chickpeas or lentils.');
 if(!supported(r))return {available:false,reason:'Alex needs to review swaps and the method for this edited or custom recipe. Automatic swaps cover the unchanged prefilled catalogue.',source_id:r.id,source_version:r.version,style,protein};
 const swaps:any[]=[],items=r.ingredient_items.map((i:any)=>{
  const code=i.source_code;let to=code,reason='';
  if(['18-323','16-358','16-416'].includes(code)){to=proteinSwaps[protein as keyof typeof proteinSwaps].code;reason='Replace meat or fish with the chosen cooked plant protein.';}
  if(style==='vegan'){
   if(code==='12-313'){to='12-524';reason='Use a fortified unsweetened soya drink in place of milk.';}
   if(code==='12-379'){to=family(r)?.pack==='kitchen'&&[3,12].includes(family(r)!.index)?'13-570':'12-609';reason=to==='13-570'?'Use mashed or blended steamed tofu for a savoury cream.':'Use the named fortified fruit-flavoured soya yoghurt. Its flavour and macros differ from plain dairy yoghurt.';}
   if(['12-550','12-940'].includes(code)){to='13-570';reason='Use steamed tofu, mashed or sliced as described in the adapted method.';}
   if(code==='11-941'){to='11-725';reason='Replace cooked egg noodles with cooked rice noodles.';}
  }
  if(to!==code){const f=foodMap.get('cofid-'+to);swaps.push({from:i.name,to:f.name,grams:i.grams,reason});}
  return {food_id:'cofid-'+to,grams:i.grams};
 });
 const c=calculateRecipe(items,r.yield_servings),tags=r.tags.filter((t:string)=>!['omnivore','fish','vegetarian','plant-based','vegan'].includes(t));tags.push(style==='vegan'?'plant-based':'vegetarian');
 return {available:true,source_id:r.id,source_version:r.version,style,protein,swaps,original_nutrition:r.nutrition,recipe:{...r,id:undefined,title:titleSwap(r.title,style,protein),ingredient_items:c.items,ingredients:c.items.map((i:any)=>`${i.grams}g · ${i.name}`).join('\n'),nutrition:c.nutrition,tags,yield_servings:r.yield_servings,portions:r.yield_servings+' servings',preparation:method(r,style,swaps,protein),substitutions:'Ingredient substitutions are estimated, not nutritionally equivalent. Check suitability and labels for every packaged product, including bread, pasta, tortillas and curry powders. Vegan does not mean allergen-free; soya is introduced by several swaps. Vegetarian dairy products may need a rennet check.',version:1},notes:['Replacement quantities use equal edible grams as a starting point; protein and other macros can change.','Cooking times may change for larger groups. Cook in manageable batches and follow safe storage guidance.','Check product labels and preparation surfaces. These swaps do not certify allergen safety or guarantee vegan/vegetarian suitability of packaged foods.']};
}
function key(v:any){check(typeof v==='string'&&v.length>0&&v.length<=60,'Use a submission key up to 60 characters.');return v;}
function saveCopy(db:DatabaseSync,userId:string,r:any,a:any,submission:string,request:string){
 const recipeId=randomUUID(),v=a.recipe;
 db.prepare('INSERT INTO recipes(id,title,ingredients,portions,preparation,substitutions,ingredient_items,yield_servings,nutrition,tags,prep_minutes,client_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(recipeId,v.title,v.ingredients,v.portions,v.preparation,v.substitutions,JSON.stringify(v.ingredient_items),v.yield_servings,JSON.stringify(v.nutrition),JSON.stringify(v.tags),v.prep_minutes,userId);
 db.prepare('INSERT INTO recipe_adaptations(recipe_id,user_id,source_recipe_id,source_version,style,protein,request,idempotency_key) VALUES(?,?,?,?,?,?,?,?)').run(recipeId,userId,r.id,r.version,a.style,a.protein,request,submission);return recipeId;
}
export function saveAdaptation(db:DatabaseSync,userId:string,b:any){
 const submission=key(b.idempotency_key),request=JSON.stringify({recipe_id:b.recipe_id,source_version:b.source_version,style:b.style,protein:b.protein||'tofu'}),old=db.prepare('SELECT * FROM recipe_adaptations WHERE user_id=? AND idempotency_key=?').get(userId,submission) as any;
 if(old){check(old.request===request,'That submission key belongs to another adaptation.',409);return {id:old.recipe_id,duplicate:true};}
 const r=adaptationSource(db,userId,b.recipe_id);check(r.version===b.source_version,'The recipe changed. Preview the latest version before saving.',409);const a=recipeAdaptation(r,b.style,b.protein||'tofu');check(a.available,(a as any).reason,409);
 return atomic(db,()=>({id:saveCopy(db,userId,r,a,submission,request)}));
}
function guestInput(b:any){const counts={original:b.original??0,vegetarian:b.vegetarian??0,vegan:b.vegan??0};for(const [style,n] of Object.entries(counts))check(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=100,`${style} servings must be a whole number from 0 to 100.`);check(Object.values(counts).reduce((a,n)=>a+n,0)>0&&Object.values(counts).reduce((a,n)=>a+n,0)<=100,'Choose between 1 and 100 total servings.');return counts;}
export function cateringPreview(r:any,b:any){
 const counts=guestInput(b),protein=b.protein||'tofu';check(Object.hasOwn(proteinSwaps,protein),'Choose a plant protein.');check(r.nutrition&&r.ingredient_items.length,'This recipe needs calculated ingredients first.',409);
 const batches=Object.entries(counts).filter(([,n])=>n>0).map(([style,servings])=>{const adaptation=style==='original'?null:recipeAdaptation(r,style,protein);check(!adaptation||adaptation.available,(adaptation as any)?.reason||'This adaptation needs review.',409);const recipe=adaptation?.recipe||r;return {style,servings,recipe,swaps:adaptation?.swaps||[],totals:scaleNutrition(recipe.nutrition,servings)};});
 const ingredients=new Map<string,any>();for(const batch of batches)for(const i of batch.recipe.ingredient_items){const grams=i.grams*batch.servings/batch.recipe.yield_servings,old=ingredients.get(i.food_id);ingredients.set(i.food_id,{food_id:i.food_id,name:i.name,grams:(old?.grams||0)+grams});}
 return {source_id:r.id,source_version:r.version,protein,counts,batches,total_servings:Object.values(counts).reduce((a,n)=>a+n,0),shopping:[...ingredients.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(i=>({...i,grams:Math.round(i.grams*10)/10})),totals:Object.fromEntries(nutrients.map(k=>[k,batches.some(b=>b.totals[k]===null)?null:Math.round(batches.reduce((n,b)=>n+b.totals[k],0)*10)/10]))};
}
export function saveCatering(db:DatabaseSync,userId:string,b:any){
 const submission=key(b.idempotency_key),day=nutritionDate(b.day);check(['breakfast','lunch','dinner','snack'].includes(b.slot),'Choose a meal.');const counts=guestInput(b),request=JSON.stringify({recipe_id:b.recipe_id,source_version:b.source_version,counts,protein:b.protein||'tofu',day,slot:b.slot});
 const old=db.prepare('SELECT * FROM catering_batches WHERE user_id=? AND idempotency_key=?').get(userId,submission) as any;if(old){check(old.request===request,'That submission key belongs to another group plan.',409);return {id:old.id,plan_ids:JSON.parse(old.plan_ids),duplicate:true};}
 const r=adaptationSource(db,userId,b.recipe_id);check(r.version===b.source_version,'The recipe changed. Preview again before planning.',409);const preview=cateringPreview(r,b);
 return atomic(db,()=>{const planIds=preview.batches.map(batch=>{const rid=batch.style==='original'?r.id:saveCopy(db,userId,r,recipeAdaptation(r,batch.style,preview.protein),'group:'+submission+':'+batch.style,request);return planMeal(db,userId,{recipe_id:rid,day,slot:b.slot,quantity:batch.servings,idempotency_key:'group:'+submission+':'+batch.style}).id;});const id=randomUUID();db.prepare('INSERT INTO catering_batches(id,user_id,request,plan_ids,idempotency_key) VALUES(?,?,?,?,?)').run(id,userId,request,JSON.stringify(planIds),submission);return {id,plan_ids:planIds};});
}
export function adaptationsExport(db:DatabaseSync,userId:string){return {recipes:db.prepare('SELECT r.* FROM recipes r JOIN recipe_adaptations a ON a.recipe_id=r.id WHERE a.user_id=?').all(userId).map(decorateRecipe),provenance:db.prepare('SELECT * FROM recipe_adaptations WHERE user_id=?').all(userId),groups:db.prepare('SELECT * FROM catering_batches WHERE user_id=?').all(userId).map((r:any)=>({...r,request:JSON.parse(r.request),plan_ids:JSON.parse(r.plan_ids)}))};}
