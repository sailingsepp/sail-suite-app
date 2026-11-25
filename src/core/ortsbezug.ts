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
