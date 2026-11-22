
import type L from 'leaflet';
import { UEBERNAHME_SPAET_AB_UHR } from '@/core/zielfunktion';
import { aktuelleSprache } from '@/shell/sprache';
import type { Sprache } from '@/core/types';
import { liesSitzungsToken } from '@/shell/session';
import {
  holeEtappen, holeOptionen, loescheOption, schreibeEtappen, type EtappeDaten,
} from '@/data/toernApi';
import { distNM } from '@/core/geo';
import { istWachfaehig, nachtfahrtCrewReicht, type NachtVorgaben } from '@/core/bereitschaft';
import type { WochenplanErgebnis } from '@/core/wochenplan';
import type { Kandidatennetz } from '@/core/hafennetz';
import type { Begruendungsspur } from '@/core/begruendung';
import type { Punkt } from '@/core/types';
import { pruefeMachbarkeit } from '@/core/wunschziele';
import { planKennzahlen } from '@/core/zielfunktion';
import { wochenBriefingAbschnitte } from '@/briefing/wochenplan';
import { initVorlesen } from '@/ui/vorlesen';
import { initShare } from '@/ui/share';
import { initPdf } from '@/ui/pdf';
import { initServerTeilen } from '@/ui/teilenServer';
import {
  baueMachbarkeitEingabe, fehlendeEingabeSchluessel, hatEtwasZuPlanen, istOffeneUeberstellung,
  uebernahmeZeitpunkt, rueckgabeZeitpunkt, type WunschlisteKontext,
} from './wunschliste';
import { nachtVorgabenAus } from './planung';
import { eigenerOptionsName, type Entscheidungspunkt, type OptionsEmpfehlung } from '@/core/optionen';
import { schlagePlanVor, speicherePlanAlsEtappen, brichPlanVorschlagAb } from './planVorschlagen';
import {
  renderAutomatischenWochenplan, renderGespeichertenWochenplan, renderOptionenVergleich,
  entscheidungspunktText, naechsterVerbundenerKnoten, tageszieleText, optionsSpalteHtml, type GespeicherteEtappenZeile, ablegeTag,
  gespeicherterAblegetag, vortag,
} from './wochenplanAutomatik';
import {
  wunschzielIndizes, AUTOMATIK_SCHLUESSEL, OPTION_SCHLUESSEL_1, OPTION_SCHLUESSEL_2,
  keinPlanTextSchluessel, lockerungTextSchluessel, ohneWetterTextSchluessel, kuesteUnbekanntTextSchluessel, kuesteRueckfallTextSchluessel, haefenTeilpaketTextSchluessel, haefenUnbekanntTextSchluessel,
  zeitbudgetTextSchluessel, netzGedeckeltTextSchluessel,
  type RechnerAnfrage, type OptionWunsch, type RechnerFortschritt, type KeinPlanGrund,
} from './rechnerProtokoll';
import { zeichnePlaene, passeAusschnittAn, zeichneUeberstellung } from './karte';
import { holeRevierwetterAusblick } from './revierwetter';
import { ueberstellungVorschlagen } from './ueberstellungBedienung';
import { nf, naiveIso, nDate, kursGrad } from '@/core/time';
import { richtungsName } from '@/briefing/wind';
import { liesPlanFixierungen, legeTagFest } from './planungBedienung';
import type { RechnerAntwort } from './rechnerProtokoll';
import { fixierungenFuerRechner } from './handplan';
import {
  app, wort, $, wunschlisteEins, wunschlisteZwei, wunschlisteKontext, planungJetzt, standardSchiffConfig,
  rueckgabehafenFuerRechner, starthafenAlsZiel, ohneUmkehrpunktFuerToern, datumIso, schreibeAnkunftAlsBis, rahmenGespeichert, tankVorschlag,
} from './kontext';

let karte: L.Map | null = null;
let planEbenen: L.LayerGroup | null = null;


let letzteAntwort: Extract<RechnerAntwort, { lage: 'gefunden' }> | null = null;

let letzterKontext: WunschlisteKontext | undefined;

let gewaehlteOption: string | null = null;

let planLauf = 0;
let planLaufStartIso: string | null = null;

export function planLaufNummer(): number { return planLauf; }


export function letzterGerechneterPlan(): { ergebnis: WochenplanErgebnis; netz: Kandidatennetz; startDatumIso: string } | null {
  const a = letzteAntwort;
  if (!a || !planLaufStartIso) return null;
  const zweite = gewaehlteOption === OPTION_SCHLUESSEL_2 ? a.optionen?.[1]?.ergebnis ?? null : null;
  return { ergebnis: zweite ?? a.ergebnis, netz: a.netz, startDatumIso: planLaufStartIso };
}



let zweiteOptionAktiv = false;

export function setzeZweiteOptionSichtbarkeit(aktiv: boolean): void {
  zweiteOptionAktiv = aktiv;
  const sektion = $('vp-wunschliste-2');
  if (sektion) sektion.hidden = !aktiv;
  const umschaltWrap = $('vp-zweite-option-umschalten-wrap');
  if (umschaltWrap) umschaltWrap.hidden = aktiv;
  if (!aktiv) {
    
    
    
    const box2 = $('vp-woche-automatisch-2');
    if (box2) { box2.hidden = true; box2.innerHTML = ''; }
    zeigeOptionsSpalten(null);
    renderOptionenVergleich(null, aktuelleSprache());
    zeigeOptionenHinweis(null);
    
    
    
    const token = liesSitzungsToken();
    if (token && app.toern && !app.nurLesen) {
      void loescheOption(token, app.toern.id, OPTION_SCHLUESSEL_2);
    }
  }
}




function nachtVorgabenFuerToern(): NachtVorgaben {
  return nachtVorgabenAus(planungJetzt());
}


function crewHinweisNachtfahrt(): string | null {
  if (!app.crewFunktionen || nachtfahrtCrewReicht(app.crewFunktionen)) return null;
  if (!letzteAntwort?.ergebnis.etappen.some((e) => e.istNachtschlag)) return null;
  const wachfaehige = app.crewFunktionen.filter(istWachfaehig).length;
  return wort('automatik.crewNichtWachfaehig', { n: String(wachfaehige) });
}


