#!/usr/bin/env bash
# FORM & FIRE: complete fictional test data, in a separate local-only database.
# Usage: bash form-fire-demo.sh [start|foreground|seed|logins|otp|codes|recover|repair-logins|status|stop] [APP_DIRECTORY] [DEMO_EMAIL]
# Defaults: app ~/Form-Fire; demo port 8086. No packages or Git changes are made.
set -euo pipefail
umask 077
FF_DEMO_ACTION="${1:-start}"
case "$FF_DEMO_ACTION" in start|foreground|seed|logins|otp|codes|recover|repair-logins|status|stop) ;; *) echo 'Usage: bash form-fire-demo.sh [start|foreground|seed|logins|otp|codes|recover|repair-logins|status|stop] [APP_DIRECTORY] [DEMO_EMAIL]' >&2; exit 1;; esac
FF_DEMO_APP="${2:-${FF_DEMO_APP:-$HOME/Form-Fire}}"
if [ ! -f "$FF_DEMO_APP/src/server.ts" ] && [ -f "$PWD/src/server.ts" ]; then FF_DEMO_APP="$PWD"; fi
if [ ! -f "$FF_DEMO_APP/migrations/007_shopping_progress.sql" ]; then
  echo 'Use the updated FORM & FIRE checkout (including Shop & prepare).' >&2
  echo 'Run ~/.local/bin/form-fire update, then try this script again.' >&2
  echo 'For another checkout location, pass: start /path/to/Form-Fire' >&2
  exit 1
fi
export FF_DEMO_SCRIPT="$(realpath "${BASH_SOURCE[0]}")"
cd "$FF_DEMO_APP"
FF_DEMO_APP="$PWD"
export FF_DEMO_ACTION
export FF_DEMO_EMAIL="${3:-}"
export FF_DEMO_ROOT="${FF_DEMO_ROOT:-$HOME/.local/share/form-fire-demo}"
export FF_DEMO_PORT="${FF_DEMO_PORT:-8086}"
# Never inherit the installed app's database, OAuth credentials or transport.
export FF_DATA_DIR="$FF_DEMO_ROOT"
export FF_MODE=local-test FF_HOST=127.0.0.1 FF_PORT="$FF_DEMO_PORT"
export FF_ORIGIN="http://127.0.0.1:$FF_DEMO_PORT"
unset FF_GOOGLE_CLIENT_ID FF_GOOGLE_CLIENT_SECRET FF_TLS_CERT_FILE FF_TLS_KEY_FILE
node --input-type=module <<'JS'
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, writeFileSync, lstatSync, chmodSync, realpathSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { openDb, id, transaction } from './src/db.ts';
import { passwordOK, passwordHash, token, totpSecret, totp, digest } from './src/auth.ts';
import { planContent, planSnapshot } from './src/plan-library.ts';

