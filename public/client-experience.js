/* Small, honest next steps. Presentation helpers never change coaching records. */
function clientCoachAction(d,day) {
  const waiting=d.requests.find(r=>r.status==='awaiting_client_response');
  if(waiting)return ['Your coach','Alex has a question for you.','Pick up your conversation and agree the next step.','/request/'+waiting.id,'Reply to Alex'];
  const week=dateShift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));
  const saved=d.checkins.find(c=>c.week===week);
  if(saved)return ['Your coach',saved.feedback?'Alex’s feedback is here.':'Your check-in is saved.',saved.feedback?'Read the response with your weekly update.':'Alex can review it. Your saved update is here whenever you need it.','/portal/checkins',saved.feedback?'Read feedback':'View my check-in'];
  if(d.requests.some(r=>r.active))return ['Your coach','How has your week felt?','A win, a tricky moment or a question. There’s room for all of it.','/portal/checkins','Catch up with Alex'];
  return ['Your coach','A conversation comes first.','Follow your enquiry or find the support that fits you.','/portal/requests','My conversations'];
}
function clientActionArt(kind) {
  const scene=kind==='Eat'?'eat':kind==='Move'?'move':'coach';
  const drawings={
   eat:'<path d="M12 29h32c-1 12-7 18-16 18S13 41 12 29Z" fill="#f1a16e"/><path d="M15 27c-2-7 2-11 8-9 1-8 10-9 13-2 7-2 10 6 5 11" fill="#aabd79"/><path d="m25 23 5 4m4-8-2 7M11 30h34M19 47h18"/>',
   move:'<path d="m19 33 6-12 6 6 9 1M25 21l6-6M25 31l8 8-3 9M24 32l-8 10H9"/><circle cx="34" cy="9" r="4" fill="#f1a16e"/><path d="M8 18h8M6 25h7M41 40h7" stroke="#8b9d5e"/>',
   coach:'<path d="M9 14c0-5 5-8 12-8h14c7 0 12 4 12 10v10c0 6-5 10-12 10H23L12 45l1-13c-3-2-4-5-4-9Z" fill="#efd1b7"/><path d="M19 18h18M19 25h12"/><path d="m35 42 4 4 8-9" stroke="#597446"/>'
  };
  return `<span class="client-action-symbol client-action-illustration client-action-${scene}" aria-hidden="true"><svg viewBox="0 0 56 56" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${drawings[scene]}</svg></span>`;
}
function dailyFocusItems(items,entries,options) {
  const remaining=items.filter(i=>!entries.some(e=>sameActivity(e,i,options.date)));
  const ordered=[...remaining.filter(i=>i.kind==='workout'),...remaining.filter(i=>i.kind!=='workout')];
  return {first:ordered.slice(0,3),more:ordered.slice(3),logged:items.filter(i=>entries.some(e=>sameActivity(e,i,options.date)))};
}
function clientWeekDate(week) {
 const label=validCalendarDate(week)?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(week+'T12:00:00Z')):week;
 return `<time datetime="${esc(week)}">${esc(label)}</time>`;
}
function clientCheckinHistory(c,selectedWeek='') {
 return `<article class="card checkin-history"${c.week===selectedWeek?' data-selected-week="true"':''}><div class="row"><div>${c.week===selectedWeek?'<span class="checkin-selected-label">Selected week</span>':''}<h3>Week of ${clientWeekDate(c.week)}</h3></div><span class="pill" data-feedback="${c.feedback?'ready':'waiting'}"><span aria-hidden="true">${c.feedback?'💬':'✓'}</span> ${c.feedback?'Feedback ready':'Saved'}</span></div><p class="pre checkin-reflection">${esc(c.progress)}</p><p class="micro checkin-energy">Energy you reported <strong>${c.energy}<span>/5</span></strong></p>${c.notes||c.measurements?`<details><summary>Your optional notes</summary>${c.notes?`<p class="pre">${esc(c.notes)}</p>`:''}${c.measurements?`<p class="pre">${esc(c.measurements)}</p>`:''}</details>`:''}<div class="reply" data-feedback="${c.feedback?'ready':'waiting'}"><strong>${c.feedback?'Alex’s feedback':'Awaiting Alex’s feedback'}</strong>${c.feedback?`<p class="pre">${esc(c.feedback)}</p>`:''}</div></article>`;
}
function clientCheckinsPage(d) {
 const thisWeek=checkinMonday(d.user.profile?.timezone),week=query().get('week')||thisWeek;
 if(!validCalendarDate(week)||new Date(week+'T12:00:00Z').getUTCDay()!==1)throw Error('Choose a Monday for your check-in week.');
 const saved=d.checkins.find(c=>c.week===week),active=d.requests.some(r=>r.active);
 const sorted=[...d.checkins].sort((a,b)=>b.week.localeCompare(a.week)),ordered=saved?[saved,...sorted.filter(c=>c!==saved)]:sorted;
 const history=ordered.slice(0,3).map(c=>clientCheckinHistory(c,week)).join(''),older=ordered.slice(3);
 const weekLinks=`<div class="actions checkin-week-links">${link('/portal/checkins?week='+dateShift(week,-7),'Choose an earlier week','secondary small')}${week!==thisWeek?link('/portal/checkins','Back to this week','secondary small'):''}</div>`;
 const editor=saved?`<section class="card checkin-saved" role="status" tabindex="-1"><span class="client-action-symbol" aria-hidden="true">✓</span><h3>Your check-in is saved.</h3><p>Week of ${clientWeekDate(week)}. ${saved.feedback?'Alex’s response is in your saved update.':'Alex can now take a look.'}</p><p class="micro">One check-in per week keeps the conversation together.</p>${weekLinks}</section>`:!active?empty('Start with a conversation.','Weekly check-ins open when Alex activates your coaching service.',link('/portal/requests','View my requests','secondary')):`<div class="card checkin-editor"><span class="eyebrow">A moment to reflect · week of <span data-checkin-week>${esc(week)}</span></span><h3>Your week, in your words.</h3><p>A sentence is enough. Start with whichever feels useful:</p><ul class="checkin-prompts"><li><span aria-hidden="true">✦</span> A small win</li><li><span aria-hidden="true">〰</span> A tricky moment</li><li><span aria-hidden="true">💬</span> Something to ask</li></ul>${form('checkin',`<label>How did training or your plan feel?<textarea name="progress" required maxlength="4000" rows="4"></textarea></label>`+select('energy','How was your energy this week?',[["",'Choose how it felt'],[1,'1 · Low'],[2,'2 · A little low'],[3,'3 · Steady'],[4,'4 · Good'],[5,'5 · High']],'').replace('<select name="energy">','<select name="energy" required>')+`<details class="checkin-options"><summary>Choose a different week or add a little more (optional)</summary>${field('week','Week starting (Monday)',week,'date','required')}${area('notes','Anything you’d like Alex to know?','',false).replace('<textarea name="notes"','<textarea maxlength="4000" name="notes"')}${area('measurements','Optional measurements','',false).replace('<textarea name="measurements"','<textarea maxlength="1000" name="measurements"')}</details><p class="micro checkin-privacy"><span aria-hidden="true">↗</span> Shared privately with Alex only when you send your check-in.</p>`,'Send check-in')}${week!==thisWeek?link('/portal/checkins','Back to this week','secondary small'):''}</div>`;
 return `<div class="checkin-page-heading"><span class="client-action-symbol" aria-hidden="true">💬</span><div><h2>How’s it going?</h2><p>Big wins, small steps, a tricky week — all welcome.</p></div></div><div class="checkin-layout"><section class="checkin-compose" aria-label="Your weekly check-in">${editor}</section><section class="checkin-replies" aria-label="Check-in history and feedback"><h3>Your check-ins & feedback</h3>${history||'<p class="muted">Your first check-in and Alex’s feedback will stay here. There’s no need to have a perfect week.</p>'}${older.length?`<details class="checkin-older"><summary>More check-ins (${older.length})</summary>${older.map(c=>clientCheckinHistory(c,week)).join('')}</details>`:''}${animatedArtwork('rest','checkin-art')}</section></div>`;
}
