import { readFileSync } from 'node:fs';

// This release is deliberately local-only. A public origin is not a deployment switch.
export function transportConfig(env:NodeJS.ProcessEnv=process.env, originOverride?:string) {
  const host=env.FF_HOST||'127.0.0.1';
  if(!['127.0.0.1','::1'].includes(host))throw Error('Local-test mode must bind to loopback.');
  const port=Number(env.FF_PORT||8085);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('FF_PORT must be a port from 1 to 65535.');
  const certFile=env.FF_TLS_CERT_FILE||'',keyFile=env.FF_TLS_KEY_FILE||'';
  if(Boolean(certFile)!==Boolean(keyFile))throw Error('Configure both FF_TLS_CERT_FILE and FF_TLS_KEY_FILE for HTTPS.');
  const origin=originOverride||env.FF_ORIGIN||new URL(`${certFile?'https':'http'}://${host==='::1'?'[::1]':host}:${port}`).origin;
  let url:URL;
  try{url=new URL(origin);}catch{throw Error('FF_ORIGIN must be a valid loopback origin.');}
  if(url.origin!==origin||!['http:','https:'].includes(url.protocol)||!['127.0.0.1','[::1]','localhost'].includes(url.hostname))throw Error('FF_ORIGIN must be an exact loopback HTTP or HTTPS origin without a path, credentials or query.');
  if(!originOverride){
    const originPort=Number(url.port||(url.protocol==='https:'?443:80));
    if(originPort!==port)throw Error('FF_ORIGIN port must match FF_PORT.');
    if((url.hostname==='[::1]'&&host!=='::1')||(url.hostname==='127.0.0.1'&&host!=='127.0.0.1'))throw Error('FF_ORIGIN address must match FF_HOST.');
  }
  if(url.protocol==='https:'&&!certFile)throw Error('HTTPS requires FF_TLS_CERT_FILE and FF_TLS_KEY_FILE; HTTP fallback is disabled.');
  if(url.protocol==='http:'&&certFile)throw Error('TLS certificates require an https:// FF_ORIGIN.');
  const tls=certFile?{cert:readFileSync(certFile),key:readFileSync(keyFile),minVersion:'TLSv1.2' as const}:undefined;
  return {origin,host,port,tls};
}
