import type { Punkt } from './types';

export interface AntriebBezug {
  lat: number;
  lon: number;
  nm: number;
  time: Date;
  underMotor: boolean;
}

export interface Antriebsphase {
  beginn: Date;

  ende: Date | null;
  beginnNM: number;
  endeNM: number | null;
  beginnOrt: Punkt;
  endeOrt: Punkt | null;
  unterMotor: boolean;
}

export const ANTRIEB_MIN_MINUTEN = 20;

function dauerMin(p: Antriebsphase, arrival: Date): number {
  return ((p.ende ?? arrival).getTime() - p.beginn.getTime()) / 60_000;
}

function glaetten(roh: Antriebsphase[]): Antriebsphase[] {
  if (roh.length <= 1) return roh;
  const arrival = roh[roh.length - 1]!.ende!;

  const out: Antriebsphase[] = [];
  for (const p of roh) {
    if (dauerMin(p, arrival) < ANTRIEB_MIN_MINUTEN && out.length > 0) {
      const vor = out[out.length - 1]!;
      vor.ende = p.ende; vor.endeNM = p.endeNM; vor.endeOrt = p.endeOrt;
      continue;
    }
    out.push({ ...p });
  }
  if (out.length > 1 && dauerMin(out[0]!, arrival) < ANTRIEB_MIN_MINUTEN) {
    out[1] = { ...out[1]!, beginn: out[0]!.beginn, beginnNM: out[0]!.beginnNM, beginnOrt: out[0]!.beginnOrt };
    out.shift();
  }

  const zusammen: Antriebsphase[] = [];
  for (const p of out) {
    const letzte = zusammen[zusammen.length - 1];
    if (letzte && letzte.unterMotor === p.unterMotor) {
      letzte.ende = p.ende; letzte.endeNM = p.endeNM; letzte.endeOrt = p.endeOrt;
    } else {
      zusammen.push({ ...p });
    }
  }
  return zusammen;
}

export function antriebsphasen(track: AntriebBezug[]): Antriebsphase[] {
  if (track.length === 0) return [];

  const roh: Antriebsphase[] = [];
  let beginn = track[0]!;
  let unterMotor = track[0]!.underMotor;
  for (let i = 1; i <= track.length; i++) {
    const letzterSchritt = i === track.length;
    const p = letzterSchritt ? track[track.length - 1]! : track[i]!;
    if (letzterSchritt || p.underMotor !== unterMotor) {
      roh.push({
        beginn: beginn.time, ende: p.time, beginnNM: beginn.nm, endeNM: p.nm,
        beginnOrt: { lat: beginn.lat, lon: beginn.lon }, endeOrt: { lat: p.lat, lon: p.lon },
        unterMotor,
      });
      if (letzterSchritt) break;
      beginn = p; unterMotor = p.underMotor;
    }
  }

  const geglaettet = glaetten(roh);
  geglaettet[geglaettet.length - 1]!.ende = null;
  return geglaettet;
}
