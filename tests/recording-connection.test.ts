import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRecordingRequest,recordingCanRetry,verifyRecordingConnection} from '../public/showcase-connection.js';
const offline=()=>Object.assign(Error('Connection interrupted'),{code:'connection_unavailable'});
test('Recording retries a failed read once and never retries writes or validation failures',async()=>{
 let reads=0,writes=0,attempted=0;
 const request=createRecordingRequest(async(_path:string,method:string)=>{if(method==='GET'){if(++reads===1)throw offline();return {ok:true};}writes++;throw offline();},{wait:async()=>{},onWrite:()=>attempted++});
 assert.deepEqual(await request('/session'),{ok:true});assert.equal(reads,2);
 await assert.rejects(()=>request('/auth/login','POST',{}));assert.equal(writes,1);assert.equal(attempted,1);
 let invalid=0;await assert.rejects(()=>createRecordingRequest(async()=>{invalid++;throw Error('Forbidden');})('/admin/dashboard'));assert.equal(invalid,1);
});
test('Recording timeouts are bounded and indeterminate writes cannot become safe retries',async()=>{
 let attempts=0;
 const hung=createRecordingRequest(async(_p:string,_m:string,_b:any,options:any)=>{attempts++;return await new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(offline()),{once:true}));},{timeout:15,wait:async()=>{}});
 await assert.rejects(()=>hung('/session'));assert.equal(attempts,2);
 attempts=0;await assert.rejects(()=>hung('/profile','PUT',{}));assert.equal(attempts,1);
 assert.equal(recordingCanRetry(offline(),false),true);assert.equal(recordingCanRetry(offline(),true),false);assert.equal(recordingCanRetry(Error('Invalid form'),false),false);
});
test('Recovery verifies the same take before allowing playback',async()=>{
 const calls:string[]=[];const request=async(p:string)=>{calls.push(p);return p==='/showcase'?{runId:'same'}:{user:null};};
 await verifyRecordingConnection(request,'same');assert.deepEqual(calls,['/showcase','/session']);
 calls.length=0;await assert.rejects(()=>verifyRecordingConnection(request,'different'),{code:'recording_changed'});assert.deepEqual(calls,['/showcase']);
});
test('Recording diagnostics identify the final failed request without form values or query strings',async()=>{
 const failures:any[]=[];
 const request=createRecordingRequest(async()=>{throw offline();},{wait:async()=>{},onFailure:(failure:any)=>failures.push(failure)});
 await assert.rejects(()=>request('/profile?private=value','PUT',{password:'never include this'}));
 assert.equal(failures.length,1);assert.equal(failures[0].path,'/profile');assert.equal(failures[0].method,'PUT');assert.equal(failures[0].timed_out,false);
 assert.ok(!JSON.stringify(failures).includes('private'));assert.ok(!JSON.stringify(failures).includes('password'));
 await assert.rejects(()=>request('/session'));
 assert.equal(failures.length,2,'a retried read records only its final failure');
});
