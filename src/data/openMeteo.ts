import { nDate } from '@/core/time';
import type { StundenWind, Tageslicht, Wind, StreckenPunkt } from '@/core/types';
import { holeOpenMeteoJson } from './openMeteoNetz';
import { meldeFormatabweichung } from './fehlerbericht';


export const RECHENMODELL = 'ecmwf_ifs025';
export const VERGLEICHSMODELL = 'best_match';
export type WindModell = typeof RECHENMODELL | typeof VERGLEICHSMODELL;

export interface WindForPoints {
  hourly: StundenWind[];
  
  utcOffsetSeconds: number;
  
  vergleich: (StundenWind | null)[];
  
  rechenmodell: WindModell;
  
  zone?: string | null;
}


const HOURLY_FELDER = [
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'wind_speed_80m',
  'weather_code', 'precipitation', 'cape', 'lifted_index', 'visibility',
  'pressure_msl', 'cloud_cover', 'temperature_2m', 'dew_point_2m',
] as const;

function hatWerte(a: unknown): a is (number | null)[] {
  return Array.isArray(a) && a.some((v) => v != null);
}


export function trenneModelle(hourly: Record<string, unknown>): { rechnung: StundenWind; vergleich: StundenWind | null; rechenmodell: WindModell } {
  if (Array.isArray(hourly.wind_speed_10m)) {
    return { rechnung: hourly as unknown as StundenWind, vergleich: null, rechenmodell: VERGLEICHSMODELL };
  }
  const feld = (name: string, modell: WindModell) => hourly[`${name}_${modell}`];
  const ecmwfWind = hatWerte(feld('wind_speed_10m', RECHENMODELL)) && hatWerte(feld('wind_direction_10m', RECHENMODELL));
  const windModell: WindModell = ecmwfWind ? RECHENMODELL : VERGLEICHSMODELL;
  const rechnung: Record<string, unknown> = { time: hourly.time };
  for (const name of HOURLY_FELDER) {
    const windFeld = name.startsWith('wind_');
    const bevorzugt = feld(name, windFeld ? windModell : RECHENMODELL);
    const ersatz = feld(name, VERGLEICHSMODELL);
    const wert = windFeld ? (bevorzugt ?? ersatz) : (hatWerte(bevorzugt) ? bevorzugt : ersatz);
    if (wert !== undefined) rechnung[name] = wert;
  }
  const vergleich: StundenWind | null = ecmwfWind && Array.isArray(feld('wind_speed_10m', VERGLEICHSMODELL))
    ? {
      time: hourly.time as string[],
      wind_speed_10m: feld('wind_speed_10m', VERGLEICHSMODELL) as number[],
      wind_direction_10m: feld('wind_direction_10m', VERGLEICHSMODELL) as number[],
      wind_gusts_10m: (feld('wind_gusts_10m', VERGLEICHSMODELL) ?? []) as number[],
      
      weather_code: [], precipitation: [], cape: [],
    }
    : null;
  return { rechnung: rechnung as unknown as StundenWind, vergleich, rechenmodell: windModell };
}








export const FORECAST_DAYS = 6;

const CHUNK = 10; 


function bloecke<T>(alle: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < alle.length; i += CHUNK) out.push(alle.slice(i, i + CHUNK));
  return out;
}


function istGueltigeWindantwort(hourly: unknown): hourly is StundenWind {
  if (!hourly || typeof hourly !== 'object') return false;
  const h = hourly as Record<string, unknown>;
  const zeit = h.time;
  if (!Array.isArray(zeit) || zeit.length === 0) return false;
  return (['wind_speed_10m', 'wind_direction_10m'] as const)
    .every((feld) => Array.isArray(h[feld]) && (h[feld] as unknown[]).length === zeit.length);
}


export function einheitlicheZone(antworten: readonly { timezone?: string }[]): string | null {
  const zonen = antworten.map((a) => a.timezone).filter((z): z is string => typeof z === 'string' && z.length > 0);
  if (zonen.length === 0) return null;
  const buergerlich = zonen.filter((z) => !z.startsWith('Etc/'));
  const kandidaten = buergerlich.length > 0 ? buergerlich : zonen;
  const anzahl = new Map<string, number>();
  for (const z of kandidaten) anzahl.set(z, (anzahl.get(z) ?? 0) + 1);
  return [...anzahl].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
}


export function mitZone(url: string, zone: string): string {
  return url.replace('timezone=auto', `timezone=${encodeURIComponent(zone)}`);
}

