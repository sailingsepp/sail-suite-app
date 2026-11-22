import { createTidePredictor } from '@neaps/tide-predictor';
import type { Punkt } from './types';


export const MESSINA_ENGE: Punkt = { lat: 38.25, lon: 15.635 };
export const GEGENSTROM_MAX_KN = 1;


export interface MessinaEinfahrt { de: string; en: string; kurzDe: string; kurzEn: string; a: Punkt; b: Punkt }
export const MESSINA_EINFAHRT: { sued: MessinaEinfahrt; nord: MessinaEinfahrt } = {
  sued: {
    de: 'Südeinfahrt (Südgrenze des Verkehrstrennungsgebiets, 38°08,9′ N)',
    en: 'southern entrance (southern limit of the traffic separation scheme, 38°08.9′ N)',
    kurzDe: 'Südeinfahrt', kurzEn: 'southern entrance',
    a: { lat: 38 + 8.94 / 60, lon: 15.50 }, b: { lat: 38 + 8.94 / 60, lon: 15.70 },
  },
  nord: {
    de: 'Nordeinfahrt (Linie von Capo Peloro nach Torre Cavallo)',
    en: 'northern entrance (line from Capo Peloro to Torre Cavallo)',
    kurzDe: 'Nordeinfahrt', kurzEn: 'northern entrance',
    a: { lat: 38.26785, lon: 15.65308 }, b: { lat: 38.24665, lon: 15.68023 },
  },
};


function xy(p: Punkt): [number, number] {
  return [(p.lon - MESSINA_ENGE.lon) * 60 * Math.cos((MESSINA_ENGE.lat * Math.PI) / 180), (p.lat - MESSINA_ENGE.lat) * 60];
}


export function abstandZurEinfahrt(p: Punkt, e: MessinaEinfahrt): number {
  const [px, py] = xy(p), [ax, ay] = xy(e.a), [bx, by] = xy(e.b);
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}


export function vorDerEinfahrt(p: Punkt, e: MessinaEinfahrt): boolean {
  const [ax, ay] = xy(e.a), [bx, by] = xy(e.b), [px, py] = xy(p);
  const seite = (x: number, y: number) => Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
  return seite(px, py) !== 0 && seite(px, py) !== seite(0, 0);
}


export function kreuztEinfahrt(p: Punkt, q: Punkt, e: MessinaEinfahrt): number | null {
  const [px, py] = xy(p), [qx, qy] = xy(q), [ax, ay] = xy(e.a), [bx, by] = xy(e.b);
  const rx = qx - px, ry = qy - py, sx = bx - ax, sy = by - ay;
  const nenner = rx * sy - ry * sx;
  if (Math.abs(nenner) < 1e-12) return null;
  const t = ((ax - px) * sy - (ay - py) * sx) / nenner;
  const u = ((ax - px) * ry - (ay - py) * rx) / nenner;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}


export function einfahrtBisEnge(e: MessinaEinfahrt): number {
  const [ax, ay] = xy(e.a), [bx, by] = xy(e.b);
  return Math.max(0.5, Math.hypot((ax + bx) / 2, (ay + by) / 2));
}
const H = 3_600_000;
const SCHRITT_MS = 10 * 60_000;

const SUCHE_MS = 30 * H;


export const MESSINA_MITTEL_KN = -0.7;

export const MESSINA_KOMPONENTEN: readonly [string, number, number][] = [
  ['M2', 3.1983, 100.1], ['S2', 0.9018, 116.8], ['N2', 0.4997, 93.6], ['K2', 0.3001, 117],
  ['K1', 0.8004, 58], ['O1', 0.3974, 41.9], ['P1', 0.2978, 58.4], ['M4', 0.2988, 16.2],
];


export interface MessinaStelle {
  name: string;
  
  ort?: Punkt;
  
  achse?: number;
  mittel: number;
  komponenten: readonly [string, number, number][];
}


export const MESSINA_GANZIRRI: MessinaStelle = { name: 'Ganzirri', mittel: -0.17, komponenten: [['M2', 2.5986, 100.1], ['S2', 0.7011, 116.9], ['K1', 0.7004, 58], ['N2', 0.3997, 93.6], ['O1', 0.2981, 41.9], ['K2', 0.2000, 117], ['M4', 0.1993, 16.2], ['P1', 0.1981, 58.6]] };


