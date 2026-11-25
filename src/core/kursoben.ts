import type { SpurPunkt } from './spur';
import { bearingOf, relAngle } from './geo';

export const MIN_SOG_KN = 1.0;

export const FENSTER_S = 60;

export const TOTBAND_GRAD = 10;

export function kursFuerKarte(punkte: readonly SpurPunkt[]): number | null {
  const juengster = punkte[punkte.length - 1];
  if (!juengster || juengster.cog === null || !(juengster.sog >= MIN_SOG_KN)) return null;

  const ab = juengster.t - FENSTER_S * 1000;
  let x = 0;
  let y = 0;
  for (let i = punkte.length - 1; i >= 0; i--) {
    const p = punkte[i]!;
    if (p.t < ab) break;
    if (p.cog === null || !(p.sog >= MIN_SOG_KN)) continue;
    const r = (p.cog * Math.PI) / 180;
    x += p.sog * Math.sin(r);
    y += p.sog * Math.cos(r);
  }

  if (Math.hypot(x, y) < 1e-9) return null;
  return bearingOf(x, y);
}

export function naechsteAusrichtung(angezeigt: number | null, kurs: number | null): number | null {
  if (kurs === null) return angezeigt;
  if (angezeigt === null) return kurs;
  return relAngle(kurs, angezeigt) >= TOTBAND_GRAD ? kurs : angezeigt;
}

export function drehweg(von: number, nach: number): number {
  const d = (((nach - von) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

export function dreheVektor(x: number, y: number, grad: number): [number, number] {
  const r = (grad * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

export function quadratSeite(w: number, h: number): number {
  return Math.ceil(Math.hypot(w, h));
}
