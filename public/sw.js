const CACHE_VERSION = 'gymcrm-v1';
const APP_SHELL = ['/', '/dashboard', '/admin', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});
