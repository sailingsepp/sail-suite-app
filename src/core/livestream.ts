import { distNM } from './geo';

export const LIVE_TAKT_MS = 5 * 60_000;
export const LIVE_PUNKT_ABSTAND_MS = 30_000;

export const LIVE_PUNKTE_SENDEN_MAX = 5000;
export const LIVE_EINTRAEGE_SENDEN_MAX = 1800;

export function aufHoechstens<T>(punkte: readonly T[], max: number): T[] {
  if (punkte.length <= max) return [...punkte];
  const jung = Math.floor(max / 2);
  const alt = punkte.slice(0, punkte.length - jung);
  const platz = max - jung;
  const schritt = alt.length / platz;
  const duenn: T[] = [];
  for (let i = 0; i < platz; i++) duenn.push(alt[Math.floor(i * schritt)]!);
  return [...duenn, ...punkte.slice(punkte.length - jung)];
}

export interface LiveFix { t: number; lat: number; lon: number; acc?: number }

export const LIVE_GENAUIGKEIT_MAX_M = 50;

export function livePunkte(
  fixe: readonly LiveFix[], seit: number, abstandMs = LIVE_PUNKT_ABSTAND_MS,
): [number, number, number][] {
  const aus: [number, number, number][] = [];
  let zuletzt = seit;
  const neue = fixe.filter((f) => f.t > seit && !(Number.isFinite(f.acc) && f.acc! > LIVE_GENAUIGKEIT_MAX_M));
  neue.forEach((f, i) => {
    if (f.t - zuletzt >= abstandMs || i === neue.length - 1) {
      aus.push([f.t, Math.round(f.lat * 1e6) / 1e6, Math.round(f.lon * 1e6) / 1e6]);
      zuletzt = f.t;
    }
  });
  return aufHoechstens(aus, LIVE_PUNKTE_SENDEN_MAX);
}

export const TAKT_UNTERWEGS_MS = 30_000;
export const MIN_ABSTAND_MS = 10_000;
export const KUEG_SCHWELLE_GRAD = 5;

export const FUEG_SCHWELLE_KN = 0.2;

export const KUEG_AB_KN = 1;

export interface Gemeldet { t: number; sog: number | null; cog: number | null }

export function kursDifferenz(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

export function liveAnlass(letzte: Gemeldet | null, jetzt: Gemeldet): 'aenderung' | 'takt' | null {
  if (!letzte) return 'aenderung';
  const seit = jetzt.t - letzte.t;
  if (seit >= TAKT_UNTERWEGS_MS) return 'takt';
  if (seit < MIN_ABSTAND_MS) return null;
  const fahrt = letzte.sog != null && jetzt.sog != null && Math.abs(jetzt.sog - letzte.sog) >= FUEG_SCHWELLE_KN - 1e-9;
  const kurs = letzte.cog != null && jetzt.cog != null
    && Math.max(letzte.sog ?? 0, jetzt.sog ?? 0) >= KUEG_AB_KN
    && kursDifferenz(letzte.cog, jetzt.cog) >= KUEG_SCHWELLE_GRAD;
  const neuDa = (letzte.cog == null) !== (jetzt.cog == null) || (letzte.sog == null) !== (jetzt.sog == null);
  return fahrt || kurs || neuDa ? 'aenderung' : null;
}

export function logMerkmal(eintraege: readonly { t: number; art: string; text?: string }[]): string {
  let h = 0;
  for (const e of eintraege) {
    const s = `${e.t}|${e.art}|${e.text ?? ''}`;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return `${eintraege.length}:${h}`;
}

export const STOPP_NACHMELDEN_TAGE = 7;

export function stoppZuMelden<F extends { id: string; toern?: string; beendet: number | null }>(
  fahrten: readonly F[], laeuftEine: boolean, gemeldet: string | null, jetzt: number,
): F | null {
  if (laeuftEine) return null;
  const f = fahrten.find((x) => x.toern);
  if (!f || f.beendet === null || f.id === gemeldet) return null;
  return jetzt - f.beendet <= STOPP_NACHMELDEN_TAGE * 86_400_000 ? f : null;
}

export const SPRUNG_KN = 40;

export const SPRUNG_MIN_SM = 0.1;

export const SPRUNG_LAUF_MAX = 3;

export function ohneSpruenge<P extends readonly [number, number, number]>(punkte: readonly P[], maxKn = SPRUNG_KN): P[] {
  const aus: P[] = [];
  let verworfen: P[] = [];
  for (const p of punkte) {
    const v = aus[aus.length - 1];
    if (!v) { aus.push(p); continue; }
    const sm = distNM(v[1], v[2], p[1], p[2]);
    const h = (p[0] - v[0]) / 3_600_000;
    if (sm <= SPRUNG_MIN_SM || (h > 0 && sm / h <= maxKn)) { aus.push(p); verworfen = []; continue; }
    verworfen.push(p);
    if (verworfen.length > SPRUNG_LAUF_MAX) { aus.push(...verworfen); verworfen = []; }
  }
  return aus;
}
