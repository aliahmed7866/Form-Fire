/* Small, honest next steps. Presentation helpers never change coaching records. */
function clientCoachAction(d,day) {
  const waiting=d.requests.find(r=>r.status==='awaiting_client_response');
  if(waiting)return ['Your coach','Alex has a question for you.','Pick up your conversation and agree the next step.','/request/'+waiting.id,'Reply to Alex'];
  const week=dateShift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
  const saved=d.checkins.find(c=>c.week===week);
  if(saved)return ['Your coach',saved.feedback?'Alex’s feedback is here.':'Your check-in is saved.',saved.feedback?'Read the response beside your weekly update.':'Alex can review it. Your saved update is here whenever you need it.','/portal/checkins',saved.feedback?'Read feedback':'View my check-in'];
  if(d.requests.some(r=>r.active))return ['Your coach','How has your week felt?','A win, a tricky moment or a question. There’s room for all of it.','/portal/checkins','Catch up with Alex'];
  return ['Your coach','A conversation comes first.','Follow your enquiry or find the support that fits you.','/portal/requests','My conversations'];
}
function clientActionArt(kind) {
  return `<span class="client-action-symbol" aria-hidden="true">${kind==='Eat'?'🥗':kind==='Move'?'✳':'💬'}</span>`;
}
function dailyFocusItems(items,entries,options) {
  const remaining=items.filter(i=>!entries.some(e=>sameActivity(e,i,options.date)));
  const ordered=[...remaining.filter(i=>i.kind==='workout'),...remaining.filter(i=>i.kind!=='workout')];
  return {first:ordered.slice(0,3),more:ordered.slice(3),logged:items.filter(i=>entries.some(e=>sameActivity(e,i,options.date)))};
}
function clientCheckinHistory(c) {
 return `<article class="card checkin-history"><div class="row"><h3>Week of ${esc(c.week)}</h3><span class="pill">${c.feedback?'Feedback ready':'Saved · awaiting feedback'}</span></div><p class="pre">${esc(c.progress)}</p><p class="micro">Energy you reported: ${c.energy}/5</p>${c.notes||c.measurements?`<details><summary>Your optional notes</summary>${c.notes?`<p class="pre">${esc(c.notes)}</p>`:''}${c.measurements?`<p class="pre">${esc(c.measurements)}</p>`:''}</details>`:''}<div class="reply"><strong>Alex’s feedback</strong><p class="pre">${esc(c.feedback||'Alex hasn’t left feedback yet.')}</p></div></article>`;
}
function clientCheckinsPage(d) {
 const thisWeek=checkinMonday(d.user.profile?.timezone),week=query().get('week')||thisWeek;
 if(!validCalendarDate(week)||new Date(week+'T12:00:00Z').getUTCDay()!==1)throw Error('Choose a Monday for your check-in week.');
 const saved=d.checkins.find(c=>c.week===week),active=d.requests.some(r=>r.active);
 const sorted=[...d.checkins].sort((a,b)=>b.week.localeCompare(a.week)),ordered=saved?[saved,...sorted.filter(c=>c!==saved)]:sorted;
 const history=ordered.slice(0,3).map(clientCheckinHistory).join(''),older=ordered.slice(3);
 const weekLinks=`<div class="actions checkin-week-links">${link('/portal/checkins?week='+dateShift(week,-7),'Choose an earlier week','secondary small')}${week!==thisWeek?link('/portal/checkins','Back to this week','secondary small'):''}</div>`;
 const editor=saved?`<section class="card checkin-saved" role="status" tabindex="-1"><span class="client-action-symbol" aria-hidden="true">✓</span><h3>Your check-in is saved.</h3><p>Week of ${esc(week)}. ${saved.feedback?'Alex’s response is beside your update.':'Alex can now take a look.'}</p><p class="micro">One check-in per week keeps the conversation together.</p>${weekLinks}</section>`:!active?empty('Start with a conversation.','Weekly check-ins open when Alex activates your coaching service.',link('/portal/requests','View my requests','secondary')):`<div class="card checkin-editor"><span class="eyebrow">A moment to reflect · week of <span data-checkin-week>${esc(week)}</span></span><h3>Your week, in your words.</h3><p>A sentence is enough. Start with whichever feels useful:</p><ul class="checkin-prompts"><li><span aria-hidden="true">✦</span> A small win</li><li><span aria-hidden="true">〰</span> A tricky moment</li><li><span aria-hidden="true">💬</span> Something to ask</li></ul>${form('checkin',`<label>How did training or your plan feel?<textarea name="progress" required maxlength="4000" rows="4"></textarea></label>`+select('energy','How was your energy this week?',[["",'Choose how it felt'],[1,'1 · Low'],[2,'2 · A little low'],[3,'3 · Steady'],[4,'4 · Good'],[5,'5 · High']],'').replace('<select name="energy">','<select name="energy" required>')+`<details class="checkin-options"><summary>Choose a different week or add a little more (optional)</summary>${field('week','Week starting (Monday)',week,'date','required')}${area('notes','Anything you’d like Alex to know?','',false).replace('<textarea name="notes"','<textarea maxlength="4000" name="notes"')}${area('measurements','Optional measurements','',false).replace('<textarea name="measurements"','<textarea maxlength="1000" name="measurements"')}</details><p class="micro">Shared privately with Alex only when you send your check-in.</p>`,'Send check-in')}${week!==thisWeek?link('/portal/checkins','Back to this week','secondary small'):''}</div>`;
 return `<div class="checkin-page-heading"><span class="client-action-symbol" aria-hidden="true">💬</span><div><h2>How’s it going?</h2><p>Big wins, small steps, a tricky week — all welcome.</p></div></div><div class="checkin-layout"><section class="checkin-compose" aria-label="Your weekly check-in">${editor}</section><section class="checkin-replies" aria-label="Check-in history and feedback"><h3>Your check-ins & feedback</h3>${history||'<p class="muted">Your first check-in and Alex’s feedback will stay here. There’s no need to have a perfect week.</p>'}${older.length?`<details class="checkin-older"><summary>More check-ins (${older.length})</summary>${older.map(clientCheckinHistory).join('')}</details>`:''}${animatedArtwork('rest','checkin-art')}</section></div>`;
}