const root=resolve(process.env.FF_DEMO_ROOT), action=process.env.FF_DEMO_ACTION;
const marker='form-fire-complete-fictional-demo-v1';
const database=join(root,'form-fire.sqlite'), manifest=join(root,'demo-only.json'), credentials=join(root,'demo-logins.json');
const port=Number(process.env.FF_DEMO_PORT);
if(!Number.isInteger(port)||port<1024||port>65535||port===8085)throw Error('Choose a separate demo port (1024–65535, not 8085). Default: 8086.');
if(existsSync(root)&&lstatSync(root).isSymbolicLink())throw Error('The demo directory must not be a symbolic link.');
mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
for(const file of [database,manifest,credentials,join(root,'demo-logins.pending.json')])if(existsSync(file)&&lstatSync(file).isSymbolicLink())throw Error('Refusing a linked demo file.');
const ownership=existsSync(manifest)?JSON.parse(readFileSync(manifest,'utf8')):null;
if(existsSync(database)&&ownership?.marker!==marker)throw Error('This folder contains an unrecognised database. Nothing has been seeded. Choose a new empty FF_DEMO_ROOT folder.');
if(ownership&&ownership.marker!==marker)throw Error('This directory belongs to another task. Choose a new empty FF_DEMO_ROOT folder.');
if(['otp','codes','logins','recover','repair-logins','status','stop'].includes(action)&&!existsSync(database))throw Error('Run this script with start or seed first.');
// Fail before seeding if a process already owns the requested demo port.
if(action==='foreground')await new Promise((ok,no)=>{const probe=createServer();probe.once('error',()=>no(Error(`Port ${port} is in use. Stop the earlier demo with Ctrl+C, or choose FF_DEMO_PORT=8087.`)));probe.listen(port,'127.0.0.1',()=>probe.close(ok));});
if(!ownership)writeFileSync(manifest,JSON.stringify({marker,notice:'FICTIONAL DEMO ONLY — all people, bookings, payments and activity are sample records.'},null,2),{flag:'wx',mode:0o600});
const lock=join(root,'seed.lock');
let lockFd;
try{lockFd=openSync(lock,'wx',0o600);}catch{throw Error('Another seed operation may be running. Retry after it finishes. If interrupted, verify no seed is running before removing seed.lock from the demo folder.');}
let db;
try {
  // Inspect an existing file read-only BEFORE openDb can migrate it.
  if(existsSync(database)){
    const check=new DatabaseSync(database,{readOnly:true});
    try {
      const tables=check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
      if(tables.includes('users')) {
        const users=check.prepare('SELECT COUNT(*) n FROM users').get().n;
        const marked=tables.includes('content_packs')&&check.prepare('SELECT id FROM content_packs WHERE id=?').get(marker);
        if(users&&!marked)throw Error('Existing users found without the complete-demo marker. Refusing to alter this database.');
      }
    }finally{check.close();}
  }
  db=openDb(root);
  const run=(sql,...values)=>db.prepare(sql).run(...values);
  const get=(sql,...values)=>db.prepare(sql).get(...values);
  const recoveryFile=join(root,'demo-logins.pending.json');
  if(get('SELECT id FROM content_packs WHERE id=?',marker)&&existsSync(recoveryFile)){
    const pendingLogins=JSON.parse(readFileSync(recoveryFile,'utf8'));
    if(pendingLogins.marker===marker&&pendingLogins.logins.every(u=>{const account=get('SELECT password FROM users WHERE id=? AND email=?',u.id,u.email);return !account||passwordOK(u.password,account.password);}))renameSync(recoveryFile,credentials);
  }
  if(['status','stop'].includes(action)) {
    if(!get('SELECT id FROM content_packs WHERE id=?',marker))throw Error('This is not a recognised complete demo.');
  }else if(['recover','repair-logins'].includes(action)) {
    if(!get('SELECT id FROM content_packs WHERE id=?',marker))throw Error('This is not a recognised complete demo.');
    const email=process.env.FF_DEMO_EMAIL||'demo-alex@form-fire.example';
    if(!existsSync(credentials))throw Error('The private demo login manifest is missing; refusing to change an unidentified account.');
    const saved=JSON.parse(readFileSync(credentials,'utf8')),login=saved.logins.find(u=>u.email===email);
    if(saved.marker!==marker||!login)throw Error('Choose an email from the dedicated demo login manifest.');
    const account=get('SELECT * FROM users WHERE id=? AND email=?',login.id,email);
    if(!account)throw Error('This demo account was deleted. It will not be recreated.');
    if(action==='recover'){
      const code=token();transaction(db,()=>{run("DELETE FROM tokens WHERE user_id=? AND kind='reset'",account.id);run("DELETE FROM outbox WHERE user_id=? AND kind='reset'",account.id);run("INSERT INTO tokens VALUES(?,?,'reset',?)",digest(code),account.id,Date.now()+3600000);run("INSERT INTO outbox(id,user_id,kind,token) VALUES(?,?,'reset',?)",id(),account.id,code);});
      console.log('Email: '+email+'\nPrivate recovery code: '+code+'\nOpen '+process.env.FF_ORIGIN+'/#/reset and choose a new password. Expires in one hour.');
    }else{
      login.password=token().slice(0,24);const pending=join(root,'demo-logins.pending.json');
      writeFileSync(pending,JSON.stringify(saved,null,2),{mode:0o600});
      transaction(db,()=>{run('UPDATE users SET password=? WHERE id=?',passwordHash(login.password),account.id);run('DELETE FROM sessions WHERE user_id=?',account.id);run("DELETE FROM tokens WHERE user_id=? AND kind='reset'",account.id);run("DELETE FROM outbox WHERE user_id=? AND kind='reset'",account.id);run('INSERT INTO audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)',id(),account.id,'demo.password.repaired',account.id);});
      renameSync(pending,credentials);
      console.log('Repaired only '+email+'\nNew password: '+login.password+'\nPlans, requests and authenticator are preserved.');
    }
  }else if(action==='otp') {
    const admin=get("SELECT totp_secret FROM users WHERE email='demo-alex@form-fire.example' AND role='admin'");
    if(!admin)throw Error('The demo administrator is missing. No existing account will be replaced.');
    console.log('Demo admin authenticator code: '+totp(admin.totp_secret)+' (changes every 30 seconds)');
  }else if(action==='codes'){
    console.log('LOCAL DEMO OUTBOX — no email was sent. Codes expire after one hour.');
    for(const row of db.prepare('SELECT u.email,o.kind,o.token,o.created_at FROM outbox o JOIN users u ON u.id=o.user_id ORDER BY o.created_at').all())console.log(`${row.email} | ${row.kind} | ${row.token} | ${row.created_at} UTC`);
    console.log('For an expired code, use Resend verification or Reset password in the demo app, then run codes again.');
  }else {
    const seeded=!!get('SELECT id FROM content_packs WHERE id=?',marker);
    const pending=join(root,'demo-logins.pending.json');
    if(seeded&&!existsSync(credentials)&&existsSync(pending))renameSync(pending,credentials);
    if(!seeded){
      if(get('SELECT COUNT(*) n FROM users').n)throw Error('Seed requires an empty or already marked demo database.');
      const definitions=[
        ['alex','Alex · DEMO admin','admin',1,'Admin: requests, plans, clients, chef bookings, money and check-ins'],
        ['sam','DEMO · Sam','client',1,'Active combined plan, saved shopping ticks, activity and plan history'],
        ['morgan','DEMO · Morgan','client',1,'Active training, workout logs and paid invoice'],
        ['robin','DEMO · Robin','client',1,'Active meal plan, shopping and partly paid invoice'],
        ['jamie','DEMO · Jamie','client',1,'New request: try review, approval, activation and plan assignment'],
        ['casey','DEMO · Casey','client',1,'Awaiting your reply: try the request conversation'],
        ['taylor','DEMO · Taylor','client',1,'Approved request awaiting activation'],
        ['avery','DEMO · Avery','client',1,'Private chef enquiries, proposals, accepted/confirmed/cancelled bookings'],
        ['riley','DEMO · Riley','client',1,'Paused plan history, declined/withdrawn requests and deletion request'],
        ['jordan','DEMO · Jordan','client',0,'Unverified account: try verification using the local outbox']
      ];
      const logins=definitions.map(([key,name,role,verified,journey])=>({key,id:id(),name,email:`demo-${key}@form-fire.example`,password:token().slice(0,24),role,verified,journey,...(role==='admin'?{secret:totpSecret()}: {})}));
      // Save credentials privately before the DB transaction; recover after interruption.
      writeFileSync(pending,JSON.stringify({marker,logins},null,2),{mode:0o600});chmodSync(pending,0o600);
      transaction(db,()=>{
        const users=Object.fromEntries(logins.map(u=>[u.key,u]));
        const now=new Date(),dayOffset=n=>new Date(now.getTime()+n*86400000).toISOString().slice(0,10);
        const when=n=>new Date(now.getTime()+n*86400000).toISOString().slice(0,19).replace('T',' ');
        const audit=(action,entity,day=-1)=>run('INSERT INTO audit(id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?)',id(),users.alex.id,action,entity,when(day));
        for(const u of logins)run('INSERT INTO users(id,email,name,password,role,verified,totp_secret,profile,admin_notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',u.id,u.email,u.name,passwordHash(u.password),u.role,u.verified,u.secret||null,JSON.stringify({goals:'FICTIONAL: build a comfortable routine around training and enjoyable food.',preferences:'FICTIONAL: practical meals and flexible preparation.',dietary:'DEMO ONLY: no real medical information or allergen assurance.'}),'DEMO: private admin note; must not appear in client responses or export.',when(-30));
        const verification=token();run("INSERT INTO tokens VALUES(?,?,'verify',?)",digest(verification),users.jordan.id,Date.now()+3600000);
        run("INSERT INTO outbox(id,user_id,kind,token) VALUES(?,?,'verify',?)",id(),users.jordan.id,verification);
        // Prices are fictional and exist only in this isolated demo database.
        for(const [sid,amount] of [['train',6500],['eat',4500],['both',9500],['chef',null]])run("UPDATE services SET title='DEMO · '||title,description='FICTIONAL TEST SERVICE. '||description,price_minor=? WHERE id=?",amount,sid);
        run("INSERT INTO services(id,title,kind,description,inclusions,published,archived) VALUES('demo-draft','DEMO · Draft coaching package','both','Fictional unpublished package','Example training and meal planning',0,0)");
        run("INSERT INTO services(id,title,kind,description,inclusions,published,archived) VALUES('demo-archived','DEMO · Archived package','train','Fictional archived package','Historical example',0,1)");
        const makeRequest=(who,service,status='submitted',active=0,extra={})=>{
          const rid=id(),chef=service==='chef';
          const details=chef?{date:dayOffset(extra.eventDay||21),timezone:'Europe/London',location:'FICTIONAL venue, Exampletown; travel not confirmed',guests:8,occasion:'DEMO birthday gathering',budget_minor:48000,currency:'GBP',dietary:'DEMO: discuss individual requirements; no allergen-safety claim.',notes:'FICTIONAL TEST ENQUIRY. No actual booking or availability.'}:{goals:'FICTIONAL: make space for movement and food I enjoy.',experience:'DEMO: starting a routine.',equipment:'DEMO: a chair, wall and light dumbbells.',availability:'DEMO: two flexible sessions a week.',preferences:'DEMO: easy meals with familiar ingredients.'};
          run('INSERT INTO requests(id,user_id,service_id,kind,details,status,active,package,booking_status,proposal,accepted_at,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',rid,users[who].id,service,chef?'chef':'coaching',JSON.stringify(details),status,active,active?JSON.stringify({description:'DEMO agreed coaching package; fictional price and service.'}):null,extra.booking||'enquiry',extra.proposal?JSON.stringify(extra.proposal):null,['accepted','confirmed'].includes(extra.booking)?when(-2):null,'demo-'+id(),when(-21));
          const steps=status==='submitted'?['submitted']:status==='withdrawn'?['submitted','under_review','withdrawn']:['submitted','under_review',...(status==='under_review'?[]:[status])];
          steps.forEach((s,i)=>run('INSERT INTO request_events(id,request_id,actor_id,status,created_at) VALUES(?,?,?,?,?)',id(),rid,i?users.alex.id:users[who].id,s,when(-21+i)));
          audit('demo.request.'+status,rid,-18);return rid;
        };
        const sam=makeRequest('sam','both','approved',1),morgan=makeRequest('morgan','train','approved',1),robin=makeRequest('robin','eat','approved',1);
        makeRequest('jamie','both');makeRequest('jamie','train','under_review');
        const casey=makeRequest('casey','both','awaiting_client_response');makeRequest('taylor','both','approved');
        const paused=makeRequest('riley','both','approved');makeRequest('riley','train','declined');makeRequest('riley','eat','withdrawn');
        run('INSERT INTO replies(id,request_id,author_id,body,created_at) VALUES(?,?,?,?,?)',id(),casey,users.alex.id,'DEMO: Which days would make the best starting point for you?',when(-1));
        run('INSERT INTO replies(id,request_id,author_id,body,created_at) VALUES(?,?,?,?,?)',id(),sam,users.sam.id,'DEMO: I’d like to keep the cooking simple this week.',when(-5));
        run('INSERT INTO replies(id,request_id,author_id,body,created_at) VALUES(?,?,?,?,?)',id(),sam,users.alex.id,'DEMO: Let’s start with familiar meals and build from there.',when(-4));
        const starterMeal=get("SELECT * FROM templates WHERE id='starter-meals'"),starterTraining=get("SELECT * FROM templates WHERE id='starter-training'");
        const mealContent=JSON.parse(starterMeal.content);for(const meal of mealContent.meals)meal.day='Daily';
        mealContent.schedule='DEMO: three sample meals, recurring daily. This is a software test, not personal dietary advice.';
        for(const [tid,title,kind,content] of [['demo-training','DEMO · Your flexible training week','training',JSON.parse(starterTraining.content)],['demo-meals','DEMO · Everyday food','meal',mealContent]])run('INSERT INTO templates(id,title,kind,content,is_demo) VALUES(?,?,?,?,1)',tid,title,kind,JSON.stringify(planContent(db,kind,content)));
        const archived=JSON.parse(starterTraining.content);run("INSERT INTO templates(id,title,kind,content,is_demo,archived) VALUES('demo-retired-plan','DEMO · Retired template','training',?,1,1)",JSON.stringify(archived));
        run("INSERT INTO recipes(id,title,ingredients,portions,preparation,substitutions,is_demo,archived) VALUES('demo-retired-recipe','DEMO · Retired recipe','Example ingredients','1 example serving','Fictional archived record for UI testing','Review with Alex',1,1)");
        const assign=(who,rid,tid,version=1,day=-14)=>{
          const template=get('SELECT * FROM templates WHERE id=?',tid),aid=id();
          const snapshot=planSnapshot(db,template,'DEMO ONLY: a fictional client version for testing; Alex must tailor any real plan.');
          run('INSERT INTO assignments(id,user_id,request_id,template_id,template_version,version,title,kind,snapshot,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',aid,users[who].id,rid,template.id,template.version,version,template.title,template.kind,JSON.stringify(snapshot),when(day));
          audit('demo.plan.publish',aid,day);return aid;
        };
        const samOld=assign('sam',sam,'demo-training',1,-18),samOldMeal=assign('sam',sam,'demo-meals',1,-18);
        const samTraining=assign('sam',sam,'demo-training',2,-7),samMeal=assign('sam',sam,'demo-meals',2,-7);
        const morganTraining=assign('morgan',morgan,'demo-training'),robinMeal=assign('robin',robin,'demo-meals');assign('riley',paused,'demo-training');assign('riley',paused,'demo-meals');
        const activity=(who,aid,kind,index,day,notes='DEMO: fictional activity log, not a real outcome.')=>run('INSERT INTO plan_activity(assignment_id,user_id,item_kind,item_index,activity_date,timezone,notes,effort,completed_at) VALUES(?,?,?,?,?,?,?,?,?)',aid,users[who].id,kind,index,dayOffset(day),'UTC',notes,kind==='workout'?3:null,when(day));
        activity('sam',samOld,'workout',0,-12);
        for(const day of [-6,-3,0])activity('sam',samTraining,'workout',0,day);
        for(const day of [-5,-4,-2,0])for(const index of [0,1])activity('sam',samMeal,'meal',index,day);
        for(const day of [-10,-7,-2])activity('morgan',morganTraining,'workout',1,day);
        for(const day of [-3,-1,0])activity('robin',robinMeal,'meal',2,day);
        for(const [who,aid,ticks] of [['sam',samOldMeal,[0,2]],['sam',samMeal,[1,3]],['robin',robinMeal,[0]]])run('INSERT INTO shopping_progress(assignment_id,user_id,purchased,revision) VALUES(?,?,?,1)',aid,users[who].id,JSON.stringify(ticks));
        const monday=new Date(now);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
        for(const [who,weeks,feedback] of [['sam',0,''],['sam',1,'DEMO: Thanks for sharing. Let’s keep the next step manageable.'],['sam',2,'DEMO: We can adapt the plan together.'],['morgan',0,''],['morgan',1,'DEMO: Let’s talk about what fitted your week.'],['robin',0,'']]){
          const week=new Date(monday.getTime()-weeks*7*86400000).toISOString().slice(0,10);
          run('INSERT INTO checkins(id,user_id,week,progress,energy,notes,measurements,feedback,created_at) VALUES(?,?,?,?,?,?,?,?,?)',id(),users[who].id,week,'DEMO: a fictional reflection to test this form.',3,'DEMO: I would like to discuss how to fit the plan around my week.','',feedback,when(-weeks*7));
        }
        const proposal=(amount,payment=true)=>({description:'DEMO private dining proposal: fictional menu, date, venue and travel for UI testing only.',amount_minor:amount,currency:'GBP',payment_required:payment});
        makeRequest('avery','chef');
        makeRequest('avery','chef','under_review',0,{booking:'proposed',proposal:proposal(48000),eventDay:14});
        const chefAccepted=makeRequest('avery','chef','approved',0,{booking:'accepted',proposal:proposal(48000),eventDay:21});
        const chefConfirmed=makeRequest('avery','chef','approved',0,{booking:'confirmed',proposal:proposal(60000),eventDay:28});
        makeRequest('avery','chef','approved',0,{booking:'cancelled',proposal:proposal(32000,false),eventDay:35});
        const invoice=(who,rid,amount,currency,description)=>{
          const iid=id(),req=get('SELECT * FROM requests WHERE id=?',rid);
          run('INSERT INTO invoices(id,user_id,request_id,description,amount_minor,currency,price_snapshot,created_at) VALUES(?,?,?,?,?,?,?,?)',iid,users[who].id,rid,'DEMO · '+description,amount,currency,JSON.stringify({description:'FICTIONAL invoice snapshot',amount_minor:amount,currency,package:req.package?JSON.parse(req.package):null,proposal:req.proposal?JSON.parse(req.proposal):null}),when(-5));
          audit('demo.invoice.create',iid,-5);return iid;
        };
        const payment=(iid,amount,kind='payment')=>{const pid=id();run('INSERT INTO payments(id,invoice_id,kind,amount_minor,source,event_key,reference,created_at) VALUES(?,?,?,?,?,?,?,?)',pid,iid,kind,amount,'manual','demo-'+id(),'DEMO ONLY — no money moved',when(-3));audit('demo.manual.'+kind,pid,-3);};
        const samInvoice=invoice('sam',sam,12000,'GBP','Paid coaching with partial refund');payment(samInvoice,12000);payment(samInvoice,2000,'refund');
        const morganInvoice=invoice('morgan',morgan,6500,'GBP','Paid training');payment(morganInvoice,6500);
        const robinInvoice=invoice('robin',robin,4500,'GBP','Partly paid meal plan');payment(robinInvoice,2000);
        invoice('sam',sam,9500,'GBP','Unpaid coaching invoice');
        const euro=invoice('robin',robin,9000,'EUR','Separate currency example');payment(euro,9000);
        invoice('avery',chefAccepted,48000,'GBP','Accepted proposal awaiting payment');
        const confirmedInvoice=invoice('avery',chefConfirmed,60000,'GBP','Paid confirmed booking');payment(confirmedInvoice,60000);
        const refunded=invoice('morgan',morgan,3000,'GBP','Fully refunded example');payment(refunded,3000);payment(refunded,3000,'refund');
        run("INSERT INTO account_requests(id,user_id,kind) VALUES(?,?,'deletion')",id(),users.riley.id);
        audit('demo.seed.complete',marker,0);
        run('INSERT INTO content_packs(id) VALUES(?)',marker);
      });
      renameSync(pending,credentials);chmodSync(credentials,0o600);
      console.log('Created a complete FICTIONAL demo. Existing app records were not touched.');
    }else console.log('Demo already populated. Your edits, passwords and deletions have been preserved.');
    if(existsSync(credentials)){
      const saved=JSON.parse(readFileSync(credentials,'utf8'));
      console.log('\nPRIVATE DEMO LOGINS (passwords checked against this database):');
      for(const login of saved.logins){
        const account=get('SELECT id,email,password,totp_secret FROM users WHERE id=?',login.id);if(!account)continue;
        if(process.env.FF_DEMO_EMAIL&&login.email!==process.env.FF_DEMO_EMAIL)continue;
        if(!process.env.FF_DEMO_EMAIL&&action!=='logins'&&!['alex','sam'].includes(login.key))continue;
        const valid=account.email===login.email&&passwordOK(login.password,account.password);
        console.log(`\n${login.name}\n  Email: ${login.email}\n  ${valid?'Verified password: '+login.password:'Password changed — the old password will not be printed. Use form-fire-demo recover '+login.email}\n  Try: ${login.journey}`);
        if(login.role==='admin'){console.log('  Current authenticator code: '+totp(account.totp_secret)+' (30 seconds)');console.log('  For a fresh code: form-fire-demo otp');}
      }
    }else console.log('Private login file is missing. Existing passwords have not been reset. Use the demo app’s password recovery and the codes command.');
    console.log('\nDEMO SUMMARY:');
    for(const table of ['users','services','requests','replies','exercises','recipes','templates','assignments','plan_activity','shopping_progress','checkins','invoices','payments','account_requests'])console.log(`  ${table}: ${get('SELECT COUNT(*) n FROM '+table).n}`);
    console.log('\nAll people, prices, payments, bookings and activity in this separate database are FICTIONAL.');
    console.log('No emails are sent, Google sign-in is disconnected, and no money moves. Media uploads are not connected.');
    console.log('Demo URL: '+process.env.FF_ORIGIN+'/#/login');
    console.log('Data stays in: '+realpathSync(root));
    console.log('Use form-fire-demo logins to see all accounts; form-fire-demo otp for an admin code; form-fire-demo codes for recovery/verification.');
  }
}finally{
  if(db)db.close();
  closeSync(lockFd);unlinkSync(lock);
}
JS
# Install a private launcher that remembers this exact app, data directory and port.
FF_DEMO_BIN="${FF_DEMO_BIN:-$HOME/.local/bin}"
mkdir -p "$FF_DEMO_BIN"
if [ -e "$FF_DEMO_BIN/form-fire-demo" ] && ! head -n 4 "$FF_DEMO_BIN/form-fire-demo" | grep -q 'FORM-FIRE-DEMO-LAUNCHER'; then
  echo 'Refusing to replace an unrelated form-fire-demo command.' >&2; exit 1
