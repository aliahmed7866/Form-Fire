import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../src/server.ts';
import { openDb, id } from '../src/db.ts';
import { digest } from '../src/auth.ts';
import { animations, exerciseInput } from '../src/plan-library.ts';
import { installStarterContent } from '../src/starter-content.ts';
import { additionalStarterExercises, exerciseAnimationKeys, expandedStarterExercises } from '../src/exercise-catalog.ts';

test('All 40 exercise motions pass API and database validation; unrecognised keys fail both',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-motion-keys-')),db=openDb(dir);
  try {
    assert.equal(exerciseAnimationKeys.length,40);
    assert.equal(new Set(exerciseAnimationKeys).size,40);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM exercises WHERE is_demo=1').get() as any).n,40);
    assert.deepEqual(new Set(db.prepare('SELECT animation FROM exercises').all().map((e:any)=>e.animation)),new Set(exerciseAnimationKeys));
    assert.equal((db.prepare('SELECT COUNT(*) n FROM assignments').get() as any).n,0);
    const insert=db.prepare('INSERT INTO exercises(id,title,category,instructions,animation) VALUES(?,?,?,?,?)');
    for (const animation of animations) {
      assert.equal(exerciseInput({title:'Example',category:'Example',instructions:'Example cues',animation}).animation,animation);
      insert.run('key-'+animation,'Validation example','Example','Example cues',animation);
    }
    for (const animation of ['unknown','__proto__','constructor','<svg onload=alert(1)>','push-up;DROP TABLE exercises']) {
      assert.throws(()=>exerciseInput({title:'Example',category:'Example',instructions:'Example cues',animation}),/Choose one of the available motion examples/);
      assert.throws(()=>insert.run('bad-'+animation,'Example','Example','Example',animation),/CHECK constraint failed/);
    }
    assert.equal(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys,1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Upgrading a v4 library and rerunning seeds preserve edits, flags, versions and removals',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-motion-upgrade-'));
  let db:DatabaseSync|undefined;
  try {
    const previous=new DatabaseSync(join(dir,'form-fire.sqlite'));
    previous.exec('CREATE TABLE migrations(version INTEGER PRIMARY KEY)');
    for (const [version,file] of [[1,'001_initial.sql'],[2,'002_plan_library.sql'],[3,'003_plan_activity.sql'],[4,'004_google_auth.sql']] as const) {
      previous.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
      previous.prepare('INSERT INTO migrations VALUES(?)').run(version);
    }
    previous.prepare('INSERT INTO content_packs(id) VALUES(?)').run('plan-library-v1');
    for (const [eid,animation] of [['starter-squat','squat'],['starter-push','wall-push'],['starter-hinge','hinge'],['starter-row','row'],['starter-push-up','wall-push']]) {
      previous.prepare('INSERT INTO exercises(id,title,category,equipment,instructions,animation,is_demo,archived,version,updated_at) VALUES(?,?,?,?,?,?,0,1,7,?)').run(eid,'Alex edited '+eid,'Custom category','Custom equipment','Cues approved by Alex',animation,'2025-02-03 04:05:06');
    }
    const before=previous.prepare('SELECT * FROM exercises ORDER BY id').all();
    const previousSnapshot=JSON.stringify({schedule:'Original schedule',guidance:'Original guidance',workouts:[{name:'Original session',day:'Monday',exercises:[{exercise_id:'starter-squat',sets:2,reps:'8',exercise:{title:'Previously published name',animation:'squat',instructions:'Previously published cues',is_demo:true,version:1}}]}],is_demo:true});
    previous.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').run('original-client','original@example.test','Original client','unused');
    previous.prepare('INSERT INTO google_identities(subject,user_id) VALUES(?,?)').run('existing-google-subject','original-client');
    previous.prepare('INSERT INTO services(id,title,kind,description,inclusions) VALUES(?,?,?,?,?)').run('original-service','Original service','train','Original','Original');
    previous.prepare('INSERT INTO requests(id,user_id,service_id,kind,details,idempotency_key) VALUES(?,?,?,?,?,?)').run('original-request','original-client','original-service','coaching','{}','original-key');
    previous.prepare('INSERT INTO templates(id,title,kind,content) VALUES(?,?,?,?)').run('original-template','Original template','training','{}');
    previous.prepare('INSERT INTO assignments(id,user_id,request_id,template_id,template_version,version,title,kind,snapshot) VALUES(?,?,?,?,1,1,?,?,?)').run('original-assignment','original-client','original-request','original-template','Original plan','training',previousSnapshot);
    previous.close();
    db=openDb(dir);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM exercises').get() as any).n,40);
    for(const row of before as any[]) assert.deepEqual(db.prepare('SELECT * FROM exercises WHERE id=?').get(row.id),row);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM exercises WHERE is_demo=1').get() as any).n,35);
    assert.equal((db.prepare('SELECT COUNT(*) n FROM migrations').get() as any).n,6);
    assert.equal(db.prepare('SELECT user_id FROM google_identities WHERE subject=?').get('existing-google-subject')?.user_id,'original-client');
    assert.equal((db.prepare('SELECT COUNT(*) n FROM assignments').get() as any).n,1);
    assert.equal(db.prepare('SELECT snapshot FROM assignments WHERE id=?').get('original-assignment')?.snapshot,previousSnapshot);
    db.prepare('UPDATE exercises SET title=?,is_demo=0,archived=1,version=9 WHERE id=?').run('Alex tailored the floor press','starter-floor-press');
    db.prepare('DELETE FROM exercises WHERE id=?').run('starter-dead-bug');
    const afterEdit=db.prepare('SELECT * FROM exercises ORDER BY id').all();
    installStarterContent(db);
    assert.deepEqual(db.prepare('SELECT * FROM exercises ORDER BY id').all(),afterEdit);
    db.close();db=openDb(dir);
    assert.deepEqual(db.prepare('SELECT * FROM exercises ORDER BY id').all(),afterEdit);
    assert.equal(db.prepare('SELECT snapshot FROM assignments WHERE id=?').get('original-assignment')?.snapshot,previousSnapshot);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db?.close();rmSync(dir,{recursive:true,force:true});}
});

