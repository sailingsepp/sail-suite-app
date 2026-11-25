import '@/shell/tokens.css';
import './style.css';
import './vollbild.css';

import { setzeAppTexte } from '@/shell/strings';
import { initSprache, aktuelleSprache, sichereSpracheWahl, aufSprachwechsel } from '@/shell/sprache';
import { nf } from '@/core/time';
import { initTheme, sichereThemeWahl } from '@/shell/theme';
import { merktSich, setzeMerktSich } from '@/shell/merken';
import { initTour } from '@/shell/tour';
import { initUserMenu, liesSitzungsToken, liesEigeneNutzerId } from '@/shell/session';
import { initIcons, icon } from '@/shell/icons';
import { initHandbuchModal } from '@/shell/handbuch';
import { initSupport } from '@/shell/support';
import { initKompendium } from '@/shell/kompendium';
import { aktiviereLesestand } from '@/shell/lesestand';
import { initOfflineHinweis } from '@/shell/offlineHinweis';
import { sicheresBriefingFragment } from '@/ui/sicheresHtml';
import { tagesplanungUrl } from '@/core/tagesplanungLink';
import { navUrl } from '@/core/navUebergabe';
import { PLAN_SCHLUESSEL, waehlePlan, planZeile } from './toernplan';
import { initModal } from '@/shell/modal';
import { TITLE, DESCRIPTION, STRINGS, TOUR_STEPS } from './strings';
import {
  holeToerne, holeToern, legeToernAn, aendereToern, archiviereToern, loescheToern, holeKontoSpeicher,
  holeCrew, legePlatzhalterAn, erzeugeEinladung, aendereMitglied, schreibeAnlage9,
  holeEinladungsVorschau, loeseEinladungEin, holeBriefings, holeEtappen, holeEigenesProfil,
  aktiviereToern, deaktiviereToern, sendeCrewNachricht, entferneMitglied,
  schiffFotoUrl, ladeSchiffFotoHoch, loescheSchiffFoto,
  type ToernZeile, type ToernFunktion, type CrewEintrag, type ToernHafen,
} from '@/data/toernApi';
import { neueFahrtId } from '@/data/logdb';
import { verkleinere } from '@/data/bild';
import { oeffneLiegeplatzWahl } from '@/ui/liegeplatzWahl';
import { polareFuerSchiff, type PolarVorschlag } from '@/core/polarwahl';
import { erkenneRevierRechtshinweise } from '@/core/revierRecht';
import { toernRevierText, toernRevierStrecke, startRevierTeil, revierNachgezogen } from '@/core/revierzonen';
import { revierFuerToern, zielrevierFehlt } from '@/data/toernRevier';
import { seeflagge, seeflaggeSvg, normLandcode, landcodeAusRevier, flaggeDesToerns } from '@/core/seeflaggen';
import { ALL_BOATS } from '@/core/boats';
import { YACHTTYPEN, typName, typFinden, type Yachttyp } from '@/core/yachttypen';
import { kraftstoffFuerSchiff } from '@/core/kraftstoff';
import { ladeStatistik } from './statistik';
import { biete, pdfZiel, verwirfZiel } from '@/ui/pdfAnzeige';
import { pdfDateiname } from './dateiname';
import { ladeMotordaten, initMotordaten, sperreTankliste } from './motordaten';
import { initBordkasse, ladeBordkasse, setzeKassenCrew, kassenEingabe, zeichne as zeichneBordkasse } from './bordkasse';
import { initStreamDialog } from './stream';
import { initCrewFotos } from './fotos';
import { initTechnik } from '@/shell/technik';
import { entfernenFrageSchluessel } from './crewEntfernen';
import { fuelleFunktionsAuswahl, leseFunktionsAuswahl, funktionSchluessel, funktionsOptionen, leseAuswahlWert, auswahlWert } from '@/core/crewFunktion';
import { crewblatt, bordkassenblatt } from './pdf';
import type { SchiffDaten, ToernYachtnutzung, GeteiltesBriefing, EtappeDaten } from '@/data/toernApi';
import { setzeTiefgang } from '@/map/seekarte';
import { initUmbau, zeigeReiter, fuelleToerndaten, fuelleEinladung } from './umbau';
import { oeffneKarte, schliesseKarte, offeneKarte, type KartenArt } from './karteBearbeiten';
import { zeitraumText as zeitraumKurz } from '@/core/zeitraum';
import { waehlePolare } from '@/core/polarwahl';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { escapeHtml } from '@/core/html';
import { fehlendeAngaben, nimmtLetztenSkipper, type FehlendeAngabe } from './toernPflicht';
import { lateinisch } from '@/core/umschrift';
import { ladebildGezeichnet, ladebildWeg } from '@/shell/ladebild';

await ladebildGezeichnet();
initIcons();
initUmbau();
setzeAppTexte({ titel: TITLE, beschreibung: DESCRIPTION, strings: STRINGS, tour: TOUR_STEPS });

aktiviereLesestand();
initOfflineHinweis();

initSprache();
initTheme();
initTour();

initUserMenu();
initHandbuchModal();
initSupport('voyagebook');
initKompendium();
initMotordaten();
initBordkasse();

const merkenBox = document.getElementById('in-menu-merken') as HTMLInputElement | null;
if (merkenBox) {
  merkenBox.checked = merktSich();
  merkenBox.addEventListener('change', () => {
    setzeMerktSich(merkenBox.checked);
    if (merkenBox.checked) { sichereSpracheWahl(); sichereThemeWahl(); }
  });
}

function wort(schluessel: string, werte?: Record<string, string>): string {
  let text = STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
  for (const [k, v] of Object.entries(werte ?? {})) text = text.replace(`{${k}}`, v);
  return text;
}

const $ = (id: string) => document.getElementById(id);

