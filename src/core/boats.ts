import { FARR_BAVARIA_50 } from './polar';
import type { BoatPolar } from './polar';
import { ORC_BOATS } from './boatPolars';
import { GENERIC_BOATS } from './genericBoats';

export const ALL_BOATS: readonly BoatPolar[] = [FARR_BAVARIA_50, ...GENERIC_BOATS, ...ORC_BOATS];

export function boatById(id: string): BoatPolar | undefined {
  return ALL_BOATS.find((b) => b.id === id);
}
