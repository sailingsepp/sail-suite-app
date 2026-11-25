import { vorhaltAusStrom, type Vorhalt } from '@/core/vorhalt';
import type { Strom } from '@/core/types';
import { stromHier } from '@/data/stromHier';

let jetzt: { v: Vorhalt | null; strom: Strom } | null = null;

export function aktualisiereVorhalt(lat: number, lon: number, kueg: number | null, fueg: number | null): Vorhalt | null {
  const strom = stromHier(lat, lon);
  jetzt = strom ? { v: vorhaltAusStrom(kueg, fueg, strom), strom } : null;
  return jetzt?.v ?? null;
}

export function vorhaltWeg(): void { jetzt = null; }

export function vorhaltJetzt(): { v: Vorhalt | null; strom: Strom } | null { return jetzt; }