const token = liesSitzungsToken();
const params = new URLSearchParams(window.location.search);
const einladungsToken = params.get('einladung');
if (!token && !einladungsToken) {
  window.location.href = `/?login=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

type Ansicht = 'liste' | 'detail' | 'einladung';

const BREIT = window.matchMedia('(min-width: 1100px)');

function zeigeAnsicht(a: Ansicht): void {
  const main = $('vb-main');
  if (main) main.dataset['ansicht'] = a;
  document.body.dataset['ansicht'] = a;
  const liste = $('vb-liste-ansicht');
  const detail = $('vb-detail-ansicht');
  const einladung = $('vb-einladung-ansicht');
  if (liste) liste.hidden = a !== 'liste';
  if (detail) detail.hidden = a !== 'detail';
  if (einladung) einladung.hidden = a !== 'einladung';
}

function markiereInListe(id: string | null): void {
  document.querySelectorAll<HTMLElement>('#vb-toernliste .vb-toern-zeile').forEach((z) => {
    const an = z.dataset['id'] === id;
    z.classList.toggle('vb-gewaehlt', an);
    if (an) z.setAttribute('aria-current', 'true'); else z.removeAttribute('aria-current');
  });
}

async function zeigeSpeicherstand(): Promise<void> {
  const el = $('vb-speicher-hinweis');
  if (!el || !token) return;
  const s = await holeKontoSpeicher(token);
  const sp = aktuelleSprache();
  const gb = (b: number) => nf(b / 1024 ** 3, 1, sp);
  const teile = [
    ...(s && s.belegt >= 0.8 * s.grenze ? [wort('liste.speicher', { belegt: gb(s.belegt), grenze: gb(s.grenze) })] : []),
    ...(s && s.toerne >= 0.8 * s.toerneMax ? [wort('liste.toernZahl', { n: String(s.toerne), max: String(s.toerneMax) })] : []),
  ];
  el.textContent = teile.join(' · ');
  el.hidden = teile.length === 0;
}

async function ladeListe(): Promise<void> {
  const liste = $('vb-toernliste');
  const laedt = $('vb-liste-lädt');
  const leer = $('vb-liste-leer');
  const fehler = $('vb-liste-fehler');
  if (!liste || !token) return;
  if (leer) leer.hidden = true;
  if (fehler) fehler.hidden = true;
  if (laedt) laedt.hidden = liste.childElementCount > 0;

  const toerne = await holeToerne(token);
  if (laedt) laedt.hidden = true;
  void zeigeSpeicherstand();
  liste.innerHTML = '';
  if (toerne === null) {
    if (fehler) fehler.hidden = false;
    return;
  }
  if (toerne.length === 0) {
    if (leer) leer.hidden = false;
    return;
  }
  const offene = toerne.filter((t) => !t.archiviert_am).sort((a, b) => Number(Boolean(b.istAktiv)) - Number(Boolean(a.istAktiv)));
  const archiv = toerne.filter((t) => t.archiviert_am);
  const zeile = (t: ToernZeile): HTMLLIElement => {
    const li = document.createElement('li');
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.dataset['id'] = t.id;
    knopf.className = 'vb-toern-zeile' + (t.archiviert_am ? ' vb-archiviert' : '') + (t.istAktiv ? ' vb-aktiv' : '');
    const marke = t.istAktiv ? 'liste.aktiv' : t.archiviert_am ? 'liste.archiviert' : 'liste.offen';
    const info = [revierText(t), zeitraumText(t)].filter(Boolean).join(' · ');
    knopf.innerHTML = `
      <span class="vb-toern-zeile-kopf">
        <span class="vb-toern-name">${escapeHtml(t.name)}</span>
        <span class="${t.istAktiv ? 'vb-toern-aktiv-abzeichen' : 'vb-toern-marke'}">${escapeHtml(wort(marke))}</span>
      </span>
      ${info ? `<span class="vb-toern-info">${escapeHtml(info)}</span>` : ''}
    `;
    knopf.addEventListener('click', () => { void oeffneDetail(t.id); });
    li.appendChild(knopf);
    return li;
  };
  for (const t of offene) liste.appendChild(zeile(t));
  if (archiv.length) {
    const kopf = document.createElement('li');
    kopf.className = 'vb-listen-trenner';
    kopf.textContent = wort('liste.weitere');
    liste.appendChild(kopf);
    for (const t of archiv) liste.appendChild(zeile(t));
  }
  markiereInListe(aktuellerToern?.id ?? null);

  if (BREIT.matches && !aktuellerToern && $('vb-detail-ansicht')?.hidden) {
    const erster = offene[0] ?? archiv[0];
    if (erster) void oeffneDetail(erster.id);
  }
}

const toernOverlay = $('toern-overlay');
const toernStatus = $('toern-status');
const toernModalEl = $('toern-modal');
const toernModal = toernModalEl ? initModal(toernModalEl, () => schliesseNeuerToern()) : null;

let toernBearbeitenId: string | null = null;

let gewaehlteFotoDatei: File | null = null;

let fotoEntfernenMarkiert = false;

function zeigeFotoVorschau(url: string | null): void {
  const wrap = $('vb-foto-vorschau');
  const img = document.getElementById('vb-foto-bild') as HTMLImageElement | null;
  if (!wrap || !img) return;
  if (!url) {
    wrap.hidden = true;
    img.removeAttribute('src');
    return;
  }

  img.onload = () => { wrap.hidden = false; };
  img.onerror = () => { wrap.hidden = true; };
  img.src = url;
}

function setzeToernFeld(id: string, wert: string | null | undefined): void {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.value = wert ?? '';
}

function feldZahl(n: number | null | undefined): string | undefined {
  if (n == null) return undefined;
  return aktuelleSprache() === 'de' ? String(n).replace('.', ',') : String(n);
}
function leseToernFeld(id: string): string {
  return ((document.getElementById(id) as HTMLInputElement | null)?.value ?? '').trim();
}

const CREW_VORGABE = 0.75;

function crewProzent(x: number): string {
  return `${Math.round(x * 100)} %`;
}

function zeigeCrewErfahrungFelder(sichtbar: boolean): void {
  const feld = $('feld-crew-erfahrung');
  if (feld) feld.hidden = !sichtbar;
}

document.getElementById('in-toern-crew-angeben')?.addEventListener('change', (ev) => {
  zeigeCrewErfahrungFelder((ev.target as HTMLInputElement).checked);
});

for (const [in_, out] of [['in-toern-crewfaktor', 'out-toern-crewfaktor'], ['in-toern-crewzumutbarkeit', 'out-toern-crewzumutbarkeit']] as const) {
  const regler = document.getElementById(in_) as HTMLInputElement | null;
  const anzeige = document.getElementById(out);
  if (regler && anzeige) {
    regler.addEventListener('input', () => { anzeige.textContent = crewProzent(parseFloat(regler.value)); });
  }
}

const SCHIFF_FELDER = [
  'in-toern-schiffsname', 'in-toern-typ', 'in-toern-flagge', 'in-toern-mmsi', 'in-toern-laenge', 'in-toern-breite',
  'in-toern-tiefgang', 'in-toern-verdraengung', 'in-toern-motor', 'in-toern-baujahr',
  'in-toern-verbrauch', 'in-toern-tank',
] as const;

function zahlAus(id: string): number | undefined {
  const roh = leseToernFeld(id);
  const n = Number(roh.replace(',', '.'));
  return roh && Number.isFinite(n) ? n : undefined;
}

function aktuellerVorschlag(): PolarVorschlag | null {
  return polareFuerSchiff({ typ: leseToernFeld('in-toern-typ'), laengeM: zahlAus('in-toern-laenge') });
}

function zeigeKraftstoffVorschlag(): void {
  const k = kraftstoffFuerSchiff({ typ: leseToernFeld('in-toern-typ'), laengeM: zahlAus('in-toern-laenge'), motorPS: zahlAus('in-toern-motor') });
  const sp = aktuelleSprache();
  const zahl = (n: number, d: number): string => n.toLocaleString(sp === 'en' ? 'en-GB' : 'de-AT', { maximumFractionDigits: d });
  const verbrauch = document.getElementById('in-toern-verbrauch') as HTMLInputElement | null;
  const tank = document.getElementById('in-toern-tank') as HTMLInputElement | null;
  if (verbrauch) verbrauch.placeholder = k ? zahl(k.verbrauchLh, 1) : '';
  if (tank) tank.placeholder = k ? zahl(k.tankL, 0) : '';
  const el = $('vb-kraftstoff-hinweis');
  if (!el) return;
  if (!k) { el.textContent = wort('neu.kraftstoffOhne'); return; }
  const ft = k.klasse.laengeFt[0] + '–' + k.klasse.laengeFt[1] + ' ft';
  el.textContent = wort(k.verbrauchQuelle === 'modell' ? 'neu.kraftstoffModellVerbrauch' : k.tankQuelle === 'modell' ? 'neu.kraftstoffModell' : 'neu.kraftstoffKlasse', {
    lh: zahl(k.verbrauchLh, 1), tank: zahl(k.tankL, 0), ft, modell: k.modellName ?? '',
  });
}
for (const id of ['in-toern-typ', 'in-toern-laenge', 'in-toern-motor']) {
  document.getElementById(id)?.addEventListener('input', () => zeigeKraftstoffVorschlag());
  document.getElementById(id)?.addEventListener('change', () => zeigeKraftstoffVorschlag());
}

function zeigePolarHinweis(): void {
  zeigeKraftstoffVorschlag();
  const el = $('vb-polar-hinweis');
  if (!el) return;
  const v = aktuellerVorschlag();
  if (!v) { el.textContent = ''; return; }
  const schluessel = v.guete === 'exakt' ? 'neu.polarExakt'
    : v.guete === 'aehnlich' ? 'neu.polarAehnlich' : 'neu.polarGeschaetzt';
  el.textContent = wort(schluessel, { b: v.boot.name });
}

const AUS_LISTE: [string, keyof Yachttyp][] = [
  ['in-toern-laenge', 'loaM'],
  ['in-toern-breite', 'breiteM'],
  ['in-toern-tiefgang', 'tiefgangM'],
  ['in-toern-verdraengung', 'verdraengungT'],
  ['in-toern-motor', 'motorPS'],
  ['in-toern-baujahr', 'baujahrAb'],
];

function uebernimmTypwerte(typ: Yachttyp | undefined): void {
  if (!typ) return;
  for (const [id, feld] of AUS_LISTE) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) continue;
    const vonHand = el.value !== '' && el.dataset['auto'] !== '1';
    if (vonHand) continue;
    const wertV = typ[feld];
    if (wertV === undefined) continue;
    el.value = typeof wertV === 'number' ? feldZahl(wertV) ?? '' : String(wertV);
    el.dataset['auto'] = '1';
  }
}
for (const [id] of AUS_LISTE) {
  document.getElementById(id)?.addEventListener('input', (e) => {
    delete (e.currentTarget as HTMLInputElement).dataset['auto'];
  });
}

function raeumeAutoMarken(): void {
  for (const [id] of AUS_LISTE) delete (document.getElementById(id) as HTMLInputElement | null)?.dataset['auto'];
}

const TYP_VORSCHLAEGE_MAX = 8;

function initTypAutocomplete(): void {
  const input = document.getElementById('in-toern-typ') as HTMLInputElement | null;
  const liste = document.getElementById('vb-toern-typ-vorschlaege') as HTMLUListElement | null;
  if (!input || !liste) return;

  const gesehen = new Set<string>();
  const alleTypen: string[] = [];
  const dazu = (name: string): void => {
    const schluessel = name.toLowerCase();
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    alleTypen.push(name);
  };
  for (const t of YACHTTYPEN) dazu(typName(t));
  for (const b of ALL_BOATS) dazu(b.name);

  let treffer: string[] = [];
  let aktiv = -1;
  let geradeAusgewaehlt = false;

  function schliessen(): void {
    liste!.hidden = true;
    liste!.innerHTML = '';
    treffer = [];
    aktiv = -1;
  }

  function auswaehlen(name: string): void {
    input!.value = name;
    schliessen();

    geradeAusgewaehlt = true;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    geradeAusgewaehlt = false;
  }

  function passendeTreffer(query: string): string[] {
    const q = query.toLowerCase();
    if (!q) return alleTypen.slice(0, TYP_VORSCHLAEGE_MAX);
    const beginnt = alleTypen.filter((n) => n.toLowerCase().startsWith(q));
    const enthaelt = alleTypen.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q));
    return [...beginnt, ...enthaelt].slice(0, TYP_VORSCHLAEGE_MAX);
  }

  function render(): void {
    if (!treffer.length) { schliessen(); return; }
    liste!.innerHTML = treffer.map((n, i) =>
      `<li role="option" aria-selected="${i === aktiv}" class="${i === aktiv ? 'aktiv' : ''}">${escapeHtml(n)}</li>`,
    ).join('');
    liste!.hidden = false;
    [...liste!.children].forEach((li, i) => {
      li.addEventListener('mousedown', (e) => { e.preventDefault(); auswaehlen(treffer[i]!); });
    });
  }

  function aktualisieren(): void {
    if (geradeAusgewaehlt) return;
    treffer = passendeTreffer(input!.value.trim());
    aktiv = -1;
    render();
  }

  input.addEventListener('focus', aktualisieren);
  input.addEventListener('input', aktualisieren);
  input.addEventListener('keydown', (e) => {
    if (!treffer.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); aktiv = Math.min(aktiv + 1, treffer.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); aktiv = Math.max(aktiv - 1, 0); render(); }
    else if (e.key === 'Enter') { if (aktiv >= 0) { e.preventDefault(); auswaehlen(treffer[aktiv]!); } }
    else if (e.key === 'Escape') { schliessen(); }
  });

  input.addEventListener('blur', () => setTimeout(schliessen, 150));
}
initTypAutocomplete();

for (const id of ['in-toern-typ', 'in-toern-laenge']) {
  document.getElementById(id)?.addEventListener('input', zeigePolarHinweis);
}
document.getElementById('in-toern-typ')?.addEventListener('input', () => {
  uebernimmTypwerte(typFinden(leseToernFeld('in-toern-typ')));
});

function leseSchiffAusFormular(): SchiffDaten {
  const schiff: SchiffDaten = {};
  const name = leseToernFeld('in-toern-schiffsname');
  const typ = leseToernFeld('in-toern-typ');
  const mmsi = leseToernFeld('in-toern-mmsi');
  if (name) schiff.name = name;
  if (typ) schiff.typ = typ;
  if (mmsi) schiff.mmsi = mmsi;
  const flagge = normLandcode(leseToernFeld('in-toern-flagge'));
  if (flagge) schiff.flagge = flagge;
  const laengeM = zahlAus('in-toern-laenge');
  if (laengeM !== undefined) schiff.laengeM = laengeM;
  const breiteM = zahlAus('in-toern-breite');
  if (breiteM !== undefined) schiff.breiteM = breiteM;
  const tiefgangM = zahlAus('in-toern-tiefgang');
  if (tiefgangM !== undefined) schiff.tiefgangM = tiefgangM;
  const verdraengungT = zahlAus('in-toern-verdraengung');
  if (verdraengungT !== undefined) schiff.verdraengungT = verdraengungT;
  const motorPS = zahlAus('in-toern-motor');
  if (motorPS !== undefined) schiff.motorPS = motorPS;
  const baujahr = zahlAus('in-toern-baujahr');
  if (baujahr !== undefined) schiff.baujahr = baujahr;
  const verbrauchLh = zahlAus('in-toern-verbrauch');
  if (verbrauchLh !== undefined && verbrauchLh > 0) schiff.verbrauchLh = verbrauchLh;
  const tankL = zahlAus('in-toern-tank');
  if (tankL !== undefined && tankL > 0) schiff.tankL = Math.round(tankL);
  const vorschlag = aktuellerVorschlag();
  if (vorschlag) {
    schiff.polarId = vorschlag.boot.id;
    schiff.polarGuete = vorschlag.guete;
  }
  return schiff;
}

function istProfilVollstaendig(p: { vorname?: string; nachname?: string } | null): boolean {
  return Boolean(p?.vorname && p?.nachname);
}

async function pruefeProfilUndOeffneNeuerToern(): Promise<void> {
  if (!token) return;
  const profil = await holeEigenesProfil(token);
  if (!istProfilVollstaendig(profil)) {
    const next = `${window.location.pathname}?neuerToern=1`;
    window.location.href = `/?profil=1&next=${encodeURIComponent(next)}&hinweis=toern`;
    return;
  }
  oeffneNeuerToern();
}

let formularStart: ToernHafen | null = null;
let formularEnde: ToernHafen | null = null;

let formularLand: string | null = null;

let startGeaendert = false;

let endeGeaendert = false;
let formularLandEnde: string | null = null;

function startRevierFormular(): string | null {
  if (startGeaendert && formularStart) return toernRevierText(formularLand, formularStart.lat, formularStart.lon, aktuelleSprache());
  return startRevierTeil(aktuellerToern?.revier);
}

function abgeleitetesRevier(): string | null {
  if (!startGeaendert && !endeGeaendert) return null;
  const ziel = formularEnde ? { ...formularEnde, land: formularLandEnde } : null;
  return toernRevierStrecke(startRevierFormular(), formularStart, ziel, aktuelleSprache());
}

async function revierZumSpeichern(): Promise<string | null> {
  return revierFuerToern({
    start: formularStart, ziel: formularEnde,
    startText: startGeaendert && !formularLand ? null : startRevierFormular(),
    ...(formularLandEnde ? { landZiel: formularLandEnde } : {}),
  }, aktuelleSprache());
}

function zeigePunkte(): void {
  for (const [praefix, hafen] of [['start', formularStart], ['ende', formularEnde]] as const) {
    const wert = $(`vb-${praefix}-wert`);
    if (wert) {
      wert.textContent = hafen ? lateinisch(hafen.name) : wort('neu.punktLeer');
      wert.classList.toggle('leer', !hafen);
    }

    const knopf = $(`btn-${praefix}-waehlen`);
    if (knopf) knopf.textContent = wort(hafen ? 'neu.punktAendern' : 'neu.punktWaehlen');

    if (hafen) wert?.removeAttribute('aria-invalid');
  }

  const revierZeile = $('vb-revier-abgeleitet');
  if (revierZeile) {
    const revier = abgeleitetesRevier() ?? (startGeaendert || endeGeaendert ? null : aktuellerToern?.revier ?? null);
    revierZeile.hidden = !revier;
    if (revier) revierZeile.textContent = wort('neu.revierAbgeleitet', { r: revier });
  }
}

async function waehlePunkt(welcher: 'start' | 'ende'): Promise<void> {
  const bisher = welcher === 'start' ? formularStart : formularEnde;
  const wahl = await oeffneLiegeplatzWahl({
    titel: wort(welcher === 'start' ? 'neu.startpunktTitel' : 'neu.endpunktTitel'),
    sprache: aktuelleSprache(),
    vorbelegung: bisher,
  });
  if (!wahl) return;
  const hafen: ToernHafen = { name: wahl.name, lat: wahl.lat, lon: wahl.lon };
  if (welcher === 'start') {
    formularStart = hafen;
    startGeaendert = true;

    formularLand = wahl.land;
    if (!flaggeVonHand) {
      const code = landcodeAusRevier(wahl.land);
      if (code) { setzeToernFeld('in-toern-flagge', code); zeigeFlagge(); }
    }
  } else {
    formularEnde = hafen;
    endeGeaendert = true;
    formularLandEnde = wahl.land;
  }
  zeigePunkte();
}

let flaggeVonHand = false;
function zeigeFlagge(): void {
  const code = normLandcode(leseToernFeld('in-toern-flagge'));
  const vorschau = $('vb-flagge-vorschau');
  if (vorschau) vorschau.innerHTML = seeflaggeSvg(code, 22, aktuelleSprache()) ?? '';
  const name = $('vb-flagge-name');
  if (name) {
    const fl = seeflagge(code);
    name.textContent = !code ? wort('neu.flaggeLeer') : fl ? fl.name[aktuelleSprache()] : wort('neu.flaggeUnbekannt', { c: code });
  }
}
function initFlaggenFeld(): void {
  const feld = document.getElementById('in-toern-flagge') as HTMLInputElement | null;
  feld?.addEventListener('input', () => {
    feld.value = feld.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    flaggeVonHand = feld.value !== '';
    zeigeFlagge();
  });
  aufSprachwechsel(zeigeFlagge);
}
initFlaggenFeld();

function initToernPunkte(): void {
  $('btn-start-waehlen')?.addEventListener('click', () => void waehlePunkt('start'));
  $('btn-ende-waehlen')?.addEventListener('click', () => void waehlePunkt('ende'));
  $('in-toern-meine-funktion')?.addEventListener('change', zeigeSkipperFeld);

  $('btn-ende-wie-start')?.addEventListener('click', () => {
    if (!formularStart) return;
    formularEnde = { ...formularStart };
    zeigePunkte();
  });

}

function zeigeSkipperFeld(): void {
  const feld = $('feld-skipper');
  if (!feld) return;
  const meineFunktion = leseAuswahlWert(leseToernFeld('in-toern-meine-funktion'))?.funktion;
  const anlegen = !toernBearbeitenId;
  feld.hidden = !anlegen || meineFunktion === 'skipper';
  zeigeSkipperForm();
}

function markiereFehlende(fehlt: readonly FehlendeAngabe[]): void {
  const ziele: Record<FehlendeAngabe, string> = {
    name: 'in-toern-name', start: 'vb-start-wert', ende: 'vb-ende-wert',
    von: 'in-toern-von', bis: 'in-toern-bis', zeitraum: 'in-toern-bis', skipper: 'in-toern-skipper-vorname',
  };
  for (const id of new Set(Object.values(ziele))) $(id)?.removeAttribute('aria-invalid');
  for (const f of fehlt) $(ziele[f])?.setAttribute('aria-invalid', 'true');
  if (toernStatus) {
    toernStatus.textContent = fehlt.length
      ? wort('neu.pflichtFehlt', { liste: fehlt.map((f) => wort(`neu.fehlt.${f}`)).join(', ') })
      : '';
  }
}

function oeffneNeuerToern(): void {

  schliesseKarte();
  toernBearbeitenId = null;
  raeumeAutoMarken();
  for (const id of ['in-toern-name', 'in-toern-von', 'in-toern-bis', 'in-toern-skipper-vorname', 'in-toern-skipper-nachname', ...SCHIFF_FELDER]) {
    setzeToernFeld(id, '');
  }
  formularStart = null;
  formularEnde = null;
  formularLand = null;
  startGeaendert = false;
  formularLandEnde = null;
  endeGeaendert = false;
  flaggeVonHand = false;
  zeigeFlagge();
  zeigePunkte();

  setzeToernFeld('in-toern-yachtnutzung', 'bareboat-charter');
  const crewAngeben = document.getElementById('in-toern-crew-angeben') as HTMLInputElement | null;
  if (crewAngeben) crewAngeben.checked = false;
  zeigeCrewErfahrungFelder(false);

  setzeToernFeld('in-toern-crewfaktor', String(CREW_VORGABE));
  setzeToernFeld('in-toern-crewzumutbarkeit', String(CREW_VORGABE));
  const crewfaktorOut = $('out-toern-crewfaktor'); if (crewfaktorOut) crewfaktorOut.textContent = crewProzent(CREW_VORGABE);
  const crewzumOut = $('out-toern-crewzumutbarkeit'); if (crewzumOut) crewzumOut.textContent = crewProzent(CREW_VORGABE);

  fuelleFunktionsfeld('in-toern-meine-funktion', { funktion: 'skipper', form: null });
  setzeToernFeld('in-toern-skipper-form', '');
  const meineFunktionFeld = $('feld-meine-funktion');
  if (meineFunktionFeld) meineFunktionFeld.hidden = false;
  zeigeSkipperFeld();
  markiereFehlende([]);
  gewaehlteFotoDatei = null;
  fotoEntfernenMarkiert = false;
  const fotoInput = document.getElementById('in-toern-foto') as HTMLInputElement | null;
  if (fotoInput) fotoInput.value = '';
  zeigeFotoVorschau(null);
  const titel = $('toern-titel');
  if (titel) titel.textContent = wort('neu.titel');
  const anlegenKnopf = $('btn-toern-anlegen');
  if (anlegenKnopf) anlegenKnopf.textContent = wort('neu.anlegen');
  zeigePolarHinweis();
  if (toernOverlay) toernOverlay.hidden = false;
  if (toernStatus) toernStatus.textContent = '';
  toernModal?.beimOeffnen(undefined, document.getElementById('in-toern-name') as HTMLInputElement | null);
}

function oeffneToernBearbeiten(art: KartenArt = 'toern'): void {
  if (!aktuellerToern || aktuellerToern.archiviert_am) return;

  if (offeneKarte()) { oeffneKarte(art); return; }
  toernBearbeitenId = aktuellerToern.id;
  raeumeAutoMarken();
  setzeToernFeld('in-toern-name', aktuellerToern.name);
  formularStart = aktuellerToern.start_hafen ?? null;
  formularEnde = aktuellerToern.rueckgabe_hafen ?? null;
  formularLand = null;
  startGeaendert = false;
  formularLandEnde = null;
  endeGeaendert = false;
  zeigePunkte();
  setzeToernFeld('in-toern-von', aktuellerToern.von);
  setzeToernFeld('in-toern-bis', aktuellerToern.bis);
  setzeToernFeld('in-toern-yachtnutzung', aktuellerToern.yachtnutzung);
  {
    const angegeben = aktuellerToern.crew_faktor != null || aktuellerToern.crew_zumutbarkeit != null;
    const crewAngeben = document.getElementById('in-toern-crew-angeben') as HTMLInputElement | null;
    if (crewAngeben) crewAngeben.checked = angegeben;
    zeigeCrewErfahrungFelder(angegeben);

    const faktor = aktuellerToern.crew_faktor ?? CREW_VORGABE;
    const zumutbarkeit = aktuellerToern.crew_zumutbarkeit ?? CREW_VORGABE;
    setzeToernFeld('in-toern-crewfaktor', String(faktor));
    setzeToernFeld('in-toern-crewzumutbarkeit', String(zumutbarkeit));
    const crewfaktorOut = $('out-toern-crewfaktor'); if (crewfaktorOut) crewfaktorOut.textContent = crewProzent(faktor);
    const crewzumOut = $('out-toern-crewzumutbarkeit'); if (crewzumOut) crewzumOut.textContent = crewProzent(zumutbarkeit);
  }
  setzeToernFeld('in-toern-schiffsname', aktuellerToern.schiff.name);
  setzeToernFeld('in-toern-typ', aktuellerToern.schiff.typ);
  setzeToernFeld('in-toern-mmsi', aktuellerToern.schiff.mmsi);

  flaggeVonHand = !!aktuellerToern.schiff.flagge;
  setzeToernFeld('in-toern-flagge', aktuellerToern.schiff.flagge ?? landcodeAusRevier(aktuellerToern.revier));
  zeigeFlagge();
  setzeToernFeld('in-toern-laenge', feldZahl(aktuellerToern.schiff.laengeM));
  setzeToernFeld('in-toern-breite', feldZahl(aktuellerToern.schiff.breiteM));
  setzeToernFeld('in-toern-tiefgang', feldZahl(aktuellerToern.schiff.tiefgangM));
  setzeToernFeld('in-toern-verdraengung', feldZahl(aktuellerToern.schiff.verdraengungT));
  setzeToernFeld('in-toern-motor', aktuellerToern.schiff.motorPS?.toString());
  setzeToernFeld('in-toern-baujahr', aktuellerToern.schiff.baujahr?.toString());
  setzeToernFeld('in-toern-verbrauch', feldZahl(aktuellerToern.schiff.verbrauchLh));
  setzeToernFeld('in-toern-tank', aktuellerToern.schiff.tankL?.toString());

  const meineFunktionFeld = $('feld-meine-funktion');
  if (meineFunktionFeld) meineFunktionFeld.hidden = true;
  zeigeSkipperFeld();
  markiereFehlende([]);
  gewaehlteFotoDatei = null;
  fotoEntfernenMarkiert = false;
  const fotoInput = document.getElementById('in-toern-foto') as HTMLInputElement | null;
  if (fotoInput) fotoInput.value = '';
  zeigeFotoVorschau(schiffFotoUrl(aktuellerToern.id));
  const titel = $('toern-titel');
  if (titel) titel.textContent = wort('neu.titelBearbeiten');
  const aendernKnopf = $('btn-toern-anlegen');
  if (aendernKnopf) aendernKnopf.textContent = wort('neu.aendern');
  zeigePolarHinweis();
  if (toernStatus) toernStatus.textContent = '';

  const kurz = $('vb-form-yacht-kurz');
  if (kurz) kurz.textContent = [aktuellerToern.schiff.name, aktuellerToern.schiff.typ].filter(Boolean).join(' · ') || wort('detail.yachtKeine');
  oeffneKarte(art);
}

function schliesseNeuerToern(): void {
  if (offeneKarte()) { schliesseKarte(); return; }
  if (toernOverlay) toernOverlay.hidden = true;
  toernModal?.beimSchliessen();
}

async function speichereToernFormular(): Promise<void> {
  const name = leseToernFeld('in-toern-name');

  const anlegen = !toernBearbeitenId;
  const fehlt = fehlendeAngaben({
    name, von: leseToernFeld('in-toern-von'), bis: leseToernFeld('in-toern-bis'),
    start: formularStart, ende: formularEnde,
    ...(anlegen ? {
      meineFunktion: (leseAuswahlWert(leseToernFeld('in-toern-meine-funktion'))?.funktion ?? 'skipper') as ToernFunktion,
      skipperVorname: leseToernFeld('in-toern-skipper-vorname'),
    } : {}),
  });
  markiereFehlende(fehlt);
  if (fehlt.length) return;
  if (!token) return;

  try {

    const revierNeu = startGeaendert || endeGeaendert;
    const revier = revierNeu ? await revierZumSpeichern() : null;
    const von = leseToernFeld('in-toern-von');
    const bis = leseToernFeld('in-toern-bis');
    const yachtnutzung = leseToernFeld('in-toern-yachtnutzung') as ToernYachtnutzung;
    const schiff = leseSchiffAusFormular();

    const crewAngegeben = (document.getElementById('in-toern-crew-angeben') as HTMLInputElement | null)?.checked ?? false;
    const crewFaktor = crewAngegeben ? parseFloat(leseToernFeld('in-toern-crewfaktor')) : null;
    const crewZumutbarkeit = crewAngegeben ? parseFloat(leseToernFeld('in-toern-crewzumutbarkeit')) : null;

    let zielId: string;
    if (toernBearbeitenId) {
      const aktualisiert = await aendereToern(token, toernBearbeitenId, {
        name,

        ...(revierNeu ? { revier } : {}),
        ...(startGeaendert ? { start_hafen: formularStart } : {}),
        rueckgabe_hafen: formularEnde,
        von: von || null,
        bis: bis || null,
        yachtnutzung,
        schiff,
        crew_faktor: crewFaktor,
        crew_zumutbarkeit: crewZumutbarkeit,
      });
      if (!aktualisiert) {
        if (toernStatus) toernStatus.textContent = wort('neu.fehlerAendern');
        return;
      }
      zielId = aktualisiert.id;
    } else {

      const meineWahl = leseAuswahlWert(leseToernFeld('in-toern-meine-funktion'));
      const meineFunktion = meineWahl?.funktion as ToernFunktion | undefined;
      const skipperForm = leseToernFeld('in-toern-skipper-form');
      const neu = await legeToernAn(token, {
        id: neueFahrtId(Date.now()),
        name,
        ...(revier ? { revier } : {}),
        ...(formularStart ? { start_hafen: formularStart } : {}),
        ...(formularEnde ? { rueckgabe_hafen: formularEnde } : {}),
        ...(von ? { von } : {}),
        ...(bis ? { bis } : {}),
        ...(yachtnutzung ? { yachtnutzung } : {}),
        ...(Object.keys(schiff).length ? { schiff } : {}),
        ...(meineFunktion ? { meineFunktion, meineForm: meineWahl?.form ?? null } : {}),
        ...(meineFunktion && meineFunktion !== 'skipper' ? {
          skipper: {
            vorname: leseToernFeld('in-toern-skipper-vorname'),
            nachname: leseToernFeld('in-toern-skipper-nachname') || null,
            form: skipperForm === 'w' || skipperForm === 'm' ? skipperForm : null,
          },
        } : {}),
        ...(crewAngegeben ? { crew_faktor: crewFaktor, crew_zumutbarkeit: crewZumutbarkeit } : {}),
      });
      if (!neu.toern) {

        if (toernStatus) toernStatus.textContent = wort(neu.status === 507 ? 'neu.grenze' : 'neu.fehler');
        return;
      }
      zielId = neu.toern.id;
      await ladeListe();
    }

    let fotoFehlt = false;
    if (gewaehlteFotoDatei) {
      const klein = await verkleinere(gewaehlteFotoDatei).then((k) => k.blob).catch(() => gewaehlteFotoDatei);
      fotoFehlt = !(klein && await ladeSchiffFotoHoch(token, zielId, klein));
    } else if (fotoEntfernenMarkiert) {
      await loescheSchiffFoto(token, zielId);
    }

    schliesseNeuerToern();
    await oeffneDetail(zielId);
    if (fotoFehlt) {
      const status = $('vb-detail-status');
      if (status) status.textContent = wort('neu.fotoFehler');
    }
    if (toernBearbeitenId) void ladeListe();
  } catch (err) {
    console.error('speichereToernFormular:', err);
    if (toernStatus) toernStatus.textContent = wort(toernBearbeitenId ? 'neu.fehlerAendern' : 'neu.fehler');
  }
}

$('btn-neuer-toern')?.addEventListener('click', () => { void pruefeProfilUndOeffneNeuerToern(); });
$('btn-toerndaten-bearbeiten')?.addEventListener('click', () => oeffneToernBearbeiten('toern'));
$('btn-yacht-bearbeiten')?.addEventListener('click', () => oeffneToernBearbeiten('yacht'));
$('btn-form-zur-yacht')?.addEventListener('click', () => oeffneKarte('yacht'));

document.querySelectorAll<HTMLElement>('[data-fakt]').forEach((k) => k.addEventListener('click', () => {
  const fakt = k.dataset['fakt'];
  if (fakt === 'rolle') { zeigeReiter('crew'); oeffneCrewZeile(letzteCrew.find((m) => m.istIchSelbst)?.id ?? null); return; }
  oeffneToernBearbeiten(fakt === 'yacht' ? 'yacht' : 'toern');
}));
initMehrMenue();
initToernPunkte();

fuelleFunktionsfeld('in-crew-funktion', { funktion: 'deckshand', form: null });
fuelleFunktionsfeld('in-toern-meine-funktion', { funktion: 'skipper', form: null });
zeigeSkipperForm();
document.getElementById('in-toern-foto')?.addEventListener('change', (ev) => {
  const datei = (ev.target as HTMLInputElement).files?.[0] ?? null;
  gewaehlteFotoDatei = datei;
  fotoEntfernenMarkiert = false;
  if (datei) zeigeFotoVorschau(URL.createObjectURL(datei));
});
$('btn-foto-entfernen')?.addEventListener('click', () => {
  gewaehlteFotoDatei = null;
  fotoEntfernenMarkiert = true;
  const fotoInput = document.getElementById('in-toern-foto') as HTMLInputElement | null;
  if (fotoInput) fotoInput.value = '';
  zeigeFotoVorschau(null);
});
$('btn-toern-aktiv')?.addEventListener('click', () => {
  void (async () => {
    if (!token || !aktuellerToern) return;
    const aktualisiert = aktuellerToern.istAktiv
      ? await deaktiviereToern(token, aktuellerToern.id)
      : await aktiviereToern(token, aktuellerToern.id);
    if (!aktualisiert) return;
    aktuellerToern = aktualisiert;
    zeigeAktivKnopf(aktualisiert);
    void ladeListe();
  })();
});
$('toern-schliessen')?.addEventListener('click', schliesseNeuerToern);
$('btn-toern-abbrechen')?.addEventListener('click', schliesseNeuerToern);
$('btn-toern-anlegen')?.addEventListener('click', () => { void speichereToernFormular(); });

let aktuellerToern: ToernZeile | null = null;

initStreamDialog(() => token, () => aktuellerToern);

const crewFotos = initCrewFotos(() => token, () => aktuellerToern);

{
  const behaelter = $('vb-reiter-technik');
  initTechnik({
    yacht: () => aktuellerToern?.schiff?.name ?? null,
    ...(behaelter ? {
      reiter: {
        behaelter,
        knopf: document.querySelector<HTMLElement>('.vb-reiter [data-reiter="technik"]'),
        offen: () => $('vb-detail-ansicht')?.hidden === false,
        zeige: () => zeigeReiter('technik'),
      },
    } : {}),
  });
}

const REVIER_HINWEIS_WORT: Record<ReturnType<typeof erkenneRevierRechtshinweise>[number], string> = {
  'kroatien-seefunk': 'hinweis.kroatienSeefunk',
  'griechenland-coskipper': 'hinweis.griechenlandCoskipper',
};

const YACHTNUTZUNG_WORT: Record<ToernYachtnutzung, string> = {
  'eigene-yacht': 'yachtnutzung.eigeneYacht',
  'bareboat-charter': 'yachtnutzung.bareboatCharter',
  'skippered-charter': 'yachtnutzung.skipperedCharter',
  'crewed-charter': 'yachtnutzung.crewedCharter',
};

function revierText(t: ToernZeile): string | null {
  return t.revier;
}
function zeitraumText(t: { von: string | null; bis: string | null }): string | null {
  return zeitraumKurz(t.von, t.bis) || null;
}

function erfahrungText(t: ToernZeile): string | null {
  if (t.crew_faktor == null && t.crew_zumutbarkeit == null) return null;
  const teile: string[] = [];
  if (t.crew_faktor != null) teile.push(`${wort('field.crewfactor')} ${crewProzent(t.crew_faktor)}`);
  if (t.crew_zumutbarkeit != null) teile.push(`${wort('field.crewzumutbarkeit')} ${crewProzent(t.crew_zumutbarkeit)}`);
  return teile.join(' · ');
}

function meineRolleText(): string | null {
  const mich = letzteCrew.find((m) => m.istIchSelbst);
  return mich ? funktionsText(mich) : null;
}

function zeigeRevierHinweise(revier: string | null): void {
  const liste = $('vb-revier-hinweise');
  if (!liste) return;
  liste.innerHTML = '';
  const hinweise = erkenneRevierRechtshinweise(revier);
  for (const h of hinweise) {
    const li = document.createElement('li');
    li.textContent = wort(REVIER_HINWEIS_WORT[h]);
    liste.appendChild(li);
  }
  liste.hidden = hinweise.length === 0;
}

function zeigeAktivKnopf(t: ToernZeile): void {
  const knopf = $('btn-toern-aktiv') as HTMLButtonElement | null;
  if (!knopf) return;
  const aktiv = Boolean(t.istAktiv);

  knopf.hidden = Boolean(t.beendet) || (Boolean(t.archiviert_am) && !aktiv);

  knopf.setAttribute('aria-checked', String(aktiv));
  const abzeichen = $('vb-detail-aktiv-abzeichen');
  if (abzeichen) abzeichen.hidden = !aktiv;
}

function zeigeNurLesen(t: ToernZeile): void {
  const archiviert = Boolean(t.archiviert_am);
  document.querySelectorAll<HTMLElement>('#vb-detail-ansicht [data-nur-offen]')
    .forEach((el) => { el.hidden = archiviert; });
  const hinweis = $('vb-archiv-hinweis');
  if (hinweis) {
    hinweis.hidden = !archiviert;
    hinweis.textContent = t.archiviert_am
      ? wort('detail.archivHinweis', {
        datum: new Date(t.archiviert_am).toLocaleDateString(aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT'),
      })
      : '';
  }
  if (archiviert) {
    const handeintrag = $('vb-crew-handeintrag');
    if (handeintrag) handeintrag.hidden = true;
    document.querySelector('[data-klapp="vb-crew-handeintrag"]')?.setAttribute('aria-expanded', 'false');
  }
  for (const id of ['in-motor-anfang', 'in-motor-ende']) {
    const feld = document.getElementById(id) as HTMLInputElement | null;
    if (feld) feld.readOnly = archiviert;
  }
  sperreTankliste(archiviert);
}

const zielrevierVersucht = new Set<string>();

function ergaenzeZielrevier(toern: ToernZeile): void {
  if (!token || toern.archiviert_am || toern.besitzer !== liesEigeneNutzerId()) return;

  const nachgezogen = revierNachgezogen(toern.revier, toern.start_hafen, toern.rueckgabe_hafen);
  if (nachgezogen && nachgezogen !== toern.revier && !zielrevierVersucht.has(`${toern.id}:see`)) {
    zielrevierVersucht.add(`${toern.id}:see`);
    void aendereToern(token, toern.id, { revier: nachgezogen }).then((neu) => {
      if (neu && aktuellerToern?.id === toern.id) void oeffneDetail(toern.id);
    });
    return;
  }
  if (!zielrevierFehlt(toern) || zielrevierVersucht.has(toern.id)) return;
  zielrevierVersucht.add(toern.id);
  void (async () => {
    const revier = await revierFuerToern({
      start: toern.start_hafen ?? null, ziel: toern.rueckgabe_hafen ?? null, startText: startRevierTeil(toern.revier),
    }, aktuelleSprache());
    if (!revier || revier === toern.revier || !token) return;
    const neu = await aendereToern(token, toern.id, { revier });
    if (neu && aktuellerToern?.id === toern.id) void oeffneDetail(toern.id);
  })();
}

async function oeffneDetail(id: string): Promise<void> {
  if (!token) return;
  schliesseKarte();
  zeigeAnsicht('detail');
  markiereInListe(id);
  $('vb-detail-ansicht')?.scrollTo?.({ top: 0 });
  if (!BREIT.matches) window.scrollTo({ top: 0 });
  zeigeReiter('uebersicht');
  const nameEl = $('vb-detail-name');
  const infoEl = $('vb-detail-info');
  if (nameEl) nameEl.textContent = '…';
  if (infoEl) infoEl.textContent = '';

  const toern = await holeToern(token, id);
  if (!toern) {
    if (nameEl) nameEl.textContent = wort('detail.fehlerLaden');
    aktuellerToern = null;
    return;
  }
  aktuellerToern = toern;

  setzeTiefgang(toern.schiff?.tiefgangM ?? null);
  zeigeAktivKnopf(toern);
  zeigeNurLesen(toern);

  const nachrichtBlock = $('vb-nachricht-block');
  if (nachrichtBlock) nachrichtBlock.hidden = toern.besitzer !== liesEigeneNutzerId();
  if (nameEl) nameEl.textContent = toern.name;
  if (infoEl) {

    const start = lateinisch(toern.start_hafen?.name);
    const ende = lateinisch(toern.rueckgabe_hafen?.name);
    const teile = [
      revierText(toern), zeitraumText(toern),
      start && ende ? (start === ende ? start : `${start} → ${ende}`) : start || ende,
      wort(YACHTNUTZUNG_WORT[toern.yachtnutzung]),
    ].filter(Boolean) as string[];
    infoEl.innerHTML = teile.map((t) => `<span>${escapeHtml(t)}</span>`).join('');
  }
  zeigeYacht(toern);
  zeigeRevierHinweise(toern.revier);
  ergaenzeZielrevier(toern);

  await ladeCrew(id);
  void ladeBordkasse(token, toern.id, Boolean(toern.archiviert_am));
  await ladeStatistik(token, toern);

  void crewFotos.lade(toern);

  await ladeMotordaten(token, toern, () => void ladeStatistik(token, toern));
  await ladeBriefing(id);
  await ladeToernplan(id);

  fuelleToerndaten({
    revier: revierText(toern),
    zeitraum: zeitraumText(toern),
    nutzung: wort(YACHTNUTZUNG_WORT[toern.yachtnutzung]),
    start: lateinisch(toern.start_hafen?.name) ?? null,
    ende: lateinisch(toern.rueckgabe_hafen?.name) ?? null,
    schiff: [toern.schiff.name, toern.schiff.typ].filter(Boolean).join(' · ') || null,
    erfahrung: erfahrungText(toern),
    rolle: meineRolleText(),
  }, wort('detail.keineAngabe'));
}

let letzteCrew: CrewEintrag[] = [];

function statusText(status: string): string {
  return STRINGS[aktuelleSprache()]['status.' + status] ?? status;
}

function crewName(m: CrewEintrag): string {
  if (!m.profil || !('vorname' in m.profil)) return '';
  return [m.profil.vorname, m.profil.nachname].filter(Boolean).join(' ');
}

function funktionsText(m: { funktion: string; funktionForm?: 'w' | 'm' | null }): string {
  return wort(funktionSchluessel(m.funktion, m.funktionForm));
}

function fuelleFunktionsfeld(id: string, aktuell?: { funktion: string; form?: 'w' | 'm' | null } | null): void {
  const sel = document.getElementById(id) as HTMLSelectElement | null;
  if (!sel) return;
  fuelleFunktionsAuswahl(sel, aktuelleSprache(), wort, aktuell ?? leseFunktionsAuswahl(sel));
}

function zeigeSkipperForm(): void {
  const feld = $('feld-skipper-form');
  if (feld) feld.hidden = aktuelleSprache() === 'en';
}

function crewHatVollenNamen(m: CrewEintrag): boolean {
  return !!(m.profil && 'vorname' in m.profil && m.profil.vorname && m.profil.nachname);
}

function initialen(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]!).join('').slice(0, 2).toUpperCase();
}

let offeneCrewId: string | null = null;

function oeffneCrewZeile(id: string | null): void {
  offeneCrewId = id;
  document.querySelectorAll<HTMLElement>('#vb-crewliste .vb-crew-zeile').forEach((z) => {
    const an = z.dataset['id'] === id;
    z.classList.toggle('offen', an);
    z.querySelector('.vb-crew-kopf')?.setAttribute('aria-expanded', String(an));
    const inhalt = z.querySelector<HTMLElement>('.vb-crew-inhalt');
    if (inhalt) inhalt.hidden = !an;
    if (an) z.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

async function speichereCrewZeile(m: CrewEintrag, zeile: HTMLElement): Promise<boolean> {
  if (!token || !aktuellerToern) return false;
  const status = zeile.querySelector<HTMLElement>('[data-status]');
  const wahl = leseFunktionsAuswahl(zeile.querySelector('select'));
  const aenderung: Parameters<typeof aendereMitglied>[3] = {
    funktion: (wahl?.funktion ?? m.funktion) as ToernFunktion,
    form: wahl ? wahl.form : m.funktionForm ?? null,
  };
  const geaendert = aenderung.funktion !== m.funktion || (aenderung.form ?? null) !== (m.funktionForm ?? null);
  let nameGeaendert = false;
  if (!m.userId) {
    const vorname = (zeile.querySelector<HTMLInputElement>('[data-feld="vorname"]')?.value ?? '').trim();
    const nachname = (zeile.querySelector<HTMLInputElement>('[data-feld="nachname"]')?.value ?? '').trim();
    if (!vorname) { if (status) status.textContent = wort('neu.eingabeFehlt'); return false; }
    const alt = m.profil && 'vorname' in m.profil ? m.profil : null;
    nameGeaendert = vorname !== (alt?.vorname ?? '') || nachname !== (alt?.nachname ?? '');
    aenderung.vorname = vorname;
    aenderung.nachname = nachname || null;
  }
  if (!geaendert && !nameGeaendert) return true;
  if (aenderung.funktion && nimmtLetztenSkipper(letzteCrew, m.id, aenderung.funktion)) {
    if (status) status.textContent = wort('crewEdit.letzterSkipper');
    return false;
  }
  const erg = await aendereMitglied(token, aktuellerToern.id, m.id, aenderung);
  if (!erg) { if (status) status.textContent = wort('crewEdit.fehler'); return false; }
  return true;
}

async function ladeCrew(toernId: string): Promise<void> {
  if (!token) return;
  const liste = $('vb-crewliste');
  const kurz = $('vb-crewliste-kurz');
  if (!liste) return;
  const crew = await holeCrew(token, toernId);
  liste.innerHTML = '';
  if (kurz) kurz.innerHTML = '';
  if (!crew) return;
  letzteCrew = crew;
  setzeKassenCrew(crew.map((m) => ({ id: m.id, name: crewName(m), ich: m.istIchSelbst })));
  const sichtbar = crew.filter(crewHatVollenNamen);
  for (const id of ['vb-crew-anzahl', 'vb-crew-anzahl-2', 'vb-crew-anzahl-3']) {
    const z = $(id);
    if (z) z.textContent = String(sichtbar.length);
  }
  const archiviert = Boolean(aktuellerToern?.archiviert_am);
  const binBesitzer = aktuellerToern?.besitzer === liesEigeneNutzerId();
  for (const m of sichtbar) {
    const name = crewName(m);
    const kopfText = `<span class="vb-initialen" aria-hidden="true">${escapeHtml(initialen(name))}</span>
      <span class="vb-crew-text"><span class="vb-crew-name">${escapeHtml(name)}</span>
      <span class="vb-crew-funktion">${escapeHtml(funktionsText(m))}</span></span>`;
    if (kurz) {
      const li = document.createElement('li');
      li.innerHTML = kopfText;
      kurz.appendChild(li);
    }
    const zeile = document.createElement('li');
    zeile.className = 'vb-crew-zeile';
    zeile.dataset['id'] = m.id;
    const kopf = document.createElement(archiviert ? 'div' : 'button');
    kopf.className = 'vb-crew-kopf';
    if (kopf instanceof HTMLButtonElement) {
      kopf.type = 'button';
      kopf.setAttribute('aria-expanded', 'false');
      kopf.setAttribute('aria-controls', `vb-crew-inhalt-${m.id}`);
    }
    kopf.innerHTML = kopfText.replace('</span></span>', ` · ${escapeHtml(statusText(m.status))}</span></span>`)
      + (archiviert ? '' : '<span class="vb-pfeil" aria-hidden="true"></span>');
    zeile.appendChild(kopf);
    if (!archiviert) {
      const inhalt = document.createElement('div');
      inhalt.className = 'vb-crew-inhalt';
      inhalt.id = `vb-crew-inhalt-${m.id}`;
      inhalt.hidden = true;
      const vorname = m.profil && 'vorname' in m.profil ? m.profil.vorname ?? '' : '';
      const nachname = m.profil && 'nachname' in m.profil ? m.profil.nachname ?? '' : '';
      const hinweis = m.istIchSelbst && m.funktion === 'skipper' ? wort('crewEdit.hinweisSkipper')
        : m.userId ? wort('crewEdit.nameGesperrt') : wort('crewEdit.hinweisPlatzhalter');
      inhalt.innerHTML = `
        ${m.userId ? '' : `<div class="vb-crew-namen">
          <label><span>${escapeHtml(wort('crewEdit.vorname'))}</span><input type="text" data-feld="vorname" autocomplete="off" maxlength="100" value="${escapeHtml(vorname)}"></label>
          <label><span>${escapeHtml(wort('crewEdit.nachname'))}</span><input type="text" data-feld="nachname" autocomplete="off" maxlength="100" value="${escapeHtml(nachname)}"></label>
        </div>`}
        <label><span>${escapeHtml(wort('crewEdit.rolleAnBord'))}</span><select></select></label>
        <p class="vb-hinweis">${escapeHtml(hinweis)}</p>
        <p class="vb-status" data-status role="status" aria-live="polite"></p>
        <div class="vb-aktionen"></div>`;
      const auswahl = inhalt.querySelector('select')!;
      fuelleFunktionsAuswahl(auswahl, aktuelleSprache(), wort, { funktion: m.funktion, form: m.funktionForm ?? null });
      const aktionen = inhalt.querySelector('.vb-aktionen')!;
      const fertig = document.createElement('button');
      fertig.type = 'button';
      fertig.className = 'btn primary';
      fertig.textContent = wort('crewEdit.fertig');
      fertig.addEventListener('click', () => {
        void (async () => {
          if (!(await speichereCrewZeile(m, zeile))) return;
          offeneCrewId = null;
          await ladeCrew(toernId);
          void fuelleRolle();
        })();
      });
      aktionen.appendChild(fertig);
      if (m.status === 'platzhalter') {
        const einladen = document.createElement('button');
        einladen.type = 'button';
        einladen.className = 'btn';
        einladen.textContent = wort('detail.crewEinladen');
        einladen.addEventListener('click', () => { void einladeMitglied(toernId, m.id); });
        aktionen.appendChild(einladen);
      }

      if (binBesitzer && m.rolle !== 'besitzer') {
        const entfernen = document.createElement('button');
        entfernen.type = 'button';
        entfernen.className = 'btn danger';
        entfernen.textContent = wort('detail.crewEntfernenLang');
        entfernen.setAttribute('aria-label', wort('detail.crewEntfernenAria', { name }));
        entfernen.addEventListener('click', () => { void entferneCrewmitglied(toernId, m); });
        aktionen.appendChild(entfernen);
      }
      zeile.appendChild(inhalt);
      kopf.addEventListener('click', () => oeffneCrewZeile(offeneCrewId === m.id ? null : m.id));
    }
    liste.appendChild(zeile);
  }
  if (offeneCrewId) oeffneCrewZeile(offeneCrewId);
}

async function fuelleRolle(): Promise<void> {
  const el = $('vb-wert-rolle');
  const rolle = meineRolleText();
  if (el) { el.textContent = rolle ?? wort('detail.keineAngabe'); el.classList.toggle('vb-wert-leer', !rolle); }
}

async function entferneCrewmitglied(toernId: string, m: CrewEintrag): Promise<void> {
  if (!token) return;

  const frage = aktuellerToern
    ? wort(entfernenFrageSchluessel(aktuellerToern, m.status === 'platzhalter'), { name: crewName(m) })
    : wort('detail.crewEntfernenFrage.angelegt', { name: crewName(m) });
  if (!window.confirm(frage)) return;
  const status = $('vb-crew-status');
  const ok = await entferneMitglied(token, toernId, m.id);
  if (status) status.textContent = wort(ok ? 'detail.crewEntfernt' : 'detail.crewEntfernenFehler', { name: crewName(m) });
  if (ok) await ladeCrew(toernId);
}

async function einladeMitglied(toernId: string, mitgliedId?: string): Promise<void> {
  if (!token) return;
  const status = $('vb-crew-status');

  const funktionSelect = document.getElementById('in-crew-funktion') as HTMLSelectElement | null;
  const wahl = mitgliedId ? null : leseFunktionsAuswahl(funktionSelect);
  const erg = await erzeugeEinladung(token, toernId, mitgliedId, wahl?.funktion as ToernFunktion | undefined, wahl?.form ?? null);
  if (!erg) {
    if (status) status.textContent = wort('detail.crewLinkFehler');
    return;
  }
  const link = `https://sail-suite.app/voyagebook/?einladung=${encodeURIComponent(erg.token)}`;

  const titel = aktuellerToern?.name ?? wort('neu.titel');
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ url: link, title: titel, text: titel });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(link);
      if (status) status.textContent = wort('detail.crewLinkKopiert');
    }
  } catch (err) {
    if ((err as Error).name !== 'AbortError' && navigator.clipboard) {
      await navigator.clipboard.writeText(link).catch(() => {});
      if (status) status.textContent = wort('detail.crewLinkKopiert');
    }
  }
  await ladeCrew(toernId);
}

