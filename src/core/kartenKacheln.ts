import { vereinfache } from './kuestenKacheln';
import type { Box } from './landumfahrung';

export const KARTE_KACHEL_GRAD = 0.5;
export const KARTE_FAKTOR = 1_000_000;

export const FEIN_TOLERANZ_M = 3;

export const GROB_TOLERANZ_M = 120;

export const FEIN_AB_ZOOM = 11;

export interface LandKachel { i: number; j: number; faktor: number; fein: number[][]; grob: number[][] }
export interface KartenIndex {
  erstellt: string;
  kachelGrad: number;
  faktor: number;

  gebiete: [number, number, number, number][];

  kacheln: string[];
}

const zahl = (n: number) => (n < 0 ? `m${-n}` : String(n));
export function landKachelName(i: number, j: number): string {
  return `land-${zahl(i)}-${zahl(j)}`;
}
export function landKachelAn(lat: number, lon: number): { i: number; j: number; name: string } {
  const i = Math.floor(lat / KARTE_KACHEL_GRAD), j = Math.floor(lon / KARTE_KACHEL_GRAD);
  return { i, j, name: landKachelName(i, j) };
}
export function landKachelnFuerBox(b: Box): { i: number; j: number; name: string }[] {
  const g = KARTE_KACHEL_GRAD, aus: { i: number; j: number; name: string }[] = [];
  for (let i = Math.floor(b.swLat / g); i <= Math.floor(b.neLat / g); i++) {
    for (let j = Math.floor(b.swLon / g); j <= Math.floor(b.neLon / g); j++) aus.push({ i, j, name: landKachelName(i, j) });
  }
  return aus;
}

export const MEER_ZWISCHEN_REVIEREN: readonly [number, number, number, number][] = [
  [17.5, 36.5, 19, 39.5],
  [19, 36.5, 20.5, 37.5],
  [20.5, 36.5, 21, 37],
  [17.5, 34.5, 21, 36.5],
];

export function karteGedeckt(index: Pick<KartenIndex, 'gebiete'>, lat: number, lon: number): boolean {
  return index.gebiete.some(([w, s, o, n]) => lon >= w && lon < o && lat >= s && lat < n);
}

export function kodiereRing(ring: readonly number[], toleranzM: number, faktor = KARTE_FAKTOR): number[] {
  const v = vereinfacheMitRand(ring, toleranzM);
  if (v.length < 8) return [];
  const ganz = Array.from(v, (x) => Math.round(x * faktor));
  const aus = [ganz[0]!, ganz[1]!];
  for (let k = 2; k < ganz.length; k += 2) aus.push(ganz[k]! - ganz[k - 2]!, ganz[k + 1]! - ganz[k - 1]!);
  return aus;
}

function aufKante(v: number): boolean {
  const q = v / KARTE_KACHEL_GRAD;
  return Math.abs(q - Math.round(q)) < 1e-9;
}

function vereinfacheMitRand(ring: readonly number[], toleranzM: number): Float64Array {
  const halt: number[] = [0];
  for (let k = 2; k < ring.length - 2; k += 2) if (aufKante(ring[k]!) || aufKante(ring[k + 1]!)) halt.push(k);
  halt.push(ring.length - 2);
  const aus: number[] = [];
  for (let h = 0; h + 1 < halt.length; h++) {
    const teil = vereinfache(Float64Array.from(ring.slice(halt[h]!, halt[h + 1]! + 2)), toleranzM);
    for (let k = h === 0 ? 0 : 2; k < teil.length; k++) aus.push(teil[k]!);
  }
  return Float64Array.from(aus);
}

export function dekodiereRing(k: readonly number[], faktor = KARTE_FAKTOR): Float64Array {
  const p = new Float64Array(k.length);
  let lat = 0, lon = 0;
  for (let n = 0; n < k.length; n += 2) {
    lat += k[n]!; lon += k[n + 1]!;
    p[n] = lat / faktor; p[n + 1] = lon / faktor;
  }
  return p;
}

export function anLand(ringe: readonly Float64Array[], lat: number, lon: number): boolean {
  let innen = false;
  for (const r of ringe) {
    for (let k = 0, m = r.length - 2; k < r.length; m = k, k += 2) {
      const y1 = r[k]!, x1 = r[k + 1]!, y2 = r[m]!, x2 = r[m + 1]!;
      if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) innen = !innen;
    }
  }
  return innen;
}
