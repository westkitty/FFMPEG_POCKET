/* DEX//CUT Studio: opt-in single-worker FFmpeg.wasm sequential clip renderer.
 * Supports simple cuts/joins only. Rejects effects not implemented by this path.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DexCutStudioRender=api;
})(typeof window!=='undefined'?window:null,function(root){
  'use strict';
  const CORE='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
  class Engine {
    constructor(log){this.worker=null;this.pending=new Map();this.seq=0;this.logs=[];this.listener=log||(()=>{});}
    async init(){
      const [script,wasm]=await Promise.all([
        fetch(CORE+'/ffmpeg-core.js',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Failed loading FFmpeg JS');return r.blob();}),
        fetch(CORE+'/ffmpeg-core.wasm',{cache:'force-cache'}).then(r=>{if(!r.ok)throw Error('Failed loading FFmpeg WASM');return r.blob();})
      ]);
      const coreURL=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));
      const wasmURL=URL.createObjectURL(new Blob([wasm],{type:'application/wasm'}));
      const workerSource=String.raw`
let ffmpeg;
onmessage=async e=>{
 const {id,op,data}=e.data;
 try{
  let result;
  if(op==='load'){
   importScripts(data.core);
   ffmpeg=await createFFmpegCore({mainScriptUrlOrBlob:data.core+'#'+btoa(JSON.stringify({wasmURL:data.wasm,workerURL:''}))});
   ffmpeg.setLogger(line=>postMessage({op:'log',line}));
   ffmpeg.setProgress(line=>postMessage({op:'progress',line}));
   result=true;
  }else if(op==='exec'){
   ffmpeg.setTimeout(-1);
   ffmpeg.exec(...data);
   result=ffmpeg.ret;
   ffmpeg.reset();
  }else if(op==='write'){ffmpeg.FS.writeFile(data.path,data.bytes);result=true;}
  else if(op==='read')result=ffmpeg.FS.readFile(data);
  else if(op==='delete'){try{ffmpeg.FS.unlink(data);}catch(_){}result=true;}
  else throw Error('Unknown operation');
  if(result instanceof Uint8Array)postMessage({id,result},[result.buffer]);
  else postMessage({id,result});
 }catch(err){postMessage({id,error:String(err?.message||err)});}
};
`;
      const workerURL=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
      try{
        this.worker=new Worker(workerURL);
        this.worker.onmessage=e=>{
          const m=e.data;
          if(m.op==='log'){this.logs.push(m.line?.message||'');if(this.logs.length>180)this.logs.shift();this.listener({kind:'log',data:m.line});return;}
          if(m.op==='progress'){this.listener({kind:'progress',data:m.line});return;}
          const waiting=this.pending.get(m.id);if(!waiting)return;
          this.pending.delete(m.id);if(m.error)waiting.reject(Error(m.error));else waiting.resolve(m.result);
        };
        this.worker.onerror=e=>{for(const x of this.pending.values())x.reject(Error(e.message||'Worker error'));this.pending.clear();};
        await this.send('load',{core:coreURL,wasm:wasmURL});
      }finally{URL.revokeObjectURL(workerURL);URL.revokeObjectURL(coreURL);URL.revokeObjectURL(wasmURL);}
    }
    send(op,data,transfer){
      if(!this.worker)return Promise.reject(Error('Worker unavailable'));
      const id=++this.seq;
      return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,op,data},transfer||[]);});
    }
    write(path,bytes){return this.send('write',{path,bytes},[bytes.buffer]);}
    exec(args){this.logs=[];return this.send('exec',args);}
    read(path){return this.send('read',path);}
    del(path){return this.send('delete',path);}
    close(){for(const p of this.pending.values())p.reject(Error('Cancelled'));this.pending.clear();this.worker?.terminate();this.worker=null;}
  }
  function verifySupported(project,files){
    const P=root?.DexCutProject||typeof require==='function'&&require('./dexcut-project.js');
    if(!P)throw Error('Project model unavailable');
    P.validate(project);
    if(!project.clips.length)throw Error('Add video clips before rendering');
    if(project.titles.length+project.captions.length>12)throw Error('This preliminary renderer supports up to 12 timed text cues per export');
    if(project.audio.length>4)throw Error('This preliminary mixer supports at most four audio tracks');
    if(project.clips.some(c=>c.speed!==1||c.transitionOut?.type==='fade'))
      throw Error('This render path does not yet support speed changes or transitions');
    if(!['portrait-720p','landscape-720p','square-720p','messaging'].includes(project.export.preset))
      throw Error('This renderer currently supports conservative output profiles only');
    const segments=P.flatten(project);
    if(segments.length>15)throw Error('Limit this preliminary renderer to 15 sections');
    if(segments.some(s=>s.sourceEndUs<=s.sourceStartUs))throw Error('Empty segment');
    for(const id of new Set(segments.map(s=>s.sourceId)))if(!files.has(id))throw Error('Relink missing source '+id);
    return segments;
  }
  async function textPng(layer,w){
    if(typeof document==='undefined')throw Error('Timed text rendering requires a browser canvas');
    const canvas=document.createElement('canvas'),font=Math.max(22,Math.min(48,Math.round(w/17)));
    canvas.width=Math.min(1000,Math.max(220,w-36));canvas.height=Math.max(110,font*3+32);
    const g=canvas.getContext('2d');if(!g)throw Error('Canvas typography unavailable');
    g.clearRect(0,0,canvas.width,canvas.height);
    g.fillStyle='rgba(0,0,0,0.75)';
    g.fillRect(0,0,canvas.width,canvas.height);
    g.fillStyle='#ffffff';g.font='700 '+font+'px system-ui, sans-serif';g.textAlign='center';g.textBaseline='middle';
    const words=layer.text.trim().split(/\s+/),lines=[];let current='';
    for(const word of words){
      const candidate=current?current+' '+word:word;
      if(current && g.measureText(candidate).width>canvas.width-38){lines.push(current);current=word;}
      else current=candidate;
    }
    if(current)lines.push(current);
    const visible=lines.slice(0,3),dy=font*1.08;
    visible.forEach((line,i)=>g.fillText(line,canvas.width/2,canvas.height/2+(i-(visible.length-1)/2)*dy,canvas.width-26));
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Text image failed')),'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function render(project,files,options){
    const P=root?.DexCutProject;
    const segments=verifySupported(project,files);
    const opts=options||{},e=new Engine(opts.onEvent);
    let cancelled=false;const isCancelled=()=>cancelled||(opts.signal?.aborted);
    const abort=()=>{cancelled=true;e.close();};
    opts.signal?.addEventListener('abort',abort,{once:true});
    const done=[],pref={ 'portrait-720p':[720,1280], 'landscape-720p':[1280,720], 'square-720p':[720,720],messaging:[480,854]};
    const [w,h]=pref[project.export.preset],rate=project.export.preset==='messaging'?24:30;
    const plannedDuration=P.projectDurationUs(project)/1e6;
    const targetKbps=project.export.targetSizeBytes?
      Math.floor(project.export.targetSizeBytes*8/plannedDuration/1000):null;
    if(targetKbps && targetKbps<150)throw Error('Requested file-size budget is below the preliminary encoder minimum');
    try{
      if(isCancelled())throw Error('Cancelled');
      opts.onEvent?.({kind:'stage',message:'Starting the local FFmpeg engine'});
      await e.init();
      let commonAudio=null;
      for(let i=0;i<segments.length;i++){
        if(isCancelled())throw Error('Cancelled');
        const s=segments[i],file=files.get(s.sourceId),input='source-'+i+'.'+String(file.name.split('.').pop()||'mp4').replace(/[^a-z0-9]/gi,'').slice(0,5);
        opts.onEvent?.({kind:'stage',message:'Encoding section '+(i+1)+' of '+segments.length});
        const data=new Uint8Array(await file.arrayBuffer());await e.write(input,data);
        const rcProbe=await e.exec(['-hide_banner','-i',input]);
        void rcProbe;
        const streams=e.logs.join('\n');const hasAudio=/Stream #\S+: Audio:/.test(streams);
        if(commonAudio===null)commonAudio=hasAudio;
        if(hasAudio!==commonAudio)throw Error('Mixed silent and audio clips need a future normalized audio renderer');
        const out='section-'+i+'.mp4';
        const clip=project.clips.find(x=>x.id===s.clipId);
        const crop=clip.crop;
        const part=crop?'crop=iw*'+crop.w+':ih*'+crop.h+':iw*'+crop.x+':ih*'+crop.y+',':'';
        const mode=clip.backgroundMode||'letterbox';
        const base=part+'scale='+w+':'+h+':force_original_aspect_ratio=decrease,pad='+w+':'+h+':(ow-iw)/2:(oh-ih)/2';
        const vf=base+',setsar=1,fps='+rate;
        const blurgraph='[0:v]'+part+'split=2[bg][fg];'+
          '[bg]scale='+w+':'+h+':force_original_aspect_ratio=increase,crop='+w+':'+h+',gblur=sigma=12[background];'+
          '[fg]scale='+w+':'+h+':force_original_aspect_ratio=decrease[foreground];'+
          '[background][foreground]overlay=(W-w)/2:(H-h)/2,setsar=1,fps='+rate+'[v]';
        const duration=(s.sourceEndUs-s.sourceStartUs)/1e6,offset=s.sourceStartUs/1e6;
        const args=['-hide_banner','-ss',String(offset),'-i',input,'-t',String(duration)];
        if(mode==='blur')args.push('-filter_complex',blurgraph,'-map','[v]');
        else {const hex=/^#[0-9a-f]{6}$/i.test(clip.background||'')?clip.background.slice(1):'000000';
          args.push('-vf',mode==='solid'?vf.replace(/pad=([^,]+)/,'pad=$1:color=0x'+hex):vf,'-map','0:v:0');}
        if(hasAudio)args.push('-map','0:a:0','-c:a','aac','-ar','44100','-ac','2','-b:a','96k');
        else args.push('-an');
        args.push('-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p');
        if(targetKbps){
          const vKbps=Math.max(80,targetKbps-(hasAudio||project.audio.length?128:0)-24);
          args.push('-b:v',vKbps+'k','-maxrate',vKbps+'k','-bufsize',(vKbps*2)+'k');
        }else args.push('-crf','27');
        args.push('-movflags','+faststart',out);
        const code=await e.exec(args);
        if(code!==0)throw Error('Encoding section '+(i+1)+' failed ('+code+')');
        await e.del(input);done.push(out);
      }
      if(isCancelled())throw Error('Cancelled');
      opts.onEvent?.({kind:'stage',message:'Combining sections'});
      const list=done.map(f=>"file '"+f+"'").join('\n')+'\n';
      await e.write('list.txt',new TextEncoder().encode(list));
      const code=await e.exec(['-hide_banner','-f','concat','-safe','0','-i','list.txt','-c','copy','-movflags','+faststart','result.mp4']);
      if(code!==0)throw Error('Final concatenation failed ('+code+')');
      let finalName='result.mp4';
      if(project.audio.length){
        opts.onEvent?.({kind:'stage',message:'Mixing music and narration'});
        await e.exec(['-hide_banner','-i','result.mp4']);
        const hasOriginalAudio=/Stream #\S+: Audio:/.test(e.logs.join('\n'));
        const inputs=['-i','result.mp4'],chains=[],names=[];
        if(hasOriginalAudio){chains.push('[0:a]aresample=44100[baseaudio]');names.push('[baseaudio]');}
        const maxDuration=P.projectDurationUs(project)/1e6;
        for(let i=0;i<project.audio.length;i++){
          const layer=project.audio[i],file=files.get(layer.sourceId);
          if(!file)throw Error('Relink audio source before export');
          if(file.size>20*1024*1024)throw Error('Audio import is too large for this preliminary phone mixer');
          const ext=String(file.name.split('.').pop()||'m4a').replace(/[^a-z0-9]/gi,'').slice(0,5);
          const input='track-'+i+'.'+ext;
          const bytes=new Uint8Array(await file.arrayBuffer());
          await e.write(input,bytes);inputs.push('-i',input);
          const length=(layer.endUs-layer.startUs)/1e6,at=layer.startUs/1e6;
          let chain='['+(i+1)+':a]aresample=44100,atrim=0:'+length+
            ',asetpts=PTS-STARTPTS,volume='+layer.gain;
          if(layer.fadeInUs>0)chain+=',afade=t=in:st=0:d='+Math.min(length,layer.fadeInUs/1e6);
          if(layer.fadeOutUs>0){const d=Math.min(length,layer.fadeOutUs/1e6);
            chain+=',afade=t=out:st='+Math.max(0,length-d)+':d='+d;}
          if(at>0)chain+=',adelay='+Math.round(at*1000)+'|'+Math.round(at*1000);
          chain+='[layer'+i+']';chains.push(chain);names.push('[layer'+i+']');
        }
        if(!names.length)throw Error('No sound tracks available to mix');
        const graph=chains.join(';')+';'+names.join('')+
          'amix=inputs='+names.length+':duration=longest:dropout_transition=0,'+
          'atrim=0:'+maxDuration+',asetpts=PTS-STARTPTS[mixed]';
        const args=['-hide_banner',...inputs,'-filter_complex',graph,'-map','0:v:0','-map','[mixed]',
          '-c:v','copy','-c:a','aac','-ar','44100','-ac','2','-b:a','128k','-t',String(maxDuration),
          '-movflags','+faststart','result-mixed.mp4'];
        const audioCode=await e.exec(args);
        if(audioCode!==0)throw Error('Audio mix failed ('+audioCode+'). Review unsupported source audio codecs.');
        finalName='result-mixed.mp4';
      }
      const layers=[...project.captions.map(x=>({...x,kind:'caption'})),...project.titles.map(x=>({...x,kind:'title'}))]
        .sort((a,b)=>a.startUs-b.startUs);
      if(layers.length){
        opts.onEvent?.({kind:'stage',message:'Rendering timed titles and captions'});
        const inputs=['-i',finalName],graph=[],duration=P.projectDurationUs(project)/1e6;
        let last='[0:v]';
        for(let i=0;i<layers.length;i++){
          const l=layers[i],file='text-'+i+'.png';
          await e.write(file,await textPng(l,w));
          inputs.push('-loop','1','-framerate',String(rate),'-i',file);
          const y=l.position==='top'?'36':l.position==='center'?'(H-h)/2':'H-h-36';
          const enable='between(t\\,'+(l.startUs/1e6)+'\\,'+(l.endUs/1e6)+')';
          const dest='[textv'+i+']';
          graph.push(last+'['+(i+1)+':v]overlay=x=(W-w)/2:y='+y+
            ':enable='+enable+':shortest=0:repeatlast=1'+dest);
          last=dest;
        }
        const args=['-hide_banner',...inputs,'-filter_complex',graph.join(';'),'-map',last,
          '-map','0:a:0?','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-crf','27',
          '-c:a','copy','-t',String(duration),'-movflags','+faststart','result-text.mp4'];
        const textCode=await e.exec(args);
        if(textCode!==0)throw Error('Timed-text render failed ('+textCode+'). Review source format and overlay capabilities.');
        finalName='result-text.mp4';
      }
      const out=await e.read(finalName);
      if(!out?.length)throw Error('Empty final output');
      if(isCancelled())throw Error('Cancelled');
      opts.onEvent?.({kind:'stage',message:'Output ready'});
      return new File([out.buffer],(project.title||'dexcut')+'-studio.mp4',{type:'video/mp4'});
    }finally{
      opts.signal?.removeEventListener('abort',abort);
      e.close();
    }
  }
  return {render,verifySupported};
});
