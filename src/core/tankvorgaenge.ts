export interface Tankvorgang {

  datum: string | null;
  liter: number;

  ort: string | null;

  motorstand?: number | null;
}

export const MAX_TANKVORGAENGE = 100;
export const ORT_MAX = 100;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export function tankvorgangGueltig(x: unknown): x is Tankvorgang {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const liter = o['liter'];
  const datum = o['datum'];
  const ort = o['ort'];
  const stand = o['motorstand'];
  return typeof liter === 'number' && Number.isFinite(liter) && liter >= 0 && liter < 100_000
    && (datum === null || (typeof datum === 'string' && DATUM.test(datum)))
    && (ort === null || (typeof ort === 'string' && ort.length <= ORT_MAX))
    && (stand === undefined || stand === null || (typeof stand === 'number' && Number.isFinite(stand) && stand >= 0 && stand < 1_000_000));
}

export function summeLiter(vorgaenge: readonly Tankvorgang[]): number | null {
  if (!vorgaenge.length) return null;

  return Math.round(vorgaenge.reduce((s, v) => s + v.liter, 0) * 10) / 10;
}

export function tankvorgaengeAus(t: { tankvorgaenge?: readonly Tankvorgang[] | null; dieselGetanktL?: number | null } | null | undefined): Tankvorgang[] {
  if (!t) return [];
  if (Array.isArray(t.tankvorgaenge)) {
    return t.tankvorgaenge.map((v) => ({
      datum: v.datum ?? null, liter: v.liter, ort: v.ort ?? null, ...(typeof v.motorstand === 'number' ? { motorstand: v.motorstand } : {}),
    }));
  }
  return t.dieselGetanktL != null ? [{ datum: null, liter: t.dieselGetanktL, ort: null }] : [];
}

export function nurSumme(vorgaenge: readonly Tankvorgang[]): boolean {
  return vorgaenge.length === 0
    || (vorgaenge.length === 1 && vorgaenge[0]!.datum === null && vorgaenge[0]!.ort === null && vorgaenge[0]!.motorstand == null);
}

export function sortiereTankvorgaenge(vorgaenge: readonly Tankvorgang[]): Tankvorgang[] {
  return vorgaenge
    .map((v, i) => ({ v, i }))
    .sort((a, b) => {
      if (a.v.datum && b.v.datum && a.v.datum !== b.v.datum) return a.v.datum < b.v.datum ? -1 : 1;
      if (a.v.datum && !b.v.datum) return -1;
      if (!a.v.datum && b.v.datum) return 1;
      return a.i - b.i;
    })
    .map((x) => x.v);
}

export function verbrauchJeIntervall(
  vorgaenge: readonly Tankvorgang[], minStunden = 1,
): ({ literJeStunde: number; stunden: number; liter: number; seit: Tankvorgang } | null)[] {
  const s = sortiereTankvorgaenge(vorgaenge);
  const aus: ({ literJeStunde: number; stunden: number; liter: number; seit: Tankvorgang } | null)[] = s.map(() => null);
  let vorher = -1;
  for (let i = 0; i < s.length; i++) {
    const stand = s[i]!.motorstand;
    if (typeof stand !== 'number' || !Number.isFinite(stand)) continue;
    if (vorher >= 0) {
      const davor = s[vorher]!;
      const stunden = stand - davor.motorstand!;
      const liter = s.slice(vorher + 1, i + 1).reduce((x, v) => x + v.liter, 0);
      if (stunden >= minStunden && liter > 0) aus[i] = { literJeStunde: liter / stunden, stunden, liter, seit: davor };
    }
    vorher = i;
  }
  return aus;
}

