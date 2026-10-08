'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const newRoot=path.resolve(__dirname,'..'),oldRoot=path.resolve(process.env.DEXCUT_BASELINE_ROOT||path.join(newRoot,'..','FFMPEG_POCKET_BASELINE'));
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
function serve(root){const s=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const full=path.resolve(root,'.'+(name==='/'?'/index.html':decodeURIComponent(name)));if(!full.startsWith(root+path.sep)){res.writeHead(403);res.end();return}fs.readFile(full,(e,b)=>{if(e){res.writeHead(404);res.end();return}res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(b)})});return s}
const old=serve(oldRoot),current=serve(newRoot);
const median=a=>{const n=[...a].sort((x,y)=>x-y);return +(n[Math.floor(n.length/2)]).toFixed(1)};
const p95=a=>{const n=[...a].sort((x,y)=>x-y);return +(n[Math.min(n.length-1,Math.ceil(.95*n.length)-1)]).toFixed(1)};
(async()=>{
 await Promise.all([new Promise(ok=>old.listen(0,'127.0.0.1',ok)),new Promise(ok=>current.listen(0,'127.0.0.1',ok))]);
 let browser;const data={baseline:[],dexcut:[]},N=10;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox','--enable-precise-memory-info']});
  for(let i=0;i<N;i++){
   for(const [label,srv] of (i%2===0?[['baseline',old],['dexcut',current]]:[['dexcut',current],['baseline',old]])){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await context.newPage();
    const issues=[];page.on('pageerror',e=>issues.push(e.message));
    await page.goto('http://127.0.0.1:'+srv.address().port+'/?bench='+i,{waitUntil:'load'});
    await page.waitForSelector('#jobs .job');
    const item=await page.evaluate(()=>{
     const n=performance.getEntriesByType('navigation')[0];
     const resources=performance.getEntriesByType('resource');
     const paint=performance.getEntriesByType('paint');
     const search=document.querySelector('#toolSearch');const t0=performance.now();
     for(let j=0;j<100;j++){
      search.value=j%2===0?'audio':'';
      search.dispatchEvent(new Event('input',{bubbles:true}));
     }
     const searchMs=performance.now()-t0;
     const expected=document.querySelectorAll('#jobs .job').length;
     return {domMs:+n.domContentLoadedEventEnd.toFixed(1),loadMs:+n.loadEventEnd.toFixed(1),fcpMs:+(paint.find(x=>x.name==='first-contentful-paint')?.startTime||0).toFixed(1),search100Ms:+searchMs.toFixed(1),resources:resources.length,resourceTransfer:resources.reduce((a,b)=>a+b.transferSize,0),navTransfer:n.transferSize,toolCardsAfterSearch:expected,heapBytes:performance.memory?.usedJSHeapSize||null};
    });
    assert.equal(item.toolCardsAfterSearch,30,label+' search reset');
    assert.equal(issues.length,0,label+' JS errors '+JSON.stringify(issues));
    data[label].push(item);
    await context.close();
   }
  }
  const metrics=['domMs','loadMs','fcpMs','search100Ms','resourceTransfer','heapBytes'];
  const stats={};
  for(const [k,rows] of Object.entries(data)){
   stats[k]={runs:rows.length};
   for(const m of metrics){const values=rows.map(r=>r[m]).filter(Number.isFinite);stats[k][m]={median:median(values),p95:p95(values)}}
  }
  const files=['index.html','dexcut.css','assets/dexcut-atlas.avif','assets/dexcut-poster.webp','icon-192.png','icon-512.png','icon-maskable-512.png'];
  stats.staticBytes=Object.fromEntries(files.map(f=>[f,fs.statSync(path.join(newRoot,f)).size]));
  stats.baselineStaticBytes=fs.statSync(path.join(oldRoot,'index.html')).size;
  fs.writeFileSync('/tmp/dexcut-performance.json',JSON.stringify({stats,raw:data},null,2));
  console.log(JSON.stringify(stats,null,2));
 }finally{if(browser)await browser.close();old.close();current.close()}
})().catch(e=>{console.error('PERF_QA_ERROR',e.stack||e);old.close();current.close();process.exitCode=1});
