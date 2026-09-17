import { resolve } from 'node:path';
import { digest } from './auth.ts';

// Browsers share cookies across ports. Keep the original main-app name for
// compatibility, but isolate every other local app port (including the demo).
export function instanceCookie(origin:string,base='ff_session') {
  const url=new URL(origin),port=url.port||(url.protocol==='https:'?'443':'80');
  return port==='8085'?base:`${base}_${port}`;
}
export function instanceInfo(dataDir:string,origin:string,demo:boolean) {
  return {id:digest(resolve(dataDir)).slice(0,16),kind:demo?'demo':'local',label:demo?'Fictional demo':'Your local workspace',origin};
}
