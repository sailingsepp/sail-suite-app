import type { Punkt } from './types';
import { distNM, bearingDeg, destPoint } from './geo';
import { anzeigeKn, beaufort } from '@/briefing/wind';

export const MIN_GEWINN_MIN = 15;

export const MIN_STRECKE_SM = 8;

export const RAND_ANTEIL = 0.15;

export const VERSATZ_ANTEILE = [0.08, 0.15, 0.25] as const;
export const MIN_VERSATZ_SM = 1.5;
export const MAX_VERSATZ_SM = 15;

export interface RoutenKandidat {

  punkte: Punkt[];

  versatzSm: number;

  richtungDeg: number;

  bogen: Punkt[];
}

function laengen(punkte: readonly Punkt[]): number[] {
  const cum = [0];
  for (let i = 1; i < punkte.length; i++) {
    cum.push(cum[i - 1]! + distNM(punkte[i - 1]!.lat, punkte[i - 1]!.lon, punkte[i]!.lat, punkte[i]!.lon));
  }
  return cum;
}

function punktBei(punkte: readonly Punkt[], cum: readonly number[], s: number): { p: Punkt; kurs: number } {
  let i = 1;
  while (i < punkte.length - 1 && cum[i]! < s) i++;
  const a = punkte[i - 1]!, b = punkte[i]!;
  const l = cum[i]! - cum[i - 1]!;
  const t = l > 0 ? Math.min(1, Math.max(0, (s - cum[i - 1]!) / l)) : 0;
  return {
    p: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
    kurs: bearingDeg(a.lat, a.lon, b.lat, b.lon),
  };
}

export function alternativKandidaten(strecke: readonly Punkt[]): RoutenKandidat[] {
  if (strecke.length < 2) return [];
  const cum = laengen(strecke);
  const l = cum[cum.length - 1]!;
  if (l < MIN_STRECKE_SM) return [];
  const versaetze = [...new Set(VERSATZ_ANTEILE.map((a) => Math.round(Math.min(MAX_VERSATZ_SM, Math.max(MIN_VERSATZ_SM, a * l)) * 10) / 10))];
  const anfang = RAND_ANTEIL * l, ende = (1 - RAND_ANTEIL) * l;

  const anteile = [0, 0.25, 0.5, 0.75, 1];
  const out: RoutenKandidat[] = [];
  for (const seite of [-1, 1] as const) {
    for (const d of versaetze) {
      const bogen = anteile.map((f) => {
        const { p, kurs } = punktBei(strecke, cum, anfang + f * (ende - anfang));
        const v = d * Math.sin(Math.PI * f);
        if (v === 0) return p;
        const [lat, lon] = destPoint(p.lat, p.lon, (kurs + seite * 90 + 360) % 360, v);
        return { lat, lon };
      });
      const vor = strecke.filter((_, i) => cum[i]! < anfang);
      const nach = strecke.filter((_, i) => cum[i]! > ende);
      const mitte = punktBei(strecke, cum, l / 2).p;
      out.push({
        punkte: [...vor, ...bogen, ...nach],
        versatzSm: d,
        richtungDeg: bearingDeg(mitte.lat, mitte.lon, bogen[2]!.lat, bogen[2]!.lon),
        bogen,
      });
    }
  }
  return out;
}

export function streckenlaengeSm(punkte: readonly Punkt[]): number {
  const cum = laengen(punkte);
  return cum[cum.length - 1]!;
}

export function seitenRichtung(richtungDeg: number): 'n' | 'o' | 's' | 'w' {
  const r = ((richtungDeg % 360) + 360) % 360;
  if (r >= 315 || r < 45) return 'n';
  if (r < 135) return 'o';
  if (r < 225) return 's';
  return 'w';
}

export interface Fahrtvergleich {
  totalHrs: number;
  safetyFail: boolean;
  hasStorm: boolean;
  isDaylight: boolean | null;
  motorShare: number;
  beatShare: number;
  avgSpeed: number;

  maxGust?: number;
  maxHs?: number;
  dunkelHrs?: number;
}

const SEEGANG_GRENZEN = [0, 0.1, 0.5, 1.25, 2.5, 4, 6, 9, 14];

export function seegangsStufe(hs: number): number {
  let st = 0;
  for (let i = 0; i < SEEGANG_GRENZEN.length; i++) if (hs > SEEGANG_GRENZEN[i]!) st = i + 1;
  return Math.min(st, 9);
}

export const STARKWIND_BFT = 6;

export const MAESSIGE_SEE_STUFE = 4;

const DUNKEL_TOLERANZ_HRS = 5 / 60;

export function lohntSich(eigene: Fahrtvergleich, alternative: Fahrtvergleich): boolean {
  if ((eigene.totalHrs - alternative.totalHrs) * 60 < MIN_GEWINN_MIN) return false;
  if (alternative.safetyFail && !eigene.safetyFail) return false;
  if (alternative.hasStorm && !eigene.hasStorm) return false;
  if (eigene.isDaylight === true && alternative.isDaylight !== true) return false;

  if (eigene.maxGust != null && alternative.maxGust != null) {
    const bftAlt = beaufort(anzeigeKn(alternative.maxGust));
    if (bftAlt >= STARKWIND_BFT && bftAlt > beaufort(anzeigeKn(eigene.maxGust))) return false;
  }
  if (eigene.maxHs != null && alternative.maxHs != null) {
    const seeAlt = seegangsStufe(alternative.maxHs);
    if (seeAlt >= MAESSIGE_SEE_STUFE && seeAlt > seegangsStufe(eigene.maxHs)) return false;
  }
  if (eigene.dunkelHrs != null && alternative.dunkelHrs != null
    && alternative.dunkelHrs > eigene.dunkelHrs + DUNKEL_TOLERANZ_HRS) return false;
  return true;
}

export function grundDerAlternative(eigene: Fahrtvergleich, alternative: Fahrtvergleich): 'motor' | 'kreuzen' | 'fahrt' {
  if (eigene.motorShare - alternative.motorShare >= 0.1) return 'motor';
  if (eigene.beatShare - alternative.beatShare >= 0.1) return 'kreuzen';
  return 'fahrt';
}
