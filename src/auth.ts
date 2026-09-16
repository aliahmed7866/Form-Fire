import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
export const token = () => randomBytes(32).toString('hex');
export const digest = (v: string) => createHash('sha256').update(v).digest('hex');
// OWASP's 16 MiB scrypt profile keeps memory practical on Termux without lowering
// the work factor. Only explicitly supported profiles can control the KDF cost.
const passwordPrefix='$scrypt$v=1$N=16384,r=8,p=5$';
const passwordOptions={N:16384,r:8,p:5,maxmem:32*1024*1024};
const legacyPasswordOptions={N:16384,r:8,p:1,maxmem:32*1024*1024};
function readPasswordHash(stored: string) {
  if(typeof stored!=='string'||stored.length>256)return null;
  const current=/^\$scrypt\$v=1\$N=16384,r=8,p=5\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(stored);
  if(current&&current[0]===stored)return {salt:current[1],hash:current[2],legacy:false};
  const legacy=/^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored);
  return legacy&&legacy[0]===stored?{salt:legacy[1],hash:legacy[2],legacy:true}:null;
}
export function passwordHash(password: string) {
  const salt=randomBytes(16).toString('hex');
  return `${passwordPrefix}${salt}$${scryptSync(password,salt,64,passwordOptions).toString('hex')}`;
}
export function passwordOK(password: string, stored: string) {
  const parsed=readPasswordHash(stored);
  if(typeof password!=='string'||!parsed)return false;
  try {
    const actual=scryptSync(password,parsed.salt,64,parsed.legacy?legacyPasswordOptions:passwordOptions);
    return timingSafeEqual(actual,Buffer.from(parsed.hash,'hex'));
  } catch { return false; }
}
export function passwordNeedsUpgrade(stored: string) { return readPasswordHash(stored)?.legacy===true; }
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function totpSecret() { return Array.from(randomBytes(32),v=>alphabet[v%32]).join(''); }
export function totp(secret: string, time=Date.now()) {
  let bits=''; for (const c of secret) bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map(v=>parseInt(v,2)));
  const counter=Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time/30000)));
  const h=createHmac('sha1',key).update(counter).digest(); const offset=h[h.length-1]&15;
  return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
export function totpOK(secret: string, code: string) { return /^\d{6}$/.test(code) && [-30000,0,30000].some(d=>timingSafeEqual(Buffer.from(totp(secret,Date.now()+d)),Buffer.from(code))); }
