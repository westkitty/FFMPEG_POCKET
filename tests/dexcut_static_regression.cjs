'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=cp.execFileSync('git',['show','0cc2943cfe0342ef543208bf4197ee55d04c9017:index.html'],{cwd:root,encoding:'utf8'});
const getInline=src=>src.slice(src.indexOf('<script>')+8,src.lastIndexOf('</script>'));
new vm.Script(getInline(html),{filename:'dexcut-app-inline.js'});
new vm.Script(fs.readFileSync(path.join(root,'sw.js'),'utf8'),{filename:'sw.js'});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.short_name,'DEX//CUT');
assert.equal(manifest.id,'./');assert.equal(manifest.scope,'./');
const source=getInline(html),original=getInline(baseline);
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,'Missing section '+start);return text.slice(a,b)}
const protectedSections=[
  ['const JOBS=[','const values={}'],
  ['class PocketFFmpeg','async function blobURL'],
  ['function build(','function friendlyError'],
  ['async function runDeviceTests(){',"verifyOpen.addEventListener('click'"],
  ['function decodeCheck(','function assertDeviceResult('],
  ['function assertDeviceResult(','async function runDeviceTests()']
];
for(const [a,b] of protectedSections){
 assert.equal(section(source,a,b),section(original,a,b),'Protected implementation changed: '+a);
}
const jobs=[...source.matchAll(/\{id:'([^']+)',icon:/g)].map(x=>x[1]);
assert.equal(jobs.length,30);assert.equal(new Set(jobs).size,30);
for(const id of ['ending','clip','smaller','audio','mute','gif','resize','rotate','picture','speed','crop','fitframe','reverse','loop','boomerang','compat','webm','mp3','wav','normalize','volume','silence','mono','color','blur','sharpen','bw','pixelate','fps','metadata'])assert(jobs.includes(id),'Missing tool '+id);
for(const id of ['verifyOpen','verifyDialog','verifyRun','verifyCancel','verifyCopy','verifyList','installBtn','toolDialog','fileInput','toolSearch','jobs','resultHub','sheetRun','hubPreview'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'DOM ID '+id);
assert(html.includes('THE FULL ARSENAL.'));assert(html.includes('PROVE IT ON THIS DEVICE.'));
assert(html.includes('MEDIA PROCESSING. UNDER PROTEST.'));assert(!html.includes('FFmpeg Pocket'));
assert(source.includes("if(new URLSearchParams(location.search).has('verify'))verifyDialog.showModal();"));
const shell=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const f of ['./dexcut.css','./assets/dexcut-atlas.avif','./assets/dexcut-poster.webp'])assert(shell.includes(f),'Cache asset '+f);
for(const f of ['assets/dexcut-atlas.avif','assets/dexcut-poster.webp','dexcut.css','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','icon.svg'])assert(fs.statSync(path.join(root,f)).size>100,'Missing asset '+f);
console.log(JSON.stringify({result:'PASS',protectedSections:protectedSections.length,toolDefinitions:jobs.length,domSelectors:'verified',manifest:'valid',serviceWorker:'valid',runtimeSyntax:'valid',icons:'present'},null,2));
