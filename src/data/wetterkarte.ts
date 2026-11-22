import { nDate } from '@/core/time';
import type { Punkt } from '@/core/types';
import { feldDeckt, wetterGitter, WETTER_NEU_MS, type WetterFeld } from '@/core/wetterkarte';
import { holeOpenMeteoJson, OpenMeteoKontingent } from './openMeteoNetz';
import { FORECAST_DAYS, RECHENMODELL, VERGLEICHSMODELL } from './openMeteo';


const DB_NAME = 'sail-suite-wetter';
const STORE = 'felder';
const SCHLUESSEL = 'letztes';
const FELDER = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'weather_code', 'cape', 'lifted_index'] as const;
type Feldname = typeof FELDER[number];

let db: Promise<IDBDatabase | null> | null = null;
let imSpeicher: WetterFeld | null | undefined;

function oeffne(): Promise<IDBDatabase | null> {
  if (db) return db;
  db = new Promise((res) => {
    if (typeof indexedDB === 'undefined') { res(null); return; }
    let a: IDBOpenDBRequest;
    try { a = indexedDB.open(DB_NAME, 1); } catch { res(null); return; }
    a.onupgradeneeded = () => { if (!a.result.objectStoreNames.contains(STORE)) a.result.createObjectStore(STORE); };
    a.onsuccess = () => res(a.result);
    a.onerror = () => res(null);
    a.onblocked = () => res(null);
  });
  return db;
}


export async function abgelegtesWetter(): Promise<WetterFeld | null> {
  if (imSpeicher !== undefined) return imSpeicher;
  const d = await oeffne();
  if (!d) return (imSpeicher = null);
  try {
    imSpeicher = await new Promise<WetterFeld | null>((res, rej) => {
      const q = d.transaction(STORE, 'readonly').objectStore(STORE).get(SCHLUESSEL);
      q.onsuccess = () => res((q.result as WetterFeld | undefined) ?? null);
      q.onerror = () => rej(q.error);
    });
  } catch { imSpeicher = null; }
  return imSpeicher;
}

async function lege(f: WetterFeld): Promise<void> {
  imSpeicher = f;
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(f, SCHLUESSEL);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {  }
}

type Roh = { hourly?: Record<string, unknown> };
const hatWerte = (a: unknown): a is (number | null)[] => Array.isArray(a) && a.some((v) => v != null);


export function feldAusAntwort(roh: unknown, lats: number[], lons: number[], geholt: number): WetterFeld | null {
  const arr = (Array.isArray(roh) ? roh : [roh]) as Roh[];
  if (arr.length !== lats.length * lons.length) return null;
  const zeitText = arr[0]?.hourly?.['time'];
  if (!Array.isArray(zeitText) || !zeitText.length) return null;
  if (arr.some((a) => !Array.isArray(a.hourly?.['time']) || (a.hourly!['time'] as string[])[0] !== zeitText[0])) return null;
  const ueberall = (name: Feldname, modell: string) => arr.every((a) => hatWerte(a.hourly?.[`${name}_${modell}`]));
  const windModell = ueberall('wind_speed_10m', RECHENMODELL) && ueberall('wind_direction_10m', RECHENMODELL) ? RECHENMODELL : VERGLEICHSMODELL;
  const reihe = (name: Feldname): (number | null)[][] => {
    const modell = name.startsWith('wind_') ? windModell : (ueberall(name, RECHENMODELL) ? RECHENMODELL : VERGLEICHSMODELL);
    return arr.map((a) => {
      const r = a.hourly?.[`${name}_${modell}`] ?? a.hourly?.[name];
      return Array.isArray(r) ? r.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)) : [];
    });
  };
  const f: WetterFeld = {
    geholt, modell: windModell, lats, lons,
    zeiten: (zeitText as string[]).map((t) => nDate(t).getTime()),
    reihen: {
      wind: reihe('wind_speed_10m'), richtung: reihe('wind_direction_10m'), boeen: reihe('wind_gusts_10m'),
      regen: reihe('precipitation'), code: reihe('weather_code'), cape: reihe('cape'), li: reihe('lifted_index'),
    },
  };
  return f.reihen.wind.some((r) => r.some((v) => v !== null)) ? f : null;
}

