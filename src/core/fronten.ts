import { konturZuege, verfeinereGitter } from './isobaren';
import { glaetteFeld, type DruckGitter } from './druckfeld';

const KAPPA = 0.2854;
const LV = 2.5e6;
const CP = 1004;
const NIVEAU_HPA = 850;

const KM_JE_BREITENGRAD = 110.57;
const KM_JE_LAENGENGRAD = 111.32;

export const GRADIENT_MIN_K_100KM = 3;

export const ZUGKOMPONENTE_MIN_KN = 5;

export const OKKLUSION_RADIUS_KM = 400;

export const FRONT_MIN_KM = 300;

export const STRECKUNG_MIN = 0.25;

export type Frontart = 'kalt' | 'warm' | 'stationaer' | 'okklusion';

export interface Frontlinie {
  art: Frontart;

  punkte: { lat: number; lon: number }[];

  zugrichtung: number;
}

export interface FrontenFelder {

  temp: (number | null)[][];

  taupunkt: (number | null)[][];

  windKn: (number | null)[][];

  windVon: (number | null)[][];
}

export function thetaE(tempC: number, taupunktC: number, pHpa = NIVEAU_HPA): number {
  const tK = tempC + 273.15;
  const e = 6.112 * Math.exp((17.67 * taupunktC) / (taupunktC + 243.5));
  const r = (0.622 * e) / Math.max(1, pHpa - e);
  const theta = tK * (1000 / pHpa) ** KAPPA;
  return theta * Math.exp((LV * r) / (CP * tK));
}

interface Feld { lats: number[]; lons: number[]; werte: number[][] }

function gradient(f: Feld, i: number, j: number): { gx: number; gy: number } | null {
  const o = f.werte[i]?.[j + 1], w = f.werte[i]?.[j - 1];
  const n = f.werte[i + 1]?.[j], s = f.werte[i - 1]?.[j];
  if (o == null || w == null || n == null || s == null) return null;
  const lat = f.lats[i]!;
  const dx = (f.lons[j + 1]! - f.lons[j - 1]!) * KM_JE_LAENGENGRAD * Math.cos((lat * Math.PI) / 180);
  const dy = (f.lats[i + 1]! - f.lats[i - 1]!) * KM_JE_BREITENGRAD;
  if (dx === 0 || dy === 0) return null;
  return { gx: (o - w) / dx, gy: (n - s) / dy };
}

function felder(lats: number[], lons: number[], f: FrontenFelder): {
  te: Feld; betrag: Feld; tfp: Feld;
} | null {
  const roh: number[][] = lats.map((_, i) => lons.map((__, j) => {
    const t = f.temp[i]?.[j], d = f.taupunkt[i]?.[j];
    return (t == null || d == null) ? NaN : thetaE(t, d);
  }));
  if (roh.flat().some((v) => Number.isNaN(v))) return null;

  const teF: Feld = { lats, lons, werte: glaetteFeld(roh) };

  const betrag: number[][] = lats.map(() => new Array<number>(lons.length).fill(NaN));
  for (let i = 1; i < lats.length - 1; i++) {
    for (let j = 1; j < lons.length - 1; j++) {
      const g = gradient(teF, i, j);
      if (g) betrag[i]![j] = Math.hypot(g.gx, g.gy);
    }
  }
  const betragF: Feld = { lats, lons, werte: betrag };

  const tfp: number[][] = lats.map(() => new Array<number>(lons.length).fill(NaN));
  for (let i = 2; i < lats.length - 2; i++) {
    for (let j = 2; j < lons.length - 2; j++) {
      const gTe = gradient(teF, i, j);
      const gB = gradient(betragF, i, j);
      if (!gTe || !gB) continue;
      const betragTe = Math.hypot(gTe.gx, gTe.gy);
      if (betragTe < 1e-9) continue;

      tfp[i]![j] = -((gB.gx * gTe.gx) + (gB.gy * gTe.gy)) / betragTe;
    }
  }
  return { te: teF, betrag: betragF, tfp: { lats, lons, werte: tfp } };
}

