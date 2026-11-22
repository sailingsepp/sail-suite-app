import { windSee, ausweichregeln, lichter, schallsignale, notsignale } from './abschnitteA';
import { signalflaggen, flaggenkombinationen, flaggenfuehrung, leuchtfeuer, lateralsystem, kardinalsystem, einzelgefahr } from './abschnitteB';
import { kompass, einheiten, gezeitenGrundlagen, formeln, mob, ersteHilfe, quellenAbschnitt } from './abschnitteC';
import { manoever } from './manoever';
import { segeltheorie, stabilitaet, segeltrimm } from './abschnitteD';
import { segelmanoever } from './segelmanoever';
import type { Sprache } from '@/core/types';


export interface Abschnitt {
  schluessel: string;
  id: { de: string; en: string };
  titel: { de: string; en: string };
  baue: (sprache: Sprache) => string;
}

export const ABSCHNITTE: readonly Abschnitt[] = [
  { schluessel: 'wind', id: { de: 'wind', en: 'wind' }, titel: { de: 'Wind & See', en: 'Wind & sea' }, baue: windSee },
  { schluessel: 'ausweichen', id: { de: 'ausweichen', en: 'rules' }, titel: { de: 'Ausweichregeln', en: 'Rules of the road' }, baue: ausweichregeln },
  { schluessel: 'lichter', id: { de: 'lichter', en: 'lights' }, titel: { de: 'Lichter & Signalkörper', en: 'Lights & shapes' }, baue: lichter },
  { schluessel: 'schall', id: { de: 'schall', en: 'sound' }, titel: { de: 'Schallsignale', en: 'Sound signals' }, baue: schallsignale },
  { schluessel: 'not', id: { de: 'not', en: 'distress' }, titel: { de: 'Notsignale', en: 'Distress signals' }, baue: notsignale },
  { schluessel: 'flaggen', id: { de: 'flaggen', en: 'flags' }, titel: { de: 'Signalflaggen', en: 'Signal flags' }, baue: signalflaggen },
  { schluessel: 'kombi', id: { de: 'kombi', en: 'combos' }, titel: { de: 'Flaggenkombinationen', en: 'Flag combinations' }, baue: flaggenkombinationen },
  { schluessel: 'fuehrung', id: { de: 'fuehrung', en: 'etiquette' }, titel: { de: 'Flaggenführung', en: 'Flag etiquette' }, baue: flaggenfuehrung },
  { schluessel: 'feuer', id: { de: 'feuer', en: 'characteristics' }, titel: { de: 'Leuchtfeuer', en: 'Light characteristics' }, baue: leuchtfeuer },
  { schluessel: 'lateral', id: { de: 'lateral', en: 'lateral' }, titel: { de: 'Lateralsystem IALA A', en: 'IALA A lateral system' }, baue: lateralsystem },
  { schluessel: 'kardinal', id: { de: 'kardinal', en: 'cardinal' }, titel: { de: 'Kardinalsystem', en: 'Cardinal system' }, baue: kardinalsystem },
  { schluessel: 'einzel', id: { de: 'einzel', en: 'isolated' }, titel: { de: 'Einzelgefahr & Sonderzeichen', en: 'Isolated danger & special marks' }, baue: einzelgefahr },
  { schluessel: 'kompass', id: { de: 'kompass', en: 'compass' }, titel: { de: 'Kompass', en: 'Compass' }, baue: kompass },
  { schluessel: 'einheiten', id: { de: 'einheiten', en: 'units' }, titel: { de: 'Einheiten', en: 'Units' }, baue: einheiten },
  { schluessel: 'gezeiten', id: { de: 'gezeiten', en: 'tides' }, titel: { de: 'Gezeiten', en: 'Tides' }, baue: gezeitenGrundlagen },
  { schluessel: 'formeln', id: { de: 'formeln', en: 'formulas' }, titel: { de: 'Formeln', en: 'Formulas' }, baue: formeln },
  { schluessel: 'segeltheorie', id: { de: 'segeltheorie', en: 'sailtheory' }, titel: { de: 'Segeltheorie', en: 'Sail theory' }, baue: segeltheorie },
  { schluessel: 'stabilitaet', id: { de: 'stabilitaet', en: 'stability' }, titel: { de: 'Stabilität & Balance', en: 'Stability & balance' }, baue: stabilitaet },
  { schluessel: 'trimm', id: { de: 'trimm', en: 'trim' }, titel: { de: 'Segeltrimm', en: 'Sail trim' }, baue: segeltrimm },
  { schluessel: 'segelmanoever', id: { de: 'segelmanoever', en: 'sailmanoeuvres' }, titel: { de: 'Segelmanöver', en: 'Sailing manoeuvres' }, baue: segelmanoever },
  { schluessel: 'manoever', id: { de: 'ablegen-ankern', en: 'berthing-anchoring' }, titel: { de: 'Ablegen und Ankern', en: 'Leaving a berth and anchoring' }, baue: manoever },
  { schluessel: 'mob', id: { de: 'mob', en: 'mob' }, titel: { de: 'Mensch über Bord', en: 'Man overboard' }, baue: mob },
  { schluessel: 'hilfe', id: { de: 'hilfe', en: 'firstaid' }, titel: { de: 'Erste Hilfe', en: 'First aid' }, baue: ersteHilfe },
  { schluessel: 'quellen', id: { de: 'quellen', en: 'sources' }, titel: { de: 'Quellen', en: 'Sources' }, baue: quellenAbschnitt },
];

export function abschnitt(schluessel: string | null | undefined): Abschnitt {
  
  const s = schluessel === 'ankern' ? 'manoever' : schluessel;
  return ABSCHNITTE.find((a) => a.schluessel === s) ?? ABSCHNITTE[0]!;
}


export function zeichneAbschnitt(a: Abschnitt, sprache: Sprache): string {
  return `<section class="kp-sec" id="kp-${a.id[sprache]}" lang="${sprache}" aria-labelledby="kp-h-${a.id[sprache]}">`
    + `<p class="kp-eyebrow" id="kp-h-${a.id[sprache]}">${a.titel[sprache]}</p>${mitWasserzeichen(a.baue(sprache))}</section>`;
}


const WZ_MIN_BREITE = 200;
const WZ_MIN_HOEHE = 120;


export function mitWasserzeichen(html: string): string {
  return html.replace(/(<svg\b[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>)([\s\S]*?)<\/svg>/g, (ganz, kopf: string, b: string, h: string, inhalt: string) => {
    const breite = Number(b);
    const hoehe = Number(h);
    if (breite < WZ_MIN_BREITE || hoehe < WZ_MIN_HOEHE) return ganz;
    
    const gr = Math.max(9, Math.min(11, breite / 55));
    const streifen = Math.round(gr + 6);
    const neuKopf = kopf.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${b} ${hoehe + streifen}"`);
    return `${neuKopf}${inhalt}<rect x="0" y="${hoehe}" width="${b}" height="${streifen}" fill="var(--panel-2)"/>`
      + `<text x="${breite - 6}" y="${hoehe + streifen - 5}" text-anchor="end" class="kp-wz" font-size="${gr.toFixed(1)}" aria-hidden="true">© Sail-Suite</text></svg>`;
  });
}
