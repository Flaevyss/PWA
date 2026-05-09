const CACHE_NAME = 'schedule-v4';
const ASSETS = ['./', './index.html', './style.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => 
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
});

self.addEventListener('fetch', e => {
  //  Не кэшируем запросы к Google Apps Script и другим внешним API
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Остальное (HTML, CSS, JS, иконки) кэшируем
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});