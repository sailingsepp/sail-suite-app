import { createTidePredictor } from '@neaps/tide-predictor';
import { distNM } from './geo';
import type { GezeitenStation } from './gezeitenStationen';




export const GEZEIT_MAX_KM = 50;


export const GEZEIT_BEACHTLICH_M = 0.3;

export interface Stationstreffer { station: GezeitenStation; entfernungKm: number }


export function stationenNachEntfernung(stationen: readonly GezeitenStation[], lat: number, lon: number): Stationstreffer[] {
  return stationen
    .map((station) => ({ station, entfernungKm: distNM(lat, lon, station.lat, station.lon) * 1.852 }))
    .sort((a, b) => a.entfernungKm - b.entfernungKm);
}


export function bezugsStation(
  stationen: readonly GezeitenStation[], lat: number, lon: number, maxKm = GEZEIT_MAX_KM,
): Stationstreffer | null {
  const t = stationenNachEntfernung(stationen, lat, lon)[0];
  return t && t.entfernungKm <= maxKm ? t : null;
}

type Vorhersager = ReturnType<typeof createTidePredictor>;
const cache = new WeakMap<GezeitenStation, Map<string, Vorhersager>>();


function vorhersager(station: GezeitenStation, nur?: readonly string[]): Vorhersager {
  let je = cache.get(station);
  if (!je) { je = new Map(); cache.set(station, je); }
  const schluessel = nur ? nur.join(',') : '*';
  let p = je.get(schluessel);
  if (!p) {
    const komponenten = station.komponenten
      .filter(([name]) => !nur || nur.includes(name))
      .map(([name, amplitude, phase]) => ({ name, amplitude, phase }));
    p = createTidePredictor(komponenten);
    je.set(schluessel, p);
  }
  return p;
}

function amplitude(station: GezeitenStation, name: string): number {
  return station.komponenten.find(([n]) => n === name)?.[1] ?? 0;
}
function phase(station: GezeitenStation, name: string): number | null {
  return station.komponenten.find(([n]) => n === name)?.[2] ?? null;
}

export interface Tidenpunkt { zeit: Date; hoeheM: number }
export interface Tidenextrem { zeit: Date; hoeheM: number; art: 'HW' | 'NW' }


function versatzMs(station: GezeitenStation): number {
  return (station.versatzMin ?? 0) * 60_000;
}
const verschoben = (d: Date, ms: number) => (ms === 0 ? d : new Date(d.getTime() + ms));


export function wasserstandZu(station: GezeitenStation, zeit: Date): number {
  return vorhersager(station).getWaterLevelAtTime({ time: verschoben(zeit, -versatzMs(station)) }).level;
}


export function tidenkurve(station: GezeitenStation, von: Date, bis: Date, schrittMin = 10): Tidenpunkt[] {
  const v = versatzMs(station);
  return vorhersager(station)
    .getTimelinePrediction({ start: verschoben(von, -v), end: verschoben(bis, -v), timeFidelity: schrittMin * 60 })
    .map((p) => ({ zeit: verschoben(p.time, v), hoeheM: p.level }));
}


export function tidenextreme(station: GezeitenStation, von: Date, bis: Date): Tidenextrem[] {
  const v = versatzMs(station);
  return vorhersager(station)
    .getExtremesPrediction({ start: verschoben(von, -v), end: verschoben(bis, -v) })
    .map((e) => ({ zeit: verschoben(e.time, v), hoeheM: e.level, art: e.high ? 'HW' as const : 'NW' as const }));
}


export function groessterTidenhub(extreme: readonly Tidenextrem[]): number {
  let max = 0;
  for (let i = 1; i < extreme.length; i++) max = Math.max(max, Math.abs(extreme[i]!.hoeheM - extreme[i - 1]!.hoeheM));
  return max;
}



export type Gezeitenform = 'halbtaegig' | 'gemischt-halbtaegig' | 'gemischt-eintaegig' | 'eintaegig';


export function formzahl(station: GezeitenStation): number {
  const halb = amplitude(station, 'M2') + amplitude(station, 'S2');
  const ein = amplitude(station, 'K1') + amplitude(station, 'O1');
  return halb > 0 ? ein / halb : Infinity;
}

export function gezeitenform(f: number): Gezeitenform {
  if (f < 0.25) return 'halbtaegig';
  if (f < 1.5) return 'gemischt-halbtaegig';
  if (f < 3) return 'gemischt-eintaegig';
  return 'eintaegig';
}




export interface Gezeitenkennwerte {
  mspHW: number; mspNW: number; mnpHW: number; mnpNW: number;
  mhw: number | null; mnw: number | null; mhhw: number | null; mllw: number | null;
  hat: number; lat: number;
  formzahl: number;
  form: Gezeitenform;
  
  springHub: number;
  
  nippHub: number;
  
