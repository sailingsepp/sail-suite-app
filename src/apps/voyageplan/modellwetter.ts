
import { fetchWindEnsemble } from '@/data/ensemble';
import { modellUebereinstimmung } from '@/core/modellsicherheit';
import type { Punkt } from '@/core/types';


export const ENSEMBLE_TAGE_MAX = 5;


export type ModellUebereinstimmungJeTag = ReadonlyMap<string, number>;


export async function holeModellUebereinstimmung(
  start: Punkt, tage: readonly string[],
): Promise<ModellUebereinstimmungJeTag> {
  const ergebnis = new Map<string, number>();
  if (tage.length === 0) return ergebnis;
  try {
    const ensemble = await fetchWindEnsemble(start.lat, start.lon, ENSEMBLE_TAGE_MAX);
    if (!ensemble) return ergebnis;
    for (const tag of tage) {
      const wert = modellUebereinstimmung(ensemble, tag);
      
      
      if (wert != null) ergebnis.set(tag, wert);
    }
  } catch {
    
  }
  return ergebnis;
}
