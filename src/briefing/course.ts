import { nf } from '@/core/time';
import { STEEP_SEA } from '@/core/polar';
import type { Ablegezeit, Sprache } from '@/core/types';
import { windBand, boeigRuppig, anzeigeKn, MOTOR_FLAUTE_UNTER_KN } from './wind';

export const KREUZKURS_AB_ANTEIL = 0.55;

export function twaBand(t: number): number {
  if (t < 45) return 0;
  if (t < 62) return 1;
  if (t < 80) return 2;
  if (t < 100) return 3;
  if (t < 125) return 4;
  if (t < 150) return 5;
  return 6;
}

export const KURSLAGE = [
  'hart am Wind', 'am Wind', 'anliegender Am-Wind-Kurs', 'halber Wind',
  'raumschots', 'breit raumschots', 'vor dem Wind',
];

export const KURSLAGE_EN = [
  'hard on the wind', 'close-hauled', 'close reach', 'beam reach',
  'broad reach', 'deep broad reach', 'running',
];

const AUF_DIE_NASE_TWA = 30;

function seeLage(b: Ablegezeit): 'vorn' | 'querab' | 'achtern' | null {
  const a = b.seaAngle;
  if (a == null) return null;
  return a < 60 ? 'vorn' : a < 120 ? 'querab' : 'achtern';
}

const MOTORFAHRT_AB = 0.7;

function mittelteil(b: Ablegezeit): { twa: number; nm: number } | null {
  if (b.twaFirst === null) return null;
  const b0 = twaBand(b.twaFirst), b1 = twaBand(b.twaLast);
  if (b.twaMax !== undefined && b.twaMaxNM !== undefined && twaBand(b.twaMax) - Math.max(b0, b1) >= 2) {
    return { twa: b.twaMax, nm: b.twaMaxNM };
  }
  if (b.twaMin !== undefined && b.twaMinNM !== undefined && Math.min(b0, b1) - twaBand(b.twaMin) >= 2) {
    return { twa: b.twaMin, nm: b.twaMinNM };
  }
  return null;
}

function kursEntwicklung(b: Ablegezeit, sprache: Sprache = 'de'): string {
  if (b.twaFirst === null) return '';
  const b0 = twaBand(b.twaFirst), b1 = twaBand(b.twaLast);
  const mitte = mittelteil(b);

  const frueh = !!mitte && mitte.nm < 1;

  if (Math.abs(b1 - b0) < 2 && !mitte) return '';

  if (b.motorShare >= 0.995) return '';
  const en = sprache === 'en';
  const lageName = (twa: number): string => en
    ? (twa < AUF_DIE_NASE_TWA ? 'the wind sits almost dead ahead' : KURSLAGE_EN[twaBand(twa)]!)

    : (twa < AUF_DIE_NASE_TWA ? 'steht der Wind praktisch auf der Nase' : KURSLAGE[twaBand(twa)]!);

  const wechsel = b.motorShare > MOTORFAHRT_AB ? ''
    : en ? ' The sail change falls partway through the passage, so it is worth deciding in advance who handles it.'
      : ' Der Segelwechsel fällt mitten auf die Strecke, also besser vorher überlegen, wer ihn fährt.';

  if (en) {
    const verlauf = Math.abs(b1 - b0) >= 2
      ? ` The wind angle ${b1 > b0 ? 'frees' : 'heads'} en route from ${nf(b.twaFirst, 0, 'en')}° to ${nf(b.twaLast, 0, 'en')}°`
      : ` The wind angle is ${nf(b.twaFirst, 0, 'en')}° at the start and ${nf(b.twaLast, 0, 'en')}° at the end`;
    const zwischen = mitte
      ? (frueh ? `, shortly after departure ${nf(mitte.twa, 0, 'en')}°` : `, in between up to ${nf(mitte.twa, 0, 'en')}° (around ${nf(mitte.nm, 0, 'en')} NM in)`) : '';
    const lagen = mitte
      ? `, starting ${lageName(b.twaFirst)}, ${frueh ? 'shortly after departure' : 'in between'} ${lageName(mitte.twa)}, later ${lageName(b.twaLast)}.`
      : `, starting ${lageName(b.twaFirst)}, later ${lageName(b.twaLast)}.`;
    return verlauf + zwischen + lagen + wechsel;
  }
  const verlauf = Math.abs(b1 - b0) >= 2
    ? ` Der Windwinkel ${b1 > b0 ? 'raumt' : 'schralt'} unterwegs von ${nf(b.twaFirst, 0)}° auf ${nf(b.twaLast, 0)}°`
    : ` Der Windwinkel liegt anfangs bei ${nf(b.twaFirst, 0)}° und am Ende bei ${nf(b.twaLast, 0)}°`;
  const zwischen = mitte
    ? (frueh ? `, kurz nach dem Ablegen aber bei ${nf(mitte.twa, 0)}°` : `, zwischendurch aber bei ${nf(mitte.twa, 0)}° (nach rund ${nf(mitte.nm, 0)} sm)`) : '';

  const lagen = mitte
    ? `, anfangs ${lageName(b.twaFirst)}, ${frueh ? 'kurz nach dem Ablegen' : 'zwischendurch'} ${lageName(mitte.twa)}, gegen Ende ${lageName(b.twaLast)}.`
    : `, anfangs ${lageName(b.twaFirst)}, gegen Ende ${lageName(b.twaLast)}.`;
  return verlauf + zwischen + lagen + wechsel;
}

