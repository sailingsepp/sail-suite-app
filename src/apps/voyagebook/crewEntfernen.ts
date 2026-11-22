export type ToernPhase = 'angelegt' | 'aktiv' | 'begonnen' | 'beendet';

interface PhasenAngaben {
  von: string | null;
  bis: string | null;
  beendet: string | null;
  istAktiv?: boolean;
}

function heuteLokal(jetzt: Date): string {
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}`;
}

export function toernPhase(t: PhasenAngaben, jetzt: Date = new Date()): ToernPhase {
  const heute = heuteLokal(jetzt);
  if (t.beendet || (t.bis && heute > t.bis)) return 'beendet';
  if (t.von && heute >= t.von) return 'begonnen';
  if (t.istAktiv) return 'aktiv';
  return 'angelegt';
}

export function entfernenFrageSchluessel(t: PhasenAngaben, platzhalter: boolean, jetzt?: Date): string {
  return platzhalter ? 'detail.crewEntfernenFragePlatzhalterIn' : `detail.crewEntfernenFrage.${toernPhase(t, jetzt)}`;
}