$('btn-crew-einladen')?.addEventListener('click', () => {
  if (aktuellerToern) void einladeMitglied(aktuellerToern.id);
});

$('btn-crew-dazu')?.addEventListener('click', () => {
  void (async () => {
    if (!token || !aktuellerToern) return;
    const vornameInput = document.getElementById('in-crew-vorname') as HTMLInputElement | null;
    const nachnameInput = document.getElementById('in-crew-nachname') as HTMLInputElement | null;
    const funktionSelect = document.getElementById('in-crew-funktion') as HTMLSelectElement | null;
    const vorname = vornameInput?.value.trim() ?? '';
    const nachname = nachnameInput?.value.trim() ?? '';
    const status = $('vb-crew-status');
    if (!vorname) return;
    const wahl = leseFunktionsAuswahl(funktionSelect);
    const erg = await legePlatzhalterAn(token, aktuellerToern.id, vorname, nachname || null, (wahl?.funktion ?? 'deckshand') as ToernFunktion, wahl?.form ?? null);
    if (!erg) {
      if (status) status.textContent = wort('detail.crewLinkFehler');
      return;
    }
    if (vornameInput) vornameInput.value = '';
    if (nachnameInput) nachnameInput.value = '';
    await ladeCrew(aktuellerToern.id);
  })();
});

