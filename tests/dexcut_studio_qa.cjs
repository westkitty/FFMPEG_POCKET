'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'studio.html'),'utf8');
const code=fs.readFileSync(path.join(root,'dexcut-studio.js'),'utf8');
new vm.Script(code,{filename:'dexcut-studio.js'});
for(const file of ['dexcut-project.js','dexcut-export-plan.js','dexcut-studio.js']){
  assert(html.includes('src="./'+file+'"'),'Missing module '+file);
}
for(const id of ['mediaInput','clipList','preview','timeline','undo','redo','rangeStart','rangeEnd','addRange','removeRange','invertRange',
  'downloadProject','openProject','exportPreset','sizeTarget','checkExport','thumbs','backgroundMode']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'Missing/duplicate '+id);
  assert(code.includes("el('"+id+"')")||code.includes("['"+id+"'"),'Missing UI usage '+id);
}
assert(/Studio composition rendering is not enabled/.test(code),'Cannot falsely advertise completed export');
assert(!/navigator\.sendBeacon|XMLHttpRequest|localStorage|indexedDB/i.test(code),'Studio must not silently upload or store media');
console.log('PASS: studio module syntax, interaction hooks, honest composition-export boundary');
