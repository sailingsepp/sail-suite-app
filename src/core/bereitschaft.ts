import type { AnkerplatzArt } from './types';

export type Bereitschaft = 'nie' | 'wenn noetig' | 'gern';

export type BereitschaftsWirkung = 'gefiltert' | 'abschlag' | 'neutral';

export function wirkung(b: Bereitschaft): BereitschaftsWirkung {
  switch (b) {
    case 'nie': return 'gefiltert';
    case 'wenn noetig': return 'abschlag';
    case 'gern': return 'neutral';
  }
}

export function istZulaessig(b: Bereitschaft): boolean {
  return wirkung(b) !== 'gefiltert';
}

export function anlegenBeiDunkelheitErlaubt(b: Bereitschaft, ankerplatzArt: AnkerplatzArt): boolean {
  if (b === 'nie') return false;
  if (b === 'gern') return true;
  return ankerplatzArt === 'marina';
}

export type Crewfunktion = 'skipper' | 'co-skipper' | 'navigator' | 'smutje' | 'deckshand' | 'pax';

export function istWachfaehig(funktion: Crewfunktion): boolean {
  return funktion !== 'pax' && funktion !== 'smutje';
}

export const WACHFAEHIGE_FUER_NACHTFAHRT = 2;

export function nachtfahrtCrewReicht(funktionen: readonly Crewfunktion[]): boolean {
  return funktionen.filter(istWachfaehig).length >= WACHFAEHIGE_FUER_NACHTFAHRT;
}

export interface NachtVorgaben {

  nachtfahrtBudget: number;

  ablegenBeiDunkelheit: Bereitschaft;

  anlegenBeiDunkelheit: Bereitschaft;
}

export const VORGABEN_5_1: NachtVorgaben = {
  nachtfahrtBudget: 0,
  ablegenBeiDunkelheit: 'wenn noetig',
  anlegenBeiDunkelheit: 'nie',
};
