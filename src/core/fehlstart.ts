import { distNM } from './geo';

export interface Fenster { von: number; bis: number; radiusNm: number }
export interface Ort { lat: number; lon: number }

export const FEHLSTART_RADIUS_NM = 50;

export const FEHLSTART_TROPEA: Fenster = {
  von: Date.UTC(2026, 10, 14, 23, 0),
  bis: Date.UTC(2026, 10, 16, 23, 0),
  radiusNm: FEHLSTART_RADIUS_NM,
};

export const WEITER_TOLERANZ_NM = 1;

export function abstandZurYacht(geraet: Ort & { accM?: number | null }, yacht: Ort): number | null {
  const d = distNM(geraet.lat, geraet.lon, yacht.lat, yacht.lon);
  const acc = geraet.accM != null && Number.isFinite(geraet.accM) ? geraet.accM / 1852 : 0;
  return d > WEITER_TOLERANZ_NM + acc ? d : null;
}

export function istFern(p: { lat: number | null; lon: number | null }, bezug: Ort, radiusNm: number): boolean {
  if (p.lat == null || p.lon == null || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
  return distNM(p.lat, p.lon, bezug.lat, bezug.lon) > radiusNm;
}

export const imFenster = (t: number, f: Fenster): boolean => t >= f.von && t < f.bis;

export function fernImFenster<T extends { t: number; lat: number | null; lon: number | null }>(
  punkte: readonly T[], bezug: Ort, f: Fenster,
): T[] {
  return punkte.filter((p) => imFenster(p.t, f) && istFern(p, bezug, f.radiusNm));
}

export function bezugVor(fixe: readonly { t: number; lat: number; lon: number }[], f: Fenster): Ort | null {
  let best: { t: number; lat: number; lon: number } | null = null;
  for (const x of fixe) if (x.t < f.von && (!best || x.t > best.t)) best = x;
  return best ? { lat: best.lat, lon: best.lon } : null;
}

export function pausenZusammen(
  pausen: readonly { von: number; bis: number }[], offenSeit: number | null,
  fixZeiten: readonly number[], f: Fenster,
): { pausen: { von: number; bis: number }[]; offenSeit: number | null } {
  const sortiert = [...pausen].sort((a, b) => a.von - b.von);
  const leer = (a: number, b: number) => !fixZeiten.some((t) => t > a && t < b);
  const aus: { von: number; bis: number }[] = [];
  for (const p of sortiert) {
    const vorige = aus[aus.length - 1];
    if (vorige && imFenster(vorige.bis, f) && p.von >= vorige.bis && leer(vorige.bis, p.von)) vorige.bis = Math.max(vorige.bis, p.bis);
    else aus.push({ ...p });
  }
  let offen = offenSeit;
  const letzte = aus[aus.length - 1];
  if (offen !== null && letzte && imFenster(letzte.bis, f) && offen >= letzte.bis && leer(letzte.bis, offen)) {
    offen = letzte.von;
    aus.pop();
  }
  return { pausen: aus, offenSeit: offen };
}