const crewlisteOverlay = $('crewliste-overlay');
const crewlisteModalEl = $('crewliste-modal');
const crewlisteModal = crewlisteModalEl ? initModal(crewlisteModalEl, () => schliesseCrewliste()) : null;

function schliesseCrewliste(): void {
  if (crewlisteOverlay) crewlisteOverlay.hidden = true;
  crewlisteModal?.beimSchliessen();
}

function anlage9Feld(profil: CrewEintrag['profil'], feld: 'geburtsdatum' | 'staatsbuergerschaft' | 'passnummer'): string {
  if (!profil || !(feld in profil)) return '';
  return (profil as Record<string, string | undefined>)[feld] ?? '';
}

function siehtVolleCrew(): boolean {
  if (aktuellerToern?.besitzer === liesEigeneNutzerId()) return true;
  return letzteCrew.some((m) => m.istIchSelbst && m.funktion === 'skipper');
}

function baueCrewlisteKarte(m: CrewEintrag, nurName = false): HTMLElement {
  const karte = document.createElement('div');
  karte.className = 'vb-crewliste-voll-karte';
  const verlinkt = Boolean(m.userId);
  const vorname = m.profil && 'vorname' in m.profil ? m.profil.vorname ?? '' : '';
  const nachname = m.profil && 'nachname' in m.profil ? m.profil.nachname ?? '' : '';

  const gewaehlt = auswahlWert(m.funktion, m.funktionForm);
  const funktionOptionen = funktionsOptionen(aktuelleSprache(), { funktion: m.funktion, form: m.funktionForm ?? null })
    .map((o) => `<option value="${escapeHtml(o.wert)}" ${o.wert === gewaehlt ? 'selected' : ''}>${escapeHtml(wort(o.schluessel))}</option>`)
    .join('');

  karte.innerHTML = `
    <label ${verlinkt ? 'hidden' : ''} data-feld="vorname">
      <span>${escapeHtml(wort('crewEdit.vorname'))}</span>
      <input type="text" autocomplete="given-name" value="${escapeHtml(vorname)}">
    </label>
    <label ${verlinkt ? 'hidden' : ''} data-feld="nachname">
      <span>${escapeHtml(wort('crewEdit.nachname'))}</span>
      <input type="text" autocomplete="family-name" value="${escapeHtml(nachname)}">
    </label>
    ${verlinkt ? `<p class="vb-hinweis">${escapeHtml([vorname, nachname].filter(Boolean).join(' ') || '–')}</p>` : ''}
    <label data-feld="funktion">
      <span>${escapeHtml(wort('crewEdit.rolle'))}</span>
      <select>${funktionOptionen}</select>
    </label>
    <label data-feld="geburtsdatum">
      <span>${escapeHtml(wort('crewliste.geburtsdatum'))}</span>
      <input type="date" value="${escapeHtml(anlage9Feld(m.profil, 'geburtsdatum'))}">
    </label>
    <label data-feld="staatsbuergerschaft">
      <span>${escapeHtml(wort('crewliste.staatsbuergerschaft'))}</span>
      <input type="text" value="${escapeHtml(anlage9Feld(m.profil, 'staatsbuergerschaft'))}">
    </label>
    <label data-feld="passnummer">
      <span>${escapeHtml(wort('crewliste.passnummer'))}</span>
      <input type="text" value="${escapeHtml(anlage9Feld(m.profil, 'passnummer'))}">
    </label>
    <p class="vb-status" data-status role="status" aria-live="polite"></p>
  `;

  if (nurName) {
    for (const feld of ['geburtsdatum', 'staatsbuergerschaft', 'passnummer']) {
      karte.querySelector<HTMLElement>(`[data-feld="${feld}"]`)?.setAttribute('hidden', '');
    }
  }

  if (aktuellerToern?.archiviert_am || nurName) {
    karte.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
      .forEach((f) => { f.disabled = true; });
    return karte;
  }
  const speichern = document.createElement('button');
  speichern.type = 'button';
  speichern.className = 'btn';
  speichern.textContent = wort('crewliste.speichern');
  speichern.addEventListener('click', () => {
    void (async () => {
      if (!token || !aktuellerToern) return;
      const statusEl = karte.querySelector('[data-status]');
      const lese = (feld: string): string => (
        karte.querySelector(`[data-feld="${feld}"] input, [data-feld="${feld}"] select`) as HTMLInputElement | HTMLSelectElement | null
      )?.value.trim() ?? '';
      const wahl = leseAuswahlWert(lese('funktion'));
      const aenderung: Parameters<typeof aendereMitglied>[3] = { funktion: (wahl?.funktion ?? m.funktion) as ToernFunktion, form: wahl ? wahl.form : m.funktionForm ?? null };
      if (!verlinkt) {
        const vornameNeu = lese('vorname');
        if (!vornameNeu) {
          if (statusEl) statusEl.textContent = wort('neu.eingabeFehlt');
          return;
        }
        aenderung.vorname = vornameNeu;
        aenderung.nachname = lese('nachname') || null;
      }
      if (aenderung.funktion && nimmtLetztenSkipper(letzteCrew, m.id, aenderung.funktion)) {
        if (statusEl) statusEl.textContent = wort('crewEdit.letzterSkipper');
        return;
      }
      const [okMitglied, okAnlage9] = await Promise.all([
        aendereMitglied(token, aktuellerToern.id, m.id, aenderung),
        schreibeAnlage9(token, aktuellerToern.id, m.id, {
          ...(lese('geburtsdatum') ? { geburtsdatum: lese('geburtsdatum') } : {}),
          ...(lese('staatsbuergerschaft') ? { staatsbuergerschaft: lese('staatsbuergerschaft') } : {}),
          ...(lese('passnummer') ? { passnummer: lese('passnummer') } : {}),
        }),
      ]);
      if (statusEl) statusEl.textContent = wort(okMitglied && okAnlage9 ? 'crewliste.gespeichert' : 'crewliste.fehler');
      await ladeCrew(aktuellerToern.id);
    })();
  });
  karte.appendChild(speichern);
  return karte;
}

