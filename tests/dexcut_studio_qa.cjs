'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio.html'),'utf8');
const code=fs.readFileSync(path.join(root,'dexcut-studio.js'),'utf8');
new vm.Script(code,{filename:'dexcut-studio.js'});
new vm.Script(fs.readFileSync(path.join(root,'dexcut-studio-render.js'),'utf8'),{filename:'dexcut-studio-render.js'});
for(const module of ['dexcut-studio-readiness.js','dexcut-studio-gestures.js','dexcut-studio-markers.js','dexcut-studio-batch.js'])new vm.Script(fs.readFileSync(path.join(root,module),'utf8'),{filename:module});
for(const file of ['dexcut-project.js','dexcut-export-plan.js','dexcut-studio-render.js','dexcut-studio-readiness.js','dexcut-studio.js','dexcut-studio-gestures.js','dexcut-studio-markers.js','dexcut-studio-batch.js']){
  assert(html.includes('src="./'+file+'"'),'Missing module '+file);
}
const allCode=code+fs.readFileSync(path.join(root,'dexcut-studio-gestures.js'),'utf8')+fs.readFileSync(path.join(root,'dexcut-studio-readiness.js'),'utf8')+fs.readFileSync(path.join(root,'dexcut-studio-markers.js'),'utf8')+fs.readFileSync(path.join(root,'dexcut-studio-batch.js'),'utf8');
for(const id of ['mediaInput','clipList','preview','timeline','undo','redo','rangeStart','rangeEnd','addRange','removeRange','invertRange',
  'downloadProject','openProject','exportPreset','sizeTarget','checkExport','thumbs','backgroundMode','backgroundColor','exportSrt','renderVideo','cancelRender','renderProgress','renderResult','audioInput','audioTracks','recordVoice','stopVoice','voiceStatus','textContent','addTitle','subtitleInput','textTracks','precisionTrack','cropWorkspace','timelineZoom','timelinePan','snapCuts','refreshReadiness','readiness','analyzeScenes','analyzeSilence','cancelAnalyze','analyzeStatus','markerResults','batchInput','batchStatus','batchList','runBatch','cancelBatch']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'Missing/duplicate '+id);
  assert(allCode.includes("el('"+id+"')")||allCode.includes("['"+id+"'")||allCode.includes("byId('"+id+"')")||allCode.includes("getElementById('"+id+"')"),'Missing UI usage '+id);
}
assert(/Studio rendering supports tested simple compositions/.test(code),'Preflight must describe renderer limitations honestly');
assert(html.includes('Advanced effects remain unsupported') || html.includes('advanced audio/caption effects'),'Renderer limitations must be visible');
assert(!/navigator\.sendBeacon|XMLHttpRequest|localStorage|indexedDB/i.test(code),'Studio must not silently upload or store media');
console.log('PASS: studio module syntax, interaction hooks, honest composition-export boundary');
