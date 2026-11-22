import { FORECAST_DAYS } from '@/data/openMeteo';
import type { Sprache } from '@/core/types';

export const GERECHNET_BIS_TAG = FORECAST_DAYS - 1;

export const NORMALWIND_KN = 12;

export const NORMALWIND_TWA = 90;

export type Lage = 'guenstig' | 'brauchbar' | 'unfahrbar';

export const LAGE_ZEICHEN: Record<Lage, string> = {
  guenstig: '●', brauchbar: '◐', unfahrbar: '○',
};

export const LAGE_TEXT: Record<Sprache, Record<Lage, string>> = {
  de: { guenstig: 'günstig', brauchbar: 'brauchbar', unfahrbar: 'nicht fahrbar' },
  en: { guenstig: 'favourable', brauchbar: 'workable', unfahrbar: 'not sailable' },
};
