import {test} from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,symlinkSync,statSync,existsSync,utimesSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,spawnSync} from 'node:child_process';

const script=new URL('../termux/service.sh',import.meta.url).pathname;
// Native Termux has no /bin/bash or /bin/sh; capture its real shell before
// each fixture replaces PREFIX with a private service directory.
const shell=process.env.PREFIX?join(process.env.PREFIX,'bin/bash'):'/bin/bash';
const shebang='#!'+shell+'\n';
const exec=(command:string,args:string[],env:NodeJS.ProcessEnv,cwd:string)=>new Promise<{code:number|null,output:string}>(resolve=>{
 const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});let output='';
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('close',code=>resolve({code,output}));
});
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'ff-service-')),prefix=join(root,'prefix'),bin=join(prefix,'bin'),service=join(prefix,'var/service/form-fire');
 mkdirSync(bin,{recursive:true});mkdirSync(service,{recursive:true});symlinkSync(shell,join(bin,'bash'));
 writeFileSync(join(service,'run'),shebang+'exec sleep 60\n',{mode:0o700});
 return {root,prefix,bin,service,env:{...process.env,PREFIX:prefix,PATH:bin+':'+process.env.PATH,SVDIR:join(root,'wrong-services')}};
}

test('Sourcing the Termux supervisor helper has no service or shell-option side effects',async()=>{
 const before={...process.env};delete before.PREFIX;
 const result=await exec('bash',['-c','set +e; source "$1"; case "$-" in *e*) exit 9;; esac; declare -F ff_wait_for_supervisor >/dev/null','bash',script],before,tmpdir());
 assert.equal(result.code,0,result.output);assert.equal(result.output,'');
});

