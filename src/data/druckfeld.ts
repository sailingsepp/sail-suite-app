import { nDate } from '@/core/time';
import { glaetteDruckfeld, DRUCKFELD_STUNDEN, type DruckGitter, type DruckfeldSchnappschuss } from '@/core/druckfeld';
import type { FrontenFelder } from '@/core/fronten';
import type { Punkt } from '@/core/types';

const SCHRITT_LAT = 1.5;
const SCHRITT_LON = 2;

const ANZAHL_LAT = 15;
const ANZAHL_LON = 17;

const MAX_PUNKTE = 440;

const FORECAST_DAYS = 6;

function achse(mitte: number, schritt: number, anzahl: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < anzahl; k++) out.push(mitte + (k - (anzahl - 1) / 2) * schritt);
  return out;
}

export function gitterKoordinaten(mitte: Punkt): { lats: number[]; lons: number[] } {

  const lats = achse(mitte.lat, SCHRITT_LAT, ANZAHL_LAT).map((v) => Math.max(-85, Math.min(85, v)));
  const lons = achse(mitte.lon, SCHRITT_LON, ANZAHL_LON).map((v) => ((v + 540) % 360) - 180);
  return { lats, lons };
}

export function bezugszeitUTC(dateStr: string, lonMitte: number, stundeLokal = 12): number {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, stundeLokal, 0, 0) - (lonMitte / 15) * 3600_000;
}

interface OpenMeteoDruckAntwort {
  latitude: number;
  longitude: number;
  hourly?: {
    time: string[];
    pressure_msl: (number | null)[];
    temperature_850hPa?: (number | null)[];
    dew_point_850hPa?: (number | null)[];
    wind_speed_850hPa?: (number | null)[];
    wind_direction_850hPa?: (number | null)[];
  };
}

export async function fetchDruckfeld(
  mitte: Punkt, dateStr: string, timeoutMs = 8000,
): Promise<DruckfeldSchnappschuss[] | null> {
  const { lats, lons } = gitterKoordinaten(mitte);
  if (lats.length * lons.length > MAX_PUNKTE) return null;

  const paarLat: number[] = [], paarLon: number[] = [];
  for (const la of lats) for (const lo of lons) { paarLat.push(la); paarLon.push(lo); }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${paarLat.map((v) => v.toFixed(2)).join(',')}`
      + `&longitude=${paarLon.map((v) => v.toFixed(2)).join(',')}`

      + `&hourly=pressure_msl,temperature_850hPa,dew_point_850hPa`
      + `,wind_speed_850hPa,wind_direction_850hPa`
      + `&wind_speed_unit=kn&timezone=UTC&forecast_days=${FORECAST_DAYS}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const roh: unknown = await res.json();
    const arr = (Array.isArray(roh) ? roh : [roh]) as OpenMeteoDruckAntwort[];
    if (arr.length !== paarLat.length) return null;

    const zeiten = arr[0]?.hourly?.time;
    if (!zeiten?.length) return null;

    const naechsterIndex = (zielMs: number): number => {
      let idx = 0, kleinster = Infinity;
      zeiten.forEach((t, i) => {
        const d = Math.abs(nDate(t).getTime() - zielMs);
        if (d < kleinster) { kleinster = d; idx = i; }
      });
      return idx;
    };

    const feld = (idx: number, name: keyof NonNullable<OpenMeteoDruckAntwort['hourly']>): (number | null)[][] =>
      lats.map((_, i) => lons.map((__, j) => {
        const reihe = arr[i * lons.length + j]?.hourly?.[name] as (number | null)[] | undefined;
        return reihe?.[idx] ?? null;
      }));

    const schnappschuesse: DruckfeldSchnappschuss[] = DRUCKFELD_STUNDEN.map((stundeLokal) => {
      const idx = naechsterIndex(bezugszeitUTC(dateStr, mitte.lon, stundeLokal));
      const druck = feld(idx, 'pressure_msl');

      const fronten: FrontenFelder = {
        temp: feld(idx, 'temperature_850hPa'),
        taupunkt: feld(idx, 'dew_point_850hPa'),
        windKn: feld(idx, 'wind_speed_850hPa'),
        windVon: feld(idx, 'wind_direction_850hPa'),
      };
      const hatFronten = fronten.temp.flat().some((v) => v != null)
        && fronten.windKn.flat().some((v) => v != null);
      const gitter: DruckGitter = { ...glaetteDruckfeld({ lats, lons, druck }), ...(hatFronten ? { fronten } : {}) };
      return { stundeLokal, utcMs: nDate(zeiten[idx]!).getTime(), gitter };
    });

    return schnappschuesse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
