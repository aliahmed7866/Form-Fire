import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
function ui(reduced=false){
 const timers=new Map<number,()=>void>();let counter=0;
 const c=createContext({document:{addEventListener(){}},window:{addEventListener(){},matchMedia(){return {matches:reduced}}},location:{hash:'#/login'},URLSearchParams,setTimeout(fn:()=>void,ms:number){assert.equal(ms,4800);timers.set(++counter,fn);return counter;},clearTimeout(id:number){timers.delete(id);}});
 for(const file of ['lifestyle-art.js','experience.js','plan-studio.js','daily-plan.js','app.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),c);
 runInContext("toast=message=>{lastToast=message}",c);return {c,timers};
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
 c.location.hash='#/login';assert.ok(!runInContext('authPage()',c).includes('name="otp"'));
});
test('Direct admin routes and recovery retain the admin destination and authenticator field',()=>{
 const {c}=ui();runInContext('session={connections:{google:true}}',c);
 for(const path of ['/admin','/admin/plans']){c.location.hash='#'+path;const html=runInContext('authPage()',c);assert.match(html,/name="otp"[^>]+required/);assert.ok(html.includes('name="next" value="'+path+'"'));assert.ok(!html.includes('/api/auth/google/start'));assert.ok(!html.includes('Create your account'));assert.ok(html.includes('#/recover?next='+encodeURIComponent(path)));}
 c.location.hash='#/recover?next=%2Fadmin%2Fplans';let html=runInContext("authPage('recover')",c);assert.ok(html.includes('name="next" value="/admin/plans"'));
 c.location.hash='#/login?next=%2Fadmin%2Fplans';html=runInContext('authPage()',c);assert.match(html,/name="otp"[^>]+required/);
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
