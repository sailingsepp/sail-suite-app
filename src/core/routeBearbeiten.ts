import type { Punkt } from './types';

export interface Wegpunkt extends Punkt { name: string }

const AUTO = /^WP \d+$/;

export function nummeriere<T extends Wegpunkt>(punkte: readonly T[]): T[] {
  return punkte.map((p, k) => (AUTO.test(p.name) ? { ...p, name: `WP ${k}` } : p));
}

export function darfLoeschen(anzahl: number, k: number, fest: number): boolean {
  return k >= fest && k < anzahl && anzahl - 1 > fest;
}

export function loescheWegpunkt<T extends Wegpunkt>(punkte: readonly T[], k: number, fest: number): T[] | null {
  if (!darfLoeschen(punkte.length, k, fest)) return null;
  return nummeriere(punkte.filter((_, i) => i !== k));
}

export function fuegeEin<T extends Wegpunkt>(punkte: readonly T[], nach: number, p: Punkt, neu: (p: Punkt) => T, fest: number): T[] | null {
  if (nach < fest - 1 || nach >= punkte.length - 1) return null;
  const liste = [...punkte];
  liste.splice(nach + 1, 0, neu(p));
  return nummeriere(liste);
}

export function verschiebe<T extends Wegpunkt>(punkte: readonly T[], k: number, p: Punkt, fest: number): T[] | null {
  if (k < fest || k >= punkte.length) return null;
  return punkte.map((q, i) => (i === k ? { ...q, lat: p.lat, lon: p.lon } : q));
}

export function schenkelMitte(a: Punkt, b: Punkt): Punkt {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}
