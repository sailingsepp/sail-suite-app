import type { VorrechnungManifest } from '@/core/vorrechnung';
import { boxUm, type Box } from '@/core/landumfahrung';
import type { MoleRoh } from '@/core/molen';
import type { Punkt } from '@/core/types';
import { landKachelnFuerBox } from '@/core/kartenKacheln';
import { dekodiereSteg, type KartenName, type OrtsArt, type SeekartenPaket, type StegArt, type StrassenKlasse, type VerkehrArt } from '@/core/seekartenObjekte';
import { API_BASIS } from '@/shell/api';

const DB_NAME = 'sail-suite-seekarte';
const STORE = 'pakete';
const MANIFEST_NEU_MS = 6 * 3600_000;

export interface Steg { art: StegArt; flaeche: boolean; breiteM: number | null; p: Float64Array; s: number; w: number; n: number; o: number }

export interface Ortsflaeche { art: OrtsArt; ringe: Float64Array[]; s: number; w: number; n: number; o: number }

export interface Strasse { klasse: StrassenKlasse; p: Float64Array; s: number; w: number; n: number; o: number }

export interface Piste { breiteM: number | null; p: Float64Array; s: number; w: number; n: number; o: number }

export interface Verkehrsweg { art: VerkehrArt; flaeche: boolean; p: Float64Array; s: number; w: number; n: number; o: number }

interface Geladen {
  paket: SeekartenPaket;
  stegeJe?: Map<string, Steg[]>; orteJe?: Map<string, Ortsflaeche[]>; strassenJe?: Map<string, Strasse[]>;
  pistenJe?: Map<string, Piste[]>; verkehrJe?: Map<string, Verkehrsweg[]>;
}

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;
let manifest: { wert: VorrechnungManifest; geholt: number } | null = null;
const geladen = new Map<string, Geladen>();
let alleAbgelegt: Promise<SeekartenPaket[]> | null = null;
const laeuft = new Map<string, Promise<boolean>>();

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

function abgelegt(): Promise<SeekartenPaket[]> {
  if (alleAbgelegt) return alleAbgelegt;
  alleAbgelegt = (async () => {
    const d = await oeffne();
    if (!d) return [];
    try {
      return await new Promise<SeekartenPaket[]>((res, rej) => {
        const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        q.onsuccess = () => res((q.result as SeekartenPaket[] | undefined) ?? []);
        q.onerror = () => rej(q.error);
      });
    } catch { return []; }
  })();
  return alleAbgelegt;
}

async function lege(p: SeekartenPaket): Promise<void> {
  alleAbgelegt = null;
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(p, p.revier);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {  }
}

function gueltig(x: unknown): x is SeekartenPaket {
  const p = x as SeekartenPaket | null;
  return !!p && typeof p.revier === 'string' && typeof p.erstellt === 'string' && Array.isArray(p.stege) && Array.isArray(p.namen);
}

function einordnen<T extends { s: number; w: number; n: number; o: number }>(je: Map<string, T[]>, x: T): void {
  for (const z of landKachelnFuerBox({ swLat: x.s, swLon: x.w, neLat: x.n, neLon: x.o })) {
    const l = je.get(z.name);
    if (l) l.push(x); else je.set(z.name, [x]);
  }
}

function rahmenRoh(ks: readonly (readonly number[])[], faktor: number): { s: number; w: number; n: number; o: number } {
  let s = Infinity, w = Infinity, n = -Infinity, o = -Infinity;
  for (const k of ks) {
    let lat = 0, lon = 0;
    for (let i = 0; i < k.length; i += 2) {
      lat += k[i]!; lon += k[i + 1]!;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
      if (lon < w) w = lon;
      if (lon > o) o = lon;
    }
  }
  return { s: s / faktor, w: w / faktor, n: n / faktor, o: o / faktor };
}

function mitPunkten<T extends object>(x: T, k: readonly number[], faktor: number): T & { p: Float64Array } {
  let p: Float64Array | null = null;
  return Object.defineProperty(x, 'p', { enumerable: true, get: () => (p ??= dekodiereSteg(k, faktor)) }) as T & { p: Float64Array };
}

function je<T extends { s: number; w: number; n: number; o: number }>(liste: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of liste) einordnen(m, x);
  return m;
}

const STEGE = (g: Geladen): Map<string, Steg[]> => (g.stegeJe ??= je(g.paket.stege.map(([art, fl, dm, k]) =>
  mitPunkten({ art, flaeche: fl === 1, breiteM: dm ? dm / 10 : null, ...rahmenRoh([k], g.paket.faktor) }, k, g.paket.faktor))));
const ORTE = (g: Geladen): Map<string, Ortsflaeche[]> => (g.orteJe ??= je((g.paket.orte ?? []).map(([art, ringe]) => {
  let r: Float64Array[] | null = null;
  const f = g.paket.faktor;
  return Object.defineProperty({ art, ...rahmenRoh(ringe, f) }, 'ringe', {
    enumerable: true, get: () => (r ??= ringe.map((k) => dekodiereSteg(k, f))),
  }) as Ortsflaeche;
})));
const STRASSEN = (g: Geladen): Map<string, Strasse[]> => (g.strassenJe ??= je((g.paket.strassen ?? []).map(([klasse, k]) =>
  mitPunkten({ klasse, ...rahmenRoh([k], g.paket.faktor) }, k, g.paket.faktor))));
const PISTEN = (g: Geladen): Map<string, Piste[]> => (g.pistenJe ??= je((g.paket.pisten ?? []).map(([dm, k]) =>
  mitPunkten({ breiteM: dm ? dm / 10 : null, ...rahmenRoh([k], g.paket.faktor) }, k, g.paket.faktor))));
