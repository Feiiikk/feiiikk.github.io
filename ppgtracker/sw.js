const CACHE='study-tracker-v8';
const ROOT=new URL('./',self.location.href);
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png','./config.js','./sync.js','./vendor/supabase.js'];
const ASSETS=new Set(SHELL.map(path=>new URL(path,ROOT).href));
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(path=>new Request(new URL(path,ROOT),{cache:'reload'})))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('study-tracker-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const {request}=event;
  if(request.method!=='GET'||(!ASSETS.has(request.url)&&!(request.mode==='navigate'&&request.url.startsWith(ROOT.href)))) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(request);
      if(response.ok&&ASSETS.has(request.url)) await cache.put(request,response.clone());
      return response;
    } catch(error) {
      return (await cache.match(request))||(request.mode==='navigate'&&await cache.match('./index.html'))||Response.error();
    }
  })());
});
