export interface BoatPolar {
  id: string;
  name: string;
  referenceHeight: 'mast' | '10m';
  tws: readonly number[];
  twa: readonly number[];
  speed: readonly (readonly number[])[];
  sourceNote: string;

  extended?: boolean;
}

const POLAR_TWS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35];
const POLAR_TWA = [30, 33, 36, 39, 42, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170, 180];
// Polar tables of third parties are not part of this repository.
const POLAR_SPEED: number[][] = POLAR_TWA.map(() => POLAR_TWS.map(() => 0));

export const FARR_BAVARIA_50: BoatPolar = {
  id: 'farr-bavaria-cruiser-50',
  name: 'Bavaria 50',
  referenceHeight: 'mast',
  sourceNote: 'Farr Yacht Design, Performance Prediction Design 680, 2011: "Best Boatspeeds (kt)", Rough water, unveraendert, Referenzpolare der App',
  tws: POLAR_TWS,
  twa: POLAR_TWA,
  speed: POLAR_SPEED,
};

export const STEEP_SEA = 1 / 25;

export const STEEP_SEA_SEHR = 1 / 17;
export const STEEP_SEA_EXTREM = 1 / 10;

export function steilStufe(steilheit: number): 0 | 1 | 2 | 3 {
  if (!(steilheit > STEEP_SEA)) return 0;
  const x = Math.round(1 / steilheit);
  return x <= Math.round(1 / STEEP_SEA_EXTREM) ? 3 : x <= Math.round(1 / STEEP_SEA_SEHR) ? 2 : 1;
}

export const MIN_STEIL_HS = 0.3;

const MAST_HEIGHT_M = 19, WIND_SHEAR_ALPHA = 0.11;
export const MAST_FACTOR = Math.pow(MAST_HEIGHT_M / 10, WIND_SHEAR_ALPHA);

const SHEAR_REF_HOEHE_M = 80;

const SHEAR_MIN_WIND_KN = 3;

const SHEAR_ALPHA_MIN = 0.04, SHEAR_ALPHA_MAX = 0.35;

export function mastFaktorEffektiv(speed10: number, speed80: number | null): number {
  if (speed80 == null || speed10 < SHEAR_MIN_WIND_KN) return MAST_FACTOR;
  const alpha = Math.log(speed80 / speed10) / Math.log(SHEAR_REF_HOEHE_M / 10);
  if (!Number.isFinite(alpha)) return MAST_FACTOR;
  const alphaC = Math.min(SHEAR_ALPHA_MAX, Math.max(SHEAR_ALPHA_MIN, alpha));
  return Math.pow(MAST_HEIGHT_M / 10, alphaC);
}

export function polarSpeed(tws: number, twa: number, crewFactor: number, boat: BoatPolar = FARR_BAVARIA_50): number {
  const twaArr = boat.twa, twsArr = boat.tws, speedArr = boat.speed;
  const twsMin = twsArr[0]!, twsMax = twsArr[twsArr.length - 1]!;
  const twsC = Math.min(Math.max(tws, twsMin), twsMax);
  const twaC = Math.min(Math.max(twa, twaArr[0]!), twaArr[twaArr.length - 1]!);
  let i1 = twaArr.findIndex((a) => a >= twaC); if (i1 <= 0) i1 = 1;
  const i0 = i1 - 1;
  let j1 = twsArr.findIndex((s) => s >= twsC); if (j1 <= 0) j1 = 1;
  const j0 = j1 - 1;
  const ta0 = twaArr[i0]!, ta1 = twaArr[i1]!, ts0 = twsArr[j0]!, ts1 = twsArr[j1]!;
  const fa = ta1 > ta0 ? (twaC - ta0) / (ta1 - ta0) : 0;
  const fs = ts1 > ts0 ? (twsC - ts0) / (ts1 - ts0) : 0;
  const v00 = speedArr[i0]![j0]!, v01 = speedArr[i0]![j1]!, v10 = speedArr[i1]![j0]!, v11 = speedArr[i1]![j1]!;
  const v0 = v00 + (v01 - v00) * fs;
  const v1 = v10 + (v11 - v10) * fs;
  const v = (v0 + (v1 - v0) * fa) * crewFactor;

  return tws < twsMin ? v * Math.max(0, tws / twsMin) : v;
}
