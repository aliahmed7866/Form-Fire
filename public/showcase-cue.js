// Recording-only visual cues. Labels describe controls, never their entered values.
export function createShowcaseCue() {
 let overlay,ring,label,target;
 const clean=text=>String(text||'').replace(/\s+/g,' ').trim();
 const controlName=el=>{
  const labelledBy=el.getAttribute('aria-labelledby');
  if(labelledBy)return clean(labelledBy.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '));
  if(el.getAttribute('aria-label'))return clean(el.getAttribute('aria-label'));
  if(el.labels?.length){
   const copy=el.labels[0].cloneNode(true);
   copy.querySelectorAll('input,select,textarea,button,.micro,.hint').forEach(node=>node.remove());
   return clean(copy.textContent);
  }
  if(el.matches('input,select,textarea'))return clean(el.getAttribute('name')||'field').replaceAll('_',' ');
  return clean(el.textContent||el.getAttribute('title')||'control');
 };
 const clear=()=>{
  target=null;overlay?.remove();overlay=ring=label=null;
  window.removeEventListener('scroll',position,true);window.removeEventListener('resize',position);
  window.visualViewport?.removeEventListener('resize',position);
  window.visualViewport?.removeEventListener('scroll',position);
 };
 function position(){
  if(!target?.isConnected){clear();return;}
  const rect=target.getBoundingClientRect(),viewport=window.visualViewport;
  const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
  const right=left+(viewport?.width||window.innerWidth),bottom=top+(viewport?.height||window.innerHeight);
  if(rect.bottom<=top||rect.top>=bottom||rect.right<=left||rect.left>=right){overlay.hidden=true;return;}
  overlay.hidden=false;
  // Put the marker at the visible part of the actual control, even after scrolling.
  const x=(Math.max(left,rect.left)+Math.min(right,rect.right))/2;
  const y=(Math.max(top,rect.top)+Math.min(bottom,rect.bottom))/2;
  ring.style.left=x+'px';ring.style.top=y+'px';
  label.style.maxWidth=Math.max(0,right-left-24)+'px';
  const width=label.offsetWidth,height=label.offsetHeight;
  label.style.left=Math.max(left+12,Math.min(x-width/2,right-width-12))+'px';
  const above=rect.top-height-14;
  label.style.top=Math.max(top+8,Math.min(above>=top+8?above:rect.bottom+14,bottom-height-8))+'px';
 }
 return {
  show(el,action='Tap'){
   clear();
   if(!el.isConnected)return '';
   if(!overlay){
    overlay=document.createElement('div');overlay.id='showcase-cue';overlay.hidden=true;
    overlay.innerHTML='<span class="showcase-cue-ring" aria-hidden="true"></span><span class="showcase-cue-label" role="status" aria-live="polite" aria-atomic="true"></span>';
    document.body.append(overlay);ring=overlay.firstElementChild;label=overlay.lastElementChild;
   }
   const name=controlName(el),shortName=name.length>64?name.slice(0,61)+'…':name;
   label.textContent=action+' · '+shortName;overlay.dataset.action=action.toLowerCase();
   target=el;overlay.hidden=false;position();
   window.addEventListener('scroll',position,true);window.addEventListener('resize',position);
   window.visualViewport?.addEventListener('resize',position);window.visualViewport?.addEventListener('scroll',position);
   return label.textContent;
  },
  clear
 };
}
