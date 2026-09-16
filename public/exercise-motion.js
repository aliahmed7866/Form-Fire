/* Original FORM & FIRE motion artwork. No media requests, canvas or animation dependencies.
   Joint targets are interpolated; two-bone IK preserves the lengths of arms and legs.
   These stylised examples complement the coach's written instructions and video. */

function exerciseIllustration(key, progress=0) {
  return exerciseMotionEngine.illustration(key,progress);
}

function exerciseArt(exercise,{compact=false}={}) {
  const key=typeof exercise==='string'?exercise:exercise?.animation||exercise?.animation_key||exercise?.key;
  const item=Object.hasOwn(exerciseMotionCatalog,key)?exerciseMotionCatalog[key]:null;
  if(!item)return '';
  const esc=exerciseMotionEngine.escape;
  const title=typeof exercise==='object'&&exercise.title?exercise.title:item.title;
  return `<figure class="exercise-motion${compact?' exercise-motion--compact':''}" data-exercise-motion="${esc(key)}" data-motion-state="paused" data-motion-title="${esc(title)}"><figcaption class="exercise-motion-heading"><span>${esc(item.group)} <span aria-hidden="true">/</span> <strong>Movement guide</strong></span><span class="exercise-motion-format">${esc(item.viewLabel||(item.view==='front'?'Front view':'Side view'))}</span></figcaption><div class="exercise-motion-stage" data-motion-stage>${exerciseIllustration(key)}</div><div class="exercise-motion-caption"><span class="exercise-motion-step" data-motion-step>01 / 02</span><p data-motion-cue>${esc(item.phases[0])}</p></div><div class="exercise-motion-track" aria-hidden="true"><span data-motion-progress></span></div><label class="exercise-motion-scrub"><span>Explore the movement <output data-motion-position aria-live="off">0%</output></span><input type="range" min="0" max="100" step="1" value="0" data-motion-scrub aria-label="Movement position for ${esc(title)}" aria-valuetext="Start position"><span class="exercise-motion-range-labels"><span>Start</span><span>${item.hold?'Hold':'Finish'}</span></span></label><div class="exercise-motion-controls"><button type="button" class="small" data-motion-action="play" aria-pressed="false" aria-label="Play ${esc(title)} illustration"><span data-motion-play-label>Play movement</span></button><button type="button" class="small secondary" data-motion-action="next" aria-label="Show next pose for ${esc(title)}">Next pose <span aria-hidden="true">↗</span></button><label class="exercise-motion-speed"><span class="exercise-motion-sr-only">Playback speed for ${esc(title)}</span><select data-motion-speed aria-label="Playback speed for ${esc(title)}"><option value="1">1× speed</option><option value="0.5">½× speed</option><option value="0.25">¼× speed</option></select></label></div><p class="exercise-motion-note">Illustrated example. Follow Alex’s written cues and demonstration video.</p><p class="exercise-motion-status exercise-motion-sr-only" data-motion-status role="status" aria-live="polite"></p></figure>`;
}