function oeffneCrewliste(): void {
  const ziel = $('vb-crewliste-voll');
  if (!ziel) return;
  ziel.innerHTML = '';

  const voll = siehtVolleCrew();
  for (const m of letzteCrew) ziel.appendChild(baueCrewlisteKarte(m, !voll && !m.istIchSelbst));

  const hinweis = $('crewliste-hinweis');
  if (hinweis) hinweis.hidden = !voll;
  const nurNameHinweis = $('crewliste-nur-name');
  if (nurNameHinweis) nurNameHinweis.hidden = voll;
  const status = $('crewliste-status');
  if (status) status.textContent = '';
  if (crewlisteOverlay) crewlisteOverlay.hidden = false;
  crewlisteModal?.beimOeffnen();
}

$('btn-crewliste-oeffnen')?.addEventListener('click', () => { schliesseMehrMenue(); oeffneCrewliste(); });
$('btn-crewliste-oeffnen-2')?.addEventListener('click', oeffneCrewliste);
$('crewliste-schliessen')?.addEventListener('click', schliesseCrewliste);
$('btn-crewliste-schliessen2')?.addEventListener('click', schliesseCrewliste);
crewlisteOverlay?.addEventListener('click', (ev) => { if (ev.target === crewlisteOverlay) schliesseCrewliste(); });

