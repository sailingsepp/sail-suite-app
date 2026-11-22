import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { stationenNachEntfernung, GEZEIT_MAX_KM, type Stationstreffer } from '@/core/gezeiten';
import { gezeitenLage, lageVerschoben } from '@/core/gezeitenLage';
import type { GezeitenStation } from '@/core/gezeitenStationen';
import type { CopernicusGitter } from '@/core/copernicusMarine';
import { zonenVersatzMs, nf, alsUtc } from '@/core/time';


const KM_JE_SM = 1.852;
import { describeGezeitenTafel } from '@/briefing/gezeiten';
import { gezeitenGrafikHtml, bindeGezeitenGrafik } from '@/ui/gezeitenGrafik';
import { holeGitterUm } from '@/data/copernicusMarine';
import { istOnline } from './netz';
import { STRINGS } from './strings';
import { escapeHtml } from '@/core/html';



type Position = { lat: number; lon: number } | null;

const $ = (id: string) => document.getElementById(id);
const wort = (k: string): string => STRINGS[aktuelleSprache()][k] ?? k;

let modal: ModalHandle | null = null;
let position: () => Position = () => null;
let stationen: readonly GezeitenStation[] | null = null;
let gewaehlt: string | null = null;
let gitter: CopernicusGitter | null = null;
let abruf = 0;

async function ladeStationen(): Promise<readonly GezeitenStation[] | null> {
  if (stationen) return stationen;
  stationen = await import('@/core/gezeitenStationen').then((m) => m.GEZEITEN_STATIONEN).catch(() => null);
  return stationen;
}


function fuelleAuswahl(treffer: Stationstreffer[], mitEntfernung: boolean): void {
  const sel = $('tb-gz-pegel') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = '';
  for (const t of treffer) {
    const o = document.createElement('option');
    o.value = t.station.id;
    o.textContent = mitEntfernung
      ? `${t.station.name} (${t.station.land}), ${nf(t.entfernungKm / KM_JE_SM, 0, aktuelleSprache())} ${aktuelleSprache() === 'en' ? 'NM' : 'sm'}`
      : `${t.station.name} (${t.station.land})`;
    sel.appendChild(o);
  }
  if (gewaehlt && treffer.some((t) => t.station.id === gewaehlt)) sel.value = gewaehlt;
  else gewaehlt = sel.value || null;
}

function zeichne(): void {
  const inhalt = $('tb-gz-inhalt');
  if (!inhalt || !stationen) return;
  const pos = position();
  const sprache = aktuelleSprache();
  const liste = pos
    ? stationenNachEntfernung(stationen, pos.lat, pos.lon)
    : [...stationen].sort((a, b) => a.name.localeCompare(b.name)).map((station) => ({ station, entfernungKm: NaN }));
  fuelleAuswahl(pos ? liste.slice(0, 10) : liste, !!pos);
  const treffer = liste.find((t) => t.station.id === gewaehlt) ?? liste[0];
  const hinweis = $('tb-gz-position');
  if (hinweis) hinweis.textContent = pos ? '' : wort('gezeiten.ohnePosition');
  if (!treffer) { inhalt.innerHTML = ''; return; }

  const ort = pos ?? { lat: treffer.station.lat, lon: treffer.station.lon };
  const jetzt = new Date();
  const von = alsUtc(new Date(jetzt.getTime() - 6 * 3600e3));
  const bis = alsUtc(new Date(jetzt.getTime() + 30 * 3600e3));
  const lage = gezeitenLage(stationen, ort.lat, ort.lon, von, bis, gitter,
    { station: treffer.station, entfernungKm: pos ? treffer.entfernungKm : 0 });
  if (!lage) { inhalt.innerHTML = ''; return; }
  
  
  
  const versatz = zonenVersatzMs(treffer.station.zeitzone, jetzt);
  const anzeige = lageVerschoben(lage, versatz);
  const jetztAnzeige = new Date(jetzt.getTime() + versatz);
  inhalt.innerHTML = gezeitenGrafikHtml({ lage: anzeige, jetzt: jetztAnzeige, sprache, breite: 380 })
    + describeGezeitenTafel({ lage: anzeige, jetzt: jetztAnzeige }, sprache);
  bindeGezeitenGrafik(inhalt);
  const knopf = $('btn-gz-wetter') as HTMLButtonElement | null;
  if (knopf) knopf.hidden = !!gitter && lage.modell.length > 0;
}

async function oeffne(): Promise<void> {
  const el = $('tb-gezeiten-modal');
  if (!el) return;
  el.removeAttribute('hidden');
  modal?.beimOeffnen();
  const inhalt = $('tb-gz-inhalt');
  const nr = ++abruf;
  if (!stationen && inhalt) inhalt.innerHTML = `<p class="tb-hinweis">${wort('gezeiten.laedt')}</p>`;
  const s = await ladeStationen();
  if (nr !== abruf) return;
  if (!s) {
    if (inhalt) inhalt.innerHTML = `<p class="tb-sw-fehlt">${wort('gezeiten.fehlt')}</p>`;
    return;
  }
  zeichne();
}

