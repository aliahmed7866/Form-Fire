import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync,symlinkSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createServer,Server} from 'node:net';
import {prepareRecording,loadRecording,assertRecordingPortFree,chooseRecordingPort,rememberRecordingPort,recordingSettings} from '../scripts/record-workspace.ts';
import {passwordHash} from '../src/auth.ts';

test('Port diagnostics preserve non-conflict errors and never treat permission failures as a reason to move',async(t)=>{
 const denied=Object.assign(Error('permission denied'),{code:'EACCES'});
 t.mock.method(Server.prototype,'listen',function(this:Server){process.nextTick(()=>this.emit('error',denied));return this;});
 await assert.rejects(assertRecordingPortFree(8088),error=>error.code==='EACCES'&&error.cause===denied&&/permission denied/.test(error.message)&&!/is busy/.test(error.message));
 await assert.rejects(chooseRecordingPort(true),error=>error.code==='EACCES');
});

test('Recording defaults remember the selected port while explicit overrides and invalid metadata stay strict',()=>{
 const root=mkdtempSync(join(tmpdir(),'ff-record-port-')),before={...process.env};
 process.env.FF_RECORD_ROOT=root;delete process.env.FF_RECORD_PORT;
 try{
  assert.equal(recordingSettings().port,8088);
  process.env.FF_RECORD_PORT='8094';rememberRecordingPort();delete process.env.FF_RECORD_PORT;
  assert.equal(recordingSettings().port,8094);assert.equal(statSync(join(root,'active-port')).mode&0o777,0o600);
  process.env.FF_RECORD_PORT='8095';assert.equal(recordingSettings().port,8095);assert.equal(readFileSync(join(root,'active-port'),'utf8'),'8094\n');
  delete process.env.FF_RECORD_PORT;writeFileSync(join(root,'active-port'),'../../other');assert.throws(recordingSettings,/Invalid saved recording port/);
 }finally{for(const key of ['FF_RECORD_ROOT','FF_RECORD_PORT']){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}rmSync(root,{recursive:true,force:true});}
});

test('Port exhaustion leaves foreign service directories and the preferred listener untouched',async()=>{
 const root=mkdtempSync(join(tmpdir(),'ff-record-ports-')),before={...process.env},listener=createServer();
 await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));
 const port=(listener.address() as import('node:net').AddressInfo).port;
 process.env.FF_RECORD_ROOT=join(root,'takes');process.env.FF_RECORD_PORT=String(port);process.env.PREFIX=root;
 try{
  for(let candidate=8088;candidate<=8118;candidate++){
   const service=join(root,'var/service',`form-fire-recording-${candidate}`);mkdirSync(service,{recursive:true});writeFileSync(join(service,'owner'),'FOREIGN');
  }
  await assert.rejects(chooseRecordingPort(false),error=>error.code==='EADDRINUSE');
  await assert.rejects(chooseRecordingPort(true),/No available recording port/);
  assert.equal(listener.listening,true);assert.ok(!readdirSync(root).includes('takes'));
  for(let candidate=8088;candidate<=8118;candidate++)assert.equal(readFileSync(join(root,'var/service',`form-fire-recording-${candidate}`,'owner'),'utf8'),'FOREIGN');
 }finally{
  await new Promise<void>(r=>listener.close(()=>r()));
  for(const key of ['FF_RECORD_ROOT','FF_RECORD_PORT','PREFIX']){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}rmSync(root,{recursive:true,force:true});
 }
});

test('Saved recording recovery validates its private manifest, identity and fictional accounts before opening for writes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'ff-record-manifest-')),before={...process.env};
 process.env.FF_RECORD_ROOT=root;process.env.FF_RECORD_PORT='8101';process.env.FF_MODE='local-test';
 try{
  const take=await prepareRecording(),manifest=join(take.dir,'recording-only.json');
  assert.equal(statSync(manifest).mode&0o777,0o600);assert.equal(loadRecording(take.dir).showcase.runId,take.showcase.runId);
  const db=new DatabaseSync(join(take.dir,'form-fire.sqlite'));
  try{
   db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run('sam',take.showcase.client.email,'Sam',passwordHash(take.showcase.client.password),'client');
   assert.equal(loadRecording(take.dir).showcase.runId,take.showcase.runId,'registered client can be recovered');
   db.prepare("UPDATE users SET role='admin' WHERE id='sam'").run();assert.throws(()=>loadRecording(take.dir),/unexpected accounts/);
   db.prepare("UPDATE users SET role='client',email='foreign@example.test' WHERE id='sam'").run();assert.throws(()=>loadRecording(take.dir),/unexpected accounts/);
  }finally{db.close();}
  const other=await prepareRecording();process.env.FF_RECORD_PORT='8102';assert.throws(()=>loadRecording(other.dir),/cannot be resumed/);process.env.FF_RECORD_PORT='8101';
  const linked=join(root,'take-linked');symlinkSync(other.dir,linked);assert.throws(()=>loadRecording(linked),/dedicated directory/);
  const saved=JSON.parse(readFileSync(join(other.dir,'recording-only.json'),'utf8'));saved.showcase.runId='wrong';writeFileSync(join(other.dir,'recording-only.json'),JSON.stringify(saved));assert.throws(()=>loadRecording(other.dir),/own fictional workspace/);
 }finally{for(const key of ['FF_RECORD_ROOT','FF_RECORD_PORT','FF_MODE']){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}rmSync(root,{recursive:true,force:true});}
});

