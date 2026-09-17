import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
function ui(reduced=false){
 const timers=new Map<number,()=>void>(),listeners=new Map<string,any[]>();let counter=0;
 const c=createContext({document:{addEventListener(event:string,listener:any){listeners.set(event,[...(listeners.get(event)||[]),listener]);}},window:{addEventListener(){},matchMedia(){return {matches:reduced}}},location:{hash:'#/login'},URLSearchParams,setTimeout(fn:()=>void,ms:number){assert.equal(ms,4800);timers.set(++counter,fn);return counter;},clearTimeout(id:number){timers.delete(id);}});
 for(const file of ['lifestyle-art.js','experience.js','plan-studio.js','daily-plan.js','enrichment.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 runInContext("toast=message=>{lastToast=message}",c);return {c,timers,listeners};
}
function button(){const attrs=new Map([['aria-pressed','false']]),classes=new Set<string>();const figure={classList:{add(v:string){classes.add(v);},remove(v:string){classes.delete(v);}},querySelector(){return {getAttribute(){return 'A still-life drawing';}}}};return {attrs,classes,closest(){return figure;},setAttribute(k:string,v:string){attrs.set(k,v);},getAttribute(k:string){return attrs.get(k);},innerHTML:''};}
test('Google appears only when configured and preserves the enquiry return route',()=>{
 const {c}=ui();runInContext('session={connections:{google:false}}',c);
 assert.equal(runInContext("googleSignin('/enquire?service=both')",c),'');
 runInContext('session={connections:{google:true}}',c);const html=runInContext("googleSignin('/enquire?service=both')",c);assert.ok(html.includes('/api/auth/google/start?next=%2Fenquire%3Fservice%3Dboth'));assert.ok(!html.includes('disabled'));assert.ok(!html.includes('#/google-setup'));
});
test('Google errors are allowlisted and never echo provider or URL text or advertise admin access',()=>{
 const {c}=ui();for(const code of ['<script>alert(1)</script>','constructor','__proto__']){c.location.hash='#/login?google_error='+encodeURIComponent(code);const html=runInContext('googleNotice()',c);assert.ok(html.includes('could not be completed'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('function Object'));}
 c.location.hash='#/login?google_error=admin_google';const html=runInContext('googleNotice()',c);assert.ok(html.includes('email and password'));assert.ok(!html.includes('admin'));assert.ok(!html.includes('<a'));
});
test('There is one public sign-in without admin links, role hints or a premature OTP prompt',()=>{
 const {c}=ui();runInContext('session={connections:{google:true}}',c);
 for(const path of ['/login','/login?admin=1&next=%2Fadmin','/login?next=%2Fadmin%2Fplans','/admin','/admin/plans']){
  c.location.hash='#'+path;const html=runInContext('authPage()',c);
  assert.ok(html.includes('Good to see you.'));assert.ok(html.includes('/api/auth/google/start'));assert.ok(!html.includes('name="otp"'));assert.ok(!html.includes('Hello, Alex.'));assert.ok(!html.includes('Alex’s admin'));assert.ok(!html.includes('signin-modes'));assert.ok(!html.includes('#/test-admin'));assert.ok(!html.includes('setup-admin-test'));assert.ok(!html.includes('read-test-otp'));
 }
 const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert.ok(!index.includes('#/test-admin'));assert.ok(!index.includes('#/admin'));assert.ok(!index.includes('Try admin'));
});
test('Protected return routes survive sign-in and recovery without changing sign-in controls',()=>{
 const {c}=ui();runInContext('session={connections:{google:true}}',c);
 for(const path of ['/admin','/admin/plans','/portal/plans']){c.location.hash='#'+path;const html=runInContext('authPage()',c);assert.ok(html.includes('name="next" value="'+path+'"'));assert.ok(!html.includes('name="otp"'));assert.ok(html.includes('#/recover?next='+encodeURIComponent(path)));}
 c.location.hash='#/recover?next=%2Fadmin%2Fplans';assert.ok(runInContext("authPage('recover')",c).includes('name="next" value="/admin/plans"'));
});
test('Setup guides are unavailable to anonymous or client users and do not fetch private status',async()=>{
 const {c}=ui();c.fetch=()=>{throw Error('Guide must not request setup details');};
 for(const session of [{},{user:{role:'client'}}]){
  c.sessionFixture=session;runInContext('session=sessionFixture',c);
  for(const html of [runInContext('adminTestPage()',c),await runInContext('googleSetupPage()',c)]){
   assert.ok(!html.includes('setup-admin-test'));assert.ok(!html.includes('admin-test@'));assert.ok(!html.includes('FF_GOOGLE_CLIENT_SECRET'));assert.ok(!html.includes('read-test-otp'));
  }
 }
 runInContext("session={user:{role:'admin'}}",c);assert.ok(runInContext('adminTestPage()',c).includes('setup-admin-test'));
});
function loginHarness(responses:any[]){
 const {c,listeners}=ui(),sent:any[]=[],events:string[]=[];
 const fields:Record<string,any>={email:{value:'admin-test@form-fire.example'},password:{value:'keep this exact password'},next:{value:'/portal'}};
 let insertions=0;
 function insert(_position:string,html:string){
  assert.match(html,/name="otp"[^>]+required/);
  insertions++;
  fields.otp={value:'',focus(){events.push('focus');},select(){events.push('select');},scrollIntoView(){events.push('input-scroll');}};
 }
 const submitButton={disabled:false,textContent:'Sign in ↗',insertAdjacentHTML:insert};
 const error={className:'error',textContent:'',scrollIntoView(){events.push('error-scroll');}};
 const form={dataset:{form:'login'},fields,insertAdjacentHTML:insert,querySelector(selector:string){if(selector==='[type=submit]')return submitButton;if(selector==='.error')return error;if(selector==='[name="otp"]'||selector==="[name='otp']"||selector==='[name=otp]')return fields.otp||null;throw Error('Unexpected selector: '+selector);}};
 c.FormData=class extends Map{constructor(f:any){super(Object.entries(f.fields).map(([name,input]:[string,any])=>[name,input.value]));}};
 c.fetch=async(url:string,options:any)=>{assert.equal(url,'/api/auth/login');assert.equal(options.method,'POST');sent.push(JSON.parse(options.body));const response=responses.shift();assert.ok(response,'unexpected extra login request');if(response.networkError)throw TypeError('Failed to fetch');return {ok:response.status===200,json:async()=>{if(response.invalidJSON)throw SyntaxError('Unexpected token');return response.data;}};};
 c.renderCount=0;runInContext('render=async()=>{renderCount++}',c);
 return {c,fields,sent,events,submitButton,error,get insertions(){return insertions;},async submit(){let prevented=false;const handlers=listeners.get('submit')||[];assert.equal(handlers.length,1);await handlers[0]({target:form,preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(submitButton.disabled,false);}};
}
test('Admin credentials in the shared sign-in reveal a focused code field and preserve the form through retry',async()=>{
 const challenge={status:401,data:{error:'Enter the current six-digit authenticator code.',code:'authenticator_required'}};
 const h=loginHarness([challenge,challenge,{status:200,data:{user:{role:'admin'},csrf:'test-csrf'}}]);
 const email=h.fields.email,password=h.fields.password;
 await h.submit();
 assert.equal(h.insertions,1);assert.equal(h.fields.email,email);assert.equal(h.fields.password,password);assert.equal(password.value,'keep this exact password');assert.equal(h.c.location.hash,'#/login');assert.equal(h.fields.next.value,'/portal');assert.equal(h.c.renderCount,0);
 assert.ok(h.events.includes('focus'));assert.ok(h.events.includes('select'));assert.ok(h.events.indexOf('error-scroll')<h.events.indexOf('focus'));
 assert.equal(h.submitButton.textContent,'Verify & sign in ↗');
 assert.equal(h.error.textContent,challenge.data.error);assert.equal(h.sent[0].otp,undefined);
 h.fields.otp.value='000000';await h.submit();
 assert.equal(h.insertions,1,'retry reuses the existing authenticator field');assert.equal(h.sent[1].otp,'000000');assert.equal(h.c.renderCount,0);assert.equal(h.fields.password,password);
 h.fields.otp.value='123456';await h.submit();
 assert.equal(h.sent[2].otp,'123456');assert.equal(h.sent[2].password,password.value);assert.equal(h.sent[2].email,email.value);assert.equal(h.c.location.hash,'/admin');assert.equal(h.c.renderCount,1);
});
test('Incorrect credentials leave shared sign-in unchanged without an authenticator challenge',async()=>{
 const h=loginHarness([{status:401,data:{error:'Email or password is incorrect.'}}]);
 await h.submit();assert.equal(h.insertions,0);assert.equal(h.fields.otp,undefined);assert.equal(h.error.textContent,'Email or password is incorrect.');assert.equal(h.fields.password.value,'keep this exact password');assert.equal(h.c.location.hash,'#/login');assert.equal(h.c.renderCount,0);
});
test('Server-returned account role decides the destination while client enquiries are preserved',async()=>{
 for(const [role,next,want] of [
  ['admin','/portal','/admin'],['admin','/enquire?service=both','/admin'],['admin','/admin/plans','/admin/plans'],
  ['client','/admin','/portal'],['client','/admin/plans?x=1','/portal'],['client','/test-admin','/portal'],['client','/google-setup','/portal'],
  ['client','/enquire?service=both','/enquire?service=both'],['client','/portal/plans','/portal/plans'],['client','//external.example','/portal']
 ]){
  const h=loginHarness([{status:200,data:{user:{role},csrf:'test-csrf'}}]);h.fields.next.value=next;await h.submit();assert.equal(h.c.location.hash,want);assert.equal(h.c.renderCount,1);
 }
});
test('Network failure keeps entered credentials, gives local recovery steps and never retries sign-in automatically',async()=>{
 const h=loginHarness([{networkError:true}]);h.c.location.hostname='127.0.0.1';await h.submit();
 assert.equal(h.sent.length,1);assert.equal(h.insertions,0);assert.equal(h.fields.password.value,'keep this exact password');assert.equal(h.c.location.hash,'#/login');assert.equal(h.c.renderCount,0);assert.match(h.error.textContent,/couldn’t reach FORM & FIRE/);assert.match(h.error.textContent,/form-fire status/);assert.match(h.error.textContent,/form-fire restart/);assert.ok(!h.error.textContent.includes('Failed to fetch'));
});
test('Unreadable server responses produce a useful error and do not reveal an authenticator field',async()=>{
 const h=loginHarness([{status:502,invalidJSON:true}]);h.c.location.hostname='form-fire.example';await h.submit();
 assert.equal(h.sent.length,1);assert.equal(h.insertions,0);assert.match(h.error.textContent,/unexpected response/);assert.match(h.error.textContent,/try again/);assert.ok(!h.error.textContent.includes('Termux'));assert.ok(!h.error.textContent.includes('Unexpected token'));
});
test('Failed page load has a manual GET-only retry that restores the normal sign-in',async()=>{
 const {c,listeners}=ui(),main={innerHTML:''},account={textContent:'',href:''},calls:string[]=[];let first=true;
 c.location.hostname='127.0.0.1';c.document.querySelector=(selector:string)=>selector==='#main'?main:account;c.document.querySelectorAll=()=>[];
 c.fetch=async(url:string,options:any)=>{calls.push(url);assert.equal(options.method,'GET');if(first){first=false;throw TypeError('Failed to fetch');}return {ok:true,json:async()=>url==='/api/session'?{connections:{google:false}}:[]};};
 await runInContext('render()',c);assert.match(main.innerHTML,/data-action="retry-page"/);assert.match(main.innerHTML,/form-fire restart/);assert.equal(calls.length,1);
 const retryButton={dataset:{action:'retry-page'},disabled:false};await listeners.get('click')!.at(-1)({target:{closest(){return retryButton;}}});
 assert.deepEqual(calls,['/api/session','/api/session','/api/services']);assert.ok(main.innerHTML.includes('data-form="login"'));assert.ok(!main.innerHTML.includes('retry-page'));assert.equal(account.textContent,'Your space ↗');assert.equal(account.href,'#/login');
});
test('Illustrations remain still until requested and stop automatically or when paused',()=>{
 const {c,timers}=ui(),b=button();c.button=b;const html=runInContext("animatedArtwork('kitchen')",c);assert.ok(!html.includes('is-playing'));assert.ok(html.includes('aria-pressed="false"'));assert.ok(html.includes('art-steam'));
 runInContext('playDrawing(button)',c);assert.equal(b.attrs.get('aria-pressed'),'true');assert.ok(b.classes.has('is-playing'));assert.equal(timers.size,1);
 [...timers.values()][0]();assert.equal(b.attrs.get('aria-pressed'),'false');assert.equal(timers.size,0);
 runInContext('playDrawing(button);playDrawing(button)',c);assert.equal(b.attrs.get('aria-pressed'),'false');assert.equal(timers.size,0);
});
test('Reduced-motion preference and page cleanup stop optional illustration movement',()=>{
 const reduced=ui(true),b=button();reduced.c.button=b;runInContext('playDrawing(button)',reduced.c);assert.equal(reduced.timers.size,0);assert.equal(b.classes.size,0);assert.match(runInContext('lastToast',reduced.c),/reduced-motion/);
 const normal=ui();normal.c.button=b;runInContext('playDrawing(button);stopIllustrations()',normal.c);assert.equal(normal.timers.size,0);assert.equal(b.classes.size,0);
});
