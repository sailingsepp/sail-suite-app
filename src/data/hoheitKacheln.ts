import {
  hoheitGedeckt, hoheitKachelAn, hoheitKachelnFuerBox, zoneAmPunkt, abstandZumRandSm,
  type HoheitIndex, type HoheitKachel, type HoheitZone,
} from '@/core/hoheitKacheln';
import type { Box } from '@/core/landumfahrung';
import { API_BASIS } from '@/shell/api';


const DB_NAME = 'sail-suite-hoheit';
const STORE = 'kacheln';
const INDEX_SCHLUESSEL = '_index';

const INDEX_NEU_MS = 6 * 3600_000;

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;
let index: { wert: HoheitIndex; geholt: number } | null = null;
const imSpeicher = new Map<string, HoheitKachel | null>();

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

function gueltig(x: unknown): x is HoheitIndex {
  const i = x as HoheitIndex | null;
  return !!i && typeof i.erstellt === 'string' && Array.isArray(i.gebiete) && Array.isArray(i.kacheln) && typeof i.faktor === 'number';
}


async function holeIndex(netz: boolean, basis = API_BASIS): Promise<HoheitIndex | null> {
  if (index && (!netz || Date.now() - index.geholt < INDEX_NEU_MS)) return index.wert;
  const abgelegt = index?.wert ?? await lies<HoheitIndex>(INDEX_SCHLUESSEL);
  if (netz) {
    try {
      const r = await fetch(`${basis}/api/vorrechnung/hoheit`, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const neu: unknown = await r.json();
        if (gueltig(neu)) {
          
          if (abgelegt && abgelegt.erstellt !== neu.erstellt) imSpeicher.clear();
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

async function holeKachel(name: string, idx: HoheitIndex, netz: boolean, basis = API_BASIS): Promise<HoheitKachel | null> {
  if (imSpeicher.has(name)) return imSpeicher.get(name)!;
  const schluessel = `${idx.erstellt}|${name}`;
  const abgelegt = await lies<HoheitKachel>(schluessel);
  if (abgelegt) { imSpeicher.set(name, abgelegt); return abgelegt; }
  if (!netz) return null;
  try {
    const r = await fetch(`${basis}/api/vorrechnung/${name}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const k = (await r.json()) as HoheitKachel;
    imSpeicher.set(name, k);
    await schreibe(schluessel, k);
    return k;
  } catch { return null; }
}


export async function ladeHoheitImGebiet(b: Box, basis = API_BASIS): Promise<boolean> {
  const idx = await holeIndex(true, basis);
  if (!idx) return false;
  const vorhanden = new Set(idx.kacheln);
  const namen = hoheitKachelnFuerBox(b).map((k) => k.name).filter((n) => vorhanden.has(n));
  const geholt = await Promise.all(namen.map((n) => holeKachel(n, idx, true, basis)));
  return geholt.every(Boolean);
}


export const RAND_UNKLAR_SM = 0.5;


export async function hoheitAusKacheln(
  lat: number, lon: number, netz = false, basis = API_BASIS,
): Promise<{ zone: HoheitZone | null } | undefined> {
  const idx = await holeIndex(netz, basis);
  if (!idx || !hoheitGedeckt(idx, lat, lon)) return undefined;
  const { name } = hoheitKachelAn(lat, lon);
  if (!idx.kacheln.includes(name)) return { zone: null };
  const k = await holeKachel(name, idx, netz, basis);
  if (!k) return undefined;
  const zone = zoneAmPunkt(k, lat, lon, idx.faktor);
  if (zone) return { zone };
  return abstandZumRandSm(k, lat, lon, idx.faktor) < RAND_UNKLAR_SM ? undefined : { zone: null };
}


export function _vergessen(): void {
  db = null; offen = null; index = null; imSpeicher.clear();
}
