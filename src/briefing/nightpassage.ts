import { nf, uhrLt, vonRevierzeit, zuRevierzeit } from '@/core/time';
import { mondphase, mondzeiten, mondhoehe, MOND_HORIZONT, type Mondphasenname } from '@/core/moon';
import { segmenteSchneidenSich } from '@/core/geo';
import type { Dunkelheit, Dunkelphase, DunkelBezug } from '@/core/darkness';
import type { Ablegezeit, AnkerplatzArt, Punkt, Sprache } from '@/core/types';
import { istInselrevier, type Inselrevier } from './terrain';
import { anzeigeKn } from './wind';
import { REFF_AM_WIND } from './sails';

const MONDPHASE_EN: Record<Mondphasenname, string> = {
  'Neumond': 'new moon',
  'zunehmende Sichel': 'waxing crescent',
  'erstes Viertel': 'first quarter',
  'zunehmender Mond': 'waxing gibbous',
  'Vollmond': 'full moon',
  'abnehmender Mond': 'waning gibbous',
  'letztes Viertel': 'last quarter',
  'abnehmende Sichel': 'waning crescent',
};

export function stundenText(h: number, sprache: Sprache = 'de'): string {
  if (sprache === 'en') {
    if (h < 1.5) return `${Math.round(h * 60)} minutes`;
    const ganze = Math.floor(h);
    const min = Math.round((h - ganze) * 60);
    if (min === 0) return `${ganze} hours`;
    if (min === 30) return `${ganze}½ hours`;
    return `${nf(h, 1, 'en')} hours`;
  }
  if (h < 1.5) return `${Math.round(h * 60)} Minuten`;
  const ganze = Math.floor(h);
  const min = Math.round((h - ganze) * 60);
  if (min === 0) return `${ganze} Stunden`;
  if (min === 30) return `${ganze}½ Stunden`;
  return `${nf(h, 1)} Stunden`;
}

function ortText(nm: number, gesamtNM: number, sprache: Sprache = 'de'): string {
  const rest = gesamtNM - nm;
  if (sprache === 'en') {
    if (nm < 2) return 'practically still in harbour';
    if (rest < 2) return 'practically at the destination already';
    return `roughly ${nf(nm, 0, 'en')} NM after departure, ${nf(rest, 0, 'en')} NM still to go`;
  }
  if (nm < 2) return 'praktisch noch im Hafen';
  if (rest < 2) return 'praktisch schon am Ziel';
  return `rund ${nf(nm, 0)} sm nach dem Ablegen, noch ${nf(rest, 0)} sm bis zum Ziel`;
}

export const WACHPLAN_AB_STUNDEN = 3;

