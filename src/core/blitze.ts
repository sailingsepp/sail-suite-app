import type { Punkt } from './types';
import { bearingDeg, distNM } from './geo';

export const BLITZ_SCHRITT_MIN = 5;

export const BLITZ_KARTE_MIN = 60;

export const BLITZ_WARN_MIN = 30;

export const BLITZ_PIXEL_GRAD = 0.02;
export const BLITZ_MAX_PIXEL = 600;

export const BLITZ_ALPHA_MIN = 128;

export const BLITZ_ZELLE_GRAD = 0.04;

export const BLITZ_RADIEN = [0, 5, 10, 15, 20, 30] as const;
export const BLITZ_RADIUS_VORGABE = 15;

export const BLITZ_WARN_RUHE_MS = 30 * 60_000;

export const BLITZ_VORAUS_H = 2;
export const BLITZ_VORAUS_MIN_SM = 10;

export type BlitzBox = { s: number; w: number; n: number; o: number };
export interface Blitz { lat: number; lon: number;  t: number }

export function bildMass(b: BlitzBox): { breite: number; hoehe: number } {
  const breite = Math.max(1, Math.min(BLITZ_MAX_PIXEL, Math.ceil((b.o - b.w) / BLITZ_PIXEL_GRAD)));
  const hoehe = Math.max(1, Math.min(BLITZ_MAX_PIXEL, Math.ceil((b.n - b.s) / BLITZ_PIXEL_GRAD)));
  return { breite, hoehe };
}

export function boxUm(punkte: readonly Punkt[], randSm: number): BlitzBox | null {
  if (!punkte.length) return null;
  let s = Infinity, n = -Infinity, w = Infinity, o = -Infinity;
  for (const p of punkte) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); o = Math.max(o, p.lon); }
  const dLat = randSm / 60, dLon = randSm / (60 * Math.max(0.2, Math.cos(((s + n) / 2) * Math.PI / 180)));
  const r = (x: number, auf: boolean) => (auf ? Math.ceil(x * 10) : Math.floor(x * 10)) / 10;
  return { s: r(Math.max(-70, s - dLat), false), n: r(Math.min(70, n + dLat), true), w: r(w - dLon, false), o: r(o + dLon, true) };
}

export function neuesterSchritt(xml: string): number | null {
  const m = /<Dimension[^>]*name="time"[^>]*default="([^"]+)"/.exec(xml);
  const t = m ? Date.parse(m[1]!) : NaN;
  return Number.isFinite(t) ? t : null;
}

export function schritte(neuester: number, fensterMin: number): number[] {
  const n = Math.max(1, Math.floor(fensterMin / BLITZ_SCHRITT_MIN));
  return Array.from({ length: n }, (_, k) => neuester - k * BLITZ_SCHRITT_MIN * 60_000);
}

export function blitzeAusBild(rgba: ArrayLike<number>, breite: number, hoehe: number, b: BlitzBox, t: number): Blitz[] {
  const zellen = new Map<string, Blitz>();
  const g = BLITZ_ZELLE_GRAD;
  for (let y = 0; y < hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      if ((rgba[(y * breite + x) * 4 + 3] ?? 0) < BLITZ_ALPHA_MIN) continue;
      const lat = b.n - ((y + 0.5) / hoehe) * (b.n - b.s);
      const lon = b.w + ((x + 0.5) / breite) * (b.o - b.w);
      const i = Math.floor(lat / g), j = Math.floor(lon / g);
      const k = `${i}|${j}`;
      if (!zellen.has(k)) zellen.set(k, { lat: Math.round((i + 0.5) * g * 1e4) / 1e4, lon: Math.round((j + 0.5) * g * 1e4) / 1e4, t });
    }
  }
  return [...zellen.values()];
}

export function naechsterBlitz(blitze: readonly Blitz[], p: Punkt): { sm: number; peilung: number; t: number } | null {
  let best: { sm: number; peilung: number; t: number } | null = null;
  for (const b of blitze) {
    const sm = distNM(p.lat, p.lon, b.lat, b.lon);
    if (!best || sm < best.sm) best = { sm, peilung: bearingDeg(p.lat, p.lon, b.lat, b.lon), t: b.t };
  }
  return best;
}

function zurStrecke(p: Punkt, a: Punkt, b: Punkt): { sm: number; entlang: number } {
  const c = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const ax = a.lon * c * 60, ay = a.lat * 60, bx = b.lon * c * 60, by = b.lat * 60, px = p.lon * c * 60, py = p.lat * 60;
  const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const f = l > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return { sm: Math.hypot(px - (ax + f * dx), py - (ay + f * dy)), entlang: f * Math.sqrt(l) };
}

export function routeVoraus(rest: readonly Punkt[], smVoraus: number): Punkt[] {
  if (rest.length < 2) return [...rest];
  const aus: Punkt[] = [rest[0]!];
  let summe = 0;
  for (let i = 1; i < rest.length; i++) {
    const a = rest[i - 1]!, b = rest[i]!;
    const d = distNM(a.lat, a.lon, b.lat, b.lon);
    if (summe + d >= smVoraus) {
      const f = d > 0 ? (smVoraus - summe) / d : 0;
      aus.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });
      return aus;
    }
    summe += d;
    aus.push(b);
  }
  return aus;
}

export function blitzAnRoute(blitze: readonly Blitz[], route: readonly Punkt[]): { sm: number; voraus: number; t: number } | null {
  if (route.length < 2) return null;
  let best: { sm: number; voraus: number; t: number } | null = null;
  for (const bl of blitze) {
    let bisher = 0;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1]!, b = route[i]!;
      const z = zurStrecke(bl, a, b);
      if (!best || z.sm < best.sm) best = { sm: z.sm, voraus: bisher + z.entlang, t: bl.t };
      bisher += distNM(a.lat, a.lon, b.lat, b.lon);
    }
  }
  return best;
}

export type BlitzLage =
  | { art: 'yacht'; sm: number; peilung: number; t: number }
  | { art: 'route'; sm: number; voraus: number; t: number };

export function blitzLage(blitze: readonly Blitz[], boot: Punkt, routeVorausPunkte: readonly Punkt[] | null, radiusSm: number): BlitzLage | null {
  if (radiusSm <= 0 || !blitze.length) return null;
  const y = naechsterBlitz(blitze, boot);
  if (y && y.sm <= radiusSm) return { art: 'yacht', ...y };
  const r = routeVorausPunkte && routeVorausPunkte.length >= 2 ? blitzAnRoute(blitze, routeVorausPunkte) : null;
  if (r && r.sm <= radiusSm) return { art: 'route', ...r };
  return null;
}

export function sollWarnen(lage: BlitzLage | null, zuletzt: { t: number; sm: number } | null, jetzt: number): boolean {
  if (!lage) return false;
  if (!zuletzt) return true;
  return jetzt - zuletzt.t >= BLITZ_WARN_RUHE_MS || lage.sm <= zuletzt.sm / 2;
}

export const BLITZ_ALTER_MIN = [25, 45] as const;
export function altersStufe(t: number, jetzt: number): 0 | 1 | 2 {
  const min = (jetzt - t) / 60_000;
  return min < BLITZ_ALTER_MIN[0] ? 0 : min < BLITZ_ALTER_MIN[1] ? 1 : 2;
}
