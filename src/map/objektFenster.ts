import './objektFenster.css';
import L from 'leaflet';
import { initModal, type ModalHandle } from '@/shell/modal';
import { aktuelleSprache } from '@/shell/sprache';
import { API_BASIS } from '@/shell/api';
import { escapeHtml } from '@/core/html';
import { distNM } from '@/core/geo';
import { trefferAm, type KartenTreffer } from '@/core/kartenTreffer';
import { feuerSteckbrief } from '@/briefing/feuerText';
import { diensteVon, gefahrSteckbrief, hafenSteckbrief, tankstelleSteckbrief, tonneSteckbrief } from '@/briefing/seezeichenText';
import { ladeUmgebungFuer, umgebungLokal } from '@/data/umgebung';
import { gefahrenImGebiet } from '@/data/navroute';
import type { Punkt, Sprache } from '@/core/types';



const TEXTE: Record<Sprache, Record<string, string>> = {
  de: {
    schliessen: 'Schließen', quelle: 'Quelle: OpenStreetMap (OpenSeaMap)', sektor: 'Sektor',
    luftbild: 'Luftbild', laedt: 'Luftbild wird geladen …', fehlt: 'Luftbild nicht verfügbar', offline: 'Offline. Luftbild nicht verfügbar!',
    esri: 'Powered by Esri · ArcGIS Static Maps', gross: 'Luftbild groß zeigen', tippen: 'Zum Zoomen tippen.', klicken: 'Zum Zoomen klicken.',
  },
  en: {
    schliessen: 'Close', quelle: 'Source: OpenStreetMap (OpenSeaMap)', sektor: 'Sector',
    luftbild: 'Aerial view', laedt: 'Loading aerial view …', fehlt: 'Aerial view not available', offline: 'Offline. Aerial view not available!',
    esri: 'Powered by Esri · ArcGIS Static Maps', gross: 'Show aerial view enlarged', tippen: 'Tap to zoom.', klicken: 'Click to zoom.',
  },
};
const tx = (k: string): string => TEXTE[aktuelleSprache()][k] ?? k;
const esc = escapeHtml;


const TREFFER_PX = 24;

const DIENSTE_M = 500;
const PAKET_AB_ZOOM = 11;
const GEFAHREN_AB_ZOOM = 12;

export interface ObjektFensterOptionen {
  
  aus?: () => boolean;
  
  aktion?: { text: () => string; beimKlick: (p: Punkt) => void };
}

export interface ObjektFenster {
  
  tipp: (e: L.LeafletMouseEvent) => Promise<boolean>;
}

type Elemente = readonly (readonly [number, number, Readonly<Record<string, string>>])[];

export function objektFensterAuf(k: L.Map, o: ObjektFensterOptionen = {}): ObjektFenster {
  
  let nachgeladen = '';
  const nachladen = (): void => {
    if (!navigator.onLine) return;
    const z = k.getZoom();
    const m = k.getCenter();
    if (z >= PAKET_AB_ZOOM) void ladeUmgebungFuer({ lat: m.lat, lon: m.lng }).catch(() => null);
    if (z >= GEFAHREN_AB_ZOOM) {
      const b = k.getBounds();
      const schl = `${b.getSouth().toFixed(2)},${b.getWest().toFixed(2)},${b.getNorth().toFixed(2)},${b.getEast().toFixed(2)}`;
      if (schl !== nachgeladen) {
        nachgeladen = schl;
        void gefahrenImGebiet({ swLat: b.getSouth(), swLon: b.getWest(), neLat: b.getNorth(), neLon: b.getEast() }, false).catch(() => null);
      }
    }
  };
  k.on('moveend', nachladen);
  nachladen();

  async function tipp(e: L.LeafletMouseEvent): Promise<boolean> {
    if (o.aus?.()) return false;
    const ziel = e.originalEvent?.target as Element | null;
    if (ziel?.closest?.('.leaflet-interactive, .leaflet-control')) return false;
    const z = k.getZoom();
    if (z < PAKET_AB_ZOOM) return false;
    let ll = e.latlng;
    
    const ev = e.originalEvent as MouseEvent | undefined;
    if (ev && typeof ev.clientX === 'number') {
      const trifft = (r: DOMRect) => r.width > 0 && ev.clientX >= r.left - 6 && ev.clientX <= r.right + 6 && ev.clientY >= r.top - 6 && ev.clientY <= r.bottom + 6;
      for (const el of k.getContainer().querySelectorAll<HTMLElement>('.tb-kn[data-lat]')) {
        if ([el, ...el.querySelectorAll<HTMLElement>('*')].some((x) => trifft(x.getBoundingClientRect()))) {
          ll = L.latLng(Number(el.dataset['lat']), Number(el.dataset['lon']));
          break;
        }
      }
    }
    const punkt = { lat: ll.lat, lon: ll.lng };
    const paket = await umgebungLokal(punkt, 0).catch(() => null);
    const d = 0.01;
    const gefahren = z >= GEFAHREN_AB_ZOOM
      ? (await gefahrenImGebiet({ swLat: ll.lat - d, swLon: ll.lng - d, neLat: ll.lat + d, neLon: ll.lng + d }, true).catch(() => null))?.gefahren ?? []
      : [];
    const p0 = k.latLngToContainerPoint(ll);
    const elemente: Elemente = paket?.elemente ?? [];
    const t = trefferAm(elemente, gefahren, z, (lat, lon) => k.latLngToContainerPoint([lat, lon]).distanceTo(p0), TREFFER_PX);
    if (!t) return false;
    oeffne(t, elemente, { lat: e.latlng.lat, lon: e.latlng.lng }, o);
    return true;
  }

  return { tipp };
}



