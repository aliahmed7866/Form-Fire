import {runInContext} from 'node:vm';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const {JSDOM}=await import(process.env.FF_JSDOM_MODULE?pathToFileURL(resolve(process.env.FF_JSDOM_MODULE)).href:'jsdom');
const root=fileURLToPath(new URL('..',import.meta.url));
const publicFile=name=>join(root,'public',name);
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/server.ts';
import {openDb} from '../src/db.ts';
import {seedShowcase} from '../src/showcase.ts';
const dir=mkdtempSync(join(tmpdir(),'ff-record-test-'));
const seed=openDb(dir),config=seedShowcase(seed);seed.close();
const port=Number(process.env.FF_RECORD_TEST_PORT||8098),origin='http://127.0.0.1:'+port,app=createApp({dataDir:dir,origin,showcase:config});await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
const dom=new JSDOM(readFileSync(publicFile('index.html'),'utf8'),{url:origin,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;const evaluate=code=>runInContext(code,dom.getInternalVMContext());let cookie='';
w.__SHOWCASE_TEST__=true;w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=function(){};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.structuredClone=structuredClone;w.crypto.randomUUID=randomUUID;w.confirm=()=>true;
w.fetch=async(path,options={})=>{const headers={...options.headers,Cookie:cookie};if(options.method&&options.method!=='GET')headers.Origin=origin;const r=await fetch(origin+path,{...options,headers});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;};
try{
 for(const el of [...w.document.querySelectorAll('script[src]')]){const src=el.getAttribute('src');evaluate(readFileSync(publicFile(src.slice(1)),'utf8').replace(/\nrender\(\);\s*$/,'\n'));}
 evaluate(readFileSync(publicFile('showcase-scenario.js'),'utf8').replace('export function','function'));
 evaluate(readFileSync(publicFile('showcase-player.js'),'utf8').replace(/^import .*\n/,'').replaceAll('export function','function').replaceAll('export async function','async function'));
 w.config=config;
 await evaluate("render()");
 evaluate("var settle=trackShowcaseApp();var tourUI=createShowcaseUI({settle,getSession:async()=>{session=await api('/session');return session},request:(...args)=>api(...args),renderPage:()=>render(),setRoute:path=>history.replaceState(null,'','#'+path),wait:ms=>new Promise(r=>setTimeout(r,Math.min(ms,5))),pace:()=>1000});var tourState={};var tourSteps=buildShowcase(config,tourUI,tourState)");
 for(let i=0;i<w.tourSteps.length;i++){const step=w.tourSteps[i];console.log(`${i+1}/${w.tourSteps.length} ${step.title}`);await w.tourUI.role(step.role,config);await step.run();}
 console.log('ALL RECORDING STEPS PASSED');
 const presenter=await w.startShowcase();
 const until=async test=>{const end=Date.now()+10000;while(!test()){if(Date.now()>end)throw Error('Presenter control timed out');await new Promise(r=>setTimeout(r,20));}};
 w.document.querySelector('[data-tour-next]').click();
 await until(()=>presenter.report().steps[0].status==='completed'&&!w.document.querySelector('[data-tour-next]').disabled);
 if(presenter.report().steps[1].status!=='not run')throw Error('Next ran more than one step.');
 w.document.querySelector('[data-tour-play]').click();
 await until(()=>presenter.report().steps[1].status==='completed');
 w.document.querySelector('[data-tour-play]').click();
 const completed=presenter.report().steps.filter(s=>s.status==='completed').length;
 await new Promise(r=>setTimeout(r,300));
 if(presenter.report().steps.filter(s=>s.status==='completed').length!==completed)throw Error('Pause advanced another step.');
 w.document.querySelector('[data-tour-report]').click();
 if(!w.document.querySelector('[data-tour-details]').textContent.includes('MANUAL / DISCONNECTED'))throw Error('Coverage does not disclose manual work.');
 console.log('NEXT, PLAY, PAUSE AND COVERAGE CONTROLS PASSED');
}catch(error){console.error(error);console.error('PAGE',w.document.querySelector('#main').textContent.slice(-2200));process.exitCode=1;}finally{w.close();await new Promise(r=>app.server.close(r));app.db.close();rmSync(dir,{recursive:true,force:true});}
