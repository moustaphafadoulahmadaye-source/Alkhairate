const CACHE_NAME = 'eaepcg-pwa-v7';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/css/style.css',
  '/assets/css/style.css?v=7',
  '/assets/css/pwa.css',
  '/assets/css/pwa.css?v=7',
  '/assets/js/api.js',
  '/assets/js/api.js?v=7',
  '/assets/js/components.js',
  '/assets/js/components.js?v=7',
  '/assets/js/pwa.js',
  '/assets/js/pwa.js?v=7',
  '/assets/js/pages/offline.js',
  '/assets/img/logo.jpg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/favicon-32.png',
  '/assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // NEVER cache non-GET requests
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // Only handle HTTP and HTTPS schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // NEVER cache: anything under /api/, /assets/uploads/, /assets/avatars/, or admin.html
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/assets/uploads/') ||
    url.pathname.startsWith('/assets/avatars/') ||
    url.pathname === '/admin.html' ||
    url.pathname.endsWith('/admin.html')
  ) {
    return;
  }

  // 1. Page Navigations: Network first, then cache, then /offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const pathname = url.pathname;
            // Do not cache the catch-all index.html fallback for URLs that are not real pages
            const isRealPage = pathname === '/' || pathname.endsWith('.html');
            if (isRealPage && pathname !== '/admin.html') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(req, responseToCache);
              });
            }
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(req);
          if (cachedResponse) {
            return cachedResponse;
          }
          const offlinePage = await caches.match('/offline.html');
          return offlinePage || Response.error();
        })
    );
    return;
  }

  // 2. Static Assets (CSS, JS, Fonts, Images): Stale-While-Revalidate
  const isStaticAsset = (
    url.pathname.match(/\.(css|js|woff2?|ttf|eot|png|jpe?g|gif|svg|webp|ico|webmanifest)$/i) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (!cachedResponse) {
          return caches.match(req, { ignoreSearch: true }).then((fallbackResponse) => {
            const fetchPromise = fetch(req)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  const responseToCache = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => {
                    cache.put(req, responseToCache);
                  });
                }
                return networkResponse;
              })
              .catch(() => fallbackResponse);

            return fallbackResponse || fetchPromise;
          });
        }

        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(req, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
