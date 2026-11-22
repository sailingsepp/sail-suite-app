import { noetigeFahrt } from '@/core/ankunftszeit';
import { nf, uhrLt, fmtDur, zuRevierzeit, vonRevierzeit, localDateStr, tagKurz, hhmm, zeitzoneText } from '@/core/time';
import { abgelaufenFuer, abgelaufenOhneOrt, amtlicherVorbehalt, amtlicheBoeen, amtlicheGewitter, giltBisZusatz, tagUndStunde, type AmtlicherBericht } from '@/briefing/amtlich';
import { STEEP_SEA, steilStufe } from '@/core/polar';
import { sonnenhoehe, sonnenzeiten, DAEMMERUNGSWINKEL, type Daemmerungsstufe } from '@/core/sun';
import type { Ablegezeit, SchiffConfig, Grenzwerte, StundenWind, Tageslicht, AnkerplatzArt, Punkt, Gezeit } from '@/core/types';
import { beaufort, anzeigeKn } from '@/briefing/wind';
import { schnellsteFahrt, preisDerEile, spanneText } from '@/briefing/tradeoff';
import { istUnfahrbar } from '@/briefing/verdict';
import { buildBriefing, type BriefingAbschnitt } from '@/briefing';
import type { WarnTreffer } from '@/core/warnungen';
import type { Tiefenlage } from '@/briefing/tiefe';
import type { Gebietsangabe } from '@/briefing/seegebiet';
import { aktuelleSprache } from '@/shell/sprache';
import { icon } from '@/shell/icons';
import { STRINGS } from './strings';
import { buildWarnings } from '@/briefing/weather';
import type { VerlaufPunkt } from '@/briefing/profile';
import type { AusweichzielText } from '@/briefing/alternatives';
import type { HafensteckbriefEingabe } from '@/briefing/hafeninfo';
import type { GezeitenAbsatzEingabe } from '@/briefing/gezeiten';
import type { KritischTexte } from '@/briefing/kritisch';
import { gezeitenGrafikHtml, bindeGezeitenGrafik } from './gezeitenGrafik';
import type { NachtfahrtEingabe } from '@/briefing/nightpassage';
import type { SkipperGuideZitat } from '@/briefing/night';
import type { Synoptik } from '@/briefing/synoptik';
import type { Antriebsphase } from '@/core/antrieb';
import type { Kuestenlinie } from '@/core/shelter';
import { stripSkala, pctVonZeit, indexVonPct, pfeilGeometrie, type StripSkala } from './stripGeom';
import { initVorlesen } from './vorlesen';
import { initShare } from './share';
import { kurzfassung } from '@/briefing/kurzfassung';
import { initPdf } from './pdf';
import { bewertung, LAGE_TEXT, LAGE_ZEICHEN, ankunftLabel, tabelleHtml, stripWerttext, type Lage, type Vorbehalt } from './ergebnisTabelle';
import { kernUndRest } from '@/briefing/kern';
import { anspruch, anspruchHtml } from '@/briefing/anspruch';
import { faehrtDurchMessina } from '@/briefing/messina';
import { describeBoraWetterlage, erkannterLokalwind } from '@/briefing/localWinds';
import type { KraftstoffAngabe } from '@/core/kraftstoff';
import { abstandWaehrend, ABWEICHUNG_DEUTLICH_KN, type Modellabgleich } from '@/core/modellabgleich';
import { bindeBriefing, istOffen } from './briefingAnsicht';

export { bindeBriefing };
import { escapeHtml } from '@/core/html';
import type { Sprache } from '@/core/types';
import { initServerTeilen } from './teilenServer';

import { zeigeIsobarenkarte } from './isobarenkarte';
import type { DruckGitter, Druckanalyse } from '@/core/druckfeld';
import { grenzwertAngabe } from '@/briefing/grenzwert';

function gezeitenBreite(): number {
  const w = typeof window === 'undefined' ? 600 : window.innerWidth - 70;
  return Math.round(Math.min(600, Math.max(260, w)));
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
}

const LAGE_ABZEICHEN: Record<Sprache, Record<'beachten' | 'kritisch', string>> = {
  de: { beachten: 'Beachten', kritisch: 'Kritisch' },
  en: { beachten: 'Note', kritisch: 'Critical' },
};

function kennung(a: BriefingAbschnitt, i: number): string {
  return a.art ? (a.art === 'engstelle' || a.art === 'schutzgebiet' ? a.art + i : a.art) : 'ab' + i;
}

function restText(a: BriefingAbschnitt): string {
  return a.kern && a.text.startsWith(a.kern) ? a.text.slice(a.kern.length).trim() : a.text;
}

const WARN_KURZ_AB = 320;
function warnKurz(text: string, en: boolean): string {
  if (text.replace(/<[^>]+>/g, '').length <= WARN_KURZ_AB) return text;
  const k = kernUndRest(text);
  if (!k?.rest) return text;
  return `${k.kern}<details class="brief-warn-mehr"><summary>${en ? 'More' : 'Mehr'}</summary>${k.rest}</details>`;
}

export type AmtlichStand = 'laedt' | 'fehlt' | null;

