import { uv, bearingOf, relAngle, distNM } from './geo';
import { sonnenhoehe, sonnenzeiten, DAEMMERUNGSWINKEL } from './sun';
import { nDate, localDateStr, vonRevierzeit, zuRevierzeit, type UtcDate } from './time';
import { solveSegment } from './segment';
import { STEEP_SEA, MIN_STEIL_HS } from './polar';
import { windAt } from '@/data/openMeteo';
import { currentAt, waveAt, gezeitenAt } from '@/data/marine';
import {
  stromAusGitter, seegangAusGitter, wasserstandAusGitter, gitterFrisch, gitterTeiltGezeit, wetteranteilAusGitter, type CopernicusGitter,
} from './copernicusMarine';
import { messinaStromAnPunkt, mischeMessina, MESSINA_EINFAHRT, MESSINA_ENGE, kreuztEinfahrt, vorDerEinfahrt, einfahrtImFenster, einfahrtBisEnge, naivNachUtc } from './messinaStrom';
import type {
  HaltZeit,
  Ablegezeit, SchiffConfig, Grenzwerte, StreckenPunkt,
  StundenWind, StundenMarine, Tageslicht, WetterEreignis, Strom, Seegang, Gezeit,
} from './types';

const OHNE_STROM: Strom = { speed: 0, dir: 0, valid: false };
const OHNE_SEEGANG: Seegang = {
  hs: 0, tp: 0, dir: 0, swellHs: 0, swellTp: 0, swellDir: 0,
  windWaveHs: 0, windWaveTp: 0, windWaveDir: 0, steep: 0, kreuzWinkel: 0, valid: false,
};
const OHNE_GEZEIT: Gezeit = { hoeheM: 0, valid: false };

export function loeseAbschnitt(
  course: number, w: Parameters<typeof solveSegment>[1], cur: Parameters<typeof solveSegment>[2],
  cfg: SchiffConfig, lat: number, lon: number, naivZeit: Date,
): ReturnType<typeof solveSegment> {
  const seg = solveSegment(course, w, cur, cfg);
  if (!seg.beating || cfg.model !== 'polar') return seg;
  const m = messinaStromAnPunkt(lat, lon, naivZeit);
  return m && m.gewicht >= 1 ? solveSegment(course, w, cur, { ...cfg, minSailWind: Infinity }) : seg;
}

export function stromAn(
  copernicusGitter: CopernicusGitter | null | undefined,
  hourly: StundenMarine | null, lat: number, lon: number, zeitpunkt: Date, useCurrent: boolean,

  utcOffsetSeconds: number,
): Strom {
  if (!useCurrent) return OHNE_STROM;
  const grund = stromAusDaten(copernicusGitter, hourly, lat, lon, zeitpunkt, utcOffsetSeconds);

  const m = messinaStromAnPunkt(lat, lon, zeitpunkt);
  return m ? mischeMessina(grund, m) : grund;
}

function gitterZeit(zeitpunkt: Date, utcOffsetSeconds: number): UtcDate {
  return vonRevierzeit(zeitpunkt, utcOffsetSeconds);
}

function stromAusDaten(
  copernicusGitter: CopernicusGitter | null | undefined,
  hourly: StundenMarine | null, lat: number, lon: number, zeitpunkt: Date, utcOffsetSeconds: number,
): Strom {
  const utc = gitterZeit(zeitpunkt, utcOffsetSeconds);
  if (copernicusGitter && gitterFrisch(copernicusGitter, utc)) {
    const c = stromAusGitter(copernicusGitter, lat, lon, utc);
    if (c.valid) return c;
  }
  return hourly ? currentAt(hourly, zeitpunkt) : OHNE_STROM;
}

export function seegangAn(
  copernicusGitter: CopernicusGitter | null | undefined,
  hourly: StundenMarine | null, lat: number, lon: number, zeitpunkt: Date, utcOffsetSeconds: number,
): Seegang {
  const utc = gitterZeit(zeitpunkt, utcOffsetSeconds);
  if (copernicusGitter && gitterFrisch(copernicusGitter, utc)) {
    const s = seegangAusGitter(copernicusGitter, lat, lon, utc);
    if (s.valid) return s;
  }
  return hourly ? waveAt(hourly, zeitpunkt) : OHNE_SEEGANG;
}

