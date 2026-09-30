// Read-only diagnostics, including the transport cause that 'fetch failed' hides.
import {recordingSettings,loadRecording} from './record-workspace.ts';
const {port,origin}=recordingSettings();
const wait=process.argv.includes('--wait'),deadline=Date.now()+(wait?20000:0);
try{
 const expected=process.env.FF_RECORD_TAKE?loadRecording(process.env.FF_RECORD_TAKE).showcase.runId:null;
 let config;
 for(;;){try{
 const health=await fetch(origin+'/health',{signal:AbortSignal.timeout(wait?1000:5000)});
 if(!health.ok||(await health.json()).app!=='form-fire')throw Error('This port is not serving a healthy FORM & FIRE app.');
 const response=await fetch(origin+'/api/showcase',{signal:AbortSignal.timeout(wait?1000:5000)});
 if(!response.ok)throw Error('An app is running here, but it is not a recording workspace.');
 config=await response.json();if(typeof config.runId!=='string')throw Error('The recording response is invalid.');
 if(expected&&config.runId!==expected)throw Error('This port belongs to a different recording take. It was not stopped or replaced.');
 break;
 }catch(error){if(Date.now()>=deadline)throw error;await new Promise(r=>setTimeout(r,250));}}
 console.log(`Recording server reachable: ${origin}/?record=1\nTake: ${config.runId}\nReturn to the browser and choose Check connection. No data was changed.`);
}catch(error){
 const code=error.cause?.code||error.cause?.errors?.[0]?.code||error.code||error.name;
 const reason=code==='ECONNREFUSED'?'No server accepted the connection.':error.name==='TimeoutError'?'The connection timed out.':error.message;
 console.error(`Recording check failed on port ${port}: ${reason} (${code})\nRun: cd "$HOME/Form-Fire" && FF_RECORD_PORT=${port} bash termux/record.sh start\nThen check: FF_RECORD_PORT=${port} bash termux/record.sh logs\nStart reuses a managed take; fresh explicitly creates another. Return to the same browser tab and choose Check connection after recovery.`);process.exitCode=1;
}
