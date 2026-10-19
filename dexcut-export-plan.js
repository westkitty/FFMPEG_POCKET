/* DEX//CUT Studio capability-aware export preflight. No media reads or network activity. */
(function(root,factory) {
  const api=factory(typeof module==='object' && module.exports ? require('./dexcut-project.js') : root.DexCutProject);
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.DexCutExportPlan=api;
})(typeof window!=='undefined'?window:null,function(P){
  'use strict';
  if(!P)throw Error('Project model must be loaded before export planning');
  const PRESETS={
    'portrait-720p':{width:720,height:1280,container:'mp4',fps:30,audioKbps:128},
    'landscape-720p':{width:1280,height:720,container:'mp4',fps:30,audioKbps:128},
    'square-720p':{width:720,height:720,container:'mp4',fps:30,audioKbps:128},
    'portrait-1080p':{width:1080,height:1920,container:'mp4',fps:30,audioKbps:128},
    'messaging':{width:480,height:854,container:'mp4',fps:24,audioKbps:96}
  };
  const defaultCaps=()=>({filters:[],encoders:[],formats:[],verified:false});
  function textBlocks(project){
    return [...project.captions.map(x=>({...x,kind:'caption'})),...project.titles.map(x=>({...x,kind:'title'}))];
  }
  function preflight(project,mediaBindings,capabilities,limits){
    P.validate(project);
    const bindings=new Map((mediaBindings||[]).map(x=>[x.assetId,x]));
    const caps=capabilities||defaultCaps(),filters=new Set(caps.filters||[]),encoders=new Set(caps.encoders||[]),
      problems=[],warnings=[],requirements=new Set(),nodes=[];
    const durationUs=P.projectDurationUs(project),duration=durationUs/1e6;
    if(!project.clips.length)problems.push('Add at least one video clip');
    if(!durationUs)problems.push('Timeline has no playable duration');
    const preset=PRESETS[project.export.preset];
    if(!preset)problems.push('Unknown export preset');
    const w=preset?.width||project.canvas.width,h=preset?.height||project.canvas.height;
    const fps=preset?.fps||project.canvas.fpsNum/project.canvas.fpsDen;
    const maxDimension=limits?.maxDimension||0;
    if(maxDimension && Math.max(w,h)>maxDimension)problems.push('Requested dimensions exceed this device profile');
    if(!caps.verified)warnings.push('The pinned FFmpeg engine capabilities have not been verified for this device');
    const has=(name)=>filters.has(name);
    const requireFilter=(name,why)=>{
      requirements.add(name);
      if(caps.verified&&!has(name))problems.push('Missing '+name+' filter required for '+why);
    };
    const inputSources=new Set(project.clips.map(c=>c.sourceId).concat(project.audio.map(x=>x.sourceId)));
    for(const id of inputSources)if(!bindings.has(id))problems.push('Relink source '+id+' before export');
    for(const clip of project.clips){
      if(clip.ranges.length>1)requireFilter('concat','multi-range edits');
      if(clip.speed!==1)requireFilter('setpts','clip speed');
      if(clip.crop)requireFilter('crop','interactive crop');
      if(clip.backgroundMode==='blur')for(const f of ['split','gblur','overlay'])requireFilter(f,'blurred background');
    }
    if(project.clips.length>1)requireFilter('concat','clip assembly');
    if(project.clips.some(c=>c.transitionOut?.type==='fade')){
      requireFilter('xfade','video transitions');
      if(project.clips.some(c=>c.audio!==false))requireFilter('acrossfade','audio transitions');
    }
    if(project.audio.length){
      requireFilter('amix','music and narration mixing');
      if(project.audio.some(a=>(a.points||[]).length))requireFilter('volume','audio gain envelopes');
    }
    if(textBlocks(project).length){
      if(!has('drawtext')&&!has('overlay'))
        problems.push('Timed text requires a verified text or image-overlay rendering path');
      else requirements.add(has('drawtext')?'drawtext':'overlay');
    }
    if(caps.verified && encoders.size && !encoders.has('libx264') && preset?.container==='mp4')
      problems.push('H.264 encoding was not demonstrated by this engine profile');
    const sourceTotal=project.assets.filter(x=>inputSources.has(x.id)).reduce((n,a)=>n+a.sizeBytes,0);
    const maxSourceBytes=limits?.maxInputBytes || null;
    if(maxSourceBytes && project.assets.some(a=>inputSources.has(a.id)&&a.sizeBytes>maxSourceBytes))
      problems.push('One or more source files exceed the measured safe device input size');
    const target=project.export.targetSizeBytes, audioKbps=project.audio.length? (preset?.audioKbps||128) : (preset?.audioKbps||128);
    const targetTotalKbps=target && duration>0 ? target*8/duration/1000 : null;
    let videoKbps=targetTotalKbps ? Math.floor(targetTotalKbps-audioKbps-24) : null;
    if(videoKbps!==null && videoKbps<80)problems.push('Target output size is too small for a useful video stream');
    if(target)warnings.push('File size is an estimate, not a guaranteed output size');
    if(project.clips.length>1 && !limits?.multiInputVerified)
      warnings.push('Multi-input composition has not passed a physical device benchmark');
    if(project.audio.length && !limits?.audioMixVerified)
      warnings.push('Audio mixing has not passed a physical device benchmark');
    if(project.clips.some(c=>c.transitionOut?.type==='fade') && !limits?.transitionsVerified)
      warnings.push('Crossfades are experimental until verified on this iPhone');
    P.flatten(project).forEach((range,i)=>nodes.push({
      id:'segment-'+i,kind:'segment',clipId:range.clipId,sourceId:range.sourceId,
      sourceStartUs:range.sourceStartUs,sourceEndUs:range.sourceEndUs,
      projectStartUs:range.projectStartUs,projectEndUs:range.projectEndUs
    }));
    if(nodes.length>1)nodes.push({id:'assembly',kind:'concat',inputs:nodes.map(x=>x.id)});
    if(project.audio.length)nodes.push({id:'mix',kind:'audio-mix',inputs:project.audio.map(x=>x.id)});
    if(textBlocks(project).length)nodes.push({id:'titles',kind:'text-layers',count:textBlocks(project).length});
    nodes.push({id:'final',kind:'encode',width:w,height:h,fps,container:preset?.container||project.export.container,
      videoKbps,audioKbps,estimatedBytes:target||null});
    const estimatedWorkingBytes=sourceTotal+Math.ceil(w*h*4*3)+Math.ceil(sourceTotal*.6);
    if(limits?.maxWorkingBytes && estimatedWorkingBytes>limits.maxWorkingBytes)
      warnings.push('Estimated working memory exceeds the device profile; stage media or reduce resolution');
    if(caps.verified && !problems.length && (!limits || !limits.multiInputVerified) && project.clips.length>1)
      warnings.push('The export plan is structurally ready but its iPhone performance is unverified');
    return {verdict:problems.length?'blocked':warnings.length?'needs-confirmation':'ready',
      projectRevision:project.revision,output:{width:w,height:h,fps,container:preset?.container||project.export.container,
        estimatedBytes:target||null},requiredFilters:[...requirements],problems,warnings,nodes,
      estimates:{durationUs,sourceTotalBytes:sourceTotal,workingSetBytes:estimatedWorkingBytes}};
  }
  return {PRESETS,preflight};
});
