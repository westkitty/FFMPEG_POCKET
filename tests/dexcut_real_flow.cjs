'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.avif':'image/avif','.webp':'image/webp','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');const pathname=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);const target=path.resolve(root,'.'+pathname);
 if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(target,(err,buf)=>{if(err){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(buf)});
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser,context,page;const records=[],issues=[];const started=Date.now();
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox']});
  context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  page=await context.newPage();
  page.on('pageerror',err=>issues.push(err.message));
  page.on('console',msg=>{if(msg.type()==='error')issues.push(msg.text())});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  await page.locator('#fileInput').setInputFiles(path.join(root,'qa-sample.mp4'));
  await page.locator('#fileCard').waitFor({state:'visible'});
  const filename=await page.locator('#fileName').innerText();
  assert.equal(filename,'qa-sample.mp4');
  await page.locator('.job[data-job="mute"]').click();
  assert(await page.locator('#sheetRun').isEnabled());
  const conversionStart=Date.now();
  await page.locator('#sheetRun').click();
  await page.locator('#sheetResult').waitFor({state:'visible',timeout:90000});
  assert(await page.locator('#errorBox').isHidden(),'Mute conversion showed error');
  const outputName=await page.locator('#sheetResultText').innerText();
  assert(outputName.includes('-muted.mp4'),'Unexpected mute output '+outputName);
  assert.equal(await page.locator('#sheetResultTimeline .dc-wave-track').count(),1,'Processed result missing waveform in tool sheet');
  assert.equal(await page.locator('#hubResultTimeline .dc-wave-track').count(),1,'Processed result missing waveform in result hub');
  const video=page.locator('#sheetPreview video');
  await video.waitFor({state:'visible'});
  const v=await video.evaluate(async el=>{
   if(el.readyState<1)await new Promise((ok,fail)=>{el.addEventListener('loadedmetadata',ok,{once:true});el.addEventListener('error',fail,{once:true})});
   return {width:el.videoWidth,height:el.videoHeight,duration:el.duration,readyState:el.readyState};
  });
  assert(v.width>0&&v.height>0&&v.duration>0,'Mute output did not decode');
  const dl=page.waitForEvent('download',{timeout:15000});
  await page.locator('#sheetResultActions [data-action="save"]').click();
  const downloaded=await dl;
  const dlpath=await downloaded.path();
  assert(fs.statSync(dlpath).size>0,'Output download was empty');
  records.push({step:'mute-to-video',elapsedMs:Date.now()-conversionStart,outputName,decoded:v,downloadBytes:fs.statSync(dlpath).size});
  await page.locator('#sheetResultActions [data-action="use-result"]').click();
  await page.waitForFunction(()=>document.querySelector('#fileName').textContent.includes('-muted.mp4'),null,{timeout:10000});
  records.push({step:'keep-editing',sourceFile:await page.locator('#fileName').innerText()});
  assert.equal(await page.locator('#sourceTimeline .dc-wave-track').count(),1,'Chained result did not restore source waveform');
  await page.locator('.job[data-job="picture"]').click();
  const pictureStart=Date.now();
  await page.locator('#sheetRun').click();
  await page.locator('#sheetResult').waitFor({state:'visible',timeout:90000});
  assert(await page.locator('#errorBox').isHidden(),'JPEG extraction showed error');
  const img=page.locator('#sheetPreview img');
  await img.waitFor({state:'visible'});
  const im=await img.evaluate(async e=>{
   if(!e.complete)await new Promise((ok,fail)=>{e.addEventListener('load',ok,{once:true});e.addEventListener('error',fail,{once:true})});
   return {width:e.naturalWidth,height:e.naturalHeight,complete:e.complete};
  });
  assert(im.width>0&&im.height>0,'JPEG not decoded');
  records.push({step:'jpeg-inline-preview',elapsedMs:Date.now()-pictureStart,decoded:im});
  await page.screenshot({path:'/tmp/dexcut-real-flow.png',fullPage:true});
  assert.deepEqual(issues,[]);
  const result={result:'PASS',elapsedSeconds:Math.round((Date.now()-started)/1000),records,issues};
  fs.writeFileSync('/tmp/dexcut-real-flow.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error('REAL_FLOW_FAILED',e.stack||e);server.close();process.exitCode=1});
