
import { schutzStufe } from '@/core/shelter';
import { fmtDur, nf } from '@/core/time';
import { smText } from './einheit';
import { distNM } from '@/core/geo';
import type { WochenplanErgebnis, WochenplanEtappe, EtappenKennzahlen } from '@/core/wochenplan';
import { kantenWeg, type Kandidatennetz } from '@/core/hafennetz';
import type { Begruendungsspur } from '@/core/begruendung';
import type { UmkehrpunktErgebnis } from '@/core/rueckkehr';
import { planKennzahlen } from '@/core/zielfunktion';
import type { OptionKennzahlen, Entscheidungspunkt } from '@/core/optionen';
import { tagesBegruendung, wochenUeberblick, vollstaendigeTagesSpur } from '@/briefing/wochenplan';
import type { Sprache, Punkt } from '@/core/types';
import { LAGE_TEXT } from './konstanten';
import { escapeHtml } from '@/core/html';
import { dieselLiter, type KraftstoffAngabe } from '@/core/kraftstoff';
import { tankZeile, bedarfSatz } from '@/briefing/kraftstoff';
import { tagesplanungUrl } from '@/core/tagesplanungLink';
import { tageszeileHtml, tabellenKopfHtml, wochentagDatum, wochentagAusIso } from './tageszeile';
import { anspruch, anspruchHtml, anspruchKompaktHtml, anspruchKurztext, anspruchGruende, type Anspruch } from '@/briefing/anspruch';


function tageAbHeute(datum: Date | null): number | null {
  if (!datum) return null;
  const heute = new Date(); heute.setHours(12, 0, 0, 0);
  const tag = new Date(datum); tag.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((tag.getTime() - heute.getTime()) / 86_400_000));
}


export function etappenAnspruch(e: WochenplanEtappe, datum: Date | null, sprache: Sprache): Anspruch | null {
  const k = e.kennzahlen;
  if (e.istHafentag || e.regime === 'geruest' || k.totalHrs == null) return null;
  return anspruch({
    dauerHrs: k.totalHrs,
    maxWindKn: k.maxWindKn, maxBoeKn: k.maxGustKn, maxHsM: k.maxHsM,
    kreuzAnteil: k.vmgShareAnteil,
    dunkelHrs: k.dunkelShareAnteil != null ? k.dunkelShareAnteil * k.totalHrs : null,
    nachtfahrt: e.istNachtschlag,
    gewitter: Boolean(k.gewitter),
    nichtFahrbar: k.lage === 'unfahrbar',
    tageVoraus: tageAbHeute(datum),
    modellUebereinstimmungProzent: k.modellUebereinstimmungProzent,
  }, sprache);
}


export function toernAnspruchHtml(liste: readonly { tag: number; a: Anspruch }[], sprache: Sprache): string {
  if (liste.length === 0) return '';
  const max = liste.reduce((m, x) => (x.a.punkte > m.a.punkte ? x : m), liste[0]!);
  const en = sprache === 'en';
  return `<p class="vp-anspruch-toern">${escapeHtml(en ? 'Highest demand of the voyage' : 'Höchster Anspruch des Törns')}: `
    + `<b>${escapeHtml(anspruchKurztext(max.a, sprache))}</b> (${en ? 'day' : 'Tag'} ${max.tag}) · ${escapeHtml(anspruchGruende(max.a, sprache))}</p>`;
}

const ANKER_ZEICHEN: Record<'geschuetzt' | 'teilweise' | 'offen', string> = {
  geschuetzt: '⚓', teilweise: '⚓', offen: '⚓',
};


const WARUM_TEXT: Record<Sprache, (t: number) => string> = {
  de: (t) => `Begründung<span class="vp-sr-only">, Tag ${t}</span>`,
  en: (t) => `Reasoning<span class="vp-sr-only">, day ${t}</span>`,
};
const DETAILS_TEXT: Record<Sprache, (t: number) => string> = {
  de: (t) => `Tag ${t} ändern`,
  en: (t) => `Change day ${t}`,
};


const EINGRIFF_TEXT: Record<Sprache, {
  festnageln: string; hafentag: string; hafentagFest: string; umlegen: string; umlegenKnopf: string;
}> = {
  de: {
    festnageln: 'Etappe fest einplanen', hafentag: 'Hier stattdessen einen Hafentag',
    hafentagFest: 'Hafentag fest einplanen', umlegen: 'Übernachten stattdessen in', umlegenKnopf: 'Festlegen',
  },
  en: {
    festnageln: 'Pin this leg', hafentag: 'Make this a day in port instead',
    hafentagFest: 'Pin this day in port', umlegen: 'Stay overnight instead at', umlegenKnopf: 'Pin',
  },
};


