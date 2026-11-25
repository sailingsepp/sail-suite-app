const APP_CACHE = 'trackbook-app-v2';
const KACHEL_CACHE = 'trackbook-kacheln-v1';

const STIMME_CACHE = 'trackbook-stimme-v1';
const STIMME_QUELLEN = [
  'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/',
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/',
];
const istStimme = (url) => STIMME_QUELLEN.some((q) => url.startsWith(q));

const KACHELN_MAX = 6000;

const ZEITLIMIT_SEITE_MS = 2500;
const ZEITLIMIT_REST_MS = 10_000;

const ZEITLIMIT_SEITE_GESPEICHERT_MS = 800;

const istEntwicklungspfad = (pfad) =>
  pfad.startsWith('/@') || pfad.startsWith('/node_modules/') || pfad.startsWith('/src/');

const APP_DATEIEN = ['./', './index.html', '/icon-180.png', '/icon-trackbook-180.png'];

const istUnveraenderlich = (pfad) => pfad.startsWith('/app-assets/');

const INDEX = new URL('./index.html', self.location.href).href;
function seitenSchluessel(adresse) {
  const u = new URL(adresse);
  const basis = new URL('./', self.location.href).pathname;
  if (u.pathname === basis || u.pathname === basis + 'index.html') return INDEX;
  return u.origin + u.pathname;
}

async function legeSeite(cache, schluessel, antwort) {
  const vorige = await cache.match(schluessel).then((a) => (a ? a.text() : null)).catch(() => null);
  await cache.put(schluessel, antwort.clone());
  if (schluessel === INDEX) await cache.put('./', antwort.clone());
  await raeumeAlteDateien(cache, vorige).catch(() => {});
}

async function raeumeAlteDateien(cache, vorigeSeite) {
  const schluessel = await cache.keys();
  const seiten = vorigeSeite ? [vorigeSeite] : [];
  for (const k of schluessel) {
    const pfad = new URL(k.url).pathname;
    if (istUnveraenderlich(pfad)) continue;
    const a = await cache.match(k);
    if (a && (a.headers.get('content-type') || '').includes('text/html')) seiten.push(await a.text());
  }
  const behalten = new Set();
  const offen = seiten.flatMap((html) => verweise(html));
  while (offen.length) {
    const pfad = offen.pop();
    if (behalten.has(pfad)) continue;
    behalten.add(pfad);
    if (!/\.m?js$/.test(pfad)) continue;
    const a = await cache.match(pfad, { ignoreVary: true });
    if (a) offen.push(...verweise(await a.text(), self.location.origin + pfad));
  }
  for (const k of schluessel) {
    const pfad = new URL(k.url).pathname;
    if (istUnveraenderlich(pfad) && /\.(?:m?js|css)$/.test(pfad) && !behalten.has(pfad)) await cache.delete(k);
  }
}

const echteDatei = (antwort) => antwort && antwort.ok
  && !(antwort.headers.get('content-type') || '').includes('text/html');

