import { nf, uhrLt } from '@/core/time';
import type { Ablegezeit, Sprache } from '@/core/types';
import { twaBand } from './course';
import { anzeigeKn } from './wind';
import type { VerlaufPunkt } from './profile';

export const REFF_AM_WIND = [16, 22, 28];
const REFF_ZUSCHLAG_RAUM = 5;

function reffGrenzen(twa: number): number[] {
  const raum = twa >= 120 ? REFF_ZUSCHLAG_RAUM : twa >= 90 ? REFF_ZUSCHLAG_RAUM / 2 : 0;
  return REFF_AM_WIND.map((g) => g + raum);
}

function reffStufe(mittelwind: number, twa: number): number {
  return reffGrenzen(twa).filter((g) => mittelwind >= g).length;
}

function achterlich(b: Ablegezeit, t: number): boolean {
  return t >= 5 && (!(b.avgAws > 0) || b.avgAwa >= 90);
}

function describeSegelfuehrungEn(b: Ablegezeit): string {
  const S: string[] = [];
  const t = twaBand(b.avgTwa);

  if (b.avgAws > 0) {
    let satz = `The instruments read around ${nf(b.avgAws, 0, 'en')} kn apparent at ${nf(b.avgAwa, 0, 'en')}° on average`;
    if (t <= 2) {
      satz += ". On the wind the boat's own speed adds to it, so pressure builds in the rig sooner"
        + ' than the true wind from the forecast suggests.';
    } else if (achterlich(b, t)) {
      satz += ". Running, the boat's own speed subtracts from it, which makes the pressure feel milder"
        + ' than it is: heading up or gybing brings it on at full force in an instant.';
    } else {
      satz += '.';
    }
    S.push(satz);
  }

  const stufe = reffStufe(b.maxWind, b.avgTwa);
  const amWind = t <= 2;
  const REFF_TEXT_EN = [
    'Full sail, no load on the rig.',
    'Plan for the first reef: tying it in before casting off is easier than'
      + (amWind ? ' catching up on it later on the beat.' : ' catching up on it later underway.'),
    'Plan for the second reef, and furl the genoa well in as well.',
    'Third reef, or storm canvas: from here on it is no longer about speed.',
  ];
  const grenzen = reffGrenzen(b.avgTwa);
  const naechste = grenzen[Math.min(stufe, 2)]!;
  const boeenDruecken = b.maxGust >= naechste && stufe < 3;
  const boeenStufe = grenzen.filter((g) => b.maxGust >= g).length;
  const STUFENNAME_EN = ['first', 'second', 'third'];
  let reff: string;
  if (stufe === 0 && boeenDruecken) {
    reff = boeenStufe >= 2
      ? `On paper full sail is enough, but the gusts reach ${nf(b.maxGust, 0, 'en')} kn against only`
        + ` ${nf(b.maxWind, 0, 'en')} kn mean wind, well above it: taken on their own, they call for the`
        + ` ${STUFENNAME_EN[Math.min(boeenStufe, 3) - 1]} reef (from ${nf(grenzen[Math.min(boeenStufe, 3) - 1]!, 0, 'en')} kn).`
        + ' Reefing follows the mean wind though, not the peak: reefed that deep, too little sail would'
        + ' stand between the gusts, and the yacht would stop pointing.'
        + (amWind ? ' On the beat, the first reef should therefore go in before casting off. It takes the punch out of the gust and leaves enough set in between.'
          : ' The first reef should therefore go in before casting off, not only once underway.')
      : `On paper full sail is enough, but at ${nf(b.maxWind, 0, 'en')} kn mean wind the`
        + ` ${nf(b.maxGust, 0, 'en')} kn gusts are already brushing the first reef threshold`
        + (amWind ? '. On the beat, better to tie in the first reef straight away.' : '. Keep the first reef ready to hand.');
  } else {
    reff = REFF_TEXT_EN[Math.min(stufe, 3)]!;
    if (boeenDruecken) {
      reff += ` The gusts run to ${nf(b.maxGust, 0, 'en')} kn, well above the ${nf(b.maxWind, 0, 'en')} kn mean wind`
        + '. When in doubt, reef one stage earlier: you can always shake it out again.';
    }
  }
  S.push(reff);

  if (t <= 1 && b.beatShare > 0.3 && stufe < 3) {
    S.push('On the beat, favour footing off and keeping the boat moving over squeezing out the last'
      + " few degrees of pointing. The passage time above is calculated at the tacking angle of best VMG.");
  }
  if (achterlich(b, t)) {
    S.push('Running dead downwind, rig the preventer and keep the headsail sheet under tension;'
      + ' if the sea builds, better to head up a few degrees than run dead square.');
  } else if (t === 4 && b.maxWind >= 11) {
    S.push('On a broad reach the boom can ease well out. A preventer does no harm here either,'
      + ' especially if the sea sets the boat rolling.');
  }

  return S.join(' ');
}

