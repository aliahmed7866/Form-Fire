import { openDb, id, transaction } from './db.ts';
import { passwordHash, token, totpSecret, totp } from './auth.ts';
import { backup } from 'node:sqlite';
import { resolve } from 'node:path';
import { chmodSync, mkdirSync } from 'node:fs';
import { setupAdminTest, readAdminTestOTP, recoverAdminTest } from './admin-test.ts';
const dir=process.env.FF_DATA_DIR||'data',db=openDb(dir),[command,arg]=process.argv.slice(2);
try {
 if(command==='setup-admin-test') {
   const result=setupAdminTest(db);
   console.log('FORM & FIRE · private local test administrator');
   console.log(`Email: ${result.email}`);
   if(result.created) console.log(`Password: ${result.password}\nAuthenticator setup key: ${result.secret}\nStore these privately now; this command will not show the password or setup key again.\nAdd the setup key to an authenticator app (TOTP, 6 digits, 30 seconds).`);
   else console.log('The existing password, authenticator and test records have been kept.');
   console.log(`Current test code: ${result.currentOTP} (changes every 30 seconds)\nSign in with email, password and the current authenticator code.\nFresh code: form-fire admin read-test-otp\nForgotten password: form-fire admin recover-admin-test`);
   console.log(result.samples.created?`Created two fictional Example clients, two requests, ${result.samples.assignments} plan copies and one welcome check-in. No activity or payments were invented.`:'Example records were already installed. Edits and deletions are preserved.');
   if(result.samples.skipped.length)console.log('Skipped edited, archived or unavailable starter plans: '+result.samples.skipped.join(', ')+'. Use Plan studio to publish a plan yourself.');
   console.log('Try Requests → Example · Jamie; Plan studio / Publish → Example · Sam; then Check-ins.');
 } else if(command==='read-test-otp') {
   console.log('Current test admin code: '+readAdminTestOTP(db)+' (changes every 30 seconds)');
 } else if(command==='recover-admin-test') {
   console.log('Private one-use reset code (expires in one hour): '+recoverAdminTest(db));
   console.log('Open Sign in → Reset password and enter this code with a new password. The current password is unchanged until then. Your authenticator and records are kept.');
 } else if(command==='create-admin') {
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
   transaction(db,()=>{const uid=u.id;for(const table of ['payments'])db.prepare(`DELETE FROM ${table} WHERE invoice_id IN (SELECT id FROM invoices WHERE user_id=?)`).run(uid);db.prepare('DELETE FROM replies WHERE request_id IN (SELECT id FROM requests WHERE user_id=?) OR author_id=?').run(uid,uid);db.prepare('DELETE FROM request_events WHERE request_id IN (SELECT id FROM requests WHERE user_id=?)').run(uid);for(const table of ['sessions','tokens','outbox','plan_activity','assignments','checkins','invoices','account_requests','requests'])db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(uid);db.prepare('DELETE FROM users WHERE id=?').run(uid);db.prepare('INSERT INTO audit(id,action,entity_id) VALUES(?,?,?)').run(id(),'local.account.deleted',uid);});
   console.log('Local test account deleted. The backup still contains its prior data; remove it when no longer needed. Real retention policy must be agreed before launch.');
 } else console.log('Commands: setup-admin-test | read-test-otp | recover-admin-test | create-admin EMAIL | outbox | test-otp EMAIL | backup [DESTINATION] | delete-requested-account EMAIL');
} catch(e:any) {console.error(e.message);process.exitCode=1;} finally {db.close();}
