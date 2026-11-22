import type { Punkt } from './types';
import { destPoint } from './geo';

export const VTG_ANSAGE_SM = 2;
export const VTG_VORAUS_MIN = 6;

export const VTG_WIEDER_SM = 3;

const MIN_FAHRT_KN = 1;

export interface VtgGebiet { id: string; linien: readonly (readonly Punkt[])[]; name?: string }

function abstandLinie(p: Punkt, linie: readonly Punkt[]): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const xy = (q: Punkt): [number, number] => [(q.lon - p.lon) * 60 * k, (q.lat - p.lat) * 60];
  let best = Infinity;
  for (let i = 0; i < linie.length; i++) {
    const [ax, ay] = xy(linie[i]!);
    if (linie.length === 1) { best = Math.min(best, Math.hypot(ax, ay)); break; }
    if (i === linie.length - 1) break;
    const [bx, by] = xy(linie[i + 1]!);
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function abstandGebiet(p: Punkt, g: VtgGebiet): number {
  let best = Infinity;
  for (const l of g.linien) best = Math.min(best, abstandLinie(p, l));
  return best;
}

export function vtgAnnaeherung(
  boot: Punkt, cogGrad: number | null, sogKn: number | null, gebiete: readonly VtgGebiet[], schonGesagt: ReadonlySet<string>,
): { gebiet: VtgGebiet; sm: number } | null {
  if (cogGrad === null || sogKn === null || sogKn < MIN_FAHRT_KN) return null;
  const [vlat, vlon] = destPoint(boot.lat, boot.lon, cogGrad, sogKn * (VTG_VORAUS_MIN / 60));
  const voraus = { lat: vlat, lon: vlon };
  let treffer: { gebiet: VtgGebiet; sm: number } | null = null;
  for (const g of gebiete) {
    if (schonGesagt.has(g.id)) continue;
    const d = abstandGebiet(boot, g);
    if (d > VTG_ANSAGE_SM || d < 0.05) continue;
    if (abstandGebiet(voraus, g) >= d) continue;
    if (!treffer || d < treffer.sm) treffer = { gebiet: g, sm: d };
  }
  return treffer;
}

export function vtgFreigeben(boot: Punkt, gesagt: Set<string>, gebiete: readonly VtgGebiet[]): void {
  for (const id of [...gesagt]) {
    const g = gebiete.find((x) => x.id === id);
    if (!g || abstandGebiet(boot, g) > VTG_WIEDER_SM) gesagt.delete(id);
  }
}
