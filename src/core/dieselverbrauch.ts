export const VERBRAUCH_MIN_STUNDEN = 1;

export function dieselJeStunde(liter: number | undefined, motorStunden: number): number | null {
  if (liter === undefined || !Number.isFinite(liter) || !(liter > 0)) return null;
  if (!Number.isFinite(motorStunden) || motorStunden < VERBRAUCH_MIN_STUNDEN) return null;
  return liter / motorStunden;
}

export function literGueltig(n: number | undefined): boolean {
  return n === undefined || (Number.isFinite(n) && n >= 0);
}