export const MESSINA_ZONEN: readonly MessinaStelle[] = [
  { name: 'Zona 1', ort: { lat: 38.2656, lon: 15.6802 }, achse: 30, mittel: -0.405, komponenten: [['M2', 0.4797, 114.6], ['S2', 0.1352, 131.8], ['K1', 0.1201, 65.5], ['N2', 0.0750, 107.8], ['O1', 0.0596, 48.9], ['K2', 0.0450, 132], ['M4', 0.0448, 45.2], ['P1', 0.0446, 65.8]] },
  { name: 'Zona 2', ort: { lat: 38.2585, lon: 15.6637 }, achse: 41, mittel: -0.8, komponenten: [['M2', 0.9595, 107.3], ['S2', 0.2705, 124.4], ['K1', 0.2401, 61.7], ['N2', 0.1499, 100.8], ['O1', 0.1192, 45.4], ['K2', 0.0900, 124.5], ['M4', 0.0897, 30.8], ['P1', 0.0893, 62.2]] },
  { name: 'Zona 3', ort: { lat: 38.242, lon: 15.6212 }, achse: 58, mittel: 0, komponenten: [['M2', 2.8784, 100.1], ['S2', 0.8116, 116.8], ['K1', 0.7204, 58], ['N2', 0.4497, 93.7], ['O1', 0.3577, 42], ['K2', 0.2701, 117], ['M4', 0.2690, 16.3], ['P1', 0.2680, 58.4]] },
  { name: 'Zona 4', ort: { lat: 38.25, lon: 15.6039 }, achse: 67, mittel: 0.005, komponenten: [['M2', 2.0789, 92.8], ['S2', 0.5861, 109.3], ['K1', 0.5203, 54.2], ['N2', 0.3248, 86.5], ['O1', 0.2583, 38.5], ['K2', 0.1950, 109.4], ['M4', 0.1943, 1.8], ['P1', 0.1936, 54.7]] },
  { name: 'Zona 5', ort: { lat: 38.2372, lon: 15.5851 }, achse: 36, mittel: 0.4, komponenten: [['M2', 1.5991, 56.6], ['S2', 0.4509, 71.8], ['K1', 0.4002, 35.4], ['N2', 0.2499, 51], ['O1', 0.1987, 21], ['K2', 0.1501, 71.8], ['M4', 0.1494, 289.3], ['P1', 0.1489, 36]] },
  { name: 'Zona 6', ort: { lat: 38.2445, lon: 15.6735 }, achse: 58, mittel: -0.8, komponenten: [['M2', 0.9595, 107.3], ['S2', 0.2705, 124.4], ['K1', 0.2401, 61.7], ['N2', 0.1499, 100.8], ['O1', 0.1192, 45.4], ['K2', 0.0900, 124.5], ['M4', 0.0897, 30.8], ['P1', 0.0893, 62.2]] },
  { name: 'Zona 7', ort: { lat: 38.2504, lon: 15.674 }, achse: 59, mittel: -0.6, komponenten: [['M2', 1.5991, 107.3], ['S2', 0.4508, 124.3], ['K1', 0.4002, 61.7], ['N2', 0.2498, 100.8], ['O1', 0.1987, 45.4], ['K2', 0.1501, 124.5], ['M4', 0.1494, 30.7], ['P1', 0.1489, 62.2]] },
  { name: 'Zona 8', ort: { lat: 38.2572, lon: 15.708 }, achse: 83, mittel: -0.005, komponenten: [['M2', 0.4797, 121.8], ['S2', 0.1353, 139.3], ['K1', 0.1200, 69.2], ['N2', 0.0749, 114.9], ['O1', 0.0596, 52.4], ['K2', 0.0450, 139.5], ['M4', 0.0448, 59.7], ['P1', 0.0447, 69.6]] },
  { name: 'Zona 9', ort: { lat: 38.2583, lon: 15.6277 }, achse: 68, mittel: 0.4, komponenten: [['M2', 2.2387, 104.9], ['S2', 0.6312, 121.8], ['K1', 0.5603, 60.5], ['N2', 0.3498, 98.4], ['O1', 0.2782, 44.3], ['K2', 0.2101, 122], ['M4', 0.2092, 25.9], ['P1', 0.2085, 60.9]] },
  { name: 'Zona 10', ort: { lat: 38.2742, lon: 15.656 }, achse: 287, mittel: -1, komponenten: [['M2', 1.5991, 114.6], ['S2', 0.4509, 131.8], ['K1', 0.4002, 65.5], ['N2', 0.2499, 107.9], ['O1', 0.1987, 48.9], ['K2', 0.1501, 132], ['M4', 0.1494, 45.2], ['P1', 0.1489, 65.9]] },
];