export function naechsteLiegeplaetze(netz: Kandidatennetz, index: number, anzahl = 6): number[] {
  const ort = netz.knoten[index]?.ort;
  if (!ort) return [];
  const mitKante = new Set(netz.kanten.flatMap((k) => [k.von, k.nach]));
  return netz.knoten
    .map((k, i) => ({ i, sm: distNM(ort.lat, ort.lon, k.ort.lat, k.ort.lon) }))
    .filter((x) => x.i !== index && mitKante.has(x.i))
    .sort((a, b) => a.sm - b.sm || a.i - b.i)
    .slice(0, anzahl)
    .map((x) => x.i);
}


export function naechsterVerbundenerKnoten(netz: Kandidatennetz, punkt: Punkt): number | null {
  const mitKante = new Set(netz.kanten.flatMap((k) => [k.von, k.nach]));
  let bester: number | null = null;
  let besterSm = Infinity;
  for (let i = 0; i < netz.knoten.length; i++) {
    if (!mitKante.has(i)) continue;
    const sm = distNM(punkt.lat, punkt.lon, netz.knoten[i]!.ort.lat, netz.knoten[i]!.ort.lon);
    if (sm < besterSm) { bester = i; besterSm = sm; }
  }
  return bester;
}


export function eingriffHtml(e: WochenplanEtappe, netz: Kandidatennetz, sprache: Sprache): string {
  const T = EINGRIFF_TEXT[sprache];
  const knopf = (text: string, knoten: number): string =>
    `<button type="button" class="btn ghost vp-eingriff-knopf" data-aktion="festlegen" data-tag="${e.tag}" data-knoten="${knoten}">${escapeHtml(text)}</button>`;
  if (e.istHafentag) return `<div class="vp-eingriff">${knopf(T.hafentagFest, e.vonIndex)}</div>`;
  const optionen = naechsteLiegeplaetze(netz, e.nachIndex)
    .map((i) => `<option value="${i}">${escapeHtml(netz.knoten[i]!.name)}</option>`).join('');
  return `<div class="vp-eingriff">`
    + knopf(T.festnageln, e.nachIndex)
    
    
    + (e.istNachtschlag ? '' : knopf(T.hafentag, e.vonIndex))
    + (optionen ? `<label class="vp-eingriff-umlegen">${escapeHtml(T.umlegen)} `
      + `<select class="vp-eingriff-auswahl" data-tag="${e.tag}">${optionen}</select></label>`
      + `<button type="button" class="btn ghost vp-eingriff-knopf" data-aktion="umlegen" data-tag="${e.tag}">${escapeHtml(T.umlegenKnopf)}</button>` : '')
    + '</div>';
}
const ANKER_TEXT: Record<Sprache, Record<'geschuetzt' | 'teilweise' | 'offen', string>> = {
  de: { geschuetzt: 'gedeckt', teilweise: 'teilweise gedeckt', offen: 'offen' },
  en: { geschuetzt: 'sheltered', teilweise: 'partly sheltered', offen: 'exposed' },
};
const HAFENTAG_TEXT: Record<Sprache, string> = { de: 'Hafentag', en: 'Day in port' };

const RESERVETAG_TEXT: Record<Sprache, string> = { de: 'Reservetag', en: 'Reserve day' };
const UEBERNAHMETAG_TEXT: Record<Sprache, string> = { de: 'Übernahmetag', en: 'Check-in day' };
const NACHTSCHLAG_TEXT: Record<Sprache, string> = { de: 'Nachtfahrt', en: 'Night passage' };

const GEWITTER_TEXT: Record<Sprache, string> = { de: 'Gewitter möglich', en: 'Thunderstorms possible' };

const GERUEST_TEXT: Record<Sprache, string> = { de: 'Noch keine Vorhersage: Fahrzeit geschätzt', en: 'No forecast yet: passage time estimated' };

const GERUEST_KURZ: Record<Sprache, string> = { de: 'geschätzt', en: 'estimated' };

const HAFENTAG_IN: Record<Sprache, (art: string, ort: string) => string> = {
  de: (art, ort) => `${art} in ${ort}`, en: (art, ort) => `${art}: ${ort}`,
};


const LISTE_LABEL: Record<Sprache, string> = { de: 'Tage des Plans', en: 'Days of the plan' };

const OHNE_PLAN_TEXT: Record<Sprache, string> = {
  de: 'Noch kein Plan berechnet: „Plan vorschlagen" oben starten.',
  en: 'No plan calculated yet: start "Suggest plan" above.',
};

const OPTION_NICHT_MACHBAR_TEXT: Record<Sprache, string> = {
  de: 'Diese Option ist nicht machbar: kein gültiger Plan gefunden.',
  en: 'This option is not feasible: no valid plan found.',
};
const SPUR_TITEL: Record<Sprache, string> = {
  de: 'Vollständige Begründungsspur', en: 'Full reasoning trace',
};

const GESPEICHERT_TEXT: Record<Sprache, string> = {
  de: 'Gespeicherter Plan: Wind, Schutzlage und Begründung stehen erst nach dem Neurechnen wieder da.',
  en: 'Saved plan: wind, shelter and reasoning return only after recalculating.',
};
const TAG_LABEL: Record<Sprache, (t: number) => string> = {
  de: (t) => `Tag ${t}`, en: (t) => `Day ${t}`,
};