test('Supervisor startup reports the real daemon failure and never restarts unrelated services',async()=>{
 const f=fixture();
 try{
  writeFileSync(join(f.bin,'sv'),shebang+'printf "%s|%s\\n" "$SVDIR" "$*" >> "$PREFIX/sv-calls"\necho "fail: $*: runsv not running"\nexit 1\n',{mode:0o700});
  writeFileSync(join(f.bin,'service-daemon'),shebang+'printf "%s\\n" "$*" >> "$PREFIX/daemon-calls"\necho "supervisor launch denied" >&2\nexit 7\n',{mode:0o700});
  // Speed up only the failed-wait test; successful startup below uses real runit and waits.
  writeFileSync(join(f.bin,'sleep'),shebang+'exit 0\n',{mode:0o700});
  writeFileSync(join(f.bin,'touch'),shebang+'printf "%s\\n" "$*" >> "$PREFIX/touch-calls"\necho "timestamp refresh denied" >&2\nexit 9\n',{mode:0o700});
  const result=await exec('bash',[script,'restart'],f.env,f.root);
  assert.equal(result.code,1,result.output);assert.match(result.output,/supervisor launch denied/);assert.match(result.output,/exited with code 7/);
  assert.match(result.output,/timestamp refresh denied/);assert.match(result.output,/Could not refresh the service directory timestamp/);
  assert.equal(readFileSync(join(f.prefix,'touch-calls'),'utf8'),'-m '+join(f.prefix,'var/service')+'\n');
  assert.equal(readFileSync(join(f.prefix,'daemon-calls'),'utf8'),'start\n');
  const calls=readFileSync(join(f.prefix,'sv-calls'),'utf8').trim().split('\n');
  assert.ok(calls.length>1);for(const call of calls)assert.equal(call,join(f.prefix,'var/service')+'|status '+f.service);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('Launcher repair preserves existing configuration and routes through the checkout helper',async()=>{
 const f=fixture(),app=join(f.root,'app with spaces'),config=join(f.root,'config with spaces'),launcher=join(f.root,'bin with spaces/form-fire');
 try{
  mkdirSync(join(app,'termux'),{recursive:true});copyFileSync(script,join(app,'termux/service.sh'));mkdirSync(config);
  const saved="export FF_DATA_DIR='existing private data'\n";writeFileSync(join(config,'env'),saved,{mode:0o600});
  writeFileSync(join(f.bin,'sv'),shebang+'[ "$FF_DATA_DIR" = "existing private data" ] || exit 3\nprintf "%s|%s\\n" "$SVDIR" "$*"\n',{mode:0o700});
  let result=await exec('bash',['-c','source "$1"; ff_write_launcher "$2" "$3" "$4" "$5"','bash',script,launcher,app,config,f.prefix],f.env,f.root);
  assert.equal(result.code,0,result.output);assert.equal(statSync(launcher).mode&0o777,0o700);
  result=await exec('bash',[launcher,'status'],f.env,f.root);assert.equal(result.code,0,result.output);
  assert.equal(result.output,join(f.prefix,'var/service')+'|status '+f.service+'\n');assert.equal(readFileSync(join(config,'env'),'utf8'),saved);
  const linked=join(f.root,'linked-launcher');symlinkSync(launcher,linked);
  result=await exec('bash',['-c','source "$1"; ff_write_launcher "$2" "$3" "$4" "$5"','bash',script,linked,app,config,f.prefix],f.env,f.root);
  assert.equal(result.code,1,result.output);assert.match(result.output,/symlink launcher/);assert.equal(readFileSync(join(config,'env'),'utf8'),saved);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('Normal service starts a cold supervisor, ignores inherited SVDIR and leaves other services running',{
 skip:!process.env.FF_RUNIT_TEST_BIN||spawnSync('start-stop-daemon',['--version'],{stdio:'ignore'}).status!==0,timeout:45000
},async()=>{
 const f=fixture(),services=join(f.prefix,'var/service'),other=join(services,'unrelated'),extra=join(services,'new-recording'),pidfile=join(f.prefix,'var/run/service-daemon.pid');
 for(const name of ['sv','runsv','runsvdir'])symlinkSync(join(process.env.FF_RUNIT_TEST_BIN!,name),join(f.bin,name));
 mkdirSync(other);writeFileSync(join(f.service,'down'),'');
 const run=shebang+'exec node -e "setInterval(() => {}, 1000)"\n';writeFileSync(join(f.service,'run'),run,{mode:0o700});writeFileSync(join(other,'run'),run,{mode:0o700});
 // Termux service-daemon's cold start, using the host start-stop-daemon.
 // The private PID guard models its already-running result without requiring
 // /proc access for executable matching in restricted test environments.
 writeFileSync(join(f.bin,'service-daemon'),shebang+'set -e\n[ "$1" = start ]\nmkdir -p "$PREFIX/var/run"\nprintf "%s\\n" "$SVDIR" >> "$PREFIX/daemon-calls"\nif [ -r "$PREFIX/var/run/service-daemon.pid" ] && kill -0 "$(cat "$PREFIX/var/run/service-daemon.pid")" 2>/dev/null; then echo "Supervisor already running"; exit 1; fi\nstart-stop-daemon -S -b -m -p "$PREFIX/var/run/service-daemon.pid" -x "$PREFIX/bin/runsvdir" -d "$PREFIX" -- "$SVDIR"\n',{mode:0o700});
 const call=(action:string)=>exec('bash',[script,action],f.env,f.root);
 let supervisorPid:string|undefined;
 try{
  assert.equal(existsSync(pidfile),false);
  let result=await call('restart');assert.equal(result.code,0,result.output);assert.match(result.output,/ok: run:/);
  supervisorPid=readFileSync(pidfile,'utf8');
  assert.equal(readFileSync(join(f.prefix,'daemon-calls'),'utf8'),services+'\n');
  const unrelatedPid=readFileSync(join(other,'supervise/pid'),'utf8');assert.ok(Number(unrelatedPid)>0);
  const initialPid=readFileSync(join(f.service,'supervise/pid'),'utf8');
  result=await call('restart');assert.equal(result.code,0,result.output);
  // sv's timestamp has whole-second precision, so wait for the observable
  // process replacement when two restarts happen within the same second.
  const restartDeadline=Date.now()+10000;let restartedPid=initialPid;
  while(Date.now()<restartDeadline){
   restartedPid=readFileSync(join(f.service,'supervise/pid'),'utf8');
   if(Number(restartedPid)>0&&restartedPid!==initialPid)break;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(Number(restartedPid)>0&&restartedPid!==initialPid,'restart must replace the service process');
  assert.equal(readFileSync(join(other,'supervise/pid'),'utf8'),unrelatedPid);
  assert.equal(readFileSync(join(f.prefix,'daemon-calls'),'utf8'),services+'\n','ready supervisor is reused');
  result=await call('stop');assert.equal(result.code,0,result.output);assert.match(result.output,/ok: down:/);
  result=await call('status');assert.equal(result.code,0,result.output);assert.match(result.output,/down:/);
  result=await call('start');assert.equal(result.code,0,result.output);assert.match(result.output,/ok: run:/);
  assert.equal(readFileSync(join(other,'supervise/pid'),'utf8'),unrelatedPid);
  // Let runsvdir finish its initial follow-up scan, then reproduce a new
  // directory whose whole-second mtime matches the timestamp it cached.
  await new Promise(resolve=>setTimeout(resolve,2000));
  const cached=statSync(services),normalPid=readFileSync(join(f.service,'supervise/pid'),'utf8');
  mkdirSync(extra);writeFileSync(join(extra,'down'),'');writeFileSync(join(extra,'run'),run,{mode:0o700});
  utimesSync(services,cached.atime,cached.mtime);
  result=await exec('bash',['-c','source "$1"; ff_wait_for_supervisor "$2" && sv -w 5 start "$2"','bash',script,extra],f.env,f.root);
  assert.equal(result.code,0,result.output);assert.match(result.output,/ok: run:/);
  assert.notEqual(Math.floor(statSync(services).mtimeMs/1000),Math.floor(cached.mtimeMs/1000),'refresh requests a normal directory rescan');
  assert.ok(Number(readFileSync(join(extra,'supervise/pid'),'utf8'))>0);
  assert.equal(readFileSync(join(f.service,'supervise/pid'),'utf8'),normalPid);assert.equal(readFileSync(join(other,'supervise/pid'),'utf8'),unrelatedPid);
  assert.equal(readFileSync(pidfile,'utf8'),supervisorPid,'directory discovery does not replace the global supervisor');
 }finally{
  for(const service of [f.service,other,extra])if(existsSync(service))await exec('sv',['-w','5','shutdown',service],f.env,f.root);
  const supervisorPids=new Set([Number(supervisorPid),existsSync(pidfile)?Number(readFileSync(pidfile,'utf8')):0]);
  for(const pid of supervisorPids)if(Number.isInteger(pid)&&pid>1){try{process.kill(pid,'SIGTERM');}catch{}}
  rmSync(f.root,{recursive:true,force:true});
 }
});
