
import type { WochenplanErgebnis } from '@/core/wochenplan';
import type { Punkt } from '@/core/types';
import { distNM, bearingDeg } from '@/core/geo';


export function markenJeOrt(
  etappen: WochenplanErgebnis['etappen'],
): Map<number, { tage: number[]; fahrtage: number[] }> {
  const je = new Map<number, { tage: number[]; fahrtage: number[] }>();
  for (const e of etappen) {
    const eintrag = je.get(e.nachIndex) ?? { tage: [], fahrtage: [] };
    eintrag.tage.push(e.tag);
    if (!e.istHafentag) eintrag.fahrtage.push(e.tag);
    je.set(e.nachIndex, eintrag);
  }
  for (const eintrag of je.values()) eintrag.tage.sort((x, y) => x - y);
  return je;
}


export const PFEIL_ANTEIL = 0.4;


export function punktAufWeg(weg: readonly Punkt[], anteil: number): { punkt: Punkt; kursDeg: number } | null {
  if (weg.length < 2) return null;
  const laengen: number[] = [];
  let gesamt = 0;
  for (let i = 1; i < weg.length; i++) {
    const l = distNM(weg[i - 1]!.lat, weg[i - 1]!.lon, weg[i]!.lat, weg[i]!.lon);
    laengen.push(l);
    gesamt += l;
  }
  if (gesamt === 0) return null;
  let rest = anteil * gesamt;
  for (let i = 0; i < laengen.length; i++) {
    const a = weg[i]!, b = weg[i + 1]!;
    if (rest <= laengen[i]! || i === laengen.length - 1) {
      const t = laengen[i]! === 0 ? 0 : Math.min(1, rest / laengen[i]!);
      return {
        punkt: { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) },
        kursDeg: bearingDeg(a.lat, a.lon, b.lat, b.lon),
      };
    }
    rest -= laengen[i]!;
  }
  return null;
}
