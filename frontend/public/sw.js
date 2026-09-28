const CACHE_NAME = 'cielito-home-v2';

const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.png',
  '/manifest.json'
];

self.addEventListener('install', event => {
  // Forzar que el nuevo SW tome el control inmediatamente
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  // Convertirse en controlador activo de todos los clientes
  event.waitUntil(self.clients.claim());
  
  // Limpiar cachés viejos (v1)
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar peticiones a la API ni de otros orígenes
  if (event.request.method !== 'GET' ||
      url.pathname.startsWith('/api') ||
      url.origin !== self.location.origin) {
    return;
  }

  // Estrategia Network-First para la navegación (HTML)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Estrategia Stale-While-Revalidate para recursos estáticos
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
      .catch(() => {
        return new Response('Offline', { status: 503 });
      })
  );
});
