import { openDb, id, transaction } from './db.ts';
import { passwordHash, token, totpSecret, totp } from './auth.ts';
import { backup } from 'node:sqlite';
import { resolve } from 'node:path';
import { chmodSync, mkdirSync } from 'node:fs';
const dir=process.env.FF_DATA_DIR||'data',db=openDb(dir),[command,arg]=process.argv.slice(2);
try {
 if(command==='create-admin') {
   if(!arg||!arg.includes('@'))throw Error('Usage: npm run admin -- create-admin alex@example.test');
   if(db.prepare('SELECT id FROM users WHERE email=?').get(arg))throw Error('That account already exists. Client accounts are never automatically promoted.');
   const password=process.env.FF_ADMIN_PASSWORD||token().slice(0,24),secret=totpSecret();
   if(password.length<12)throw Error('Use a password of at least 12 characters.');
   db.prepare("INSERT INTO users(id,email,name,password,role,verified,totp_secret) VALUES(?,?,?,?,'admin',1,?)").run(id(),arg,'Alex',passwordHash(password),secret);
   console.log(`Local test administrator created. Store these privately.\nEmail: ${arg}\nPassword: ${password}\nAuthenticator setup key: ${secret}\nAdd the setup key to an authenticator app (TOTP, 6 digits, 30 seconds).`);
 } else if(command==='outbox') {
   const rows=db.prepare('SELECT u.email,o.kind,o.token,o.created_at FROM outbox o JOIN users u ON u.id=o.user_id ORDER BY o.created_at').all();
   console.log('LOCAL TEST OUTBOX — no email was sent. Codes expire after one hour.');for(const r of rows)console.log(`${r.email} | ${r.kind} | ${r.token} | ${r.created_at} UTC`);
 } else if(command==='test-otp') {
   const u=db.prepare("SELECT totp_secret FROM users WHERE email=? AND role='admin'").get(arg||'') as any;if(!u)throw Error('Administrator not found.');console.log('Local test code: '+totp(u.totp_secret));
 } else if(command==='backup') {
   const destination=resolve(arg||`${dir}/backups/form-fire-${new Date().toISOString().replaceAll(':','-')}.sqlite`);mkdirSync(resolve(destination,'..'),{recursive:true,mode:0o700});await backup(db,destination);chmodSync(destination,0o600);console.log('Backup saved: '+destination);
 } else if(command==='delete-requested-account') {
   const u=db.prepare("SELECT * FROM users WHERE email=? AND role='client'").get(arg||'') as any;
   if(!u||!db.prepare("SELECT id FROM account_requests WHERE user_id=? AND status='requested'").get(u.id))throw Error('A pending client deletion request is required.');
   const destination=resolve(`${dir}/backups/before-deletion-${Date.now()}.sqlite`);mkdirSync(resolve(destination,'..'),{recursive:true,mode:0o700});await backup(db,destination);chmodSync(destination,0o600);
   transaction(db,()=>{const uid=u.id;for(const table of ['payments'])db.prepare(`DELETE FROM ${table} WHERE invoice_id IN (SELECT id FROM invoices WHERE user_id=?)`).run(uid);db.prepare('DELETE FROM replies WHERE request_id IN (SELECT id FROM requests WHERE user_id=?) OR author_id=?').run(uid,uid);db.prepare('DELETE FROM request_events WHERE request_id IN (SELECT id FROM requests WHERE user_id=?)').run(uid);for(const table of ['sessions','tokens','outbox','assignments','checkins','invoices','account_requests','requests'])db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(uid);db.prepare('DELETE FROM users WHERE id=?').run(uid);db.prepare('INSERT INTO audit(id,action,entity_id) VALUES(?,?,?)').run(id(),'local.account.deleted',uid);});
   console.log('Local test account deleted. The backup still contains its prior data; remove it when no longer needed. Real retention policy must be agreed before launch.');
 } else console.log('Commands: create-admin EMAIL | outbox | test-otp EMAIL | backup [DESTINATION] | delete-requested-account EMAIL');
} catch(e:any) {console.error(e.message);process.exitCode=1;} finally {db.close();}