export function describeCourse(b: Ablegezeit, sprache: Sprache = 'de'): string {
  const entwicklung = kursEntwicklung(b, sprache);

  const liegtAn = b.motorShare <= 0.7 && b.beatShare <= 0.55 && b.gybeShare <= 0.55;
  if (entwicklung && liegtAn) return entwicklung.trimStart();
  return describeCourseKern(b, sprache) + entwicklung;
}

function describeCourseKernEn(b: Ablegezeit): string {
  const w = windBand(b.maxWind).i, t = twaBand(b.avgTwa);

  const boeig = boeigRuppig(b);
  const see = b.seaValid && (b.maxHs >= 1.0 || b.maxSteep > STEEP_SEA);
  const umweg = b.extraNM > 1
    ? ` ${nf(b.waterNM - b.extraNM, 0, 'en')} NM as the crow flies becomes ${nf(b.waterNM, 0, 'en')} NM through the water.` : '';

  if (b.motorShare > 0.7) {
    if (anzeigeKn(b.maxWind) < MOTOR_FLAUTE_UNTER_KN) return "Motoring throughout: there isn't enough wind to sail.";
    if (b.avgTwa < 45) return 'Mostly under engine: the wind is dead on the nose, and beating would gain less than motoring.';
    return 'Mostly under engine: under sail the yacht would make too little progress on this course.';
  }

  if (b.beatShare > KREUZKURS_AB_ANTEIL) {
    if (w <= 2) return 'Beating in barely any breeze. The tacks drag on, and in the lulls the boat all but stops.' + umweg;
    if (w === 3) return "Beating to windward in light air. The yacht won't point as high as the polar suggests: flatten the sails rather than pinching." + umweg;
    if (w === 4) return see
      ? `Close-hauled, tacking upwind. There is good breeze, but the ${seeLage(b) === 'vorn' ? 'head sea' : 'sea'} costs pointing and speed.` + umweg
      : 'Clean close-hauled sailing on alternating tacks. Enough breeze to hold a proper heading.' + umweg;
    if (w === 5) return "Beating into a fresh breeze. Plan for the first reef, it'll be wet on deck." + umweg;
    if (w === 6) return 'Hard beating into a strong breeze. Reef early, clip the crew on, hatches shut.' + umweg;
    return 'Beating in strong wind. This is work for an experienced crew. Seriously consider whether it is necessary.' + umweg;
  }

  if (b.gybeShare > KREUZKURS_AB_ANTEIL) {
    const g = b.extraNM > 1
      ? ` The gybing angle costs ${nf(b.extraNM, 0, 'en')} NM, but is clearly faster than sailing dead downwind.` : '';
    if (w <= 3) return 'Running downwind with gybes. Especially in light air it pays to head up a little. Dead downwind the main would blanket the headsail.' + g;
    if (w === 4) return (boeig
      ? 'Running downwind with gybes. With these gusts rig the preventer and gybe under control.'
      : 'Running downwind with gybes, a comfortable passage course. A preventer still does not hurt.') + g;
    if (w === 5) return 'Broad reaching with gybes in a fresh breeze. Rig the preventer, sheet in hard through the gybe.' + g;
    return 'Running downwind in a strong breeze. A preventer is essential, avoid an accidental gybe at all costs. Tack right around if you have to.' + g;
  }

  if (t === 0) return w <= 3
    ? 'Hard on the wind, only just laying the course. In this little breeze the yacht is sluggish and makes noticeable leeway.'
    : (see ? `Hard on the wind in a decent breeze ${seeLage(b) === 'vorn' ? 'with a head sea' : 'and a noticeable sea'}: no margin if the wind heads further.`
      : 'Hard on the wind, only just laying the course. No margin to windward if the wind heads further.');
  if (t === 1) return w >= 5
    ? 'Close-hauled in a fresh breeze: laying the course, but heeling noticeably.'
    : 'Close-hauled with a little margin; the course lies comfortably.';
  if (t === 2) return 'Close reach with margin to spare. If the wind heads a few degrees, the course still holds.';
  if (t === 3) {
    if (w <= 3) return 'Beam reach: in light air the course that still gathers the most speed.';
    if (w === 4) return boeig
      ? 'Beam reach: for this boat the fastest course of the day, heeling in the gusts.'
      : 'Beam reach: for this boat, the fastest and most comfortable course of the day.';
    if (w === 5) return 'Beam reach in a fresh breeze. Fast, but heeling: a reef in the main settles the boat without costing much.';
    return 'Beam reach in a strong breeze. A fast course, but reefed and keeping an eye out for gusts.';
  }
  if (t === 4) {

    if (w >= 6) return 'Broad reach in a strong breeze. Fast, but reefed, with the mainsheet in hand for the gusts.';
    if (see) {
      const l = seeLage(b);
      return `Broad reach with ${l === 'querab' ? 'a beam sea' : l === 'achtern' ? 'a following sea' : l === 'vorn' ? 'a head sea' : 'a noticeable sea'}. Fast, but the boat works noticeably.`;
    }
    if (w === 5) return 'Broad reach in a fresh breeze. Fast, heeling in the gusts: a reef in the main settles the boat.';
    return boeig
      ? 'Broad reach and fast. With these gusts keep the mainsheet in hand.'
      : 'Broad reach. Comfortable and fast, the boat runs steady and upright.';
  }
  if (t === 5) return w >= 5
    ? 'Deep broad reach in a fresh breeze: the fastest course of all, but watch the rolling.'
    : boeig
      ? 'Deep broad reach. With these gusts not a course to sail half-attentively: keep the mainsheet in hand.'
      : 'Deep broad reach, a relaxed passage course.';
  return w >= 5
    ? 'Running dead downwind in a strong breeze. Rig the preventer and steer attentively.'
    : 'Running dead downwind, the course lies directly astern.';
}

