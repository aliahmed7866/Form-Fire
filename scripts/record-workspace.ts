// Private, recording-only manifests let a supervised server reopen the SAME take.
import {lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {basename,dirname,join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {openDb} from '../src/db.ts';
import {seedShowcase,validateShowcase} from '../src/showcase.ts';

export function recordingSettings(){
 const parent=resolve(process.env.FF_RECORD_ROOT||join(homedir(),'.local/share/form-fire-recordings'));
 let saved='8088';
 if(!process.env.FF_RECORD_PORT){
  try{saved=readFileSync(join(parent,'active-port'),'utf8').trim();if(!/^\d{4,5}$/.test(saved))throw Error('Invalid saved recording port. Set FF_RECORD_PORT explicitly to recover.');}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
 const port=Number(process.env.FF_RECORD_PORT||saved);
 if(!Number.isInteger(port)||port<1024||port>65535||[8085,8086].includes(port))throw Error('Choose a recording port from 1024–65535, separate from 8085/8086. Default: 8088.');
 return {port,origin:`http://127.0.0.1:${port}`,parent};
}
export async function assertRecordingPortFree(port:number){
 await new Promise<void>((ok,no)=>{
  const probe=createServer();
  probe.once('error',error=>{
   const code=error.code||'UNKNOWN';
   const message=code==='EADDRINUSE'
    ? `Recording port ${port} is busy (EADDRINUSE). The existing listener was left running. On Termux, remove an explicit FF_RECORD_PORT setting and run bash termux/record.sh fresh to choose an available port. For foreground recording, choose another FF_RECORD_PORT.`
    : `Cannot open recording port ${port} (${code}): ${error.message}`;
   no(Object.assign(new Error(message,{cause:error}),{code}));
  });
  probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?no(error):ok()));
 });
}
// Only a new take can change origin. An existing take must resume on its saved port.
export async function chooseRecordingPort(allowFallback:boolean){
 const {port}=recordingSettings();
 try{await assertRecordingPortFree(port);return port;}
 catch(error){if(!allowFallback||error.code!=='EADDRINUSE')throw error;}
 for(let candidate=8088;candidate<=8118;candidate++){
  if(candidate===port)continue;
  if(process.env.PREFIX){
   // Do not claim another service, including a stopped one or a broken symlink.
   try{lstatSync(join(process.env.PREFIX,'var/service',`form-fire-recording-${candidate}`));continue;}
   catch(error){if(error.code!=='ENOENT')throw error;}
  }
  try{await assertRecordingPortFree(candidate);return candidate;}
  catch(error){if(error.code!=='EADDRINUSE')throw error;}
 }
 throw Error('No available recording port between 8088 and 8118. Choose another port with FF_RECORD_PORT. Existing listeners and saved takes were left intact.');
}
export function rememberRecordingPort(){
 const {port,parent}=recordingSettings();
 mkdirSync(parent,{recursive:true,mode:0o700});
 const temporary=join(parent,`.active-port-${randomUUID()}`);
 try{writeFileSync(temporary,String(port)+'\n',{mode:0o600,flag:'wx'});renameSync(temporary,join(parent,'active-port'));}
 finally{rmSync(temporary,{force:true});}
}
export async function prepareRecording(){
 const settings=recordingSettings();await assertRecordingPortFree(settings.port);
 mkdirSync(settings.parent,{recursive:true,mode:0o700});
 const dir=mkdtempSync(join(settings.parent,'take-')),db=openDb(dir);
 try{
  const showcase=seedShowcase(db);
  writeFileSync(join(dir,'recording-only.json'),JSON.stringify({version:1,tourVersion:2,fictional:true,port:settings.port,created_at:new Date().toISOString(),showcase}),{mode:0o600,flag:'wx'});
  return {dir,showcase};
 }finally{db.close();}
}
export function loadRecording(dir:string){
 const settings=recordingSettings();dir=resolve(dir);
 if(!basename(dir).startsWith('take-')||lstatSync(dir).isSymbolicLink()||realpathSync(dirname(dir))!==realpathSync(settings.parent))throw Error('The saved take must be a dedicated directory inside the recording workspace.');
 for(const name of ['recording-only.json','form-fire.sqlite','form-fire.sqlite-wal','form-fire.sqlite-shm']){
  let stat;try{stat=lstatSync(join(dir,name));}catch(error){if(error.code==='ENOENT'&&['form-fire.sqlite-wal','form-fire.sqlite-shm'].includes(name))continue;throw error;}
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Refusing a linked or invalid recording file.');
 }
 const saved=JSON.parse(readFileSync(join(dir,'recording-only.json'),'utf8'));
 if(saved.version!==1||saved.tourVersion!==2||saved.fictional!==true||saved.port!==settings.port||!saved.showcase)throw Error('This take cannot be resumed by this recorder. Run bash termux/record.sh fresh.');
 const db=new DatabaseSync(join(dir,'form-fire.sqlite'),{readOnly:true});
 try{validateShowcase(db,saved.showcase,true);}finally{db.close();}
 return {dir,showcase:saved.showcase};
}
