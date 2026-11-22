import 'leaflet/dist/leaflet.css';
import { setzeTiefgang } from '@/map/seekarte';
import '@/shell/tokens.css';
import './style.css';
import { startBeimOeffnen } from '@/ui/standortStart';
import { startAusPosition } from '@/data/navroute';

import { sampleRoute } from '@/core/geo';
import { halteDerRoute, ordneHalteZu } from '@/core/halt';
import { escapeHtml } from '@/core/html';
import { frageHalt } from '@/ui/haltDialog';
import { umfahreWegpunkte, type UmfahreneRoute } from '@/data/umfahrung';
import { navUrl } from '@/core/navUebergabe';
import { fetchTiefe, fetchTiefeNahe, fetchTiefenprofil } from '@/data/bathymetrie';
import { braucheSuche, zieltiefe } from '@/core/tiefe';
import { fetchSeegebiet } from '@/data/seegebiete';
import { hoheitsStaat } from '@/briefing/seegebiet';
import type { Tiefenlage } from '@/briefing/tiefe';
import type { HafensteckbriefEingabe } from '@/briefing/hafeninfo';
import { nDate, uhrLt, nf, nowInRevier, zuRevierzeit, vonRevierzeit, localDateStr, aufRaster, versatzAmTag, alsUtc, datumUhrLt, uhrLtVon } from '@/core/time';
import { gezeitenLage, lageVerschoben } from '@/core/gezeitenLage';
import type { GezeitenStation } from '@/core/gezeitenStationen';
import { naechsteZeitzone } from '@/core/revierZeitzone';
import type { GezeitenAbsatzEingabe } from '@/briefing/gezeiten';
import { sonnenzeiten, DAEMMERUNGSWINKEL } from '@/core/sun';
import { saisonLage, marinaVermutlichVoll } from '@/core/season';
import { evaluateDeparture, wasserstandAn, zuschlagUnterwegs } from '@/core/evaluate';
import { messinaAblegezeit } from '@/core/messinaStrom';
import { messinaNachtBis, ergaenzeMessinaNacht } from '@/core/tagesfenster';
import { ablegenFuerAnkunft, ankunftsZeitpunkt } from '@/core/ankunftszeit';
import { istUnfahrbar } from '@/briefing/verdict';
import { sucheAlternativroute, alternativText, type AlternativVorschlag } from './alternativroute';
import { dunkelphasen, istNachtfahrt, dunkelMinuten } from '@/core/darkness';
import { antriebsphasen } from '@/core/antrieb';
import { verlaufAbschnitte } from '@/briefing/profile';
import { fetchWindForPoints, fetchDaylight } from '@/data/openMeteo';
import { vergleicheModelle } from '@/core/modellabgleich';
import { fetchWindEnsemble } from '@/data/ensemble';
import { fetchCurrentForPoints } from '@/data/marine';
import { OpenMeteoUeberlastet, OpenMeteoKontingent } from '@/data/openMeteoNetz';
import { polareFuerSchiff } from '@/core/polarwahl';
import { kraftstoffFuerSchiff, type KraftstoffAngabe } from '@/core/kraftstoff';
import { findAnkerplatzArt } from '@/data/overpass';
import { hafenSteckbrief } from '@/data/hafeninfo';
import { ortsbezeichnung } from '@/data/places';
import { naechsterBenannterOrt } from '@/data/geocode';
import { kuestenlinienRueckfall } from '@/data/kuestenlinienFallback';
import {
  dhmzWarnungen, hnmsWarnungen, meteomarWarnungen, hnmsAusgabeStunde, meteomarGueltigkeit, warnlageEntlang, ohneOrtsangabe,
  type Warnangabe, type WarnKontext, BFT_KN,
} from '@/core/warnlage';
import { ortsbezug, type Bezugsort } from '@/core/ortsbezug';
import { luvFetchNM } from '@/core/shelter';
import { seegebieteAn } from '@/core/hnmsSeegebiet';
import type { HnmsGebietDaten } from '@/core/hnmsSeegebieteDaten';
import { kritischTexte, staerkeText, type KritischTexte } from '@/briefing/kritisch';
import { findeAusweichziele } from '@/data/alternatives';
import { sucheSkipperGuideEintrag } from '@/data/skipperguide';
import { holeDhmzBericht } from '@/data/dhmz';
import { ladeHnmsSeegebiete } from '@/data/hnms';
import { holeGebietsBericht, ladeMeteomarSeegebiete } from '@/data/seebericht';
import { holeWarnungen } from '@/data/warnungen';
import { rahmenUm, warnungenFuer, type WarnTreffer } from '@/core/warnungen';
import { seegebieteEntlang, istGriechisch } from '@/core/hnmsSeegebiet';
import { mgmGebieteEntlang } from '@/core/mgmSeegebiet';
import { seeberichtLand, inAdriaBox, beiZypern, passendeGebiete, ZYPERN_KUESTE, gewaesserStaat, staatGefragt } from '@/core/seeberichtWahl';
import { aemetRegionenEntlang } from '@/core/aemetRegion';
import { empfehlungMitVorbehalt } from '@/ui/ergebnisTabelle';
import { gebietsBerichtAlsAmtlich, amtlicherVorbehalt, giltFuer, type AmtlicherBericht } from '@/briefing/amtlich';
import { fetchDruckfeld } from '@/data/druckfeld';
import { analysiereDruckfeld, naechsterSchnappschuss } from '@/core/druckfeld';
import { holeGitterUm } from '@/data/copernicusMarine';
import type { CopernicusGitter } from '@/core/copernicusMarine';
import type { Ablegezeit, AnkerplatzArt, Punkt } from '@/core/types';
import { parseKoordinatenEingabe, positionText } from '@/core/koordinaten';
import { anzeigeKn } from '@/briefing/wind';
import { describeRevierWetter } from '@/briefing/overview';
import { synoptik } from '@/briefing/synoptik';
import { briefTitel } from '@/briefing/title';
import type { NachtfahrtEingabe } from '@/briefing/nightpassage';
import { parseGpx, buildGpx } from '@/ui/gpx';
import { listeRouten, routeSpeichern, routeLoeschen, routeFinden } from '@/ui/savedRoutes';
import { RouteMap, type RoutenPunkt, type LandMeldung, type TrackPunkt, type SpitzenwertMarker, type KritischMarker } from '@/ui/map';
import { routeWindTrack } from '@/ui/routeTrack';
import { initColResizer, initRowResizer, widenForResults } from '@/ui/resizer';
import * as offline from './offline';
import { renderRecommendation, renderStrip, renderTable, initStripSlider, type AmtlichStand } from '@/ui/results';
import { renderTagesvergleich, type LetzterLauf } from '@/ui/multiday';
import {
  syncSpeedModel, fuelleTagesauswahl, setzeRevierZeitzone, initAnkunft, fuelleBootsauswahl, leseSchiffConfig, leseGrenzwerte,
  leseSuchfenster, istEingabeFehler, initSliders, alsProzent, AB_JETZT, AB_JETZT_STUNDEN, UNTERWEGS,
} from '@/ui/form';
import { initSprache, aktuelleSprache, aufSprachwechsel, sichereSpracheWahl } from '@/shell/sprache';
import { STRINGS, TITLE, DESCRIPTION, TOUR_STEPS } from '@/ui/strings';
import { setzeAppTexte } from '@/shell/strings';
import { initTheme, setzeReferenzOrt, sichereThemeWahl } from '@/shell/theme';
import { merktSich, setzeMerktSich } from '@/shell/merken';
import { initTour } from '@/shell/tour';
import { initUserMenu, liesSitzungsToken } from '@/shell/session';
import { holeAktivenToern } from '@/data/toernApi';
import { initIcons } from '@/shell/icons';
import { initHandbuchModal } from '@/shell/handbuch';
import { initSupport } from '@/shell/support';
import { initKompendium } from '@/shell/kompendium';
import { initTechnik } from '@/shell/technik';
import { ladebildGezeichnet, ladebildWeg } from '@/shell/ladebild';

async function holeCopernicusGitterFuerRoute(punkte: { lat: number; lon: number }[]): Promise<CopernicusGitter | null> {

  return holeGitterUm(punkte, 1);
}

await ladebildGezeichnet();

initIcons();
setzeAppTexte({ titel: TITLE, beschreibung: DESCRIPTION, strings: STRINGS, tour: TOUR_STEPS });

initSprache();

initTheme();

initTour();
initUserMenu();
initHandbuchModal();
initSupport('coursecast');
initKompendium();

initTechnik();

const merkenCheckbox = document.getElementById('in-menu-merken') as HTMLInputElement | null;
if (merkenCheckbox) {
  merkenCheckbox.checked = merktSich();
  merkenCheckbox.addEventListener('change', () => {
    setzeMerktSich(merkenCheckbox.checked);

    if (merkenCheckbox.checked) {
      sichereSpracheWahl();
      sichereThemeWahl();
    }
  });
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Element #${id} fehlt`);
  return e as T;
}

const statusEl = el<HTMLDivElement>('status');

function setStatus(text: string, fehler = false): void {
  statusEl.className = fehler ? 'err' : '';
  statusEl.textContent = text;
}

const ladeOverlayEl = el<HTMLDivElement>('lade-overlay');

function zeigeLadeanzeige(): void {
  ladeOverlayEl.hidden = false;
}
function versteckeLadeanzeige(): void {
  ladeOverlayEl.hidden = true;
}