const UMKEHR_TEXT: Record<Sprache, (tag: number) => string> = {
  de: (tag) => `Umkehrpunkt nach Tag ${tag}: Ab hier geht es Richtung Rückgabehafen. Weiter hinaus reicht die Zeit nicht mehr, wenn die übrigen Wunschziele und die Reservetage noch Platz haben sollen.`,
  en: (tag) => `Turning point after day ${tag}: from here the plan heads for the return harbour. Going further out would leave no time for the remaining wish destinations and the reserve days.`,
};


const UMKEHR_NIE: Record<Sprache, string> = {
  de: 'Umkehrpunkt: schon zu Beginn reicht die Zeit nur für Rückweg, offene Wünsche und Reserve.',
  en: 'Turning point: from the very start the time covers only the way back, the open wishes and the reserve.',
};


const UMKEHR_BRUCH: Record<Sprache, string> = {
  de: ' Achtung: Eine spätere Etappe hält die Bedingung wieder ein. Der Plan überspringt den Umkehrpunkt.',
  en: ' Careful: a later leg meets the condition again. The plan steps over the turning point.',
};

const SPUR_TAG_LABEL: Record<Sprache, (t: number) => string> = {
  de: (t) => `Tag ${t}`, en: (t) => `Day ${t}`,
};




export interface WochenplanAnzeigeZiel {
  boxId?: string;
  label?: string;
  istOption?: boolean;
  
  hinweis?: string;
  
  umkehrpunkt?: UmkehrpunktErgebnis | null;
  
  datumFuerTag?: (tag: number) => Date | null;
  
  reserveTage?: number;
  
  uebernahmeSpaet?: boolean;
  
  eingriff?: boolean;
  
  skipperGuide?: ReadonlyMap<number, { name: string; text: string; seite: string; quelle: string; stand: string | null }>;
  
  kraftstoff?: { angabe: KraftstoffAngabe; motorKn: number } | null;
}


export function planMotorSm(ergebnis: WochenplanErgebnis): { sm: number; ohneVorhersage: boolean } {
  let sm = 0, ohneVorhersage = false;
  for (const e of ergebnis.etappen) {
    if (e.istHafentag) continue;
    const anteil = e.kennzahlen.motorShareAnteil;
    if (anteil == null) ohneVorhersage = true;
    sm += e.sm * (anteil ?? 1);
  }
  return { sm, ohneVorhersage };
}


export function skipperGuideZitatHtml(
  z: { name: string; text: string; seite: string; quelle: string; stand: string | null }, sprache: Sprache,
): string {
  const en = sprache === 'en';
  const kopf = `SkipperGuide.de, ${z.seite === z.name ? `„${z.seite}"` : `„${z.seite}", ${z.name}`}`
    + (z.stand ? (en ? `, as of ${z.stand}` : `, Stand ${z.stand}`) : '')
    + (en ? ' (German original)' : '');
  return `<blockquote class="vp-zitat"><p>${escapeHtml(kopf)}:</p><p>${escapeHtml(z.text)}</p>`
    + `<p class="vp-zitat-quelle">${en ? 'Source' : 'Quelle'}: ${escapeHtml(z.quelle)} (GFDL)</p></blockquote>`;
}


function kennzahlenzeileHtml(
  ergebnis: WochenplanErgebnis, sprache: Sprache, umkehr: UmkehrpunktErgebnis | null,
  kraftstoff: WochenplanAnzeigeZiel['kraftstoff'] = null,
): string {
  const k = planKennzahlen(ergebnis);
  const fahrtage = ergebnis.etappen.filter((e) => !e.istHafentag).length;
  const hafentage = ergebnis.etappen.filter((e) => e.istHafentag).length;
  const naechte = ergebnis.etappen.filter((e) => e.istNachtschlag).length;
  const laengste = Math.max(0, ...ergebnis.etappen.map((e) => e.sm));

  const felder: { schluessel: keyof typeof KENNZAHL_TEXT['de']; wert: string }[] = [
    { schluessel: 'sm', wert: smText(k.gesamtSm, 0, sprache) },
    { schluessel: 'fahrtage', wert: String(fahrtage) },
    { schluessel: 'hafentage', wert: String(hafentage) },
    { schluessel: 'laengste', wert: smText(laengste, 0, sprache) },
  ];
  
  
  if (naechte > 0) felder.push({ schluessel: 'naechte', wert: String(naechte) });
  
  
  const reichweite = umkehr?.reichweiteJeTag[umkehr.reichweiteJeTag.length - 1];
  if (reichweite != null) felder.push({ schluessel: 'reichweite', wert: `${reichweite} d` });
  
  
  if (k.modellUebereinstimmungMinProzent != null) {
    felder.push({ schluessel: 'modell', wert: `${nf(k.modellUebereinstimmungMinProzent, 0, sprache)} %` });
  }
  
  if (kraftstoff) {
    const motor = planMotorSm(ergebnis).sm;
    felder.push({ schluessel: 'motor', wert: smText(motor, 0, sprache) });
    felder.push({ schluessel: 'diesel', wert: `${nf(Math.max(1, Math.round(dieselLiter(kraftstoff.angabe, motor, kraftstoff.motorKn) / 5) * 5), 0, sprache)} l` });
  }

  return `<dl class="vp-woche-kennzahlen">${felder.map((f) => (
    `<div><dt>${escapeHtml(KENNZAHL_TEXT[sprache][f.schluessel])}</dt><dd>${escapeHtml(f.wert)}</dd></div>`
  )).join('')}</dl>`;
}


