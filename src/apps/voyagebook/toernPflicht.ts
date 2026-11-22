
import type { ToernFunktion } from '@/data/toernApi';
import { istUeberstellung } from '@/core/ueberstellung';

export { istUeberstellung };

export type FehlendeAngabe = 'name' | 'start' | 'ende' | 'von' | 'bis' | 'zeitraum' | 'skipper';

export interface ToernFormularStand {
  name: string;
  von: string;
  bis: string;
  start: unknown;
  ende: unknown;
  
  meineFunktion?: ToernFunktion;
  skipperVorname?: string;
}

export function fehlendeAngaben(f: ToernFormularStand): FehlendeAngabe[] {
  const fehlt: FehlendeAngabe[] = [];
  if (!f.name.trim()) fehlt.push('name');
  if (f.start == null) fehlt.push('start');
  if (!f.von) fehlt.push('von');
  
  if (f.von && f.bis && f.bis <= f.von) fehlt.push('zeitraum');
  if (f.meineFunktion && f.meineFunktion !== 'skipper' && !f.skipperVorname?.trim()) fehlt.push('skipper');
  return fehlt;
}


export function nimmtLetztenSkipper(
  crew: readonly { id: string; funktion: ToernFunktion }[], mitgliedId: string, neueFunktion: ToernFunktion,
): boolean {
  const bisher = crew.find((m) => m.id === mitgliedId)?.funktion;
  if (bisher !== 'skipper' || neueFunktion === 'skipper') return false;
  return !crew.some((m) => m.id !== mitgliedId && m.funktion === 'skipper');
}
