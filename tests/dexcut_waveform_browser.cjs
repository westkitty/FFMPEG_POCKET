'use strict';
const { chromium } = require(process.env.DEXCUT_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.json':'application/json','.mp4':'video/mp4','.wav':'audio/wav'};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!target.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.readFile(target, (error, bytes) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store'});
    response.end(bytes);
  });
});
function toneWav(duration=4, hz=320) {
  const sampleRate=22050, count=Math.round(sampleRate*duration);
  const buffer=Buffer.alloc(44+count*2), data=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  buffer.write('RIFF',0);data.setUint32(4,36+count*2,true);
  buffer.write('WAVEfmt ',8);data.setUint32(16,16,true);
  data.setUint16(20,1,true);data.setUint16(22,1,true);
  data.setUint32(24,sampleRate,true);data.setUint32(28,sampleRate*2,true);
  data.setUint16(32,2,true);data.setUint16(34,16,true);
  buffer.write('data',36);data.setUint32(40,count*2,true);
  for(let i=0;i<count;i++) {
    const fade=Math.min(1,i/(sampleRate*.05),(count-i)/(sampleRate*.05));
    data.setInt16(44+i*2,Math.round(Math.sin(2*Math.PI*i*hz/sampleRate)*12500*Math.max(0,fade)),true);
  }
  return buffer;
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/';
  let browser=null;
  try {
    browser=await chromium.launch({
      headless:true, executablePath:process.env.DEXCUT_BROWSER || undefined,
      args:['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required']
    });
    const results=[];
    for(const size of [{width:320,height:700},{width:390,height:844},{width:768,height:1024}]) {
      const context=await browser.newContext({viewport:size,reducedMotion:'reduce'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{
        if(response.url().startsWith(url)&&response.status()>=400) errors.push('HTTP '+response.status()+' '+response.url());
      });
      await page.goto(url,{waitUntil:'load'});
      assert.equal(await page.locator('#jobs .job').count(),30);
      assert.equal(await page.evaluate(()=>typeof window.DexCutWaveform),'object');
      await page.locator('#fileInput').setInputFiles({name:'tone.wav',mimeType:'audio/wav',buffer:toneWav()});
      await page.locator('#sourceTimeline .dc-wave-track').waitFor({state:'visible'});
      await page.waitForFunction(()=>document.querySelector('#sourceTimeline .dc-wave-status')?.textContent==='Decoded waveform',{timeout:12000});
      const signal=await page.evaluate(()=>{
        const node=document.querySelector('#sourceTimeline canvas'),ctx=node.getContext('2d');
        const data=ctx.getImageData(0,0,node.width,node.height).data;
        let active=0;
        for(let i=0;i<data.length;i+=4)if(data[i+3]>80&&data[i+1]>75)active++;
        return active;
      });
      assert(signal>200,'Waveform peaks not rendered '+JSON.stringify(size));
      await page.locator('#jobs [data-job="clip"]').click();
      await page.locator('#toolTimeline .dc-wave-track').waitFor({state:'visible'});
      assert.equal(await page.locator('#toolTimeline .dc-handle').count(),2);
      const track=page.locator('#toolTimeline .dc-wave-track');
      await track.scrollIntoViewIfNeeded();
      const rect=await track.boundingBox();
      assert(rect&&rect.width>=150);
      await page.evaluate(() => { window.__dcWavePointer = []; ['pointerdown','pointermove','pointerup'].forEach(type => document.addEventListener(type,e => { if(window.__dcWavePointer.length<32) window.__dcWavePointer.push({type,target:e.target?.className?.toString()?.slice(0,100)||e.target?.tagName,x:e.clientX,y:e.clientY}); }, true)); });
      const before = await page.evaluate(() => ({duration:document.querySelector('#toolTimeline .dc-wave-total')?.textContent,point:document.elementFromPoint(...(() => {const r=document.querySelector('#toolTimeline .dc-wave-track').getBoundingClientRect();return [r.left+r.width*.25,r.top+8]})())?.className?.toString(),track:getComputedStyle(document.querySelector('#toolTimeline .dc-wave-track')).pointerEvents}));
      await page.mouse.move(rect.x+rect.width*.25,rect.y+8);
      await page.mouse.down();
      await page.mouse.move(rect.x+rect.width*.75,rect.y+8,{steps:8});
      await page.mouse.up();
      const start=Number(await page.locator('#fields [data-key="start"]').inputValue());
      const length=Number(await page.locator('#fields [data-key="length"]').inputValue());
      if(!(start>0.8&&start<1.2)) console.error('WAVEFORM_DRAG_DEBUG',JSON.stringify({before,rect,start,length,pointers:await page.evaluate(()=>window.__dcWavePointer)}));
      assert(start>0.8&&start<1.2,'Dragged IN did not update time field: '+start);
      assert(length>1.8&&length<2.2,'Dragged OUT did not update clip length: '+length);
      const inHandle=page.locator('#toolTimeline .dc-handle--start');
      await inHandle.focus();await inHandle.press('ArrowRight');
      assert(Number(await page.locator('#fields [data-key="start"]').inputValue())>start,'Keyboard handle arrow did not update value');
      await page.locator('#fields [data-key="start"]').fill('0.5');
      const readout=await page.locator('#toolTimeline .dc-wave-start').innerText();
      assert(readout.includes('0:00.5'),'Numeric field did not synchronize waveform: '+readout);
      await page.locator('#sheetClose').click();
      assert.equal(await page.locator('#toolTimeline .dc-timeline').count(),0);
      await page.locator('#jobs [data-job="ending"]').click();
      assert.equal(await page.locator('#toolTimeline .dc-handle').count(),1);
      await page.locator('#fields [data-key="seconds"]').fill('2');
      const inPoint=await page.locator('#toolTimeline .dc-wave-start').innerText();
      assert(inPoint.includes('0:02.0'),'Keep-ending did not move IN point: '+inPoint);
      await page.locator('#sheetClose').click();
      const overflow=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      assert(overflow.doc<=size.width&&overflow.body<=size.width,'Horizontal overflow '+JSON.stringify({size,overflow}));
      assert.deepEqual(errors,[],'Browser exceptions or resource failures '+JSON.stringify(size));
      results.push({size,signal,start,length,keyboard:'PASS',sync:'PASS',overflow:'PASS'});
      await context.close();
    }
    console.log(JSON.stringify({result:'PASS',browsers:results.length,media:'PCM WAV',results},null,2));
  } finally {
    await browser?.close();server.close();
  }
})().catch(error=>{console.error('WAVEFORM_BROWSER_QA_FAIL',error.stack||error);server.close();process.exitCode=1;});
