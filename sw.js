/* Кэш для мгновенных повторных заходов.
   html/js/css — сначала сеть (чтобы разработка была видна сразу), при плохой сети — из кэша.
   картинки, шрифты, звуки — из кэша мгновенно, обновляются в фоне. */
const CACHE = 'premia-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  const code = r.mode === 'navigate' || /\.(?:html|js|css)$/i.test(u.pathname) || u.pathname.endsWith('/');
  if (code) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const net = await Promise.race([fetch(r), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
        if (net && net.ok) c.put(r, net.clone());
        return net;
      } catch (_) { return (await c.match(r)) || (await c.match(r, { ignoreSearch: true })) || fetch(r); }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(r);
    const upd = fetch(r).then(net => { if (net && net.ok) c.put(r, net.clone()); return net; }).catch(() => null);
    if (hit) { e.waitUntil(upd); return hit; }
    return (await upd) || fetch(r);
  })());
});