function kraftstoffHtml(ergebnis: WochenplanErgebnis, k: NonNullable<WochenplanAnzeigeZiel['kraftstoff']>, sprache: Sprache): string {
  const motor = planMotorSm(ergebnis);
  return `<p class="vp-hinweis">${escapeHtml(`${tankZeile(k.angabe, k.motorKn, sprache)} ${bedarfSatz(k.angabe, motor.sm, k.motorKn, sprache, motor.ohneVorhersage)}`)}</p>`;
}

const KENNZAHL_TEXT = {
  de: {
    sm: 'Strecke', fahrtage: 'Fahrtage', hafentage: 'Hafentage',
    laengste: 'längste Etappe', naechte: 'Nachtfahrten', reichweite: 'Reichweite am Ziel',
    modell: 'Modellübereinstimmung', motor: 'unter Motor', diesel: 'Diesel, geschätzt',
  },
  en: {
    sm: 'Distance', fahrtage: 'Sailing days', hafentage: 'Days in port',
    laengste: 'Longest leg', naechte: 'Night passages', reichweite: 'Slack at the end',
    modell: 'Model agreement', motor: 'Under engine', diesel: 'Diesel, estimated',
  },
} as const;


const k0 = (e: { kennzahlen: EtappenKennzahlen }): EtappenKennzahlen => e.kennzahlen;


function ankerHtml(stufe: 'geschuetzt' | 'teilweise' | 'offen', sprache: Sprache): string {
  return `<span class="vp-woche-anker vp-woche-anker-${stufe}">${ANKER_ZEICHEN[stufe]}`
    + `<span class="vp-woche-anker-text">${escapeHtml(ANKER_TEXT[sprache][stufe])}</span></span>`;
}


function warumHtml(titel: string | null, tag: number, sprache: Sprache, eingriff = ''): string {
  if (!titel && !eingriff) return '';
  return `<details class="vp-woche-warum">
    <summary>${titel ? WARUM_TEXT[sprache](tag) : escapeHtml(DETAILS_TEXT[sprache](tag))}</summary>
    ${titel ? `<p>${escapeHtml(titel)}</p>` : ''}${eingriff}
  </details>`;
}



export function ablegeTag(e: Pick<WochenplanEtappe, 'tag' | 'istNachtschlag'>): number {
  return e.istNachtschlag ? e.tag - 1 : e.tag;
}


export function vortag(iso: string | null | undefined): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1)).toISOString().slice(0, 10) : null;
}


export function gespeicherterAblegetag(datum: string | null, vorigesDatum: string | null): string | null {
  if (!datum || !vorigesDatum) return datum;
  const tag = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return Math.round((tag(datum) - tag(vorigesDatum)) / 86_400_000) === 2 ? vortag(datum) : datum;
}

function tagLabel(tag: number, datumFuerTag: ((tag: number) => Date | null) | undefined, sprache: Sprache): string {
  const datum = datumFuerTag?.(tag) ?? null;
  return datum ? wochentagDatum(datum, sprache) : TAG_LABEL[sprache](tag);
}


function uhrzeitAus(iso: string): string {
  return iso.slice(11, 16);
}


function courseCastLink(
  e: WochenplanEtappe, netz: Kandidatennetz,
  datumFuerTag: ((tag: number) => Date | null) | undefined, sprache: Sprache,
): string {
  if (e.istHafentag) return '';
  const von = netz.knoten[e.vonIndex]?.ort;
  const nach = netz.knoten[e.nachIndex]?.ort;
  const datum = datumFuerTag?.(ablegeTag(e)) ?? null;
  if (!von || !nach || !datum) return '';
  const p = (n: number): string => String(n).padStart(2, '0');
  
  const zwischen = kantenWeg(netz, e.vonIndex, e.nachIndex).slice(1, -1);
  return tagesplanungLinkHtml(von, nach, `${datum.getFullYear()}-${p(datum.getMonth() + 1)}-${p(datum.getDate())}`, sprache, zwischen);
}


