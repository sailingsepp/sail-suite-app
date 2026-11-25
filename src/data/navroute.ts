import type { Punkt } from '@/core/types';
import { boxUm, randFuer, randZweiterVersuch, umfahreLand, liegtAnLand, TEILUNG_TIEFE, type Box } from '@/core/landumfahrung';
import { ohneMolen } from '@/core/molen';
import { hafenDaten } from './umfahrung';
import { gefahrAlsKueste, pruefeGefahren, ohneStummel, planStart, type Gefahr, type GefahrenBefund } from '@/core/navigation';
import { kreuzungsZahl, sampleRoute } from '@/core/geo';
import { kuestenlinienUmGebiet, queryOverpass, type OverpassElement } from './overpass';
import { fetchTiefenprofil } from './bathymetrie';
import { liegtImWasser } from './landcheck';
import { ladeHoheitImGebiet } from './hoheitKacheln';
import { vtgInBox, vtgAlsKueste, quertVtg } from '@/core/messinaVtg';

const KACHEL_GRAD = 0.25;
const DB = 'sail-suite-nav';
const STORE = 'gefahren';

const GEFAHREN_VERSION = 2;
const GEFAHREN_VERSION_ALT = 1;
export const GEFAHREN_ARTEN = ['rock', 'wreck', 'obstruction'] as const;

function oeffne(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const a = indexedDB.open(DB, 1);
      a.onupgradeneeded = () => a.result.createObjectStore(STORE);
      a.onsuccess = () => res(a.result);
      a.onerror = () => res(null);
      a.onblocked = () => res(null);
    } catch { res(null); }
  });
}

async function lies<T>(k: string): Promise<T | null> {
  const db = await oeffne();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const q = db.transaction(STORE, 'readonly').objectStore(STORE).get(k);
      q.onsuccess = () => { db.close(); res((q.result as T | undefined) ?? null); };
      q.onerror = () => { db.close(); res(null); };
    } catch { db.close(); res(null); }
  });
}

async function schreibe(k: string, v: unknown): Promise<void> {
  const db = await oeffne();
  if (!db) return;
  await new Promise<void>((res) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(v, k);
      tx.oncomplete = () => { db.close(); res(); };
      tx.onerror = () => { db.close(); res(); };
    } catch { db.close(); res(); }
  });
}

function kachelnFuer(b: Box): { i: number; j: number }[] {
  const aus: { i: number; j: number }[] = [];
  for (let i = Math.floor(b.swLat / KACHEL_GRAD); i <= Math.floor(b.neLat / KACHEL_GRAD); i++) {
    for (let j = Math.floor(b.swLon / KACHEL_GRAD); j <= Math.floor(b.neLon / KACHEL_GRAD); j++) aus.push({ i, j });
  }
  return aus;
}

export const GEFAHREN_KORRIDOR_SM = 2;

export function kachelnEntlang(punkte: readonly Punkt[], pufferSm = GEFAHREN_KORRIDOR_SM): { i: number; j: number }[] {
  const gesehen = new Set<string>();
  const aus: { i: number; j: number }[] = [];
  const proben = punkte.length > 1 ? sampleRoute([...punkte], Math.max(0.5, pufferSm / 2)) : punkte;
  for (const q of proben) {
    for (const k of kachelnFuer(boxUm([q], pufferSm))) {
      const s = `${k.i}:${k.j}`;
      if (!gesehen.has(s)) { gesehen.add(s); aus.push(k); }
    }
  }
  return aus;
}

function alsGefahr(e: OverpassElement): Gefahr | null {
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  const art = e.tags?.['seamark:type'];
  if (lat == null || lon == null || !art) return null;

  if (art === 'rock' && e.tags?.['seamark:rock:water_level'] === 'always_dry') return null;
  const merkmale: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.tags ?? {})) if (k.startsWith('seamark:') || k === 'depth' || k === 'description') merkmale[k] = v;
  return { lat, lon, art, name: e.tags?.['seamark:name'] ?? e.tags?.name ?? '', merkmale };
}

