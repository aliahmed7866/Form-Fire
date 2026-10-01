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
test('Request handoff is optional and only prepares a fixed greeting after an explicit link click',()=>{
 const c=createContext({Intl,Date});runInContext(`const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));`,c);runInContext(script,c);
 c.contact={channels:[{kind:'whatsapp',label:'Chat on WhatsApp',address:'+447700900123',url:'https://wa.me/447700900123'}],response_note:'Reply hours: <script>private</script>',answers:'PRIVATE_HEALTH_ANSWER',name:'PRIVATE_CLIENT_NAME',token:'PRIVATE_AUTH_TOKEN'};
 const html=runInContext('requestContactHandoff(contact)',c),href=html.match(/href="([^"]+)"/)?.[1];
 assert.ok(href);const url=new URL(href.replaceAll('&amp;','&'));
 assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/447700900123');
 assert.deepEqual([...url.searchParams.keys()],['text']);
 assert.equal(url.searchParams.get('text'),'Hi Alex, I have sent an enquiry through FORM & FIRE. Can we talk about the next steps?');
 assert.doesNotMatch(html,/PRIVATE_HEALTH_ANSWER|PRIVATE_CLIENT_NAME|PRIVATE_AUTH_TOKEN|<script>|onclick=/);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/nothing is sent automatically/);assert.match(html,/reply below/);assert.match(html,/messages are not copied into the app/);
 assert.match(html,/rel="noopener noreferrer"/);assert.match(html,/referrerpolicy="no-referrer"/);
 assert.equal(runInContext('requestContactHandoff(contact,{closed:true})',c),'');
 assert.equal(runInContext('requestContactHandoff(null)',c),'');
 assert.equal(runInContext('requestContactHandoff({channels:[]})',c),'');
 assert.equal(runInContext("requestContactHandoff({channels:[{kind:'instagram',url:'https://www.instagram.com/demo_alex/'}]})",c),'');
});
test('Outbound contact helpers do not render unexpected hosts, credentials, extra paths or supplied query data',()=>{
 const c=createContext({Intl,Date});runInContext('const esc=v=>String(v??"");',c);runInContext(script,c);
 for(const url of ['javascript:alert(1)','https://wa.me.evil.test/447700900123','https://user@wa.me/447700900123','https://wa.me/447700900123?text=private','https://wa.me/447700900123/extra','https://wa.me/447700900123#private','https://wa.me/447700900123\n']){
  c.contact={channels:[{kind:'whatsapp',url}]};
  assert.equal(runInContext('requestContactHandoff(contact)',c),'',url);
  assert.doesNotMatch(runInContext('contactCards(contact)',c),/href=/,url);
 }
});
test('Check-in default week follows the client time zone at Sunday/Monday boundaries',()=>{
 const c=createContext({Intl,Date,document:{addEventListener(){}}});runInContext(readFileSync(new URL('../public/daily-plan.js',import.meta.url),'utf8'),c);
 assert.equal(runInContext(`checkinMonday('America/Los_Angeles',new Date('2026-09-28T00:30:00Z'))`,c),'2026-09-21');
 assert.equal(runInContext(`checkinMonday('Europe/London',new Date('2026-09-28T00:30:00Z'))`,c),'2026-09-28');
 assert.equal(runInContext(`checkinMonday('Pacific/Auckland',new Date('2026-09-27T12:30:00Z'))`,c),'2026-09-28');
});