function tagesplanungLinkHtml(von: Punkt, nach: Punkt, datumStr: string, sprache: Sprache, zwischen: readonly Punkt[] = []): string {
  const url = tagesplanungUrl(von, nach, datumStr, zwischen);
  
  
  
  
  
  
  return `<a class="vp-woche-coursecast" href="${url}">${escapeHtml(COURSECAST_TEXT[sprache])}</a>`;
}

const COURSECAST_TEXT: Record<Sprache, string> = {
  
  
  
  de: 'In der Tagesplanung', en: 'In CourseCast',
};


function umkehrlinieHtml(u: UmkehrpunktErgebnis | null | undefined, sprache: Sprache): string {
  if (!u) return '';
  const warnung = !u.gueltig
    ? `<span class="vp-umkehr-bruch">${escapeHtml(UMKEHR_BRUCH[sprache])}</span>`
    : '';
  if (u.tag == null) {
    return `<div class="vp-umkehrlinie vp-umkehrlinie-nie">
      <span class="vp-umkehr-text">${escapeHtml(UMKEHR_NIE[sprache])}</span>${warnung}
    </div>`;
  }
  return `<div class="vp-umkehrlinie">
    <span class="vp-umkehr-text">${escapeHtml(UMKEHR_TEXT[sprache](u.tag))}</span>${warnung}
  </div>`;
}


function vollstaendigeSpurHtml(begruendung: Begruendungsspur, netz: Kandidatennetz, sprache: Sprache): string {
  const eintraege = begruendung.tage
    .map((tag) => ({ tag: tag.tag, text: vollstaendigeTagesSpur(tag, netz, sprache) }))
    .filter((e): e is { tag: number; text: string } => e.text != null);
  if (eintraege.length === 0) return '';
  const zeilen = eintraege
    .map((e) => `<li><strong>${escapeHtml(SPUR_TAG_LABEL[sprache](e.tag))}:</strong> ${escapeHtml(e.text)}</li>`)
    .join('');
  return `<details class="vp-woche-spur">
    <summary>${escapeHtml(SPUR_TITEL[sprache])}</summary>
    <ul>${zeilen}</ul>
  </details>`;
}


export function renderAutomatischenWochenplan(
  ergebnis: WochenplanErgebnis | null, netz: Kandidatennetz | null,
  wunschzielIndizesListe: readonly number[], sprache: Sprache,
  begruendung: Begruendungsspur | null = null, ziel: WochenplanAnzeigeZiel = {},
): void {
  const box = document.getElementById(ziel.boxId ?? 'vp-woche-automatisch');
  if (!box) return;
  const labelHtml = ziel.label ? `<h4 class="vp-woche-label">${escapeHtml(ziel.label)}</h4>` : '';

  if (!ergebnis || !netz) {
    const text = ziel.hinweis ?? (ziel.istOption ? OPTION_NICHT_MACHBAR_TEXT[sprache] : OHNE_PLAN_TEXT[sprache]);
    box.innerHTML = `${labelHtml}<p class="vp-hinweis">${escapeHtml(text)}</p>`;
    return;
  }

  
  
  const ueberblickHtml = `<p class="vp-woche-ueberblick">`
    + `${escapeHtml(wochenUeberblick(ergebnis, planKennzahlen(ergebnis), sprache))}</p>`;

  const spurHtml = begruendung ? vollstaendigeSpurHtml(begruendung, netz, sprache) : '';
  const kennzahlenHtml = kennzahlenzeileHtml(ergebnis, sprache, ziel.umkehrpunkt ?? null, ziel.kraftstoff ?? null)
    + (ziel.kraftstoff ? kraftstoffHtml(ergebnis, ziel.kraftstoff, sprache) : '');

  box.innerHTML = labelHtml + ueberblickHtml + kennzahlenHtml
    + planZeilenHtml(ergebnis, netz, wunschzielIndizesListe, sprache, begruendung, ziel)
    + spurHtml;
}