interface Bausatz { overlay: HTMLDivElement; titel: HTMLHeadingElement; inhalt: HTMLDivElement; x: HTMLButtonElement; handle: ModalHandle }
let bausatz: Bausatz | null = null;

function baue(): Bausatz {
  if (bausatz) return bausatz;
  const overlay = document.createElement('div');
  overlay.className = 'of-overlay';
  overlay.hidden = true;
  overlay.innerHTML = '<div class="of-modal" role="dialog" aria-modal="true" aria-labelledby="of-titel" tabindex="-1">'
    + '<div class="of-kopf"><h2 id="of-titel"></h2><button type="button" class="of-x">✕</button></div>'
    + '<div class="of-inhalt"></div></div>';
  document.body.append(overlay);
  const modal = overlay.querySelector<HTMLDivElement>('.of-modal')!;
  const handle = initModal(modal, schliesseObjektFenster);
  const x = overlay.querySelector<HTMLButtonElement>('.of-x')!;
  x.addEventListener('click', schliesseObjektFenster);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) schliesseObjektFenster(); });
  bausatz = { overlay, titel: overlay.querySelector('h2')!, inhalt: overlay.querySelector('.of-inhalt')!, x, handle };
  return bausatz;
}

export function schliesseObjektFenster(): void {
  if (schliesseGross()) return;
  if (!bausatz || bausatz.overlay.hidden) return;
  bausatz.overlay.hidden = true;
  bausatz.handle.beimSchliessen();
}

