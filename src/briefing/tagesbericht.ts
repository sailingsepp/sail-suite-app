import { nf } from '@/core/time';
import type { Sprache } from '@/core/types';
import { richtungsName, beaufort } from './wind';

export interface TagesberichtEingabe {
  ablegen?: number;
  anlegen?: number;

  anlegenArt?: string;
  streckeNM: number;
  fahrzeitS: number;
  maxSog: number;
  segel: { nm: number; prozent: number };
  motor: { nm: number; prozent: number };
  offen: { nm: number; prozent: number };

  wechsel: { t: number; antrieb: 'segel' | 'motor' }[];
  pausen: { von: number; bis: number; ort?: string }[];

  eintraege: {
    art: string; t: number;
    wetter?: { quelle: 'vorhersage' | 'beobachtet'; windKn?: number; windAus?: number; boeKn?: number; welleM?: number };
  }[];
  nachtfahrten: number;
  nachtansteuerung: boolean;
  lueckenAnzahl: number;
  lueckenS: number;

  uhr: (t: number) => string;
}

const FAST_GANZ = 90;

const WECHSEL_EINZELN = 3;

const ABWEICHUNG_KN = 5;

function dauer(s: number): string {
  const min = Math.floor(s / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

function mittlereRichtung(grade: number[]): number | null {
  if (!grade.length) return null;
  let x = 0;
  let y = 0;
  for (const g of grade) {
    x += Math.cos((g * Math.PI) / 180);
    y += Math.sin((g * Math.PI) / 180);
  }
  const laenge = Math.hypot(x, y) / grade.length;
  if (laenge < 0.6) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function spanne(werte: number[]): string {
  const lo = Math.round(Math.min(...werte));
  const hi = Math.round(Math.max(...werte));
  return lo === hi ? `${hi}` : `${lo}–${hi}`;
}

function windSatz(e: TagesberichtEingabe, sprache: Sprache): string[] {
  const de = sprache === 'de';
  const saetze: string[] = [];
  const vh = e.eintraege.filter((x) => x.art === 'wetter' && x.wetter?.quelle === 'vorhersage' && x.wetter.windKn !== undefined);
  const bo = e.eintraege.filter((x) => x.art === 'wetter' && x.wetter?.quelle === 'beobachtet' && x.wetter.windKn !== undefined);
  let vorhersageMax: number | null = null;
  if (vh.length) {
    const kn = vh.map((x) => x.wetter!.windKn!);
    vorhersageMax = Math.max(...kn);

    const richtung = mittlereRichtung(vh.flatMap((x) => (x.wetter!.windAus !== undefined && Math.round(x.wetter!.windKn!) > 0 ? [x.wetter!.windAus] : [])));
    const aus = richtung === null
      ? (de ? 'aus wechselnden Richtungen' : 'from varying directions')
      : (de ? `aus ${richtungsName(richtung, 'de')}` : `from ${richtungsName(richtung, 'en')}`);
    const boeen = vh.flatMap((x) => (x.wetter!.boeKn !== undefined ? [x.wetter!.boeKn] : []));
    const maxBoe = boeen.length ? Math.max(...boeen) : null;
    const welle = vh.flatMap((x) => (x.wetter!.welleM !== undefined ? [x.wetter!.welleM] : []));
    const maxWelle = welle.length ? Math.max(...welle) : null;
    const bft = beaufort(Math.round(vorhersageMax));
    const still = Math.round(vorhersageMax) === 0;
    let s = still
      ? (de ? 'Wind laut Vorhersage 0 kn' : 'Wind according to the forecast 0 kn')
      : de
        ? `Wind laut Vorhersage ${aus} ${spanne(kn)} kn (bis ${bft} Bft)`
        : `Wind according to the forecast ${aus} ${spanne(kn)} kn (up to force ${bft})`;

    if (maxBoe !== null && Math.round(maxBoe) > Math.round(vorhersageMax)) {
      s += de ? `, Böen bis ${Math.round(maxBoe)} kn` : `, gusts up to ${Math.round(maxBoe)} kn`;
    }
    if (maxWelle !== null && maxWelle >= 0.1) {
      s += de ? `, See bis ${nf(maxWelle, 1, 'de')} m` : `, sea up to ${nf(maxWelle, 1, 'en')} m`;
    }
    saetze.push(s + '.');
  }
  if (bo.length) {
    const kn = bo.map((x) => x.wetter!.windKn!);
    const max = Math.max(...kn);
    const richtung = mittlereRichtung(bo.flatMap((x) => (x.wetter!.windAus !== undefined ? [x.wetter!.windAus] : [])));
    const aus = richtung === null ? '' : (de ? ` aus ${richtungsName(richtung, 'de')}` : ` from ${richtungsName(richtung, 'en')}`);
    let s = de ? `An Bord beobachtet: bis ${Math.round(max)} kn${aus}` : `Observed on board: up to ${Math.round(max)} kn${aus}`;
    if (vorhersageMax !== null && Math.abs(max - vorhersageMax) >= ABWEICHUNG_KN) {
      const mehr = max > vorhersageMax;
      s += de
        ? `, deutlich ${mehr ? 'mehr' : 'weniger'} als vorhergesagt`
        : `, clearly ${mehr ? 'more' : 'less'} than forecast`;
    }
    saetze.push(s + '.');
  }
  return saetze;
}

function antriebSaetze(e: TagesberichtEingabe, sprache: Sprache): string[] {
  const de = sprache === 'de';
  const sm = de ? 'sm' : 'NM';
  const saetze: string[] = [];
  if (e.segel.prozent >= FAST_GANZ) {
    saetze.push(de ? 'Fast durchgehend unter Segeln.' : 'Almost entirely under sail.');
  } else if (e.motor.prozent >= FAST_GANZ) {
    saetze.push(de ? 'Fast durchgehend unter Maschine.' : 'Almost entirely under engine.');
  } else if (e.segel.nm > 0.05 || e.motor.nm > 0.05) {
    saetze.push(de
      ? `${nf(e.segel.nm, 1, 'de')} ${sm} unter Segeln (${nf(e.segel.prozent, 0, 'de')} %), ${nf(e.motor.nm, 1, 'de')} ${sm} unter Maschine.`
      : `${nf(e.segel.nm, 1, 'en')} ${sm} under sail (${nf(e.segel.prozent, 0, 'en')} %), ${nf(e.motor.nm, 1, 'en')} ${sm} under engine.`);
  }
  if (e.offen.prozent > 50) {
    saetze.push(de
      ? 'Für den größten Teil der Strecke ist nicht eingetragen, ob gesegelt oder motort wurde.'
      : 'For most of the distance, the log does not say whether under sail or under engine.');
  }

  const unterwegs = e.wechsel.filter((w, i) => i > 0 && w.antrieb !== e.wechsel[i - 1]!.antrieb);
  if (unterwegs.length > WECHSEL_EINZELN) {
    saetze.push(de
      ? `${unterwegs.length} Wechsel zwischen Segel und Maschine.`
      : `${unterwegs.length} changes between sail and engine.`);
  } else if (unterwegs.length) {
    const teile = unterwegs.map((w) => (w.antrieb === 'segel'
      ? (de ? `Segel ab ${e.uhr(w.t)}` : `sail from ${e.uhr(w.t)}`)
      : (de ? `Maschine ab ${e.uhr(w.t)}` : `engine from ${e.uhr(w.t)}`)));
    const satz = teile.join(', ');
    saetze.push(satz.charAt(0).toUpperCase() + satz.slice(1) + '.');
  }
  return saetze;
}

export function tagesbericht(e: TagesberichtEingabe, sprache: Sprache = 'de'): string {
  const de = sprache === 'de';
  const sm = de ? 'sm' : 'NM';
  const saetze: string[] = [];

  if (e.streckeNM <= 0.05) {
    saetze.push(de
      ? 'An diesem Tag wurde keine Strecke aufgezeichnet.'
      : 'No distance was recorded on this day.');
  } else {
    const strecke = `${nf(e.streckeNM, 1, sprache)} ${sm}`;
    const zeit = dauer(e.fahrzeitS);
    const schnitt = e.fahrzeitS > 0 ? e.streckeNM / (e.fahrzeitS / 3600) : 0;
    saetze.push(de
      ? `${strecke} in ${zeit} Fahrzeit, im Schnitt ${nf(schnitt, 1, 'de')} kn, in der Spitze ${nf(e.maxSog, 1, 'de')} kn.`
      : `${strecke} in ${zeit} under way, averaging ${nf(schnitt, 1, 'en')} kn, peaking at ${nf(e.maxSog, 1, 'en')} kn.`);
  }

  const ende = e.anlegenArt === 'ankern'
    ? (de ? 'vor Anker gegangen' : 'anchored')
    : e.anlegenArt === 'ziel' ? (de ? 'angekommen' : 'arrived') : (de ? 'festgemacht' : 'moored');
  if (e.ablegen !== undefined && e.anlegen !== undefined) {
    saetze.push(de
      ? `Abgelegt um ${e.uhr(e.ablegen)}, ${ende} um ${e.uhr(e.anlegen)}.`
      : `Cast off at ${e.uhr(e.ablegen)}, ${ende} at ${e.uhr(e.anlegen)}.`);
  } else if (e.ablegen !== undefined) {
    saetze.push(de ? `Abgelegt um ${e.uhr(e.ablegen)}.` : `Cast off at ${e.uhr(e.ablegen)}.`);
  } else if (e.anlegen !== undefined) {
    const satz = de ? `${ende} um ${e.uhr(e.anlegen)}.` : `${ende} at ${e.uhr(e.anlegen)}.`;
    saetze.push(satz.charAt(0).toUpperCase() + satz.slice(1));
  }

  if (e.streckeNM > 0.05) saetze.push(...antriebSaetze(e, sprache));
  saetze.push(...windSatz(e, sprache));

  if (e.pausen.length === 1) {
    const p = e.pausen[0]!;
    const ort = p.ort ? (de ? ` bei ${p.ort}` : ` at ${p.ort}`) : '';
    saetze.push(de
      ? `Eine Pause von ${e.uhr(p.von)} bis ${e.uhr(p.bis)}${ort}.`
      : `One stop from ${e.uhr(p.von)} to ${e.uhr(p.bis)}${ort}.`);
  } else if (e.pausen.length > 1) {
    const summe = e.pausen.reduce((s, p) => s + (p.bis - p.von) / 1000, 0);
    const laengste = [...e.pausen].sort((a, b) => (b.bis - b.von) - (a.bis - a.von))[0]!;
    const ort = laengste.ort ? (de ? ` bei ${laengste.ort}` : ` at ${laengste.ort}`) : '';
    saetze.push(de
      ? `${e.pausen.length} Pausen, zusammen ${dauer(summe)}; die längste von ${e.uhr(laengste.von)} bis ${e.uhr(laengste.bis)}${ort}.`
      : `${e.pausen.length} stops, ${dauer(summe)} in total; the longest from ${e.uhr(laengste.von)} to ${e.uhr(laengste.bis)}${ort}.`);
  }

  const zahl = (art: string) => e.eintraege.filter((x) => x.art === art).length;
  const ereignisse: string[] = [];
  const auf = zahl('aufschiesser');
  if (auf) ereignisse.push(de ? `${auf}× aufgeschossen` : `${auf}× head to wind`);
  const ais = zahl('ais');
  if (ais) ereignisse.push(de ? `${ais} ${ais === 1 ? 'Schiff' : 'Schiffe'} laut AIS im Logbuch` : `${ais} ${ais === 1 ? 'vessel' : 'vessels'} logged via AIS`);
  const wache = zahl('ankerwache');
  if (wache) ereignisse.push(de ? `die Ankerwache schlug ${wache}× an` : `the anchor watch alarmed ${wache}×`);
  const fotos = zahl('foto');
  if (fotos) ereignisse.push(de ? `${fotos} ${fotos === 1 ? 'Foto' : 'Fotos'}` : `${fotos} ${fotos === 1 ? 'photo' : 'photos'}`);
  if (ereignisse.length) {
    const satz = (de ? 'Unterwegs: ' : 'Under way: ') + ereignisse.join(', ') + '.';
    saetze.push(satz);
  }

  if (e.nachtfahrten > 0) {
    saetze.push(de ? 'Der Schlag zählt als Nachtfahrt.' : 'The leg counts as a night passage.');
  }
  if (e.nachtansteuerung) {
    saetze.push(de ? 'Der Liegeplatz wurde nachts angesteuert.' : 'The berth was approached at night.');
  }
  if (e.lueckenAnzahl > 0) {
    saetze.push(de
      ? `Die Aufzeichnung hat ${e.lueckenAnzahl === 1 ? 'eine Lücke' : `${e.lueckenAnzahl} Lücken`} von zusammen ${dauer(e.lueckenS)}. Diese Strecke fehlt in den Zahlen.`
      : `The recording has ${e.lueckenAnzahl === 1 ? 'one gap' : `${e.lueckenAnzahl} gaps`} totalling ${dauer(e.lueckenS)}. That distance is missing from the figures.`);
  }
  return saetze.join(' ');
}
