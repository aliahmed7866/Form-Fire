// Recording-only transport: retry reads once; never repeat a save automatically.
export function createRecordingRequest(request,{wait=ms=>new Promise(r=>setTimeout(r,ms)),timeout=10000,onWrite=()=>{},onFailure=()=>{},runId}={}) {
 return async(path,method='GET',body)=>{
  const read=method==='GET';
  if(!read)onWrite();
  for(let attempt=0;attempt<(read?2:1);attempt++){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
   try{return await request(path,method,body,{signal:controller.signal,recordingRun:runId});}
   catch(error){
    const connection=controller.signal.aborted||['connection_unavailable','unexpected_response'].includes(error.code);
    if(connection&&!error.code)error.code='connection_unavailable';
    if(!connection||!read||attempt===1){onFailure({path:path.split('?')[0],method,code:error.code||'request_failed',timed_out:controller.signal.aborted,at:new Date().toISOString()});throw error;}
   }finally{clearTimeout(timer);}
   await wait(350);
  }
 };
}
export function recordingCanRetry(error,writeAttempted){return !writeAttempted&&['connection_unavailable','unexpected_response'].includes(error.code);}
export async function verifyRecordingConnection(request,runId){
 const current=await request('/showcase');
 if(current.runId!==runId){const error=Error('A different recording take is running. Reload this page to use the new take.');error.code='recording_changed';throw error;}
 await request('/session');
 return current;
}
