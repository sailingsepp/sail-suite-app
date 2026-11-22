import { kursGrad, nf, uhrLtVon } from '@/core/time';
import { richtungsName } from '@/briefing/wind';
import type { WetterAngabe } from '@/data/logdb';
import type { Sprache } from '@/core/types';

export const ABWEICHUNG_KN = 5;
export const ABWEICHUNG_M = 0.5;

export const ABWEICHUNG_GRAD = 90;
export const MODELL = 'Open-Meteo, ECMWF';

function uhr(t: number): string {
  return uhrLtVon(t);
}

export function vorhersageText(w: WetterAngabe, sprache: Sprache): string {
  const de = sprache === 'de';
  const teile: string[] = [];

  const kn = w.windKn == null ? null : Math.round(w.windKn);
  const boe = w.boeKn == null ? null : Math.round(w.boeKn);
  const mitBoeen = boe != null && kn != null && boe > kn + 2;
  if (kn === 0 && w.windAus != null) {
    teile.push(mitBoeen ? '0 kn' : (de ? 'Windstille' : 'calm'));
  } else if (kn != null && w.windAus != null) {
    teile.push(`${nf(kn, 0, sprache)} kn ${de ? 'aus' : 'from'} `
      + `${kursGrad(w.windAus)} (${richtungsName(w.windAus, sprache)})`);
  }
  if (mitBoeen) teile.push(`${de ? 'Böen' : 'gusts'} ${nf(boe, 0, sprache)} kn`);
  if (w.welleM != null) {
    teile.push(`${de ? 'See' : 'sea'} ${nf(w.welleM, 1, sprache)} m`
      + (w.wellePeriodeS ? ` / ${nf(w.wellePeriodeS, 0, sprache)} s` : ''));
  }
  const kopf = de ? 'Wind laut Vorhersage' : 'Wind per forecast';
  const quelle = w.abgerufen
    ? ` (${w.modell ?? MODELL}, ${de ? 'abgerufen' : 'retrieved'} ${uhr(w.abgerufen)})`
    : '';
  return `${kopf}: ${teile.join(' · ')}${quelle}`;
}

export function beobachtungText(w: WetterAngabe, vergleich: WetterAngabe | null, sprache: Sprache): string {
  const de = sprache === 'de';
  const teile: string[] = [];
  if (w.windKn != null) {

    teile.push(`${nf(w.windKn, 0, sprache)} kn`
      + (w.windAus != null && Math.round(w.windKn) > 0
        ? ` ${de ? 'aus' : 'from'} ${kursGrad(w.windAus)} (${richtungsName(w.windAus, sprache)})`
        : ''));
  }
  if (w.boeKn != null) teile.push(`${de ? 'Böen' : 'gusts'} ${nf(w.boeKn, 0, sprache)} kn`);
  if (w.welleM != null) teile.push(`${de ? 'See' : 'sea'} ${nf(w.welleM, 1, sprache)} m`);

  let abweichung = '';
  if (vergleich) {
    const dWind = w.windKn != null && vergleich.windKn != null
      ? Math.abs(w.windKn - vergleich.windKn) : 0;
    const dSee = w.welleM != null && vergleich.welleM != null
      ? Math.abs(w.welleM - vergleich.welleM) : 0;
    const dRichtung = w.windAus != null && vergleich.windAus != null
      ? Math.abs(((w.windAus - vergleich.windAus) % 360 + 540) % 360 - 180) : 0;
    const richtungDaneben = dRichtung >= ABWEICHUNG_GRAD;
    if (dWind >= ABWEICHUNG_KN || dSee >= ABWEICHUNG_M || richtungDaneben) {
      const v: string[] = [];
      if (vergleich.windKn != null) {
        v.push(`${nf(vergleich.windKn, 0, sprache)} kn`
          + (richtungDaneben && vergleich.windAus != null
            ? ` ${de ? 'aus' : 'from'} ${kursGrad(vergleich.windAus)}`
            : ''));
      }
      if (vergleich.welleM != null) v.push(`${nf(vergleich.welleM, 1, sprache)} m`);
      abweichung = de
        ? `. Vorhersage sagte ${v.join(' / ')}`
        : `. Forecast said ${v.join(' / ')}`;
    }
  }
  const kopf = de ? 'Beobachtet' : 'Observed';
  return `${kopf}: ${teile.join(' · ')}${abweichung}`;
}

export function letztesAblegen(eintraege: readonly { art: string; t: number }[]): number | null {
  let t: number | null = null;
  for (const e of eintraege) if (e.art === 'start' && (t === null || e.t > t)) t = e.t;
  return t;
}

export function wetterkopfVeraltet(
  kopf: { t: number; ab?: number } | undefined, eintraege: readonly { art: string; t: number }[],
): boolean {
  if (!kopf) return true;
  const ab = letztesAblegen(eintraege);
  if (ab === null) return false;
  return kopf.ab != null ? ab > kopf.ab : ab - kopf.t > 60 * 60_000;
}
