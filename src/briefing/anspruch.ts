import { escapeHtml } from '@/core/html';
import { nf } from '@/core/time';
import type { Sprache } from '@/core/types';
import { beaufort } from './wind';

export const ANSPRUCH_STUFEN = [1, 2, 3, 5, 8, 13] as const;
export type AnspruchStufe = typeof ANSPRUCH_STUFEN[number];

export interface AnspruchEingabe {

  dauerHrs: number;

  maxWindKn?: number | null;
  maxBoeKn?: number | null;

  maxHsM?: number | null;

  kreuzAnteil?: number | null;

  dunkelHrs?: number | null;

  nachtfahrt?: boolean;
  gewitter?: boolean;

  gewitterAmTag?: boolean;

  amtlichStreckeKn?: number | null;

  amtlichSeegebiet?: boolean;

  amtlichOhneOrt?: boolean;

  amtlichAbgelaufen?: boolean;

  wetterwarnung?: boolean;

  boeenfaktor?: number | null;

  lokalwind?: string | null;

  modelleUneins?: boolean;

  nichtFahrbar?: boolean;

  zeitfenster?: string | null;

  tageVoraus?: number | null;

  jenseitsVorhersage?: boolean;

  modellUebereinstimmungProzent?: number | null;

  crewZumutbarkeit?: number | null;
}

export type AnspruchTreiber =
  | 'dauer' | 'wind' | 'boeen' | 'amtlich' | 'warnung' | 'revierwind' | 'grenzwert' | 'kreuzen' | 'seegang' | 'dunkel' | 'gewitter'
  | 'zeitfenster' | 'unsicher' | 'crew';

export interface AnspruchGrund {
  treiber: AnspruchTreiber;
  punkte: number;
  text: string;
}

export interface Anspruch {
  stufe: AnspruchStufe;
  punkte: number;

  gruende: AnspruchGrund[];
}

const BOEIG_AB_FAKTOR = 1.8;

const WIND_WEIBLICH = new Set(['Bora', 'Tramontana']);

function revierwindZaehlt(e: AnspruchEingabe): boolean {
  return !!e.lokalwind && ((e.maxBoeKn != null && beaufort(e.maxBoeKn) >= 6) || (e.maxWindKn != null && beaufort(e.maxWindKn) >= 5));
}

const CREW_ERFAHREN = 0.75;
const CREW_EINGESPIELT = 0.9;

export function stufeFuer(punkte: number): AnspruchStufe {
  let stufe: AnspruchStufe = 1;
  for (const s of ANSPRUCH_STUFEN) if (punkte >= s) stufe = s;
  return stufe;
}

