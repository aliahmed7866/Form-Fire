import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.ts';
import { googleNext } from '../src/google-auth.ts';
import { id } from '../src/db.ts';
import { digest, passwordHash, totpSecret, totp } from '../src/auth.ts';

const origin='http://127.0.0.1:8085';
const config={clientId:'test.apps.googleusercontent.com',clientSecret:'test-secret-not-public'};
const trusted=generateKeyPairSync('rsa',{modulusLength:2048}),attacker=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...trusted.publicKey.export({format:'jwk'}),kid:'trusted-key',alg:'RS256',use:'sig'};
const encode=(value:any)=>Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(claims:any,header:any={alg:'RS256',kid:'trusted-key'},key=trusted.privateKey) {
  const message=encode(header)+'.'+encode(claims);return message+'.'+sign('RSA-SHA256',Buffer.from(message),key).toString('base64url');
}
async function fixture(google=config) {
  const dir=mkdtempSync(join(tmpdir(),'ff-google-'));
  let nonce='',verifier='',issued='',calls:any[]=[],upstream='ok',port=0;
  const googleFetch=async(input:any,init:any)=>{
    calls.push({url:String(input),init});assert.equal(init.redirect,'error');assert.ok(init.signal);
    if(upstream==='network')throw new Error('UPSTREAM-SECRET');
    if(upstream==='error')return new Response('{"error":"UPSTREAM-SECRET"}',{status:502});
    if(upstream==='oversize')return new Response('x'.repeat(65537));
    if(upstream==='oversize-header')return new Response('{}',{headers:{'content-length':'65537'}});
    if(String(input)==='https://oauth2.googleapis.com/token') {
      assert.equal(init.method,'POST');
      const body=new URLSearchParams(init.body);
      assert.equal(body.get('client_secret'),config.clientSecret);assert.equal(body.get('client_id'),config.clientId);
      assert.equal(body.get('redirect_uri'),origin+'/api/auth/google/callback');assert.equal(body.get('grant_type'),'authorization_code');
      assert.equal(body.get('code_verifier'),verifier);assert.equal(body.get('code'),'valid-code');
      return new Response(JSON.stringify({id_token:issued,access_token:'NOT-RETAINED',refresh_token:'NOT-RETAINED'}));
    }
    assert.equal(String(input),'https://www.googleapis.com/oauth2/v3/certs');return new Response(JSON.stringify({keys:[jwk]}));
  };
  let app=createApp({dataDir:dir,origin,google,googleFetch:googleFetch as typeof fetch});
  const listen=async()=>{await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));port=(app.server.address() as any).port;};await listen();
  const call=(path:string,cookie='',headers:any={},method='GET',body?:any)=>new Promise<any>((done,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers:{Host:'127.0.0.1:8085',Cookie:cookie,...headers}},res=>{
      let text='';res.on('data',part=>text+=part);res.on('end',()=>done({status:res.statusCode,headers:res.headers,text,data:text?JSON.parse(text):null}));
    });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  const begin=async(next='/portal',cookie='')=>{
    const response=await call('/api/auth/google/start?next='+encodeURIComponent(next),cookie);assert.equal(response.status,303);
    const url=new URL(response.headers.location);assert.equal(url.origin+url.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
    nonce=url.searchParams.get('nonce')!;
    const state=url.searchParams.get('state')!;
    const flow=app.db.prepare('SELECT * FROM google_transactions WHERE state_hash=?').get(digest(state)) as any;
    verifier=flow.verifier;assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('code_challenge'),createHash('sha256').update(verifier).digest('base64url'));
    assert.equal(url.searchParams.get('response_type'),'code');assert.equal(url.searchParams.get('scope'),'openid email profile');assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/auth/google/callback');
    assert.ok(!url.toString().includes(config.clientSecret));
    return {state,cookie:response.headers['set-cookie'][0].split(';')[0],response};
  };
  const claims=(patch:any={})=>({iss:'https://accounts.google.com',aud:config.clientId,sub:'google-person-123',email:'taylor@example.test',email_verified:true,name:'Taylor',nonce,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...patch});
  const callback=(flow:any,extra='code=valid-code')=>call('/api/auth/google/callback?state='+flow.state+'&'+extra,flow.cookie);
  const attempt=async(patch:any={},header?:any,key?:any)=>{const flow=await begin();issued=jwt(claims(patch),header,key);return callback(flow);};
  const close=async()=>{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();rmSync(dir,{recursive:true,force:true});};
  const restart=async()=>{await new Promise<void>(r=>app.server.close(()=>r()));app.db.close();app=createApp({dataDir:dir,origin,google,googleFetch:googleFetch as typeof fetch});await listen();};
  return {get app(){return app;},call,begin,claims,callback,attempt,close,restart,get calls(){return calls;},issue(value:string){issued=value;},upstream(value:string){upstream=value;}};
}
const error=(response:any,code:string)=>{assert.equal(response.status,303);assert.equal(response.headers.location,'/#/login?google_error='+code);assert.ok(!response.text.includes('UPSTREAM-SECRET'));assert.ok(response.headers['set-cookie'].every((value:string)=>!value.startsWith('ff_session=')));};