export function describeSegelfuehrung(b: Ablegezeit, sprache: Sprache = 'de'): string | null {

  if (b.motorShare > 0.7) return null;
  if (b.maxWind < 4) return null;
  if (sprache === 'en') return describeSegelfuehrungEn(b);

  const S: string[] = [];
  const t = twaBand(b.avgTwa);

  if (b.avgAws > 0) {
    let satz = `Am Bord-Display stehen im Mittel rund ${nf(b.avgAws, 0)} kn scheinbar bei ${nf(b.avgAwa, 0)}°`;
    if (t <= 2) {
      satz += '. Am Wind addiert sich die eigene Fahrt, der Druck im Rigg steht also früher an,'
        + ' als der wahre Wind der Vorhersage vermuten lässt.';
    } else if (achterlich(b, t)) {
      satz += '. Vor dem Wind zieht die eigene Fahrt ab, was den Druck harmloser wirken lässt:'
        + ' beim Anluven oder in der Halse steht er schlagartig voll an.';
    } else {
      satz += '.';
    }
    S.push(satz);
  }

  const stufe = reffStufe(b.maxWind, b.avgTwa);
  const amWind = t <= 2;
  const REFF_TEXT = [
    'Volles Tuch, das Rigg bleibt unbelastet.',
    'Erstes Reff einplanen: vor dem Ablegen einbinden ist bequemer, als es später'
      + (amWind ? ' auf der Kreuz nachzuholen.' : ' unterwegs nachzuholen.'),
    'Zweites Reff einplanen, dazu die Genua deutlich einrollen.',
    'Drittes Reff bzw. Sturmbesegelung: in diesem Bereich geht es nicht mehr um Geschwindigkeit.',
  ];

  const grenzen = reffGrenzen(b.avgTwa);
  const naechste = grenzen[Math.min(stufe, 2)]!;
  const boeenDruecken = b.maxGust >= naechste && stufe < 3;

  const boeenStufe = grenzen.filter((g) => b.maxGust >= g).length;
  const STUFENNAME = ['erste', 'zweite', 'dritte'];
  let reff: string;
  if (stufe === 0 && boeenDruecken) {

    reff = boeenStufe >= 2
      ? `Rechnerisch reicht volles Tuch, aber die Böen liegen mit ${nf(b.maxGust, 0)} kn bei nur`
        + ` ${nf(b.maxWind, 0)} kn Mittelwind weit darüber. Für sich genommen verlangen sie die`
        + ` ${STUFENNAME[Math.min(boeenStufe, 3) - 1]} Reffstufe (ab ${nf(grenzen[Math.min(boeenStufe, 3) - 1]!, 0)} kn).`

        + ` Gerefft wird aber nach dem Mittelwind, nicht nach der Spitze: So tief gerefft stünde`
        + ` zwischen den Böen zu wenig Tuch, und das Schiff liefe seine Höhe nicht mehr.`
        + (amWind ? ' Auf der Kreuz gehört deshalb das erste Reff vor dem Ablegen eingebunden. Es nimmt der Bö den Druck und lässt dazwischen genug stehen.'
          : ' Das erste Reff deshalb vor dem Ablegen einbinden, nicht erst unterwegs.')
      : `Rechnerisch reicht volles Tuch, aber die Böen mit ${nf(b.maxGust, 0)} kn kratzen`
        + ` bei ${nf(b.maxWind, 0)} kn Mittelwind schon an der ersten Reffgrenze`
        + (amWind ? '. Auf der Kreuz lieber gleich das erste Reff einbinden.' : '. Das erste Reff griffbereit halten.');
  } else {
    reff = REFF_TEXT[Math.min(stufe, 3)]!;
    if (boeenDruecken) {
      reff += ` Die Böen gehen mit ${nf(b.maxGust, 0)} kn über den Mittelwind von ${nf(b.maxWind, 0)} kn hinaus`
        + '. Im Zweifel eine Stufe früher reffen, herausschütteln geht immer.';
    }
  }
  S.push(reff);

  if (t <= 1 && b.beatShare > 0.3 && stufe < 3) {
    S.push('Auf der Kreuz eher abfallen und Fahrt laufen, als die letzten Grad Höhe zu erzwingen.'
      + ' Die Fahrzeit oben ist mit dem Schlagwinkel der besten VMG gerechnet.');
  }
  if (achterlich(b, t)) {
    S.push('Auf dem Vorwindkurs Bullenstander setzen und die Vorschot auf Spannung halten;'
      + ' bei aufkommender See lieber ein paar Grad anluven als platt zu laufen.');
  } else if (t === 4 && b.maxWind >= 11) {
    S.push('Raumschots kann der Baum weit auffieren. Bullenstander schadet auch hier nicht,'
      + ' besonders wenn die See das Schiff rollen lässt.');
  }

  return S.join(' ');
}

