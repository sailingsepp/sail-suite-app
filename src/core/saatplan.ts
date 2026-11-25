import { distNM } from './geo';
import {
  TOERNVORSCHLAEGE, type Toernvorschlag, type ToernvorschlagRevier, type ToernvorschlagRoutenart,
} from './toernvorschlaege';
import type { Hafenknoten } from './hafennetz';
import type { Punkt } from './types';

export const SAATPLAN_SCHWELLE_NM = 3;

export function waehleToernvorschlag(
  revier: ToernvorschlagRevier, routenart: ToernvorschlagRoutenart, start: Punkt,
  vorschlaege: readonly Toernvorschlag[] = TOERNVORSCHLAEGE,
): Toernvorschlag | null {
  let bester: Toernvorschlag | null = null;
  let besteDistanz = Infinity;
  for (const v of vorschlaege) {
    if (v.revier !== revier || v.routenart !== routenart) continue;
    const erster = v.kette[0];
    if (!erster) continue;
    const d = distNM(start.lat, start.lon, erster.lat, erster.lon);
    if (d < besteDistanz) { besteDistanz = d; bester = v; }
  }
  return bester;
}

export function waehleToernvorschlaege(
  revier: ToernvorschlagRevier, routenart: ToernvorschlagRoutenart, start: Punkt,
  anzahl = 3, maxStartSm = 15, vorschlaege: readonly Toernvorschlag[] = TOERNVORSCHLAEGE,
): Toernvorschlag[] {
  return vorschlaege
    .filter((v) => v.revier === revier && v.routenart === routenart && v.kette[0] != null)
    .map((v) => ({ v, d: distNM(start.lat, start.lon, v.kette[0]!.lat, v.kette[0]!.lon) }))
    .filter((x) => x.d <= maxStartSm)
    .sort((a, b) => a.d - b.d)
    .slice(0, anzahl)
    .map((x) => x.v);
}

export interface SaatplanKette {
  routeId: string;

  knotenIndizes: number[];
}

export function bildeKetteAufNetzAb(
  vorschlag: Toernvorschlag, knoten: readonly Hafenknoten[], schwelleNM = SAATPLAN_SCHWELLE_NM,
): SaatplanKette | null {
  const knotenIndizes: number[] = [];
  for (const ort of vorschlag.kette) {
    let bester = -1, besteDistanz = Infinity;
    knoten.forEach((k, i) => {
      const d = distNM(ort.lat, ort.lon, k.ort.lat, k.ort.lon);
      if (d < besteDistanz) { besteDistanz = d; bester = i; }
    });
    if (bester === -1 || besteDistanz > schwelleNM) return null;
    knotenIndizes.push(bester);
  }
  return { routeId: vorschlag.routeId, knotenIndizes };
}
