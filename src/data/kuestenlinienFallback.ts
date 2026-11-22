import type { Punkt } from '@/core/types';

const KACHEL_TOLERANZ_GRAD = 0.002;

const KACHEL_MIN_GRAD = 0.02;
const nahGanzerGrad = (x: number): boolean => Math.abs(x - Math.round(x)) < KACHEL_TOLERANZ_GRAD;

export function istKachelkante(lat1: number, lon1: number, lat2: number, lon2: number): boolean {
  if (lat1 === lat2 && lon1 === lon2) return true;
  if ((lat1 === lat2 && nahGanzerGrad(lat1)) || (lon1 === lon2 && nahGanzerGrad(lon1))) return true;

  const gleicherGrad = (a: number, b: number) => nahGanzerGrad(a) && nahGanzerGrad(b) && Math.round(a) === Math.round(b);
  return (gleicherGrad(lat1, lat2) && Math.abs(lat1 - lat2) < KACHEL_TOLERANZ_GRAD && Math.abs(lon1 - lon2) > KACHEL_MIN_GRAD)
    || (gleicherGrad(lon1, lon2) && Math.abs(lon1 - lon2) < KACHEL_TOLERANZ_GRAD && Math.abs(lat1 - lat2) > KACHEL_MIN_GRAD);
}

export async function kuestenlinienRueckfall(
  swLat: number, swLon: number, neLat: number, neLon: number,
): Promise<[Punkt, Punkt][] | null> {
  const { KUESTE_OSM_BOX, KUESTE_OSM_SEGMENTE } = await import('@/core/kuestenlinienOsm');
  const box = KUESTE_OSM_BOX;

  if (swLat < box.s || neLat > box.n || swLon < box.w || neLon > box.e) return null;

  const linien: [Punkt, Punkt][] = [];
  for (let i = 0; i < KUESTE_OSM_SEGMENTE.length; i += 4) {
    const lat1 = KUESTE_OSM_SEGMENTE[i]!;
    const lon1 = KUESTE_OSM_SEGMENTE[i + 1]!;
    const lat2 = KUESTE_OSM_SEGMENTE[i + 2]!;
    const lon2 = KUESTE_OSM_SEGMENTE[i + 3]!;

    const p1Drin = lat1 >= swLat && lat1 <= neLat && lon1 >= swLon && lon1 <= neLon;
    const p2Drin = lat2 >= swLat && lat2 <= neLat && lon2 >= swLon && lon2 <= neLon;
    if ((p1Drin || p2Drin) && !istKachelkante(lat1, lon1, lat2, lon2)) {
      linien.push([{ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }]);
    }
  }
  return linien;
}
