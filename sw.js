const CACHE_NAME = 'dfwatch-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './app/css/style.css',
  './app/js/app.js',
  './app/js/db.js',
  './app/js/tmdb.js',
  './app/js/achievements.js',
  './app/js/import.js',
  './app/js/export.js',
  './app/js/i18n.js',
  './app/js/profile-card.js',
  './app/js/vendor/recommender.js',
  './app/js/vendor/panoptic.js',
  './app/js/panoptic-ui.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'https://unpkg.com/dexie@3.2.4/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS_TO_CACHE);
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
  if (event.request.url.includes('api.themoviedb.org')) {
    // API calls bypass cache
    return;
  }
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
