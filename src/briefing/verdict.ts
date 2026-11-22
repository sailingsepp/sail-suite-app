import type { Ablegezeit, Sprache } from '@/core/types';
import { beaufort, anzeigeKn, MOTOR_FLAUTE_UNTER_KN } from './wind';
import { KREUZKURS_AB_ANTEIL } from './course';

export const STURM_BOE = 41, STURM_MITTEL = 34;

const TEIL_MOTOR = 0.4;

export function sturm(r: Ablegezeit): boolean {
  return anzeigeKn(r.maxGust) >= STURM_BOE || anzeigeKn(r.maxWind) >= STURM_MITTEL;
}

export function istUnfahrbar(r: Ablegezeit): boolean {
  return r.safetyFail || r.hasStorm || sturm(r);
}

export function istUnfahrbarToern(r: Ablegezeit): boolean {
  return r.safetyFail || sturm(r);
}

export const CREW_GEUEBT_AB = 0.75;

function verdictEn(b: Ablegezeit, geuebt: boolean): string {
  if (b.maxGust >= STURM_BOE || b.maxWind >= STURM_MITTEL) {
    const bfM = beaufort(anzeigeKn(b.maxWind)), bfG = beaufort(anzeigeKn(b.maxGust));
    const wie = b.maxWind >= STURM_MITTEL
      ? `Force ${bfM} on average and Force ${bfG} in gusts`
      : `Force ${bfG} in gusts`;
    return `Do not go out. ${wie}. Neither a charter yacht nor a cruising crew is built for that.`;
  }
  if (b.hasStorm) return 'Not a sailing day: a thunderstorm is on the route.';
  if (b.maxGust >= 34) return 'Very strong. Only an experienced crew on a well-prepared boat should consider this. When in doubt, stay in port.';
  if (b.safetyFail) return 'Marginal. Only with an experienced crew and after checking the official sea forecast.';
  if (b.maxWind < 5) return 'Not sailing weather. Either motor or pick another day.';
  if (b.motorShare > 0.7) {
    const anteil = `The engine runs for ${Math.round(b.motorShare * 100)} % of the passage`;
    if (anzeigeKn(b.maxWind) < MOTOR_FLAUTE_UNTER_KN) return `More of a motoring day than a sailing day: ${anteil}. There is not enough wind for sailing.`;
    if (b.avgTwa < 45) return `More of a motoring day than a sailing day: ${anteil}, because the wind sits too far ahead. Beating would gain less than motoring.`;
    return `More of a motoring day than a sailing day: ${anteil}. Under sail the yacht would make too little progress on this course.`;
  }
  const nass = b.beatShare > KREUZKURS_AB_ANTEIL && (b.maxGust > 20 || (b.seaValid && b.maxHs >= 1.0 && b.headSeaShare > 0.4));
  if (nass) {
    return geuebt
      ? 'A sporty beat, wet and demanding: exactly the kind of day a well-drilled crew signs up for. Foulies out, spare dry kit within reach.'
      : 'A wet, tiring beat. Get the foulies ready and warn the crew.';
  }
  if (b.beatShare > KREUZKURS_AB_ANTEIL && b.maxWind < 11) return 'A day for patience. Lots of tacking in light air: anyone in a hurry should motor.';
  if (b.beatShare > KREUZKURS_AB_ANTEIL) {
    return geuebt
      ? 'A sporty day to windward: enough breeze to push the boat, and good sailing.'
      : 'A day to windward. Tiring but manageable: better to reef early on the beat than late.';
  }
  if (b.maxGust > 25 || (b.seaValid && b.maxHs > 1.5)) {
    return geuebt
      ? 'A strong day with plenty of breeze: manageable for an experienced crew, but not one to switch off on.'
      : 'A strong day. Doable, but not for an inexperienced crew.';
  }
  if (b.motorShare >= TEIL_MOTOR) return `Part sailing, part motoring: the engine runs on ${Math.round(b.motorShare * 100)}% of the route.`;
  if (b.isDaylight === false) return 'Sailable, but the arrival falls after dark. Go over the harbour entrance beforehand.';
  if (b.gybeShare > 0.4 || (b.avgTwa > 100 && b.maxWind >= 8)) return 'A fine passage day on a reaching course.';
  if (b.maxWind >= 17) return 'A strong but very manageable sailing day.';
  if (b.maxWind >= 8) return 'A pleasant sailing day.';
  return 'Light air. Sailable, but it will be a leisurely day.';
}

