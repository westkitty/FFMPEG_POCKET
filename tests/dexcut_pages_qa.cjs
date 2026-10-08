'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const target='https://westkitty.github.io/FFMPEG_POCKET/';
const root=path.resolve(__dirname,'..');
(async()=>{
 let browser;const faults=[];const started=Date.now();
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,serviceWorkers:'allow',permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  page.on('pageerror',e=>faults.push('JS '+e.message));
  page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('net::ERR_INTERNET_DISCONNECTED'))faults.push('CONSOLE '+e.text())});
  await page.goto(target+'?verify=1',{waitUntil:'load',timeout:45000});
  await page.locator('#jobs .job').first().waitFor({state:'visible',timeout:20000});
  assert((await page.title()).startsWith('DEX//CUT'),'Pages served stale HTML');
  assert.equal(await page.locator('#jobs .job').count(),30,'Pages tool list incomplete');
  assert(await page.locator('#verifyDialog').evaluate(e=>e.open),'Pages verifier deep link failed');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  if(!(await page.evaluate(()=>!!navigator.serviceWorker.controller))){
   await page.reload({waitUntil:'load',timeout:35000});
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:20000});
  }
  const controlBefore=await page.evaluate(async()=>({controlled:!!navigator.serviceWorker.controller,caches:await caches.keys()}));
  assert(controlBefore.controlled,'PWA not controlled by SW on Pages');
  await page.locator('#verifyRun').click();
  await page.waitForFunction(()=>/passed on this device|Device test stopped:|Device test cancelled/.test(document.querySelector('#verifyStatus')?.textContent||''),null,{timeout:360000});
  const diagnostic=await page.locator('#verifyStatus').innerText();
  const counts=await page.locator('#verifyList .verifyEntry').evaluateAll(els=>({count:els.length,pass:els.filter(e=>e.lastElementChild?.textContent==='PASS').length}));
  assert.equal(counts.count,30);assert.equal(counts.pass,30,'Pages FFmpeg WASM failure: '+diagnostic);
  await page.locator('#verifyCopy').click();
  const report=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));
  assert.equal(report.product,'DEX//CUT');assert.equal(report.tests.length,30);
  const cacheInfo=await page.evaluate(async()=>{
   const shell=await caches.open('dexcut-app-v2');
   const core=await caches.open('ffmpeg-pocket-core-v1');
   const coreKeys=(await core.keys()).map(x=>x.url);
   return {cacheNames:await caches.keys(),shellCount:(await shell.keys()).length,coreKeys};
  });
  assert(cacheInfo.coreKeys.some(x=>x.endsWith('ffmpeg-core.js')),'Missing offline JS core');
  assert(cacheInfo.coreKeys.some(x=>x.endsWith('ffmpeg-core.wasm')),'Missing offline WASM core');
  await page.locator('#verifyClose').click();
  await context.setOffline(true);
  await page.reload({waitUntil:'load',timeout:40000});
  if(await page.locator('#verifyDialog').evaluate(e=>e.open))await page.locator('#verifyClose').click();
  assert((await page.title()).startsWith('DEX//CUT'),'Offline shell did not render');
  assert.equal(await page.locator('#jobs .job').count(),30,'Offline tool inventory');
  await page.locator('#fileInput').setInputFiles(path.join(root,'qa-sample.mp4'));
  await page.locator('#fileCard').waitFor({state:'visible'});
  await page.locator('.job[data-job="mute"]').click();
  const offlineStart=Date.now();
  await page.locator('#sheetRun').click();
  await page.locator('#sheetResult').waitFor({state:'visible',timeout:120000});
  assert(await page.locator('#errorBox').isHidden(),'Offline conversion failed');
  const video=page.locator('#sheetPreview video');
  await video.waitFor({state:'visible'});
  const decoded=await video.evaluate(async v=>{
   if(v.readyState<1)await new Promise((ok,bad)=>{v.addEventListener('loadedmetadata',ok,{once:true});v.addEventListener('error',bad,{once:true})});
   return {width:v.videoWidth,height:v.videoHeight,duration:v.duration};
  });
  assert(decoded.width>0&&decoded.height>0,'Offline output not decodable');
  const result={status:'PASS',pages:target,elapsedSeconds:Math.round((Date.now()-started)/1000),livePages:true,diagnostic,count:counts.count,passed:counts.pass,reportCopied:true,serviceWorker:controlBefore,cache:cacheInfo,offlineMute:{elapsedMs:Date.now()-offlineStart,decoded},faults};
  fs.writeFileSync('/tmp/dexcut-live-pages-qa.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,elapsedSeconds:result.elapsedSeconds,diagnostic,coreCached:cacheInfo.coreKeys.length,appShellCached:cacheInfo.shellCount,offlineMute:result.offlineMute,faults},null,2));
  if(faults.length)process.exitCode=1;
  await context.close();
 }finally{if(browser)await browser.close()}
})().catch(e=>{console.error('PAGES_QA_FAIL',e.stack||e);process.exitCode=1});