let grenzHinweis: string | null = null;

let freieRundeHinweis: string | null = null;



const RECHNUNG_LAEUFT_KEY = 'sail-suite:vp-rechnung-laeuft';
let wachsperre: WakeLockSentinel | null = null;
let rechnungLaeuft = false;

async function wachsperreHolen(): Promise<void> {
  if (!rechnungLaeuft || !('wakeLock' in navigator)) return;
  if (wachsperre && !wachsperre.released) return;
  try {
    wachsperre = await navigator.wakeLock.request('screen');
  } catch {
    wachsperre = null; 
  }
}

function wachsperreFreigeben(): void {
  const sperre = wachsperre;
  wachsperre = null;
  if (sperre && !sperre.released) void sperre.release().catch(() => {});
}

function merkeRechnungLaeuft(an: boolean): void {
  try {
    if (an) localStorage.setItem(RECHNUNG_LAEUFT_KEY, String(Date.now()));
    else localStorage.removeItem(RECHNUNG_LAEUFT_KEY);
  } catch {  }
}


function letzteRechnungUnterbrochen(): boolean {
  try {
    const marke = localStorage.getItem(RECHNUNG_LAEUFT_KEY);
    if (!marke) return false;
    localStorage.removeItem(RECHNUNG_LAEUFT_KEY);
    return true;
  } catch {
    return false;
  }
}


export function setzeFortschritt(anteil: number | null): void {
  const rahmen = $('vp-fortschritt');
  const balken = $('vp-fortschritt-balken');
  if (!rahmen || !balken) return;
  rahmen.classList.toggle('vp-fortschritt-offen', anteil == null);
  balken.style.width = anteil == null ? '' : `${Math.round(Math.min(1, Math.max(0, anteil)) * 100)}%`;
}


function fortschrittText(f: RechnerFortschritt): string {
  const n = String(f.erledigt ?? 0), m = String(f.gesamt ?? 0);
  if (f.phase === 'wetter') return f.gesamt ? wort('automatik.fortschrittWetter', { n, m }) : wort('automatik.rechnet');
  if (f.phase === 'nachrechnen') return wort('automatik.fortschrittNachrechnen', { n, m });
  if (f.phase === 'suche') return wort('automatik.fortschrittSuche');
  switch (f.schritt) {
    case 'kandidaten': return wort('automatik.schrittKandidaten');
    case 'kueste': return wort('automatik.schrittKueste');
    case 'inseln': return wort('automatik.schrittInseln');
    case 'skipperguide': return wort('automatik.schrittSkipperguide');
    case 'staaten': return wort('automatik.schrittStaaten', { n, m });
    case 'ensemble': return wort('automatik.schrittEnsemble');
    case 'gitter': return wort('automatik.schrittGitter');
    case 'tageslicht': return wort('automatik.schrittTageslicht', { n, m });
    case 'netz': return wort('automatik.schrittNetz', {
      k: String(f.knoten ?? 0), e: String(f.kanten ?? 0), min: String(Math.round((f.zeitbudgetMs ?? 0) / 60_000)),
    });
    default: return wort('automatik.rechnet');
  }
}


function empfehlungsSatz(e: OptionsEmpfehlung, namen: readonly [string, string]): string {
  const sp = aktuelleSprache();
  if (e.art === 'heimfahrtMitWind') {
    const i = e.option, j = 1 - i;
    return wort('empfehlung.heimfahrt', {
      name: namen[i]!, andere: namen[j]!, tag: String(e.abTag),
      richtung: richtungsName(e.heimwind.richtungDeg, sp), kn: nf(e.heimwind.kn, 0, sp),
      gegenan: nf(e.gegenanSm[i]!, 0, sp), heim: nf(e.heimSm[i]!, 0, sp),
      gegenanAndere: nf(e.gegenanSm[j]!, 0, sp), heimAndere: nf(e.heimSm[j]!, 0, sp),
    });
  }
  const hw = e.heimwind;
  const windSatz = wort(`empfehlung.wind.${e.windGrund}`, hw
    ? { kn: nf(hw.kn, 0, sp), richtung: richtungsName(hw.richtungDeg, sp) } : { kn: '–', richtung: '–' });
  if (e.art === 'segelanteil') {
    const i = e.option, j = 1 - i;
    return [wort('empfehlung.segel', {
      name: namen[i]!, prozent: nf(e.segelProzent[i]!, 0, sp), prozentAndere: nf(e.segelProzent[j]!, 0, sp),
    }), windSatz].join(' ');
  }
  return [wort('empfehlung.gleich'), windSatz].join(' ');
}


function zeigeOptionenHinweis(
  namen: readonly [string, string] | null, ep?: Entscheidungspunkt, empfehlung?: OptionsEmpfehlung | null,
  
  route2?: string | null,
): void {
  const satz = namen && empfehlung ? empfehlungsSatz(empfehlung, namen) : '';
  const imVergleich = $('vp-vergleich-empfehlung');
  if (imVergleich) { imVergleich.textContent = satz; imVergleich.hidden = !satz; }
  const el = $('vp-optionen-hinweis');
  if (!el) return;
  el.hidden = !namen;
  if (!namen) { el.textContent = ''; return; }
  const gewaehlt = gewaehlteOption === OPTION_SCHLUESSEL_1 ? namen[0]
    : gewaehlteOption === OPTION_SCHLUESSEL_2 ? namen[1] : null;
  el.textContent = [
    route2
      ? wort('automatik.optionenHinweisRoute', { eins: namen[0], zwei: namen[1], route: route2 })
      : wort('automatik.optionenHinweis', { eins: namen[0], zwei: namen[1] }),
    satz,
    ep != null ? entscheidungspunktText(ep, aktuelleSprache()) : '',
    gewaehlt ? wort('automatik.optionGewaehlt', { name: gewaehlt }) : '',
  ].filter(Boolean).join(' ');
}


