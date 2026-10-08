'use strict';
const {chromium}=require(process.env.DEXCUT_PLAYWRIGHT||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixtures=[
 ['assets/dexcut-atlas-v2.webp',1254,1254,345520,'19d9ecb26aa641e262453ccb77696e51de5727ff'],
 ['assets/dexcut-poster-v2.webp',1731,909,377164,'5851e3274b4ced38cf031dac8c24476d1a85b25d'],
 ['assets/dexcut-wordmark-v2.webp',2172,724,228228,'8980c1dbf42d45dccb7483a5d58877de8cda6b35'],
 ['icon-192-v2.png',192,192,70625,'5181ae5aff109f275744c907cf37c6f2b0004354'],
 ['icon-512-v2.png',512,512,423771,'ec8656d9755a3b4e85b5943651edaa09ec07ed56'],
 ['icon-maskable-512-v2.png',512,512,284547,'b1c82aca023150acf48dd4a8ddd12543aaa85bf9'],
 ['apple-touch-icon-v2.png',180,180,62772,'bdf2cddad452d6e27c185527cd022703ce61df43'],
 ['favicon-64-v2.png',64,64,9828,'84e61e9c13a78cf4714a386c4411a0f7f84dc64f'],
 ['assets/source/dexcut-expression-master.png',1254,1254,1426439,'a07674290c6ae20ca4a68a75820d5f187a88d89b'],
 ['assets/source/dexcut-poster-master.png',1731,909,2050395,'970b53066ea539a6462332786cc6187a7e134343'],
 ['assets/source/dexcut-wordmark-master.png',2172,724,1141948,'8013a65e26c6779cbcf7e7163dfc7331fd22fb58'],
 ['assets/source/dexcut-app-icon-master.png',1254,1254,2339800,'77d6f171e70e62b2aa1f71ed51dcea2c034dc385']
];
const gitBlob=(data)=>crypto.createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
for(const [name,w,h,size,sha] of fixtures){
 const buf=fs.readFileSync(path.join(root,name));
 assert.equal(buf.length,size,'Size drift '+name);
 assert.equal(gitBlob(buf),sha,'Source bytes changed '+name);
}
const css=fs.readFileSync(path.join(root,'dexcut.css'),'utf8'),
 sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),
 html=fs.readFileSync(path.join(root,'index.html'),'utf8'),
 manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert(css.includes('background-size:200% 200%'),'Retina quad sprite mapping lost');
assert(css.includes('dexcut-atlas-v2.webp'),'High-res atlas not applied');
assert(css.includes('icon-192-v2.png'),'Header icon still sourced from low-res sprite');
assert(!css.includes('dexcut-atlas.avif'),'Tiny legacy atlas still in use');
assert(!sw.includes('dexcut-atlas.avif'),'Tiny legacy atlas cached');
assert(sw.includes("const APP='dexcut-app-v2';"),'Cache revision not bumped');
for(const src of ['assets/dexcut-atlas-v2.webp','assets/dexcut-poster-v2.webp','assets/dexcut-wordmark-v2.webp',
 'icon-192-v2.png','icon-512-v2.png','icon-maskable-512-v2.png','apple-touch-icon-v2.png','favicon-64-v2.png']){
 assert(sw.includes('./'+src),'Offline shell missing '+src);
}
assert(html.includes('dexcut-wordmark-v2.webp'),'Wordmark not mounted');
assert(manifest.icons.every(i=>i.src.includes('-v2.png')),'Manifest is showing old icons');
const ext={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4'};
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost');
 const p=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!p.startsWith(root+path.sep)){response.writeHead(403);response.end();return}
 fs.readFile(p,(err,data)=>{
  if(err){response.writeHead(404);response.end('Not Found');return}
  response.writeHead(200,{'Content-Type':ext[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});
  response.end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;const views=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.DEXCUT_BROWSER||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',args:['--no-sandbox']});
  const base='http://127.0.0.1:'+server.address().port;
  for(const [label,width,height] of [['small',320,720],['android',390,844],['tablet',768,1024],['desktop',1440,900]]){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',err=>errors.push(err.message));
   page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
   await page.goto(base,{waitUntil:'load',timeout:20000});
   const measurements=await page.evaluate(async()=> {
    const sources=['assets/dexcut-atlas-v2.webp','assets/dexcut-poster-v2.webp','assets/dexcut-wordmark-v2.webp','icon-192-v2.png','icon-512-v2.png','icon-maskable-512-v2.png','apple-touch-icon-v2.png','favicon-64-v2.png'];
    const images={};
    for(const src of sources){
     const img=new Image();img.src=src;await img.decode();
     images[src]=[img.naturalWidth,img.naturalHeight];
    }
    const hero=document.querySelector('#dexMascot'),avatar=document.querySelector('.brandIcon'),
      footer=document.querySelector('.footerWordmark'),
      heroRect=hero.getBoundingClientRect(),
      headerRect=avatar.getBoundingClientRect();
    return {images,
      hero:{width:heroRect.width,height:heroRect.height,background:getComputedStyle(hero).backgroundImage,backgroundSize:getComputedStyle(hero).backgroundSize,position:getComputedStyle(hero).backgroundPosition},
      icon:{width:headerRect.width,height:headerRect.height,background:getComputedStyle(avatar).backgroundImage},
      footer:{display:getComputedStyle(footer).display,src:footer.currentSrc},
      shellWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,
      tools:document.querySelectorAll('#jobs .job').length};
   });
   for(const [src,w,h] of fixtures.filter(i=>!i[0].includes('/source/'))){
    assert.deepEqual(measurements.images[src],[w,h],src+' did not decode natively');
   }
   assert.equal(measurements.tools,30,label+' lost tool definitions');
   assert(measurements.shellWidth<=measurements.viewportWidth,label+' overflow');
   assert(measurements.hero.width>85&&measurements.hero.height>85,label+' hidden hero');
   assert(measurements.hero.background.includes('dexcut-atlas-v2.webp'),label+' hero still tiny atlas');
   assert.equal(measurements.hero.backgroundSize,'200% 200%',label+' sprite mapping');
   assert(measurements.icon.background.includes('icon-192-v2.png'),label+' old avatar used');
   assert(627/measurements.hero.width>=2,label+' sprite upscaled beyond 2x support');
   assert.equal(errors.length,0,label+' browser errors: '+errors.join(' | '));
   if(label==='android'){
    await page.screenshot({path:'/tmp/dexcut-hq-android.png',fullPage:true});
    await page.locator('#fileInput').setInputFiles(path.join(root,'qa-sample.mp4'));
    await page.locator('.job[data-job="mute"]').click();
    const sheet=page.locator('#toolDialog');
    assert(await sheet.evaluate(e=>e.open),'Tool dialog failed to open');
   }
   views.push({label,...measurements});
   await context.close();
  }
  const output={result:'PASS',files:fixtures.length,viewports:views,retainedToolCount:30};
  fs.writeFileSync('/tmp/dexcut-artwork-qa.json',JSON.stringify(output,null,2));
  console.log(JSON.stringify({result:'PASS',fileHashFixtures:fixtures.length,viewports:views.map(v=>({label:v.label,spriteCellWidth:627,displayedWidth:v.hero.width,sourcePixelsPerDisplayPixel:+(627/v.hero.width).toFixed(2),toolCount:v.tools,renderedIcon:v.icon.background.includes('icon-192-v2.png')}))},null,2));
 }finally{if(browser)await browser.close();server.close();}
})().catch(err=>{console.error('HQ_ARTWORK_QA_FAILED',err.stack||err);server.close();process.exitCode=1});
