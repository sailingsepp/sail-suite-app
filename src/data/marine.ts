import { nDate } from '@/core/time';
import type { StundenMarine, Strom, Seegang, Gezeit, StreckenPunkt } from '@/core/types';
import { holeOpenMeteoJson } from './openMeteoNetz';
import { mitZone } from './openMeteo';
import { meldeFormatabweichung } from './fehlerbericht';

const KMH_TO_KN = 1 / 1.852;

const ZEITEN_CACHE = new WeakMap<StundenMarine, number[]>();
function geparsteZeiten(hourly: StundenMarine): number[] {
  let t = ZEITEN_CACHE.get(hourly);
  if (!t) { t = hourly.time.map((s) => nDate(s).getTime()); ZEITEN_CACHE.set(hourly, t); }
  return t;
}

const FORECAST_DAYS = 6;

const CHUNK = 10;

function istGueltigeMarineantwort(hourly: unknown): hourly is StundenMarine {
  if (!hourly || typeof hourly !== 'object') return false;
  const t = (hourly as Record<string, unknown>).time;
  return Array.isArray(t) && t.length > 0;
}

export async function fetchCurrentForPoints(points: StreckenPunkt[], zone: string | null = null): Promise<(StundenMarine | null)[]> {
  const results = new Array<StundenMarine | null>(points.length).fill(null);
  const chunks: StreckenPunkt[][] = [];
  for (let i = 0; i < points.length; i += CHUNK) chunks.push(points.slice(i, i + CHUNK));

  await Promise.all(chunks.map(async (chunk, b) => {
    const lats = chunk.map((p) => p.lat.toFixed(4)).join(',');
    const lons = chunk.map((p) => p.lon.toFixed(4)).join(',');
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}`
      + `&hourly=ocean_current_velocity,ocean_current_direction`
      + `,wave_height,wave_period,wave_direction`
      + `,wind_wave_height,wind_wave_period,wind_wave_direction`
      + `,swell_wave_height,swell_wave_period,swell_wave_direction`
      + `,sea_level_height_msl,sea_surface_temperature`
      + `&cell_selection=sea&timezone=auto&forecast_days=${FORECAST_DAYS}`;
    const data = await holeOpenMeteoJson(zone ? mitZone(url, zone) : url);
    const arr = Array.isArray(data) ? data : [data];
    arr.forEach((d, idx) => {
      const hourly = (d as { hourly: StundenMarine | null }).hourly;
      if (hourly != null && !istGueltigeMarineantwort(hourly)) {
        meldeFormatabweichung('marine.fetchCurrentForPoints', 'Antwort ohne die erwarteten Marine-Felder', hourly);
        results[b * CHUNK + idx] = null;
        return;
      }
      results[b * CHUNK + idx] = hourly ?? null;
    });
  }));
  return results;
}

export function currentAt(hourly: StundenMarine | null, targetDate: Date): Strom {
  if (!hourly || !hourly.ocean_current_velocity) return { speed: 0, dir: 0, valid: false };
  const times = geparsteZeiten(hourly);
  const target = targetDate.getTime();
  let idx = times.findIndex((t) => t > target);
  if (idx === -1) idx = times.length - 1;
  if (idx === 0) idx = 1;
  const i0 = idx - 1, i1 = idx;
  const v0 = hourly.ocean_current_velocity[i0], v1 = hourly.ocean_current_velocity[i1];
  const c0 = hourly.ocean_current_direction[i0], c1 = hourly.ocean_current_direction[i1];
  if (v0 == null || v1 == null || c0 == null || c1 == null) return { speed: 0, dir: 0, valid: false };
  const t0 = times[i0]!, t1 = times[i1]!;

  const frac = t1 > t0 ? Math.min(1, Math.max(0, (target - t0) / (t1 - t0))) : 0;
  const speedKmh = v0 + (v1 - v0) * frac;
  const diff = ((c1 - c0 + 540) % 360) - 180;
  const dir = (c0 + diff * frac + 360) % 360;
  return { speed: speedKmh * KMH_TO_KN, dir, valid: true };
}

export function waveAt(hourly: StundenMarine | null, targetDate: Date): Seegang {
  const none: Seegang = {
    hs: 0, tp: 0, dir: 0, swellHs: 0, swellTp: 0, swellDir: 0,
    windWaveHs: 0, windWaveTp: 0, windWaveDir: 0, steep: 0, kreuzWinkel: 0, valid: false,
  };
  if (!hourly || !hourly.wave_height) return none;
  const times = geparsteZeiten(hourly);
  const target = targetDate.getTime();
  let idx = times.findIndex((t) => t > target);
  if (idx === -1) idx = times.length - 1;
  if (idx === 0) idx = 1;
  const i0 = idx - 1, i1 = idx;
  const t0 = times[i0]!, t1 = times[i1]!;

  const frac = t1 > t0 ? Math.min(1, Math.max(0, (target - t0) / (t1 - t0))) : 0;
  const lin = (a: (number | null)[] | undefined): number | null =>
    (a && a[i0] != null && a[i1] != null) ? a[i0]! + (a[i1]! - a[i0]!) * frac : null;
  const ang = (a: (number | null)[] | undefined): number | null => {
    if (!a || a[i0] == null || a[i1] == null) return null;
    const d = ((a[i1]! - a[i0]! + 540) % 360) - 180;
    return (a[i0]! + d * frac + 360) % 360;
  };
  const hs = lin(hourly.wave_height);
  if (hs == null) return none;
  const tp = lin(hourly.wave_period) ?? 0;
  const windWaveHs = lin(hourly.wind_wave_height) ?? hs;
  const windWaveTp = lin(hourly.wind_wave_period) ?? tp;
  const L = windWaveTp > 0 ? 9.81 * windWaveTp * windWaveTp / (2 * Math.PI) : 0;
  const swellHs = lin(hourly.swell_wave_height) ?? 0;
  const swellDir = ang(hourly.swell_wave_direction) ?? 0;
  const windWaveDir = ang(hourly.wind_wave_direction) ?? ang(hourly.wave_direction) ?? 0;
  return {
    hs, tp, dir: ang(hourly.wave_direction) ?? 0,
    swellHs,
    swellTp: lin(hourly.swell_wave_period) ?? 0,
    swellDir,
    windWaveHs, windWaveTp, windWaveDir,
    steep: L > 0 ? windWaveHs / L : 0,
    kreuzWinkel: kreuzWinkel(windWaveHs, windWaveDir, swellHs, swellDir,
      hourly.wind_wave_direction != null && hourly.swell_wave_direction != null),
    valid: true,
  };
}

export const KREUZSEE_MIN_HS = 0.5;

export const KREUZSEE_MIN_VERHAELTNIS = 0.4;

export const KREUZSEE_MIN_WINKEL = 60;

export const KREUZSEE_MIN_GEMEINSAM = 1.0;

export function kreuzWinkel(
  windWaveHs: number, windWaveDir: number,
  swellHs: number, swellDir: number,
  getrennt: boolean,
): number {
  if (!getrennt) return 0;
  if (windWaveHs < KREUZSEE_MIN_HS || swellHs < KREUZSEE_MIN_HS) return 0;
  if (Math.hypot(windWaveHs, swellHs) < KREUZSEE_MIN_GEMEINSAM) return 0;
  const klein = Math.min(windWaveHs, swellHs), gross = Math.max(windWaveHs, swellHs);
  if (gross <= 0 || klein / gross < KREUZSEE_MIN_VERHAELTNIS) return 0;
  const diff = Math.abs(((windWaveDir - swellDir + 540) % 360) - 180);
  return diff >= KREUZSEE_MIN_WINKEL ? diff : 0;
}

const WASSERSTAND_MITTEL_CACHE = new WeakMap<StundenMarine, number | null>();
function wasserstandMittel(hourly: StundenMarine): number | null {
  if (WASSERSTAND_MITTEL_CACHE.has(hourly)) return WASSERSTAND_MITTEL_CACHE.get(hourly)!;
  const werte = (hourly.sea_level_height_msl ?? []).filter((v): v is number => v != null);
  const mittel = werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : null;
  WASSERSTAND_MITTEL_CACHE.set(hourly, mittel);
  return mittel;
}

export function gezeitenAt(hourly: StundenMarine | null, targetDate: Date): Gezeit {
  const none: Gezeit = { hoeheM: 0, valid: false };
  if (!hourly || !hourly.sea_level_height_msl) return none;
  const mittel = wasserstandMittel(hourly);
  if (mittel == null) return none;
  const times = geparsteZeiten(hourly);
  const target = targetDate.getTime();
  let idx = times.findIndex((t) => t > target);
  if (idx === -1) idx = times.length - 1;
  if (idx === 0) idx = 1;
  const i0 = idx - 1, i1 = idx;
  const h0 = hourly.sea_level_height_msl[i0], h1 = hourly.sea_level_height_msl[i1];
  if (h0 == null || h1 == null) return none;
  const t0 = times[i0]!, t1 = times[i1]!;
  const frac = t1 > t0 ? Math.min(1, Math.max(0, (target - t0) / (t1 - t0))) : 0;
  return { hoeheM: (h0 + (h1 - h0) * frac) - mittel, valid: true };
}