export function anspruch(e: AnspruchEingabe, sprache: Sprache = 'de'): Anspruch {
  const en = sprache === 'en';
  const g: AnspruchGrund[] = [];
  const dazu = (treiber: AnspruchTreiber, punkte: number, de: string, eng: string): void => {
    if (punkte !== 0) g.push({ treiber, punkte, text: en ? eng : de });
  };

  const h = e.dauerHrs;
  const hText = nf(h, h < 10 ? 1 : 0, sprache);
  if (h >= 24) dazu('dauer', 5, 'mehrtägiger Schlag', 'passage over several days');
  else if (h >= 12) dazu('dauer', 3, `lange Fahrt (${hText} h)`, `long passage (${hText} h)`);
  else if (h >= 8) dazu('dauer', 2, `langer Tag (${hText} h)`, `long day (${hText} h)`);
  else if (h >= 4) dazu('dauer', 1, `${hText} h unterwegs`, `${hText} h under way`);

  if (e.maxWindKn != null) {
    const bft = beaufort(e.maxWindKn);
    const p = bft >= 7 ? 5 : bft === 6 ? 3 : bft === 5 ? 2 : bft === 4 ? 1 : 0;
    dazu('wind', p, `Wind bis ${bft} Bft`, `wind up to force ${bft}`);
  }
  if (e.maxBoeKn != null) {
    const bft = beaufort(e.maxBoeKn);
    const p = bft >= 10 ? 5 : bft === 9 ? 3 : bft === 8 ? 2 : bft === 7 ? 1 : 0;

    if (p === 0 && bft === 6 && e.boeenfaktor != null && e.boeenfaktor >= BOEIG_AB_FAKTOR && !revierwindZaehlt(e)) {
      dazu('boeen', 1, `böig (Böen 6 Bft bei Faktor ${nf(e.boeenfaktor, 1)})`, `gusty (gusts force 6 at factor ${nf(e.boeenfaktor, 1, 'en')})`);
    } else {
      dazu('boeen', p, `Böen bis ${bft} Bft`, `gusts up to force ${bft}`);
    }
  }

  if (e.amtlichStreckeKn != null) {
    const kn = Math.round(e.amtlichStreckeKn);
    dazu('amtlich', 3, `amtliche Warnung auf der Strecke (Böen bis ${kn} kn)`, `official warning on the route (gusts up to ${kn} kn)`);
  } else if (e.amtlichSeegebiet) {
    dazu('amtlich', 1, 'amtliche Warnung im Seegebiet', 'official warning for the sea area');
  } else if (e.amtlichOhneOrt) {

  } else if (e.wetterwarnung) {
    dazu('warnung', 2, 'Druckverteilung passt zur Bora', 'pressure pattern fits the bora');
  }

  if (revierwindZaehlt(e)) {
    const w = e.lokalwind!;
    dazu('revierwind', 2, `passt ${WIND_WEIBLICH.has(w) ? 'zur' : 'zum'} ${w}`, `matches the ${w.toLowerCase()}`);
  }
  if (e.kreuzAnteil != null && e.maxWindKn != null) {
    const p = e.kreuzAnteil >= 0.5 && e.maxWindKn >= 17 ? 2 : e.kreuzAnteil >= 0.3 && e.maxWindKn >= 11 ? 1 : 0;
    dazu('kreuzen', p, 'Ziel liegt nicht an (kreuzen)', 'course not laid directly (tacking)');
  }
  if (e.maxHsM != null) {
    const hs = e.maxHsM;
    const p = hs >= 2.5 ? 3 : hs >= 1.75 ? 2 : hs >= 1 ? 1 : 0;
    dazu('seegang', p, `Seegang bis ${nf(hs, 1, sprache)} m`, `sea state up to ${nf(hs, 1, sprache)} m`);
  }
  const dunkel = e.dunkelHrs ?? null;
  if (dunkel != null && dunkel >= 0.5) {
    const p = dunkel >= 8 ? 3 : dunkel >= 3 ? 2 : 1;
    dazu('dunkel', p, p >= 2 ? 'Nachtfahrt' : 'ein Stück im Dunkeln', p >= 2 ? 'night passage' : 'part of it in the dark');
  } else if (e.nachtfahrt) {
    dazu('dunkel', 2, 'Nachtfahrt', 'night passage');
  }
  if (e.gewitter) dazu('gewitter', 2, 'Gewitter möglich', 'thunderstorms possible');
  else if (e.gewitterAmTag) dazu('gewitter', 1, 'Gewitter am Tag möglich', 'thunderstorms possible during the day');
  if (e.zeitfenster) dazu('zeitfenster', 2, `Zeitfenster ${e.zeitfenster}`, `time window ${e.zeitfenster}`);

  if (e.jenseitsVorhersage) {
    dazu('unsicher', 2, 'reicht über das Vorhersageende', 'runs beyond the end of the forecast');
  } else if (e.amtlichAbgelaufen) {
    dazu('unsicher', 1, 'amtlicher Bericht reicht nicht bis zur Abfahrt', 'official forecast does not reach the departure');
  } else if ((e.modellUebereinstimmungProzent != null && e.modellUebereinstimmungProzent < 60) || e.modelleUneins) {
    dazu('unsicher', 1, 'Wettermodelle uneins', 'weather models disagree');
  } else if (e.tageVoraus != null && e.tageVoraus >= 4) {
    dazu('unsicher', 1, `Vorhersage ${e.tageVoraus} Tage voraus`, `forecast ${e.tageVoraus} days ahead`);
  }

  const summe = g.reduce((s, x) => s + x.punkte, 0);
  if (e.crewZumutbarkeit != null && summe >= 3) {
    if (e.crewZumutbarkeit < CREW_ERFAHREN) dazu('crew', 1, 'Crew wenig geübt', 'crew with little practice');
    else if (e.crewZumutbarkeit >= CREW_EINGESPIELT) dazu('crew', -1, 'eingespielte Crew', 'well-practised crew');
  }

  if (e.nichtFahrbar) dazu('grenzwert', 13, 'über den eingestellten Grenzwerten', 'beyond the configured limits');
  const punkte = Math.max(0, g.reduce((s, x) => s + x.punkte, 0));
  const gruende = g.filter((x) => x.punkte > 0).sort((a, b) => b.punkte - a.punkte);
  return { stufe: stufeFuer(punkte), punkte, gruende };
}

