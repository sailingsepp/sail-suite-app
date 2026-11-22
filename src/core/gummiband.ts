import type { Punkt } from './types';

type XY = [number, number];

function eben(punkte: readonly Punkt[]): XY[] {
  if (punkte.length === 0) return [];
  const mLat = punkte.reduce((s, p) => s + p.lat, 0) / punkte.length;
  const k = Math.cos((mLat * Math.PI) / 180);
  return punkte.map((p) => [p.lon * 60 * k, p.lat * 60]);
}

const kreuz = (o: XY, a: XY, b: XY): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

export function huelle(punkte: readonly Punkt[]): XY[] {
  const p = eben(punkte)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .filter((q, i, alle) => i === 0 || q[0] !== alle[i - 1]![0] || q[1] !== alle[i - 1]![1]);
  if (p.length <= 2) return p;
  const unten: XY[] = [];
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2]!, unten[unten.length - 1]!, q) <= 0) unten.pop();
    unten.push(q);
  }
  const oben: XY[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]!;
    while (oben.length >= 2 && kreuz(oben[oben.length - 2]!, oben[oben.length - 1]!, q) <= 0) oben.pop();
    oben.push(q);
  }
  return [...unten.slice(0, -1), ...oben.slice(0, -1)];
}

export function huellenumfangSm(punkte: readonly Punkt[]): number {
  const h = huelle(punkte);
  if (h.length < 2) return 0;
  let u = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i]!, b = h[(i + 1) % h.length]!;
    u += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return u;
}

export function rundheit(punkte: readonly Punkt[], gefahrenSm: number): number | null {
  return gefahrenSm > 0 ? Math.min(1, huellenumfangSm(punkte) / gefahrenSm) : null;
}

export function umlaufWinkel(orte: readonly Punkt[], startIndex: number, richtung: 1 | -1): number[] {
  const p = eben(orte);
  if (p.length === 0) return [];
  const mx = p.reduce((s, q) => s + q[0], 0) / p.length;
  const my = p.reduce((s, q) => s + q[1], 0) / p.length;
  const w = p.map((q) => Math.atan2(q[1] - my, q[0] - mx));
  const w0 = w[startIndex] ?? 0;
  const voll = 2 * Math.PI;
  return w.map((x) => ((((x - w0) * richtung) % voll) + voll) % voll);
}

export function selbstkreuzungen(orte: readonly Punkt[]): number {
  const p = eben(orte);
  const schneiden = (a: XY, b: XY, c: XY, d: XY): boolean => {
    const d1 = kreuz(c, d, a), d2 = kreuz(c, d, b), d3 = kreuz(a, b, c), d4 = kreuz(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  };
  let n = 0;
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = i + 2; j + 1 < p.length; j++) {
      if (i === 0 && j + 1 === p.length - 1 && orte[0] && orte[p.length - 1]
        && orte[0].lat === orte[p.length - 1]!.lat && orte[0].lon === orte[p.length - 1]!.lon) continue;
      if (schneiden(p[i]!, p[i + 1]!, p[j]!, p[j + 1]!)) n++;
    }
  }
  return n;
}

export const RUECKSCHRITT_TOLERANZ_SM = 2;

export function fortschrittSm(start: Punkt, ziel: Punkt, p: Punkt): number {
  const k = Math.cos((start.lat * Math.PI) / 180);
  const dx = (ziel.lon - start.lon) * 60 * k, dy = (ziel.lat - start.lat) * 60, l = Math.hypot(dx, dy) || 1;
  return (((p.lon - start.lon) * 60 * k) * dx + ((p.lat - start.lat) * 60) * dy) / l;
}

export function rueckschritte(orte: readonly Punkt[], ziel: Punkt, toleranzSm = RUECKSCHRITT_TOLERANZ_SM): number {
  const start = orte[0];
  if (!start) return 0;
  const f = orte.map((p) => fortschrittSm(start, ziel, p));
  let n = 0;
  for (let i = 1; i < f.length; i++) if (f[i]! < f[i - 1]! - toleranzSm) n++;
  return n;
}
