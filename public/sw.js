const VERSION = 2;
const CACHE = `axon-tiket-v${VERSION}`;
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('axon-tiket-') && k !== CACHE).map(k => caches.delete(k)))
    )
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll().then(cls =>
      cls.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: VERSION }))
    ))
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.hostname.includes('supabase') || u.hostname.includes('cdnjs.cloudflare.com')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(r => {
        const c = r.clone();
        caches.open(CACHE).then(ca => ca.put(e.request, c));
        return r;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  if (e.request.method !== 'GET') return;

  if (u.pathname.match(/\/assets\/.*\.[a-f0-9]{8}\./)) {
    e.respondWith(
      caches.match(e.request).then(c => c || fetch(e.request).then(r => {
        if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, cl)); }
        return r;
      }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => {
        if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, cl)); }
        return r;
      });
      return cached || net;
    })
  );
});
