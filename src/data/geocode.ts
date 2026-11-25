import type { Punkt } from '@/core/types';

import { holeUeberServer } from './fremdProxy';

interface NominatimAdresse {
  hamlet?: string;
  village?: string;
  city_district?: string;
  town?: string;
  city?: string;
  suburb?: string;
  municipality?: string;
  island?: string;
}

export interface OrtsKomponenten {
  ort: string | null;
  insel: string | null;

  gemeinde: string | null;

  ortschaft?: string | null;

  roh?: Record<string, string>;

  fehler?: true;
}

export function ohneVerwaltungswort(roh: string): string {
  return roh
    .replace(/^(Općina|Opcina|Gemeinde|Demos|Δήμος)\s+/i, '')
    .replace(/\s+(Municipality|Gemeinde|Općina|Opcina)$/i, '')
    .trim();
}

async function reverseKomponenten(punkt: Punkt, timeoutMs: number, sprache: 'de' | 'en' = 'en'): Promise<OrtsKomponenten> {
  const LEER: OrtsKomponenten = { ort: null, insel: null, gemeinde: null };
  const FEHLER: OrtsKomponenten = { ...LEER, fehler: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${punkt.lat}&lon=${punkt.lon}`
      + `&zoom=16&addressdetails=1&accept-language=${sprache}`;

    const res = await holeUeberServer(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'sail-suite-coursecast (privates, nicht-kommerzielles Segelprojekt)' },
    });
    if (!res.ok) return FEHLER;
    const data = await res.json() as { address?: NominatimAdresse };
    const a = data.address;
    if (!a) return LEER;

    const ort = a.hamlet ?? a.city_district ?? a.village ?? a.town ?? a.city ?? a.suburb ?? null;

    const verwaltung = [a.village, a.city_district, a.town, a.hamlet, a.suburb]
      .find((v): v is string => !!v && ohneVerwaltungswort(v) !== v);
    const gemeinde = a.municipality ? ohneVerwaltungswort(a.municipality)
      : verwaltung ? ohneVerwaltungswort(verwaltung) : null;
    const dorf = a.village && ohneVerwaltungswort(a.village) === a.village ? a.village : null;

    const ortschaft = a.town ?? a.city ?? dorf ?? a.city_district ?? gemeinde ?? a.hamlet ?? a.suburb ?? null;
    const roh: Record<string, string> = {};
    for (const k of ['hamlet', 'village', 'city_district', 'town', 'city', 'suburb', 'municipality', 'island'] as const) {
      const v = a[k];
      if (v) roh[k] = v;
    }
    return { ort, insel: a.island ?? null, gemeinde, ortschaft, roh };
  } catch {
    return FEHLER;
  } finally {
    clearTimeout(timer);
  }
}

export async function landAmPunkt(punkt: Punkt, sprache: 'de' | 'en', timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${punkt.lat}&lon=${punkt.lon}`
      + `&zoom=3&addressdetails=1&accept-language=${sprache}`;
    const res = await holeUeberServer(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'sail-suite-coursecast (privates, nicht-kommerzielles Segelprojekt)' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { address?: { country?: string } };
    return data.address?.country?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseOrt(punkt: Punkt, timeoutMs = 6000): Promise<string | null> {
  const { ort, insel } = await reverseKomponenten(punkt, timeoutMs, 'en');
  if (ort && insel) return `${ort}, Insel ${insel}`;
  if (ort) return ort;
  if (insel) return `Insel ${insel}`;
  return null;
}

export async function reverseOrtKomponenten(punkt: Punkt, timeoutMs = 6000): Promise<OrtsKomponenten> {
  return reverseKomponenten(punkt, timeoutMs, 'en');
}

export async function reverseOrtFuerLogbuch(punkt: Punkt, sprache: 'de' | 'en', timeoutMs = 6000): Promise<OrtsKomponenten> {
  return reverseKomponenten(punkt, timeoutMs, sprache);
}

export async function reverseOrtKomponentenDe(punkt: Punkt, timeoutMs = 6000): Promise<OrtsKomponenten> {
  return reverseKomponenten(punkt, timeoutMs, 'de');
}

export async function naechsterBenannterOrt(
  punkt: Punkt, sprache: 'de' | 'en', timeoutMs = 6000,
): Promise<{ name: string; lat: number; lon: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${punkt.lat}&lon=${punkt.lon}`
      + `&zoom=14&accept-language=${sprache}`;
    const res = await holeUeberServer(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'sail-suite-coursecast (privates, nicht-kommerzielles Segelprojekt)' },
    });
    if (!res.ok) return null;
    const d = await res.json() as { name?: string; lat?: string; lon?: string };
    const name = d.name?.trim() ? ohneVerwaltungswort(d.name.trim()) : '';
    const lat = Number(d.lat), lon = Number(d.lon);
    return name && Number.isFinite(lat) && Number.isFinite(lon) ? { name, lat, lon } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