test('Upgrading the 24-motion v5 library preserves all existing fields, old pack removals and published snapshots',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-motion-v5-upgrade-'));
  let db:DatabaseSync|undefined;
  try {
    const previous=new DatabaseSync(join(dir,'form-fire.sqlite'));
    previous.exec('PRAGMA foreign_keys=ON; CREATE TABLE migrations(version INTEGER PRIMARY KEY)');
    for(const [version,file] of [[1,'001_initial.sql'],[2,'002_plan_library.sql'],[3,'003_plan_activity.sql'],[4,'004_google_auth.sql'],[5,'005_exercise_motion.sql']] as const) {
      previous.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
      previous.prepare('INSERT INTO migrations VALUES(?)').run(version);
    }
    for(const pack of ['plan-library-v1','exercise-motions-v2']) previous.prepare('INSERT INTO content_packs(id,installed_at) VALUES(?,?)').run(pack,'2025-01-02 03:04:05');
    const insert=previous.prepare('INSERT INTO exercises(id,title,category,equipment,instructions,animation,is_demo) VALUES(?,?,?,?,?,?,1)');
    for(const [eid,animation] of [['starter-squat','squat'],['starter-push','wall-push'],['starter-hinge','hinge'],['starter-row','row']]) insert.run(eid,'Original '+eid,'Original category','Original equipment','Original cues',animation);
    for(const exercise of additionalStarterExercises) insert.run(...exercise);
    // Alex removed one example from each existing pack before this upgrade.
    previous.prepare('DELETE FROM exercises WHERE id IN (?,?)').run('starter-push','starter-dead-bug');
    previous.prepare('UPDATE exercises SET title=?,category=?,equipment=?,instructions=?,video_url=?,video_caption=?,is_demo=0,archived=1,version=8,updated_at=? WHERE id=?').run('Tailored floor press','Personal category','Personal equipment','Personal cues','https://videos.example.org/personal.mp4','Personal caption','2025-04-05 06:07:08','starter-floor-press');
    // A separately created record may already use an incoming starter ID.
    previous.prepare('INSERT INTO exercises(id,title,category,equipment,instructions,animation,is_demo,archived,version,updated_at) VALUES(?,?,?,?,?,?,0,1,3,?)').run('starter-goblet-squat','Existing personal squat','Custom','Custom equipment','Custom cues','squat','2025-05-06 07:08:09');
    const before=previous.prepare('SELECT * FROM exercises ORDER BY id').all() as any[];
    const oldPacks=previous.prepare('SELECT * FROM content_packs ORDER BY id').all() as any[];
    const snapshot=JSON.stringify({is_demo:true,workouts:[{name:'Published before removal',day:'Monday',exercises:[{exercise_id:'starter-dead-bug',exercise:{title:'Original dead bug',instructions:'Original published cues',animation:'dead-bug',version:1}}]}]});
    previous.prepare('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)').run('client-v5','client-v5@example.test','Original client','unused');
    previous.prepare('INSERT INTO google_identities(subject,user_id) VALUES(?,?)').run('subject-v5','client-v5');
    previous.prepare('INSERT INTO services(id,title,kind,description,inclusions) VALUES(?,?,?,?,?)').run('service-v5','Existing service','train','Existing description','Existing inclusions');
    previous.prepare('INSERT INTO requests(id,user_id,service_id,kind,details,idempotency_key) VALUES(?,?,?,?,?,?)').run('request-v5','client-v5','service-v5','coaching','{}','key-v5');
    previous.prepare('INSERT INTO templates(id,title,kind,content) VALUES(?,?,?,?)').run('template-v5','Existing plan','training','{}');
    previous.prepare('INSERT INTO assignments(id,user_id,request_id,template_id,template_version,version,title,kind,snapshot) VALUES(?,?,?,?,1,1,?,?,?)').run('assignment-v5','client-v5','request-v5','template-v5','Existing assignment','training',snapshot);
    const identity=previous.prepare('SELECT * FROM google_identities WHERE subject=?').get('subject-v5');
    const assignment=previous.prepare('SELECT * FROM assignments WHERE id=?').get('assignment-v5');
    previous.close();

    db=openDb(dir);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM exercises').get()?.n,38);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM migrations').get()?.n,6);
    for(const row of before) assert.deepEqual(db.prepare('SELECT * FROM exercises WHERE id=?').get(row.id),row);
    for(const row of oldPacks) assert.deepEqual(db.prepare('SELECT * FROM content_packs WHERE id=?').get(row.id),row);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM content_packs').get()?.n,3);
    assert.equal(db.prepare('SELECT id FROM exercises WHERE id=?').get('starter-push'),undefined);
    assert.equal(db.prepare('SELECT id FROM exercises WHERE id=?').get('starter-dead-bug'),undefined);
    for(const [eid,title,category,equipment,instructions,animation] of expandedStarterExercises) {
      if(eid==='starter-goblet-squat') continue;
      assert.deepEqual(db.prepare('SELECT title,category,equipment,instructions,animation,is_demo,archived,version FROM exercises WHERE id=?').get(eid),Object.assign(Object.create(null),{title,category,equipment,instructions,animation,is_demo:1,archived:0,version:1}));
    }
    assert.deepEqual(db.prepare('SELECT * FROM google_identities WHERE subject=?').get('subject-v5'),identity);
    assert.deepEqual(db.prepare('SELECT * FROM assignments WHERE id=?').get('assignment-v5'),assignment);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM assignments').get()?.n,1);
    db.prepare('UPDATE exercises SET title=?,is_demo=0,archived=1,version=11 WHERE id=?').run('Alex tailored the new bench press','starter-bench-press');
    db.prepare('DELETE FROM exercises WHERE id=?').run('starter-donkey-kick');
    const afterEdit=db.prepare('SELECT * FROM exercises ORDER BY id').all();
    installStarterContent(db);
    assert.deepEqual(db.prepare('SELECT * FROM exercises ORDER BY id').all(),afterEdit);
    db.close();db=openDb(dir);
    assert.deepEqual(db.prepare('SELECT * FROM exercises ORDER BY id').all(),afterEdit);
    assert.deepEqual(db.prepare('SELECT * FROM assignments WHERE id=?').get('assignment-v5'),assignment);
    assert.deepEqual(db.prepare('SELECT * FROM google_identities WHERE subject=?').get('subject-v5'),identity);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  } finally {db?.close();rmSync(dir,{recursive:true,force:true});}
});

