import { nf } from '@/core/time';
import type { Sprache } from '@/core/types';


export const smEinheit = (sprache: Sprache): string => (sprache === 'en' ? 'NM' : 'sm');
export const smText = (x: number, stellen: number, sprache: Sprache): string => `${nf(x, stellen, sprache)} ${smEinheit(sprache)}`;
