import { bearingDeg } from './geo';
import type { Punkt } from './types';



export interface Takt {
  
  h: number;
  
  s: number;
  
  farbe: FeuerFarbe;
}
export type FeuerFarbe = 'red' | 'green' | 'white' | 'yellow' | 'blue' | 'orange' | 'violet';
export interface Sektor {
  farben: FeuerFarbe[];
  
  kennung: string;
  takte: Takt[];
  periode: number;
  
  von: number | null;
  bis: number | null;
}
export interface Feuer { lat: number; lon: number; sektoren: Sektor[]; gross: boolean }

const FARBEN: Record<string, FeuerFarbe> = {
  red: 'red', green: 'green', white: 'white', yellow: 'yellow', amber: 'orange', orange: 'orange', blue: 'blue', violet: 'violet',
};
const MARKE: Record<string, FeuerFarbe> = { W: 'white', R: 'red', G: 'green', Y: 'yellow', BU: 'blue', OR: 'orange', VI: 'violet' };
const KURZ: Record<FeuerFarbe, string> = { red: 'R', green: 'G', white: 'W', yellow: 'Y', blue: 'Bu', orange: 'Or', violet: 'Vi' };


const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
};

const zahl = (x: string | undefined): number | null => {
  if (x == null) return null;
  const v = Number(String(x).replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v > 0 ? v : null;
};

const grad = (x: string | undefined): number | null => {
  if (x == null || x.trim() === '') return null;
  const v = Number(x.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};


export function folgeAusSequenz(seq: string, ersterHell = true): { h: number; s: number }[] | null {
  const teile = seq.match(/\(?\s*\d+(?:[.,]\d+)?\s*\)?/g);
  if (!teile?.length) return null;
  const mitKlammern = teile.some((t) => t.includes('('));
  const aus = teile.map((t, i) => ({
    h: mitKlammern ? (t.includes('(') ? 0 : 1) : ((i % 2 === 0) === ersterHell ? 1 : 0),
    s: Number(t.replace(/[()\s]/g, '').replace(',', '.')),
  }));
  return aus.every((t) => t.s > 0) ? aus : null;
}


const ARTEN = ['Q+LFl', 'VQ+LFl', 'UQ+LFl', 'FLFl', 'FlLFl', 'OcFl', 'LFl', 'IVQ', 'IUQ', 'IQ', 'VQ', 'UQ', 'Q', 'Iso', 'Oc', 'Mo', 'FFl', 'Fl', 'F'];


export function zerlegeKennung(character: string, group?: string): { art: string; wechsel: boolean; gruppe: string | null } {
  const c = character.trim();
  const wechsel = /^Al\.?/i.test(c);
  const rest = c.replace(/^Al\.?/i, '');
  
  const art = ARTEN.find((x) => rest.toLowerCase().startsWith(x.toLowerCase())) ?? rest.replace(/[^A-Za-z+].*$/, '');
  const klammer = /\(([^)]*)\)/.exec(rest.slice(art.length));
  const gruppe = (group && group.trim()) || klammer?.[1]?.trim() || null;
  return { art, wechsel, gruppe };
}

const SCHNELL: Record<string, number> = { Q: 1, VQ: 0.5, UQ: 0.25 };

function blitze(anzahl: number, an: number, zwischen: number): { h: number; s: number }[] {
  const t: { h: number; s: number }[] = [];
  for (let i = 0; i < anzahl; i++) { t.push({ h: 1, s: an }); if (i < anzahl - 1) t.push({ h: 0, s: zwischen }); }
  return t;
}


export function sequenzAbgleichen(t: { h: number; s: number }[], art: string, n: number, periode: number | null): { h: number; s: number }[] | null {
  let aus = t.map((x) => ({ ...x }));
  const elemente = aus.filter((x) => (art === 'Oc' ? x.h === 0 : x.h > 0)).length;
  if (n > 1 && elemente < n) {
    if (art === 'Oc') return null;
    const an = aus.find((x) => x.h > 0)?.s ?? 0.5, dunkel = aus.find((x) => x.h === 0)?.s ?? 1;
    aus = blitze(n, an, dunkel);
  }
  const summe = aus.reduce((a, x) => a + x.s, 0);
  if (periode && summe > periode * 1.1) return null;
  if (periode && summe < periode - 0.05) {
    const letzter = aus.at(-1)!;
    if (letzter.h === 0) letzter.s += periode - summe; else aus.push({ h: 0, s: periode - summe });
  }
  return aus;
}


export function folgeAusKennung(art: string, gruppe: string | null, periode: number | null): { h: number; s: number }[] {
  const n = gruppe && /^\d+$/.test(gruppe) ? Number(gruppe) : 1;
  const auffuellen = (t: { h: number; s: number }[], p: number | null) => {
    const summe = t.reduce((a, x) => a + x.s, 0);
    if (p && p > summe + 0.05) t.push({ h: 0, s: p - summe });
    else if (p && p < summe - 0.05) { const f = p / summe; for (const x of t) x.s *= f; }
    return t;
  };
  switch (art) {
    case 'F': return [{ h: 1, s: 1 }];
    case 'Iso': { const p = periode ?? 4; return [{ h: 1, s: p / 2 }, { h: 0, s: p / 2 }]; }
    case 'Oc': {
      
      const p = periode ?? 4;
      const t = blitze(n, 1, 1).map((x) => ({ h: 1 - x.h, s: x.s }));
      const summe = t.reduce((a, x) => a + x.s, 0);
      if (summe >= p) { const dunkel = Math.min(1, p / 3); return [{ h: 1, s: p - dunkel }, { h: 0, s: dunkel }]; }
      return [{ h: 1, s: p - summe }, ...t];
    }
    case 'LFl': return auffuellen(blitze(n, 2, 1.5), periode ?? (n * 3.5 + 3));
    case 'Q': case 'VQ': case 'UQ': {
      const z = SCHNELL[art]!;
      if (gruppe && periode) return auffuellen(blitze(n, z * 0.4, z * 0.6), periode);
      return [{ h: 1, s: z * 0.4 }, { h: 0, s: z * 0.6 }];
    }
    case 'IQ': case 'IVQ': case 'IUQ': {
      const z = SCHNELL[art.slice(1)]!;
      const p = periode ?? 10;
      return auffuellen(blitze(Math.max(1, Math.floor((p * 0.75) / z)), z * 0.4, z * 0.6), p);
    }
    case 'Q+LFl': case 'VQ+LFl': case 'UQ+LFl': {
      const z = SCHNELL[art.split('+')[0]!]!;
      const t = blitze(n, z * 0.4, z * 0.6);
      t.push({ h: 0, s: z * 0.6 }, { h: 1, s: 2 });
      return auffuellen(t, periode ?? 15);
    }
    case 'Mo': {
      const zeichen = (gruppe ?? 'U').toUpperCase().replace(/[^A-Z]/g, '').split('').map((b) => MORSE[b] ?? '').join(' ');
      const t: { h: number; s: number }[] = [];
      for (const z of zeichen) {
        if (z === ' ') { const l = t.at(-1); if (l) l.s = 1.5; continue; }
        t.push({ h: 1, s: z === '.' ? 0.5 : 1.5 }, { h: 0, s: 0.5 });
      }
      if (!t.length) return [{ h: 1, s: 1 }];
      return auffuellen(t, periode ?? t.reduce((a, x) => a + x.s, 0) + 3);
    }
    case 'FFl': return auffuellen([{ h: 1, s: 1 }, { h: 0.35, s: 1 }], periode ?? 5).map((x) => (x.h === 0 ? { ...x, h: 0.35 } : x));
    case 'Fl': default: {
      const p = periode ?? (n > 1 ? n * 1.5 + 3 : 3);
      const an = p < 2 ? 0.3 : 0.5;
      return auffuellen(blitze(n, an, 1), p);
    }
  }
}


function sektorAus(tags: Readonly<Record<string, string>>, nr: number | null): Sektor | null {
  const f = (k: string) => (nr === null ? undefined : tags[`seamark:light:${nr}:${k}`]) ?? tags[`seamark:light:${k}`];
  const character = f('character');
  if (!character) return null;
  const farben = (f('colour') ?? 'white').split(/[;,]/).map((x) => FARBEN[x.trim().toLowerCase()]).filter((x): x is FeuerFarbe => !!x);
  if (!farben.length) farben.push('white');
  const { art, wechsel, gruppe } = zerlegeKennung(character, f('group'));
  const periode = zahl(f('period'));
  const seq = f('sequence');
  const n = gruppe && /^\d+$/.test(gruppe) ? Number(gruppe) : 1;
  const ausSeq = seq ? folgeAusSequenz(seq, art !== 'Oc') : null;
  const roh = (ausSeq && sequenzAbgleichen(ausSeq, art, n, periode)) || folgeAusKennung(art, gruppe, periode);
  
  
  const marken = ausSeq && seq ? [...seq.matchAll(/\[([A-Za-z]+)\.?\]/g)].map((m) => MARKE[m[1]!.toUpperCase()]).filter((x): x is FeuerFarbe => !!x) : [];
  let k = 0;
  const takte: Takt[] = roh.map((t) => {
    if (t.h <= 0) return { ...t, farbe: farben[0]! };
    const farbe = marken.length ? marken[k % marken.length]! : wechsel ? farben[k % farben.length]! : farben[0]!;
    k++;
    return { ...t, farbe };
  });
  const p = takte.reduce((a, t) => a + t.s, 0);
  const von = grad(f('sector_start')), bis = grad(f('sector_end'));
  const g = gruppe && gruppe !== '1' ? `(${gruppe})` : '';
  
  const artMitGruppe = g && art.includes('+') ? art.replace('+', `${g}+`) : `${art}${g}`;
  
  
  const wiederkehr = art === 'F' || periode == null ? '' : ` ${Math.round(periode * 10) / 10}s`;
  const kennung = `${wechsel ? 'Al.' : ''}${artMitGruppe} ${farben.map((x) => KURZ[x]).join('')}${wiederkehr}`;
  return { farben, kennung, takte, periode: p, von: von !== null && bis !== null ? von : null, bis: von !== null && bis !== null ? bis : null };
}


export const FEUER_TYPEN: readonly string[] = ['light_major', 'light_minor', 'light_float', 'light_vessel'];


export function istFeuer(t: Readonly<Record<string, string>>): boolean {
  if (t['seamark:light:character'] || t['seamark:light:1:character']) return true;
  if (FEUER_TYPEN.includes(t['seamark:type'] ?? '')) return true;
  const schluessel = Object.keys(t);
  if (schluessel.some((k) => /^seamark:light:(\d+:)?colour$/.test(k))) return true;
  return t['man_made'] === 'lighthouse' && schluessel.some((k) => k.startsWith('seamark:'));
}


export function feuerAusTags(lat: number, lon: number, tags: Readonly<Record<string, string>>): Feuer | null {
  const nummern = new Set<number>();
  for (const k of Object.keys(tags)) { const m = /^seamark:light:(\d+):/.exec(k); if (m) nummern.add(Number(m[1])); }
  const sektoren = (nummern.size ? [...nummern].sort((a, b) => a - b).map((n) => sektorAus(tags, n)) : [sektorAus(tags, null)])
    .filter((s): s is Sektor => !!s);
  if (!sektoren.length) return null;
  return { lat, lon, sektoren, gross: tags['seamark:type'] === 'light_major' };
}


export function imSektor(s: Pick<Sektor, 'von' | 'bis'>, peilung: number): boolean {
  if (s.von === null || s.bis === null) return true;
  const a = ((s.von % 360) + 360) % 360, b = ((s.bis % 360) + 360) % 360, p = ((peilung % 360) + 360) % 360;
  if (Math.abs(s.bis - s.von) >= 360) return true;
  return a <= b ? p >= a && p <= b : p >= a || p <= b;
}


export function sichtbarerSektor(f: Feuer, boot: Punkt | null): Sektor {
  if (boot && f.sektoren.length > 1) {
    const peilung = bearingDeg(boot.lat, boot.lon, f.lat, f.lon);
    const s = f.sektoren.find((x) => imSektor(x, peilung));
    if (s) return s;
  }
  return f.sektoren[0]!;
}


export function verdunkelt(f: Feuer, boot: Punkt | null): boolean {
  if (!boot || f.sektoren.length === 0 || f.sektoren.every((x) => x.von === null || x.bis === null)) return false;
  const peilung = bearingDeg(boot.lat, boot.lon, f.lat, f.lon);
  return !f.sektoren.some((x) => imSektor(x, peilung));
}


export function taktSchluessel(s: Pick<Sektor, 'takte'>): string {
  return s.takte.map((t) => `${t.h}:${Math.round(t.s * 100)}:${t.farbe}`).join('|');
}