export function renderBriefing(abschnitte: BriefingAbschnitt[], o: {
  liegeplatzZusatz: string; untertitel: string; fazitLage: Lage; modellWarnungen: boolean; sprache: Sprache;

  fazitVorbehalt?: boolean;

  amtlichStand?: AmtlichStand;
}): string {
  const en = o.sprache === 'en';
  const fazit = abschnitte.find((x) => x.art === 'fazit');
  const warnungen = abschnitte.find((x) => x.art === 'warnungen');
  const teile = abschnitte.map((x, i) => ({ x, id: kennung(x, i) })).filter(({ x }) => x.art !== 'fazit' && x.art !== 'warnungen');

  const knopf = (id: string, ikon: Parameters<typeof icon>[0], text: string, extra = '', schluessel = ''): string => {
    const i18n = schluessel ? ` data-i18n-aria-label="${schluessel}"` : '';
    const span = schluessel ? ` data-i18n="${schluessel}"` : '';
    return `<button type="button" id="${id}" class="btn-audio brief-aktion" aria-label="${text}" title="${text}"${i18n}${extra}>${icon(ikon)}<span class="brief-aktion-text"${span}>${text}</span></button>`;
  };

  const kopf = `<div class="brief-head">`
    + `<div class="brief-kopf-text"><h2 class="brief-h">Briefing</h2>`
    + (o.untertitel ? `<span class="brief-unter">${o.untertitel}</span>` : '') + `</div>`
    + `<span class="brief-head-actions">`
    + knopf('btn-share', 'teilen', en ? 'Share' : 'Teilen', '', 'brief.teilen')

    + knopf('btn-kurz', 'liste', en ? 'Short' : 'Kurz', ' aria-pressed="false"', 'brief.kurz')
    + knopf('btn-pdf', 'dokument', 'PDF')

    + `<button type="button" id="btn-vorlesen" class="btn-audio brief-aktion"></button>`

    + `<span class="menu-wrap">`
    + knopf('btn-teilen-crew', 'person', en ? 'Share with crew' : 'Für Crew teilen', ' aria-haspopup="true" aria-expanded="false" aria-controls="teilen-panel" hidden', 'brief.crewTeilen')
    + `<div class="menu-panel" id="teilen-panel" hidden>`
    + `<span class="menu-label" data-i18n="brief.crewTeilenTitel">${en ? 'Share with the voyage crew' : 'Mit der Törn-Crew teilen'}</span>`
    + `<select id="teilen-toern-auswahl" class="menu-choice-btn"></select>`
    + `<button type="button" id="btn-teilen-bestaetigen" class="menu-choice-btn" data-i18n="brief.teilen">${en ? 'Share' : 'Teilen'}</button>`
    + `<span id="teilen-status" class="menu-label" role="status" aria-live="polite"></span>`
    + `</div></span>`
    + `</span></div>`
    + `<div class="brief-audio-fehler" id="brief-audio-fehler" hidden></div>`;

  let fazitHtml = '';

  const GRUSS = /\s*<div class="brief-absatz brief-gruss">([\s\S]*?)<\/div>\s*$/;
  const gruss = fazit?.text.match(GRUSS)?.[1] ?? '';
  if (fazit) {
    const k = kernUndRest(fazit.text.replace(GRUSS, ''));
    const warnListe = warnungen?.eintraege?.length
      ? `<h4 class="brief-warn-etikett">${en ? 'Warnings' : 'Warnungen'}</h4><ul class="brief-warnliste">${warnungen.eintraege.map((w) =>
        `<li class="lage-${w.lage}"><span class="sr-only">${LAGE_ABZEICHEN[o.sprache][w.lage === 'kritisch' ? 'kritisch' : 'beachten']}: </span>${warnKurz(w.text, en)}</li>`).join('')}</ul>`
      : o.modellWarnungen ? ''
        : `<p class="brief-keine-warnung"><span class="brief-punkt lage-ok" aria-hidden="true"></span>${en ? 'No warnings for route and period.' : 'Keine Warnungen für Strecke und Zeitraum.'}</p>`;

    const laedt = o.amtlichStand === 'laedt';
    const marke = laedt ? (en ? '… provisional' : '… vorläufig')
      : o.fazitVorbehalt && o.fazitLage === 'brauchbar' ? (en ? '⚠ with reservation' : '⚠ mit Vorbehalt') : `${LAGE_ZEICHEN[o.fazitLage]} ${LAGE_TEXT[o.sprache][o.fazitLage]}`;
    const standZeile = laedt
      ? `<p class="brief-amtlich-stand" role="status">${en ? 'The official marine forecast is still loading. Verdict and recommendation can change with it.' : 'Der amtliche Seewetterbericht wird noch geladen. Fazit und Empfehlung können sich damit ändern.'}</p>`
      : o.amtlichStand === 'fehlt'
        ? `<p class="brief-amtlich-stand" role="status">${en ? 'Official marine forecast unavailable: this verdict rests on the model calculation alone.' : 'Amtlicher Seewetterbericht nicht erreichbar: Dieses Fazit stützt sich nur auf die Modellrechnung.'}</p>`
        : '';
    fazitHtml = `<section class="brief-fazit fazit-${laedt ? 'vorlaeufig' : o.fazitLage}" aria-labelledby="brief-fazit-etikett">`
      + `<div class="brief-fazit-kopf"><span class="brief-fazit-marke">${marke}</span>`
      + `<h3 class="brief-fazit-etikett" id="brief-fazit-etikett">${fazit.titel}</h3></div>`
      + standZeile
      + (k ? `<p class="brief-fazit-kern">${k.kern}</p>${k.rest ? `<div class="brief-fazit-text">${k.rest}</div>` : ''}`
        : `<div class="brief-fazit-text">${fazit.text.replace(GRUSS, '')}</div>`)
      + warnListe + `</section>`;
  }

  const inhalt = `<nav class="brief-inhalt" aria-label="${en ? 'Sections' : 'Abschnitte'}">`
    + `<span class="brief-inhalt-etikett">${en ? 'Sections' : 'Abschnitte'}</span>`
    + teile.map(({ x, id }) => `<button type="button" class="brief-inhalt-knopf" data-ziel="${id}">`
      + `<span class="brief-punkt lage-${x.lage ?? 'ok'}" aria-hidden="true"></span>${x.titel}</button>`).join('')
    + `</nav>`;
  const leiste = `<div class="brief-schmal-leiste"><span class="brief-anzahl">${teile.length} ${en ? 'sections' : 'Abschnitte'}</span>`
    + `<button type="button" class="btn-audio brief-alle"></button></div>`;

  const karten = teile.map(({ x, id }) => {
    const lage = x.lage ?? 'ok';
    const offen = istOffen(id);
    const abzeichen = lage === 'ok' ? '' : `<span class="brief-ab-marke lage-${lage}">${LAGE_ABZEICHEN[o.sprache][lage as 'beachten' | 'kritisch']}</span>`;
    const zusatz = x.art === 'wetter'
      ? `<div id="isobaren-karte" class="isobaren-karte" role="button" tabindex="0" `
        + `aria-label="${en ? 'Enlarge isobar chart' : 'Isobarenkarte vergrößern'}">`
        + `<span class="isobaren-karte-hinweis">${icon('lupe')}${en ? 'Enlarge' : 'Vergrößern'}</span></div>`
      : x.art === 'liegeplatz' ? o.liegeplatzZusatz : '';
    const rest = restText(x);
    return `<article class="brief-abschnitt lage-${lage}" id="brief-ab-${id}" data-id="${id}">`
      + `<h3 class="brief-ab-h"><button type="button" class="brief-ab-kopf" aria-expanded="${offen}" aria-controls="brief-text-${id}">`
      + `<span class="brief-ab-zeile"><span class="brief-punkt lage-${lage}" aria-hidden="true"></span>`
      + `<span class="brief-ab-titel">${x.titel}</span>${abzeichen}</span>`
      + `<span class="brief-pfeil" aria-hidden="true"></span>`
      + (x.kern ? `<span class="brief-ab-kern">${x.kern}</span>` : '')
      + `</button></h3>`
      + `<div class="brief-ab-text" id="brief-text-${id}"${offen ? '' : ' hidden'}>`
      + (rest ? `<div class="brief-panel-txt">${rest}</div>` : '') + zusatz + `</div></article>`;
  }).join('');

  return kopf + fazitHtml + `<div class="brief-koerper">${inhalt}${leiste}<div class="brief-abschnitte">${karten}</div></div>`
    + (gruss ? `<p class="brief-gruss">${gruss}</p>` : '');
}

export interface EmpfehlungEingabe {

  gewaehlt: Ablegezeit;

  empfohlen: Ablegezeit;
  results: Ablegezeit[];
  cfg: SchiffConfig;
  limits: Grenzwerte;
  hatStromdaten: boolean;
  curNote: string;
  daemmerungNote: string;
  totalNM: number;
  forecastEndText: string | null;
  revierWetter: string | null;
  track: VerlaufPunkt[] | null;
  zielHourly: StundenWind | null;
  tageslicht: Tageslicht | null;
  ankerplatzArt: AnkerplatzArt;
  abgerufenText: string | null;
  ziel: Punkt | null;
  ausweichziele: AusweichzielText[] | null;
  nacht: NachtfahrtEingabe | null;
  gezeitZiel?: Gezeit | null;
  syn?: Synoptik | null;

  antrieb?: Antriebsphase[] | null;

  zielKueste?: Kuestenlinie | null;

  skipperGuide?: SkipperGuideZitat | null;

  skipperGuideLaedt?: boolean;

  kartenMitte?: Punkt | null;

  druckfeld?: DruckGitter | null;

  druckanalyse?: Druckanalyse | null;

  tiefe?: Tiefenlage | null;

  seegebiet?: Gebietsangabe | null;

  skipperGuideLage?: 'kein-eintrag' | 'fehlgeschlagen' | null;

  hafen?: HafensteckbriefEingabe | null;

  amtlich?: AmtlicherBericht | AmtlicherBericht[] | null;

  druckfeldStand?: { datum: string; stunde: number } | null;

  gezeiten?: GezeitenAbsatzEingabe | null;

  amtlichStand?: AmtlichStand;

  kritisch?: KritischTexte | null;

  kritischBoeKn?: number | null;

  rechnerischBeste?: Ablegezeit | null;

  kraftstoff?: KraftstoffAngabe | null;

  modellabgleich?: Modellabgleich | null;

  startName?: string | null;
  zielName?: string | null;

  unterwegs?: boolean;

  ankunftSoll?: { ziel: Date; zuSpaet: Date | null; heute?: string } | null;

  wetterwarnungen?: { treffer: WarnTreffer[]; stand: string | null } | null;

  revierZone?: string | null;
  revierVersatzS?: number;
}

function zoneKopf(abfahrtNaiv: Date, zone: string | null | undefined, versatzS: number, sprache: 'de' | 'en'): string {
  const t = abfahrtNaiv.getTime() - versatzS * 1000;
  if (zone) { const z = zeitzoneText(t, zone, sprache); if (z) return z; }
  const h = versatzS / 3600;
  return `UTC${h >= 0 ? '+' : '−'}${Math.abs(h)}`;
}

