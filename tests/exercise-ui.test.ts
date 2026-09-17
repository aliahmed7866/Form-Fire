import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { exerciseAnimationKeys } from '../src/exercise-catalog.ts';

function ui() {
  const listeners=new Map<string,Array<(event:any)=>void>>();
  const nodes=new Map<string,any>();
  const document={
    addEventListener(type:string,listener:(event:any)=>void) { listeners.set(type,[...(listeners.get(type)||[]),listener]); },
    querySelector(selector:string) { return nodes.get(selector)||null; },
    querySelectorAll(selector:string) { return nodes.get(selector)||[]; }
  };
  const context=createContext({document,window:{addEventListener(){}},location:{hash:'#/admin/plans?view=exercises'},URLSearchParams});
  for(const file of ['exercise-catalog-extra.js','exercise-catalog.js','exercise-motion.js','plan-studio.js','navigation.js','app.js']) {
    runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8').replace(/\nrender\(\);\s*$/,'\n'),context);
  }
  function fire(type:string,target:any) { for(const listener of listeners.get(type)||[])listener({target}); }
  return {context,nodes,fire};
}

test('Body-part and search changes combine, clear independently, and report empty results',()=>{
  const {nodes,fire}=ui();
  const search={value:'',matches:(s:string)=>s==='[data-library-search]'};
  const group={value:'',matches:(s:string)=>s==='select[data-body-part]'};
  const cards=[
    {dataset:{search:'dumbbell floor press chest dumbbells',bodyPart:'Chest'},hidden:false},
    {dataset:{search:'press-up chest no equipment',bodyPart:'Chest'},hidden:false},
    {dataset:{search:'dumbbell row back dumbbells',bodyPart:'Back'},hidden:false},
    {dataset:{search:'custom mobility other',bodyPart:'Other'},hidden:false}
  ];
  const empty={hidden:true},count={textContent:''};
  nodes.set('[data-library-search]',search);nodes.set('select[data-body-part]',group);
  nodes.set('[data-library-card]',cards);nodes.set('[data-library-empty]',empty);nodes.set('[data-library-count]',count);
  const shown=()=>cards.map((card,index)=>card.hidden?null:index).filter(index=>index!==null);

  group.value='Chest';fire('change',group);
  assert.deepEqual(shown(),[0,1]);assert.equal(count.textContent,'2 exercises');
  search.value='  DUMBBELL  ';fire('input',search);
  assert.deepEqual(shown(),[0]);assert.equal(count.textContent,'1 exercise');assert.equal(empty.hidden,true);
  group.value='Back';fire('change',group);
  assert.deepEqual(shown(),[2]);
  search.value='press';fire('input',search);
  assert.deepEqual(shown(),[]);assert.equal(empty.hidden,false);assert.equal(count.textContent,'0 exercises');
  group.value='';fire('change',group);
  assert.deepEqual(shown(),[0,1]);assert.equal(empty.hidden,true);
  search.value='';fire('input',search);
  assert.deepEqual(shown(),[0,1,2,3]);
  group.value='Other';fire('change',group);
  assert.deepEqual(shown(),[3]);
});

test('Recipe and plan search remains usable when no body-part filter exists',()=>{
  const {nodes,fire}=ui();
  const search={value:'oats',matches:(s:string)=>s==='[data-library-search]'};
  const cards=[{dataset:{search:'berry oats'},hidden:false},{dataset:{search:'chickpea lunch'},hidden:false}];
  const empty={hidden:true};
  nodes.set('[data-library-search]',search);nodes.set('[data-library-card]',cards);nodes.set('[data-library-empty]',empty);
  fire('input',search);assert.deepEqual(cards.map(card=>card.hidden),[false,true]);
  search.value='nothing';fire('input',search);assert.equal(empty.hidden,false);
  search.value='';fire('input',search);assert.deepEqual(cards.map(card=>card.hidden),[false,false]);assert.equal(empty.hidden,true);
});

