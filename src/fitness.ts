import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { LibraryError } from './plan-library.ts';
import { nutritionDate } from './nutrition.ts';

function check(ok:any,message:string,status=400):asserts ok{if(!ok)throw new LibraryError(message,status);}
function text(v:any,name:string,max=3000){check(typeof v==='string'&&v.length<=max,`${name} must be text up to ${max} characters.`);return v.trim();}
function number(v:any,name:string,min:number,max:number){check(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,`${name} must be between ${min} and ${max}.`);return v;}
export const fitnessGoals={
 wellbeing:{title:'Feel good & move more',metrics:['energy','sleep_hours','steps','cardio_minutes'],copy:'Choose the habits and activities you enjoy. Energy, movement and how your week feels are useful things to notice.'},
 lose_weight:{title:'Lose weight steadily',metrics:['weight','waist','energy','strength_load'],copy:'Look at weight trends alongside energy, movement and strength. A single weigh-in does not tell the whole story. Agree a manageable approach with Alex.'},
 cut:{title:'Cut / reduce body fat',metrics:['waist','weight','strength_load','energy'],copy:'Review waist and weight trends alongside strength and how you feel. Changes in scale weight alone cannot tell you how much fat or muscle changed.'},
 maintain:{title:'Maintain & feel strong',metrics:['weight','strength_load','energy','steps'],copy:'Maintenance can mean a comfortable weight range and routines you enjoy. A stable trend can be progress too. Agree any range with Alex.'},
 bulk:{title:'Bulk / gain size',metrics:['strength_load','weight','arm','chest','energy'],copy:'Put progressive training and regular meals first. Review strength, measurements and weight together with Alex; weight gain does not prove muscle gain.'},
 build_muscle:{title:'Build muscle',metrics:['strength_load','strength_reps','arm','chest','energy'],copy:'Follow the loads and reps you can manage with the same exercise and technique. Measurements are optional, and strength improvements alone do not prove muscle growth.'},
 strength:{title:'Get stronger',metrics:['strength_load','strength_reps','energy','sleep_hours'],copy:'Compare the same exercise at the same reps and technique. Gradual training progress and recovery give you more useful context than scale weight.'},
 endurance:{title:'Build stamina',metrics:['distance','cardio_minutes','energy','sleep_hours'],copy:'Track distance and session duration alongside how it felt. More minutes is a record of activity, not an automatic measure of fitness.'}
} as const;
export const metricDefinitions={
 weight:{label:'Body weight',unit:'kg',units:['kg','lb'],min:20,max:500},
 waist:{label:'Waist',unit:'cm',units:['cm','in'],min:10,max:300},
 hips:{label:'Hips',unit:'cm',units:['cm','in'],min:10,max:300},
 chest:{label:'Chest',unit:'cm',units:['cm','in'],min:10,max:300},
 arm:{label:'Upper arm',unit:'cm',units:['cm','in'],min:5,max:150},
 body_fat:{label:'Body fat (self-reported estimate)',unit:'%',units:['%'],min:1,max:75},
 strength_load:{label:'Exercise load',unit:'kg',units:['kg','lb'],min:0,max:1000},
 strength_reps:{label:'Bodyweight exercise reps',unit:'reps',units:['reps'],min:1,max:1000},
 distance:{label:'Session distance',unit:'km',units:['km','mi'],min:0,max:1000},
 cardio_minutes:{label:'Session duration',unit:'min',units:['min'],min:0,max:1440},
 steps:{label:'Daily steps',unit:'steps',units:['steps'],min:0,max:100000},
 sleep_hours:{label:'Sleep',unit:'hours',units:['hours'],min:0,max:24},
 energy:{label:'How your energy feels',unit:'/5',units:['/5'],min:1,max:5}
} as const;
export function profileInput(b:any,current:any) {
 const p={...current};
 for(const [key,max] of Object.entries({goals:3000,preferences:3000,dietary:3000,goal_notes:3000,experience:1000,equipment:2000,availability:1000,favourite_foods:1000}))if(b[key]!==undefined)p[key]=text(b[key],key.replaceAll('_',' '),max);
 if(b.fitness_goal!==undefined){check(Object.hasOwn(fitnessGoals,b.fitness_goal),'Choose a valid fitness goal.');p.fitness_goal=b.fitness_goal;}
 if(b.units!==undefined){check(['metric','imperial'].includes(b.units),'Choose metric or imperial units.');p.units=b.units;}
 if(b.avatar!==undefined){check(['fire','leaf','barbell','chef'].includes(b.avatar),'Choose a profile illustration.');p.avatar=b.avatar;}
 if(b.timezone!==undefined){const timezone=text(b.timezone,'Time zone',80);try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{throw new LibraryError('Choose a valid time zone, such as Europe/London.');}p.timezone=timezone;}
 if(b.hide_weight!==undefined){check(typeof b.hide_weight==='boolean','Choose whether to show weight charts.');p.hide_weight=b.hide_weight;}
 for(const [key,min,max] of [['height_cm',50,260],['target_weight_kg',20,500],['maintenance_min_kg',20,500],['maintenance_max_kg',20,500]] as const)if(b[key]!==undefined)p[key]=b[key]===null?null:number(b[key],key.replaceAll('_',' '),min,max);
 if(p.maintenance_min_kg!=null&&p.maintenance_max_kg!=null)check(p.maintenance_min_kg<=p.maintenance_max_kg,'The lower maintenance weight must not exceed the upper weight.');
 return p;
}
export function recordGoalChange(db:DatabaseSync,userId:string,before:any,after:any){const keys=['fitness_goal','target_weight_kg','maintenance_min_kg','maintenance_max_kg','goal_notes'];if(keys.every(k=>before[k]===after[k]))return;db.prepare('INSERT INTO fitness_goal_history(id,user_id,goal,snapshot) VALUES(?,?,?,?)').run(randomUUID(),userId,after.fitness_goal||'wellbeing',JSON.stringify(Object.fromEntries(keys.map(k=>[k,after[k]??null]))));}
export function metricInput(b:any){check(Object.hasOwn(metricDefinitions,b.metric),'Choose a metric.');const def=metricDefinitions[b.metric as keyof typeof metricDefinitions];check((def.units as readonly string[]).includes(b.unit),'Choose a supported unit for this metric.');let value=number(b.value,'Measurement',0,1000000);if(b.unit==='lb')value*=0.45359237;if(b.unit==='in')value*=2.54;if(b.unit==='mi')value*=1.609344;number(value,def.label,def.min,def.max);
 const context=text(b.context??'','Exercise / activity',100).toLowerCase().replace(/\s+/g,' '),notes=text(b.notes??'','Notes',2000),strength=b.metric.startsWith('strength');check(!strength||context.length>0,'Name the exercise so like-for-like results can be compared.');const reps=b.metric==='strength_load'?number(b.reps,'Reps',1,100):0;check(Number.isInteger(reps),'Reps must be a whole number.');if(['steps','strength_reps','energy'].includes(b.metric))check(Number.isInteger(value),'Use a whole number for this metric.');return {day:nutritionDate(b.day),metric:b.metric,value:Math.round(value*10000)/10000,context:strength||b.metric==='distance'||b.metric==='cardio_minutes'?context:'',reps,notes};
}
export function saveMetric(db:DatabaseSync,userId:string,b:any){const input=metricInput(b),key=text(b.idempotency_key,'Submission key',100);check(key,'A submission key is required.');const old=db.prepare('SELECT * FROM fitness_metrics WHERE user_id=? AND idempotency_key=?').get(userId,key) as any;if(old){check(Object.entries(input).every(([k,v])=>old[k]===v),'That submission key already belongs to another measurement.',409);return {...old,duplicate:true};}check(!db.prepare('SELECT id FROM fitness_metrics WHERE user_id=? AND day=? AND metric=? AND context=? AND reps=?').get(userId,input.day,input.metric,input.context,input.reps),'A measurement for this date and exercise already exists. Edit that entry instead.',409);const user=db.prepare('SELECT profile FROM users WHERE id=?').get(userId) as any,goal=JSON.parse(user.profile).fitness_goal||'wellbeing',eid=randomUUID();db.prepare('INSERT INTO fitness_metrics(id,user_id,day,metric,value,context,reps,notes,goal,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?)').run(eid,userId,input.day,input.metric,input.value,input.context,input.reps,input.notes,goal,key);return {id:eid,...input,goal,version:1};}
export function updateMetric(db:DatabaseSync,userId:string,eid:string,b:any,remove=false){const old=db.prepare('SELECT * FROM fitness_metrics WHERE id=? AND user_id=?').get(eid,userId) as any;check(old,'Measurement not found.',404);check(old.version===b.version,'This measurement changed. Refresh before saving.',409);if(remove){db.prepare('DELETE FROM fitness_metrics WHERE id=? AND user_id=?').run(eid,userId);return {ok:true};}const i=metricInput(b);check(!db.prepare('SELECT id FROM fitness_metrics WHERE user_id=? AND day=? AND metric=? AND context=? AND reps=? AND id<>?').get(userId,i.day,i.metric,i.context,i.reps,eid),'An entry already exists for this date and exercise.',409);db.prepare('UPDATE fitness_metrics SET day=?,metric=?,value=?,context=?,reps=?,notes=?,version=version+1 WHERE id=? AND user_id=?').run(i.day,i.metric,i.value,i.context,i.reps,i.notes,eid,userId);return {ok:true};}
export function fitnessData(db:DatabaseSync,userId:string){const user=db.prepare('SELECT profile,profile_version,name FROM users WHERE id=?').get(userId) as any;check(user,'Client not found.',404);return {name:user.name,profile:JSON.parse(user.profile),profile_version:user.profile_version,entries:db.prepare('SELECT * FROM fitness_metrics WHERE user_id=? ORDER BY day,created_at,id').all(userId),goals:db.prepare('SELECT * FROM fitness_goal_history WHERE user_id=? ORDER BY created_at,rowid').all(userId).map((r:any)=>({...r,snapshot:JSON.parse(r.snapshot)})),definitions:metricDefinitions,goal_options:fitnessGoals};}