const STUFEN_WORT: Record<Sprache, Record<AnspruchStufe, string>> = {
  de: { 1: 'leicht', 2: 'überschaubar', 3: 'mäßig', 5: 'fordernd', 8: 'anspruchsvoll', 13: 'sehr anspruchsvoll' },
  en: { 1: 'easy', 2: 'manageable', 3: 'moderate', 5: 'demanding', 8: 'challenging', 13: 'very challenging' },
};

export function stufenWort(s: AnspruchStufe, sprache: Sprache): string {
  return STUFEN_WORT[sprache][s];
}

export function anspruchKurztext(a: Anspruch, sprache: Sprache): string {
  return sprache === 'en'
    ? `Demand ${a.stufe} of 13 · ${stufenWort(a.stufe, 'en')}`
    : `Anspruch ${a.stufe} von 13 · ${stufenWort(a.stufe, 'de')}`;
}

export function anspruchGruende(a: Anspruch, sprache: Sprache, n = 3): string {
  if (a.gruende.length === 0) return sprache === 'en' ? 'short, calm passage' : 'kurze, ruhige Fahrt';
  const rest = a.gruende.length - n;
  const teile = a.gruende.slice(0, n).map((x) => x.text);
  if (rest > 0) teile.push(sprache === 'en' ? `${rest} more` : `${rest} weitere`);
  return teile.join(' · ');
}

export function anspruchSkalaHtml(a: Anspruch): string {
  return `<span class="anspruch-skala" aria-hidden="true">${ANSPRUCH_STUFEN.map((s) =>
    `<span class="anspruch-stufe${s === a.stufe ? ' an' : ''}">${s}</span>`).join('')}</span>`;
}

export function anspruchHtml(a: Anspruch, sprache: Sprache): string {
  const en = sprache === 'en';
  return `<div class="anspruch" data-stufe="${a.stufe}">`
    + `<div class="anspruch-kopf"><span class="anspruch-label">${en ? 'Demand' : 'Anspruch'}</span>`
    + `<b class="anspruch-wert">${a.stufe}</b><span class="anspruch-von">${en ? 'on the scale 1–13' : 'auf der Skala 1–13'}</span>`
    + `<span class="anspruch-wort">${escapeHtml(stufenWort(a.stufe, sprache))}</span></div>`
    + anspruchSkalaHtml(a)
    + `<div class="anspruch-gruende">${escapeHtml(anspruchGruende(a, sprache, a.gruende.length))}</div>`
    + `<div class="anspruch-fuss">${en
      ? 'A guide to effort and demands on the crew, not a safety rating.'
      : 'Ein Hinweis auf Aufwand und Anforderung an die Crew, keine Sicherheitsbewertung.'}</div>`
    + '</div>';
}

export function anspruchKompaktHtml(a: Anspruch, sprache: Sprache): string {
  const voll = `${anspruchKurztext(a, sprache)}: ${anspruchGruende(a, sprache)}`;
  const balken = ANSPRUCH_STUFEN.map((s) => `<i class="${s <= a.stufe ? 'an' : ''}"></i>`).join('');
  return `<span class="anspruch-kompakt" data-stufe="${a.stufe}">`
    + `<span class="anspruch-balken" aria-hidden="true">${balken}</span>`
    + `<span aria-hidden="true">${a.stufe}/13</span><span class="vp-sr-only">${escapeHtml(voll)}</span></span>`;
}