export function planZeilenHtml(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz,
  wunschzielIndizesListe: readonly number[], sprache: Sprache,
  begruendung: Begruendungsspur | null = null, ziel: WochenplanAnzeigeZiel = {},
): string {
  
  
  
  
  const umkehrNachTag = ziel.umkehrpunkt?.tag ?? null;

  const zusatzHtml = (knoten: number, e: WochenplanEtappe): string => {
    const zitat = ziel.skipperGuide?.get(knoten);
    return (zitat ? skipperGuideZitatHtml(zitat, sprache) : '') + (ziel.eingriff ? eingriffHtml(e, netz, sprache) : '');
  };
  
  
  
  const letzterPlanTag = ergebnis.etappen[ergebnis.etappen.length - 1]?.tag ?? 0;
  const umkehrSagtEtwas = ziel.umkehrpunkt?.gueltig === false || (umkehrNachTag != null && umkehrNachTag < letzterPlanTag);
  const ansprueche: { tag: number; a: Anspruch }[] = [];
  const zeilen = ergebnis.etappen.map((e) => {
    const a = etappenAnspruch(e, ziel.datumFuerTag?.(ablegeTag(e)) ?? null, sprache);
    if (a) ansprueche.push({ tag: e.tag, a });
    const linie = umkehrSagtEtwas && umkehrNachTag != null && e.tag === umkehrNachTag
      ? umkehrlinieHtml(ziel.umkehrpunkt, sprache) : '';
    const von = netz.knoten[e.vonIndex]?.name ?? '?';
    const nach = netz.knoten[e.nachIndex]?.name ?? '?';
    const istWunschziel = wunschzielIndizesListe.includes(e.nachIndex);
    
    
    const tagBeg = begruendung?.tage.find((t) => t.tag === e.tag);
    const titel = tagBeg ? tagesBegruendung(tagBeg, netz, sprache) : null;
    const k = e.kennzahlen;
    const wind = k.maxWindKn != null ? `${nf(k.maxWindKn, 0, sprache)}/${nf(k.maxGustKn ?? k.maxWindKn, 0, sprache)} kn` : null;
    const wann = tagLabel(ablegeTag(e), ziel.datumFuerTag, sprache);

    if (e.istHafentag) {
      const letzteEtappe = ergebnis.etappen[ergebnis.etappen.length - 1];
      const letzterTag = letzteEtappe?.tag ?? 0;
      const zielKnoten = letzteEtappe?.nachIndex;
      const hafentagName = (x: typeof e): string => {
        if (x.tag === 1 && ziel.uebernahmeSpaet && x.vonIndex === ergebnis.etappen[0]?.vonIndex) return UEBERNAHMETAG_TEXT[sprache];
        if ((ziel.reserveTage ?? 0) > 0 && x.vonIndex === zielKnoten && x.tag > letzterTag - (ziel.reserveTage ?? 0)) return RESERVETAG_TEXT[sprache];
        return HAFENTAG_TEXT[sprache];
      };
      
      
      return tageszeileHtml({
        tag: e.tag, wann, route: HAFENTAG_IN[sprache](hafentagName(e), von), ort: von,
        klassen: ['vp-woche-hafentag'], wind,
        lage: { klasse: 'hafentag', text: HAFENTAG_TEXT[sprache] },
        mehr: warumHtml(titel, e.tag, sprache, zusatzHtml(e.vonIndex, e)),
      }, sprache) + linie;
    }

    const klassen: string[] = [];
    if (istWunschziel) klassen.push('vp-woche-wunschziel');
    if (e.regime === 'geruest') klassen.push('vp-woche-geruest');
    if (k0(e).lage) klassen.push(`vp-lage-${k0(e).lage}`);
    const anker = k.schutzWellenanlaufNM != null ? schutzStufe(k.schutzWellenanlaufNM) : null;
    const lage = e.regime === 'geruest'
      ? { klasse: 'geruest', text: GERUEST_KURZ[sprache] }
      : k.lage ? { klasse: k.lage, text: LAGE_TEXT[sprache][k.lage] } : null;

    return tageszeileHtml({
      tag: e.tag, wann, route: `${von} → ${nach}`, klassen,
      sm: smText(e.sm, 1, sprache),
      ablegen: k.ablegeZeitIso ? uhrzeitAus(k.ablegeZeitIso) : null,
      dauer: k.totalHrs != null ? fmtDur(k.totalHrs) : null,
      wind, lage,
      routeZusatz: (e.istNachtschlag ? `<span class="vp-woche-nacht" aria-hidden="true">🌙</span><span class="vp-sr-only">${escapeHtml(NACHTSCHLAG_TEXT[sprache])}</span>` : '')
        + (k.gewitter ? `<span class="vp-woche-gewitter"><span aria-hidden="true">⚡</span><span class="vp-sr-only">${escapeHtml(GEWITTER_TEXT[sprache])}</span></span>` : '')
        + (a ? anspruchKompaktHtml(a, sprache) : ''),
      link: courseCastLink(e, netz, ziel.datumFuerTag, sprache),
      mehr: (a ? anspruchHtml(a, sprache) : '') + (anker ? ankerHtml(anker, sprache) : '')
        + (k.gewitter ? `<p class="vp-woche-gewitter-text"><span aria-hidden="true">⚡</span> ${escapeHtml(GEWITTER_TEXT[sprache])}</p>` : '')
        + (e.istNachtschlag ? `<p class="vp-woche-nacht-text">${escapeHtml(NACHTSCHLAG_TEXT[sprache])}</p>` : '')
        + (e.regime === 'geruest' ? `<p class="vp-woche-info">${escapeHtml(GERUEST_TEXT[sprache])}</p>` : '')
        + warumHtml(titel, e.tag, sprache, zusatzHtml(e.nachIndex, e)),
    }, sprache) + linie;
  });
  
  
  return toernAnspruchHtml(ansprueche, sprache)
    + `<div class="vp-woche-liste" role="list" aria-label="${escapeHtml(LISTE_LABEL[sprache])}">`
    + tabellenKopfHtml(sprache)
    + zeilen.map((z) => `<div role="listitem">${z}</div>`).join('')
    + '</div>';
}


