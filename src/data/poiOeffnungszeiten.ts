
import type { Punkt } from '@/core/types';
import { queryOverpass } from './overpass';
import { distNM } from '@/core/geo';

export const POI_OEFFNUNGSZEITEN_RADIUS_M = 300;

export interface PoiOeffnungszeitenTreffer {
  
  tagRoh: string;
  
  name: string | null;
  
  distM: number;
}


export async function holeOeffnungszeitenNaheOrt(
  punkt: Punkt, radiusM = POI_OEFFNUNGSZEITEN_RADIUS_M,
): Promise<PoiOeffnungszeitenTreffer | null> {
  const um = `(around:${Math.round(radiusM)},${punkt.lat},${punkt.lon})`;
  const ql = `[out:json][timeout:8];(`
    + `node["opening_hours"]${um};`
    + `way["opening_hours"]${um};`
    + `);out tags center;`;
  try {
    const elemente = await queryOverpass(ql);
    let bestes: PoiOeffnungszeitenTreffer | null = null;
    for (const el of elemente) {
      const tagRoh = el.tags?.['opening_hours'];
      if (!tagRoh) continue;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;
      const distM = distNM(punkt.lat, punkt.lon, lat, lon) * 1852;
      if (!bestes || distM < bestes.distM) bestes = { tagRoh, name: el.tags?.name ?? null, distM };
    }
    return bestes;
  } catch {
    return null;
  }
}
