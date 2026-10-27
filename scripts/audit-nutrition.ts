// Read-only checks on an existing database, or a disposable seeded catalogue.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {openDb} from '../src/db.ts';
import {foods,nutrients,decorateRecipe,scaleNutrition} from '../src/nutrition.ts';
import {recipeAdaptation} from '../src/recipe-adaptations.ts';
const round=(n:number)=>Math.round(n*10)/10;
const map=new Map(foods.map((f:any)=>[f.id,f]));
// Deliberately independent of calculateRecipe/sumNutrition: verify from source rows.
function expected(recipe:any,quantity=1){return Object.fromEntries(nutrients.map(k=>{const values=recipe.ingredient_items.map((i:any)=>{const food:any=map.get(i.food_id);assert.ok(food,'Unknown food '+i.food_id);assert.ok(Number.isFinite(i.grams)&&i.grams>0,'Invalid grams');assert.equal(i.name,food.name,'Ingredient identity mismatch');return food[k]===null?null:food[k]*i.grams/100;});return [k,values.includes(null)?null:round(values.reduce((sum:number,v:number)=>sum+v,0)/recipe.yield_servings*quantity)];}));}
export function auditNutrition(db:DatabaseSync,includeVariants=true){
 const report=JSON.parse(readFileSync(new URL('../data-sources/cofid-2021-validation.json',import.meta.url),'utf8'));
 const checksum=createHash('sha256').update(readFileSync(new URL('../data-sources/cofid-2021.json',import.meta.url))).digest('hex');
 assert.equal(checksum,report.catalogue_sha256,'Catalogue changed since official-workbook validation');
 assert.equal(map.size,foods.length,'Duplicate app food IDs');
 for(const f of foods){assert.equal(f.basis,'100g');assert.equal(typeof f.name,'string');for(const k of nutrients)assert.ok(f[k]===null&&k==='fibre_g'||typeof f[k]==='number'&&Number.isFinite(f[k])&&f[k]>=0,'Invalid '+f.id+' '+k);}
 let recipes=0,variants=0,portionChecks=0,legacyAmbiguous=0;
 const issues:string[]=[];
 for(const row of db.prepare('SELECT * FROM recipes WHERE archived=0 AND nutrition IS NOT NULL').all()){
  const r=decorateRecipe(row);recipes++;
  try{
   assert.ok(r.yield_servings>0&&Number.isFinite(r.yield_servings));
   const want=expected(r);
   for(const k of nutrients)assert.equal(r.nutrition[k],want[k],r.id+' '+k);
   const samples=[r];
   if(includeVariants)for(const style of ['vegetarian','vegan'])for(const protein of ['tofu','chickpea','lentil']){const adapted=recipeAdaptation(r,style,protein);if(adapted.available){samples.push(adapted.recipe);variants++;}}
   for(const sample of samples)for(const quantity of [.01,.25,.5,1,1.5,3.33,100]){
    // Old stored recipes deliberately retain their original rounded precision.
    if(sample.nutrition.unrounded)assert.deepEqual(scaleNutrition(sample.nutrition,quantity),expected(sample,quantity),r.id+' portion '+quantity);
    portionChecks++;
   }
   legacyAmbiguous+=r.ingredient_items.filter((i:any)=>i.food_id==='cofid-13-669').length;
  }catch(e:any){issues.push(r.id+': '+e.message);}
 }
 return {foods:foods.length,official_nutrient_values_checked:report.nutrient_values_compared,recipes,variants,portion_checks:portionChecks,legacy_ambiguous_ingredients:legacyAmbiguous,issues,notes:['Values are typical CoFID estimates, not laboratory measurements of meals.','Existing diary and plan snapshots are not rewritten or recalculated from current recipes.','Legacy code 13-669 may require manual review: the source assigns it to aubergine and watercress.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const database=process.argv[2];let dir:string|undefined,db:DatabaseSync|undefined;
 try{if(database){assert.equal(process.argv.length,3,'Usage: node scripts/audit-nutrition.ts [DATABASE.sqlite]');db=new DatabaseSync(resolve(database),{readOnly:true});}else{dir=mkdtempSync(join(tmpdir(),'ff-macro-audit-'));db=openDb(dir);}const result=auditNutrition(db);console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;}
 finally{db?.close();if(dir)rmSync(dir,{recursive:true,force:true});}
}
