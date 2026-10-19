'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.wasm':'application/wasm'};
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
    await page.waitForFunction(()=>document.querySelector('#renderResult video')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const fail=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video').count()===1,'Studio WASM render failed: '+fail);
    const download=page.waitForEvent('download',{timeout:15000});
    await page.locator('#renderResult a[download]').click();
    const got=await download,buf=fs.readFileSync(await got.path());
    assert(buf.length>1000,'Export is empty');
    assert(buf.subarray(4,8).toString('ascii')==='ftyp','Export does not look like MP4');
    await page.locator('#exportPreset').selectOption('messaging');
    await page.locator('#cropShape').evaluate(el=>{el.value='10';el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.locator('#backgroundMode').selectOption('blur');
    await page.locator('#renderVideo').click();
    await page.waitForFunction(()=>document.querySelector('#renderResult video')||document.querySelector('#status')?.textContent.startsWith('Render failed:'),null,{timeout:240000});
    const modeStatus=await page.locator('#status').innerText();
    assert(await page.locator('#renderResult video').count()===1,'Blurred crop FFmpeg render failed: '+modeStatus);
    assert.equal(errors.length,0,JSON.stringify(errors));
    console.log(JSON.stringify({result:'PASS',studioExportBytes:buf.length,hasMp4Header:true,blurredCrop:true,pageErrors:errors.length}));
  }finally{await browser?.close();server.close();}
})().catch(err=>{console.error('STUDIO_WASM_FAIL',err.stack||err);server.close();process.exitCode=1;});
