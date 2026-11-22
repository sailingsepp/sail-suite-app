import type { Ablegezeit } from './types';


export const MAX_SCHRITTE = 12;

export function ablegenFuerAnkunft(ziel: Date, rechne: (t: Date) => Ablegezeit, schaetzungH: number): Ablegezeit {
  const minute = (ms: number) => new Date(Math.floor(ms / 60_000) * 60_000);
  let t = minute(ziel.getTime() - schaetzungH * 3_600_000);
  let r = rechne(t);
  for (let i = 0; i < MAX_SCHRITTE; i++) {
    const versatz = r.arrival.getTime() - ziel.getTime();
    if (Math.abs(versatz) < 60_000) break;
    t = minute(t.getTime() - versatz);
    r = rechne(t);
  }
  for (let i = 0; i < 30 && r.arrival > ziel; i++) {
    t = new Date(t.getTime() - 60_000);
    r = rechne(t);
  }
  return r;
}


export function ankunftsZeitpunkt(dateStr: string, hhmm: string, abJetzt: boolean, jetzt: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const z = new Date(`${dateStr}T${m[1]!.padStart(2, '0')}:${m[2]}:00Z`);
  if (Number.isNaN(z.getTime())) return null;
  return abJetzt && z <= jetzt ? new Date(z.getTime() + 86_400_000) : z;
}


export function noetigeFahrt(r: Ablegezeit, ziel: Date): number | null {
  const stunden = (ziel.getTime() - r.departure.getTime()) / 3_600_000 - r.manHrs - (r.haltHrs ?? 0);
  if (!(stunden > 0)) return null;
  return (r.avgSpeed * r.sailHrs) / stunden;
}
