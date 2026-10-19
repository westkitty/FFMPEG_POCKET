/* DEX//CUT Studio project model. No media bytes, DOM, or network calls. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DexCutProject = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const FORMAT = 'dexcut.project', VERSION = 1, MAX_US = Number.MAX_SAFE_INTEGER;
  const clone = value => JSON.parse(JSON.stringify(value));
  const validInt = n => Number.isSafeInteger(n) && n >= 0 && n <= MAX_US;
  const positive = n => validInt(n) && n > 0;
  const seconds = us => us / 1000000;
  const micros = s => Math.round(Number(s) * 1000000);
  const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'dc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function newProject(title) {
    return {format:FORMAT, schemaVersion:VERSION, id:uid(), title:String(title || 'Untitled edit').slice(0,120),
      revision:0, timeUnit:'microseconds',
      canvas:{width:720,height:1280,fpsNum:30,fpsDen:1, background:'#000000'},
      assets:[], clips:[], audio:[], captions:[], titles:[],
      export:{preset:'portrait-720p', container:'mp4', videoCodec:'h264', audioCodec:'aac', targetSizeBytes:null}};
  }
  function normalizeRanges(ranges, durationUs) {
    assert(Array.isArray(ranges), 'Ranges must be an array');
    const ordered = ranges.map(pair => {
      assert(Array.isArray(pair) && pair.length === 2 && validInt(pair[0]) && positive(pair[1]), 'Invalid range values');
      assert(pair[0] < pair[1], 'A range must have positive duration');
      if (durationUs != null) assert(pair[1] <= durationUs, 'Range exceeds source duration');
      return [pair[0], pair[1]];
    }).sort((a,b) => a[0]-b[0] || a[1]-b[1]);
    const out = [];
    for (const r of ordered) {
      const last=out[out.length-1];
      if (last && last[1]>=r[0]) last[1]=Math.max(last[1],r[1]);
      else out.push(r);
    }
    return out;
  }
  function invertRanges(ranges, durationUs) {
    assert(positive(durationUs), 'Known source duration required');
    const keep=normalizeRanges(ranges,durationUs), excluded=[];
    let cursor=0;
    for(const [a,b] of keep){if(a>cursor) excluded.push([cursor,a]); cursor=b;}
    if(cursor<durationUs) excluded.push([cursor,durationUs]);
    return excluded;
  }
  function diffRanges(a,b,durationUs) {
    const blocked=normalizeRanges(b,durationUs), result=[];
    for(const [s,e] of normalizeRanges(a,durationUs)){
      let cursor=s;
      for(const [bs,be] of blocked){
        if(be<=cursor)continue;
        if(bs>=e)break;
        if(bs>cursor)result.push([cursor,Math.min(bs,e)]);
        cursor=Math.max(cursor,Math.min(be,e));
        if(cursor>=e)break;
      }
      if(cursor<e)result.push([cursor,e]);
    }
    return result;
  }
  function durationOfRanges(ranges) { return ranges.reduce((sum,r)=>sum+(r[1]-r[0]),0); }
  function clipDurationUs(clip) { return Math.round(durationOfRanges(clip.ranges)/clip.speed); }
  function projectDurationUs(project) {
    let total=0;
    project.clips.forEach((clip,i)=>{
      total+=clipDurationUs(clip);
      if(i<project.clips.length-1 && clip.transitionOut?.type==='fade')
        total-=clip.transitionOut.durationUs || 0;
    });
    return total;
  }
  function flatten(project) {
    let projectTime=0;const result=[];
    project.clips.forEach((clip,index)=>{
      for(const range of clip.ranges){
        const dur=Math.round((range[1]-range[0])/clip.speed);
        result.push({clipId:clip.id,sourceId:clip.sourceId,sourceStartUs:range[0],sourceEndUs:range[1],
          projectStartUs:projectTime,projectEndUs:projectTime+dur,clipIndex:index});
        projectTime+=dur;
      }
      if(index<project.clips.length-1 && clip.transitionOut?.type==='fade')
        projectTime-=(clip.transitionOut.durationUs || 0);
    });
    return result;
  }
  function validate(project) {
    assert(project && typeof project==='object' && !Array.isArray(project),'Invalid project');
    assert(project.format===FORMAT && project.schemaVersion===VERSION,'Unsupported project schema');
    assert(project.timeUnit==='microseconds','Unsupported project time unit');
    assert(Array.isArray(project.assets) && project.assets.length<=100,'Invalid asset inventory');
    assert(Array.isArray(project.clips) && project.clips.length<=100,'Invalid clip inventory');
    for(const key of ['audio','captions','titles'])assert(Array.isArray(project[key]) && project[key].length<=250,'Invalid '+key+' track');
    assert(typeof project.title==='string' && project.title.length<=120,'Invalid project title');
    assert(validInt(project.revision),'Invalid revision');
    const c=project.canvas;
    assert(c && positive(c.width) && positive(c.height) && c.width<=4096 && c.height<=4096 &&
      c.width%2===0 && c.height%2===0 && positive(c.fpsNum) && positive(c.fpsDen) &&
      c.fpsNum/c.fpsDen>=1 && c.fpsNum/c.fpsDen<=120,'Invalid canvas settings');
    const ids=new Set(), assets=new Map();
    for(const a of project.assets){
      assert(a && typeof a.id==='string' && a.id.length<=96 && !ids.has(a.id),'Duplicate or invalid asset');
      assert(typeof a.name==='string' && a.name.length<=255,'Invalid asset name');
      assert(validInt(a.sizeBytes) && validInt(a.durationUs),'Invalid asset metadata');
      assert(['video','audio'].includes(a.kind),'Invalid asset kind');
      ids.add(a.id);assets.set(a.id,a);
    }
    const clipIDs=new Set();
    for(const cl of project.clips){
      assert(cl && typeof cl.id==='string' && !clipIDs.has(cl.id),'Duplicate or invalid clip ID');
      clipIDs.add(cl.id);
      assert(assets.has(cl.sourceId) && assets.get(cl.sourceId).kind==='video','Clip references missing video');
      assert(Array.isArray(cl.ranges) && cl.ranges.length>0 && cl.ranges.length<=250,'Clip must keep at least one range');
      assert(cl.speed>=0.25 && cl.speed<=4 && Number.isFinite(cl.speed),'Invalid speed');
      const normalized=normalizeRanges(cl.ranges,assets.get(cl.sourceId).durationUs);
      assert(JSON.stringify(normalized)===JSON.stringify(cl.ranges),'Clip ranges must be sorted, non-overlapping');
      if(cl.transitionOut){
        assert(['cut','fade'].includes(cl.transitionOut.type),'Invalid transition');
        assert(validInt(cl.transitionOut.durationUs),'Invalid transition duration');
        if(cl.transitionOut.type==='fade')
          assert(cl.transitionOut.durationUs<clipDurationUs(cl),'Transition too long');
      }
      if(cl.crop){const {x,y,w,h}=cl.crop;assert([x,y,w,h].every(n=>Number.isFinite(n)) &&
        x>=0&&y>=0&&w>0&&h>0&&x+w<=1.000001&&y+h<=1.000001,'Invalid crop geometry');}
    }
    for(let i=0;i<project.clips.length-1;i++){
      const tr=project.clips[i].transitionOut;
      if(tr?.type==='fade')assert(tr.durationUs<clipDurationUs(project.clips[i+1]),'Transition exceeds following clip');
    }
    for(const key of ['audio','captions','titles']){
      const layerIDs=new Set();
      for(const x of project[key]){
        assert(x && typeof x.id==='string' && !layerIDs.has(x.id),'Invalid or duplicate '+key+' ID');
        layerIDs.add(x.id);
        assert(validInt(x.startUs) && positive(x.endUs) && x.startUs<x.endUs,'Invalid layer timing');
        if(key==='audio'){
          assert(assets.has(x.sourceId) && assets.get(x.sourceId).kind==='audio','Missing audio source');
          assert(Number.isFinite(x.gain) && x.gain>=0 && x.gain<=4,'Invalid audio gain');
          if(x.points){assert(Array.isArray(x.points) && x.points.length<=100,'Invalid gain keyframes');
            let previous=-1;for(const p of x.points){assert(Array.isArray(p)&&p.length===2&&validInt(p[0])&&p[0]>previous&&p[0]<=x.endUs-x.startUs&&
              Number.isFinite(p[1])&&p[1]>=0&&p[1]<=4,'Invalid gain point');previous=p[0];}}
        }else assert(typeof x.text==='string' && x.text.length<=2000,'Invalid text content');
      }
    }
    assert(project.export && ['mp4','webm','m4a','mp3'].includes(project.export.container),'Invalid output container');
    if(project.export.targetSizeBytes!==null) assert(positive(project.export.targetSizeBytes),'Invalid target file size');
    assert(projectDurationUs(project)>=0 && Number.isSafeInteger(projectDurationUs(project)),'Invalid total duration');
    return true;
  }
  function apply(project, command) {
    validate(project);
    assert(command && typeof command.type==='string','Invalid command');
    const p=clone(project), d=command.data || {};
    const findClip=()=>{const x=p.clips.find(c=>c.id===d.id);assert(x,'Clip not found');return x;};
    switch(command.type){
      case 'ADD_ASSET':p.assets.push(clone(d.asset));break;
      case 'ADD_CLIP':p.clips.splice(d.at==null?p.clips.length:d.at,0,clone(d.clip));break;
      case 'REMOVE_CLIP':{const i=p.clips.findIndex(c=>c.id===d.id);assert(i>=0,'Clip not found');p.clips.splice(i,1);break;}
      case 'MOVE_CLIP':{const i=p.clips.findIndex(c=>c.id===d.id);assert(i>=0 && Number.isInteger(d.to) && d.to>=0 && d.to<p.clips.length,'Invalid move');
        p.clips.splice(d.to,0,p.clips.splice(i,1)[0]);break;}
      case 'SET_RANGES':{const cl=findClip(),a=p.assets.find(x=>x.id===cl.sourceId);cl.ranges=normalizeRanges(d.ranges,a.durationUs);break;}
      case 'UPDATE_CLIP':{const cl=findClip();for(const k of ['crop','speed','transitionOut','background','backgroundMode']){
        if(Object.prototype.hasOwnProperty.call(d,k))cl[k]=clone(d[k]);}break;}
      case 'ADD_LAYER':assert(['audio','captions','titles'].includes(d.track),'Invalid track');p[d.track].push(clone(d.layer));break;
      case 'UPDATE_LAYER':{assert(['audio','captions','titles'].includes(d.track),'Invalid track');
        const i=p[d.track].findIndex(x=>x.id===d.id);assert(i>=0,'Layer not found');p[d.track][i]=Object.assign({},p[d.track][i],clone(d.patch));break;}
      case 'REMOVE_LAYER':assert(['audio','captions','titles'].includes(d.track),'Invalid track');
        p[d.track]=p[d.track].filter(x=>x.id!==d.id);break;
      case 'SET_CANVAS':p.canvas=Object.assign({},p.canvas,clone(d));break;
      case 'SET_EXPORT':p.export=Object.assign({},p.export,clone(d));break;
      case 'RENAME':p.title=String(d.title || '').slice(0,120);break;
      default:throw new Error('Unknown edit command');
    }
    p.revision++;
    validate(p);
    return p;
  }
  class History {
    constructor(project){validate(project);this.current=clone(project);this.undoStack=[];this.redoStack=[];}
    execute(command){
      const before=this.current,after=apply(before,command);
      if(JSON.stringify(before)===JSON.stringify(after))return this.current;
      this.undoStack.push({before,after,type:command.type});
      if(this.undoStack.length>60)this.undoStack.shift();
      this.redoStack=[];
      this.current=after;return after;
    }
    undo(){const entry=this.undoStack.pop();if(!entry)return this.current;
      this.redoStack.push(entry);this.current=clone(entry.before);return this.current;}
    redo(){const entry=this.redoStack.pop();if(!entry)return this.current;
      this.undoStack.push(entry);this.current=clone(entry.after);return this.current;}
    replace(project){validate(project);this.current=clone(project);this.undoStack=[];this.redoStack=[];}
  }
  function encode(project, history){
    validate(project);const clean=clone(project);
    if(history)clean.recentEditTypes=history.undoStack.slice(-30).map(x=>x.type);
    return JSON.stringify(clean,null,2);
  }
  function decode(text) {
    assert(typeof text==='string' && text.length<=4*1024*1024,'Project is missing or too large');
    const obj=JSON.parse(text);
    if(obj.schemaVersion!==VERSION)throw new Error('This project schema version is not supported');
    validate(obj);return clone(obj);
  }
  function makeClip(asset, startUs, endUs) {
    assert(asset && asset.kind==='video','A video source is required');
    return {id:uid(),sourceId:asset.id,ranges:normalizeRanges([[startUs,endUs]],asset.durationUs),
      speed:1,transitionOut:{type:'cut',durationUs:0},crop:null,backgroundMode:'letterbox'};
  }
  return {VERSION,FORMAT,newProject,clone,uid,micros,seconds,validate,apply,History,encode,decode,makeClip,
    normalizeRanges,invertRanges,diffRanges,durationOfRanges,clipDurationUs,projectDurationUs,flatten};
});