function wachplan(dunkelStunden: number, wachgaenger: number, sprache: Sprache = 'de'): string {
  if (dunkelStunden < WACHPLAN_AB_STUNDEN) return '';
  if (wachgaenger <= 1) {
    if (sprache === 'en') {
      return '<b class="warn-text">Singlehanding through the night</b> is a different matter from a night '
        + 'passage with watches. Without a watch rotation, only a 20 to 30 minute alarm rhythm remains, '
        + 'and that wears you down faster than planned. Anyone without practice at this should rather put '
        + 'the passage off.';
    }
    return '<b class="warn-text">Einhand durch die Nacht</b> ist etwas anderes als eine Nachtfahrt mit Wachen. '
      + 'Ohne Wachwechsel bleibt nur ein Weckerrhythmus von 20 bis 30 Minuten, und der zehrt schneller, '
      + 'als man plant. Wer das nicht geübt hat, verschiebt den Schlag lieber.';
  }

  const kandidaten = [2, 2.5, 3, 3.5, 4];
  let beste = 3, bestFehler = Infinity;
  for (const d of kandidaten) {
    const n = Math.round(dunkelStunden / d);
    if (n < 1) continue;
    const fehler = Math.abs(dunkelStunden / n - d);
    if (fehler < bestFehler) { bestFehler = fehler; beste = d; }
  }
  const anzahl = Math.max(1, Math.round(dunkelStunden / beste));
  const dauer = dunkelStunden / anzahl;
  const jeder = anzahl / wachgaenger;
  if (sprache === 'en') {
    return `With ${wachgaenger} watchkeepers and ${stundenText(dunkelStunden, 'en')} of darkness, `
      + `<b>${anzahl === 1 ? 'one watch of around' : `${anzahl} watches of around`} ${stundenText(dauer, 'en')}${anzahl === 1 ? '' : ' each'}</b> fit in. That works out to `
      + `${jeder < 1.2 ? 'one watch' : `${Number.isInteger(jeder) ? jeder : nf(jeder, 1, 'en')} watches`} each. `
      + (wachgaenger === 2
        ? 'With two watchkeepers, it pays to start the rhythm as early as the afternoon: anyone who only '
          + 'starts sleeping once darkness falls does not really sleep.'
        : 'The first and last watch are the easiest. The hardest lies between 0300 and 0500 LT in the '
          + 'morning, and that is where the most rested hand belongs.');
  }
  return `Bei ${wachgaenger} Wachfähigen an Bord und ${stundenText(dunkelStunden)} Dunkelheit passen `
    + `<b>${anzahl === 1 ? 'eine Wache von' : `${anzahl} Wachen zu je`} rund ${stundenText(dauer)}</b> hinein. Jeder kommt damit auf `

    + `${jeder < 1.2 ? 'eine Wache' : `${Number.isInteger(jeder) ? jeder : nf(jeder, 1)} Wachen`}. `
    + (wachgaenger === 2
      ? 'Zu zweit lohnt es, den Rhythmus schon am Nachmittag zu beginnen: Wer erst bei Einbruch der '
        + 'Dunkelheit anfängt zu schlafen, schläft nicht.'
      : 'Die erste und die letzte Wache sind die leichtesten. Die schwerste liegt zwischen 0300 und '
        + '0500 LT, dorthin gehört der Ausgeruhteste.');
}

export function mondText(phase: Dunkelphase, ziel: Punkt | null, versatz: number, sprache: Sprache = 'de'): string {
  const p = ziel ?? phase.beginnOrt;
  const beginn = vonRevierzeit(phase.beginn, versatz).getTime();
  const endeNaiv = phase.ende ?? new Date(phase.beginn.getTime() + phase.stunden * 3600_000);
  const ende = vonRevierzeit(endeNaiv, versatz).getTime();
  const m = mondphase(new Date(beginn));

  const anteil = Math.round((m.beleuchtung * 100) / 5) * 5;

  const z = mondzeiten(p.lat, p.lon, new Date(beginn - 12 * 3600_000));
  const imFenster = (d: Date | null) => !!d && d.getTime() > beginn - 60_000 && d.getTime() < ende;
  const ort = (d: Date) => uhrLt(zuRevierzeit(d, versatz));
  const stehtSchon = mondhoehe(p.lat, p.lon, new Date(beginn)) > MOND_HORIZONT;

  if (sprache === 'en') {
    let satz = `<b>Moon:</b> ${MONDPHASE_EN[m.name]}, roughly ${anteil} % illuminated`;
    if (anteil <= 15) {
      satz += ', practically a dark night, sail by instruments and navigation lights.';
    } else if (anteil >= 85) {
      satz += ', in clear air, this is enough to make out the coastline, sail trim and the sea state.';
    } else {
      satz += '.';
    }
    if (!stehtSchon && imFenster(z.auf)) {
      satz += ` It only rises at ${ort(z.auf!)}. Until then it is dark.`;
    } else if (stehtSchon && imFenster(z.unter)) {
      satz += ` It sets at ${ort(z.unter!)}, after which it stays dark for the rest of the night.`;
    } else if (stehtSchon) {
      satz += ' It is already up by the time it gets dark.';
    }
    return satz;
  }

  let satz = `<b>Mond:</b> ${m.name}, rund ${anteil} % beleuchtet`;
  if (anteil <= 15) {
    satz += ', praktisch eine dunkle Nacht, gefahren wird nach Instrument und Positionslichtern.';
  } else if (anteil >= 85) {
    satz += ', bei klarer Luft sieht man damit Küstenlinie, Segelstand und Wellenbild.';
  } else {
    satz += '.';
  }

  if (!stehtSchon && imFenster(z.auf)) {
    satz += ` Er geht erst um ${ort(z.auf!)} auf. Bis dahin ist es dunkel.`;
  } else if (stehtSchon && imFenster(z.unter)) {
    satz += ` Um ${ort(z.unter!)} geht er unter, danach wird es für den Rest der Nacht dunkel.`;
  } else if (stehtSchon) {
    satz += ' Er steht schon am Himmel, wenn es dunkel wird.';
  }
  return satz;
}