function verweise(text, basis) {
  const treffer = new Set();
  for (const m of text.matchAll(/["'(](\/app-assets\/[A-Za-z0-9_.-]+\.(?:js|mjs|css))/g)) treffer.add(m[1]);

  if (basis) {
    for (const m of text.matchAll(/["'](\.\/[A-Za-z0-9_.-]+\.(?:js|mjs|css))["']/g)) {
      if (m[1] !== './sw.js') treffer.add(new URL(m[1], basis).pathname);
    }
  }
  return [...treffer];
}

async function sichereVollstaendig(cache, html, frist) {
  const noetig = verweise(html);
  for (const pfad of noetig) {
    if (await cache.match(pfad, { ignoreVary: true })) continue;
    const rest = frist - Date.now();
    if (rest <= 0) return false;
    try {
      const a = await mitZeitlimit(pfad, rest);
      if (!echteDatei(a)) return false;
      await cache.put(pfad, a);
    } catch {
      return false;
    }
  }
  return true;
}

async function sichereNachgeladene(cache, html) {
  for (const pfad of verweise(html)) {
    if (!pfad.endsWith('.js')) continue;
    const a = await cache.match(pfad, { ignoreVary: true });
    if (!a) continue;
    const text = await a.text();
    for (const weiter of verweise(text, self.location.origin + pfad)) {
      if (await cache.match(weiter, { ignoreVary: true })) continue;
      try {
        const b = await fetch(weiter);
        if (echteDatei(b)) await cache.put(weiter, b);
      } catch {  }
    }
  }
}

const istKachel = (url) =>
  /^https:\/\/(tile\.openstreetmap\.org|[a-c]\.tile\.openstreetmap\.org|tiles\.openseamap\.org)\//.test(url);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_CACHE)

      .then(async (c) => {
        await Promise.all(APP_DATEIEN.map((d) => c.add(d).catch(() => {})));

        const seite = await c.match('./index.html');
        if (seite) {
          const html = await seite.text();
          await sichereVollstaendig(c, html, Date.now() + 60_000);
          await sichereNachgeladene(c, html).catch(() => {});
        }
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(

        namen.filter((n) => n.startsWith('trackbook-') && n !== APP_CACHE && n !== KACHEL_CACHE && n !== STIMME_CACHE)
          .map((n) => caches.delete(n)),
      ))

      .then(() => caches.open(APP_CACHE))
      .then(async (c) => {
        for (const k of await c.keys()) {
          const u = new URL(k.url);
          if (u.search && !istUnveraenderlich(u.pathname)) await c.delete(k);
        }
      })
      .catch(() => {})
      .then(() => self.clients.claim()),
  );

  opakeKachelnRaeumen().catch(() => { opakeGeraeumt = false; });
});

self.addEventListener('message', (e) => {
  if (e.data?.art !== 'speicherRaeumen') return;
  e.waitUntil(opakeKachelnRaeumen().catch(() => { opakeGeraeumt = false; }));
});

function mitZeitlimit(anfrage, ms) {
  return new Promise((res, rej) => {
    const uhr = setTimeout(() => rej(new Error('Zeitlimit')), ms);
    fetch(anfrage).then(
      (a) => { clearTimeout(uhr); res(a); },
      (f) => { clearTimeout(uhr); rej(f); },
    );
  });
}

const KACHELN_SPIEL = 300;

const STUTZEN_NACH_MS = 5000;

let kachelBestand = null;
let stutzenGeplant = false;

async function kachelnStutzen() {
  const cache = await caches.open(KACHEL_CACHE);
  const schluessel = await cache.keys();
  kachelBestand = schluessel.length;
  if (schluessel.length <= KACHELN_MAX) return;
  for (const k of schluessel.slice(0, schluessel.length - KACHELN_MAX)) await cache.delete(k);
  kachelBestand = KACHELN_MAX;
}

let opakeGeraeumt = false;
async function opakeKachelnRaeumen() {
  if (opakeGeraeumt) return;
  opakeGeraeumt = true;

  const cache = await caches.open(KACHEL_CACHE);
  const schluessel = await cache.keys();
  const antworten = await cache.matchAll();
  if (antworten.length !== schluessel.length) return;
  const opak = schluessel.filter((_, i) => antworten[i].type === 'opaque');
  if (opak.length * 2 >= schluessel.length && opak.length) await caches.delete(KACHEL_CACHE);
  else for (const k of opak) await cache.delete(k);
  kachelBestand = null;
}

function kachelAbgelegt() {
  if (kachelBestand !== null) kachelBestand++;
  if (stutzenGeplant) return;
  if (kachelBestand !== null && kachelBestand <= KACHELN_MAX + KACHELN_SPIEL) return;
  stutzenGeplant = true;
  setTimeout(() => {
    kachelnStutzen().catch(() => {}).finally(() => { stutzenGeplant = false; });
  }, STUTZEN_NACH_MS);
}

async function holeNeueFassung() {
  const antwort = await mitZeitlimit(new Request('./', { cache: 'no-store', credentials: 'include' }), ZEITLIMIT_REST_MS * 4);
  if (!antwort || !antwort.ok || antwort.redirected) return null;
  const html = await antwort.clone().text();
  const version = (html.match(/<meta name="app-version" content="([^"]+)"/) || [])[1] || null;
  if (!version) return null;
  const cache = await caches.open(APP_CACHE);
  if (!(await sichereVollstaendig(cache, html, Date.now() + 120_000))) return null;
  await legeSeite(cache, INDEX, antwort);
  await sichereNachgeladene(cache, html).catch(() => {});
  return version;
}

self.addEventListener('message', (e) => {
  if (!e.data || e.data.art !== 'neueFassung') return;
  e.waitUntil(holeNeueFassung().catch(() => null).then((version) => {

    const kanal = e.ports && e.ports[0];
    if (kanal) kanal.postMessage({ art: 'neueFassung', version });
    else if (e.source) e.source.postMessage({ art: 'neueFassung', version });
  }));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (istStimme(req.url)) {
    e.respondWith(
      caches.open(STIMME_CACHE).then((c) => c.match(req.url).then((treffer) => treffer || fetch(req).then((antwort) => {
        if (antwort && antwort.ok) c.put(req.url, antwort.clone()).catch(() => {});
        return antwort;
      }))),
    );
    return;
  }

  if (istKachel(req.url)) {
    e.respondWith(
      caches.match(req, { ignoreVary: true }).then((treffer) => {

        if (treffer && !(treffer.type === 'opaque' && req.mode !== 'no-cors')) return treffer;
        return fetch(req).then((antwort) => {

          if (antwort && (antwort.ok || antwort.type === 'opaque')) {
            const kopie = antwort.clone();
            caches.open(KACHEL_CACHE)
              .then((c) => c.put(req, kopie))
              .then(kachelAbgelegt)
              .catch(() => {});
          }
          return antwort;
        });
      }),
    );
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (istEntwicklungspfad(url.pathname)) return;

  if (istUnveraenderlich(url.pathname)) {
    e.respondWith(

      caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((treffer) => treffer
        ?? mitZeitlimit(req, ZEITLIMIT_REST_MS).then((antwort) => {
          if (echteDatei(antwort)) {
            const kopie = antwort.clone();
            caches.open(APP_CACHE).then((c) => c.put(req, kopie)).catch(() => {});
          }
          return antwort;
        })),
    );
    return;
  }

  const istSeite = req.mode === 'navigate';
  if (istSeite) {
    e.respondWith(seiteLaden(e));
    return;
  }
  e.respondWith(
    mitZeitlimit(req, istSeite ? ZEITLIMIT_SEITE_MS : ZEITLIMIT_REST_MS)
      .then((antwort) => {
        if (antwort && antwort.ok) {
          const kopie = antwort.clone();
          caches.open(APP_CACHE).then((c) => c.put(req, kopie)).catch(() => {});
        }
        return antwort;
      })
      .catch(async () => {
        const treffer = await caches.match(req, { ignoreSearch: true, ignoreVary: true });
        if (treffer) return treffer;

        if (istSeite) {
          const seite = await caches.match('./index.html');
          if (seite) return seite;
        }
        return new Response('', { status: 504, statusText: 'Kein Netz und nichts im Speicher' });
      }),
  );
});

async function alleDa(cache, html) {

  const treffer = await Promise.all(verweise(html).map((pfad) => cache.match(pfad, { ignoreVary: true })));
  return treffer.every(Boolean);
}

async function seiteAblegen(cache, schluessel, antwort, html) {
  if (!(await sichereVollstaendig(cache, html, Date.now() + ZEITLIMIT_SEITE_MS + 6000))) return;
  await legeSeite(cache, schluessel, antwort);
  await sichereNachgeladene(cache, html).catch(() => {});
}

async function seiteLaden(e) {
  const req = e.request;
  const cache = await caches.open(APP_CACHE);
  const schluessel = seitenSchluessel(req.url);

  const alt = await cache.match(schluessel);
  if (alt) return seiteMitGespeicherter(e, cache, alt, schluessel);
  const frist = Date.now() + ZEITLIMIT_SEITE_MS + 6000;
  try {
    const antwort = await mitZeitlimit(req, ZEITLIMIT_SEITE_MS);

    if (antwort.type === 'opaqueredirect' || (!antwort.ok && antwort.status < 500)) return antwort;
    if (!antwort.ok) return alt ?? antwort;
    const html = await antwort.clone().text();
    if (!(await sichereVollstaendig(cache, html, frist)) && alt) return alt;
    await legeSeite(cache, schluessel, antwort);

    sichereNachgeladene(cache, html).catch(() => {});
    return antwort;
  } catch {
    if (alt) return alt;
    return new Response('', { status: 504, statusText: 'Kein Netz und nichts im Speicher' });
  }
}

async function seiteMitGespeicherter(e, cache, alt, schluessel) {
  const req = e.request;
  const netz = fetch(req);

  const altText = alt.clone().text();
  const entscheid = netz.then(async (antwort) => {
    if (antwort.type === 'opaqueredirect' || (!antwort.ok && antwort.status < 500)) return { zeige: antwort };
    if (!antwort.ok) return { zeige: null };
    const html = await antwort.clone().text();

    if (html === (await altText)) return { zeige: antwort, antwort, html };
    return { zeige: (await alleDa(cache, html)) ? antwort : null, antwort, html };
  });
  const ergebnis = await Promise.race([
    entscheid.catch(() => ({ zeige: null })),
    new Promise((ok) => setTimeout(() => ok(null), ZEITLIMIT_SEITE_GESPEICHERT_MS)),
  ]);
  if (ergebnis?.zeige) {
    if (ergebnis.antwort) {

      const kopie = ergebnis.antwort.clone();
      e.waitUntil(legeSeite(cache, schluessel, kopie)
        .then(() => sichereNachgeladene(cache, ergebnis.html)).catch(() => {}));
    }
    return ergebnis.zeige;
  }

  e.waitUntil(entscheid.then((r) => (r?.antwort ? seiteAblegen(cache, schluessel, r.antwort, r.html) : null)).catch(() => {}));
  return alt;
}

self.addEventListener('message', (e) => {
  if (e.data?.art !== 'kachelzahl') return;
  e.waitUntil(
    caches.open(KACHEL_CACHE)
      .then((c) => c.keys())
      .then((k) => e.source?.postMessage({ art: 'kachelzahl', anzahl: k.length })),
  );
});