function refreshPointList(route: RoutenPunkt[]): void {
  const listEl = el<HTMLDivElement>('pointlist');
  const en = aktuelleSprache() === 'en';
  if (route.length === 0) {
    listEl.textContent = STRINGS[aktuelleSprache()]['pointlist.hint']!;
    return;
  }
  listEl.innerHTML = route.map((p, i) => {
    const istStart = i === 0, istZiel = i === route.length - 1 && route.length > 1;
    const cls = istStart ? 's' : (istZiel ? 'z' : 'w');
    const nm = istStart ? 'START' : (istZiel ? (en ? 'DEST' : 'ZIEL') : 'WP' + i);

    if (!istStart && !istZiel) {
      const h = p.halt ? ` · ${p.halt.text ? `${escapeHtml(p.halt.text)}, ` : ''}${p.halt.min} min` : '';
      const titel = en ? 'Stop at this waypoint' : 'Aufenthalt an diesem Wegpunkt';
      return `<button type="button" class="tag ${cls} tag-wp" data-wp="${i}" title="${titel}">${nm} ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}${h}</button>`;
    }
    return `<span class="tag ${cls}">${nm} ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</span>`;
  }).join('');
  if (route.length === 1) {
    listEl.innerHTML += `<span class="tag" style="border-style:dashed;">`
      + (en ? 'at least one more point needed' : 'noch mindestens ein Punkt nötig') + '</span>';
  }
}

function renderLandWarnungen(meldungen: LandMeldung[]): void {
  const box = el<HTMLDivElement>('land-warn');
  box.hidden = meldungen.length === 0;
  box.innerHTML = meldungen.map((m) => m.art === 'warnung'
    ? `<div>⚠ ${m.text}</div>`
    : `<div class="land-info">ℹ ${m.text}</div>`).join('');
}

let zonenStationen: Promise<readonly GezeitenStation[] | null> | null = null;
async function pruefeRevierZeitzone(punkt: { lat: number; lon: number } | undefined): Promise<void> {
  if (!punkt) return;
  zonenStationen ??= import('@/core/gezeitenStationen').then((m) => m.GEZEITEN_STATIONEN).catch(() => null);
  const st = await zonenStationen;
  if (st && setzeRevierZeitzone(naechsteZeitzone(punkt.lat, punkt.lon, st))) fuelleTagesauswahl();
}

const routeMap = new RouteMap('map', () => {
  refreshPointList(routeMap.route);
  void pruefeRevierZeitzone(routeMap.route[0]);
  el<HTMLButtonElement>('btn-undo').disabled = routeMap.route.length === 0;
  el<HTMLButtonElement>('btn-reset').disabled = routeMap.route.length === 0;
  el<HTMLButtonElement>('btn-gpx-export').disabled = routeMap.route.length < 2;
  el<HTMLButtonElement>('btn-an-nav').disabled = routeMap.route.length < 2;
  el<HTMLButtonElement>('btn-route-save').disabled = routeMap.route.length < 2;

  setzeReferenzOrt(routeMap.route[0] ? { lat: routeMap.route[0].lat, lon: routeMap.route[0].lon } : null);
}, renderLandWarnungen);
refreshPointList(routeMap.route);

el<HTMLDivElement>('pointlist').addEventListener('click', (e) => {
  const knopf = (e.target as HTMLElement).closest<HTMLButtonElement>('button.tag-wp');
  const i = Number(knopf?.dataset['wp']);
  const p = routeMap.route[i];
  if (!knopf || !p || i <= 0 || i >= routeMap.route.length - 1) return;
  void frageHalt(i, p.halt, aktuelleSprache()).then((h) => { p.halt = h; routeMap.redrawPoints(); });
});

const tiefgangFeld = document.getElementById('in-tiefgang') as HTMLInputElement | null;
const tiefgangAnKarte = (): void => { const v = tiefgangFeld ? parseFloat(tiefgangFeld.value) : Number.NaN; setzeTiefgang(Number.isFinite(v) ? v : null); };
tiefgangFeld?.addEventListener('input', tiefgangAnKarte);
tiefgangFeld?.addEventListener('change', tiefgangAnKarte);
tiefgangAnKarte();
window.addEventListener('load', () => window.setTimeout(tiefgangAnKarte, 500));

aufSprachwechsel(() => refreshPointList(routeMap.route));
initColResizer(() => routeMap.map.invalidateSize());

initRowResizer(() => routeMap.map.invalidateSize());

el<HTMLButtonElement>('btn-undo').addEventListener('click', () => routeMap.undo());
el<HTMLButtonElement>('btn-reset').addEventListener('click', () => {
  routeMap.reset();
  el<HTMLDivElement>('results').style.display = 'none';
  setStatus('');
});

const gpxInput = el<HTMLInputElement>('in-gpx');
el<HTMLButtonElement>('btn-gpx').addEventListener('click', () => gpxInput.click());
gpxInput.addEventListener('change', async () => {
  const datei = gpxInput.files?.[0];
  gpxInput.value = '';
  if (!datei) return;
  try {
    const text = await datei.text();
    const punkte = parseGpx(text);
    routeMap.setRoute(punkte);
    el<HTMLDivElement>('results').style.display = 'none';
    setStatus(aktuelleSprache() === 'en'
      ? `${punkte.length} points taken from "${datei.name}".`
      : `${punkte.length} Punkte aus "${datei.name}" übernommen.`);
  } catch (err) {
    setStatus((aktuelleSprache() === 'en' ? 'GPX import failed: ' : 'GPX-Import fehlgeschlagen: ') + (err as Error).message, true);
  }
});

const koordinatenBtn = el<HTMLButtonElement>('btn-koordinaten');
const koordinatenPanel = el<HTMLDivElement>('koordinaten-panel');
koordinatenBtn.addEventListener('click', () => {
  const offen = !koordinatenPanel.hidden;
  koordinatenPanel.hidden = offen;
  koordinatenBtn.setAttribute('aria-expanded', String(!offen));
  if (!offen) el<HTMLInputElement>('in-koordinaten').focus();
});

function uebernimmKoordinaten(): void {
  const en = aktuelleSprache() === 'en';
  const feld = el<HTMLInputElement>('in-koordinaten');
  const roh = feld.value.trim();
  if (!roh) return;
  const ergebnis = parseKoordinatenEingabe(roh);
  if (!ergebnis.ok) {
    setStatus((en ? 'Invalid position: ' : 'Ungültige Position: ') + `"${ergebnis.ungueltigeZeile}"`, true);
    return;
  }
  const { punkte } = ergebnis;
  if (punkte.length === 0) return;
  routeMap.setRoute([...routeMap.route, ...punkte]);
  el<HTMLDivElement>('results').style.display = 'none';
  const gesamt = routeMap.route.length;
  setStatus(en
    ? `${punkte.length === 1 ? 'Point added' : `${punkte.length} points added`}, ${gesamt} in the route.`
    : `${punkte.length === 1 ? 'Punkt ergänzt' : `${punkte.length} Punkte ergänzt`}, ${gesamt} in der Route.`);
  feld.value = '';
  feld.focus();
}
el<HTMLButtonElement>('btn-koordinaten-uebernehmen').addEventListener('click', uebernimmKoordinaten);

el<HTMLInputElement>('in-koordinaten').addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  uebernimmKoordinaten();
});

let letzteStrecke: { schluessel: string; punkte: Punkt[]; von: string | null; nach: string | null } | null = null;
const routenSchluessel = (r: readonly Punkt[]) => r.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(';');
el<HTMLButtonElement>('btn-an-nav').addEventListener('click', () => {
  if (routeMap.route.length < 2) return;
  const passt = letzteStrecke?.schluessel === routenSchluessel(routeMap.route) ? letzteStrecke : null;
  window.location.href = navUrl(passt?.punkte ?? routeMap.route, {
    vonName: passt?.von ?? null, nachName: passt?.nach ?? null, quelle: 'coursecast',
  });
});

el<HTMLButtonElement>('btn-gpx-export').addEventListener('click', () => {
  if (routeMap.route.length < 2) return;
  const gpx = buildGpx(routeMap.route);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `route-${localDateStr(new Date())}.gpx`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(aktuelleSprache() === 'en' ? 'Route downloaded as a GPX file.' : 'Route als GPX-Datei heruntergeladen.');
});

const savedRoutesSel = el<HTMLSelectElement>('in-saved-routes');
function refreshSavedRoutesSelect(): void {
  const vorher = savedRoutesSel.value;
  const platzhalter = STRINGS[aktuelleSprache()]['savedRoutes.placeholder'];
  const einheit = aktuelleSprache() === 'en' ? 'points' : 'Punkte';

  savedRoutesSel.replaceChildren(new Option(platzhalter ?? '', ''),
    ...listeRouten().map((r) => new Option(`${r.name} (${r.points.length} ${einheit})`, r.name)));
  if ([...savedRoutesSel.options].some((o) => o.value === vorher)) savedRoutesSel.value = vorher;
}
refreshSavedRoutesSelect();

aufSprachwechsel(refreshSavedRoutesSelect);
aufSprachwechsel(() => { if (alternativJetzt) zeigeAlternativroute(alternativJetzt); });

