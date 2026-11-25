import type { Punkt } from './types';
import { punktBei } from './routenGrenzen';
import { bearingDeg, distNM } from './geo';

export const WETTER_SCHRITT_GRAD = 0.25;

export const WETTER_RAND_GRAD = 0.75;
export const WETTER_RAND_OHNE_ROUTE_GRAD = 1.5;

export const WETTER_MAX_PUNKTE = 200;

export const WETTER_NEU_MS = 3 * 3600_000;

export type WetterEbene = 'wind' | 'boeen' | 'regen' | 'gewitter' | 'blitze' | 'strom';
export type GewitterStufe = 'gewitter' | 'neigung';

export interface WetterFeld {

  geholt: number;

  modell: 'ecmwf_ifs025' | 'best_match';

  lats: number[];
  lons: number[];

  zeiten: number[];
  reihen: {
    wind: (number | null)[][];
    richtung: (number | null)[][];
    boeen: (number | null)[][];
    regen: (number | null)[][];
    code: (number | null)[][];
    cape: (number | null)[][];
    li: (number | null)[][];

    strom?: (number | null)[][];
    stromNach?: (number | null)[][];
  };
}

const aufRaster = (x: number, s: number, auf: boolean) => (auf ? Math.ceil(x / s - 1e-9) : Math.floor(x / s + 1e-9)) * s;
const rund = (x: number) => Math.round(x * 1e4) / 1e4;

export function wetterGitter(
  punkte: readonly Punkt[], rand = punkte.length > 1 ? WETTER_RAND_GRAD : WETTER_RAND_OHNE_ROUTE_GRAD,
  schritt = WETTER_SCHRITT_GRAD, max = WETTER_MAX_PUNKTE,
): { lats: number[]; lons: number[]; schritt: number } {
  let s = Infinity, n = -Infinity, w = Infinity, o = -Infinity;
  for (const p of punkte) {
    s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); o = Math.max(o, p.lon);
  }
  for (let g = schritt; ; g *= 2) {
    const s0 = aufRaster(Math.max(-80, s - rand), g, false), n0 = aufRaster(Math.min(80, n + rand), g, true);
    const w0 = aufRaster(w - rand, g, false), o0 = aufRaster(o + rand, g, true);
    const nLat = Math.round((n0 - s0) / g) + 1, nLon = Math.round((o0 - w0) / g) + 1;
    if (nLat * nLon <= max || g >= 4) {
      return {
        lats: Array.from({ length: nLat }, (_, i) => rund(s0 + i * g)),
        lons: Array.from({ length: nLon }, (_, j) => rund(w0 + j * g)),
        schritt: g,
      };
    }
  }
}

export function feldDeckt(f: Pick<WetterFeld, 'lats' | 'lons'>, punkte: readonly Punkt[]): boolean {
  const s = f.lats[0], n = f.lats.at(-1), w = f.lons[0], o = f.lons.at(-1);
  if (s === undefined || n === undefined || w === undefined || o === undefined) return false;
  return punkte.every((p) => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= o);
}

export function ersteStunde(zeiten: readonly number[], jetzt: number): number {
  const i = zeiten.findIndex((t) => t >= jetzt - 30 * 60_000);
  return i < 0 ? Math.max(0, zeiten.length - 1) : i;
}

type Ecke = { k: number; g: number };
function ecken(f: Pick<WetterFeld, 'lats' | 'lons'>, lat: number, lon: number): Ecke[] | null {
  const { lats, lons } = f;
  if (lats.length < 2 || lons.length < 2) return null;
  if (lat < lats[0]! || lat > lats.at(-1)! || lon < lons[0]! || lon > lons.at(-1)!) return null;
  let i = 0; while (i < lats.length - 2 && lat >= lats[i + 1]!) i++;
  let j = 0; while (j < lons.length - 2 && lon >= lons[j + 1]!) j++;
  const ty = (lat - lats[i]!) / (lats[i + 1]! - lats[i]!), tx = (lon - lons[j]!) / (lons[j + 1]! - lons[j]!);
  const m = lons.length;
  return [
    { k: i * m + j, g: (1 - ty) * (1 - tx) }, { k: i * m + j + 1, g: (1 - ty) * tx },
    { k: (i + 1) * m + j, g: ty * (1 - tx) }, { k: (i + 1) * m + j + 1, g: ty * tx },
  ];
}

function gewichtet(e: Ecke[], reihe: (number | null)[][], t: number): number | null {
  let summe = 0, gs = 0;
  for (const { k, g } of e) {
    const v = reihe[k]?.[t];
    if (typeof v !== 'number' || !Number.isFinite(v) || g <= 0) continue;
    summe += v * g; gs += g;
  }
  return gs > 0 ? summe / gs : null;
}