test('Exercise editor selection and title changes refresh the preview without saving',()=>{
  const {context,fire}=ui();
  context.previewCalls=[];
  runInContext('exerciseArt=e=>{previewCalls.push(e);return "preview";}',context);
  const preview={innerHTML:''};
  const form={dataset:{form:'exercise'},elements:{animation:{value:'floor-press'},title:{value:'Alex’s floor press'}},querySelector:(s:string)=>s==='[data-exercise-preview]'?preview:null};
  const animation={name:'animation',form,matches:()=>false};
  fire('change',animation);
  assert.deepEqual(JSON.parse(runInContext('JSON.stringify(previewCalls)',context)),[{animation:'floor-press',title:'Alex’s floor press'}]);
  assert.equal(preview.innerHTML,'preview');
  form.elements.title.value='Personal floor press';fire('input',{name:'title',form,matches:()=>false});
  assert.equal(runInContext('previewCalls.at(-1).title',context),'Personal floor press');
  form.elements.animation.value='biceps-curl';form.elements.title.value='';fire('change',animation);
  assert.equal(runInContext('previewCalls.at(-1).title===exerciseMotionCatalog["biceps-curl"].title',context),true);
  form.elements.animation.value='';fire('change',animation);
  assert.equal(runInContext('previewCalls.at(-1).animation',context),'');
});

test('Workout exercise changes replace cues and video preview and clearing removes them',()=>{
  const {context,fire}=ui();
  context.fixtures=[
    {id:'press',title:'My floor press',animation:'floor-press',instructions:'Keep the original cues',video_url:'https://videos.example.org/press',video_caption:'Original summary'},
    {id:'row',title:'My row',animation:'row',instructions:'Updated <row> cues',video_url:'https://videos.example.org/row',video_caption:'Row summary'}
  ];
  runInContext('adminData={exercises:fixtures}',context);
  const preview={innerHTML:''};
  const row={querySelector:(s:string)=>s==='[data-builder-exercise-preview]'?preview:null};
  const target={name:'exercise_id',value:'press',matches:()=>false,closest:(s:string)=>s==='[data-exercise-row]'?row:null};
  fire('change',target);
  assert.ok(preview.innerHTML.includes('Keep the original cues'));assert.ok(preview.innerHTML.includes('https://videos.example.org/press'));assert.ok(preview.innerHTML.includes('aria-pressed="false"'));
  target.value='row';fire('change',target);
  assert.ok(preview.innerHTML.includes('Updated &lt;row&gt; cues'));assert.ok(preview.innerHTML.includes('Row summary'));assert.ok(!preview.innerHTML.includes('Keep the original cues'));
  target.value='';fire('change',target);assert.equal(preview.innerHTML,'');
});

test('Every persisted movement key is selectable and renders locally in published plans',()=>{
  const {context}=ui();
  const catalogKeys=JSON.parse(runInContext('JSON.stringify(Object.keys(exerciseMotionCatalog))',context));
  assert.deepEqual(new Set(catalogKeys),new Set(exerciseAnimationKeys));
  const form=runInContext('exerciseForm()',context);
  for(const key of exerciseAnimationKeys) {
    assert.ok(form.includes('value="'+key+'"'),key+' missing from editor');
    context.fixture={workouts:[{day:'Monday',name:'My session',exercises:[{sets:2,reps:'8',rest_seconds:60,exercise:{title:'My '+key,animation:key,instructions:'Published cues',video_url:''}}]}]};
    const markup=runInContext('publishedPlanView(fixture)',context);
    assert.ok(markup.includes('<svg'),key+' missing illustration');
    assert.ok(markup.includes('Show next pose'),key+' missing static step control');
    assert.ok(markup.includes('data-motion-scrub'),key+' missing movement position control');
    assert.ok(markup.includes('value="0.25"'),key+' missing quarter-speed playback');
    assert.ok(!/<(?:iframe|video|img|script)\b/.test(markup),key+' embeds network media');
    for(const progress of [0,.25,.5,.75,1]) {
      context.progress=progress;context.key=key;
      const illustration=runInContext('exerciseIllustration(key,progress)',context);
      assert.ok(illustration.includes('data-motion-figure'),key+' missing pose at '+progress);
      assert.ok(!/NaN|Infinity|undefined/.test(illustration),key+' has invalid geometry at '+progress);
    }
  }
  const noArt=runInContext('exerciseArt({title:"Custom movement",animation:""})',context);
  assert.ok(!noArt.includes('<svg'));
});