test('Google is optional; endpoints do not reveal credentials; safe return paths are limited',async()=>{
  const f=await fixture({clientId:'',clientSecret:''});
  try {
    const status=await f.call('/api/auth/google/status');assert.deepEqual(status.data,{enabled:false,redirect_uri:origin+'/api/auth/google/callback'});
    assert.equal((await f.call('/api/session')).data.connections.google,false);
    error(await f.call('/api/auth/google/start'),'disabled');error(await f.call('/api/auth/google/callback'),'disabled');assert.equal(f.calls.length,0);
    for(const path of ['https://attacker.test','//attacker.test','/admin','/portal?next=https://bad.test','/portal#bad','/enquire?service=x&service=y','/enquire?service=%0a','/chef?next=x'])assert.equal(googleNext(path),'/portal');
    for(const path of ['/portal/today','/portal/checkins','/enquire','/enquire?service=both','/chef'])assert.equal(googleNext(path),path);
  }finally{await f.close();}
});

test('Google state is browser-bound, single-use, expiring and retained across process restarts',async t=>{
  const f=await fixture();
  try {
    await t.test('Cross-site starts and mismatched origins are refused',async()=>{
      assert.equal((await f.call('/api/auth/google/start','',{'Sec-Fetch-Site':'cross-site'})).status,403);
      assert.equal((await f.call('/api/auth/google/start','',{Origin:'https://attacker.test'})).status,403);
      const status=await f.call('/api/auth/google/status');assert.equal(status.data.enabled,true);assert.ok(!JSON.stringify(status).includes(config.clientSecret));assert.equal((await f.call('/api/session')).data.connections.google,true);
    });
    await t.test('Missing, incorrect and duplicate state or cookies never reach Google',async()=>{
      const flow=await f.begin();assert.match(flow.response.headers['set-cookie'][0],/HttpOnly; SameSite=Lax; Path=\/api\/auth\/google; Max-Age=600/);
      error(await f.call('/api/auth/google/callback?code=valid-code',flow.cookie),'invalid');
      error(await f.call('/api/auth/google/callback?state='+flow.state+'&code=valid-code'),'invalid');
      error(await f.callback({...flow,state:'0'.repeat(64)}),'expired');
      error(await f.callback({...flow,cookie:'ff_google='+'0'.repeat(64)}),'expired');
      error(await f.callback(flow,'state='+flow.state+'&code=valid-code'),'invalid');
      assert.equal(f.calls.length,0);
      f.issue(jwt(f.claims()));const success=await f.callback(flow);assert.equal(success.headers.location,'/#/portal');
      error(await f.callback(flow),'expired');assert.equal(f.calls.length,2);
    });
    await t.test('Cancellation consumes state and exposes only an allowlisted error',async()=>{
      const flow=await f.begin();error(await f.callback(flow,'error=access_denied&error_description=UPSTREAM-SECRET'),'cancelled');error(await f.callback(flow),'expired');
      const other=await f.begin();error(await f.callback(other,'error=UPSTREAM-SECRET'),'invalid');
    });
    await t.test('Expired transactions and replacement starts invalidate old state',async()=>{
      const flow=await f.begin();f.app.db.prepare('UPDATE google_transactions SET expires=? WHERE state_hash=?').run(Date.now()-1,digest(flow.state));error(await f.callback(flow),'expired');
      const old=await f.begin();const current=await f.begin('/portal',old.cookie);error(await f.callback(old),'expired');error(await f.callback(current,'code=valid-code&code=duplicate'),'invalid');
    });
    await t.test('A pending flow survives restart and a successful callback cannot be replayed',async()=>{
      const flow=await f.begin('/portal/today');f.issue(jwt(f.claims()));await f.restart();const success=await f.callback(flow);assert.equal(success.headers.location,'/#/portal/today');error(await f.callback(flow),'expired');
      assert.equal((f.app.db.prepare('SELECT COUNT(*) n FROM google_transactions').get() as any).n,0);
    });
    await t.test('Concurrent callbacks can exchange a transaction only once',async()=>{
      const flow=await f.begin();f.issue(jwt(f.claims()));const before=f.calls.length;
      const results=await Promise.all([f.callback(flow),f.callback(flow)]);
      assert.equal(results.filter(result=>result.headers.location==='/#/portal').length,1);
      assert.equal(results.filter(result=>result.headers.location==='/#/login?google_error=expired').length,1);
      assert.equal(f.calls.length-before,2);
    });
  }finally{await f.close();}
});

