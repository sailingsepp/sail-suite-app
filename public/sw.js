

const CACHE = 'suite-start-v1';
const ZEITLIMIT_MS = 2500;

const ZEITLIMIT_GESPEICHERT_MS = 800;

const istStartseite = (pfad) => pfad === '/' || pfad === '/index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.add('/').catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(
        namen.filter((n) => n.startsWith('suite-start-') && n !== CACHE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !istStartseite(url.pathname)) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const alt = await cache.match('/');
    const netz = fetch(req);
    
    
    const ablegen = (antwort) => {
      if (antwort.ok && antwort.type === 'basic') e.waitUntil(cache.put('/', antwort.clone()).catch(() => {}));
      return antwort;
    };
    if (!alt) {
      return ablegen(await Promise.race([netz, new Promise((_, nein) => setTimeout(() => nein(new Error('Zeitlimit')), ZEITLIMIT_MS))]));
    }
    
    
    const antwort = await Promise.race([
      netz.catch(() => null),
      new Promise((ok) => setTimeout(() => ok(null), ZEITLIMIT_GESPEICHERT_MS)),
    ]);
    if (antwort && antwort.ok) return ablegen(antwort);
    if (antwort && antwort.status < 500) return antwort;
    e.waitUntil(netz.then((a) => { if (a.ok && a.type === 'basic') return cache.put('/', a); }).catch(() => {}));
    return alt;
  })());
});
