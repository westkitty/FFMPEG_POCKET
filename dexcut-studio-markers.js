/* DEX//CUT Studio local-only opt-in analysis. Suggestions never mutate edit decisions. */
(function(root){
'use strict';
const G=root.DexCutStudioControl;if(!G)return;
const el=id=>document.getElementById(id);
let active=null;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
async function seek(video,at,signal){
  if(signal.aborted)throw Error('Cancelled');
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>finish(Error('Video seek timed out')),3500);
    function finish(err){clearTimeout(timeout);video.removeEventListener('seeked',ok);video.removeEventListener('error',bad);
      signal.removeEventListener('abort',cancel);err?reject(err):resolve();}
    function ok(){finish();}
    function bad(){finish(Error('Frame extraction unavailable'));}
    function cancel(){finish(Error('Cancelled'));}
    video.addEventListener('seeked',ok,{once:true});video.addEventListener('error',bad,{once:true});
    signal.addEventListener('abort',cancel,{once:true});
    video.currentTime=at;
  });
}
async function scenes(file,signal,onProgress){
  const src=URL.createObjectURL(file),video=document.createElement('video');
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=18;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas unavailable');
  video.muted=true;video.playsInline=true;video.preload='auto';
  try{
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Video metadata unavailable')),8000);
      video.onloadedmetadata=()=>{clearTimeout(timeout);resolve();};
      video.onerror=()=>{clearTimeout(timeout);reject(Error('Video decoder unavailable'));};
      video.src=src;
    });
    if(video.duration>180)throw Error('Scene analysis is limited to 3-minute videos in this preview');
    const step=Math.max(.4,video.duration/36),markers=[];let previous=null;
    for(let t=Math.min(.2,video.duration*.1);t<video.duration-.06;t+=step){
      await seek(video,t,signal);
      if(signal.aborted)throw Error('Cancelled');
      ctx.drawImage(video,0,0,32,18);
      const rgba=ctx.getImageData(0,0,32,18).data;
      const current=new Uint8Array(32*18*3);
      for(let x=0,y=0;x<rgba.length;x+=4){current[y++]=rgba[x];current[y++]=rgba[x+1];current[y++]=rgba[x+2];}
      if(previous){
        let total=0;
        for(let k=0;k<current.length;k++)total+=Math.abs(current[k]-previous[k]);
        const score=total/current.length/255;
        if(score>.29)markers.push({at:t,description:'Possible scene change',confidence:score.toFixed(2)});
      }
      previous=current;
      onProgress?.(t/video.duration);
    }
    return markers;
  }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(src);}
}
async function silence(file,signal,onProgress){
  if(file.size>12*1024*1024)throw Error('Audio silence analysis is limited to 12 MiB source files');
  const AC=root.AudioContext||root.webkitAudioContext;
  if(!AC)throw Error('Web Audio decoding unavailable');
  const ctx=new AC();
  try{
    const decoded=await ctx.decodeAudioData(await file.arrayBuffer());
    if(signal.aborted)throw Error('Cancelled');
    if(decoded.duration>120)throw Error('Silence analysis is limited to 2 minutes');
    const hop=Math.max(1,Math.round(decoded.sampleRate*.08)),channels=[];
    for(let ch=0;ch<Math.min(2,decoded.numberOfChannels);ch++)channels.push(decoded.getChannelData(ch));
    const intervals=[];let quietStart=null,last=0;
    for(let pos=0;pos<decoded.length;pos+=hop){
      if(signal.aborted)throw Error('Cancelled');
      let square=0,samples=0;
      for(let offset=0;offset<hop && pos+offset<decoded.length;offset+=8)
        for(const data of channels){const x=data[pos+offset]||0;square+=x*x;samples++;}
      const quiet=Math.sqrt(square/Math.max(1,samples))<.012;
      const time=pos/decoded.sampleRate;
      if(quiet&&quietStart==null)quietStart=time;
      if(!quiet&&quietStart!=null){
        if(time-quietStart>=.45)intervals.push({at:quietStart,end:time,description:'Quiet interval'});
        quietStart=null;
      }
      last=time;onProgress?.(pos/decoded.length);
    }
    if(quietStart!=null&&decoded.duration-quietStart>=.45)
      intervals.push({at:quietStart,end:decoded.duration,description:'Quiet interval'});
    return intervals.slice(0,50);
  }finally{ctx.close().catch(()=>{});}
}
function drawMarkers(markers){
  const host=el('markerResults');host.replaceChildren();
  if(!markers.length){host.textContent='No strong suggestions detected. Keep editing manually.';return;}
  markers.forEach((m,i)=>{
    const row=document.createElement('p');
    const button=document.createElement('button');button.type='button';button.className='secondary';
    button.textContent=(i+1)+'. '+m.description+' near '+m.at.toFixed(2)+'s'+(m.end!=null?'–'+m.end.toFixed(2)+'s':'');
    button.setAttribute('aria-label','Preview suggested marker at '+m.at.toFixed(2)+' seconds');
    button.addEventListener('click',()=>G.seek(m.at));
    row.append(button);host.append(row);
  });
}
async function run(kind){
  if(active)return;
  const file=G.getFile(),clip=G.selectedClip();
  if(!file||!clip){el('analyzeStatus').textContent='Select a local video before analysis';return;}
  active=new AbortController();const signal=active.signal;
  for(const x of ['analyzeScenes','analyzeSilence'])el(x).disabled=true;
  el('cancelAnalyze').disabled=false;
  el('analyzeStatus').textContent='Analyzing local media…';
  el('markerResults').replaceChildren();
  try{
    const markers=kind==='scene'?await scenes(file,signal,p=>{el('analyzeStatus').textContent='Sampling frames · '+Math.round(p*100)+'%';}):
      await silence(file,signal,p=>{el('analyzeStatus').textContent='Examining audio · '+Math.round(p*100)+'%';});
    if(signal.aborted)return;
    drawMarkers(markers);
    el('analyzeStatus').textContent=markers.length+' suggestions found. Review manually; nothing has been cut.';
  }catch(err){el('analyzeStatus').textContent='Analysis unavailable: '+err.message;}
  finally{active=null;for(const x of ['analyzeScenes','analyzeSilence'])el(x).disabled=false;
    el('cancelAnalyze').disabled=true;}
}
el('analyzeScenes')?.addEventListener('click',()=>run('scene'));
el('analyzeSilence')?.addEventListener('click',()=>run('silence'));
el('cancelAnalyze')?.addEventListener('click',()=>active?.abort());
root.addEventListener('pagehide',()=>active?.abort());
})(window);
