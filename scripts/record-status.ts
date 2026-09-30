// Read-only diagnostics for the recording port, never the installed app.
const port=Number(process.env.FF_RECORD_PORT||8088);
if(!Number.isInteger(port)||port<1024||port>65535||[8085,8086].includes(port))throw Error('Choose the recording port with FF_RECORD_PORT (default 8088).');
const origin=`http://127.0.0.1:${port}`;
try{
 const health=await fetch(origin+'/health',{signal:AbortSignal.timeout(5000)});
 if(!health.ok||(await health.json()).app!=='form-fire')throw Error('This port is not serving a healthy FORM & FIRE app.');
 const response=await fetch(origin+'/api/showcase',{signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw Error('An app is running here, but it is not a recording workspace.');
 const config=await response.json();if(typeof config.runId!=='string')throw Error('The recording response is invalid.');
 console.log(`Recording server reachable: ${origin}/?record=1\nTake: ${config.runId}\nReturn to the browser and choose Check connection. No data was changed.`);
}catch(error){console.error(`Recording check failed on port ${port}: ${error.message}\nKeep the recording Termux session open. If it stopped, run bash termux/record.sh for a fresh take, then reload ${origin}/?record=1.\nIf Termux displays a process-killed message, allow Termux background activity in Android battery settings. Restarting the normal form-fire app does not start this recording server.`);process.exitCode=1;}
