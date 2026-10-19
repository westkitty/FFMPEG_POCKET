'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.wasm':'application/wasm'};
function toneWav(){
 const rate=22050,duration=1.5,frames=Math.floor(rate*duration),bytes=new Uint8Array(44+frames*2);
 const view=new DataView(bytes.buffer);
 for(let i=0;i<4;i++)bytes[i]='RIFF'.charCodeAt(i);
 view.setUint32(4,36+frames*2,true);
 for(let i=0;i<4;i++)bytes[8+i]='WAVE'.charCodeAt(i);
 for(let i=0;i<4;i++)bytes[12+i]='fmt '.charCodeAt(i);
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 for(let i=0;i<4;i++)bytes[36+i]='data'.charCodeAt(i);
 view.setUint32(40,frames*2,true);
 for(let i=0;i<frames;i++)view.setInt16(44+i*2,Math.floor(9000*Math.sin(2*Math.PI*440*i/rate)),true);
 return Buffer.from(bytes);
}
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const full=path.resolve(root,'.'+(pathname==='/'?'/studio.html':pathname));
  if(!full.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(full,(err,bytes)=>{if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream'});res.end(bytes);});
});
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||undefined,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/studio.html');
    await page.locator('#mediaInput').setInputFiles(path.join(root,'qa-sample.mp4'));
    await page.waitForFunction(()=>document.querySelectorAll('#clipList article').length===1,{timeout:20000});
    await page.locator('#rangeStart').fill('0');
    await page.locator('#rangeEnd').fill('1');
    await page.locator('#rangeEnd').dispatchEvent('change');
    await page.locator('#checkExport').click();
    assert((await page.locator('#duration').innerText()).includes('1.00s'));
    await page.locator('#renderVideo').click();
    await page.waitForFunction(()=>document.querySelector('#renderResult video:not([hidden])')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const fail=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video:not([hidden])').count()===1,'Studio WASM render failed: '+fail);
    const download=page.waitForEvent('download',{timeout:15000});
    await page.locator('#renderResult a[download]').click();
    const got=await download,buf=fs.readFileSync(await got.path());
    assert(buf.length>1000,'Export is empty');
    assert(buf.subarray(4,8).toString('ascii')==='ftyp','Export does not look like MP4');
    await page.locator('#exportPreset').selectOption('messaging');
    await page.locator('#cropShape').evaluate(el=>{el.value='10';el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.locator('#backgroundMode').selectOption('blur');
    await page.locator('#renderVideo').click();
    await page.waitForFunction(()=>document.querySelector('#renderResult video:not([hidden])')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const modeStatus=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video:not([hidden])').count()===1,'Blurred crop FFmpeg render failed: '+modeStatus);
    await page.locator('#backgroundMode').selectOption('letterbox');
    await page.locator('#audioInput').setInputFiles({name:'tone.wav',mimeType:'audio/wav',buffer:toneWav()});
    await page.locator('#audioTracks fieldset').waitFor({state:'visible'});
    await page.locator('#renderVideo').click();
    await page.waitForFunction(()=>document.querySelector('#renderResult video:not([hidden])')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const mixStatus=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video:not([hidden])').count()===1,'FFmpeg audio mixing failed: '+mixStatus);
    await page.locator('#textContent').fill('DEXCUT Studio Test');
    await page.locator('#textStart').fill('0');
    await page.locator('#textEnd').fill('0.8');
    await page.locator('#addTitle').click();
    assert.equal(await page.locator('#textTracks .clip').count(),1,'Timed title missing');
    await page.locator('#renderVideo').click();
    await page.waitForFunction(()=>document.querySelector('#renderResult video:not([hidden])')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const titleStatus=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video:not([hidden])').count()===1,'Timed title overlay export failed: '+titleStatus);
    await page.locator('#audioInput').setInputFiles({name:'narration-test.wav',mimeType:'audio/wav',buffer:toneWav()});
    await page.waitForFunction(()=>document.querySelectorAll('#audioTracks fieldset').length===2);
    await page.locator('#audioTracks fieldset').first().locator('input[type="checkbox"]').check();
    const gainCanvas=page.locator('#audioTracks fieldset').first().locator('canvas');
    await gainCanvas.scrollIntoViewIfNeeded();
    await gainCanvas.click({position:{x:20,y:35}});
    assert(await page.evaluate(()=>window.DexCutStudioControl.project().audio[0].points.length)>=1,'Gain point not recorded');
    await page.locator('#renderVideo').click();
    await page.waitForFunction(()=>document.querySelector('#renderResult video:not([hidden])')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const duckStatus=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video:not([hidden])').count()===1,'Gain/ducking FFmpeg render failed: '+duckStatus);
    assert.equal(errors.length,0,JSON.stringify(errors));
    console.log(JSON.stringify({result:'PASS',studioExportBytes:buf.length,hasMp4Header:true,blurredCrop:true,audioMix:true,timedTitle:true,audioDucking:true,pageErrors:errors.length}));
  }finally{await browser?.close();server.close();}
})().catch(err=>{console.error('STUDIO_WASM_FAIL',err.stack||err);server.close();process.exitCode=1;});
