import { nf } from '@/core/time';
import { STEEP_SEA, steilStufe } from '@/core/polar';
import { richtungsName } from './wind';
import type { Ablegezeit, Sprache } from '@/core/types';

const RUPPIG_AB_BOE = 25;

function describeSeaEn(b: Ablegezeit): string {
  if ((!b.seaValid || b.maxHs < 0.8) && b.maxGust >= RUPPIG_AB_BOE) {
    return `Little sea in itself, but gusts of up to ${nf(b.maxGust, 0, 'en')} kn whip up a short, choppy wind sea `
      + 'in the channels and under land at once. Expect spray on deck.';
  }
  if (!b.seaValid || b.maxHs < 0.5) return 'Flat water.';
  if (b.maxHs < 0.8) return `Barely any sea, ${nf(b.maxHs, 1, 'en')} m.`;
  const steep = b.maxSteep > STEEP_SEA;
  const a = b.seaAngle;
  const masse = `${nf(b.maxHs, 1, 'en')} m at ${nf(b.hsTp, 0, 'en')} s`;
  let lage;
  if (a === null) lage = 'Sea';
  else if (a < 60) lage = 'Head sea';
  else if (a < 120) lage = 'Beam sea';
  else lage = 'Following sea';
  let t = `${lage}, ${masse}`;
  if (steep && b.maxHs >= 1.8 && a !== null && a < 60)
    t += ': high, short and dead ahead. The boat pitches heavily, loses noticeable speed, and the crew gets wet.';
  else if (steep && b.maxHs >= 1.8)
    t += ': short, steep and high. This is no longer a matter of comfort but of load on boat and crew.';
  else if (steep && a !== null && a < 60)
    t += ': short and steep from ahead, the boat pitches and loses speed.';
  else if (steep)
    t += ': short, steep waves, uncomfortable on board.';
  else if (b.maxHs >= 1.8 && a !== null && a >= 120)
    t += ': rough following sea. The boat gets pushed and yaws; hand-steer, the autopilot cannot cope with this.';
  else if (b.maxHs >= 1.2 && a !== null && a >= 120)
    t += ': running with it, but steering load and rolling increase.';
  else if (b.maxHs >= 1.2 && a !== null && a >= 60 && a < 120)
    t += ': on the beam, so it rolls; anyone prone to seasickness will notice.';
  else if (b.hsTp >= 8)
    t += ': long swell, comfortable sailing.';
  else t += '.';
  if (b.headSeaShare > 0.6 && b.maxHs >= 1.0 && !(a !== null && a < 60))
    t += ` Head seas for ${Math.round(b.headSeaShare * 100)} % of the passage.`;
  const stufe = steilStufeSatz(b, 'en');
  if (stufe) t += ` ${stufe}`;
  const kreuz = describeKreuzsee(b, 'en');
  if (kreuz) t += ` ${kreuz}`;
  const maxWelle = describeMaxWelle(b, 'en');
  if (maxWelle) t += ` ${maxWelle}`;
  const versatz = describeWellenversatz(b, 'en');
  if (versatz) t += ` ${versatz}`;
  return t;
}

export function describeSea(b: Ablegezeit, sprache: Sprache = 'de'): string {
  if (sprache === 'en') return describeSeaEn(b);
  if ((!b.seaValid || b.maxHs < 0.8) && b.maxGust >= RUPPIG_AB_BOE) {
    return `Wenig Seegang an sich, aber Böen bis ${nf(b.maxGust, 0)} kn rauen das Wasser in den Kanälen und `
      + 'unter Land sofort zu kurzer, ruppiger Windsee auf. Mit Gischt an Deck rechnen.';
  }
  if (!b.seaValid || b.maxHs < 0.5) return 'Glattes Wasser.';
  if (b.maxHs < 0.8) return `Kaum Seegang, ${nf(b.maxHs, 1)} m.`;
  const steep = b.maxSteep > STEEP_SEA;
  const a = b.seaAngle;
  const masse = `${nf(b.maxHs, 1)} m bei ${nf(b.hsTp, 0)} s`;
  let lage;
  if (a === null) lage = 'See';
  else if (a < 60) lage = 'See von vorn';
  else if (a < 120) lage = 'See querab';
  else lage = 'See von achtern';
  let t = `${lage}, ${masse}`;

  if (steep && b.maxHs >= 1.8 && a !== null && a < 60)
    t += ': hoch, kurz und genau von vorn. Das Schiff stampft schwer, verliert deutlich Fahrt und die Crew wird nass.';
  else if (steep && b.maxHs >= 1.8)
    t += ': kurz, steil und hoch. Das ist keine Frage des Komforts mehr, sondern der Belastung von Schiff und Crew.';
  else if (steep && a !== null && a < 60)
    t += ': kurz und steil von vorn, das Schiff stampft und verliert Fahrt.';
  else if (steep)
    t += ': kurze, steile Wellen, unruhig an Bord.';
  else if (b.maxHs >= 1.8 && a !== null && a >= 120)
    t += ': grobe See von achtern. Das Schiff wird geschoben und giert; Handsteuerung, der Autopilot kommt damit nicht zurecht.';
  else if (b.maxHs >= 1.2 && a !== null && a >= 120)
    t += ': läuft mit, dafür steigt die Steuerarbeit und die Rollbewegung.';
  else if (b.maxHs >= 1.2 && a !== null && a >= 60 && a < 120)
    t += ': querab, also rollig; wer zu Seekrankheit neigt, merkt das.';
  else if (b.hsTp >= 8)
    t += ': lange Dünung, gut zu fahren.';
  else t += '.';

  if (b.headSeaShare > 0.6 && b.maxHs >= 1.0 && !(a !== null && a < 60))
    t += ` Auf ${Math.round(b.headSeaShare * 100)} % der Strecke läuft sie gegenan.`;
  const stufe = steilStufeSatz(b);
  if (stufe) t += ` ${stufe}`;
  const kreuz = describeKreuzsee(b);
  if (kreuz) t += ` ${kreuz}`;
  const maxWelle = describeMaxWelle(b);
  if (maxWelle) t += ` ${maxWelle}`;
  const versatz = describeWellenversatz(b);
  if (versatz) t += ` ${versatz}`;
  return t;
}

