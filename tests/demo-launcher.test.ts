import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {passwordHash} from '../src/auth.ts';

test('One-command repair starts the actual demo and prints working password-only logins after live checks',async()=>{
 const root=mkdtempSync(join(tmpdir(),'ff-launcher-')),data=join(root,'data'),app=fileURLToPath(new URL('../',import.meta.url)),script=join(app,'termux/demo.sh');
 const probe=createServer();await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r));const port=(probe.address() as any).port;await new Promise<void>(r=>probe.close(()=>r()));
 const env={...process.env,PREFIX:'',FF_REQUIRE_VERIFICATION:'1',FF_DEMO_ROOT:data,FF_DEMO_BIN:join(root,'bin'),FF_DEMO_PORT:String(port)};
 const seed=spawnSync('bash',[script,'seed',app],{env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
 const before=JSON.parse(readFileSync(join(data,'demo-logins.json'),'utf8')).logins;
 const db=new DatabaseSync(join(data,'form-fire.sqlite'));db.prepare("UPDATE users SET password=?,admin_notes='Keep this note' WHERE email='demo-sam@form-fire.example'").run(passwordHash('changed password to repair'));const requests=(db.prepare('SELECT COUNT(*) n FROM requests').get() as any).n;db.close();
 const child=spawn('bash',[script,'fix',app],{env,stdio:['ignore','pipe','pipe']});let output='',errors='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>errors+=c);
 try{
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Launcher never became ready: '+errors)),25000);const ready=()=>{if(output.includes('Demo ready:')){clearTimeout(timer);child.stdout.off('data',ready);resolve();}};child.stdout.on('data',ready);child.once('exit',code=>{clearTimeout(timer);reject(Error('Launcher exited before ready: '+code+' '+errors));});});
  const origin='http://127.0.0.1:'+port,logins=JSON.parse(readFileSync(join(data,'demo-logins.json'),'utf8')).logins;
  const health=await (await fetch(origin+'/health')).json();assert.equal(health.requireVerification,false);assert.equal(health.instance.kind,'demo');
  for(const key of ['alex','sam']){
   const login=logins.find((u:any)=>u.key===key);assert.notEqual(login.password,before.find((u:any)=>u.key===key).password);assert.ok(output.includes('Password: '+login.password));
   const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:login.email,password:login.password})});assert.equal(response.status,200);const result=await response.json();assert.equal(result.user.id,login.id);
  }
  assert.ok(!output.includes('Current authenticator code:'));assert.ok(output.includes('No verification or authenticator code needed.'));
  const check=new DatabaseSync(join(data,'form-fire.sqlite'));assert.equal((check.prepare('SELECT COUNT(*) n FROM requests').get() as any).n,requests);assert.equal((check.prepare("SELECT admin_notes FROM users WHERE email='demo-sam@form-fire.example'").get() as any).admin_notes,'Keep this note');check.close();
  const collision=spawnSync('bash',[script,'foreground',app],{env,encoding:'utf8'});assert.notEqual(collision.status,0);assert.ok(!collision.stdout.includes('Password:'));assert.match(collision.stderr,/Port .* is in use/);
 }finally{
  const exited=new Promise<void>(r=>child.once('exit',()=>r()));if(child.exitCode===null){child.kill('SIGTERM');await exited;}rmSync(root,{recursive:true,force:true});
 }
});
