import { toRad, toDeg } from './geo';
import { tageSeitJ2000, sonnenOrt, sternzeit, hoeheAusStundenwinkel } from './sun';



const SCHIEFE_DER_EKLIPTIK = 23.4397;

const AE_KM = 149598000;

export const MOND_HORIZONT = 0.125;

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

export interface MondOrt {
  
  ra: number;
  
  dec: number;
  
  distanz: number;
}


export function mondOrt(d: Date): MondOrt {
  const n = tageSeitJ2000(d);
  
  const L = toRad(norm360(218.316 + 13.176396 * n));
  const M = toRad(norm360(134.963 + 13.064993 * n));
  const F = toRad(norm360(93.272 + 13.229350 * n));

  
  
  
  const lambda = L + toRad(6.289) * Math.sin(M);
  const beta = toRad(5.128) * Math.sin(F);
  const distanz = 385001 - 20905 * Math.cos(M);

  const eps = toRad(SCHIEFE_DER_EKLIPTIK);
  const ra = Math.atan2(
    Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
    Math.cos(lambda),
  );
  const dec = Math.asin(
    Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda),
  );
  return { ra: toDeg(ra), dec: toDeg(dec), distanz };
}


export function mondhoehe(lat: number, lon: number, d: Date): number {
  const { ra, dec } = mondOrt(d);
  return hoeheAusStundenwinkel(sternzeit(d) + lon - ra, dec, lat);
}

export type Mondphasenname =
  | 'Neumond' | 'zunehmende Sichel' | 'erstes Viertel' | 'zunehmender Mond'
  | 'Vollmond' | 'abnehmender Mond' | 'letztes Viertel' | 'abnehmende Sichel';

export interface Mondphase {
  
  phase: number;
  
  beleuchtung: number;
  name: Mondphasenname;
  zunehmend: boolean;
}

function phasenName(phase: number): Mondphasenname {
  
  
  if (phase < 0.03 || phase >= 0.97) return 'Neumond';
  if (phase < 0.22) return 'zunehmende Sichel';
  if (phase < 0.28) return 'erstes Viertel';
  if (phase < 0.47) return 'zunehmender Mond';
  if (phase < 0.53) return 'Vollmond';
  if (phase < 0.72) return 'abnehmender Mond';
  if (phase < 0.78) return 'letztes Viertel';
  return 'abnehmende Sichel';
}


export function mondphase(d: Date): Mondphase {
  const s = sonnenOrt(d);
  const m = mondOrt(d);
  const raS = toRad(s.ra), decS = toRad(s.dec);
  const raM = toRad(m.ra), decM = toRad(m.dec);

  
  const elongation = Math.acos(
    Math.sin(decS) * Math.sin(decM) + Math.cos(decS) * Math.cos(decM) * Math.cos(raS - raM),
  );
  
  const phasenwinkel = Math.atan2(
    AE_KM * Math.sin(elongation),
    m.distanz - AE_KM * Math.cos(elongation),
  );
  
  const richtung = Math.atan2(
    Math.cos(decS) * Math.sin(raS - raM),
    Math.sin(decS) * Math.cos(decM) - Math.cos(decS) * Math.sin(decM) * Math.cos(raS - raM),
  );
  const phase = 0.5 + (0.5 * phasenwinkel * (richtung < 0 ? -1 : 1)) / Math.PI;
  return {
    phase,
    beleuchtung: (1 + Math.cos(phasenwinkel)) / 2,
    name: phasenName(phase),
    zunehmend: phase < 0.5,
  };
}

export interface Mondzeit {
  auf: Date | null;
  unter: Date | null;
  
  immerAuf: boolean;
  
  immerUnter: boolean;
}


export function mondzeiten(lat: number, lon: number, von: Date): Mondzeit {
  const SCHRITT_MS = 3600_000;
  const DAUER_MS = 24 * SCHRITT_MS;
  const hoehe = (t: number) => mondhoehe(lat, lon, new Date(t)) - MOND_HORIZONT;

  let auf: Date | null = null, unter: Date | null = null;
  const start = von.getTime();
  let vorher = hoehe(start);
  const startUeber = vorher > 0;
  let wechsel = false;

  for (let t = start + SCHRITT_MS; t <= start + DAUER_MS; t += SCHRITT_MS) {
    const jetzt = hoehe(t);
    if ((vorher <= 0) !== (jetzt <= 0)) {
      wechsel = true;
      
      
      let a = t - SCHRITT_MS, b = t;
      for (let k = 0; k < 30; k++) {
        const mitte = (a + b) / 2;
        if ((hoehe(a) <= 0) === (hoehe(mitte) <= 0)) a = mitte; else b = mitte;
      }
      const zeit = new Date((a + b) / 2);
      if (jetzt > 0) { if (!auf) auf = zeit; } else if (!unter) unter = zeit;
    }
    vorher = jetzt;
  }
  return { auf, unter, immerAuf: !wechsel && startUeber, immerUnter: !wechsel && !startUeber };
}


export function hellerRand(lat: number, lon: number, d: Date): number {
  const s = sonnenOrt(d), m = mondOrt(d);
  const a0 = toRad(s.ra), d0 = toRad(s.dec), a = toRad(m.ra), dm = toRad(m.dec);
  const chi = Math.atan2(
    Math.cos(d0) * Math.sin(a0 - a),
    Math.sin(d0) * Math.cos(dm) - Math.cos(d0) * Math.sin(dm) * Math.cos(a0 - a),
  );
  const h = toRad(sternzeit(d) + lon - m.ra), phi = toRad(lat);
  const q = Math.atan2(Math.sin(h), Math.tan(phi) * Math.cos(dm) - Math.sin(dm) * Math.cos(h));
  return norm360(toDeg(chi - q));
}
