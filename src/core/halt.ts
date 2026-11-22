import { distNM } from './geo';
import type { Halt, Punkt, StreckenPunkt } from './types';




export const HALT_MAX_MIN = 24 * 60;


export type WegpunktMitHalt = Punkt & { halt?: { min: number; text: string } | null };


export function halteDerRoute(route: readonly WegpunktMitHalt[]): (Halt & Punkt)[] {
  const out: (Halt & Punkt)[] = [];
  for (let i = 1; i < route.length - 1; i++) {
    const h = route[i]!.halt;
    if (h && h.min > 0) out.push({ lat: route[i]!.lat, lon: route[i]!.lon, min: Math.min(h.min, HALT_MAX_MIN), text: h.text.trim(), wp: i });
  }
  return out;
}


export function ordneHalteZu(points: StreckenPunkt[], halte: readonly (Halt & Punkt)[]): void {
  let ab = 1;
  for (const h of halte) {
    let best = -1, bestD = Infinity;
    
    for (let j = ab; j < points.length - 1; j++) {
      const d = distNM(h.lat, h.lon, points[j]!.lat, points[j]!.lon);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best < 0) continue;
    points[best]!.halt = { min: h.min, text: h.text, wp: h.wp };
    ab = best + 1;
  }
}
