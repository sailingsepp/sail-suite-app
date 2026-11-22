import type { Sprache } from '@/core/types';
import { distNM, bearingDeg } from '@/core/geo';
import { nf, kursRw } from '@/core/time';
import { beaufort, richtungsName } from './wind';
import { DRUCK_ANSTIEG_STARKWIND, DRUCK_FALL_JUGO_FALLE, DRUCK_FALL_KALTFRONT } from './synoptik';

export interface LaufbandStation {
  quelle: 'dhmz' | 'metar' | 'meteofrance' | 'esoh' | 'ispra' | 'insitu' | 'aemet';
  name: string;
  lat: number;
  lon: number;
  zeit: string;
  windKn: number | null;
  windDeg: number | null;
  boeKn: number | null;
  druckHpa: number | null;
  druckTendenzHpa: number | null;

  boje?: boolean;
  welleM?: number | null;
  wellePerS?: number | null;
}

const QUELLENNAME: Record<LaufbandStation['quelle'], string> = {
  dhmz: 'DHMZ', metar: 'NOAA AWC (METAR)', meteofrance: 'Météo-France', esoh: 'EUMETNET E-SOH (CC BY 4.0)', ispra: 'ISPRA (CC BY 4.0)', insitu: 'Copernicus Marine', aemet: '© AEMET',
};

const STILL_KN = 1;

function alter(ms: number, sprache: Sprache): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(min / 60), m = min % 60;
  const dauer = h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  return sprache === 'en' ? `${dauer} ago` : `vor ${dauer}`;
}

function wind(s: LaufbandStation, sprache: Sprache): string | null {
  if (s.windKn == null) return null;
  const en = sprache === 'en';

  const kn = Math.round(s.windKn), boe = s.boeKn == null ? null : Math.round(s.boeKn);
  if (kn < STILL_KN && (boe == null || boe < STILL_KN)) return en ? 'calm' : 'Windstille';
  const richtung = s.windDeg == null ? (en ? 'variable' : 'umlaufend') : richtungsName(s.windDeg, sprache);
  const kern = `${richtung} ${nf(kn, 0, sprache)} kn (${beaufort(kn)} Bft)`;
  return boe != null && boe > kn ? `${kern}, ${en ? 'gusts' : 'Böen'} ${nf(boe, 0, sprache)} kn` : kern;
}

function seegang(s: LaufbandStation, sprache: Sprache): string | null {
  if (s.welleM == null) return null;
  const hoehe = `${sprache === 'en' ? 'sea' : 'Seegang'} ${nf(s.welleM, 1, sprache)} m`;
  return s.wellePerS == null ? hoehe : `${hoehe}, ${nf(s.wellePerS, 0, sprache)} s`;
}

function druck(s: LaufbandStation, sprache: Sprache): string | null {
  if (s.druckHpa == null) return null;
  const hpa = `${nf(s.druckHpa, 0, sprache)} hPa`;
  if (s.druckTendenzHpa == null) return hpa;
  const t = s.druckTendenzHpa;
  return `${hpa}, ${t > 0 ? '+' : t < 0 ? '−' : '±'}${nf(Math.abs(t), 1, sprache)}/3 h`;
}

export type Stufe = 'ok' | 'gelb' | 'rot';
export const WIND_GELB_KN = 17;
export const WIND_ROT_KN = 28;
export const BOE_GELB_KN = 22;
export const BOE_ROT_KN = 34;

const hoechste = (a: Stufe, b: Stufe): Stufe => (a === 'rot' || b === 'rot' ? 'rot' : a === 'gelb' || b === 'gelb' ? 'gelb' : 'ok');

export function windStufe(s: Pick<LaufbandStation, 'windKn' | 'boeKn'>): Stufe | null {
  if (s.windKn == null) return null;
  const w: Stufe = s.windKn >= WIND_ROT_KN ? 'rot' : s.windKn >= WIND_GELB_KN ? 'gelb' : 'ok';
  const b: Stufe = s.boeKn == null ? 'ok' : s.boeKn >= BOE_ROT_KN ? 'rot' : s.boeKn >= BOE_GELB_KN ? 'gelb' : 'ok';
  return hoechste(w, b);
}

export function druckStufe(s: Pick<LaufbandStation, 'druckHpa' | 'druckTendenzHpa'>): Stufe | null {
  if (s.druckHpa == null) return null;
  const t = s.druckTendenzHpa;
  if (t == null) return 'ok';
  if (-t >= DRUCK_FALL_KALTFRONT) return 'rot';
  if (-t >= DRUCK_FALL_JUGO_FALLE || t >= DRUCK_ANSTIEG_STARKWIND) return 'gelb';
  return 'ok';
}

export interface LaufbandTeil { text: string; stufe: Stufe | null }

export function laufbandTeile(
  stationen: readonly LaufbandStation[], yacht: { lat: number; lon: number }, jetzt: number, sprache: Sprache = 'de',
): LaufbandTeil[][] {
  const sm = sprache === 'en' ? 'NM' : 'sm';
  return stationen.map((s) => {
    const d = distNM(yacht.lat, yacht.lon, s.lat, s.lon);
    const lage = d < 0.1 ? (sprache === 'en' ? 'here' : 'hier')
      : `${nf(d, d < 10 ? 1 : 0, sprache)} ${sm} ${kursRw(bearingDeg(yacht.lat, yacht.lon, s.lat, s.lon), sprache)}`;
    const w = wind(s, sprache), p = druck(s, sprache), see = seegang(s, sprache);
    const name = s.boje ? `${sprache === 'en' ? 'Buoy' : 'Boje'} ${s.name}` : s.name;
    const teile: LaufbandTeil[] = [{ text: `${name} ${lage}`, stufe: null }];
    if (w) teile.push({ text: w, stufe: windStufe(s) });
    if (see) teile.push({ text: see, stufe: null });
    if (p) teile.push({ text: p, stufe: druckStufe(s) });
    teile.push({ text: alter(jetzt - Date.parse(s.zeit), sprache), stufe: null });
    return teile;
  });
}

export function alleUnauffaellig(teile: readonly (readonly LaufbandTeil[])[]): boolean {
  const stufen = teile.flat().map((t) => t.stufe).filter((x): x is Stufe => x !== null);
  return stufen.length > 0 && stufen.every((x) => x === 'ok');
}

export function laufbandEintraege(
  stationen: readonly LaufbandStation[], yacht: { lat: number; lon: number }, jetzt: number, sprache: Sprache = 'de',
): string[] {
  return laufbandTeile(stationen, yacht, jetzt, sprache).map((t) => t.map((x) => x.text).join(' · '));
}

export function laufbandQuellen(stationen: readonly LaufbandStation[], sprache: Sprache = 'de'): string {

  const namen = [...new Set(stationen.map((s) => QUELLENNAME[s.quelle] ?? s.quelle))].join(', ');
  return sprache === 'en'
    ? `Source: ${namen}`
    : `Quelle: ${namen}`;
}