test('Google JWT signature, key, issuer, audience and authorisation claims are verified',async t=>{
  const f=await fixture();
  try {
    const cases:[string,any,any?,any?][]=[
      ['forged signature',{},undefined,attacker.privateKey],['unknown key',{}, {alg:'RS256',kid:'attacker-key'}],['wrong algorithm',{}, {alg:'none',kid:'trusted-key'}],
      ['critical token extension',{}, {alg:'RS256',kid:'trusted-key',crit:['invented']}],['wrong issuer',{iss:'https://attacker.test'}],
      ['wrong audience',{aud:'someone-else'}],['wrong authorised party',{azp:'someone-else'}],['ambiguous audience',{aud:[config.clientId,'other']}],
      ['missing subject',{sub:''}],['unverified email',{email_verified:false}],['text verification flag',{email_verified:'true'}],['invalid email',{email:'not-an-email'}],
      ['wrong nonce',{nonce:'attacker-nonce'}],['expired token',{exp:Math.floor(Date.now()/1000)-1}],['future issue time',{iat:Math.floor(Date.now()/1000)+600}],
      ['missing issue time',{iat:null}],['stale token',{iat:Math.floor(Date.now()/1000)-7201}],['excess lifetime',{exp:Math.floor(Date.now()/1000)+10800}]
    ];
    for(const [name,patch,header,key]of cases)await t.test(name,async()=>error(await f.attempt(patch,header,key),'invalid'));
    assert.equal((f.app.db.prepare('SELECT COUNT(*) n FROM users').get() as any).n,0);
    assert.equal((f.app.db.prepare('SELECT COUNT(*) n FROM sessions').get() as any).n,0);
  }finally{await f.close();}
});

