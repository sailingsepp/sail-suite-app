import type { Sprache } from '@/core/types';
import { escapeHtml } from '@/core/html';
import { nf } from '@/core/time';
import { einFingerScrollt } from '@/map/einFinger';
import { initModal, type ModalHandle } from '@/shell/modal';
import { bindeOrtsAutocomplete } from './ortsAutocomplete';
import type { OrtsVorschlag } from '@/data/ortssuche';
import { liegeplaetzeUmOrt, type LiegeplatzWahl } from '@/data/haefen';
import { pruefeWegpunkt } from '@/data/landcheck';
import './liegeplatzWahl.css';

import { lateinisch } from '@/core/umschrift';



export interface LiegeplatzErgebnis {
  name: string;
  lat: number;
  lon: number;
  
  land: string | null;
}

export interface LiegeplatzWahlOptionen {
  titel: string;
  sprache: Sprache;
  
  vorbelegung?: { name: string; lat: number; lon: number } | null;
  
  mitte?: { lat: number; lon: number } | null;
}

const TEXTE = {
  de: {
    suche: 'Ort, Marina oder Hafen suchen',
    platzhalter: 'z. B. Trogir, Alimos, Lefkas …',
    hinweis: 'Ungefähre Eingabe genügt. Danach den Liegeplatz aus der Liste wählen.',
    suchen: 'Zuerst oben eine Gegend suchen.',
    laedt: 'Liegeplätze werden gesucht …',
    keine: 'Hier sind keine benannten Liegeplätze eingetragen. Punkt auf der Karte antippen.',
    fehler: 'Die Suche hat zu lange gedauert oder ist fehlgeschlagen.',
    erneut: 'Erneut versuchen',
    liste: 'Liegeplätze in der Nähe',
    karteHinweis: 'Nicht dabei? Punkt auf der Karte antippen.',
    freiName: 'Name des Punkts',
    gewaehlt: 'Gewählt',
    nichts: 'Noch nichts gewählt',
    uebernehmen: 'Übernehmen',
    abbrechen: 'Abbrechen',
    schliessen: 'Schließen',
    marina: 'Marina',
    hafen: 'Hafen',
    bucht: 'Bucht',
    frei: 'Punkt auf der Karte',
    pruefe: 'Prüfe, ob der Punkt im Wasser liegt …',
    verschoben: 'Der Punkt lag an Land und wurde auf die nächste Wasserstelle gesetzt.',
    anLand: 'Der Punkt liegt an Land. Bitte im Wasser antippen.',
    ungeprueft: 'Ob der Punkt im Wasser liegt, ließ sich gerade nicht prüfen. Bitte deutlich im Wasser setzen.',
    nameFehlt: 'Bitte dem Punkt einen Namen geben.',
  },
  en: {
    suche: 'Search for a town, marina or harbour',
    platzhalter: 'e.g. Trogir, Alimos, Lefkas …',
    hinweis: 'A rough entry is enough. Then pick the berth from the list.',
    suchen: 'Search for an area above first.',
    laedt: 'Looking for berths …',
    keine: 'No named berths are mapped here. Tap a point on the map.',
    fehler: 'The search took too long or failed.',
    erneut: 'Try again',
    liste: 'Berths nearby',
    karteHinweis: 'Not listed? Tap a point on the map.',
    freiName: 'Name of the point',
    gewaehlt: 'Selected',
    nichts: 'Nothing selected yet',
    uebernehmen: 'Use this',
    abbrechen: 'Cancel',
    schliessen: 'Close',
    marina: 'Marina',
    hafen: 'Harbour',
    bucht: 'Bay',
    frei: 'Point on the map',
    pruefe: 'Checking that the point is on water …',
    verschoben: 'The point was on land and has been moved to the nearest water.',
    anLand: 'The point is on land. Please tap on the water.',
    ungeprueft: 'Could not check right now whether the point is on water. Please place it clearly on the water.',
    nameFehlt: 'Please give the point a name.',
  },
} as const;

interface Bausatz {
  overlay: HTMLElement;
  modal: HTMLElement;
  titel: HTMLElement;
  sucheText: HTMLElement;
  suchfeld: HTMLInputElement;
  hinweis: HTMLElement;
  listenTitel: HTMLElement;
  liste: HTMLElement;
  karte: HTMLElement;
  karteHinweis: HTMLElement;
  freiFeld: HTMLElement;
  freiLabel: HTMLElement;
  freiName: HTMLInputElement;
  gewaehlt: HTMLElement;
  uebernehmen: HTMLButtonElement;
  abbrechen: HTMLButtonElement;
  schliessen: HTMLButtonElement;
  handle: ModalHandle;
}

