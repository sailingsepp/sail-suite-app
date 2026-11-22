import { type Wunschziel, type Endziel, type MachbarkeitEingabe } from '@/core/wunschziele';
import type { RevierRandbedingungen } from '@/core/referenzfahrt';
import { bearingDeg, distNM } from '@/core/geo';
import { istUeberstellung } from '@/core/ueberstellung';
import { nDate } from '@/core/time';
import type { Punkt, SchiffConfig } from '@/core/types';
import type { ToernZeile } from '@/data/toernApi';

import { NORMALWIND_KN } from './konstanten';

export const STANDARD_MAX_STUNDEN_PRO_TAG = 7;

export interface WunschlisteKontext {
  toern: ToernZeile;
  cfg: SchiffConfig;

  start: Punkt | null;
  startName: string;
}

function baueRevier(cfg: SchiffConfig, windDeg: number): RevierRandbedingungen {
  return {
    boat: cfg.boat, crewFactor: cfg.crewFactor, motorSpeedKn: cfg.motorSpeed,
    vorherrschenderWindDeg: windDeg, vorherrschenderWindKn: NORMALWIND_KN,
  };
}

export function windrichtung(start: Punkt, wunschziele: readonly Wunschziel[], endziel: Endziel | null): number {
  const ziel = endziel?.ort ?? wunschziele[wunschziele.length - 1]?.ort;
  return ziel ? bearingDeg(start.lat, start.lon, ziel.lat, ziel.lon) : 0;
}

export const RUECKGABE_FAHRTAG_AB_UHR = 12;

export function rueckgabetagIstFahrtag(rueckgabeZeit: string | null | undefined): boolean {
  const stunde = rueckgabeZeit ? Number(rueckgabeZeit.slice(0, 2)) : NaN;
  return Number.isFinite(stunde) && stunde >= RUECKGABE_FAHRTAG_AB_UHR;
}

type MitPlanung = { planung?: Record<string, unknown> | null };

export function istOffeneUeberstellung(
  toern: Pick<ToernZeile, 'von' | 'bis'> & Partial<Pick<ToernZeile, 'start_hafen' | 'rueckgabe_hafen'>> & MitPlanung,
): boolean {
  if (!toern.von || !istUeberstellung(toern.start_hafen ?? null, toern.rueckgabe_hafen ?? null)) return false;
  return !toern.bis || toern.bis === toern.planung?.['endeAusPlan'];
}

export const UEBERSTELLUNG_MAX_TAGE = 30;

export function ueberstellungsRahmen(
  toern: Partial<Pick<ToernZeile, 'start_hafen' | 'rueckgabe_hafen'>>, regelmassSm = 30,
): number | null {
  const a = toern.start_hafen, b = toern.rueckgabe_hafen;
  if (!a || !b) return null;
  const tage = Math.ceil((2 * distNM(a.lat, a.lon, b.lat, b.lon)) / Math.max(regelmassSm, 15)) + 3;
  return Math.min(UEBERSTELLUNG_MAX_TAGE, Math.max(3, tage));
}

export function verfuegbareFahrtage(
  toern: Pick<ToernZeile, 'von' | 'bis'> & { rueckgabe_zeit?: string | null | undefined }
    & Partial<Pick<ToernZeile, 'start_hafen' | 'rueckgabe_hafen'>> & MitPlanung,
  regelmassSm?: number,
): number | null {

  if (istOffeneUeberstellung(toern)) return ueberstellungsRahmen(toern, regelmassSm);
  if (!toern.von || !toern.bis) return null;
  const von = new Date(`${toern.von}T00:00:00`).getTime();
  const bis = new Date(`${toern.bis}T00:00:00`).getTime();
  const differenz = Math.round((bis - von) / 86_400_000);
  if (differenz < 0) return null;
  const tage = differenz + (rueckgabetagIstFahrtag(toern.rueckgabe_zeit) ? 1 : 0);
  return tage > 0 ? tage : null;
}

export function hatEtwasZuPlanen(
  wunschziele: readonly Wunschziel[], endziel: Endziel | null,
): boolean {
  return wunschziele.length > 0 || endziel != null;
}

export function uebernahmeZeitpunkt(
  toern: Pick<ToernZeile, 'von' | 'uebernahme_zeit'>,
): Date | null {
  if (!toern.von || !toern.uebernahme_zeit) return null;
  return nDate(`${toern.von}T${toern.uebernahme_zeit}:00`);
}

export function rueckgabeZeitpunkt(
  toern: Pick<ToernZeile, 'bis' | 'rueckgabe_zeit'>,
): Date | null {
  if (!toern.bis || !toern.rueckgabe_zeit) return null;
  return nDate(`${toern.bis}T${toern.rueckgabe_zeit}:00`);
}

export function fehlendeEingabe(kontext: WunschlisteKontext | null): 'start' | 'zeitraum' | null {
  if (!kontext?.start) return 'start';
  if (verfuegbareFahrtage(kontext.toern) == null) return 'zeitraum';
  return null;
}

export function fehlendeEingabeSchluessel(kontext: WunschlisteKontext | null): string {
  return fehlendeEingabe(kontext) === 'zeitraum' ? 'wunschliste.keinZeitraum' : 'wunschliste.keinStart';
}

export function baueMachbarkeitEingabe(
  wunschziele: readonly Wunschziel[], endziel: Endziel | null,
  kontext: WunschlisteKontext | null, obergrenzeSm: number | null,
): MachbarkeitEingabe | null {
  if (!kontext?.start) return null;
  const fahrtage = verfuegbareFahrtage(kontext.toern);
  if (fahrtage == null) return null;
  const revier = baueRevier(kontext.cfg, windrichtung(kontext.start, wunschziele, endziel));
  return {
    start: kontext.start, startName: kontext.startName,

    ...(istOffeneUeberstellung(kontext.toern) && kontext.toern.rueckgabe_hafen
      ? { ziel: { lat: kontext.toern.rueckgabe_hafen.lat, lon: kontext.toern.rueckgabe_hafen.lon }, zielName: kontext.toern.rueckgabe_hafen.name }
      : { ziel: kontext.start, zielName: kontext.startName }),
    wunschziele: [...wunschziele], endziel,
    verfuegbareFahrtage: fahrtage,
    regelmassSm: 0,
    obergrenzeSm,
    maxStundenProTag: STANDARD_MAX_STUNDEN_PRO_TAG,
    revier,
  };
}