test('Google success creates client sessions, preserves subject identity and refuses email takeover or admin bypass',async t=>{
  const f=await fixture();let clientId='',sessionCookie='';
  const pw='long local test password',secret=totpSecret();
  try {
    await t.test('A verified new identity receives a normal client session and CSRF protection',async()=>{
      const flow=await f.begin('/enquire?service=both');f.issue(jwt(f.claims({aud:[config.clientId,'other'],azp:config.clientId})));
      const success=await f.callback(flow);assert.equal(success.headers.location,'/#/enquire?service=both');
      sessionCookie=success.headers['set-cookie'].find((cookie:string)=>cookie.startsWith('ff_session='));assert.match(sessionCookie,/HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800/);sessionCookie=sessionCookie.split(';')[0];
      const session=(await f.call('/api/session',sessionCookie)).data;assert.equal(session.user.role,'client');assert.equal(session.user.verified,true);assert.equal(session.user.email,'taylor@example.test');assert.ok(session.csrf);clientId=session.user.id;
      const storedSession=f.app.db.prepare('SELECT * FROM sessions WHERE user_id=?').get(clientId) as any;
      assert.ok(storedSession.expires>Date.now()+28790000&&storedSession.expires<=Date.now()+28800000);
      assert.equal((await f.call('/api/admin/dashboard',sessionCookie)).status,403);
      assert.equal((await f.call('/api/profile',sessionCookie,{Origin:origin,'Content-Type':'application/json'},'PUT',{name:'Changed'})).status,403);
      const row=f.app.db.prepare('SELECT * FROM users WHERE id=?').get(clientId) as any;assert.ok(row.password);assert.ok(!JSON.stringify(session).includes(row.password));
      assert.equal((f.app.db.prepare('SELECT COUNT(*) n FROM google_transactions').get() as any).n,0);
    });
    await t.test('Repeat sign-in uses stable subject; changed Google email never takes over another account',async()=>{
      f.app.db.prepare('INSERT INTO users(id,email,name,password,verified) VALUES(?,?,?,?,1)').run(id(),'different@example.test','Existing person',passwordHash(pw));
      const success=await f.attempt({iss:'accounts.google.com',email:'different@example.test'});const cookie=success.headers['set-cookie'].find((cookie:string)=>cookie.startsWith('ff_session=')).split(';')[0];
      const session=(await f.call('/api/session',cookie)).data;assert.equal(session.user.id,clientId);assert.equal(session.user.email,'taylor@example.test');
      assert.equal((f.app.db.prepare('SELECT COUNT(*) n FROM google_identities').get() as any).n,1);
    });
    await t.test('A matching existing local email cannot be automatically linked',async()=>{
      error(await f.attempt({sub:'another-subject',email:'different@example.test'}),'local_signin');
      error(await f.attempt({sub:'another-subject',email:'taylor@example.test'}),'local_signin');
      assert.equal((f.app.db.prepare('SELECT COUNT(*) n FROM google_identities').get() as any).n,1);
    });
    await t.test('An administrator still needs the local password and authenticator',async()=>{
      const adminId=id();f.app.db.prepare("INSERT INTO users(id,email,name,password,role,verified,totp_secret) VALUES(?,?,?,?,'admin',1,?)").run(adminId,'alex@example.test','Alex',passwordHash(pw),secret);
      error(await f.attempt({sub:'google-admin',email:'alex@example.test'}),'admin_google');
      f.app.db.prepare('INSERT INTO google_identities(subject,user_id) VALUES(?,?)').run('google-admin',adminId);
      error(await f.attempt({sub:'google-admin',email:'changed@example.test'}),'admin_google');
      const headers={Origin:origin,'Content-Type':'application/json'};
      assert.equal((await f.call('/api/auth/login','',headers,'POST',{email:'alex@example.test',password:pw})).status,401);
      assert.equal((await f.call('/api/auth/login','',headers,'POST',{email:'alex@example.test',password:pw,otp:totp(secret)})).status,200);
    });
    await t.test('Deleting the account removes its linked provider identity',async()=>{
      f.app.db.prepare('DELETE FROM sessions WHERE user_id=?').run(clientId);f.app.db.prepare('DELETE FROM users WHERE id=?').run(clientId);
      assert.equal(f.app.db.prepare('SELECT * FROM google_identities WHERE user_id=?').get(clientId),undefined);
    });
  }finally{await f.close();}
});

test('Google upstream failure, oversized content and malformed tokens fail closed without retaining credentials',async t=>{
  const f=await fixture();
  try {
    for(const failure of ['network','error','oversize','oversize-header'])await t.test(failure,async()=>{
      const flow=await f.begin();f.issue(jwt(f.claims()));f.upstream(failure);error(await f.callback(flow),'unavailable');f.upstream('ok');error(await f.callback(flow),'expired');
    });
    for(const malformed of ['not-a-jwt','x.y.z','a'.repeat(16385)]) {
      const flow=await f.begin();f.issue(malformed);error(await f.callback(flow),'invalid');
    }
    const flow=await f.begin('//attacker.test');f.issue(jwt(f.claims(),{alg:'RS256',kid:'trusted-key',jku:'https://attacker.test/keys'}));
    assert.equal((await f.callback(flow)).headers.location,'/#/portal');assert.ok(f.calls.every(call=>['https://oauth2.googleapis.com/token','https://www.googleapis.com/oauth2/v3/certs'].includes(call.url)));
    const tables=f.app.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    for(const table of tables) {
      const rows=f.app.db.prepare('SELECT * FROM '+table.name).all();assert.ok(!JSON.stringify(rows).includes('NOT-RETAINED'));assert.ok(!JSON.stringify(rows).includes(config.clientSecret));
    }
  }finally{await f.close();}
});