let bausatz: Bausatz | null = null;

let karte: import('leaflet').Map | null = null;
let markenEbene: import('leaflet').LayerGroup | null = null;
let L: typeof import('leaflet') | null = null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, klasse?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}


function baue(): Bausatz {
  if (bausatz) return bausatz;

  const overlay = el('div', 'lpw-overlay');
  overlay.hidden = true;
  const modal = el('div', 'lpw-modal');
  modal.tabIndex = -1;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const kopf = el('div', 'lpw-kopf');
  const titel = el('h2');
  titel.id = 'lpw-titel';
  modal.setAttribute('aria-labelledby', titel.id);
  const schliessen = el('button', 'lpw-schliessen', '✕');
  schliessen.type = 'button';
  kopf.append(titel, schliessen);

  const suche = el('label', 'lpw-suche');
  const sucheText = el('span');
  const suchfeld = el('input');
  suchfeld.type = 'text';
  suche.append(sucheText, suchfeld);

  const hinweis = el('p', 'lpw-hinweis');

  const spalten = el('div', 'lpw-spalten');
  const linkeSpalte = el('div');
  const listenTitel = el('p', 'lpw-hinweis');
  const liste = el('ul', 'lpw-liste');
  
  
  liste.setAttribute('aria-live', 'polite');
  linkeSpalte.append(listenTitel, liste);

  const rechteSpalte = el('div');
  const karteEl = el('div', 'lpw-karte');
  const karteHinweis = el('p', 'lpw-hinweis');
  
  
  karteHinweis.setAttribute('aria-live', 'polite');
  rechteSpalte.append(karteEl, karteHinweis);
  spalten.append(linkeSpalte, rechteSpalte);

  const freiFeld = el('div', 'lpw-frei');
  freiFeld.hidden = true;
  const freiLabel = el('label');
  freiLabel.htmlFor = 'lpw-frei-name';
  const freiName = el('input');
  freiName.type = 'text';
  freiName.id = 'lpw-frei-name';
  freiName.maxLength = 120;
  freiFeld.append(freiLabel, freiName);

  const gewaehlt = el('p', 'lpw-gewaehlt');

  
  
  
  
  
  
  
  bindeOrtsAutocomplete(suchfeld, (v) => aufOrtsAuswahl?.(v), () => wahlSprache);

  const aktionen = el('div', 'lpw-aktionen');
  const uebernehmen = el('button', 'btn primary');
  uebernehmen.type = 'button';
  const abbrechen = el('button', 'btn');
  abbrechen.type = 'button';
  aktionen.append(uebernehmen, abbrechen);

  
  const fuss = el('div', 'lpw-fuss');
  fuss.append(gewaehlt, aktionen);
  modal.append(kopf, suche, hinweis, spalten, freiFeld, fuss);
  overlay.append(modal);
  document.body.append(overlay);

  bausatz = {
    overlay, modal, titel, sucheText, suchfeld, hinweis, listenTitel, liste,
    karte: karteEl, karteHinweis, freiFeld, freiLabel, freiName, gewaehlt,
    uebernehmen, abbrechen, schliessen,
    handle: initModal(modal, () => schliesse(null)),
  };
  return bausatz;
}


let aktuellSchliessen: ((ergebnis: LiegeplatzErgebnis | null) => void) | null = null;

let aufOrtsAuswahl: ((v: OrtsVorschlag) => void) | null = null;
let wahlSprache: Sprache = 'de';
function schliesse(ergebnis: LiegeplatzErgebnis | null): void {
  aktuellSchliessen?.(ergebnis);
}


