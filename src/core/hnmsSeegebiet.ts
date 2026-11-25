import type { HnmsGebietDaten } from './hnmsSeegebieteDaten';

export const NAH_KM = 20;

export const NACHBAR_KM = 5;

export const GRIECHISCHE_GEBIETE = new Set([
  'NORTH IONIO', 'SOUTH IONIO', 'PATRAIKOS', 'KORINTHIAKOS', 'KITHIRA SEA', 'KASTELLORIZO SEA',
  'RODOS SEA', 'KARPATHIO', 'WEST KRITIKO', 'EAST KRITIKO', 'SOUTHWEST AEGEAN', 'SOUTHEAST AEGEAN IKARIO',
  'SAMOS SEA', 'SARONIKOS', 'SOUTH EVVOIKOS', 'KAFIREAS STRAIT', 'CENTRAL AEGEAN', 'NORTHWEST AEGEAN',
  'NORTHEAST AEGEAN', 'THRAKIKO', 'THERMAIKOS',
]);

export interface GebietsTreffer { name: string; code: string; abstandKm: number }

function imRing(lon: number, lat: number, r: number[]): boolean {
  let innen = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const x1 = r[i]!, y1 = r[i + 1]!, x2 = r[j]!, y2 = r[j + 1]!;
    if ((y1 > lat) !== (y2 > lat) && lon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) innen = !innen;
  }
  return innen;
}

function randKm(lon: number, lat: number, r: number[]): number {
  const k = Math.cos((lat * Math.PI) / 180);
  let min = Infinity;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const ax = r[j]! * k, ay = r[j + 1]!, bx = r[i]! * k, by = r[i + 1]!;
    const px = lon * k, py = lat;
    const dx = bx - ax, dy = by - ay;
    const l = dx * dx + dy * dy;
    const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
    min = Math.min(min, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return min * 111.2;
}

export function abstandZumGebietKm(lat: number, lon: number, g: HnmsGebietDaten): number {
  const [umriss, ...inseln] = g.ringe;
  if (!umriss) return Infinity;
  if (imRing(lon, lat, umriss) && !inseln.some((r) => imRing(lon, lat, r))) return 0;
  return Math.min(...g.ringe.map((r) => randKm(lon, lat, r)));
}

export function seegebieteAn(lat: number, lon: number, daten: HnmsGebietDaten[]): GebietsTreffer[] {
  const alle = daten
    .map((g) => ({ name: g.name, code: g.code, abstandKm: abstandZumGebietKm(lat, lon, g) }))
    .sort((a, b) => a.abstandKm - b.abstandKm);
  const erstes = alle[0];
  if (!erstes || erstes.abstandKm > NAH_KM) return [];
  return alle.filter((t, i) => i === 0 || t.abstandKm <= NACHBAR_KM);
}

export function seegebieteEntlang(punkte: { lat: number; lon: number }[], daten: HnmsGebietDaten[]): string[] {
  const out: string[] = [];
  for (const p of punkte) {
    for (const t of seegebieteAn(p.lat, p.lon, daten)) if (!out.includes(t.name)) out.push(t.name);
  }
  return out;
}

export function istGriechisch(gebiete: string[]): boolean {
  return gebiete.some((n) => GRIECHISCHE_GEBIETE.has(n));
}