function leseAb(f: Feld, lat: number, lon: number): number {
  const i = Math.max(0, Math.min(f.lats.length - 2, f.lats.findIndex((v, k) =>
    k < f.lats.length - 1 && lat >= v && lat <= f.lats[k + 1]!)));
  const j = Math.max(0, Math.min(f.lons.length - 2, f.lons.findIndex((v, k) =>
    k < f.lons.length - 1 && lon >= v && lon <= f.lons[k + 1]!)));
  const a = f.werte[i]?.[j], b = f.werte[i]?.[j + 1], c = f.werte[i + 1]?.[j], d = f.werte[i + 1]?.[j + 1];
  if (a == null || b == null || c == null || d == null) return NaN;
  const tl = (lat - f.lats[i]!) / (f.lats[i + 1]! - f.lats[i]!);
  const tj = (lon - f.lons[j]!) / (f.lons[j + 1]! - f.lons[j]!);
  return a * (1 - tl) * (1 - tj) + b * (1 - tl) * tj + c * tl * (1 - tj) + d * tl * tj;
}

function windAn(windKn: Feld, windVon: Feld, lat: number, lon: number):
{ u: number; v: number } | null {
  const kn = leseAb(windKn, lat, lon);
  const von = leseAb(windVon, lat, lon);
  if (Number.isNaN(kn) || Number.isNaN(von)) return null;

  const r = (von * Math.PI) / 180;
  return { u: -kn * Math.sin(r), v: -kn * Math.cos(r) };
}

