import { toRad } from './geo';
import { FARR_BAVARIA_50 } from './polar';
import type { BoatPolar } from './polar';

export interface VmgOptimum {
  angle: number;
  speed: number;
  vmg: number;
}

const VMG_CACHE = new Map<string, VmgOptimum>();

export function vmgOptimum(tws: number, crewFactor: number, upwind: boolean, boat: BoatPolar = FARR_BAVARIA_50): VmgOptimum {
  const minTwa = boat.twa[0]!;
  const key = boat.id + '|' + (upwind ? 'U' : 'D') + tws.toFixed(2) + '|' + crewFactor;
  const cached = VMG_CACHE.get(key);
  if (cached) return cached;
  let best: VmgOptimum = { angle: upwind ? minTwa : 180, speed: 0, vmg: -1 };
  const lo = upwind ? minTwa : 90, hi = upwind ? 90 : 180;
  const v = polarZeile(tws, crewFactor, boat);
  const cos = kosinusReihe(lo, hi, upwind);
  let k = 0;
  for (let a = lo; a <= hi; a += 0.5, k++) {
    const s = v(a);
    const vmg = s * cos[k]!;
    if (vmg > best.vmg) best = { angle: a, speed: s, vmg };
  }
  VMG_CACHE.set(key, best);
  return best;
}

const KOSINUS = new Map<string, number[]>();
function kosinusReihe(lo: number, hi: number, upwind: boolean): number[] {
  const key = `${lo}|${hi}|${upwind ? 'U' : 'D'}`;
  let r = KOSINUS.get(key);
  if (!r) {
    r = [];
    for (let a = lo; a <= hi; a += 0.5) r.push(Math.cos(toRad(upwind ? a : 180 - a)));
    KOSINUS.set(key, r);
  }
  return r;
}

export function polarZeile(tws: number, crewFactor: number, boat: BoatPolar = FARR_BAVARIA_50): (twa: number) => number {
  const twaArr = boat.twa, twsArr = boat.tws, speedArr = boat.speed;
  const twsMin = twsArr[0]!, twsMax = twsArr[twsArr.length - 1]!;
  const twsC = Math.min(Math.max(tws, twsMin), twsMax);
  let j1 = twsArr.findIndex((s) => s >= twsC); if (j1 <= 0) j1 = 1;
  const j0 = j1 - 1;
  const ts0 = twsArr[j0]!, ts1 = twsArr[j1]!;
  const fs = ts1 > ts0 ? (twsC - ts0) / (ts1 - ts0) : 0;
  const spalte = speedArr.map((z) => { const v0 = z[j0]!, v1 = z[j1]!; return v0 + (v1 - v0) * fs; });
  const aMin = twaArr[0]!, aMax = twaArr[twaArr.length - 1]!;
  let i1 = 0;
  return (twa: number) => {
    const twaC = Math.min(Math.max(twa, aMin), aMax);
    while (i1 < twaArr.length - 1 && twaArr[i1]! < twaC) i1++;
    const i = i1 <= 0 ? 1 : i1;
    const ta0 = twaArr[i - 1]!, ta1 = twaArr[i]!;
    const fa = ta1 > ta0 ? (twaC - ta0) / (ta1 - ta0) : 0;
    const v0 = spalte[i - 1]!, v1 = spalte[i]!;
    const v = (v0 + (v1 - v0) * fa) * crewFactor;
    return tws < twsMin ? v * Math.max(0, tws / twsMin) : v;
  };
}