async function gefahrenKachel(i: number, j: number, nurAblage: boolean): Promise<Gefahr[] | null> {
  const k = `v${GEFAHREN_VERSION}:${i}:${j}`;
  const neu = await lies<Gefahr[]>(k);
  if (neu) return neu;
  const alt = await lies<Gefahr[]>(`v${GEFAHREN_VERSION_ALT}:${i}:${j}`);
  if (nurAblage) return alt;
  const s = i * KACHEL_GRAD, w = j * KACHEL_GRAD, n = s + KACHEL_GRAD, o = w + KACHEL_GRAD;
  const art = GEFAHREN_ARTEN.join('|');
  const ql = `[out:json][timeout:25];(node["seamark:type"~"^(${art})$"](${s},${w},${n},${o});`
    + `way["seamark:type"~"^(${art})$"](${s},${w},${n},${o}););out center tags;`;
  try {
    const el = await queryOverpass(ql, 20_000);
    const g = el.map(alsGefahr).filter((x): x is Gefahr => x !== null);
    await schreibe(k, g);
    return g;
  } catch {
    return alt;
  }
}

export interface GefahrenAbfrage {
  gefahren: Gefahr[];

  unvollstaendig: boolean;
}

export async function gefahrenImGebiet(b: Box, nurAblage = !navigator.onLine): Promise<GefahrenAbfrage> {
  const g = await gefahrenInKacheln(kachelnFuer(b), nurAblage);
  return { gefahren: g.gefahren.filter((x) => x.lat >= b.swLat && x.lat <= b.neLat && x.lon >= b.swLon && x.lon <= b.neLon), unvollstaendig: g.unvollstaendig };
}

export function gefahrenEntlang(
  punkte: readonly Punkt[], fortschritt?: (n: number, von: number) => void, nurAblage = !navigator.onLine,
): Promise<GefahrenAbfrage> {
  return gefahrenInKacheln(kachelnEntlang(punkte), nurAblage, fortschritt);
}

async function gefahrenInKacheln(
  kacheln: readonly { i: number; j: number }[], nurAblage: boolean, fortschritt?: (n: number, von: number) => void,
): Promise<GefahrenAbfrage> {
  const gefahren: Gefahr[] = [];
  let unvollstaendig = false;

  const ergebnisse: (Gefahr[] | null)[] = [];
  fortschritt?.(0, kacheln.length);
  for (let k = 0; k < kacheln.length; k += 4) {
    ergebnisse.push(...await Promise.all(kacheln.slice(k, k + 4).map(({ i, j }) => gefahrenKachel(i, j, nurAblage))));
    fortschritt?.(ergebnisse.length, kacheln.length);
  }
  for (const g of ergebnisse) {
    if (g === null) { unvollstaendig = true; continue; }
    gefahren.push(...g);
  }
  return { gefahren, unvollstaendig };
}

export interface RoutenDaten {
  kueste: [Punkt, Punkt][] | null;

  kuesteVereinfacht: boolean;
  gefahren: Gefahr[];
  gefahrenUnvollstaendig: boolean;
  box: Box;
}

function routenBox(punkte: readonly Punkt[]): Box {
  let rand = 2;
  for (let i = 1; i < punkte.length; i++) rand = Math.max(rand, randFuer(punkte[i - 1]!, punkte[i]!));
  return boxUm(punkte, rand);
}

export async function ladeRoutenDaten(punkte: readonly Punkt[]): Promise<RoutenDaten> {
  const box = routenBox(punkte);
  const [k, g] = await Promise.all([
    kuestenlinienUmGebiet(box.swLat, box.swLon, box.neLat, box.neLon).catch(() => null),
    gefahrenEntlang(punkte),
  ]);
  return {
    kueste: k?.linien ?? null, kuesteVereinfacht: !!k?.rueckfall,
    gefahren: g.gefahren, gefahrenUnvollstaendig: g.unvollstaendig, box,
  };
}

export async function startAusPosition(p: Punkt): Promise<{ punkt: Punkt; ausfahrt: boolean } | null> {
  const box = boxUm([p], 3.5);
  const [k, osm] = await Promise.all([
    kuestenlinienUmGebiet(box.swLat, box.swLon, box.neLat, box.neLon).catch(() => null),
    queryOverpass(hafenAbfrage(p), 15_000).catch(() => [] as OverpassElement[]),
  ]);
  if (k?.linien.length) return planStart(p, k.linien, hafenAusOsm(osm));

  return (await liegtImWasser(p).catch(() => false)) ? { punkt: p, ausfahrt: false } : null;
}

