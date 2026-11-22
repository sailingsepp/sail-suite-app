import type { Bereitschaft, NachtVorgaben } from '@/core/bereitschaft';
import { VORGABEN_5_1 } from '@/core/bereitschaft';
import type { ErklaertePraeferenzen } from '@/core/zielfunktion';
import type { Grenzwerte } from '@/core/types';

export interface PlanungEinstellungen {

  nachtfahrtBudget?: number;
  ablegenBeiDunkelheit?: Bereitschaft;
  anlegenBeiDunkelheit?: Bereitschaft;

  reserveTage?: number;

  freieRuhetage?: number;

  maxStundenProTag?: number;
  grenzwerte?: Grenzwerte;

  regelmassSm?: number;
  langeTage?: Bereitschaft;

  hoechstensEinLangerTagAmStueck?: boolean;
  kreuzen?: Bereitschaft;
  motoren?: Bereitschaft;

  buchtenBevorzugt?: boolean;

  ankerbuchtenGleichwertig?: boolean;

  grenzuebertritt?: Bereitschaft;

  planungsart?: 'woche' | 'ueberstellung';

  ueberstellungFahrtKn?: number;

  tankReichweiteSm?: number | null;

  maxHafennaechte?: number | null;
}

export const VORGABEN: Required<PlanungEinstellungen> = {
  nachtfahrtBudget: VORGABEN_5_1.nachtfahrtBudget,
  ablegenBeiDunkelheit: VORGABEN_5_1.ablegenBeiDunkelheit,
  anlegenBeiDunkelheit: VORGABEN_5_1.anlegenBeiDunkelheit,
  reserveTage: 0,
  maxStundenProTag: 7,
  grenzwerte: { mean: 25, gust: 32, wave: 2.5 },
  regelmassSm: 30,

  langeTage: 'gern',
  kreuzen: 'gern',
  motoren: 'gern',
  buchtenBevorzugt: false,
  ankerbuchtenGleichwertig: true,
  grenzuebertritt: 'nie',
  freieRuhetage: 0,
  hoechstensEinLangerTagAmStueck: true,
  planungsart: 'woche',

  ueberstellungFahrtKn: 6,
  tankReichweiteSm: null,
  maxHafennaechte: null,
};

export const NACHTFAHRT_BUDGET_MAX = 5;

export function mitVorgaben(e: PlanungEinstellungen | null | undefined): Required<PlanungEinstellungen> {
  const g = e ?? {};
  const zahl = (wert: number | undefined, min: number, max: number, vorgabe: number): number =>
    typeof wert === 'number' && Number.isFinite(wert) && wert >= min && wert <= max ? wert : vorgabe;
  return {
    nachtfahrtBudget: zahl(g.nachtfahrtBudget, 0, NACHTFAHRT_BUDGET_MAX, VORGABEN.nachtfahrtBudget),
    ablegenBeiDunkelheit: g.ablegenBeiDunkelheit ?? VORGABEN.ablegenBeiDunkelheit,
    anlegenBeiDunkelheit: g.anlegenBeiDunkelheit ?? VORGABEN.anlegenBeiDunkelheit,
    reserveTage: zahl(g.reserveTage, 0, 7, VORGABEN.reserveTage),
    maxStundenProTag: zahl(g.maxStundenProTag, 1, 24, VORGABEN.maxStundenProTag),
    grenzwerte: g.grenzwerte ?? VORGABEN.grenzwerte,
    regelmassSm: zahl(g.regelmassSm, 1, 500, VORGABEN.regelmassSm),
    langeTage: g.langeTage ?? VORGABEN.langeTage,
    kreuzen: g.kreuzen ?? VORGABEN.kreuzen,
    motoren: g.motoren ?? VORGABEN.motoren,
    buchtenBevorzugt: g.buchtenBevorzugt ?? VORGABEN.buchtenBevorzugt,
    ankerbuchtenGleichwertig: g.ankerbuchtenGleichwertig ?? VORGABEN.ankerbuchtenGleichwertig,
    grenzuebertritt: g.grenzuebertritt ?? VORGABEN.grenzuebertritt,
    freieRuhetage: zahl(g.freieRuhetage, 0, 6, VORGABEN.freieRuhetage),
    hoechstensEinLangerTagAmStueck: g.hoechstensEinLangerTagAmStueck ?? VORGABEN.hoechstensEinLangerTagAmStueck,
    planungsart: g.planungsart === 'ueberstellung' ? 'ueberstellung' : 'woche',
    ueberstellungFahrtKn: zahl(g.ueberstellungFahrtKn, 1, 30, VORGABEN.ueberstellungFahrtKn),
    tankReichweiteSm: typeof g.tankReichweiteSm === 'number' && g.tankReichweiteSm >= 10 && g.tankReichweiteSm <= 5000 ? g.tankReichweiteSm : null,
    maxHafennaechte: typeof g.maxHafennaechte === 'number' && g.maxHafennaechte >= 0 && g.maxHafennaechte <= 60 ? Math.round(g.maxHafennaechte) : null,
  };
}

export function nachtVorgabenAus(e: Required<PlanungEinstellungen>): NachtVorgaben {
  return {
    nachtfahrtBudget: e.nachtfahrtBudget,
    ablegenBeiDunkelheit: e.ablegenBeiDunkelheit,
    anlegenBeiDunkelheit: e.anlegenBeiDunkelheit,
  };
}

export function praeferenzenAus(e: Required<PlanungEinstellungen>): ErklaertePraeferenzen {
  return {
    kreuzen: e.kreuzen, motoren: e.motoren, langeTage: e.langeTage,
    hoechstensEinLangerTagAmStueck: e.hoechstensEinLangerTagAmStueck,
  };
}

export function reserveVorschlag(eingestellt: number, revierwert: number): number | null {
  return revierwert === eingestellt ? null : revierwert;
}