el<HTMLButtonElement>('btn-route-save').addEventListener('click', () => {
  if (routeMap.route.length < 2) return;
  const en = aktuelleSprache() === 'en';
  const name = window.prompt(en ? 'Name for the route:' : 'Name für die Route:', savedRoutesSel.value || '');
  if (!name) return;

  routeSpeichern(name, routeMap.route.map((p) => ({ lat: p.lat, lon: p.lon, ...(p.halt !== undefined ? { halt: p.halt } : {}) })));
  refreshSavedRoutesSelect();
  savedRoutesSel.value = name;
  setStatus(en ? `Route "${name}" saved.` : `Route „${name}" gespeichert.`);
});

el<HTMLButtonElement>('btn-route-load').addEventListener('click', () => {
  const name = savedRoutesSel.value;
  if (!name) return;
  const en = aktuelleSprache() === 'en';
  const route = routeFinden(name);
  if (!route) { setStatus(en ? `Route "${name}" was not found.` : `Route „${name}" wurde nicht gefunden.`, true); return; }
  routeMap.setRoute(route.points);
  el<HTMLDivElement>('results').style.display = 'none';
  setStatus(en ? `Route "${name}" loaded (${route.points.length} points).` : `Route „${name}" geladen (${route.points.length} Punkte).`);
});

el<HTMLButtonElement>('btn-route-delete').addEventListener('click', () => {
  const name = savedRoutesSel.value;
  if (!name) return;
  routeLoeschen(name);
  refreshSavedRoutesSelect();
  setStatus(aktuelleSprache() === 'en' ? `Route "${name}" deleted.` : `Route „${name}" gelöscht.`);
});

fuelleTagesauswahl();
initAnkunft();
fuelleBootsauswahl();

function uebernimmAusAdresszeile(): void {
  const params = new URLSearchParams(window.location.search);
  const route = params.get('route');
  if (route) {
    const ergebnis = parseKoordinatenEingabe(route.replace(/;/g, '\n'));
    if (ergebnis.ok && ergebnis.punkte.length >= 2) routeMap.setRoute(ergebnis.punkte);
  }
  const datum = params.get('datum');
  if (datum) {
    const dateSel = el<HTMLSelectElement>('in-date');

    if ([...dateSel.options].some((o) => o.value === datum)) dateSel.value = datum;
  }
}
uebernimmAusAdresszeile();

let aktiverToernName: string | null = null;

let toernKraftstoff: KraftstoffAngabe | null = null;
function zeichneToernZeile(): void {
  const zeile = document.getElementById('cc-toern-zeile');
  const nameEl = document.getElementById('cc-toern-zeile-name');
  if (!zeile || !nameEl || !aktiverToernName) return;
  nameEl.textContent = `${STRINGS[aktuelleSprache()]['toern.praefix']} ${aktiverToernName}`;
  zeile.hidden = false;
}

aufSprachwechsel(zeichneToernZeile);

void (async () => {
  const token = liesSitzungsToken();
  if (!token) return;
  const abfrage = await holeAktivenToern(token);
  if (abfrage.lage !== 'geliefert' || !abfrage.toern) return;
  const toern = abfrage.toern;

  aktiverToernName = toern.name;
  toernKraftstoff = kraftstoffFuerSchiff(toern.schiff);
  zeichneToernZeile();

  const neuBestimmt = polareFuerSchiff(toern.schiff)?.boot.id ?? null;
  const polarId = neuBestimmt ?? toern.schiff.polarId;
  if (polarId) {
    const sel = el<HTMLSelectElement>('in-boat');
    if ([...sel.options].some((o) => o.value === polarId)) sel.value = polarId;
  }

  if (toern.crew_faktor != null) {
    const crewfactor = el<HTMLInputElement>('in-crewfactor');
    crewfactor.value = String(toern.crew_faktor);
    el<HTMLSpanElement>('out-crewfactor').textContent = alsProzent(toern.crew_faktor);
  }
  if (toern.crew_zumutbarkeit != null) {
    const crewzumutbarkeit = el<HTMLInputElement>('in-crewzumutbarkeit');
    crewzumutbarkeit.value = String(toern.crew_zumutbarkeit);
    el<HTMLSpanElement>('out-crewzumutbarkeit').textContent = alsProzent(toern.crew_zumutbarkeit);
  }
})();

aufSprachwechsel(fuelleTagesauswahl);
aufSprachwechsel(fuelleBootsauswahl);
el<HTMLSelectElement>('in-speedmodel').addEventListener('change', syncSpeedModel);
syncSpeedModel();
initSliders();

let laufToken = 0;

let alternativJetzt: AlternativVorschlag | null = null;
function zeigeAlternativroute(v: AlternativVorschlag | null): void {
  alternativJetzt = v;
  const box = document.getElementById('alternativroute');
  routeMap.setAlternative(v?.punkte ?? null);
  if (!box) return;
  if (!v) { box.hidden = true; box.textContent = ''; return; }
  const en = aktuelleSprache() === 'en';
  box.textContent = '';
  const p = document.createElement('p');
  p.textContent = alternativText(v, aktuelleSprache());
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'btn';
  knopf.textContent = en ? 'Use the alternative route' : 'Alternativroute übernehmen';
  knopf.addEventListener('click', () => {
    routeMap.setRoute(v.punkte);
    el<HTMLButtonElement>('btn-calc').click();
  });
  box.append(p, knopf);
  box.hidden = false;
}

let letzterLauf: LetzterLauf | null = null;

const tagesvergleichBox = el<HTMLDetailsElement>('box-tagesvergleich');
tagesvergleichBox.addEventListener('toggle', () => {
  if (!tagesvergleichBox.open || !letzterLauf) return;
  const dateSel = el<HTMLSelectElement>('in-date');
  const tage = [...dateSel.options].filter((o) => o.value !== AB_JETZT && o.value !== UNTERWEGS).map((o) => ({ dateStr: o.value, label: o.textContent ?? o.value }));
  renderTagesvergleich(tage, letzterLauf, dateSel.value, (dateStr) => {
    dateSel.value = dateStr;
    tagesvergleichBox.open = false;
    el<HTMLButtonElement>('btn-calc').click();
  });
});