export async function fetchWindForPoints(points: StreckenPunkt[]): Promise<WindForPoints> {
  const hourly = new Array<StundenWind>(points.length);
  let utcOffsetSeconds = 0;
  const bloeckeRoh: { url: string; arr: unknown[] }[] = [];
  
  
  
  await Promise.all(bloecke(points).map(async (chunk, b) => {
    const lats = chunk.map((p) => p.lat.toFixed(4)).join(',');
    const lons = chunk.map((p) => p.lon.toFixed(4)).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}`
      + `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m`
      + `,weather_code,precipitation,cape,lifted_index,visibility`
      + `,pressure_msl,cloud_cover,temperature_2m,dew_point_2m`
      + `&models=${RECHENMODELL},${VERGLEICHSMODELL}`
      + `&wind_speed_unit=kn&timezone=auto&forecast_days=${FORECAST_DAYS}`;
    const data = await holeOpenMeteoJson(url);
    bloeckeRoh[b] = { url, arr: Array.isArray(data) ? data : [data] };
  }));

  
  
  
  
  const zone = einheitlicheZone(bloeckeRoh.flatMap((x) => x.arr as { timezone?: string }[]));
  if (zone) {
    await Promise.all(bloeckeRoh.map(async (blk, b) => {
      if (blk.arr.every((d) => (d as { timezone?: string }).timezone === zone)) return;
      const data = await holeOpenMeteoJson(mitZone(blk.url, zone));
      bloeckeRoh[b] = { url: blk.url, arr: Array.isArray(data) ? data : [data] };
    }));
  }

  const vergleich = new Array<StundenWind | null>(points.length);
  let rechenmodell: WindModell = RECHENMODELL;
  bloeckeRoh.forEach(({ arr }, b) => {
    arr.forEach((d, idx) => {
      const punkt = d as { hourly?: Record<string, unknown>; utc_offset_seconds?: number };
      const getrennt = punkt?.hourly && typeof punkt.hourly === 'object' ? trenneModelle(punkt.hourly) : null;
      if (!getrennt || !istGueltigeWindantwort(getrennt.rechnung)) {
        meldeFormatabweichung('openMeteo.fetchWindForPoints', 'Antwort ohne die erwarteten Windfelder', punkt);
        throw new Error('Open-Meteo: unerwartete Antwortform (Windfelder fehlen oder haben falsche Länge)');
      }
      hourly[b * CHUNK + idx] = getrennt.rechnung;
      vergleich[b * CHUNK + idx] = getrennt.vergleich;
      
      
      if (getrennt.rechenmodell !== RECHENMODELL) rechenmodell = VERGLEICHSMODELL;
      if (b === 0 && idx === 0 && punkt.utc_offset_seconds != null) utcOffsetSeconds = punkt.utc_offset_seconds;
    });
  });
  if (rechenmodell !== RECHENMODELL) {
    bloeckeRoh.forEach(({ arr }, b) => {
      arr.forEach((d, idx) => {
        const h = (d as { hourly: Record<string, unknown> }).hourly;
        if (Array.isArray(h[`wind_speed_10m_${VERGLEICHSMODELL}`])) {
          const r = hourly[b * CHUNK + idx]!;
          r.wind_speed_10m = h[`wind_speed_10m_${VERGLEICHSMODELL}`] as number[];
          r.wind_direction_10m = h[`wind_direction_10m_${VERGLEICHSMODELL}`] as number[];
          r.wind_gusts_10m = (h[`wind_gusts_10m_${VERGLEICHSMODELL}`] ?? []) as number[];
          const w80 = h[`wind_speed_80m_${VERGLEICHSMODELL}`];
          if (Array.isArray(w80)) r.wind_speed_80m = w80 as (number | null)[]; else delete r.wind_speed_80m;
        }
        vergleich[b * CHUNK + idx] = null;
      });
    });
  }
  return { hourly, utcOffsetSeconds, vergleich, rechenmodell, zone };
}

function istGueltigeTageslichtantwort(daily: unknown): daily is Tageslicht {
  if (!daily || typeof daily !== 'object') return false;
  const d = daily as Record<string, unknown>;
  return Array.isArray(d.sunrise) && Array.isArray(d.sunset)
    && d.sunrise.length > 0 && d.sunrise.length === d.sunset.length;
}


export async function fetchDaylight(lat: number, lon: number, zone: string | null = null): Promise<Tageslicht> {
  const roh = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + `&daily=sunrise,sunset,uv_index_max&timezone=auto&forecast_days=${FORECAST_DAYS}`;
  const url = zone ? mitZone(roh, zone) : roh;
  const data = await holeOpenMeteoJson(url);
  const daily = (data as { daily: Tageslicht }).daily;
  if (!istGueltigeTageslichtantwort(daily)) {
    meldeFormatabweichung('openMeteo.fetchDaylight', 'Antwort ohne die erwarteten Tageslichtfelder', daily);
    throw new Error('Open-Meteo: unerwartete Antwortform (Tageslichtfelder fehlen oder passen nicht zusammen)');
  }
  return daily;
}





const ZEITEN_CACHE = new WeakMap<StundenWind, number[]>();
function geparsteZeiten(hourly: StundenWind): number[] {
  let t = ZEITEN_CACHE.get(hourly);
  if (!t) { t = hourly.time.map((s) => nDate(s).getTime()); ZEITEN_CACHE.set(hourly, t); }
  return t;
}


export const LUECKE_STUNDEN = 3;


export function naechsterWert(reihe: readonly (number | null)[], i: number): number | null {
  for (let d = 0; d <= LUECKE_STUNDEN; d++) {
    const a = reihe[i - d], b = reihe[i + d];
    if (a != null) return a;
    if (b != null) return b;
  }
  return null;
}


export function windAt(hourly: StundenWind, targetDate: Date): Wind {
  const times = geparsteZeiten(hourly);
  const target = targetDate.getTime();
  let idx = times.findIndex((t) => t > target);
  if (idx === -1) idx = times.length - 1;
  if (idx === 0) idx = 1;
  const i0 = idx - 1, i1 = idx;
  const t0 = times[i0]!, t1 = times[i1]!;
  
  
  
  
  
  
  const frac = t1 > t0 ? Math.min(1, Math.max(0, (target - t0) / (t1 - t0))) : 0;
  
  
  const n0 = naechsterWert(hourly.wind_speed_10m, i0), n1 = naechsterWert(hourly.wind_speed_10m, i1);
  
  const windLuecke = n0 == null || n1 == null;
  const s0 = n0 ?? 0, s1 = n1 ?? s0;
  const speed = s0 + (s1 - s0) * frac;
  const d0 = naechsterWert(hourly.wind_direction_10m, i0) ?? 0, d1 = naechsterWert(hourly.wind_direction_10m, i1) ?? d0;
  const diff = ((d1 - d0 + 540) % 360) - 180;
  const dir = (d0 + diff * frac + 360) % 360;
  
  
  
  
  const g0 = hourly.wind_gusts_10m ? hourly.wind_gusts_10m[i0] : null;
  const g1 = hourly.wind_gusts_10m ? hourly.wind_gusts_10m[i1] : null;
  const gust = (g0 == null && g1 == null) ? speed : Math.max(g0 ?? 0, g1 ?? 0);
  
  
  
  const wc0 = hourly.weather_code ? hourly.weather_code[i0] : null;
  const wc1 = hourly.weather_code ? hourly.weather_code[i1] : null;
  const sev = (c: number | null | undefined) => (c == null ? -1 : (c >= 95 ? 100 + c : c));
  const code = (wc0 == null && wc1 == null) ? null : (sev(wc0) >= sev(wc1) ? wc0! : wc1!);
  const p0 = hourly.precipitation ? hourly.precipitation[i0] : null;
  const p1 = hourly.precipitation ? hourly.precipitation[i1] : null;
  const precip = (p0 == null && p1 == null) ? 0 : Math.max(p0 ?? 0, p1 ?? 0);
  const cape0 = hourly.cape ? (hourly.cape[i0] ?? 0) : 0;
  const cape1 = hourly.cape ? (hourly.cape[i1] ?? 0) : 0;
  const cape = hourly.cape ? cape0 + (cape1 - cape0) * frac : 0;
  
  
  
  const lin = (a: (number | null)[] | undefined): number | null =>
    (a && a[i0] != null && a[i1] != null) ? a[i0]! + (a[i1]! - a[i0]!) * frac : null;
  const speed80 = lin(hourly.wind_speed_80m);
  const visibility = lin(hourly.visibility);
  const liftedIndex = lin(hourly.lifted_index);
  
  
  
  
  
  const gfVon = (s: number | undefined, g: number | null | undefined) =>
    (s != null && s > 0 && g != null) ? g / s : 0;
  const gf0 = gfVon(s0, g0), gf1 = gfVon(s1, g1);
  const nimmI1 = gf1 > gf0;
  const boeigWind = nimmI1 ? s1 : s0;
  const boeigGust = (nimmI1 ? g1 : g0) ?? boeigWind;
  return {
    speed, dir, gust, code, precip, cape, speed80, visibility, liftedIndex,
    boeigWind, boeigGust,
    ...(windLuecke ? { windLuecke: true } : {}),
  };
}
