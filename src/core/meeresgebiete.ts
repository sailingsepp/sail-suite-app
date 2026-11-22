import type { Sprache } from './types';
import { MEERESGEBIETE_ROH } from './meeresgebieteDaten';



export interface Meeresgebiet {
  
  id: string;
  iho: string;
  de: string;
  
  deAus: string;
  en: string;
}

const NAMEN: Record<string, { de: string; deAus: string; en: string }> = {
  '28a': { de: 'Straße von Gibraltar', deAus: 'aus der Straße von Gibraltar', en: 'Strait of Gibraltar' },
  '28b': { de: 'Alborán-Meer', deAus: 'aus dem Alborán-Meer', en: 'Alboran Sea' },
  '28c': { de: 'Balearenmeer', deAus: 'aus dem Balearenmeer', en: 'Balearic Sea' },
  '28d': { de: 'Ligurisches Meer', deAus: 'aus dem Ligurischen Meer', en: 'Ligurian Sea' },
  '28e': { de: 'Tyrrhenisches Meer', deAus: 'aus dem Tyrrhenischen Meer', en: 'Tyrrhenian Sea' },
  '28f': { de: 'Ionisches Meer', deAus: 'aus dem Ionischen Meer', en: 'Ionian Sea' },
  '28g': { de: 'Adriatisches Meer', deAus: 'aus dem Adriatischen Meer', en: 'Adriatic Sea' },
  '28h': { de: 'Ägäisches Meer', deAus: 'aus dem Ägäischen Meer', en: 'Aegean Sea' },
  '28A': { de: 'Westliches Mittelmeerbecken', deAus: 'aus dem westlichen Mittelmeerbecken', en: 'western Mediterranean basin' },
  '28B': { de: 'Östliches Mittelmeerbecken', deAus: 'aus dem östlichen Mittelmeerbecken', en: 'eastern Mediterranean basin' },
  '29': { de: 'Marmarameer', deAus: 'aus dem Marmarameer', en: 'Sea of Marmara' },
  '30': { de: 'Schwarzes Meer', deAus: 'aus dem Schwarzen Meer', en: 'Black Sea' },
  '31': { de: 'Asowsches Meer', deAus: 'aus dem Asowschen Meer', en: 'Sea of Azov' },
  '23': { de: 'Nordatlantik', deAus: 'aus dem Nordatlantik', en: 'North Atlantic Ocean' },
};

export interface Meerenge { de: string; deDurch: string; en: string }
const MEERENGEN: Record<string, Meerenge> = {
  otranto: { de: 'Straße von Otranto', deDurch: 'durch die Straße von Otranto', en: 'Strait of Otranto' },
  messina: { de: 'Straße von Messina', deDurch: 'durch die Straße von Messina', en: 'Strait of Messina' },
  bonifacio: { de: 'Straße von Bonifacio', deDurch: 'durch die Straße von Bonifacio', en: 'Strait of Bonifacio' },
  sizilien: { de: 'Straße von Sizilien', deDurch: 'durch die Straße von Sizilien', en: 'Strait of Sicily' },
  dardanellen: { de: 'Dardanellen', deDurch: 'durch die Dardanellen', en: 'Dardanelles' },
  bosporus: { de: 'Bosporus', deDurch: 'durch den Bosporus', en: 'Bosporus' },
  kertsch: { de: 'Straße von Kertsch', deDurch: 'durch die Straße von Kertsch', en: 'Kerch Strait' },
};


const BONIFACIO_BOX = { sued: 41.1, nord: 41.5, west: 8.85, ost: 9.45 };

export const INSELSTRASSE_KM = 25;
export const NAECHSTES_BIS_KM = 5;
const INSELSTRASSEN: { lat: number; lon: number; enge: Meerenge }[] = [
  
  { lat: 36.029, lon: 23.173, enge: { de: 'Kythira Strait', deDurch: 'durch die Meerenge Kythira Strait', en: 'Kythira Strait' } },
  { lat: 35.699, lon: 23.456, enge: { de: 'Steno Antikythiro', deDurch: 'durch die Meerenge Steno Antikythiro', en: 'Steno Antikythiro' } },
  { lat: 35.922, lon: 27.5, enge: { de: 'Steno Karpathou', deDurch: 'durch die Meerenge Steno Karpathou', en: 'Steno Karpathou' } },
];

const paar = (a: string, b: string) => [a, b].sort().join('|');
const MEERENGE_JE_GRENZE: Record<string, (lat: number, lon: number) => string | null> = {
  [paar('28f', '28g')]: () => 'otranto',
  [paar('28e', '28f')]: () => 'messina',
  [paar('28A', '28e')]: (lat, lon) => (lat >= BONIFACIO_BOX.sued && lat <= BONIFACIO_BOX.nord && lon >= BONIFACIO_BOX.west && lon <= BONIFACIO_BOX.ost ? 'bonifacio' : null),
  [paar('28A', '28B')]: () => 'sizilien',
  [paar('28h', '29')]: () => 'dardanellen',
  [paar('29', '30')]: () => 'bosporus',
  [paar('30', '31')]: () => 'kertsch',
};

function kmZwischen(la1: number, lo1: number, la2: number, lo2: number): number {
  const r = Math.PI / 180;
  const d = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(d)));
}

interface Flaeche { gebiet: Meeresgebiet; ringe: [number, number][][]; box: { s: number; n: number; w: number; o: number } }
const FLAECHEN: Flaeche[] = MEERESGEBIETE_ROH.map((r) => {
  let s = 90, n = -90, w = 180, o = -180;
  for (const ring of r.ringe) for (const [la, lo] of ring) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); o = Math.max(o, lo); }
  const name = NAMEN[r.id] ?? { de: r.iho, deAus: `aus ${r.iho}`, en: r.iho };
  return { gebiet: { id: r.id, iho: r.iho, ...name }, ringe: r.ringe, box: { s, n, w, o } };
});