test('Movement titles cannot create markup and unknown keys render no artwork',()=>{
  const {context}=ui();
  context.fixture={animation:'biceps-curl',title:'\"><img src=x onerror="alert(1)"> & personal'};
  const markup=runInContext('exerciseArt(fixture)',context);
  assert.ok(!markup.includes('<img'));
  assert.ok(markup.includes('&quot;&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; personal'));
  for(const key of ['__proto__','constructor','toString','unknown']) {
    context.key=key;
    assert.equal(runInContext('exerciseArt(key)',context),'',key);
    assert.equal(runInContext('exerciseIllustration(key,.5)',context),'',key);
  }
});

function motionPlayer(initialReduced=false) {
  const listeners=new Map<string,Array<(event:any)=>void>>(),frames=new Map<number,(now:number)=>void>();
  let nextFrame=1,reducedListener:()=>void=()=>{};
  const media={matches:initialReduced,addEventListener(_type:string,callback:()=>void){reducedListener=callback;}};
  const document={hidden:false,addEventListener(type:string,callback:(event:any)=>void){listeners.set(type,[...(listeners.get(type)||[]),callback]);}};
  const context=createContext({document,window:{innerHeight:800,innerWidth:1200,matchMedia:()=>media},
    requestAnimationFrame(callback:(now:number)=>void){const id=nextFrame++;frames.set(id,callback);return id;},
    cancelAnimationFrame(id:number){frames.delete(id);}
  });
  for(const file of ['exercise-catalog-extra.js','exercise-catalog.js','exercise-motion.js'])runInContext(readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),context);
  function guide(key='biceps-curl') {
    const nodes=new Map<string,any>();
    for(const selector of ['[data-motion-figure]','[data-motion-cue]','[data-motion-step]','[data-motion-status]','[data-motion-play-label]','[data-motion-position]','.exercise-motion-note'])nodes.set(selector,{innerHTML:'',textContent:''});
    nodes.set('[data-motion-progress]',{style:{width:'0%'}});
    const element={dataset:{exerciseMotion:key,motionState:'paused'},isConnected:true,closed:false,offscreen:false,
      querySelector:(selector:string)=>nodes.get(selector)||null,
      closest(selector:string){return selector==='details:not([open])'&&this.closed?{}:null;},
      getClientRects:()=>[{}],
      getBoundingClientRect(){return {top:this.offscreen?900:0,bottom:this.offscreen?1200:300,left:0,right:400};}
    };
    const play={dataset:{motionAction:'play'},attributes:{'aria-pressed':'false'} as Record<string,string>,
      setAttribute(name:string,value:string){this.attributes[name]=value;},
      closest(selector:string):any{return selector==='[data-motion-action]'?this:selector==='[data-exercise-motion]'?element:null;}
    };
    nodes.set('[data-motion-action="play"]',play);
    const next={dataset:{motionAction:'next'},closest(selector:string):any{return selector==='[data-motion-action]'?this:selector==='[data-exercise-motion]'?element:null;}};
    const speed={value:'1',closest(selector:string):any{return selector==='[data-motion-speed]'?this:selector==='[data-exercise-motion]'?element:null;}};
    const scrub={value:'0',attributes:{} as Record<string,string>,
      setAttribute(name:string,value:string){this.attributes[name]=value;},
      closest(selector:string):any{return selector==='[data-motion-scrub]'?this:selector==='[data-exercise-motion]'?element:null;}
    };
    nodes.set('[data-motion-scrub]',scrub);
    return {nodes,element,play,next,speed,scrub};
  }
  function fire(type:string,target:any={}){for(const listener of listeners.get(type)||[])listener({target});}
  function advance(now:number){const first=frames.entries().next().value;if(first){frames.delete(first[0]);first[1](now);}}
  return {...guide(),guide,context,frames,document,fire,advance,reduce(value:boolean){media.matches=value;reducedListener();}};
}

