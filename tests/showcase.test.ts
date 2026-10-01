import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDb} from '../src/db.ts';
import {seedShowcase,validateShowcase} from '../src/showcase.ts';
import {createApp} from '../src/server.ts';
import {buildShowcase} from '../public/showcase-scenario.js';

test('Recording setup refuses existing users and validates fixture credentials and ownership',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-record-')),db=openDb(dir);
 try{assert.equal(validateShowcase(db),null);const config=seedShowcase(db);assert.equal(validateShowcase(db,config)?.runId,config.runId);assert.throws(()=>seedShowcase(db),/fresh database/);assert.throws(()=>validateShowcase(db,{...config,runId:'different'}),/own fictional workspace/);assert.throws(()=>validateShowcase(db,{...config,admin:{...config.admin,password:'wrong'}}),/credentials/);db.prepare('UPDATE users SET role=? WHERE id=?').run('client',config.admin.id);assert.throws(()=>validateShowcase(db,config),/credentials/);}
 finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Normal app does not expose recording assets or credentials; isolated app uses real auth',async()=>{
 for(const enabled of [false,true]){
  const dir=mkdtempSync(join(tmpdir(),'ff-record-'));let config;if(enabled){const db=openDb(dir);config=seedShowcase(db);db.close();}
  const app=createApp({dataDir:dir,origin:'http://127.0.0.1:8099',showcase:config});await new Promise<void>(r=>app.server.listen(8099,'127.0.0.1',r));
  try{
   const base='http://127.0.0.1:8099';const call=(path:string,options:any={})=>fetch(base+path,{...options,headers:{...options.headers,Connection:'close'}});const html=await(await call('')).text();assert.equal(html.includes('/showcase-player.js'),enabled);
   for(const path of ['/api/showcase','/showcase-player.js','/showcase-connection.js','/showcase-cue.js','/showcase-journey.js','/showcase-scenario.js','/showcase-player.css'])assert.equal((await call(path)).status,enabled?200:404,path);
   assert.equal((await call('/api/admin/dashboard')).status,401);
   if(config){const changed=await call('/api/session',{headers:{'X-Recording-Run':'old-take'}});assert.equal(changed.status,409);assert.equal((await changed.json()).code,'recording_changed');const rejected=await call('/api/auth/register',{method:'POST',headers:{'X-Recording-Run':'old-take',Origin:base,'Content-Type':'application/json'},body:JSON.stringify(config.client)});assert.equal(rejected.status,409);assert.equal((app.db.prepare('SELECT COUNT(*) n FROM users').get() as any).n,2);const r=await call('/api/auth/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(config.admin)});const session=await r.json();assert.equal(r.status,200);assert.equal(session.user.role,'admin');assert.equal((await (await call('/api/session')).json()).requireVerification,false);const cookie=r.headers.get('set-cookie')!.split(';')[0];assert.equal((await call('/api/admin/dashboard',{headers:{Cookie:cookie}})).status,200);assert.equal((await call('/api/admin/services',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{}'})).status,403);}
  }finally{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});}
 }
});

test('Recording inventory names roles, unique steps and the complete connected feature families',()=>{
 const steps=buildShowcase({},{});assert.ok(steps.length>=90);assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);for(const step of steps){assert.ok(['visitor','client','admin','other'].includes(step.role));assert.equal(typeof step.run,'function');assert.ok(step.title);}
 const chapters=new Set(steps.map(s=>s.chapter));for(const chapter of ['Welcome','Join','Coaching','Plans','Training','Food','Progress','Rhythm','Check-ins','Coach review','Studio','Private chef','Payments','Other request states','Privacy','Account','Finish'])assert.ok(chapters.has(chapter));
});

test('Recording launcher works outside the checkout and preserves existing data',async()=>{
 const {spawn}=await import('node:child_process');const {readFileSync,writeFileSync,readdirSync}=await import('node:fs');const {createServer}=await import('node:net');
 const root=mkdtempSync(join(tmpdir(),'ff-record-launch-')),sentinel=join(root,'original-data');writeFileSync(sentinel,'KEEP EXISTING DATA');
 const script=new URL('../termux/record.sh',import.meta.url).pathname,env:NodeJS.ProcessEnv={...process.env,FF_RECORD_ROOT:join(root,'takes'),FF_RECORD_PORT:'8097',FF_DATA_DIR:sentinel,FF_REQUIRE_VERIFICATION:'1'};
 // Exercise foreground mode on every host, without touching installed Termux services.
 delete env.PREFIX;
 const child=spawn('bash',[script],{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);
 const closed=new Promise<number|null>(r=>child.on('exit',r));
 try{
  const end=Date.now()+15000;while(!output.includes('Open http://127.0.0.1:8097/')&&Date.now()<end&&child.exitCode===null)await new Promise(r=>setTimeout(r,30));
  assert.match(output,/SCREEN-RECORDING WORKSPACE/,errors);const response=await fetch('http://127.0.0.1:8097/api/session',{headers:{Connection:'close'}});assert.equal((await response.json()).requireVerification,false);
  const status=spawn('bash',[script,'status'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let checkOutput='';status.stdout.on('data',b=>checkOutput+=b);assert.equal(await new Promise(r=>status.on('exit',r)),0);assert.match(checkOutput,/Recording server reachable/);assert.ok(!checkOutput.includes('password'));
  assert.equal(readFileSync(sentinel,'utf8'),'KEEP EXISTING DATA');const takes=readdirSync(join(root,'takes'));assert.equal(takes.length,1);
  child.kill('SIGTERM');assert.equal(await closed,0);
  const unavailable=spawn('bash',[script,'status'],{cwd:root,env,stdio:'ignore'});assert.equal(await new Promise(r=>unavailable.on('exit',r)),1);
  const blocker=createServer();await new Promise<void>(r=>blocker.listen(8097,'127.0.0.1',r));
  try{const failed=spawn('bash',[script],{cwd:root,env,stdio:'ignore'});assert.notEqual(await new Promise(r=>failed.on('exit',r)),0);assert.deepEqual(readdirSync(join(root,'takes')),takes);}finally{await new Promise<void>(r=>blocker.close(()=>r()));}
 }finally{if(child.exitCode===null)child.kill('SIGTERM');await closed;rmSync(root,{recursive:true,force:true});}
});
