import type { Punkt } from '@/core/types';

export interface KuestenBox { s: number; w: number; n: number; e: number }

export interface CacheEintrag {
  id: string;
  box: KuestenBox;

  zeit: number;
}

export const PUFFER_GRAD = 0.1;

export const MAX_ALTER_MS = 30 * 24 * 3600_000;

export const MAX_EINTRAEGE = 40;

export function enthaelt(aussen: KuestenBox, innen: KuestenBox): boolean {
  return aussen.s <= innen.s && aussen.w <= innen.w
    && aussen.n >= innen.n && aussen.e >= innen.e;
}

export function erweitert(box: KuestenBox, grad: number): KuestenBox {
  return {
    s: Math.max(-90, box.s - grad),
    n: Math.min(90, box.n + grad),
    w: Math.max(-180, box.w - grad),
    e: Math.min(180, box.e + grad),
  };
}

function flaeche(b: KuestenBox): number {
  return Math.max(0, b.n - b.s) * Math.max(0, b.e - b.w);
}

export function findeTreffer(
  eintraege: CacheEintrag[], box: KuestenBox, jetzt: number, maxAlterMs = MAX_ALTER_MS,
): CacheEintrag | null {
  let beste: CacheEintrag | null = null;
  for (const e of eintraege) {
    if (jetzt - e.zeit > maxAlterMs) continue;
    if (!enthaelt(e.box, box)) continue;
    if (!beste || flaeche(e.box) < flaeche(beste.box)) beste = e;
  }
  return beste;
}

export function zuVerdraengen(
  eintraege: CacheEintrag[], jetzt: number, maxAnzahl = MAX_EINTRAEGE, maxAlterMs = MAX_ALTER_MS,
): CacheEintrag[] {
  const abgelaufen = eintraege.filter((e) => jetzt - e.zeit > maxAlterMs);
  const frisch = eintraege.filter((e) => jetzt - e.zeit <= maxAlterMs)
    .sort((a, b) => b.zeit - a.zeit);
  return [...abgelaufen, ...frisch.slice(maxAnzahl)];
}

const DB_NAME = 'leinen-los';
const DB_VERSION = 1;
const STORE_INDEX = 'kueste-index';
const STORE_LINIEN = 'kueste-linien';

function idbVerfuegbar(): boolean {
  return typeof indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function oeffne(): Promise<IDBDatabase | null> {
  if (!idbVerfuegbar()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((fertig) => {
    let anfrage: IDBOpenDBRequest;
    try {
      anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    } catch { fertig(null); return; }
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains(STORE_INDEX)) db.createObjectStore(STORE_INDEX);
      if (!db.objectStoreNames.contains(STORE_LINIEN)) db.createObjectStore(STORE_LINIEN);
    };
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fertig(null);
    anfrage.onblocked = () => fertig(null);
  });
  return dbPromise;
}

function alsPromise<T>(anfrage: IDBRequest<T>): Promise<T | null> {
  return new Promise((fertig) => {
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fertig(null);
  });
}

let index: CacheEintrag[] | null = null;

async function ladeIndex(): Promise<CacheEintrag[]> {
  if (index) return index;
  const db = await oeffne();
  if (!db) { index = []; return index; }
  try {
    const tx = db.transaction(STORE_INDEX, 'readonly');
    const store = tx.objectStore(STORE_INDEX);
    const [schluessel, werte] = await Promise.all([
      alsPromise(store.getAllKeys()), alsPromise(store.getAll()),
    ]);
    index = (schluessel ?? []).map((k, i) => ({
      id: String(k),
      box: (werte?.[i] as { box: KuestenBox }).box,
      zeit: (werte?.[i] as { zeit: number }).zeit,
    }));
  } catch {
    index = [];
  }
  return index;
}

export async function ausCache(box: KuestenBox): Promise<[Punkt, Punkt][] | null> {
  const eintraege = await ladeIndex();
  const treffer = findeTreffer(eintraege, box, Date.now());
  if (!treffer) return null;
  const db = await oeffne();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_LINIEN, 'readonly');
    const linien = await alsPromise(tx.objectStore(STORE_LINIEN).get(treffer.id));
    return (linien as [Punkt, Punkt][] | null) ?? null;
  } catch {
    return null;
  }
}

export async function inCache(box: KuestenBox, linien: [Punkt, Punkt][]): Promise<void> {
  const db = await oeffne();
  if (!db) return;
  const eintraege = await ladeIndex();
  const jetzt = Date.now();
  const id = `${box.s.toFixed(3)},${box.w.toFixed(3)},${box.n.toFixed(3)},${box.e.toFixed(3)}`;
  const neu: CacheEintrag = { id, box, zeit: jetzt };
  const raus = zuVerdraengen([...eintraege.filter((e) => e.id !== id), neu], jetzt);
  try {
    const tx = db.transaction([STORE_INDEX, STORE_LINIEN], 'readwrite');
    const iStore = tx.objectStore(STORE_INDEX), lStore = tx.objectStore(STORE_LINIEN);
    for (const e of raus) { iStore.delete(e.id); lStore.delete(e.id); }
    iStore.put({ box, zeit: jetzt }, id);
    lStore.put(linien, id);

    index = [...eintraege.filter((e) => e.id !== id && !raus.some((r) => r.id === e.id)), neu];
  } catch {

  }
}

export function _indexVergessen(): void {
  index = null;
}