export type MessinaStromArt = 'montante' | 'scendente';

export interface MessinaStrom {
  art: MessinaStromArt;
  
  kn: number;
}

let praediktor: ReturnType<typeof createTidePredictor> | null = null;
function kurve(): ReturnType<typeof createTidePredictor> {
  praediktor ??= createTidePredictor(MESSINA_KOMPONENTEN.map(([name, amplitude, phase]) => ({ name, amplitude, phase })));
  return praediktor;
}

const praediktoren = new Map<MessinaStelle, ReturnType<typeof createTidePredictor>>();
const stellenTage = new Map<MessinaStelle, Map<number, Float64Array>>();
const TAG_MS = 24 * H;


export function messinaStelleKn(stelle: MessinaStelle, t: number): number {
  let tage = stellenTage.get(stelle);
  if (!tage) { tage = new Map(); stellenTage.set(stelle, tage); }
  const tag = Math.floor(t / TAG_MS);
  let reihe = tage.get(tag);
  if (!reihe) {
    let p = praediktoren.get(stelle);
    if (!p) {
      p = createTidePredictor(stelle.komponenten.map(([name, amplitude, phase]) => ({ name, amplitude, phase })));
      praediktoren.set(stelle, p);
    }
    const punkte = p.getTimelinePrediction({ start: new Date(tag * TAG_MS), end: new Date((tag + 1) * TAG_MS), timeFidelity: SCHRITT_MS / 1000 });
    reihe = Float64Array.from(punkte, (x) => stelle.mittel + x.level);
    if (tage.size > 60) tage.clear();
    tage.set(tag, reihe);
  }
  const x = (t - tag * TAG_MS) / SCHRITT_MS, i = Math.min(Math.floor(x), reihe.length - 2);
  return reihe[i]! + (reihe[i + 1]! - reihe[i]!) * (x - i);
}


export function messinaStromKn(t: number): number {
  return MESSINA_MITTEL_KN + kurve().getWaterLevelAtTime({ time: new Date(t) }).level;
}


export function messinaStrom(t: number): MessinaStrom {
  const u = messinaStromKn(t);
  return { art: u >= 0 ? 'montante' : 'scendente', kn: Math.abs(u) };
}


function reihe(von: number, bis: number): { start: number; u: number[] } {
  const start = Math.floor(von / SCHRITT_MS) * SCHRITT_MS;
  const punkte = kurve().getTimelinePrediction({ start: new Date(start), end: new Date(bis + SCHRITT_MS), timeFidelity: SCHRITT_MS / 1000 });
  return { start, u: punkte.map((p) => MESSINA_MITTEL_KN + p.level) };
}

interface Phase { art: MessinaStromArt; beginn: number; ende: number }


export function messinaPhasen(von: number, bis: number): Phase[] {
  const { start, u } = reihe(von - 30 * H, bis + 30 * H);
  const wechsel: { t: number; art: MessinaStromArt }[] = [];
  for (let i = 1; i < u.length; i++) {
    const a = u[i - 1]!, b = u[i]!;
    if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) {
      const f = a / (a - b);
      wechsel.push({ t: start + (i - 1 + f) * SCHRITT_MS, art: b >= 0 ? 'montante' : 'scendente' });
    }
  }
  const phasen: Phase[] = [];
  for (let i = 0; i + 1 < wechsel.length; i++) {
    const p = { art: wechsel[i]!.art, beginn: wechsel[i]!.t, ende: wechsel[i + 1]!.t };
    if (p.ende >= von && p.beginn <= bis) phasen.push(p);
  }
  return phasen;
}


