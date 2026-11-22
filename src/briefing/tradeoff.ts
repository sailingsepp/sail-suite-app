import { uhrLt, fmtDur, anzeigeMinuten } from '@/core/time';
import type { Ablegezeit, Sprache } from '@/core/types';
import { istUnfahrbar } from './verdict';
import { grundFuer, guenstigGrenze } from './window';

export interface Spreizung {

  geprueft: number;

  fahrbar: number;

  guenstig: number;

  fahrzeitMin: number;

  fahrzeitZaehlt: boolean;
  klasse: 'gering' | 'mittel' | 'gross';
}

const GUENSTIG_ANTEIL_GERING = 0.7;
const GUENSTIG_ANTEIL_GROSS = 0.3;
const FAHRZEIT_GERING_MIN = 30;
const FAHRZEIT_GROSS_MIN = 90;

const SCHNELLER_MIN = 15;
const SCHNELLER_ANTEIL = 0.05;

const MOTOR_FAST_GANZ = 0.8;

export function spanneText(min: number): string {
  const m = Math.round(min);
  return m < 60 ? `${m} min` : fmtDur(m / 60);
}

export function preisDerEile(best: Ablegezeit, schnell: Ablegezeit, sprache: Sprache = 'de'): string {
  const grund = grundFuer(best, schnell, sprache);
  if (sprache === 'en') {
    return grund !== null
      ? `In exchange, ${grund}.`
      : 'In exchange, the overall rating comes out a little worse, without any single quantity tipping the balance.';
  }
  return grund !== null
    ? `Dafür ${grund}.`
    : 'Dafür fällt die Gesamtbewertung etwas schlechter aus, ohne dass eine einzelne Größe den Ausschlag gibt.';
}

export function spreizung(results: Ablegezeit[], best: Ablegezeit): Spreizung | null {
  const fahrbar = results.filter((r) => !istUnfahrbar(r));
  if (fahrbar.length < 2) return null;
  const grenze = guenstigGrenze(best);
  let tMin = Infinity, tMax = -Infinity, guenstig = 0;
  for (const r of fahrbar) {
    if (r.score <= grenze) guenstig++;
    if (r.totalHrs < tMin) tMin = r.totalHrs;
    if (r.totalHrs > tMax) tMax = r.totalHrs;
  }
  const fahrzeitMin = (tMax - tMin) * 60;
  const anteil = guenstig / results.length;
  const klasse = (anteil >= GUENSTIG_ANTEIL_GERING && fahrzeitMin <= FAHRZEIT_GERING_MIN) ? 'gering'
    : (anteil <= GUENSTIG_ANTEIL_GROSS || fahrzeitMin >= FAHRZEIT_GROSS_MIN) ? 'gross'
      : 'mittel';
  const fahrzeitZaehlt = fahrzeitMin >= SCHNELLER_MIN
    && fahrzeitMin >= best.totalHrs * 60 * SCHNELLER_ANTEIL;
  return { geprueft: results.length, fahrbar: fahrbar.length, guenstig, fahrzeitMin, fahrzeitZaehlt, klasse };
}

function kuerzesteFahrt(results: Ablegezeit[], best: Ablegezeit): Ablegezeit | null {
  if (istUnfahrbar(best)) return null;
  let s: Ablegezeit | null = null;
  for (const r of results) {
    if (istUnfahrbar(r)) continue;

    if (best.isDaylight === true && r.isDaylight === false) continue;
    if (s === null || r.totalHrs < s.totalHrs) s = r;
  }
  return s !== null && s !== best ? s : null;
}

export function schnellsteFahrt(results: Ablegezeit[], best: Ablegezeit): Ablegezeit | null {
  const s = kuerzesteFahrt(results, best);
  if (s === null) return null;
  const gewinnMin = (best.totalHrs - s.totalHrs) * 60;
  return (gewinnMin >= SCHNELLER_MIN && gewinnMin >= best.totalHrs * 60 * SCHNELLER_ANTEIL) ? s : null;
}

function gleichaufText(sp: Spreizung, sprache: Sprache): string {
  if (sp.guenstig <= 1) {
    const andere = sp.geprueft - 1;
    return sprache === 'en'
      ? `none of the other ${andere} tested departure times is practically tied with the recommended one`
      : `keine der übrigen ${andere} geprüften Ablegezeiten liegt mit der empfohlenen praktisch gleichauf`;
  }
  return sprache === 'en'
    ? `${sp.guenstig} of the ${sp.geprueft} tested departure times are practically tied`
    : `${sp.guenstig} der ${sp.geprueft} geprüften Ablegezeiten liegen praktisch gleichauf`;
}