export interface NachtfahrtEingabe {

  dunkel: Dunkelheit;

  sonneWeg: Dunkelheit;

  grenzeName: string;
  gesamtNM: number;
  wachgaenger: number;
  best: Ablegezeit;
  ziel: Punkt | null;
  ankerplatzArt: AnkerplatzArt;

  sonnenaufgangAmZiel: Date | null;

  track: DunkelBezug[];

  monat: number;

  utcOffsetSeconds?: number;
}

export function nachtImFazit(dunkel: Dunkelheit, ankunft: Date, sprache: Sprache = 'de'): string | null {
  if (!dunkel.phasen.length) return null;

  const ankunftDunkel = dunkel.phasen.some((p) => !p.ende);
  if (sprache === 'en') {
    return `On top of that, about ${stundenText(dunkel.stunden, 'en')} in the dark`
      + (ankunftDunkel ? `, arriving at ${uhrLt(ankunft)}.` : '.');
  }
  return `Dazu rund ${stundenText(dunkel.stunden)} im Dunkeln`
    + (ankunftDunkel ? `, Ankunft um ${uhrLt(ankunft)}.` : '.');
}

export function describeNachtfahrt(e: NachtfahrtEingabe, sprache: Sprache = 'de'): string | null {
  if (sprache === 'en') return describeNachtfahrtEn(e);
  if (!e.dunkel.phasen.length) return null;
  const T: string[] = [];

  const anteilProzent = Math.round(e.dunkel.anteil * 100);
  T.push(`<b>Dieser Schlag geht durch die Nacht:</b> rund ${stundenText(e.dunkel.stunden)} im Dunkeln, `
    + `etwa ${anteilProzent} % der Strecke.`);

  for (const p of e.dunkel.phasen) {

    const amHalt = p.endeAmHalt && p.ende
      ? `Den Aufenthalt erreicht die Yacht gegen <b>${uhrLt(p.ende)}</b> im Dunkeln, `
        + `${ortText(p.endeNM ?? 0, e.gesamtNM)}.`
      : null;
    if (p.vonAnfangAn) {
      T.push('Abgelegt wird bereits im Dunkeln. ' + (amHalt ?? ('Hell wird es '
        + (p.ende ? `gegen ${uhrLt(p.ende)}, ${ortText(p.endeNM ?? 0, e.gesamtNM)}.` : 'erst nach der Ankunft.'))));
      continue;
    }
    if (p.abHalt) {
      T.push(`Nach dem Aufenthalt wird gegen <b>${uhrLt(p.beginn)}</b> im Dunkeln abgelegt, `
        + `${ortText(p.beginnNM, e.gesamtNM)}.`);
    } else {

      const sonne = e.sonneWeg.phasen.find((s) => Math.abs(s.beginn.getTime() - p.beginn.getTime()) < 3 * 3600_000);
      const vorlauf = (sonne && sonne.beginn < p.beginn)
        ? `Die Sonne geht gegen ${uhrLt(sonne.beginn)} unter. ` : '';
      T.push(`${vorlauf}Dunkel nach der gewählten Grenze (${e.grenzeName}) wird es gegen `
        + `<b>${uhrLt(p.beginn)}</b>, ${ortText(p.beginnNM, e.gesamtNM)}.`);
    }
    if (amHalt) {
      T.push(amHalt);
    } else if (p.ende) {
      T.push(`Hell wird es wieder gegen <b>${uhrLt(p.ende)}</b>, ${ortText(p.endeNM ?? 0, e.gesamtNM)}.`);
    } else {
      T.push('Bis zur Ankunft bleibt es dunkel.');
    }
  }

  T.push(mondText(e.dunkel.phasen[0]!, e.ziel, e.utcOffsetSeconds ?? 0));

  const wachen = wachplan(e.dunkel.stunden, e.wachgaenger);
  if (wachen) T.push(wachen);

  const startOrt = e.dunkel.phasen[0]!.beginnOrt;
  const nachtwind = nachtwindHinweis(istInselrevier(startOrt.lat, startOrt.lon), e.monat, e.best);
  if (nachtwind) T.push(nachtwind);

  const landfall = describeLandfall(e);
  if (landfall) T.push(landfall);

  T.push('<b>Unterwegs:</b> Positionslichter vor Einbruch der Dunkelheit prüfen, Radarreflektor und AIS '
    + 'setzen, Rettungswesten und Lifebelt für alle an Deck. Nachts wird niemand allein an Deck geschickt, '
    + 'der nicht eingepickt ist. Fischerboote und Netzmarkierungen führen häufig kein AIS und oft nur ein '
    + 'schwaches Licht; wer nur auf den Plotter schaut, sieht sie nicht.');

  const faehren = gekreuzteFaehrlinien(e.track);
  if (faehren.length) {
    T.push(`Die Route kreuzt ${faehren.length === 1 ? 'die Fährlinie' : 'die Fährlinien'} `
      + `<b>${faehren.join(', ')}</b>: diese Verbindungen laufen überwiegend nachts. `
      + 'Eine Fähre macht über 20 kn; zwischen dem ersten Licht und einer engen Begegnung liegen wenige '
      + 'Minuten. Die Linien sind hier als gerade Hafen-zu-Hafen-Verbindung hinterlegt und nicht '
      + 'vollständig. Sie ersetzen weder AIS noch Ausguck.');
  }

  return T.join(' ');
}