test('Expanded motion publication retains the assigned copy and keeps client access isolated',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ff-motion-publish-'));
  const app=createApp({dataDir:dir,origin:'http://127.0.0.1:8085'});
  await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const port=(app.server.address() as any).port;
  const client=id(),admin=id(),other=id(),requestId=id();
  for(const [uid,role] of [[client,'client'],[admin,'admin'],[other,'client']]) {
    app.db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(uid,uid+'@example.test',role,'unused',role);
    app.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(uid),uid,'csrf',Date.now()+3600000);
  }
  app.db.prepare("INSERT INTO requests(id,user_id,service_id,kind,details,status,active,idempotency_key) VALUES(?,?,'train','coaching','{}','approved',1,?)").run(requestId,client,id());
  async function call(who:string,path:string,method='GET',body?:any,csrf='csrf') {
    return new Promise<{status:number;data:any}>((resolve,reject)=>{
      const req=request({hostname:'127.0.0.1',port,path:'/api'+path,method,headers:{Host:'127.0.0.1:8085',Origin:'http://127.0.0.1:8085','Content-Type':'application/json','X-CSRF-Token':csrf,Cookie:'ff_session='+who}},res=>{
        let response='';res.on('data',chunk=>response+=chunk);res.on('end',()=>resolve({status:res.statusCode!,data:JSON.parse(response)}));
      });
      req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
    });
  }
  try {
    const exercise={title:'Alex reviewed bench press',category:'Chest',equipment:'Two dumbbells and stable bench',instructions:'Reviewed original cues',animation:'bench-press',video_url:'https://videos.example.org/bench-press.mp4',video_caption:'Alex demonstrates the movement.',is_demo:false};
    const countBefore=app.db.prepare('SELECT COUNT(*) n FROM exercises').get()?.n;
    assert.equal((await call(client,'/admin/exercises','POST',exercise)).status,403);
    assert.equal((await call('', '/admin/exercises','POST',exercise)).status,401);
    assert.equal((await call(admin,'/admin/exercises','POST',exercise,'wrong')).status,403);
    assert.equal(app.db.prepare('SELECT COUNT(*) n FROM exercises').get()?.n,countBefore);
    const created=await call(admin,'/admin/exercises','POST',exercise);assert.equal(created.status,200);
    const eid=created.data.id;
    const content={schedule:'Wednesday',guidance:'Agreed with Alex',workouts:[{name:'Session',day:'Wednesday',exercises:[{exercise_id:eid,sets:2,reps:'8',rest_seconds:60,notes:'Individual note'}]}]};
    const template=await call(admin,'/admin/templates','POST',{title:'Personal plan',kind:'training',content,is_demo:false});assert.equal(template.status,200);
    const publish=()=>call(admin,'/admin/assignments','POST',{request_id:requestId,template_id:template.data.id});
    const published=await publish();assert.equal(published.status,201);
    const path='/assignments/'+published.data.id;
    const assigned=(await call(client,path)).data;
    assert.equal(assigned.snapshot.workouts[0].exercises[0].exercise.animation,'bench-press');
    assert.equal(assigned.snapshot.workouts[0].exercises[0].exercise.version,1);
    assert.equal(assigned.snapshot.is_demo,false);
    assert.equal((await call(other,path)).status,404);
    assert.equal((await call('',path)).status,401);
    assert.equal((await call(client,'/admin/exercises/'+eid,'PUT',{...exercise,animation:'push-up',version:1})).status,403);
    assert.equal((await call(admin,'/admin/exercises/'+eid,'PUT',{...exercise,animation:'push-up',instructions:'Revised cues',version:1})).status,200);
    assert.equal((await call(admin,'/admin/exercises/'+eid,'PUT',{...exercise,version:1})).status,409);
    assert.deepEqual((await call(client,path)).data,assigned);
    const newer=await publish();assert.equal(newer.status,201);
    const revised=(await call(client,'/assignments/'+newer.data.id)).data;
    assert.equal(revised.snapshot.workouts[0].exercises[0].exercise.animation,'push-up');
    assert.equal(revised.snapshot.workouts[0].exercises[0].exercise.instructions,'Revised cues');
    assert.equal(revised.snapshot.workouts[0].exercises[0].exercise.version,2);
    assert.deepEqual((await call(other,'/dashboard')).data.assignments,[]);
    assert.deepEqual((await call(client,'/export')).data.assignments.find((a:any)=>a.id===published.data.id).snapshot,assigned.snapshot);
  } finally {await new Promise<void>(resolve=>app.server.close(()=>resolve()));app.db.close();rmSync(dir,{recursive:true,force:true});}
});
