import { sampleRoute, distNM } from '@/core/geo';
import { berechneTagesfenster } from '@/core/tagesfenster';
import { fetchWindForPoints, fetchDaylight } from '@/data/openMeteo';
import { fetchDruckfeld } from '@/data/druckfeld';
import { analysiereDruckfeld } from '@/core/druckfeld';
import { nDate, nowInRevier } from '@/core/time';
import { synoptik } from '@/briefing/synoptik';
import { describeGrosswetterlage } from '@/briefing/grosswetterlage';
import { localWind } from '@/briefing/localWinds';
import type { Punkt, SchiffConfig, Grenzwerte, Sprache } from '@/core/types';
import type { Daemmerungsstufe } from '@/core/sun';

export async function holeRevierwetterAusblick(
  von: Punkt, nach: Punkt, dateStr: string, cfg: SchiffConfig, limits: Grenzwerte,
  daemmerung: Daemmerungsstufe, stepMin: number, sampleStepNM: number, sprache: Sprache,
): Promise<string | null> {
  try {
    const points = sampleRoute([von, nach], sampleStepNM);
    const { hourly: windData, utcOffsetSeconds } = await fetchWindForPoints(points);
    const zeitreihe = windData[0]?.time;
    if (!zeitreihe || zeitreihe.length === 0) return null;

    const forecastEnd = nDate(zeitreihe[zeitreihe.length - 1]!);
    const daylight = await fetchDaylight(nach.lat, nach.lon);
    const jetzt = nowInRevier(utcOffsetSeconds);

    const f = berechneTagesfenster(
      dateStr, daemmerung, stepMin, points[0]!, points, windData, null, cfg, limits, daylight,
      utcOffsetSeconds, forecastEnd, jetzt, sprache,
    );
    if (!f.best) return null;

    const mitte: Punkt = { lat: (von.lat + nach.lat) / 2, lon: (von.lon + nach.lon) / 2 };
    const druckfeldTag = await fetchDruckfeld(mitte, dateStr);
    const mittagsgitter = druckfeldTag?.find((s) => s.stundeLokal === 12)?.gitter ?? null;
    const druckanalyse = mittagsgitter ? analysiereDruckfeld(mittagsgitter, mitte) : null;

    const syn = synoptik(windData, dateStr);
    const monat = Number(dateStr.slice(5, 7));
    const routeNM = distNM(von.lat, von.lon, nach.lat, nach.lon);

    const grosswetter = describeGrosswetterlage(druckanalyse, f.best.avgWindDir, sprache);
    const revierwind = localWind(f.best, monat, syn, routeNM > 0 ? routeNM : null, druckanalyse, sprache);

    const saetze = [grosswetter, revierwind].filter((s): s is string => s != null);
    return saetze.length > 0 ? saetze.join(' ') : null;
  } catch {
    return null;
  }
}