export function wasserstandAn(
  copernicusGitter: CopernicusGitter | null | undefined,
  hourly: StundenMarine | null, lat: number, lon: number, zeitpunkt: Date, utcOffsetSeconds: number,
): Gezeit {
  const utc = gitterZeit(zeitpunkt, utcOffsetSeconds);
  if (copernicusGitter && gitterFrisch(copernicusGitter, utc)) {

    if (gitterTeiltGezeit(copernicusGitter)) {
      const w = wetteranteilAusGitter(copernicusGitter, lat, lon, utc);
      if (w.valid) return w;
    }
    const g = wasserstandAusGitter(copernicusGitter, lat, lon, utc);
    if (g.valid) return g;
  }
  return hourly ? gezeitenAt(hourly, zeitpunkt) : OHNE_GEZEIT;
}

const NACHT_WINKEL = -6;

const GUSTFAKTOR_MIN_WIND = 5;

const LIFTED_INDEX_GEDECKELT = 2;

export const SCORE_PRO_FAHRTSTUNDE = 5;

export const UNTERWEGS_ZUSCHLAG_ANTEIL = 0.5;
export const zuschlagUnterwegs = (min: number): number => min * UNTERWEGS_ZUSCHLAG_ANTEIL;

const SCORE_PRO_VMG_ANTEIL = 10;
const SCORE_PRO_MOTORANTEIL = 25;