fi
cp "$FF_DEMO_SCRIPT" "$FF_DEMO_ROOT/demo-launcher.sh.tmp"
chmod 700 "$FF_DEMO_ROOT/demo-launcher.sh.tmp"
mv "$FF_DEMO_ROOT/demo-launcher.sh.tmp" "$FF_DEMO_ROOT/demo-launcher.sh"
{
  printf '#!/usr/bin/env bash\n# FORM-FIRE-DEMO-LAUNCHER\nset -euo pipefail\n'
  printf 'export FF_DEMO_ROOT=%q\nexport FF_DEMO_PORT=%q\nexport FF_DEMO_BIN=%q\n' "$FF_DEMO_ROOT" "$FF_DEMO_PORT" "$FF_DEMO_BIN"
  printf 'exec bash %q "${1:-start}" %q "${2:-}"\n' "$FF_DEMO_ROOT/demo-launcher.sh" "$FF_DEMO_APP"
} > "$FF_DEMO_BIN/form-fire-demo.tmp"
chmod 700 "$FF_DEMO_BIN/form-fire-demo.tmp"
mv "$FF_DEMO_BIN/form-fire-demo.tmp" "$FF_DEMO_BIN/form-fire-demo"
if [ "$FF_DEMO_ACTION" = foreground ]; then
  printf '\nKeep this session running. Ctrl+C stops the demo. Open %s/#/login\n' "$FF_ORIGIN"
  exec node src/server.ts