function describeNachtfahrtEn(e: NachtfahrtEingabe): string | null {
  if (!e.dunkel.phasen.length) return null;
  const T: string[] = [];

  const anteilProzent = Math.round(e.dunkel.anteil * 100);
  T.push(`<b>This leg runs through the night:</b> roughly ${stundenText(e.dunkel.stunden, 'en')} in the `
    + `dark, about ${anteilProzent} % of the route.`);

  for (const p of e.dunkel.phasen) {
    const amHalt = p.endeAmHalt && p.ende
      ? `The stop is reached in the dark around <b>${uhrLt(p.ende)}</b>, ${ortText(p.endeNM ?? 0, e.gesamtNM, 'en')}.`
      : null;
    if (p.vonAnfangAn) {
      T.push('Departure is already in the dark. ' + (amHalt ?? ('It gets light '
        + (p.ende ? `around ${uhrLt(p.ende)}, ${ortText(p.endeNM ?? 0, e.gesamtNM, 'en')}.` : 'only after arrival.'))));
      continue;
    }
    if (p.abHalt) {
      T.push(`After the stop, departure is around <b>${uhrLt(p.beginn)}</b> in the dark, `
        + `${ortText(p.beginnNM, e.gesamtNM, 'en')}.`);
    } else {
      const sonne = e.sonneWeg.phasen.find((s) => Math.abs(s.beginn.getTime() - p.beginn.getTime()) < 3 * 3600_000);
      const vorlauf = (sonne && sonne.beginn < p.beginn)
        ? `The sun sets around ${uhrLt(sonne.beginn)}. ` : '';
      T.push(`${vorlauf}It gets dark by the chosen limit (${e.grenzeName}) around `
        + `<b>${uhrLt(p.beginn)}</b>, ${ortText(p.beginnNM, e.gesamtNM, 'en')}.`);
    }
    if (amHalt) {
      T.push(amHalt);
    } else if (p.ende) {
      T.push(`It gets light again around <b>${uhrLt(p.ende)}</b>, ${ortText(p.endeNM ?? 0, e.gesamtNM, 'en')}.`);
    } else {
      T.push('It stays dark until arrival.');
    }
  }

  T.push(mondText(e.dunkel.phasen[0]!, e.ziel, e.utcOffsetSeconds ?? 0, 'en'));

  const watches = wachplan(e.dunkel.stunden, e.wachgaenger, 'en');
  if (watches) T.push(watches);

  const startOrt = e.dunkel.phasen[0]!.beginnOrt;
  const nachtwind = nachtwindHinweis(istInselrevier(startOrt.lat, startOrt.lon), e.monat, e.best, 'en');
  if (nachtwind) T.push(nachtwind);

  const landfall = describeLandfall(e, 'en');
  if (landfall) T.push(landfall);

  T.push('<b>Underway:</b> check navigation lights before dark falls, rig a radar reflector and AIS, '
    + 'lifejackets and a lifebelt/harness for everyone on deck. Nobody goes on deck alone at night without '
    + 'being clipped on. Fishing boats and net markers often carry no AIS and only a weak light; anyone '
    + 'watching only the plotter will not see them.');

  const faehren = gekreuzteFaehrlinien(e.track);
  if (faehren.length) {
    T.push(`The route crosses the ferry ${faehren.length === 1 ? 'line' : 'lines'} `
      + `<b>${faehren.join(', ')}</b>: these services run mostly at night. `
      + 'A ferry makes over 20 kn; only a few minutes pass between the first light and a close encounter. '
      + 'The lines here are modelled as a straight port-to-port connection and are not exhaustive. They '
      + 'replace neither AIS nor a lookout.');
  }

  return T.join(' ');
}

