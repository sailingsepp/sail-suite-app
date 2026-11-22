import type { Sprache } from '@/core/types';
import { uhrLt, uhrUtc } from '@/core/time';
import { escapeHtml } from '@/core/html';
import { richtungsKuerzel } from '@/core/ortsbezug';
import {
  BFT_KN, OFFENE_SEE_SM, LEE_SM, type KritischerAbschnitt, type Warnangabe, type Warnlage,
} from '@/core/warnlage';

export interface KritischEingabe {
  lage: Warnlage;

  ort: string;

  abfahrt: Date;

  utcVersatzMs: number;

  anlaufMaxSm: number;

  ankunft?: Date;
}

const GANZE_STRECKE_MS = 20 * 60_000;

const FAST_GANZ_ANTEIL = 0.75;

const OFFEN_GANZ_ANTEIL = 0.75;

export function anteilWort(a: number, en: boolean): string {
  const stufen: [number, string, string][] = [[0.25, 'ein Viertel', 'a quarter'], [1 / 3, 'ein Drittel', 'a third'], [0.5, 'die Hälfte', 'half'], [2 / 3, 'zwei Drittel', 'two thirds']];
  let best = stufen[0]!;
  for (const s of stufen) if (Math.abs(s[0] - a) < Math.abs(best[0] - a)) best = s;
  return en ? best[2] : best[1];
}

function ganzeStrecke(k: KritischerAbschnitt, e: KritischEingabe): 'ganz' | 'fast' | null {
  if (!e.ankunft) return null;
  if (Math.abs(k.von.getTime() - e.abfahrt.getTime()) <= GANZE_STRECKE_MS
    && Math.abs(k.bis.getTime() - e.ankunft.getTime()) <= GANZE_STRECKE_MS) return 'ganz';
  const fahrt = e.ankunft.getTime() - e.abfahrt.getTime();
  return fahrt > 0 && (k.bis.getTime() - k.von.getTime()) / fahrt >= FAST_GANZ_ANTEIL ? 'fast' : null;
}

export interface KritischTexte {

  wetterlage: string;

  ablegezeit: string | null;

  fazit: string | null;
}

function dienst(w: Warnangabe, en: boolean): string {
  if (w.quelle === 'hnms') return en ? 'the Hellenic National Meteorological Service (HNMS)' : 'der griechische Wetterdienst (HNMS)';
  if (w.quelle === 'meteomar') return en ? 'the Italian METEOMAR bulletin' : 'der italienische Seewetterbericht (Meteomar)';
  return en ? 'the Marine Meteorological Centre Split (DHMZ)' : 'der Seewetterdienst Split (DHMZ)';
}

function richtungen(w: Warnangabe, sprache: Sprache): string {
  return [...new Set(w.richtungen.map((d) => richtungsKuerzel(d, sprache)))].join('/');
}

function staerkeKurz(w: Warnangabe, sprache: Sprache): string {
  if (!w.bft) return staerkeText(w, sprache);
  const r = richtungen(w, sprache);
  const bft = w.bft.von === w.bft.bis ? `${w.bft.bis}` : `${w.bft.von}${sprache === 'en' ? ' to ' : ' bis '}${w.bft.bis}`;
  return sprache === 'en' ? `${r ? `${r} ` : ''}force ${bft}` : `${r ? `${r} ` : ''}Stärke ${bft}`;
}

