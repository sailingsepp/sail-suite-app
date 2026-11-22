import type { WindEnsemble } from '@/data/ensemble';




const STREUUNG_NIEDRIG_KN = 1.0;

const STREUUNG_HOCH_KN = 6.0;
const PROZENT_MAX = 95;
const PROZENT_MIN = 30;


function streuung(werte: (number | null)[]): number | null {
  const gueltig = werte.filter((v): v is number => v != null && Number.isFinite(v));
  if (gueltig.length < 2) return null;
  const mittel = gueltig.reduce((a, b) => a + b, 0) / gueltig.length;
  const varianz = gueltig.reduce((a, b) => a + (b - mittel) ** 2, 0) / gueltig.length;
  return Math.sqrt(varianz);
}


export function modellUebereinstimmung(ensemble: WindEnsemble, dateStr: string): number | null {
  const idxs: number[] = [];
  ensemble.time.forEach((t, i) => { if (t.startsWith(dateStr)) idxs.push(i); });
  if (idxs.length === 0) return null;

  const streuungenJeStunde = idxs
    .map((i) => streuung(ensemble.mitglieder.map((lauf) => lauf[i] ?? null)))
    .filter((s): s is number => s != null);
  if (streuungenJeStunde.length === 0) return null;

  const mittlereStreuung = streuungenJeStunde.reduce((a, b) => a + b, 0) / streuungenJeStunde.length;
  const anteil = Math.min(1, Math.max(0,
    (mittlereStreuung - STREUUNG_NIEDRIG_KN) / (STREUUNG_HOCH_KN - STREUUNG_NIEDRIG_KN)));
  return Math.round(PROZENT_MAX - anteil * (PROZENT_MAX - PROZENT_MIN));
}
