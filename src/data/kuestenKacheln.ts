import type { Punkt } from '@/core/types';
import {
  dekodiere, fehlendeKacheln, grobeKachel, kachelnFuerBox, streckenInBox,
  type Box, type DekodierteKachel, type KuestenIndex, type KuestenKachel,
} from '@/core/kuestenKacheln';
import { API_BASIS } from '@/shell/api';

const DB_NAME = 'sail-suite-kueste';
const DB_VERSION = 1;
const STORE_KACHELN = 'kacheln';
const STORE_INDEX = 'index';

const IM_SPEICHER = 48;

const INDEX_PAUSE_MS = 5 * 60_000;
const GLEICHZEITIG = 6;

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;
let index: KuestenIndex | null = null;

let indexLauf: Promise<KuestenIndex | null> | null = null;
let indexPauseBis = 0;
const dekodiert = new Map<string, DekodierteKachel>();
const unterwegs = new Map<string, Promise<DekodierteKachel | null>>();

function oeffne(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (offen) return offen;
  offen = new Promise((res) => {
    if (typeof indexedDB === 'undefined') { res(null); return; }
    let anfrage: IDBOpenDBRequest;
    try {
      anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      res(null);
      return;
    }
    anfrage.onupgradeneeded = () => {
      const d = anfrage.result;
      if (!d.objectStoreNames.contains(STORE_KACHELN)) d.createObjectStore(STORE_KACHELN);
      if (!d.objectStoreNames.contains(STORE_INDEX)) d.createObjectStore(STORE_INDEX);
    };
    anfrage.onsuccess = () => { db = anfrage.result; res(db); };
    anfrage.onerror = () => res(null);
    anfrage.onblocked = () => res(null);
  });
  return offen;
}

async function lies<T>(store: string, schluessel: string): Promise<T | null> {
  const d = await oeffne();
  if (!d) return null;
  try {
    return await new Promise<T | null>((res, rej) => {
      const q = d.transaction(store, 'readonly').objectStore(store).get(schluessel);
      q.onsuccess = () => res((q.result as T | undefined) ?? null);
      q.onerror = () => rej(q.error);
    });
  } catch {
    return null;
  }
}

async function schreibe(store: string, schluessel: string, wert: unknown): Promise<void> {
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(store, 'readwrite');
      tx.objectStore(store).put(wert, schluessel);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {

  }
}

function gueltigerIndex(x: unknown): x is KuestenIndex {
  const i = x as KuestenIndex | null;
  return !!i && typeof i.erstellt === 'string' && typeof i.kachelGrad === 'number' && i.kachelGrad > 0
    && typeof i.faktor === 'number' && Array.isArray(i.gebiete) && Array.isArray(i.kacheln);
}

async function holeIndex(): Promise<KuestenIndex | null> {
  if (indexLauf) return indexLauf;
  if (Date.now() < indexPauseBis) return index ?? (index = await lies<KuestenIndex>(STORE_INDEX, 'index'));
  indexLauf = (async () => {
    const lokal = index ?? await lies<KuestenIndex>(STORE_INDEX, 'index');
    try {
      const r = await fetch(`${API_BASIS}/api/vorrechnung/kueste`, { signal: AbortSignal.timeout(8_000) });
      if (r.ok) {
        const neu: unknown = await r.json();
        if (gueltigerIndex(neu)) {
          if (!lokal || neu.erstellt !== lokal.erstellt) void schreibe(STORE_INDEX, 'index', neu);
          return neu;
        }
      }
    } catch {

    }
    indexPauseBis = Date.now() + INDEX_PAUSE_MS;
    indexLauf = null;
    return lokal;
  })();
  index = await indexLauf;
  return index;
}

function merke(name: string, k: DekodierteKachel): DekodierteKachel {
  dekodiert.delete(name);
  dekodiert.set(name, k);
  while (dekodiert.size > IM_SPEICHER) dekodiert.delete(dekodiert.keys().next().value!);
  return k;
}

function holeKachel(name: string, idx: KuestenIndex): Promise<DekodierteKachel | null> {
  const schon = dekodiert.get(name);
  if (schon) return Promise.resolve(schon);
  const lauf = unterwegs.get(name);
  if (lauf) return lauf;
  const neu = (async () => {
    const lokal = await lies<KuestenKachel>(STORE_KACHELN, name);
    if (lokal && lokal.erstellt >= idx.erstellt) return merke(name, dekodiere(lokal));
    try {
      let r = await fetch(`${API_BASIS}/api/vorrechnung/${name}`, { signal: AbortSignal.timeout(30_000) });

      for (let v = 0; r.status === 429 && v < 2; v++) {
        await new Promise((ok) => setTimeout(ok, 1500 * (v + 1)));
        r = await fetch(`${API_BASIS}/api/vorrechnung/${name}`, { signal: AbortSignal.timeout(30_000) });
      }
      if (r.ok) {
        const k = (await r.json()) as KuestenKachel;
        if (Array.isArray(k?.linien) && typeof k.faktor === 'number') {
          void schreibe(STORE_KACHELN, name, k);
          return merke(name, dekodiere(k));
        }
      }
    } catch {

    }
    return lokal ? merke(name, dekodiere(lokal)) : null;
  })();
  unterwegs.set(name, neu);
  void neu.finally(() => unterwegs.delete(name));
  return neu;
}

export const TOLERANZ_STUFEN_M = [0, 10, 25, 50, 100, 200] as const;

export interface KachelKueste {
  linien: [Punkt, Punkt][];

  toleranzM: number;

  fehlend?: Box[];
}

export async function kuesteAusKachelnMitBudget(
  b: Box, maxStrecken = Infinity,

  teilweise = false,
): Promise<KachelKueste | null> {
  const idx = await holeIndex();
  if (!idx) return null;
  const fehlend = fehlendeKacheln(idx, b);
  if (fehlend.length > 0 && !teilweise) return null;
  if (fehlend.length > 0 && fehlend.length === kachelnFuerBox(b, idx.kachelGrad).length) return null;
  const mitKueste = new Set(idx.kacheln);
  const noetig = kachelnFuerBox(b, idx.kachelGrad).filter((k) => mitKueste.has(k.name));
  const kacheln: DekodierteKachel[] = [];
  for (let i = 0; i < noetig.length; i += GLEICHZEITIG) {
    const teil = await Promise.all(noetig.slice(i, i + GLEICHZEITIG).map((k) => holeKachel(k.name, idx)));

    if (teil.some((k) => k === null)) return null;
    kacheln.push(...(teil as DekodierteKachel[]));
  }
  let linien: [Punkt, Punkt][] = [];
  let toleranzM = 0;
  for (const tol of TOLERANZ_STUFEN_M) {
    toleranzM = tol;
    linien = streckenInBox(kacheln.map((k) => grobeKachel(k, tol)), b);
    if (linien.length <= maxStrecken) break;
  }
  return fehlend.length > 0 ? { linien, toleranzM, fehlend } : { linien, toleranzM };
}

export async function kuesteAusKacheln(b: Box): Promise<[Punkt, Punkt][] | null> {
  return (await kuesteAusKachelnMitBudget(b))?.linien ?? null;
}

export function _kachelnVergessen(): void {
  index = null;
  indexLauf = null;
  indexPauseBis = 0;
  dekodiert.clear();
  unterwegs.clear();
}