export function staerkeText(w: Warnangabe, sprache: Sprache): string {
  const en = sprache === 'en';
  const r = richtungen(w, sprache);
  if (w.boeenKn) {
    const sp = w.boeenKn.von === w.boeenKn.bis ? `${w.boeenKn.bis}` : en ? `${w.boeenKn.von} to ${w.boeenKn.bis}` : `${w.boeenKn.von} bis ${w.boeenKn.bis}`;
    return en ? `${r ? `${r} ` : ''}gusts of ${sp} kn` : `${r ? `${r}-` : ''}Böen ${sp} kn`;
  }
  if (w.bft) {
    const kn = [BFT_KN[w.bft.von]?.[0], BFT_KN[w.bft.bis]?.[1]];
    const bft = w.bft.von === w.bft.bis ? `${w.bft.bis}` : en ? `${w.bft.von} to ${w.bft.bis}` : `${w.bft.von} bis ${w.bft.bis}`;
    const knText = kn[0] != null && kn[1] != null ? (en ? ` (${kn[0]} to ${kn[1]} kn mean wind)` : ` (${kn[0]} bis ${kn[1]} kn Mittelwind)`) : '';

    const boeen = w.quelle === 'hnms' ? (en ? ', gusts up to 40 % stronger' : ', Böen bis 40 % stärker') : '';
    return en ? `wind ${r ? `from ${r} ` : ''}force ${bft}${knText}${boeen}` : `Wind ${r ? `aus ${r} ` : ''}Stärke ${bft}${knText}${boeen}`;
  }
  return '';
}

function wann(w: Warnangabe, en: boolean, utcVersatzMs = 0): string {
  if (!w.zeitText) return '';

  if (w.quelle === 'hnms' && w.zeit?.art === 'utc') {
    const ort = (ms: number) => uhrLt(new Date(ms + utcVersatzMs));
    const utc = (ms: number) => uhrUtc(ms);
    const ab = /^ab /.test(w.zeitText) ? (en ? `from ${utc(w.zeit.vonMs)} (${ort(w.zeit.vonMs)}) ` : `ab ${utc(w.zeit.vonMs)} (${ort(w.zeit.vonMs)}) `) : '';
    const laenger = / oder länger$/.test(w.zeitText) ? (en ? ' or later' : ' oder länger') : '';
    return en ? `${ab}until ${utc(w.zeit.bisMs)} (${ort(w.zeit.bisMs)})${laenger}` : `${ab}bis ${utc(w.zeit.bisMs)} (${ort(w.zeit.bisMs)})${laenger}`;
  }
  if (!en) return w.zeitText;
  return ({ 'am Nachmittag': 'in the afternoon', 'am Vormittag': 'in the morning', 'am Abend': 'in the evening', nachts: 'at night', anfangs: 'initially', 'später': 'later', laufend: 'in progress', erwartet: 'expected' } as Record<string, string>)[w.zeitText]
    ?? w.zeitText.replace(/^ab /, 'from ').replace(/ bis /, ' to ').replace(/^bis /, 'until ').replace(' oder länger', ' or later');
}

function wo(w: Warnangabe, en: boolean): string {
  if (!en) return w.ortText;
  return w.ortText
    .replace(/^stellenweise in der /, 'in places in the ').replace(/^auf offener See der /, 'on the open sea of the ').replace(/^in der /, 'in the ').replace(/^im Seegebiet /, 'in sea area ').replace(/^um /, 'around ')
    .replace('nördlichen', 'northern').replace('mittleren', 'central').replace('südlichen', 'southern').replace(' und ', ' and ').replace('Adria', 'Adriatic')
    .replace('westlich von', 'west of').replace('östlich von', 'east of').replace('nördlich von', 'north of').replace('südlich von', 'south of')
    .replace('nördlicher Teil', 'northern part').replace('südlicher Teil', 'southern part').replace('westlicher Teil', 'western part').replace('östlicher Teil', 'eastern part')
    .replace('° O', '° E');
}

function zeitspanne(k: KritischerAbschnitt, en: boolean): string {
  const a = uhrLt(k.von), b = uhrLt(k.bis);
  if (a === b) return en ? `around ${a}` : `gegen ${a}`;
  return en ? `from about ${a} to ${b}` : `von etwa ${a} bis ${b}`;
}