async function sendeNachrichtAnCrew(): Promise<void> {
  if (!token || !aktuellerToern) return;
  const feld = document.getElementById('in-nachricht-text') as HTMLTextAreaElement | null;
  const status = $('vb-nachricht-status');
  const knopf = $('btn-nachricht-senden') as HTMLButtonElement | null;
  const text = feld?.value.trim() ?? '';
  if (!text) {
    if (status) status.textContent = wort('nachricht.leer');
    return;
  }
  if (status) status.textContent = wort('nachricht.sendet');
  if (knopf) knopf.disabled = true;
  const erg = await sendeCrewNachricht(token, aktuellerToern.id, text, aktuelleSprache());
  if (knopf) knopf.disabled = false;
  if (!status) return;
  if (erg.ok) {
    status.textContent = wort('nachricht.gesendet', { anzahl: String(erg.empfaengerAnzahl) });
    if (feld) feld.value = '';
  } else {
    status.textContent = wort(erg.grund === 'keine-empfaenger' ? 'nachricht.keineEmpfaenger' : 'nachricht.fehler');
  }
}

$('btn-nachricht-senden')?.addEventListener('click', () => { void sendeNachrichtAnCrew(); });

$('btn-crewliste-pdf')?.addEventListener('click', () => {
  if (!aktuellerToern) return;

  const tab = pdfZiel(wort('crewliste.pdfLaedt'));
  void (async () => {
    if (!aktuellerToern) return;
    const status = $('crewliste-status');
    if (status) status.textContent = wort('crewliste.pdfLaedt');
    try {
      const blob = await crewblatt(aktuellerToern, letzteCrew, aktuelleSprache());
      await biete(blob, pdfDateiname('crewliste', aktuellerToern.name, aktuelleSprache()), tab);
      if (status) status.textContent = '';
    } catch {
      verwirfZiel(tab);
      if (status) status.textContent = wort('crewliste.pdfFehler');
    }
  })();
});

