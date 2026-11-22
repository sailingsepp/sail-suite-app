import { bearingOf, distNM } from './geo';
import type { Punkt } from './types';

const KM_JE_BREITENGRAD = 110.57;

const KM_JE_LAENGENGRAD = 111.32;

export const ZENTRUM_MIN_ABWEICHUNG = 2;

export const ZENTRUM_RADIUS_KM = 400;

export const ZENTRUM_MIN_PROMINENZ = 0.8;

export const GRADIENT_FLACH = 0.5;

export const GRADIENT_KRAEFTIG = 1.5;

export const STROEMUNG_TOLERANZ_GRAD = 60;

export const DRUCKFELD_STUNDEN = [7, 12, 19] as const;
export type DruckfeldStunde = typeof DRUCKFELD_STUNDEN[number];

export interface DruckGitter {
  lats: number[];
  lons: number[];

  druck: (number | null)[][];

  fronten?: {
    temp: (number | null)[][];
    taupunkt: (number | null)[][];
    windKn: (number | null)[][];
    windVon: (number | null)[][];
  };
}

export interface Druckzentrum {
  lat: number;
  lon: number;
  hPa: number;

  distanzNM: number;

  peilung: number;
}

export interface Druckanalyse {
  hoch: Druckzentrum | null;
  tief: Druckzentrum | null;

  gradient: number;

  stroemungVon: number | null;

  anstiegNach: number | null;

  mittel: number;
}

export interface DruckfeldSchnappschuss {
  stundeLokal: DruckfeldStunde;
  utcMs: number;
  gitter: DruckGitter;
}

export function naechsterSchnappschuss(
  tag: DruckfeldSchnappschuss[], zeitpunkt: Date,
): DruckfeldSchnappschuss | null {
  if (tag.length === 0) return null;
  const zielMs = zeitpunkt.getTime();
  return tag.reduce((beste, s) =>
    Math.abs(s.utcMs - zielMs) < Math.abs(beste.utcMs - zielMs) ? s : beste);
}

function alleWerte(g: DruckGitter): number[] {
  const out: number[] = [];
  for (const reihe of g.druck) for (const v of reihe) if (v != null) out.push(v);
  return out;
}

const GLAETTUNG_DURCHGAENGE = 1;

export function glaetteDruckfeld(g: DruckGitter, durchgaenge = GLAETTUNG_DURCHGAENGE): DruckGitter {

  if (g.druck.some((r) => r.some((v) => v == null))) return g;

  return { lats: g.lats, lons: g.lons, druck: glaetteFeld(g.druck as number[][], durchgaenge) };
}

export function glaetteFeld(werte: number[][], durchgaenge = GLAETTUNG_DURCHGAENGE): number[][] {
  const rand = (a: number[], i: number): number => a[Math.max(0, Math.min(a.length - 1, i))]!;
  let feld = werte.map((r) => [...r]);
  for (let d = 0; d < durchgaenge; d++) {
    const quer = feld.map((r) => r.map((_, j) => (rand(r, j - 1) + 2 * rand(r, j) + rand(r, j + 1)) / 4));
    feld = quer.map((r, i) => r.map((_, j) =>
      (quer[Math.max(0, i - 1)]![j]! + 2 * quer[i]![j]! + quer[Math.min(quer.length - 1, i + 1)]![j]!) / 4));
  }
  return feld;
}

function kmAbstand(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dy = (lat2 - lat1) * KM_JE_BREITENGRAD;
  const dx = (lon2 - lon1) * KM_JE_LAENGENGRAD * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(dx, dy);
}

function extrema(g: DruckGitter, suchMaximum: boolean): { lat: number; lon: number; hPa: number }[] {
  const out: { lat: number; lon: number; hPa: number }[] = [];
  const latMin = g.lats[0]!, latMax = g.lats[g.lats.length - 1]!;
  const lonMin = g.lons[0]!, lonMax = g.lons[g.lons.length - 1]!;

  for (let i = 0; i < g.lats.length; i++) {
    for (let j = 0; j < g.lons.length; j++) {
      const wert = g.druck[i]?.[j];
      if (wert == null) continue;
      const lat = g.lats[i]!, lon = g.lons[j]!;

      if (kmAbstand(lat, lon, latMin, lon) < ZENTRUM_RADIUS_KM
        || kmAbstand(lat, lon, latMax, lon) < ZENTRUM_RADIUS_KM
        || kmAbstand(lat, lon, lat, lonMin) < ZENTRUM_RADIUS_KM
        || kmAbstand(lat, lon, lat, lonMax) < ZENTRUM_RADIUS_KM) continue;

      let extrem = true;
      const ring: number[] = [];
      for (let a = 0; a < g.lats.length && extrem; a++) {
        for (let b = 0; b < g.lons.length; b++) {
          if (a === i && b === j) continue;
          const n = g.druck[a]?.[b];
          if (n == null) continue;
          const d = kmAbstand(lat, lon, g.lats[a]!, g.lons[b]!);
          if (d > ZENTRUM_RADIUS_KM) continue;
          if (suchMaximum ? n >= wert : n <= wert) { extrem = false; break; }

          if (d >= ZENTRUM_RADIUS_KM * 0.6) ring.push(n);
        }
      }
      if (!extrem || ring.length === 0) continue;
      const ringMittel = ring.reduce((a, b) => a + b, 0) / ring.length;
      if (Math.abs(wert - ringMittel) < ZENTRUM_MIN_PROMINENZ) continue;
      out.push({ lat, lon, hPa: wert });
    }
  }
  return out;
}

