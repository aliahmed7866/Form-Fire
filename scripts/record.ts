// Foreground starts a fresh take; the service reopens its private, validated manifest.
import { spawn,spawnSync } from 'node:child_process';
import { createApp } from '../src/server.ts';
import {recordingSettings,assertRecordingPortFree,prepareRecording,loadRecording} from './record-workspace.ts';
const {port,origin}=recordingSettings();
process.env.FF_MODE='local-test';process.env.FF_HOST='127.0.0.1';process.env.FF_PORT=String(port);process.env.FF_ORIGIN=origin;process.env.FF_REQUIRE_VERIFICATION='0';
for(const key of ['FF_GOOGLE_CLIENT_ID','FF_GOOGLE_CLIENT_SECRET','FF_TLS_CERT_FILE','FF_TLS_KEY_FILE'])delete process.env[key];
if(process.argv[2]==='prepare'){console.log((await prepareRecording()).dir);process.exit(0);}
const resume=!!process.env.FF_RECORD_TAKE;
if(resume)await assertRecordingPortFree(port);
const {dir,showcase}=resume?loadRecording(process.env.FF_RECORD_TAKE!):await prepareRecording();
const app=createApp({dataDir:dir,showcase,requireVerification:false,resumeShowcase:resume});
await new Promise<void>((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
let closing=false;function close(signal:string){if(closing)return;closing=true;console.log(`${new Date().toISOString()} Stopping recording server: ${signal}`);app.server.close(()=>{app.db.close();process.exit(0);});}
process.on('SIGINT',()=>close('SIGINT'));process.on('SIGTERM',()=>close('SIGTERM'));
try{
 // Fresh takes get a real sign-in smoke check. Recovery must not mutate sessions.
 if(!resume){
 const response=await fetch(`${process.env.FF_ORIGIN}/api/auth/login`,{method:'POST',headers:{Origin:process.env.FF_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(showcase.admin),signal:AbortSignal.timeout(10000)});
 const result=await response.json();if(!response.ok||result.user?.role!=='admin')throw Error('Recording administrator sign-in check failed.');
 const logout=await fetch(`${process.env.FF_ORIGIN}/api/auth/logout`,{method:'POST',headers:{Origin:process.env.FF_ORIGIN,'Content-Type':'application/json',Cookie:response.headers.get('set-cookie')!.split(';')[0],'X-CSRF-Token':result.csrf},body:'{}',signal:AbortSignal.timeout(5000)});
 if(!logout.ok)throw Error('Recording administrator sign-out check failed.');
 }
 const health=await fetch(process.env.FF_ORIGIN+'/health',{signal:AbortSignal.timeout(5000)});
 const ready=await fetch(process.env.FF_ORIGIN+'/api/showcase',{signal:AbortSignal.timeout(5000)});
 if(!health.ok||!ready.ok||(await ready.json()).runId!==showcase.runId)throw Error('Recording readiness check failed.');
 // Best effort: prevents CPU sleep on Termux; Android can still stop the app.
 const wake=spawnSync('termux-wake-lock',[],{stdio:'ignore',timeout:3000});
 console.log(`\n${new Date().toISOString()} FORM & FIRE — SCREEN-RECORDING WORKSPACE\nFictional accounts and transactions only. Normal app data is untouched.\n\nOpen ${origin}/?record=1\nTake: ${showcase.runId}\n${process.env.FF_RECORD_MANAGED==='1'?'Managed recording service. Recovery keeps this same take.':'Keep this Termux session running. Ctrl+C stops the foreground server.'}\nCheck: cd "$HOME/Form-Fire" && FF_RECORD_PORT=${port} bash termux/record.sh status\n${wake.status===0?'Termux keep-awake requested. Run termux-wake-unlock when finished.\n':''}Workspace: ${dir}\n`);
 if(process.env.FF_RECORD_MANAGED!=='1')spawn('termux-open-url',[origin+'/?record=1'],{stdio:'ignore'}).on('error',()=>{});
}catch(error){app.server.close();app.db.close();throw error;}
