import { revierDeckt, kachelnFuer, fuegeKachelnZusammen, zuschneidenUm, type CopernicusGitter, type KachelRaster } from '@/core/copernicusMarine';
import { API_BASIS } from '@/shell/api';



const DB_NAME = 'leinen-los-copernicus';
const DB_VERSION = 1;
const STORE = 'gitter';

export interface CopernicusManifestEintrag {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  generatedAt: string;
  horizonH: number;
  
  kacheln?: KachelRaster;
}

export interface CopernicusManifest {
  reviere: CopernicusManifestEintrag[];
}

interface CacheEintrag {
  generatedAt: string;
  gitter: CopernicusGitter;
}

function verfuegbar(): boolean {
  return typeof indexedDB !== 'undefined';
}

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;

function oeffne(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (offen) return offen;
  offen = new Promise((res) => {
    if (!verfuegbar()) { res(null); return; }
    let anfrage: IDBOpenDBRequest;
    try {
      anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      res(null);
      return;
    }
    anfrage.onupgradeneeded = () => {
      const d = anfrage.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    };
    anfrage.onsuccess = () => { db = anfrage.result; res(db); };
    anfrage.onerror = () => res(null);
    anfrage.onblocked = () => res(null);
  });
  return offen;
}

async function ausCache(revierId: string): Promise<CacheEintrag | null> {
  const d = await oeffne();
  if (!d) return null;
  try {
    return await new Promise<CacheEintrag | null>((res, rej) => {
      const q = d.transaction(STORE, 'readonly').objectStore(STORE).get(revierId);
      q.onsuccess = () => res((q.result as CacheEintrag | undefined) ?? null);
      q.onerror = () => rej(q.error);
    });
  } catch {
    return null;
  }
}

async function inCache(revierId: string, eintrag: CacheEintrag): Promise<void> {
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(eintrag, revierId);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    
  }
}


export async function holeManifest(basisUrl: string): Promise<CopernicusManifest | null> {
  try {
    const res = await fetch(`${basisUrl}/api/copernicus/manifest`);
    if (!res.ok) return null;
    return (await res.json()) as CopernicusManifest;
  } catch {
    return null;
  }
}


export async function holeGitter(basisUrl: string, revierId: string): Promise<CopernicusGitter | null> {
  const manifest = await holeManifest(basisUrl);
  const eintrag = manifest?.reviere.find((r) => r.id === revierId);

  if (!eintrag) {
    
    
    
    
    const cache = await ausCache(revierId);
    return cache?.gitter ?? null;
  }

  const cache = await ausCache(revierId);
  if (cache && cache.generatedAt === eintrag.generatedAt) return cache.gitter;

  try {
    const res = await fetch(`${basisUrl}/api/copernicus/package/${revierId}/${eintrag.generatedAt}`);
    if (!res.ok) return cache?.gitter ?? null;
    const gitter = (await res.json()) as CopernicusGitter;
    await inCache(revierId, { generatedAt: eintrag.generatedAt, gitter });
    return gitter;
  } catch {
    return cache?.gitter ?? null;
  }
}


export const COPERNICUS_API_BASIS = API_BASIS;


export async function holeGitterAmPunkt(
  lat: number, lon: number, basisUrl: string = COPERNICUS_API_BASIS,
): Promise<CopernicusGitter | null> {
  const manifest = await holeManifest(basisUrl);
  if (!manifest) return null;
  const eintrag = manifest.reviere.find((r) => revierDeckt(r.bbox, lat, lon));
  if (!eintrag) return null;
  return holeGitter(basisUrl, eintrag.id);
}


export function _verbindungVergessen(): void {
  db = null;
  offen = null;
}



async function liesWert<T>(k: string): Promise<T | null> {
  const d = await oeffne();
  if (!d) return null;
  try {
    return await new Promise<T | null>((res, rej) => {
      const q = d.transaction(STORE, 'readonly').objectStore(STORE).get(k);
      q.onsuccess = () => res((q.result as T | undefined) ?? null);
      q.onerror = () => rej(q.error);
    });
  } catch { return null; }
}

