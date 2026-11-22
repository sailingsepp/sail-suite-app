export const SCHRITT_MS = 10 * 60_000;
const H = 3_600_000;

export interface Messwert { t: number; m: number }

export function zehnminutenreihe(roh: readonly Messwert[]): Map<number, number> {
  const sum = new Map<number, [number, number]>();
  for (const { t, m } of roh) {
    if (!Number.isFinite(m) || Math.abs(m) > 20) continue;
    const k = Math.floor(t / SCHRITT_MS) * SCHRITT_MS;
    const a = sum.get(k) ?? [0, 0]; a[0] += m; a[1]++; sum.set(k, a);
  }
  const mittel = new Map([...sum].map(([t, [s, n]]) => [t, s / n] as [number, number]));
  const out = new Map<number, number>();
  for (const [t, v] of mittel) {
    const a = mittel.get(t - SCHRITT_MS), b = mittel.get(t + SCHRITT_MS);
    if (a == null || b == null) { out.set(t, v); continue; }
    const median = [a, v, b].sort((x, y) => x - y)[1]!;

    if (Math.abs(v - median) > 3 * Math.max(Math.abs(a - b), 0.02)) continue;
    out.set(t, v);
  }
  return out;
}

function gleitend(q: Map<number, number>, halb: number): Map<number, number> {
  const out = new Map<number, number>();
  for (const t of q.keys()) {
    let s = 0, n = 0;
    for (let d = -halb; d <= halb; d++) { const v = q.get(t + d * SCHRITT_MS); if (v != null) { s += v; n++; } }
    if (n > halb) out.set(t, s / n);
  }
  return out;
}

export function gezeitenAnteil(q: Map<number, number>): Map<number, number> {
  const lang = gleitend(q, 75);
  const hp = new Map<number, number>();
  for (const [t, v] of q) { const m = lang.get(t); if (m != null) hp.set(t, v - m); }
  return gleitend(hp, 3);
}

export interface Vergleich {

  n: number;

  tage: number;

  r0: number;

  versatzMin: number;
  rBest: number;

  steigung: number;

  spanne: number;
}

export function vergleiche(
  messung: Map<number, number>, modell: (t: number) => number, vorzeichen: 1 | -1 = 1, maxVersatzMin = 180,
): Vergleich | null {
  const zeiten = [...messung.keys()].sort((a, b) => a - b);
  if (zeiten.length < 6 * 24 * 3) return null;
  const von = zeiten[0]! - (maxVersatzMin + 13 * 60) * 60_000, bis = zeiten.at(-1)! + (maxVersatzMin + 13 * 60) * 60_000;
  const roh = new Map<number, number>();
  for (let t = Math.floor(von / SCHRITT_MS) * SCHRITT_MS; t <= bis; t += SCHRITT_MS) roh.set(t, vorzeichen * modell(t));
  const m = gezeitenAnteil(roh);
  const paare = (lagMin: number): [number, number][] => {
    const out: [number, number][] = [];
    for (const t of zeiten) { const p = m.get(t - lagMin * 60_000); if (p != null) out.push([p, messung.get(t)!]); }
    return out;
  };
  const statistik = (xs: [number, number][]) => {
    const n = xs.length;
    let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (const [x, y] of xs) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; }
    const vx = sxx - (sx * sx) / n, vy = syy - (sy * sy) / n, cxy = sxy - (sx * sy) / n;
    return { r: cxy / Math.sqrt(vx * vy), steigung: cxy / vx };
  };
  let best = { lag: 0, r: -2, steigung: 0 };
  let r0 = 0;
  for (let lag = -maxVersatzMin; lag <= maxVersatzMin; lag += 10) {
    const s = statistik(paare(lag));
    if (lag === 0) r0 = s.r;
    if (s.r > best.r) best = { lag, r: s.r, steigung: s.steigung };
  }
  const werte = zeiten.map((t) => m.get(t)).filter((v): v is number => v != null);
  return {
    n: zeiten.length, tage: (zeiten.at(-1)! - zeiten[0]!) / (24 * H), r0, versatzMin: best.lag, rBest: best.r,
    steigung: best.steigung, spanne: Math.max(...werte) - Math.min(...werte),
  };
}

export type Urteil = 'ok' | 'abweichend' | 'schwach' | 'umgekehrt' | 'keine Daten';

export const R_DEUTLICH = 0.6;

export const VERSATZ_OK_MIN = 30;

export const R_KLAR = 0.8;

export const STEIGUNG_OK: readonly [number, number] = [0.6, 1.6];

export function urteil(v: Vergleich | null): Urteil {
  if (!v || v.tage < 5 || !Number.isFinite(v.rBest) || !Number.isFinite(v.r0)) return 'keine Daten';

  if (v.r0 <= -R_DEUTLICH) return 'umgekehrt';
  if (v.rBest < R_DEUTLICH) return 'schwach';
  if (Math.abs(v.versatzMin) > VERSATZ_OK_MIN) return 'abweichend';
  if (v.rBest >= R_KLAR && (v.steigung < STEIGUNG_OK[0] || v.steigung > STEIGUNG_OK[1])) return 'abweichend';
  return 'ok';
}
