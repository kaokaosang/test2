self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('v1').then(cache => cache.addAll(['/']))
  );
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});
