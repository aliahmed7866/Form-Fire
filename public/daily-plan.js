/* Daily plan views. Calendar labels use an explicit zone; source plans remain immutable. */
const dailyWeekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function calendarDate(timezone,now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=name=>parts.find(p=>p.type===name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function dateShift(date,days) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function validCalendarDate(value) {return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function dailyOptions() {
  const timezone=query().get('zone')||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  try {new Intl.DateTimeFormat('en-GB',{timeZone:timezone});}catch{throw Error('Choose a valid time zone, such as Europe/London.');}
  const today=calendarDate(timezone),date=query().get('date')||today;
  if(!validCalendarDate(date))throw Error('Choose a valid calendar date.');
  return {timezone,today,date};
}
function dailyLink(date,timezone) {return '/portal/today?date='+encodeURIComponent(date)+'&zone='+encodeURIComponent(timezone);}
function currentActivePlans(d) {
  const active=new Set(d.requests.filter(r=>r.active).map(r=>r.id)),latest=new Map();
  for(const a of d.assignments){if(!active.has(a.request_id))continue;const key=a.request_id+':'+a.kind;const previous=latest.get(key);if(!previous||a.version>previous.version)latest.set(key,a);}
  return [...latest.values()];
}
function planItems(assignments) {
  return assignments.flatMap(a=>{
    const kind=a.kind==='training'?'workout':'meal',items=kind==='workout'?(a.snapshot.workouts||[]):(a.snapshot.meals||[]);
    return items.map((item,index)=>({assignment:a,item,kind,index,title:kind==='workout'?item.name:item.slot+' · '+item.recipe.title}));
  });
}
function scheduleMatch(day,date) {
  const label=String(day||'').trim().toLowerCase();
  if(['daily','every day'].includes(label))return 'scheduled';
  const named=dailyWeekdays.findIndex(x=>x.toLowerCase()===label);
  if(named<0)return 'flexible';
  return named===new Date(date+'T12:00:00Z').getUTCDay()?'scheduled':'other';
}
function sameActivity(entry,item,date) {return entry.assignment_id===item.assignment.id&&entry.item_kind===item.kind&&entry.item_index===item.index&&entry.activity_date===date;}
function canRecordItem(item,date,timezone,today) {
  const publication=calendarDate(timezone,new Date(item.assignment.created_at.replace(' ','T')+'Z'));
  return date>=dateShift(today,-90)&&date<=today&&date>=publication;
}
function activityFields(item,options) {
  return `<input type="hidden" name="assignment_id" value="${esc(item.assignment.id)}"><input type="hidden" name="item_kind" value="${item.kind}"><input type="hidden" name="item_index" value="${item.index}"><input type="hidden" name="activity_date" value="${options.date}"><input type="hidden" name="timezone" value="${esc(options.timezone)}">`;
}
function dailyItemCard(item,entries,options) {
  const done=entries.find(e=>sameActivity(e,item,options.date)),editable=canRecordItem(item,options.date,options.timezone,options.today),isWorkout=item.kind==='workout';
  const data=`data-assignment="${esc(item.assignment.id)}" data-kind="${item.kind}" data-index="${item.index}" data-date="${options.date}" data-timezone="${esc(options.timezone)}" data-completed="${!done}" data-note="${esc(done?.notes||'')}" data-effort="${done?.effort||''}"`;
  return `<article class="card daily-item ${done?'logged':''}" data-daily-item="${esc(item.assignment.id)}-${item.kind}-${item.index}"><div class="row"><div><span class="eyebrow">${isWorkout?'Move a little':'Good food'} · ${esc(item.item.day)}</span><h3>${esc(item.title)}</h3></div>${done?'<span class="pill strong">✓ Logged</span>':''}</div><p class="micro">${esc(item.assignment.title)} · version ${item.assignment.version}</p>${starterBadge(item.assignment.snapshot.is_demo)}${isWorkout?`<p>${item.item.exercises.length} exercises · ${item.item.exercises.reduce((n,e)=>n+e.sets,0)} total sets</p><details><summary>Exercises & demonstrations</summary>${item.item.exercises.map(e=>`<div class="daily-exercise"><h4>${esc(e.exercise.title)}</h4><p>${e.sets} sets · ${esc(e.reps)} reps / duration · ${e.rest_seconds}s rest</p><p class="pre">${esc(e.exercise.instructions)}</p>${e.notes?`<p class="pre">${esc(e.notes)}</p>`:''}${exerciseMedia(e.exercise)}</div>`).join('')}</details>`:`<p><strong>For you:</strong> ${esc(item.item.servings)}</p>${item.item.notes?`<p class="pre">${esc(item.item.notes)}</p>`:''}<details><summary>Ingredients & preparation</summary>${recipeView(item.item.recipe)}</details>`}
  <div class="actions daily-actions">${editable?`<button type="button" class="${done?'secondary':''}" data-daily-action="toggle" ${data} aria-label="${done?'Undo log for':'Log'} ${esc(item.title)}">${done?'Undo log':isWorkout?'Workout done ✓':'Meal prepared ✓'}</button>`:'<span class="micro">Preview only — log on or after publication, up to 90 days back and through today.</span>'}${link('/plan/'+item.assignment.id,'Full plan ↗','secondary small')}</div>
  ${done?.notes?`<p class="pre daily-note">${esc(done.notes)}</p>`:''}${done?.effort?`<p class="micro">Effort you reported: ${done.effort}/5</p>`:''}${editable?`<details class="daily-note-editor"><summary>${done?'Edit your note':'Add a note for Alex (optional)'}</summary>${form('activity-note',activityFields(item,options)+area('notes','How did it go?',done?.notes||'',false)+(isWorkout?select('effort','How challenging was it? (optional)',[['','Leave blank'],['1','1 · Very light'],['2','2 · Light'],['3','3 · Moderate'],['4','4 · Challenging'],['5','5 · Very challenging']],String(done?.effort||'')):'')+'<p class="micro">Saving a note also logs this item. Alex can see your note.</p>','Save log & note')}</details>`:''}</article>`;
}
function activityHistory(d,entries) {
  if(!entries.length)return empty('A little space for your week.','Logs will appear here when you choose to add them.');
  return `<div class="activity-history">${entries.slice().sort((a,b)=>b.activity_date.localeCompare(a.activity_date)||b.completed_at.localeCompare(a.completed_at)).map(e=>{
    const a=d.assignments.find(a=>a.id===e.assignment_id),list=e.item_kind==='workout'?a?.snapshot.workouts:a?.snapshot.meals,item=list?.[e.item_index],title=e.item_kind==='workout'?item?.name:item?(item.slot+' · '+item.recipe.title):null;
    return `<article class="history-row"><div><span class="micro">${esc(e.activity_date)} · ${esc(e.timezone)}</span><h4>${esc(title||'Plan activity')}</h4><p class="micro">${e.item_kind==='workout'?'Workout completed':'Meal prepared'} · plan version ${a?.version||'—'}</p>${e.notes?`<p class="pre">${esc(e.notes)}</p>`:''}</div>${a?link('/plan/'+a.id,'View plan','secondary small'):''}</article>`;
  }).join('')}</div>`;
}
async function todayPage(d) {
  const viewer=d.user||session.user;
  if(viewer?.role==='admin')return '<div class="notice">Today is a client view. Use <a href="#/admin/progress">Client progress</a> to review their logs, or sign in with a test client to try it.</div>';
  if(!viewer?.verified)return '<div class="notice">Verify your account to open your daily plan. <a href="#/verify">Enter your verification code →</a></div>';
  const options=dailyOptions(),{date,timezone,today}=options;
  const dayIndex=new Date(date+'T12:00:00Z').getUTCDay(),monday=dateShift(date,-((dayIndex+6)%7)),sunday=dateShift(monday,6);
  const report=await api('/activity?from='+monday+'&to='+sunday),entries=report.entries;
  const plans=currentActivePlans(d),items=planItems(plans),scheduled=items.filter(i=>scheduleMatch(i.item.day,date)==='scheduled'),flexible=items.filter(i=>scheduleMatch(i.item.day,date)==='flexible'),other=items.filter(i=>scheduleMatch(i.item.day,date)==='other');
  const header=`<div class="today-heading"><div><div class="eyebrow">One next step at a time</div><h2>${date===today?'A little progress.<br><span class="serif">Your way.</span>':'Your plan for '+new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}</h2><p class="muted">Your workouts, good food and a place to tell Alex how it went.</p></div><div class="week-totals"><strong>${entries.filter(e=>e.item_kind==='workout').length}</strong><span>workouts logged this week</span><strong>${entries.filter(e=>e.item_kind==='meal').length}</strong><span>meals prepared this week</span></div></div>`;
  const controls=`<details class="date-settings"><summary>${esc(date)} · ${esc(timezone)} — change date or time zone</summary>${form('daily-date',`<div class="form-grid">${field('date','View date',date,'date','required')}${field('timezone','Time zone',timezone,'text','required placeholder="Europe/London"')}</div>`,'Show this day')}</details><nav class="week-strip" aria-label="Days in selected week">${Array.from({length:7},(_,i)=>{const day=dateShift(monday,i),total=entries.filter(e=>e.activity_date===day).length;return `<a href="#${dailyLink(day,timezone)}" class="${day===date?'selected':''}" ${day===date?'aria-current="date"':''}><span>${dailyWeekdays[(i+1)%7].slice(0,3)}</span><strong>${Number(day.slice(8))}</strong><small>${total?'✓ '+total:'—'}</small></a>`;}).join('')}</nav><div class="row week-navigation">${link(dailyLink(dateShift(date,-7),timezone),'← Previous week','secondary small')}${link(dailyLink(today,timezone),'Today','secondary small')}${link(dailyLink(dateShift(date,7),timezone),'Next week →','secondary small')}</div>`;
  const requestsNote=d.requests.some(r=>r.status==='awaiting_client_response')?`<div class="notice">Alex has a question for you. <a href="#/portal/requests">Open your requests →</a></div>`:'';
  const sections=plans.length?`${scheduled.length?`<div class="daily-grid">${scheduled.map(i=>dailyItemCard(i,entries,options)).join('')}</div>`:empty('A little breathing room.','Nothing has a recurring day matching this date. You can open another day or choose a plan item below.')}${flexible.length?`<section class="flexible-items"><h3>Find a time that fits.</h3><p class="micro">These plan labels do not name a recurring weekday. Agree the timing with Alex.</p><div class="daily-grid">${flexible.map(i=>dailyItemCard(i,entries,options)).join('')}</div></section>`:''}${other.length?`<details><summary>Using a different day? Choose from your other plan items</summary><p class="micro">Logging here records the selected date; it does not change Alex’s plan.</p><div class="daily-grid">${other.map(i=>dailyItemCard(i,entries,options)).join('')}</div></details>`:''}${!items.length?`<div class="notice">Your current plans use written guidance. <a href="#/portal/plans">Open your plans</a> to follow them; daily tracking appears when Alex publishes structured workouts or meals.</div>`:''}`:empty('Your next chapter is taking shape.','Once Alex activates your service and publishes a plan, you’ll find your days here.',link('/portal/requests','View your requests','secondary small'));
  const shopping=link('/portal/shopping','Shop & prepare — your saved checklist ↗','secondary')+plans.filter(a=>a.kind==='meal'&&a.snapshot.shopping_list).map(a=>`<details><summary>${esc(a.title)} · shopping list</summary><p class="micro">Follow the quantities and serving notes agreed with Alex.</p><div class="pre">${esc(a.snapshot.shopping_list)}</div></details>`).join('');
  return `<div class="daily-welcome">${header}${artwork('train','today-art')}</div>`+controls+requestsNote+sections+shopping+dailyInvitation(date)+`<section class="weekly-history"><div class="section-top"><div><div class="eyebrow">${monday} to ${sunday}</div><h2>A few steps <span class="serif">worth noticing.</span></h2></div></div><p class="micro">Only what you choose to log. A blank day isn’t a judgement.</p>${activityHistory(d,entries)}</section>`;
}
async function adminProgressPage() {
  const today=calendarDate('UTC'),from=query().get('from')||dateShift(today,-6),to=query().get('to')||today;
  if(!validCalendarDate(from)||!validCalendarDate(to))throw Error('Choose valid report dates.');
  const report=await api('/admin/activity?from='+from+'&to='+to);
  const summary=report.summary.map(c=>`<article class="card"><h3>${esc(c.client_name)}</h3><div class="progress-counts"><span><strong>${c.workouts_completed}</strong>workouts logged</span><span><strong>${c.meals_prepared}</strong>meals prepared</span></div><p class="micro">${c.last_activity?'Last logged activity: '+esc(c.last_activity):'No activity logged in this period.'}</p></article>`).join('');
  return `<h2>Start with <span class="serif">how they’re doing.</span></h2><p class="muted">Client-reported workouts, meals and notes. These counts describe what was logged, not adherence or outcomes.</p><div class="card">${form('progress-range',`<div class="form-grid">${field('from','From',from,'date','required')}${field('to','To',to,'date','required')}</div><p class="micro">Up to 90 days per report. Dates use each entry’s recorded local calendar day; its time zone stays attached.</p>`,'Show progress')}</div><div class="grid">${summary||empty('No clients yet.','Client progress will appear here after they join.')}</div><h3>Notes from their week</h3>${report.entries.length?report.entries.map(e=>`<article class="card"><div class="row"><h3>${esc(e.client_name)} · ${esc(e.item_title)}</h3>${pill(e.item_kind==='workout'?'workout completed':'meal prepared')}</div><p class="micro">${esc(e.activity_date)} · ${esc(e.timezone)} · ${esc(e.plan_title)}</p>${e.effort?`<p class="micro">Reported effort: ${e.effort}/5</p>`:''}<p class="pre">${esc(e.notes||'No note added.')}</p>${link('/plan/'+e.assignment_id,'View assigned version ↗','secondary small')}</article>`).join(''):empty('No logs in this date range.','You can follow up through their request or weekly check-in.')}`;
}
async function submitDailyForm(kind,b) {
  if(kind==='daily-date') {
    try {new Intl.DateTimeFormat('en-GB',{timeZone:b.timezone});}catch{throw Error('Choose a valid time zone, such as Europe/London.');}
    if(!validCalendarDate(b.date))throw Error('Choose a valid date.');
    navigate(dailyLink(b.date,b.timezone));return;
  }
  if(kind==='progress-range') {
    if(!validCalendarDate(b.from)||!validCalendarDate(b.to)||b.from>b.to||b.to>dateShift(b.from,89))throw Error('Choose an ordered date range of no more than 90 days.');
    navigate('/admin/progress?from='+b.from+'&to='+b.to);return;
  }
  if(kind==='activity-note') {
    await api('/assignments/'+b.assignment_id+'/activity','PUT',{item_kind:b.item_kind,item_index:Number(b.item_index),activity_date:b.activity_date,timezone:b.timezone,completed:true,notes:b.notes,effort:b.effort?Number(b.effort):null});
    toast('Your log and note are saved.');await render();
  }
}
function activityFromButton(button) {
  const d=button.dataset;
  return {assignmentId:d.assignment,payload:{item_kind:d.kind,item_index:Number(d.index),activity_date:d.date,timezone:d.timezone,completed:d.completed==='true',notes:d.note||'',effort:d.effort?Number(d.effort):null}};
}
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-daily-action]');if(!button)return;
  const {assignmentId,payload}=activityFromButton(button);button.disabled=true;
  try {
    await api('/assignments/'+assignmentId+'/activity','PUT',payload);
    toast(payload.completed?'Saved. One step at a time.':'Log removed. You can add it again whenever you like.');await render();
    document.querySelector(`[data-daily-item="${assignmentId}-${payload.item_kind}-${payload.item_index}"] [data-daily-action]`)?.focus({preventScroll:true});
  }catch(error){toast(error.message);}finally{button.disabled=false;}
});
