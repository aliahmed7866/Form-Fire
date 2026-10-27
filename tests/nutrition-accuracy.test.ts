import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {openDb} from '../src/db.ts';
import {auditNutrition} from '../scripts/audit-nutrition.ts';
import {foods,calculateRecipe,scaleNutrition,sumNutrition,diary} from '../src/nutrition.ts';
import {passwordHash} from '../src/auth.ts';

test('Official catalogue, every recipe and all supported variations pass independent arithmetic',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-macros-')),db=openDb(dir);
 try{const report=auditNutrition(db);assert.equal(report.foods,2767);assert.equal(report.official_nutrient_values_checked,13835);assert.equal(report.recipes,132);assert.equal(report.variants,792);assert.equal(report.portion_checks,6468);assert.deepEqual(report.issues,[]);}finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Duplicate source code cannot substitute watercress macros for roasted aubergine',()=>{
 const rows=foods.filter((f:any)=>f.source_code==='13-669');assert.equal(rows.length,2);assert.equal(new Set(rows.map((f:any)=>f.id)).size,2);
 const aubergine=calculateRecipe([{food_id:'cofid-13-669-aubergine-roasted',grams:100}],1).nutrition;
 const watercress=calculateRecipe([{food_id:'cofid-13-669',grams:100}],1).nutrition;
 assert.equal(aubergine.kcal,62);assert.equal(aubergine.fat_g,3.8);assert.equal(watercress.kcal,10);assert.equal(watercress.fat_g,0.3);
});

test('Fractional recipes and mixed totals round once; incomplete nutrients never become zero',()=>{
 // 100g banana = 81 kcal, split into 7 then scale back to the whole recipe.
 const r=calculateRecipe([{food_id:'cofid-14-318',grams:100}],7);
 assert.equal(r.nutrition.kcal,11.6);assert.equal(scaleNutrition(r.nutrition,7).kcal,81);
 assert.equal(sumNutrition([{nutrition:{kcal:1.04},quantity:1},{nutrition:{kcal:1.04},quantity:1}]).kcal,2.1);
 for(const n of [{kcal:1,fibre_g:null},{kcal:1},{kcal:1,fibre_g:NaN},{kcal:1,fibre_g:'0'},{kcal:1,fibre_g:-1}])assert.equal(scaleNutrition(n,1).fibre_g,null);
 assert.throws(()=>scaleNutrition(r.nutrition,NaN));assert.throws(()=>scaleNutrition(r.nutrition,-1));
 // Frozen legacy estimates still use their saved values, never today's food map.
 assert.equal(scaleNutrition({kcal:11.6},7).kcal,81.2);
});

test('Diary daily totals aggregate frozen quantities before rounding and preserve historical snapshots',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-total-')),db=openDb(dir);
 try{
  db.prepare("INSERT INTO users(id,email,name,password,role,verified) VALUES('macro-client','macro@example.test','Example',?,'client',1)").run(passwordHash('fictional macro password'));
  const snapshot=JSON.stringify({kind:'food',source_id:'historical',title:'Frozen food',unit:'grams',nutrition:{kcal:1.04,protein_g:0.04,carbs_g:0.04,fat_g:0,fibre_g:null}});
  for(const id of ['one','two'])db.prepare("INSERT INTO food_diary(id,user_id,day,slot,quantity,snapshot,idempotency_key) VALUES(?,'macro-client','2026-10-27','snack',1,?,?)").run(id,snapshot,id);
  const d=diary(db,'macro-client','2026-10-27');assert.equal(d.entries[0].totals.kcal,1);assert.equal(d.totals.kcal,2.1);assert.equal(d.totals.protein_g,0.1);assert.equal(d.totals.fibre_g,null);
  assert.equal(db.prepare("SELECT snapshot FROM food_diary WHERE id='one'").get()?.snapshot,snapshot);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Live portion previews match server scaling for every food and show missing data honestly',()=>{
 const c=createContext({document:{addEventListener(){}},Number,Math});runInContext(`const esc=v=>String(v??'');`,c);runInContext(readFileSync(new URL('../public/nutrition.js',import.meta.url),'utf8'),c);
 for(const food of foods){c.n=food;c.qty=1.37;const ui=JSON.parse(runInContext('JSON.stringify(nutritionScaled(n,qty))',c));delete ui.source;assert.deepEqual(ui,scaleNutrition(food,1.37),food.id);}
 c.n=calculateRecipe([{food_id:'cofid-14-318',grams:100}],7).nutrition;
 assert.equal(runInContext('nutritionScaled(n,7).kcal',c),81);
 assert.match(runInContext('nutritionMacros({kcal:1})',c),/Unknown/);
 assert.doesNotMatch(runInContext('nutritionMacros({kcal:1})',c),/undefinedg|NaN/);
 assert.match(runInContext('nutritionSummary({entries:[],totals:{}})',c),/Not logged/);
 assert.doesNotMatch(runInContext('nutritionSummary({entries:[],totals:{}})',c),/>0g</);
});
