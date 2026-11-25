import { nDate, zuRevierzeit, localDateStr, aufRaster } from './time';
import { sonnenzeiten, DAEMMERUNGSWINKEL, type Daemmerungsstufe } from './sun';
import { evaluateDeparture } from './evaluate';
import { messinaAblegezeit } from './messinaStrom';
import type { CopernicusGitter } from './copernicusMarine';
import type {
  Ablegezeit, SchiffConfig, Grenzwerte, StreckenPunkt, StundenWind, StundenMarine, Tageslicht, Punkt, Sprache,
} from './types';

export interface Tagesfenster {
  dateStr: string;
  results: Ablegezeit[];

  best: Ablegezeit | null;
  istNachtschlag: boolean;
  fehler: string | null;

  hellVon: Date | null;
  hellBis: Date | null;

  messinaGewaehlt?: true;

  messinaNacht?: true;
}

const unfahrbarFuerMessina = (r: Ablegezeit): boolean => r.safetyFail;

export function messinaNachtBis(
  dateStr: string, startPunkt: Punkt, daemmerung: Daemmerungsstufe, utcOffsetSeconds: number, forecastEnd: Date,
): Date {
  const morgen = localDateStr(new Date(nDate(`${dateStr}T12:00:00`).getTime() + 86_400_000));
  const s = sonnenzeiten(startPunkt.lat, startPunkt.lon, morgen, DAEMMERUNGSWINKEL[daemmerung]);
  const bis = s ? zuRevierzeit(s.auf, utcOffsetSeconds) : nDate(`${morgen}T06:00:00`);
  return bis < forecastEnd ? bis : forecastEnd;
}

export function ergaenzeMessinaNacht(
  results: Ablegezeit[], nachEnde: Date, bis: Date, stepMin: number,
  rechne: (t: Date) => Ablegezeit, unfahrbar: (r: Ablegezeit) => boolean,
): { results: Ablegezeit[]; verlaengert: boolean } {
  if (!results.some((r) => r.messinaEinfahrt) || messinaAblegezeit(results, unfahrbar)) return { results, verlaengert: false };
  const mehr = [...results];

  for (let t = aufRaster(new Date(nachEnde.getTime() + 1), stepMin); t <= bis; t = new Date(t.getTime() + stepMin * 60_000)) mehr.push(rechne(new Date(t)));
  if (mehr.length === results.length) return { results, verlaengert: false };
  mehr.sort((a, b) => a.score - b.score);
  return { results: mehr, verlaengert: true };
}

export function berechneTagesfenster(
  dateStr: string,
  daemmerung: Daemmerungsstufe,
  stepMin: number,
  startPunkt: Punkt,
  points: StreckenPunkt[],
  windData: StundenWind[],
  curData: (StundenMarine | null)[] | null,
  cfg: SchiffConfig,
  limits: Grenzwerte,
  daylight: Tageslicht,
  utcOffsetSeconds: number,
  forecastEnd: Date,
  jetzt: Date,
  sprache: Sprache = 'de',

  copernicusGitter?: CopernicusGitter | null,
): Tagesfenster {
  const sonnenstand = sonnenzeiten(startPunkt.lat, startPunkt.lon, dateStr, DAEMMERUNGSWINKEL[daemmerung]);

  const hellVon = sonnenstand ? zuRevierzeit(sonnenstand.auf, utcOffsetSeconds) : null;
  const hellBis = sonnenstand ? zuRevierzeit(sonnenstand.unter, utcOffsetSeconds) : null;

  const leer = (fehler: string, fehlerEn: string, istNachtschlag = false): Tagesfenster =>
    ({
      dateStr, results: [], best: null, istNachtschlag,
      fehler: sprache === 'en' ? fehlerEn : fehler, hellVon, hellBis,
    });

  let windowStart: Date, windowEnd: Date;
  if (hellVon && hellBis) {
    windowStart = new Date(hellVon);
    windowEnd = new Date(hellBis);
  } else {
    windowStart = nDate(`${dateStr}T00:00:00`);
    windowEnd = nDate(`${dateStr}T23:59:00`);
  }

  if (windowStart > forecastEnd) return leer('außerhalb der Vorhersage', 'outside the forecast');

  const probeStart = evaluateDeparture(new Date(windowStart), points, windData, curData, cfg, limits, daylight, utcOffsetSeconds, copernicusGitter);
  const probeEnd = evaluateDeparture(new Date(windowEnd), points, windData, curData, cfg, limits, daylight, utcOffsetSeconds, copernicusGitter);
  const probeHrs = Math.min(probeStart.totalHrs, probeEnd.totalHrs);
  const hellStunden = (windowEnd.getTime() - windowStart.getTime()) / 3600_000;
  const istNachtschlag = probeHrs > hellStunden;
  if (istNachtschlag) {
    windowStart = nDate(`${dateStr}T00:00:00`);
    windowEnd = nDate(`${dateStr}T23:59:00`);
  }

  if (dateStr === localDateStr(jetzt) && jetzt > windowStart) windowStart = jetzt;

  windowStart = aufRaster(windowStart, stepMin);
  if (windowStart > windowEnd) return leer('bereits vorbei', 'already past', istNachtschlag);

  const results: Ablegezeit[] = [];
  for (let t = new Date(windowStart); t <= windowEnd; t = new Date(t.getTime() + stepMin * 60000)) {
    results.push(evaluateDeparture(new Date(t), points, windData, curData, cfg, limits, daylight, utcOffsetSeconds, copernicusGitter));
  }
  if (results.length === 0) return leer('kein gültiges Zeitfenster', 'no valid time window', istNachtschlag);

  results.sort((a, b) => a.score - b.score);

  const { results: alle, verlaengert } = istNachtschlag
    ? { results, verlaengert: false }
    : ergaenzeMessinaNacht(results, windowEnd, messinaNachtBis(dateStr, startPunkt, daemmerung, utcOffsetSeconds, forecastEnd),
      stepMin, (t) => evaluateDeparture(t, points, windData, curData, cfg, limits, daylight, utcOffsetSeconds, copernicusGitter),
      unfahrbarFuerMessina);
  const nachStrom = messinaAblegezeit(alle, unfahrbarFuerMessina);
  return {
    dateStr, results: alle, best: nachStrom ?? alle[0]!, istNachtschlag, fehler: null, hellVon, hellBis,
    ...(nachStrom ? { messinaGewaehlt: true as const } : {}),
    ...(verlaengert ? { messinaNacht: true as const } : {}),
  };
}
