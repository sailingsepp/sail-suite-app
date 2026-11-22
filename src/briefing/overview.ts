import { nf, nDate, tagKurz } from '@/core/time';
import { uv, bearingOf } from '@/core/geo';
import type { StundenWind, StundenMarine, Tageslicht, Punkt, Sprache } from '@/core/types';
import { windBand, richtungsName, anzeigeKn } from './wind';
import { revierSpanne } from './region';
import { describeGewitterneigung } from './gewitter';
import { describeGrosswetterlage } from './grosswetterlage';
import type { Druckanalyse } from '@/core/druckfeld';
import { temperaturTagAusGitter, type CopernicusGitter } from '@/core/copernicusMarine';
import { modellUebereinstimmung } from '@/core/modellsicherheit';
import type { Modellabgleich } from '@/core/modellabgleich';
import { describeModellabgleich } from './modellabgleich';
import type { WindEnsemble } from '@/data/ensemble';
import {
  nebelSpread, nebelUnstimmig, NEBEL_SPREAD_MAX,
  sichtBeiNebel, sichtUnstimmig, NEBEL_SICHT_MAX_M,
} from './weather';

const LIFTED_INDEX_GEDECKELT = 2;

const UV_INDEX_SEHR_HOCH = 8;

function tagesteil(d: Date, sprache: Sprache = 'de'): string {
  const h = d.getUTCHours();
  if (sprache === 'en') {
    if (h < 9) return 'in the early morning';
    if (h < 12) return 'in the late morning';
    if (h < 14) return 'around midday';
    if (h < 18) return 'in the afternoon';
    return 'in the evening';
  }
  if (h < 9) return 'morgens';
  if (h < 12) return 'vormittags';
  if (h < 14) return 'mittags';
  if (h < 18) return 'nachmittags';
  return 'abends';
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

interface PunktTag {
  hourly: StundenWind;
  idxs: number[];
  speed: number[];
  dir: number[];
}

function tagesWerte(hourly: StundenWind, dateStr: string): PunktTag | null {
  const idxs: number[] = [];
  hourly.time.forEach((t, i) => { if (t.startsWith(dateStr)) idxs.push(i); });
  if (idxs.length === 0) return null;
  return {
    hourly, idxs,
    speed: idxs.map((i) => hourly.wind_speed_10m[i]!),
    dir: idxs.map((i) => hourly.wind_direction_10m[i]!),
  };
}

export function describeRevierWetter(
  windData: StundenWind[],
  dateStr: string,
  start: Punkt,
  ziel: Punkt,
  curData?: (StundenMarine | null)[] | null,
  tageslicht?: Tageslicht | null,

  druckanalyse?: Druckanalyse | null,

  sprache: Sprache = 'de',

  copernicusGitter?: CopernicusGitter | null,

  ensemble?: WindEnsemble | null,

  mitRevierkunde = true,

  modellabgleich?: Modellabgleich | null,
): string | null {
  const punkte = windData
    .map((h) => tagesWerte(h, dateStr))
    .filter((p): p is PunktTag => p !== null);
  if (punkte.length === 0) return null;

  const minV = Math.min(...punkte.map((p) => Math.min(...p.speed)));
  const maxV = Math.max(...punkte.map((p) => Math.max(...p.speed)));

  let dx = 0, dy = 0;
  for (const p of punkte) {
    p.idxs.forEach((_, k) => {
      const [ux, uy] = uv(p.dir[k]!);
      dx += ux * p.speed[k]!; dy += uy * p.speed[k]!;
    });
  }
  const meanDir = bearingOf(dx, dy);

  const maxAnz = anzeigeKn(maxV), minAnz = anzeigeKn(minV);
  const band = windBand(maxAnz, sprache);
  const windSpan = sprache === 'en'
    ? ((maxV - minV > 3) ? `${nf(minAnz, 0, 'en')} to ${nf(maxAnz, 0, 'en')} kn` : `around ${nf(maxAnz, 0, 'en')} kn`)
    : ((maxV - minV > 3) ? `${nf(minAnz, 0)} bis ${nf(maxAnz, 0)} kn` : `um ${nf(maxAnz, 0)} kn`);

  let satz = sprache === 'en'
    ? `Weather ${revierSpanne(start.lat, start.lon, ziel.lat, ziel.lon, 'en')} on ${tagKurz(dateStr, 'en')}: ${band.name} from ${richtungsName(meanDir, 'en')}, ${windSpan}.`
    : `Wetterlage ${revierSpanne(start.lat, start.lon, ziel.lat, ziel.lon)} am ${tagKurz(dateStr)}: ${band.name} aus ${richtungsName(meanDir)}, ${windSpan}.`;

  const startPunkt = punkte[0]!;
  if (startPunkt.speed.length >= 4) {
    const mitte = Math.floor(startPunkt.speed.length / 2);
    const trend = avg(startPunkt.speed.slice(mitte)) - avg(startPunkt.speed.slice(0, mitte));
    if (sprache === 'en') {
      if (trend > 3) satz += ' The wind freshens through the day.';
      else if (trend < -3) satz += ' The wind eases through the day.';
    } else {
      if (trend > 3) satz += ' Der Wind frischt im Tagesverlauf auf.';
      else if (trend < -3) satz += ' Der Wind lässt im Tagesverlauf nach.';
    }
  }

  if (ensemble) {
    const prozent = modellUebereinstimmung(ensemble, dateStr);
    if (prozent != null) {
      const einordnung = prozent >= 80
        ? (sprache === 'en' ? 'the models largely agree' : 'die Modelle stimmen weitgehend überein')
        : prozent >= 50
          ? (sprache === 'en' ? 'the models diverge noticeably' : 'die Modelle weichen spürbar voneinander ab')
          : (sprache === 'en' ? 'the models disagree markedly' : 'die Modelle sind sich deutlich uneinig');
      satz += sprache === 'en'
        ? ` Model agreement: ${prozent}% (${einordnung}).`
        : ` Modellübereinstimmung: ${prozent} % (${einordnung}).`;
    }
  }

  const abgleichSatz = describeModellabgleich(modellabgleich, sprache);
  if (abgleichSatz) satz += ' ' + abgleichSatz;

  const wolkenMittel = (() => {
    const w = startPunkt.hourly.cloud_cover ? startPunkt.idxs.map((i) => startPunkt.hourly.cloud_cover![i]).filter((v): v is number => v != null) : [];
    return w.length ? avg(w) : null;
  })();
  const grosswetter = describeGrosswetterlage(druckanalyse ?? null, meanDir, sprache, wolkenMittel === null || wolkenMittel < 60);
  if (grosswetter) satz += ` ${grosswetter}`;

  const startHourly = startPunkt.hourly;
  if (startHourly.pressure_msl) {
    const druck = startPunkt.idxs.map((i) => startHourly.pressure_msl![i]).filter((v): v is number => v != null);
    if (druck.length >= 2) {
      const letzter = druck[druck.length - 1]!;
      const delta = letzter - druck[0]!;
      if (sprache === 'en') {
        const niveau = letzter >= 1020 ? 'high pressure' : letzter <= 1005 ? 'low pressure' : 'normal pressure';
        const trendTxt = delta > 1.5 ? ', rising' : delta < -1.5 ? ', falling' : ', steady';
        satz += grosswetter
          ? ` Locally ${niveau}${trendTxt} (${nf(letzter, 0, 'en')} hPa).`
          : ` ${niveau.charAt(0).toUpperCase()}${niveau.slice(1)}${trendTxt} (${nf(letzter, 0, 'en')} hPa).`;
      } else {
        const niveau = letzter >= 1020 ? 'hoher Luftdruck' : letzter <= 1005 ? 'tiefer Luftdruck' : 'normaler Luftdruck';
        const trendTxt = delta > 1.5 ? ', steigend' : delta < -1.5 ? ', fallend' : ', stabil';
        satz += grosswetter
          ? ` Vor Ort ${niveau}${trendTxt} (${nf(letzter, 0)} hPa).`
          : ` ${niveau.charAt(0).toUpperCase()}${niveau.slice(1)}${trendTxt} (${nf(letzter, 0)} hPa).`;
      }
    }
  }
  if (startHourly.cloud_cover) {
    const wolken = startPunkt.idxs.map((i) => startHourly.cloud_cover![i]).filter((v): v is number => v != null);
    if (wolken.length) {
      const mittel = avg(wolken);
      if (sprache === 'en') {
        satz += mittel < 25 ? ' Mostly clear skies.' : mittel < 60 ? ' Variable cloud.' : ' Mostly overcast.';
      } else {
        satz += mittel < 25 ? ' Meist klarer Himmel.' : mittel < 60 ? ' Wechselnd bewölkt.' : ' Meist stark bewölkt.';
      }
    }
  }

  if (startHourly.temperature_2m) {
    const temps = startPunkt.idxs.map((i) => startHourly.temperature_2m![i]).filter((v): v is number => v != null);
    if (temps.length) {
      const tMin = Math.min(...temps), tMax = Math.max(...temps);
      if (sprache === 'en') {
        satz += tMax - tMin > 2
          ? ` Temperature ${nf(tMin, 0, 'en')} to ${nf(tMax, 0, 'en')} °C`
          : ` Temperature around ${nf(tMax, 0, 'en')} °C`;
      } else {
        satz += tMax - tMin > 2
          ? ` Temperatur ${nf(tMin, 0)} bis ${nf(tMax, 0)} °C`
          : ` Temperatur um ${nf(tMax, 0)} °C`;
      }
      if (startHourly.dew_point_2m) {

        const tags = startPunkt.idxs.filter((i) => {
          const h = Number(startHourly.time[i]!.slice(11, 13));
          return h >= 9 && h <= 20;
        });
        const taupunkte = (tags.length ? tags : startPunkt.idxs)
          .map((i) => startHourly.dew_point_2m![i]).filter((v): v is number => v != null);
        if (taupunkte.length) {

          const taupunkt = Math.round(avg(taupunkte));

          if (sprache === 'en') {
            satz += `, dew point ${nf(taupunkt, 0, 'en')} °C`;

            if (taupunkt >= 20) satz += ', very humid';
            else if (taupunkt >= 17) satz += ', humid';
          } else {
            satz += `, Taupunkt ${nf(taupunkt, 0)} °C`;

            if (taupunkt >= 20) satz += ', sehr schwül';
            else if (taupunkt >= 17) satz += ', schwül';
          }
        }
      }
      satz += '.';
    }
  }

  {
    const sstCopernicus = copernicusGitter
      ? temperaturTagAusGitter(copernicusGitter, start.lat, start.lon, dateStr) : [];
    const marineIdxs: number[] = [];
    if (curData?.[0]?.sea_surface_temperature) {
      curData[0]!.time.forEach((t, i) => { if (t.startsWith(dateStr)) marineIdxs.push(i); });
    }
    const sst = sstCopernicus.length ? sstCopernicus : marineIdxs
      .map((i) => curData![0]!.sea_surface_temperature![i])
      .filter((v): v is number => v != null);
    if (sst.length) {
      const sstMin = Math.min(...sst), sstMax = Math.max(...sst);
      if (sprache === 'en') {
        satz += sstMax - sstMin > 1
          ? ` Sea temperature ${nf(sstMin, 0, 'en')} to ${nf(sstMax, 0, 'en')} °C.`
          : ` Sea temperature around ${nf(sstMax, 0, 'en')} °C.`;
      } else {
        satz += sstMax - sstMin > 1
          ? ` Wassertemperatur ${nf(sstMin, 0)} bis ${nf(sstMax, 0)} °C.`
          : ` Wassertemperatur um ${nf(sstMax, 0)} °C.`;
      }
    }
  }

  if (tageslicht?.uv_index_max) {
    const tagIdx = tageslicht.time.indexOf(dateStr);
    const uvMax = tagIdx >= 0 ? tageslicht.uv_index_max[tagIdx] : undefined;
    if (uvMax != null && uvMax >= UV_INDEX_SEHR_HOCH) {
      if (sprache === 'en') {
        satz += uvMax >= 11
          ? ` UV index extreme (${nf(uvMax, 0, 'en')}): avoid the midday sun in the cockpit and reapply sunscreen.`
          : ` UV index very high (${nf(uvMax, 0, 'en')}): reflection off the water adds to it, don't skip sun protection.`;
      } else {
        satz += uvMax >= 11
          ? ` UV-Index extrem (${nf(uvMax, 0)}): Mittagssonne im Cockpit meiden, Sonnencreme nachlegen.`
          : ` UV-Index sehr hoch (${nf(uvMax, 0)}): auf dem Wasser reflektiert zusätzlich, Sonnenschutz nicht vergessen.`;
      }
    }
  }

  let maxCape = 0, capeZeit: Date | null = null, capeLI: number | null = null;
  let hatGewitter = false, gewitterZeit: Date | null = null;
  let hatNebel = false, nebelZeit: Date | null = null, nebelSpreadMin: number | null = null;
  let nebelSichtMin: number | null = null;
  let maxPrecipSum = 0;
  for (const p of punkte) {
    let precipSum = 0;
    p.idxs.forEach((i) => {
      const cape = p.hourly.cape[i] ?? 0;

      if (cape > maxCape) {
        maxCape = cape; capeZeit = nDate(p.hourly.time[i]!);
        capeLI = p.hourly.lifted_index ? (p.hourly.lifted_index[i] ?? null) : null;
      }
      if ((p.hourly.weather_code[i] ?? 0) >= 95) {
        hatGewitter = true;
        const t = nDate(p.hourly.time[i]!);
        if (!gewitterZeit || t < gewitterZeit) gewitterZeit = t;
      }
      if (p.hourly.weather_code[i] === 45 || p.hourly.weather_code[i] === 48) {
        hatNebel = true;
        const t = nDate(p.hourly.time[i]!);
        if (!nebelZeit || t < nebelZeit) nebelZeit = t;
      }
      precipSum += p.hourly.precipitation[i] ?? 0;
    });

    const spread = nebelSpread(p.hourly, p.idxs);
    if (spread !== null && (nebelSpreadMin === null || spread < nebelSpreadMin)) nebelSpreadMin = spread;
    const sicht = sichtBeiNebel(p.hourly, p.idxs);
    if (sicht !== null && (nebelSichtMin === null || sicht < nebelSichtMin)) nebelSichtMin = sicht;
    maxPrecipSum = Math.max(maxPrecipSum, precipSum);
  }

  if (sprache === 'en') {
    if (hatGewitter) satz += ` Thunderstorms possible during the day, most likely ${tagesteil(gewitterZeit!, 'en')}.`;
    else if (maxCape >= 1000 && (capeLI === null || capeLI <= LIFTED_INDEX_GEDECKELT))
      satz += ` Unstable air mass, most likely ${tagesteil(capeZeit!, 'en')}, isolated showers possible.`;
    if (hatNebel && nebelSichtMin !== null) {
      satz += nebelSichtMin >= NEBEL_SICHT_MAX_M
        ? sichtUnstimmig(nebelSichtMin, 'en')
        : ` Fog at times, most likely ${tagesteil(nebelZeit!, 'en')}, visibility down to around `
          + `${Math.round(nebelSichtMin / 100) * 100} m.`;
    } else if (hatNebel && nebelSpreadMin !== null && nebelSpreadMin > NEBEL_SPREAD_MAX) {
      satz += nebelUnstimmig(nebelSpreadMin, 'en');
    } else if (hatNebel) {
      satz += ` Fog at times, most likely ${tagesteil(nebelZeit!, 'en')}.`;
    }
    if (maxPrecipSum >= 5) satz += ` Rain spread through the day, roughly ${nf(maxPrecipSum, 0, 'en')} mm in total.`;
  } else {
    if (hatGewitter) satz += ` Gewitter im Tagesverlauf möglich, am ehesten ${tagesteil(gewitterZeit!)}.`;
    else if (maxCape >= 1000 && (capeLI === null || capeLI <= LIFTED_INDEX_GEDECKELT))
      satz += ` Labile Luftmasse, am ehesten ${tagesteil(capeZeit!)}, einzelne Schauer möglich.`;

    if (hatNebel && nebelSichtMin !== null) {
      satz += nebelSichtMin >= NEBEL_SICHT_MAX_M
        ? sichtUnstimmig(nebelSichtMin)
        : ` Zeitweise Nebel, am ehesten ${tagesteil(nebelZeit!)}, Sicht bis auf rund `
          + `${Math.round(nebelSichtMin / 100) * 100} m herab.`;
    } else if (hatNebel && nebelSpreadMin !== null && nebelSpreadMin > NEBEL_SPREAD_MAX) {
      satz += nebelUnstimmig(nebelSpreadMin);
    } else if (hatNebel) {
      satz += ` Zeitweise Nebel, am ehesten ${tagesteil(nebelZeit!)}.`;
    }
    if (maxPrecipSum >= 5) satz += ` Niederschlag über den Tag verteilt, in Summe rund ${nf(maxPrecipSum, 0)} mm.`;
  }

  const monat = Number(dateStr.slice(5, 7));
  const neigung = mitRevierkunde
    ? describeGewitterneigung((start.lat + ziel.lat) / 2, (start.lon + ziel.lon) / 2, monat, sprache)
    : null;
  if (neigung) satz += ` ${neigung}`;

  return satz;
}

export function ohneRevierkunde(text: string): string {
  const i = text.search(/\s*(Zur Jahreszeit:|For the season:)/);
  return i >= 0 ? text.slice(0, i) : text;
}
