import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createContext, runInContext } from 'node:vm';
import { createApp } from '../src/server.ts';
import { openDb, id } from '../src/db.ts';
import { digest } from '../src/auth.ts';
import { videoURL } from '../src/plan-library.ts';

test('Existing database migrates without replacing client records or repeating starter content',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-migration-'));
  try {
    const old=new DatabaseSync(join(dir,'form-fire.sqlite'));
    old.exec(readFileSync(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
    old.exec('CREATE TABLE migrations(version INTEGER PRIMARY KEY); INSERT INTO migrations VALUES(1);');
    old.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').run('existing','existing@example.test','Existing client','unused');
    old.prepare('INSERT INTO templates(id,title,kind,content) VALUES(?,?,?,?)').run('old-plan','Existing plan','training',JSON.stringify({schedule:'Original',guidance:'Original',recipe_ids:[]}));
    old.close();
    const db=openDb(dir);
    assert.equal((db.prepare('SELECT name FROM users WHERE id=?').get('existing') as any).name,'Existing client');
    assert.equal((db.prepare('SELECT content FROM templates WHERE id=?').get('old-plan') as any).content,JSON.stringify({schedule:'Original',guidance:'Original',recipe_ids:[]}));
    assert.equal((db.prepare('SELECT COUNT(*) n FROM exercises WHERE is_demo=1').get() as any).n,4);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM recipes WHERE is_demo=1').get() as any).n,3);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM templates WHERE is_demo=1').get() as any).n,2);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM assignments').get() as any).n,0);
    db.prepare('UPDATE exercises SET title=?,archived=1 WHERE id=?').run('Alex edited this','starter-squat');db.close();
    const again=openDb(dir);
    assert.equal((again.prepare('SELECT title FROM exercises WHERE id=?').get('starter-squat') as any).title,'Alex edited this');
    assert.equal((again.prepare('SELECT COUNT(*) n FROM exercises').get() as any).n,4);
    assert.equal((again.prepare('SELECT COUNT(*) n FROM migrations').get() as any).n,4);again.close();
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('Video URLs allow HTTPS links and reject executable, embedded or local destinations',()=>{
  assert.equal(videoURL('https://www.youtube.com/watch?v=example'),'https://www.youtube.com/watch?v=example');
  assert.equal(videoURL('https://videos.example.org/demo.mp4'),'https://videos.example.org/demo.mp4');
  assert.equal(videoURL(''),'');
  for(const url of ['javascript:alert(1)','data:text/html,bad','http://example.org/x','file:///tmp/video','https://user:secret@example.org/x','https://127.0.0.1/x','https://2130706433/x','https://[::1]/x','https://server.local/x','https://localhost/x','https://example.org:8443/x','<iframe src="https://example.org">'])assert.throws(()=>videoURL(url),undefined,url);
});

test('Structured workout and meal journeys retain snapshots and enforce admin/owner access',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-library-')),app=createApp({dataDir:dir,origin:'http://127.0.0.1:8085'});
  await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));
  const port=(app.server.address() as any).port;
  // Fixture identities, not a production sign-in shortcut. Every request still passes server role/CSRF checks.
  const uid=id(),aid=id(),other=id(),rid=id();
  for(const [key,role] of [[uid,'client'],[aid,'admin'],[other,'client']]) {
    app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(key,key+'@example.test',role,'unused',role);
    app.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(key),key,'csrf',Date.now()+3600000);
  }
  app.db.prepare("INSERT INTO requests(id,user_id,service_id,kind,details,status,active,idempotency_key) VALUES(?,?,'both','coaching','{}','approved',1,?)").run(rid,uid,id());
  async function call(who:string,path:string,method='GET',body?:any){return new Promise<any>((done,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:'http://127.0.0.1:8085','Content-Type':'application/json','X-CSRF-Token':'csrf',Cookie:'ff_session='+who}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>done({status:res.statusCode,data:JSON.parse(text)}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });}
  let eid='',tid='',assignment='',first:any,mealAssignment='',firstMeal:any;
  const ex={title:'Test exercise',category:'Test category',equipment:'Test equipment',instructions:'Original cues',video_url:'https://www.youtube.com/watch?v=example',video_caption:'Original video summary',animation:'squat',is_demo:false,archived:false};
  const content={schedule:'Two sessions',guidance:'Original overall guidance',shopping_list:'',recipe_ids:[],workouts:[],meals:[]} as any;
  try {
    await t.test('Clients cannot create, edit or list admin library data',async()=>{
      assert.equal((await call(uid,'/admin/exercises','POST',ex)).status,403);
      assert.equal((await call(uid,'/admin/exercises/starter-squat','PUT',{...ex,version:1})).status,403);
      assert.equal((await call(uid,'/admin/recipes/starter-oats','PUT',{})).status,403);
      assert.equal((await call(other,'/admin/dashboard')).status,403);
      assert.equal((await call('', '/admin/dashboard')).status,401);
      const d=(await call(uid,'/dashboard')).data;assert.equal(d.assignments.length,0);assert.equal(d.exercises,undefined);
    });
    await t.test('Exercise cues, video and prescriptions publish in the exact workout order',async()=>{
      const result=await call(aid,'/admin/exercises','POST',ex);assert.equal(result.status,200);eid=result.data.id;
      content.workouts=[{name:'Session B',day:'Thursday',exercises:[{exercise_id:eid,sets:3,reps:'30 seconds',rest_seconds:45,notes:'Individual note'}]},{name:'Session A',day:'Monday',exercises:[{exercise_id:eid,sets:2,reps:'8',rest_seconds:60,notes:''}]}];
      const plan=await call(aid,'/admin/templates','POST',{title:'Configured training',kind:'training',content});assert.equal(plan.status,200);tid=plan.data.id;
      const published=await call(aid,'/admin/assignments','POST',{request_id:rid,template_id:tid,customisation:'For this client'});assert.equal(published.status,201);assignment=published.data.id;
      first=(await call(uid,'/assignments/'+assignment)).data;
      assert.deepEqual(first.snapshot.workouts.map((w:any)=>w.name),['Session B','Session A']);
      const e=first.snapshot.workouts[0].exercises[0];assert.equal(e.sets,3);assert.equal(e.reps,'30 seconds');assert.equal(e.rest_seconds,45);assert.equal(e.exercise.video_url,ex.video_url);assert.equal(e.exercise.instructions,'Original cues');
      assert.equal((await call(other,'/assignments/'+assignment)).status,404);
      assert.equal((await call('', '/assignments/'+assignment)).status,401);
    });
    await t.test('Exercise and template edits leave existing client media and prescriptions unchanged',async()=>{
      assert.equal((await call(aid,'/admin/exercises/'+eid,'PUT',{...ex,version:1,instructions:'Changed cues',video_url:'https://vimeo.com/123456'})).status,200);
      assert.equal((await call(aid,'/admin/exercises/'+eid,'PUT',{...ex,version:1})).status,409);
      content.workouts[0].exercises[0].sets=4;
      assert.equal((await call(aid,'/admin/templates/'+tid,'PUT',{title:'Changed training',kind:'training',content,version:1})).status,200);
      assert.deepEqual((await call(uid,'/assignments/'+assignment)).data,first);
      const pub=await call(aid,'/admin/assignments','POST',{request_id:rid,template_id:tid});const newer=(await call(uid,'/assignments/'+pub.data.id)).data;
      assert.equal(newer.version,2);assert.equal(newer.snapshot.workouts[0].exercises[0].sets,4);assert.equal(newer.snapshot.workouts[0].exercises[0].exercise.instructions,'Changed cues');
      assert.equal(newer.snapshot.workouts[0].exercises[0].exercise.video_url,'https://vimeo.com/123456');
    });
    await t.test('Validation rejects bad prescriptions and unavailable records without writing templates',async()=>{
      const template=(c:any)=>call(aid,'/admin/templates','POST',{title:'Bad plan',kind:'training',content:c});
      for(const patch of [{sets:0},{sets:1.5},{rest_seconds:-1},{rest_seconds:9999},{reps:''},{exercise_id:'missing'}]) {
        const c=structuredClone(content);Object.assign(c.workouts[0].exercises[0],patch);assert.equal((await template(c)).status,400);
      }
      assert.equal((await template({...content,workouts:[{day:'Monday',name:'Empty',exercises:[]}]})).status,400);
      assert.equal((await call(aid,'/admin/exercises','POST',{...ex,video_url:'javascript:alert(1)'})).status,400);
      assert.equal((await call(aid,'/admin/exercises','POST',{...ex,animation:'untrusted-svg'})).status,400);
      assert.equal((await call(aid,'/admin/templates','POST',{title:'Mixed plan',kind:'meal',content})).status,400);
    });
    await t.test('Meal schedule snapshots contain recipes, serving notes and shopping lists',async()=>{
      const published=await call(aid,'/admin/assignments','POST',{request_id:rid,template_id:'starter-meals'});assert.equal(published.status,201);mealAssignment=published.data.id;
      firstMeal=(await call(uid,'/assignments/'+mealAssignment)).data;assert.equal(firstMeal.snapshot.meals.length,3);assert.equal(firstMeal.snapshot.recipes.length,3);
      assert.equal(firstMeal.snapshot.meals[0].recipe.title,'Berry overnight oats');assert.equal(firstMeal.snapshot.meals[0].servings,'1 example serving');assert.equal(firstMeal.snapshot.is_demo,true);assert.ok(firstMeal.snapshot.shopping_list.includes('Chickpeas'));
      const recipe=(await call(aid,'/admin/dashboard')).data.recipes.find((r:any)=>r.id==='starter-oats');
      assert.equal((await call(aid,'/admin/recipes/starter-oats','PUT',{...recipe,ingredients:'New ingredients'})).status,200);
      assert.equal((await call(aid,'/admin/recipes/starter-oats','PUT',recipe)).status,409);
      assert.deepEqual((await call(uid,'/assignments/'+mealAssignment)).data,firstMeal);
      const again=await call(aid,'/admin/assignments','POST',{request_id:rid,template_id:'starter-meals'});assert.equal((await call(uid,'/assignments/'+again.data.id)).data.snapshot.meals[0].recipe.ingredients,'New ingredients');
    });
    await t.test('Archiving blocks new publication while assigned copies and exports remain intact',async()=>{
      await call(aid,'/admin/exercises/'+eid,'PUT',{...ex,version:2,archived:true});
      assert.equal((await call(aid,'/admin/assignments','POST',{request_id:rid,template_id:tid})).status,409);
      const r=(await call(aid,'/admin/dashboard')).data.recipes.find((r:any)=>r.id==='starter-oats');await call(aid,'/admin/recipes/starter-oats','PUT',{...r,archived:true});
      assert.equal((await call(aid,'/admin/assignments','POST',{request_id:rid,template_id:'starter-meals'})).status,409);
      assert.deepEqual((await call(uid,'/assignments/'+assignment)).data,first);
      assert.deepEqual((await call(uid,'/assignments/'+mealAssignment)).data,firstMeal);
      const exported=(await call(uid,'/export')).data.assignments.find((a:any)=>a.id===assignment);assert.deepEqual(exported.snapshot,first.snapshot);
      assert.equal((await call(other,'/export')).data.assignments.length,0);
    });
  } finally {await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Client plan markup escapes text and video URLs, does not load external media, and supports old plans',()=>{
  const context=createContext({document:{addEventListener(){}},esc:(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string))});
  runInContext(readFileSync(new URL('../public/plan-studio.js',import.meta.url),'utf8'),context);
  const media=runInContext(`exerciseMedia({title:'<img src=x onerror=alert(1)>',animation:'squat',video_url:'https://videos.example.org/watch?q=" onclick="bad',video_caption:'<script>bad</script>'})`,context);
  assert.ok(media.includes('&lt;img'));assert.ok(media.includes('&quot;'));assert.ok(media.includes('rel="noopener noreferrer"'));assert.ok(media.includes('aria-pressed="false"'));
  assert.ok(!/<iframe|<video|<script|<img/.test(media));assert.ok(!media.includes('class="motion-demo playing"'));
  const legacy=runInContext(`publishedPlanView({schedule:'Old schedule',guidance:'Old guidance',recipes:[{title:'Old recipe',ingredients:'Beans',portions:'One',preparation:'Cook',substitutions:''}]})`,context);
  assert.ok(legacy.includes('Old schedule'));assert.ok(legacy.includes('Old recipe'));
});

