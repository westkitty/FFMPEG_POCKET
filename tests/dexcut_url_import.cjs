'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'dexcut-url-import.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
new vm.Script(js,{filename:'dexcut-url-import.js'});
assert(html.includes('<script defer src="./dexcut-url-import.js"></script>'),'Importer must be loaded');
assert(html.includes("document.addEventListener('dexcut:import-file'"),'Imported File must enter existing handleFile path');
assert(sw.includes('"./dexcut-url-import.js"'),'Importer must be cached for offline app shell');
for(const literal of ['credentials:\'omit\'','new AbortController()','controller?.abort()','consent.checked','MAX_BYTES','new File(','CustomEvent(\'dexcut:import-file\'','redirect:\'error\'']){
 assert(js.includes(literal),'Missing importer invariant: '+literal);
}
assert(!js.includes('localStorage'),'Service URLs must not be persisted silently');
console.log('DEX//CUT URL import static contract PASS');