export function renderRecommendation(e: EmpfehlungEingabe): void {
  const {
    gewaehlt,
    empfohlen,
    results,
    cfg,
    limits,
    hatStromdaten,
    curNote,
    daemmerungNote,
    totalNM,
    forecastEndText,
    revierWetter,
    track,
    zielHourly,
    tageslicht,
    ankerplatzArt,
    abgerufenText,
    ziel,
    ausweichziele,
    nacht,
    gezeitZiel = null,
    syn = null,
    antrieb = null,
    zielKueste = null,
    skipperGuide = null,
    skipperGuideLaedt = false,
    kartenMitte = null,
    druckfeld = null,
    druckanalyse = null,
    tiefe = null,
    seegebiet = null,
    skipperGuideLage = null,
    hafen = null,
    amtlich = null,
    amtlichStand = null,
    gezeiten = null,
    druckfeldStand = null,
    kritisch = null,
    kritischBoeKn = null,
    rechnerischBeste = null,
    kraftstoff = null,
    modellabgleich = null,
    startName = null,
    zielName = null,
    unterwegs = false,
    ankunftSoll = null,
    wetterwarnungen = null,
  } = e;
  let warn = '';
  const istEmpfehlung = gewaehlt === empfohlen;
  const sprache = aktuelleSprache();
  const en = sprache === 'en';

  const abschnitte = buildBriefing(gewaehlt, results, revierWetter, track, zielHourly, tageslicht,
    ankerplatzArt, ziel, ausweichziele, nacht, gezeitZiel, syn,
    cfg.model === 'polar' ? cfg.motorSpeed : null,
    cfg.model === 'polar' ? (cfg.crewZumutbarkeit ?? null) : null,
    empfohlen, antrieb, zielKueste, skipperGuide, skipperGuideLaedt,

    druckanalyse, tiefe, seegebiet, sprache, skipperGuideLage, hafen, amtlich, gezeiten, limits.gust, kritisch, kraftstoff,
    modellabgleich, unterwegs, ankunftSoll, wetterwarnungen);
  const briefSrc = abgerufenText
    ? `<div class="brief-src">${en ? `Data from ${abgerufenText}` : `Daten von ${abgerufenText}`}</div>`
    : '';

  const gezeitenGrafik = gezeiten
    ? gezeitenGrafikHtml({

      lage: gezeiten.lage, sprache, breite: gezeitenBreite(),
      marke: { zeit: gezeiten.ankunft, text: en ? 'arrival' : 'Ankunft' },
    })
    : '';
  const warnungen = buildWarnings(gewaehlt.events, sprache);

  const tagIso = localDateStr(gewaehlt.departure);
  const [jj, mm, tt] = tagIso.split('-').map(Number);
  const tagText = new Date(jj!, (mm ?? 1) - 1, tt ?? 1).toLocaleDateString(en ? 'en-GB' : 'de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const strecke = startName && zielName ? `${escapeHtml(startName)} → ${escapeHtml(zielName)}` : escapeHtml(startName ?? zielName ?? '');

  const zoneText = zoneKopf(gewaehlt.departure, e.revierZone, e.revierVersatzS ?? 0, en ? 'en' : 'de');
  const untertitel = [strecke, tagText, en ? `from ${uhrLt(gewaehlt.departure)}` : `ab ${uhrLt(gewaehlt.departure)}`, `LT = ${zoneText}`].filter(Boolean).join(' · ');
  warn += `<div class="brief">${renderBriefing(abschnitte, {
    liegeplatzZusatz: gezeitenGrafik, untertitel, sprache,

    fazitLage: bewertung(gewaehlt, empfohlen, Boolean(amtlicherVorbehalt(amtlich, tagIso, limits.gust, gewaehlt.departure, track)) || Boolean(kritisch?.fazit)),

    fazitVorbehalt: Boolean(amtlicherVorbehalt(amtlich, tagIso, limits.gust, gewaehlt.departure, track)) || Boolean(kritisch?.fazit),
    amtlichStand,
    modellWarnungen: warnungen.length > 0,
  })}${briefSrc}</div>`;

  if (warnungen.length) {
    const rows = warnungen.map((w) =>
      `<div class="wx-item ${w.lvl}"><span class="wx-ico">${w.lvl === 'rot' ? '⚠' : 'ℹ'}</span><span>${w.text}</span></div>`).join('');
    warn += en
      ? `<div class="wx-box"><div class="wx-head">Weather warnings for this passage</div>${rows}`
        + `<div class="wx-foot">Derived from the forecast models: <b>not an official severe-weather warning</b>. `
        + `Check the sea forecast of the responsible service before casting off.</div></div>`
      : `<div class="wx-box"><div class="wx-head">Wetterwarnungen für diese Fahrt</div>${rows}`
        + `<div class="wx-foot">Aus den Vorhersagemodellen abgeleitet: <b>keine amtliche Unwetterwarnung</b>. `
        + `Vor dem Ablegen den Seewetterbericht des zuständigen Dienstes prüfen.</div></div>`;
  }
  if (curNote) warn += `<div class="rec-info">ℹ ${curNote}</div>`;
  if (daemmerungNote) warn += `<div class="rec-info">ℹ ${daemmerungNote}</div>`;
  if (gewaehlt.seaValid && gewaehlt.maxSteep > STEEP_SEA) {

    const andere = nf(gewaehlt.steepHs, 1) !== nf(gewaehlt.maxHs, 1);

    const stufe = steilStufe(gewaehlt.maxSteep);
    const stufeWort = stufe === 3 ? (en ? ', extremely steep' : ', extrem steil') : stufe === 2 ? (en ? ', very steep' : ', sehr steil') : '';
    warn += en
      ? `<div class="rec-warn">⚠ Steepest point of the route: ${nf(gewaehlt.steepHs, 1, 'en')} m at a ${gewaehlt.steepTp.toFixed(0)} s period `
        + `(steepness 1:${(1 / gewaehlt.maxSteep).toFixed(0)}${stufeWort})${andere ? `; the highest wave (${nf(gewaehlt.maxHs, 1, 'en')} m) occurs elsewhere` : ''}. `
        + `Short, steep waves are noticeably more uncomfortable for boat and crew than the same height with a long swell.</div>`
      : `<div class="rec-warn">⚠ Steilste Stelle der Route: ${nf(gewaehlt.steepHs, 1)} m bei ${gewaehlt.steepTp.toFixed(0)} s Periode `
        + `(Steilheit 1:${(1 / gewaehlt.maxSteep).toFixed(0)}${stufeWort})${andere ? `; die höchste Welle (${nf(gewaehlt.maxHs, 1)} m) steht an anderer Stelle` : ''}. `
        + `Kurze, steile Wellen sind für Schiff und Crew deutlich unangenehmer als dieselbe Höhe mit langer Dünung.</div>`;
  }
  if (gewaehlt.seaValid && gewaehlt.headSeaShare > 0.4 && gewaehlt.maxHs >= 1.0) {
    warn += en
      ? `<div class="rec-info">ℹ Head sea on ${(gewaehlt.headSeaShare * 100).toFixed(0)}% of the route. `
        + `Expect noticeably less speed and more motion on board than the figures here show.</div>`
      : `<div class="rec-info">ℹ Auf ${(gewaehlt.headSeaShare * 100).toFixed(0)}% der Strecke läuft die See von vorn. `
        + `Rechne mit spürbar weniger Fahrt und mehr Bewegung an Bord, als die Zahlen hier ausweisen.</div>`;
  }
  if (gewaehlt.blockedShare > 0) {

    warn += en
      ? `<div class="rec-warn">⚠ On ${(gewaehlt.blockedShare * 100).toFixed(0)}% of the route the current is stronger than the boat's `
        + `speed across the route, or sets against it on balance. The route can't be held there as planned.</div>`
      : `<div class="rec-warn">⚠ Auf ${(gewaehlt.blockedShare * 100).toFixed(0)}% der Strecke ist der Strom stärker als die Fahrt `
        + `des Bootes quer zur Route oder setzt netto dagegen. Die Route ist dort so nicht zu halten.</div>`;
  }
  if (gewaehlt.beyondForecast && forecastEndText) {
    warn += en
      ? `<div class="rec-warn">⚠ The arrival lies after the end of the forecast (${forecastEndText}). `
        + `The last known wind value is carried forward unchanged for the final part of the route.</div>`
      : `<div class="rec-warn">⚠ Die Ankunft liegt nach dem Ende der Vorhersage (${forecastEndText}). `
        + `Für den letzten Teil der Strecke wird der letzte bekannte Windwert konstant fortgeschrieben.</div>`;
  }
  if (gewaehlt.windLuecke) {

    const l = gewaehlt.windLuecke;
    warn += en
      ? `<div class="rec-warn">⚠ From NM ${nf(l.nm, 0, 'en')} (${uhrLt(l.time)}) the forecast has no wind values for more than 3 hours. `
        + `Passage time and propulsion from there on are not reliable.</div>`
      : `<div class="rec-warn">⚠ Ab sm ${nf(l.nm, 0)} (${uhrLt(l.time)}) fehlen in der Vorhersage Windwerte für mehr als 3 Stunden. `
        + `Fahrzeit und Antrieb sind ab dort nicht belastbar.</div>`;
  }
  if (gewaehlt.safetyFail) {

    const wo = (at: { nm: number; time: Date }) =>
      en ? `at NM ${nf(at.nm, 0, 'en')}, ${uhrLt(at.time)}` : `bei sm ${nf(at.nm, 0)}, ${uhrLt(at.time)}`;
    const parts: string[] = [];
    if (en) {
      if (gewaehlt.meanFail) parts.push(`${grenzwertAngabe('mean wind', gewaehlt.maxWind, limits.mean, 0, 'kn', 'en')} (${wo(gewaehlt.maxWindAt)})`);
      if (gewaehlt.gustFail) parts.push(`${grenzwertAngabe('gusts', gewaehlt.maxGust, limits.gust, 0, 'kn', 'en')} (${wo(gewaehlt.maxGustAt)})`);
      if (gewaehlt.seaFail) parts.push(`${grenzwertAngabe('wave height', gewaehlt.maxHs, limits.wave, 1, 'm', 'en')} (${wo(gewaehlt.maxHsAt)})`);
      warn += `<div class="rec-warn">⚠ This option also exceeds a limit along the route `
        + `(${parts.join(', ')}). Check the official marine forecast before casting off.</div>`;
    } else {
      if (gewaehlt.meanFail) parts.push(`${grenzwertAngabe('Mittelwind', gewaehlt.maxWind, limits.mean, 0, 'kn', 'de')} (${wo(gewaehlt.maxWindAt)})`);
      if (gewaehlt.gustFail) parts.push(`${grenzwertAngabe('Böen', gewaehlt.maxGust, limits.gust, 0, 'kn', 'de')} (${wo(gewaehlt.maxGustAt)})`);
      if (gewaehlt.seaFail) parts.push(`${grenzwertAngabe('Wellenhöhe', gewaehlt.maxHs, limits.wave, 1, 'm', 'de')} (${wo(gewaehlt.maxHsAt)})`);
      warn += `<div class="rec-warn">⚠ Auch bei dieser Option wird ein Grenzwert entlang der Route überschritten `
        + `(${parts.join(', ')}). Vor dem Ablegen den amtlichen Seewetterbericht prüfen.</div>`;
    }
  }

  const kachel = (t: string, v: string) => `<div><span>${t}</span><b>${v}</b></div>`;

  const kachelMitTitel = (t: string, v: string, titel: string) =>
    `<div${titel ? ` title="${titel}"` : ''}><span>${t}</span><b>${v}</b></div>`;

  const kachelMitNotiz = (t: string, v: string, notiz: string) =>
    `<div><span>${t}</span><b>${v}</b><small class="stats-note">${notiz}</small></div>`;
  const alleSchlecht = results.every(istUnfahrbar);

  const schnell = alleSchlecht ? null : schnellsteFahrt(results, gewaehlt);

  const gewaehltUnfahrbar = istUnfahrbar(gewaehlt);

  const amtVorbehalt = alleSchlecht || gewaehltUnfahrbar ? null
    : amtlicherVorbehalt(amtlich, localDateStr(gewaehlt.departure), limits.gust, gewaehlt.departure, track);
  const farbeGelb = amtVorbehalt ? ' style="color:var(--gelb)"' : '';
  const vorbehaltZeile = amtVorbehalt
    ? (en
      ? `<div class="sub rec-vorbehalt">⚠ Only with reservation: the official warning${amtVorbehalt.giltBis ? ` (${giltBisZusatz(amtVorbehalt.giltBis, 'en').slice(2)})` : ''} gives gusts of ${amtVorbehalt.von === amtVorbehalt.bis ? amtVorbehalt.bis : `${amtVorbehalt.von} to ${amtVorbehalt.bis}`} kn, `
        + `above your gust limit of ${limits.gust} kn. The calculation sees at most ${Math.round(gewaehlt.maxGust)} kn on the route.</div>`
      : `<div class="sub rec-vorbehalt">⚠ Nur mit Vorbehalt: Amtlich gewarnt${amtVorbehalt.giltBis ? ` (${giltBisZusatz(amtVorbehalt.giltBis, 'de').slice(2)})` : ''} sind Böen ${amtVorbehalt.von === amtVorbehalt.bis ? amtVorbehalt.bis : `${amtVorbehalt.von} bis ${amtVorbehalt.bis}`} kn, `
        + `über deiner Böen-Grenze von ${limits.gust} kn. Die Rechnung sieht auf der Strecke höchstens ${Math.round(gewaehlt.maxGust)} kn.</div>`)
    : '';

  const verschoben = rechnerischBeste && istEmpfehlung
    ? amtlicherVorbehalt(amtlich, tagIso, limits.gust, rechnerischBeste.departure, track) : null;
  const verschobenZeile = rechnerischBeste && verschoben
    ? (en
      ? `<div class="sub rec-vorbehalt">${empfohlen.departure > rechnerischBeste.departure ? 'Later' : 'Earlier'} than the best calculated time (${uhrLt(rechnerischBeste.departure)}): `
        + (verschoben.giltBis
          ? `the official bulletin warns of gusts above your gust limit until ${tagUndStunde(verschoben.giltBis, 'en')}. There is no newer bulletin for the time after that yet; read the current marine forecast before casting off.</div>`
          : 'at that time the official bulletin warns of gusts above your gust limit.</div>')
      : `<div class="sub rec-vorbehalt">${empfohlen.departure > rechnerischBeste.departure ? 'Später' : 'Früher'} als die rechnerisch beste Zeit (${uhrLt(rechnerischBeste.departure)}): `
        + (verschoben.giltBis
          ? `Der amtliche Bericht warnt bis ${tagUndStunde(verschoben.giltBis, 'de')} vor Böen über deiner Böen-Grenze. Für die Zeit danach liegt noch kein neuerer Bericht vor; vor dem Ablegen den aktuellen Seewetterbericht lesen.</div>`
          : 'Zu dieser Zeit warnt der amtliche Bericht vor Böen über deiner Böen-Grenze.</div>'))
    : '';

  const uhrBezug = (d: Date) => {
    const tage = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      - Date.UTC(gewaehlt.departure.getUTCFullYear(), gewaehlt.departure.getUTCMonth(), gewaehlt.departure.getUTCDate())) / 86_400_000);
    const zusatz = tage === 1 ? (en ? ' the next day' : ' am nächsten Tag') : tage === -1 ? (en ? ' the day before' : ' am Vortag') : '';
    return en ? `${uhrLt(d)}${zusatz}` : `${uhrLt(d)}${zusatz}`;
  };
  const kopf = ankunftSoll && !unterwegs
    ? (alleSchlecht
      ? (en
        ? `<div class="big" style="color:var(--red)">Outside the limits</div>
 <div class="sub" style="color:var(--red); font-weight:600; margin-bottom:6px;">
 Departing at ${uhrLt(gewaehlt.departure)} for arrival at ${uhrBezug(ankunftSoll.ziel)}, the passage exceeds the configured limits or a thunderstorm sits on the route.</div>`
        : `<div class="big" style="color:var(--red)">Außerhalb der Grenzwerte</div>
 <div class="sub" style="color:var(--red); font-weight:600; margin-bottom:6px;">
 Mit Ablegen um ${uhrLt(gewaehlt.departure)} für die Ankunft um ${uhrBezug(ankunftSoll.ziel)} überschreitet die Fahrt die eingestellten Grenzwerte oder es steht ein Gewitter auf der Route.</div>`)
      : (en ? `<div class="big"${farbeGelb}>Depart at ${uhrLt(gewaehlt.departure)}</div>` : `<div class="big"${farbeGelb}>${uhrLt(gewaehlt.departure)} ablegen</div>`)
        + (ankunftSoll.zuSpaet
          ? `<div class="sub" style="color:var(--red); font-weight:600; margin-top:4px;">${en
            ? `Arrival at ${uhrBezug(ankunftSoll.ziel)} would have needed departure at ${uhrBezug(ankunftSoll.zuSpaet)}. From now, arrival around ${uhrBezug(gewaehlt.arrival)}.`
            : `Für die Ankunft um ${uhrBezug(ankunftSoll.ziel)} hätte um ${uhrBezug(ankunftSoll.zuSpaet)} abgelegt werden müssen. Ab jetzt Ankunft gegen ${uhrBezug(gewaehlt.arrival)}.`}</div>`
          : `<div class="rec-kriterium">${ankunftSoll.heute && localDateStr(gewaehlt.departure) !== ankunftSoll.heute ? `${tagKurz(localDateStr(gewaehlt.departure), sprache)} · ` : ''}${en ? `For arrival at ${uhrBezug(ankunftSoll.ziel)}` : `Für die Ankunft um ${uhrBezug(ankunftSoll.ziel)}`}</div>`)
        + vorbehaltZeile)
    : unterwegs
    ? (alleSchlecht
      ? (en
        ? `<div class="big" style="color:var(--red)">Outside the limits</div>
 <div class="sub" style="color:var(--red); font-weight:600; margin-bottom:6px;">
 From now, ${uhrLt(gewaehlt.departure)}, the passage exceeds the configured limits or a thunderstorm sits on the route. Check the alternatives below.</div>`
        : `<div class="big" style="color:var(--red)">Außerhalb der Grenzwerte</div>
 <div class="sub" style="color:var(--red); font-weight:600; margin-bottom:6px;">
 Ab jetzt, ${uhrLt(gewaehlt.departure)}, überschreitet die Fahrt die eingestellten Grenzwerte oder es steht ein Gewitter auf der Route. Die Ausweichziele unten prüfen.</div>`)
      : (en ? `<div class="big"${farbeGelb}>Underway from ${uhrLt(gewaehlt.departure)}</div>` : `<div class="big"${farbeGelb}>Unterwegs ab ${uhrLt(gewaehlt.departure)}</div>`)

        + (ankunftSoll
          ? (() => {
            const v = noetigeFahrt(gewaehlt, ankunftSoll.ziel);
            const text = v == null
              ? (en ? `Arrival at ${uhrBezug(ankunftSoll.ziel)}: no longer possible` : `Ankunft um ${uhrBezug(ankunftSoll.ziel)}: geht sich nicht mehr aus`)
              : (en ? `Arrival at ${uhrBezug(ankunftSoll.ziel)}: mean ${nf(v, 1, 'en')} kn over ground` : `Ankunft um ${uhrBezug(ankunftSoll.ziel)}: im Schnitt ${nf(v, 1)} kn über Grund`);
            return `<div class="rec-kriterium">${text}</div>`;
          })()
          : '')
        + vorbehaltZeile)
    : alleSchlecht
    ? (en
      ? `<div class="big" style="color:var(--red)">Do not cast off</div>
 <div class="sub" style="color:var(--red); font-weight:600; margin-bottom:6px;">
 None of the ${results.length} tested departure times stays within the configured limits.
 The time shown below is merely the least unfavourable one, not a recommendation.</div>
 <div class="sub" style="margin-top:8px;">Currently showing ${uhrLt(gewaehlt.departure)}:</div>`
      : `<div class="big" style="color:var(--red)">Nicht auslaufen</div>
 <div class="sub" style="color:var(--red); font-weight:600; margin-bottom:6px;">
 Keine der ${results.length} geprüften Ablegezeiten bleibt innerhalb der eingestellten Grenzwerte.
 Die unten stehende Zeit ist lediglich die am wenigsten ungünstige, keine Empfehlung.</div>
 <div class="sub" style="margin-top:8px;">Angesehen wird ${uhrLt(gewaehlt.departure)}:</div>`)
    : !istEmpfehlung

      ? (en
        ? `<div class="big"${gewaehltUnfahrbar ? ' style="color:var(--red)"' : farbeGelb}>${uhrLt(gewaehlt.departure)}</div>
 <div class="rec-kriterium">Manually chosen time. Recommended: ${uhrLt(empfohlen.departure)}</div>${vorbehaltZeile}
 ${gewaehltUnfahrbar
          ? `<div class="sub" style="color:var(--red); font-weight:600; margin-top:4px;">
             Departure at this time is not advised. It exceeds the configured limits
             or there's a thunderstorm on the route.</div>`
          : ''}`
        : `<div class="big"${gewaehltUnfahrbar ? ' style="color:var(--red)"' : farbeGelb}>${uhrLt(gewaehlt.departure)}</div>
 <div class="rec-kriterium">Selbst gewählte Zeit. Empfehlung: ${uhrLt(empfohlen.departure)}</div>${vorbehaltZeile}
 ${gewaehltUnfahrbar
          ? `<div class="sub" style="color:var(--red); font-weight:600; margin-top:4px;">
             Zu dieser Zeit sollte nicht abgelegt werden. Sie überschreitet die eingestellten Grenzwerte
             oder es steht ein Gewitter auf der Route.</div>`
          : ''}`)
      : (en ? `<div class="big"${farbeGelb}>Depart at ${uhrLt(gewaehlt.departure)}</div>` : `<div class="big"${farbeGelb}>${uhrLt(gewaehlt.departure)} ablegen</div>`)
        + vorbehaltZeile
        + verschobenZeile

        + (schnell ? `<div class="rec-kriterium">${en ? 'Best overall rating' : 'Beste Gesamtbewertung'}</div>` : '');

  const altZeile = schnell
    ? `<div class="rec-alt">
         <div class="rec-alt-kopf">
           <span class="rec-alt-label">${en ? 'Shortest passage time' : 'Kürzeste Fahrzeit'}</span>
           <b>${uhrLt(schnell.departure)}</b>
           <span class="rec-alt-dauer">${fmtDur(schnell.totalHrs)}</span>
           <span class="rec-alt-delta">−${spanneText((gewaehlt.totalHrs - schnell.totalHrs) * 60)}</span>
         </div>
         <div class="rec-alt-grund">${preisDerEile(gewaehlt, schnell, sprache)}</div>
       </div>`
    : '';

  const ankunftText = ankunftLabel(gewaehlt);

  const dauerTitel = gewaehlt.manHrs > 0
    ? ` title="${en ? `incl. ${Math.round(gewaehlt.manHrs * 60)} min manoeuvring` : `inkl. ${Math.round(gewaehlt.manHrs * 60)} min Manöver`}"`
    : '';

  const haltMin = Math.round((gewaehlt.haltHrs ?? 0) * 60);
  const haltNote = haltMin > 0
    ? `<small class="rec-highlight-note">${en ? `incl. ${haltMin} min stop${(gewaehlt.halte?.length ?? 0) > 1 ? 's' : ''}` : `inkl. ${haltMin} min Aufenthalt`}</small>`
    : '';

  const tageslichtText = en
    ? (gewaehlt.isDaylight === null ? 'daylight unknown' : gewaehlt.isDaylight ? 'in daylight' : 'in the dark')
    : (gewaehlt.isDaylight === null ? 'Tageslicht unbekannt' : gewaehlt.isDaylight ? 'bei Tageslicht' : 'im Dunkeln');
  const highlight = en
    ? `<div class="rec-highlight">
      <div><b>${nf(totalNM, 1, 'en')} NM</b><span>Distance</span></div>
      <div${dauerTitel}><b>${fmtDur(gewaehlt.totalHrs)}</b><span>Duration</span>${haltNote}</div>
      <div><b>${ankunftText}</b><span>Arrival</span><small class="rec-highlight-note">${tageslichtText}</small></div>
      <div><b>${nf(gewaehlt.avgSpeed, 1, 'en')} kn</b><span>Avg. speed</span></div>
    </div>`
    : `<div class="rec-highlight">
      <div><b>${nf(totalNM, 1)} sm</b><span>Distanz</span></div>
      <div${dauerTitel}><b>${fmtDur(gewaehlt.totalHrs)}</b><span>Dauer</span>${haltNote}</div>
      <div><b>${ankunftText}</b><span>Ankunft</span><small class="rec-highlight-note">${tageslichtText}</small></div>
      <div><b>${nf(gewaehlt.avgSpeed, 1)} kn</b><span>Ø Geschwindigkeit</span></div>
    </div>`;

  const heute = localDateStr(new Date());
  const tageVoraus = Math.max(0, Math.round((Date.parse(`${tagIso}T12:00:00`) - Date.parse(`${heute}T12:00:00`)) / 86_400_000));
  const amtlichListe: AmtlicherBericht[] = amtlich ? (Array.isArray(amtlich) ? amtlich : [amtlich]) : [];
  const anspruchBlock = anspruchHtml(anspruch({
    dauerHrs: gewaehlt.totalHrs,
    maxWindKn: anzeigeKn(gewaehlt.maxWind),
    maxBoeKn: anzeigeKn(gewaehlt.maxGust),
    maxHsM: gewaehlt.seaValid ? gewaehlt.maxHs : null,
    kreuzAnteil: cfg.model === 'polar' ? gewaehlt.vmgShare : null,
    dunkelHrs: gewaehlt.dunkelHrs,
    gewitter: gewaehlt.events.some((ev) => ev.type === 'gewitter'),
    gewitterAmTag: results.some((r) => r.hasStorm && r !== gewaehlt)
      || amtlichListe.some((ab) => amtlicheGewitter(ab, tagIso, track, gewaehlt.departure)),
    amtlichStreckeKn: kritischBoeKn,

    amtlichSeegebiet: amtlichListe.some((ab) => amtlicheBoeen(ab, tagIso, gewaehlt.departure, track, true) != null),

    amtlichOhneOrt: amtlichListe.some((ab) => amtlicheBoeen(ab, tagIso, gewaehlt.departure, track) != null
      || abgelaufenOhneOrt(ab, tagIso, gewaehlt.departure, track)),

    amtlichAbgelaufen: amtlichListe.some((ab) => abgelaufenFuer(ab, tagIso, gewaehlt.departure)),

    wetterwarnung: describeBoraWetterlage(gewaehlt, gewaehlt.departure.getUTCMonth() + 1, syn ?? null, druckanalyse ?? null, sprache) != null,

    boeenfaktor: gewaehlt.gustFactor,
    lokalwind: erkannterLokalwind(gewaehlt, gewaehlt.departure.getUTCMonth() + 1, syn ?? null),

    modelleUneins: modellabgleich != null
      && (abstandWaehrend(modellabgleich, gewaehlt.departure, gewaehlt.arrival) ?? 0) >= ABWEICHUNG_DEUTLICH_KN,
    nichtFahrbar: istUnfahrbar(gewaehlt),
    zeitfenster: faehrtDurchMessina(track) ? (en ? 'Strait of Messina' : 'Straße von Messina') : null,
    tageVoraus,
    jenseitsVorhersage: gewaehlt.beyondForecast,
    crewZumutbarkeit: cfg.model === 'polar' ? (cfg.crewZumutbarkeit ?? null) : null,
  }, sprache), sprache);

  el<HTMLDivElement>('rec-card').innerHTML = `
    ${kopf}
    ${altZeile}
    ${highlight}
    ${anspruchBlock}
    <div class="stats">
      ${en
      ? kachelMitNotiz('Wind / gusts', nf(anzeigeKn(gewaehlt.maxWind), 0, 'en') + ' / ' + nf(anzeigeKn(gewaehlt.maxGust), 0, 'en')
        + ' kn (' + beaufort(anzeigeKn(gewaehlt.maxGust)) + ' Bft)',
        `Peak wind NM ${nf(gewaehlt.maxWindAt.nm, 0, 'en')}, ${uhrLt(gewaehlt.maxWindAt.time)} · `
        + `gusts NM ${nf(gewaehlt.maxGustAt.nm, 0, 'en')}, ${uhrLt(gewaehlt.maxGustAt.time)}`)
      : kachelMitNotiz('Wind / Böen', nf(anzeigeKn(gewaehlt.maxWind), 0) + ' / ' + nf(anzeigeKn(gewaehlt.maxGust), 0)
        + ' kn (' + beaufort(anzeigeKn(gewaehlt.maxGust)) + ' Bft)',
        `Spitze Wind sm ${nf(gewaehlt.maxWindAt.nm, 0)}, ${uhrLt(gewaehlt.maxWindAt.time)} · `
        + `Böen sm ${nf(gewaehlt.maxGustAt.nm, 0)}, ${uhrLt(gewaehlt.maxGustAt.time)}`)}
      ${en
      ? gewaehlt.gustFactorWind === 0
        ? kachelMitNotiz('Gust factor', '–', 'mean wind below 5 kn throughout')
      : kachelMitTitel('Gust factor', nf(gewaehlt.gustFactor, 2, 'en'),
        gewaehlt.gustFactorWind > 0
          ? `highest gust factor at a single route point: ${nf(gewaehlt.gustFactorGust, 0, 'en')} kn gusts at ${nf(gewaehlt.gustFactorWind, 0, 'en')} kn mean wind. Not maxGust/maxWind, those occur at different points on the route.`
          : '')
      : gewaehlt.gustFactorWind === 0
        ? kachelMitNotiz('Böenfaktor', '–', 'Mittelwind überall unter 5 kn')
      : kachelMitTitel('Böenfaktor', nf(gewaehlt.gustFactor, 2),
        gewaehlt.gustFactorWind > 0
          ? `größter Böenfaktor an einem einzelnen Streckenpunkt: ${nf(gewaehlt.gustFactorGust, 0)} kn Böen bei ${nf(gewaehlt.gustFactorWind, 0)} kn Mittelwind. Nicht maxBöe/maxWind, die stehen an verschiedenen Stellen der Route.`
          : '')}
      ${cfg.model === 'polar' ? kachel(en ? 'Beat / gybe / motor' : 'Kreuz / Hals / Motor',
    Math.round(gewaehlt.beatShare * 100) + ' / ' + Math.round(gewaehlt.gybeShare * 100) + ' / ' + Math.round(gewaehlt.motorShare * 100) + ' %') : ''}
      ${gewaehlt.extraNM > 0.05
      ? kachel(en ? 'Extra distance through water' : 'Mehrweg durchs Wasser', '+' + nf(gewaehlt.extraNM, 1, en ? 'en' : 'de') + (en ? ' NM' : ' sm'))
      : ''}
      ${gewaehlt.seaValid
      ? (en
        ? kachelMitNotiz('Sea state', nf(gewaehlt.maxHs, 1, 'en') + ' m at ' + nf(gewaehlt.hsTp, 0, 'en') + ' s',
          `Peak at NM ${nf(gewaehlt.maxHsAt.nm, 0, 'en')}, ${uhrLt(gewaehlt.maxHsAt.time)}`)
        : kachelMitNotiz('Seegang', nf(gewaehlt.maxHs, 1) + ' m bei ' + nf(gewaehlt.hsTp, 0) + ' s',
          `Spitze bei sm ${nf(gewaehlt.maxHsAt.nm, 0)}, ${uhrLt(gewaehlt.maxHsAt.time)}`))
      : ''}
      ${(cfg.useCurrent && hatStromdaten)
      ? (en
        ? kachel('Current', nf(gewaehlt.maxCurrent, 1, 'en') + ' kn · ' + (gewaehlt.currentGainMin >= 0 ? 'saves ' : 'costs ')
          + Math.abs(Math.round(gewaehlt.currentGainMin)) + ' min')
        : kachel('Strom', nf(gewaehlt.maxCurrent, 1) + ' kn · ' + (gewaehlt.currentGainMin >= 0 ? 'spart ' : 'kostet ')
          + Math.abs(Math.round(gewaehlt.currentGainMin)) + ' min'))
      : ''}
    </div>
    ${warn}
  `;

  bindeBriefing(el<HTMLDivElement>('rec-card'), sprache);
  bindeGezeitenGrafik(el<HTMLDivElement>('rec-card'));
  initVorlesen(abschnitte);
  initShare(abschnitte);
  initKurz(abschnitte, gewaehlt, sprache);
  initPdf(abschnitte, gewaehlt.departure, abgerufenText);
  initServerTeilen(abschnitte, gewaehlt.departure);
  zeigeIsobarenkarte(druckfeld, druckanalyse, kartenMitte, druckfeldStand);
}

export { LAGE_TEXT } from './ergebnisTabelle';

const MIN_ABSTAND_PX = 46;

const MIN_ABSTAND_FAHRT_PX = 95;

const MIN_ABSTAND_SONNE_PX = 120;

let stripByTime: Ablegezeit[] = [];
let stripSkalaAktuell: StripSkala | null = null;
let stripGewaehltIndex = 0;
let stripOnWahl: ((r: Ablegezeit) => void) | null = null;
let stripInit = false;

export function initStripSlider(onWahl: (r: Ablegezeit) => void): void {
  stripOnWahl = onWahl;
  if (stripInit) return;
  stripInit = true;

  const strip = el<HTMLDivElement>('strip');
  let ziehen = false;
  let rafId = 0;

  const waehleIndex = (i: number): void => {
    const r = stripByTime[i];
    if (!r || i === stripGewaehltIndex) return;
    stripOnWahl?.(r);
  };

  const waehleAusX = (clientX: number): void => {
    const s = stripSkalaAktuell;
    if (!s) return;
    const rect = strip.getBoundingClientRect();
    if (rect.width === 0) return;
    waehleIndex(indexVonPct(s, ((clientX - rect.left) / rect.width) * 100));
  };

  const onMove = (e: PointerEvent): void => {
    if (!ziehen || rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; waehleAusX(e.clientX); });
  };
  const stop = (): void => {
    if (!ziehen) return;
    ziehen = false;
    strip.classList.remove('zieht');
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  };

  strip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!stripSkalaAktuell) return;
    e.preventDefault();
    ziehen = true;
    strip.classList.add('zieht');
    document.body.style.userSelect = 'none';
    strip.focus();
    waehleAusX(e.clientX);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  });

  strip.addEventListener('keydown', (e) => {
    const n = stripByTime.length;
    if (n === 0) return;
    let ziel: number | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ziel = stripGewaehltIndex - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') ziel = stripGewaehltIndex + 1;
    else if (e.key === 'PageDown') ziel = stripGewaehltIndex - 4;
    else if (e.key === 'PageUp') ziel = stripGewaehltIndex + 4;
    else if (e.key === 'Home') ziel = 0;
    else if (e.key === 'End') ziel = n - 1;
    if (ziel === null) return;
    e.preventDefault();
    waehleIndex(Math.min(n - 1, Math.max(0, ziel)));
  });
}

export function renderStrip(
  results: Ablegezeit[],
  empfohlen: Ablegezeit,
  gewaehlt: Ablegezeit = empfohlen,
  startOrt: Punkt | null = null,
  dateStr: string | null = null,
  daemmerung: Daemmerungsstufe | null = null,
  utcOffsetSeconds = 0,
  vorbehalt: Vorbehalt = false,
): void {
  const sprache = aktuelleSprache();
  const en = sprache === 'en';

  const strip = el<HTMLDivElement>('strip');
  const stripLabels = el<HTMLDivElement>('strip-labels');
  const sonneLabelsEl = el<HTMLDivElement>('strip-sonne-labels');
  const fahrtLabelsEl = el<HTMLDivElement>('strip-fahrt-labels');
  const hinweisEl = el<HTMLDivElement>('strip-hinweis');
  strip.innerHTML = ''; stripLabels.innerHTML = ''; sonneLabelsEl.innerHTML = ''; fahrtLabelsEl.innerHTML = '';
  const byTime = [...results].sort((a, b) => a.departure.getTime() - b.departure.getTime());
  byTime.forEach((r) => {
    const div = document.createElement('div');
    const b = bewertung(r, empfohlen, vorbehalt);
    div.className = `strip-cell ${b}`;
    div.title = en
      ? `${uhrLt(r.departure)}: ${LAGE_TEXT.en[b]} · ${fmtDur(r.totalHrs)} · `
        + `wind up to ${r.maxWind.toFixed(0)} kn, gusts ${r.maxGust.toFixed(0)} kn`
      : `${uhrLt(r.departure)}: ${LAGE_TEXT.de[b]} · ${fmtDur(r.totalHrs)} · `
        + `Wind bis ${r.maxWind.toFixed(0)} kn, Böen ${r.maxGust.toFixed(0)} kn`;
    if (r === empfohlen) div.classList.add('empfohlen');
    strip.appendChild(div);
  });

  stripByTime = byTime;
  stripGewaehltIndex = Math.max(0, byTime.indexOf(gewaehlt));

  const skala = stripSkala(byTime.map((r) => r.departure));
  stripSkalaAktuell = skala;

  strip.setAttribute('aria-valuemin', '0');
  strip.setAttribute('aria-valuemax', String(Math.max(0, byTime.length - 1)));
  strip.setAttribute('aria-valuenow', String(stripGewaehltIndex));
  strip.setAttribute('aria-valuetext', stripWerttext(gewaehlt, empfohlen, sprache, vorbehalt));

  const posAttr = (pct: number, zeichen = 5): string => {
    const halb = (zeichen * 6.4) / 2 / Math.max(1, strip.clientWidth || 320) * 100;
    return pct < Math.max(3, halb) ? 'left:0;transform:none'
      : pct > Math.min(97, 100 - halb) ? 'left:auto;right:0;transform:none' : `left:${pct}%`;
  };

  if (!skala) {
    stripLabels.innerHTML = `<span style="left:0">${hhmm(byTime[0]!.departure)}</span>`;
    hinweisEl.innerHTML = '';
    return;
  }

  const breite = strip.clientWidth || 320;

  const unter = (winkel: number): Date | null => {
    if (!startOrt || !dateStr) return null;
    const roh = sonnenzeiten(startOrt.lat, startOrt.lon, dateStr, winkel)?.unter;
    return roh ? zuRevierzeit(roh, utcOffsetSeconds) : null;
  };

  const auf = (winkel: number): Date | null => {
    if (!startOrt || !dateStr) return null;
    const roh = sonnenzeiten(startOrt.lat, startOrt.lon, dateStr, winkel)?.auf;
    return roh ? zuRevierzeit(roh, utcOffsetSeconds) : null;
  };

  if (startOrt) {
    const winkelDunkel = daemmerung ? DAEMMERUNGSWINKEL[daemmerung] : DAEMMERUNGSWINKEL.buergerlich;
    const suZeit = unter(DAEMMERUNGSWINKEL.sonne);
    const duskZeit = unter(winkelDunkel);
    const suPct = suZeit ? pctVonZeit(skala, suZeit.getTime()) : null;
    const duskPct = duskZeit ? pctVonZeit(skala, duskZeit.getTime()) : null;

    if (suPct !== null && duskPct !== null && duskPct > 0 && suPct < 100) {
      const vonVerlauf = Math.max(0, suPct);
      const bisVerlauf = Math.min(100, duskPct);
      if (bisVerlauf > vonVerlauf + 0.01) {
        const verlauf = document.createElement('div');
        verlauf.className = 'strip-night-verlauf';
        verlauf.style.left = `${vonVerlauf}%`;
        verlauf.style.width = `${bisVerlauf - vonVerlauf}%`;
        verlauf.title = en
          ? `Sunset ${uhrLt(suZeit!)}: twilight begins here.`
          : `Sonnenuntergang ${uhrLt(suZeit!)}: ab hier beginnt die Dämmerung.`;
        strip.appendChild(verlauf);
      }
      if (duskPct < 100) {
        const nacht = document.createElement('div');
        nacht.className = 'strip-night';
        nacht.style.left = `${Math.max(0, duskPct)}%`;
        nacht.style.width = `${100 - Math.max(0, duskPct)}%`;
        nacht.title = en ? 'It is dark at the start point during this period.' : 'In diesem Zeitraum ist es am Startpunkt dunkel.';
        strip.appendChild(nacht);
      }
    }

    const ersterPunkt = byTime[0];
    if (ersterPunkt
      && sonnenhoehe(startOrt.lat, startOrt.lon, vonRevierzeit(ersterPunkt.departure, utcOffsetSeconds)) < winkelDunkel) {
      const aufZeit = auf(winkelDunkel);
      const aufPct = aufZeit ? pctVonZeit(skala, aufZeit.getTime()) : null;
      const bisFrueh = aufPct !== null ? Math.min(100, Math.max(0, aufPct)) : 100;
      if (bisFrueh > 0.01) {
        const nachtFrueh = document.createElement('div');
        nachtFrueh.className = 'strip-night';
        nachtFrueh.style.left = '0%';
        nachtFrueh.style.width = `${bisFrueh}%`;
        nachtFrueh.title = en ? 'It is dark at the start point during this period.' : 'In diesem Zeitraum ist es am Startpunkt dunkel.';
        strip.appendChild(nachtFrueh);
      }
    }
  }

  interface Sonderpunkt { pct: number; zeit: Date; praefix: string; titelWort: string }
  const sonderpunkte: Sonderpunkt[] = [];
  if (startOrt && dateStr) {
    const pruefen = (zeit: Date | null, praefix: string, titelWort: string): void => {
      if (!zeit) return;
      const pct = pctVonZeit(skala, zeit.getTime());

      if (pct < 0 || pct > 100) return;
      sonderpunkte.push({ pct, zeit, praefix, titelWort });
    };
    pruefen(unter(DAEMMERUNGSWINKEL.sonne), en ? 'SS ' : 'SU ', en ? 'Sunset' : 'Sonnenuntergang');

    if (daemmerung && daemmerung !== 'sonne') {

      const grenzeName = STRINGS[sprache][`option.daemmerung.${daemmerung}`]!;
      pruefen(unter(DAEMMERUNGSWINKEL[daemmerung]), en ? 'Dark ' : 'Dunkel ', en ? `End of ${grenzeName}` : `Ende ${grenzeName}`);
    }
  }

  for (const sp of sonderpunkte) {
    const tick = document.createElement('div');
    tick.className = 'strip-mark';
    tick.style.left = `${sp.pct}%`;
    tick.title = `${sp.titelWort} ${uhrLt(sp.zeit)}`;
    strip.appendChild(tick);
  }

  const ersteVolleStunde = new Date(byTime[0]!.departure);
  ersteVolleStunde.setUTCMinutes(0, 0, 0);
  if (ersteVolleStunde.getTime() < skala.startMs) ersteVolleStunde.setUTCHours(ersteVolleStunde.getUTCHours() + 1);
  const letzteMs = byTime[byTime.length - 1]!.departure.getTime();
  const stunden: number[] = [];
  for (let t = ersteVolleStunde.getTime(); t <= letzteMs; t += 3_600_000) {
    const mark = document.createElement('div');
    mark.className = 'strip-tick';
    mark.style.left = `${pctVonZeit(skala, t)}%`;
    strip.appendChild(mark);
    stunden.push(t);
  }

  const pf = pfeilGeometrie(skala, gewaehlt.departure.getTime(), gewaehlt.arrival.getTime());
  const ankunftKurz = hhmm(gewaehlt.arrival);
  const ankunftLang = ankunftLabel(gewaehlt);

  const pfeil = document.createElement('div');
  pfeil.className = 'strip-fahrt' + (pf.abgeschnitten ? ' offen' : '');
  pfeil.style.left = `${pf.vonPct}%`;
  pfeil.style.width = `${Math.max(0, pf.bisPct - pf.vonPct)}%`;
  pfeil.title = en
    ? (pf.abgeschnitten
      ? `Duration ${fmtDur(gewaehlt.totalHrs)}: the arrival at ${ankunftLang} lies beyond the checked period.`
      : `Duration ${fmtDur(gewaehlt.totalHrs)}: arrival ${ankunftLang}`)
    : (pf.abgeschnitten
      ? `Fahrtdauer ${fmtDur(gewaehlt.totalHrs)}: die Ankunft um ${ankunftLang} liegt hinter dem geprüften Zeitraum.`
      : `Fahrtdauer ${fmtDur(gewaehlt.totalHrs)}: Ankunft ${ankunftLang}`);
  strip.appendChild(pfeil);

  if (!pf.abgeschnitten) {
    const zielStrich = document.createElement('div');
    zielStrich.className = 'strip-ankunft';
    zielStrich.style.left = `${pf.bisPct}%`;
    zielStrich.title = en ? `Arrival ${ankunftLang}` : `Ankunft ${ankunftLang}`;
    strip.appendChild(zielStrich);
  }

  const griff = document.createElement('div');
  griff.className = 'strip-griff';
  griff.style.left = `${pf.vonPct}%`;
  griff.title = en ? `Depart ${uhrLt(gewaehlt.departure)}: drag to move` : `Ablegen ${uhrLt(gewaehlt.departure)}: zum Verschieben ziehen`;
  strip.appendChild(griff);

  const proLabel = (3_600_000 / skala.spanMs) * breite;
  const schritt = Math.max(1, Math.ceil(MIN_ABSTAND_PX / Math.max(1, proLabel)));
  const stundenLabels = stunden
    .filter((_, i) => i % schritt === 0)
    .map((t) => {

      return `<span style="${posAttr(pctVonZeit(skala, t))}">${hhmm(new Date(t))}</span>`;
    });

  stripLabels.innerHTML = stundenLabels.join('');

  const sonneLabels = sonderpunkte.length === 2
    && (Math.abs(sonderpunkte[0]!.pct - sonderpunkte[1]!.pct) / 100) * breite < MIN_ABSTAND_SONNE_PX
    ? (() => {
        const [a, b] = sonderpunkte as [Sonderpunkt, Sonderpunkt];
        const mitte = (a.pct + b.pct) / 2;
        return [`<span class="mark" style="${posAttr(mitte, a.praefix.length + 11)}" `
          + `title="${a.titelWort} ${uhrLt(a.zeit)}, ${b.titelWort} ${uhrLt(b.zeit)}">`
          + `${a.praefix}${hhmm(a.zeit)}→${hhmm(b.zeit)}</span>`];
      })()
    : sonderpunkte.map((sp) => {
        const titel = `${sp.titelWort} ${uhrLt(sp.zeit)}`;
        return `<span class="mark" style="${posAttr(sp.pct, sp.praefix.length + 5)}" title="${titel}">${sp.praefix}${hhmm(sp.zeit)}</span>`;
      });
  sonneLabelsEl.innerHTML = sonneLabels.join('');

  const fahrtLabels: string[] = [];
  const fahrtAbstandPx = ((pf.bisPct - pf.vonPct) / 100) * breite;
  if (!pf.abgeschnitten && fahrtAbstandPx < MIN_ABSTAND_FAHRT_PX) {

    const mitte = (pf.vonPct + pf.bisPct) / 2;
    fahrtLabels.push(`<span class="fahrt" style="${posAttr(mitte)}" `
      + `title="${en ? `Depart ${uhrLt(gewaehlt.departure)}, arrival ${ankunftLang}` : `Ablegen ${uhrLt(gewaehlt.departure)}, Ankunft ${ankunftLang}`}">`
      + `${hhmm(gewaehlt.departure)}→${ankunftKurz}</span>`);
  } else {
    fahrtLabels.push(`<span class="fahrt" style="${posAttr(pf.vonPct)}" `
      + `title="${en ? `Depart ${uhrLt(gewaehlt.departure)}` : `Ablegen ${uhrLt(gewaehlt.departure)}`}">${hhmm(gewaehlt.departure)}</span>`);
    fahrtLabels.push(pf.abgeschnitten

      ? `<span class="fahrt offen" style="left:auto;right:0;transform:none" `
        + `title="${en ? `Arrival ${ankunftLang}, after the checked period` : `Ankunft ${ankunftLang}, nach dem geprüften Zeitraum`}">→ ${ankunftLang}</span>`
      : `<span class="fahrt" style="${posAttr(pf.bisPct)}" `
        + `title="${en ? `Arrival ${ankunftLang}` : `Ankunft ${ankunftLang}`}">${ankunftKurz}</span>`);
  }
  fahrtLabelsEl.innerHTML = fahrtLabels.join('');

  if (gewaehlt === empfohlen) {
    hinweisEl.innerHTML = en
      ? '<span class="strip-tipp">Drag the departure time along the bar: briefing and map recalculate.</span>'
      : '<span class="strip-tipp">Ablegezeit am Balken ziehen: Briefing und Karte rechnen mit.</span>';
  } else {
    hinweisEl.innerHTML = en
      ? `<span class="strip-abweichung">Chosen: <b>${uhrLt(gewaehlt.departure)}</b>, not the recommendation.</span>`
        + `<button type="button" class="btn ghost strip-zurueck">Back to ${uhrLt(empfohlen.departure)}</button>`
      : `<span class="strip-abweichung">Gewählt: <b>${uhrLt(gewaehlt.departure)}</b>, `
        + `nicht die Empfehlung.</span>`
        + `<button type="button" class="btn ghost strip-zurueck">Zurück zu ${uhrLt(empfohlen.departure)}</button>`;
    hinweisEl.querySelector('.strip-zurueck')?.addEventListener('click', () => stripOnWahl?.(empfohlen));
  }
}

export function renderTable(
  results: Ablegezeit[], empfohlen: Ablegezeit, cfg: SchiffConfig, hatStromdaten: boolean,
  gewaehlt: Ablegezeit = empfohlen,
  vorbehalt: Vorbehalt = false,
): void {
  const sprache = aktuelleSprache();

  el<HTMLTableElement>('table').innerHTML = tabelleHtml(results, empfohlen, cfg, hatStromdaten, gewaehlt, sprache, vorbehalt);
}

function initKurz(abschnitte: BriefingAbschnitt[], gewaehlt: Ablegezeit, sprache: Sprache): void {
  const knopf = document.getElementById('btn-kurz') as HTMLButtonElement | null;
  if (!knopf) return;
  const en = sprache === 'en';
  const saetze = kurzfassung(gewaehlt, abschnitte, sprache);
  const kurz: BriefingAbschnitt[] = [{ titel: en ? 'In five sentences' : 'In fünf Sätzen', text: saetze.join(' '), art: 'kurz' }];
  let box = document.getElementById('brief-kurz');
  if (!box) {
    box = document.createElement('div');
    box.id = 'brief-kurz';
    box.className = 'brief-kurz';
    box.hidden = true;
    knopf.closest('.brief-head')?.insertAdjacentElement('afterend', box);
  }
  box.innerHTML = `<ol>${saetze.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
  knopf.onclick = () => {
    const an = knopf.getAttribute('aria-pressed') !== 'true';
    knopf.setAttribute('aria-pressed', String(an));
    box!.hidden = !an;
    initVorlesen(an ? kurz : abschnitte);
    initShare(an ? kurz : abschnitte);
  };
}