function describeCourseKern(b: Ablegezeit, sprache: Sprache = 'de'): string {
  if (sprache === 'en') return describeCourseKernEn(b);
  const w = windBand(b.maxWind).i, t = twaBand(b.avgTwa);

  const boeig = boeigRuppig(b);

  const see = b.seaValid && (b.maxHs >= 1.0 || b.maxSteep > STEEP_SEA);
  const umweg = b.extraNM > 1
    ? ` Aus ${nf(b.waterNM - b.extraNM, 0)} sm Luftlinie werden ${nf(b.waterNM, 0)} sm durchs Wasser.` : '';

  if (b.motorShare > 0.7) {
    if (anzeigeKn(b.maxWind) < MOTOR_FLAUTE_UNTER_KN) return 'Es bleibt bei der Maschine. Zum Segeln reicht der Wind nicht.';
    if (b.avgTwa < 45) return 'Überwiegend unter Maschine: der Wind steht genau auf die Nase, und Kreuzen brächte weniger als Motoren.';
    return 'Überwiegend unter Maschine: unter Segeln käme die Yacht auf diesem Kurs zu langsam voran.';
  }

  if (b.beatShare > KREUZKURS_AB_ANTEIL) {
    if (w <= 2) return 'Kreuzen bei kaum Druck. Die Schläge ziehen sich, und in den Flauten steht das Schiff fast.' + umweg;
    if (w === 3) return 'Aufkreuzen bei wenig Druck. Die Yacht läuft nicht die Höhe, die im Polardiagramm steht: Segel flach trimmen, nicht zu hoch anluven.' + umweg;
    if (w === 4) return see
      ? `Am Wind mit Kreuzschlägen. Der Wind reicht gut, aber die See ${seeLage(b) === 'vorn' ? 'von vorn ' : ''}kostet Höhe und Fahrt.` + umweg
      : 'Sauberes Am-Wind-Segeln mit Kreuzschlägen: Druck genug, um vernünftig Höhe zu laufen.' + umweg;
    if (w === 5) return 'Kreuzen gegen frische Brise. Erstes Reff einplanen, es wird nass an Deck.' + umweg;
    if (w === 6) return 'Hartes Kreuzen gegen starken Wind. Früh reffen, Crew anleinen, Luken dicht.' + umweg;
    return 'Kreuzen bei Starkwind. Das ist Arbeit für eine geübte Crew. Ernsthaft prüfen, ob es sein muss.' + umweg;
  }

  if (b.gybeShare > KREUZKURS_AB_ANTEIL) {
    const g = b.extraNM > 1
      ? ` Der Halsbogen kostet ${nf(b.extraNM, 0)} sm, ist aber klar schneller als platt vor dem Laken.` : '';
    if (w <= 3) return 'Vor dem Wind mit Halsen. Gerade bei wenig Druck lohnt das Anluven: direkt vor dem Wind nähme das Groß der Fock den Wind.' + g;
    if (w === 4) return (boeig
      ? 'Vor dem Wind mit Halsen. Bei diesen Böen Bullenstander setzen und kontrolliert halsen.'
      : 'Vor dem Wind mit Halsen, angenehmer Reisekurs. Bullenstander schadet trotzdem nicht.') + g;
    if (w === 5) return 'Raumschots mit Halsen bei frischer Brise. Bullenstander setzen, beim Halsen die Schot dichtholen.' + g;
    return 'Vor dem Wind bei kräftigem Druck. Bullenstander ist Pflicht, Patenthalse unbedingt vermeiden: notfalls Q-Wende.' + g;
  }

  if (t === 0) return w <= 3
    ? 'Hart am Wind, gerade noch anliegend. Bei so wenig Druck läuft die Yacht träge und driftet spürbar nach Lee.'
    : (see ? `Hart am Wind bei ordentlichem Druck und ${seeLage(b) === 'vorn' ? 'See von vorn' : 'spürbarer See'}: kein Spielraum, falls der Wind schralt.`
      : 'Hart am Wind, der Kurs liegt gerade noch an. Kein Spielraum nach Luv, falls der Wind schralt.');
  if (t === 1) return w >= 5
    ? 'Am Wind bei frischer Brise: anliegend, aber mit deutlicher Krängung.'
    : 'Am Wind mit etwas Luft; der Kurs liegt sicher an.';
  if (t === 2) return 'Anliegender Am-Wind-Kurs mit Reserve: schralt der Wind ein paar Grad, bleibt der Kurs trotzdem fahrbar.';
  if (t === 3) {
    if (w <= 3) return 'Halber Wind: bei wenig Druck der Kurs, auf dem noch am meisten Fahrt zusammenkommt.';
    if (w === 4) return boeig
      ? 'Halber Wind: für dieses Schiff der schnellste Kurs des Tages, in den Böen mit Krängung.'
      : 'Halber Wind: für dieses Schiff der schnellste und bequemste Kurs des Tages.';
    if (w === 5) return 'Halber Wind bei frischer Brise. Schnell, aber mit Krängung: ein Reff im Groß macht es ruhiger, ohne viel zu kosten.';
    return 'Halber Wind bei kräftigem Druck. Schneller Kurs, aber gerefft und mit Ausguck auf die Böen.';
  }
  if (t === 4) {

    if (w >= 6) return 'Raumschots bei kräftigem Druck. Schnell, aber gerefft und mit der Großschot in der Hand für die Böen.';
    if (see) {
      const l = seeLage(b);
      return `Raumschots mit ${l === 'querab' ? 'See querab' : l === 'achtern' ? 'achterlicher See' : l === 'vorn' ? 'See von vorn' : 'spürbarer See'}: schnell, aber das Schiff arbeitet spürbar.`;
    }
    if (w === 5) return 'Raumschots bei frischer Brise. Schnell, in den Böen mit Krängung: ein Reff im Groß macht es ruhiger.';
    return boeig
      ? 'Raumschots und schnell: bei diesen Böen die Großschot in der Hand behalten.'
      : 'Raumschots. Bequem und schnell, das Schiff läuft ruhig und aufrecht.';
  }
  if (t === 5) return w >= 5
    ? 'Breit raumschots bei frischer Brise: der schnellste Kurs überhaupt, aber Ausguck auf die Rollbewegung.'
    : boeig
      ? 'Breit raumschots: bei diesen Böen kein Kurs zum Nebenherlaufen: die Großschot in der Hand behalten.'
      : 'Breit raumschots, ein entspannter Reisekurs.';
  return w >= 5
    ? 'Vorwindkurs bei kräftigem Wind. Bullenstander setzen und aufmerksam steuern.'
    : 'Vorwindkurs, der Kurs liegt direkt an.';
}