export interface WetterAmPunkt {
  kn: number;

  von: number;
  boeenKn: number | null;
  regenMm: number | null;
  gewitter: GewitterStufe | null;
}

export function wetterAn(f: WetterFeld, t: number, lat: number, lon: number): WetterAmPunkt | null {
  const e = ecken(f, lat, lon);
  if (!e) return null;
  const kn = gewichtet(e, f.reihen.wind, t);
  if (kn === null) return null;
  let x = 0, y = 0;
  for (const { k, g } of e) {
    const d = f.reihen.richtung[k]?.[t], s = f.reihen.wind[k]?.[t];
    if (typeof d !== 'number' || typeof s !== 'number') continue;
    x += Math.sin((d * Math.PI) / 180) * s * g;
    y += Math.cos((d * Math.PI) / 180) * s * g;
  }
  const von = x === 0 && y === 0 ? (gewichtet(e, f.reihen.richtung, t) ?? 0) : ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const naechste = e.reduce((a, b) => (b.g > a.g ? b : a)).k;
  return {
    kn, von, boeenKn: gewichtet(e, f.reihen.boeen, t), regenMm: gewichtet(e, f.reihen.regen, t),
    gewitter: gewitterStufe(f.reihen.code[naechste]?.[t] ?? null, f.reihen.cape[naechste]?.[t] ?? null, f.reihen.li[naechste]?.[t] ?? null),
  };
}

export function stromAn(f: WetterFeld, t: number, lat: number, lon: number): { speed: number; dir: number; valid: true } | null {
  const e = ecken(f, lat, lon);
  const kn = f.reihen.strom, nach = f.reihen.stromNach;
  if (!e || !kn || !nach) return null;
  let x = 0, y = 0, gs = 0;
  for (const { k, g } of e) {
    const v = kn[k]?.[t], d = nach[k]?.[t];
    if (typeof v !== 'number' || typeof d !== 'number' || g <= 0) continue;
    x += Math.sin((d * Math.PI) / 180) * v * g;
    y += Math.cos((d * Math.PI) / 180) * v * g;
    gs += g;
  }
  if (gs <= 0) return null;
  x /= gs; y /= gs;
  return { speed: Math.hypot(x, y), dir: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360, valid: true };
}

export const GEWITTER_CAPE = 1000;
export const GEWITTER_LI_GEDECKELT = 2;
export function gewitterStufe(code: number | null, cape: number | null, li: number | null): GewitterStufe | null {
  if (code !== null && code >= 95) return 'gewitter';
  if (cape !== null && cape >= GEWITTER_CAPE && (li === null || li <= GEWITTER_LI_GEDECKELT)) return 'neigung';
  return null;
}

export const STARKREGEN_MM = 5;

type RGB = [number, number, number];

export const WIND_STUFEN: readonly [number, RGB][] = [
  [0, [70, 110, 180]], [7, [45, 168, 160]], [11, [120, 190, 90]], [17, [232, 197, 71]],
  [22, [242, 169, 59]], [28, [225, 88, 75]], [34, [180, 50, 120]], [48, [110, 40, 150]],
];

export const REGEN_STUFEN: readonly [number, RGB, number][] = [
  [0.1, [160, 210, 240], 0.4], [1, [80, 160, 230], 0.5], [2, [40, 100, 210], 0.55],
  [STARKREGEN_MM, [120, 60, 200], 0.6], [10, [200, 40, 160], 0.65],
];

export const STROM_STUFEN: readonly [number, RGB][] = [
  [0, [70, 95, 150]], [0.5, [25, 140, 150]], [1, [120, 190, 90]], [1.5, [232, 197, 71]],
  [2, [242, 169, 59]], [3, [225, 88, 75]], [4, [180, 50, 120]], [5, [110, 40, 150]],
];
export const GEWITTER_FARBE: Record<GewitterStufe, [RGB, number]> = {
  neigung: [[242, 169, 59], 0.45], gewitter: [[225, 50, 75], 0.6],
};

function zwischen<T extends readonly unknown[]>(stufen: readonly (readonly [number, RGB, ...T])[], v: number): { rgb: RGB; i: number; f: number } {
  if (v <= stufen[0]![0]) return { rgb: stufen[0]![1], i: 0, f: 0 };
  for (let i = 1; i < stufen.length; i++) {
    const [a, ca] = stufen[i - 1]!, [b, cb] = stufen[i]!;
    if (v < b) {
      const f = (v - a) / (b - a);
      return { rgb: [0, 1, 2].map((q) => Math.round(ca[q]! + (cb[q]! - ca[q]!) * f)) as RGB, i, f };
    }
  }
  return { rgb: stufen.at(-1)![1], i: stufen.length - 1, f: 0 };
}

