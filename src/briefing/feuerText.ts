import { nf, kursRw, bereichRw } from '@/core/time';
import { zerlegeKennung } from '@/core/leuchtfeuer';
import type { Sprache } from '@/core/types';

export interface FeuerZeile { titel: string; text: string }
export interface FeuerSektor { nr: number | null; zeilen: FeuerZeile[]; sichtbar: boolean }
export interface FeuerSteckbrief { titel: string; art: string | null; zeilen: FeuerZeile[]; sektoren: FeuerSektor[] }

type Tags = Readonly<Record<string, string>>;
type T = { de: string; en: string };

const ART: Record<string, T> = {
  F: { de: 'Festfeuer', en: 'fixed' }, Oc: { de: 'unterbrochenes Feuer', en: 'occulting' },
  Iso: { de: 'Gleichtaktfeuer', en: 'isophase' }, Fl: { de: 'Blitzfeuer', en: 'flashing' },
  LFl: { de: 'Blinkfeuer', en: 'long-flashing' }, Q: { de: 'Funkelfeuer', en: 'quick-flashing' },
  VQ: { de: 'schnelles Funkelfeuer', en: 'very quick-flashing' }, UQ: { de: 'ultraschnelles Funkelfeuer', en: 'ultra quick-flashing' },
  IQ: { de: 'unterbrochenes Funkelfeuer', en: 'interrupted quick-flashing' },
  IVQ: { de: 'unterbrochenes schnelles Funkelfeuer', en: 'interrupted very quick-flashing' },
  IUQ: { de: 'unterbrochenes ultraschnelles Funkelfeuer', en: 'interrupted ultra quick-flashing' },
  Mo: { de: 'Morsefeuer', en: 'Morse' }, FFl: { de: 'Fest- und Blitzfeuer', en: 'fixed and flashing' },
  FLFl: { de: 'Fest- und Blinkfeuer', en: 'fixed and long-flashing' }, FlLFl: { de: 'Blitz- und Blinkfeuer', en: 'flash and long-flash' },
  OcFl: { de: 'unterbrochenes Feuer mit Blitz', en: 'occulting and flashing' },
  'Q+LFl': { de: 'Funkelfeuer mit Blink', en: 'quick-flash plus long-flash' },
  'VQ+LFl': { de: 'schnelles Funkelfeuer mit Blink', en: 'very quick-flash plus long-flash' },
  'UQ+LFl': { de: 'ultraschnelles Funkelfeuer mit Blink', en: 'ultra quick-flash plus long-flash' },
};
const FARBE: Record<string, T> = {
  white: { de: 'weiß', en: 'white' }, red: { de: 'rot', en: 'red' }, green: { de: 'grün', en: 'green' },
  yellow: { de: 'gelb', en: 'yellow' }, blue: { de: 'blau', en: 'blue' }, amber: { de: 'orange', en: 'amber' },
  orange: { de: 'orange', en: 'orange' }, violet: { de: 'violett', en: 'violet' }, magenta: { de: 'magenta', en: 'magenta' },
};
const KURZ: Record<string, string> = { white: 'W', red: 'R', green: 'G', yellow: 'Y', blue: 'Bu', amber: 'Am', orange: 'Or', violet: 'Vi', magenta: 'Mg' };
const TYP: Record<string, T> = {
  light_major: { de: 'Leuchtfeuer', en: 'major light' }, light_minor: { de: 'Feuer', en: 'minor light' },
  light_vessel: { de: 'Feuerschiff', en: 'light vessel' }, light_float: { de: 'Leuchttonne', en: 'light float' },
  buoy_lateral: { de: 'Lateraltonne', en: 'lateral buoy' }, beacon_lateral: { de: 'Lateralbake', en: 'lateral beacon' },
  buoy_cardinal: { de: 'Kardinaltonne', en: 'cardinal buoy' }, beacon_cardinal: { de: 'Kardinalbake', en: 'cardinal beacon' },
  buoy_isolated_danger: { de: 'Einzelgefahrentonne', en: 'isolated danger buoy' },
  beacon_isolated_danger: { de: 'Einzelgefahrenbake', en: 'isolated danger beacon' },
  buoy_safe_water: { de: 'Ansteuerungstonne', en: 'safe water buoy' }, beacon_safe_water: { de: 'Ansteuerungsbake', en: 'safe water beacon' },
  buoy_special_purpose: { de: 'Sondertonne', en: 'special purpose buoy' }, beacon_special_purpose: { de: 'Sonderbake', en: 'special purpose beacon' },
  landmark: { de: 'Landmarke', en: 'landmark' }, platform: { de: 'Plattform', en: 'platform' },
};