function ankunftsDatum(ergebnis: WochenplanErgebnis | null, von: string): string | null {
  const tag = ergebnis?.etappen[ergebnis.etappen.length - 1]?.tag;
  if (tag == null) return null;
  const d = new Date(`${von}T12:00:00`);
  d.setDate(d.getDate() + tag - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


function ankunftsSatz(ergebnis: WochenplanErgebnis | null, datum: string): string {
  const tag = ergebnis?.etappen[ergebnis.etappen.length - 1]?.tag ?? 0;
  const [, m, d] = datum.split('-');
  return wort('automatik.ankunftUeberstellung', {
    ziel: app.toern?.rueckgabe_hafen?.name ?? '', datum: `${d}.${m}.`, tag: String(tag),
  });
}


function keinPlanSatz(grund: KeinPlanGrund): string {
  const { schluessel, werte } = keinPlanTextSchluessel(grund);
  const lockerung = lockerungTextSchluessel(grund);
  return [
    wort(schluessel, werte),
    lockerung ? wort(lockerung.schluessel, lockerung.werte) : '',
    ...(lockerung?.weitere ?? []).map((s) => wort(s, lockerung!.werte)),
  ].filter(Boolean).join(' ');
}


function setzeAutomatikStatus(text: string): void {
  const status = $('vp-automatik-status');
  if (!status) return;
  const bericht = app.letzterBericht;
  const ohneWetter = bericht ? ohneWetterTextSchluessel(bericht) : null;
  const ohneKueste = bericht ? kuesteUnbekanntTextSchluessel(bericht) : null;
  const kuesteRueckfall = bericht ? kuesteRueckfallTextSchluessel(bericht) : null;
  const haefenTeilpaket = bericht ? haefenTeilpaketTextSchluessel(bericht) : null;
  const haefenUnbekannt = bericht ? haefenUnbekanntTextSchluessel(bericht) : null;
  const zeitbudget = bericht ? zeitbudgetTextSchluessel(bericht) : null;
  const gedeckelt = bericht ? netzGedeckeltTextSchluessel(bericht) : null;
  const teile = [
    text,
    freieRundeHinweis,
    crewHinweisNachtfahrt(),
    zeitbudget ? wort(zeitbudget.schluessel, zeitbudget.werte) : null,
    bericht?.nachrechnungUebersprungen ? wort('automatik.nachrechnungUebersprungen') : null,
    
    gedeckelt && !freieRundeHinweis ? wort(gedeckelt.schluessel, gedeckelt.werte) : null,
    ohneWetter ? wort(ohneWetter.schluessel, ohneWetter.werte) : null,
    ohneKueste ? wort(ohneKueste) : null,
    kuesteRueckfall ? wort(kuesteRueckfall) : null,
    haefenTeilpaket ? wort(haefenTeilpaket) : null,
    haefenUnbekannt ? wort(haefenUnbekannt) : null,
    grenzHinweis,
  ].filter((t): t is string => t != null);
  status.textContent = teile.join(' ');
}



const WOCHE_REITER = ['auto', 'hand', 'optionen'] as const;

export function zeigeWochenReiter(aktiv: typeof WOCHE_REITER[number]): void {
  for (const name of WOCHE_REITER) {
    const knopf = $(`tab-woche-${name}`);
    const feld = $(`panel-woche-${name}`);
    knopf?.setAttribute('aria-selected', String(name === aktiv));
    if (feld) feld.hidden = name !== aktiv;
  }
  const vorher = imVergleichsReiter;
  imVergleichsReiter = aktiv === 'optionen';
  if (vorher !== imVergleichsReiter) zeichneOptionenAufKarte(false);
}


let imVergleichsReiter = false;

let kartenOptionImVergleich = 0;


function zeichneOptionenAufKarte(ausschnittAnpassen: boolean): void {
  const antwort = letzteAntwort;
  if (!planEbenen || !antwort) return;
  const ziehOptional = !app.nurLesen ? { aufZiehen: beiEtappeZiehen } : {};
  const beide = antwort.optionen ?? [];
  let gezeigt: WochenplanErgebnis | null = antwort.ergebnis;
  if (beide.length > 1) {
    const i = imVergleichsReiter ? kartenOptionImVergleich : (beide[0]?.ergebnis ? 0 : 1);
    gezeigt = beide[i]?.ergebnis ?? null;
  }
  if (gezeigt) zeichnePlaene(planEbenen, [{ ergebnis: gezeigt, netz: antwort.netz, ...ziehOptional }]);
  else planEbenen.clearLayers();
  if (ausschnittAnpassen && karte && gezeigt) passeAusschnittAn(karte, planEbenen);
}


function zeigeOptionAufKarte(i: 0 | 1): void {
  kartenOptionImVergleich = i;
  for (const [n, id] of [[0, 'btn-option-karte-1'], [1, 'btn-option-karte-2']] as const) {
    $(id)?.setAttribute('aria-pressed', String(n === i));
  }
  zeichneOptionenAufKarte(true);
  
  const k = $('vp-karte');
  if (k) {
    const r = k.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) k.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}


function zeigeOptionsSpalten(
  spalten: readonly { name: string; html: string }[] | null,
): void {
  const raster = $('vp-optionen-raster');
  const details = $('vp-option2-details') as HTMLDetailsElement | null;
  if (raster) raster.hidden = !spalten;
  if (details) details.open = !spalten;
  if (!spalten) return;
  spalten.forEach((s, i) => {
    const titel = $(`vp-option-titel-${i + 1}`);
    const tage = $(`vp-option-tage-${i + 1}`);
    if (titel) titel.textContent = s.name;
    if (tage) tage.innerHTML = s.html;
  });
  for (const [n, id] of [[0, 'btn-option-karte-1'], [1, 'btn-option-karte-2']] as const) {
    $(id)?.setAttribute('aria-pressed', String(n === kartenOptionImVergleich));
  }
}




function alsGespeicherteZeilen(etappen: readonly EtappeDaten[], startIso: string | null = null): GespeicherteEtappenZeile[] {
  return etappen.map((e, i) => {
    const erster = e.wegpunkte[0], letzter = e.wegpunkte[e.wegpunkte.length - 1];
    const istHafentag = e.wegpunkte.length < 2;
    return {
      tag: i + 1,
      datum: istHafentag ? e.datum : gespeicherterAblegetag(e.datum, i > 0 ? etappen[i - 1]!.datum : vortag(startIso)),
      vonName: e.von_name ?? '',
      nachName: e.nach_name ?? '',
      istHafentag,
      sm: !istHafentag && erster && letzter
        ? distNM(erster.lat, erster.lon, letzter.lat, letzter.lon) : null,
      
      von: istHafentag ? null : erster ?? null,
      nach: istHafentag ? null : letzter ?? null,
      wegpunkte: istHafentag ? [] : e.wegpunkte.map((p) => ({ lat: p.lat, lon: p.lon })),
    };
  });
}



let neuZeichnen: (() => void) | null = null;
export function automatikNeuZeichnen(): void { neuZeichnen?.(); }

export async function zeigeGespeicherteAutomatik(token: string, toernId: string): Promise<void> {
  neuZeichnen = () => { void zeigeGespeicherteAutomatik(token, toernId); };
  const vorhandene = await holeOptionen(token, toernId);
  const automatik = AUTOMATIK_SCHLUESSEL.filter((s) => vorhandene.includes(s));
  if (automatik.length === 0) return;
  
  
  
  
  
  if (!automatik.includes(OPTION_SCHLUESSEL_1)) renderGespeichertenWochenplan([], aktuelleSprache());

  const namen: [string, string] = [wort('automatik.optionEins'), wort('automatik.optionZwei')];
  let aufDieKarte: EtappeDaten[] | null = null;
  for (const schluessel of automatik) {
    const etappen = await holeEtappen(token, toernId, schluessel);
    if (!etappen || etappen.length === 0) continue;
    
    
    if (!aufDieKarte || etappen[0]?.gewaehlt) aufDieKarte = etappen;
    const istZweite = schluessel === OPTION_SCHLUESSEL_2;
    
    
    
    
    const eigenerName = eigenerOptionsName(etappen[0]?.anzeigename);
    if (etappen[0]?.gewaehlt) { gewaehlteOption = schluessel; zeigeOptionsWahl(); }
    const label = istZweite
      ? (eigenerName ?? wort('automatik.optionZwei'))
      : (automatik.length > 1 ? (eigenerName ?? wort('automatik.optionEins')) : undefined);
    if (label) namen[istZweite ? 1 : 0] = label;
    if (istZweite) {
      
      setzeZweiteOptionSichtbarkeit(true);
      const box2 = $('vp-woche-automatisch-2');
      if (box2) box2.hidden = false;
    }
    renderGespeichertenWochenplan(
      alsGespeicherteZeilen(etappen, app.toern?.von ?? null), aktuelleSprache(),
      istZweite
        ? { boxId: 'vp-woche-automatisch-2', label: label!, istOption: true }
        : (label ? { label } : {}),
    );
  }
  if (aufDieKarte && planEbenen && !letzteAntwort) {
    const fahrten = aufDieKarte.map((e, i) => ({ e, tag: i + 1 })).filter((x) => x.e.wegpunkte.length >= 2);
    zeichneUeberstellung(
      planEbenen,
      fahrten.map(({ e, tag }) => ({ punkte: e.wegpunkte, tag, titel: `${e.von_name ?? ''} → ${e.nach_name ?? ''}` })),
      fahrten.map(({ e, tag }) => ({ ort: e.wegpunkte[e.wegpunkte.length - 1]!, text: String(tag), tag, titel: `${tag}: ${e.nach_name ?? ''}` })),
    );
    if (karte) passeAusschnittAn(karte, planEbenen);
  }
  
  
  zeigeOptionenHinweis(automatik.includes(OPTION_SCHLUESSEL_1) && automatik.includes(OPTION_SCHLUESSEL_2) ? namen : null);
}



function versteckeWochenbriefingAktionen(): void {
  const box = $('vp-briefing-aktionen');
  if (box) box.hidden = true;
}


async function holeRevierwetterFuerErstenFahrtag(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz, startDatumIso: string,
): Promise<string | null> {
  if (!app.toern) return null;
  const ersterFahrtag = ergebnis.etappen.find((e) => !e.istHafentag);
  if (!ersterFahrtag) return null;
  const von = netz.knoten[ersterFahrtag.vonIndex]?.ort;
  const nach = netz.knoten[ersterFahrtag.nachIndex]?.ort;
  if (!von || !nach) return null;
  const startDatum = new Date(`${startDatumIso}T00:00:00`);
  const datum = new Date(startDatum.getFullYear(), startDatum.getMonth(), startDatum.getDate() + ablegeTag(ersterFahrtag) - 1);
  return holeRevierwetterAusblick(
    von, nach, datumIso(datum), standardSchiffConfig(app.toern), planungJetzt().grenzwerte,
    'buergerlich', 30, 1, aktuelleSprache(),
  );
}


async function zeigeWochenbriefingAktionen(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz, begruendung: Begruendungsspur | null, startDatumIso: string,
): Promise<void> {
  const box = $('vp-briefing-aktionen');
  if (!box || !app.toern) return;
  const sprache = aktuelleSprache();
  const revierwetterText = await holeRevierwetterFuerErstenFahrtag(ergebnis, netz, startDatumIso);
  const abschnitte = wochenBriefingAbschnitte(
    ergebnis, netz, planKennzahlen(ergebnis), begruendung, sprache, revierwetterText,
  );
  const titelEl = $('brief-titel');
  if (titelEl) {
    titelEl.textContent = sprache === 'en'
      ? `${app.toern.name}: Voyage plan` : `${app.toern.name}: Törnplan`;
  }
  box.hidden = false;
  
  
  
  const startDatum = nDate(`${startDatumIso}T00:00:00`);
  initVorlesen(abschnitte);
  initShare(abschnitte);
  initPdf(abschnitte, startDatum, null);
  initServerTeilen(abschnitte, startDatum, 'voyageplan');
}



function liesOptionsname2(): string {
  const input = $('in-options-name-2') as HTMLInputElement | null;
  
  
  return input?.value.trim() || wort('automatik.optionZwei');
}


export async function planVorschlagenKlick(kontextUeberschreibung?: WunschlisteKontext): Promise<void> {
  letzterKontext = kontextUeberschreibung;
  
  await rahmenGespeichert();
  if (!app.toern) return;
  
  
  letzteAntwort = null;
  planEbenen?.clearLayers();
  
  if (!kontextUeberschreibung && planungJetzt().planungsart === 'ueberstellung') {
    renderOptionenVergleich(null, aktuelleSprache());
    zeigeOptionenHinweis(null);
    await ueberstellungVorschlagen(karte, planEbenen);
    return;
  }
  const status = $('vp-automatik-status');
  const zustand1 = wunschlisteEins.liesZustand();
  const zustand2 = wunschlisteZwei.liesZustand();
  const wkontext = kontextUeberschreibung ?? wunschlisteKontext();
  const eingabe = baueMachbarkeitEingabe(zustand1.wunschziele, zustand1.endziel, wkontext, zustand1.obergrenzeSm);
  if (!eingabe) {
    if (status) status.textContent = wort(fehlendeEingabeSchluessel(wkontext));
    return;
  }
  
  
  
  
  
  freieRundeHinweis = hatEtwasZuPlanen(zustand1.wunschziele, zustand1.endziel)
    ? null : wort('automatik.freieRunde', { r: String(planungJetzt().regelmassSm) });

  const vorpruefung = pruefeMachbarkeit(eingabe);
  if (vorpruefung.befund === 'gehtNicht') {
    
    
    if (status) status.textContent = wort('wunschliste.gehtNicht', { n: String(vorpruefung.grund?.fehlendeTage ?? 0) });
    return;
  }

  const knopf = $('btn-plan-vorschlagen') as HTMLButtonElement | null;
  const box = $('vp-woche-automatisch');
  const ladeanzeige = $('vp-lade-anzeige');
  if (knopf) knopf.disabled = true;
  if (box) box.setAttribute('aria-busy', 'true');
  setzeFortschritt(null);
  if (ladeanzeige) ladeanzeige.hidden = false;
  if (status) status.textContent = wort('automatik.rechnet');
  
  rechnungLaeuft = true;
  merkeRechnungLaeuft(true);
  void wachsperreHolen();
  app.letzterBericht = null;
  grenzHinweis = null;
  const toern = app.toern;

  try {
    const zweiteOption: OptionWunsch | null = zweiteOptionAktiv
      ? { name: liesOptionsname2(), wunschziele: [...zustand2.wunschziele], endziel: zustand2.endziel }
      : null;
    const uebernahme = uebernahmeZeitpunkt(wkontext!.toern);
    
    const offenesEnde = istOffeneUeberstellung(wkontext!.toern);
    const rueckgabe = offenesEnde ? null : rueckgabeZeitpunkt(wkontext!.toern);
    const planung = planungJetzt();
    const anfrage: RechnerAnfrage = {
      start: { ort: wkontext!.start!, name: wkontext!.startName },
      
      rueckgabehafen: rueckgabehafenFuerRechner() ?? (offenesEnde ? null : starthafenAlsZiel(wkontext!.start)),
      ...(uebernahme ? { uebernahmeIso: naiveIso(uebernahme) } : {}),
      ...(rueckgabe ? { rueckgabeIso: naiveIso(rueckgabe) } : {}),
      ohneUmkehrpunkt: ohneUmkehrpunktFuerToern(),
      ...(offenesEnde ? { offenesEnde: true } : {}),
      
      
      
      fixierungen: (() => {
        
        
        const versatz = app.toern?.von && wkontext!.toern.von
          ? Math.round((Date.parse(`${wkontext!.toern.von}T00:00:00Z`) - Date.parse(`${app.toern.von}T00:00:00Z`)) / 86_400_000) : 0;
        const ausPlan = liesPlanFixierungen().map((f) => ({ ...f, tag: f.tag - versatz })).filter((f) => f.tag >= 1);
        const tage = new Set(ausPlan.map((f) => f.tag));
        return [...fixierungenFuerRechner(wkontext!.toern.von!).filter((f) => !tage.has(f.tag)), ...ausPlan];
      })(),
      wunschziele: [...zustand1.wunschziele],
      endziel: zustand1.endziel,
      ...(zweiteOption ? { zweiteOption } : {}),
      gesamtFahrtage: eingabe.verfuegbareFahrtage,
      startDatumIso: wkontext!.toern.von!,
      cfg: wkontext!.cfg,
      limits: planung.grenzwerte,
      obergrenzeSm: zustand1.obergrenzeSm,
      maxStundenProTag: eingabe.maxStundenProTag,
      sprache: aktuelleSprache(),
      nachtVorgaben: nachtVorgabenFuerToern(),
      planung,
      ruhetagIndizes: zustand1.wunschziele
        .map((w, i) => (w.art === 'ruhetag' ? i : -1)).filter((i) => i >= 0),
      ...(zweiteOption ? {
        zweiteOptionRuhetagIndizes: zustand2.wunschziele
          .map((w, i) => (w.art === 'ruhetag' ? i : -1)).filter((i) => i >= 0),
      } : {}),
    };
    const abbrechen = $('btn-plan-abbrechen');
    if (abbrechen) abbrechen.hidden = false;
    const antwort = await schlagePlanVor(anfrage, (f) => {
      
      
      
      if (status) status.textContent = fortschrittText(f);
      setzeFortschritt(f.gesamt ? (f.erledigt ?? 0) / f.gesamt : null);
    });
    if (abbrechen) abbrechen.hidden = true;

    if (antwort.lage === 'abgebrochen') {
      if (status) status.textContent = wort('automatik.abgebrochen');
      return;
    }
    
    
    app.letzterBericht = antwort.lage === 'fehler' ? null : antwort.bericht;

    if (antwort.lage === 'fehler') {
      letzteAntwort = null; 
      setzeAutomatikStatus(wort('automatik.fehler', { text: antwort.text }));
      versteckeWochenbriefingAktionen();
      return;
    }
    if (antwort.lage === 'keinPlanGefunden') {
      letzteAntwort = null; 
      
      setzeAutomatikStatus(keinPlanSatz(antwort.grund));
      
      const hinweis = wort('automatik.keinPlanBox');
      renderAutomatischenWochenplan(null, null, [], aktuelleSprache(), null, { hinweis });
      if (zweiteOptionAktiv) renderAutomatischenWochenplan(null, null, [], aktuelleSprache(), null, { boxId: 'vp-woche-automatisch-2', istOption: true, hinweis });
      renderOptionenVergleich(null, aktuelleSprache());
      zeigeOptionsSpalten(null);
      zeigeOptionenHinweis(null);
      versteckeWochenbriefingAktionen();
      return;
    }

    
    
    const planStart = new Date(`${wkontext!.toern.von!}T00:00:00`);
    const planTagDatum = (tag: number): Date =>
      new Date(planStart.getFullYear(), planStart.getMonth(), planStart.getDate() + tag - 1);

    letzteAntwort = antwort;
    gewaehlteOption = null;
    planLauf += 1;
    planLaufStartIso = wkontext!.toern.von!;
    const inHandplan = $('btn-vorschlag-in-handplan');
    if (inHandplan) inHandplan.hidden = app.nurLesen;
    kartenOptionImVergleich = antwort.optionen?.[0]?.ergebnis ? 0 : 1;
    zeigeOptionsWahl();
    const eingriff = !app.nurLesen;
    const skipperGuide = new Map((antwort.skipperGuide ?? []).map((z) => [z.knotenIndex, z] as const));
    const indizes1 = wunschzielIndizes(zustand1.wunschziele, zustand1.endziel);
    const box2 = $('vp-woche-automatisch-2');
    
    
    
    const erstesErgebnis = antwort.optionen?.[0];
    const zweitesErgebnis = antwort.optionen?.[1];
    const indizes2 = zweitesErgebnis ? wunschzielIndizes(zustand2.wunschziele, zustand2.endziel) : [];
    
    const uebernahmeSpaet = Number((app.toern?.uebernahme_zeit ?? '').slice(0, 2)) >= UEBERNAHME_SPAET_AB_UHR
      && (app.toern?.uebernahme_zeit ?? '') !== '';
    
    const motorKn = app.toern ? standardSchiffConfig(app.toern).motorSpeed : 6;
    const tank = app.toern ? tankVorschlag(app.toern, motorKn) : null;
    const kraftstoff = tank ? { angabe: tank.angabe, motorKn } : null;
    
    const zeichnePlan = (sp: Sprache): void => {
      renderAutomatischenWochenplan(
        erstesErgebnis ? erstesErgebnis.ergebnis : antwort.ergebnis, antwort.netz, indizes1, sp,
        erstesErgebnis ? erstesErgebnis.begruendung : antwort.begruendung,
        {
          ...(erstesErgebnis ? { label: erstesErgebnis.name, istOption: true } : {}),
          ...(erstesErgebnis?.keinPlanGrund ? { hinweis: keinPlanSatz(erstesErgebnis.keinPlanGrund) } : {}),
          umkehrpunkt: erstesErgebnis ? erstesErgebnis.umkehrpunkt : antwort.umkehrpunkt,
          datumFuerTag: planTagDatum, eingriff, skipperGuide,
          reserveTage: planungJetzt().reserveTage, uebernahmeSpaet, kraftstoff,
        },
      );
      if (zweitesErgebnis) {
        if (box2) box2.hidden = false;
        renderAutomatischenWochenplan(
          zweitesErgebnis.ergebnis, antwort.netz, indizes2, sp, zweitesErgebnis.begruendung,
          {
            boxId: 'vp-woche-automatisch-2', label: zweitesErgebnis.name, istOption: true,
            ...(zweitesErgebnis.keinPlanGrund ? { hinweis: keinPlanSatz(zweitesErgebnis.keinPlanGrund) } : {}),
            umkehrpunkt: zweitesErgebnis.umkehrpunkt, datumFuerTag: planTagDatum, eingriff, skipperGuide,
            reserveTage: planungJetzt().reserveTage, uebernahmeSpaet, kraftstoff,
          },
        );
      } else if (box2) {
        box2.hidden = true;
        box2.innerHTML = '';
      }
      const tagesziele = (antwort.optionen ?? []).map((o) => tageszieleText(o.ergebnis, antwort.netz));
      renderOptionenVergleich(antwort.vergleich ?? null, sp);
      const zielAnzeige = { datumFuerTag: planTagDatum, reserveTage: planungJetzt().reserveTage, uebernahmeSpaet };
      zeigeOptionsSpalten(erstesErgebnis && zweitesErgebnis ? [
        { name: erstesErgebnis.name, html: optionsSpalteHtml(erstesErgebnis.ergebnis, antwort.netz, indizes1, sp, {
          ...zielAnzeige, ...(erstesErgebnis.keinPlanGrund ? { hinweis: keinPlanSatz(erstesErgebnis.keinPlanGrund) } : {}) }) },
        { name: zweitesErgebnis.name, html: optionsSpalteHtml(zweitesErgebnis.ergebnis, antwort.netz, indizes2, sp, {
          ...zielAnzeige, ...(zweitesErgebnis.keinPlanGrund ? { hinweis: keinPlanSatz(zweitesErgebnis.keinPlanGrund) } : {}) }) },
      ] : null);
      zeigeOptionenHinweis(
        erstesErgebnis && zweitesErgebnis ? [erstesErgebnis.name, zweitesErgebnis.name] : null,
        antwort.vergleich?.entscheidungspunkt,
        antwort.vergleich?.empfehlung ?? null,
        tagesziele[1] ?? null,
      );
    };
    zeichnePlan(aktuelleSprache());
    neuZeichnen = () => zeichnePlan(aktuelleSprache());
    await zeigeWochenbriefingAktionen(antwort.ergebnis, antwort.netz, antwort.begruendung, wkontext!.toern.von!);
    
    const sprache = aktuelleSprache();
    const poiHinweise = (antwort.poiBasen ?? []).map((b) => {
      const werte = { poi: b.poi, basis: b.basis, tag: b.tag != null ? String(b.tag) : '–', sm: nf(b.smJeWeg, 1, sprache) };
      const satz = !b.wetter ? wort('automatik.poiBasis', werte) : wort('automatik.poiBasisWetter', {
        ...werte, wind: nf(b.wetter.windKn, 0, sprache), boe: nf(b.wetter.boeKn, 0, sprache),
        richtung: b.wetter.richtungDeg != null ? ` ${sprache === 'en' ? 'from' : 'aus'} ${richtungsName(b.wetter.richtungDeg, sprache)}` : '',
      });
      
      
      
      if (!b.oeffnungszeiten) return satz;
      const quelle = b.oeffnungszeiten.quelle ? wort('automatik.poiOeffnungszeitenQuelle', { name: b.oeffnungszeiten.quelle }) : '';
      const oeffnungsSatz = b.oeffnungszeiten.urteil.urteil === 'ganztag'
        ? wort('automatik.poiOeffnungszeitenGanztag', { quelle })
        : b.oeffnungszeiten.urteil.urteil === 'zu'
          ? wort('automatik.poiOeffnungszeitenZu', { quelle })
          : wort('automatik.poiOeffnungszeitenTeilweise', { intervalle: b.oeffnungszeiten.urteil.intervalle.join(', '), quelle });
      return `${satz} ${oeffnungsSatz}`;
    });
    grenzHinweis = antwort.grenzuebertritte?.length
      ? wort('automatik.grenzuebertritt', {
        liste: antwort.grenzuebertritte.map((g) => `${wort('rollierend.tag', { n: String(g.tag) })} ${g.vonName} → ${g.nachName}`).join('; '),
      })
      : null;
    
    
    if (poiHinweise.length > 0) grenzHinweis = [grenzHinweis, ...poiHinweise].filter(Boolean).join(' ');
    
    const ersatzHinweise = (antwort.zufahrtErsatz ?? []).map((z) => wort('automatik.zufahrtErsatz', {
      wunsch: z.wunsch, basis: z.basis, sm: nf(z.sm, 1, sprache),
    }));
    if (ersatzHinweise.length > 0) grenzHinweis = [grenzHinweis, ...ersatzHinweise].filter(Boolean).join(' ');
    
    
    const tagWort = (n: number) => wort('rollierend.tag', { n: String(n) });
    const wetterHinweise = [
      ...(antwort.abwetterOhneWunsch ? [wort('automatik.abwetterOhneWunsch', {
        wuensche: antwort.abwetterOhneWunsch.wuensche.join(', '),
        tage: antwort.abwetterOhneWunsch.tage.map(tagWort).join(', '),
      })] : []),
      ...(antwort.wetterHafentage ?? []).map((w) => wort('automatik.wetterHafentag', {
        tag: tagWort(w.tag), ort: w.ort,
        wind: w.windKn != null && w.boeKn != null && w.windDeg != null
          ? wort('automatik.wetterWind', { richtung: kursGrad(w.windDeg), wind: String(w.windKn), boe: String(w.boeKn) }) : '',
        schutz: w.schutz === 'revier' ? wort('automatik.wetterSchutzRevier')
          : w.schutz === 'geschuetzt' ? wort('automatik.wetterSchutzGeschuetzt')
            : w.schutz === 'teilweise' ? wort('automatik.wetterSchutzTeilweise')
              : w.schutz === 'offen' ? wort('automatik.wetterSchutzOffen') : '',
      }).replace(' ()', '')),
    ];
    if (wetterHinweise.length > 0) grenzHinweis = [grenzHinweis, ...wetterHinweise].filter(Boolean).join(' ');

    
    zeichneOptionenAufKarte(true);

    const token = liesSitzungsToken();
    if (antwort.fixierungBrichtUmkehrpunkt) {
      
      setzeAutomatikStatus(wort('automatik.fixierungBricht'));
    } else if (app.nurLesen) {
      
      
      const ankunft = offenesEnde ? ankunftsDatum(antwort.ergebnis, wkontext!.toern.von!) : null;
      setzeAutomatikStatus([wort('automatik.nurAngezeigt'), ankunft ? ankunftsSatz(antwort.ergebnis, ankunft) : ''].filter(Boolean).join(' '));
    } else if (token) {
      if (status) status.textContent = wort('automatik.speichertGerade');
      const startDatum = new Date(`${wkontext!.toern.von!}T00:00:00`);
      
      
      
      const zuSpeichern = antwort.optionen
        ? antwort.optionen.map((o) => ({ schluessel: o.schluessel, name: o.name as string | null, ergebnis: o.ergebnis }))
        : [{ schluessel: OPTION_SCHLUESSEL_1, name: null, ergebnis: antwort.ergebnis },
          { schluessel: OPTION_SCHLUESSEL_2, name: null, ergebnis: null }];
      let ok = true;
      for (const o of zuSpeichern) {
        if (o.ergebnis) {
          ok = (await speicherePlanAlsEtappen(token, toern.id, o.ergebnis, antwort.netz, startDatum, o.schluessel, o.name)) && ok;
        } else {
          await loescheOption(token, toern.id, o.schluessel);
        }
      }
      
      
      
      const ankunft = offenesEnde ? ankunftsDatum(antwort.ergebnis, wkontext!.toern.von!) : null;
      if (ok && ankunft && toern.bis !== ankunft) {
        ok = await schreibeAnkunftAlsBis(token, ankunft);
      }
      setzeAutomatikStatus([
        wort(ok ? 'automatik.gespeichert' : 'automatik.speicherFehler'),
        ankunft ? ankunftsSatz(antwort.ergebnis, ankunft) : '',
      ].filter(Boolean).join(' '));
    } else if (status) {
      status.textContent = '';
    }
  } finally {
    rechnungLaeuft = false;
    merkeRechnungLaeuft(false);
    wachsperreFreigeben();
    if (knopf) knopf.disabled = false;
    if (box) box.removeAttribute('aria-busy');
    if (ladeanzeige) ladeanzeige.hidden = true;
  }
}




function fixiereUndRechne(tag: number, ort: Punkt, name: string): void {
  const kontext = letzterKontext;
  const versatz = kontext?.toern.von && app.toern?.von
    ? Math.round((Date.parse(`${kontext.toern.von}T00:00:00Z`) - Date.parse(`${app.toern.von}T00:00:00Z`)) / 86_400_000) : 0;
  void legeTagFest({ tag: tag + versatz, ort, name }).then(() => planVorschlagenKlick(kontext));
}


function beiEingriff(ev: Event): void {
  const ziel = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-aktion]');
  if (!ziel || !letzteAntwort || app.nurLesen) return;
  const tag = Number(ziel.dataset.tag);
  let knoten = Number(ziel.dataset.knoten);
  if (ziel.dataset.aktion === 'umlegen') {
    const auswahl = ziel.parentElement?.querySelector<HTMLSelectElement>('select.vp-eingriff-auswahl');
    knoten = Number(auswahl?.value);
  }
  const ort = letzteAntwort.netz.knoten[knoten];
  if (!Number.isInteger(tag) || !ort) return;
  fixiereUndRechne(tag, ort.ort, ort.name);
}


function beiEtappeZiehen(tag: number, punkt: Punkt): void {
  if (!letzteAntwort || app.nurLesen) return;
  const knotenIndex = naechsterVerbundenerKnoten(letzteAntwort.netz, punkt);
  const ort = knotenIndex != null ? letzteAntwort.netz.knoten[knotenIndex] : null;
  if (!ort) return;
  fixiereUndRechne(tag, ort.ort, ort.name);
}

function zeigeOptionsWahl(): void {
  for (const [id, schluessel] of [['btn-option-waehlen-1', OPTION_SCHLUESSEL_1], ['btn-option-waehlen-2', OPTION_SCHLUESSEL_2]] as const) {
    const knopf = $(id) as HTMLButtonElement | null;
    if (!knopf) continue;
    knopf.setAttribute('aria-pressed', String(gewaehlteOption === schluessel));
    knopf.disabled = app.nurLesen;
  }
}


async function waehleOption(schluessel: string): Promise<void> {
  const token = liesSitzungsToken();
  if (!token || !app.toern || app.nurLesen) return;
  const status = $('vp-automatik-status');
  let ok = true;
  for (const s of [OPTION_SCHLUESSEL_1, OPTION_SCHLUESSEL_2]) {
    const etappen = await holeEtappen(token, app.toern.id, s);
    if (!etappen || etappen.length === 0) continue;
    ok = await schreibeEtappen(token, app.toern.id, etappen.map((e) => ({
      id: e.id, nummer: e.nummer, gewaehlt: s === schluessel, datum: e.datum, vonName: e.von_name,
      nachName: e.nach_name, wegpunkte: e.wegpunkte, fixiert: e.fixiert, notiz: e.notiz,
    })), s, etappen[0]?.anzeigename ?? null) && ok;
  }
  if (!ok) { if (status) status.textContent = wort('automatik.speicherFehler'); return; }
  gewaehlteOption = schluessel;
  zeigeOptionsWahl();
  const index = schluessel === OPTION_SCHLUESSEL_2 ? 1 : 0;
  const antwort = letzteAntwort;
  if (antwort) {
    zeigeOptionAufKarte(index === 1 ? 1 : 0);
    const gewaehlt = (antwort.optionen ?? [])[index];
    
    if (gewaehlt?.ergebnis && app.toern.von) {
      await zeigeWochenbriefingAktionen(gewaehlt.ergebnis, antwort.netz, gewaehlt.begruendung, app.toern.von);
    }
  }
  if (status) status.textContent = wort('automatik.optionGewaehlt', { name: antwort?.optionen?.[index]?.name ?? '' });
}

export function initAutomatik(k: L.Map | null, ebenen: L.LayerGroup | null): void {
  karte = k;
  planEbenen = ebenen;
  $('vp-woche-automatisch')?.addEventListener('click', beiEingriff);
  $('vp-woche-automatisch-2')?.addEventListener('click', beiEingriff);
  $('btn-option-waehlen-1')?.addEventListener('click', () => { void waehleOption(OPTION_SCHLUESSEL_1); });
  $('btn-option-waehlen-2')?.addEventListener('click', () => { void waehleOption(OPTION_SCHLUESSEL_2); });
  $('btn-option-karte-1')?.addEventListener('click', () => zeigeOptionAufKarte(0));
  $('btn-option-karte-2')?.addEventListener('click', () => zeigeOptionAufKarte(1));
  $('btn-zweite-option-umschalten')?.addEventListener('click', () => setzeZweiteOptionSichtbarkeit(true));
  $('btn-zweite-option-entfernen')?.addEventListener('click', () => setzeZweiteOptionSichtbarkeit(false));
  for (const name of WOCHE_REITER) {
    $(`tab-woche-${name}`)?.addEventListener('click', () => zeigeWochenReiter(name));
  }
  $('btn-plan-vorschlagen')?.addEventListener('click', () => { void planVorschlagenKlick(); });
  
  
  
  $('btn-plan-abbrechen')?.addEventListener('click', () => brichPlanVorschlagAb());
  $('btn-plan-abbrechen-2')?.addEventListener('click', () => brichPlanVorschlagAb());
  
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void wachsperreHolen();
  });
  if (letzteRechnungUnterbrochen()) {
    const status = $('vp-automatik-status');
    if (status) status.textContent = wort('automatik.unterbrochen');
  }
}
