import type { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes } from 'node:crypto';
import { passwordHash, passwordOK } from './auth.ts';
export type Showcase = {runId:string; admin:{id:string,email:string,password:string}; other:{id:string,email:string,password:string}; client:{email:string,password:string,name:string}};
export function seedShowcase(db:DatabaseSync):Showcase {
 if((db.prepare('SELECT COUNT(*) n FROM users').get() as any).n)throw Error('Recording setup requires a fresh database. Existing users will not be changed.');
 const runId=randomUUID(),password=()=>randomBytes(24).toString('base64url');
 const config={runId,admin:{id:randomUUID(),email:'recording-alex@form-fire.example',password:password()},other:{id:randomUUID(),email:'recording-robin@form-fire.example',password:password()},client:{email:'recording-sam@form-fire.example',password:password(),name:'Sam (fictional)'}};
 db.exec('BEGIN IMMEDIATE');try{
 for(const [role,u,name] of [['admin',config.admin,'Alex (fictional)'],['client',config.other,'Robin (fictional)']] as const)db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(u.id,u.email,name,passwordHash(u.password),role);
 db.prepare('INSERT INTO content_packs(id) VALUES(?)').run('screen-recording:'+runId);
 db.exec('COMMIT');return config;
 }catch(error){db.exec('ROLLBACK');throw error;}
}
export function validateShowcase(db:DatabaseSync,config?:Showcase) {
 if(!config)return null;
 if((process.env.FF_MODE||'local-test')!=='local-test'||!db.prepare('SELECT id FROM content_packs WHERE id=?').get('screen-recording:'+config.runId))throw Error('Recording mode requires its own fictional workspace.');
 const rows=db.prepare('SELECT * FROM users').all() as any[];
 if(rows.length!==2)throw Error('Recording mode must start with only its two fixture accounts. Start a fresh recording run.');
 for(const [role,u] of [['admin',config.admin],['client',config.other]] as const){const row=rows.find(r=>r.id===u.id);if(!row||row.role!==role||row.email!==u.email||!row.email.endsWith('@form-fire.example')||!passwordOK(u.password,row.password))throw Error('Recording credentials do not match their fictional accounts.');}
 if(config.client.email!=='recording-sam@form-fire.example')throw Error('Unexpected recording client.');
 return config;
}
