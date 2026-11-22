

export const FENSTER = 32768;

export const SPEKTRUM_BIS_HZ = 4000;
const GRUND_HALBBREITE_HZ = 12;
const F0_MIN = 8;
const F0_MAX = 120;
const F0_SCHRITT = 0.1;
const KAMM_BIS_HZ = 1000;
const KAMM_MAX_K = 10;
const KAMM_MIN_K = 3;


export const OBERTON_K = 6;
export const OBERTON_DB = 6;
export const OBERTON_MIN = 3;


export interface Spektrum {
  df: number;
  db: Float32Array;
}

export interface Baender {
  
  b10_60: number;
  b60_200: number;
  b200_1000: number;
  b1000_4000: number;
}

export interface Kamm {
  
  f0: number;
  
  h: number;
  
  k: number;
  
  treffer: number;
}

export interface Merkmale {
  fs: number;
  dauerS: number;
  
  pegel: number;
  baender: Baender;
  kamm: Kamm;
  
  abschnitte: Kamm[];
  
  f0Streuung: number;
  
  linie: { f: number; h: number };
}


function zweierPotenz(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}


export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]!; re[i] = re[j]!; re[j] = t;
      t = im[i]!; im[i] = im[j]!; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const w = -2 * Math.PI / len;
    const wr = Math.cos(w), wi = Math.sin(w);
    const halb = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < halb; k++) {
        const a = i + k, b = a + halb;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr; im[b] = im[a]! - xi;
        re[a] = re[a]! + xr; im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}


export function welch(x: ArrayLike<number>, fs: number, n = FENSTER, bisHz = SPEKTRUM_BIS_HZ): Spektrum {
  const N = zweierPotenz(n);
  const df = fs / N;
  const bins = Math.min(N / 2, Math.floor(bisHz / df) + 1);
  const hann = new Float64Array(N);
  let wSumme = 0;
  for (let i = 0; i < N; i++) { hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); wSumme += hann[i]! ** 2; }
  const summe = new Float64Array(bins);
  const re = new Float64Array(N), im = new Float64Array(N);
  const schritt = N / 2;
  let anzahl = 0;
  for (let start = 0; start === 0 || start + N <= x.length; start += schritt) {
    let mittel = 0;
    const ende = Math.min(N, x.length - start);
    for (let i = 0; i < ende; i++) mittel += x[start + i]!;
    mittel /= Math.max(1, ende);
    for (let i = 0; i < N; i++) {
      re[i] = i < ende ? (x[start + i]! - mittel) * hann[i]! : 0;
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < bins; i++) summe[i] = summe[i]! + re[i]! ** 2 + im[i]! ** 2;
    anzahl++;
    if (start + N >= x.length) break;
  }
  const db = new Float32Array(bins);
  
  
  for (let i = 0; i < bins; i++) {
    const p = (summe[i]! / anzahl) * (i === 0 ? 1 : 2) / (wSumme * N);
    db[i] = 10 * Math.log10(p + 1e-20);
  }
  return { df, db };
}


export function rauschgrund(db: Float32Array, halb: number): Float32Array {
  const out = new Float32Array(db.length);
  const fenster: number[] = [];
  for (let i = 0; i < db.length; i++) {
    fenster.length = 0;
    const a = Math.max(0, i - halb), b = Math.min(db.length - 1, i + halb);
    for (let j = a; j <= b; j++) fenster.push(db[j]!);
    fenster.sort((p, q) => p - q);
    out[i] = fenster[fenster.length >> 1]!;
  }
  return out;
}


export function hervorhebung(s: Spektrum, bisHz = KAMM_BIS_HZ + 20): Float32Array {
  const bins = Math.min(s.db.length, Math.floor(bisHz / s.df) + 1);
  const teil = s.db.subarray(0, bins);
  const grund = rauschgrund(teil, Math.max(3, Math.round(GRUND_HALBBREITE_HZ / s.df)));
  const out = new Float32Array(bins);
  for (let i = 0; i < bins; i++) out[i] = teil[i]! - grund[i]!;
  return out;
}