export function verdict(roh: Ablegezeit, crewZumutbarkeit?: number | null, sprache: Sprache = 'de'): string {

  const b: Ablegezeit = { ...roh, maxGust: anzeigeKn(roh.maxGust), maxWind: anzeigeKn(roh.maxWind) };

  const geuebt = crewZumutbarkeit != null && crewZumutbarkeit >= CREW_GEUEBT_AB;
  if (sprache === 'en') return verdictEn(b, geuebt);

  if (b.maxGust >= STURM_BOE || b.maxWind >= STURM_MITTEL) {
    const bfM = beaufort(anzeigeKn(b.maxWind)), bfG = beaufort(anzeigeKn(b.maxGust));
    const wie = b.maxWind >= STURM_MITTEL
      ? `${bfM} Beaufort im Mittel und ${bfG} in den Böen`
      : `${bfG} Beaufort in den Böen`;
    return `Nicht auslaufen. ${wie}. Dafür ist weder eine Charteryacht noch eine `
      + `Fahrtencrew gebaut.`;
  }
  if (b.hasStorm) return 'Kein Segeltag: Gewitter auf der Route.';
  if (b.maxGust >= 34) return 'Sehr kräftig. Nur eine geübte Crew auf einem gut vorbereiteten Schiff sollte das erwägen. Im Zweifel im Hafen bleiben.';
  if (b.safetyFail) return 'Grenzwertig. Nur mit erfahrener Crew und nach Rücksprache mit dem Seewetterbericht.';
  if (b.maxWind < 5) return 'Kein Segelwetter. Entweder Maschine oder einen anderen Tag nehmen.';

  if (b.motorShare > 0.7) {
    const anteil = `Auf ${Math.round(b.motorShare * 100)} % der Strecke läuft die Maschine`;
    if (anzeigeKn(b.maxWind) < MOTOR_FLAUTE_UNTER_KN) return `Eher eine Motorfahrt als ein Segeltag: ${anteil}. Für Segeln reicht der Wind nicht.`;
    if (b.avgTwa < 45) return `Eher eine Motorfahrt als ein Segeltag: ${anteil}, weil der Wind zu spitz von vorn steht, Kreuzen brächte weniger als Motoren.`;
    return `Eher eine Motorfahrt als ein Segeltag: ${anteil}. Unter Segeln käme die Yacht auf diesem Kurs zu langsam voran.`;
  }
  const nass = b.beatShare > KREUZKURS_AB_ANTEIL && (b.maxGust > 20 || (b.seaValid && b.maxHs >= 1.0 && b.headSeaShare > 0.4));

  if (nass) {
    return geuebt
      ? 'Sportlicher Kreuzkurs, nass und fordernd: für eine eingespielte Crew genau so ein Tag. Ölzeug raus, Nasszeug griffbereit.'
      : 'Nasser, anstrengender Kreuzkurs. Ölzeug bereitlegen, Crew vorwarnen.';
  }
  if (b.beatShare > KREUZKURS_AB_ANTEIL && b.maxWind < 11) return 'Geduldstag. Viel Kreuzarbeit bei wenig Druck: wer es eilig hat, nimmt die Maschine.';
  if (b.beatShare > KREUZKURS_AB_ANTEIL) {
    return geuebt
      ? 'Sportlicher Am-Wind-Tag: Druck genug, um das Schiff zu fordern, und gutes Segeln.'
      : 'Am-Wind-Tag. Anstrengend, aber gut zu fahren: auf der Kreuz lieber früher reffen als später.';
  }
  if (b.maxGust > 25 || (b.seaValid && b.maxHs > 1.5)) {
    return geuebt
      ? 'Kräftiger Tag mit ordentlich Druck: für eine geübte Crew gut zu fahren, aber nichts zum Nebenherlaufen.'
      : 'Kräftiger Tag. Machbar, aber nichts für eine ungeübte Crew.';
  }

  if (b.motorShare >= TEIL_MOTOR) return `Segeln und Maschine: Auf ${Math.round(b.motorShare * 100)} % der Strecke läuft die Maschine.`;
  if (b.isDaylight === false) return 'Segelbar, aber die Ankunft liegt im Dunkeln: Hafeneinfahrt vorher durchgehen.';
  if (b.gybeShare > 0.4 || (b.avgTwa > 100 && b.maxWind >= 8)) return 'Schöner Reisetag auf raumen Kursen.';
  if (b.maxWind >= 17) return 'Kräftiger, aber gut fahrbarer Segeltag.';
  if (b.maxWind >= 8) return 'Angenehmer Segeltag.';

  return 'Wenig Druck. Segelbar, aber es wird ein gemütlicher Tag.';
}