const VERKEHR = (g: Geladen): Map<string, Verkehrsweg[]> => (g.verkehrJe ??= je((g.paket.verkehr ?? []).map(([art, fl, k]) =>
  mitPunkten({ art, flaeche: fl === 1, ...rahmenRoh([k], g.paket.faktor) }, k, g.paket.faktor))));

function nimm(p: SeekartenPaket): void {
  const da = geladen.get(p.revier);
  if (!da || da.paket.erstellt < p.erstellt) geladen.set(p.revier, { paket: p });
}

const schneidet = (bb: readonly number[], b: Box) => !(bb[0]! > b.neLon || bb[2]! < b.swLon || bb[1]! > b.neLat || bb[3]! < b.swLat);

async function holeManifest(netz: boolean, basis: string): Promise<VorrechnungManifest | null> {
  if (manifest && (!netz || Date.now() - manifest.geholt < MANIFEST_NEU_MS)) return manifest.wert;
  if (!netz) return manifest?.wert ?? null;
  try {
    const r = await fetch(`${basis}/api/vorrechnung/manifest`, { signal: AbortSignal.timeout(10_000) });
    if (r.ok) manifest = { wert: (await r.json()) as VorrechnungManifest, geholt: Date.now() };
  } catch {  }
  return manifest?.wert ?? null;
}

export function ladeSeekartenObjekte(b: Box, netz: boolean, basis = API_BASIS): Promise<boolean> {
  const schluessel = `${netz}|${Math.floor(b.swLat)}|${Math.floor(b.swLon)}|${Math.floor(b.neLat)}|${Math.floor(b.neLon)}`;
  const da = laeuft.get(schluessel);
  if (da) return da;
  const lauf = (async () => {
    const vorher = [...geladen.values()].map((g) => `${g.paket.revier}|${g.paket.erstellt}`).join(',');
    for (const p of await abgelegt()) if (schneidet(p.bbox, b)) nimm(p);
    const m = await holeManifest(netz, basis);
    for (const e of m?.reviere ?? []) {
      if (!e.seekarte || !schneidet(e.bbox, b)) continue;
      const hier = geladen.get(e.id);
      if (hier && hier.paket.erstellt >= (e.seekarteErstellt ?? '')) continue;
      if (!netz) continue;
      try {
        const r = await fetch(`${basis}/api/vorrechnung/${encodeURIComponent(e.seekarte.replace(/\.json$/, ''))}`, { signal: AbortSignal.timeout(60_000) });
        if (!r.ok) continue;
        const p: unknown = await r.json();
        if (!gueltig(p)) continue;
        nimm(p);
        await lege(p);
      } catch {  }
    }
    return [...geladen.values()].map((g) => `${g.paket.revier}|${g.paket.erstellt}`).join(',') !== vorher;
  })().finally(() => laeuft.delete(schluessel));
  laeuft.set(schluessel, lauf);
  return lauf;
}

export function stegeJetzt(b: Box): Steg[] {
  const aus = new Set<Steg>();
  for (const z of landKachelnFuerBox(b)) {
    for (const g of geladen.values()) {
      for (const s of STEGE(g).get(z.name) ?? []) {
        if (s.n >= b.swLat && s.s <= b.neLat && s.o >= b.swLon && s.w <= b.neLon) aus.add(s);
      }
    }
  }
  return [...aus];
}

export async function molenUm(punkte: readonly Punkt[], randSm: number): Promise<MoleRoh[]> {
  const netz = typeof navigator === 'undefined' || navigator.onLine !== false;
  const aus = new Set<Steg>();
  for (const p of punkte) {
    const b = boxUm([p], randSm);
    await ladeSeekartenObjekte(b, netz).catch(() => false);
    for (const s of stegeJetzt(b)) if (s.art !== 'quay') aus.add(s);
  }
  return [...aus].map((s) => ({ flaeche: s.flaeche, p: s.p }));
}

function imAusschnitt<T extends { s: number; w: number; n: number; o: number }>(b: Box, je: (g: Geladen) => Map<string, T[]>): T[] {
  const aus = new Set<T>();
  for (const z of landKachelnFuerBox(b)) {
    for (const g of geladen.values()) {
      for (const x of je(g).get(z.name) ?? []) {
        if (x.n >= b.swLat && x.s <= b.neLat && x.o >= b.swLon && x.w <= b.neLon) aus.add(x);
      }
    }
  }
  return [...aus];
}

export function ortsflaechenJetzt(b: Box): Ortsflaeche[] { return imAusschnitt(b, ORTE); }
export function strassenJetzt(b: Box): Strasse[] { return imAusschnitt(b, STRASSEN); }
export function pistenJetzt(b: Box): Piste[] { return imAusschnitt(b, PISTEN); }
export function verkehrJetzt(b: Box): Verkehrsweg[] { return imAusschnitt(b, VERKEHR); }

export function namenJetzt(b: Box): KartenName[] {
  const aus: KartenName[] = [];
  const gesehen = new Set<string>();
  for (const g of geladen.values()) {
    if (!schneidet(g.paket.bbox, b)) continue;
    for (const x of g.paket.namen) {
      if (x[0] < b.swLat || x[0] > b.neLat || x[1] < b.swLon || x[1] > b.neLon) continue;
      const k = `${x[2]}|${x[3]}|${x[0].toFixed(3)}|${x[1].toFixed(3)}`;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      aus.push(x);
    }
  }
  return aus;
}

export function _vergessen(): void {
  db = null; offen = null; manifest = null; geladen.clear(); alleAbgelegt = null; laeuft.clear();
}