$('btn-kasse-pdf')?.addEventListener('click', () => {
  if (!aktuellerToern) return;
  const tab = pdfZiel(wort('crewliste.pdfLaedt'));
  void (async () => {
    if (!aktuellerToern) return;
    const status = $('vb-kasse-status');
    try {
      const blob = await bordkassenblatt({ ...kassenEingabe(), toernName: aktuellerToern.name });
      await biete(blob, pdfDateiname('bordkassa', aktuellerToern.name, aktuelleSprache()), tab);
    } catch {
      verwirfZiel(tab);
      if (status) status.textContent = wort('kasse.pdfFehler');
    }
  })();
});

function briefingQuelle(b: GeteiltesBriefing): 'coursecast' | 'voyageplan' | null {
  return b.quelle ?? (/: (Wochenplan|Week plan)$/.test(b.titel) ? 'voyageplan' : null);
}

function zeigeBriefingQuelle(briefings: readonly GeteiltesBriefing[]): void {
  const quellen = new Set(briefings.map(briefingQuelle));
  const woche = quellen.has('voyageplan'), tag = quellen.has('coursecast') || quellen.has(null);
  const marke = $('vb-briefing-marke');
  if (marke) {
    marke.textContent = woche && tag ? 'VoyagePlan · CourseCast'
      : woche ? 'VoyagePlan' : quellen.has('coursecast') || briefings.length === 0 ? 'CourseCast' : 'Briefing';
  }
  const titel = $('vb-briefing-titel');
  if (titel) {
    const schluessel = briefings.length > 1 ? 'detail.briefingTitelAlle'
      : woche ? 'detail.briefingTitelWoche'
        : quellen.has('coursecast') || briefings.length === 0 ? 'detail.briefingTitel' : 'detail.briefingTitelGeteilt';
    titel.dataset['i18n'] = schluessel;
    titel.textContent = wort(schluessel);
  }
}

function briefingEintrag(b: GeteiltesBriefing, sprache: string, offen: boolean): HTMLElement {
  const datum = b.fuer_datum ? new Date(`${b.fuer_datum}T00:00:00`).toLocaleDateString(sprache) : '–';

  const zeitpunkt = new Date(b.erstellt_am).toLocaleDateString(sprache);
  const eintrag = document.createElement('details');
  eintrag.className = 'vb-briefing-eintrag';
  eintrag.open = offen;
  const kopf = document.createElement('summary');
  const name = document.createElement('b');
  name.textContent = b.titel;
  const meta = document.createElement('span');
  meta.className = 'vb-briefing-meta';
  meta.textContent = wort('detail.briefingMeta', { datum, zeitpunkt });
  kopf.append(name, meta);
  eintrag.appendChild(kopf);
  b.abschnitte.forEach((a, i) => {

    const abschnitt = document.createElement('details');
    abschnitt.className = 'vb-briefing-abschnitt';
    abschnitt.open = i === 0;
    const titel = document.createElement('summary');
    titel.textContent = a.titel;
    const text = document.createElement('div');
    text.className = 'vb-briefing-text';
    text.appendChild(sicheresBriefingFragment(a.text));
    abschnitt.append(titel, text);
    eintrag.appendChild(abschnitt);
  });
  return eintrag;
}

function briefingKurz(briefings: readonly GeteiltesBriefing[], sprache: string): string {
  const teile: string[] = [];
  const woche = briefings.find((b) => briefingQuelle(b) === 'voyageplan');
  if (woche) {
    teile.push(wort('detail.briefingKurzWoche', { zeitpunkt: new Date(woche.erstellt_am).toLocaleDateString(sprache) }));
  }
  const tage = briefings.filter((b) => b !== woche);
  if (tage.length > 0) {
    const liste = tage.map((b) => (b.fuer_datum
      ? new Date(`${b.fuer_datum}T00:00:00`).toLocaleDateString(sprache, { day: 'numeric', month: 'numeric' })
      : '–')).join(', ');
    teile.push(wort(tage.length === 1 ? 'detail.briefingKurzTag' : 'detail.briefingKurzTage', { tage: liste }));
  }
  return teile.join(' · ');
}

async function ladeToernplan(toernId: string): Promise<void> {
  if (!token) return;
  const ziel = $('vb-toernplan');
  if (!ziel) return;
  ziel.textContent = '';
  delete ziel.dataset['kurz'];
  delete ziel.dataset['zusammen'];
  const plaene = new Map<string, EtappeDaten[]>();
  await Promise.all(PLAN_SCHLUESSEL.map(async (s) => {
    const etappen = await holeEtappen(token!, toernId, s);
    if (etappen) plaene.set(s, etappen);
  }));
  const auswahl = waehlePlan(plaene);
  if (!auswahl) {
    ziel.textContent = wort('detail.toernplanKeiner');
    return;
  }
  const sprache = aktuelleSprache();
  const zeilen = auswahl.etappen.map(planZeile);
  const fahrtage = zeilen.filter((z) => !z.istHafentag);
  const gesamtSm = fahrtage.reduce((summe, z) => summe + (z.sm ?? 0), 0);
  const name = auswahl.schluessel === 'plan' ? wort('detail.toernplanVonHand')
    : (auswahl.name ?? wort(auswahl.schluessel === 'automatik' ? 'detail.toernplanOption1' : 'detail.toernplanOption2'));
  const werte = {
    name, tage: String(zeilen.length), sm: gesamtSm.toLocaleString(sprache === 'en' ? 'en-GB' : 'de-AT', { maximumFractionDigits: 0 }),
  };
  ziel.dataset['kurz'] = wort('detail.toernplanKurz', werte);
  ziel.dataset['zusammen'] = wort('detail.toernplanZusammen', werte);

  const kopf = document.createElement('p');
  kopf.className = 'vb-toernplan-kopf';
  kopf.textContent = [
    wort('detail.toernplanGezeigt', { name }),
    auswahl.andereOption ? wort('detail.toernplanAndere', {
      name: auswahl.andereOption.name
        ?? wort(auswahl.andereOption.schluessel === 'automatik' ? 'detail.toernplanOption1' : 'detail.toernplanOption2'),
    }) : '',
  ].filter(Boolean).join(' ');
  ziel.appendChild(kopf);

  const liste = document.createElement('ol');
  liste.className = 'vb-toernplan-liste';
  for (const z of zeilen) {
    const li = document.createElement('li');

    const zeile = document.createElement(z.von && z.nach && z.datum ? 'a' : 'div');
    zeile.className = 'vb-plan-zeile';
    const nr = document.createElement('span');
    nr.className = 'vb-plan-nr';
    nr.textContent = String(z.tag);
    const tag = document.createElement('span');
    tag.className = 'vb-toernplan-tag';
    const m = z.datum ? /^(\d{4})-(\d{2})-(\d{2})/.exec(z.datum) : null;
    tag.textContent = m ? `${m[3]}.${m[2]}.` : '';
    const strecke = document.createElement('span');
    strecke.className = 'vb-toernplan-strecke';
    strecke.textContent = z.istHafentag
      ? wort('detail.toernplanHafentag', { ort: lateinisch(z.vonName || z.nachName) })
      : `${lateinisch(z.vonName)} → ${lateinisch(z.nachName)}`;
    const sm = document.createElement('span');
    sm.className = 'vb-toernplan-sm';
    sm.textContent = z.sm != null
      ? `${z.sm.toLocaleString(sprache === 'en' ? 'en-GB' : 'de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${sprache === 'en' ? 'NM' : 'sm'}`
      : '';
    const pfeil = document.createElement('span');
    pfeil.className = 'vb-plan-pfeil';
    pfeil.setAttribute('aria-hidden', 'true');
    zeile.append(nr, tag, strecke, sm, pfeil);
    if (zeile instanceof HTMLAnchorElement) {

      zeile.href = tagesplanungUrl(z.von!, z.nach!, z.datum!, z.wegpunkte.slice(1, -1));
      zeile.title = wort('detail.toernplanTagesplanung');
    }
    li.appendChild(zeile);

    if (z.wegpunkte.length >= 2) {
      const nav = document.createElement('a');
      nav.className = 'vb-plan-nav';
      nav.href = navUrl(z.wegpunkte, { vonName: lateinisch(z.vonName) || null, nachName: lateinisch(z.nachName) || null, quelle: 'voyagebook' });
      nav.innerHTML = icon('navigation');
      const t = document.createElement('span');
      t.textContent = wort('detail.toernplanNav');
      nav.appendChild(t);
      li.appendChild(nav);
    }
    liste.appendChild(li);
  }
  ziel.appendChild(liste);
  const tipp = document.createElement('p');
  tipp.className = 'vb-toernplan-tipp';
  tipp.textContent = wort('detail.toernplanTipp');
  ziel.appendChild(tipp);
}

async function ladeBriefing(toernId: string): Promise<void> {
  if (!token) return;
  const ziel = $('vb-briefing');
  if (!ziel) return;
  ziel.textContent = '';
  delete ziel.dataset['kurz'];
  delete ziel.dataset['zusammen'];
  try {
    const briefings = await holeBriefings(token, toernId);
    if (briefings === null) throw new Error('Netz');
    zeigeBriefingQuelle(briefings);
    if (briefings.length === 0) {
      ziel.textContent = wort('detail.briefingKeine');
      return;
    }
    const sprache = aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT';
    const zusammen = briefingKurz(briefings, sprache);
    ziel.dataset['zusammen'] = zusammen;
    ziel.dataset['kurz'] = `${zusammen}; ${wort('detail.briefingKurzDetails')}`;

    for (const b of briefings) ziel.appendChild(briefingEintrag(b, sprache, briefings.length === 1));
  } catch {
    ziel.textContent = wort('detail.briefingFehler');
  }
}

