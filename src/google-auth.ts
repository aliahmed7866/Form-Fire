import { createHash, createPublicKey, verify } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { token, digest, passwordHash } from './auth.ts';
import { instanceCookie } from './instance.ts';
import { id, transaction } from './db.ts';

// Fixed provider endpoints: neither environment values nor token headers can redirect requests.
const AUTHORISE='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN='https://oauth2.googleapis.com/token';
const KEYS='https://www.googleapis.com/oauth2/v3/certs';
const TEN_MINUTES=600000;
export type GoogleConfig={clientId:string,clientSecret:string};
export type GoogleErrorCode='disabled'|'cancelled'|'expired'|'invalid'|'unavailable'|'local_signin'|'admin_google';
export class GoogleAuthError extends Error {
  code:GoogleErrorCode;
  constructor(code:GoogleErrorCode){super('Google sign-in could not be completed.');this.code=code;}
}
function requireClaim(ok:any):asserts ok {if(!ok)throw new GoogleAuthError('invalid');}
export function googleNext(value:string|null) {
  if(!value||value.length>250)return '/portal';
  try {
    const url=new URL(value,'https://local.invalid');
    if(url.origin!=='https://local.invalid'||!value.startsWith('/')||value.startsWith('//')||url.hash)return '/portal';
    if(['/portal','/portal/today','/portal/plans','/portal/profile','/portal/checkins','/chef'].includes(url.pathname)&&!url.search)return url.pathname;
    if(url.pathname==='/enquire') {
      const values=url.searchParams.getAll('service');
      if([...url.searchParams.keys()].some(key=>key!=='service')||values.length>1)return '/portal';
      if(!values.length)return '/enquire';
      if(/^[A-Za-z0-9_-]{1,100}$/.test(values[0]))return '/enquire?'+new URLSearchParams({service:values[0]});
    }
  } catch {}
  return '/portal';
}
function readPart(part:string) {
  requireClaim(part.length>0&&/^[A-Za-z0-9_-]+$/.test(part));
  const data=Buffer.from(part,'base64url');requireClaim(data.toString('base64url')===part);
  const result=JSON.parse(data.toString('utf8'));requireClaim(result&&typeof result==='object'&&!Array.isArray(result));return result;
}
export function createGoogleAuth(db:DatabaseSync,origin:string,config:GoogleConfig={clientId:process.env.FF_GOOGLE_CLIENT_ID||'',clientSecret:process.env.FF_GOOGLE_CLIENT_SECRET||''},fetcher:typeof fetch=fetch) {
  const clientId=config.clientId.trim(),clientSecret=config.clientSecret.trim();
  const enabled=!!clientId&&!!clientSecret;
  const redirectUri=origin+'/api/auth/google/callback';
  const cookie=(value:string,clear=false)=>`${instanceCookie(origin,'ff_google')}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=${clear?0:600}${origin.startsWith('https:')?'; Secure':''}`;
  const clearCookie=()=>cookie('',true);
  const cleanup=()=>db.prepare('DELETE FROM google_transactions WHERE expires<=?').run(Date.now());
  async function remote(url:string,init:RequestInit={}) {
    try {
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
      try {
        const response=await fetcher(url,{...init,redirect:'error',signal:controller.signal,headers:{Accept:'application/json',...init.headers}});
        if(!response.ok||!response.body)throw new GoogleAuthError('unavailable');
        const length=Number(response.headers.get('content-length')||0);if(length>65536)throw new GoogleAuthError('unavailable');
        const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
        try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw new GoogleAuthError('unavailable');chunks.push(value);}}
        finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
        const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if(!value||typeof value!=='object'||Array.isArray(value))throw new GoogleAuthError('unavailable');return value;
      } finally {clearTimeout(timeout);}
    }catch{throw new GoogleAuthError('unavailable');}
  }
  function begin(next:string|null,oldBrowser:string|undefined) {
    if(!enabled)throw new GoogleAuthError('disabled');
    const state=token(),browser=token(),nonce=token(),verifier=token();
    transaction(db,()=>{
      cleanup();if(oldBrowser)db.prepare('DELETE FROM google_transactions WHERE browser_hash=?').run(digest(oldBrowser));
      db.prepare('INSERT INTO google_transactions VALUES(?,?,?,?,?,?)').run(digest(state),digest(browser),digest(nonce),verifier,googleNext(next),Date.now()+TEN_MINUTES);
    });
    const params=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
    return {location:AUTHORISE+'?'+params,cookie:cookie(browser)};
  }
  async function complete(params:URLSearchParams,browser:string|undefined) {
    if(!enabled)throw new GoogleAuthError('disabled');
    const state=params.get('state');
    requireClaim(params.getAll('state').length===1&&state&&/^[a-f0-9]{64}$/.test(state)&&browser&&/^[a-f0-9]{64}$/.test(browser));
    // Consume before any await or provider request. Concurrent callbacks cannot both win.
    const flow=transaction(db,()=>{
      const row=db.prepare('DELETE FROM google_transactions WHERE state_hash=? AND browser_hash=? RETURNING *').get(digest(state),digest(browser)) as any;
      cleanup();return row;
    });
    if(!flow||flow.expires<=Date.now())throw new GoogleAuthError('expired');
    if(params.has('error'))throw new GoogleAuthError(params.get('error')==='access_denied'?'cancelled':'invalid');
    const code=params.get('code');requireClaim(params.getAll('code').length===1&&typeof code==='string'&&code.length>0&&code.length<=4096);
    const tokens=await remote(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:flow.verifier})});
    requireClaim(typeof tokens.id_token==='string'&&tokens.id_token.length<=16384);
    let claims:any;
    try {
      const parts=tokens.id_token.split('.');requireClaim(parts.length===3);
      const header=readPart(parts[0]);claims=readPart(parts[1]);
      requireClaim(header.alg==='RS256'&&typeof header.kid==='string'&&header.kid.length>0&&header.kid.length<=200&&!header.crit);
      requireClaim(/^[A-Za-z0-9_-]+$/.test(parts[2]));
      const keys=await remote(KEYS);requireClaim(Array.isArray(keys.keys)&&keys.keys.length<=100);
      const matching=keys.keys.filter((key:any)=>key&&key.kid===header.kid&&key.kty==='RSA'&&(!key.alg||key.alg==='RS256')&&(!key.use||key.use==='sig'));
      requireClaim(matching.length===1);
      const key=createPublicKey({key:matching[0],format:'jwk'});requireClaim((key.asymmetricKeyDetails?.modulusLength||0)>=2048);
      requireClaim(verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')));
      const now=Math.floor(Date.now()/1000);
      requireClaim(['https://accounts.google.com','accounts.google.com'].includes(claims.iss));
      const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
      requireClaim(audiences.length>0&&audiences.every((aud:any)=>typeof aud==='string')&&audiences.includes(clientId));
      requireClaim((audiences.length===1||claims.azp===clientId)&&(claims.azp===undefined||claims.azp===clientId));
      requireClaim(Number.isSafeInteger(claims.exp)&&claims.exp>now&&Number.isSafeInteger(claims.iat)&&claims.iat<=now+60&&claims.iat>=now-7200&&claims.exp>claims.iat&&claims.exp-claims.iat<=7200);
      requireClaim(typeof claims.nonce==='string'&&digest(claims.nonce)===flow.nonce_hash);
      requireClaim(typeof claims.sub==='string'&&claims.sub.length>0&&claims.sub.length<=255);
      requireClaim(claims.email_verified===true&&typeof claims.email==='string'&&claims.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email));
    }catch(error){if(error instanceof GoogleAuthError)throw error;throw new GoogleAuthError('invalid');}
    const userId=transaction(db,()=>{
      const existing=db.prepare('SELECT u.* FROM google_identities g JOIN users u ON u.id=g.user_id WHERE g.subject=?').get(claims.sub) as any;
      if(existing) {
        if(existing.role!=='client')throw new GoogleAuthError('admin_google');
        return existing.id as string;
      }
      const email=claims.email.toLowerCase();
      // Never turn proof of a matching email into authority over an existing local account.
      const collision=db.prepare('SELECT role FROM users WHERE email=?').get(email) as any;
      if(collision)throw new GoogleAuthError(collision.role==='admin'?'admin_google':'local_signin');
      const userId=id(),name=typeof claims.name==='string'&&claims.name.trim()?claims.name.trim().slice(0,100):'Google client';
      db.prepare('INSERT INTO users(id,email,name,password,role,verified) VALUES(?,?,?,?,?,1)').run(userId,email,name,passwordHash(token()),'client');
      db.prepare('INSERT INTO google_identities(subject,user_id) VALUES(?,?)').run(claims.sub,userId);
      return userId;
    });
    return {userId,next:googleNext(flow.next_path)};
  }
  return {enabled,redirectUri,begin,complete,clearCookie};
}
