import type { Strom } from './types';




export const VORHALT_MIN_FUEG = 1;

export const VORHALT_MIN_FDW = 0.5;

export interface Vorhalt {
  
  kdw: number;
  
  fdw: number;
  
  winkel: number;
}


export function vorhaltAusStrom(kueg: number | null, fueg: number | null, strom: Strom | null): Vorhalt | null {
  if (kueg === null || fueg === null || !strom?.valid || fueg < VORHALT_MIN_FUEG) return null;
  const rad = Math.PI / 180;
  const we = fueg * Math.sin(kueg * rad) - strom.speed * Math.sin(strom.dir * rad);
  const wn = fueg * Math.cos(kueg * rad) - strom.speed * Math.cos(strom.dir * rad);
  const fdw = Math.hypot(we, wn);
  if (fdw < VORHALT_MIN_FDW) return null;
  const kdw = (Math.atan2(we, wn) / rad + 360) % 360;
  const winkel = ((kdw - kueg + 540) % 360) - 180;
  return { kdw, fdw, winkel };
}
