import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transportConfig } from './transport.ts';

export async function healthcheck(env:NodeJS.ProcessEnv=process.env) {
  const {origin,tls}=transportConfig(env);
  const caFile=env.FF_TLS_CA_FILE||env.FF_TLS_CERT_FILE;
  return await new Promise<{ok:true,app:string}>((done,reject)=>{
    const req=(tls?httpsRequest:httpRequest)(new URL('/health',origin),tls?{ca:caFile?readFileSync(caFile):undefined}:{},res=>{
      let body='';
      res.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy(Error('Unexpected health response.'));});
      res.on('error',reject);
      res.on('end',()=>{
        try{const value=JSON.parse(body);if(res.statusCode!==200||value.ok!==true||value.app!=='form-fire')throw Error('Unexpected health response.');done(value);}catch{reject(Error('FORM & FIRE did not return a healthy response.'));}
      });
    });
    const timeout=setTimeout(()=>req.destroy(Error('Health check timed out.')),3000);
    req.once('close',()=>clearTimeout(timeout));req.on('error',reject);req.end();
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(await healthcheck()));}catch(error:any){console.error('FORM & FIRE health check: '+error.message);process.exitCode=1;}
}
