import { kursGrad, nf } from './time';
import { positionText } from './koordinaten';
import type { Ereignis } from './spur';
import type { Sprache } from './types';
import { lateinisch } from './umschrift';


const ORTS_ARTEN = new Set(['start', 'ziel', 'anlegen', 'ankern', 'liegeplatz', 'ankerplatz', 'treiben']);


const ARTEN: Record<string, [string, string]> = {
  kurswechsel: ['Kurswechsel', 'Course change'],
  fahrtwechsel: ['Fahrtänderung', 'Speed change'],
  antrieb: ['Antrieb', 'Propulsion'],
  start: ['Abgelegt', 'Cast off'],
  ziel: ['Angekommen', 'Arrived'],
  ankern: ['Ankern', 'Anchored'],
  anlegen: ['Anlegen', 'Moored'],
  liegeplatz: ['Liegeplatz', 'Berth'],
  ankerplatz: ['Ankerplatz', 'Anchorage'],
  luecke: ['Lücke', 'Gap'],
  import: ['Import', 'Import'],
  ankerwache: ['Ankerwache', 'Anchor watch'],
  tagesende: ['Tageswechsel', 'Day boundary'],
  foto: ['Foto', 'Photo'],
  standort: ['Standort', 'Position'],
  aufschiesser: ['Aufschießer', 'Head to wind'],
  treiben: ['Treiben lassen', 'Drifting'],
  
  ais: ['AIS', 'AIS'],
  
  navigation: ['Navigation', 'Navigation'],
  mob: ['Mann über Bord', 'Man overboard'],
  
  tanken: ['Tankstopp', 'Fuel stop'],
};


export type Liegeart = 'anker' | 'heck' | 'bug' | 'laengsseits' | 'boje' | 'treiben';

export const LIEGEARTEN: readonly Liegeart[] = ['anker', 'heck', 'bug', 'laengsseits', 'boje', 'treiben'];


const FESTGEMACHT: Record<'heck' | 'bug' | 'laengsseits' | 'boje', [string, string]> = {
  heck: ['Heckleinen am Kai', 'stern-to'],
  bug: ['Bug zum Kai', 'bow-to'],
  laengsseits: ['längsseits am Kai', 'alongside'],
  boje: ['an Boje', 'to a buoy'],
};


export function liegeartName(l: Liegeart, sprache: Sprache): string {
  switch (l) {
    case 'anker': return sprache === 'de' ? 'Ankern (ohne Ankerwache)' : 'Anchored (no anchor watch)';
    case 'treiben': return sprache === 'de' ? 'Boot treibend' : 'Drifting';
    default: return sprache === 'de' ? `Festgemacht, ${FESTGEMACHT[l][0]}` : `Moored ${FESTGEMACHT[l][1]}`;
  }
}


export function liegeEintragArt(l: Liegeart): 'ankern' | 'anlegen' | 'treiben' {
  return l === 'anker' ? 'ankern' : l === 'treiben' ? 'treiben' : 'anlegen';
}


export function eintragArtName(art: string, sprache: Sprache, liegeart?: Liegeart): string {
  if (art === 'hand' || art === 'wetter') return '';
  
  if (liegeart === 'heck' || liegeart === 'bug' || liegeart === 'laengsseits' || liegeart === 'boje') {
    if (art === 'anlegen') return liegeartName(liegeart, sprache);
    if (art === 'liegeplatz') {
      const [de, en] = FESTGEMACHT[liegeart];
      return sprache === 'de' ? `Liegeplatz, ${de}` : `Berth, ${en}`;
    }
  }
  const paar = ARTEN[art];
  return paar ? (sprache === 'de' ? paar[0] : paar[1]) : art;
}


export function eintragInhalt(art: string, text: string | null | undefined, sprache: Sprache): string {
  const t = text ?? '';
  if (art === 'antrieb') {
    if (t === 'motor') return sprache === 'de' ? 'Maschine' : 'Engine';
    if (t === 'segel') return sprache === 'de' ? 'Segel' : 'Sail';
  }
  
  
  if (ORTS_ARTEN.has(art)) return lateinisch(t);
  
  
  if (art === 'kurswechsel') {
    return t.replace(/(?<![\d,.])(\d{1,2})°/g, (_, g: string) => `${g.padStart(3, '0')}°`);
  }
  if (art === 'fahrtwechsel') {
    return t.replace(/(\d+)[.,](\d+) kn/g, (_, a: string, b: string) =>
      `${nf(Number(`${a}.${b}`), b.length, sprache)} kn`);
  }
  return t;
}


export function ereignisText(e: Ereignis, sprache: Sprache): string {
  const grad = (x: number) => kursGrad(x);
  switch (e.art) {
    case 'kurswechsel':
      return `${grad(e.von)} → ${grad(e.nach)}`;
    case 'fahrtwechsel':
      return `${nf(e.von, 1, sprache)} kn → ${nf(e.nach, 1, sprache)} kn`;
    case 'standort':
      
      
      return sprache === 'en'
        ? `${positionText(e.lat, e.lon, 'en')} · COG ${grad(e.von)} · SOG ${nf(e.nach, 1, 'en')} kn`
        : `${positionText(e.lat, e.lon, 'de')} · KüG ${grad(e.von)} · FüG ${nf(e.nach, 1, 'de')} kn`;
    case 'aufschiesser': {
      const kurs = `${grad(e.von)} → ${grad(e.nach)}`;
      if (e.windAus !== undefined) {
        return sprache === 'en'
          ? `${kurs}, into the wind (wind per forecast from ${grad(e.windAus)})`
          : `${kurs}, in den Wind (Wind laut Vorhersage aus ${grad(e.windAus)})`;
      }
      return sprache === 'en'
        ? `${kurs}, sharp turn and stop (wind direction not checked)`
        : `${kurs}, scharf gedreht und aufgestoppt (Windrichtung nicht geprüft)`;
    }
  }
}

const BEWEGUNG = new Set(['kurswechsel', 'fahrtwechsel', 'aufschiesser']);


export function liegeZeitNachBewegung(
  eintraege: readonly { art: string; t: number }[], liegeT: number, fensterMs = 3 * 60_000,
): number {
  let t = liegeT;
  for (const e of eintraege) {
    if (BEWEGUNG.has(e.art) && e.t >= liegeT && e.t <= liegeT + fensterMs && e.t >= t) t = e.t + 1000;
  }
  return t;
}


export function liegenAmTagesbeginn(
  alteEintraege: readonly { art: string; t: number; text?: string | undefined; liegeart?: Liegeart | undefined }[],
  ankerwache: boolean,
): { art: 'liegeplatz' | 'ankerplatz'; text: string; liegeart?: Liegeart } {
  const letzter = [...alteEintraege]
    .filter((e) => LIEGE_ARTEN.has(e.art))
    .sort((a, b) => a.t - b.t)
    .pop();
  const geankert = ankerwache || letzter?.art === 'ankern' || letzter?.art === 'ankerplatz';
  const art = geankert ? 'ankerplatz' : 'liegeplatz';
  
  const la = letzter?.liegeart;
  return la && la !== 'treiben' && (la === 'anker') === geankert
    ? { art, text: letzter?.text ?? '', liegeart: la }
    : { art, text: letzter?.text ?? '' };
}

const LIEGE_ARTEN = new Set(['anlegen', 'ankern', 'liegeplatz', 'ankerplatz']);
