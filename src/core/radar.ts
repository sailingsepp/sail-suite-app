export const RADAR_STUFEN: readonly { dbz: number; rgb: readonly [number, number, number] }[] = [
  { dbz: 10, rgb: [150, 210, 255] },
  { dbz: 20, rgb: [40, 130, 240] },
  { dbz: 30, rgb: [20, 180, 60] },
  { dbz: 40, rgb: [250, 210, 0] },
  { dbz: 50, rgb: [240, 90, 0] },
  { dbz: 55, rgb: [200, 0, 160] },
];

export const RADAR_OHNE_RGB: readonly [number, number, number] = [170, 170, 170];

export const RADAR_TAKT_MS = 5 * 60_000;

export const RADAR_BILD_MS = 600;
export const RADAR_HALT_MS = 2000;

export function naechstesBild(i: number, anzahl: number): { i: number; warte: number } {
  if (anzahl < 2) return { i: Math.max(0, anzahl - 1), warte: RADAR_HALT_MS };
  return i >= anzahl - 1 ? { i: 0, warte: RADAR_HALT_MS } : { i: i + 1, warte: RADAR_BILD_MS };
}

export function regenrateMmH(dbz: number): number {
  return (10 ** (dbz / 10) / 200) ** (1 / 1.6);
}

export interface RadarBildDaten {

  zeit: number;

  bild: string;
}

export interface RadarDaten {

  zeit: number;

  bild: string;

  bilder: RadarBildDaten[];

  grenzen: [[number, number], [number, number]];
}

export function radarAntwort(j: unknown): RadarDaten | null {
  const d = j as { zeit?: unknown; bild?: unknown; grenzen?: unknown } | null;
  if (!d || typeof d.zeit !== 'string' || typeof d.bild !== 'string' || !d.bild.startsWith('/api/radar/')) return null;
  const zeit = Date.parse(d.zeit);
  const g = d.grenzen;
  const zahlen = Array.isArray(g) && g.length === 2 && g.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'number' && Number.isFinite(x)));
  if (!Number.isFinite(zeit) || !zahlen) return null;
  const [[s, w], [n, o]] = g as [[number, number], [number, number]];
  if (!(s < n && w < o)) return null;

  const roh = (j as { bilder?: unknown }).bilder;
  const bilder = (Array.isArray(roh) ? roh : [])
    .map((b: { zeit?: unknown; bild?: unknown }) => ({ zeit: typeof b?.zeit === 'string' ? Date.parse(b.zeit) : NaN, bild: b?.bild }))
    .filter((b): b is RadarBildDaten => Number.isFinite(b.zeit) && typeof b.bild === 'string' && b.bild.startsWith('/api/radar/'))
    .sort((a, b) => a.zeit - b.zeit);
  if (!bilder.length || bilder.at(-1)!.zeit !== zeit) bilder.push({ zeit, bild: d.bild });
  return { zeit, bild: d.bild, bilder, grenzen: [[s, w], [n, o]] };
}
