import type { Stunde, Stundenwetter } from '@/core/zielwetter';
import { RECHENMODELL, VERGLEICHSMODELL } from './openMeteo';


const MARINE = [
  'wave_height', 'wave_period', 'wave_direction', 'wind_wave_height', 'wind_wave_period', 'wind_wave_direction',
  'swell_wave_height', 'swell_wave_period', 'swell_wave_direction', 'sea_surface_temperature',
] as const;
type MarineFeld = typeof MARINE[number];


async function holeMarine(lat: number, lon: number): Promise<Map<string, Partial<Record<MarineFeld, number | null>>> | null> {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
    + `&hourly=${MARINE.join(',')}&timezone=auto&forecast_days=3&past_days=1&cell_selection=sea`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { hourly?: Record<string, unknown[]> };
    const h = j.hourly;
    if (!h || !Array.isArray(h['time'])) return null;
    const aus = new Map<string, Partial<Record<MarineFeld, number | null>>>();
    h['time'].forEach((zeit, i) => {
      if (typeof zeit !== 'string') return;
      const z: Partial<Record<MarineFeld, number | null>> = {};
      for (const f of MARINE) { const v = h[f]?.[i]; z[f] = typeof v === 'number' && Number.isFinite(v) ? v : null; }
      aus.set(zeit.slice(0, 13), z);
    });
    return aus;
  } catch {
    return null;
  }
}
const FELDER = [
  'temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'dew_point_2m', 'weather_code', 'is_day',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'pressure_msl', 'precipitation',
  'precipitation_probability', 'cloud_cover', 'visibility', 'cape', 'lifted_index', 'uv_index',
] as const;
type Feld = typeof FELDER[number];

const hatWerte = (a: unknown): a is unknown[] => Array.isArray(a) && a.some((v) => typeof v === 'number');


export function reihenAusAntwort(h: Record<string, unknown>): Partial<Record<Feld, unknown[]>> {
  const aus: Partial<Record<Feld, unknown[]>> = {};
  const mitSuffix = !Array.isArray(h['wind_speed_10m']);
  if (!mitSuffix) {
    for (const f of FELDER) if (Array.isArray(h[f])) aus[f] = h[f] as unknown[];
    return aus;
  }
  const feld = (f: Feld, m: string) => h[`${f}_${m}`];
  const windModell = hatWerte(feld('wind_speed_10m', RECHENMODELL)) && hatWerte(feld('wind_direction_10m', RECHENMODELL))
    ? RECHENMODELL : VERGLEICHSMODELL;
  for (const f of FELDER) {
    const r = f.startsWith('wind_') ? feld(f, windModell)
      : hatWerte(feld(f, RECHENMODELL)) ? feld(f, RECHENMODELL) : feld(f, VERGLEICHSMODELL);
    if (Array.isArray(r)) aus[f] = r;
  }
  return aus;
}

export async function holeStundenwetter(lat: number, lon: number): Promise<Stundenwetter | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`
    + `&hourly=${FELDER.join(',')}`
    + `&models=${RECHENMODELL},${VERGLEICHSMODELL}`
    + '&wind_speed_unit=kn&timezone=auto&forecast_days=3&past_days=1&cell_selection=sea';
  const marine = holeMarine(lat, lon);
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { utc_offset_seconds?: number; hourly?: Record<string, unknown[]> };
    const h = j.hourly;
    if (!h || !Array.isArray(h['time']) || typeof j.utc_offset_seconds !== 'number') return null;
    const see = await marine;
    const reihen = reihenAusAntwort(h);
    const n = (k: Feld, i: number) => {
      const v = reihen[k]?.[i];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    };
    const stunden: Stunde[] = [];
    h['time'].forEach((zeit, i) => {
      const windKn = n('wind_speed_10m', i), windAus = n('wind_direction_10m', i), code = n('weather_code', i), temperatur = n('temperature_2m', i);
      if (typeof zeit !== 'string' || windKn === null || windAus === null || code === null || temperatur === null) return;
      stunden.push({
        zeit, windKn, windAus, boeenKn: n('wind_gusts_10m', i), druckHpa: n('pressure_msl', i), code, temperatur,
        tag: n('is_day', i) !== 0,
        gefuehlt: n('apparent_temperature', i), feuchte: n('relative_humidity_2m', i), taupunkt: n('dew_point_2m', i),
        regenMm: n('precipitation', i), regenWahrsch: n('precipitation_probability', i), wolken: n('cloud_cover', i),
        sichtM: n('visibility', i), cape: n('cape', i), liftedIndex: n('lifted_index', i), uv: n('uv_index', i),
        ...seeFelder(see?.get(zeit.slice(0, 13))),
      });
    });
    return stunden.length ? { offsetS: j.utc_offset_seconds, stunden } : null;
  } catch {
    return null;
  }
}

function seeFelder(m: Partial<Record<MarineFeld, number | null>> | undefined): Partial<Stunde> {
  const v = (f: MarineFeld) => m?.[f] ?? null;
  return {
    hsM: v('wave_height'), periodeS: v('wave_period'), seeAus: v('wave_direction'),
    windseeM: v('wind_wave_height'), windseePeriodeS: v('wind_wave_period'), windseeAus: v('wind_wave_direction'),
    duenungM: v('swell_wave_height'), duenungPeriodeS: v('swell_wave_period'), duenungAus: v('swell_wave_direction'),
    wasserTemp: v('sea_surface_temperature'),
  };
}