function spreizungSatzEn(sp: Spreizung): string {
  const zahlen = `${gleichaufText(sp, 'en')}, `
    + `and the fastest and slowest feasible sailing times differ by ${spanneText(sp.fahrzeitMin)}`;
  if (sp.klasse === 'gering') {
    return `The departure time makes little difference on this day: ${zahlen}. Anyone who wants to depart earlier or `
      + 'later for other reasons loses little by it.';
  }
  if (sp.klasse === 'gross') {
    if (!sp.fahrzeitZaehlt) {
      return 'The departure time makes a clear difference on this day, not in sailing time '
        + `(only ${spanneText(sp.fahrzeitMin)} between the fastest and slowest feasible), but in the conditions: `
        + `${sp.guenstig <= 1 ? '' : 'only '}${gleichaufText(sp, 'en')}. `
        + 'Keeping to the window gets you there no sooner, but in better shape.';
    }
    return `The departure time makes a clear difference on this day: ${sp.guenstig <= 1 ? '' : 'only '}${zahlen}. `
      + 'It is worth keeping to the stated window here.';
  }
  return `For context: ${zahlen}.`;
}

function spreizungSatz(sp: Spreizung, sprache: Sprache = 'de'): string {
  if (sprache === 'en') return spreizungSatzEn(sp);

  const zahlen = `${gleichaufText(sp, 'de')}, `
    + `und zwischen der schnellsten und der langsamsten fahrbaren liegen ${spanneText(sp.fahrzeitMin)} Fahrzeit`;
  if (sp.klasse === 'gering') {
    return `Die Ablegezeit macht an diesem Tag wenig aus: ${zahlen}. Wer aus anderen Gründen früher oder `
      + 'später ablegen möchte, verliert damit wenig.';
  }
  if (sp.klasse === 'gross') {

    if (!sp.fahrzeitZaehlt) {
      return 'Die Ablegezeit macht an diesem Tag einen deutlichen Unterschied. Nicht in der Fahrzeit '
        + `(zwischen der schnellsten und der langsamsten fahrbaren liegen nur ${spanneText(sp.fahrzeitMin)}), `
        + `sondern in den Bedingungen: ${sp.guenstig <= 1 ? '' : 'nur '}${gleichaufText(sp, 'de')}. `
        + 'Wer das Fenster einhält, kommt nicht früher an, aber unter besseren Bedingungen.';
    }
    return `Die Ablegezeit macht an diesem Tag einen deutlichen Unterschied: ${sp.guenstig <= 1 ? '' : 'nur '}${zahlen}. `
      + 'Hier lohnt es sich, das genannte Fenster einzuhalten.';
  }
  return `Zur Einordnung: ${zahlen}.`;
}

function schlusszeilen(
  best: Ablegezeit,
  results: Ablegezeit[],
  motorSpeed: number | null | undefined,
  sprache: Sprache = 'de',
): string | null {
  const en = sprache === 'en';
  const zeilen: string[] = [];

  const kurz = kuerzesteFahrt(results, best);
  const schonImText = schnellsteFahrt(results, best) !== null;
  if (kurz && !schonImText && kurz.motorShare < MOTOR_FAST_GANZ) {
    zeilen.push(en
      ? `Shortest feasible passage: ${fmtDur(kurz.totalHrs)}, departing at ${uhrLt(kurz.departure)}.`
      : `Kürzeste fahrbare Fahrzeit: ${fmtDur(kurz.totalHrs)}, Ablegen um ${uhrLt(kurz.departure)}.`);
  }

  const totalNM = best.avgSpeed * best.sailHrs;
  if (motorSpeed && motorSpeed > 0 && totalNM > 0 && best.motorShare < MOTOR_FAST_GANZ) {
    const motorHrs = totalNM / motorSpeed + best.manHrs;
    zeilen.push(en
      ? `Passage entirely under engine: roughly ${fmtDur(motorHrs)}, almost independent of the departure time.`
      : `Fahrzeit ganz unter Maschine: rund ${fmtDur(motorHrs)}, fast unabhängig von der Ablegezeit.`);
  }

  if (!zeilen.length) return null;

  return ` <div class="brief-absatz">${zeilen.join(' <br>')}</div>`;
}

export function describeZeitwahl(
  best: Ablegezeit,
  results: Ablegezeit[],
  motorSpeed?: number | null,
  sprache: Sprache = 'de',
): string | null {
  if (istUnfahrbar(best)) return null;
  const S: string[] = [];

  const sp = spreizung(results, best);
  if (sp) S.push(spreizungSatz(sp, sprache));

  const schnell = schnellsteFahrt(results, best);
  if (schnell) {

    const diff = spanneText(anzeigeMinuten(best.totalHrs) - anzeigeMinuten(schnell.totalHrs));
    if (sprache === 'en') {
      S.push(`In a hurry? Depart at ${uhrLt(schnell.departure)} and the passage is ${diff} shorter `
        + `(${fmtDur(schnell.totalHrs)} instead of ${fmtDur(best.totalHrs)}). ${preisDerEile(best, schnell, sprache)}`);
    } else {
      S.push(`Wer es eilig hat: Um ${uhrLt(schnell.departure)} abgelegt ist die Fahrt ${diff} kürzer `
        + `(${fmtDur(schnell.totalHrs)} statt ${fmtDur(best.totalHrs)}). ${preisDerEile(best, schnell)}`);
    }
  }

  const text = S.join(' ');

  const schluss = schlusszeilen(best, results, motorSpeed, sprache);
  if (!text) return schluss ? schluss.trimStart() : null;
  return schluss ? text + schluss : text;
}
