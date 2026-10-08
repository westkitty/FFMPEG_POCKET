const APP='ffmpeg-pocket-app-v2';
const CORE='ffmpeg-pocket-core-v1';
const SHELL=['./','./index.html','./manifest.json','./icon.svg'];
const CORE_PATH='/npm/@ffmpeg/core@0.12.10/dist/umd/';
self.addEventListener('install',event=>{event.waitUntil(caches.open(APP).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>![APP,CORE].includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes(CORE_PATH)){event.respondWith(caches.open(CORE).then(async c=>{const hit=await c.match(event.request);if(hit)return hit;const res=await fetch(event.request);if(res.ok)await c.put(event.request,res.clone());return res}));return}if(u.origin===self.location.origin){event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(res=>{const copy=res.clone();caches.open(APP).then(c=>c.put(event.request,copy));return res}).catch(()=>caches.match('./index.html'))))}});
