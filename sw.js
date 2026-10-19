'use strict';
// Only app-shell files are cached. Study data remains in browser storage / JSON.
const VERSION = '3.0.0';
const PREFIX = 'nhip-hoc-shell:' + self.registration.scope + ':';
const CACHE = PREFIX + VERSION;
const FILES = ['index.html','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
const urls = FILES.map(path=>new URL(path,self.registration.scope).href);
const home = urls[0];
const allowed = new Set(urls);

self.addEventListener('install',event=>{
  // A failed install keeps the previous working offline version.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls)));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request, url=new URL(request.url);
  if(request.method!=='GET' || url.origin!==new URL(self.registration.scope).origin) return;
  const navigation=request.mode==='navigate' && (url.pathname===new URL(self.registration.scope).pathname || url.pathname===new URL(home).pathname);
  if(!navigation && !allowed.has(url.href)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const key=navigation?home:request.url;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch(request,{signal:controller.signal,cache:'no-cache'});
      if(response.ok && (!navigation || (response.headers.get('content-type')||'').includes('text/html'))){
        try{await cache.put(key,response.clone());}catch(_){}
        return response;
      }
      return await cache.match(key) || response;
    }catch(error){
      const fallback=await cache.match(key);
      if(fallback) return fallback;
      return new Response('Nhịp Học chưa tải xong bản ngoại tuyến. Hãy kết nối mạng và mở lại trang.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }finally{clearTimeout(timeout);}
  })());
});

