import { scryptSync, randomBytes, timingSafeEqual, createHash, createHmac } from 'node:crypto';
export const token = () => randomBytes(32).toString('hex');
export const digest = (v: string) => createHash('sha256').update(v).digest('hex');
export function passwordHash(password: string) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function passwordOK(password: string, stored: string) { const [salt, hash]=stored.split(':'); const actual=scryptSync(password,salt,64); return actual.length===Buffer.from(hash,'hex').length && timingSafeEqual(actual,Buffer.from(hash,'hex')); }
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