export const DRAUSSEN_WARTEN_MAX_H = 3;

function describeLandfall(e: NachtfahrtEingabe, sprache: Sprache = 'de'): string | null {
  if (e.best.isDaylight !== false) return null;
  const istMarina = e.ankerplatzArt === 'marina';
  const sr = e.sonnenaufgangAmZiel;

  const kurzBisHell = !sr || sr.getTime() - e.best.arrival.getTime() <= DRAUSSEN_WARTEN_MAX_H * 3_600_000;
  if (sprache === 'en') {
    const wartenBisEn = sr ? ` It gets light there around ${uhrLt(sr)}.` : '';
    if (istMarina) {
      return `<b class="warn-text">The arrival at ${uhrLt(e.best.arrival)} falls in the dark.</b> `
        + 'You can enter a lit harbour at night too, but the harbour office will not be staffed, and an '
        + 'open berth is harder to find in the dark. Have approach notes and light characteristics ready '
        + `beforehand, not just outside the harbour entrance.${wartenBisEn}`;
    }
    return `<b class="warn-text">The arrival at ${uhrLt(e.best.arrival)} falls in the dark, and the `
      + 'destination is not a confirmed harbour.</b> Entering an unlit bay, judging the holding ground and '
      + 'finding a spot among boats already anchored is not something to attempt in the dark. '
      + (kurzBisHell ? 'Either depart later, or wait outside and approach in daylight.'
        : 'Either time the departure so that the arrival falls in daylight, or choose a lit harbour as the destination.')
      + wartenBisEn;
  }
  const wartenBis = sr ? ` Hell wird es dort gegen ${uhrLt(sr)}.` : '';

  if (istMarina) {
    return `<b class="warn-text">Die Ankunft um ${uhrLt(e.best.arrival)} liegt im Dunkeln.</b> `
      + 'In einen befeuerten Hafen kann man auch nachts einlaufen, aber die Hafenmeisterei ist nicht besetzt, '
      + 'und ein freier Platz findet sich im Dunkeln schlechter. Anlaufunterlagen und Feuerkennungen vorher '
      + `bereitlegen, nicht erst vor der Hafeneinfahrt.${wartenBis}`;
  }
  return `<b class="warn-text">Die Ankunft um ${uhrLt(e.best.arrival)} liegt im Dunkeln, und das Ziel ist `
    + 'kein bestätigter Hafen.</b> In eine unbeleuchtete Bucht einzulaufen, den Ankergrund zu beurteilen und '
    + 'zwischen bereits liegenden Booten einen Platz zu finden, ist im Dunkeln nichts, was man plant. '
    + (kurzBisHell ? 'Entweder später ablegen, oder draußen abwarten und bei Tageslicht anlaufen.'
      : 'Entweder so ablegen, dass die Ankunft ins Helle fällt, oder einen befeuerten Hafen als Ziel wählen.')
    + wartenBis;
}

interface Faehrkorridor {
  name: string;
  von: Punkt;
  bis: Punkt;
}

