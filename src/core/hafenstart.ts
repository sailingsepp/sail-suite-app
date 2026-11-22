import type { Punkt } from './types';
import { baueWassergitter, boxUm, liegtAnLand } from './landumfahrung';




export const HAFENSTART_ZELLE_SM = 0.003;

export const HAFENSTART_VOR_SM = 0.02;

export const HAFENSTART_ANSCHLUSS_SM = 0.04;


function xy(p: Punkt, o: Punkt): [number, number] {
  return [(p.lon - o.lon) * 60 * Math.cos((o.lat * Math.PI) / 180), (p.lat - o.lat) * 60];
}


export function imPolygon(p: Punkt, ring: readonly Punkt[]): boolean {
  let innen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.lat > p.lat) !== (b.lat > p.lat)
      && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) innen = !innen;
  }
  return innen;
}


export function abstandZumRandSm(p: Punkt, ring: readonly Punkt[]): number {
  let min = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = xy(ring[i - 1]!, p), [bx, by] = xy(ring[i]!, p);
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}


export function startVorHafen(
  p: Punkt,
  flaechen: readonly (readonly Punkt[])[],
  sperren: readonly [Punkt, Punkt][],
  kueste: readonly [Punkt, Punkt][],
): Punkt | null {
  const ring = flaechen.find((f) => f.length >= 4 && imPolygon(p, f));
  if (!ring) return null;
  const g = baueWassergitter(boxUm([p, ...ring], 0.15), sperren, HAFENSTART_ZELLE_SM, 0);
  const mitte = (i: number): Punkt => {
    const x = i % g.nx, y = (i - x) / g.nx;
    return { lat: g.swLat + (y + 0.5) * g.dLat, lon: g.swLon + (x + 0.5) * g.dLon };
  };
  const wasser = (q: Punkt) => !liegtAnLand(q, kueste);

  
  
  const x0 = Math.floor((p.lon - g.swLon) / g.dLon), y0 = Math.floor((p.lat - g.swLat) / g.dLat);
  const r = Math.ceil(HAFENSTART_ANSCHLUSS_SM / g.zelleSm);
  const kandidaten: { i: number; d: number }[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= g.nx || y >= g.ny || dx * dx + dy * dy > r * r) continue;
      const i = y * g.nx + x;
      if (g.frei[i]) kandidaten.push({ i, d: dx * dx + dy * dy });
    }
  }
  kandidaten.sort((a, b) => a.d - b.d);
  const start = kandidaten.find((k) => wasser(mitte(k.i)));
  if (!start) return null;

  
  
  const besucht = new Uint8Array(g.nx * g.ny);
  const schlange = new Int32Array(g.nx * g.ny);
  let kopf = 0, ende = 0;
  schlange[ende++] = start.i; besucht[start.i] = 1;
  while (kopf < ende) {
    const i = schlange[kopf++]!;
    const q = mitte(i);
    if (!imPolygon(q, ring) && abstandZumRandSm(q, ring) >= HAFENSTART_VOR_SM && wasser(q)) return q;
    const x = i % g.nx, y = (i - x) / g.nx;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= g.nx || ny >= g.ny) continue;
      const n = ny * g.nx + nx;
      if (besucht[n] || !g.frei[n]) continue;
      besucht[n] = 1;
      schlange[ende++] = n;
    }
  }
  return null;
}