export function windFarbe(kn: number): RGB { return zwischen(WIND_STUFEN, kn).rgb; }
export function stromFarbe(kn: number): RGB { return zwischen(STROM_STUFEN, kn).rgb; }
export const hex = ([r, g, b]: RGB): string => `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

export function regenFarbe(mm: number): [RGB, number] | null {
  if (!(mm >= REGEN_STUFEN[0]![0])) return null;
  const { rgb, i, f } = zwischen(REGEN_STUFEN, mm);
  const a0 = REGEN_STUFEN[Math.max(0, i - 1)]![2], a1 = REGEN_STUFEN[i]![2];
  return [rgb, i === 0 ? a1 : a0 + (a1 - a0) * f];
}

const mercY = (lat: number) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI);
const latAusMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90;

export function zeilenBreiten(nord: number, sued: number, hoehe: number): number[] {
  const a = mercY(nord), b = mercY(sued);
  return Array.from({ length: hoehe }, (_, r) => latAusMercY(a + ((r + 0.5) / hoehe) * (b - a)));
}

export function ausduennung(abstandPx: number, ziel = 56): number {
  return abstandPx > 0 ? Math.max(1, Math.ceil(ziel / abstandPx)) : 1;
}

export function yachtNach(rest: readonly Punkt[], fahrtKn: number, stunden: number): { p: Punkt; kurs: number; sm: number; amZiel: boolean } | null {
  if (!rest.length) return null;
  const c = [0];
  for (let i = 1; i < rest.length; i++) c.push(c[i - 1]! + distNM(rest[i - 1]!.lat, rest[i - 1]!.lon, rest[i]!.lat, rest[i]!.lon));
  const gesamt = c.at(-1)!;
  const sm = Math.min(gesamt, Math.max(0, fahrtKn * stunden));
  const p = punktBei(rest, sm, c);
  let seg = 1;
  while (seg < rest.length - 1 && sm > c[seg]!) seg++;
  const a = rest[Math.max(0, seg - 1)]!, b = rest[Math.min(rest.length - 1, seg)]!;
  const kurs = a === b ? 0 : bearingDeg(a.lat, a.lon, b.lat, b.lon);
  return { p, kurs, sm, amZiel: sm >= gesamt - 1e-9 };
}

export function mercatorVerhaeltnis(f: Pick<WetterFeld, 'lats' | 'lons'>): number {
  const breite = (f.lons.at(-1)! - f.lons[0]!) / 360;
  return breite > 0 ? (mercY(f.lats[0]!) - mercY(f.lats.at(-1)!)) / breite : 1;
}

export function flaechenWerte(
  f: WetterFeld, groesse: 'wind' | 'boeen' | 'regen', t: number, breite: number, hoehe: number,
): Float32Array {
  const aus = new Float32Array(breite * hoehe).fill(Number.NaN);
  const zeilen = zeilenBreiten(f.lats.at(-1)!, f.lats[0]!, hoehe);
  const w = f.lons[0]!, o = f.lons.at(-1)!;
  const reihe = f.reihen[groesse];
  for (let r = 0; r < hoehe; r++) {
    for (let c = 0; c < breite; c++) {
      const e = ecken(f, zeilen[r]!, w + ((c + 0.5) / breite) * (o - w));
      const v = e ? gewichtet(e, reihe, t) : null;
      if (v !== null) aus[r * breite + c] = v;
    }
  }
  return aus;
}

export function flaechenStufen(f: WetterFeld, t: number, breite: number, hoehe: number): Uint8Array {
  const aus = new Uint8Array(breite * hoehe);
  const zeilen = zeilenBreiten(f.lats.at(-1)!, f.lats[0]!, hoehe);
  const w = f.lons[0]!, o = f.lons.at(-1)!;
  const stufe = f.lats.flatMap((_, i) => f.lons.map((__, j) => {
    const k = i * f.lons.length + j;
    const s = gewitterStufe(f.reihen.code[k]?.[t] ?? null, f.reihen.cape[k]?.[t] ?? null, f.reihen.li[k]?.[t] ?? null);
    return s === 'gewitter' ? 2 : s === 'neigung' ? 1 : 0;
  }));
  const naechster = (achse: readonly number[], x: number) => {
    let best = 0;
    for (let q = 1; q < achse.length; q++) if (Math.abs(achse[q]! - x) < Math.abs(achse[best]! - x)) best = q;
    return best;
  };
  const spalten = Array.from({ length: breite }, (_, c) => naechster(f.lons, w + ((c + 0.5) / breite) * (o - w)));
  for (let r = 0; r < hoehe; r++) {
    const i = naechster(f.lats, zeilen[r]!);
    for (let c = 0; c < breite; c++) aus[r * breite + c] = stufe[i * f.lons.length + spalten[c]!]!;
  }
  return aus;
}
