export const M_JE_SM = 1852;

export const METER_JE_TERTIE = M_JE_SM / 3600;

const BOGENMINUTEN_JE_RAD = (180 * 60) / Math.PI;

export const KIMM_FAKTOR = 2.075;

export function wegSm(kn: number, minuten: number): number {
  return (kn * minuten) / 60;
}

export function hoehenwinkelGenau(hoeheM: number, alphaMinuten: number): number {
  return hoeheM / Math.tan(alphaMinuten / BOGENMINUTEN_JE_RAD) / M_JE_SM;
}

export function hoehenwinkelFaust(hoeheM: number, alphaMinuten: number): number {
  return (13 * hoeheM) / (7 * alphaMinuten);
}

export function relingslogge(streckeM: number, sekunden: number): number {
  return streckeM / (METER_JE_TERTIE * sekunden);
}

export function rumpfgeschwindigkeit(lwlFt: number): number {
  return 1.34 * Math.sqrt(lwlFt);
}

export function kimmabstand(augeM: number): number {
  return KIMM_FAKTOR * Math.sqrt(augeM);
}

export function feuerInDerKimm(feuerM: number, augeM: number): number {
  return KIMM_FAKTOR * (Math.sqrt(feuerM) + Math.sqrt(augeM));
}

export function normGrad(g: number): number {
  const r = ((g % 360) + 360) % 360;
  return r === 360 ? 0 : r;
}

export function kursRueck(rwK: number, mw: number, abl: number): { mwK: number; mgK: number } {
  const mwK = normGrad(rwK - mw);
  return { mwK, mgK: normGrad(mwK - abl) };
}

export function kursVor(mgK: number, abl: number, mw: number): { mwK: number; rwK: number } {
  const mwK = normGrad(mgK + abl);
  return { mwK, rwK: normGrad(mwK + mw) };
}

export function knotenUmrechnen(kn: number): { kmh: number; ms: number } {
  return { kmh: (kn * M_JE_SM) / 1000, ms: (kn * M_JE_SM) / 3600 };
}

export const ZWOELFTEL = [1, 2, 3, 3, 2, 1] as const;

export function zwoelftel(tidenhubM: number, stunden: number): { zwoelftel: number; meter: number } | null {
  const s = Math.round(stunden);
  if (!(s >= 0 && s <= 6) || !(tidenhubM >= 0)) return null;
  const z = ZWOELFTEL.slice(0, s).reduce((a, b) => a + b, 0);
  return { zwoelftel: z, meter: (tidenhubM * z) / 12 };
}

export const SICHERE_SEKTOREN = {
  N: { von: 315, bis: 45 },
  E: { von: 45, bis: 135 },
  S: { von: 135, bis: 225 },
  W: { von: 225, bis: 315 },
} as const;
export type Kardinal = keyof typeof SICHERE_SEKTOREN;

export function imSektor(kurs: number, sektor: { von: number; bis: number }): boolean {
  const k = normGrad(kurs);
  const breite = normGrad(sektor.bis - sektor.von);
  return normGrad(k - sektor.von) <= breite;
}

export function leseZahl(text: string): number {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}