async function holeWetteranteil(): Promise<void> {
  const status = $('tb-gz-status');
  const pos = position();
  const st = stationen?.find((s) => s.id === gewaehlt);
  const ort = pos ?? (st ? { lat: st.lat, lon: st.lon } : null);
  if (!ort) return;
  if (!istOnline()) { if (status) status.textContent = wort('gezeiten.wetterOffline'); return; }
  if (status) status.textContent = wort('gezeiten.wetterLaedt');
  const nr = ++abruf;
  
  const g = await holeGitterUm([ort], 0.5);
  if (nr !== abruf) return;
  gitter = g;
  if (status) status.textContent = g ? '' : wort('gezeiten.wetterFehlt');
  zeichne();
  if (streifenAn) zeichneStreifen();
  
  if (g && status && !g.wasserstandOhneGezeit) status.textContent = wort('gezeiten.wetterFehlt');
}

function schliesse(): void {
  abruf++;
  $('tb-gezeiten-modal')?.setAttribute('hidden', '');
  modal?.beimSchliessen();
}




const STREIFEN_TAKT_MS = 5 * 60_000;
let streifenAn = false;
let streifenGezeichnet = 0;
let streifenLaedt = false;



function zeichneStreifen(): boolean {
  const el = $('tb-gz-streifen');
  const inhalt = $('tb-gz-streifen-inhalt');
  if (!el || !inhalt || !stationen) return false;
  const sprache = aktuelleSprache();
  const pos = position();
  const gewaehlteStation = gewaehlt ? stationen.find((s) => s.id === gewaehlt) : undefined;
  const ref = pos ?? (gewaehlteStation ? { lat: gewaehlteStation.lat, lon: gewaehlteStation.lon } : null);
  if (!ref) {
    
    
    inhalt.innerHTML = `<p class="tb-gz-kopf">${escapeHtml(wort('gezeiten.streifenOhnePosition'))}</p>`;
    el.hidden = false;
    return true;
  }
  const treffer = gewaehlteStation
    ? stationenNachEntfernung([gewaehlteStation], ref.lat, ref.lon)[0]
    : stationenNachEntfernung(stationen, ref.lat, ref.lon)[0];
  if (!treffer) { el.hidden = true; return true; }
  const jetzt = new Date();
  const von = alsUtc(new Date(jetzt.getTime() - 6 * 3600e3));
  const bis = alsUtc(new Date(jetzt.getTime() + 30 * 3600e3));
  const lage = gezeitenLage(stationen, ref.lat, ref.lon, von, bis, gitter,
    { station: treffer.station, entfernungKm: pos ? treffer.entfernungKm : 0 });
  if (!lage) { el.hidden = true; return true; }
  const versatz = zonenVersatzMs(treffer.station.zeitzone, jetzt);
  
  const sm = pos ? nf(treffer.entfernungKm / KM_JE_SM, 0, sprache) : '–';
  const kopf = wort(pos && treffer.entfernungKm > GEZEIT_MAX_KM ? 'gezeiten.streifenFern' : 'gezeiten.streifenPegel')
    .replace('{name}', treffer.station.name)
    .replace('{sm}', sm);
  inhalt.innerHTML = `<p class="tb-gz-kopf">${escapeHtml(kopf)}</p>`
    + gezeitenGrafikHtml({
      lage: lageVerschoben(lage, versatz), jetzt: new Date(jetzt.getTime() + versatz),
      sprache, breite: 380,
    });
  el.hidden = false;
  return true;
}


export function gezeitenStreifen(an: boolean): void {
  const el = $('tb-gz-streifen');
  if (!el) return;
  if (!an) {
    streifenAn = false;
    el.hidden = true;
    return;
  }
  const neu = !streifenAn;
  streifenAn = true;
  if (!neu && Date.now() - streifenGezeichnet < STREIFEN_TAKT_MS) return;
  if (stationen) {
    if (zeichneStreifen()) streifenGezeichnet = Date.now();
    return;
  }
  if (streifenLaedt) return;
  streifenLaedt = true;
  void ladeStationen().then((s) => {
    streifenLaedt = false;
    if (!s || !streifenAn) return;
    if (zeichneStreifen()) streifenGezeichnet = Date.now();
  });
}


export function gezeitenNeuZeichnen(): void {
  if ($('tb-gezeiten-modal')?.hasAttribute('hidden') === false) zeichne();
  if (streifenAn) zeichneStreifen();
}

export function initGezeiten(positionQuelle: () => Position): void {
  position = positionQuelle;
  const el = $('tb-gezeiten-modal');
  if (el) modal = initModal(el, schliesse);
  $('btn-gezeiten')?.addEventListener('click', () => void oeffne());
  const streifen = $('tb-gz-streifen');
  streifen?.addEventListener('click', () => void oeffne());
  streifen?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); void oeffne(); }
  });
  $('btn-gezeiten-zu')?.addEventListener('click', schliesse);
  $('btn-gz-wetter')?.addEventListener('click', () => void holeWetteranteil());
  $('tb-gz-pegel')?.addEventListener('change', (ev) => {
    gewaehlt = (ev.target as HTMLSelectElement).value;
    zeichne();
    if (streifenAn) zeichneStreifen();
  });
}