// Optional integration with real runit binaries. No packages are required by the app.
test('Managed recording survives launcher exit and process kill, preserves the take and session, and supports fresh/stop/status',{
 skip:!process.env.FF_RUNIT_TEST_BIN,timeout:90000
},async()=>{
 const root=mkdtempSync(join(tmpdir(),'ff-record-service-')),prefix=join(root,'prefix'),bin=join(prefix,'bin'),services=join(prefix,'var/service');
 mkdirSync(bin,{recursive:true});mkdirSync(services,{recursive:true});
 for(const name of ['sv','runsv','runsvdir'])symlinkSync(join(process.env.FF_RUNIT_TEST_BIN!,name),join(bin,name));
 const shell=process.env.PREFIX?join(process.env.PREFIX,'bin/bash'):'/bin/bash';
 symlinkSync(shell,join(bin,'bash'));
 // The test owns runsvdir directly; Termux's service-daemon supplies that process on device.
 writeFileSync(join(bin,'service-daemon'),`#!${shell}\nexit 0\n`,{mode:0o700});
 const takes=join(root,'recordings with spaces'),port='8103',origin='http://127.0.0.1:'+port;
 const env:NodeJS.ProcessEnv={...process.env,PREFIX:prefix,PATH:bin+':'+process.env.PATH,FF_RECORD_ROOT:takes,FF_RECORD_PORT:port,SVDIR:join(root,'wrong-services')};
 const script=new URL('../termux/record.sh',import.meta.url).pathname,service=join(services,'form-fire-recording-'+port);
 let supervisorErrors='';
 const supervisor=spawn(join(bin,'runsvdir'),[services],{env,stdio:['ignore','ignore','pipe']});
 supervisor.stderr.on('data',b=>supervisorErrors+=b);
 let alternateService:string|undefined;
 const exec=(command:string,args:string[])=>new Promise<{code:number|null,output:string}>(resolve=>{const child=spawn(command,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('close',code=>resolve({code,output}));});
 const cmd=(action:string)=>exec('bash',[script,action]);
 const call=(path:string,method='GET',body?:any,cookie='',csrf='')=>fetch(origin+path,{method,headers:{Connection:'close',Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrf},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const until=async(fn:()=>Promise<boolean>)=>{const end=Date.now()+15000;while(Date.now()<end){try{if(await fn())return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out waiting for recording recovery');};
 try{
  let result=await cmd('start');assert.equal(result.code,0,result.output);assert.match(result.output,/Recording server reachable/);
  const config=await(await call('/api/showcase')).json();const dir=readFileSync(join(service,'take'),'utf8').trim();
  assert.equal((await call('/api/auth/register','POST',config.client)).status,201);
  const login=await call('/api/auth/login','POST',config.client),session=await login.json(),cookie=login.headers.get('set-cookie')!.split(';')[0];assert.equal(login.status,200);
  assert.equal((await call('/api/profile','PUT',{name:'Sam (fictional)',favourite_foods:'Saved before recovery'},cookie,session.csrf)).status,200);
  const saved=await(await call('/api/session','GET',undefined,cookie)).json();
  const originalPid=readFileSync(join(service,'supervise/pid'),'utf8');
  assert.equal((await exec('sv',['kill',service])).code,0);
  await until(async()=>readFileSync(join(service,'supervise/pid'),'utf8')!==originalPid&&(await call('/health')).ok);
  assert.equal((await(await call('/api/showcase')).json()).runId,config.runId);
  const recovered=await(await call('/api/session','GET',undefined,cookie)).json();assert.deepEqual(recovered.user,saved.user);assert.equal(recovered.csrf,session.csrf);
  assert.match(readFileSync(join(takes,'logs',port+'.log'),'utf8'),/signal=9/);
  // A broken configuration must stop instead of repeatedly launching or replacing a take.
  const manifest=join(dir,'recording-only.json'),originalManifest=readFileSync(manifest,'utf8');
  writeFileSync(manifest,'{}');assert.equal((await exec('sv',['kill',service])).code,0);
  await until(async()=>readFileSync(join(takes,'logs',port+'.log'),'utf8').includes('code=1 signal=0')&&(await exec('sv',['status',service])).output.startsWith('down:'));
  assert.equal(readdirSync(takes).filter(n=>n.startsWith('take-')).length,1);
  writeFileSync(manifest,originalManifest);
  result=await cmd('start');assert.equal(result.code,0,result.output);assert.equal(readFileSync(join(service,'take'),'utf8').trim(),dir);
  result=await cmd('restart');assert.equal(result.code,0,result.output);assert.equal((await(await call('/api/showcase')).json()).runId,config.runId);
  result=await cmd('stop');assert.equal(result.code,0,result.output);
  result=await cmd('status');assert.equal(result.code,1,result.output);assert.match(result.output,/ECONNREFUSED/);
  result=await cmd('start');assert.equal(result.code,0,result.output);assert.deepEqual((await(await call('/api/session','GET',undefined,cookie)).json()).user,saved.user);
  result=await cmd('fresh');assert.equal(result.code,0,result.output);const fresh=await(await call('/api/showcase')).json();assert.notEqual(fresh.runId,config.runId);
  assert.equal((await call('/api/session')).status,200);assert.equal((await fetch(origin+'/api/session',{headers:{'X-Recording-Run':config.runId}})).status,409);
  assert.equal(readdirSync(takes).filter(n=>n.startsWith('take-')).length,2);assert.ok(statSync(join(dir,'form-fire.sqlite')).isFile());
  const logs=(await cmd('logs')).output;for(const password of [config.admin.password,config.client.password,config.other.password])assert.ok(!logs.includes(password));
  // Reproduce the phone report: managed service is down but another listener still holds its port.
  assert.equal((await cmd('stop')).code,0);
  const blocker=createServer();await new Promise<void>(r=>blocker.listen(Number(port),'127.0.0.1',r));
  try{
   const oldTake=readFileSync(join(service,'take'),'utf8');
   result=await cmd('fresh');assert.equal(result.code,1,result.output);assert.match(result.output,/EADDRINUSE/);
   assert.equal(readFileSync(join(service,'take'),'utf8'),oldTake);assert.equal(readdirSync(takes).filter(n=>n.startsWith('take-')).length,2);
   delete env.FF_RECORD_PORT;
   // Both restart and start must preserve this take's port and refuse to move it.
   result=await cmd('restart');assert.equal(result.code,1,result.output);assert.equal(readFileSync(join(takes,'active-port'),'utf8').trim(),port);
   const beforeSelectionMtime=statSync(services).mtimeMs;
   result=await cmd('fresh');assert.equal(result.code,0,result.output+'\nSupervisor: '+JSON.stringify({stderr:supervisorErrors,exit:supervisor.exitCode,signal:supervisor.signalCode,beforeSelectionMtime,afterSelectionMtime:statSync(services).mtimeMs}));assert.match(result.output,/existing listener is unchanged/);
   const selected=readFileSync(join(takes,'active-port'),'utf8').trim();assert.notEqual(selected,port);
   alternateService=join(services,'form-fire-recording-'+selected);
   assert.equal(blocker.listening,true);assert.ok(statSync(join(dir,'form-fire.sqlite')).isFile());
   assert.equal(readFileSync(join(service,'take'),'utf8'),oldTake);assert.equal(readdirSync(takes).filter(n=>n.startsWith('take-')).length,3);
   result=await cmd('status');assert.equal(result.code,0,result.output);assert.ok(result.output.includes(`127.0.0.1:${selected}/`));
   const selectedTake=readFileSync(join(alternateService,'take'),'utf8');
   result=await cmd('stop');assert.equal(result.code,0,result.output);assert.equal(blocker.listening,true);
   result=await cmd('start');assert.equal(result.code,0,result.output);assert.equal(readFileSync(join(alternateService,'take'),'utf8'),selectedTake);
  }finally{await new Promise<void>(r=>blocker.close(()=>r()));}
 }finally{
  if(alternateService)await exec('sv',['-w','5','shutdown',alternateService]);
  await exec('sv',['-w','5','shutdown',service]);supervisor.kill('SIGTERM');await new Promise(r=>supervisor.once('exit',r));rmSync(root,{recursive:true,force:true});
 }
});
