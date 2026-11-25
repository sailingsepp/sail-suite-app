import { distNM } from './geo';

export interface UferWay {
  id: number;
  geometry: readonly { lat: number; lon: number }[];

  tags?: Record<string, string> | undefined;
}

export interface InselRelation {
  name: string;

  wayIds: readonly number[];
}

const INSEL_PLACES = ['island', 'islet'];

export function abstandZurLinieNM(p: { lat: number; lon: number }, linie: readonly { lat: number; lon: number }[]): number {
  if (linie.length === 0) return Infinity;
  if (linie.length === 1) return distNM(p.lat, p.lon, linie[0]!.lat, linie[0]!.lon);
  const k = Math.cos((p.lat * Math.PI) / 180);
  const xy = (q: { lat: number; lon: number }) => [(q.lon - p.lon) * k * 60, (q.lat - p.lat) * 60] as const;
  let best = Infinity;
  for (let i = 1; i < linie.length; i++) {
    const [ax, ay] = xy(linie[i - 1]!);
    const [bx, by] = xy(linie[i]!);
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    const x = ax + t * dx, y = ay + t * dy;
    best = Math.min(best, Math.hypot(x, y));
  }
  return best;
}

export function landpunktAmUfer(
  p: { lat: number; lon: number }, ways: readonly UferWay[], abstandM = 40,
): { lat: number; lon: number } | null {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const M_JE_GRAD = 111_320;
  const xy = (q: { lat: number; lon: number }) => [(q.lon - p.lon) * k * M_JE_GRAD, (q.lat - p.lat) * M_JE_GRAD] as const;
  let best: { d: number; x: number; y: number; dx: number; dy: number } | null = null;
  for (const w of ways) {
    for (let i = 1; i < w.geometry.length; i++) {
      const [ax, ay] = xy(w.geometry[i - 1]!);
      const [bx, by] = xy(w.geometry[i]!);
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) continue;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
      const x = ax + t * dx, y = ay + t * dy;
      const d = Math.hypot(x, y);
      if (!best || d < best.d) best = { d, x, y, dx, dy };
    }
  }
  if (!best) return null;
  const l = Math.hypot(best.dx, best.dy);

  const lx = best.x + (-best.dy / l) * abstandM;
  const ly = best.y + (best.dx / l) * abstandM;
  return { lat: p.lat + ly / M_JE_GRAD, lon: p.lon + lx / (k * M_JE_GRAD) };
}

export function inselDesNaechstenUfers(
  p: { lat: number; lon: number }, ways: readonly UferWay[], inseln: readonly InselRelation[],
): string | null {
  let naechster: UferWay | null = null;
  let best = Infinity;
  for (const w of ways) {
    const d = abstandZurLinieNM(p, w.geometry);
    if (d < best) { best = d; naechster = w; }
  }
  if (!naechster) return null;
  const t = naechster.tags;
  if (t?.name && t.place && INSEL_PLACES.includes(t.place)) return t.name;
  return inseln.find((r) => r.wayIds.includes(naechster!.id))?.name ?? null;
}
