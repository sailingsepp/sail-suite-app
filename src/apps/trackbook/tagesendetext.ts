import type { Sprache } from '@/core/types';




export function tagesabschlussText(bilanz: string, sprache: Sprache = 'de'): string {
  return sprache === 'en' ? `Day closed: ${bilanz}` : `Tagesabschluss: ${bilanz}`;
}


export function unterFahrtText(sprache: Sprache = 'de'): string {
  return sprache === 'en'
    ? 'Day boundary passed while under way: leg continues.'
    : 'Tageswechsel unter Fahrt: Etappe läuft weiter.';
}