$('btn-zurueck')?.addEventListener('click', () => {
  aktuellerToern = null;
  setzeTiefgang(null);
  zeigeAnsicht('liste');
  void ladeListe();
});

$('btn-toern-archivieren')?.addEventListener('click', () => {
  void (async () => {
    if (!token || !aktuellerToern) return;
    schliesseMehrMenue();
    if (!window.confirm(wort('detail.archivierenBestaetigung'))) return;
    const ok = await archiviereToern(token, aktuellerToern.id);
    const status = $('vb-detail-status');
    if (status) status.textContent = ok ? wort('detail.archiviert') : wort('detail.crewLinkFehler');
    if (ok) await oeffneDetail(aktuellerToern.id);
  })();
});

$('btn-toern-loeschen')?.addEventListener('click', () => {
  void (async () => {
    if (!token || !aktuellerToern) return;
    if (aktuellerToern.archiviert_am) {
      const status = $('vb-detail-status');
      if (status) status.textContent = wort('detail.loeschenGesperrt');
      return;
    }
    schliesseMehrMenue();
    if (!window.confirm(wort('detail.loeschenBestaetigung'))) return;
    const ok = await loescheToern(token, aktuellerToern.id);
    if (ok) {
      aktuellerToern = null;
      zeigeAnsicht('liste');
      await ladeListe();
    }
  })();
});

async function bearbeiteEinladung(einladungsToken: string): Promise<void> {
  zeigeAnsicht('einladung');
  const textEl = $('vb-einladung-text');
  const status = $('vb-einladung-status');
  const btn = $('btn-einladung-annehmen') as HTMLButtonElement | null;
  if (textEl) textEl.textContent = wort('einladung.laedt');

  const vorschau = await holeEinladungsVorschau(einladungsToken);
  if (!vorschau) {
    if (textEl) textEl.textContent = wort('einladung.ungueltig');
    if (btn) btn.hidden = true;
    return;
  }

  fuelleEinladung({
    name: vorschau.toernName,
    revier: vorschau.revier,
    zeitraum: zeitraumText(vorschau),
    start: vorschau.startpunkt,
    nutzung: wort(YACHTNUTZUNG_WORT[vorschau.yachtnutzung]),
  }, wort('detail.keineAngabe'));
  if (vorschau.bereitsEingeloest) {
    if (textEl) textEl.textContent = wort('einladung.bereitsEingeloest');
    if (btn) btn.hidden = true;
    return;
  }
  if (textEl) {
    textEl.textContent = wort('einladung.text', { name: vorschau.toernName, funktion: funktionsText(vorschau) });
  }

  const fotoWrap = $('vb-einladung-foto');
  const fotoImg = document.getElementById('vb-einladung-foto-bild') as HTMLImageElement | null;
  if (fotoWrap && fotoImg) {
    fotoImg.onload = () => { fotoWrap.hidden = false; };
    fotoImg.onerror = () => { fotoWrap.hidden = true; };
    fotoImg.src = schiffFotoUrl(vorschau.toernId);
  }
  if (btn) {
    btn.hidden = false;
    btn.textContent = token ? wort('einladung.annehmen') : wort('einladung.annehmenAnmelden');
    btn.onclick = () => {
      if (!token) {
        window.location.href = `/?login=1&next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      void (async () => {
        const erg = await loeseEinladungEin(token, einladungsToken);
        if (!erg) {
          if (status) status.textContent = wort('einladung.fehler');
          return;
        }
        btn.hidden = true;

        const profil = await holeEigenesProfil(token);
        if (!istProfilVollstaendig(profil)) {
          const next = `/voyagebook/?willkommen=${encodeURIComponent(erg.toernId)}`;
          window.location.href = `/?profil=1&next=${encodeURIComponent(next)}&hinweis=crew`;
          return;
        }
        if (status) status.textContent = wort('einladung.willkommen', { name: vorschau.toernName });
        window.setTimeout(() => { void oeffneDetail(erg.toernId); }, 800);
      })();
    };
  }
}

aufSprachwechsel(() => {
  zeichneBordkasse();

  for (const id of ['in-crew-funktion', 'in-toern-meine-funktion', 'in-crew-edit-funktion']) fuelleFunktionsfeld(id);
  zeigeSkipperForm();

  zeigePolarHinweis();

  const einladungOffen = $('vb-einladung-ansicht')?.hidden === false;
  const detailOffen = $('vb-detail-ansicht')?.hidden === false;

  if (einladungOffen) {
    if (einladungsToken) void bearbeiteEinladung(einladungsToken);
    return;
  }
  if (detailOffen) {

    if (aktuellerToern) void oeffneDetail(aktuellerToern.id);
    return;
  }
  void ladeListe();
});

const willkommenToernId = params.get('willkommen');

const neuerToernNachProfil = params.get('neuerToern') === '1';

if (einladungsToken) {
  void bearbeiteEinladung(einladungsToken);
} else if (willkommenToernId) {
  zeigeAnsicht('liste');
  void (async () => {
    await ladeListe();
    await oeffneDetail(willkommenToernId);

    if (!token) return;
    const toern = await holeToern(token, willkommenToernId);
    const status = $('vb-detail-status');
    if (status && toern) status.textContent = wort('einladung.willkommen', { name: toern.name });
  })();
} else if (neuerToernNachProfil) {
  zeigeAnsicht('liste');
  void ladeListe().then(() => { void pruefeProfilUndOeffneNeuerToern(); });
} else {
  zeigeAnsicht('liste');
  void ladeListe();
}

function zeigeYacht(t: ToernZeile): void {
  const s = t.schiff;
  const kraftstoff = kraftstoffFuerSchiff({ typ: s.typ, laengeM: s.laengeM, motorPS: s.motorPS });
  const name = $('vb-yacht-name');
  const typ = $('vb-yacht-typ');
  if (name) {

    const flagge = seeflaggeSvg(flaggeDesToerns(s, t.revier), 18, aktuelleSprache());
    name.innerHTML = (flagge ? `${flagge} ` : '') + escapeHtml(s.name || wort('detail.yachtOhneName'));
  }
  if (typ) typ.textContent = s.typ || wort('detail.yachtOhneTyp');
  const zahl = (v: number | null | undefined, einheit: string, stellen = 1): string | null =>
    v == null ? null : `${v.toLocaleString(aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT', { maximumFractionDigits: stellen })}${einheit ? ` ${einheit}` : ''}`;
  const werte: [string, string | null][] = [
    ['detail.yachtLaenge', zahl(s.laengeM, 'm')], ['detail.yachtBreite', zahl(s.breiteM, 'm')],
    ['detail.yachtTiefgang', zahl(s.tiefgangM, 'm')], ['detail.yachtVerdraengung', zahl(s.verdraengungT, 't')],
    ['detail.yachtMotor', zahl(s.motorPS, 'PS', 0)], ['detail.yachtBaujahr', s.baujahr ? String(s.baujahr) : null],

    ['detail.yachtVerbrauch', s.verbrauchLh != null ? zahl(s.verbrauchLh, 'l/h') : (kraftstoff ? zahl(kraftstoff.verbrauchLh, 'l/h') + ' (' + wort(kraftstoff.verbrauchQuelle === 'modell' ? 'detail.modelldurchschnitt' : 'detail.richtwert') + ')' : null)],
    ['detail.yachtTank', s.tankL != null ? zahl(s.tankL, 'l', 0) : (kraftstoff ? zahl(kraftstoff.tankL, 'l', 0) + ' (' + wort(kraftstoff.tankQuelle === 'modell' ? 'detail.herstellerangabe' : 'detail.richtwert') + ')' : null)],
    ['detail.yachtFlagge', ((c) => (c ? [c, seeflagge(c)?.name[aktuelleSprache()]].filter(Boolean).join(' · ') : null))(flaggeDesToerns(s, t.revier))],
    ['detail.yachtMmsi', s.mmsi || null],
  ];
  const dl = $('vb-yacht-werte');
  if (dl) {
    dl.innerHTML = werte.map(([k, v]) => `<div><dt>${escapeHtml(wort(k))}</dt><dd${v ? '' : ' class="vb-wert-leer"'}>${escapeHtml(v ?? '–')}</dd></div>`).join('');
  }
  const polare = $('vb-yacht-polare');
  if (polare) {
    const v = polareFuerSchiff({ typ: s.typ, laengeM: s.laengeM });
    polare.textContent = !v
      ? wort('detail.polareReferenz', { b: waehlePolare({}).boot.name })
      : wort(v.guete === 'exakt' ? 'detail.polareExakt' : v.guete === 'aehnlich' ? 'detail.polareAehnlich' : 'detail.polareGeschaetzt', { b: v.boot.name });
  }

  const bild = $('vb-yacht-foto-bild') as HTMLImageElement | null;
  const leer = $('vb-yacht-foto-leer');
  if (bild && leer) {
    bild.hidden = true;
    leer.hidden = false;
    bild.onload = () => { bild.hidden = false; leer.hidden = true; };
    bild.onerror = () => { bild.hidden = true; leer.hidden = false; };
    bild.alt = wort('detail.yachtFotoAlt', { name: s.name || t.name });
    bild.src = `${schiffFotoUrl(t.id)}?t=${Date.now()}`;
  }
}

function schliesseMehrMenue(): void {
  const panel = $('vb-mehr-panel');
  if (panel) panel.hidden = true;
  $('btn-toern-mehr')?.setAttribute('aria-expanded', 'false');
}

function passeMehrMenueEin(panel: HTMLElement): void {
  panel.style.removeProperty('right');
  panel.style.removeProperty('left');
  const eltern = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect();
  if (!eltern) return;
  const r = panel.getBoundingClientRect();
  const rand = 8;
  const links = Math.max(rand, Math.min(r.left, window.innerWidth - rand - r.width));
  if (Math.abs(links - r.left) > 0.5) { panel.style.right = 'auto'; panel.style.left = `${Math.round(links - eltern.left)}px`; }
}

function initMehrMenue(): void {
  const knopf = $('btn-toern-mehr');
  const panel = $('vb-mehr-panel');
  if (!knopf || !panel) return;
  knopf.addEventListener('click', (e) => {
    e.stopPropagation();
    const auf = panel.hidden;
    panel.hidden = !auf;
    knopf.setAttribute('aria-expanded', String(auf));
    if (auf) { passeMehrMenueEin(panel); panel.querySelector<HTMLElement>('button:not([hidden])')?.focus(); }
  });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target as Node)) schliesseMehrMenue(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { schliesseMehrMenue(); knopf.focus(); } });
}

(() => {
  const main = $('vb-main');
  const box = $('in-menu-toernliste') as HTMLInputElement | null;
  let an = true;
  try { an = localStorage.getItem(SCHLUESSEL.buchListe) !== '0'; } catch {  }
  const setze = (wert: boolean): void => { if (main) main.dataset['liste'] = wert ? 'an' : 'aus'; };
  setze(an);
  if (box) {
    box.checked = an;
    box.addEventListener('change', () => {
      setze(box.checked);
      try { localStorage.setItem(SCHLUESSEL.buchListe, box.checked ? '1' : '0'); } catch {  }
    });
  }
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    })
    .catch((err) => console.warn('Service Worker nicht registriert:', err));
}

ladebildWeg();

$('in-toern-tiefgang')?.addEventListener('input', (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value.replace(',', '.'));
  setzeTiefgang(Number.isFinite(v) ? v : null);
});