el<HTMLButtonElement>('btn-calc').addEventListener('click', async () => {
  const lauf = ++laufToken;
  setStatus('');

  if (routeMap.route.length < 2) {
    const en = aktuelleSprache() === 'en';
    setStatus(routeMap.route.length === 0
      ? (en ? 'Please set at least two points on the map, start and destination.'
        : 'Bitte mindestens zwei Punkte auf der Karte setzen: Start und Ziel.')
      : (en ? 'The destination is still missing. Please set one more point on the map.'
        : 'Es fehlt noch das Ziel. Bitte einen weiteren Punkt auf der Karte setzen.'), true);
    return;
  }

  for (let i = 1; i < routeMap.route.length - 1; i++) {
    const p = routeMap.route[i]!;
    if (p.halt !== undefined) continue;
    p.halt = await frageHalt(i, null, aktuelleSprache());
    if (lauf !== laufToken) return;
  }
  routeMap.redrawPoints();

  const cfg = leseSchiffConfig();
  if (istEingabeFehler(cfg)) { setStatus(cfg.message, true); return; }
  const limits = leseGrenzwerte();
  if (istEingabeFehler(limits)) { setStatus(limits.message, true); return; }
  const suchfenster = leseSuchfenster();
  if (istEingabeFehler(suchfenster)) { setStatus(suchfenster.message, true); return; }
  const { sampleStep, dateStr, daemmerung, stepMin, tageVoraus, abJetzt, unterwegs } = suchfenster;

  if (unterwegs) cfg.maneuverMin = zuschlagUnterwegs(cfg.maneuverMin);
  const waypoints = routeMap.route;
  const en = aktuelleSprache() === 'en';

  const vorhersageNote = tageVoraus >= 3
    ? (en
      ? 'The forecast for a day this far ahead is markedly less certain than for today or tomorrow. '
        + 'Wind, gusts and sea state can still change noticeably before the day of the passage.'
      : 'Die Vorhersage für einen Tag so weit voraus ist deutlich unsicherer als für heute oder morgen. '
        + 'Wind, Böen und Seegang können sich bis zum Fahrttag noch spürbar ändern.')
    : '';

  zeigeAlternativroute(null);
  try {
    zeigeLadeanzeige();

    setStatus(en ? 'Checking the route against the coastline …' : 'Route wird gegen die Küstenlinie geprüft …');
    const umfahrung = await umfahreWegpunkte(waypoints);
    const strecke = umfahrung.punkte;
    letzteStrecke = { schluessel: routenSchluessel(waypoints), punkte: strecke, von: null, nach: null };
    const umfahrungNote = umfahrungsHinweis(umfahrung, en);
    setStatus(en ? 'Sampling the route …' : 'Route wird abgetastet …');
    const points = sampleRoute(strecke, sampleStep);
    ordneHalteZu(points, halteDerRoute(waypoints));
    const mitHalt = points.some((p) => p.halt);

    widenForResults();
    routeMap.map.invalidateSize();
    routeMap.drawRoute(strecke);

    const ankerplatzArtPromise = findAnkerplatzArt(waypoints[waypoints.length - 1]!);

    const hafenPromise = hafenSteckbrief(waypoints[waypoints.length - 1]!);

    const startOrtPromise = ortsbezeichnung(waypoints[0]!, aktuelleSprache());
    const zielOrtPromise = ortsbezeichnung(waypoints[waypoints.length - 1]!, aktuelleSprache());

    const druckfeldPromise = fetchDruckfeld(
      { lat: (waypoints[0]!.lat + waypoints[waypoints.length - 1]!.lat) / 2,
        lon: (waypoints[0]!.lon + waypoints[waypoints.length - 1]!.lon) / 2 },
      dateStr,
    );

    const copernicusGitterPromise = holeCopernicusGitterFuerRoute(waypoints);

    const ensemblePromise = fetchWindEnsemble(
      (waypoints[0]!.lat + waypoints[waypoints.length - 1]!.lat) / 2,
      (waypoints[0]!.lon + waypoints[waypoints.length - 1]!.lon) / 2,
      6,
    );

    const abtastHinweis = (points.length > 60 && sampleStep < 2)
      ? (en
        ? ', at this route length a sampling step of 2 to 3 NM would be noticeably faster and changes little about the result.'
        : ', bei dieser Streckenlänge wäre ein Abtastabstand von 2 bis 3 sm deutlich schneller und ändert am Ergebnis wenig.')
      : '';
    setStatus(en
      ? `Loading the wind forecast for ${points.length} points along the route (${nf(points[points.length - 1]!.cum, 1, 'en')} NM) …${abtastHinweis}`
      : `Windvorhersage für ${points.length} Punkte entlang der Route (${nf(points[points.length - 1]!.cum, 1)} sm) wird geladen …${abtastHinweis}`);
    const { hourly: windData, utcOffsetSeconds, vergleich: windVergleich, zone: windZone = null } = await fetchWindForPoints(points);

    const modellabgleich = vergleicheModelle(windData, windVergleich, dateStr, cfg.minSailWind);
    const abgerufenText = uhrLt(nowInRevier(utcOffsetSeconds));

    const tagVersatz = versatzAmTag(windZone, dateStr, utcOffsetSeconds);

    let curData: Awaited<ReturnType<typeof fetchCurrentForPoints>> | null = null;
    let curNote = '';
    if (cfg.useCurrent) {
      setStatus(en ? 'Loading current and tide data …' : 'Strömungs- und Gezeitendaten werden geladen …');
      try {
        curData = await fetchCurrentForPoints(points, windZone);
        const ok = curData.filter((d) => d?.ocean_current_velocity?.some((v) => v != null)).length;
        if (ok === 0) {
          curData = null;
          curNote = en
            ? 'The marine model provides no current data for this route (grid cell too close to land or outside the model area): calculated without current.'
            : 'Für diese Route liefert das Marine-Modell keine Stromdaten (Gitterzelle zu dicht unter Land oder außerhalb des Modellgebiets). Es wird ohne Strom gerechnet.';
        } else if (ok < points.length) {
          curNote = en
            ? `Current data available for only ${ok} of ${points.length} route points; the rest are calculated without current.`
            : `Stromdaten nur für ${ok} von ${points.length} Streckenpunkten verfügbar; an den übrigen wird ohne Strom gerechnet.`;
        }
      } catch (e) {
        curData = null;
        curNote = e instanceof OpenMeteoUeberlastet
          ? (en
            ? 'Current data unavailable (the marine service is temporarily overloaded or unreachable): calculated without current.'
            : 'Strömungsdaten nicht verfügbar (der Marine-Dienst ist gerade überlastet oder nicht erreichbar): es wird ohne Strom gerechnet.')
          : (en ? 'Current data could not be loaded (' : 'Strömungsdaten konnten nicht geladen werden (')
            + (e as Error).message + (en ? '): calculated without current.' : '): es wird ohne Strom gerechnet.');
      }
    }

    const copernicusGitter = await copernicusGitterPromise;

    const gezeitenStationen: readonly GezeitenStation[] | null = await import('@/core/gezeitenStationen')
      .then((m) => m.GEZEITEN_STATIONEN).catch(() => null);

    const gezeitenCache = new Map<number, GezeitenAbsatzEingabe | null>();

    const daylight = await fetchDaylight(waypoints[waypoints.length - 1]!.lat, waypoints[waypoints.length - 1]!.lon, windZone);

    setStatus(en ? 'Simulating departure times …' : 'Startzeiten werden simuliert …');

    const startPunkt = routeMap.route[0]!;
    const sonnenstand = sonnenzeiten(startPunkt.lat, startPunkt.lon, dateStr, DAEMMERUNGSWINKEL[daemmerung]);
    let windowStart: Date, windowEnd: Date, daemmerungNote = '';
    if (sonnenstand) {
      windowStart = zuRevierzeit(sonnenstand.auf, tagVersatz);
      windowEnd = zuRevierzeit(sonnenstand.unter, tagVersatz);
    } else {

      windowStart = nDate(`${dateStr}T00:00:00`);
      windowEnd = nDate(`${dateStr}T23:59:00`);
      daemmerungNote = en
        ? 'At this location and time of year, it never gets fully dark at the chosen twilight threshold. The whole day was checked.'
        : 'An diesem Tag und Ort wird es bei der gewählten Dämmerungsgrenze nicht vollständig dunkel. Der ganze Tag wurde geprüft.';
    }

    const forecastEnd = nDate(windData[0]!.time[windData[0]!.time.length - 1]!);
    if (windowStart > forecastEnd) {
      versteckeLadeanzeige();
      setStatus(en
        ? `The chosen date lies outside the forecast. Data is only available up to ${datumUhrLt(forecastEnd)}.`
        : `Das gewählte Datum liegt außerhalb der Vorhersage. Daten liegen nur bis ${datumUhrLt(forecastEnd)} vor.`, true);
      return;
    }

    letzterLauf = {
      startPunkt, points, windData, curData, cfg, limits, daylight,
      utcOffsetSeconds, zone: windZone, forecastEnd, daemmerung, stepMin, copernicusGitter,
    };

    if (abJetzt) {
      const ab = aufRaster(nowInRevier(utcOffsetSeconds), stepMin);
      const bis = new Date(Math.min(ab.getTime() + AB_JETZT_STUNDEN * 3600_000, forecastEnd.getTime()));
      daemmerungNote = en
        ? `Departure times checked from now for the next ${AB_JETZT_STUNDEN} hours, in darkness too; daylight only counts in the rating.`
        : `Geprüft wurden Ablegezeiten ab jetzt für die nächsten ${AB_JETZT_STUNDEN} Stunden, auch bei Dunkelheit; das Tageslicht zählt nur in der Bewertung.`;
      windowStart = ab;
      windowEnd = bis;
    }

    if (unterwegs) {
      const jetztMin = new Date(Math.floor(nowInRevier(utcOffsetSeconds).getTime() / 60_000) * 60_000);
      windowStart = jetztMin;
      windowEnd = jetztMin;
      daemmerungNote = en
        ? `Calculated from now, ${uhrLt(jetztMin)}, from the start point; no departure time was searched.`
        : `Gerechnet ab jetzt, ${uhrLt(jetztMin)}, vom Startpunkt aus; eine Ablegezeit wurde nicht gesucht.`;
    }

    let ankunftSoll: { ziel: Date; zuSpaet: Date | null; heute?: string } | null = null;

    const ankunftZiel = suchfenster.ankunft
      ? ankunftsZeitpunkt(suchfenster.ankunftDatum ?? dateStr, suchfenster.ankunft, abJetzt && !suchfenster.ankunftDatum, nowInRevier(utcOffsetSeconds))
      : null;
    if (suchfenster.ankunft && (!ankunftZiel || ankunftZiel > forecastEnd)) {
      versteckeLadeanzeige();
      setStatus(!ankunftZiel
        ? (en ? 'The arrival time cannot be read (HH:MM).' : 'Die Ankunftszeit ist nicht lesbar (HH:MM).')
        : (en ? `The arrival lies beyond the forecast. Data is only available up to ${datumUhrLt(forecastEnd)}.`
          : `Die Ankunft liegt hinter der Vorhersage. Daten liegen nur bis ${datumUhrLt(forecastEnd)} vor.`), true);
      return;
    }

    if (unterwegs && ankunftZiel) ankunftSoll = { ziel: ankunftZiel, zuSpaet: null, heute: localDateStr(nowInRevier(utcOffsetSeconds)) };
    if (!unterwegs && suchfenster.ankunft) {
      const jetztR = nowInRevier(utcOffsetSeconds);
      const ziel = ankunftZiel;
      if (!ziel) return;
      const rechne = (t: Date) => evaluateDeparture(t, points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter);
      const schaetzung = rechne(new Date(ziel.getTime() - 6 * 3600_000)).totalHrs;
      const r = ablegenFuerAnkunft(ziel, rechne, schaetzung);
      const jetztMin = new Date(Math.floor(jetztR.getTime() / 60_000) * 60_000);
      const zuSpaet = r.departure < jetztMin ? r.departure : null;
      windowStart = zuSpaet ? jetztMin : r.departure;
      windowEnd = windowStart;
      ankunftSoll = { ziel, zuSpaet, heute: localDateStr(jetztR) };
      daemmerungNote = en
        ? `Departure calculated for arrival at ${uhrLt(ziel)}; no departure time was searched.`
        : `Ablegezeit für die Ankunft um ${uhrLt(ziel)} gerechnet; eine Ablegezeit wurde nicht gesucht.`;
    }

    const festeZeit = unterwegs || ankunftSoll != null;
    const probeStart = evaluateDeparture(new Date(windowStart), points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter);
    const probeEnd = evaluateDeparture(new Date(windowEnd), points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter);
    const probeHrs = Math.min(probeStart.totalHrs, probeEnd.totalHrs);
    const hellStunden = (windowEnd.getTime() - windowStart.getTime()) / 3600_000;
    const istNachtschlag = !abJetzt && !festeZeit && probeHrs > hellStunden;
    let nachtNote = '';
    if (istNachtschlag) {
      windowStart = nDate(`${dateStr}T00:00:00`);
      windowEnd = nDate(`${dateStr}T23:59:00`);
      nachtNote = en
        ? `The passage takes around ${nf(probeHrs, 0, 'en')} hours and so doesn't fit into daylight. It becomes `
          + 'a night passage. Departure times were therefore checked across the whole day, not just in daylight.'
        : `Die Fahrt dauert rund ${nf(probeHrs, 0)} Stunden und passt damit nicht in den hellen `
          + 'Tag. Es wird eine Nachtfahrt. Geprüft wurden deshalb Ablegezeiten über den ganzen Tag, nicht nur '
          + 'bei Tageslicht.';
    }

    const jetzt = nowInRevier(utcOffsetSeconds);
    let zeitNote = '';
    if (!abJetzt && !festeZeit && dateStr === localDateStr(jetzt) && jetzt > windowStart) {
      windowStart = jetzt;
      zeitNote = en
        ? 'The search window starts at the next full step after the current time. Earlier departure times have already passed for today.'
        : 'Das Suchfenster beginnt beim nächsten vollen Schritt nach der aktuellen Uhrzeit. Frühere Ablegezeiten sind für heute '
          + 'bereits verstrichen.';
    }

    if (!festeZeit) windowStart = aufRaster(windowStart, stepMin);

    const nurNacht = windowStart > windowEnd && !abJetzt && !festeZeit && !istNachtschlag
      && !!evaluateDeparture(new Date(windowStart), points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter).messinaEinfahrt;
    if (windowStart > windowEnd && !nurNacht) {
      versteckeLadeanzeige();
      setStatus(en
        ? 'It\'s already too late for today: the search window lies entirely in the past. Choose a different date.'
        : 'Für heute ist es dafür schon zu spät. Das Suchfenster liegt bereits vollständig in der '
          + 'Vergangenheit. Ein anderes Datum wählen.', true);
      return;
    }

    let results: Ablegezeit[] = [];
    for (let t = new Date(windowStart); t <= windowEnd; t = new Date(t.getTime() + stepMin * 60000)) {
      results.push(evaluateDeparture(new Date(t), points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter));
    }

    let messinaNachtNote = '';
    if (!abJetzt && !festeZeit && !istNachtschlag) {

      const probe = nurNacht ? [evaluateDeparture(new Date(windowStart), points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter)] : results;
      const bis = messinaNachtBis(dateStr, startPunkt, daemmerung, tagVersatz, forecastEnd);
      const erg = ergaenzeMessinaNacht(probe, nurNacht ? windowStart : windowEnd, bis, stepMin,
        (t) => evaluateDeparture(t, points, windData, curData, cfg, limits, daylight, tagVersatz, copernicusGitter), istUnfahrbar);
      if (nurNacht) results = erg.results;
      if (erg.verlaengert) {
        results = erg.results;
        messinaNachtNote = en
          ? `No departure in daylight reaches the Strait of Messina in a favourable window, so departure times were also checked through the night until ${uhrLt(bis)}.`
          : `Keine Ablegezeit bei Tageslicht erreicht die Straße von Messina in einem günstigen Fenster; geprüft wurden deshalb auch Ablegezeiten durch die Nacht bis ${uhrLt(bis)}.`;
      }
    }
    if (results.length === 0) {
      versteckeLadeanzeige();
      setStatus(en ? 'No valid time window (end must be after start).' : 'Kein gültiges Zeitfenster (bis muss nach von liegen).', true);
      return;
    }
    results.sort((a, b) => a.score - b.score);

    let best = (festeZeit ? null : messinaAblegezeit(results, istUnfahrbar)) ?? results[0]!;
    const rechnerischBeste = best;

    const zielPunkt = waypoints[waypoints.length - 1]!;
    const abbruch = points.find((p) => p.cum >= points[points.length - 1]!.cum * 0.6) ?? null;
    const ausweichPromise = findeAusweichziele(zielPunkt, abbruch, best.avgWindDir,
      marinaVermutlichVoll(saisonLage(best.departure)));

    const skipperGuidePromise = sucheSkipperGuideEintrag(
      zielPunkt, aktuelleSprache(), zielOrtPromise.then((n) => [n]).catch(() => []),
    );

    const totalSM = points[points.length - 1]!.cum;

    const start = routeMap.route[0]!, ziel = routeMap.route[routeMap.route.length - 1]!;

    const streckenMitte = { lat: (start.lat + ziel.lat) / 2, lon: (start.lon + ziel.lon) / 2 };

    const druckfeldTag = await druckfeldPromise;
    const mittagsgitter = druckfeldTag?.find((s) => s.stundeLokal === 12)?.gitter ?? null;
    const druckanalyse = mittagsgitter ? analysiereDruckfeld(mittagsgitter, streckenMitte) : null;

    const ensemble = await ensemblePromise;
    const revierWetter = describeRevierWetter(
      windData, dateStr, start, ziel, curData, daylight, druckanalyse, aktuelleSprache(), copernicusGitter,
      ensemble, true, modellabgleich,
    );

    const revierWetterJe = new Map<number, string | null>();
    const revierWetterZu = (s: { stundeLokal: number; gitter: Parameters<typeof analysiereDruckfeld>[0] } | null): string | null => {
      if (!s) return revierWetter;
      if (!revierWetterJe.has(s.stundeLokal)) {
        revierWetterJe.set(s.stundeLokal, describeRevierWetter(
          windData, dateStr, start, ziel, curData, daylight, analysiereDruckfeld(s.gitter, streckenMitte),
          aktuelleSprache(), copernicusGitter, ensemble, true, modellabgleich,
        ));
      }
      return revierWetterJe.get(s.stundeLokal) ?? null;
    };

    const syn = synoptik(windData, dateStr, curData);

    const zielHourly = windData[windData.length - 1] ?? null;

    let osmArt: AnkerplatzArt = null;
    let osmAusweich: Awaited<typeof ausweichPromise>['ziele'] | null = null;

    let osmZielKueste: Awaited<typeof ausweichPromise>['zielKueste'] = null;
    let skipperGuide: Awaited<typeof skipperGuidePromise>['eintrag'] = null;

    let skipperGuideLaedt = true;

    let amtlich: AmtlicherBericht[] | null = null;

    let amtlichStand: AmtlichStand = 'laedt';

    let wetterwarnungen: { treffer: WarnTreffer[]; stand: string | null } | null = null;

    let warnungen: Warnangabe[] = [];

    let warnBericht: AmtlicherBericht | null = null;
    let warnGebiete: HnmsGebietDaten[] = [];
    let warnKueste: [Punkt, Punkt][] | null = null;
    let startName: string | null = null;
    let zielName: string | null = null;
    const ortCache = new Map<string, Bezugsort | null>();

    let skipperGuideLage: 'kein-eintrag' | 'fehlgeschlagen' | null = null;

    let tiefenlage: Tiefenlage | null = null;

    let seegebiet: Awaited<ReturnType<typeof fetchSeegebiet>> = null;

    let hafen: HafensteckbriefEingabe | null = null;
    let gewaehlt: Ablegezeit = best;

    let merkUhr = 0;
    const merkeSpaeter = (): void => {
      window.clearTimeout(merkUhr);
      merkUhr = window.setTimeout(() => {
        if (lauf !== laufToken) return;
        offline.speichere({
          gerechnet: new Date().toISOString(), datenVon: abgerufenText, datum: dateStr,
          sprache: aktuelleSprache(), route: strecke.map((p) => ({ lat: p.lat, lon: p.lon })),
          wegpunkte: waypoints.map((p) => ({ lat: p.lat, lon: p.lon })),
          titel: el<HTMLHeadingElement>('brief-titel').textContent ?? '', html: offline.abbild(),
        });
      }, 1500);
    };

    const ANLAUF_MAX_SM = 40;

    const ortsangabe = (q: Punkt, sprache: 'de' | 'en'): string => {
      const schluessel = `${q.lat.toFixed(2)},${q.lon.toFixed(2)}`;
      if (!ortCache.has(schluessel)) {
        ortCache.set(schluessel, null);
        void naechsterBenannterOrt(q, sprache).then((o) => {
          if (!o || lauf !== laufToken) return;
          ortCache.set(schluessel, o);
          zeichneAlles(gewaehlt);
        });
      }
      const gefunden = ortCache.get(schluessel);
      const kandidaten: Bezugsort[] = [
        ...(gefunden ? [gefunden] : []),
        ...(startName ? [{ name: startName, lat: start.lat, lon: start.lon }] : []),
        ...(zielName ? [{ name: zielName, lat: ziel.lat, lon: ziel.lon }] : []),
        ...(osmAusweich ?? []).map((a) => ({ name: a.name, lat: a.lat, lon: a.lon })),
      ];
      const bezug = ortsbezug(q, kandidaten, sprache);
      if (bezug) return bezug.text;
      return `${sprache === 'en' ? 'at' : 'auf'} ${positionText(q.lat, q.lon, sprache)}`;
    };

    const zeichneAlles = (auswahl: Ablegezeit): void => {
      gewaehlt = auswahl;
      merkeSpaeter();

      const track = routeWindTrack(auswahl.departure, points, windData, curData, cfg, copernicusGitter, tagVersatz);

      const dunkel = dunkelphasen(track, DAEMMERUNGSWINKEL[daemmerung], tagVersatz, auswahl.halte);
      const sonneWeg = dunkelphasen(track, DAEMMERUNGSWINKEL.sonne, tagVersatz, auswahl.halte);
      const nachtfahrt = istNachtfahrt(dunkel);

      if (auswahl.halte?.length) {
        auswahl.halte = auswahl.halte.map((h) => (h.lat !== undefined && h.lon !== undefined
          ? { ...h, dunkelMin: dunkelMinuten(h.lat, h.lon, h.an, h.ab, DAEMMERUNGSWINKEL[daemmerung], tagVersatz) } : h));
      }

      const want = Math.min(14, Math.max(4, Math.round(totalSM / 3)));
      const spacing = totalSM / (want - 1);
      let next = 0;
      const gezeigterTrack = track.filter((tp, i) => {
        if (tp.nm + 1e-9 < next && i !== track.length - 1) return false;
        next = tp.nm + spacing; return true;
      });

      const verlaufBezug = verlaufAbschnitte(track, aktuelleSprache());
      routeMap.setTrack(gezeigterTrack, limits, verlaufBezug);

      routeMap.setDunkelphasen(dunkel.phasen.map((p) => ({
        beginn: p.beginn, ende: p.ende, beginnOrt: p.beginnOrt, endeOrt: p.endeOrt,
        vonAnfangAn: p.vonAnfangAn,
        strecke: track.filter((t) => t.time >= p.beginn && (!p.ende || t.time <= p.ende))
          .map((t) => ({ lat: t.lat, lon: t.lon })),
      })));

      const antrieb = antriebsphasen(track);
      routeMap.setAntriebsphasen(antrieb.map((p) => ({
        beginn: p.beginn, ende: p.ende, beginnOrt: p.beginnOrt, endeOrt: p.endeOrt,
        unterMotor: p.unterMotor,
        strecke: track.filter((t) => t.nm >= p.beginnNM && (p.endeNM === null || t.nm <= p.endeNM))
          .map((t) => ({ lat: t.lat, lon: t.lon })),
      })));

      const naechsterTrackPunkt = (nm: number): TrackPunkt => {
        let beste = track[0]!, kleinsterAbstand = Infinity;
        for (const t of track) {
          const abstand = Math.abs(t.nm - nm);
          if (abstand < kleinsterAbstand) { kleinsterAbstand = abstand; beste = t; }
        }
        return beste;
      };
      const spitzenGruppen = new Map<TrackPunkt, { symbol: string; text: string }[]>();
      const spitzeEintragen = (nm: number, symbol: string, text: string): void => {
        const p = naechsterTrackPunkt(nm);
        const liste = spitzenGruppen.get(p) ?? [];
        liste.push({ symbol, text });
        spitzenGruppen.set(p, liste);
      };
      const spitzenSprache = aktuelleSprache();
      const spitzenEn = spitzenSprache === 'en';
      spitzeEintragen(auswahl.maxWindAt.nm, '💨', spitzenEn
        ? `Highest mean wind: ${nf(anzeigeKn(auswahl.maxWind), 0, 'en')} kn (${uhrLt(auswahl.maxWindAt.time)}, NM ${nf(auswahl.maxWindAt.nm, 0, 'en')})`
        : `Höchster Mittelwind: ${nf(anzeigeKn(auswahl.maxWind), 0)} kn (${uhrLt(auswahl.maxWindAt.time)}, sm ${nf(auswahl.maxWindAt.nm, 0)})`);
      spitzeEintragen(auswahl.maxGustAt.nm, '🌬️', spitzenEn
        ? `Highest gust: ${nf(anzeigeKn(auswahl.maxGust), 0, 'en')} kn (${uhrLt(auswahl.maxGustAt.time)}, NM ${nf(auswahl.maxGustAt.nm, 0, 'en')})`
        : `Höchste Böe: ${nf(anzeigeKn(auswahl.maxGust), 0)} kn (${uhrLt(auswahl.maxGustAt.time)}, sm ${nf(auswahl.maxGustAt.nm, 0)})`);
      if (auswahl.seaValid) {
        spitzeEintragen(auswahl.maxHsAt.nm, '🌊', spitzenEn
          ? `Highest wave: ${nf(auswahl.maxHs, 1, 'en')} m (${uhrLt(auswahl.maxHsAt.time)}, NM ${nf(auswahl.maxHsAt.nm, 0, 'en')})`
          : `Höchste Welle: ${nf(auswahl.maxHs, 1)} m (${uhrLt(auswahl.maxHsAt.time)}, sm ${nf(auswahl.maxHsAt.nm, 0)})`);
      }
      const spitzenMarker: SpitzenwertMarker[] = [...spitzenGruppen.entries()].map(([p, eintraege]) => ({
        ort: { lat: p.lat, lon: p.lon },
        symbol: eintraege.map((e) => e.symbol).join(''),
        text: eintraege.map((e) => e.text).join('<br>'),
      }));
      routeMap.setSpitzenwerte(spitzenMarker);

      let kritisch: KritischTexte | null = null;

      let kritischBoeKn: number | null = null;
      const kritischMarker: KritischMarker[] = [];

      const warnGilt = !warnBericht || giltFuer(warnBericht, dateStr, auswahl.departure);
      if (warnungen.length && warnGebiete.length && warnGilt) {
        const sprache = aktuelleSprache();
        const spur = track.map((t) => ({ lat: t.lat, lon: t.lon, nm: t.nm, time: t.time, speed: t.speed, gust: t.gust }));
        const ctx: WarnKontext = {
          gebieteAn: (lat, lon) => seegebieteAn(lat, lon, warnGebiete).map((g) => g.name),
          gebietsBox: (name) => {
            const ring = warnGebiete.find((g) => g.name === name)?.ringe[0];
            if (!ring) return null;
            const xs = ring.filter((_, i) => i % 2 === 0), ys = ring.filter((_, i) => i % 2 === 1);
            return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          },
          anlaufSm: (lat, lon, d) => (warnKueste ? luvFetchNM({ lat, lon }, d, warnKueste, ANLAUF_MAX_SM) : null),
          utcVersatzMs: tagVersatz * 1000,
          istDunkel: (q) => dunkel.phasen.some((ph) => q.time >= ph.beginn && (!ph.ende || q.time <= ph.ende)),
        };
        const lage = warnlageEntlang(spur, warnungen, ctx);
        const fokus = lage.abschnitte[0]?.punkt ?? lage.ausserhalbDerZeit?.punkt ?? null;
        const ort = fokus ? ortsangabe(fokus, sprache) : '';
        kritisch = kritischTexte({ lage, ort, abfahrt: auswahl.departure, ankunft: auswahl.arrival, utcVersatzMs: tagVersatz * 1000, anlaufMaxSm: ANLAUF_MAX_SM }, sprache);

        const staerken = lage.abschnitte.filter((k) => !ohneOrtsangabe(k.warnung)).map((k) => k.warnung.boeenKn?.bis ?? (k.warnung.bft ? BFT_KN[k.warnung.bft.bis]?.[1] ?? 0 : 0));
        kritischBoeKn = staerken.length ? Math.max(...staerken) : null;
        for (const k of lage.abschnitte) {
          const bisZeit = uhrLt(k.bis) !== uhrLt(k.von) ? uhrLt(k.bis) : null;
          kritischMarker.push({
            strecke: spur.slice(k.vonIdx, k.bisIdx + 1).map((q) => ({ lat: q.lat, lon: q.lon })),
            punkt: { lat: k.punkt.lat, lon: k.punkt.lon },
            text: sprache === 'en'
              ? `<b>Critical section</b> ${uhrLt(k.von)}${bisZeit ? ` to ${bisZeit}` : ''}: officially ${staerkeText(k.warnung, sprache)}`
              : `<b>Kritischer Abschnitt</b> ${uhrLt(k.von)}${bisZeit ? ` bis ${bisZeit}` : ''}: amtlich ${staerkeText(k.warnung, sprache)}`,
          });
        }
      }
      routeMap.setKritisch(kritischMarker);

      const gezeitZiel = wasserstandAn(
        copernicusGitter, curData ? curData[curData.length - 1] ?? null : null,
        ziel.lat, ziel.lon, auswahl.arrival, tagVersatz,
      );

      let gezeiten: GezeitenAbsatzEingabe | null = null;
      if (gezeitenStationen) {
        const schluessel = Math.round(auswahl.arrival.getTime() / 600000);
        if (!gezeitenCache.has(schluessel)) {
          const ankunftUtc = vonRevierzeit(auswahl.arrival, tagVersatz).getTime();
          const lage = gezeitenLage(gezeitenStationen, ziel.lat, ziel.lon,
            alsUtc(new Date(ankunftUtc - 3 * 3600e3)), alsUtc(new Date(ankunftUtc + 21 * 3600e3)), copernicusGitter);
          gezeitenCache.set(schluessel, lage
            ? { lage: lageVerschoben(lage, tagVersatz * 1000), ankunft: auswahl.arrival } : null);
        }
        gezeiten = gezeitenCache.get(schluessel) ?? null;
      }

      const srZiel = sonnenzeiten(ziel.lat, ziel.lon, localDateStr(auswahl.arrival), DAEMMERUNGSWINKEL.sonne);

      const nachtEingabe: NachtfahrtEingabe | null = nachtfahrt ? {
        dunkel, sonneWeg,

        grenzeName: STRINGS[aktuelleSprache()][`option.daemmerung.${daemmerung}`]!,
        gesamtNM: totalSM,
        wachgaenger: cfg.wachgaenger,
        best: auswahl,
        ziel,
        ankerplatzArt: osmArt,
        sonnenaufgangAmZiel: srZiel ? zuRevierzeit(srZiel.auf, tagVersatz) : null,
        track,
        monat: auswahl.departure.getUTCMonth() + 1,
        utcOffsetSeconds: tagVersatz,
      } : null;

      const schnappschussAuswahl = druckfeldTag ? naechsterSchnappschuss(druckfeldTag, auswahl.departure) : null;
      const gitterAuswahl = schnappschussAuswahl?.gitter ?? null;
      const druckanalyseAuswahl = gitterAuswahl ? analysiereDruckfeld(gitterAuswahl, streckenMitte) : null;

      renderRecommendation({
        startName, zielName,
        gewaehlt: auswahl,
        empfohlen: best,
        results,
        cfg,
        limits,
        hatStromdaten: curData !== null,
        curNote,
        daemmerungNote: [umfahrungNote, zeitNote, daemmerungNote, nachtNote, messinaNachtNote, vorhersageNote].filter(Boolean).join(' '),
        totalNM: totalSM,
        forecastEndText: datumUhrLt(forecastEnd),
        revierZone: windZone, revierVersatzS: tagVersatz,
        revierWetter: revierWetterZu(schnappschussAuswahl),
        track,
        zielHourly,
        tageslicht: daylight,
        ankerplatzArt: osmArt,
        abgerufenText,
        ziel,
        ausweichziele: osmAusweich,
        nacht: nachtEingabe,
        gezeitZiel,
        syn,
        antrieb,
        zielKueste: osmZielKueste,
        skipperGuide,
        skipperGuideLaedt,
        kartenMitte: streckenMitte,
        druckfeld: gitterAuswahl,
        druckanalyse: druckanalyseAuswahl,
        tiefe: tiefenlage,
        seegebiet,
        skipperGuideLage,
        hafen,
        amtlich,
        amtlichStand,
        wetterwarnungen,
        gezeiten,
        druckfeldStand: schnappschussAuswahl ? { datum: dateStr, stunde: schnappschussAuswahl.stundeLokal } : null,
        kritisch,
        kritischBoeKn,
        rechnerischBeste: best !== rechnerischBeste ? rechnerischBeste : null,
        kraftstoff: toernKraftstoff ?? kraftstoffFuerSchiff({ typ: cfg.boat.name }),
        modellabgleich,
        unterwegs,
        ankunftSoll,
      });

      const vorbehalt = (r: Ablegezeit): boolean => amtlicherVorbehalt(amtlich, dateStr, limits.gust, r.departure, track) !== null;

      for (const id of ['strip', 'strip-labels', 'strip-sonne-labels', 'strip-fahrt-labels', 'strip-hinweis']) el(id).style.display = festeZeit ? 'none' : '';
      (el<HTMLTableElement>('table').closest('details') as HTMLElement).style.display = festeZeit ? 'none' : '';
      if (!festeZeit) {
        renderStrip(results, best, auswahl, start, dateStr, daemmerung, tagVersatz, vorbehalt);
        renderTable(results, best, cfg, curData !== null, auswahl, vorbehalt);
      }
    };

    el<HTMLHeadingElement>('brief-titel').textContent = briefTitel(null, null, aktuelleSprache());

    const resultsEl = el<HTMLDivElement>('results');
    resultsEl.style.display = 'block';

    initStripSlider((auswahl) => {
      if (lauf !== laufToken) return;
      zeichneAlles(auswahl);
    });
    zeichneAlles(best);

    if (!mitHalt) void sucheAlternativroute({
      strecke, best, cfg, limits, daylight, utcOffsetSeconds: tagVersatz, sampleStep, copernicusGitter, mitStrom: curData !== null,
    }).then((v) => { if (lauf === laufToken) zeigeAlternativroute(v); }).catch(() => {});

    versteckeLadeanzeige();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultsEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    resultsEl.focus({ preventScroll: true });
    const fertig = en
      ? `Done · ${points.length} route points · ${results.length} departure times checked.`
      : `Fertig · ${points.length} Streckenpunkte · ${results.length} geprüfte Startzeiten.`;
    setStatus(`${fertig} ${en ? 'Harbour and place names are still loading …' : 'Hafen- und Ortsangaben werden noch geladen …'}`);

    const statusFrist = window.setTimeout(() => {
      if (lauf === laufToken) setStatus(`${fertig} ${en ? 'Harbour and place names are currently unavailable.' : 'Hafen- und Ortsangaben sind gerade nicht abrufbar.'}`);
    }, 20_000);

    void fetchSeegebiet(waypoints[waypoints.length - 1]!.lat, waypoints[waypoints.length - 1]!.lon)
      .then((g) => {
        if (lauf !== laufToken || !g) return;
        seegebiet = g;
        zeichneAlles(gewaehlt);
      }).catch(() => {  });

    void Promise.all([
      fetchTiefe(waypoints[waypoints.length - 1]!).then(async (t) => {

        if (!braucheSuche(t) || strecke.length < 2) return zieltiefe(t, null);

        const nahe = await fetchTiefeNahe(
          strecke[strecke.length - 1]!, strecke[strecke.length - 2]!,
        );
        return zieltiefe(t, nahe);
      }),
      fetchTiefenprofil(points),
    ]).then(([zielTiefe, profil]) => {
      if (lauf !== laufToken) return;
      tiefenlage = {
        ziel: zielTiefe,
        profil: profil?.punkte ?? null,
        tiefgangM: cfg.tiefgangM,

      };
      zeichneAlles(gewaehlt);
    }).catch(() => {  });

    const stichproben = points.filter((_, i) => i % Math.max(1, Math.ceil(points.length / 40)) === 0
      || i === points.length - 1);

    const warnRahmen = rahmenUm(stichproben);
    if (warnRahmen) {
      const tagBeginn = Date.parse(`${dateStr}T00:00:00Z`) - tagVersatz * 1000;
      void holeWarnungen(warnRahmen).then((daten) => {
        if (lauf !== laufToken || !daten) return;
        wetterwarnungen = { treffer: warnungenFuer(daten, stichproben, tagBeginn, tagBeginn + 86_400_000), stand: daten.stand };
        if (wetterwarnungen.treffer.length) zeichneAlles(gewaehlt);
      }).catch(() => {  });
    }
    void Promise.all([ladeHnmsSeegebiete(), ladeMeteomarSeegebiete()]).then(async ([hnmsDaten, meteomarDaten]) => {
      const gr = seegebieteEntlang(stichproben, hnmsDaten);
      const tr = mgmGebieteEntlang(stichproben);
      const it = seegebieteEntlang(stichproben, meteomarDaten);
      const es = aemetRegionenEntlang(stichproben);
      const zypern = stichproben.some((p) => beiZypern(p.lat, p.lon));

      const adria = inAdriaBox(streckenMitte.lat, streckenMitte.lon);
      const griechisch = istGriechisch(gr);
      const staat = staatGefragt({ adria, griechisch })
        ? gewaesserStaat(await fetchSeegebiet(streckenMitte.lat, streckenMitte.lon).catch(() => null), hoheitsStaat) : null;
      const land = seeberichtLand({
        griechisch, zypern, tuerkisch: tr.length > 0, spanisch: es.length > 0,
        adria, italienisch: it.length > 0, staat,
      });
      if (lauf !== laufToken) return;

      if (!land) { amtlichStand = null; zeichneAlles(gewaehlt); return; }
      warnGebiete = [...hnmsDaten, ...meteomarDaten];

      const lats = points.map((q) => q.lat), lons = points.map((q) => q.lon);

      const ladeWarnKueste = () => void kuestenlinienRueckfall(Math.min(...lats) - 0.6, Math.min(...lons) - 0.8, Math.max(...lats) + 0.6, Math.max(...lons) + 0.8)
        .then((k) => { if (lauf === laufToken && k) { warnKueste = k; if (warnungen.length) zeichneAlles(gewaehlt); } })
        .catch(() => {});
      let b: AmtlicherBericht | null = null;
      let zweit: AmtlicherBericht | null = null;
      if (land === 'hr') {
        b = await holeDhmzBericht(aktuelleSprache());
        warnungen = b ? dhmzWarnungen(b.warnung, { datum: b.datum, stunde: b.stunde ?? null }) : [];
        warnBericht = b;
      } else {
        const herkunft = ({ gr: 'hnms', tr: 'mgm', it: 'meteomar', es: 'aemet', cy: 'dom' } as const)[land];
        const bericht = await holeGebietsBericht(herkunft);
        const auswahl = bericht ? passendeGebiete(bericht.gebiete, land === 'es' ? { gruppen: es }
          : land === 'cy' ? { gruppen: [ZYPERN_KUESTE], hnms: gr }
            : { namen: land === 'gr' ? gr : land === 'tr' ? tr : it }) : [];
        b = bericht ? gebietsBerichtAlsAmtlich(bericht, auswahl) : null;
        const meteomarNamen = meteomarDaten.map((g) => g.name);
        const meteomarAus = (mb: typeof bericht) => (mb ? meteomarWarnungen(mb.warnung?.gebiete, meteomarNamen, meteomarGueltigkeit(mb.kopf, mb.datum)) : []);
        if (bericht && herkunft === 'hnms') {
          warnungen = hnmsWarnungen(bericht.warnung?.gebiete, { datum: bericht.datum, stundeUtc: hnmsAusgabeStunde(bericht.kopf) });
        } else if (bericht && herkunft === 'meteomar') {
          warnungen = meteomarAus(bericht);
        }

        if (land === 'es' && it.length) {
          const mm = await holeGebietsBericht('meteomar');
          zweit = mm ? gebietsBerichtAlsAmtlich(mm, passendeGebiete(mm.gebiete, { namen: it })) : null;
          warnungen = meteomarAus(mm);
        }
      }
      if (warnungen.length && !warnKueste) ladeWarnKueste();
      const liste = [b, zweit].filter((x): x is AmtlicherBericht => !!x);
      if (lauf !== laufToken) return;

      if (!liste.length) { amtlichStand = 'fehlt'; zeichneAlles(gewaehlt); return; }
      amtlich = liste;
      amtlichStand = null;

      const neu = empfehlungMitVorbehalt(results, rechnerischBeste,
        (r) => amtlicherVorbehalt(liste, dateStr, limits.gust, r.departure, points) !== null);
      if (neu !== best) {
        const folgte = gewaehlt === best;
        best = neu;
        if (folgte) gewaehlt = neu;
      }

      if (letzterLauf) {
        letzterLauf.amtlich = liste;
        if (tagesvergleichBox.open) tagesvergleichBox.dispatchEvent(new Event('toggle'));
      }
      zeichneAlles(gewaehlt);
    }).catch(() => {

      if (lauf !== laufToken) return;
      amtlichStand = 'fehlt';
      zeichneAlles(gewaehlt);
    });

    void Promise.all([ankerplatzArtPromise, ausweichPromise, skipperGuidePromise, hafenPromise]).then(([art, ausweich, sg, steckbrief]) => {
      window.clearTimeout(statusFrist);
      if (lauf !== laufToken) return;
      osmArt = art;

      hafen = steckbrief ? { ort: steckbrief, tiefgangM: cfg.tiefgangM } : null;
      osmAusweich = ausweich.ziele;
      osmZielKueste = ausweich.zielKueste;
      skipperGuide = sg.eintrag;
      skipperGuideLaedt = false;

      skipperGuideLage = sg.lage === 'treffer' ? null : sg.lage;

      zeichneAlles(gewaehlt);
      setStatus(fertig);
    }).catch((err) => {

      console.error(err);
      window.clearTimeout(statusFrist);
      if (lauf !== laufToken) return;
      skipperGuideLaedt = false;
      zeichneAlles(gewaehlt);
      setStatus(fertig);
    });
    void Promise.all([startOrtPromise, zielOrtPromise]).then(([startOrt, zielOrt]) => {
      if (lauf !== laufToken) return;
      el<HTMLHeadingElement>('brief-titel').textContent = briefTitel(startOrt, zielOrt, aktuelleSprache());
      startName = startOrt; zielName = zielOrt;
      if (letzteStrecke?.schluessel === routenSchluessel(waypoints)) letzteStrecke = { ...letzteStrecke, von: startOrt, nach: zielOrt };
      if (warnungen.length) zeichneAlles(gewaehlt);
    }).catch((err) => { console.error(err);  });
  } catch (err) {
    versteckeLadeanzeige();
    console.error(err);

    const wiederAb = (() => {
      const n = new Date();
      const ab = err instanceof OpenMeteoKontingent && err.art === 'stunde'
        ? new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), n.getUTCHours() + 1))
        : new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
      return uhrLtVon(ab.getTime());
    })();
    const nachricht = err instanceof OpenMeteoKontingent
      ? (en
        ? `No briefing: the weather service Open-Meteo has used up the free ${err.art === 'tag' ? 'daily' : 'hourly'} quota for this internet connection. It works again from ${wiederAb}; via another network, such as the phone's hotspot, right away.`
        : `Kein Briefing: Der Wetterdienst Open-Meteo hat für diese Internetverbindung das ${err.art === 'tag' ? 'Tages' : 'Stunden'}kontingent seines kostenlosen Zugangs ausgeschöpft. Ab ${wiederAb} Uhr geht es wieder; über ein anderes Netz, etwa den Hotspot des Handys, sofort.`)
      : err instanceof OpenMeteoUeberlastet
      ? (en
        ? 'The weather service is temporarily overloaded or unreachable. Please try again in a minute or two.'
        : 'Der Wetterdienst ist gerade überlastet oder nicht erreichbar. Bitte in ein bis zwei Minuten erneut versuchen.')
      : (en ? 'Error: ' : 'Fehler: ') + (err as Error).message;
    setStatus(nachricht, true);

    const netz = !navigator.onLine || err instanceof TypeError;
    if (netz || err instanceof OpenMeteoUeberlastet) {
      const b = offline.lies();
      if (b && offline.passtZu(b, routeMap.route, dateStr)) zeigeGespeichertes(b, netz ? 'netz' : 'dienst');
      else el<HTMLDivElement>('results').style.display = 'none';
    }
  }
});

