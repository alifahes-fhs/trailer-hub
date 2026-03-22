/* ============================================================
   TRAILER HUB — Service Worker
   Caches static assets for offline use
   ============================================================ */

const CACHE  = 'trailerhub-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/contact.html',
  '/movie.html',
  '/styles.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // For TMDB API calls — network first, no cache
  if (url.hostname.includes('themoviedb') || url.hostname.includes('tmdb')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // For everything else — cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});