async function schreibeWert(k: string, v: unknown): Promise<void> {
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {  }
}


async function raeumeAuf(revierId: string, generatedAt: string): Promise<void> {
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res) => {
      const tx = d.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      st.delete(revierId);
      const q = st.openKeyCursor();
      q.onsuccess = () => {
        const c = q.result;
        if (!c) return;
        const k = String(c.key);
        if (k.startsWith(`${revierId}|`) && !k.startsWith(`${revierId}|${generatedAt}|`) && k !== `${revierId}|manifest`) st.delete(c.key);
        c.continue();
      };
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {  }
}


export async function holeGitterUm(
  punkte: readonly { lat: number; lon: number }[], randGrad: number, basisUrl: string = COPERNICUS_API_BASIS,
): Promise<CopernicusGitter | null> {
  if (!punkte.length) return null;
  const lats = punkte.map((p) => p.lat), lons = punkte.map((p) => p.lon);
  const mitte = { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lon: (Math.min(...lons) + Math.max(...lons)) / 2 };
  const manifest = await holeManifest(basisUrl);
  let eintrag = manifest?.reviere.find((r) => revierDeckt(r.bbox, mitte.lat, mitte.lon)) ?? null;
  const online = !!manifest;
  if (eintrag) void schreibeWert(`${eintrag.id}|manifest`, eintrag);
  else if (!online) {
    
    const d = await oeffne();
    if (d) {
      const alle = await new Promise<CopernicusManifestEintrag[]>((res) => {
        const aus: CopernicusManifestEintrag[] = [];
        try {
          const q = d.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
          q.onsuccess = () => { const c = q.result; if (!c) { res(aus); return; } if (String(c.key).endsWith('|manifest')) aus.push(c.value as CopernicusManifestEintrag); c.continue(); };
          q.onerror = () => res(aus);
        } catch { res(aus); }
      });
      eintrag = alle.find((r) => revierDeckt(r.bbox, mitte.lat, mitte.lon)) ?? null;
    }
  }
  const zugeschnitten = (g: CopernicusGitter | null) => (g ? zuschneidenUm(g, punkte, randGrad) : null);
  if (!eintrag) return online ? null : zugeschnitten(await holeGitterAmPunkt(mitte.lat, mitte.lon, basisUrl));
  if (!eintrag.kacheln) return zugeschnitten(await holeGitter(basisUrl, eintrag.id));
  
  
  const schritt = 0.1;
  const b = kachelnFuer(eintrag.kacheln, Math.min(...lats) - randGrad - schritt, Math.min(...lons) - randGrad - schritt,
    Math.max(...lats) + randGrad + schritt, Math.max(...lons) + randGrad + schritt);
  if (!b) return null;
  const geholt = new Map<string, CopernicusGitter>();
  const auftraege: Promise<void>[] = [];
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      const k = `${r}-${c}`;
      const schluessel = `${eintrag.id}|${eintrag.generatedAt}|${k}`;
      auftraege.push((async () => {
        const alt = await liesWert<CopernicusGitter>(schluessel);
        if (alt) { geholt.set(k, alt); return; }
        if (!online) return;
        try {
          const res = await fetch(`${basisUrl}/api/copernicus/package/${eintrag!.id}/${eintrag!.generatedAt}/${k}`);
          if (!res.ok) return;
          const g = (await res.json()) as CopernicusGitter;
          geholt.set(k, g);
          await schreibeWert(schluessel, g);
        } catch {  }
      })());
    }
  }
  await Promise.all(auftraege);
  const g = fuegeKachelnZusammen((r, c) => geholt.get(`${r}-${c}`), b);
  if (!g) return online ? zugeschnitten(await holeGitter(basisUrl, eintrag.id)) : null;
  if (online) void raeumeAuf(eintrag.id, eintrag.generatedAt);
  return zuschneidenUm(g, punkte, randGrad);
}
