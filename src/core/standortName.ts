import { distNM } from './geo';
import { positionText } from './koordinaten';
import type { Sprache } from './types';



const M_PRO_NM = 1852;


export const ORT_NEU_M = 500;

export const ORT_NEU_MS = 5 * 60_000;

export const ORT_GILT_M = 1500;

export interface Punkt { lat: number; lon: number }
export interface Versuch extends Punkt { t: number }
export interface StandOrt extends Punkt { name: string }

const abstandM = (a: Punkt, b: Punkt) => distNM(a.lat, a.lon, b.lat, b.lon) * M_PRO_NM;


export function sollNeuBenennen(letzter: Versuch | null, pos: Punkt, jetzt: number): boolean {
  if (!letzter) return true;
  return jetzt - letzter.t >= ORT_NEU_MS && abstandM(letzter, pos) > ORT_NEU_M;
}


export function ortFuerPosition(pos: Punkt, ort: StandOrt | null | undefined): string | null {
  return ort && ort.name && abstandM(pos, ort) <= ORT_GILT_M ? ort.name : null;
}


export function fotoOrtText(f: { lat: number | null; lon: number | null; ort?: string | null }, sprache: Sprache): string | null {
  if (f.lat === null || f.lon === null) return null;
  return f.ort ? f.ort : positionText(f.lat, f.lon, sprache);
}
