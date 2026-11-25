import { toRad } from './geo';
import type { Punkt } from './types';

export type Kuestenlinie = [Punkt, Punkt][];

function zuLokal(p: Punkt, ref: Punkt): [number, number] {
  const kx = Math.cos(toRad(ref.lat)) * 60;
  return [(p.lon - ref.lon) * kx, (p.lat - ref.lat) * 60];
}

const kreuz = (ax: number, ay: number, bx: number, by: number): number => ax * by - ay * bx;

function fetchEntlangStrahl(
  von: Punkt, bearing: number, kueste: Kuestenlinie, maxNM: number,
): number {

  const rx = Math.sin(toRad(bearing)) * maxNM;
  const ry = Math.cos(toRad(bearing)) * maxNM;

  let naechster = maxNM;
  for (const [c, d] of kueste) {
    const [cx, cy] = zuLokal(c, von);
    const [dx, dy] = zuLokal(d, von);
    const sx = dx - cx, sy = dy - cy;
    const nenner = kreuz(rx, ry, sx, sy);
    if (Math.abs(nenner) < 1e-12) continue;
    const t = kreuz(cx, cy, sx, sy) / nenner;
    const u = kreuz(cx, cy, rx, ry) / nenner;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) naechster = Math.min(naechster, t * maxNM);
  }
  return naechster;
}

const SEKTOR = [-30, -15, 0, 15, 30];

export function luvFetchNM(
  punkt: Punkt, windVonDeg: number, kueste: Kuestenlinie, maxNM = 12,
): number {
  if (kueste.length === 0) return maxNM;
  return Math.max(...SEKTOR.map((v) => fetchEntlangStrahl(punkt, windVonDeg + v, kueste, maxNM)));
}

export type SchutzStufe = 'geschuetzt' | 'teilweise' | 'offen';

export interface Schutzlage {
  fetchNM: number | null;
  schutz: SchutzStufe | null;
}

export function schutzStufe(fetchNM: number): SchutzStufe {
  if (fetchNM < 1) return 'geschuetzt';
  if (fetchNM < 3) return 'teilweise';
  return 'offen';
}