export function messinaFenster(von: number, bis: number, nachNorden: boolean): { beginn: number; ende: number }[] {
  const { start, u } = reihe(von - 30 * H, bis + 30 * H);
  const gut = (x: number) => (nachNorden ? x >= -GEGENSTROM_MAX_KN : x <= GEGENSTROM_MAX_KN);
  const fenster: { beginn: number; ende: number }[] = [];
  let beginn: number | null = null;
  for (let i = 0; i < u.length; i++) {
    const t = start + i * SCHRITT_MS;
    if (gut(u[i]!)) { if (beginn === null) beginn = t; }
    else if (beginn !== null) { fenster.push({ beginn, ende: t }); beginn = null; }
  }
  
  return fenster.filter((f) => f.beginn > start && f.ende >= von && f.beginn <= bis);
}


export function einfahrtFenster(
  e: MessinaEinfahrt, nachNorden: boolean, tUtc: number, vKn: number, spanneMs = SUCHE_MS,
): { von: number; bis: number }[] {
  const laufMs = (einfahrtBisEnge(e) / Math.max(vKn, LANGSAM_MIN_KN)) * H;
  return messinaFenster(tUtc + laufMs, tUtc + laufMs + spanneMs, nachNorden)
    .map((f) => ({ von: f.beginn - laufMs, bis: f.ende - laufMs }))
    .filter((f) => f.bis > tUtc);
}


export function einfahrtImFenster(e: MessinaEinfahrt, nachNorden: boolean, tUtc: number, vKn: number): boolean {
  const u = messinaStromKn(tUtc + (einfahrtBisEnge(e) / Math.max(vKn, LANGSAM_MIN_KN)) * H);
  return nachNorden ? u >= -GEGENSTROM_MAX_KN : u <= GEGENSTROM_MAX_KN;
}

type MitEinfahrt = { departure: Date; messinaEinfahrt?: { imFenster: boolean; zeit: Date; nachNorden: boolean; vKn: number } };


export function zeitInDerEnge(e: { zeit: Date; nachNorden: boolean; vKn: number }): number {
  const einfahrt = e.nachNorden ? MESSINA_EINFAHRT.sued : MESSINA_EINFAHRT.nord;
  return naivNachUtc(e.zeit.getTime()) + (einfahrtBisEnge(einfahrt) / Math.max(e.vKn, LANGSAM_MIN_KN)) * H;
}


export function zumMaximum(e: { zeit: Date; nachNorden: boolean; vKn: number }): boolean {
  const t = zeitInDerEnge(e);
  const v = messinaStromverlauf(t, e.nachNorden);
  return !!v && t >= v.maxVon && t <= v.maxBis;
}


export function messinaAblegezeit<T extends MitEinfahrt>(ergebnisse: readonly T[], unfahrbar: (r: T) => boolean): T | null {
  let beste: T | null = null;
  for (const r of ergebnisse) {
    if (!r.messinaEinfahrt?.imFenster || unfahrbar(r) || !zumMaximum(r.messinaEinfahrt)) continue;
    if (!beste || r.departure < beste.departure) beste = r;
  }
  return beste ?? messinaFruehesteAblegezeit(ergebnisse, unfahrbar);
}


export function messinaFruehesteAblegezeit<T extends MitEinfahrt>(ergebnisse: readonly T[], unfahrbar: (r: T) => boolean): T | null {
  let beste: T | null = null;
  for (const r of ergebnisse) {
    if (!r.messinaEinfahrt?.imFenster || unfahrbar(r)) continue;
    if (!beste || r.departure < beste.departure) beste = r;
  }
  return beste;
}

export interface MessinaDurchfahrt {
  
  zeit: number;
  wartenMs: number;
  strom: MessinaStrom;
}


