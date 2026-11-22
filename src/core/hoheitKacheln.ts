import { vereinfache } from './kuestenKacheln';
import type { Box } from './landumfahrung';


export const HOHEIT_KACHEL_GRAD = 0.5;
export const HOHEIT_FAKTOR = 100_000;

export const HOHEIT_TOLERANZ_M = 100;

export type HoheitArt = '12nm' | 'innere' | 'archipel';
export interface HoheitZone { name: string; art: HoheitArt; ringe: number[][] }
export interface HoheitKachel { i: number; j: number; zonen: HoheitZone[] }
export interface HoheitIndex {
  erstellt: string;
  kachelGrad: number;
  faktor: number;
  
  gebiete: [number, number, number, number][];
  
  kacheln: string[];
}

const zahl = (n: number) => (n < 0 ? `m${-n}` : String(n));
export function hoheitKachelName(i: number, j: number): string {
  return `hoheit-${zahl(i)}-${zahl(j)}`;
}
export function hoheitKachelAn(lat: number, lon: number): { i: number; j: number; name: string } {
  const i = Math.floor(lat / HOHEIT_KACHEL_GRAD), j = Math.floor(lon / HOHEIT_KACHEL_GRAD);
  return { i, j, name: hoheitKachelName(i, j) };
}
export function hoheitKachelnFuerBox(b: Box): { i: number; j: number; name: string }[] {
  const g = HOHEIT_KACHEL_GRAD, aus: { i: number; j: number; name: string }[] = [];
  for (let i = Math.floor(b.swLat / g); i <= Math.floor(b.neLat / g); i++) {
    for (let j = Math.floor(b.swLon / g); j <= Math.floor(b.neLon / g); j++) aus.push({ i, j, name: hoheitKachelName(i, j) });
  }
  return aus;
}
export function hoheitGedeckt(index: Pick<HoheitIndex, 'gebiete'>, lat: number, lon: number): boolean {
  return index.gebiete.some(([w, s, o, n]) => lon >= w && lon < o && lat >= s && lat < n);
}


export function schneideRing(ring: readonly number[], b: Box): number[] {
  let pkt: [number, number][] = [];
  for (let k = 0; k + 1 < ring.length; k += 2) pkt.push([ring[k]!, ring[k + 1]!]);
  const kanten: [(p: [number, number]) => boolean, (a: [number, number], c: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= b.swLat, (a, c) => schnitt(a, c, 0, b.swLat)],
    [(p) => p[0] <= b.neLat, (a, c) => schnitt(a, c, 0, b.neLat)],
    [(p) => p[1] >= b.swLon, (a, c) => schnitt(a, c, 1, b.swLon)],
    [(p) => p[1] <= b.neLon, (a, c) => schnitt(a, c, 1, b.neLon)],
  ];
  for (const [innen, kreuz] of kanten) {
    if (!pkt.length) break;
    const neu: [number, number][] = [];
    for (let k = 0; k < pkt.length; k++) {
      const a = pkt[k]!, c = pkt[(k + 1) % pkt.length]!;
      const ia = innen(a), ic = innen(c);
      if (ia && ic) neu.push(c);
      else if (ia && !ic) neu.push(kreuz(a, c));
      else if (!ia && ic) { neu.push(kreuz(a, c)); neu.push(c); }
    }
    pkt = neu;
  }
  if (pkt.length < 3) return [];
  const aus = pkt.flat();
  aus.push(pkt[0]![0], pkt[0]![1]);
  return aus;
}

function schnitt(a: [number, number], c: [number, number], achse: 0 | 1, wert: number): [number, number] {
  const t = (wert - a[achse]) / (c[achse] - a[achse]);
  const p: [number, number] = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
  p[achse] = wert;
  return p;
}


export function ablegbarerRing(ring: readonly number[]): number[] {
  const v = vereinfache(Float64Array.from(ring), HOHEIT_TOLERANZ_M);
  if (v.length < 8) return [];
  return Array.from(v, (x) => Math.round(x * HOHEIT_FAKTOR));
}

function imRing(lat: number, lon: number, r: readonly number[], f: number): boolean {
  let innen = false;
  for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
    const y1 = r[k]! / f, x1 = r[k + 1]! / f, y2 = r[m]! / f, x2 = r[m + 1]! / f;
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) innen = !innen;
  }
  return innen;
}


export function zoneAmPunkt(k: HoheitKachel, lat: number, lon: number, faktor = HOHEIT_FAKTOR): HoheitZone | null {
  for (const z of k.zonen) {
    let innen = false;
    for (const r of z.ringe) if (imRing(lat, lon, r, faktor)) innen = !innen;
    if (innen) return z;
  }
  return null;
}


export function abstandZumRandSm(k: HoheitKachel, lat: number, lon: number, faktor = HOHEIT_FAKTOR): number {
  const c = Math.cos((lat * Math.PI) / 180);
  let min = Infinity;
  for (const z of k.zonen) {
    for (const r of z.ringe) {
      for (let q = 0; q + 3 < r.length; q += 2) {
        const ay = r[q]! / faktor, ax = r[q + 1]! / faktor, by = r[q + 2]! / faktor, bx = r[q + 3]! / faktor;
        const dx = (bx - ax) * c, dy = by - ay, px = (lon - ax) * c, py = lat - ay;
        const l = dx * dx + dy * dy;
        const t = l > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / l)) : 0;
        min = Math.min(min, Math.hypot(px - t * dx, py - t * dy) * 60);
      }
    }
  }
  return min;
}
