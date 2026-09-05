const CACHE_NAME = 'dfwatch-v8';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
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
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('api.themoviedb.org') || event.request.url.includes('api4.thetvdb.com')) {
    // API calls bypass cache
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
