import { gitterAchsen } from '@/core/windgitter';
import type { Seegangsgitter } from '@/core/seegangsgitter';
import type { StundenMarine } from '@/core/types';
import { holeOpenMeteoJson } from './openMeteoNetz';
import { FORECAST_DAYS, einheitlicheZone, mitZone } from './openMeteo';
import { GITTER_MAX_PUNKTE } from './revierwind';

const BLOCK = 100;

const VERSUCHE = 2;
const PAUSE_MS = 5_000;

interface Antwort { hourly?: StundenMarine; utc_offset_seconds?: number; timezone?: string }

export interface RevierseegangErgebnis {
  gitter: Seegangsgitter;

  utcOffsetSeconds: number;
}

export async function holeSeegangsgitter(
  box: { swLat: number; swLon: number; neLat: number; neLon: number }, schrittGrad: number,
): Promise<RevierseegangErgebnis | null> {
  const { lats, lons } = gitterAchsen(box, schrittGrad);
  const punkte: { i: number; j: number; lat: number; lon: number }[] = [];
  lats.forEach((lat, i) => lons.forEach((lon, j) => punkte.push({ i, j, lat, lon })));
  if (punkte.length > GITTER_MAX_PUNKTE) return null;
  const reihen: StundenMarine[][] = lats.map(() => new Array<StundenMarine>(lons.length));
  const offsets = new Set<number>();
  try {
    const bloecke: { block: typeof punkte; url: string; liste: Antwort[] }[] = [];
    for (let b = 0; b < punkte.length; b += BLOCK) {
      const block = punkte.slice(b, b + BLOCK);
      const url = 'https://marine-api.open-meteo.com/v1/marine'
        + `?latitude=${block.map((p) => p.lat.toFixed(4)).join(',')}`
        + `&longitude=${block.map((p) => p.lon.toFixed(4)).join(',')}`
        + '&hourly=wave_height,wave_period,wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction'
        + ',swell_wave_height,swell_wave_period,swell_wave_direction'
        + `&cell_selection=sea&timezone=auto&forecast_days=${FORECAST_DAYS}`;
      const daten = await holeOpenMeteoJson(url, 30_000, VERSUCHE, PAUSE_MS);
      const liste = (Array.isArray(daten) ? daten : [daten]) as Antwort[];
      if (liste.length !== block.length) return null;
      bloecke.push({ block, url, liste });
    }
    const zone = einheitlicheZone(bloecke.flatMap((x) => x.liste));
    if (zone) {
      for (const x of bloecke) {
        if (x.liste.every((a) => a.timezone === zone)) continue;
        const daten = await holeOpenMeteoJson(mitZone(x.url, zone), 30_000, VERSUCHE, PAUSE_MS);
        const liste = (Array.isArray(daten) ? daten : [daten]) as Antwort[];
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
