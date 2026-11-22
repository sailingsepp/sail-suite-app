import { nf, uhrLt, fmtDur, localDateStr } from '@/core/time';
import type { Ablegezeit, Sprache } from '@/core/types';
import { istUnfahrbar } from './verdict';
import { anzeigeKn } from './wind';

const WOCHENTAG = {
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

function tagName(d: Date, bezug: Date | null, sprache: Sprache): string | null {
  if (!bezug || localDateStr(d) === localDateStr(bezug)) return null;
  return WOCHENTAG[sprache === 'en' ? 'en' : 'de'][d.getUTCDay()]!;
}

function uhrMitTag(d: Date, bezug: Date | null, sprache: Sprache): string {
  const t = tagName(d, bezug, sprache);
  return t ? `${t} ${uhrLt(d)}` : uhrLt(d);
}

export interface Ablegefenster {
  from: Date;
  to: Date;
  single: boolean;
  before: Ablegezeit | null;
  after: Ablegezeit | null;
  atStart: boolean;
  atEnd: boolean;
  byTime: Ablegezeit[];
}

export function guenstigGrenze(best: Ablegezeit): number {
  return best.score * 1.12 + 3;
}

export function bestWindow(results: Ablegezeit[], best: Ablegezeit): Ablegefenster {
  const byTime = [...results].sort((a, b) => a.departure.getTime() - b.departure.getTime());
  const limit = guenstigGrenze(best);
  const bi = byTime.findIndex((r) => r === best);
  let lo = bi, hi = bi;
  while (lo > 0 && byTime[lo - 1]!.score <= limit && !istUnfahrbar(byTime[lo - 1]!)) lo--;
  while (hi < byTime.length - 1 && byTime[hi + 1]!.score <= limit && !istUnfahrbar(byTime[hi + 1]!)) hi++;
  return {
    from: byTime[lo]!.departure, to: byTime[hi]!.departure, single: lo === hi,
    before: lo > 0 ? byTime[lo - 1]! : null, after: hi < byTime.length - 1 ? byTime[hi + 1]! : null,
    atStart: lo === 0, atEnd: hi === byTime.length - 1, byTime,
  };
}

function zeigtUeber(wert: number, grenze: number | undefined, stellen: number): boolean {
  return grenze === undefined || Number(wert.toFixed(stellen)) > grenze;
}

function grundFuerEn(best: Ablegezeit, other: Ablegezeit): string | null {
  if (other.hasStorm && !best.hasStorm) return 'a thunderstorm moves across the route';
  if (other.gustFail && !best.gustFail) return zeigtUeber(other.maxGust, other.grenzen?.gust, 0)
    ? `gusts of ${nf(other.maxGust, 0, 'en')} kn exceed the limit` : 'gusts just exceed the limit';
  if (other.meanFail && !best.meanFail) return zeigtUeber(other.maxWind, other.grenzen?.mean, 0)
    ? `the mean wind at ${nf(other.maxWind, 0, 'en')} kn is above the limit` : 'the mean wind is just above the limit';
  if (other.seaFail && !best.seaFail) return zeigtUeber(other.maxHs, other.grenzen?.wave, 1)
    ? `the sea at ${nf(other.maxHs, 1, 'en')} m runs above the limit` : 'the sea runs just above the limit';
  if (best.isDaylight !== false && other.isDaylight === false) return 'the arrival falls into darkness';
  if (other.totalHrs > best.totalHrs * 1.25) return `the passage stretches to ${fmtDur(other.totalHrs)}`;
  if (other.beatShare > best.beatShare + 0.25)
    return `the wind heads onto the nose: ${Math.round(other.beatShare * 100)} % of the route would have to be beaten`;
  if (other.motorShare > best.motorShare + 0.25)

    return other.maxWind < best.maxWind
      ? `the wind dies and the engine runs for ${Math.round(other.motorShare * 100)} % of the route`
      : `the engine runs for ${Math.round(other.motorShare * 100)} % of the route`;
  if (other.maxHs > best.maxHs + 0.5) return `the sea builds to ${nf(other.maxHs, 1, 'en')} m`;
  if (other.maxPrecip >= 2 && best.maxPrecip < 2) return 'rain sets in';
  if (other.maxGust > best.maxGust + 4 && other.maxGust >= 17)
    return `gusts freshen to around ${nf(other.maxGust, 0, 'en')} kn`;
  if (other.avgTwa < best.avgTwa - 15)

    return `the wind sits further onto the nose: ${Math.round(other.avgTwa)}° instead of ${Math.round(best.avgTwa)}° on average`;
  if (other.headSeaShare > best.headSeaShare + 0.2)
    return `the sea runs from ahead on ${Math.round(other.headSeaShare * 100)} % of the route`;
  const windDiff = other.maxWind - best.maxWind;
  if (Math.abs(windDiff) >= 2) {
    return windDiff > 0
      ? `the wind increases by ${nf(windDiff, 0, 'en')} kn`
      : `the wind eases by ${nf(-windDiff, 0, 'en')} kn`;
  }
  return null;
}

function wieAngezeigt(a: Ablegezeit): Ablegezeit {
  return { ...a, maxWind: anzeigeKn(a.maxWind), maxGust: anzeigeKn(a.maxGust), maxHs: Math.round(a.maxHs * 10) / 10 };
}

export function grundFuer(bestRoh: Ablegezeit, otherRoh: Ablegezeit, sprache: Sprache = 'de'): string | null {
  const best = wieAngezeigt(bestRoh), other = wieAngezeigt(otherRoh);
  if (sprache === 'en') return grundFuerEn(best, other);

  if (other.hasStorm && !best.hasStorm) return 'zieht ein Gewitter über die Route';
  if (other.gustFail && !best.gustFail) return zeigtUeber(other.maxGust, other.grenzen?.gust, 0)
    ? `überschreiten die Böen mit ${nf(other.maxGust, 0)} kn den Grenzwert` : 'liegen die Böen knapp über dem Grenzwert';
  if (other.meanFail && !best.meanFail) return zeigtUeber(other.maxWind, other.grenzen?.mean, 0)
    ? `liegt der Mittelwind mit ${nf(other.maxWind, 0)} kn über dem Grenzwert` : 'liegt der Mittelwind knapp über dem Grenzwert';
  if (other.seaFail && !best.seaFail) return zeigtUeber(other.maxHs, other.grenzen?.wave, 1)
    ? `läuft die See mit ${nf(other.maxHs, 1)} m über den Grenzwert` : 'läuft die See knapp über dem Grenzwert';
  if (best.isDaylight !== false && other.isDaylight === false) return 'fällt die Ankunft in die Dunkelheit';
  if (other.totalHrs > best.totalHrs * 1.25) return `zieht sich die Fahrt auf ${fmtDur(other.totalHrs)}`;
  if (other.beatShare > best.beatShare + 0.25)
    return `dreht der Wind auf die Nase: ${Math.round(other.beatShare * 100)} % der Strecke müssten gekreuzt werden`;
  if (other.motorShare > best.motorShare + 0.25)

    return other.maxWind < best.maxWind
      ? `schläft der Wind ein und die Maschine läuft auf ${Math.round(other.motorShare * 100)} % der Strecke`
      : `läuft die Maschine auf ${Math.round(other.motorShare * 100)} % der Strecke`;
  if (other.maxHs > best.maxHs + 0.5) return `baut sich die See auf ${nf(other.maxHs, 1)} m auf`;
  if (other.maxPrecip >= 2 && best.maxPrecip < 2) return 'setzt Regen ein';

  if (other.maxGust > best.maxGust + 4 && other.maxGust >= 17)
    return `frischt es auf Böen um ${nf(other.maxGust, 0)} kn auf`;

  if (other.avgTwa < best.avgTwa - 15)
    return `steht der Wind mehr auf die Nase: im Mittel ${Math.round(other.avgTwa)}° statt ${Math.round(best.avgTwa)}°`;
  if (other.headSeaShare > best.headSeaShare + 0.2)
    return `läuft die See auf ${Math.round(other.headSeaShare * 100)} % der Strecke von vorn`;

  const windDiff = other.maxWind - best.maxWind;
  if (Math.abs(windDiff) >= 2) {
    return windDiff > 0
      ? `nimmt der Wind um ${nf(windDiff, 0)} kn zu`
      : `lässt der Wind um ${nf(-windDiff, 0)} kn nach`;
  }
  return null;
}

function satzFuerEn(
  zeit: Date, spaeter: boolean, grund: string | null,
  trend: string | null = null, hart = false, bezug: Date | null = null,
): string {
  const uhr = uhrMitTag(zeit, bezug, 'en');
  if (grund !== null) {
    if (hart) {
      return spaeter
        ? `From ${uhr} onward you should no longer depart: by then ${grund}.`
        : `Do not depart before ${uhr}: by then ${grund}.`;
    }

    return spaeter
      ? `Departing at ${uhr} or later, ${grund}.`
      : `Departing at ${uhr} or earlier, ${grund}.`;
  }

  const wann = spaeter ? `From ${uhr} onward` : `Until ${uhr}`;
  if (trend !== null) return `${wann} conditions become increasingly unfavourable${trend}`;
  return `${wann} conditions are less favourable, without any single limit being crossed.`;
}

function satzFuer(
  zeit: Date, spaeter: boolean, grund: string | null,
  trend: string | null = null, hart = false, sprache: Sprache = 'de', bezug: Date | null = null,
): string {
  if (sprache === 'en') return satzFuerEn(zeit, spaeter, grund, trend, hart, bezug);
  const uhr = uhrMitTag(zeit, bezug, 'de');
  if (grund !== null) {
    if (hart) {
      return spaeter
        ? `Ab ${uhr} sollte nicht mehr abgelegt werden: dann ${grund}.`
        : `Bis ${uhr} sollte nicht abgelegt werden: dann ${grund}.`;
    }

    return spaeter
      ? `Bei Ablegen ab ${uhr} ${grund}.`
      : `Bei Ablegen bis ${uhr} ${grund}.`;
  }

  const wann = `${spaeter ? 'Ab' : 'Bis'} ${uhr}`;
  if (trend !== null) return `${wann} werden die Bedingungen zunehmend ungünstiger${trend}`;
  return `${wann} sind die Bedingungen ungünstiger, ohne dass eine einzelne Grenze kippt.`;
}

function istHart(best: Ablegezeit, other: Ablegezeit): boolean {
  return istUnfahrbar(other) && !istUnfahrbar(best);
}

export function whyNot(best: Ablegezeit, other: Ablegezeit | null, spaeter: boolean, sprache: Sprache = 'de'): string | null {
  if (!other) return null;
  return satzFuer(other.departure, spaeter, grundFuer(best, other, sprache), null, istHart(best, other), sprache);
}

function trendGrund(best: Ablegezeit, byTime: Ablegezeit[], spaeter: boolean, sprache: Sprache = 'de'): { grund: string; zeit: Date } | null {
  const rand = spaeter ? byTime[byTime.length - 1]! : byTime[0]!;
  const grund = grundFuer(best, rand, sprache);
  return grund === null ? null : { grund, zeit: rand.departure };
}

function trendSatz(rand: { grund: string; zeit: Date } | null, sprache: Sprache = 'de', bezug: Date | null = null): string | null {
  if (rand === null) return null;
  const tag = tagName(rand.zeit, bezug, sprache);
  return sprache === 'en'
    ? `, around ${uhrLt(rand.zeit)}${tag ? ` on ${tag}` : ''}, for example, ${rand.grund}.`
    : `, ${tag ? `am ${tag} ` : ''}um ${uhrLt(rand.zeit)} zum Beispiel ${rand.grund}.`;
}

const SPIELRAUM_KNAPP_MIN = 60;

function dauerText(min: number, sprache: Sprache = 'de'): string {
  if (sprache === 'en') {
    if (min === 15) return 'a quarter of an hour';
    if (min === 30) return 'half an hour';
    if (min === 45) return 'three quarters of an hour';
    if (min === 60) return 'an hour';
    return `${min} minutes`;
  }
  if (min === 15) return 'eine Viertelstunde';
  if (min === 30) return 'eine halbe Stunde';
  if (min === 45) return 'eine Dreiviertelstunde';
  if (min === 60) return 'eine Stunde';
  return `${min} Minuten`;
}

function spielraumSatz(best: Ablegezeit, byTime: Ablegezeit[], sprache: Sprache = 'de'): string | null {

  if (istUnfahrbar(best)) return null;
  const ersteUnfahrbar = byTime.find((r) => r.departure > best.departure && istUnfahrbar(r));
  if (!ersteUnfahrbar) return null;
  const min = Math.round((ersteUnfahrbar.departure.getTime() - best.departure.getTime()) / 60000);
  if (min > SPIELRAUM_KNAPP_MIN) return null;
  if (sprache === 'en') {
    return `<b class="warn-text">Little margin:</b> Only ${dauerText(min, 'en')} lies between the recommendation and `
      + `${uhrLt(ersteUnfahrbar.departure)}. Delaying departure means sailing in conditions beyond the set limits`
      + ', and the forecast does not pin down such transitions to the quarter hour anyway.';
  }

  return `<b class="warn-text">Wenig Spielraum:</b> Zwischen der Empfehlung und ${uhrLt(ersteUnfahrbar.departure)} `
    + `liegt nur ${dauerText(min)}. Verzögert sich das Ablegen, fällt die Fahrt in Bedingungen jenseits der `
    + 'eingestellten Grenzwerte, und die Vorhersage trifft solche Übergänge ohnehin nicht auf die Viertelstunde genau.';
}

export function windowText(best: Ablegezeit, w: Ablegefenster, sprache: Sprache = 'de'): string[] {
  const L: string[] = [];

  const bezug = w.byTime[0]?.departure ?? null;
  const u = (d: Date) => uhrMitTag(d, bezug, sprache);
  const tagBest = tagName(best.departure, bezug, sprache);
  if (sprache === 'en') {
    if (w.single) {
      L.push(`The best time to depart is ${uhrLt(best.departure)}${tagBest ? ` on ${tagBest}` : ''}.`);
    } else {
      L.push(`The favourable departure window runs from ${u(w.from)} to ${u(w.to)}, `
        + `best by calculation at ${uhrLt(best.departure)}${tagBest ? ` on ${tagBest}` : ''}.`);
    }
  } else if (w.single) {
    L.push(`Bester Zeitpunkt zum Ablegen ist ${tagBest ? `${tagBest} ` : ''}${uhrLt(best.departure)}.`);
  } else {
    L.push(`Das günstige Ablegefenster reicht von ${u(w.from)} bis ${u(w.to)}, `
      + `rechnerisch am besten ${tagBest ? `am ${tagBest} ` : ''}um ${uhrLt(best.departure)}.`);
  }

  const spaetGrund = w.after ? grundFuer(best, w.after, sprache) : null;
  const fruehGrund = w.before ? grundFuer(best, w.before, sprache) : null;
  const spaetTrend = w.after && spaetGrund === null ? trendGrund(best, w.byTime, true, sprache) : null;
  const fruehTrend = w.before && fruehGrund === null ? trendGrund(best, w.byTime, false, sprache) : null;

  const beideAllgemein = !w.atEnd && !w.atStart && w.after && w.before
    && spaetGrund === null && fruehGrund === null && spaetTrend === null && fruehTrend === null;

  if (sprache === 'en') {
    if (w.atEnd && !w.single) L.push(`It extends to the end of the tested time span. Nothing was calculated after ${u(w.to)}.`);
    else if (w.after && !beideAllgemein) L.push(satzFuer(w.after.departure, true, spaetGrund, trendSatz(spaetTrend, sprache, bezug), istHart(best, w.after), sprache, bezug));

    if (w.atStart && !w.single) L.push(`It extends to the start of the tested time span. Nothing was calculated before ${u(w.from)}.`);
    else if (w.before && !beideAllgemein) L.push(satzFuer(w.before.departure, false, fruehGrund, trendSatz(fruehTrend, sprache, bezug), istHart(best, w.before), sprache, bezug));

    if (beideAllgemein) {
      L.push(`Until ${u(w.before!.departure)} and from ${u(w.after!.departure)} onward, conditions are each `
        + 'less favourable, without any single limit being crossed.');
    }
  } else {
    if (w.atEnd && !w.single) L.push(`Nach hinten reicht es bis ans Ende des geprüften Zeitraums. Nach ${u(w.to)} wurde nicht gerechnet.`);
    else if (w.after && !beideAllgemein) L.push(satzFuer(w.after.departure, true, spaetGrund, trendSatz(spaetTrend, 'de', bezug), istHart(best, w.after), 'de', bezug));

    if (w.atStart && !w.single) L.push(`Nach vorn reicht das Fenster bis an den Anfang des geprüften Zeitraums. Vor ${u(w.from)} wurde nicht gerechnet.`);
    else if (w.before && !beideAllgemein) L.push(satzFuer(w.before.departure, false, fruehGrund, trendSatz(fruehTrend, 'de', bezug), istHart(best, w.before), 'de', bezug));

    if (beideAllgemein) {
      L.push(`Bis ${u(w.before!.departure)} und ab ${u(w.after!.departure)} sind die Bedingungen `
        + 'jeweils ungünstiger, ohne dass eine einzelne Grenze kippt.');
    }
  }

  const spielraum = spielraumSatz(best, w.byTime, sprache);
  if (spielraum) L.push(spielraum);

  return L;
}
