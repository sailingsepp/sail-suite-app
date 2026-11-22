import { antriebsbilanz, wechselAusEintraegen } from '@/core/antriebsbilanz';
import { werteSpurAus, type Fix } from '@/core/spur';



type Punkt3 = readonly [number, number, number];
interface Eintrag { t: number; art: string; text?: string }

export interface Meilen { gesamtNM: number; motorNM: number; segelNM: number; offenNM: number }

export const KEINE_MEILEN: Meilen = { gesamtNM: 0, motorNM: 0, segelNM: 0, offenNM: 0 };


export const ANGENOMMENE_GENAUIGKEIT_M = 10;


export function meilenEinesTages(punkte: readonly Punkt3[], eintraege: readonly Eintrag[], gemeldetNM?: number | null): Meilen {
  const fixe: Fix[] = punkte.map((p) => ({ t: p[0], lat: p[1], lon: p[2], acc: ANGENOMMENE_GENAUIGKEIT_M }));
  const a = werteSpurAus(fixe);
  const b = antriebsbilanz(a.punkte, wechselAusEintraegen([...eintraege]), a.luecken);
  const summe = b.motorNM + b.segelNM + b.offenNM;
  
  const gesamt = gemeldetNM != null && gemeldetNM >= 0 ? gemeldetNM : a.streckeNM;
  const f = summe > 0 ? gesamt / summe : 0;
  return { gesamtNM: gesamt, motorNM: b.motorNM * f, segelNM: b.segelNM * f, offenNM: summe > 0 ? b.offenNM * f : gesamt };
}

export function addiere(...m: readonly Meilen[]): Meilen {
  return m.reduce((a, b) => ({
    gesamtNM: a.gesamtNM + b.gesamtNM, motorNM: a.motorNM + b.motorNM,
    segelNM: a.segelNM + b.segelNM, offenNM: a.offenNM + b.offenNM,
  }), KEINE_MEILEN);
}