const KATEGORIE: Record<string, T> = {
  directional: { de: 'Richtfeuer', en: 'directional' }, leading: { de: 'Leitfeuer', en: 'leading' },
  front: { de: 'Unterfeuer', en: 'front' }, rear: { de: 'Oberfeuer', en: 'rear' },
  lower: { de: 'Unterfeuer', en: 'lower' }, upper: { de: 'Oberfeuer', en: 'upper' },
  aero: { de: 'Luftfahrtfeuer', en: 'aero' }, air_obstruction: { de: 'Luftfahrthindernisfeuer', en: 'air obstruction' },
  emergency: { de: 'Notfeuer', en: 'emergency' }, subsidiary: { de: 'Nebenfeuer', en: 'subsidiary' },
  floodlight: { de: 'Anstrahlung', en: 'floodlight' },
};

const t = (x: T | undefined, s: Sprache, roh: string) => (x ? x[s] : roh);

export const farbWort = (c: string, s: Sprache): string => t(FARBE[c], s, c);
const zahl = (v: string | undefined) => { const n = Number((v ?? '').replace(',', '.')); return v && Number.isFinite(n) ? n : null; };
const zeit = (n: number, s: Sprache) => `${nf(n, Number.isInteger(n) ? 0 : 1, s)} s`;

export function folgeText(seq: string, s: Sprache): string | null {
  const teile = seq.replace(/\[[^\]]*\]/g, '').split(/[+,]/).map((x) => x.trim()).filter(Boolean);
  const aus = teile.map((x) => {
    const dunkel = /^\(.*\)$/.test(x);
    const n = zahl(x.replace(/[()]/g, ''));
    return n === null ? null : `${zeit(n, s)} ${dunkel ? (s === 'de' ? 'dunkel' : 'dark') : (s === 'de' ? 'hell' : 'light')}`;
  });
  return aus.length && aus.every(Boolean) ? aus.join(' · ') : null;
}