const liste = (z: readonly { titel: string; text: string }[]): string => z.length
  ? `<dl class="of-liste">${z.map((x) => `<dt>${esc(x.titel)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>` : '';

function oeffne(t: KartenTreffer, elemente: Elemente, getippt: Punkt, o: ObjektFensterOptionen): void {
  const b = baue();
  const s = aktuelleSprache();
  let titel: string, art: string | null, html = '';
  const tags = t.art === 'gefahr' ? null : t.tags;
  const mitFeuer = !!tags && Object.keys(tags).some((x) => x.startsWith('seamark:light'));
  if (tags && (t.art === 'feuer' || (t.art === 'tonne' && mitFeuer))) {
    const f = feuerSteckbrief(tags, s, null);
    titel = f.titel; art = f.art;
    
    if (t.art === 'tonne') html += liste(tonneSteckbrief(tags, s).zeilen.filter((z) => z.titel !== (s === 'de' ? 'Hinweis' : 'Note')));
    for (const sek of f.sektoren) {
      if (sek.nr !== null && f.sektoren.length > 1) html += `<p class="of-sektor">${esc(`${tx('sektor')} ${sek.nr}`)}</p>`;
      html += liste(sek.zeilen);
    }
    html += liste(f.zeilen);
  } else {
    const dienste: string[] = [];
    if (t.art === 'hafen') {
      const set = new Set<string>();
      for (const [lat, lon, tg] of elemente) if (distNM(t.lat, t.lon, lat, lon) * 1852 <= DIENSTE_M) for (const x of diensteVon(tg)) set.add(x);
      dienste.push(...set);
    }
    const st = t.art === 'gefahr' ? gefahrSteckbrief(t.gefahr.art, t.gefahr.name, t.gefahr.merkmale ?? {}, s)
      : t.art === 'tonne' ? tonneSteckbrief(t.tags, s)
        : t.art === 'hafen' ? hafenSteckbrief(t.tags, dienste, s) : tankstelleSteckbrief(t.tags, s);
    titel = st.titel; art = st.art;
    html += liste(st.zeilen);
    if (t.art === 'hafen') html += '<div class="of-luftbild"></div>';
  }
  if (o.aktion) html += `<button type="button" class="of-aktion">${esc(o.aktion.text())}</button>`;
  html += `<p class="of-quelle">${esc(tx('quelle'))}</p>`;
  b.titel.textContent = titel;
  b.x.setAttribute('aria-label', tx('schliessen'));
  b.inhalt.innerHTML = (art ? `<p class="of-art">${esc(art)}</p>` : '') + html;
  const ort = t.art === 'hafen' || t.art === 'tankstelle' ? { lat: t.lat, lon: t.lon } : getippt;
  b.inhalt.querySelector('.of-aktion')?.addEventListener('click', () => { schliesseObjektFenster(); o.aktion!.beimKlick(ort); });
  const lb = b.inhalt.querySelector<HTMLElement>('.of-luftbild');
  if (lb) zeigeLuftbild(lb, t.lat, t.lon, titel);
  if (b.overlay.hidden) { b.overlay.hidden = false; b.handle.beimOeffnen(document.activeElement as HTMLElement | null, b.x); }
}



function beruehrung(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return 'ontouchstart' in window; }
}

function zeigeLuftbild(box: HTMLElement, lat: number, lon: number, titel: string): void {
  const status = document.createElement('p');
  status.className = 'of-leise';
  if (!navigator.onLine) { status.textContent = tx('offline'); box.replaceChildren(status); return; }
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'of-luftbild-bild';
  knopf.setAttribute('aria-label', tx('gross'));
  const bild = document.createElement('img');
  bild.alt = tx('luftbild');
  bild.decoding = 'async';
  bild.src = `${API_BASIS}/api/luftbild?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`;
  knopf.appendChild(bild);
  const hinweis = document.createElement('p');
  hinweis.className = 'of-leise';
  hinweis.textContent = tx(beruehrung() ? 'tippen' : 'klicken');
  status.textContent = tx('laedt');
  bild.addEventListener('load', () => { status.textContent = tx('esri'); });
  bild.addEventListener('error', () => { knopf.remove(); hinweis.remove(); status.textContent = tx(navigator.onLine ? 'fehlt' : 'offline'); });
  knopf.addEventListener('click', () => { if (bild.naturalWidth) zeigeGross(bild, titel); });
  box.replaceChildren(hinweis, knopf, status);
}

let grossKarte: L.Map | null = null;
function schliesseGross(): boolean {
  const el = document.getElementById('of-gross');
  if (!el) return false;
  grossKarte?.remove();
  grossKarte = null;
  el.remove();
  return true;
}

function zeigeGross(bild: HTMLImageElement, titel: string): void {
  schliesseGross();
  const el = document.createElement('section');
  el.id = 'of-gross';
  el.className = 'of-gross';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${tx('luftbild')}: ${titel}`);
  el.innerHTML = `<header class="of-gross-kopf"><h2>${esc(titel)}</h2><button type="button" class="of-x" aria-label="${esc(tx('schliessen'))}">✕</button></header>`
    + `<div class="of-gross-flaeche"></div><p class="of-gross-fuss">${esc(tx('esri'))}</p>`;
  document.body.appendChild(el);
  el.querySelector('.of-x')!.addEventListener('click', () => { schliesseGross(); });
  el.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); schliesseGross(); } });
  const flaeche = el.querySelector<HTMLElement>('.of-gross-flaeche')!;
  const grenzen = L.latLngBounds([0, 0], [bild.naturalHeight, bild.naturalWidth]);
  grossKarte = L.map(flaeche, { crs: L.CRS.Simple, attributionControl: false, zoomSnap: 0, zoomDelta: 0.5, maxBoundsViscosity: 1, minZoom: -5 });
  L.imageOverlay(bild.src, grenzen).addTo(grossKarte);
  grossKarte.fitBounds(grenzen);
  const start = grossKarte.getZoom();
  grossKarte.setMinZoom(start);
  grossKarte.setMaxZoom(start + 2);
  grossKarte.setMaxBounds(grenzen);
  el.querySelector<HTMLButtonElement>('.of-x')!.focus();
}