test('Admin studio renders all library views using the shared app helpers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-studio-')),db=openDb(dir);
  try {
    const fixtureData={exercises:db.prepare('SELECT * FROM exercises').all(),recipes:db.prepare('SELECT * FROM recipes').all(),templates:db.prepare('SELECT * FROM templates').all().map((t:any)=>({...t,content:JSON.parse(t.content)})),assignments:[],requests:[]};
    const context=createContext({fixtureData,document:{addEventListener(){}},window:{addEventListener(){}},location:{hash:'#/admin/plans'},URLSearchParams,crypto:{randomUUID:id}});
    runInContext(readFileSync(new URL('../public/plan-studio.js',import.meta.url),'utf8'),context);
    runInContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),context);
    runInContext('adminData=fixtureData',context);
    for(const view of ['templates','exercises','recipes','publish']) {
      (context.location as any).hash='#/admin/plans?view='+view;
      const html=runInContext('planStudioPage(adminData)',context);
      assert.ok(html.includes('data-form='));assert.ok(html.includes('aria-label="Plan studio views"'));
    }
    const training=runInContext("templateForm(adminData.templates.find(t=>t.kind==='training'))",context);
    const meal=runInContext("templateForm(adminData.templates.find(t=>t.kind==='meal'))",context);
    assert.ok(training.includes('Full body A'));assert.ok(training.includes('Supported dumbbell row'));
    assert.ok(meal.includes('Berry overnight oats'));assert.ok(meal.includes('1 example serving'));
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});
