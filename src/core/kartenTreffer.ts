import { istFeuer } from './leuchtfeuer';
import { SEEZEICHEN_TYPEN } from './osmAuszug';

type Tags = Readonly<Record<string, string>>;

export type TrefferArt = 'feuer' | 'tonne' | 'tankstelle' | 'hafen' | 'gefahr';
export interface GefahrStelle { lat: number; lon: number; art: string; name: string; merkmale?: Tags }
export type KartenTreffer =
  | { art: 'feuer' | 'tonne' | 'tankstelle' | 'hafen'; lat: number; lon: number; tags: Tags }
  | { art: 'gefahr'; lat: number; lon: number; gefahr: GefahrStelle };

export const TREFFER_AB_ZOOM: Readonly<Record<TrefferArt, number>> = { feuer: 12, tonne: 12, tankstelle: 12, gefahr: 12, hafen: 11 };

const GEFAHR_ARTEN = ['rock', 'wreck', 'obstruction'];

export const istTonne = (t: Tags): boolean => SEEZEICHEN_TYPEN.includes(t['seamark:type'] ?? '');
export const istHafen = (t: Tags): boolean => t['leisure'] === 'marina' || t['seamark:type'] === 'harbour';
export const istTankstelle = (t: Tags): boolean => t['waterway'] === 'fuel'
  || (t['seamark:small_craft_facility:category'] ?? '').split(';').includes('fuel_station')
  || (t['amenity'] === 'fuel' && !!t['seamark:type']);

export function trefferArt(t: Tags): Exclude<TrefferArt, 'gefahr'> | null {
  if (istTonne(t)) return 'tonne';
  if (istFeuer(t)) return 'feuer';
  if (istHafen(t)) return 'hafen';
  if (istTankstelle(t)) return 'tankstelle';
  return null;
}

export function trefferAm(
  elemente: readonly (readonly [number, number, Tags])[], gefahren: readonly GefahrStelle[], zoom: number,
  abstandPx: (lat: number, lon: number) => number, radiusPx: number,
): KartenTreffer | null {
  let bestes: KartenTreffer | null = null;
  let bestD = radiusPx;
  for (const [lat, lon, tags] of elemente) {
    const art = trefferArt(tags);
    if (!art || zoom < TREFFER_AB_ZOOM[art]) continue;
    const d = abstandPx(lat, lon);
    if (d <= bestD) { bestD = d; bestes = { art, lat, lon, tags }; }
  }
  if (zoom >= TREFFER_AB_ZOOM.gefahr) {
    for (const g of gefahren) {
      if (!GEFAHR_ARTEN.includes(g.art)) continue;
      const d = abstandPx(g.lat, g.lon);
      if (d < bestD) { bestD = d; bestes = { art: 'gefahr', lat: g.lat, lon: g.lon, gefahr: g }; }
    }
  }
  return bestes;
}
