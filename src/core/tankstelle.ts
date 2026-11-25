import { distNM } from './geo';
import { nf } from './time';
import type { Sprache } from './types';

export const TANKSTELLE_NAH_M = 30;

export const TANKSTELLE_SUCHE_M = 80;

export const TANKPAUSE_MAX_MIN = 60;

type Tags = Readonly<Record<string, string>>;

export function istBootstankstelle(t: Tags): boolean {
  if (t['waterway'] === 'fuel') return true;
  const kat = t['seamark:small_craft_facility:category'];
  if (kat && kat.split(';').map((s) => s.trim()).includes('fuel_station')) return true;
  return t['amenity'] === 'fuel' && (t['boat'] === 'yes' || t['boat'] === 'designated');
}

export interface Tankstelle {
  lat: number;
  lon: number;
  name: string | null;
  abstandM: number;
}

export function naechsteTankstelle(
  elemente: readonly { lat: number; lon: number; tags?: Tags }[],
  punkt: { lat: number; lon: number },
  maxM = TANKSTELLE_NAH_M,
): Tankstelle | null {
  let beste: Tankstelle | null = null;
  for (const e of elemente) {
    if (!e.tags || !istBootstankstelle(e.tags)) continue;
    const m = distNM(punkt.lat, punkt.lon, e.lat, e.lon) * 1852;
    if (m > maxM || (beste && m >= beste.abstandM)) continue;
    beste = { lat: e.lat, lon: e.lon, name: e.tags['name'] ?? e.tags['seamark:name'] ?? null, abstandM: m };
  }
  return beste;
}

export interface TankMerker {
  fahrt: string;

  t: number;
  lat: number;
  lon: number;
  name: string | null;
  abstandM: number;
}

export const TANKSTOPP_STILL_MIN = 3;
export const TANKSTOPP_STILL_M = 25;
export const TANKSTOPP_WEG_M = 80;

export function liegtStill(
  fixe: readonly { t: number; lat: number; lon: number; acc?: number }[],
  jetzt: number,
  minuten = TANKSTOPP_STILL_MIN,
  radiusM = TANKSTOPP_STILL_M,
): { seit: number; lat: number; lon: number } | null {

  const gut = (f: { acc?: number }) => !(typeof f.acc === 'number' && f.acc > 30);
  let i = fixe.length - 1;
  while (i >= 0 && !gut(fixe[i]!)) i--;
  const letzter = i >= 0 ? fixe[i]! : null;
  if (!letzter || jetzt - letzter.t > 2 * 60_000) return null;
  let seit = letzter.t;
  let sLat = 0, sLon = 0, n = 0;
  let weg = false;
  for (; i >= 0; i--) {
    const f = fixe[i]!;
    if (!gut(f)) continue;
    if (distNM(f.lat, f.lon, letzter.lat, letzter.lon) * 1852 > radiusM) { weg = true; break; }
    sLat += f.lat; sLon += f.lon; n++;
    seit = f.t;
  }

  if (!weg || letzter.t - seit < minuten * 60_000) return null;
  return { seit, lat: sLat / n, lon: sLon / n };
}

export function sollTankstoppFragen(m: TankMerker | null, fahrtId: string | null, jetzt: number): boolean {
  if (!m || !fahrtId || m.fahrt !== fahrtId) return false;
  const min = (jetzt - m.t) / 60_000;
  return min >= 0 && min <= TANKPAUSE_MAX_MIN;
}

export function istTankMerker(x: unknown): x is TankMerker {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o['fahrt'] === 'string' && typeof o['t'] === 'number' && typeof o['lat'] === 'number'
    && typeof o['lon'] === 'number' && (o['name'] === null || typeof o['name'] === 'string')
    && typeof o['abstandM'] === 'number';
}

export function tankstoppText(liter: number, ort: string | null, sprache: Sprache): string {
  const l = `${nf(liter, Number.isInteger(liter) ? 0 : 1, sprache)} l ${sprache === 'de' ? 'Diesel' : 'diesel'}`;
  return ort ? `${l}, ${ort}` : l;
}