function lageText(k: KritischerAbschnitt, e: KritischEingabe, sprache: Sprache): string {
  const en = sprache === 'en';
  const r = k.richtung != null ? richtungsKuerzel(k.richtung, sprache) : null;

  const umfang = ganzeStrecke(k, e);
  if (umfang) {
    const dieGanze = umfang === 'ganz' ? (en ? 'The whole route' : 'Die ganze Strecke') : (en ? 'Almost the whole route' : 'Fast die ganze Strecke');
    const sm = k.anlaufSm == null ? null : k.anlaufSm >= e.anlaufMaxSm ? (en ? `more than ${e.anlaufMaxSm}` : `über ${e.anlaufMaxSm}`) : `${Math.round(k.anlaufSm)}`;
    if (!r || sm == null) return en ? `${dieGanze} is in the warned area (most exposed ${e.ort})` : `${dieGanze} liegt im gewarnten Gebiet (am offensten ${e.ort})`;

    const anteil = k.offenAnteil;
    if (k.anlaufSm! >= OFFENE_SEE_SM && anteil != null && anteil < OFFEN_GANZ_ANTEIL) {

      const teil = anteil < 1 / 6 ? (en ? 'Only a short stretch' : 'nur ein kurzes Stück') : en ? `About ${anteilWort(anteil, en)}` : `rund ${anteilWort(anteil, en)}`;
      return en ? `${dieGanze} is in the warned area. ${teil} of it is open to the ${r} (up to ${sm} NM of fetch, most exposed ${e.ort}), the rest lies in the lee`
        : `${dieGanze} liegt im gewarnten Gebiet. Offen nach ${r} ist davon ${teil} (bis ${sm} sm Anlauf, am offensten ${e.ort}), der Rest liegt in Lee`;
    }
    const offen = k.anlaufSm! >= OFFENE_SEE_SM ? (en ? 'open' : 'offen') : (en ? 'partly open' : 'teils offen');
    return en ? `${dieGanze} is ${offen} to the ${r} (up to ${sm} NM of fetch, most exposed ${e.ort})`
      : `${dieGanze} liegt ${offen} nach ${r} (bis ${sm} sm Anlauf, am offensten ${e.ort})`;
  }
  if (k.anlaufSm == null || !r) return en ? `the route is ${e.ort}` : `liegt die Strecke ${e.ort}`;
  const sm = k.anlaufSm >= e.anlaufMaxSm ? (en ? `more than ${e.anlaufMaxSm}` : `über ${e.anlaufMaxSm}`) : `${Math.round(k.anlaufSm)}`;
  if (k.anlaufSm >= OFFENE_SEE_SM) {
    return en ? `the route is ${e.ort}, open to the ${r} (${sm} NM of fetch)` : `liegt die Strecke ${e.ort} offen nach ${r} (${sm} sm Anlauf)`;
  }
  if (k.anlaufSm < LEE_SM) {
    return en ? `the route is ${e.ort}, in the warned area but in the lee to the ${r} (under ${LEE_SM} NM of fetch)`
      : `liegt die Strecke ${e.ort} im gewarnten Gebiet, dort aber in Lee nach ${r} (unter ${LEE_SM} sm Anlauf)`;
  }
  return en ? `the route is ${e.ort}, partly open to the ${r} (${sm} NM of fetch)` : `liegt die Strecke ${e.ort} teils offen nach ${r} (${sm} sm Anlauf)`;
}

function modellText(k: KritischerAbschnitt, w: Warnangabe, en: boolean): string {
  const boe = Math.round(k.modellBoeKn), wind = Math.round(k.modellWindKn);
  if (w.bft) return en ? `The model sees at most ${wind} kn mean wind there, gusts ${boe} kn.` : `Das Modell sieht dort höchstens ${wind} kn Mittelwind, Böen ${boe} kn.`;
  return en ? `The model sees at most ${boe} kn in gusts there.` : `Das Modell sieht dort höchstens ${boe} kn in Böen.`;
}