function imRing(lat: number, lon: number, ring: [number, number][]): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, oi] = ring[i]!; const [aj, oj] = ring[j]!;
    if ((ai > lat) !== (aj > lat) && lon < ((oj - oi) * (lat - ai)) / (aj - ai) + oi) drin = !drin;
  }
  return drin;
}


function randKm(f: Flaeche, lat: number, lon: number): number {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 110.57;
  let min = Infinity;
  for (const r of f.ringe) {
    for (let i = 0; i < r.length - 1; i++) {
      const ax = (r[i]![1] - lon) * kx, ay = (r[i]![0] - lat) * ky, bx = (r[i + 1]![1] - lon) * kx, by = (r[i + 1]![0] - lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, (-ax * dx - ay * dy) / l2)) : 0;
      min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return min;
}


export function meeresgebietAm(lat: number, lon: number): Meeresgebiet | null {
  for (const f of FLAECHEN) {
    if (lat < f.box.s || lat > f.box.n || lon < f.box.w || lon > f.box.o) continue;
    if (f.ringe.some((r) => imRing(lat, lon, r))) return f.gebiet;
  }
  const rand = NAECHSTES_BIS_KM / 111;
  let best: { f: Flaeche; d: number } | null = null;
  for (const f of FLAECHEN) {
    if (lat < f.box.s - rand || lat > f.box.n + rand || lon < f.box.w - rand * 1.5 || lon > f.box.o + rand * 1.5) continue;
    const d = randKm(f, lat, lon);
    if (d <= NAECHSTES_BIS_KM && (!best || d < best.d)) best = { f, d };
  }
  return best?.f.gebiet ?? null;
}

export function gebietNachId(id: string): Meeresgebiet | null {
  return FLAECHEN.find((f) => f.gebiet.id === id)?.gebiet ?? null;
}


export function meerengeZwischen(von: string, nach: string, lat: number, lon: number): Meerenge | null {
  const k = MEERENGE_JE_GRENZE[paar(von, nach)]?.(lat, lon);
  if (k) return MEERENGEN[k]!;
  if (paar(von, nach) === paar('28B', '28h')) {
    const nah = INSELSTRASSEN.map((s) => ({ s, d: kmZwischen(lat, lon, s.lat, s.lon) })).sort((a, b) => a.d - b.d)[0];
    if (nah && nah.d <= INSELSTRASSE_KM) return nah.s.enge;
  }
  return null;
}




export const WECHSEL_MIN_PUNKTE = 3;
export const WECHSEL_MIN_MS = 60_000;

export const NEUBEGINN_PAUSE_MS = 12 * 3_600_000;
export const NEUBEGINN_SPRUNG_SM = 100;

export interface Ort { t: number; lat: number; lon: number }
export interface GebietStand {
  
  gebiet: string | null;
  
  zuletzt: Ort | null;
  
  kandidat: string | null;
  kandidatAb: Ort | null;
  kandidatPunkte: number;
}
export const LEERER_STAND: GebietStand = { gebiet: null, zuletzt: null, kandidat: null, kandidatAb: null, kandidatPunkte: 0 };

export interface Uebergang { von: string; nach: string; ort: Ort; meerenge: Meerenge | null }

function sm(a: Ort, b: Ort): number {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(d)));
}


export function gebietSchritt(stand: GebietStand, id: string | null, ort: Ort): { stand: GebietStand; uebergang: Uebergang | null } {
  const neubeginn = !stand.zuletzt || ort.t - stand.zuletzt.t > NEUBEGINN_PAUSE_MS || sm(stand.zuletzt, ort) > NEUBEGINN_SPRUNG_SM;
  const basis: GebietStand = neubeginn ? { ...LEERER_STAND } : { ...stand };
  basis.zuletzt = ort;
  if (id === null) return { stand: basis, uebergang: null };
  if (basis.gebiet === null) return { stand: { ...basis, gebiet: id, kandidat: null, kandidatAb: null, kandidatPunkte: 0 }, uebergang: null };
  if (id === basis.gebiet) return { stand: { ...basis, kandidat: null, kandidatAb: null, kandidatPunkte: 0 }, uebergang: null };
  const gleich = basis.kandidat === id && basis.kandidatAb;
  const kandidatAb = gleich ? basis.kandidatAb! : ort;
  const punkte = gleich ? basis.kandidatPunkte + 1 : 1;
  if (punkte >= WECHSEL_MIN_PUNKTE && ort.t - kandidatAb.t >= WECHSEL_MIN_MS) {
    const uebergang: Uebergang = { von: basis.gebiet, nach: id, ort: kandidatAb, meerenge: meerengeZwischen(basis.gebiet, id, kandidatAb.lat, kandidatAb.lon) };
    return { stand: { ...basis, gebiet: id, kandidat: null, kandidatAb: null, kandidatPunkte: 0 }, uebergang };
  }
  return { stand: { ...basis, kandidat: id, kandidatAb, kandidatPunkte: punkte }, uebergang: null };
}


export function uebergangText(u: Uebergang, sprache: Sprache): string {
  const von = gebietNachId(u.von);
  const nach = gebietNachId(u.nach);
  if (!von || !nach) return '';
  if (sprache === 'en') return `Entered the ${nach.en}, from the ${von.en}${u.meerenge ? ` through the ${u.meerenge.en}` : ''}`;
  return `${nach.de} erreicht, ${von.deAus}${u.meerenge ? ` ${u.meerenge.deDurch}` : ''}`;
}