export function messinaPlaner(von: number, bis: number): (ankunft: number, nachNorden: boolean) => MessinaDurchfahrt | null {
  const { start, u } = reihe(von, bis + SUCHE_MS);
  const bei = (t: number): number | null => {
    const x = (t - start) / SCHRITT_MS, i = Math.floor(x);
    if (i < 0 || i + 1 >= u.length) return null;
    return u[i]! + (u[i + 1]! - u[i]!) * (x - i);
  };
  return (ankunft, nachNorden) => {
    for (let t = ankunft; t <= ankunft + SUCHE_MS; t += SCHRITT_MS) {
      const v = bei(t);
      if (v == null) return null;
      if (nachNorden ? v >= -GEGENSTROM_MAX_KN : v <= GEGENSTROM_MAX_KN) {
        return { zeit: t, wartenMs: t - ankunft, strom: { art: v >= 0 ? 'montante' : 'scendente', kn: Math.abs(v) } };
      }
    }
    return null;
  };
}


export function messinaDurchfahrt(ankunft: number, nachNorden: boolean): MessinaDurchfahrt | null {
  return messinaPlaner(ankunft, ankunft)(ankunft, nachNorden);
}


const formatierer = new Map<string, Intl.DateTimeFormat>();
function formatiererFuer(zone: string): Intl.DateTimeFormat {
  let f = formatierer.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatierer.set(zone, f);
  }
  return f;
}


export function zonenVersatzMs(zone: string, utc: number): number {
  const teile = formatiererFuer(zone).formatToParts(new Date(utc));
  const w = (typ: string) => Number(teile.find((x) => x.type === typ)!.value);
  return Date.UTC(w('year'), w('month') - 1, w('day'), w('hour'), w('minute'), w('second')) - Math.floor(utc / 1000) * 1000;
}


export function naivNachUtc(naiv: number, zone = 'Europe/Rome'): number {
  const erst = naiv - zonenVersatzMs(zone, naiv);
  return naiv - zonenVersatzMs(zone, erst);
}


export const LANGSAM_MIN_KN = 2.5;


export function langsameFahrt(vorlaufSm: number, fahrtKn: number, wartenMs: number): number | null {
  if (wartenMs <= 0 || vorlaufSm <= 0 || fahrtKn <= 0) return null;
  const v = vorlaufSm / (vorlaufSm / fahrtKn + wartenMs / H);
  return v >= LANGSAM_MIN_KN ? v : null;
}


export const MESSINA_VOLL_SM = 3;
export const MESSINA_AUSLAUF_SM = 8;

const ZONE_NAH_KM = 0.3;


export function messinaStromAnPunkt(
  lat: number, lon: number, naivZeit: Date,
): { gewicht: number; speed: number; dir: number } | null {
  
  
  if (abstandZurEngeSm(lat, lon) >= MESSINA_AUSLAUF_SM) return null;
  return messinaStromAnPunktUtc(lat, lon, naivNachUtc(naivZeit.getTime()));
}


function abstandZurEngeSm(lat: number, lon: number): number {
  const kmLat = 111.32, kmLon = 111.32 * Math.cos((MESSINA_ENGE.lat * Math.PI) / 180);
  return Math.hypot((lat - MESSINA_ENGE.lat) * kmLat, (lon - MESSINA_ENGE.lon) * kmLon) / 1.852;
}


export function messinaStromAnPunktUtc(
  lat: number, lon: number, t: number,
): { gewicht: number; speed: number; dir: number } | null {
  const kmLat = 111.32, kmLon = 111.32 * Math.cos((MESSINA_ENGE.lat * Math.PI) / 180);
  const sm = abstandZurEngeSm(lat, lon);
  if (sm >= MESSINA_AUSLAUF_SM) return null;
  const gewicht = sm <= MESSINA_VOLL_SM ? 1 : (MESSINA_AUSLAUF_SM - sm) / (MESSINA_AUSLAUF_SM - MESSINA_VOLL_SM);
  let e = 0, n = 0, summe = 0;
  for (const z of MESSINA_ZONEN) {
    const km = Math.max(ZONE_NAH_KM, Math.hypot((lat - z.ort!.lat) * kmLat, (lon - z.ort!.lon) * kmLon));
    const w = 1 / (km * km), u = messinaStelleKn(z, t), r = (z.achse! * Math.PI) / 180;
    e += w * u * Math.sin(r); n += w * u * Math.cos(r); summe += w;
  }
  e /= summe; n /= summe;
  return { gewicht, speed: Math.hypot(e, n), dir: ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360 };
}


