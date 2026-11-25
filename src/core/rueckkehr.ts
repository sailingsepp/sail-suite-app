import type { Punkt } from './types';
import type { Revier } from './revierwissen';
import { distNM, bearingDeg } from './geo';
import { referenzfahrtKn, type RevierRandbedingungen } from './referenzfahrt';
import { mindestFahrtageMitWunschzielen, type Wunschziel } from './wunschziele';

export type { RevierRandbedingungen } from './referenzfahrt';

export function wegTage(von: Punkt, nach: Punkt, revier: RevierRandbedingungen, maxStundenProTag: number): number {
  const sm = distNM(von.lat, von.lon, nach.lat, nach.lon);
  const bearing = bearingDeg(von.lat, von.lon, nach.lat, nach.lon);
  const kn = referenzfahrtKn(bearing, revier);
  return Math.ceil(sm / kn / maxStundenProTag);
}

export function heimkehrTage(o: Punkt, rueckgabehafen: Punkt, revier: RevierRandbedingungen, maxStundenProTag: number): number {
  return wegTage(o, rueckgabehafen, revier, maxStundenProTag);
}

export function restwegTage(o: Punkt, zielhafen: Punkt, revier: RevierRandbedingungen, maxStundenProTag: number): number {
  return wegTage(o, zielhafen, revier, maxStundenProTag);
}

export function restbedarfTage(
  offeneWunschziele: readonly Wunschziel[], o: Punkt, heimathafen: Punkt,
  revier: RevierRandbedingungen, maxStundenProTag: number,
): number {
  if (offeneWunschziele.length === 0) return 0;
  const mitWuenschen = mindestFahrtageMitWunschzielen(o, '·', heimathafen, '·', offeneWunschziele, revier, maxStundenProTag);
  const direkt = heimkehrTage(o, heimathafen, revier, maxStundenProTag);
  return Math.max(0, mitWuenschen - direkt);
}

const RESERVETAGE_ADRIA = 4;
const RESERVETAGE_AEGAEIS_MELTEMI = 3;
const RESERVETAGE_IONISCH_GREGALE = 3;

export const RESERVETAGE_VORGABE = 1;

function inMeltemiSaison(monat: number): boolean {
  return monat >= 6 && monat <= 9;
}

export function reserveTage(revier: Revier | null, monat: number): number {
  switch (revier) {
    case 'adria': return RESERVETAGE_ADRIA;
    case 'aegaeis': return inMeltemiSaison(monat) ? RESERVETAGE_AEGAEIS_MELTEMI : RESERVETAGE_VORGABE;
    case 'ionisch': return RESERVETAGE_IONISCH_GREGALE;
    case 'bonifacio':
    case 'westmed':
    case null:
      return RESERVETAGE_VORGABE;
  }
}

export function reichweiteAmTag(
  o: Punkt, t: number, gesamtFahrtage: number, heimathafen: Punkt,
  offeneWunschziele: readonly Wunschziel[], revier: RevierRandbedingungen, maxStundenProTag: number,
  reserve: number,
): number {
  const heim = wegTage(o, heimathafen, revier, maxStundenProTag);
  const restbedarf = restbedarfTage(offeneWunschziele, o, heimathafen, revier, maxStundenProTag);
  if (heim === 0 && restbedarf === 0) return gesamtFahrtage - t;
  return (gesamtFahrtage - t) - restbedarf - heim - reserve;
}

export interface UmkehrpunktTag {
  ort: Punkt;
  offeneWunschziele: readonly Wunschziel[];
}

export interface UmkehrpunktErgebnis {

  tag: number | null;

  reichweiteJeTag: number[];

  gueltig: boolean;
}

export function umkehrpunkt(
  trajektorie: readonly UmkehrpunktTag[], heimathafen: Punkt, gesamtFahrtage: number,
  revier: RevierRandbedingungen, maxStundenProTag: number, reserve: number,

  bonusTage = 0,
): UmkehrpunktErgebnis {
  const reichweiteJeTag = trajektorie.map((tag, t) =>
    reichweiteAmTag(tag.ort, t, gesamtFahrtage, heimathafen, tag.offeneWunschziele, revier, maxStundenProTag, reserve) + bonusTage);
  let letzterHaltender: number | null = null;
  let gebrochen = false;
  let gueltig = true;
  for (let i = 0; i < reichweiteJeTag.length; i++) {
    const haelt = reichweiteJeTag[i]! >= 0;
    if (haelt) {
      if (gebrochen) gueltig = false;
      letzterHaltender = i;
    } else {
      gebrochen = true;
    }
  }
  return { tag: letzterHaltender, reichweiteJeTag, gueltig };
}