function peilung(x: number, y: number): number {
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function kmAbstand(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dy = (lat2 - lat1) * KM_JE_BREITENGRAD;
  const dx = (lon2 - lon1) * KM_JE_LAENGENGRAD * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(dx, dy);
}

function bogenlaenge(l: { lat: number; lon: number }[]): number {
  let km = 0;
  for (let i = 1; i < l.length; i++) km += kmAbstand(l[i - 1]!.lat, l[i - 1]!.lon, l[i]!.lat, l[i]!.lon);
  return km;
}

function taugtAlsFront(l: { lat: number; lon: number }[]): boolean {
  if (l.length < 3) return false;
  const bogen = bogenlaenge(l);
  if (bogen < FRONT_MIN_KM) return false;
  const a = l[0]!, e = l[l.length - 1]!;
  return kmAbstand(a.lat, a.lon, e.lat, e.lon) / bogen >= STRECKUNG_MIN;
}

function aufTeilen(
  zug: { lat: number; lon: number }[], betrag: Feld,
): { lat: number; lon: number }[][] {
  const schwelle = GRADIENT_MIN_K_100KM / 100;
  const erster = zug[0], letzter = zug[zug.length - 1];
  const geschlossen = zug.length > 2 && erster != null && letzter != null
    && erster.lat === letzter.lat && erster.lon === letzter.lon;

  const punkte = geschlossen ? zug.slice(0, -1) : zug;

  const laeufe: { lat: number; lon: number }[][] = [];
  let lauf: { lat: number; lon: number }[] = [];
  for (const p of punkte) {
    const b = leseAb(betrag, p.lat, p.lon);
    if (!Number.isNaN(b) && b >= schwelle) lauf.push(p);
    else { if (lauf.length) laeufe.push(lauf); lauf = []; }
  }
  if (lauf.length) laeufe.push(lauf);

  if (geschlossen && laeufe.length > 0) {
    const ersterLauf = laeufe[0]!;
    const letzterLauf = laeufe[laeufe.length - 1]!;
    if (laeufe.length === 1 && ersterLauf.length === punkte.length) {

      laeufe[0] = [...ersterLauf, ersterLauf[0]!];
    } else if (laeufe.length > 1
      && ersterLauf[0] === punkte[0]
      && letzterLauf[letzterLauf.length - 1] === punkte[punkte.length - 1]) {

      laeufe.pop();
      laeufe[0] = [...letzterLauf, ...ersterLauf];
    }
  }
  return laeufe.filter(taugtAlsFront);
}

function einstufen(
  zug: { lat: number; lon: number }[], te: Feld, windKn: Feld, windVon: Feld,
): { art: Exclude<Frontart, 'okklusion'>; zugrichtung: number } | null {
  let sumVn = 0, sumX = 0, sumY = 0, n = 0;
  for (const p of zug) {
    const i = Math.max(1, Math.min(te.lats.length - 2, te.lats.findIndex((v, k) =>
      k < te.lats.length - 1 && p.lat >= v && p.lat <= te.lats[k + 1]!)));
    const j = Math.max(1, Math.min(te.lons.length - 2, te.lons.findIndex((v, k) =>
      k < te.lons.length - 1 && p.lon >= v && p.lon <= te.lons[k + 1]!)));
    const g = gradient(te, i, j);
    const w = windAn(windKn, windVon, p.lat, p.lon);
    if (!g || !w) continue;
    const betrag = Math.hypot(g.gx, g.gy);
    if (betrag < 1e-9) continue;

    const kx = -g.gx / betrag, ky = -g.gy / betrag;
    const vn = w.u * kx + w.v * ky;
    sumVn += vn;

    sumX += kx * vn; sumY += ky * vn;
    n++;
  }
  if (n === 0) return null;
  const vn = sumVn / n;
  const art = vn > ZUGKOMPONENTE_MIN_KN ? 'warm'
    : (vn < -ZUGKOMPONENTE_MIN_KN ? 'kalt' : 'stationaer');
  return { art, zugrichtung: peilung(sumX, sumY) };
}

function okkludiere(fronten: Frontlinie[], tiefLat: number | null, tiefLon: number | null): Frontlinie[] {
  if (tiefLat === null || tiefLon === null) return fronten;
  const nahAmTief = (p: { lat: number; lon: number }): boolean =>
    kmAbstand(p.lat, p.lon, tiefLat, tiefLon) <= OKKLUSION_RADIUS_KM;

  const kalt = fronten.filter((x) => x.art === 'kalt');
  const warm = fronten.filter((x) => x.art === 'warm');
  if (kalt.length === 0 || warm.length === 0) return fronten;

  return fronten.map((fr) => {
    if (fr.art === 'stationaer') return fr;
    const gegenstueck = fr.art === 'kalt' ? warm : kalt;
    const beruehrt = gegenstueck.some((o) => o.punkte.some((op) =>
      fr.punkte.some((fp) => kmAbstand(fp.lat, fp.lon, op.lat, op.lon) <= OKKLUSION_RADIUS_KM / 2
        && nahAmTief(fp))));
    if (!beruehrt) return fr;
    const imUmkreis = fr.punkte.filter(nahAmTief);
    if (imUmkreis.length < 3) return fr;
    return { ...fr, art: 'okklusion' as const, punkte: imUmkreis };
  });
}

export function analysiereFronten(
  g: DruckGitter, f: FrontenFelder,
  tief: { lat: number; lon: number } | null = null,
): Frontlinie[] {
  const fd = felder(g.lats, g.lons, f);
  if (!fd) return [];

  const iVon = 2, iBis = g.lats.length - 3;
  const jVon = 2, jBis = g.lons.length - 3;
  if (iBis < iVon + 1 || jBis < jVon + 1) return [];
  const sauber: DruckGitter = {
    lats: g.lats.slice(iVon, iBis + 1),
    lons: g.lons.slice(jVon, jBis + 1),
    druck: fd.tfp.werte.slice(iVon, iBis + 1).map((r) => r.slice(jVon, jBis + 1)),
  };
  if (sauber.druck.flat().some((v) => v == null || Number.isNaN(v))) return [];

  const fein = verfeinereGitter(sauber, 4) ?? sauber;

  const windKnFeld: Feld = { lats: g.lats, lons: g.lons, werte: f.windKn.map((r) => r.map((v) => v ?? NaN)) };
  const windVonFeld: Feld = { lats: g.lats, lons: g.lons, werte: f.windVon.map((r) => r.map((v) => v ?? NaN)) };

  const out: Frontlinie[] = [];
  for (const zug of konturZuege(fein, 0)) {
    for (const teil of aufTeilen(zug, fd.betrag)) {
      const e = einstufen(teil, fd.te, windKnFeld, windVonFeld);
      if (!e) continue;
      out.push({ art: e.art, punkte: teil, zugrichtung: e.zugrichtung });
    }
  }
  return okkludiere(out, tief?.lat ?? null, tief?.lon ?? null);
}
