import { gitterAchsen, type Windgitter } from '@/core/windgitter';
import type { StundenWind } from '@/core/types';
import { holeOpenMeteoJson } from './openMeteoNetz';
import { FORECAST_DAYS, einheitlicheZone, mitZone } from './openMeteo';

export const GITTER_SCHRITT_GRAD = 0.25;

const BLOCK = 100;

export const GITTER_MAX_PUNKTE = 1200;

const GITTER_VERSUCHE = 4;
const GITTER_PAUSE_MS = 15_000;

interface GitterAntwortPunkt {
  hourly?: StundenWind;
  utc_offset_seconds?: number;
  timezone?: string;
}

export interface RevierwindErgebnis {
  gitter: Windgitter;

  utcOffsetSeconds: number;
}

export async function holeWindgitter(
  box: { swLat: number; swLon: number; neLat: number; neLon: number },
  schrittGrad = GITTER_SCHRITT_GRAD,
): Promise<RevierwindErgebnis | null> {
  const { lats, lons } = gitterAchsen(box, schrittGrad);
  const punkte: { i: number; j: number; lat: number; lon: number }[] = [];
  lats.forEach((lat, i) => lons.forEach((lon, j) => punkte.push({ i, j, lat, lon })));
  if (punkte.length > GITTER_MAX_PUNKTE) return null;

  const reihen: StundenWind[][] = lats.map(() => new Array<StundenWind>(lons.length));
  const offsets = new Set<number>();
  try {
    const bloecke: { block: typeof punkte; url: string; liste: GitterAntwortPunkt[] }[] = [];
    for (let b = 0; b < punkte.length; b += BLOCK) {
      const block = punkte.slice(b, b + BLOCK);
      const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${block.map((p) => p.lat.toFixed(4)).join(',')}`
        + `&longitude=${block.map((p) => p.lon.toFixed(4)).join(',')}`

        + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m'
        + ',weather_code,precipitation,cape,lifted_index,visibility'
        + `&wind_speed_unit=kn&timezone=auto&forecast_days=${FORECAST_DAYS}`;
      const daten = await holeOpenMeteoJson(url, 30_000, GITTER_VERSUCHE, GITTER_PAUSE_MS);
      const liste = (Array.isArray(daten) ? daten : [daten]) as GitterAntwortPunkt[];
      if (liste.length !== block.length) return null;
      bloecke.push({ block, url, liste });
    }

    const zone = einheitlicheZone(bloecke.flatMap((x) => x.liste));
    if (zone) {
      for (const x of bloecke) {
        if (x.liste.every((a) => a.timezone === zone)) continue;
        const daten = await holeOpenMeteoJson(mitZone(x.url, zone), 30_000, GITTER_VERSUCHE, GITTER_PAUSE_MS);
        const liste = (Array.isArray(daten) ? daten : [daten]) as GitterAntwortPunkt[];
        if (liste.length !== x.block.length) return null;
        x.liste = liste;
      }
    }
    for (const { block, liste } of bloecke) {
      liste.forEach((antwort, k) => {
        const p = block[k]!;
        if (!antwort.hourly?.time?.length) throw new Error('Gitterpunkt ohne Stundenwerte');
        reihen[p.i]![p.j] = antwort.hourly;
        offsets.add(antwort.utc_offset_seconds ?? 0);
      });
    }
  } catch {
    return null;
  }

  if (offsets.size !== 1) return null;
  return { gitter: { lats, lons, reihen }, utcOffsetSeconds: [...offsets][0]! };
}

