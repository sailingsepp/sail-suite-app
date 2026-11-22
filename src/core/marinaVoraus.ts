import { bearingDeg, distNM } from './geo';
import type { Punkt } from './types';

export const VORAUS_MAX_SM = 1;
export const VORAUS_HALBWINKEL_GRAD = 60;
export const NAH_SM = 0.3;

export interface Liegeplatz { name: string; ort: Punkt; art: 'marina' | 'hafen' | 'bucht' }

export function winkelAbstand(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

export function marinaVoraus(
  position: Punkt, cog: number | null, plaetze: readonly Liegeplatz[],
): (Liegeplatz & { distanzSm: number }) | null {
  let beste: (Liegeplatz & { distanzSm: number }) | null = null;
  for (const p of plaetze) {
    if (p.art === 'bucht' || !p.name.trim()) continue;
    const sm = distNM(position.lat, position.lon, p.ort.lat, p.ort.lon);
    if (sm > VORAUS_MAX_SM) continue;
    const voraus = cog == null || sm < NAH_SM
      || winkelAbstand(bearingDeg(position.lat, position.lon, p.ort.lat, p.ort.lon), cog) <= VORAUS_HALBWINKEL_GRAD;
    if (!voraus) continue;

    const besser = !beste || sm < beste.distanzSm - 0.1
      || (Math.abs(sm - beste.distanzSm) <= 0.1 && p.art === 'marina' && beste.art !== 'marina');
    if (besser) beste = { ...p, distanzSm: sm };
  }
  return beste;
}
