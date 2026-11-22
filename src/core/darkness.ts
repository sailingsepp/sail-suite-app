import { sonnenhoehe } from './sun';
import { vonRevierzeit } from './time';
import type { Punkt } from './types';




export interface DunkelBezug {
  lat: number;
  lon: number;
  nm: number;
  time: Date;
}

export interface Dunkelphase {
  beginn: Date;
  
  ende: Date | null;
  
  beginnNM: number;
  endeNM: number | null;
  beginnOrt: Punkt;
  endeOrt: Punkt | null;
  stunden: number;
  
  vonAnfangAn: boolean;
  
  endeAmHalt?: boolean;
  
  abHalt?: boolean;
}


export interface HaltBezug {
  an: Date;
  ab: Date;
  nm: number;
}

export interface Dunkelheit {
  phasen: Dunkelphase[];
  stunden: number;
  
  nm: number;
  
  anteil: number;
}


export const NACHTFAHRT_AB_STUNDEN = 1;

function lerp(a: number, b: number, s: number): number {
  return a + (b - a) * s;
}


function zwischen(a: DunkelBezug, b: DunkelBezug, s: number): { ort: Punkt; nm: number; zeit: Date } {
  return {
    ort: { lat: lerp(a.lat, b.lat, s), lon: lerp(a.lon, b.lon, s) },
    nm: lerp(a.nm, b.nm, s),
    zeit: new Date(lerp(a.time.getTime(), b.time.getTime(), s)),
  };
}


function grenze(
  a: DunkelBezug, b: DunkelBezug, winkel: number, utcOffsetSeconds: number,
): { ort: Punkt; nm: number; zeit: Date } {
  const dunkelBei = (s: number) => {
    const z = zwischen(a, b, s);
    
    
    return sonnenhoehe(z.ort.lat, z.ort.lon, vonRevierzeit(z.zeit, utcOffsetSeconds)) < winkel;
  };
  let lo = 0, hi = 1;
  const startDunkel = dunkelBei(0);
  for (let k = 0; k < 24; k++) {
    const mitte = (lo + hi) / 2;
    if (dunkelBei(mitte) === startDunkel) lo = mitte; else hi = mitte;
  }
  return zwischen(a, b, (lo + hi) / 2);
}


export function dunkelphasen(
  roh: DunkelBezug[], winkel: number, utcOffsetSeconds = 0, halte: readonly HaltBezug[] = [],
): Dunkelheit {
  const leer: Dunkelheit = { phasen: [], stunden: 0, nm: 0, anteil: 0 };
  if (roh.length < 2) return leer;

  
  
  
  
  const track: DunkelBezug[] = [];
  const liegezeit: boolean[] = []; 
  
  
  const offeneHalte = halte.filter((x) => x.ab.getTime() > x.an.getTime());
  for (const p of roh) {
    const k = track.length ? offeneHalte.findIndex((x) => Math.abs(x.nm - p.nm) < 1e-6) : -1;
    if (k >= 0) {
      const h = offeneHalte.splice(k, 1)[0]!;
      track.push({ ...p, time: new Date(p.time.getTime() - (h.ab.getTime() - h.an.getTime())) });
      liegezeit.push(false);
    }
    track.push(p);
    liegezeit.push(k >= 0);
  }

  const dunkel = track.map((p) => sonnenhoehe(p.lat, p.lon, vonRevierzeit(p.time, utcOffsetSeconds)) < winkel);
  const phasen: Dunkelphase[] = [];
  let offen: Dunkelphase | null = null;

  if (dunkel[0]) {
    const p = track[0]!;
    offen = {
      beginn: p.time, ende: null, beginnNM: p.nm, endeNM: null,
      beginnOrt: { lat: p.lat, lon: p.lon }, endeOrt: null, stunden: 0, vonAnfangAn: true,
    };
  }

  for (let i = 1; i < track.length; i++) {
    if (liegezeit[i]) {
      
      const an = track[i - 1]!, ab = track[i]!;
      if (offen) {
        offen.ende = an.time;
        offen.endeNM = an.nm;
        offen.endeOrt = { lat: an.lat, lon: an.lon };
        offen.stunden = (an.time.getTime() - offen.beginn.getTime()) / 3600_000;
        offen.endeAmHalt = true;
        phasen.push(offen);
        offen = null;
      }
      if (dunkel[i]) {
        offen = {
          beginn: ab.time, ende: null, beginnNM: ab.nm, endeNM: null,
          beginnOrt: { lat: ab.lat, lon: ab.lon }, endeOrt: null, stunden: 0, vonAnfangAn: false, abHalt: true,
        };
      }
      continue;
    }
    if (dunkel[i] === dunkel[i - 1]) continue;
    const g = grenze(track[i - 1]!, track[i]!, winkel, utcOffsetSeconds);
    if (dunkel[i]) {
      offen = {
        beginn: g.zeit, ende: null, beginnNM: g.nm, endeNM: null,
        beginnOrt: g.ort, endeOrt: null, stunden: 0, vonAnfangAn: false,
      };
    } else if (offen) {
      offen.ende = g.zeit;
      offen.endeNM = g.nm;
      offen.endeOrt = g.ort;
      offen.stunden = (g.zeit.getTime() - offen.beginn.getTime()) / 3600_000;
      phasen.push(offen);
      offen = null;
    }
  }

  
  
  
  if (offen) {
    const letzt = track[track.length - 1]!;
    offen.stunden = (letzt.time.getTime() - offen.beginn.getTime()) / 3600_000;
    offen.endeNM = letzt.nm;
    phasen.push(offen);
  }

  const stunden = phasen.reduce((s, p) => s + p.stunden, 0);
  const nm = phasen.reduce((s, p) => s + ((p.endeNM ?? p.beginnNM) - p.beginnNM), 0);
  const gesamtNM = track[track.length - 1]!.nm - track[0]!.nm;
  return { phasen, stunden, nm, anteil: gesamtNM > 0 ? nm / gesamtNM : 0 };
}


export function istNachtfahrt(d: Dunkelheit): boolean {
  return d.stunden >= NACHTFAHRT_AB_STUNDEN;
}


export function dunkelMinuten(lat: number, lon: number, von: Date, bis: Date, winkel: number, utcOffsetSeconds: number): number {
  const schritt = 5 * 60_000;
  let n = 0;
  for (let t = von.getTime(); t < bis.getTime(); t += schritt) {
    const ende = Math.min(t + schritt, bis.getTime());
    const mitte = new Date((t + ende) / 2);
    if (sonnenhoehe(lat, lon, vonRevierzeit(mitte, utcOffsetSeconds)) < winkel) n += (ende - t) / 60_000;
  }
  return Math.round(n);
}

