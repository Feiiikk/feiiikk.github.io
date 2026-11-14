const CACHE = 'wellness-pwa-4327a3690827591e';
const ROOT = new URL('./', self.location.href);
const FILES = ['./', './index.html', './config.js', './pwa.js', './manifest.webmanifest', './vendor/chart.umd.js', './vendor/supabase.js', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
const URLS = new Set(FILES.map(path => new URL(path, ROOT).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(new URL(path, ROOT), {cache: 'reload'})))));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('wellness-pwa-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  // Never intercept cloud API calls or cache personal records.
  if (request.method !== 'GET' || !URLS.has(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      return (await cache.match('./index.html')) || fetch(request);
    }
    return (await cache.match(request)) || fetch(request);
  })());
});
