const CACHE_NAME = 'dfwatch-v10';
const IMAGE_CACHE_NAME = 'dfwatch-images-v1';
const IMAGE_CORS_CACHE_NAME = 'dfwatch-images-cors-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './nlp_fr.json',
  './nlp_en.json',
  './app/css/style.css',
  './app/css/driver.css',
  './app/js/app.js',
  './app/js/db.js',
  './app/js/tmdb.js',
  './app/js/achievements.js',
  './app/js/import.js',
  './app/js/export.js',
  './app/js/i18n.js',
  './app/js/profile-card.js',
  './app/js/vendor/bigbrother.js',
  './app/js/vendor/bigbrother_nlp.js',
  './app/js/tutorial.js',
  './app/js/vendor/panoptic.js',
  './app/js/panoptic-ui.js',
  './app/js/vendor/papaparse.min.js',
  './app/js/vendor/dexie.js',
  './app/js/vendor/driver.js.iife.js',
  './app/js/vendor/html2canvas.min.js'
];

const OPTIONAL_EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 1. Cache essential local core assets
      await cache.addAll(CORE_ASSETS);
      // 2. Cache optional external assets without blocking install on network failure
      for (const url of OPTIONAL_EXTERNAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('[SW] Non-critical asset cache skipped:', url);
        }
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  const keepCaches = new Set([CACHE_NAME, IMAGE_CACHE_NAME, IMAGE_CORS_CACHE_NAME]);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => !keepCaches.has(name)).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  if (url.includes('api.themoviedb.org') || url.includes('api4.thetvdb.com')) {
    // API calls bypass cache
    return;
  }

  // Cache-First for TMDB images & YouTube thumbnails, keeping CORS separate from opaque responses
  if (url.includes('image.tmdb.org') || url.includes('i.ytimg.com')) {
    const isCors = event.request.mode === 'cors';
    const targetCacheName = isCors ? IMAGE_CORS_CACHE_NAME : IMAGE_CACHE_NAME;
    event.respondWith(
      caches.open(targetCacheName).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached && (!isCors || cached.type !== 'opaque')) {
          return cached;
        }
        try {
          const response = await fetch(event.request);
          if (response.ok && (!isCors || response.type !== 'opaque')) {
            cache.put(event.request, response.clone());
          }
          return response;
        } catch {
          return new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Network-First for same-origin app assets so updates arrive cleanly while preserving offline support
  if (url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 503 }));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
