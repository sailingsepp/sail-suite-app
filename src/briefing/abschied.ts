import type { Sprache } from '@/core/types';
import { hoheitsStaat, type Gebietsangabe } from './seegebiet';

const GRUSS: Record<string, string> = {
  croatian: 'Mirno more!',
  italian: 'Buon vento!',
  greek: 'Kalés thálasses!',
  french: 'Bon vent !',
  spanish: '¡Buen viento y buena mar!',
};

export const ENGLISCHER_GRUSS = 'Fair winds and following seas!';

export function zielStaat(gebiet: Gebietsangabe | null | undefined): string | null {
  if (!gebiet) return null;
  return (gebiet.hoheit ? hoheitsStaat(gebiet.hoheit) : null) ?? (gebiet.awz ? hoheitsStaat(gebiet.awz) : null);
}

export function abschiedsgruss(staat: string | null, sprache: Sprache): string {
  const land = staat ? GRUSS[staat] : undefined;
  if (sprache === 'en') return land ? `${ENGLISCHER_GRUSS} ${land}` : ENGLISCHER_GRUSS;
  return `Gute Fahrt und ${land ?? 'fair winds and following seas!'}`;
}
