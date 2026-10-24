/* DEX//CUT Studio local-only readiness inspection; never claims RAM availability. */
(function(root){
'use strict';
async function inspect(){
  const report={networkHint:typeof navigator!=='undefined'?navigator.onLine:null,
    worker:typeof Worker!=='undefined',wasm:typeof WebAssembly!=='undefined',
    recorder:typeof MediaRecorder!=='undefined',cacheNames:[],appShellCached:false,
    ffmpegCoreCached:false,estimatedStorage:null,errors:[]};
  if(typeof caches!=='undefined'){
    try{
      const keys=await caches.keys();report.cacheNames=keys;
      report.appShellCached=keys.includes('dexcut-app-v9') &&
        await caches.open('dexcut-app-v9').then(cache=>cache.match('./studio.html')).then(Boolean);
      if(keys.includes('ffmpeg-pocket-core-v1')){
        const cache=await caches.open('ffmpeg-pocket-core-v1');
        const reqs=await cache.keys();
        report.ffmpegCoreCached=reqs.some(r=>r.url.includes('ffmpeg-core.js'))&&
          reqs.some(r=>r.url.includes('ffmpeg-core.wasm'));
      }
    }catch(e){report.errors.push('Cache inspection unavailable: '+e.message);}
  }else report.errors.push('CacheStorage is not exposed');
  if(navigator.storage?.estimate)try{
    const x=await navigator.storage.estimate();
    if(Number.isFinite(x.usage)&&Number.isFinite(x.quota))report.estimatedStorage={usedBytes:x.usage,quotaBytes:x.quota};
  }catch(e){report.errors.push('Storage estimates unavailable: '+e.message);}
  return report;
}
function mount(){
  const button=document.getElementById('refreshReadiness'),node=document.getElementById('readiness');
  if(!button||!node||button.dataset.readyBound)return;
  button.dataset.readyBound='true';
  button.addEventListener('click',async()=>{
    button.disabled=true;node.textContent='Checking local browser features and cache state…';
    try{
      const r=await inspect();node.replaceChildren();
      const rows=[
        ['Network hint',r.networkHint===null?'Unknown':r.networkHint?'Browser reports online':'Browser reports offline'],
        ['FFmpeg runtime',r.ffmpegCoreCached?'Both core resources appear cached':'Not confirmed cached — first load requires network'],
        ['Offline Studio shell',r.appShellCached?'Found in CacheStorage':'Not confirmed cached'],
        ['WebAssembly/Worker',r.wasm&&r.worker?'Available':'Unavailable'],
        ['Microphone recording API',r.recorder?'Available (permission not checked)':'Unavailable'],
        ['Origin storage',r.estimatedStorage?
          (r.estimatedStorage.usedBytes/1048576).toFixed(1)+' MiB used / approx '+
          (r.estimatedStorage.quotaBytes/1048576).toFixed(1)+' MiB quota':'Unknown']
      ];
      for(const [label,value] of rows){const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+': ';
        p.append(strong,document.createTextNode(value));node.append(p);}
      const note=document.createElement('p');note.textContent='Storage quota does not measure free RAM or guarantee export success.';node.append(note);
      r.errors.forEach(error=>{const p=document.createElement('p');p.textContent=error;node.append(p);});
    }catch(e){node.textContent='Readiness check failed: '+e.message;}finally{button.disabled=false;}
  });
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();}
if(root)root.DexCutReadiness={inspect};
if(typeof module==='object'&&module.exports)module.exports={inspect};
})(typeof window!=='undefined'?window:null);
