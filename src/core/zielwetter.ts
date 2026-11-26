import { gewitterStufe, type GewitterStufe } from './wetterkarte';
import { nf } from './time';
import { seegangsStufe } from './alternativroute';
import { MIN_STEIL_HS, steilStufe } from './polar';

export interface Stunde {

  zeit: string;
  windKn: number;

  windAus: number;

  boeenKn: number | null;

  druckHpa?: number | null;
  code: number;
  temperatur: number;
  tag: boolean;

  gefuehlt?: number | null;

  feuchte?: number | null;

  taupunkt?: number | null;

  regenMm?: number | null;

  regenWahrsch?: number | null;

  wolken?: number | null;

  sichtM?: number | null;

  cape?: number | null;

  liftedIndex?: number | null;

  uv?: number | null;

  hsM?: number | null;

  periodeS?: number | null;
  seeAus?: number | null;
  windseeM?: number | null;
  windseePeriodeS?: number | null;
  windseeAus?: number | null;
  duenungM?: number | null;
  duenungPeriodeS?: number | null;
  duenungAus?: number | null;

  wasserTemp?: number | null;
}

export interface Stundenwetter {

  offsetS: number;
  stunden: Stunde[];
}

export function ortszeit(t: number, offsetS: number): string {
  return new Date(t + offsetS * 1000).toISOString().slice(0, 16);
}

export function stundenIndex(w: Stundenwetter, t: number): number {
  const h = 3_600_000;
  const voll = Math.ceil(t / h) * h;
  const schluessel = ortszeit(voll, w.offsetS).slice(0, 13);
  return w.stunden.findIndex((s) => s.zeit.slice(0, 13) === schluessel);
}

export type WetterOrtArt = 'ziel' | 'position';

export interface WetterOrt {
  art: WetterOrtArt;
  lat: number;
  lon: number;

  name: string | null;

  ankunft: number | null;
}

export function wetterOrt(
  z: { betriebsart: 'gestoppt' | 'laeuft' | 'pausiert' | 'pausiert-anker'; abgelegt: boolean },
  ziel: { lat: number; lon: number; name: string; etz: number | null } | null,
  position: { lat: number; lon: number } | null,
): WetterOrt | null {
  const unterwegs = z.betriebsart === 'laeuft' && z.abgelegt;
  if (unterwegs && ziel) {
    return { art: 'ziel', lat: ziel.lat, lon: ziel.lon, name: ziel.name.trim().length > 1 ? ziel.name.trim() : null, ankunft: ziel.etz };
  }
  return position ? { art: 'position', lat: position.lat, lon: position.lon, name: null, ankunft: null } : null;
}

export function richtungKurz(grad: number, sprache: 'de' | 'en'): string {
  const de = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  const en = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (sprache === 'de' ? de : en)[Math.round((((grad % 360) + 360) % 360) / 45) % 8]!;
}

export interface DruckTendenz {
  hPa: number;

  aenderung: number;

  stufe: 0 | 1 | 2 | 3 | 4;
}

export function druckTendenz(w: Stundenwetter, i: number): DruckTendenz | null {
  const s = w.stunden[i];
  if (!s || s.druckHpa == null) return null;

  const vorher = new Date(Date.parse(`${s.zeit}:00Z`) - 3 * 3_600_000).toISOString().slice(0, 13);
  const v = w.stunden.find((x) => x.zeit.slice(0, 13) === vorher);
  if (!v || v.druckHpa == null) return null;
  const aenderung = Math.round((s.druckHpa - v.druckHpa) * 10) / 10;
  const b = Math.abs(aenderung);
  const stufe = b < 0.1 ? 0 : b <= 1.5 ? 1 : b <= 3.5 ? 2 : b <= 6 ? 3 : 4;
  return { hPa: s.druckHpa, aenderung, stufe };
}

export function schwuele(taupunkt: number | null | undefined): 0 | 1 | 2 | null {
  if (taupunkt == null) return null;
  const t = Math.round(taupunkt);
  return t >= 20 ? 2 : t >= 17 ? 1 : 0;
}

export interface GewitterLage {
  stufe: GewitterStufe | null;

  ab: string | null;

  capeMax: number | null;
}

export function gewitterLage(w: Stundenwetter, i: number, stunden: number): GewitterLage | null {
  const spanne = w.stunden.slice(i, i + stunden);
  if (!spanne.length) return null;
  let stufe: GewitterStufe | null = null, ab: string | null = null, capeMax: number | null = null;
  for (const s of spanne) {
    if (s.cape != null) capeMax = Math.max(capeMax ?? 0, s.cape);
    const g = gewitterStufe(s.code, s.cape ?? null, s.liftedIndex ?? null);
    if (g === 'gewitter' && stufe !== 'gewitter') { stufe = 'gewitter'; ab = s.zeit; }
    else if (g === 'neigung' && stufe === null) { stufe = 'neigung'; ab = s.zeit; }
  }
  return { stufe, ab, capeMax };
}

export function sichtAnzeige(m: number, sprache: 'de' | 'en'): { text: string; stufe: 0 | 1 | 2 | 3 } {
  if (m < 1000) return { text: `${Math.max(100, Math.floor(m / 100) * 100)} m`, stufe: 3 };
  const sm = m / 1852;

  const zehntel = Math.round(sm * 10) / 10;
  const ganz = zehntel >= 2;
  const d = ganz ? Math.round(sm) : zehntel;
  return { text: `${nf(d, ganz ? 0 : 1, sprache)} ${sprache === 'de' ? 'sm' : 'nm'}`, stufe: d > 5 ? 0 : d >= 2 ? 1 : 2 };
}

export interface SeegangAnzeige {

  hsM: number;
  stufe: number;

  steil: 0 | 1 | 2 | 3;
}

export function seegangAnzeige(s: Stunde): SeegangAnzeige | null {
  if (s.hsM == null) return null;
  const hsM = Math.round(s.hsM * 10) / 10;
  const ws = s.windseeM, tp = s.windseePeriodeS;
  let steil: 0 | 1 | 2 | 3 = 0;
  if (ws != null && tp != null && tp > 0 && ws >= MIN_STEIL_HS) steil = steilStufe(ws / ((9.81 * tp * tp) / (2 * Math.PI)));
  return { hsM, stufe: seegangsStufe(hsM), steil };
}

export const GEWITTER_BEOBACHTET_SM = 20;

export type GewitterUrteil =
  | { art: 'beobachtet'; sm: number; peilung: number; t: number }
  | { art: 'amtlich'; stufe: 2 | 3 | 4 }
  | { art: 'modell'; stufe: GewitterStufe; ab: string | null }
  | { art: 'modellKeine' };

export function gewitterUrteil(
  modell: GewitterLage | null,
  blitz: { sm: number; peilung: number; t: number } | null,
  amtlich: { stufe: 2 | 3 | 4 } | null,
): GewitterUrteil | null {
  if (blitz && blitz.sm <= GEWITTER_BEOBACHTET_SM) return { art: 'beobachtet', ...blitz };
  if (amtlich) return { art: 'amtlich', stufe: amtlich.stufe };
  if (!modell) return null;
  if (modell.stufe) return { art: 'modell', stufe: modell.stufe, ab: modell.ab };
  return { art: 'modellKeine' };
}