  springverspaetungH: number | null;
}

export function kennwerte(station: GezeitenStation): Gezeitenkennwerte {
  const m2 = amplitude(station, 'M2');
  const s2 = amplitude(station, 'S2');
  const f = formzahl(station);
  const gM2 = phase(station, 'M2');
  const gS2 = phase(station, 'S2');
  let verspaetung: number | null = null;
  if (gM2 != null && gS2 != null) {
    
    
    const d = ((gS2 - gM2 + 540) % 360) - 180;
    verspaetung = 0.984 * d;
  }
  return {
    mspHW: m2 + s2, mspNW: -(m2 + s2), mnpHW: Math.abs(m2 - s2), mnpNW: -Math.abs(m2 - s2),
    mhw: station.datum.mhw, mnw: station.datum.mlw, mhhw: station.datum.mhhw, mllw: station.datum.mllw,
    hat: station.datum.hat, lat: station.datum.lat,
    formzahl: f, form: gezeitenform(f),
    springHub: 2 * (m2 + s2), nippHub: 2 * Math.abs(m2 - s2),
    springverspaetungH: verspaetung,
  };
}



const STUNDE = 3600_000;
const HALBTAEGIG = ['M2', 'S2'] as const;
const EINTAEGIG = ['K1', 'O1'] as const;


function huelle(p: Vorhersager, t: number, viertelH: number): number {
  const a = p.getWaterLevelAtTime({ time: new Date(t) }).level;
  const b = p.getWaterLevelAtTime({ time: new Date(t + viertelH * STUNDE) }).level;
  return Math.hypot(a, b);
}

export type Tidenphase = 'springzeit' | 'nippzeit' | 'mittzeit-zunehmend' | 'mittzeit-abnehmend';

export interface SpringNippLage {
  phase: Tidenphase;
  
  anteil: number;
  
  naechsteSpring: Date | null;
  
  naechsteNipp: Date | null;
  
  letzteSpring: Date | null;
}


export function springNippLage(station: GezeitenStation, zeit: Date): SpringNippLage | null {
  return huellkurvenLage(station, zeit, HALBTAEGIG, 12.42 / 4);
}


export function deklinationsLage(station: GezeitenStation, zeit: Date): SpringNippLage | null {
  return huellkurvenLage(station, zeit, EINTAEGIG, 24.9 / 4);
}

function huellkurvenLage(
  station: GezeitenStation, zeit: Date, paar: readonly string[], viertelH: number,
): SpringNippLage | null {
  if (paar.some((n) => amplitude(station, n) === 0)) return null;
  const p = vorhersager(station, paar);
  const t0 = zeit.getTime();
  
  
  const werte: { t: number; a: number }[] = [];
  for (let h = -432; h <= 432; h++) werte.push({ t: t0 + h * STUNDE, a: huelle(p, t0 + h * STUNDE, viertelH) });
  const maxima: { t: number; a: number }[] = [];
  const minima: { t: number; a: number }[] = [];
  
  
  for (let i = 24; i < werte.length - 24; i++) {
    const a = werte[i]!.a;
    let istMax = true, istMin = true;
    for (let k = i - 24; k <= i + 24; k++) {
      if (werte[k]!.a > a) istMax = false;
      if (werte[k]!.a < a) istMin = false;
    }
    if (istMax) maxima.push(werte[i]!);
    if (istMin) minima.push(werte[i]!);
  }
  const jetzt = huelle(p, t0, viertelH);
  const spaeter = (l: typeof maxima) => l.find((w) => w.t >= t0) ?? null;
  const frueher = (l: typeof maxima) => [...l].reverse().find((w) => w.t < t0) ?? null;
  const nSpring = spaeter(maxima), vSpring = frueher(maxima);
  const nNipp = spaeter(minima), vNipp = frueher(minima);
  
  const oben = Math.max(nSpring?.a ?? -Infinity, vSpring?.a ?? -Infinity);
  const unten = Math.min(nNipp?.a ?? Infinity, vNipp?.a ?? Infinity);
  if (!Number.isFinite(oben) || !Number.isFinite(unten) || oben <= unten) return null;
  const anteil = Math.min(1, Math.max(0, (jetzt - unten) / (oben - unten)));
  
  const zunehmend = (nSpring?.t ?? Infinity) < (nNipp?.t ?? Infinity);
  const phase: Tidenphase = anteil >= 0.75 ? 'springzeit' : anteil <= 0.25 ? 'nippzeit'
    : zunehmend ? 'mittzeit-zunehmend' : 'mittzeit-abnehmend';
  return {
    phase, anteil,
    naechsteSpring: nSpring ? new Date(nSpring.t) : null,
    naechsteNipp: nNipp ? new Date(nNipp.t) : null,
    letzteSpring: vSpring ? new Date(vSpring.t) : null,
  };
}
