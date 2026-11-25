import { landKachelnFuerBox } from '@/core/kartenKacheln';
import { dekodiereLinie, type HoehenLinie } from '@/core/hoehen';
import type { Box } from '@/core/landumfahrung';
import { API_BASIS } from '@/shell/api';

const DB_NAME = 'sail-suite-tiefen';
const STORE = 'kacheln';
const INDEX_SCHLUESSEL = '_index';
const INDEX_NEU_MS = 24 * 3600_000;

interface TiefenIndex { erstellt: string; kacheln: string[] }

interface Roh { name: string; faktor: number; linien: HoehenLinie[]; baender?: HoehenLinie[]; flaechen?: HoehenLinie[] }
interface Abgelegt { erstellt: string; k: Roh }
export interface TiefenZug { tiefeM: number; p: Float64Array; s: number; w: number; n: number; o: number }
interface Zelle { erstellt: string; linien: TiefenZug[]; flaechen: TiefenZug[] }

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;
let index: { wert: TiefenIndex; geholt: number } | null = null;
const zellen = new Map<string, Zelle>();
const unterwegs = new Map<string, Promise<boolean>>();

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

async function tiefenIndex(netz: boolean, basis: string): Promise<TiefenIndex | null> {
  if (index && (!netz || Date.now() - index.geholt < INDEX_NEU_MS)) return index.wert;
  const abgelegt = index?.wert ?? await lies<TiefenIndex>(INDEX_SCHLUESSEL);
  if (netz) {
    try {
      const r = await fetch(`${basis}/api/vorrechnung/tiefen`, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const neu = (await r.json()) as TiefenIndex;
        if (neu && typeof neu.erstellt === 'string' && Array.isArray(neu.kacheln)) {
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

function zuege(l: readonly HoehenLinie[], faktor: number, teiler = 1): TiefenZug[] {
  return l.map((x) => {
    const { hoeheM: roh, p } = dekodiereLinie(x, faktor);
    const hoeheM = roh / teiler;
    let s = Infinity, w = Infinity, n = -Infinity, o = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      if (p[i]! < s) s = p[i]!;
      if (p[i]! > n) n = p[i]!;
      if (p[i + 1]! < w) w = p[i + 1]!;
      if (p[i + 1]! > o) o = p[i + 1]!;
    }
    return { tiefeM: hoeheM, p, s, w, n, o };
  });
}

function nimm(erstellt: string, k: Roh): void {
  zellen.set(k.name, { erstellt, linien: zuege(k.linien, k.faktor), flaechen: k.baender ? zuege(k.baender, k.faktor, 10) : zuege(k.flaechen ?? [], k.faktor) });
}

const tName = (landName: string) => landName.replace(/^land-/, 'tiefe-');

function holeZelle(name: string, idx: TiefenIndex, netz: boolean, basis: string): Promise<boolean> {
  const da = zellen.get(name);
  if (da && (da.erstellt === idx.erstellt || !netz)) return Promise.resolve(false);
  const lauf0 = unterwegs.get(name);
  if (lauf0) return lauf0;
  const lauf = (async () => {
    const abgelegt = da ? null : await lies<Abgelegt>(name);
    if (abgelegt) {
      nimm(abgelegt.erstellt, abgelegt.k);
      if (abgelegt.erstellt === idx.erstellt || !netz) return true;
    }
    if (!netz) return false;
    try {
      const r = await fetch(`${basis}/api/vorrechnung/${name}`, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) return !!abgelegt;
      const k = (await r.json()) as Roh;
      if (!Array.isArray(k.linien)) return !!abgelegt;
      nimm(idx.erstellt, k);
      await schreibe(name, { erstellt: idx.erstellt, k } satisfies Abgelegt);
      return true;
    } catch { return !!abgelegt; }
  })().finally(() => unterwegs.delete(name));
  unterwegs.set(name, lauf);
  return lauf;
}

export async function ladeTiefenImGebiet(b: Box, netz: boolean, basis = API_BASIS): Promise<boolean> {
  const idx = await tiefenIndex(netz, basis);
  if (!idx) return false;
  const da = new Set(idx.kacheln);
  const namen = landKachelnFuerBox(b).map((k) => tName(k.name)).filter((n) => da.has(n));
  const neu = await Promise.all(namen.map((n) => holeZelle(n, idx, netz, basis).catch(() => false)));
  return neu.some(Boolean);
}

export function tiefenJetzt(landName: string): { linien: TiefenZug[]; flaechen: TiefenZug[] } | null {
  return zellen.get(tName(landName)) ?? null;
}

export function _vergessen(): void {
  db = null; offen = null; index = null; zellen.clear(); unterwegs.clear();
}
