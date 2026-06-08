// Ledivan PWA Service Worker
// IMPORTANTE: navegação (HTML) é SEMPRE network-first — nunca servir HTML cacheado,
// senão referencia chunks de CSS/JS antigos (já deletados no deploy) → página sem estilo.
const CACHE = 'ledivan-v2';
const PRECACHE = ['/manifest.json', '/icon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // não intercepta terceiros (fontes/CDN)

  // Navegação (HTML): network-first, cai pro cache só offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/'))));
    return;
  }

  // Assets versionados do Next (hash imutável): cache-first é seguro.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
    return;
  }

  // Demais GET: network-first com fallback ao cache.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
