/* DEX//CUT Studio: isolated editing UI. Composite media rendering not yet enabled. */
(() => {
  'use strict';
  const P=window.DexCutProject,E=window.DexCutExportPlan;
  if(!P || !E)return;
  const el=id=>document.getElementById(id);
  const state={history:new P.History(P.newProject()),bound:new Map(),selected:null,activeRange:0,url:'',thumbnailTask:0,audioUrls:new Map()};
  const project=()=>state.history.current;
  const fmt=s=>Number(s).toFixed(2)+'s';
  const say=msg=>{el('status').textContent=msg;};
  const seconds=us=>P.seconds(us);
  const micro=s=>P.micros(s);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function bindingFor(sourceId){return state.bound.get(sourceId);}
  function selectedClip(){return project().clips.find(c=>c.id===state.selected);}
  function safeFileKind(file){return file.type.startsWith('audio/')?'audio':file.type.startsWith('video/')?'video':null;}
  function objectUrl(file){return URL.createObjectURL(file);}
  function releasePreview(){if(state.url){URL.revokeObjectURL(state.url);state.url='';}}
  function doEdit(type,data){
    try{state.history.execute({type,data});render();return true;}
    catch(error){say(error.message);return false;}
  }
  function drawClips(){
    const list=el('clipList');list.replaceChildren();
    if(!project().clips.length){const p=document.createElement('p');p.className='muted';p.textContent='No clips in this project.';list.append(p);}
    project().clips.forEach((clip,i)=>{
      const asset=project().assets.find(x=>x.id===clip.sourceId);
      const article=document.createElement('article');article.className='clip'+(clip.id===state.selected?' selected':'');
      const heading=document.createElement('div');heading.className='clipname';heading.textContent=(i+1)+'. '+(asset?.name||'Missing source')+' — '+fmt(seconds(P.clipDurationUs(clip)));
      const actions=document.createElement('div');actions.className='actions';
      const add=(name,act,disabled=false)=>{
        const b=document.createElement('button');b.type='button';b.textContent=name;b.className='secondary';b.disabled=disabled;
        b.addEventListener('click',act);actions.append(b);
      };
      add('Select',()=>selectClip(clip.id));
      add('Move up',()=>doEdit('MOVE_CLIP',{id:clip.id,to:i-1}),i===0);
      add('Move down',()=>doEdit('MOVE_CLIP',{id:clip.id,to:i+1}),i===project().clips.length-1);
      add('Remove',()=>{if(doEdit('REMOVE_CLIP',{id:clip.id})&&clip.id===state.selected)selectClip(project().clips[0]?.id||null);});
      article.append(heading,actions);list.append(article);
    });
    const visual=el('timeline');visual.replaceChildren();
    const total=P.projectDurationUs(project());
    project().clips.forEach((clip,i)=>{
      const b=document.createElement('button');b.className='segment';b.style.flex=String(Math.max(.7,P.clipDurationUs(clip)/Math.max(1,total)*8));b.textContent='Clip '+(i+1);
      b.setAttribute('aria-label','Select clip '+(i+1));b.type='button';
      b.addEventListener('click',()=>selectClip(clip.id));visual.append(b);
    });
    el('duration').textContent='Timeline length: '+fmt(seconds(total));
  }

  function drawAudio(){
    const list=el('audioTracks');list.replaceChildren();
    if(!project().audio.length){const p=document.createElement('p');p.className='muted';p.textContent='No audio tracks.';list.append(p);return;}
    project().audio.forEach((layer,i)=>{
      const asset=project().assets.find(a=>a.id===layer.sourceId);
      const field=document.createElement('fieldset');
      const leg=document.createElement('legend');leg.textContent=(i+1)+'. '+(asset?.name||'Unlinked audio');field.append(leg);
      const controls=[
        ['Starts at (seconds)',layer.startUs/1e6,0,100000,.01,n=>({startUs:micro(n),endUs:micro(n)+asset.durationUs})],
        ['Volume (%)',Math.round(layer.gain*100),0,400,1,n=>({gain:n/100})],
        ['Fade in (seconds)',(layer.fadeInUs||0)/1e6,0,60,.1,n=>({fadeInUs:micro(n)})],
        ['Fade out (seconds)',(layer.fadeOutUs||0)/1e6,0,60,.1,n=>({fadeOutUs:micro(n)})]
      ];
      for(const [label,value,min,max,step,change] of controls){
        const wrapper=document.createElement('label');wrapper.textContent=label;
        const input=document.createElement('input');input.type='number';input.value=value;input.min=min;input.max=max;input.step=step;
        input.setAttribute('aria-label',label+' for '+(asset?.name||'audio'));
        input.addEventListener('change',()=>{
          const v=Number(input.value);
          if(!Number.isFinite(v)||v<min||v>max){say('Invalid '+label);return;}
          doEdit('UPDATE_LAYER',{track:'audio',id:layer.id,patch:change(v)});
        });wrapper.append(input);field.append(wrapper);
      }
      const actions=document.createElement('div');actions.className='actions';
      const remove=document.createElement('button');remove.textContent='Remove track';remove.type='button';remove.className='secondary';
      remove.addEventListener('click',()=>doEdit('REMOVE_LAYER',{track:'audio',id:layer.id}));actions.append(remove);
      const file=bindingFor(layer.sourceId);if(file){
        const audio=document.createElement('audio');audio.controls=true;audio.preload='none';let u=state.audioUrls.get(layer.sourceId);if(!u){u=objectUrl(file);state.audioUrls.set(layer.sourceId,u);}audio.src=u;
        audio.addEventListener('ended',()=>audio.pause());actions.append(audio);
      }
      field.append(actions);list.append(field);
    });
  }
  function render(){
    const p=project();el('undo').disabled=!state.history.undoStack.length;
    el('redo').disabled=!state.history.redoStack.length;
    if(el('title').value!==p.title)el('title').value=p.title;
    drawClips();drawAudio();
    el('exportPreset').value=p.export.preset;
    el('sizeTarget').value=p.export.targetSizeBytes==null?'':Math.max(1,Math.round(p.export.targetSizeBytes/1048576));
    const clip=selectedClip();
    el('editControls').hidden=!clip;
    for(const id of ['markIn','markOut','seekBack','seekNext'])el(id).disabled=!clip || !bindingFor(clip.sourceId);
    if(clip){
      const asset=p.assets.find(x=>x.id===clip.sourceId);
      el('selectedHint').textContent='Editing '+(asset?.name||'missing source');
      el('backgroundMode').value=clip.backgroundMode||'letterbox';
      const crop=clip.crop;el('cropShape').value=crop?Math.round(crop.x*200):0;
      el('cropPercent').value=el('cropShape').value+'%';
      state.activeRange=clamp(state.activeRange,0,clip.ranges.length-1);
      const [a,b]=clip.ranges[state.activeRange];
      el('rangeStart').value=seconds(a);el('rangeEnd').value=seconds(b);
      const ranges=el('ranges');ranges.replaceChildren();
      clip.ranges.forEach((r,i)=>{
        const button=document.createElement('button');button.type='button';button.className=state.activeRange===i?'':'secondary';
        button.textContent='Keep '+(i+1)+' · '+fmt(seconds(r[0]))+' to '+fmt(seconds(r[1]));
        button.addEventListener('click',()=>{state.activeRange=i;render();});ranges.append(button);
      });
    }else{el('selectedHint').textContent='Select a clip to edit its range.';el('ranges').replaceChildren();}
    const binds=el('bindings');binds.replaceChildren();
    p.assets.forEach(a=>{
      const row=document.createElement('div');row.textContent=(bindingFor(a.id)?'Linked: ':'Missing: ')+a.name;
      if(!bindingFor(a.id)){const picker=document.createElement('input');picker.type='file';picker.accept=a.kind+'/*';
        picker.setAttribute('aria-label','Relink '+a.name);picker.addEventListener('change',()=>linkFile(a,picker.files?.[0]));row.append(picker);}
      binds.append(row);
    });
  }
  function selectClip(id){
    state.selected=id;state.activeRange=0;releasePreview();
    const clip=selectedClip(),source=clip&&bindingFor(clip.sourceId),video=el('preview');
    video.pause();video.removeAttribute('src');video.load();
    video.hidden=!source;el('previewEmpty').hidden=!!source;
    if(source){state.url=objectUrl(source);video.src=state.url;video.currentTime=seconds(clip.ranges[0][0]);video.load();}
    render();makeThumbnails(clip,source);
  }
  async function detectDuration(file){
    const url=objectUrl(file);const media=document.createElement(safeFileKind(file)==='audio'?'audio':'video');
    try{return await new Promise((resolve,reject)=>{
      const t=setTimeout(()=>reject(Error('Could not read media duration')),15000);
      media.preload='metadata';media.onloadedmetadata=()=>{clearTimeout(t);resolve(media.duration);};
      media.onerror=()=>{clearTimeout(t);reject(Error('Browser cannot preview this media codec'));};
      media.src=url;
    });}finally{media.pause();media.removeAttribute('src');media.load();URL.revokeObjectURL(url);}
  }
  async function importMedia(files){
    for(const f of files){
      const kind=safeFileKind(f);if(!kind){say('Unsupported import: '+f.name);continue;}
      try{
        const dur=await detectDuration(f);
        if(!Number.isFinite(dur)||dur<=0)throw Error('Unknown or invalid media duration');
        const asset={id:P.uid(),name:f.name.slice(0,255),kind,sizeBytes:f.size,durationUs:micro(dur)};
        if(!doEdit('ADD_ASSET',{asset}))continue;
        state.bound.set(asset.id,f);
        if(kind==='video'){
          const c=P.makeClip(asset,0,asset.durationUs);
          if(doEdit('ADD_CLIP',{clip:c})){state.selected=c.id;selectClip(c.id);}
        }
        if(kind==='audio'){
          const layer={id:P.uid(),sourceId:asset.id,startUs:0,endUs:asset.durationUs,gain:1,points:[],fadeInUs:0,fadeOutUs:0};
          doEdit('ADD_LAYER',{track:'audio',layer});
        }
        say('Imported '+f.name+' locally.');
      }catch(e){say(f.name+': '+e.message);}
    }
    render();
  }
  function linkFile(asset,file){
    if(!file)return;
    if(file.name!==asset.name || file.size!==asset.sizeBytes || safeFileKind(file)!==asset.kind){
      say('Source mismatch: choose the original '+asset.name+' with its original byte size.');return;
    }
    state.bound.set(asset.id,file);say('Relinked '+asset.name);
    if(selectedClip()?.sourceId===asset.id)selectClip(state.selected);
    else render();
  }
  function setRange(next){
    const clip=selectedClip();if(!clip)return;
    const ranges=clip.ranges.map(x=>x.slice());ranges[state.activeRange]=next;
    if(!doEdit('SET_RANGES',{id:clip.id,ranges}))return;
    state.activeRange=0;
  }
  function seekFor(source,at){
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{cleanup();reject(Error('Frame seeking timed out'));},4000);
      const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Frame unavailable'));};
      function cleanup(){clearTimeout(timeout);source.removeEventListener('seeked',done);source.removeEventListener('error',fail);}
      source.addEventListener('seeked',done,{once:true});source.addEventListener('error',fail,{once:true});
      source.currentTime=at;
    });
  }
  async function makeThumbnails(clip,sourceFile){
    const token=++state.thumbnailTask,root=el('thumbs');root.replaceChildren();
    if(!clip||!sourceFile)return;
    const media=document.createElement('video');const u=objectUrl(sourceFile);media.muted=true;media.playsInline=true;media.preload='auto';media.src=u;
    try{
      await new Promise((resolve,reject)=>{media.onloadedmetadata=resolve;media.onerror=()=>reject(Error('Thumbnails unsupported'));});
      if(token!==state.thumbnailTask)return;
      const duration=media.duration,amount=Math.min(7,Math.max(2,Math.ceil(duration/5)));
      for(let i=0;i<amount;i++){
        if(token!==state.thumbnailTask)break;
        const t=duration*(i+.5)/amount;
        try{await seekFor(media,t);}catch(_){continue;}
        if(token!==state.thumbnailTask)break;
        const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
        const ctx=canvas.getContext('2d');
        if(!ctx||!media.videoWidth)continue;
        ctx.drawImage(media,0,0,160,90);
        const b=document.createElement('button');b.type='button';
        b.setAttribute('aria-label','Preview '+fmt(t));b.append(canvas);
        const label=document.createElement('div');label.textContent=fmt(t);b.append(label);
        b.addEventListener('click',()=>{el('preview').currentTime=t;});
        root.append(b);
      }
    }catch(_){say('Thumbnail extraction unavailable for this source; timeline controls remain usable.');}
    finally{media.pause();media.removeAttribute('src');media.load();URL.revokeObjectURL(u);}
  }
  function exportProject(){
    const blob=new Blob([P.encode(project(),state.history)],{type:'application/json'});
    const url=objectUrl(blob),a=document.createElement('a');a.href=url;a.download='dexcut-'+project().id+'.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    say('Saved project recipe. Keep your original media files; they are not embedded.');
  }
  async function openProject(file){
    if(!file)return;try{
      const next=P.decode(await file.text());
      for(const u of state.audioUrls.values())URL.revokeObjectURL(u);state.audioUrls.clear();state.bound.clear();state.selected=null;state.thumbnailTask++;
      state.history.replace(next);releasePreview();el('preview').pause();el('preview').removeAttribute('src');el('preview').load();
      el('preview').hidden=true;el('previewEmpty').hidden=false;el('thumbs').replaceChildren();
      render();say('Project opened. Relink original media before editing or export.');
    }catch(e){say('Cannot open project: '+e.message);}
  }
  function showPreflight(){
    try{
      const result=E.preflight(project(),
        [...state.bound.keys()].map(assetId=>({assetId})),{verified:false},
        {multiInputVerified:false});
      const container=el('exportResult');container.replaceChildren();
      const p=document.createElement('p');p.textContent='Export readiness: '+result.verdict.toUpperCase();container.append(p);
      for(const line of result.problems.concat(result.warnings)){
        const n=document.createElement('p');n.textContent='• '+line;container.append(n);
      }
      const n=document.createElement('p');
      n.textContent='Estimated timeline: '+fmt(result.estimates.durationUs/1e6)+'. Studio composition rendering is not enabled.';
      container.append(n);
    }catch(error){el('exportResult').textContent='Invalid project: '+error.message;}
  }
  el('mediaInput').addEventListener('change',e=>{importMedia(Array.from(e.target.files||[]));e.target.value='';});
  el('audioInput').addEventListener('change',e=>{importMedia(Array.from(e.target.files||[]));e.target.value='';});
  let recording=null;
  el('recordVoice').addEventListener('click',async()=>{
    if(recording)return;
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      el('voiceStatus').textContent='Microphone recording is unavailable in this browser';return;
    }
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      const options=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'].find(m=>MediaRecorder.isTypeSupported(m));
      const rec=new MediaRecorder(stream,options?{mimeType:options}:undefined),chunks=[];
      rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
      rec.onerror=e=>{el('voiceStatus').textContent='Microphone error: '+(e.error?.message||'recording failed');};
      rec.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());
        recording=null;el('recordVoice').disabled=false;el('stopVoice').disabled=true;
        if(!chunks.length){el('voiceStatus').textContent='No audio captured';return;}
        const mime=rec.mimeType||chunks[0].type||'audio/mp4';
        const ext=mime.includes('webm')?'webm':mime.includes('ogg')?'ogg':'m4a';
        const file=new File(chunks,'narration-'+Date.now()+'.'+ext,{type:mime.split(';')[0]});
        el('voiceStatus').textContent='Recording captured. Adding local narration track.';
        await importMedia([file]);
      };
      recording=rec;rec.start(250);
      el('recordVoice').disabled=true;el('stopVoice').disabled=false;
      el('voiceStatus').textContent='Recording microphone… tap Stop to keep this take.';
    }catch(error){
      stream?.getTracks().forEach(t=>t.stop());
      el('voiceStatus').textContent='Microphone unavailable or permission denied: '+error.message;
    }
  });
  el('stopVoice').addEventListener('click',()=>{if(recording?.state==='recording')recording.stop();});

  el('undo').addEventListener('click',()=>{state.history.undo();if(!selectedClip())state.selected=project().clips[0]?.id||null;selectClip(state.selected);});
  el('redo').addEventListener('click',()=>{state.history.redo();if(!selectedClip())state.selected=project().clips[0]?.id||null;selectClip(state.selected);});
  el('title').addEventListener('change',e=>doEdit('RENAME',{title:e.target.value}));
  el('downloadProject').addEventListener('click',exportProject);
  el('openProject').addEventListener('change',e=>{openProject(e.target.files?.[0]);e.target.value='';});
  el('addRange').addEventListener('click',()=>{
    const c=selectedClip();if(!c)return;
    const asset=project().assets.find(a=>a.id===c.sourceId);
    const start=micro(Number(el('rangeStart').value)),end=micro(Number(el('rangeEnd').value));
    const next=P.normalizeRanges(c.ranges.concat([[start,end]]),asset.durationUs);
    doEdit('SET_RANGES',{id:c.id,ranges:next});
  });
  el('removeRange').addEventListener('click',()=>{
    const c=selectedClip();if(!c || c.ranges.length<2){say('At least one keep range is required for a clip. Remove the whole clip if needed.');return;}
    const next=c.ranges.filter((_,i)=>i!==state.activeRange);
    state.activeRange=0;doEdit('SET_RANGES',{id:c.id,ranges:next});
  });
  el('invertRange').addEventListener('click',()=>{
    const c=selectedClip();if(!c)return;
    const asset=project().assets.find(a=>a.id===c.sourceId);
    const next=P.invertRanges(c.ranges,asset.durationUs);
    if(!next.length){say('Inverting would remove the entire clip.');return;}
    state.activeRange=0;doEdit('SET_RANGES',{id:c.id,ranges:next});
  });
  for(const id of ['rangeStart','rangeEnd'])el(id).addEventListener('change',()=>{
    const start=micro(Number(el('rangeStart').value)),end=micro(Number(el('rangeEnd').value));
    setRange([start,end]);
  });
  for(const [id,idx] of [['markIn',0],['markOut',1]])el(id).addEventListener('click',()=>{
    const c=selectedClip();if(!c)return;const next=c.ranges[state.activeRange].slice();
    next[idx]=micro(el('preview').currentTime);setRange(next);
  });
  for(const [id,step] of [['seekBack',-1],['seekNext',1]])el(id).addEventListener('click',()=>{
    const frame=project().canvas.fpsDen/project().canvas.fpsNum;
    const v=el('preview');v.currentTime=clamp(v.currentTime+frame*step,0,v.duration||0);
  });
  el('cropShape').addEventListener('change',()=>{
    const c=selectedClip();if(!c)return;
    const q=Number(el('cropShape').value)/200;
    doEdit('UPDATE_CLIP',{id:c.id,crop:q?{x:q,y:q,w:1-2*q,h:1-2*q}:null});
  });
  el('backgroundMode').addEventListener('change',()=>{
    const c=selectedClip();if(c)doEdit('UPDATE_CLIP',{id:c.id,backgroundMode:el('backgroundMode').value});
  });
  el('exportPreset').addEventListener('change',e=>doEdit('SET_EXPORT',{preset:e.target.value}));
  el('sizeTarget').addEventListener('change',e=>{
    const v=e.target.value.trim()?Math.round(Number(e.target.value)*1048576):null;
    doEdit('SET_EXPORT',{targetSizeBytes:v});
  });
  el('checkExport').addEventListener('click',showPreflight);
  window.addEventListener('pagehide',()=>{state.thumbnailTask++;releasePreview();
    for(const u of state.audioUrls.values())URL.revokeObjectURL(u);state.audioUrls.clear();});
  let activeRender=null,completedURL=null;
  el('renderVideo').addEventListener('click',async()=>{
    if(activeRender)return;
    const renderer=window.DexCutStudioRender;
    if(!renderer){say('Studio renderer is unavailable');return;}
    const frozen=P.clone(project()),controller=new AbortController();
    try{
      renderer.verifySupported(frozen,state.bound);
      activeRender=controller;
      el('renderVideo').disabled=true;el('cancelRender').disabled=false;
      el('renderProgress').hidden=false;el('renderProgress').value=0;
      el('renderResult').replaceChildren();
      say('Preparing local video composition. Keep the app in the foreground.');
      const file=await renderer.render(frozen,new Map(state.bound),{signal:controller.signal,
        onEvent:ev=>{
          if(ev.kind==='stage')say(ev.message);
          if(ev.kind==='progress' && Number.isFinite(ev.data?.progress)){
            el('renderProgress').value=Math.max(0,Math.min(100,Math.round(ev.data.progress*100)));
          }
        }});
      if(controller.signal.aborted)return;
      if(completedURL)URL.revokeObjectURL(completedURL);
      completedURL=URL.createObjectURL(file);
      const video=document.createElement('video');video.controls=true;video.playsInline=true;video.src=completedURL;
      const a=document.createElement('a');a.href=completedURL;a.download=file.name;a.textContent='Save '+file.name;
      a.className='button';a.style.display='inline-block';a.style.marginTop='8px';
      const share=document.createElement('button');share.type='button';share.className='secondary';share.textContent='Share result';
      share.addEventListener('click',async()=>{
        if(navigator.canShare?.({files:[file]}))try{await navigator.share({files:[file]});}catch(e){if(e.name!=='AbortError')say('Share failed: '+e.message);}
        else say('This browser cannot share the output file. Use Save instead.');
      });
      el('renderResult').replaceChildren(video,a,share);
      say('Output assembled locally. Verify playback and duration before sharing.');
    }catch(err){say(controller.signal.aborted?'Render cancelled.':'Render failed: '+err.message);}
    finally{if(activeRender===controller)activeRender=null;el('renderVideo').disabled=false;
      el('cancelRender').disabled=true;el('renderProgress').hidden=true;}
  });
  el('cancelRender').addEventListener('click',()=>activeRender?.abort());
  window.addEventListener('pagehide',()=>{activeRender?.abort();if(completedURL)URL.revokeObjectURL(completedURL);});
  render();
})();
