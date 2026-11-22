import type { BriefingAbschnitt } from './index';
import type { Sprache } from '@/core/types';
import { htmlZuText } from '@/core/html';

const KOMPASS_SPRECHEN_DE: Record<string, string> = {
  N: 'Nord', NNO: 'Nordnordost', NO: 'Nordost', ONO: 'Ostnordost', O: 'Ost',
  OSO: 'Ostsüdost', SO: 'Südost', SSO: 'Südsüdost', S: 'Süd', SSW: 'Südsüdwest',
  SW: 'Südwest', WSW: 'Westsüdwest', W: 'West', WNW: 'Westnordwest',
  NW: 'Nordwest', NNW: 'Nordnordwest',
};

const KOMPASS_SPRECHEN_EN: Record<string, string> = {
  N: 'North', NNE: 'North-northeast', NE: 'Northeast', ENE: 'East-northeast', E: 'East',
  ESE: 'East-southeast', SE: 'Southeast', SSE: 'South-southeast', S: 'South', SSW: 'South-southwest',
  SW: 'Southwest', WSW: 'West-southwest', W: 'West', WNW: 'West-northwest',
  NW: 'Northwest', NNW: 'North-northwest',
};

const kompassMuster = (k: string[]): RegExp =>
  new RegExp(`(?<![\\p{L}\\d])(${k.join('|')})(?![\\p{L}\\d])(?!\\s*\\d{1,2}:\\d{2})(?!\\s*\\d{1,2} Uhr\\b)(?!\\s*\\d{4} (?:LT|UTC)\\b)`, 'gu');
const KOMPASS_MUSTER_DE = kompassMuster(Object.keys(KOMPASS_SPRECHEN_DE));
const KOMPASS_MUSTER_EN = kompassMuster(Object.keys(KOMPASS_SPRECHEN_EN));

function kompassSprechen(t: string, sprache: Sprache): string {
  return sprache === 'en'
    ? t.replace(KOMPASS_MUSTER_EN, (treffer) => KOMPASS_SPRECHEN_EN[treffer]!)
    : t.replace(KOMPASS_MUSTER_DE, (treffer) => KOMPASS_SPRECHEN_DE[treffer]!);
}

export function uhrzeitenSprechen(t: string, sprache: Sprache): string {
  const de = sprache !== 'en';
  const bezug = (b: string) => (b === 'UTC' ? 'UTC' : de ? 'Ortszeit' : 'local time');
  const zeit = (hh: string, mm: string) => (de
    ? `${Number(hh)} Uhr${Number(mm) ? ` ${Number(mm)}` : ''}`
    : `${hh}:${mm}`);
  return t
    .replace(/\b(\d{2})(\d{2})\s*[–-]\s*(\d{2})(\d{2}) (LT|UTC)\b/g,
      (_m, h1: string, m1: string, h2: string, m2: string, b: string) => `${zeit(h1, m1)} ${de ? 'bis' : 'to'} ${zeit(h2, m2)} ${bezug(b)}`)
    .replace(/\b(\d{2})(\d{2}) (LT|UTC)\b/g, (_m, hh: string, mm: string, b: string) => `${zeit(hh, mm)} ${bezug(b)}`);
}

function einheitenSprechenDe(t: string): string {
  return uhrzeitenSprechen(t, 'de')
    .replace(/\bkn\b/g, 'Knoten')
    .replace(/\bsm\b/g, 'Seemeilen')
    .replace(/\bBft\b/g, 'Beaufort')
    .replace(/\bhPa\b/g, 'Hektopascal')
    .replace(/\bmm\/h\b/g, 'Millimeter pro Stunde')
    .replace(/\bJ\/kg\b/g, 'Joule pro Kilogramm')

    .replace(/(\d+)\s*h\b/g, (_, n: string) => (Number(n) === 1 ? 'eine Stunde' : `${n} Stunden`))
    .replace(/(\d+)\s*min\b/g, (_, n: string) => (Number(n) === 1 ? 'eine Minute' : `${n} Minuten`))

    .replace(/\s*°C?/g, ' Grad')
    .replace(/%/g, ' Prozent')

    .replace(/\s*[—–]\s*/g, ', ');
}

function einheitenSprechenEn(t: string): string {
  return uhrzeitenSprechen(t, 'en')
    .replace(/\bkn\b/g, 'knots')
    .replace(/\b(?:nm|NM)\b/g, 'nautical miles')
    .replace(/\bBft\b/g, 'Beaufort')
    .replace(/\bhPa\b/g, 'hectopascals')
    .replace(/\bmm\/h\b/g, 'millimetres per hour')
    .replace(/\bJ\/kg\b/g, 'joules per kilogram')

    .replace(/(\d+)\s*h\b/g, (_, n: string) => (Number(n) === 1 ? '1 hour' : `${n} hours`))
    .replace(/(\d+)\s*min\b/g, (_, n: string) => (Number(n) === 1 ? '1 minute' : `${n} minutes`))
    .replace(/\s*°C?/g, ' degrees')
    .replace(/%/g, ' percent')
    .replace(/\s*[—–]\s*/g, ', ');
}

function vorlesbar(html: string, sprache: Sprache, wortlaut = false): string {

  const text = wortlaut ? htmlZuText(html) : kompassSprechen(htmlZuText(html), sprache);
  return sprache === 'en' ? einheitenSprechenEn(text) : einheitenSprechenDe(text);
}

export function vorleseFolge(abschnitte: readonly BriefingAbschnitt[]): BriefingAbschnitt[] {
  const vorne = (a: BriefingAbschnitt): number => (a.art === 'fazit' ? 0 : a.art === 'warnungen' ? 1 : 2);
  return [...abschnitte].sort((a, b) => vorne(a) - vorne(b));
}

export function vorlesetext(abschnitte: BriefingAbschnitt[], sprache: Sprache = 'de'): string {
  return vorleseFolge(abschnitte)
    .map((a) => `${vorlesbar(a.titel, sprache)}. ${vorlesbar(a.text, sprache)}`)
    .join(' ');
}

const SATZGRENZE = /(?<=[.!?])\s+/;

export function vorleseHaeppchen(abschnitte: BriefingAbschnitt[], sprache: Sprache = 'de'): string[] {
  const out: string[] = [];
  for (const a of vorleseFolge(abschnitte)) {
    const titel = vorlesbar(a.titel, sprache);
    const saetze = vorlesbar(a.text, sprache, a.art === 'amtlich').split(SATZGRENZE).map((s) => s.trim()).filter((s) => s.length > 0);
    if (saetze.length === 0) { out.push(`${titel}.`); continue; }
    out.push(`${titel}. ${saetze[0]}`);
    out.push(...saetze.slice(1));
  }
  return out;
}