fi
if [ "$FF_DEMO_ACTION" = start ] || [ "$FF_DEMO_ACTION" = status ] || [ "$FF_DEMO_ACTION" = stop ]; then
  if [ -z "${PREFIX:-}" ] || ! command -v sv >/dev/null 2>&1; then
    if [ "$FF_DEMO_ACTION" = start ]; then
      printf '\nNo Termux supervisor found. Running in the foreground; keep this session open.\n'
      exec node src/server.ts
    fi
    echo 'No Termux supervisor found. A foreground demo is stopped with Ctrl+C.' >&2; exit 1
  fi
  FF_DEMO_SERVICE="$PREFIX/var/service/form-fire-demo"
  if [ -e "$FF_DEMO_SERVICE/run" ] && ! head -n 4 "$FF_DEMO_SERVICE/run" | grep -q 'FORM-FIRE-DEMO-SERVICE'; then
    echo 'Refusing to replace an unrelated demo service.' >&2; exit 1
  fi
  if [ "$FF_DEMO_ACTION" = start ]; then
    if [ -f "$FF_DEMO_SERVICE/run" ]; then sv -w 10 down "$FF_DEMO_SERVICE"; fi
    node --input-type=module <<'PORT'
import {createServer} from 'node:net';
await new Promise((ok,no)=>{const server=createServer();server.once('error',()=>no(Error('Demo port is occupied. Stop the old foreground demo with Ctrl+C before starting this managed demo.')));server.listen(Number(process.env.FF_DEMO_PORT),'127.0.0.1',()=>server.close(ok));});
PORT
    mkdir -p "$FF_DEMO_SERVICE/log" "$FF_DEMO_ROOT/logs"
    # Mark down until the run scripts are complete.
    touch "$FF_DEMO_SERVICE/down"
    {
      printf '#!%s/bin/bash\n# FORM-FIRE-DEMO-SERVICE\nset -euo pipefail\nexec 2>&1\n' "$PREFIX"
      printf 'cd %q\nexport FF_DATA_DIR=%q\nexport FF_PORT=%q\nexport FF_ORIGIN=%q\n' "$FF_DEMO_APP" "$FF_DEMO_ROOT" "$FF_DEMO_PORT" "$FF_ORIGIN"
      printf 'export FF_MODE=local-test FF_HOST=127.0.0.1\nunset FF_GOOGLE_CLIENT_ID FF_GOOGLE_CLIENT_SECRET FF_TLS_CERT_FILE FF_TLS_KEY_FILE\nexec node src/server.ts\n'
    } > "$FF_DEMO_SERVICE/run.tmp"
    chmod 700 "$FF_DEMO_SERVICE/run.tmp"; mv "$FF_DEMO_SERVICE/run.tmp" "$FF_DEMO_SERVICE/run"
    printf '#!%s/bin/sh\nexec svlogd -tt "%s"\n' "$PREFIX" "$FF_DEMO_ROOT/logs" > "$FF_DEMO_SERVICE/log/run"
    chmod 700 "$FF_DEMO_SERVICE/log/run"
    if [ -f "$PREFIX/etc/profile.d/start-services.sh" ]; then . "$PREFIX/etc/profile.d/start-services.sh"; fi
    rm -f "$FF_DEMO_SERVICE/down"
    sv -w 10 up "$FF_DEMO_SERVICE"
  elif [ "$FF_DEMO_ACTION" = stop ]; then
    sv -w 10 down "$FF_DEMO_SERVICE"
    echo 'Demo stopped. Your data is preserved.'; exit 0
  else
    sv status "$FF_DEMO_SERVICE" || true
  fi
  # Verify the running server and an actual password login, not just its port.
  if ! node --input-type=module <<'VERIFY'
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {passwordOK,totp,digest} from './src/auth.ts';
const origin=process.env.FF_ORIGIN,root=process.env.FF_DEMO_ROOT;
let health;
for(let attempt=0;attempt<5;attempt++){
  try{const response=await fetch(origin+'/health',{signal:AbortSignal.timeout(2000)});if(response.ok){health=await response.json();break;}}catch{}
  await new Promise(r=>setTimeout(r,500));
}
if(!health?.ok||health.app!=='form-fire')throw Error('Demo is not responding. Run form-fire-demo status and check the demo logs. If an older foreground demo is open, stop it with Ctrl+C first.');
if(health.instance&&health.instance.id!==digest(resolve(root)).slice(0,16))throw Error('This port is serving a different database. No credentials were sent. Stop the other instance or select another demo port.');
const db=new DatabaseSync(join(root,'form-fire.sqlite'),{readOnly:true});
try{
  const saved=process.env.FF_DEMO_ACTION==='start'?JSON.parse(readFileSync(join(root,'demo-logins.json'),'utf8')):{logins:[]};
  for(const login of saved.logins.filter(l=>['alex','sam'].includes(l.key))){
    const user=db.prepare('SELECT * FROM users WHERE id=? AND email=?').get(login.id,login.email);
    if(!user||!passwordOK(login.password,user.password)){console.log(login.email+': stored password has changed; use your new password or form-fire-demo recover '+login.email);continue;}
    const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:login.email,password:login.password,...(user.role==='admin'?{otp:totp(user.totp_secret)}:{})}),signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    if(!response.ok||result.user?.id!==login.id)throw Error('Actual demo login failed for '+login.email+': '+(result.error||'workspace mismatch')+'. Check that the intended demo owns this port.');
    const cookie=response.headers.get('set-cookie')?.split(';')[0];
    if(!cookie)throw Error('Sign-in did not set a session cookie.');
    const sessionResponse=await fetch(origin+'/api/session',{headers:{Cookie:cookie},signal:AbortSignal.timeout(3000)});
    const session=await sessionResponse.json();if(session.user?.id!==login.id)throw Error('Demo session verification failed.');
    await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':result.csrf,Cookie:cookie},body:'{}',signal:AbortSignal.timeout(3000)});
    console.log('Verified live sign-in and session: '+login.email);
  }
}finally{db.close();}
console.log('Demo ready: '+origin+'/#/login');
console.log('Open this address in your normal browser. Do not reuse main-app account details.');
console.log('Useful commands: form-fire-demo logins | form-fire-demo otp | form-fire-demo status | form-fire-demo stop');
VERIFY
  then
    if [ "$FF_DEMO_ACTION" = start ]; then sv -w 10 down "$FF_DEMO_SERVICE" || true; fi
    echo 'Demo checks failed; resolve the error above before signing in.' >&2
    exit 1
  fi
fi