export function steilStufeSatz(b: Ablegezeit, sprache: Sprache = 'de'): string | null {
  if (!b.seaValid) return null;
  const stufe = steilStufe(b.maxSteep);
  if (stufe < 2) return null;
  const x = nf(Math.round(1 / b.maxSteep), 0, sprache);
  const wo = `${nf(b.steepHs || b.maxHs, 1, sprache)} m ${sprache === 'en' ? 'at' : 'bei'} ${nf(b.steepTp || b.hsTp, 0, sprache)} s`;
  if (sprache === 'en') {
    return stufe === 3
      ? `At its steepest (${wo}) the sea reaches about 1:${x}. Seas rarely get steeper: the highest single waves break.`
      : `At its steepest (${wo}) the sea reaches about 1:${x}, steeper than a typical wind sea.`;
  }
  return stufe === 3
    ? `An der steilsten Stelle (${wo}) erreicht die See etwa 1:${x}. Steiler wird Seegang selten: Die höchsten Einzelwellen brechen.`
    : `An der steilsten Stelle (${wo}) erreicht die See etwa 1:${x}, steiler als typische Windsee.`;
}

export function describeKreuzsee(b: Ablegezeit, sprache: Sprache = 'de'): string | null {
  if (!b.seaValid || b.maxKreuzWinkel <= 0) return null;

  const gegenlaeufig = b.maxKreuzWinkel >= 135;
  if (sprache === 'en') {
    return `Wind sea and swell run ${Math.round(b.maxKreuzWinkel)}° apart `
      + `(${nf(b.kreuzWindWaveHs, 1, 'en')} m wind sea against ${nf(b.kreuzSwellHs, 1, 'en')} m swell), `
      + `a cross sea. The water becomes confused rather than running in trains: the boat finds no `
      + `rhythm, motion turns jerky, and height alone says nothing about it. `
      + (gegenlaeufig
        ? `Here the two systems run almost head-on to each other, throwing up short, steep crests `
          + `between them. Clip on in good time and secure everything below; anyone prone to `
          + `seasickness will feel this harder than a noticeably higher but orderly sea.`
        : `Hand-steering is usually calmer than the autopilot in a sea like this, and a slightly `
          + `different heading can make a real difference. It pays to find the angle to the `
          + `stronger of the two systems.`);
  }
  return `Windsee und Dünung laufen um ${Math.round(b.maxKreuzWinkel)}° auseinander `
    + `(${nf(b.kreuzWindWaveHs, 1)} m Windsee gegen ${nf(b.kreuzSwellHs, 1)} m Dünung), `
    + `eine Kreuzsee. Die See läuft dann durcheinander statt in Zügen: Das Schiff findet keinen `
    + `Rhythmus, die Bewegung wird ruckartig, und die Höhe allein sagt darüber nichts. `
    + (gegenlaeufig
      ? `Hier laufen die beiden Systeme nahezu gegeneinander, was zwischen ihnen kurze, steile Kämme `
        + `aufwirft. Rechtzeitig anschnallen und alles unter Deck sichern; wer zu Seekrankheit neigt, `
        + `trifft es hier härter als bei deutlich höherer, aber geordneter See.`
      : `Handsteuerung ist in so einer See meist ruhiger als der Autopilot, und ein etwas anderer `
        + `Kurs kann viel ausmachen. Es lohnt, den Winkel zum stärkeren der beiden Züge zu suchen.`);
}

const MAX_EINZELWELLE_VERHAELTNIS = 1.3;

const MAX_EINZELWELLE_MIN_HS = 0.8;

export function describeMaxWelle(b: Ablegezeit, sprache: Sprache = 'de'): string | null {

  if (!b.seaValid || !(b.maxIndividualHs > 0)) return null;
  if (b.maxHs < MAX_EINZELWELLE_MIN_HS) return null;
  if (!(b.maxIndividualHs >= b.maxHs * MAX_EINZELWELLE_VERHAELTNIS)) return null;
  return sprache === 'en'
    ? `Individual waves up to ${nf(b.maxIndividualHs, 1, 'en')} m are possible.`
    : `Einzelne Wellen bis ${nf(b.maxIndividualHs, 1)} m sind möglich.`;
}

const WELLENVERSATZ_MIN_KN = 0.1;

export function describeWellenversatz(b: Ablegezeit, sprache: Sprache = 'de'): string | null {

  if (!b.seaValid || !(b.stokesSpeed >= WELLENVERSATZ_MIN_KN)) return null;
  const richtung = richtungsName(b.stokesDir, sprache);
  return sprache === 'en'
    ? `The waves themselves add a further ${nf(b.stokesSpeed, 1, 'en')} kn of drift towards ${richtung}, on top of any current.`
    : `Die Wellen selbst versetzen zusätzlich um ${nf(b.stokesSpeed, 1)} kn nach ${richtung}: oben auf die Stromversetzung.`;
}
