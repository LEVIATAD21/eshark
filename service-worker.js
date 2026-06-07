/* eShark Service Worker — offline-first */
const VERSION = 'eshark-v1.0.0';
const CORE = [
  './',
  './index.html',
  './css/style.css',
  './js/security.js',
  './js/data.js',
  './js/decision.js',
  './js/store.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // network-first for HTML, cache-first for assets
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(resp => {
        const clone = resp.clone();
        caches.open(VERSION).then(c => c.put(req, clone));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      const clone = resp.clone();
      caches.open(VERSION).then(c => c.put(req, clone));
      return resp;
    }).catch(() => cached))
  );
});

// Push notification handler (placeholder — wire to Firebase Cloud Messaging in prod)
self.addEventListener('push', (event) => {
  let data = { title: 'eShark', body: 'Tem oferta nova!' };
  try { data = event.data.json(); } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: data.url || './'
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data || './'));
});
