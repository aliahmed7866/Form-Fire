import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const script=readFileSync(new URL('../public/contact.js',import.meta.url),'utf8');
test('Contact cards escape copy, disclose external navigation and send no client-data prefill',()=>{
 const c=createContext({Intl,Date});runInContext(`const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));`,c);runInContext(script,c);
 const html=runInContext(`contactCards({channels:[{kind:'whatsapp',label:'Chat on WhatsApp',address:'+447700900123',url:'https://wa.me/447700900123'}],response_note:'<img src=x onerror=alert(1)>'})`,c);
 assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/referrerpolicy="no-referrer"/);assert.match(html,/opens an external app or new tab/);assert.match(html,/&lt;img/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('?text='));
});
test('Check-in default week follows the client time zone at Sunday/Monday boundaries',()=>{
 const c=createContext({Intl,Date,document:{addEventListener(){}}});runInContext(readFileSync(new URL('../public/daily-plan.js',import.meta.url),'utf8'),c);
 assert.equal(runInContext(`checkinMonday('America/Los_Angeles',new Date('2026-09-28T00:30:00Z'))`,c),'2026-09-21');
 assert.equal(runInContext(`checkinMonday('Europe/London',new Date('2026-09-28T00:30:00Z'))`,c),'2026-09-28');
 assert.equal(runInContext(`checkinMonday('Pacific/Auckland',new Date('2026-09-27T12:30:00Z'))`,c),'2026-09-28');
});