const exerciseMotionEngine=(() => {
  const ink='#28372b',sage='#748264',lime='#d4e575',bone='#f6f3e8';
  const styles=[
    {skin:'#bd815f',shade:'#a96545',shirt:'#d4e575',pants:'#344c40',hair:'#302e25',style:0},
    {skin:'#774b35',shade:'#5c392b',shirt:'#eee9d6',pants:'#596c4c',hair:'#282722',style:1},
    {skin:'#dbaa84',shade:'#b87d5d',shirt:'#8b9c70',pants:'#323c36',hair:'#65462f',style:2},
    {skin:'#9b684a',shade:'#754b33',shirt:'#d4e575',pants:'#566b53',hair:'#252a24',style:3},
    {skin:'#e6b795',shade:'#c58e6b',shirt:'#566d58',pants:'#a8b28a',hair:'#966849',style:1},
    {skin:'#67402f',shade:'#493127',shirt:'#bdcba0',pants:'#344a3c',hair:'#25261f',style:2}
  ];
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Math.round(v*100)/100;
  const xy=p=>`${n(p[0])} ${n(p[1])}`;
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
  const vec=(angle,length)=>[Math.sin(angle*Math.PI/180)*length,Math.cos(angle*Math.PI/180)*length];
  const mix=(a,b,t)=>a+(b-a)*t;
  function interpolate(a,b,t) {
    if(Array.isArray(a)&&Array.isArray(b))return a.map((v,i)=>interpolate(v,b[i],t));
    if(typeof a==='number'&&typeof b==='number')return mix(a,b,t);
    return a??b;
  }
  function currentPose(entry,t) {
    const position=t*(entry.poses.length-1),index=Math.min(Math.floor(position),entry.poses.length-2);
    const a=entry.poses[index],b=entry.poses[index+1],segment=position-index;
    return Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(key=>[key,['elbows','knees'].includes(key)?(a[key]??b[key]):interpolate(a[key]??0,b[key]??0,segment)]));
  }
  /* Solve a two-segment chain from a fixed root towards a target. */
  function joint(root,target,length1,length2,bend=1) {
    const delta=[target[0]-root[0],target[1]-root[1]],distance=Math.hypot(...delta)||.001;
    const d=Math.min(length1+length2-.01,Math.max(Math.abs(length1-length2)+.01,distance));
    const axis=delta.map(v=>v/distance),reach=axis.map((v,i)=>root[i]+v*d);
    const along=(length1*length1-length2*length2+d*d)/(2*d);
    const height=Math.sqrt(Math.max(0,length1*length1-along*along))*bend;
    return {mid:[root[0]+axis[0]*along-axis[1]*height,root[1]+axis[1]*along+axis[0]*height],end:reach};
  }
  function limb(a,b,c,color,width,opacity=1) {
    return `<path d="M${xy(a)}L${xy(b)}L${xy(c)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
  }
  function line(a,b,color,width) {return `<path d="M${xy(a)}L${xy(b)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;}
  function weight(point,grip='standard') {
    return `<g transform="translate(${xy(point)}) rotate(${grip==='hammer'?90:0})"><path d="M-14 0H14" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><rect x="-19" y="-10" width="10" height="20" rx="3" fill="${sage}" stroke="${ink}" stroke-width="1.5"/><rect x="9" y="-10" width="10" height="20" rx="3" fill="${sage}" stroke="${ink}" stroke-width="1.5"/><path d="M-15-6v12M13-6v12" stroke="${lime}" stroke-width="2"/></g>`;
  }
  function shoe(point,side,front,heels=0,angle=0) {
    const flip=front&&side===0?-1:1;
    return `<g transform="translate(${xy(point)}) scale(${flip} 1) rotate(${n(heels*43+angle)})"><path d="M-8-5h12l5 5 14 3q5 1 5 7H-8z" fill="${bone}" stroke="${ink}" stroke-width="1.5"/><path d="M-7 8h34" stroke="${sage}" stroke-width="3"/><path d="M6-1l-3 4m9-2-3 4" stroke="${ink}" stroke-width="1.5"/></g>`;
  }
  function geometry(entry,t) {
    const p=currentPose(entry,t),front=entry.view==='front',angle=p.lean||0;
    const hip=p.shoulderAnchor?add(p.shoulderAnchor,vec(-angle,p.torso||66)):p.hip;
    const shoulder=p.shoulderAnchor||add(hip,vec(180-angle,p.torso||66));
    const normal=[Math.cos(angle*Math.PI/180),Math.sin(angle*Math.PI/180)];
    const hips=[-1,1].map((sign,i)=>add(hip,front?normal.map(x=>x*12*sign):[i*7-3,i?-1:-3]));
    const shoulders=[-1,1].map((sign,i)=>add(shoulder,front?normal.map(x=>x*19*sign):[i*7-3,i?-1:-3]));
    const arms=shoulders.map((root,i)=>{
      if(p.elbowAngles&&p.elbowAngles[i]!==null){const mid=add(root,vec(p.elbowAngles[i],36));return {mid,end:add(mid,vec(p.forearmAngles[i],35))};}
      return joint(root,p.hands[i],36,35,p.elbows?.[i]??(front?(i?-1:1):-1));
    });
    const [thighLength,shinLength]=entry.legLengths||[52,50];
    const legs=hips.map((root,i)=>{
      if(p.upperLegAngles&&p.upperLegAngles[i]!==null){const mid=add(root,vec(p.upperLegAngles[i],thighLength));return {mid,end:add(mid,vec(p.lowerLegAngles[i],shinLength))};}
      let target=p.feet[i];
      if(entry.footArc?.[i])target=[target[0],target[1]-entry.footArc[i]*Math.sin(Math.PI*t)];
      if(entry.toePivot?.[i]) {
        const flip=front&&i===0?-1:1,angle=(p.heelSides?.[i]??p.heels??0)*43*Math.PI/180;
        const baseline=entry.poses[0].feet[i];
        // Keep the forefoot fixed while the ankle follows the shoe's rotation.
        target=[baseline[0]+flip*(27-(27*Math.cos(angle)-8*Math.sin(angle))),baseline[1]+8-(27*Math.sin(angle)+8*Math.cos(angle))];
      }
      return joint(root,target,thighLength,shinLength,p.knees?.[i]??(front?(i?-1:1):-1));
    });
    // A clamshell rotates the upper leg away from the viewer; project the knee's
    // circular arc into the drawing while the two feet remain together.
    if(p.topKneeOpen&&legs[1]){
      const closed=legs[1].mid,open=joint(hips[1],p.feet[1],thighLength,shinLength,-1).mid;
      legs[1].mid=[mix(closed[0],open[0],p.topKneeOpen),mix(closed[1],open[1],p.topKneeOpen)];
    }
    return {p,hip,shoulder,hips,shoulders,arms,legs,front,normal};
  }
  function equipment(entry,g) {
    let html='';
    if(entry.prop==='wall')html+=`<path d="M299 67v210" stroke="#72815f" stroke-width="10" stroke-linecap="round"/><path d="M309 74h13m-13 23h13m-13 23h13m-13 23h13m-13 23h13m-13 23h13m-13 23h13m-13 23h13m-13 23h13" stroke="#bdc7a8" stroke-width="2"/>`;
    if(entry.prop==='chair')html+=`<g fill="none" stroke="${sage}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M136 175v62h66M144 237l-7 40M193 237l6 40"/></g><path d="M146 232h56" stroke="${lime}" stroke-width="9" stroke-linecap="round"/>`;
    if(entry.prop==='balance-chair')html+=`<g fill="none" stroke="${sage}" stroke-width="6" stroke-linecap="round"><path d="M93 143h38v89H92M98 232v43M127 232v43M93 143v89"/></g><path d="M94 229h37" stroke="${lime}" stroke-width="8"/>`;
    if(entry.prop==='bench')html+=`<path d="M270 215h72" stroke="${ink}" stroke-width="16" stroke-linecap="round"/><path d="M277 223l-8 53m65-53 8 53" stroke="${sage}" stroke-width="7" stroke-linecap="round"/>`;
    if(entry.prop==='band'){
      html+=`<path d="M328 94v76" stroke="${sage}" stroke-width="9" stroke-linecap="round"/><circle cx="324" cy="136" r="6" fill="${ink}"/>`;
      g.arms.forEach(a=>{html+=line(a.end,[325,136],'#a46c42',3);});
    }
    return html+(typeof extraExerciseEquipment==='function'?extraExerciseEquipment(entry,g):'');
  }
  function figure(entry,t) {
    const c=styles[entry.variant],g=geometry(entry,t),{p,hip,shoulder,hips,shoulders,arms,legs,front,normal}=g;
    let html=equipment(entry,g);
    // Draw the far limbs first, then the torso and the near arm.
    for(const i of [0,1]){
      html+=limb(hips[i],legs[i].mid,legs[i].end,i===0?c.shade:c.skin,17);
      html+=line(hips[i],legs[i].mid,c.pants,i===0?23:25);
      const cuff=legs[i].end.map((v,j)=>mix(legs[i].mid[j],v,.68));
      html+=line(legs[i].mid,cuff,c.pants,i===0?19:21);
      html+=shoe(legs[i].end,i,front,(p.heelSides?.[i]??p.heels??0),p.shoeAngles?.[i]??0);
    }
    const arm=i=>limb(shoulders[i],arms[i].mid,arms[i].end,i===0?c.shade:c.skin,16)+line(shoulders[i],arms[i].mid.map((v,j)=>mix(shoulders[i][j],v,.40)),c.shirt,21)+`<circle cx="${n(arms[i].end[0])}" cy="${n(arms[i].end[1])}" r="8" fill="${i===0?c.shade:c.skin}"/>`;
    html+=arm(0);
    const width=front?24:19,waist=front?18:16;
    const topL=add(shoulder,normal.map(x=>-x*width)),topR=add(shoulder,normal.map(x=>x*width));
    const lowL=add(hip,normal.map(x=>-x*waist)),lowR=add(hip,normal.map(x=>x*waist));
    html+=`<path d="M${xy(topL)}Q${xy(add(shoulder,[0,-7]))} ${xy(topR)}L${xy(lowR)}Q${xy(add(hip,[0,7]))} ${xy(lowL)}Z" fill="${c.shirt}"/><path d="M${xy(lowL)}Q${xy(add(hip,[0,7]))} ${xy(lowR)}" fill="none" stroke="${c.pants}" stroke-width="5"/><path d="M${xy(add(topL,[7,10]))}L${xy(add(lowL,[7,-8]))}" stroke="${bone}" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>`;
    const headAngle=p.headAngle??p.lean??0;
    const neck=add(shoulder,vec(180-headAngle,15));
    html+=line(shoulder,neck,c.skin,15);
    const head=add(shoulder,vec(180-headAngle,31));
    html+=`<g transform="translate(${xy(head)}) rotate(${n(headAngle)})${entry.prone?' scale(-1 1)':''}">${c.style===1?`<circle cx="-11" cy="-12" r="10" fill="${c.hair}"/>`:''}${c.style===3?`<path d="M-11-7q-18 9-10 28" fill="none" stroke="${c.hair}" stroke-width="13" stroke-linecap="round"/>`:''}<ellipse rx="15" ry="18" fill="${c.skin}"/><path d="M-15-2q-5-20 14-19 18 0 17 15-9-2-13-8-7 9-18 12Z" fill="${c.hair}"/>${(front||entry.faceFront)?`<circle cx="-5" cy="1" r="1.25" fill="${ink}"/><circle cx="6" cy="1" r="1.25" fill="${ink}"/><path d="M-3 8q4 3 8-1" fill="none" stroke="${ink}" stroke-width="1.3" stroke-linecap="round"/>`:`<path d="M13-2l7 6-7 3" fill="${c.skin}"/><circle cx="9" cy="0" r="1.3" fill="${ink}"/><path d="M9 10h5" stroke="${ink}" stroke-width="1.2" stroke-linecap="round"/>`}<circle cx="${(front||entry.faceFront)?-14:-10}" cy="4" r="3.2" fill="${c.shade}"/></g>`;
    html+=arm(1);
    if(entry.weights==='both')arms.forEach(a=>{html+=weight(a.end,entry.grip);});
    if(entry.weights==='near')html+=weight(arms[1].end,entry.grip);
    if(entry.weights==='centre')html+=weight([(arms[0].end[0]+arms[1].end[0])/2,(arms[0].end[1]+arms[1].end[1])/2],'hammer');
    if(typeof extraExerciseForeground==='function')html+=extraExerciseForeground(entry,g);
    if(entry.hold)html+=`<circle cx="324" cy="121" r="${n(19+t*6)}" fill="none" stroke="${sage}" stroke-width="1.5" opacity=".7"/><circle cx="324" cy="121" r="4" fill="${sage}"/>`;
    return html;
  }
  function illustration(key,progress=0) {
    const entry=Object.hasOwn(exerciseMotionCatalog,key)?exerciseMotionCatalog[key]:null;if(!entry)return '';
    const t=Number.isFinite(Number(progress))?Math.max(0,Math.min(1,Number(progress))):0;
    const number=String(Object.keys(exerciseMotionCatalog).indexOf(key)+1).padStart(2,'0');
    return `<svg class="exercise-motion-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" role="img" aria-label="${escape(entry.title)}: illustrated movement guide" focusable="false"><rect width="400" height="320" rx="16" fill="#e8eddd"/><path d="M0 214Q150 151 400 232V320H0Z" fill="#dce4ca"/><circle cx="313" cy="75" r="40" fill="${lime}" opacity=".55"/><path d="M29 243Q183 126 371 205M31 259Q188 146 372 222" fill="none" stroke="#f7f7e9" stroke-width="1.2" opacity=".7"/><text x="22" y="29" fill="#536548" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing="1.8">FORM &amp; FIRE / ${number}</text><text x="378" y="29" text-anchor="end" fill="#536548" font-family="Arial,sans-serif" font-size="9">${escape(entry.viewLabel||(entry.view==='front'?'Front view':'Side view'))}</text><path d="M46 285H354" stroke="#83966d" stroke-width="2" stroke-linecap="round"/>${entry.mat?`<path d="M63 273H334L359 290H38Z" fill="#7d916d"/><path d="M63 276H333" stroke="#a7b891" stroke-width="2"/>`:''}<ellipse cx="211" cy="286" rx="99" ry="6" fill="#536548" opacity=".12"/><g data-motion-figure="">${figure(entry,t)}</g><text x="200" y="309" text-anchor="middle" fill="#425637" font-family="Arial,sans-serif" font-size="10.5">${escape(entry.cue)}</text></svg>`;
  }
  const states=new WeakMap(),playing=new Map();
  let frameId=0,observer=null,reduced=null;
  function state(element) {
    if(!states.has(element))states.set(element,{progress:0,elapsed:0,speed:1,last:0,playing:false,phase:0});
    return states.get(element);
  }
  function reducedMotion() {return Boolean(reduced?.matches);}
  function tell(element,message) {const output=element.querySelector('[data-motion-status]');if(output)output.textContent=message;}
  function draw(element,s) {
    const entry=exerciseMotionCatalog[element.dataset.exerciseMotion];if(!entry)return;
    const art=element.querySelector('[data-motion-figure]');if(art)art.innerHTML=figure(entry,s.progress);
    const phase=s.progress>=.5?1:0;
    const cue=element.querySelector('[data-motion-cue]'),step=element.querySelector('[data-motion-step]');
    if(cue&&cue.textContent!==entry.phases[phase])cue.textContent=entry.phases[phase];
    if(step)step.textContent=`0${phase+1} / 02`;
    const bar=element.querySelector('[data-motion-progress]');if(bar)bar.style.width=`${n(s.progress*100)}%`;
    const scrub=element.querySelector('[data-motion-scrub]');
    if(scrub){scrub.value=String(Math.round(s.progress*100));scrub.setAttribute('aria-valuetext',Math.round(s.progress*100)+'% through the movement');}
    const position=element.querySelector('[data-motion-position]');if(position)position.textContent=Math.round(s.progress*100)+'%';
    s.phase=phase;
  }
  function visible(element) {
    if(!element.isConnected||document.hidden)return false;
    if(element.closest('details:not([open])'))return false;
    if(typeof element.getClientRects==='function'&&!element.getClientRects().length)return false;
    if(typeof element.getBoundingClientRect==='function'&&typeof window!=='undefined'){
      const r=element.getBoundingClientRect();if(r.bottom<0||r.top>window.innerHeight||r.right<0||r.left>window.innerWidth)return false;
    }
    return true;
  }
  function buttonState(element,isPlaying) {
    element.dataset.motionState=isPlaying?'playing':'paused';
    const button=element.querySelector('[data-motion-action="play"]');
    if(button){button.setAttribute('aria-pressed',String(isPlaying));button.setAttribute('aria-label',(isPlaying?'Pause':'Play')+' '+(element.dataset.motionTitle||exerciseMotionCatalog[element.dataset.exerciseMotion]?.title||'movement')+' illustration');}
    const label=element.querySelector('[data-motion-play-label]');if(label)label.textContent=isPlaying?'Pause movement':'Play movement';
  }
  function pause(element,message='') {
    const s=state(element);s.playing=false;s.last=0;playing.delete(element);observer?.unobserve(element);buttonState(element,false);
    if(message)tell(element,message);
    if(!playing.size&&frameId&&typeof cancelAnimationFrame==='function'){cancelAnimationFrame(frameId);frameId=0;}
  }
  function tick(now) {
    frameId=0;
    for(const [element,s] of playing){
      if(!visible(element)||reducedMotion()){pause(element);continue;}
      const entry=exerciseMotionCatalog[element.dataset.exerciseMotion];
      if(!entry){pause(element);continue;}
      if(s.last&&now-s.last<32)continue; // Cap drawing at about 30 fps on phones.
      if(s.last)s.elapsed+=Math.min(now-s.last,80)*s.speed;
      s.last=now;
      // Cosine easing gives a deliberate turn at each pose without a jump cut.
      s.progress=(1-Math.cos((s.elapsed/entry.duration)*Math.PI*2))/2;
      draw(element,s);
    }
    if(playing.size&&typeof requestAnimationFrame==='function')frameId=requestAnimationFrame(tick);
  }
  function reducedNote(element,isReduced) {
    const note=element.querySelector('.exercise-motion-note');
    if(note)note.textContent=isReduced?'Reduced motion is on. Use Next pose to explore the still illustrations.':'Illustrated example. Follow Alex’s written cues and demonstration video.';
  }
  function play(element) {
    const s=state(element);
    if(s.playing){pause(element,'Movement paused.');return;}
    if(reducedMotion()){reducedNote(element,true);tell(element,'Reduced motion is on. Use Next pose to view the still illustrations.');return;}
    reducedNote(element,false);
    if(!visible(element)||typeof requestAnimationFrame!=='function')return;
    for(const other of playing.keys())if(other!==element)pause(other,'Another movement is now playing.');
    s.playing=true;s.last=0;playing.set(element,s);buttonState(element,true);observer?.observe(element);
    tell(element,'Movement playing.');
    if(!frameId)frameId=requestAnimationFrame(tick);
  }
  function next(element) {
    pause(element);
    const s=state(element),entry=exerciseMotionCatalog[element.dataset.exerciseMotion];if(!entry)return;
    s.progress=s.progress<.5?1:0;s.elapsed=s.progress*entry.duration/2;draw(element,s);
    tell(element,`Pose ${s.progress+1} of 2. ${entry.phases[s.progress]}`);
  }
  function seek(element,value) {
    const entry=exerciseMotionCatalog[element.dataset.exerciseMotion];if(!entry)return;
    const parsed=Number(value);if(!Number.isFinite(parsed))return;
    pause(element);
    const s=state(element);s.progress=Math.max(0,Math.min(1,parsed/100));
    s.elapsed=Math.acos(1-2*s.progress)*entry.duration/(2*Math.PI);
    draw(element,s);tell(element,Math.round(s.progress*100)+'% through the movement. '+entry.phases[s.phase]);
  }
  function init() {
    if(typeof document==='undefined'||typeof document.addEventListener!=='function')return;
    if(typeof window!=='undefined'&&typeof window.matchMedia==='function')reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    if(typeof IntersectionObserver!=='undefined')observer=new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting)pause(entry.target);},{threshold:0});
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('[data-motion-action]');if(!button)return;
      const element=button.closest('[data-exercise-motion]');if(!element)return;
      if(button.dataset.motionAction==='play')play(element);
      if(button.dataset.motionAction==='next')next(element);
    });
    document.addEventListener('change',event=>{
      const input=event.target?.closest?.('[data-motion-speed]');if(!input)return;
      const element=input.closest('[data-exercise-motion]');if(!element)return;
      state(element).speed=['0.25','0.5','1'].includes(input.value)?Number(input.value):1;
    });
    document.addEventListener('input',event=>{
      const input=event.target?.closest?.('[data-motion-scrub]');if(!input)return;
      const element=input.closest('[data-exercise-motion]');if(element)seek(element,input.value);
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const element of playing.keys())pause(element);});
    document.addEventListener('toggle',event=>{if(event.target?.tagName==='DETAILS'&&!event.target.open)for(const element of playing.keys())if(event.target.contains(element))pause(element);},true);
    const reducedChange=()=>{if(reducedMotion())for(const element of playing.keys()){reducedNote(element,true);pause(element,'Reduced motion is on. Use Next pose for still illustrations.');}
      if(typeof document.querySelectorAll==='function')for(const element of document.querySelectorAll('[data-exercise-motion]'))reducedNote(element,reducedMotion());
    };
    if(typeof reduced?.addEventListener==='function')reduced.addEventListener('change',reducedChange);
    else if(typeof reduced?.addListener==='function')reduced.addListener(reducedChange);
  }
  init();
  return {escape,illustration};
})();