test('Motion controls play, slow, pause and step through static poses without autoplay',()=>{
  const player=motionPlayer(),{nodes,play,next,speed,frames,fire,advance}=player;
  assert.equal(frames.size,0);
  fire('click',play);assert.equal(play.attributes['aria-pressed'],'true');assert.equal(frames.size,1);
  advance(100);advance(180);
  assert.ok(nodes.get('[data-motion-figure]').innerHTML.includes('<path'));
  const firstProgress=Number.parseFloat(nodes.get('[data-motion-progress]').style.width);
  assert.ok(firstProgress>0&&firstProgress<100);
  speed.value='0.5';fire('change',speed);advance(260);
  const slowedProgress=Number.parseFloat(nodes.get('[data-motion-progress]').style.width);
  assert.ok(slowedProgress>firstProgress);
  // Half speed covers in 80 ms the same movement that normal speed covers in 40 ms.
  const normal=motionPlayer();normal.fire('click',normal.play);normal.advance(100);normal.advance(180);normal.advance(220);
  assert.equal(nodes.get('[data-motion-progress]').style.width,normal.nodes.get('[data-motion-progress]').style.width);
  fire('click',play);assert.equal(play.attributes['aria-pressed'],'false');assert.equal(frames.size,0);
  const paused=nodes.get('[data-motion-progress]').style.width;advance(900);assert.equal(nodes.get('[data-motion-progress]').style.width,paused);
  fire('click',next);assert.equal(nodes.get('[data-motion-progress]').style.width,'100%');assert.equal(nodes.get('[data-motion-step]').textContent,'02 / 02');assert.equal(frames.size,0);
  fire('click',next);assert.equal(nodes.get('[data-motion-progress]').style.width,'0%');assert.equal(nodes.get('[data-motion-step]').textContent,'01 / 02');
});

test('Reduced motion blocks playback but preserves next-pose access and pauses on a preference change',()=>{
  const player=motionPlayer(true);
  player.fire('click',player.play);assert.equal(player.frames.size,0);assert.equal(player.play.attributes['aria-pressed'],'false');
  assert.ok(player.nodes.get('[data-motion-status]').textContent.includes('Reduced motion'));
  player.fire('click',player.next);assert.equal(player.nodes.get('[data-motion-progress]').style.width,'100%');
  player.reduce(false);player.fire('click',player.play);assert.equal(player.frames.size,1);
  player.reduce(true);assert.equal(player.frames.size,0);assert.equal(player.play.attributes['aria-pressed'],'false');
});

test('Scrubbing pauses playback, updates the accessible position and resumes from the selected pose',()=>{
  const player=motionPlayer(),{nodes,scrub,play,fire,frames,advance}=player;
  fire('click',play);advance(100);advance(180);
  scrub.value='37';fire('input',scrub);
  assert.equal(frames.size,0);assert.equal(play.attributes['aria-pressed'],'false');
  assert.equal(nodes.get('[data-motion-progress]').style.width,'37%');
  assert.equal(nodes.get('[data-motion-position]').textContent,'37%');
  assert.equal(scrub.attributes['aria-valuetext'],'37% through the movement');
  assert.ok(nodes.get('[data-motion-status]').textContent.startsWith('37% through the movement.'));
  const chosenPose=nodes.get('[data-motion-figure]').innerHTML;
  fire('click',play);advance(5000);
  assert.equal(nodes.get('[data-motion-progress]').style.width,'37%');
  assert.equal(nodes.get('[data-motion-figure]').innerHTML,chosenPose);
  advance(5080);
  assert.ok(Number.parseFloat(nodes.get('[data-motion-progress]').style.width)>37);
  fire('click',play);
  const pausedProgress=nodes.get('[data-motion-progress]').style.width;
  fire('click',play);advance(9000);
  assert.equal(nodes.get('[data-motion-progress]').style.width,pausedProgress);
});

