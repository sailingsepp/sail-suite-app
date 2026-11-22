import { nf } from '@/core/time';
import type { Ablegezeit, Sprache } from '@/core/types';

const BEAUFORT = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
export function beaufort(kn: number): number {
  let b = 0;
  for (let i = 0; i < BEAUFORT.length; i++) if (kn >= BEAUFORT[i]!) b = i + 1;
  return b;
}

export function beaufortUntergrenzeKn(bft: number): number {
  const i = Math.min(Math.max(Math.round(bft), 1), BEAUFORT.length);
  return BEAUFORT[i - 1]!;
}

export function windBand(kn: number, sprache: Sprache = 'de'): { i: number; name: string } {
  const DE = ['Windstille', 'leiser Zug', 'leichte Brise', 'schwache Brise', 'mäßige Brise',
    'frische Brise', 'starker Wind', 'steifer Wind', 'stürmischer Wind', 'Sturm',
    'schwerer Sturm', 'orkanartiger Sturm', 'Orkan'];
  const EN = ['calm', 'light air', 'light breeze', 'gentle breeze', 'moderate breeze',
    'fresh breeze', 'strong breeze', 'near gale', 'gale', 'strong gale',
    'storm', 'violent storm', 'hurricane'];
  const NAMEN = sprache === 'en' ? EN : DE;
  let i = 0;
  if (kn >= 1) i = 1;
  if (kn >= 4) i = 2;
  if (kn >= 7) i = 3;
  if (kn >= 11) i = 4;
  if (kn >= 17) i = 5;
  if (kn >= 22) i = 6;
  if (kn >= 28) i = 7;
  if (kn >= 34) i = 8;
  if (kn >= 41) i = 9;
  if (kn >= 48) i = 10;
  if (kn >= 56) i = 11;
  if (kn >= 64) i = 12;
  return { i, name: NAMEN[i]! };
}

export const MOTOR_FLAUTE_UNTER_KN = 8;

export const EINGESCHLAFEN_UNTER_KN = 7;

export function anzeigeKn(kn: number): number {
  return Math.round(kn);
}

export function boeenDominieren(mittelKn: number, boeKn: number): boolean {
  const bm = beaufort(anzeigeKn(mittelKn)), bg = beaufort(anzeigeKn(boeKn));
  return bg >= 5 && bg - bm >= 3;
}

export function windName(mittelKn: number, boeKn: number, sprache: Sprache = 'de'): string {

  if (boeenDominieren(mittelKn, boeKn) && beaufort(anzeigeKn(mittelKn)) <= 3) return sprache === 'en' ? 'only light mean wind' : 'wenig Grundwind';
  return windBand(anzeigeKn(mittelKn), sprache).name;
}

export function boeenTeil(mittelKn: number, boeKn: number, sprache: Sprache = 'de'): string {
  const g = anzeigeKn(boeKn);
  if (boeenDominieren(mittelKn, boeKn)) {
    return sprache === 'en'
      ? `, but gusts to ${nf(g, 0, 'en')} kn (Force ${beaufort(g)})`
      : `, aber Böen bis ${nf(g, 0)} kn (${beaufort(g)} Bft)`;
  }
  return sprache === 'en' ? `, gusting to ${nf(g, 0, 'en')} kn` : `, Böen bis ${nf(g, 0)} kn`;
}

const KOMPASS_DE = [
  'N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];
const KOMPASS_EN = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];
export function richtungsName(deg: number, sprache: Sprache = 'de'): string {
  const KOMPASS = sprache === 'en' ? KOMPASS_EN : KOMPASS_DE;
  return KOMPASS[Math.round(deg / 22.5) % 16]!;
}

function boeenfaktorSatz(b: Ablegezeit): boolean {
  return (b.gustFactor >= 1.7 && b.maxGust >= 15) || (b.gustFactor >= 1.5 && b.maxGust >= 30);
}

export function boeigRuppig(b: Ablegezeit): boolean {
  return boeenfaktorSatz(b) && beaufort(anzeigeKn(b.maxGust)) >= 5;
}

