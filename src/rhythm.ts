import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { LibraryError } from './plan-library.ts';
import { visibleRecipe, amount, nutritionDate, scaleNutrition } from './nutrition.ts';

function check(ok:any,message:string,status=400):asserts ok {if(!ok)throw new LibraryError(message,status);}
function submissionKey(v:any){check(typeof v==='string'&&v.length>0&&v.length<=100,'A submission key is required.');return v;}
function mealSlot(v:any){check(['breakfast','lunch','dinner','snack'].includes(v),'Choose a meal.');return v;}
function atomic(db:DatabaseSync,fn:()=>any){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
export function shiftDay(day:string,days:number){const d=new Date(nutritionDate(day)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function weekStart(day:string){const n=new Date(nutritionDate(day)+'T12:00:00Z').getUTCDay();return shiftDay(day,-((n+6)%7));}
export function userToday(db:DatabaseSync,userId:string,now=new Date()){
 const row=db.prepare('SELECT profile FROM users WHERE id=?').get(userId) as any;
 const zone=JSON.parse(row?.profile||'{}').timezone||'Europe/London';
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=(key:string)=>parts.find(p=>p.type===key)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export const habitOptions={
 move:{title:'Make room to move',copy:'An activity you enjoy, at a pace that suits you.',guide:'movement'},
 colour:{title:'Add a little colour',copy:'Include some fruit or vegetables in your day.',guide:'balance'},
 prep:{title:'Make tomorrow easier',copy:'Choose a meal, check the fridge or prepare an ingredient.',guide:'prep'},
 wind_down:{title:'Find a softer landing',copy:'Make a little space for a wind-down routine.',guide:'sleep'},
 fluids:{title:'Pause for a drink',copy:'Make time for fluids through your day.',guide:'hydration'}
};
function decoded(row:any){return {...row,snapshot:JSON.parse(row.snapshot),totals:scaleNutrition(JSON.parse(row.snapshot).nutrition,row.quantity)};}
export function planMeal(db:DatabaseSync,userId:string,b:any){
 const day=nutritionDate(b.day),slot=mealSlot(b.slot),quantity=amount(b.quantity,'Servings',0.25,100),key=submissionKey(b.idempotency_key);
 const old=db.prepare('SELECT * FROM planned_meals WHERE user_id=? AND idempotency_key=?').get(userId,key) as any;
 if(old){const snapshot=JSON.parse(old.snapshot);check(old.day===day&&old.slot===slot&&old.quantity===quantity&&snapshot.source_id===b.recipe_id,'That submission key belongs to another planned meal.',409);return decoded(old);}
 check(typeof b.recipe_id==='string'&&b.recipe_id.length>0&&b.recipe_id.length<=200,'Choose a recipe.');const recipe=visibleRecipe(db,userId,b.recipe_id);check(recipe.nutrition&&recipe.ingredient_items.length,'Choose a recipe with calculated ingredients.',409);
 const snapshot={kind:'recipe',source_id:recipe.id,title:recipe.title,recipe_version:recipe.version,unit:'servings',nutrition:recipe.nutrition,ingredient_items:recipe.ingredient_items,yield_servings:recipe.yield_servings,preparation:recipe.preparation,substitutions:recipe.substitutions,tags:recipe.tags,prep_minutes:recipe.prep_minutes};
 const id=randomUUID();db.prepare('INSERT INTO planned_meals(id,user_id,day,slot,quantity,snapshot,idempotency_key) VALUES(?,?,?,?,?,?,?)').run(id,userId,day,slot,quantity,JSON.stringify(snapshot),key);
 return {id,version:1,day,slot,quantity,snapshot};
}
export function updatePlannedMeal(db:DatabaseSync,userId:string,id:string,b:any,remove=false){
 const old=db.prepare('SELECT * FROM planned_meals WHERE id=? AND user_id=?').get(id,userId) as any;check(old,'Planned meal not found.',404);check(b.version===old.version,'This meal changed. Refresh before editing.',409);
 if(remove){db.prepare('DELETE FROM planned_meals WHERE id=? AND user_id=?').run(id,userId);return {ok:true};}
 check(!old.logged_at,'This meal is already logged. Edit its entry in your diary.',409);
 db.prepare('UPDATE planned_meals SET day=?,slot=?,quantity=?,version=version+1 WHERE id=? AND user_id=?').run(nutritionDate(b.day),mealSlot(b.slot),amount(b.quantity,'Servings',0.25,100),id,userId);return {ok:true};
}
export function logPlannedMeal(db:DatabaseSync,userId:string,id:string,b:any){return atomic(db,()=>{
 const meal=db.prepare('SELECT * FROM planned_meals WHERE id=? AND user_id=?').get(id,userId) as any;check(meal,'Planned meal not found.',404);
 const quantity=amount(b.quantity===undefined?meal.quantity:b.quantity,'Servings eaten',0.01,100);
 if(meal.logged_at){const existing=meal.diary_entry_id?db.prepare('SELECT quantity FROM food_diary WHERE id=? AND user_id=?').get(meal.diary_entry_id,userId) as any:null;if(b.quantity!==undefined&&existing)check(existing.quantity===quantity,'This meal was already logged with a different portion. Edit it in the diary.',409);check(meal.diary_entry_id,'The diary entry was removed. Log another meal from your diary if needed.',409);return {id:meal.diary_entry_id,duplicate:true};}
 check(b.version===meal.version,'This meal changed. Refresh before logging.',409);
 check(meal.day<=userToday(db,userId),'Future meals are plans. Log them after you have eaten.',409);
 const entryId=randomUUID();db.prepare('INSERT INTO food_diary(id,user_id,day,slot,quantity,snapshot,idempotency_key) VALUES(?,?,?,?,?,?,?)').run(entryId,userId,meal.day,meal.slot,quantity,meal.snapshot,'planner:'+id);
 db.prepare('UPDATE planned_meals SET diary_entry_id=?,logged_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=? AND user_id=?').run(entryId,id,userId);return {id:entryId};
});}
export function planner(db:DatabaseSync,userId:string,day:string){
 const week=weekStart(day),to=shiftDay(week,6);
 const entries=db.prepare('SELECT * FROM planned_meals WHERE user_id=? AND day BETWEEN ? AND ? ORDER BY day,CASE slot WHEN \'breakfast\' THEN 1 WHEN \'lunch\' THEN 2 WHEN \'dinner\' THEN 3 ELSE 4 END,created_at,rowid').all(userId,week,to).map(decoded);
 const ingredients=new Map<string,any>();
 for(const meal of entries.filter((e:any)=>!e.logged_at))for(const item of meal.snapshot.ingredient_items){const grams=item.grams*meal.quantity/meal.snapshot.yield_servings,old=ingredients.get(item.food_id);ingredients.set(item.food_id,{food_id:item.food_id,name:item.name,grams:(old?.grams||0)+grams});}
 const ticks=db.prepare('SELECT * FROM planner_shopping WHERE user_id=? AND week=?').all(userId,week) as any[];
 const shopping=[...ingredients.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(i=>{const tick=ticks.find(t=>t.food_id===i.food_id),grams=Math.round(i.grams*100)/100;return {...i,grams,purchased:!!tick?.purchased&&tick.quantity===grams,version:tick?.version||0};});
 return {week,to,entries,shopping,today:userToday(db,userId)};
}
export function savePlannerShopping(db:DatabaseSync,userId:string,b:any){
 const week=weekStart(b.week),data=planner(db,userId,week),item=data.shopping.find(i=>i.food_id===b.food_id);check(item,'This ingredient is no longer on your list. Refresh the planner.',409);
 check(b.version===item.version&&b.quantity===item.grams,'Your list changed. Refresh to see the updated quantities.',409);check(typeof b.purchased==='boolean','Choose whether you picked up this ingredient.');
 db.prepare('INSERT INTO planner_shopping(user_id,week,food_id,purchased,quantity) VALUES(?,?,?,?,?) ON CONFLICT(user_id,week,food_id) DO UPDATE SET purchased=excluded.purchased,quantity=excluded.quantity,version=planner_shopping.version+1').run(userId,week,b.food_id,b.purchased?1:0,item.grams);return {ok:true};
}
export function saveHabit(db:DatabaseSync,userId:string,b:any){
 const day=nutritionDate(b.day);check(day<=userToday(db,userId),'Choose today or an earlier day.');check(Object.hasOwn(habitOptions,b.habit),'Choose a habit.');check(typeof b.completed==='boolean','Choose whether to mark this habit.');
 const old=db.prepare('SELECT * FROM habit_logs WHERE user_id=? AND day=? AND habit=?').get(userId,day,b.habit) as any;check(b.version===(old?.version||0),'Your habit log changed. Refresh before saving.',409);
 db.prepare('INSERT INTO habit_logs(user_id,day,habit,completed) VALUES(?,?,?,?) ON CONFLICT(user_id,day,habit) DO UPDATE SET completed=excluded.completed,version=habit_logs.version+1').run(userId,day,b.habit,b.completed?1:0);return {ok:true};
}
export function rhythmData(db:DatabaseSync,userId:string,day:string){
 const week=weekStart(day),to=shiftDay(week,6),row=db.prepare('SELECT profile FROM users WHERE id=?').get(userId) as any;
 const profile=JSON.parse(row.profile),keys=profile.habit_keys||['move','colour','wind_down'];
 const logs=db.prepare('SELECT * FROM habit_logs WHERE user_id=? AND day BETWEEN ? AND ? ORDER BY day,habit').all(userId,week,to) as any[];
 const metrics=db.prepare('SELECT metric,value,day FROM fitness_metrics WHERE user_id=? AND day BETWEEN ? AND ?').all(userId,week,to) as any[];
 const workouts=db.prepare("SELECT COUNT(*) n FROM plan_activity WHERE user_id=? AND activity_date BETWEEN ? AND ? AND item_kind='workout'").get(userId,week,to) as any;
 const diaryDays=db.prepare('SELECT COUNT(DISTINCT day) n FROM food_diary WHERE user_id=? AND day BETWEEN ? AND ?').get(userId,week,to) as any;
 const avg=(metric:string)=>{const list=metrics.filter(m=>m.metric===metric);return list.length?Math.round(list.reduce((n,m)=>n+m.value,0)/list.length*10)/10:null;};
 return {week,to,day,today:userToday(db,userId),keys,options:habitOptions,logs,summary:{workouts:workouts.n,diary_days:diaryDays.n,habit_moments:logs.filter(l=>l.completed).length,energy:avg('energy'),sleep:avg('sleep_hours'),energy_days:metrics.filter(m=>m.metric==='energy').length,sleep_days:metrics.filter(m=>m.metric==='sleep_hours').length}};
}
export function recentMeals(db:DatabaseSync,userId:string){
 const rows=db.prepare('SELECT * FROM food_diary WHERE user_id=? ORDER BY day DESC,created_at DESC,rowid DESC LIMIT 200').all(userId) as any[],seen=new Set<string>();
 return rows.filter(r=>{const snapshot=JSON.parse(r.snapshot),key=`${snapshot.kind}:${snapshot.source_id}:${snapshot.recipe_version||0}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8).map(decoded);
}
export function repeatMeal(db:DatabaseSync,userId:string,b:any){
 const row=db.prepare('SELECT * FROM food_diary WHERE id=? AND user_id=?').get(b.source_entry_id,userId) as any;check(row,'Previous meal not found.',404);
 const day=nutritionDate(b.day),slot=mealSlot(b.slot),snapshot=JSON.parse(row.snapshot),quantity=amount(b.quantity,'Quantity',0.01,snapshot.kind==='recipe'?100:10000),key=submissionKey(b.idempotency_key);
 const old=db.prepare('SELECT * FROM food_diary WHERE user_id=? AND idempotency_key=?').get(userId,key) as any;
 if(old){check(old.day===day&&old.slot===slot&&old.quantity===quantity&&old.snapshot===row.snapshot,'That submission key belongs to another diary entry.',409);return {id:old.id,duplicate:true};}
 const id=randomUUID();db.prepare('INSERT INTO food_diary(id,user_id,day,slot,quantity,snapshot,idempotency_key) VALUES(?,?,?,?,?,?,?)').run(id,userId,day,slot,quantity,row.snapshot,key);return {id};
}
export function rhythmExport(db:DatabaseSync,userId:string){return {planned_meals:db.prepare('SELECT * FROM planned_meals WHERE user_id=? ORDER BY day').all(userId).map(decoded),habits:db.prepare('SELECT * FROM habit_logs WHERE user_id=? ORDER BY day,habit').all(userId),shopping:db.prepare('SELECT * FROM planner_shopping WHERE user_id=? ORDER BY week,food_id').all(userId)};}