function naechsterIndex(achse: number[], wert: number): number {
  let beste = 0, kleinster = Infinity;
  achse.forEach((a, i) => {
    const d = Math.abs(a - wert);
    if (d < kleinster) { kleinster = d; beste = i; }
  });
  return beste;
}

function gradientAn(g: DruckGitter, bezug: Punkt): { gx: number; gy: number } | null {
  if (g.lats.length < 3 || g.lons.length < 3) return null;
  const i = Math.min(g.lats.length - 2, Math.max(1, naechsterIndex(g.lats, bezug.lat)));
  const j = Math.min(g.lons.length - 2, Math.max(1, naechsterIndex(g.lons, bezug.lon)));

  const pOst = g.druck[i]?.[j + 1], pWest = g.druck[i]?.[j - 1];
  const pNord = g.druck[i + 1]?.[j], pSued = g.druck[i - 1]?.[j];
  if (pOst == null || pWest == null || pNord == null || pSued == null) return null;

  const lat = g.lats[i]!;
  const dxKm = (g.lons[j + 1]! - g.lons[j - 1]!) * KM_JE_LAENGENGRAD * Math.cos(lat * Math.PI / 180);
  const dyKm = (g.lats[i + 1]! - g.lats[i - 1]!) * KM_JE_BREITENGRAD;
  if (dxKm === 0 || dyKm === 0) return null;

  return { gx: (pOst - pWest) / dxKm, gy: (pNord - pSued) / dyKm };
}

export function analysiereDruckfeld(g: DruckGitter, bezug: Punkt): Druckanalyse | null {
  const werte = alleWerte(g);
  if (werte.length < 9) return null;
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;

  const alsZentrum = (e: { lat: number; lon: number; hPa: number }): Druckzentrum => ({
    lat: e.lat, lon: e.lon, hPa: e.hPa,
    distanzNM: distNM(bezug.lat, bezug.lon, e.lat, e.lon),
    peilung: (() => {

      const dx = (e.lon - bezug.lon) * Math.cos(bezug.lat * Math.PI / 180);
      const dy = e.lat - bezug.lat;
      return bearingOf(dx, dy);
    })(),
  });

  const hochKandidaten = extrema(g, true)
    .filter((e) => e.hPa - mittel >= ZENTRUM_MIN_ABWEICHUNG)
    .sort((a, b) => b.hPa - a.hPa);
  const tiefKandidaten = extrema(g, false)
    .filter((e) => mittel - e.hPa >= ZENTRUM_MIN_ABWEICHUNG)
    .sort((a, b) => a.hPa - b.hPa);

  const grad = gradientAn(g, bezug);

  const gradient = grad ? Math.hypot(grad.gx, grad.gy) * 100 : 0;

  let stroemungVon: number | null = null;
  let anstiegNach: number | null = null;
  if (grad && gradient >= GRADIENT_FLACH) {

    anstiegNach = bearingOf(grad.gx, grad.gy);

    stroemungVon = bearingOf(grad.gy, -grad.gx);
  }

  return {
    hoch: hochKandidaten[0] ? alsZentrum(hochKandidaten[0]) : null,
    tief: tiefKandidaten[0] ? alsZentrum(tiefKandidaten[0]) : null,
    gradient, stroemungVon, anstiegNach, mittel,
  };
}

export function stroemungPasst(stroemungVon: number | null, windVon: number): boolean {
  if (stroemungVon === null) return false;
  const diff = Math.abs(((stroemungVon - windVon + 540) % 360) - 180);
  return diff <= STROEMUNG_TOLERANZ_GRAD;
}
