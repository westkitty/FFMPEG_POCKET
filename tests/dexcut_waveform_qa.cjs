'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const script = read('dexcut-waveform.js');
const css = read('dexcut-waveform.css');
const sw = read('sw.js');
const inline = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
new vm.Script(inline, {filename: 'index-inline.js'});
new vm.Script(script, {filename: 'dexcut-waveform.js'});
new vm.Script(sw, {filename: 'sw.js'});
for (const id of ['sourceTimeline', 'toolTimeline', 'sheetResultTimeline', 'hubResultTimeline']) {
  assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, 'DOM id ' + id);
}
assert(html.indexOf('dexcut-waveform.js') < html.indexOf('<script>'), 'The waveform module must run before the inline application.');
for (const feature of [
  'DexCutWaveform?.setSource', 'DexCutWaveform?.edit',
  'DexCutWaveform?.setResults', 'DexCutWaveform?.shutdown',
  'DexCutWaveform?.pauseAll'
]) assert(html.includes(feature), 'Missing integration ' + feature);
for (const mechanism of [
  'decodeAudioData', 'getByteTimeDomainData', 'requestAnimationFrame',
  'setPointerCapture', 'loadedmetadata', "ArrowLeft", "ArrowRight",
  "MAX_DECODE_BYTES", "stopAt"
]) assert(script.includes(mechanism), 'Missing waveform mechanism ' + mechanism);
assert(!/(?:\bfetch\s*\(|XMLHttpRequest|sendBeacon)/.test(script), 'Waveform module must not upload or fetch media.');
assert(css.includes('touch-action:pan-y'));
assert(css.includes('min-height:44px'));
const cacheVersion=Number(sw.match(/const APP='dexcut-app-v(\d+)'/)?.[1]);
assert(Number.isInteger(cacheVersion) && cacheVersion >= 4,'Unexpected PWA shell cache revision');
for (const name of ['./dexcut-waveform.css', './dexcut-waveform.js']) assert(sw.includes(name), 'Offline shell missing ' + name);
const tools = [...inline.matchAll(/\{id:'([^']+)',icon:/g)].map(m => m[1]);
assert.equal(tools.length, 30, 'Lost an existing tool');
assert.equal(new Set(tools).size, 30);
console.log(JSON.stringify({
  result:'PASS', tools:tools.length, waveSurfaces:4,
  codeSyntax:'PASS', cacheVersion:'dexcut-app-v'+cacheVersion,
  dependencies:'none', mediaUploads:'none'
}, null, 2));
