import { bearingDeg, distNM } from './geo';
import { nf } from './time';
import type { Punkt, Sprache } from './types';

export const BEI_SM = 1;
export const MAX_SM = 25;

export interface Bezugsort { name: string; lat: number; lon: number }

const STRICHE: Record<Sprache, string[]> = {
  de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

export function richtungsKuerzel(grad: number, sprache: Sprache): string {
  return STRICHE[sprache][Math.round((((grad % 360) + 360) % 360) / 45) % 8]!;
}

export function ortsbezug(
  punkt: Punkt, kandidaten: readonly Bezugsort[], sprache: Sprache,
): { text: string; name: string; sm: number } | null {
  let beste: Bezugsort | null = null, besteSm = Infinity;
  for (const k of kandidaten) {
    if (!k.name.trim()) continue;
    const sm = distNM(k.lat, k.lon, punkt.lat, punkt.lon);
    if (sm < besteSm) { beste = k; besteSm = sm; }
  }
  if (!beste || besteSm > MAX_SM) return null;
  if (besteSm < BEI_SM) return { text: sprache === 'en' ? `off ${beste.name}` : `bei ${beste.name}`, name: beste.name, sm: besteSm };
  const sm = besteSm < 10 ? nf(Math.round(besteSm * 2) / 2, besteSm < 10 && Math.round(besteSm * 2) % 2 ? 1 : 0, sprache) : String(Math.round(besteSm));
  const richtung = richtungsKuerzel(bearingDeg(beste.lat, beste.lon, punkt.lat, punkt.lon), sprache);
  return {
    text: sprache === 'en' ? `${sm} NM ${richtung} of ${beste.name}` : `${sm} sm ${richtung} von ${beste.name}`,
    name: beste.name, sm: besteSm,
  };
}

export const POSITION_MAX_SM = 15;
export const BEI_ORT_SM = 0.1;
export const QUERAB_MIN_KN = 1;
export const QUERAB_TOLERANZ_GRAD = 15;
export const INSEL_MAX_KM2 = 1;
export type BezugsArt = 'kap' | 'insel' | 'inselchen' | 'hafen' | 'marina' | 'anker' | 'stadt' | 'ort' | 'dorf';
export const GEWICHT: Readonly<Record<BezugsArt, number>> = {
  kap: 1.5, insel: 1.3, inselchen: 1.3, hafen: 1.2, marina: 1.2, stadt: 1.2, anker: 1, ort: 1, dorf: 0.8,
};
export interface PositionsBezugsort { name: string; lat: number; lon: number; art: string; km2?: number | null }

function abstandText(sm: number, sprache: Sprache): string {
  if (sm < 1) return nf(Math.max(0.1, Math.round(sm * 10) / 10), 1, sprache);
  if (sm < 10) { const h = Math.round(sm * 2) / 2; return nf(h, h % 1 ? 1 : 0, sprache); }
  return String(Math.round(sm));
}

export function positionInWorten(
  punkt: Punkt, kandidaten: readonly PositionsBezugsort[], sprache: Sprache,
  bewegung: { kursGrad: number | null; sogKn: number | null } = { kursGrad: null, sogKn: null },
): string | null {
  let beste: PositionsBezugsort | null = null, besteSm = Infinity, besteWert = Infinity;
  for (const k of kandidaten) {
    const g = GEWICHT[k.art as BezugsArt];
    if (!g || !k.name.trim()) continue;
    if (k.art === 'insel' && (k.km2 ?? Infinity) > INSEL_MAX_KM2) continue;
    const sm = distNM(punkt.lat, punkt.lon, k.lat, k.lon);
    if (sm > POSITION_MAX_SM) continue;
    const wert = sm / g;
    if (wert < besteWert) { beste = k; besteSm = sm; besteWert = wert; }
  }
  if (!beste) return null;
  const name = beste.name.trim();
  if (besteSm < BEI_ORT_SM) return sprache === 'en' ? `off ${name}` : `bei ${name}`;
  const sm = abstandText(besteSm, sprache);
  const { kursGrad, sogKn } = bewegung;
  if (kursGrad !== null && sogKn !== null && sogKn >= QUERAB_MIN_KN) {
    const rel = (((bearingDeg(punkt.lat, punkt.lon, beste.lat, beste.lon) - kursGrad) % 360) + 360) % 360;
    if (Math.abs(rel - 90) <= QUERAB_TOLERANZ_GRAD) return sprache === 'en' ? `${sm} NM abeam ${name} to starboard` : `${sm} sm querab ${name} an Stb`;
    if (Math.abs(rel - 270) <= QUERAB_TOLERANZ_GRAD) return sprache === 'en' ? `${sm} NM abeam ${name} to port` : `${sm} sm querab ${name} an Bb`;
  }
  const richtung = richtungsKuerzel(bearingDeg(beste.lat, beste.lon, punkt.lat, punkt.lon), sprache);
  return sprache === 'en' ? `${sm} NM ${richtung} of ${name}` : `${sm} sm ${richtung} ${name}`;
}