export function wetterUrl(lats: readonly number[], lons: readonly number[]): string {
  const la: string[] = [], lo: string[] = [];
  for (const a of lats) for (const b of lons) { la.push(a.toFixed(2)); lo.push(b.toFixed(2)); }
  return 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${la.join(',')}&longitude=${lo.join(',')}`
    + `&models=${RECHENMODELL},${VERGLEICHSMODELL}&hourly=${FELDER.join(',')}`
    + `&wind_speed_unit=kn&timezone=UTC&forecast_days=${FORECAST_DAYS}&cell_selection=sea`;
}


export function stromUrl(lats: readonly number[], lons: readonly number[]): string {
  const la: string[] = [], lo: string[] = [];
  for (const a of lats) for (const b of lons) { la.push(a.toFixed(2)); lo.push(b.toFixed(2)); }
  return 'https://marine-api.open-meteo.com/v1/marine'
    + `?latitude=${la.join(',')}&longitude=${lo.join(',')}`
    + `&hourly=ocean_current_velocity,ocean_current_direction&timezone=UTC&forecast_days=${FORECAST_DAYS}&cell_selection=sea`;
}

const KMH_KN = 1 / 1.852;


export function stromAusAntwort(roh: unknown, f: Pick<WetterFeld, 'lats' | 'lons' | 'zeiten'>): { strom: (number | null)[][]; stromNach: (number | null)[][] } | null {
  const arr = (Array.isArray(roh) ? roh : [roh]) as (Roh & { latitude?: number; longitude?: number; elevation?: number })[];
  if (arr.length !== f.lats.length * f.lons.length) return null;
  const schritt = f.lats.length > 1 ? f.lats[1]! - f.lats[0]! : f.lons.length > 1 ? f.lons[1]! - f.lons[0]! : 0.25;
  const idx = new Map(f.zeiten.map((t, i) => [t, i]));
  const strom: (number | null)[][] = [], stromNach: (number | null)[][] = [];
  let irgendwo = false;
  arr.forEach((a, k) => {
    const v = new Array<number | null>(f.zeiten.length).fill(null), d = new Array<number | null>(f.zeiten.length).fill(null);
    strom.push(v); stromNach.push(d);
    const lat = f.lats[Math.floor(k / f.lons.length)]!, lon = f.lons[k % f.lons.length]!;
    
    if (typeof a?.elevation === 'number' && a.elevation > 0) return;
    if (typeof a?.latitude === 'number' && typeof a.longitude === 'number'
      && (Math.abs(a.latitude - lat) > schritt * 0.4 || Math.abs(a.longitude - lon) > schritt * 0.4)) return;
    const h = a?.hourly;
    const zeit = h?.['time'], vel = h?.['ocean_current_velocity'], dir = h?.['ocean_current_direction'];
    if (!Array.isArray(zeit) || !Array.isArray(vel) || !Array.isArray(dir)) return;
    zeit.forEach((z, q) => {
      const i = typeof z === 'string' ? idx.get(nDate(z).getTime()) : undefined;
      const x = vel[q], y = dir[q];
      if (i === undefined || typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) return;
      v[i] = x * KMH_KN; d[i] = y; irgendwo = true;
    });
  });
  return irgendwo ? { strom, stromNach } : null;
}


const stromVersucht = new Set<number>();


async function ergaenzeStrom(f: WetterFeld): Promise<boolean> {
  stromVersucht.add(f.geholt);
  try {
    const s = stromAusAntwort(await holeOpenMeteoJson(stromUrl(f.lats, f.lons), 30_000, 2), f);
    if (!s) return false;
    f.reihen.strom = s.strom; f.reihen.stromNach = s.stromNach;
    return true;
  } catch { return false; }
}


export type WetterLaden = { feld: WetterFeld | null; neu: boolean; fehler?: 'kontingent' | 'netz' | 'ohneOrt' };


export async function ladeWetterkarte(punkte: readonly Punkt[], netz: boolean, jetzt = Date.now()): Promise<WetterLaden> {
  const alt = await abgelegtesWetter();
  if (!punkte.length) return alt ? { feld: alt, neu: false } : { feld: null, neu: false, fehler: 'ohneOrt' };
  if (alt && feldDeckt(alt, punkte) && jetzt - alt.geholt < WETTER_NEU_MS) {
    
    if (netz && !alt.reihen.strom && !stromVersucht.has(alt.geholt) && await ergaenzeStrom(alt)) await lege(alt);
    return { feld: alt, neu: false };
  }
  if (!netz) return { feld: alt, neu: false, fehler: 'netz' };
  const { lats, lons } = wetterGitter(punkte);
  try {
    const roh = await holeOpenMeteoJson(wetterUrl(lats, lons), 30_000, 2);
    const f = feldAusAntwort(roh, lats, lons, jetzt);
    if (!f) return { feld: alt, neu: false, fehler: 'netz' };
    await ergaenzeStrom(f);
    await lege(f);
    return { feld: f, neu: true };
  } catch (e) {
    return { feld: alt, neu: false, fehler: e instanceof OpenMeteoKontingent ? 'kontingent' : 'netz' };
  }
}


export function _vergessen(): void { db = null; imSpeicher = undefined; stromVersucht.clear(); }