const FAEHRKORRIDORE: Faehrkorridor[] = [
  { name: 'Ancona–Split', von: { lat: 43.615, lon: 13.508 }, bis: { lat: 43.503, lon: 16.437 } },
  { name: 'Ancona–Zadar', von: { lat: 43.615, lon: 13.508 }, bis: { lat: 44.115, lon: 15.227 } },
  { name: 'Bari–Dubrovnik', von: { lat: 41.130, lon: 16.868 }, bis: { lat: 42.658, lon: 18.085 } },
  { name: 'Bari–Bar', von: { lat: 41.130, lon: 16.868 }, bis: { lat: 42.093, lon: 19.088 } },
  { name: 'Ancona–Igoumenitsa', von: { lat: 43.615, lon: 13.508 }, bis: { lat: 39.505, lon: 20.265 } },
  { name: 'Brindisi–Igoumenitsa', von: { lat: 40.643, lon: 17.943 }, bis: { lat: 39.505, lon: 20.265 } },
  { name: 'Brindisi–Patras', von: { lat: 40.643, lon: 17.943 }, bis: { lat: 38.246, lon: 21.735 } },
  { name: 'Piräus–Kykladen', von: { lat: 37.942, lon: 23.627 }, bis: { lat: 36.398, lon: 25.462 } },
  { name: 'Piräus–Dodekanes', von: { lat: 37.942, lon: 23.627 }, bis: { lat: 36.450, lon: 28.220 } },
  { name: 'Piräus–Kreta', von: { lat: 37.942, lon: 23.627 }, bis: { lat: 35.341, lon: 25.152 } },
];

export function gekreuzteFaehrlinien(track: DunkelBezug[]): string[] {
  if (track.length < 2) return [];
  const treffer: string[] = [];
  for (const k of FAEHRKORRIDORE) {
    for (let i = 1; i < track.length; i++) {
      const a = { lat: track[i - 1]!.lat, lon: track[i - 1]!.lon };
      const b = { lat: track[i]!.lat, lon: track[i]!.lon };
      if (segmenteSchneidenSich(a, b, k.von, k.bis)) { treffer.push(k.name); break; }
    }
  }
  return treffer;
}

export function nachtwindHinweis(
  revier: Inselrevier | null, monat: number, best: Ablegezeit, sprache: Sprache = 'de',
): string | null {
  if (!revier) return null;
  const sommer = monat >= 5 && monat <= 9;

  if (sprache === 'en') {
    if (revier === 'adria') {
      const T: string[] = [];
      if (sommer) {
        T.push('<b>Overnight in the region:</b> the Maestral is a thermal wind. It sets in during the '
          + 'late morning, peaks in the afternoon and dies down around sunset. For the night part of the '
          + 'leg that means: expect markedly less wind than during the day, often under engine. Plan diesel '
          + 'and engine hours accordingly.');
      }
      if (best.maxGust >= 22 || (best.maxWind >= 8 && best.avgWindDir >= 20 && best.avgWindDir <= 90)) {
        T.push('<b class="warn-text">The Bora is the opposite case:</b> it preferentially gathers at night '
          + 'as cold air over the coastal mountains and often falls onto the sea in the early morning hours '
          + '. Exactly the watch in which the crew is most tired. A north-easterly wind with noticeable '
          + 'gusts is the warning sign to take seriously.');
      }
      return T.length ? T.join(' ') : null;
    }

    if (revier === 'aegaeis' && sommer) {
      return '<b>Overnight in the region:</b> the Meltemi usually eases at night, <b>but that should not '
        + 'be relied on.</b> A strong Meltemi of Force 5 to 7 can blow through the night and continue just '
        + 'as strongly the next day, and this pattern not infrequently holds for many days. It is not a '
        + 'purely thermal wind like the Maestral, but gradient-driven; the afternoon daily peak comes on '
        + 'top of that, the baseline level remains.';
    }

    if (revier === 'westmed' && sommer) {
      return '<b>Overnight in the region:</b> the Mistral is gradient-driven and does not reliably die '
        + 'down at night. Unlike a pure sea breeze, it can hold for three days and nights straight. What '
        + 'stands during the day mostly stands at night too.';
    }

    return null;
  }

  if (revier === 'adria') {
    const T: string[] = [];
    if (sommer) {
      T.push('<b>Nachts im Revier:</b> Der Maestral ist ein thermischer Wind. Er setzt am '
        + 'späten Vormittag ein, steht am Nachmittag am kräftigsten und schläft gegen Sonnenuntergang '
        + 'ein. Für den Nachtteil des Schlags heißt das: mit deutlich weniger Wind rechnen als tagsüber, '
        + 'oft mit Maschine. Diesel und Motorstunden entsprechend einplanen.');
    }

    if (best.maxGust >= 22 || (best.maxWind >= 8 && best.avgWindDir >= 20 && best.avgWindDir <= 90)) {
      T.push('<b class="warn-text">Umgekehrt die Bora:</b> Sie sammelt sich bevorzugt nachts als Kaltluft '
        + 'über den Küstengebirgen und fällt oft in den frühen Morgenstunden auf das Meer. Also genau in '
        + 'der Wache, in der die Crew am müdesten ist. Nordöstlicher Wind mit auffälligen Böen ist das '
        + 'Vorzeichen, das ernst zu nehmen ist.');
    }
    return T.length ? T.join(' ') : null;
  }

  if (revier === 'aegaeis' && sommer) {
    return '<b>Nachts im Revier:</b> Der Meltemi flaut nachts meist ab. <b>Darauf verlassen sollte man '
      + 'sich aber nicht.</b> Ein kräftiger Meltemi von 5 bis 7 Beaufort bläst durch die Nacht und am '
      + 'nächsten Tag genauso weiter, und dieses Muster hält sich nicht selten über viele Tage. '
      + 'Er ist kein rein thermischer Wind wie der Maestral, sondern gradientgetrieben; die Tagesspitze '
      + 'am Nachmittag kommt obendrauf, das Grundniveau bleibt.';
  }

  if (revier === 'westmed' && sommer) {
    return '<b>Nachts im Revier:</b> Der Mistral ist gradientgetrieben und schläft nachts nicht '
      + 'verlässlich ein. Anders als eine reine Seebrise kann er drei Tage und Nächte durchhalten. '
      + 'Was tagsüber steht, steht nachts meist auch.';
  }

  return null;
}

