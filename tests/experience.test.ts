import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
function ui(reduced=false){
 const timers=new Map<number,()=>void>(),listeners=new Map<string,any[]>();let counter=0;
 const c=createContext({document:{addEventListener(event:string,listener:any){listeners.set(event,[...(listeners.get(event)||[]),listener]);}},window:{addEventListener(){},matchMedia(){return {matches:reduced}}},location:{hash:'#/login'},URLSearchParams,setTimeout(fn:()=>void,ms:number){assert.equal(ms,4800);timers.set(++counter,fn);return counter;},clearTimeout(id:number){timers.delete(id);}});
 for(const file of ['lifestyle-art.js','experience.js','plan-studio.js','daily-plan.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 runInContext("toast=message=>{lastToast=message}",c);return {c,timers,listeners};
}
function button(){const attrs=new Map([['aria-pressed','false']]),classes=new Set<string>();const figure={classList:{add(v:string){classes.add(v);},remove(v:string){classes.delete(v);}},querySelector(){return {getAttribute(){return 'A still-life drawing';}}}};return {attrs,classes,closest(){return figure;},setAttribute(k:string,v:string){attrs.set(k,v);},getAttribute(k:string){return attrs.get(k);},innerHTML:''};}
test('Google option reflects configuration and preserves the local enquiry return route',()=>{
 const {c}=ui();runInContext('session={connections:{google:false}}',c);
 let html=runInContext("googleSignin('/enquire?service=both')",c);assert.match(html,/disabled/);assert.ok(!html.includes('href="/api/auth/google/start'));assert.ok(html.includes('#/google-setup'));
 runInContext('session={connections:{google:true}}',c);html=runInContext("googleSignin('/enquire?service=both')",c);assert.ok(html.includes('/api/auth/google/start?next=%2Fenquire%3Fservice%3Dboth'));assert.ok(!html.includes('disabled'));
});
test('Google errors are allowlisted and never echo provider or URL text',()=>{
 const {c}=ui();for(const code of ['<script>alert(1)</script>','constructor','__proto__']){c.location.hash='#/login?google_error='+encodeURIComponent(code);const html=runInContext('googleNotice()',c);assert.ok(html.includes('could not be completed'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('function Object'));}
 c.location.hash='#/login?google_error=admin_google';assert.ok(runInContext('googleNotice()',c).includes('Open admin sign-in'));
});
test('Admin sign-in has required authenticator input and does not offer Google',()=>{
 const {c}=ui();runInContext('session={connections:{google:true}}',c);c.location.hash='#/login?admin=1&next=%2Fadmin';const html=runInContext('authPage()',c);assert.ok(html.includes('Hello, Alex.'));assert.match(html,/name="otp"[^>]+required/);assert.ok(!html.includes('/api/auth/google/start'));assert.ok(html.includes('#/test-admin'));
 assert.ok(html.indexOf('class="signin-modes"')<html.indexOf('data-form="login"'));assert.match(html,/aria-current="page">Alex’s admin sign-in/);
 c.location.hash='#/login';const clientHtml=runInContext('authPage()',c);assert.ok(!clientHtml.includes('name="otp"'));assert.ok(clientHtml.indexOf('class="signin-modes"')<clientHtml.indexOf('data-form="login"'));assert.match(clientHtml,/aria-current="page">Client sign-in/);
});
test('Direct admin routes and recovery retain the admin destination and authenticator field',()=>{
 const {c}=ui();runInContext('session={connections:{google:true}}',c);
 for(const path of ['/admin','/admin/plans']){c.location.hash='#'+path;const html=runInContext('authPage()',c);assert.match(html,/name="otp"[^>]+required/);assert.ok(html.includes('name="next" value="'+path+'"'));assert.ok(!html.includes('/api/auth/google/start'));assert.ok(!html.includes('Create your account'));assert.ok(html.includes('#/recover?next='+encodeURIComponent(path)));}
 c.location.hash='#/recover?next=%2Fadmin%2Fplans';let html=runInContext("authPage('recover')",c);assert.ok(html.includes('name="next" value="/admin/plans"'));
 c.location.hash='#/login?next=%2Fadmin%2Fplans';html=runInContext('authPage()',c);assert.match(html,/name="otp"[^>]+required/);
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
 c.fetch=async(url:string,options:any)=>{assert.equal(url,'/api/auth/login');assert.equal(options.method,'POST');sent.push(JSON.parse(options.body));const response=responses.shift();assert.ok(response,'unexpected extra login request');return {ok:response.status===200,json:async()=>response.data};};
 c.renderCount=0;runInContext('render=async()=>{renderCount++}',c);
 return {c,fields,sent,events,submitButton,error,get insertions(){return insertions;},async submit(){let prevented=false;const handlers=listeners.get('submit')||[];assert.equal(handlers.length,1);await handlers[0]({target:form,preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(submitButton.disabled,false);}};
}
test('Admin credentials in client sign-in reveal a focused code field and preserve the form through retry',async()=>{
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
test('Incorrect credentials leave client sign-in unchanged without an authenticator challenge',async()=>{
 const h=loginHarness([{status:401,data:{error:'Email or password is incorrect.'}}]);
 await h.submit();assert.equal(h.insertions,0);assert.equal(h.fields.otp,undefined);assert.equal(h.error.textContent,'Email or password is incorrect.');assert.equal(h.fields.password.value,'keep this exact password');assert.equal(h.c.location.hash,'#/login');assert.equal(h.c.renderCount,0);
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