function zeigeGespeichertes(b: offline.GespeichertesBriefing, grund: offline.Grund): void {
  widenForResults();
  routeMap.map.invalidateSize();
  if (routeMap.route.length === 0) routeMap.setRoute(b.wegpunkte ?? b.route);
  routeMap.drawRoute(b.route);
  offline.zeige(b, new Date(), aktuelleSprache(), grund);
}

const beimStart = navigator.onLine ? null : offline.lies();
if (beimStart && routeMap.route.length === 0) {
  zeigeGespeichertes(beimStart, 'netz');
  setStatus(aktuelleSprache() === 'en'
    ? 'No connection. The last briefing is shown below.'
    : 'Kein Netz. Unten steht das letzte Briefing.');
}

if (routeMap.route.length === 0) {
  startBeimOeffnen(
    () => routeMap.route.length === 0,

    (lat, lon) => startAusPosition({ lat, lon }).then((r) => r?.punkt ?? null),
    (lat, lon) => routeMap.setzeStart(lat, lon),

    (lat, lon) => routeMap.map.setView([lat, lon], routeMap.map.getZoom(), { animate: false }),
  );
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void reg.update().catch(() => {});
      });
    })
    .catch((err) => console.warn('Service Worker nicht registriert:', err));
}

function umfahrungsHinweis(u: UmfahreneRoute, en: boolean): string {
  if (u.kuesteFehlt) {
    return en
      ? 'The coastline could not be loaded, so the route was not checked against land: it runs in straight lines between the waypoints.'
      : 'Die Küstenlinie war nicht abrufbar, die Route wurde nicht gegen Land geprüft: Sie läuft gerade zwischen den Wegpunkten.';
  }
  const teile: string[] = [];
  if (u.umfahreneAbschnitte.length) {
    teile.push(en
      ? 'Land was avoided automatically along the OpenStreetMap coastline. Depths, shoals, rocks and restricted areas are not known to this detour: check it against the nautical chart.'
      : 'Land wurde entlang der OpenStreetMap-Küstenlinie automatisch umfahren. Tiefen, Untiefen, Klippen und Sperrgebiete kennt diese Umfahrung nicht: bitte gegen die Seekarte prüfen.');
    if (u.rueckfall) {
      teile.push(en
        ? 'The coastline came from a simplified offline copy (about 200 m accuracy).'
        : 'Die Küstenlinie stammt aus einem vereinfachten Offline-Auszug (rund 200 m genau).');
    }
  }

  if (u.vtgBeachtet) {
    teile.push(en
      ? 'In the Strait of Messina the route keeps outside the traffic separation scheme, in the inshore zones, as the Capitaneria di Porto Messina requires for pleasure craft under 20 m.'
      : 'In der Straße von Messina läuft die Route außerhalb des Verkehrstrennungsgebiets, in den Küstenzonen, wie es die Capitaneria di Porto Messina für Sportboote unter 20 m vorschreibt.');
    if (u.durchVtg?.length) {
      teile.push(en
        ? `Leg ${u.durchVtg[0]! + 1} found no way outside it and runs through the scheme: please move a waypoint.`
        : `Abschnitt ${u.durchVtg[0]! + 1} fand keinen Weg außerhalb und führt durch das Verkehrstrennungsgebiet: bitte einen Wegpunkt verschieben.`);
    }
  }
  if (u.ohneWeg.length) {
    teile.push(en
      ? 'For at least one leg no way around land was found: it is calculated as a straight line and crosses land. Please add a waypoint.'
      : 'Für mindestens einen Abschnitt fand sich kein Weg um Land herum: Er ist gerade gerechnet und quert Land. Bitte einen Wegpunkt setzen.');
  }
  return teile.join(' ');
}

ladebildWeg();