function ausweichAblegezeit(k: KritischerAbschnitt, e: KritischEingabe): { vorher: boolean; zeit: Date } | null {
  const z = k.warnung.zeit;
  if (!z || z.art === 'nacht') return null;

  const beginnEcht = z.art === 'stunden' || z.art === 'revier' ? k.warnung.zeitText !== 'anfangs' : /^ab /.test(k.warnung.zeitText ?? '');
  const tag = Date.UTC(e.abfahrt.getUTCFullYear(), e.abfahrt.getUTCMonth(), e.abfahrt.getUTCDate());

  const beginn = z.art === 'stunden' ? tag + z.von * 3600_000 : z.art === 'revier' ? z.vonMs : z.vonMs + e.utcVersatzMs;
  const ende = z.art === 'stunden' ? tag + z.bis * 3600_000 : z.art === 'revier' ? z.bisMs : z.bisMs + e.utcVersatzMs;
  const runde = (t: number, auf: boolean) => (auf ? Math.ceil : Math.floor)(t / 600_000) * 600_000;
  const vorher = runde(e.abfahrt.getTime() - (k.bis.getTime() - beginn) - 600_000, false);
  if (beginnEcht && new Date(vorher).getUTCHours() >= 5 && vorher > tag) return { vorher: true, zeit: new Date(vorher) };
  const nachher = runde(e.abfahrt.getTime() + (ende - k.von.getTime()) + 600_000, true);
  if (new Date(nachher).getUTCHours() < 20 && nachher < tag + 86_400_000) return { vorher: false, zeit: new Date(nachher) };
  return null;
}

