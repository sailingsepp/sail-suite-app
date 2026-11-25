import { toRad } from './geo';
import type { Punkt } from './types';
import { anzeigeKn, beaufort } from '../briefing/wind';
import { STURM_BOE, STURM_MITTEL } from '../briefing/verdict';

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
  const von = wasserseitig(punkt, kueste);
  return Math.max(...SEKTOR.map((v) => fetchEntlangStrahl(von, windVonDeg + v, kueste, maxNM)));
}

export const UFER_RUECKEN_MAX_NM = 0.3;

const UFER_VERSATZ_NM = 25 / 1852;

export function wasserseitig(punkt: Punkt, kueste: Kuestenlinie): Punkt {
  let best: { d: number; x: number; y: number; dx: number; dy: number; seite: number } | null = null;
  for (const [c, d] of kueste) {
    const [ax, ay] = zuLokal(c, punkt);
    const [bx, by] = zuLokal(d, punkt);
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) continue;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    const x = ax + t * dx, y = ay + t * dy;
    const abstand = Math.hypot(x, y);

    const seite = kreuz(dx, dy, -ax, -ay) / Math.sqrt(l2);
    if (!best || abstand < best.d - 1e-9 || (Math.abs(abstand - best.d) <= 1e-9 && Math.abs(seite) > Math.abs(best.seite))) {
      best = { d: abstand, x, y, dx, dy, seite };
    }
  }
  if (!best || best.seite <= 0 || best.d > UFER_RUECKEN_MAX_NM) return punkt;
  const l = Math.hypot(best.dx, best.dy);

  const x = best.x + (best.dy / l) * UFER_VERSATZ_NM, y = best.y + (-best.dx / l) * UFER_VERSATZ_NM;
  const kx = Math.cos(toRad(punkt.lat)) * 60;
  return { lat: punkt.lat + y / 60, lon: punkt.lon + x / kx };
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

export const SCHUTZ_WINDSTILL_BIS_BFT = 2;

export interface NachtSchutzFelder {
  schutzWellenanlaufNM: number | null;
  revierSchutzhafen: boolean;

  nachtwindKn?: number | null;

  sturmAmAnker?: boolean;
}

export function sturmAmAnker(bucht: boolean, windKn: number | null, boeKn: number | null): boolean {
  if (!bucht) return false;
  return (windKn != null && anzeigeKn(windKn) >= STURM_MITTEL) || (boeKn != null && anzeigeKn(boeKn) >= STURM_BOE);
}

export function schutzDerNacht(k: NachtSchutzFelder): SchutzStufe | null {
  if (k.sturmAmAnker) return 'offen';
  if (k.revierSchutzhafen) return 'geschuetzt';
  if (k.schutzWellenanlaufNM == null) return null;
  const stufe = schutzStufe(k.schutzWellenanlaufNM);
  if (stufe === 'offen' && k.nachtwindKn != null && beaufort(anzeigeKn(k.nachtwindKn)) <= SCHUTZ_WINDSTILL_BIS_BFT) return 'teilweise';
  return stufe;
}
