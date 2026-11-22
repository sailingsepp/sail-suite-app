import { landKachelnFuerBox } from '@/core/kartenKacheln';
import { dekodiereLinie, type HoehenLinie } from '@/core/hoehen';
import type { Box } from '@/core/landumfahrung';
import { API_BASIS } from '@/shell/api';


const DB_NAME = 'sail-suite-hoehen';
const STORE = 'kacheln';
const INDEX_SCHLUESSEL = '_index';
const INDEX_NEU_MS = 24 * 3600_000;
const GROSS_HOECHSTENS = 8;

interface HoehenIndex { erstellt: string; kachelGrad: number; kacheln: string[] }
interface Roh { name: string; faktor: number; linien: HoehenLinie[]; bilder: Partial<Record<'z10' | 'z12', string>> }
interface Abgelegt { erstellt: string; k: Roh }
export interface Linie { hoeheM: number; p: Float64Array; s: number; w: number; n: number; o: number }
type Bild = ImageBitmap | HTMLImageElement;
interface Zelle { erstellt: string; linien: Linie[]; roh: Roh['bilder']; bilder: Partial<Record<'z10' | 'z12', Bild>>; benutzt: number }

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;
let index: { wert: HoehenIndex; geholt: number } | null = null;
const zellen = new Map<string, Zelle>();
const unterwegs = new Map<string, Promise<boolean>>();
const entpackt = new Map<string, Promise<void>>();

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

async function hoehenIndex(netz: boolean, basis: string): Promise<HoehenIndex | null> {
  if (index && (!netz || Date.now() - index.geholt < INDEX_NEU_MS)) return index.wert;
  const abgelegt = index?.wert ?? await lies<HoehenIndex>(INDEX_SCHLUESSEL);
  if (netz) {
    try {
      const r = await fetch(`${basis}/api/vorrechnung/hoehen`, { signal: AbortSignal.timeout(10_000) });
      if (r.ok) {
        const neu = (await r.json()) as HoehenIndex;
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

function nimm(erstellt: string, k: Roh): void {
  const linien = k.linien.map((l) => {
    const { hoeheM, p } = dekodiereLinie(l, k.faktor);
    let s = Infinity, w = Infinity, n = -Infinity, o = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      if (p[i]! < s) s = p[i]!;
      if (p[i]! > n) n = p[i]!;
      if (p[i + 1]! < w) w = p[i + 1]!;
      if (p[i + 1]! > o) o = p[i + 1]!;
    }
    return { hoeheM, p, s, w, n, o };
  });
  zellen.set(k.name, { erstellt, linien, roh: k.bilder, bilder: {}, benutzt: Date.now() });
}

const hName = (landName: string) => landName.replace(/^land-/, 'hoehe-');

function holeZelle(name: string, idx: HoehenIndex, netz: boolean, basis: string): Promise<boolean> {
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


export async function ladeHoehenImGebiet(b: Box, netz: boolean, basis = API_BASIS): Promise<boolean> {
  const idx = await hoehenIndex(netz, basis);
  if (!idx) return false;
  const da = new Set(idx.kacheln);
  const namen = landKachelnFuerBox(b).map((k) => hName(k.name)).filter((n) => da.has(n));
  const neu = await Promise.all(namen.map((n) => holeZelle(n, idx, netz, basis).catch(() => false)));
  return neu.some(Boolean);
}

async function entpacke(b64: string): Promise<Bild> {
  const bin = atob(b64);
  const roh = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) roh[i] = bin.charCodeAt(i);
  const blob = new Blob([roh], { type: 'image/webp' });
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}


export async function bereiteHoehenBilder(b: Box, stufe: 'z10' | 'z12'): Promise<boolean> {
  let neu = false;
  await Promise.all(landKachelnFuerBox(b).map(async (k) => {
    const name = hName(k.name);
    const z = zellen.get(name);
    if (!z || z.bilder[stufe] || !z.roh[stufe]) return;
    const schl = `${name}|${stufe}`;
    let lauf = entpackt.get(schl);
    if (!lauf) {
      lauf = entpacke(z.roh[stufe]!).then((bild) => { z.bilder[stufe] = bild; }, () => undefined)
        .finally(() => entpackt.delete(schl));
      entpackt.set(schl, lauf);
    }
    await lauf;
    
    
    if (z.bilder[stufe]) neu = true;
  }));
  if (stufe === 'z12') raeumeGross();
  return neu;
}


function raeumeGross(): void {
  const mit = [...zellen.values()].filter((z) => z.bilder.z12).sort((a, b) => b.benutzt - a.benutzt);
  for (const z of mit.slice(GROSS_HOECHSTENS)) {
    const bild = z.bilder.z12;
    if (bild && 'close' in bild) bild.close();
    delete z.bilder.z12;
  }
}


export function hoehenJetzt(landName: string, stufe: 'z10' | 'z12'): { linien: Linie[]; bild: Bild | null } | null {
  const z = zellen.get(hName(landName));
  if (!z) return null;
  z.benutzt = Date.now();
  return { linien: z.linien, bild: z.bilder[stufe] ?? null };
}


export function _vergessen(): void {
  db = null; offen = null; index = null; zellen.clear(); unterwegs.clear(); entpackt.clear();
}
