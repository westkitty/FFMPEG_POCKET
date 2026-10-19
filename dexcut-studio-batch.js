/* DEX//CUT Studio: strictly sequential, bounded, in-memory batch queue. */
(function(root){
'use strict';
const P=root.DexCutProject,R=root.DexCutStudioRender;
if(!P||!R)return;
const el=id=>document.getElementById(id);
const MAX_FILES=3,MAX_SOURCE_BYTES=25*1024*1024,MAX_TOTAL_BYTES=60*1024*1024;
let jobs=[],running=false,active=null;
const fileURL=file=>URL.createObjectURL(file);
const stateText=()=>jobs.length?jobs.map(x=>x.state).join(', '):'No jobs';
function announce(message){el('batchStatus').textContent=message;}
function makeButton(label,callback,disabled=false){
 const b=document.createElement('button');b.type='button';b.textContent=label;b.className='secondary';
 b.disabled=disabled;b.addEventListener('click',callback);return b;
}
function repaint(){
 const host=el('batchList');host.replaceChildren();
 for(const job of jobs){
   const card=document.createElement('article');card.className='clip';
   const name=document.createElement('h3');name.textContent=job.file.name;
   const stat=document.createElement('p');stat.className='muted';stat.textContent='Status: '+job.state+(job.error?' — '+job.error:'');
   card.append(name,stat);
   const row=document.createElement('div');row.className='actions';
   if(job.state==='queued')row.append(makeButton('Cancel item',()=>{job.state='cancelled';repaint();}));
   if(job.state==='running')row.append(makeButton('Cancel this item',()=>active?.abort()));
   if(['failed','cancelled'].includes(job.state))row.append(makeButton('Retry item',()=>{job.state='queued';job.error='';repaint();}));
   if(job.state==='completed' && job.url && job.result){
     const a=document.createElement('a');a.href=job.url;a.download=job.result.name;a.className='button';
     a.textContent='Save '+job.result.name;a.style.display='inline-block';row.append(a);
     row.append(makeButton('Share',async()=>{
       if(navigator.canShare?.({files:[job.result]}))try{await navigator.share({files:[job.result]});}
       catch(e){if(e.name!=='AbortError')announce('Share error: '+e.message);}
       else announce('File sharing unavailable; use Save');
     }));
   }
   card.append(row);host.append(card);
 }
 el('runBatch').disabled=running||!jobs.some(j=>j.state==='queued');
 el('cancelBatch').disabled=!running;
}
async function durationOf(file){
 const url=fileURL(file),video=document.createElement('video');video.preload='metadata';
 try{return await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Metadata timeout')),12000);
   video.onloadedmetadata=()=>{clearTimeout(timer);resolve(video.duration);};
   video.onerror=()=>{clearTimeout(timer);reject(Error('Browser cannot open this codec'));};
   video.src=url;
 });}finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
function dispose(){
 for(const j of jobs){if(j.url)URL.revokeObjectURL(j.url);j.url=null;j.result=null;}
}
function addFiles(files){
 if(running){announce('Stop the current batch before replacing the queue');return;}
 if(files.length>MAX_FILES){announce('Limit each batch to '+MAX_FILES+' short files');return;}
 const size=files.reduce((n,f)=>n+f.size,0);
 if(size>MAX_TOTAL_BYTES||files.some(f=>f.size>MAX_SOURCE_BYTES)){
   announce('Batch exceeds conservative size limits: 25 MiB per source and 60 MiB total');return;
 }
 if(files.some(f=>!f.type.startsWith('video/'))){announce('This batch queue accepts video files only');return;}
 dispose();jobs=files.map(file=>({file,state:'queued',error:'',result:null,url:null}));
 repaint();announce(jobs.length+' video(s) queued. No concurrent encoders.');
}
async function runOne(job,signal){
 const dur=await durationOf(job.file);
 if(!Number.isFinite(dur)||dur<=0||dur>60)throw Error('Batch source duration must be between zero and 60 seconds');
 let p=P.newProject('batch-'+job.file.name.replace(/\.[^.]+$/,'').slice(0,50));
 const asset={id:P.uid(),kind:'video',name:job.file.name.slice(0,255),sizeBytes:job.file.size,durationUs:P.micros(dur)};
 p=P.apply(p,{type:'ADD_ASSET',data:{asset}});
 p=P.apply(p,{type:'ADD_CLIP',data:{clip:P.makeClip(asset,0,asset.durationUs)}});
 const preset=el('exportPreset').value;
 p=P.apply(p,{type:'SET_EXPORT',data:{preset}});
 return R.render(p,new Map([[asset.id,job.file]]),{signal,onEvent:e=>{if(e.kind==='stage')announce(job.file.name+' — '+e.message);}});
}
async function run(){
 if(running)return;
 running=true;el('runBatch').disabled=true;el('cancelBatch').disabled=false;
 try{
   for(const job of jobs){
     if(job.state!=='queued')continue;
     job.state='running';job.error='';active=new AbortController();repaint();
     try{
       const file=await runOne(job,active.signal);
       if(active.signal.aborted){job.state='cancelled';continue;}
       if(job.url)URL.revokeObjectURL(job.url);
       job.result=file;job.url=fileURL(file);job.state='completed';
       announce('Completed '+job.file.name+'. Save the result before clearing the queue.');
     }catch(error){job.state=active.signal.aborted?'cancelled':'failed';job.error=error.message;
       announce(job.file.name+': '+job.error);}
     finally{active=null;repaint();}
   }
 }finally{running=false;active=null;repaint();
   announce('Queue idle. '+stateText()+'. Outputs remain available until a new batch is selected or this page closes.');}
}
el('batchInput')?.addEventListener('change',e=>{addFiles(Array.from(e.target.files||[]));e.target.value='';});
el('runBatch')?.addEventListener('click',run);
el('cancelBatch')?.addEventListener('click',()=>{
 if(!running)return;
 active?.abort();
 jobs.forEach(j=>{if(j.state==='queued')j.state='cancelled';});
 announce('Stopping batch after cancelling the current operation.');
 repaint();
});
root.addEventListener('pagehide',()=>{active?.abort();dispose();});
repaint();
})(window);
