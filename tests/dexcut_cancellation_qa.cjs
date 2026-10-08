'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;const p=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(p,(err,buf)=>{if(err){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(buf)});
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;const records=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox']});
  for(const mode of ['wait-for-stale','immediate-rerun']){
   const context=await browser.newContext({viewport:{width:390,height:844}});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/ffmpeg-core.js',async route=>{await new Promise(r=>setTimeout(r,2500));try{await route.continue()}catch(_){}});
   await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
   await page.locator('#fileInput').setInputFiles(path.join(root,'qa-sample.mp4'));
   await page.locator('#fileCard').waitFor({state:'visible'});
   await page.locator('.job[data-job="mute"]').click();
   await page.locator('#sheetRun').click();
   await page.locator('#processPane').waitFor({state:'visible'});
   await page.locator('#cancelRun').click();
   assert(await page.locator('#processPane').isHidden(),'cancel did not leave process pane');
   assert(await page.locator('#configPane').isVisible(),'cancel did not restore options');
   if(mode==='wait-for-stale'){
    await page.waitForTimeout(3900);
    const state={processHidden:await page.locator('#processPane').isHidden(),configVisible:await page.locator('#configPane').isVisible(),resultHidden:await page.locator('#sheetResult').isHidden(),mood:await page.locator('body').getAttribute('data-dex-mood')};
    records.push({mode,state,errors});
    assert(state.resultHidden,'A stale error/result appeared after cancel '+JSON.stringify(state));
   }else{
    await page.locator('#sheetRun').click();
    await page.locator('#sheetResult').waitFor({state:'visible',timeout:80000});
    const state={errorHidden:await page.locator('#errorBox').isHidden(),resultTitle:await page.locator('#sheetResultTitle').innerText(),mood:await page.locator('body').getAttribute('data-dex-mood')};
    records.push({mode,state,errors});
    assert(state.errorHidden,'Rerun was replaced by an error '+JSON.stringify(state));
   }
   assert.equal(errors.length,0,'JS errors');
   await context.close();
  }
  console.log(JSON.stringify({result:'PASS',records},null,2));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error('CANCEL_QA_FAIL',e.stack||e);server.close();process.exitCode=1});
