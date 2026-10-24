'use strict';
const assert=require('node:assert/strict');
const P=require('../dexcut-project.js');
const sec=P.micros;
function fixture(){
  const p=P.newProject('Proof');const source={id:'v1',name:'known.mp4',kind:'video',sizeBytes:1500,durationUs:sec(12)};
  return P.apply(p,{type:'ADD_ASSET',data:{asset:source}});
}
function segmentTest(){
 let p=fixture();let c=P.makeClip(p.assets[0],0,sec(12));c.id='c1';
 p=P.apply(p,{type:'ADD_CLIP',data:{clip:c}});
 p=P.apply(p,{type:'SET_RANGES',data:{id:'c1',ranges:[[sec(10),sec(12)],[0,sec(3)],[sec(6),sec(8)]]}});
 assert.equal(P.projectDurationUs(p),sec(7));
 assert.deepEqual(p.clips[0].ranges,[[0,sec(3)],[sec(6),sec(8)],[sec(10),sec(12)]]);
 assert.deepEqual(P.invertRanges(p.clips[0].ranges,sec(12)),[[sec(3),sec(6)],[sec(8),sec(10)]]);
 assert.deepEqual(P.diffRanges([[0,sec(12)]],[[sec(3),sec(6)],[sec(8),sec(10)]],sec(12)),p.clips[0].ranges);
 assert.equal(P.flatten(p).length,3);
 assert.equal(P.flatten(p)[2].projectStartUs,sec(5));
 assert.equal(P.decode(P.encode(p)).revision,p.revision);
 assert.throws(()=>P.apply(p,{type:'SET_RANGES',data:{id:'c1',ranges:[[sec(11),sec(13)]]}}),/source duration/);
 return p;
}
function transactionTest(){
 const p=segmentTest(),h=new P.History(p),last=JSON.stringify(h.current);
 h.execute({type:'RENAME',data:{title:'Next'}});assert.equal(h.current.title,'Next');
 h.execute({type:'SET_EXPORT',data:{preset:'square',targetSizeBytes:100000}});
 assert.equal(h.undoStack.length,2);h.undo();assert.equal(h.current.export.targetSizeBytes,null);
 h.undo();assert.equal(JSON.stringify(h.current),last);
 h.redo();assert.equal(h.current.title,'Next');
 h.execute({type:'RENAME',data:{title:'Branch'}});assert.equal(h.redoStack.length,0);
 assert.throws(()=>h.execute({type:'SET_CANVAS',data:{width:721}}),/canvas settings/);
 assert.equal(h.current.title,'Branch','Rejected command cannot change active project');
 assert.throws(()=>P.decode(JSON.stringify({...p,schemaVersion:99})),/schema version/);
 assert.throws(()=>P.decode('{ broken'),SyntaxError);
}
function reorderTest(){
 let p=fixture(),a=P.makeClip(p.assets[0],0,sec(2)),b=P.makeClip(p.assets[0],sec(5),sec(8));
 a.id='a';b.id='b';
 p=P.apply(p,{type:'ADD_CLIP',data:{clip:a}});
 p=P.apply(p,{type:'ADD_CLIP',data:{clip:b}});
 p=P.apply(p,{type:'MOVE_CLIP',data:{id:'b',to:0}});
 assert.deepEqual(p.clips.map(c=>c.id),['b','a']);
 assert.equal(P.projectDurationUs(p),sec(5));
 p=P.apply(p,{type:'UPDATE_CLIP',data:{id:'b',transitionOut:{type:'fade',durationUs:sec(1)}}});
 assert.equal(P.projectDurationUs(p),sec(4));
 assert.throws(()=>P.apply(p,{type:'UPDATE_CLIP',data:{id:'b',transitionOut:{type:'fade',durationUs:sec(2)}}}),/following clip/);
}
segmentTest();transactionTest();reorderTest();
console.log('PASS: DEXCUT project schema, multi-range algebra, time mapping, history, export JSON, failure atomicity');
