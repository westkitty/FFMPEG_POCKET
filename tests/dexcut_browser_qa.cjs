'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer((request,response)=>{
  const raw=new URL(request.url,'http://127.0.0.1');
  const relative=decodeURIComponent(raw.pathname)==='/'?'/index.html':decodeURIComponent(raw.pathname);
  const filename=path.resolve(root,'.'+relative);
  if(!filename.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
  fs.readFile(filename,(error,data)=>{
    if(error){response.writeHead(404);response.end('not found');return}
    response.writeHead(200,{'Content-Type':mime[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});response.end(data);
  });
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port+'/';
 let browser;const results=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox','--disable-gpu','--no-default-browser-check']});
  for(const [label,width,height] of [['smallphone',320,700],['phone',390,844],['tablet',768,1024],['desktop',1440,900]]){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   const page=await context.newPage();
   const problems=[];
   page.on('pageerror',e=>problems.push('JS '+e.message));
   page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)problems.push('HTTP '+r.status()+' '+r.url())});
   const start=Date.now();
   await page.goto(origin,{waitUntil:'load',timeout:15000});
   await page.waitForSelector('#jobs .job',{timeout:12000});
   const initial=await page.evaluate(()=>{
    const a=performance.getEntriesByType('navigation')[0],rs=performance.getEntriesByType('resource');
    const rect=document.querySelector('#dexMascot').getBoundingClientRect();
    return {title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScroll:document.body.scrollWidth,toolCount:document.querySelectorAll('#jobs .job').length,css:getComputedStyle(document.body).getPropertyValue('--red').trim(),dexVisible:rect.width>50&&rect.height>50,hero:document.querySelector('h1').textContent,loadMs:Math.round(a.loadEventEnd-a.startTime),domMs:Math.round(a.domContentLoadedEventEnd-a.startTime),resourceCount:rs.length,transferBytes:rs.reduce((n,x)=>n+(x.transferSize||0),0)};
   });
   assert(initial.scrollWidth<=width,'Horizontal overflow: '+label+' '+initial.scrollWidth+' > '+width);
   assert(initial.bodyScroll<=width,'Body horizontal overflow '+label);
   assert(initial.dexVisible,'Dexter not visible '+label);
   assert(initial.toolCount===30,'Initial inventory is not 30: '+label);
   assert(initial.css==='#e33434','Brand CSS not loaded: '+label);
   await page.locator('#toolSearch').fill('pixelate');
   assert.equal(await page.locator('#jobs .job').count(),1,'Search pixelate '+label);
   await page.locator('#toolSearch').fill('');
   assert.equal(await page.locator('#jobs .job').count(),30,'Search clearing '+label);
   await page.locator('#verifyOpen').click();
   assert(await page.locator('#verifyDialog').evaluate(e=>e.open),'Verifier modal '+label);
   assert(await page.locator('#verifyRun').isEnabled(),'Verifier run not enabled '+label);
   await page.locator('#verifyClose').click();
   await page.locator('#installBtn').click();
   assert(await page.locator('#installDialog').evaluate(e=>e.open),'Install modal '+label);
   await page.locator('#installClose').click();
   await page.locator('#fileInput').setInputFiles(path.join(root,'qa-sample.mp4'));
   await page.locator('#fileCard').waitFor({state:'visible'});
   assert((await page.locator('#fileName').innerText()).includes('qa-sample.mp4'),'Upload filename '+label);
   await page.locator('#jobs .job[data-job="clip"]').click();
   assert(await page.locator('#toolDialog').evaluate(e=>e.open),'Tool dialog '+label);
   assert(await page.locator('#sheetRun').isEnabled(),'Tool Run disabled '+label);
   assert(await page.locator('#fields input').count()>0,'Tool fields missing '+label);
   await page.locator('#sheetClose').click();
   assert(!(await page.locator('#toolDialog').evaluate(e=>e.open)),'Tool dialog did not close '+label);
   await page.locator('#verifyOpen').click();
   await page.locator('#verifyClose').click();
   if(label==='phone')await page.screenshot({path:'/tmp/dexcut-phone-ui.png',fullPage:true,timeout:10000});
   const record={label,initial,interactionMs:Date.now()-start,problems};
   assert.equal(problems.length,0,JSON.stringify(record));
   results.push(record);await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(origin+'?verify=1',{waitUntil:'load'});
  assert(await page.locator('#verifyDialog').evaluate(e=>e.open),'?verify=1 deep link broken');
  await context.close();
  const output={result:'PASS',cases:results.length,deepLink:'PASS',results};
  fs.writeFileSync('/tmp/dexcut-browser-qa.json',JSON.stringify(output,null,2));
  console.log(JSON.stringify(output,null,2));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error('BROWSER_QA_FAIL',e.stack||e);server.close();process.exitCode=1});
