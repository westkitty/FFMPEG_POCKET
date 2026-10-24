/* DEX//CUT Studio: browser-native touch ruler and crop interaction. */
(function(root){
'use strict';
const G=root.DexCutStudioControl,byId=id=>document.getElementById(id);
if(!G||!byId('precisionTrack')||!byId('cropWorkspace'))return;
const ruler=byId('precisionTrack'),cropCanvas=byId('cropWorkspace');
const zoomInput=byId('timelineZoom'),panInput=byId('timelinePan'),snapInput=byId('snapCuts');
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const rulerPoints=new Map(),cropPoints=new Map();
let rulerGesture=null,cropGesture=null,localCrop=null,frame=0;
function sourceLength(){const x=G.getAsset();return x?x.durationUs/1e6:0;}
function currentClip(){return G.selectedClip();}
function bounds(){
  const d=sourceLength(),z=Number(zoomInput.value)||1;
  const width=d/z,start=(d-width)*(Number(panInput.value)||0)/100;
  return {d,z,width,start,end:start+width};
}
function rulerX(time,b){
  return (time-b.start)/Math.max(.00001,b.width)*ruler.width;
}
function rulerTime(x,b){
  return clamp(b.start+x/ruler.width*b.width,0,b.d);
}
function snap(t){
  if(!snapInput.checked)return t;
  const cl=currentClip();if(!cl)return t;
  const b=bounds(),candidates=[0,b.d,...cl.ranges.flatMap(x=>x.map(n=>n/1e6))];
  let closest=t,delta=Math.min(.20,b.width*.018);
  for(const x of candidates)if(Math.abs(t-x)<delta){closest=x;delta=Math.abs(t-x);}
  return closest;
}
function refreshRuler(){
  const ctx=ruler.getContext('2d');if(!ctx)return;
  const b=bounds();ctx.clearRect(0,0,ruler.width,ruler.height);
  ctx.fillStyle='#161116';ctx.fillRect(0,0,ruler.width,ruler.height);
  if(!(b.d>0))return;
  ctx.strokeStyle='#66525a';ctx.lineWidth=1;
  const step=b.width<4?.25:b.width<12?1:b.width<50?5:10;
  for(let t=Math.ceil(b.start/step)*step;t<=b.end;t+=step){
    const x=rulerX(t,b);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,23);ctx.stroke();
    ctx.font='13px system-ui';ctx.fillStyle='#cbbabb';ctx.fillText(t.toFixed(step<1?2:0)+'s',x+3,36);
  }
  const cl=currentClip();if(cl)for(const [a,end] of cl.ranges){
    const x=rulerX(a/1e6,b),right=rulerX(end/1e6,b);
    ctx.fillStyle='rgba(183,55,61,.68)';ctx.fillRect(x,46,right-x,34);
    ctx.strokeStyle='#f0b6b7';ctx.strokeRect(x,46,right-x,34);
  }
  const video=G.media(),time=video.currentTime||0;
  const x=rulerX(time,b);ctx.strokeStyle='#f9e5cd';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,ruler.height);ctx.stroke();
}
function drawCrop(){
  const ctx=cropCanvas.getContext('2d');if(!ctx)return;
  const w=cropCanvas.width,h=cropCanvas.height,video=G.media(),clip=currentClip();
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#161116';ctx.fillRect(0,0,w,h);
  if(!clip)return;
  try{if(video.readyState>=2&&video.videoWidth)ctx.drawImage(video,0,0,w,h);}catch(_){}
  const rect=localCrop||clip.crop||{x:0,y:0,w:1,h:1};
  const x=rect.x*w,y=rect.y*h,rw=rect.w*w,rh=rect.h*h;
  ctx.fillStyle='rgba(0,0,0,.38)';
  ctx.fillRect(0,0,w,y);ctx.fillRect(0,y,x,rh);ctx.fillRect(x+rw,y,w-x-rw,rh);ctx.fillRect(0,y+rh,w,h-y-rh);
  ctx.strokeStyle='#fff2c8';ctx.lineWidth=4;ctx.strokeRect(x,y,rw,rh);
  ctx.setLineDash([12,9]);ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;
  ctx.strokeRect(x+rw*.1,y+rh*.1,rw*.8,rh*.8);ctx.setLineDash([]);
}
function refresh(){refreshRuler();drawCrop();}
function canvasX(evt,canvas){const r=canvas.getBoundingClientRect();return (evt.clientX-r.left)/r.width*canvas.width;}
function canvasY(evt,canvas){const r=canvas.getBoundingClientRect();return (evt.clientY-r.top)/r.height*canvas.height;}
ruler.addEventListener('pointerdown',e=>{
  if(!sourceLength())return;
  e.preventDefault();ruler.setPointerCapture(e.pointerId);
  rulerPoints.set(e.pointerId,{x:canvasX(e,ruler),y:canvasY(e,ruler)});
  if(rulerPoints.size===2){
    const a=[...rulerPoints.values()],dist=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y);
    rulerGesture={type:'pinch',dist,zoom:Number(zoomInput.value)};
  }else if(rulerPoints.size===1){
    rulerGesture={type:'scrub',originX:canvasX(e,ruler),originTime:G.media().currentTime||0};
    G.seek(snap(rulerTime(canvasX(e,ruler),bounds())));
  }
  refreshRuler();
});
ruler.addEventListener('pointermove',e=>{
  if(!rulerPoints.has(e.pointerId))return;
  e.preventDefault();
  rulerPoints.set(e.pointerId,{x:canvasX(e,ruler),y:canvasY(e,ruler)});
  const pts=[...rulerPoints.values()];
  if(pts.length===2&&rulerGesture?.type==='pinch'){
    const d=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);
    zoomInput.value=String(clamp(Math.round(rulerGesture.zoom*d/Math.max(5,rulerGesture.dist)),1,20));
    refresh();
  }else if(pts.length===1&&rulerGesture?.type==='scrub'){
    const distance=canvasY(e,ruler)>ruler.height?clamp(1-(canvasY(e,ruler)-ruler.height)/200,.1,1):1;
    const delta=(canvasX(e,ruler)-rulerGesture.originX)/ruler.width*bounds().width*distance;
    G.seek(snap(clamp(rulerGesture.originTime+delta,0,sourceLength())));
    refreshRuler();
  }
});
function rulerStop(e){rulerPoints.delete(e.pointerId);if(rulerPoints.size<2)rulerGesture=null;refreshRuler();}
ruler.addEventListener('pointerup',rulerStop);ruler.addEventListener('pointercancel',rulerStop);
function makeRect(orig,x,y){
  const width=orig.w,height=orig.h;
  return {x:clamp(x,0,1-width),y:clamp(y,0,1-height),w:width,h:height};
}
cropCanvas.addEventListener('pointerdown',e=>{
  if(!currentClip())return;
  e.preventDefault();cropCanvas.setPointerCapture(e.pointerId);
  cropPoints.set(e.pointerId,{x:canvasX(e,cropCanvas),y:canvasY(e,cropCanvas)});
  const rect=localCrop||currentClip().crop||{x:0,y:0,w:1,h:1};
  if(cropPoints.size===2){
    const pts=[...cropPoints.values()];
    cropGesture={type:'pinch',initial:{...rect},
      dist:Math.max(1,Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y))};
  }else cropGesture={type:'drag',rect:{...rect},point:{x:canvasX(e,cropCanvas),y:canvasY(e,cropCanvas)}};
});
cropCanvas.addEventListener('pointermove',e=>{
  if(!cropPoints.has(e.pointerId))return;
  e.preventDefault();cropPoints.set(e.pointerId,{x:canvasX(e,cropCanvas),y:canvasY(e,cropCanvas)});
  const pts=[...cropPoints.values()];
  if(pts.length===2&&cropGesture?.type==='pinch'){
    const d=Math.max(1,Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y));
    const q=cropGesture.initial,factor=cropGesture.dist/d;
    const w=clamp(q.w*factor,.2,1),h=clamp(q.h*factor,.2,1);
    localCrop=makeRect({w,h},q.x+(q.w-w)/2,q.y+(q.h-h)/2);
  }else if(pts.length===1&&cropGesture?.type==='drag'){
    const q=cropGesture.rect;
    localCrop=makeRect(q,q.x+(pts[0].x-cropGesture.point.x)/cropCanvas.width,
      q.y+(pts[0].y-cropGesture.point.y)/cropCanvas.height);
  }
  drawCrop();
});
function cropStop(e){
  cropPoints.delete(e.pointerId);
  if(cropPoints.size===0){
    if(localCrop){
      const rect=localCrop;
      const full=Math.abs(rect.x)<.0001&&Math.abs(rect.y)<.0001&&Math.abs(rect.w-1)<.0001&&Math.abs(rect.h-1)<.0001;
      G.crop(full?null:rect);
      localCrop=null;
    }
    cropGesture=null;
  }
  drawCrop();
}
cropCanvas.addEventListener('pointerup',cropStop);cropCanvas.addEventListener('pointercancel',cropStop);
for(const input of [zoomInput,panInput])input.addEventListener('input',refreshRuler);
snapInput.addEventListener('change',refreshRuler);
G.media().addEventListener('timeupdate',refresh);
G.media().addEventListener('loadeddata',refresh);
G.media().addEventListener('seeked',refresh);
root.DexCutStudioGestures={refresh};
refresh();
})(window);