function mitZeitschranke<T>(zusage: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden der Karte')), ms);
    zusage.then((wert) => { clearTimeout(timer); resolve(wert); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

async function ladeKarte(behaelter: HTMLElement): Promise<void> {
  
  
  if (!L) L = (await mitZeitschranke(import('leaflet'), 15_000)).default;
  
  
  const [{ seekarteAuf }, { seekartenNamen }] = await mitZeitschranke(
    Promise.all([import('@/map/seekarte'), import('@/map/seekartenNamen')]), 15_000);
  if (!karte) {
    karte = L.map(behaelter, { attributionControl: true });
    einFingerScrollt(karte);
    const sk = seekarteAuf(karte);
    seekartenNamen(karte, sk, { netz: () => navigator.onLine });
    markenEbene = L.layerGroup().addTo(karte);
  }
  
  
  karte.invalidateSize();
}

export function oeffneLiegeplatzWahl(opts: LiegeplatzWahlOptionen): Promise<LiegeplatzErgebnis | null> {
  const t = TEXTE[opts.sprache];
  const b = baue();
  let suchLauf = 0;
  let land: string | null = null;
  let gewaehlt: { name: string; lat: number; lon: number } | null = opts.vorbelegung ?? null;
  let freiGesetzt = false;
  
  let pruefLauf = 0;
  let pruefungLaeuft = false;

  b.titel.textContent = opts.titel;
  b.sucheText.textContent = t.suche;
  b.suchfeld.placeholder = t.platzhalter;
  b.suchfeld.value = '';
  b.hinweis.textContent = t.hinweis;
  b.listenTitel.textContent = t.liste;
  b.karteHinweis.textContent = t.karteHinweis;
  b.freiLabel.textContent = t.freiName;
  b.freiName.value = '';
  b.freiFeld.hidden = true;
  b.uebernehmen.textContent = t.uebernehmen;
  b.abbrechen.textContent = t.abbrechen;
  b.schliessen.setAttribute('aria-label', t.schliessen);
  b.liste.replaceChildren();
  b.listenTitel.textContent = t.suchen;

  function zeigeGewaehlt(): void {
    b.gewaehlt.replaceChildren();
    if (!gewaehlt) {
      b.gewaehlt.textContent = t.nichts;
      b.uebernehmen.disabled = true;
      return;
    }
    
    
    
    b.gewaehlt.append(`${t.gewaehlt}: `, el('strong', undefined, lateinisch(gewaehlt.name) || t.frei));
    b.uebernehmen.disabled = pruefungLaeuft || !gewaehlt.name;
  }

  function setzeMarken(treffer: readonly LiegeplatzWahl[]): void {
    if (!L || !karte || !markenEbene) return;
    markenEbene.clearLayers();
    for (const platz of treffer) {
      const ist = gewaehlt?.lat === platz.ort.lat && gewaehlt?.lon === platz.ort.lon;
      L.circleMarker([platz.ort.lat, platz.ort.lon], {
        radius: ist ? 9 : 6,
        color: ist ? '#e6a54a' : '#7fb2d9',
        weight: 2,
        fillOpacity: 0.7,
      })
        .bindTooltip(escapeHtml(lateinisch(platz.name)))
        .on('click', () => waehle(platz.name, platz.ort.lat, platz.ort.lon, false))
        .addTo(markenEbene);
    }
    if (gewaehlt && freiGesetzt) {
      L.circleMarker([gewaehlt.lat, gewaehlt.lon], {
        radius: 9, color: '#e6a54a', weight: 2, fillOpacity: 0.7,
      }).addTo(markenEbene);
    }
  }

  let letzteTreffer: LiegeplatzWahl[] = [];

  function waehle(name: string, lat: number, lon: number, frei: boolean): void {
    gewaehlt = { name, lat, lon };
    freiGesetzt = frei;
    b.freiFeld.hidden = !frei;
    if (frei) {
      b.freiName.value = name;
      b.freiName.focus();
    }
    for (const knopf of b.liste.querySelectorAll<HTMLButtonElement>('.lpw-treffer')) {
      knopf.setAttribute('aria-pressed', String(!frei && knopf.dataset.name === name));
    }
    setzeMarken(letzteTreffer);
    zeigeGewaehlt();
  }

  function zeigeTreffer(treffer: readonly LiegeplatzWahl[]): void {
    letzteTreffer = [...treffer];
    b.liste.replaceChildren();
    if (!treffer.length) { b.listenTitel.textContent = t.keine; return; }
    b.listenTitel.textContent = t.liste;
    for (const platz of treffer) {
      const li = el('li');
      const knopf = el('button', 'lpw-treffer');
      knopf.type = 'button';
      knopf.dataset.name = platz.name;
      
      
      knopf.setAttribute('aria-pressed', String(gewaehlt?.name === platz.name));
      const links = el('span');
      links.append(el('span', 'lpw-name', lateinisch(platz.name)), document.createTextNode(' '), el('span', 'lpw-art', t[platz.art]));
      knopf.append(links, el('span', 'lpw-distanz', `${nf(platz.distanzSm, 1, opts.sprache)} ${opts.sprache === 'en' ? 'NM' : 'sm'}`));
      knopf.addEventListener('click', () => waehle(platz.name, platz.ort.lat, platz.ort.lon, false));
      li.append(knopf);
      b.liste.append(li);
    }
  }

  function zeigeFehler(mitte: { lat: number; lon: number }, zoom: number): void {
    b.listenTitel.textContent = t.fehler;
    b.liste.replaceChildren();
    const li = el('li');
    const knopf = el('button', 'btn', t.erneut);
    knopf.type = 'button';
    knopf.addEventListener('click', () => void zeigeGegend(mitte, zoom));
    li.append(knopf);
    b.liste.append(li);
  }

  async function zeigeGegend(mitte: { lat: number; lon: number }, zoom = 12): Promise<void> {
    const lauf = ++suchLauf;
    b.listenTitel.textContent = t.laedt;
    b.liste.replaceChildren();
    try {
      await ladeKarte(b.karte);
      if (lauf !== suchLauf) return;
      karte?.setView([mitte.lat, mitte.lon], zoom);
      const treffer = await liegeplaetzeUmOrt({ lat: mitte.lat, lon: mitte.lon });
      
      
      if (lauf !== suchLauf) return;
      zeigeTreffer(treffer);
      setzeMarken(treffer);
    } catch {
      
      
      
      
      if (lauf !== suchLauf) return;
      zeigeFehler(mitte, zoom);
    }
  }

  wahlSprache = opts.sprache;
  aufOrtsAuswahl = (v: OrtsVorschlag) => {
    land = v.land;
    
    
    void zeigeGegend({ lat: v.lat, lon: v.lon }, v.istOrt ? 12 : 14);
  };

  b.freiName.oninput = () => {
    if (!gewaehlt || !freiGesetzt) return;
    gewaehlt = { ...gewaehlt, name: b.freiName.value.trim() };
    zeigeGewaehlt();
  };

  
  async function setzeFreienPunkt(lat: number, lon: number): Promise<void> {
    const lauf = ++pruefLauf;
    pruefungLaeuft = true;
    b.karteHinweis.textContent = t.pruefe;
    waehle(b.freiName.value.trim(), lat, lon, true);
    const pruefung = await pruefeWegpunkt({ lat, lon });
    if (lauf !== pruefLauf) return;
    pruefungLaeuft = false;
    if (pruefung.aufLand && pruefung.korrektur) {
      waehle(b.freiName.value.trim(), pruefung.korrektur.lat, pruefung.korrektur.lon, true);
      b.karteHinweis.textContent = t.verschoben;
    } else if (pruefung.aufLand) {
      gewaehlt = null;
      freiGesetzt = false;
      b.freiFeld.hidden = true;
      setzeMarken(letzteTreffer);
      b.karteHinweis.textContent = t.anLand;
    } else {
      b.karteHinweis.textContent = pruefung.geprueft ? t.karteHinweis : t.ungeprueft;
    }
    zeigeGewaehlt();
  }

  zeigeGewaehlt();

  return new Promise<LiegeplatzErgebnis | null>((resolve) => {
    let erledigt = false;
    aktuellSchliessen = (ergebnis) => {
      if (erledigt) return;
      erledigt = true;
      suchLauf++;             
      pruefLauf++;            
      pruefungLaeuft = false;
      aktuellSchliessen = null;
      aufOrtsAuswahl = null;
      karte?.off('click');
      b.overlay.hidden = true;
      b.handle.beimSchliessen();
      resolve(ergebnis);
    };

    b.uebernehmen.onclick = () => {
      if (pruefungLaeuft) return;
      if (!gewaehlt || !gewaehlt.name.trim()) {
        if (freiGesetzt) { b.karteHinweis.textContent = t.nameFehlt; b.freiName.focus(); }
        return;
      }
      schliesse({ name: gewaehlt.name.trim(), lat: gewaehlt.lat, lon: gewaehlt.lon, land });
    };
    b.abbrechen.onclick = () => schliesse(null);
    b.schliessen.onclick = () => schliesse(null);
    b.overlay.onclick = (e) => { if (e.target === b.overlay) schliesse(null); };

    b.overlay.hidden = false;
    b.handle.beimOeffnen(undefined, b.suchfeld);

    void (async () => {
      
      
      
      
      
      
      
      
      try {
        await ladeKarte(b.karte);
      } catch {
        
        
      }
      karte?.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        void setzeFreienPunkt(e.latlng.lat, e.latlng.lng);
      });
      if (opts.vorbelegung) {
        await zeigeGegend(opts.vorbelegung, 13);
      } else if (opts.mitte) {
        await zeigeGegend(opts.mitte, 11);
      } else {
        
        
        karte?.setView([40.0, 17.0], 5);
      }
    })();
  });
}