export function describeBoeenfaktor(b: Ablegezeit, sprache: Sprache = 'de'): string | null {
  if (!boeenfaktorSatz(b)) return null;
  const ruppig = boeigRuppig(b);
  if (sprache === 'en') {
    const paar = b.gustFactorWind > 0
      ? ` (at the gustiest point ${nf(b.gustFactorWind, 0, 'en')} kn mean, ${nf(b.gustFactorGust, 0, 'en')} kn gusts)` : '';
    return `The gust factor reaches ${nf(b.gustFactor, 1, 'en')}${paar}. Gusts run well above the mean wind, ${ruppig ? 'expect it to feel rough' : 'but stay below force 5'}.`;
  }
  const paar = b.gustFactorWind > 0
    ? ` (an der böigsten Stelle ${nf(b.gustFactorWind, 0)} kn Mittelwind, ${nf(b.gustFactorGust, 0)} kn Böen)` : '';

  return `Der Böenfaktor erreicht ${nf(b.gustFactor, 1)}${paar}. Die Böen fallen deutlich stärker aus als der Mittelwind, ${ruppig ? 'es wird ruppig' : 'bleiben aber unter 5 Bft'}.`;
}

export function describeWind(b: Ablegezeit, sprache: Sprache = 'de'): string {

  const wind = anzeigeKn(b.maxWind), gust = anzeigeKn(b.maxGust);
  const band = windBand(wind, sprache);
  const spread = b.minWind < 1e8 ? b.maxWind - b.minWind : 0;
  const bfSatz = describeBoeenfaktor(b, sprache);
  if (sprache === 'en') {
    let t;
    if (spread > 4) {
      t = `${band.name.charAt(0).toUpperCase() + band.name.slice(1)}, `
        + `${nf(anzeigeKn(b.minWind), 0, 'en')} to ${nf(wind, 0, 'en')} kn`;
    } else {
      t = `${band.name.charAt(0).toUpperCase() + band.name.slice(1)} around ${nf(wind, 0, 'en')} kn`;
    }
    t += `, gusting to ${nf(gust, 0, 'en')} kn (Force ${beaufort(gust)}).`;
    if (bfSatz) t += ` ${bfSatz}`;
    if (b.windTrend > 5)
      t += ` The wind freshens en route from ${nf(b.windFirst ?? 0, 0, 'en')} to ${nf(b.windLast, 0, 'en')} kn: the second half is the harder one.`;
    else if (b.windTrend < -5)
      t += b.windLast < EINGESCHLAFEN_UNTER_KN
        ? ` The wind dies en route from ${nf(b.windFirst ?? 0, 0, 'en')} to ${nf(b.windLast, 0, 'en')} kn: plan on the engine for the rest.`
        : ` The wind eases en route from ${nf(b.windFirst ?? 0, 0, 'en')} to ${nf(b.windLast, 0, 'en')} kn.`;
    return t;
  }
  let t;
  if (spread > 4) {
    t = `${band.name.charAt(0).toUpperCase() + band.name.slice(1)}, `
      + `${nf(anzeigeKn(b.minWind), 0)} bis ${nf(wind, 0)} kn`;
  } else {
    t = `${band.name.charAt(0).toUpperCase() + band.name.slice(1)} um ${nf(wind, 0)} kn`;
  }
  t += `, in Böen ${nf(gust, 0)} kn (${beaufort(gust)} Bft).`;
  if (bfSatz) t += ` ${bfSatz}`;
  if (b.windTrend > 5)
    t += ` Der Wind frischt unterwegs von ${nf(b.windFirst ?? 0, 0)} auf ${nf(b.windLast, 0)} kn auf. Die zweite Hälfte wird die anstrengendere.`;
  else if (b.windTrend < -5)
    t += b.windLast < EINGESCHLAFEN_UNTER_KN
      ? ` Der Wind schläft unterwegs von ${nf(b.windFirst ?? 0, 0)} auf ${nf(b.windLast, 0)} kn ein, für den Rest die Maschine einplanen.`
      : ` Der Wind nimmt unterwegs von ${nf(b.windFirst ?? 0, 0)} auf ${nf(b.windLast, 0)} kn ab.`;
  return t;
}