test('Scrubbing clamps endpoints and stays available under reduced motion',()=>{
  const player=motionPlayer(true),{nodes,scrub,fire,frames}=player;
  for(const [value,expected] of [['-20','0%'],['140','100%'],['50','50%']]) {
    scrub.value=value;fire('input',scrub);
    assert.equal(nodes.get('[data-motion-progress]').style.width,expected,value);
    assert.equal(nodes.get('[data-motion-position]').textContent,expected,value);
    assert.equal(frames.size,0,value);
  }
  const pose=nodes.get('[data-motion-figure]').innerHTML;
  for(const value of ['NaN','Infinity','not-a-number']) {
    scrub.value=value;fire('input',scrub);
    assert.equal(nodes.get('[data-motion-progress]').style.width,'50%',value);
    assert.equal(nodes.get('[data-motion-figure]').innerHTML,pose,value);
  }
  player.fire('click',player.play);
  assert.equal(frames.size,0);assert.equal(nodes.get('[data-motion-progress]').style.width,'50%');
  player.fire('click',player.next);
  assert.equal(nodes.get('[data-motion-progress]').style.width,'0%');
});

test('Quarter speed preserves selected progress and ignores unsupported speed values',()=>{
  function progressAt(speed:string,elapsed:number) {
    const player=motionPlayer();
    player.scrub.value='25';player.fire('input',player.scrub);
    player.speed.value=speed;player.fire('change',player.speed);
    player.fire('click',player.play);player.advance(100);player.advance(100+elapsed);
    return player.nodes.get('[data-motion-progress]').style.width;
  }
  assert.equal(progressAt('0.25',80),progressAt('0.5',40));
  assert.equal(progressAt('1000',80),progressAt('1',80));
  assert.equal(progressAt('-1',80),progressAt('1',80));
});

test('Starting another movement pauses the old guide and detached guides do not stop its replacement',()=>{
  const player=motionPlayer(),replacement=player.guide('row');
  player.fire('click',player.play);player.advance(100);player.advance(180);
  const originalProgress=player.nodes.get('[data-motion-progress]').style.width;
  player.element.isConnected=false;
  player.fire('click',replacement.play);
  assert.equal(player.play.attributes['aria-pressed'],'false');
  assert.equal(replacement.play.attributes['aria-pressed'],'true');
  assert.equal(player.frames.size,1);
  player.advance(200);player.advance(280);
  assert.equal(player.nodes.get('[data-motion-progress]').style.width,originalProgress);
  assert.ok(Number.parseFloat(replacement.nodes.get('[data-motion-progress]').style.width)>0);
  assert.equal(player.frames.size,1);
  player.fire('click',player.next);
  assert.equal(player.frames.size,1);
  player.fire('click',replacement.play);
  assert.equal(player.frames.size,0);
});

test('High frequency animation callbacks skip redundant painting without losing the elapsed interval',()=>{
  const player=motionPlayer();player.fire('click',player.play);player.advance(100);
  const firstPose=player.nodes.get('[data-motion-figure]').innerHTML;
  player.advance(116);
  assert.equal(player.nodes.get('[data-motion-figure]').innerHTML,firstPose);
  player.advance(132);
  assert.notEqual(player.nodes.get('[data-motion-figure]').innerHTML,firstPose);
  const normal=motionPlayer();normal.fire('click',normal.play);normal.advance(100);normal.advance(132);
  assert.equal(player.nodes.get('[data-motion-progress]').style.width,normal.nodes.get('[data-motion-progress]').style.width);
  assert.equal(player.frames.size,1);
});

test('Playing illustrations stop when removed, offscreen, inside a closed detail, or on a hidden page',()=>{
  for(const condition of ['removed','offscreen','closed','hidden']) {
    const player=motionPlayer();player.fire('click',player.play);assert.equal(player.frames.size,1,condition);
    if(condition==='removed')player.element.isConnected=false;
    if(condition==='offscreen')player.element.offscreen=true;
    if(condition==='closed')player.element.closed=true;
    if(condition==='hidden'){player.document.hidden=true;player.fire('visibilitychange');}
    player.advance(100);
    assert.equal(player.frames.size,0,condition);assert.equal(player.play.attributes['aria-pressed'],'false',condition);
  }
});
