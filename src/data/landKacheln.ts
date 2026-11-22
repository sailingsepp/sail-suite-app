import {
  karteGedeckt, landKachelnFuerBox, landKachelAn, dekodiereRing, anLand, FEIN_AB_ZOOM,
  type KartenIndex, type LandKachel,
} from '@/core/kartenKacheln';
import type { Box } from '@/core/landumfahrung';
import { API_BASIS } from '@/shell/api';


const DB_NAME = 'sail-suite-karte';
const STORE = 'kacheln';
const INDEX_SCHLUESSEL = '_index';
const INDEX_NEU_MS = 6 * 3600_000;

interface Abgelegt { erstellt: string; k: LandKachel }

export interface LandRinge { fein: Float64Array[]; grob: Float64Array[] }

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;
let index: { wert: KartenIndex; geholt: number } | null = null;
const imSpeicher = new Map<string, { erstellt: string; ringe: LandRinge }>();
const unterwegs = new Map<string, Promise<LandRinge | null>>();

function oeffne(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (offen) return offen;
  offen = new Promise((res) => {
    if (typeof indexedDB === 'undefined') { res(null); return; }
    let a: IDBOpenDBRequest;
    try { a = indexedDB.open(DB_NAME, 1); } catch { res(null); return; }
    a.onupgradeneeded = () => { if (!a.result.objectStoreNames.contains(STORE)) a.result.createObjectStore(STORE); };
    a.onsuccess = () => { db = a.result; res(db); };
    a.onerror = () => res(null);
    a.onblocked = () => res(null);
  });
  return offen;
}

async function lies<T>(k: string): Promise<T | null> {
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

async function schreibe(k: string, v: unknown): Promise<void> {
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

function gueltig(x: unknown): x is KartenIndex {
  const i = x as KartenIndex | null;
  return !!i && typeof i.erstellt === 'string' && Array.isArray(i.gebiete) && Array.isArray(i.kacheln) && typeof i.faktor === 'number';
}


export async function kartenIndex(netz: boolean, basis = API_BASIS): Promise<KartenIndex | null> {
  if (index && (!netz || Date.now() - index.geholt < INDEX_NEU_MS)) return index.wert;
  const abgelegt = index?.wert ?? await lies<KartenIndex>(INDEX_SCHLUESSEL);
  if (netz) {
    try {
      const r = await fetch(`${basis}/api/vorrechnung/karte`, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const neu: unknown = await r.json();
        if (gueltig(neu)) {
          index = { wert: neu, geholt: Date.now() };
          void schreibe(INDEX_SCHLUESSEL, neu);
          return neu;
        }
      }
    } catch {  }
  }
  if (abgelegt) index = { wert: abgelegt, geholt: index?.geholt ?? 0 };
  return abgelegt;
}


export function kartenIndexJetzt(): KartenIndex | null {
  return index?.wert ?? null;
}

function zuRingen(k: LandKachel): LandRinge {
  return { fein: k.fein.map((r) => dekodiereRing(r, k.faktor)), grob: k.grob.map((r) => dekodiereRing(r, k.faktor)) };
}


export function istLandJetzt(lat: number, lon: number): boolean | null {
  const idx = index?.wert;
  if (!idx || !karteGedeckt(idx, lat, lon)) return null;
  const k = landKachelAn(lat, lon);
  if (!idx.kacheln.includes(k.name)) return false;
  const r = imSpeicher.get(k.name)?.ringe;
  return r ? anLand(r.fein, lat, lon) : null;
}


export function landRingeJetzt(name: string): LandRinge | null {
  return imSpeicher.get(name)?.ringe ?? null;
}


export function holeLandRinge(name: string, idx: KartenIndex, netz: boolean, basis = API_BASIS): Promise<LandRinge | null> {
  const m = imSpeicher.get(name);
  if (m && (m.erstellt === idx.erstellt || !netz)) return Promise.resolve(m.ringe);
  const laufend = unterwegs.get(name);
  if (laufend) return laufend;
  const lauf = (async () => {
    const abgelegt = m ? null : await lies<Abgelegt>(name);
    if (abgelegt) {
      imSpeicher.set(name, { erstellt: abgelegt.erstellt, ringe: zuRingen(abgelegt.k) });
      if (abgelegt.erstellt === idx.erstellt || !netz) return imSpeicher.get(name)!.ringe;
    }
    if (!netz) return imSpeicher.get(name)?.ringe ?? null;
    try {
      const r = await fetch(`${basis}/api/vorrechnung/${name}`, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) return imSpeicher.get(name)?.ringe ?? null;
      const k = (await r.json()) as LandKachel;
      imSpeicher.set(name, { erstellt: idx.erstellt, ringe: zuRingen(k) });
      await schreibe(name, { erstellt: idx.erstellt, k } satisfies Abgelegt);
      return imSpeicher.get(name)!.ringe;
    } catch { return imSpeicher.get(name)?.ringe ?? null; }
  })().finally(() => unterwegs.delete(name));
  unterwegs.set(name, lauf);
  return lauf;
}


export function ausschnittStand(b: Box): 'bereit' | 'fehlt' | 'aussen' {
  const zellen = gedeckteZellen(b);
  if (!zellen.length) return 'aussen';
  const mitLand = new Set(index!.wert.kacheln);
  return zellen.every((k) => !mitLand.has(k.name) || imSpeicher.has(k.name)) ? 'bereit' : 'fehlt';
}


export function bereiteZellen(b: Box): ReturnType<typeof gedeckteZellen> {
  const idx = index?.wert;
  if (!idx) return [];
  const mitLand = new Set(idx.kacheln);
  return gedeckteZellen(b).filter((k) => !mitLand.has(k.name) || imSpeicher.has(k.name));
}


export function gedeckteZellen(b: Box): { i: number; j: number; name: string; s: number; w: number; n: number; o: number }[] {
  const idx = index?.wert;
  if (!idx) return [];
  const g = idx.kachelGrad;
  return landKachelnFuerBox(b)
    .filter((k) => karteGedeckt(idx, (k.i + 0.5) * g, (k.j + 0.5) * g))
    .map((k) => ({ ...k, s: k.i * g, w: k.j * g, n: (k.i + 1) * g, o: (k.j + 1) * g }));
}


export async function ladeLandImGebiet(b: Box, netz: boolean, basis = API_BASIS): Promise<boolean> {
  const idx = await kartenIndex(netz, basis);
  if (!idx) return false;
  const mitLand = new Set(idx.kacheln);
  const namen = landKachelnFuerBox(b).map((k) => k.name).filter((n) => mitLand.has(n));
  const geholt = await Promise.all(namen.map((n) => holeLandRinge(n, idx, netz, basis)));
  return geholt.every(Boolean);
}


export function stufeFuerZoom(z: number): 'fein' | 'grob' {
  return z >= FEIN_AB_ZOOM ? 'fein' : 'grob';
}


export function _vergessen(): void {
  db = null; offen = null; index = null; imSpeicher.clear(); unterwegs.clear();
}