export function kritischTexte(eingabe: KritischEingabe, sprache: Sprache): KritischTexte | null {

  const e: KritischEingabe = { ...eingabe, ort: escapeHtml(eingabe.ort) };
  const en = sprache === 'en';
  const [k, ...weitere] = e.lage.abschnitte;
  if (k) {
    const w = k.warnung;
    const genau = [wann(w, en, e.utcVersatzMs), wo(w, en)].filter(Boolean).join(' ');
    const ganz = ganzeStrecke(k, e);
    const anfang = ganz ? lageText(k, e, sprache) : `${zeitspanne(k, en).replace(/^./, (c) => c.toUpperCase())} ${lageText(k, e, sprache)}`;
    let satz = ganz
      ? (en
        ? `<p class="brief-amtlich"><b>Critical route:</b> ${anfang}. `
          + `That is exactly what ${dienst(w, en)} warns of${genau ? ` ${genau}` : ''}: ${staerkeText(w, sprache)}. ${modellText(k, w, en)} `
          + 'For this route the official warning counts, not the calculation.'
        : `<p class="brief-amtlich"><b>Kritische Strecke:</b> ${anfang}. `
          + `Genau dafür warnt ${dienst(w, en)}${genau ? `, ${genau}` : ''}: ${staerkeText(w, sprache)}. ${modellText(k, w, en)} `
          + 'Für diese Strecke gilt die Warnung, nicht die Rechnung.')
      : en
      ? `<p class="brief-amtlich"><b>Critical section:</b> ${zeitspanne(k, en).replace(/^./, (c) => c.toUpperCase())} ${lageText(k, e, sprache)}. `
        + `That is exactly what ${dienst(w, en)} warns of${genau ? ` ${genau}` : ''}: ${staerkeText(w, sprache)}. ${modellText(k, w, en)} `
        + 'For this section the official warning counts, not the calculation.'
      : `<p class="brief-amtlich"><b>Kritischer Abschnitt:</b> ${zeitspanne(k, en).replace(/^./, (c) => c.toUpperCase())} ${lageText(k, e, sprache)}. `
        + `Genau dafür warnt ${dienst(w, en)}${genau ? `, ${genau}` : ''}: ${staerkeText(w, sprache)}. ${modellText(k, w, en)} `
        + 'Für diesen Abschnitt gilt die Warnung, nicht die Rechnung.';
    if (weitere.length) {
      const liste = weitere.slice(0, 3).map((x) => `${zeitspanne(x, en)}: ${staerkeKurz(x.warnung, sprache)}`).join('; ');
      satz += en ? ` Further warned sections: ${liste}.` : ` Weitere gewarnte Abschnitte: ${liste}.`;
    }
    satz += '</p>';
    const aus = ganz ? null : ausweichAblegezeit(k, e);
    const ablegezeit = aus
      ? (aus.vorher
        ? (en ? `To be through this section before the warned time, you would have to leave by about ${uhrLt(aus.zeit)}.`
          : `Vor der gewarnten Zeit wärst du durch diesen Abschnitt mit Ablegen bis etwa ${uhrLt(aus.zeit)}.`)
        : (en ? `After the warned time you would reach this section leaving from about ${uhrLt(aus.zeit)}, check the arrival in daylight.`
          : `Nach der gewarnten Zeit kämst du mit Ablegen ab etwa ${uhrLt(aus.zeit)} dorthin, Ankunft im Hellen prüfen.`))
      : null;

    const teilOffen = ganz && k.richtung != null && k.anlaufSm != null && k.anlaufSm >= OFFENE_SEE_SM
      && k.offenAnteil != null && k.offenAnteil < OFFEN_GANZ_ANTEIL;
    const rK = k.richtung != null ? richtungsKuerzel(k.richtung, sprache) : '';
    const teilText = k.offenAnteil != null && k.offenAnteil < 1 / 6
      ? (en ? 'a short stretch of the route' : 'ein kurzes Stück der Strecke')
      : en ? `about ${anteilWort(k.offenAnteil ?? 0, en)} of the route` : `rund ${anteilWort(k.offenAnteil ?? 0, en)} der Strecke`;
    const fazit = teilOffen
      ? (en ? `${teilText}, open to the ${rK}, officially ${staerkeText(w, sprache)}` : `${teilText}, offen nach ${rK}, amtlich ${staerkeText(w, sprache)}`)
      : ganz
      ? (ganz === 'ganz'
        ? (en ? `the whole route, officially ${staerkeText(w, sprache)}` : `die ganze Strecke, amtlich ${staerkeText(w, sprache)}`)
        : (en ? `almost the whole route, officially ${staerkeText(w, sprache)}` : `fast die ganze Strecke, amtlich ${staerkeText(w, sprache)}`))
      : en
        ? `${zeitspanne(k, en)} ${e.ort}, officially ${staerkeText(w, sprache)}`
        : `${zeitspanne(k, en)} ${e.ort}, amtlich ${staerkeText(w, sprache)}`;
    return { wetterlage: satz, ablegezeit, fazit };
  }
  const a = e.lage.ausserhalbDerZeit;
  if (a) {
    const w = a.warnung;
    const zeit = uhrLt(a.punkt.time);
    const wetterlage = en
      ? `<p class="brief-amtlich">${dienst(w, en).replace(/^./, (c) => c.toUpperCase())} warns of ${staerkeText(w, sprache)} (${[wann(w, en), wo(w, en)].filter(Boolean).join(' ')}). `
        + `The route enters that water ${e.ort} around ${zeit}, ${a.vorher ? 'before' : 'after'} the warned time. `
        + `${a.vorher ? 'Leaving later brings you into it.' : 'Leaving earlier brings you into it.'}</p>`
      : `<p class="brief-amtlich">${dienst(w, en).replace(/^./, (c) => c.toUpperCase())} warnt vor ${staerkeText(w, sprache)} (${[wann(w, en), wo(w, en)].filter(Boolean).join(' ')}). `
        + `Dorthin kommt die Strecke ${e.ort} gegen ${zeit}, ${a.vorher ? 'vor' : 'nach'} der gewarnten Zeit. `
        + `${a.vorher ? 'Wer später ablegt, kommt hinein.' : 'Wer früher ablegt, kommt hinein.'}</p>`;
    return { wetterlage, ablegezeit: null, fazit: null };
  }
  const offen = e.lage.nichtGetroffen.find((w) => w.offeneSee && w.richtungen.length);
  if (offen) {
    const r = richtungen(offen, sprache);
    const wetterlage = en
      ? `<p class="brief-amtlich">The ${staerkeText(offen, sprache)} ${wo(offen, en)} do not hit the route directly: it has less than ${OFFENE_SEE_SM} NM of fetch to the ${r} throughout. Under the land, gusts can still drop down hard.</p>`
      : `<p class="brief-amtlich">Die gewarnten ${staerkeText(offen, sprache)} ${wo(offen, en)} treffen die Strecke nicht direkt: Sie liegt überall unter ${OFFENE_SEE_SM} sm Anlauf nach ${r}. Unter Land können Fallböen trotzdem hart einfallen.</p>`;
    return { wetterlage, ablegezeit: null, fazit: null };
  }
  return null;
}
