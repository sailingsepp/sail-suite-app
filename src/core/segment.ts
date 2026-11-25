import { toRad, toDeg, uv, bearingOf, relAngle } from './geo';
import { polarSpeed, mastFaktorEffektiv } from './polar';
import { vmgOptimum } from './vmg';
import type { SchiffConfig, SegmentLoesung } from './types';

export interface SegWind {
  speed: number;
  dir: number;

  speed80?: number | null;
}

export interface SegCurrent {
  speed: number;
  dir: number;
}

interface Kurs {
  h: number;
  v: number;
  sog: number;
  held: boolean;
  twa?: number;
  targetTwa?: number;
  beating?: boolean;
  gybing?: boolean;
  beatAngle?: number;
  stwReal?: number;
}

export function solveSegment(
  course: number,
  wind: SegWind,
  cur: SegCurrent,
  cfg: SchiffConfig,
): SegmentLoesung {

  const [wux, wuy] = uv(wind.dir + 180);

  const mastFactor = cfg.boat.referenceHeight === 'mast'
    ? mastFaktorEffektiv(wind.speed, wind.speed80 ?? null)
    : 1;

  const Wx = wind.speed * mastFactor * wux, Wy = wind.speed * mastFactor * wuy;
  const [cux, cuy] = uv(cur.dir);
  const Cx = cur.speed * cux, Cy = cur.speed * cuy;

  const sws = Math.hypot(Wx - Cx, Wy - Cy);
  const swFrom = bearingOf(-(Wx - Cx), -(Wy - Cy));

  const sws10 = sws / mastFactor;
  const targetTwa = relAngle(swFrom, course);

  const k = cur.speed * Math.sin(toRad(cur.dir - course));
  const a = cur.speed * Math.cos(toRad(cur.dir - course));

  function withSpeed(v: number): Kurs {
    const ratio = Math.max(-1, Math.min(1, -k / v));
    const h = course + toDeg(Math.asin(ratio));
    return { h, v, sog: v * Math.cos(toRad(h - course)) + a, held: Math.abs(k) <= v };
  }

  const motor = withSpeed(cfg.motorSpeed);

  let sail: Kurs | null = null;
  if (cfg.model === 'constant') {
    const c = withSpeed(cfg.speedKn);
    sail = { ...c, twa: relAngle(swFrom, c.h) };
  } else {
    const swsM = sws;
    const gamma = targetTwa;
    const beat = vmgOptimum(swsM, cfg.crewFactor, true, cfg.boat);
    const run = vmgOptimum(swsM, cfg.crewFactor, false, cfg.boat);

    if (sws10 < cfg.minSailWind) {
      sail = null;
    } else if (gamma < beat.angle || gamma > run.angle) {

      const up = gamma < beat.angle;
      const opt = up ? beat : run;
      const vEff = opt.vmg / Math.cos(toRad(up ? gamma : 180 - gamma));
      const hh = course + toDeg(Math.asin(Math.max(-1, Math.min(1, -k / vEff))));
      sail = {
        h: hh, v: vEff, sog: vEff * Math.cos(toRad(hh - course)) + a,
        held: Math.abs(k) <= vEff,
        twa: opt.angle,
        targetTwa: gamma,
        beating: up, gybing: !up,
        beatAngle: opt.angle, stwReal: opt.speed,
      };
    } else {

      let h = course, v = 0;
      for (let it = 0; it < 8; it++) {
        v = polarSpeed(swsM, relAngle(swFrom, h), cfg.crewFactor, cfg.boat);
        const hNew = course + toDeg(Math.asin(Math.max(-1, Math.min(1, -k / v))));
        if (Math.abs(hNew - h) < 0.01) { h = hNew; break; }
        h = hNew;
      }
      sail = {
        h, v, sog: v * Math.cos(toRad(h - course)) + a,
        held: Math.abs(k) <= v, twa: relAngle(swFrom, h), targetTwa: gamma,
        beating: false, gybing: false, stwReal: v,
      };
    }
  }

  let chosen: Kurs, underMotor = false;
  if (cfg.model === 'constant') {
    chosen = sail!;
  } else if (!sail || sail.sog < motor.sog * (cfg.sailPref ?? 0.6)) {
    chosen = { ...motor, twa: relAngle(swFrom, motor.h) };
    underMotor = true;
  } else {
    chosen = sail;
  }

  const blocked = !chosen.held || chosen.sog <= 0.1;

  const stwR = chosen.stwReal ?? chosen.v;
  const twaR = toRad(chosen.twa ?? 0);
  const aws = Math.hypot(sws * Math.sin(twaR), sws * Math.cos(twaR) + stwR);
  const awa = toDeg(Math.atan2(sws * Math.sin(twaR), sws * Math.cos(twaR) + stwR));

  return {
    sog: Math.max(chosen.sog, 0.1), stw: chosen.v, heading: chosen.h,
    twa: chosen.twa ?? 0, sailWind: sws, sailWind10: sws10, aws, awa, underMotor, blocked,
    beating: !underMotor && !!chosen.beating,
    gybing: !underMotor && !!chosen.gybing,
    targetTwa,
    stwReal: chosen.stwReal ?? chosen.v,
  };
}
