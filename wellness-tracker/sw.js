const ROOT = new URL('./', self.location.href);
const PREFIX='wellness-pwa-'+encodeURIComponent(ROOT.pathname)+'-';
const CACHE = PREFIX+'bc36261262f0d31b';
const FILES = ['./', './index.html', './config.js', './pwa.js', './session-import.js', './manifest.webmanifest', './vendor/chart.umd.js', './vendor/supabase.js', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
const URLS = new Set(FILES.map(path => new URL(path, ROOT).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(new URL(path, ROOT), {cache: 'reload'})))));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  // Never intercept cloud API calls or cache personal records.
  const isOCR=request.url.startsWith(new URL('./vendor/ocr/',ROOT).href);
  if (request.method !== 'GET' || (!URLS.has(request.url)&&!isOCR)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      return (await cache.match('./index.html')) || fetch(request);
    }
    const hit=await cache.match(request);if(hit)return hit;const response=await fetch(request);if(isOCR&&response.ok)await cache.put(request,response.clone());return response;
  })());
});
