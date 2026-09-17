import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDb, id, transaction } from './db.ts';
import { token, digest, passwordHash, passwordOK, passwordNeedsUpgrade, totpOK } from './auth.ts';
import { LibraryError, exerciseInput, planContent, planSnapshot } from './plan-library.ts';
import { ActivityError, activityRange, clientActivity, saveActivity, adminActivity } from './activity.ts';
import { createGoogleAuth, GoogleAuthError, type GoogleConfig } from './google-auth.ts';
import { ShoppingError, shoppingLists, saveShopping, shoppingExport } from './shopping.ts';
import { instanceCookie, instanceInfo } from './instance.ts';
import { transportConfig } from './transport.ts';

class HttpError extends Error { status: number; constructor(status:number,message:string){super(message);this.status=status;} }
function check(ok:any, message:string, status=400): asserts ok { if(!ok) throw new HttpError(status,message); }
function text(v:any,name:string,max=4000,required=true) { check(typeof v==='string',`${name} must be text.`); const s=v.trim(); check((!required||s.length>0)&&s.length<=max,`${name} ${required?'is required and ':''}must be at most ${max} characters.`);return s; }
function choice(v:any,choices:string[],name:string) { check(choices.includes(v),`Choose a valid ${name}.`);return v; }
function integer(v:any,name:string,min=0,max=100000000) { check(Number.isSafeInteger(v)&&v>=min&&v<=max,`${name} must be a whole number from ${min} to ${max}.`);return v; }
function currency(v:any) { check(typeof v==='string'&&/^[A-Z]{3}$/.test(v),'Use a three-letter currency code.');return v; }
function date(v:any,name:string) {const valid=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v));check(valid&&new Date(v).toISOString().slice(0,10)===v,`Enter a valid ${name}.`);return v;}
const parse=(v:any)=>v ? JSON.parse(v) : null;
const safeUser=(u:any)=>({id:u.id,email:u.email,name:u.name,role:u.role,verified:!!u.verified,profile:parse(u.profile)});
const transitions:Record<string,string[]>={submitted:['under_review','withdrawn'],under_review:['awaiting_client_response','approved','declined','withdrawn'],awaiting_client_response:['under_review','withdrawn'],approved:['withdrawn'],declined:[],withdrawn:[]};
export function createApp(options:{dataDir?:string,origin?:string,google?:GoogleConfig,googleFetch?:typeof fetch}={}) {
  check((process.env.FF_MODE||'local-test')==='local-test','Only local-test mode is implemented; do not use real client data.');
  const transport=transportConfig(process.env,options.origin),{origin}=transport;
  const dataDir=options.dataDir||process.env.FF_DATA_DIR||'data';
  const db=openDb(dataDir);
  const sessionCookie=instanceCookie(origin),googleCookie=instanceCookie(origin,'ff_google');
  const instance=instanceInfo(dataDir,origin,!!db.prepare('SELECT id FROM content_packs WHERE id=?').get('form-fire-complete-fictional-demo-v1'));
  const google=createGoogleAuth(db,origin,options.google,options.googleFetch);
  const rate=new Map<string,{count:number,until:number}>();
  const dummyHash=passwordHash(token());
  const get=(sql:string,...args:any[])=>db.prepare(sql).get(...args) as any;
  const all=(sql:string,...args:any[])=>db.prepare(sql).all(...args) as any[];
  const run=(sql:string,...args:any[])=>db.prepare(sql).run(...args);
  const audit=(actor:string,action:string,entity:string)=>run('INSERT INTO audit(id,actor_id,action,entity_id) VALUES(?,?,?,?)',id(),actor,action,entity);
  function issueToken(userId:string,kind:string) { const t=token();run('DELETE FROM tokens WHERE user_id=? AND kind=?',userId,kind);run('DELETE FROM outbox WHERE user_id=? AND kind=?',userId,kind);run('INSERT INTO tokens VALUES(?,?,?,?)',digest(t),userId,kind,Date.now()+3600000);run('INSERT INTO outbox(id,user_id,kind,token) VALUES(?,?,?,?)',id(),userId,kind,t); }
  function decorateRequest(r:any) {return {...r,details:parse(r.details),package:parse(r.package),proposal:parse(r.proposal),replies:all('SELECT r.id,r.body,r.created_at,u.name,u.role FROM replies r JOIN users u ON u.id=r.author_id WHERE request_id=? ORDER BY r.created_at,r.rowid',r.id),history:all('SELECT status,created_at FROM request_events WHERE request_id=? ORDER BY created_at,rowid',r.id)};}
  function decorateInvoice(i:any) { const p=all('SELECT id,kind,amount_minor,source,reference,created_at FROM payments WHERE invoice_id=? ORDER BY created_at',i.id); const paid=p.filter(x=>x.kind==='payment').reduce((s,x)=>s+x.amount_minor,0), refunded=p.filter(x=>x.kind==='refund').reduce((s,x)=>s+x.amount_minor,0); return {...i,price_snapshot:parse(i.price_snapshot),payments:p,paid_minor:paid,refunded_minor:refunded,outstanding_minor:Math.max(0,i.amount_minor-paid)}; }
  async function body(req:IncomingMessage) { let chunks:Buffer[]=[];let size=0;for await(const c of req) {size+=c.length;check(size<=65536,'Request is too large.',413);chunks.push(c);}try {const v=JSON.parse(Buffer.concat(chunks).toString()||'{}');check(v&&typeof v==='object'&&!Array.isArray(v),'Expected an object.');return v;}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Send valid JSON.');} }
  const handle=async(req:IncomingMessage,res:ServerResponse)=>{
    const send=(status:number,value:any)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url=new URL(req.url||'/',origin), p=url.pathname, method=req.method||'GET';
      // Restrict Host as well as Origin to prevent DNS rebinding against this local app.
      check(req.headers.host===new URL(origin).host,'Unexpected host.',403);
      if(p==='/health'&&method==='GET') { get('SELECT 1');return send(200,{ok:true,app:'form-fire',mode:'local-test',instance}); }
      if(!p.startsWith('/api/')) {
        check(method==='GET','Method not allowed.',405);
        const files:Record<string,[string,string]>={'/exercise-catalog.js':['exercise-catalog.js','text/javascript'],'/exercise-catalog-extra.js':['exercise-catalog-extra.js','text/javascript'],'/exercise-motion.js':['exercise-motion.js','text/javascript'],'/exercise-motion.css':['exercise-motion.css','text/css'],'/experience.js':['experience.js','text/javascript'],'/lifestyle-art.js':['lifestyle-art.js','text/javascript'],'/google-mark.svg':['google-mark.svg','image/svg+xml'],'/art-outdoors.svg':['art-outdoors.svg','image/svg+xml'],'/art-rest.svg':['art-rest.svg','image/svg+xml'],'/art-kitchen.svg':['art-kitchen.svg','image/svg+xml'],'/art-stretch.svg':['art-stretch.svg','image/svg+xml'],'/brand-mark.svg':['brand-mark.svg','image/svg+xml'],'/art-training.svg':['art-training.svg','image/svg+xml'],'/art-nourish.svg':['art-nourish.svg','image/svg+xml'],'/art-dining.svg':['art-dining.svg','image/svg+xml'],'/art-rhythm.svg':['art-rhythm.svg','image/svg+xml'],'/navigation.js':['navigation.js','text/javascript'],'/responsive.css':['responsive.css','text/css'],'/enrichment.js':['enrichment.js','text/javascript'],'/daily-plan.js':['daily-plan.js','text/javascript'],'/plan-studio.js':['plan-studio.js','text/javascript'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/hero.svg':['hero.svg','image/svg+xml']};
        const [file,type]=files[p]||['index.html','text/html'];
        res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});return res.end(readFileSync(new URL('../public/'+file,import.meta.url)));
      }
      if(method!=='GET') {
        check(req.headers.origin===origin,'Refresh this page and try again (origin mismatch).',403);
        check((req.headers['content-type']||'').split(';')[0].trim().toLowerCase()==='application/json','Use JSON requests.',415);
        check(!req.headers['content-encoding']||req.headers['content-encoding']==='identity','Compressed requests are not supported.',415);
      }
      const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
      const session=cookie?get('SELECT * FROM sessions WHERE id=? AND expires>?',digest(cookie),Date.now()):null;
      const user=session?get('SELECT * FROM users WHERE id=?',session.user_id):null;
      if(session&&method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)return send(403,{error:'Your session changed in another tab. Refresh your session and try again.',code:'session_changed'});
      const signed=()=>{check(user,'Please sign in.',401);return user;};
      const verified=()=>{signed();check(user.verified,'Verify your email before submitting.',403);return user;};
      const activityOwner=()=>{verified();check(user.role==='client','Only clients can record their own activity.',403);return user;};
      const admin=()=>{signed();check(user.role==='admin','Administrator access required.',403);return user;};
      const ownedRequest=(requestId:string)=>{signed();const r=get('SELECT * FROM requests WHERE id=?',requestId);check(r&&(r.user_id===user.id||user.role==='admin'),'Request not found.',404);return r;};
      function limit(bucket:string,max:number) { const now=Date.now(),key=`${req.socket.remoteAddress}:${bucket}`; if(rate.size>10000)for(const [k,v]of rate)if(v.until<now)rate.delete(k);const r=rate.get(key);if(!r||r.until<now)rate.set(key,{count:1,until:now+900000});else{r.count++;check(r.count<=max,'Too many attempts. Please wait 15 minutes.',429);} }
      const b=method!=='GET'?await body(req):{};
      if(p==='/api/session'&&method==='GET')return send(200,{user:user?safeUser(user):null,csrf:session?.csrf,mode:'local-test',instance,connections:{email:false,managedAuth:false,payments:false,uploads:false,google:google.enabled}});
      if(p==='/api/auth/google/status'&&method==='GET')return send(200,{enabled:google.enabled,redirect_uri:google.redirectUri});
      if(['/api/auth/google/start','/api/auth/google/callback'].includes(p)&&method==='GET') {
        const browser=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(googleCookie+'='))?.slice(googleCookie.length+1);
        const redirect=(location:string)=>{res.writeHead(303,{Location:location});res.end();};
        try {
          if(p.endsWith('/start')) {
            check(!req.headers.origin||req.headers.origin===origin,'Start Google sign-in from this app.',403);
            check(!req.headers['sec-fetch-site']||['same-origin','none'].includes(String(req.headers['sec-fetch-site'])),'Start Google sign-in from this app.',403);
            limit('google',20);
            const flow=google.begin(url.searchParams.get('next'),browser);res.setHeader('Set-Cookie',flow.cookie);return redirect(flow.location);
          }
          res.setHeader('Set-Cookie',google.clearCookie());
          const result=await google.complete(url.searchParams,browser);
          const t=token(),csrf=token();
          transaction(db,()=>{if(session)run('DELETE FROM sessions WHERE id=?',session.id);run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?,?)',digest(t),result.userId,csrf,Date.now()+8*3600000);});
          res.setHeader('Set-Cookie',[google.clearCookie(),`${sessionCookie}=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`]);return redirect('/#'+result.next);
        }catch(error){if(error instanceof HttpError)throw error;res.setHeader('Set-Cookie',google.clearCookie());return redirect('/#/login?google_error='+(error instanceof GoogleAuthError?error.code:'unavailable'));}
      }
      if(p==='/api/services'&&method==='GET')return send(200,all('SELECT * FROM services WHERE published=1 AND archived=0'));
      if(p==='/api/auth/register'&&method==='POST') {
        limit('auth',20);const email=text(b.email,'Email',254).toLowerCase();check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Enter a valid email.');const name=text(b.name,'Name',100),pw=text(b.password,'Password',128);check(pw.length>=12,'Use at least 12 characters for your password.');
        transaction(db,()=>{if(!get('SELECT id FROM users WHERE email=?',email)){const uid=id();run('INSERT INTO users(id,email,name,password) VALUES(?,?,?,?)',uid,email,name,passwordHash(pw));issueToken(uid,'verify');}});
        return send(201,{message:'If this address is new, a verification message is in the local test outbox. Run npm run admin -- outbox on the server. Email delivery is not connected.'});
      }
      if(p==='/api/auth/login'&&method==='POST') {
        limit('auth',20);const email=text(b.email,'Email',254).toLowerCase(),pw=text(b.password,'Password',128),u=get('SELECT * FROM users WHERE email=?',email);
        const valid=passwordOK(pw,u?.password||dummyHash);check(u&&valid,'Email or password is incorrect.',401);
        if(u.role==='admin'&&!(u.totp_secret&&totpOK(u.totp_secret,typeof b.otp==='string'?b.otp:'')))return send(401,{error:'Enter the current six-digit authenticator code.',code:'authenticator_required'});
        if(passwordNeedsUpgrade(u.password))run('UPDATE users SET password=? WHERE id=?',passwordHash(pw),u.id);
        const t=token(),csrf=token();if(session)run('DELETE FROM sessions WHERE id=?',session.id);run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?,?)',digest(t),u.id,csrf,Date.now()+8*3600000);
        res.setHeader('Set-Cookie',`${sessionCookie}=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`);return send(200,{user:safeUser(u),csrf});
      }
      if(p==='/api/auth/logout'&&method==='POST') { if(session)run('DELETE FROM sessions WHERE id=?',session.id);res.setHeader('Set-Cookie',`${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);return send(200,{ok:true}); }
      if(p==='/api/auth/resend'&&method==='POST') {limit('recover',10);const u=get('SELECT * FROM users WHERE email=?',text(b.email,'Email',254).toLowerCase());if(u&&!u.verified)issueToken(u.id,'verify');return send(200,{message:'If the account needs verification, a new code is in the local test outbox.'});}
      if(p==='/api/auth/recover'&&method==='POST') {limit('recover',10);const u=get('SELECT * FROM users WHERE email=?',text(b.email,'Email',254).toLowerCase());if(u)issueToken(u.id,'reset');return send(200,{message:'If that account exists, recovery instructions are in the local test outbox. Email delivery is not connected.'});}
      if(['/api/auth/verify','/api/auth/reset'].includes(p)&&method==='POST') {
        limit('auth',20);const kind=p.endsWith('verify')?'verify':'reset',t=get('SELECT * FROM tokens WHERE id=? AND kind=? AND expires>?',digest(text(b.token,'Code',100)),kind,Date.now());check(t,'This code has expired or is invalid.');
        transaction(db,()=>{if(kind==='verify')run('UPDATE users SET verified=1 WHERE id=?',t.user_id);else{const pw=text(b.password,'Password',128);check(pw.length>=12,'Use at least 12 characters.');run('UPDATE users SET password=? WHERE id=?',passwordHash(pw),t.user_id);run('DELETE FROM sessions WHERE user_id=?',t.user_id);}run('DELETE FROM tokens WHERE id=?',t.id);run('DELETE FROM outbox WHERE user_id=? AND kind=?',t.user_id,kind);});return send(200,{message:kind==='verify'?'Account verified. You can now submit your request.':'Password updated. Sign in again.'});
      }
      if(p==='/api/profile'&&method==='PUT') {signed();const profile={goals:text(b.goals||'','Goals',3000,false),preferences:text(b.preferences||'','Preferences',3000,false),dietary:text(b.dietary||'','Dietary requirements',3000,false)};run('UPDATE users SET name=?,profile=? WHERE id=?',text(b.name,'Name',100),JSON.stringify(profile),user.id);return send(200,{ok:true});}
      if(p==='/api/requests'&&method==='POST') {
        verified();limit('requests',30);const key=text(b.idempotency_key,'Submission key',100);const old=get('SELECT * FROM requests WHERE user_id=? AND idempotency_key=?',user.id,key);if(old)return send(200,decorateRequest(old));
        const s=get('SELECT * FROM services WHERE id=? AND published=1 AND archived=0',text(b.service_id,'Service',100));check(s,'This service is not accepting requests.');
        let details:any;const d=b.details||{};
        if(s.kind==='chef') {details={date:date(d.date,'event date'),timezone:text(d.timezone,'Time zone',80),location:text(d.location,'Event location',500),guests:integer(d.guests,'Guests',1,1000),occasion:text(d.occasion,'Occasion',300),budget_minor:integer(d.budget_minor,'Indicative budget',0),currency:currency(d.currency),dietary:text(d.dietary||'','Dietary requirements',3000,false),notes:text(d.notes||'','Notes',3000,false)};try{new Intl.DateTimeFormat('en',{timeZone:details.timezone});}catch{throw new HttpError(400,'Enter a valid IANA time zone, such as Europe/London.');}}
        else details={goals:text(d.goals,'Goals'),experience:text(d.experience,'Experience',2000),equipment:text(d.equipment,'Equipment access',2000),availability:text(d.availability,'Availability',2000),preferences:text(d.preferences||'','Food preferences',2000,false)};
        const rid=id();transaction(db,()=>{run('INSERT INTO requests(id,user_id,service_id,kind,details,idempotency_key) VALUES(?,?,?,?,?,?)',rid,user.id,s.id,s.kind==='chef'?'chef':'coaching',JSON.stringify(details),key);run('INSERT INTO request_events(id,request_id,actor_id,status) VALUES(?,?,?,?)',id(),rid,user.id,'submitted');});return send(201,decorateRequest(get('SELECT * FROM requests WHERE id=?',rid)));
      }
      let m=p.match(/^\/api\/requests\/([^/]+)(?:\/(reply|status|activate|proposal|accept|confirm|cancel))?$/);
      if(m) {
        const r=ownedRequest(m[1]),action=m[2];if(method==='GET'&&!action)return send(200,decorateRequest(r));
        if(method==='POST'&&action==='reply') {verified();check(!['withdrawn','declined'].includes(r.status),'This request is closed.');transaction(db,()=>{run('INSERT INTO replies(id,request_id,author_id,body) VALUES(?,?,?,?)',id(),r.id,user.id,text(b.body,'Reply'));if(user.role!=='admin'&&r.status==='awaiting_client_response'){run('UPDATE requests SET status=? WHERE id=?','under_review',r.id);run('INSERT INTO request_events(id,request_id,actor_id,status) VALUES(?,?,?,?)',id(),r.id,user.id,'under_review');}});return send(201,{ok:true});}
        if(method==='POST'&&action==='status') {const next=text(b.status,'Status',40);if(user.role!=='admin')check(next==='withdrawn','Administrator access required.',403);check(transitions[r.status]?.includes(next),'That status change is not allowed.',409);check(!r.active&&r.booking_status!=='confirmed','End the active service or cancel the booking before closing the request.',409);transaction(db,()=>{run('UPDATE requests SET status=? WHERE id=?',next,r.id);run('INSERT INTO request_events(id,request_id,actor_id,status) VALUES(?,?,?,?)',id(),r.id,user.id,next);audit(user.id,'request.'+next,r.id);});return send(200,{ok:true});}
        if(method==='POST'&&action==='activate') {admin();check(r.kind==='coaching'&&r.status==='approved','Approve a coaching request before activation.',409);check(typeof b.active==='boolean','Choose active or inactive.');const pkg=text(b.package||'','Agreed package',2000,b.active);run('UPDATE requests SET active=?,package=? WHERE id=?',b.active?1:0,JSON.stringify({description:pkg}),r.id);audit(user.id,b.active?'service.activate':'service.end',r.id);return send(200,{ok:true});}
        if(method==='POST'&&action==='proposal') {admin();check(r.kind==='chef'&&!['withdrawn','declined'].includes(r.status),'This chef enquiry is closed.',409);check(['enquiry','proposed'].includes(r.booking_status),'Accepted proposals cannot be silently changed.',409);const proposal={description:text(b.description,'Proposal'),amount_minor:integer(b.amount_minor,'Proposal price',1),currency:currency(b.currency),payment_required:!!b.payment_required};run('UPDATE requests SET proposal=?,booking_status=? WHERE id=?',JSON.stringify(proposal),'proposed',r.id);audit(user.id,'chef.propose',r.id);return send(200,{ok:true});}
        if(method==='POST'&&action==='accept') {verified();check(r.user_id===user.id,'Only the client can accept.',403);check(r.booking_status==='proposed'&&!['withdrawn','declined'].includes(r.status),'No open proposal to accept.',409);run("UPDATE requests SET booking_status='accepted',accepted_at=CURRENT_TIMESTAMP WHERE id=?",r.id);audit(user.id,'chef.accept',r.id);return send(200,{ok:true});}
        if(method==='POST'&&action==='confirm') {admin();check(r.booking_status==='accepted'&&r.status==='approved','Approve the request and obtain client acceptance first.',409);const prop=parse(r.proposal);if(prop.payment_required){const invoices=all('SELECT * FROM invoices WHERE request_id=?',r.id).map(decorateInvoice);check(invoices.some(i=>i.currency===prop.currency&&i.amount_minor===prop.amount_minor&&i.paid_minor-i.refunded_minor>=i.amount_minor),'Record payment for an invoice matching the accepted proposal before confirming.',409);}run("UPDATE requests SET booking_status='confirmed' WHERE id=?",r.id);audit(user.id,'chef.confirm',r.id);return send(200,{ok:true});}
        if(method==='POST'&&action==='cancel') {admin();check(r.kind==='chef'&&['accepted','confirmed','proposed'].includes(r.booking_status),'No booking to cancel.',409);run("UPDATE requests SET booking_status='cancelled' WHERE id=?",r.id);audit(user.id,'chef.cancel',r.id);return send(200,{ok:true});}
      }
      if(p==='/api/checkins'&&method==='POST') {verified();check(get('SELECT id FROM requests WHERE user_id=? AND active=1',user.id),'An active service is needed for a check-in.',409);const week=date(b.week,'week starting date');check(new Date(week).getUTCDay()===1,'Choose the Monday of your check-in week.');const old=get('SELECT id FROM checkins WHERE user_id=? AND week=?',user.id,week);check(!old,'You have already checked in for this week.',409);run('INSERT INTO checkins(id,user_id,week,progress,energy,notes,measurements) VALUES(?,?,?,?,?,?,?)',id(),user.id,week,text(b.progress,'Progress'),integer(b.energy,'Energy',1,5),text(b.notes||'','Notes',4000,false),text(b.measurements||'','Measurements',1000,false));return send(201,{ok:true});}
      if(p==='/api/shopping'&&method==='GET') {activityOwner();return send(200,{lists:shoppingLists(db,user.id)});}
      m=p.match(/^\/api\/assignments\/([^/]+)\/shopping(?:\/(reset))?$/);
      if(m&&((method==='PUT'&&!m[2])||(method==='POST'&&m[2]==='reset'))) {activityOwner();return send(200,saveShopping(db,user.id,m[1],b,!!m[2]));}
      if(p==='/api/activity'&&method==='GET') {activityOwner();const range=activityRange(url.searchParams);return send(200,{entries:clientActivity(db,user.id,range),...range});}
      m=p.match(/^\/api\/assignments\/([^/]+)\/activity$/);if(m&&method==='PUT') {activityOwner();return send(200,saveActivity(db,user.id,m[1],b));}
      m=p.match(/^\/api\/assignments\/([^/]+)$/);if(m&&method==='GET') {signed();const a=get('SELECT * FROM assignments WHERE id=?',m[1]);check(a&&(a.user_id===user.id||user.role==='admin'),'Plan not found.',404);return send(200,{...a,snapshot:parse(a.snapshot)});}
      if((p==='/api/dashboard'||p==='/api/export')&&method==='GET') {signed();const result={user:safeUser(user),requests:all('SELECT r.*,s.title service_title FROM requests r JOIN services s ON s.id=r.service_id WHERE user_id=? ORDER BY r.created_at DESC',user.id).map(decorateRequest),assignments:all('SELECT * FROM assignments WHERE user_id=? ORDER BY created_at DESC,rowid DESC',user.id).map(a=>({...a,snapshot:parse(a.snapshot)})),checkins:all('SELECT * FROM checkins WHERE user_id=? ORDER BY week DESC',user.id),invoices:all('SELECT * FROM invoices WHERE user_id=? ORDER BY created_at DESC',user.id).map(decorateInvoice),account_requests:all('SELECT * FROM account_requests WHERE user_id=?',user.id),...(p==='/api/export'?{activity:clientActivity(db,user.id),shopping:shoppingExport(db,user.id)}:{})};if(p==='/api/export')res.setHeader('Content-Disposition','attachment; filename="form-fire-export.json"');return send(200,result);}
      if(p==='/api/account/deletion'&&method==='POST'){signed();if(!get("SELECT id FROM account_requests WHERE user_id=? AND status='requested'",user.id))run('INSERT INTO account_requests(id,user_id,kind) VALUES(?,?,?)',id(),user.id,'deletion');return send(201,{message:'Your deletion request is recorded for administrator review. It has not yet been processed.'});}
      if(p.startsWith('/api/admin/')) {
        admin();
        if(p==='/api/admin/activity'&&method==='GET')return send(200,adminActivity(db,activityRange(url.searchParams)));
        if(p==='/api/admin/dashboard'&&method==='GET')return send(200,{clients:all('SELECT * FROM users WHERE role=?','client').map(u=>({...safeUser(u),admin_notes:u.admin_notes})),requests:all('SELECT r.*,u.name client_name,s.title service_title FROM requests r JOIN users u ON u.id=r.user_id JOIN services s ON s.id=r.service_id ORDER BY r.created_at DESC').map(decorateRequest),services:all('SELECT * FROM services'),templates:all('SELECT * FROM templates').map(t=>({...t,content:parse(t.content)})),recipes:all('SELECT * FROM recipes'),exercises:all('SELECT * FROM exercises ORDER BY title'),assignments:all('SELECT * FROM assignments ORDER BY created_at DESC,rowid DESC').map(a=>({...a,snapshot:parse(a.snapshot)})),checkins:all('SELECT c.*,u.name client_name FROM checkins c JOIN users u ON u.id=c.user_id ORDER BY week DESC'),invoices:all('SELECT i.*,u.name client_name FROM invoices i JOIN users u ON u.id=i.user_id ORDER BY i.created_at DESC').map(decorateInvoice),audit:all('SELECT * FROM audit ORDER BY created_at DESC,rowid DESC LIMIT 100'),account_requests:all('SELECT a.*,u.email FROM account_requests a JOIN users u ON u.id=a.user_id')});
        m=p.match(/^\/api\/admin\/services(?:\/([^/]+))?$/);
        if(m&&['POST','PUT'].includes(method)) {const sid=m[1]||id();if(m[1])check(get('SELECT id FROM services WHERE id=?',sid),'Service not found.',404);const values=[text(b.title,'Title',120),choice(b.kind,['train','eat','both','chef'],'service type'),text(b.description,'Description'),text(b.inclusions,'Inclusions'),b.published?1:0,b.archived?1:0,b.price_minor===null||b.price_minor===undefined?null:integer(b.price_minor,'Price',0),currency(b.currency)];if(m[1])run('UPDATE services SET title=?,kind=?,description=?,inclusions=?,published=?,archived=?,price_minor=?,currency=? WHERE id=?',...values,sid);else run('INSERT INTO services(title,kind,description,inclusions,published,archived,price_minor,currency,id) VALUES(?,?,?,?,?,?,?,?,?)',...values,sid);audit(user.id,'service.save',sid);return send(200,{id:sid});}
        m=p.match(/^\/api\/admin\/clients\/([^/]+)$/);if(m&&method==='PUT'){check(get('SELECT id FROM users WHERE id=? AND role=?',m[1],'client'),'Client not found.',404);run('UPDATE users SET admin_notes=? WHERE id=?',text(b.admin_notes||'','Private notes',10000,false),m[1]);audit(user.id,'client.notes',m[1]);return send(200,{ok:true});}
        m=p.match(/^\/api\/admin\/checkins\/([^/]+)$/);if(m&&method==='PUT'){check(get('SELECT id FROM checkins WHERE id=?',m[1]),'Check-in not found.',404);run('UPDATE checkins SET feedback=? WHERE id=?',text(b.feedback,'Feedback'),m[1]);audit(user.id,'checkin.feedback',m[1]);return send(200,{ok:true});}
        m=p.match(/^\/api\/admin\/exercises(?:\/([^/]+))?$/);
        if(m&&['POST','PUT'].includes(method)) {
          const eid=m[1]||id(), e=exerciseInput(b);
          const values=[e.title,e.category,e.equipment,e.instructions,e.video_url,e.video_caption,e.animation,e.is_demo,e.archived];
          if(m[1]) {
            const old=get('SELECT * FROM exercises WHERE id=?',eid);check(old,'Exercise not found.',404);
            check(b.version===old.version,'This exercise changed. Refresh before saving.',409);
            run('UPDATE exercises SET title=?,category=?,equipment=?,instructions=?,video_url=?,video_caption=?,animation=?,is_demo=?,archived=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?',...values,eid);
          } else run('INSERT INTO exercises(title,category,equipment,instructions,video_url,video_caption,animation,is_demo,archived,id) VALUES(?,?,?,?,?,?,?,?,?,?)',...values,eid);
          audit(user.id,'exercise.save',eid);return send(200,{id:eid});
        }
        m=p.match(/^\/api\/admin\/recipes(?:\/([^/]+))?$/);
        if(m&&['POST','PUT'].includes(method)) {
          const rid=m[1]||id(), old=m[1]?get('SELECT * FROM recipes WHERE id=?',rid):null;
          if(m[1]) {check(old,'Recipe not found.',404);check(b.version===old.version,'This recipe changed. Refresh before saving.',409);}
          const values=[text(b.title,'Recipe name',200),text(b.ingredients,'Ingredients',10000),text(b.portions,'Portions',1000),text(b.preparation,'Preparation',10000),text(b.substitutions||'','Substitutions',4000,false),b.archived?1:0,b.is_demo?1:0];
          if(old)run('UPDATE recipes SET title=?,ingredients=?,portions=?,preparation=?,substitutions=?,archived=?,is_demo=?,version=version+1 WHERE id=?',...values,rid);
          else run('INSERT INTO recipes(title,ingredients,portions,preparation,substitutions,archived,is_demo,id) VALUES(?,?,?,?,?,?,?,?)',...values,rid);
          audit(user.id,'recipe.save',rid);return send(200,{id:rid});
        }
        m=p.match(/^\/api\/admin\/templates(?:\/([^/]+))?$/);
        if(m&&['POST','PUT'].includes(method)) {
          const tid=m[1]||id(),kind=choice(b.kind,['training','meal'],'plan type'),title=text(b.title,'Title',200);
          const content=JSON.stringify(planContent(db,kind,b.content||{}));
          if(m[1]) {
            const old=get('SELECT * FROM templates WHERE id=?',tid);check(old,'Template not found.',404);
            check(old.version===b.version,'This template changed. Refresh before saving.',409);
            check(old.kind===kind,'Create a new template to change its type.');
            run('UPDATE templates SET title=?,content=?,version=version+1,archived=?,is_demo=? WHERE id=?',title,content,b.archived?1:0,b.is_demo?1:0,tid);
          } else run('INSERT INTO templates(id,title,kind,content,is_demo) VALUES(?,?,?,?,?)',tid,title,kind,content,b.is_demo?1:0);
          audit(user.id,'template.save',tid);return send(200,{id:tid});
        }
        if(p==='/api/admin/assignments'&&method==='POST') {
          const r=get('SELECT * FROM requests WHERE id=?',text(b.request_id,'Request',100)),t=get('SELECT * FROM templates WHERE id=? AND archived=0',text(b.template_id,'Template',100));
          check(r&&r.active&&r.kind==='coaching','Choose an active coaching request.',409);check(t,'Choose an available template.');
          const snapshot=planSnapshot(db,t,text(b.customisation||'','Client adjustments',10000,false));
          const aid=id();transaction(db,()=>{
            const version=get('SELECT COALESCE(MAX(version),0)+1 n FROM assignments WHERE request_id=? AND kind=?',r.id,t.kind).n;
            run('INSERT INTO assignments(id,user_id,request_id,template_id,template_version,version,title,kind,snapshot) VALUES(?,?,?,?,?,?,?,?,?)',aid,r.user_id,r.id,t.id,t.version,version,t.title,t.kind,JSON.stringify(snapshot));audit(user.id,'plan.publish',aid);
          });return send(201,{id:aid});
        }
        if(p==='/api/admin/invoices'&&method==='POST') {const r=get('SELECT * FROM requests WHERE id=?',text(b.request_id,'Request',100));check(r&&r.status==='approved','Choose an approved request.',409);const amount=integer(b.amount_minor,'Amount',1),cur=currency(b.currency),description=text(b.description,'Description',1000),iid=id();run('INSERT INTO invoices(id,user_id,request_id,description,amount_minor,currency,price_snapshot) VALUES(?,?,?,?,?,?,?)',iid,r.user_id,r.id,description,amount,cur,JSON.stringify({description,amount_minor:amount,currency:cur,package:parse(r.package),proposal:parse(r.proposal)}));audit(user.id,'invoice.create',iid);return send(201,{id:iid});}
        if(p==='/api/admin/payments'&&method==='POST') {const iid=text(b.invoice_id,'Invoice',100),event=text(b.event_key,'Reference key',100),amount=integer(b.amount_minor,'Amount',1),kind=choice(b.kind,['payment','refund'],'entry type'),reference=text(b.reference,'Payment reference',300);const result=transaction(db,()=>{const old=get('SELECT * FROM payments WHERE event_key=?',event);if(old){check(old.invoice_id===iid&&old.amount_minor===amount&&old.kind===kind&&old.reference===reference,'This reference key was used for a different entry.',409);return {id:old.id,duplicate:true};}const invoice=get('SELECT * FROM invoices WHERE id=?',iid);check(invoice,'Invoice not found.',404);const i=decorateInvoice(invoice);check(kind==='payment'?amount<=i.outstanding_minor:amount<=i.paid_minor-i.refunded_minor,kind==='payment'?'Payment exceeds the outstanding balance.':'Refund exceeds the amount paid.',409);const pid=id();run('INSERT INTO payments(id,invoice_id,kind,amount_minor,event_key,reference) VALUES(?,?,?,?,?,?)',pid,iid,kind,amount,event,reference);audit(user.id,'manual.'+kind,pid);return {id:pid};});return send(201,result);}
        if(p==='/api/admin/earnings'&&method==='GET') {const from=date(url.searchParams.get('from'),'start date'),to=date(url.searchParams.get('to'),'end date');check(from<=to,'End date must follow start date.');const rows=all(`SELECT i.currency,s.title service,SUM(CASE WHEN p.kind='payment' THEN p.amount_minor ELSE 0 END) paid_minor,SUM(CASE WHEN p.kind='refund' THEN p.amount_minor ELSE 0 END) refunded_minor FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN requests r ON r.id=i.request_id JOIN services s ON s.id=r.service_id WHERE date(p.created_at) BETWEEN ? AND ? GROUP BY i.currency,s.id`,from,to);return send(200,{from,to,source:'manual records, not independently verified',rows,outstanding:all('SELECT * FROM invoices').map(decorateInvoice).filter(i=>i.outstanding_minor>0).map(i=>({id:i.id,currency:i.currency,outstanding_minor:i.outstanding_minor})),outstanding_basis:'All-time current balances; refunds reported separately. Proposals excluded.'});}
      }
      throw new HttpError(404,'Not found.');
    }catch(e:any){send(e instanceof HttpError||e instanceof LibraryError||e instanceof ActivityError||e instanceof ShoppingError?e.status:500,{error:e instanceof HttpError||e instanceof LibraryError||e instanceof ActivityError||e instanceof ShoppingError?e.message:'Something went wrong. Please try again.'});}
  };
  const serverOptions={headersTimeout:10000,requestTimeout:15000,maxHeaderSize:8192};
  let server;
  try{server=transport.tls?createSecureServer({...serverOptions,...transport.tls},handle):createServer(serverOptions,handle);}catch(error){db.close();throw error;}
  server.setTimeout(15000,socket=>socket.destroy());
  server.maxHeadersCount=50;
  return {server,db,origin};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {host,port}=transportConfig();const {server,origin}=createApp();server.listen(port,host,()=>console.log(`FORM & FIRE local test: ${origin} — no real client data`));
}
