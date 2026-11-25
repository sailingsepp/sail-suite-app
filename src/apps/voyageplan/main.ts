import 'leaflet/dist/leaflet.css';
import '@/shell/tokens.css';
import './style.css';
import './vollbild.css';

import L from 'leaflet';
import { seekarteAuf } from '@/map/seekarte';
import { seekartenNamen } from '@/map/seekartenNamen';
import { einFingerScrollt } from '@/map/einFinger';
import { addVtgEbene } from '@/map/vtg';
import { objektFensterAuf } from '@/map/objektFenster';
import { setzeAppTexte } from '@/shell/strings';
import { initSprache, sichereSpracheWahl, aufSprachwechsel } from '@/shell/sprache';
import { initTheme, sichereThemeWahl } from '@/shell/theme';
import { merktSich, setzeMerktSich } from '@/shell/merken';
import { initTour } from '@/shell/tour';
import { initUserMenu, liesSitzungsToken, liesEigeneNutzerId } from '@/shell/session';
import { initIcons } from '@/shell/icons';
import { initHandbuchModal } from '@/shell/handbuch';
import { initSupport } from '@/shell/support';
import { initKompendium } from '@/shell/kompendium';
import { initTechnik } from '@/shell/technik';
import { aktiviereLesestand } from '@/shell/lesestand';
import { initOfflineHinweis } from '@/shell/offlineHinweis';
import { addLocationSearch } from '@/ui/search';
import { holeAktivenToern, holeEtappen, holeCrew } from '@/data/toernApi';
import { TITLE, DESCRIPTION, STRINGS, TOUR_STEPS } from './strings';
import { app, wort, $, wunschlisteEins, wunschlisteZwei, toernBeschreibung, setzeToern } from './kontext';
import { initRaender, zeigeRaender } from './raender';
import { initPlanung, zeigePlanung, zeigeWunschlisten, zeigePlanFixierungen } from './planungBedienung';
import { initHandplan, renderListe, setzeZeichenWerkzeuge, ausServerdaten, wochentabelleNeuZeichnen, zeichnetGerade } from './handplan';
import { initAutomatik, setzeZweiteOptionSichtbarkeit, zeigeGespeicherteAutomatik, automatikNeuZeichnen } from './automatik';
import { initRollierend, zeigeRollierend } from './rollierendBedienung';
import { initHandplanNeu, zeigeAbTag } from './handplanNeu';
import { initVollbild, toernGeladen } from './vollbild';
import { ladebildGezeichnet, ladebildWeg } from '@/shell/ladebild';

await ladebildGezeichnet();
initIcons();
setzeAppTexte({ titel: TITLE, beschreibung: DESCRIPTION, strings: STRINGS, tour: TOUR_STEPS });

aktiviereLesestand();
initOfflineHinweis();

initSprache();
initTheme();
initTour();
initUserMenu();
initHandbuchModal();
initSupport('voyageplan');
initKompendium();

initTechnik();

wunschlisteEins.initWunschliste();
wunschlisteZwei.initWunschliste();

const merkenBox = document.getElementById('in-menu-merken') as HTMLInputElement | null;
if (merkenBox) {
  merkenBox.checked = merktSich();
  merkenBox.addEventListener('change', () => {
    setzeMerktSich(merkenBox.checked);
    if (merkenBox.checked) { sichereSpracheWahl(); sichereThemeWahl(); }
  });
}

const karteEl = $('vp-karte');

const karte = karteEl
  ? L.map(karteEl, { zoomControl: true, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([44.0, 14.5], 8)
  : null;

const seezeichen = karte
  ? L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18, crossOrigin: 'anonymous', attribution: '&copy; OpenSeaMap' })
  : null;
if (karte) {

  einFingerScrollt(karte);

  seekartenNamen(karte, seekarteAuf(karte), { netz: () => navigator.onLine });
  addLocationSearch(karte);

  addVtgEbene(karte);

  const objekte = objektFensterAuf(karte, { aus: zeichnetGerade });
  karte.on('click', (e: L.LeafletMouseEvent) => { void objekte.tipp(e); });
}

const planEbenen = karte ? L.layerGroup().addTo(karte) : null;

initVollbild(karte, planEbenen, seezeichen);
initHandplan(karte);
initRaender();
initPlanung();
initAutomatik(karte, planEbenen);
initRollierend();
initHandplanNeu();

async function start(): Promise<void> {
  const laedt = $('vp-laedt');
  const keinToern = $('vp-kein-toern');
  const plan = $('vp-plan');
  const token = liesSitzungsToken();
  if (!token) {
    if (laedt) laedt.hidden = true;
    if (keinToern) keinToern.hidden = false;
    return;
  }

  const abfrage = await holeAktivenToern(token);
  if (laedt) laedt.hidden = true;
  if (abfrage.lage === 'fehlgeschlagen' || !abfrage.toern) {
    if (keinToern) keinToern.hidden = false;
    return;
  }
  const toern = abfrage.toern;
  setzeToern(toern);
  app.nurLesen = liesEigeneNutzerId() !== toern.besitzer;

  if (plan) plan.hidden = false;
  const nameEl = $('vp-toern-name');
  const infoEl = $('vp-toern-info');
  if (nameEl) nameEl.textContent = toern.name;
  if (infoEl) infoEl.textContent = toernBeschreibung(app.toern ?? toern);
  const nurLesenHinweis = $('vp-nur-lesen-hinweis');
  if (nurLesenHinweis) nurLesenHinweis.hidden = !app.nurLesen;
  const speichernKnopf = $('btn-plan-speichern');
  if (speichernKnopf) speichernKnopf.hidden = app.nurLesen;
  zeigeRaender();
  zeigePlanung();
  zeigePlanFixierungen();

  if (zeigeWunschlisten()) setzeZweiteOptionSichtbarkeit(true);

  const etappen = await holeEtappen(token, toern.id);
  app.etappen = (etappen ?? []).map(ausServerdaten);
  renderListe();
  setzeZeichenWerkzeuge();
  zeigeAbTag();
  void zeigeRollierend();

  void zeigeGespeicherteAutomatik(token, toern.id);

  void holeCrew(token, toern.id).then((crew) => {
    app.crewFunktionen = crew ? crew.map((c) => c.funktion) : null;
  });
  const wocheBox = $('vp-wochentabelle');
  if (wocheBox) {
    wocheBox.innerHTML = app.etappen.some((e) => e.datum != null)
      ? `<p class="vp-hinweis">${wort('woche.nochNichtBerechnet')}</p>`
      : `<p class="vp-hinweis">${wort('woche.keineDatierteEtappe')}</p>`;
  }

  toernGeladen(app.etappen.length > 0);
}

void start();

aufSprachwechsel(() => {
  if (!app.toern) return;
  const infoEl = $('vp-toern-info');
  if (infoEl) infoEl.textContent = toernBeschreibung(app.toern);
  zeigeRaender();
  zeigePlanung();
  zeigePlanFixierungen();
  zeigeWunschlisten();
  renderListe();
  void zeigeRollierend();
  wochentabelleNeuZeichnen();
  automatikNeuZeichnen();
});

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