export function hafenAbfrage(p: Punkt): string {
  const um = `around:1000,${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
  return `[out:json][timeout:20];(way(${um})[leisure=marina];way(${um})["seamark:type"="harbour"];`
    + `way(${um})[man_made~"^(pier|breakwater|groyne|quay)$"];);out tags geom;`;
}

export function hafenAusOsm(els: readonly OverpassElement[]): { flaechen: Punkt[][]; molen: [Punkt, Punkt][] } {
  const flaechen: Punkt[][] = [], molen: [Punkt, Punkt][] = [];
  for (const e of els) {
    const g = e.geometry, t = e.tags ?? {};
    if (e.type !== 'way' || !g || g.length < 2) continue;
    const punkte = g.map((q) => ({ lat: q.lat, lon: q.lon }));
    const geschlossen = punkte.length >= 4 && punkte[0]!.lat === punkte.at(-1)!.lat && punkte[0]!.lon === punkte.at(-1)!.lon;
    if (t['man_made']) for (let i = 1; i < punkte.length; i++) molen.push([punkte[i - 1]!, punkte[i]!]);
    else if (geschlossen && (t['leisure'] === 'marina' || t['seamark:type'] === 'harbour')) flaechen.push(punkte);
  }
  return { flaechen, molen };
}

export interface RoutenPlan {
  punkte: Punkt[];

  gerade: boolean;

  ohneWeg: boolean;
  daten: RoutenDaten;
}

export const ABSTAENDE_SM = [0.1, 0.2, 0.3, 0.5] as const;

export type PlanSchritt = { phase: 'kueste' } | { phase: 'gefahren'; n: number; von: number } | { phase: 'weg' };

export async function planeRoute(
  a: Punkt, b: Punkt, abstandSm: number, melde?: (s: PlanSchritt) => void,

  vorlaeufig?: (punkte: Punkt[]) => void,
): Promise<RoutenPlan> {
  melde?.({ phase: 'kueste' });
  let box = routenBox([a, b]);

  const hafenLauf = hafenDaten([a, b]).catch(() => ({ kueste: [] as [Punkt, Punkt][], molen: [] as [Punkt, Punkt][] }));
  let k = await kuestenlinienUmGebiet(box.swLat, box.swLon, box.neLat, box.neLon).catch(() => null);
  let kueste = k?.linien ?? null;
  let vtg = vtgInBox(box) ? vtgAlsKueste() : null;
  let rand: number | undefined;
  const weg = (sperre: [Punkt, Punkt][]): { punkte: Punkt[]; umfahren: boolean } | null => {
    if (!sperre.length && !vtg) return { punkte: [a, b], umfahren: false };
    return (vtg && umfahreLand(a, b, [...sperre, ...vtg], TEILUNG_TIEFE, rand ?? randFuer(a, b), true))
      || (sperre.length ? umfahreLand(a, b, sperre, TEILUNG_TIEFE, rand) : { punkte: [a, b], sm: 0, umfahren: false });
  };
  melde?.({ phase: 'weg' });
  let u0 = weg([...(kueste ?? [])]);

  if (!u0 && kueste) {
    const rand2 = randZweiterVersuch(a, b);
    const box2 = boxUm([a, b], rand2);
    const k2 = await kuestenlinienUmGebiet(box2.swLat, box2.swLon, box2.neLat, box2.neLon).catch(() => null);
    if (k2) {
      const vorher = { box, k, kueste, vtg, rand };
      box = box2; k = k2; kueste = k2.linien; vtg = vtgInBox(box2) ? vtgAlsKueste() : null; rand = rand2;
      u0 = weg([...kueste]);
      if (!u0) ({ box, k, kueste, vtg, rand } = vorher);
    }
  }
  const hafen = await hafenLauf;

  const durchHafen = <T extends { punkte: Punkt[]; umfahren: boolean }>(x: T | null): T | null => {
    if (!x || (!hafen.molen.length && !hafen.kueste.length)) return x;
    const punkte = ohneMolen(x.punkte, [...hafen.kueste, ...(vtg ?? [])], hafen.molen);
    return punkte.length === x.punkte.length && punkte.every((p, i) => p === x.punkte[i]) ? x : { ...x, punkte, umfahren: true };
  };
  u0 = durchHafen(u0);
  const hafenSperre = [...hafen.kueste, ...hafen.molen];
  if (u0) vorlaeufig?.(ohneStummel(u0.punkte, hafenSperre));
  const g0 = await gefahrenEntlang(u0?.punkte ?? [a, b], (n, von) => melde?.({ phase: 'gefahren', n, von }));
  melde?.({ phase: 'weg' });
  const sperre: [Punkt, Punkt][] = [...(kueste ?? [])];
  for (const g of g0.gefahren) sperre.push(...gefahrAlsKueste(g, abstandSm));

  const u = (g0.gefahren.length ? durchHafen(weg(sperre)) : null) ?? u0;

  const g1 = u ? await gefahrenEntlang(u.punkte) : g0;
  const gefahren = new Map<string, Gefahr>();
  for (const g of [...g0.gefahren, ...g1.gefahren]) gefahren.set(`${g.lat},${g.lon},${g.art}`, g);
  const daten: RoutenDaten = {
    kueste, kuesteVereinfacht: !!k?.rueckfall, gefahren: [...gefahren.values()],
    gefahrenUnvollstaendig: g0.unvollstaendig || g1.unvollstaendig, box,
  };
  if (!u) return { punkte: [a, b], gerade: false, ohneWeg: true, daten };
  return { punkte: ohneStummel(u.punkte, hafenSperre), gerade: !u.umfahren, ohneWeg: false, daten };
}

export interface RoutenPruefung {
  gefahr: GefahrenBefund;

  ueberLand: number[];

  durchVtg: number[];
}

export function pruefeRoute(punkte: readonly Punkt[], daten: RoutenDaten): RoutenPruefung {
  const ueberLand: number[] = [];
  if (daten.kueste) {
    const startAnLand = punkte.length > 1 && liegtAnLand(punkte[0]!, daten.kueste);
    const zielAnLand = punkte.length > 1 && liegtAnLand(punkte[punkte.length - 1]!, daten.kueste);
    for (let s = 1; s < punkte.length; s++) {
      const n = kreuzungsZahl(punkte[s - 1]!, punkte[s]!, daten.kueste);
      const erwartet = (s === 1 && startAnLand ? 1 : 0) + (s === punkte.length - 1 && zielAnLand ? 1 : 0);
      if (n !== erwartet) ueberLand.push(s - 1);
    }
  }
  const durchVtg: number[] = [];
  if (vtgInBox(daten.box)) for (let s = 1; s < punkte.length; s++) if (quertVtg(punkte[s - 1]!, punkte[s]!)) durchVtg.push(s - 1);
  return { gefahr: pruefeGefahren(punkte, daten.gefahren), ueberLand, durchVtg };
}

export const TIEFE_HAFEN_SM = 0.3;

export interface Untiefe { m: number; lat: number; lon: number; sm: number }

export async function flachsteStelle(punkte: readonly Punkt[]): Promise<Untiefe | null> {
  if (punkte.length < 2) return null;
  const probe = sampleRoute([...punkte], 0.2);
  const p = await fetchTiefenprofil(probe).catch(() => null);
  if (!p) return null;
  const gesamt = probe.at(-1)?.cum ?? 0;
  let best: Untiefe | null = null;

  p.punkte.forEach((q, i) => {
    if (q.tiefeM === null || q.cum < TIEFE_HAFEN_SM || q.cum > gesamt - TIEFE_HAFEN_SM) return;
    if (best && q.tiefeM >= best.m) return;
    const o = probe[i]!;
    best = { m: q.tiefeM, lat: o.lat, lon: o.lon, sm: q.cum };
  });
  return best;
}

export async function ladeNavDatenVor(b: Box): Promise<{ kueste: boolean; gefahren: boolean }> {
  const [k, g] = await Promise.all([
    kuestenlinienUmGebiet(b.swLat, b.swLon, b.neLat, b.neLon).catch(() => null),
    gefahrenImGebiet(b, false),

    ladeHoheitImGebiet(b).catch(() => false),
  ]);
  return { kueste: !!k && !k.rueckfall, gefahren: !g.unvollstaendig };
}
