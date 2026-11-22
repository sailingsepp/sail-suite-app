import { nf } from '@/core/time';
import type { Sprache } from '@/core/types';

export function grenzwertAngabe(
  name: string, wert: number, grenze: number, stellen: number, einheit: string, sprache: Sprache,
): string {
  const angezeigt = Number(wert.toFixed(stellen));
  const w = nf(angezeigt, stellen, sprache);
  const g = nf(grenze, stellen === 0 ? 0 : Number.isInteger(grenze) ? 0 : stellen, sprache);
  if (angezeigt > grenze) return `${name} ${w} ${einheit} > ${g} ${einheit}`;
  return sprache === 'en'
    ? `${name} ${w} ${einheit}, just above the ${g} ${einheit} limit`
    : `${name} ${w} ${einheit}, knapp über dem Grenzwert ${g} ${einheit}`;
}