export interface GespeicherteEtappenZeile {
  tag: number;
  datum: string | null;
  vonName: string;
  nachName: string;
  istHafentag: boolean;
  sm: number | null;
  
  von?: Punkt | null;
  nach?: Punkt | null;
  
  wegpunkte?: Punkt[];
}


function gespeichertesTagLabel(z: GespeicherteEtappenZeile, sprache: Sprache): string {
  return wochentagAusIso(z.datum, sprache) ?? TAG_LABEL[sprache](z.tag);
}


export function renderGespeichertenWochenplan(
  zeilen: readonly GespeicherteEtappenZeile[], sprache: Sprache, ziel: WochenplanAnzeigeZiel = {},
): void {
  const box = document.getElementById(ziel.boxId ?? 'vp-woche-automatisch');
  if (!box) return;
  const labelHtml = ziel.label ? `<h4 class="vp-woche-label">${escapeHtml(ziel.label)}</h4>` : '';

  if (zeilen.length === 0) {
    const text = ziel.hinweis ?? (ziel.istOption ? OPTION_NICHT_MACHBAR_TEXT[sprache] : OHNE_PLAN_TEXT[sprache]);
    box.innerHTML = `${labelHtml}<p class="vp-hinweis">${escapeHtml(text)}</p>`;
    return;
  }

  box.innerHTML = labelHtml
    + `<p class="vp-woche-ueberblick">${escapeHtml(GESPEICHERT_TEXT[sprache])}</p>`
    + `<div class="vp-woche-liste" role="list" aria-label="${escapeHtml(LISTE_LABEL[sprache])}">`
    + tabellenKopfHtml(sprache)
    + zeilen.map((z) => `<div role="listitem">${tageszeileHtml({
      tag: z.tag,
      wann: gespeichertesTagLabel(z, sprache),
      route: z.istHafentag ? HAFENTAG_IN[sprache](HAFENTAG_TEXT[sprache], z.vonName) : `${z.vonName} → ${z.nachName}`,
      ...(z.istHafentag ? { ort: z.vonName } : {}),
      klassen: z.istHafentag ? ['vp-woche-gespeichert', 'vp-woche-hafentag'] : ['vp-woche-gespeichert'],
      sm: z.sm != null ? smText(z.sm, 1, sprache) : null,
      lage: z.istHafentag ? { klasse: 'hafentag', text: HAFENTAG_TEXT[sprache] } : null,
      link: !z.istHafentag && z.von && z.nach && z.datum
        ? tagesplanungLinkHtml(z.von, z.nach, z.datum.slice(0, 10), sprache, (z.wegpunkte ?? []).slice(1, -1)) : '',
    }, sprache)}</div>`).join('')
    + '</div>';
}

const VERGLEICH_LABEL: Record<Sprache, Record<
  'tagesziele' | 'machbar' | 'seemeilen' | 'fahrzeit' | 'kreuzanteil' | 'motoranteil' | 'gedeckteNaechte' | 'offeneNaechte' | 'modell', string
>> = {
  de: {
    tagesziele: 'Tagesziele', machbar: 'Machbar', seemeilen: 'Seemeilen', fahrzeit: 'Fahrzeit',
    kreuzanteil: 'Kreuzanteil', motoranteil: 'Unter Maschine',
    gedeckteNaechte: 'Gedeckte Nächte', offeneNaechte: 'Offene Nächte',
    modell: 'Modellübereinstimmung (min.)',
  },
  en: {
    tagesziele: 'Overnight stops', machbar: 'Feasible', seemeilen: 'Nautical miles', fahrzeit: 'Passage time',
    kreuzanteil: 'Beating share', motoranteil: 'Under engine',
    gedeckteNaechte: 'Sheltered nights', offeneNaechte: 'Exposed nights',
    modell: 'Model agreement (min.)',
  },
};
const MACHBAR_TEXT: Record<Sprache, Record<'ja' | 'nein', string>> = {
  de: { ja: 'ja', nein: 'nein' }, en: { ja: 'yes', nein: 'no' },
};
const ENTSCHEIDUNGSPUNKT_TEXT: Record<Sprache, { keiner: string; keinVergleich: string; tag: (t: number) => string }> = {
  de: {
    keiner: 'Die Entscheidung fällt beim Ablegen. Es gibt keinen späteren Tag, an dem beide Optionen noch offen sind.',
    keinVergleich: 'Kein Entscheidungspunkt: mindestens eine Option hat keinen Plan.',
    tag: (t) => `Entscheidungspunkt: bis Tag ${t} sind beide Optionen gleich; danach trennen sie sich.`,
  },
  en: {
    keiner: 'The decision falls at departure. There is no later day at which both options are still open.',
    keinVergleich: 'No decision point: at least one option has no plan.',
    tag: (t) => `Decision point: both options match through day ${t}; after that they diverge.`,
  },
};