export function mischeMessina(
  grund: { speed: number; dir: number; valid: boolean }, m: { gewicht: number; speed: number; dir: number },
): { speed: number; dir: number; valid: true } {
  const vek = (speed: number, dir: number, w: number) => {
    const r = (dir * Math.PI) / 180;
    return [speed * w * Math.sin(r), speed * w * Math.cos(r)] as const;
  };
  const [ue, un] = vek(m.speed, m.dir, m.gewicht);
  const [ge, gn] = grund.valid ? vek(grund.speed, grund.dir, 1 - m.gewicht) : [0, 0];
  const e = ue + ge, n = un + gn;
  return { speed: Math.hypot(e, n), dir: ((Math.atan2(e, n) * 180) / Math.PI + 360) % 360, valid: true };
}


export function messinaZonenStrom(t: number): { name: string; ort: Punkt; kn: number; nach: number }[] {
  return MESSINA_ZONEN.map((z) => {
    const u = messinaStelleKn(z, t);
    return { name: z.name, ort: z.ort!, kn: Math.abs(u), nach: u >= 0 ? z.achse! : (z.achse! + 180) % 360 };
  });
}


export interface StromGitter {
  lat0: number; lon0: number; dLat: number; dLon: number; zeilen: number; spalten: number;
  u: Float32Array; v: Float32Array;
}
export function messinaStromGitter(
  t: number, radiusSm: number, schrittGrad: number,
  modell: ((lat: number, lon: number) => { speed: number; dir: number } | null) | null,
  wasser: (lat: number, lon: number) => boolean,
): StromGitter {
  const rLat = radiusSm / 60, cos = Math.cos((MESSINA_ENGE.lat * Math.PI) / 180);
  const rLon = rLat / cos, dLat = schrittGrad, dLon = schrittGrad / cos;
  const zeilen = Math.round((2 * rLat) / dLat) + 1, spalten = Math.round((2 * rLon) / dLon) + 1;
  const lat0 = MESSINA_ENGE.lat - rLat, lon0 = MESSINA_ENGE.lon - rLon;
  const u = new Float32Array(zeilen * spalten).fill(Number.NaN), v = new Float32Array(zeilen * spalten).fill(Number.NaN);
  for (let i = 0; i < zeilen; i++) {
    const lat = lat0 + i * dLat;
    for (let j = 0; j < spalten; j++) {
      const lon = lon0 + j * dLon;
      if (!wasser(lat, lon)) continue;
      const grund = modell ? modell(lat, lon) : null;
      const m = messinaStromAnPunktUtc(lat, lon, t);
      const s = m ? mischeMessina(grund ? { ...grund, valid: true } : { speed: 0, dir: 0, valid: false }, m) : grund;
      if (!s) continue;
      const r = (s.dir * Math.PI) / 180;
      u[i * spalten + j] = s.speed * Math.sin(r);
      v[i * spalten + j] = s.speed * Math.cos(r);
    }
  }
  return { lat0, lon0, dLat, dLon, zeilen, spalten, u, v };
}


export function stromImGitter(g: StromGitter, lat: number, lon: number): { u: number; v: number } | null {
  const y = (lat - g.lat0) / g.dLat, x = (lon - g.lon0) / g.dLon;
  if (!(y >= 0 && x >= 0 && y <= g.zeilen - 1 && x <= g.spalten - 1)) return null;
  const i = Math.min(Math.floor(y), g.zeilen - 2), j = Math.min(Math.floor(x), g.spalten - 2);
  const fy = y - i, fx = x - j;
  let su = 0, sv = 0, sw = 0;
  for (const [di, dj, w] of [[0, 0, (1 - fy) * (1 - fx)], [0, 1, (1 - fy) * fx], [1, 0, fy * (1 - fx)], [1, 1, fy * fx]] as const) {
    const k = (i + di) * g.spalten + j + dj, a = g.u[k]!, b = g.v[k]!;
    if (Number.isNaN(a) || Number.isNaN(b) || w <= 0) continue;
    su += a * w; sv += b * w; sw += w;
  }
  return sw > 0 ? { u: su / sw, v: sv / sw } : null;
}


