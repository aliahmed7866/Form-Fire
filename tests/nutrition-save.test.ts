import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {readFileSync} from 'node:fs';
function harness(){
 const listeners=new Map<string,any[]>(),calls:any[]=[],navigations:string[]=[],messages:string[]=[];let release:any,reject:any,renders=0;
 const controls=[{type:'number',tagName:'INPUT',readOnly:false,value:'2'},{type:'select-one',tagName:'SELECT',disabled:false,value:'lunch'},{type:'submit',tagName:'BUTTON',disabled:true},{type:'hidden',tagName:'INPUT',value:'retry-key'}];
 const attrs=new Map<string,string>([['data-form','nutrition-log']]);
 const form={elements:controls,isConnected:true,innerHTML:'original fields',setAttribute:(k:string,v:string)=>attrs.set(k,v),removeAttribute:(k:string)=>attrs.delete(k)};
 const c=createContext({document:{addEventListener(event:string,fn:any){listeners.set(event,[...(listeners.get(event)||[]),fn]);}},session:{user:{id:'client-1'}},location:{hash:'#/portal/recipe?id=fictional'},renderVersion:1,form,
  api:(...args:any[])=>{calls.push(args);return new Promise((yes,no)=>{release=yes;reject=no;});},toast:(m:string)=>messages.push(m),navigate:(p:string)=>navigations.push(p),render:async()=>{renders++;},esc:(s:string)=>s,link:(p:string,t:string)=>`<a href="#${p}">${t}</a>`});
 runInContext(readFileSync(new URL('../public/nutrition.js',import.meta.url),'utf8'),c);
 const start=(kind='nutrition-log')=>runInContext(`saveNutritionEntry(${JSON.stringify(kind)},{id:'entry-1',version:'2',quantity:'2',day:'2026-10-10',idempotency_key:'retry-key'},form)`,c);
 return {c,form,attrs,controls,calls,navigations,messages,listeners,start,finish:()=>release({ok:true}),fail:()=>reject(Error('Unconfirmed network result')),get renders(){return renders;}};
}
test('Diary saves commit captured fields, lock pending controls and navigate only an untouched originating view',async()=>{
 const h=harness(),pending=h.start();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'POST');assert.equal(h.calls[0][2].quantity,2);assert.equal(h.calls[0][2].idempotency_key,'retry-key');assert.equal(h.attrs.get('aria-busy'),'true');assert.equal(h.controls[0].readOnly,true);assert.equal(h.controls[1].disabled,true);
 await h.start();assert.equal(h.calls.length,1,'Direct repeated submissions do not write twice');let stopped=false;const event={target:h.form,preventDefault(){stopped=true;},stopImmediatePropagation(){}};h.listeners.get('submit')![0](event);assert.ok(stopped);
 h.finish();await pending;assert.deepEqual(h.navigations,['/portal/nutrition?day=2026-10-10']);assert.equal(h.renders,1);assert.equal(h.controls[0].readOnly,false);assert.equal(h.controls[1].disabled,false);assert.equal(h.controls[2].disabled,true,'Caller-owned disabled state stays intact');assert.equal(h.attrs.has('aria-busy'),false);
});
test('Delayed diary saves do not navigate, rerender or focus after newer navigation or leaving and returning',async()=>{
 for(const change of [(h:any)=>{h.c.location.hash='#/portal/profile';},(h:any)=>{h.c.renderVersion++;},(h:any)=>{h.form.isConnected=false;}]){
  const h=harness(),pending=h.start();change(h);h.finish();await pending;assert.equal(h.calls.length,1);assert.deepEqual(h.navigations,[]);assert.equal(h.renders,0);assert.equal(h.form.innerHTML,'original fields');assert.match(h.messages[0],/saved for 2026-10-10/);
 }
});
test('Newer edits preserve the rendered page and replace only the successfully submitted form',async()=>{
 const h=harness(),pending=h.start('nutrition-edit');assert.equal(h.calls[0][0],'/nutrition/diary/entry-1');assert.equal(h.calls[0][1],'PUT');assert.equal(h.calls[0][2].version,2);
 h.listeners.get('input')![0]();h.finish();await pending;assert.equal(h.renders,0);assert.deepEqual(h.navigations,[]);assert.equal(h.attrs.has('data-form'),false);assert.match(h.form.innerHTML,/other edits are still here/);assert.match(h.form.innerHTML,/View saved diary/);
});
test('Failed writes unlock the original values/key; stale failures preserve the newer view and focus',async()=>{
 for(const changed of [false,true]){
  const h=harness(),pending=h.start();if(changed){h.c.location.hash='#/portal/profile';h.c.renderVersion++;}h.fail();await assert.rejects(pending,(e:any)=>{assert.equal(e.preserveFormFocus,changed);return /Unconfirmed/.test(e.message);});
  assert.equal(h.controls[0].readOnly,false);assert.equal(h.controls[0].value,'2');assert.equal(h.controls[3].value,'retry-key');assert.equal(h.controls[1].disabled,false);assert.equal(h.attrs.has('aria-busy'),false);assert.equal(h.attrs.get('data-form'),'nutrition-log');assert.equal(h.renders,0);assert.deepEqual(h.navigations,[]);
  assert.equal(h.messages.length,changed?1:0);if(changed)assert.match(h.messages[0],/wasn’t confirmed/);
  const retry=h.start();assert.equal(h.calls.length,2);assert.equal(h.calls[1][2].idempotency_key,'retry-key');h.finish();await retry;
 }
});
test('Account changes suppress old-account success and failure messages',async()=>{
 for(const fail of [false,true]){
  const h=harness(),pending=h.start();h.c.session.user={id:'client-2'};if(fail){h.fail();await assert.rejects(pending);}else{h.finish();await pending;}
  assert.equal(h.renders,0);assert.deepEqual(h.navigations,[]);assert.deepEqual(h.messages,[]);assert.equal(h.form.innerHTML,'original fields');
 }
});
test('Same-day refresh passes a commit-time guard and keeps edits made while reading the saved diary',async()=>{
 const h=harness();h.c.location.hash='#/portal/nutrition?day=2026-10-10';let guarded=false;
 h.c.render=async(options:any)=>{assert.equal(options.canCommit(),true);h.listeners.get('input')![0]();assert.equal(options.canCommit(),false);guarded=true;};
 const pending=h.start();h.finish();await pending;assert.ok(guarded);assert.deepEqual(h.navigations,[]);assert.match(h.form.innerHTML,/other edits are still here/);
});

test('A changed account during refresh must replace private forms, even when newer edits exist',async()=>{
 const h=harness();h.c.location.hash='#/portal/nutrition?day=2026-10-10';let cleared=false;
 h.c.render=async(options:any)=>{h.listeners.get('input')![0]();h.c.session.user={id:'client-2'};assert.equal(options.canCommit(),true,'Account privacy takes precedence over preserving unsaved fields');h.form.isConnected=false;cleared=true;};
 const pending=h.start();h.finish();await pending;assert.ok(cleared);assert.match(h.messages.at(-1)!,/account changed/);assert.equal(h.form.innerHTML,'original fields');
});