export function evaluateDeparture(
  departure: Date,
  points: StreckenPunkt[],
  windData: StundenWind[],
  curData: (StundenMarine | null)[] | null,
  cfg: SchiffConfig,
  limits: Grenzwerte,
  daylight: Tageslicht,

  utcOffsetSeconds = 0,

  copernicusGitter?: CopernicusGitter | null,
): Ablegezeit {
  let maxWind = 0, minWind = 1e9, maxGust = 0, discomfortNM = 0, blockedNM = 0;

  let maxWindAt = { nm: 0, time: departure };
  let maxGustAt = { nm: 0, time: departure };
  let maxHsAt = { nm: 0, time: departure };

  let maxGustFactorPt = 1, gfWind = 0, gfGust = 0;
  let awaNM = 0, awsNM = 0, twaNM = 0, distNMges = 0, seaAngNM = 0, seaNM = 0;
  let maxPrecip = 0, precipNM = 0, precipFirst: { time: Date; nm: number } | null = null;
  let dirX = 0, dirY = 0;
  let windFirst: number | null = null, windLast = 0, twaFirst: number | null = null, twaLast = 0;

  let twaMin = Infinity, twaMinNM = 0, twaMax = -Infinity, twaMaxNM = 0;
  let motorNM = 0, maxCurrent = 0, beatNM = 0, gybeNM = 0, waterNM = 0;
  let dunkelHrs = 0;
  let maxHs = 0, maxSteep = 0, headSeaNM = 0, followSeaNM = 0, hsTp = 0, steepHs = 0, steepTp = 0, seaValid = false;

  let maxKreuzWinkel = 0, kreuzWindWaveHs = 0, kreuzSwellHs = 0;

  let messinaKabbelNM = 0;

  let einfahrt: { zeit: Date; nachNorden: boolean; vKn: number; i: number } | null = null;

  let engsteZeit: Date | null = null, engsteAbstand = Infinity;

  let maxIndividualHs = 0, stokesSpeed = 0, stokesDir = 0;
  let tHrs = 0, tHrsNoCur = 0;

  let haltHrs = 0;
  const halte: HaltZeit[] = [];
  const events: WetterEreignis[] = [];

  let windLuecke: { nm: number; time: Date } | null = null;

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;

    if (p.halt && p.halt.min > 0 && i > 0 && i < points.length - 1) {
      const an = new Date(departure.getTime() + (tHrs + haltHrs) * 3600 * 1000);
      haltHrs += p.halt.min / 60;
      halte.push({ ...p.halt, an, ab: new Date(departure.getTime() + (tHrs + haltHrs) * 3600 * 1000), nm: p.cum, lat: p.lat, lon: p.lon });
    }
    const t = new Date(departure.getTime() + (tHrs + haltHrs) * 3600 * 1000);
    if (einfahrt) {
      const d = distNM(p.lat, p.lon, MESSINA_ENGE.lat, MESSINA_ENGE.lon);
      if (d < engsteAbstand) { engsteAbstand = d; engsteZeit = t; }
    }
    const w = windAt(windData[i]!, t);
    if (w.windLuecke && !windLuecke) windLuecke = { nm: p.cum, time: t };
    const cur = stromAn(copernicusGitter, curData?.[i] ?? null, p.lat, p.lon, t, cfg.useCurrent, utcOffsetSeconds);
    const course = p.course ?? points[Math.max(0, i - 1)]!.course ?? 0;

    const wv = seegangAn(copernicusGitter, curData?.[i] ?? null, p.lat, p.lon, t, utcOffsetSeconds);
    const seg = loeseAbschnitt(course, w, cur, cfg, p.lat, p.lon, t);
    const segNoCur = (cfg.useCurrent && cur.speed > 0)
      ? loeseAbschnitt(course, w, { speed: 0, dir: 0 }, cfg, p.lat, p.lon, t) : seg;

    const ec = {
      time: t, t: t.getTime(), nm: p.cum, code: w.code,
      precip: w.precip, cape: w.cape, gust: w.gust, visibility: w.visibility,
    };
    if (w.code !== null && w.code >= 95) events.push({ ...ec, type: 'gewitter' });
    else if (w.cape >= 1000 && (w.liftedIndex === null || w.liftedIndex <= LIFTED_INDEX_GEDECKELT))
      events.push({ ...ec, type: 'cape' });
    if (w.precip >= 5) events.push({ ...ec, type: 'regen' });

    if (w.gust > limits.gust) events.push({ ...ec, type: 'sturm' });
    if (w.code === 45 || w.code === 48) events.push({ ...ec, type: 'nebel' });

    if (w.precip > maxPrecip) maxPrecip = w.precip;
    if (w.precip >= 0.4 && precipFirst === null) precipFirst = { time: t, nm: p.cum };
    if (w.speed > maxWind) { maxWind = w.speed; maxWindAt = { nm: p.cum, time: t }; }
    if (w.gust > maxGust) { maxGust = w.gust; maxGustAt = { nm: p.cum, time: t }; }

    if (w.boeigWind >= GUSTFAKTOR_MIN_WIND) {
      const gfPt = w.boeigGust / w.boeigWind;
      if (gfPt > maxGustFactorPt) { maxGustFactorPt = gfPt; gfWind = w.boeigWind; gfGust = w.boeigGust; }
    }
    if (cur.speed > maxCurrent) maxCurrent = cur.speed;
    if (wv.valid) {
      seaValid = true;
      if (wv.hs > maxHs) {
        maxHs = wv.hs; hsTp = wv.tp; maxHsAt = { nm: p.cum, time: t };
        maxIndividualHs = wv.maxIndividualHs ?? 0;
        stokesSpeed = wv.stokesSpeed ?? 0; stokesDir = wv.stokesDir ?? 0;
      }

      if (wv.windWaveHs >= MIN_STEIL_HS && wv.steep > maxSteep) { maxSteep = wv.steep; steepHs = wv.windWaveHs; steepTp = wv.windWaveTp; }
      if (wv.kreuzWinkel > maxKreuzWinkel) {
        maxKreuzWinkel = wv.kreuzWinkel;
        kreuzWindWaveHs = wv.windWaveHs; kreuzSwellHs = wv.swellHs;
      }
    }
    if (windFirst === null) { windFirst = w.speed; twaFirst = seg.twa; }
    windLast = w.speed; twaLast = seg.twa;
    if (seg.twa < twaMin) { twaMin = seg.twa; twaMinNM = p.cum; }
    if (seg.twa > twaMax) { twaMax = seg.twa; twaMaxNM = p.cum; }
    if (w.speed < minWind) minWind = w.speed;
    { const [ux, uy] = uv(w.dir); dirX += ux * w.speed; dirY += uy * w.speed; }

    if (i < points.length - 1) {
      const segNM = points[i + 1]!.cum - p.cum;

      const tEnde = new Date(t.getTime() + (segNM / seg.sog) * 3600 * 1000);
      const w2 = windAt(windData[i + 1]!, tEnde);
      const p2 = points[i + 1]!;
      const cur2 = stromAn(copernicusGitter, curData?.[i + 1] ?? null, p2.lat, p2.lon, tEnde, cfg.useCurrent, utcOffsetSeconds);
      const seg2 = loeseAbschnitt(course, w2, cur2, cfg, p2.lat, p2.lon, tEnde);
      const dt = segNM / 2 * (1 / seg.sog + 1 / seg2.sog);
      tHrs += dt;
      if (!einfahrt && dt > 0) {
        for (const [e, nachNorden] of [[MESSINA_EINFAHRT.sued, true], [MESSINA_EINFAHRT.nord, false]] as const) {
          const f = kreuztEinfahrt(p, p2, e);
          if (f == null || !vorDerEinfahrt(p, e)) continue;
          einfahrt = { zeit: new Date(t.getTime() + f * dt * 3600 * 1000), nachNorden, vKn: segNM / dt, i };
          break;
        }
      }

      const segMitte = new Date(t.getTime() + dt * 1800 * 1000);
      if (sonnenhoehe(p.lat, p.lon, vonRevierzeit(segMitte, utcOffsetSeconds)) < NACHT_WINKEL) dunkelHrs += dt;

      if (cfg.useCurrent && (cur.speed > 0 || cur2.speed > 0)) {
        const seg2NoCur = loeseAbschnitt(course, w2, { speed: 0, dir: 0 }, cfg, p2.lat, p2.lon, tEnde);
        tHrsNoCur += segNM / 2 * (1 / segNoCur.sog + 1 / seg2NoCur.sog);
      } else {
        tHrsNoCur += dt;
      }

      waterNM += segNM / 2 * (seg.stwReal / seg.sog + seg2.stwReal / seg2.sog);

      const h = segNM / 2;
      if (seg.underMotor) motorNM += h; if (seg2.underMotor) motorNM += h;
      if (seg.beating) beatNM += h; if (seg2.beating) beatNM += h;
      if (seg.gybing) gybeNM += h; if (seg2.gybing) gybeNM += h;
      if (seg.blocked) blockedNM += h; if (seg2.blocked) blockedNM += h;
      if (w.precip >= 0.4) precipNM += h; if (w2.precip >= 0.4) precipNM += h;

      const unbehag = (x: number) => (x < 90 ? (90 - x) / 90 : 0);
      discomfortNM += (unbehag(seg.twa) + unbehag(seg2.twa)) * h;
      twaNM += (seg.twa + seg2.twa) * h;
      awaNM += (seg.awa + seg2.awa) * h;
      awsNM += (seg.aws + seg2.aws) * h;
      distNMges += segNM;

      if (wv.valid && wv.hs >= 0.3) {
        const wa = relAngle(wv.dir, course);

        seaAngNM += wa * segNM * wv.hs; seaNM += segNM * wv.hs;
        if (wa < 60) headSeaNM += segNM;

        if (wa >= 120 && wv.hs >= 1.2) followSeaNM += segNM;
      }

      if (cfg.useCurrent && w.speed >= 10) {
        const m = messinaStromAnPunkt(p.lat, p.lon, t);
        if (m && m.gewicht >= 1 && m.speed >= 1 && relAngle((w.dir + 180) % 360, m.dir) > 120) messinaKabbelNM += segNM;
      }
    }
  }

  const durchEnge = einfahrt != null && points.slice(einfahrt.i + 1)
    .some((q) => (einfahrt!.nachNorden ? q.lat >= MESSINA_ENGE.lat : q.lat <= MESSINA_ENGE.lat));

  if (einfahrt && engsteZeit && engsteZeit > einfahrt.zeit) {
    const h = (engsteZeit.getTime() - einfahrt.zeit.getTime()) / 3_600_000;
    if (h > 0.05) einfahrt.vKn = einfahrtBisEnge(einfahrt.nachNorden ? MESSINA_EINFAHRT.sued : MESSINA_EINFAHRT.nord) / h;
  }
  const messinaEinfahrt = einfahrt && durchEnge
    ? {
      zeit: einfahrt.zeit, nachNorden: einfahrt.nachNorden, vKn: einfahrt.vKn,
      imFenster: einfahrtImFenster(einfahrt.nachNorden ? MESSINA_EINFAHRT.sued : MESSINA_EINFAHRT.nord,
        einfahrt.nachNorden, naivNachUtc(einfahrt.zeit.getTime()), einfahrt.vKn),
    }
    : null;

  const totalNM = points[points.length - 1]!.cum;

  const sailHrs = tHrs;
  const manHrs = Math.max(0, cfg.maneuverMin || 0) / 60;
  const totalHrs = sailHrs + manHrs + haltHrs;
  const avgSpeed = sailHrs > 0 ? totalNM / sailHrs : 0;
  const motorShare = totalNM > 0 ? motorNM / totalNM : 0;
  const currentGainMin = (tHrsNoCur - tHrs) * 60;
  const beatShare = totalNM > 0 ? beatNM / totalNM : 0;
  const gybeShare = totalNM > 0 ? gybeNM / totalNM : 0;
  const vmgShare = beatShare + gybeShare;
  const extraNM = waterNM - totalNM;
  const headSeaShare = totalNM > 0 ? headSeaNM / totalNM : 0;
  const followSeaShare = totalNM > 0 ? followSeaNM / totalNM : 0;
  const seaFail = seaValid && maxHs > limits.wave;
  const precipShare = totalNM > 0 ? precipNM / totalNM : 0;
  const seaAngle = seaNM > 0 ? seaAngNM / seaNM : null;
  const windTrend = (windFirst === null) ? 0 : windLast - windFirst;
  const avgWindDir = bearingOf(dirX, dirY);
  const midLat = points[Math.floor(points.length / 2)]!.lat;
  const midLon = points[Math.floor(points.length / 2)]!.lon;
  const arrival = new Date(departure.getTime() + totalHrs * 3600 * 1000);
  const arrDateStr = localDateStr(arrival);
  const idx = daylight.time.indexOf(arrDateStr);
  let isDaylight: boolean | null = null;
  if (idx >= 0) {
    const sunrise = nDate(daylight.sunrise[idx]!);
    const sunset = nDate(daylight.sunset[idx]!);
    isDaylight = arrival >= sunrise && arrival <= sunset;
  } else {

    const ziel = points[points.length - 1]!;
    const sonne = sonnenzeiten(ziel.lat, ziel.lon, arrDateStr, DAEMMERUNGSWINKEL.sonne);
    if (sonne) {
      isDaylight = arrival >= zuRevierzeit(sonne.auf, utcOffsetSeconds)
        && arrival <= zuRevierzeit(sonne.unter, utcOffsetSeconds);
    }
  }
  const avgDiscomfort = totalNM > 0 ? discomfortNM / totalNM : 0;
  const avgTwa = distNMges > 0 ? twaNM / distNMges : 0;
  const avgAwa = distNMges > 0 ? awaNM / distNMges : 0;
  const avgAws = distNMges > 0 ? awsNM / distNMges : 0;

  const meanFail = maxWind > limits.mean;
  const gustFail = maxGust > limits.gust;
  const safetyFail = meanFail || gustFail || seaFail;
  const gustFactor = maxGustFactorPt;

  const gustFactorWind = gfWind, gustFactorGust = gfGust;

  const forecastEnd = windData[0] ? nDate(windData[0].time[windData[0].time.length - 1]!) : null;
  const beyondForecast = forecastEnd ? arrival > forecastEnd : false;
  const blockedShare = totalNM > 0 ? blockedNM / totalNM : 0;
  const hasStorm = events.some((e) => e.type === 'gewitter');

  const hasRedWarning = events.some((e) => e.type === 'gewitter' || e.type === 'sturm');

  const fahrHrs = totalHrs - haltHrs;
  const dunkelShare = fahrHrs > 0 ? dunkelHrs / fahrHrs : 0;

  const nachtLast = dunkelShare * (
    Math.max(0, maxGust - 20) * 3
    + (seaValid ? Math.max(0, maxHs - 1.0) * 30 : 0)
    + (hasStorm ? 250 : 0)
  );

  const ankunftDunkel = isDaylight === false ? (dunkelShare > 0.1 ? 200 : 50) : 0;
  const score = (safetyFail ? 1000 : 0) + vmgShare * SCORE_PRO_VMG_ANTEIL + ankunftDunkel
    + avgDiscomfort * 20 + sailHrs * SCORE_PRO_FAHRTSTUNDE + motorShare * SCORE_PRO_MOTORANTEIL + blockedShare * 200
    + headSeaShare * 30 + followSeaShare * 20 + (maxSteep > STEEP_SEA ? 25 : 0)

    + (maxKreuzWinkel > 0 ? 20 : 0)

    + (messinaKabbelNM >= 0.5 ? 25 : 0)
    + nachtLast
    + (hasStorm ? 400 : 0)
    + (hasRedWarning ? 150 : 0);

  return {
    departure, arrival, maxWind, avgDiscomfort, isDaylight, safetyFail, dunkelHrs, dunkelShare,
    score, totalHrs, sailHrs, manHrs, avgSpeed,
    ...(halte.length ? { haltHrs, halte } : {}), motorShare, beyondForecast,
    ...(windLuecke ? { windLuecke } : {}),
    maxCurrent, currentGainMin, blockedShare, maxGust, maxWindAt, maxGustAt, maxHsAt,
    gustFactor, gustFactorWind, gustFactorGust,
    meanFail, gustFail, grenzen: { ...limits }, beatShare, gybeShare, vmgShare, extraNM, waterNM,
    maxHs, hsTp, maxSteep, steepHs, steepTp, headSeaShare, followSeaShare, seaFail, seaValid, avgAwa, avgAws, avgTwa, minWind, events, hasStorm, seaAngle, windTrend, windFirst, windLast, twaFirst, twaLast,
    ...(Number.isFinite(twaMax) ? { twaMin, twaMinNM, twaMax, twaMaxNM } : {}),
    maxKreuzWinkel, kreuzWindWaveHs, kreuzSwellHs, messinaKabbelNM,
    ...(messinaEinfahrt ? { messinaEinfahrt } : {}),
    maxIndividualHs, stokesSpeed, stokesDir,
    maxPrecip, precipShare, precipFirst, avgWindDir, midLat, midLon,
  };
}