export const STAU_KN = 0.5;
export const ZUNAHME_ANTEIL = 0.8;
export const MAX_ANTEIL = 0.95;
export interface MessinaStromverlauf {
  art: MessinaStromArt;
  kenter: number; stauVon: number; stauBis: number;
  zunahmeBis: number; maxVon: number; maxBis: number; maxKn: number;
  
  stauEndeVon: number;
  ende: number;
}
export function messinaStromverlauf(t: number, nachNorden: boolean): MessinaStromverlauf | null {
  const { start, u } = reihe(t - 16 * H, t + 30 * H);
  const s = nachNorden ? 1 : -1;
  const zeit = (i: number) => start + i * SCHRITT_MS;
  
  const kreuz = (i: number, x: number) => {
    const a = s * u[i - 1]!, b = s * u[i]!;
    return zeit(i - 1) + (b === a ? 0 : ((x - a) / (b - a)) * SCHRITT_MS);
  };
  
  const phasen: { a: number; e: number }[] = [];
  let a: number | null = null;
  for (let i = 1; i < u.length; i++) {
    const p = s * u[i - 1]!, q = s * u[i]!;
    if (p < 0 && q >= 0) a = i;
    else if (p >= 0 && q < 0 && a !== null) { phasen.push({ a, e: i }); a = null; }
  }
  const ph = phasen.find((x) => kreuz(x.e, 0) > t);
  if (!ph) return null;
  let maxI = ph.a;
  for (let i = ph.a; i < ph.e; i++) if (s * u[i]! > s * u[maxI]!) maxI = i;
  const maxKn = s * u[maxI]!;
  if (maxKn <= 0) return null;
  const kenter = kreuz(ph.a, 0);
  
  let i0 = ph.a - 1;
  while (i0 > 0 && s * u[i0 - 1]! >= -STAU_KN) i0--;
  const stauVon = i0 > 0 ? kreuz(i0, -STAU_KN) : zeit(0);
  let i1 = ph.a;
  while (i1 < maxI && s * u[i1]! < Math.min(STAU_KN, maxKn)) i1++;
  const stauBis = i1 > ph.a || s * u[ph.a]! >= STAU_KN ? kreuz(Math.max(i1, ph.a), Math.min(STAU_KN, maxKn)) : kenter;
  let iz = ph.a;
  while (iz < maxI && s * u[iz]! < ZUNAHME_ANTEIL * maxKn) iz++;
  const zunahmeBis = iz > ph.a ? kreuz(iz, ZUNAHME_ANTEIL * maxKn) : zeit(iz);
  let m0 = maxI, m1 = maxI;
  while (m0 > ph.a && s * u[m0 - 1]! >= MAX_ANTEIL * maxKn) m0--;
  while (m1 < ph.e - 1 && s * u[m1 + 1]! >= MAX_ANTEIL * maxKn) m1++;
  const maxVon = m0 > ph.a ? kreuz(m0, MAX_ANTEIL * maxKn) : zeit(m0);
  
  const b0 = s * u[m1]!, b1 = s * u[m1 + 1]!;
  const maxBis = zeit(m1) + (b1 === b0 ? 0 : ((MAX_ANTEIL * maxKn - b0) / (b1 - b0)) * SCHRITT_MS);
  let i2 = ph.e - 1;
  while (i2 > m1 && s * u[i2]! < Math.min(STAU_KN, maxKn)) i2--;
  const c0 = s * u[i2]!, c1 = s * u[i2 + 1]!, x = Math.min(STAU_KN, maxKn);
  const stauEndeVon = zeit(i2) + (c1 === c0 ? 0 : ((x - c0) / (c1 - c0)) * SCHRITT_MS);
  
  
  const stauEnde = Math.min(stauBis, maxVon);
  return {
    art: nachNorden ? 'montante' : 'scendente', kenter, stauVon, stauBis: stauEnde,
    zunahmeBis: Math.max(zunahmeBis, stauEnde), maxVon, maxBis: Math.max(maxVon, maxBis), maxKn, stauEndeVon, ende: kreuz(ph.e, 0),
  };
}
