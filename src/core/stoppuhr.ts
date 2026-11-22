import { nf } from './time';


export interface StoppuhrZustand {
  
  laeuftSeit: number | null;
  
  bisherMs: number;
  
  zwischen: number[];
  
  intervalle: number[];
  
  letzteMarkeMs: number;
}


export const STOPPUHR_MAX_EINTRAEGE = 99;

export const neueStoppuhr = (): StoppuhrZustand => ({ laeuftSeit: null, bisherMs: 0, zwischen: [], intervalle: [], letzteMarkeMs: 0 });
export const stoppuhrLaeuft = (z: StoppuhrZustand): boolean => z.laeuftSeit !== null;


export function verstrichen(z: StoppuhrZustand, jetzt: number): number {
  return z.bisherMs + (z.laeuftSeit !== null ? Math.max(0, jetzt - z.laeuftSeit) : 0);
}


export function stoppuhrStart(z: StoppuhrZustand, jetzt: number): StoppuhrZustand {
  return z.laeuftSeit !== null ? z : { ...z, laeuftSeit: jetzt };
}


export function stoppuhrStopp(z: StoppuhrZustand, jetzt: number): StoppuhrZustand {
  return z.laeuftSeit === null ? z : { ...z, bisherMs: verstrichen(z, jetzt), laeuftSeit: null };
}

const anhaengen = (liste: readonly number[], x: number) => [...liste, x].slice(-STOPPUHR_MAX_EINTRAEGE);


export function zwischenzeit(z: StoppuhrZustand, jetzt: number): StoppuhrZustand {
  if (z.laeuftSeit === null) return z;
  return { ...z, zwischen: anhaengen(z.zwischen, verstrichen(z, jetzt)) };
}


export function intervall(z: StoppuhrZustand, jetzt: number): StoppuhrZustand {
  if (z.laeuftSeit === null) {
    const s = stoppuhrStart(z, jetzt);
    return { ...s, letzteMarkeMs: verstrichen(s, jetzt) };
  }
  const t = verstrichen(z, jetzt);
  return { ...z, intervalle: anhaengen(z.intervalle, t - z.letzteMarkeMs), letzteMarkeMs: t };
}

export const stoppuhrReset = (): StoppuhrZustand => neueStoppuhr();


export function mittel(liste: readonly number[]): number | null {
  return liste.length ? liste.reduce((a, b) => a + b, 0) / liste.length : null;
}


export function uhrText(ms: number, sprache: 'de' | 'en' = 'de'): string {
  const zehntel = Math.floor(Math.max(0, ms) / 100);
  const s = Math.floor(zehntel / 10), m = Math.floor(s / 60), h = Math.floor(m / 60);
  const zwei = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${zwei(m % 60)}:${zwei(s % 60)}`;
  return `${zwei(m)}:${zwei(s % 60)}${sprache === 'de' ? ',' : '.'}${zehntel % 10}`;
}


export const sekundenText = (ms: number, sprache: 'de' | 'en' = 'de'): string => `${nf(Math.round(ms / 100) / 10, 1, sprache)} s`;


export function stoppuhrAusSpeicher(roh: unknown): StoppuhrZustand {
  const r = roh as Partial<StoppuhrZustand> | null;
  const zahlen = (x: unknown) => (Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0) : []);
  if (!r || typeof r !== 'object') return neueStoppuhr();
  return {
    laeuftSeit: typeof r.laeuftSeit === 'number' && Number.isFinite(r.laeuftSeit) ? r.laeuftSeit : null,
    bisherMs: typeof r.bisherMs === 'number' && r.bisherMs >= 0 ? r.bisherMs : 0,
    zwischen: zahlen(r.zwischen).slice(-STOPPUHR_MAX_EINTRAEGE),
    intervalle: zahlen(r.intervalle).slice(-STOPPUHR_MAX_EINTRAEGE),
    letzteMarkeMs: typeof r.letzteMarkeMs === 'number' && r.letzteMarkeMs >= 0 ? r.letzteMarkeMs : 0,
  };
}
