'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const AxeBuilder=require(process.env.DEXCUT_AXE||'@axe-core/playwright').default;
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{const pathpart=new URL(req.url,'http://localhost').pathname;const dest=path.resolve(root,'.'+(pathpart==='/'?'/index.html':pathpart));if(!dest.startsWith(root+path.sep)){res.writeHead(403);res.end();return}fs.readFile(dest,(e,b)=>{if(e){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':mime[path.extname(dest)]||'application/octet-stream'});res.end(b)})});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;const records=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await context.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'load'});
  for(const phase of ['landing','tool-dialog','verify-dialog','install-dialog']){
   if(phase==='tool-dialog'){
    await page.locator('#fileInput').setInputFiles(path.join(root,'qa-sample.mp4'));
    await page.locator('#fileCard').waitFor({state:'visible'});
    await page.locator('.job[data-job="clip"]').click();
   }
   if(phase==='verify-dialog'){await page.locator('#sheetClose').click();await page.locator('#verifyOpen').click()}
   if(phase==='install-dialog'){await page.locator('#verifyClose').click();await page.locator('#installBtn').click()}
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
   const violations=result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({selector:n.target,summary:n.failureSummary})).slice(0,12)}));
   records.push({phase,violations});
  }
  const total=records.reduce((a,r)=>a+r.violations.length,0);
  fs.writeFileSync('/tmp/dexcut-axe.json',JSON.stringify({records},null,2));
  console.log(JSON.stringify({violationsTotal:total,phases:records.map(r=>({phase:r.phase,violations:r.violations}))},null,2));
  if(total>0)process.exitCode=1;
 }finally{if(browser)await browser.close();server.close()}
})().catch(e=>{console.error('AXE_FAILED',e.stack||e);server.close();process.exitCode=1});
