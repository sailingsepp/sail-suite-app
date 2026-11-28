import { bearingDeg, distNM } from './geo';
import type { Punkt } from './types';

export const NOTHAFEN_MAX_SM = 30;
export const NOTHAFEN_ANZAHL = 3;

const DOPPELT_SM = 0.3;

export interface Nothafen { name: string; lat: number; lon: number; sm: number; peilung: number }

export function naechsteHaefen(
  boot: Punkt, namen: readonly { lat: number; lon: number; art: string; name: string }[],
  n = NOTHAFEN_ANZAHL, maxSm = NOTHAFEN_MAX_SM,
): Nothafen[] {
  const alle: Nothafen[] = [];
  for (const x of namen) {
    if ((x.art !== 'hafen' && x.art !== 'marina') || !x.name.trim()) continue;
    const sm = distNM(boot.lat, boot.lon, x.lat, x.lon);
    if (sm > maxSm) continue;
    alle.push({ name: x.name.trim(), lat: x.lat, lon: x.lon, sm, peilung: bearingDeg(boot.lat, boot.lon, x.lat, x.lon) });
  }
  alle.sort((a, b) => a.sm - b.sm);
  const aus: Nothafen[] = [];
  for (const h of alle) {
    if (aus.some((g) => g.name === h.name && distNM(g.lat, g.lon, h.lat, h.lon) < DOPPELT_SM)) continue;
    aus.push(h);
    if (aus.length >= n) break;
  }
  return aus;
}
