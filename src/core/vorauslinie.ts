import { destPoint } from './geo';
import type { Punkt } from './types';



export const VORAUS_MIN = 60;

export const VORAUS_MIN_SOG_KN = 0.5;
export const STRICH_MIN = [1, 2, 5, 10, 15, 30] as const;
export const STRICH_PX = 36;

export const BESCHRIFTUNG_PX = 60;

export interface VorausStrich {
  lat: number;
  lon: number;
  min: number;
  beschriftet: boolean;
}

export interface Vorauslinie {
  ende: [number, number];
  striche: VorausStrich[];
}


export function strichAbstand(pxJeMin: number): number | null {
  if (!(pxJeMin > 0)) return null;
  for (const m of STRICH_MIN) if (m * pxJeMin >= STRICH_PX) return m;
  return null;
}


export function vorauslinie(
  lat: number, lon: number, cog: number | null, sogKn: number | null, pxJeMin: number, bisMin = VORAUS_MIN,
): Vorauslinie | null {
  if (cog === null || sogKn === null || !(sogKn >= VORAUS_MIN_SOG_KN)) return null;
  const smJeMin = sogKn / 60;
  const laenge = Math.min(Math.max(bisMin, 0), VORAUS_MIN);
  const ende = destPoint(lat, lon, cog, smJeMin * laenge);
  const abstand = strichAbstand(pxJeMin);
  const striche: VorausStrich[] = [];
  if (abstand !== null) {
    const jeBeschriftung = Math.max(1, Math.ceil(BESCHRIFTUNG_PX / (abstand * pxJeMin)));
    for (let k = 1; k * abstand <= laenge; k++) {
      const min = k * abstand;
      const [la, lo] = destPoint(lat, lon, cog, smJeMin * min);
      striche.push({ lat: la, lon: lo, min, beschriftet: k % jeBeschriftung === 0 });
    }
  }
  return { ende, striche };
}


export const LAND_MIN_SM = 0.03;


export function landquerung(von: Punkt, nach: Punkt, kueste: readonly (readonly [Punkt, Punkt])[], mindestSm = LAND_MIN_SM): number | null {
  const k = Math.cos((von.lat * Math.PI) / 180);
  const dx = (nach.lon - von.lon) * k, dy = nach.lat - von.lat;
  const laengeGrad = Math.hypot(dx, dy);
  if (!(laengeGrad > 0)) return null;
  const tMin = mindestSm / 60 / laengeGrad;
  let best: number | null = null;
  for (const [a, b] of kueste) {
    const ax = (a.lon - von.lon) * k, ay = a.lat - von.lat;
    const ex = (b.lon - a.lon) * k, ey = b.lat - a.lat;
    const nenner = dx * ey - dy * ex;
    if (nenner === 0) continue;
    const t = (ax * ey - ay * ex) / nenner;
    const u = (ax * dy - ay * dx) / nenner;
    if (t < tMin || t > 1 || u < 0 || u > 1) continue;
    if (best === null || t < best) best = t;
  }
  return best;
}
