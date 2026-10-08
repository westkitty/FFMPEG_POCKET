'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer((request,response)=>{
 const u=new URL(request.url,'http://localhost');
 const p=u.pathname==='/'?'/index.html':decodeURIComponent(u.pathname);
 const full=path.resolve(root,'.'+p);
 if(!full.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
 fs.readFile(full,(err,buf)=>{
  if(err){response.writeHead(404);response.end('Not Found');return}
  response.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});response.end(buf);
 });
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser,context,page,timer;
 const issues=[],started=Date.now();
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox','--no-default-browser-check']});
  context=await browser.newContext({viewport:{width:390,height:844},permissions:['clipboard-read','clipboard-write']});
  page=await context.newPage();
  page.on('pageerror',e=>issues.push('JS: '+e.message));
  page.on('console',e=>{if(e.type()==='error')issues.push('CONSOLE: '+e.text())});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/?verify=1',{waitUntil:'load',timeout:15000});
  assert(await page.locator('#verifyDialog').evaluate(e=>e.open),'verification dialog missing');
  await page.locator('#verifyRun').click();
  const updates=[];
  let last='';
  timer=setInterval(async()=>{
   if(!page||page.isClosed())return;
   try{
    const msg=await page.locator('#verifyStatus').innerText({timeout:2500});
    if(msg!==last){last=msg;updates.push({elapsedSeconds:Math.round((Date.now()-started)/1000),message:msg});console.log('PROGRESS',Math.round((Date.now()-started)/1000),msg)}
   }catch(_){}
  },3000);
  await page.waitForFunction(()=>{
   const t=document.querySelector('#verifyStatus')?.textContent||'';
   return /passed on this device|Device test stopped:|Device test cancelled/.test(t);
  },null,{timeout:600000});
  clearInterval(timer);
  const final=await page.locator('#verifyStatus').innerText();
  const rows=await page.locator('#verifyList .verifyEntry').evaluateAll(els=>els.map(e=>({title:e.querySelector('span')?.textContent,status:e.lastElementChild?.textContent,detail:e.title})));
  const canCopy=await page.locator('#verifyCopy').isEnabled();
  let copied=null;
  if(canCopy){
   await page.locator('#verifyCopy').click();
   try{copied=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()))}catch(e){issues.push('COPY '+e.message)}
  }
  const record={result:rows.length===30&&rows.every(e=>e.status==='PASS')&&copied?.tests?.length===30?'PASS':'FAIL',elapsedSeconds:Math.round((Date.now()-started)/1000),final,tests:rows,reportCopied:!!copied,report:copied,updates,issues};
  fs.writeFileSync('/tmp/dexcut-wasm-qa.json',JSON.stringify(record,null,2));
  console.log('FINAL',JSON.stringify({result:record.result,elapsedSeconds:record.elapsedSeconds,final:record.final,count:rows.length,passed:rows.filter(x=>x.status==='PASS').length,failed:rows.filter(x=>x.status!=='PASS').length,reportCopied:record.reportCopied,issues},null,2));
  if(record.result!=='PASS')process.exitCode=1;
 }finally{clearInterval(timer);if(browser)await browser.close();server.close()}
})().catch(e=>{console.error('WASM_QA_FATAL',e.stack||e);server.close();process.exitCode=1});
