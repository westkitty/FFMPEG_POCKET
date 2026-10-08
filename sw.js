const APP='ffmpeg-pocket-app-v3';
const CORE='ffmpeg-pocket-core-v1';
const SHELL=['./','./index.html','./manifest.json','./icon.svg'];
const CORE_PATH='/npm/@ffmpeg/core@0.12.10/dist/umd/';

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(APP)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys
          .filter(key=>key.startsWith('ffmpeg-pocket-app-')&&key!==APP)
          .map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);

  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes(CORE_PATH)){
    event.respondWith(
      caches.open(CORE).then(async cache=>{
        const hit=await cache.match(event.request);
        if(hit)return hit;
        const response=await fetch(event.request);
        if(response.ok)await cache.put(event.request,response.clone());
        return response;
      })
    );
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(APP).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(async()=>{
          const hit=await caches.match(event.request);
          return hit||caches.match('./index.html');
        })
    );
  }
});