function sektorZeilen(g: (k: string) => string | undefined, s: Sprache): FeuerZeile[] {
  const z: FeuerZeile[] = [];
  const character = g('character');
  const farben = (g('colour') ?? '').split(/[;,]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const periode = zahl(g('period'));
  if (character) {
    const { art, wechsel, gruppe } = zerlegeKennung(character, g('group'));

    const gr = gruppe && gruppe !== '1' ? `(${gruppe})` : '';
    const kennung = `${wechsel ? 'Al.' : ''}${gr && art.includes('+') ? art.replace('+', `${gr}+`) : `${art}${gr}`}`
      + `${farben.length ? ` ${farben.map((f) => KURZ[f] ?? f).join('')}` : ''}${periode !== null ? ` ${nf(periode, Number.isInteger(periode) ? 0 : 1, 'en')}s` : ''}`;
    z.push({ titel: s === 'de' ? 'Kennung' : 'Characteristic', text: kennung });
    const worte: string[] = [];
    if (wechsel) worte.push(s === 'de' ? 'Wechselfeuer' : 'alternating');
    worte.push(t(ART[art], s, art));
    if (gruppe && gruppe !== '1') worte.push(art === 'Mo' ? `${s === 'de' ? 'Buchstabe' : 'letter'} ${gruppe}` : `${s === 'de' ? 'Gruppe' : 'group'} (${gruppe})`);
    if (farben.length) worte.push(farben.map((f) => t(FARBE[f], s, f)).join(s === 'de' ? (wechsel ? ' und ' : ', ') : (wechsel ? ' and ' : ', ')));
    z.push({ titel: 'Text', text: worte.join(', ').replace(/^./, (c) => c.toUpperCase()) });
  } else {

    z.push({ titel: s === 'de' ? 'Kennung' : 'Characteristic', text: s === 'de' ? 'in OpenStreetMap nicht eingetragen' : 'not recorded in OpenStreetMap' });
    if (farben.length) z.push({ titel: s === 'de' ? 'Farbe' : 'Colour', text: farben.map((f) => t(FARBE[f], s, f)).join(', ').replace(/^./, (c) => c.toUpperCase()) });
  }
  if (periode !== null) z.push({ titel: s === 'de' ? 'Wiederkehr' : 'Period', text: zeit(periode, s) });
  const seq = g('sequence');
  const folge = seq ? folgeText(seq, s) : null;
  if (folge) z.push({ titel: s === 'de' ? 'Folge' : 'Sequence', text: folge });
  const von = zahl(g('sector_start')), bis = zahl(g('sector_end'));
  if (von !== null && bis !== null) z.push({ titel: s === 'de' ? 'Sektor' : 'Sector', text: bereichRw(von, bis, s) });
  const hoehe = zahl(g('height'));
  if (hoehe !== null) z.push({ titel: s === 'de' ? 'Feuerhöhe' : 'Elevation', text: `${nf(hoehe, Number.isInteger(hoehe) ? 0 : 1, s)} m` });
  const weite = zahl(g('range'));
  if (weite !== null) z.push({ titel: s === 'de' ? 'Tragweite' : 'Range', text: `${nf(weite, Number.isInteger(weite) ? 0 : 1, s)} ${s === 'de' ? 'sm' : 'NM'}` });
  const kat = g('category');
  if (kat) z.push({ titel: s === 'de' ? 'Art' : 'Category', text: kat.split(/[;,]/).map((k) => t(KATEGORIE[k.trim()], s, k.trim())).join(', ') });
  const orient = zahl(g('orientation'));
  if (orient !== null) z.push({ titel: s === 'de' ? 'Richtung' : 'Orientation', text: kursRw(orient, s) });
  const mehr = zahl(g('multiple'));
  if (mehr !== null && mehr > 1) z.push({ titel: s === 'de' ? 'Anzahl' : 'Number', text: String(mehr) });
  for (const [k, de, en] of [['visibility', 'Sichtbarkeit', 'Visibility'], ['exhibition', 'Betrieb', 'Exhibition']] as const) {
    const v = g(k);
    if (v) z.push({ titel: s === 'de' ? de : en, text: v });
  }
  return z;
}

export function feuerSteckbrief(tags: Tags, s: Sprache, sichtbar: number | null = null): FeuerSteckbrief {
  const typ = tags['seamark:type'];
  const artKlein = tags['man_made'] === 'lighthouse' ? (s === 'de' ? 'Leuchtturm' : 'lighthouse') : typ ? t(TYP[typ], s, typ) : null;
  const art = artKlein ? artKlein.charAt(0).toUpperCase() + artKlein.slice(1) : null;
  const titel = tags['seamark:name']?.trim() || tags['name']?.trim() || art || (s === 'de' ? 'Feuer' : 'Light');
  const nummern = [...new Set(Object.keys(tags).map((k) => /^seamark:light:(\d+):/.exec(k)?.[1]).filter((x): x is string => !!x).map(Number))].sort((a, b) => a - b);
  const grund = (k: string) => tags[`seamark:light:${k}`];
  const sektoren: FeuerSektor[] = nummern.length
    ? nummern.map((n) => ({ nr: n, sichtbar: sichtbar === n, zeilen: sektorZeilen((k) => tags[`seamark:light:${n}:${k}`] ?? grund(k), s) }))
    : [{ nr: null, sichtbar: false, zeilen: sektorZeilen(grund, s) }];
  const zeilen: FeuerZeile[] = [];
  const ref = grund('reference');
  if (ref) zeilen.push({ titel: s === 'de' ? 'Nummer' : 'Number', text: ref });
  if (tags['seamark:radio_station:category']?.split(';').includes('ais')) {
    const mmsi = tags['seamark:radio_station:mmsi'];
    zeilen.push({ titel: 'AIS', text: mmsi ? `MMSI ${mmsi}` : 'AIS' });
  }
  const info = tags['seamark:information']?.trim();
  if (info) zeilen.push({ titel: s === 'de' ? 'Hinweis' : 'Information', text: info });
  return { titel, art: titel === art ? null : art, zeilen, sektoren };
}