export const REFF_HALTEN_MIN = 30;
export function reffZeitpunkt(track: readonly VerlaufPunkt[] | null, sprache: Sprache = 'de'): string | null {
  if (!track || track.length < 3) return null;
  const segel = track.filter((p) => !p.underMotor && p.twa !== undefined);
  if (segel.length < 3) return null;
  const stufeAn = (p: VerlaufPunkt): number => reffStufe(anzeigeKn(p.speed), p.twa!);
  const anfang = stufeAn(segel[0]!);
  const ms = REFF_HALTEN_MIN * 60_000;
  const halbe = (d: Date): Date => new Date(Math.round(d.getTime() / 1_800_000) * 1_800_000);
  const S: string[] = [];
  let erreicht = anfang;
  for (let i = 1; i < segel.length; i++) {
    const s = stufeAn(segel[i]!);
    if (s <= erreicht || s > 3) continue;
    const t0 = segel[i]!.time.getTime();
    const danach = segel.filter((p) => p.time.getTime() >= t0 && p.time.getTime() <= t0 + ms);
    const letzter = danach[danach.length - 1]!;
    if (letzter.time.getTime() - t0 < ms * 0.99 || danach.some((p) => stufeAn(p) < s)) continue;
    const grenze = reffGrenzen(segel[i]!.twa!)[s - 1]!;
    const uhr = uhrLt(halbe(segel[i]!.time));
    S.push(sprache === 'en'
      ? `By the time profile the wind reaches the limit for the ${['first', 'second', 'third'][s - 1]} reef (${nf(grenze, 0, 'en')} kn on this point of sail) around ${uhr}.`
      : `Nach dem Zeitprofil erreicht der Wind die Grenze fürs ${['erste', 'zweite', 'dritte'][s - 1]} Reff (${nf(grenze, 0)} kn auf diesem Kurs) gegen ${uhr}.`);
    erreicht = s;
  }
  return S.length ? S.join(' ') : null;
}

