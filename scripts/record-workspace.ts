// Private, recording-only manifests let a supervised server reopen the SAME take.
import {lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {createServer} from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {openDb} from '../src/db.ts';
import {seedShowcase,validateShowcase} from '../src/showcase.ts';

export function recordingSettings(){
 const port=Number(process.env.FF_RECORD_PORT||8088);
 if(!Number.isInteger(port)||port<1024||port>65535||[8085,8086].includes(port))throw Error('Choose a recording port from 1024–65535, separate from 8085/8086. Default: 8088.');
 return {port,origin:`http://127.0.0.1:${port}`,parent:resolve(process.env.FF_RECORD_ROOT||join(homedir(),'.local/share/form-fire-recordings'))};
}
export async function assertRecordingPortFree(port:number){
 await new Promise<void>((ok,no)=>{const probe=createServer();probe.once('error',()=>no(Error(`Recording port ${port} is busy. Stop the previous recording server before starting another take.`)));probe.listen(port,'127.0.0.1',()=>probe.close(()=>ok()));});
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