export function kamm(prom: Float32Array, df: number): Kamm {
  let best: Kamm = { f0: 0, h: 0, k: 0, treffer: 0 };
  const maxBin = prom.length - 2;
  for (let f0 = F0_MIN; f0 <= F0_MAX + 1e-9; f0 += F0_SCHRITT) {
    let summe = 0, k = 0, treffer = 0;
    for (let m = 1; m <= KAMM_MAX_K && m * f0 <= KAMM_BIS_HZ; m++) {
      const i = Math.round(m * f0 / df);
      if (i < 1 || i > maxBin) break;
      const v = Math.max(prom[i - 1]!, prom[i]!, prom[i + 1]!);
      summe += Math.max(0, v);
      if (m <= OBERTON_K && v >= OBERTON_DB) treffer++;
      k++;
    }
    if (k < KAMM_MIN_K) continue;
    const h = summe / k;
    if (h > best.h + 1e-9) best = { f0: Math.round(f0 * 10) / 10, h, k, treffer };
  }
  return best;
}

function bandPegel(s: Spektrum, von: number, bis: number): number {
  let p = 0;
  const a = Math.max(1, Math.ceil(von / s.df));
  const b = Math.min(s.db.length - 1, Math.floor(bis / s.df));
  for (let i = a; i <= b; i++) p += 10 ** (s.db[i]! / 10);
  return 10 * Math.log10(p + 1e-20);
}


export function merkmale(x: Float32Array, fs: number): Merkmale {
  const s = welch(x, fs);
  const prom = hervorhebung(s);
  const k = kamm(prom, s.df);

  let quadrat = 0;
  for (let i = 0; i < x.length; i++) quadrat += x[i]! ** 2;
  const pegel = 10 * Math.log10(quadrat / Math.max(1, x.length) + 1e-20);

  let linie = { f: 0, h: -Infinity };
  for (let i = Math.ceil(15 / s.df); i <= Math.min(prom.length - 1, Math.floor(400 / s.df)); i++) {
    if (prom[i]! > linie.h) linie = { f: i * s.df, h: prom[i]! };
  }

  
  const abschnitte: Kamm[] = [];
  const lang = zweierPotenz(FENSTER) * 2;
  for (let a = 0; a + lang <= x.length; a += lang) {
    const sa = welch(x.subarray(a, a + lang), fs);
    abschnitte.push(kamm(hervorhebung(sa), sa.df));
  }
  let f0Streuung = NaN;
  if (abschnitte.length >= 2) {
    const m = abschnitte.reduce((q, a) => q + a.f0, 0) / abschnitte.length;
    f0Streuung = Math.sqrt(abschnitte.reduce((q, a) => q + (a.f0 - m) ** 2, 0) / abschnitte.length);
  }

  return {
    fs,
    dauerS: x.length / fs,
    pegel,
    baender: {
      b10_60: bandPegel(s, 10, 60),
      b60_200: bandPegel(s, 60, 200),
      b200_1000: bandPegel(s, 200, 1000),
      b1000_4000: bandPegel(s, 1000, 4000),
    },
    kamm: k,
    abschnitte,
    f0Streuung,
    linie: { f: Math.round(linie.f * 10) / 10, h: linie.h },
  };
}


export function klangMessung(x: Float32Array, fs: number): { treffer: number; h: number; f0: number; pegel: number } {
  const s = welch(x, fs);
  const k = kamm(hervorhebung(s), s.df);
  let quadrat = 0;
  for (let i = 0; i < x.length; i++) quadrat += x[i]! ** 2;
  return { treffer: k.treffer, h: k.h, f0: k.f0, pegel: 10 * Math.log10(quadrat / Math.max(1, x.length) + 1e-20) };
}


export function obertonRegel(k: Kamm): boolean {
  return (k.treffer ?? 0) >= OBERTON_MIN;
}


export function drehzahlAusZuendung(f: number, zylinder: number): number {
  return f * 120 / zylinder;
}


export function drehzahlAusWelle(f: number): number {
  return f * 60;
}

export interface TrennErgebnis {
  
  minAn: number;
  maxAus: number;
  
  schwelle: number | null;
  
  abstand: number;
}


export function trennung(werte: { motor: boolean; h: number }[]): TrennErgebnis | null {
  const an = werte.filter((w) => w.motor).map((w) => w.h);
  const aus = werte.filter((w) => !w.motor).map((w) => w.h);
  if (!an.length || !aus.length) return null;
  const minAn = Math.min(...an);
  const maxAus = Math.max(...aus);
  const abstand = minAn - maxAus;
  return { minAn, maxAus, abstand, schwelle: abstand > 0 ? (minAn + maxAus) / 2 : null };
}
