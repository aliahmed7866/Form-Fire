// Each launch makes a NEW fictional workspace. No reset or existing database arguments.
import { mkdtempSync,mkdirSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { openDb } from '../src/db.ts';
import { seedShowcase } from '../src/showcase.ts';
import { createApp } from '../src/server.ts';
const port=Number(process.env.FF_RECORD_PORT||8088);
if(!Number.isInteger(port)||port<1024||port>65535||[8085,8086].includes(port))throw Error('Choose a recording port from 1024–65535, separate from 8085/8086. Default: 8088.');
await new Promise<void>((resolve,reject)=>{const probe=createServer();probe.once('error',()=>reject(Error(`Recording port ${port} is busy. Stop the previous recording server or set FF_RECORD_PORT to another port.`)));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve()));});
const parent=resolve(process.env.FF_RECORD_ROOT||join(homedir(),'.local/share/form-fire-recordings'));
mkdirSync(parent,{recursive:true,mode:0o700});
const dir=mkdtempSync(join(parent,'take-'));writeFileSync(join(dir,'recording-only.json'),JSON.stringify({fictional:true,created_at:new Date().toISOString()}),{mode:0o600});
process.env.FF_MODE='local-test';process.env.FF_HOST='127.0.0.1';process.env.FF_PORT=String(port);process.env.FF_ORIGIN=`http://127.0.0.1:${port}`;process.env.FF_REQUIRE_VERIFICATION='0';
for(const key of ['FF_GOOGLE_CLIENT_ID','FF_GOOGLE_CLIENT_SECRET','FF_TLS_CERT_FILE','FF_TLS_KEY_FILE'])delete process.env[key];
const seed=openDb(dir);const showcase=seedShowcase(seed);seed.close();
const app=createApp({dataDir:dir,showcase,requireVerification:false});
await new Promise<void>((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
try{
 const response=await fetch(`${process.env.FF_ORIGIN}/api/auth/login`,{method:'POST',headers:{Origin:process.env.FF_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(showcase.admin)});
 const result=await response.json();if(!response.ok||result.user?.role!=='admin')throw Error('Recording administrator sign-in check failed.');
 await fetch(`${process.env.FF_ORIGIN}/api/auth/logout`,{method:'POST',headers:{Origin:process.env.FF_ORIGIN,'Content-Type':'application/json',Cookie:response.headers.get('set-cookie')!.split(';')[0],'X-CSRF-Token':result.csrf},body:'{}'});
 console.log(`\nFORM & FIRE — SCREEN-RECORDING WORKSPACE\nFictional accounts and transactions only. Normal app data is untouched.\n\nOpen ${process.env.FF_ORIGIN}/?record=1\nStart your phone screen recorder, then press Play tour.\nKeep this Termux session running. Ctrl+C stops the server.\nA new launch creates a fresh take; saved takes are not deleted.\nWorkspace: ${dir}\n`);
 spawn('termux-open-url',[process.env.FF_ORIGIN+'/?record=1'],{stdio:'ignore'}).on('error',()=>{});
}catch(error){app.server.close();app.db.close();throw error;}
let closing=false;function close(){if(closing)return;closing=true;app.server.close(()=>{app.db.close();process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);
