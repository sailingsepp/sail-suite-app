
import { relAngle, toRad } from './geo';
import { vmgOptimum } from './vmg';
import { polarSpeed, FARR_BAVARIA_50, type BoatPolar } from './polar';

export interface RevierRandbedingungen {
  boat: BoatPolar;
  crewFactor: number;
  
  vorherrschenderWindDeg: number;
  vorherrschenderWindKn: number;
  
  motorSpeedKn: number;
}


export function referenzfahrtKn(bearing: number, revier: RevierRandbedingungen): number {
  const { boat, crewFactor, vorherrschenderWindDeg, vorherrschenderWindKn, motorSpeedKn } = revier;
  const gamma = relAngle(vorherrschenderWindDeg, bearing);
  const beat = vmgOptimum(vorherrschenderWindKn, crewFactor, true, boat);
  const run = vmgOptimum(vorherrschenderWindKn, crewFactor, false, boat);
  let segelKn: number;
  if (gamma < beat.angle) segelKn = beat.vmg / Math.cos(toRad(gamma));
  else if (gamma > run.angle) segelKn = run.vmg / Math.cos(toRad(180 - gamma));
  else segelKn = polarSpeed(vorherrschenderWindKn, gamma, crewFactor, boat);
  return Math.max(segelKn, motorSpeedKn);
}


export function vorgabeRevier(vorherrschenderWindDeg: number, vorherrschenderWindKn = 15): RevierRandbedingungen {
  return {
    boat: FARR_BAVARIA_50,
    crewFactor: 0.75, 
    vorherrschenderWindDeg,
    vorherrschenderWindKn,
    motorSpeedKn: 6,
  };
}