export const NACHTREFF_AB_KN = 11;

export function nachtreffHinweis(
  dunkel: Dunkelheit, best: Ablegezeit, sprache: Sprache = 'de',
  track: readonly { time: Date; speed: number; gust: number }[] | null = null,
): string | null {
  if (!dunkel.phasen.length) return null;
  const p = dunkel.phasen[0]!;

  if (best.motorShare > 0.7) return null;

  const imDunkeln = (track ?? []).filter((t) => dunkel.phasen.some((ph) =>
    t.time.getTime() >= ph.beginn.getTime() && t.time.getTime() <= (ph.ende ?? best.arrival).getTime()));
  const maxWind = imDunkeln.length ? Math.max(...imDunkeln.map((t) => t.speed)) : best.maxWind;
  const maxGust = imDunkeln.length ? Math.max(...imDunkeln.map((t) => t.gust)) : best.maxGust;

  if (anzeigeKn(maxWind) < NACHTREFF_AB_KN && anzeigeKn(maxGust) < REFF_AM_WIND[0]!) return null;
  if (sprache === 'en') {
    const wann = p.vonAnfangAn ? 'Before departure' : p.abHalt ? `Before leaving the stop at ${uhrLt(p.beginn)}` : `Before ${uhrLt(p.beginn)}`;
    const basis = `<b>${wann}, reef</b>, not only once it becomes necessary. A reef in the dark with `
      + 'rising wind is a different manoeuvre than the same reef in daylight, and you lose far less speed '
      + 'with one reef too many than a night with too much sail up will cost.';
    if (maxGust >= 25) {
      return `${basis} With gusts up to ${nf(maxGust, 0, 'en')} kn, that applies doubly.`;
    }
    return basis;
  }
  const wann = p.vonAnfangAn ? 'Vor dem Ablegen'
    : p.abHalt ? `Vor dem Ablegen am Aufenthalt um ${uhrLt(p.beginn)}` : `Vor ${uhrLt(p.beginn)}`;
  const basis = `<b>${wann} reffen</b>, nicht erst, wenn es nötig wird. Ein Reff im Dunkeln bei `
    + 'aufkommendem Wind ist ein anderes Manöver als dasselbe Reff bei Tageslicht. Ein Reff zu viel kostet '
    + 'weit weniger Fahrt als eine Nacht mit zu viel Tuch.';
  if (maxGust >= 25) {
    return `${basis} Bei Böen bis ${nf(maxGust, 0)} kn gilt das doppelt.`;
  }
  return basis;
}
