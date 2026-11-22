import { nf, uhrLt, uhrSpanneLt } from '@/core/time';
import { uv, bearingOf } from '@/core/geo';
import type { Sprache } from '@/core/types';
import { windBand, windName, boeenTeil, richtungsName, anzeigeKn } from './wind';
import { twaBand, KURSLAGE, KURSLAGE_EN } from './course';
import { seegangsStufe } from '@/core/alternativroute';
import { douglasTabelle } from '@/kompendium/daten';

export interface VerlaufPunkt {
  time: Date;
  speed: number;
  dir: number;
  gust: number;

  twa?: number;
  underMotor?: boolean;
  beating?: boolean;
  gybing?: boolean;
  steuerbordbug?: boolean;

  lat?: number;
  lon?: number;

  hs?: number;
}

function mittel(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function mittelRichtung(p: VerlaufPunkt[]): number {
  let dx = 0, dy = 0;
  for (const x of p) {
    const [ux, uy] = uv(x.dir);
    dx += ux * x.speed; dy += uy * x.speed;
  }
  return bearingOf(dx, dy);
}

function halbeStunde(d: Date): Date {
  const ms = 30 * 60_000;
  return new Date(Math.round(d.getTime() / ms) * ms);
}

function bildePhasen(track: VerlaufPunkt[]): { punkte: VerlaufPunkt[]; band: number }[] | null {
  if (track.length < 6) return null;
  const start = track[0]!.time.getTime();
  const ende = track[track.length - 1]!.time.getTime();

  if ((ende - start) / 3600000 < 3) return null;

  const g1 = start + (ende - start) / 3, g2 = start + 2 * (ende - start) / 3;
  const roh: VerlaufPunkt[][] = [[], [], []];
  for (const p of track) {
    const t = p.time.getTime();
    roh[t < g1 ? 0 : t < g2 ? 1 : 2]!.push(p);
  }

  const phasen: { punkte: VerlaufPunkt[]; band: number }[] = [];
  for (const g of roh) {
    if (g.length === 0) continue;

    const band = windBand(anzeigeKn(mittel(g.map((x) => x.speed)))).i;
    const letzte = phasen[phasen.length - 1];
    if (letzte && letzte.band === band) letzte.punkte.push(...g);
    else phasen.push({ punkte: [...g], band });
  }
  return phasen.length === 0 ? null : phasen;
}

export interface VerlaufAbschnittBezug {

  von: Date;

  bezeichnung: string;
}

const ORDINALZAHL = ['erster', 'zweiter', 'dritter'];

const ORDINALZAHL_EN = ['first', 'second', 'third'];

export function verlaufAbschnitte(track: VerlaufPunkt[], sprache: Sprache = 'de'): VerlaufAbschnittBezug[] | null {
  const phasen = bildePhasen(track);
  if (!phasen || phasen.length < 2) return null;

  const grenzen = phasen.slice(1).map((p) => halbeStunde(p.punkte[0]!.time));
  return phasen.map((p, i) => {
    if (sprache === 'en') {
      const zeitspanne = i === 0 ? `until ${uhrLt(grenzen[0]!)}`
        : i === phasen.length - 1 ? `from ${uhrLt(grenzen[i - 1]!)}`
        : uhrSpanneLt(grenzen[i - 1]!, grenzen[i]!);
      return {
        von: p.punkte[0]!.time,
        bezeichnung: `Profile text, ${ORDINALZAHL_EN[i] ?? `${i + 1}th`} section (${zeitspanne})`,
      };
    }
    const zeitspanne = i === 0 ? `bis ${uhrLt(grenzen[0]!)}`
      : i === phasen.length - 1 ? `ab ${uhrLt(grenzen[i - 1]!)}`
      : uhrSpanneLt(grenzen[i - 1]!, grenzen[i]!);
    return {
      von: p.punkte[0]!.time,
      bezeichnung: `Verlauf-Text, ${ORDINALZAHL[i] ?? `${i + 1}.`} Abschnitt (${zeitspanne})`,
    };
  });
}

export function describeVerlauf(track: VerlaufPunkt[], sprache: Sprache = 'de'): string | null {
  const phasen = bildePhasen(track);
  if (!phasen) return null;

  const beschr = (p: VerlaufPunkt[]): string => {

    const m = anzeigeKn(mittel(p.map((x) => x.speed)));
    const gust = anzeigeKn(Math.max(...p.map((x) => x.gust)));

    if (sprache === 'en') {
      return `${windName(m, gust, 'en')} from ${richtungsName(mittelRichtung(p), 'en')} at ${nf(m, 0, 'en')} kn`
        + boeenTeil(m, gust, 'en');
    }
    return `${windName(m, gust)} aus ${richtungsName(mittelRichtung(p))} um ${nf(m, 0)} kn`
      + boeenTeil(m, gust);
  };

  const lage = (p: VerlaufPunkt[]): string => {
    const mitLage = p.filter((x) => x.twa !== undefined);
    if (mitLage.length === 0) return '';
    const anteil = (f: (x: VerlaufPunkt) => boolean) => mitLage.filter(f).length / mitLage.length;
    const motor = anteil((x) => x.underMotor === true);

    if (sprache === 'en') {
      if (motor >= 0.95) return ', under engine';
      if (motor > 0.6) return ', mostly under engine';
      const name = KURSLAGE_EN[twaBand(mittel(mitLage.map((x) => x.twa!)))]!;
      const zusatz = motor > 0.2 ? ', partly under engine' : '';
      if (anteil((x) => x.beating === true) > 0.5) return `, ${name}, beating${zusatz}`;
      if (anteil((x) => x.gybing === true) > 0.5) return `, ${name}, gybing${zusatz}`;
      const stb = anteil((x) => x.steuerbordbug === true);
      const bug = stb > 0.8 ? ' on starboard tack' : stb < 0.2 ? ' on port tack' : '';
      return `, ${name}${bug}${zusatz}`;
    }
    if (motor >= 0.95) return ', unter Maschine';
    if (motor > 0.6) return ', überwiegend unter Maschine';

    const name = KURSLAGE[twaBand(mittel(mitLage.map((x) => x.twa!)))]!;
    const zusatz = motor > 0.2 ? ', streckenweise unter Maschine' : '';
    if (anteil((x) => x.beating === true) > 0.5) return `, ${name}, aufkreuzend${zusatz}`;
    if (anteil((x) => x.gybing === true) > 0.5) return `, ${name}, halsend${zusatz}`;
    const stb = anteil((x) => x.steuerbordbug === true);
    const bug = stb > 0.8 ? ' auf Steuerbordbug' : stb < 0.2 ? ' auf Backbordbug' : '';
    return `, ${name}${bug}${zusatz}`;
  };

  const teil = (i: number): string => {
    const jetzt = lage(phasen[i]!.punkte);
    const vorher = i > 0 ? lage(phasen[i - 1]!.punkte) : '';
    return beschr(phasen[i]!.punkte) + (jetzt === vorher ? '' : jetzt);
  };

  if (phasen.length === 1) {

    const mitTwa0 = phasen[0]!.punkte.filter((p) => p.twa !== undefined);
    const motorAnteil = mitTwa0.length ? mitTwa0.filter((p) => p.underMotor === true).length / mitTwa0.length : 0;
    const l = motorAnteil > 0.7 ? '' : lage(phasen[0]!.punkte);

    const mitTwa = phasen[0]!.punkte.filter((p) => p.twa != null);
    const wandert = mitTwa.length >= 2
      && Math.abs(twaBand(mitTwa[mitTwa.length - 1]!.twa!) - twaBand(mitTwa[0]!.twa!)) >= 2;
    if (sprache === 'en') {
      return `The wind changes little over the whole passage: ${beschr(phasen[0]!.punkte)}.`
        + (l ? ` ${wandert ? 'Mostly' : 'Throughout'}${l.replace(/^, /, ' ')}.` : '');
    }
    return `Der Wind ändert sich über die ganze Fahrt kaum: ${beschr(phasen[0]!.punkte)}.`
      + (l ? ` ${wandert ? 'Überwiegend' : 'Durchgehend'}${l.replace(/^, /, ' ')}.` : '');
  }
  if (phasen.length === 2) {
    const wechsel = halbeStunde(phasen[1]!.punkte[0]!.time);
    if (sprache === 'en') return `Until ${uhrLt(wechsel)} ${teil(0)}. Then ${teil(1)}.`;
    return `Bis ${uhrLt(wechsel)} ${teil(0)}. Danach ${teil(1)}.`;
  }
  const w1 = halbeStunde(phasen[1]!.punkte[0]!.time);
  const w2 = halbeStunde(phasen[2]!.punkte[0]!.time);

  if (sprache === 'en') {
    return `Until ${uhrLt(w1)} ${teil(0)}. Then ${teil(1)}. `
      + `From ${uhrLt(w2)} ${teil(2)}.`;
  }
  return `Bis ${uhrLt(w1)} ${teil(0)}. Dann ${teil(1)}. `
    + `Ab ${uhrLt(w2)} ${teil(2)}.`;
}

export function describeSeegangVerlauf(track: readonly VerlaufPunkt[] | null, sprache: Sprache = 'de'): string | null {
  if (!track || track.length < 6) return null;
  if (track.filter((p) => typeof p.hs === 'number').length < (track.length * 2) / 3) return null;
  const start = track[0]!.time.getTime(), ende = track[track.length - 1]!.time.getTime();
  if ((ende - start) / 3_600_000 < 3) return null;
  const g1 = start + (ende - start) / 3, g2 = start + (2 * (ende - start)) / 3;
  const drittel: VerlaufPunkt[][] = [[], [], []];
  for (const p of track) {
    if (typeof p.hs !== 'number') continue;
    const t = p.time.getTime();
    drittel[t < g1 ? 0 : t < g2 ? 1 : 2]!.push(p);
  }
  const phasen: { von: Date; hs: number; stufe: number }[] = [];
  for (const d of drittel) {
    if (!d.length) continue;
    const hs = Math.round(Math.max(...d.map((p) => p.hs!)) * 10) / 10;
    const stufe = seegangsStufe(hs);
    const letzte = phasen[phasen.length - 1];
    if (letzte && letzte.stufe === stufe) letzte.hs = Math.max(letzte.hs, hs);
    else phasen.push({ von: d[0]!.time, hs, stufe });
  }
  if (phasen.length < 2 || !phasen.some((p) => p.stufe >= 3)) return null;
  const namen = douglasTabelle(sprache);
  const en = sprache === 'en';
  const teil = (p: { hs: number; stufe: number }) => en
    ? `${namen[p.stufe]!.name.replace(/\s*\(.*\)/, '').toLowerCase()} sea up to ${nf(p.hs, 1, 'en')} m`
    : `${namen[p.stufe]!.name} bis ${nf(p.hs, 1)} m`;
  const zeit = (d: Date) => uhrLt(halbeStunde(d));
  if (phasen.length === 2) {
    return en
      ? `Sea state over the passage: until ${zeit(phasen[1]!.von)} ${teil(phasen[0]!)}, then ${teil(phasen[1]!)}.`
      : `Seegang im Verlauf: bis ${zeit(phasen[1]!.von)} ${teil(phasen[0]!)}, danach ${teil(phasen[1]!)}.`;
  }
  return en
    ? `Sea state over the passage: until ${zeit(phasen[1]!.von)} ${teil(phasen[0]!)}, then ${teil(phasen[1]!)}, from ${zeit(phasen[2]!.von)} ${teil(phasen[2]!)}.`
    : `Seegang im Verlauf: bis ${zeit(phasen[1]!.von)} ${teil(phasen[0]!)}, dann ${teil(phasen[1]!)}, ab ${zeit(phasen[2]!.von)} ${teil(phasen[2]!)}.`;
}
