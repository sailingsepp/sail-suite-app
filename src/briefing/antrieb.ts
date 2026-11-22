import { uhrLt } from '@/core/time';
import type { Antriebsphase } from '@/core/antrieb';
import type { Sprache } from '@/core/types';

const MAX_GENANNTE_WECHSEL = 3;

function describeAntriebEn(phasen: Antriebsphase[]): string | null {
  if (phasen.length < 2) return null;
  const wechsel = phasen.length - 1;
  const modus = (u: boolean): string => u ? 'engine' : 'sail';

  if (wechsel > MAX_GENANNTE_WECHSEL) {
    return `The propulsion switches ${wechsel} times en route between sail and engine, too often for `
      + 'a short summary, see the map for detail.';
  }
  if (wechsel === 1) {
    return `The propulsion switches at ${uhrLt(phasen[0]!.ende!)} from ${modus(phasen[0]!.unterMotor)} `
      + `to ${modus(phasen[1]!.unterMotor)}.`;
  }
  const saetze = phasen.slice(0, -1).map((p, i) =>
    `at ${uhrLt(p.ende!)} from ${modus(p.unterMotor)} to ${modus(phasen[i + 1]!.unterMotor)}`);
  return `The propulsion switches ${wechsel} times en route: ${saetze.join(', ')}.`;
}

export function describeAntrieb(phasen: Antriebsphase[], sprache: Sprache = 'de'): string | null {
  if (sprache === 'en') return describeAntriebEn(phasen);
  if (phasen.length < 2) return null;
  const wechsel = phasen.length - 1;
  const modus = (u: boolean): string => u ? 'Maschine' : 'Segel';

  if (wechsel > MAX_GENANNTE_WECHSEL) {
    return `Der Antrieb wechselt unterwegs ${wechsel}-mal zwischen Segel und Maschine, für eine knappe `
      + 'Zeitangabe zu häufig, Einzelheiten dazu auf der Karte.';
  }

  if (wechsel === 1) {
    return `Der Antrieb wechselt um ${uhrLt(phasen[0]!.ende!)} von ${modus(phasen[0]!.unterMotor)} `
      + `auf ${modus(phasen[1]!.unterMotor)}.`;
  }
  const saetze = phasen.slice(0, -1).map((p, i) =>
    `um ${uhrLt(p.ende!)} von ${modus(p.unterMotor)} auf ${modus(phasen[i + 1]!.unterMotor)}`);
  return `Der Antrieb wechselt unterwegs ${wechsel}-mal: ${saetze.join(', ')}.`;
}
