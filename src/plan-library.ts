import type { DatabaseSync } from 'node:sqlite';
import { exerciseAnimationKeys } from './exercise-catalog.ts';

export class LibraryError extends Error { status: number; constructor(message:string,status=400) {super(message);this.status=status;} }
function requireValue(ok:any,message:string,status=400):asserts ok {if(!ok)throw new LibraryError(message,status);}
function string(v:any,name:string,max=4000,optional=false) {requireValue(typeof v==='string',`${name} must be text.`);const s=v.trim();requireValue((optional||s.length>0)&&s.length<=max,`${name} ${optional?'':'is required and '}must be at most ${max} characters.`);return s;}
function whole(v:any,name:string,min:number,max:number) {requireValue(Number.isSafeInteger(v)&&v>=min&&v<=max,`${name} must be a whole number from ${min} to ${max}.`);return v;}
function list(v:any,name:string,max:number){requireValue(Array.isArray(v)&&v.length<=max,`${name} must contain at most ${max} items.`);return v;}
function object(v:any,name:string){requireValue(v&&typeof v==='object'&&!Array.isArray(v),`${name} must be an object.`);return v;}
export const animations: readonly string[]=['',...exerciseAnimationKeys];
export function videoURL(value:any) {
  const v=string(value??'','Video URL',2000,true);if(!v)return '';
  let url:URL;try{url=new URL(v);}catch{throw new LibraryError('Enter a complete https:// video URL.');}
  const host=url.hostname.toLowerCase();
  requireValue(url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&host.includes('.')&&!host.endsWith('.')&&!host.includes(':')&&!/^\d+\./.test(host)&&!/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host),'Use a public HTTPS video URL without a login or custom port.');
  return url.href;
}
export function exerciseInput(b:any) {
  const animation=string(b.animation??'','Animation',40,true);requireValue(animations.includes(animation),'Choose one of the available motion examples.');
  return {title:string(b.title,'Exercise name',200),category:string(b.category,'Category',100),equipment:string(b.equipment??'','Equipment',1000,true),instructions:string(b.instructions,'Instructions',10000),video_url:videoURL(b.video_url),video_caption:string(b.video_caption??'','Video notes / text alternative',4000,true),animation,is_demo:b.is_demo?1:0,archived:b.archived?1:0};
}
export function planContent(db:DatabaseSync,kind:string,input:any) {
  const c=object(input,'Plan content');
  const workouts=list(c.workouts??[],'Workout sessions',14),meals=list(c.meals??[],'Scheduled meals',70),recipes=list(c.recipe_ids??[],'Recipes',50);
  requireValue(kind==='training'||workouts.length===0,'Workouts belong in a training plan.');
  requireValue(kind==='meal'||meals.length===0,'Scheduled meals belong in a meal plan.');
  function exists(table:string,recordId:any,name:string) {const rid=string(recordId,name,100);requireValue(db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(rid),`${name} is unavailable.`);return rid;}
  return {
    schedule:string(c.schedule,'Weekly structure',10000),guidance:string(c.guidance,'Plan guidance',20000),shopping_list:string(c.shopping_list??'','Shopping list',10000,true),
    recipe_ids:[...new Set(recipes.map(rid=>exists('recipes',rid,'Recipe')))],
    workouts:workouts.map((raw:any)=>{const w=object(raw,'Workout');const items=list(w.exercises,'Workout exercises',30);requireValue(items.length>0,'Add at least one exercise to each workout.');return {
      name:string(w.name,'Workout name',200),day:string(w.day,'Workout day',100),exercises:items.map((raw:any)=>{const e=object(raw,'Exercise prescription');return {
        exercise_id:exists('exercises',e.exercise_id,'Exercise'),sets:whole(e.sets,'Sets',1,50),reps:string(e.reps,'Reps or duration',100),rest_seconds:whole(e.rest_seconds,'Rest in seconds',0,1800),notes:string(e.notes??'','Exercise notes',2000,true)
      };})
    };}),
    meals:meals.map((raw:any)=>{const m=object(raw,'Scheduled meal');return {day:string(m.day,'Meal day',100),slot:string(m.slot,'Meal name / time',100),recipe_id:exists('recipes',m.recipe_id,'Recipe'),servings:string(m.servings,'Serving notes',300),notes:string(m.notes??'','Meal notes',2000,true)};})
  };
}
// Resolve exactly once at publish time. Clients never read mutable library records.
export function planSnapshot(db:DatabaseSync,template:any,customisation:string) {
  const c=JSON.parse(template.content);let isDemo=!!template.is_demo;
  function exercise(rid:string) {const e=db.prepare('SELECT * FROM exercises WHERE id=? AND archived=0').get(rid) as any;requireValue(e,'An exercise is archived or missing. Edit the template before publishing.',409);isDemo ||= !!e.is_demo;return {id:e.id,title:e.title,category:e.category,equipment:e.equipment,instructions:e.instructions,video_url:e.video_url,video_caption:e.video_caption,animation:e.animation,is_demo:!!e.is_demo,version:e.version};}
  function recipe(rid:string) {const r=db.prepare('SELECT * FROM recipes WHERE id=? AND archived=0').get(rid) as any;requireValue(r,'A recipe is archived or missing. Edit the template before publishing.',409);isDemo ||= !!r.is_demo;return {id:r.id,title:r.title,ingredients:r.ingredients,portions:r.portions,preparation:r.preparation,substitutions:r.substitutions,is_demo:!!r.is_demo,version:r.version};}
  const workouts=(c.workouts||[]).map((w:any)=>({...w,exercises:w.exercises.map((e:any)=>({...e,exercise:exercise(e.exercise_id)}))}));
  const recipeIds=[...new Set<string>([...(c.recipe_ids||[]),...(c.meals||[]).map((m:any)=>m.recipe_id)])];
  const recipes=recipeIds.map(recipe);
  return {...c,recipe_ids:undefined,workouts,recipes,meals:(c.meals||[]).map((m:any)=>({...m,recipe:recipes.find(r=>r.id===m.recipe_id)})),customisation,is_demo:isDemo};
}