export function entscheidungspunktText(ep: Entscheidungspunkt, sprache: Sprache): string {
  if (ep === null) return ENTSCHEIDUNGSPUNKT_TEXT[sprache].keinVergleich;
  if (ep === 'keiner') return ENTSCHEIDUNGSPUNKT_TEXT[sprache].keiner;
  return ENTSCHEIDUNGSPUNKT_TEXT[sprache].tag(ep.tag);
}


export function optionsSpalteHtml(
  ergebnis: WochenplanErgebnis | null, netz: Kandidatennetz | null,
  wunschzielIndizesListe: readonly number[], sprache: Sprache, ziel: WochenplanAnzeigeZiel = {},
): string {
  if (!ergebnis || !netz) return `<p class="vp-hinweis">${escapeHtml(ziel.hinweis ?? OPTION_NICHT_MACHBAR_TEXT[sprache])}</p>`;
  return `<p class="vp-woche-ueberblick">${escapeHtml(wochenUeberblick(ergebnis, planKennzahlen(ergebnis), sprache))}</p>`
    + planZeilenHtml(ergebnis, netz, wunschzielIndizesListe, sprache, null, { ...ziel, eingriff: false });
}


export function tageszieleText(ergebnis: WochenplanErgebnis | null, netz: Kandidatennetz | null): string | null {
  if (!ergebnis || !netz) return null;
  const namen: string[] = [];
  for (const e of ergebnis.etappen) {
    const name = netz.knoten[e.nachIndex]?.name;
    if (name && namen[namen.length - 1] !== name) namen.push(name);
  }
  return namen.length ? namen.join(' → ') : null;
}


export function renderOptionenVergleich(
  vergleich: { kennzahlen: readonly OptionKennzahlen[]; entscheidungspunkt: Entscheidungspunkt } | null,
  sprache: Sprache,
  
  tagesziele: readonly (string | null)[] = [],
): void {
  const box = document.getElementById('vp-vergleich');
  const tabelleBox = document.getElementById('vp-vergleich-tabelle');
  const entscheidungspunktBox = document.getElementById('vp-vergleich-entscheidungspunkt');
  if (!box || !tabelleBox || !entscheidungspunktBox) return;

  if (!vergleich) {
    box.hidden = true;
    tabelleBox.innerHTML = '';
    entscheidungspunktBox.textContent = '';
    return;
  }
  box.hidden = false;

  const l = VERGLEICH_LABEL[sprache];
  const zeilen: ReadonlyArray<{ label: string; wert: (k: OptionKennzahlen, i: number) => string }> = [
    
    
    ...(tagesziele.some(Boolean) ? [{ label: l.tagesziele, wert: (_k: OptionKennzahlen, i: number) => tagesziele[i] ?? '–' }] : []),
    { label: l.machbar, wert: (k) => MACHBAR_TEXT[sprache][k.machbar ? 'ja' : 'nein'] },
    { label: l.seemeilen, wert: (k) => k.kennzahlen ? smText(k.kennzahlen.gesamtSm, 1, sprache) : '–' },
    { label: l.fahrzeit, wert: (k) => k.kennzahlen ? fmtDur(k.kennzahlen.gesamtFahrzeitHrs) : '–' },
    { label: l.kreuzanteil, wert: (k) => k.kennzahlen ? `${nf(k.kennzahlen.kreuzanteilHrs, 1, sprache)} h` : '–' },
    { label: l.motoranteil, wert: (k) => k.kennzahlen ? `${nf(k.kennzahlen.motoranteilHrs, 1, sprache)} h` : '–' },
    { label: l.gedeckteNaechte, wert: (k) => k.kennzahlen ? String(k.kennzahlen.gedeckteNaechte) : '–' },
    { label: l.offeneNaechte, wert: (k) => k.kennzahlen ? String(k.kennzahlen.offeneNaechte) : '–' },
    {
      label: l.modell,
      wert: (k) => k.kennzahlen?.modellUebereinstimmungMinProzent != null
        ? `${k.kennzahlen.modellUebereinstimmungMinProzent}%` : '–',
    },
  ];

  tabelleBox.innerHTML = `<table class="vp-vergleich-tabelle-el">
    <thead><tr><th scope="col"></th>${vergleich.kennzahlen.map((k) => `<th scope="col">${escapeHtml(k.name)}</th>`).join('')}</tr></thead>
    <tbody>${zeilen.map((z) => `<tr><th scope="row">${escapeHtml(z.label)}</th>${
      vergleich.kennzahlen.map((k, i) => `<td>${escapeHtml(z.wert(k, i))}</td>`).join('')
    }</tr>`).join('')}</tbody>
  </table>`;

  entscheidungspunktBox.textContent = entscheidungspunktText(vergleich.entscheidungspunkt, sprache);
}
