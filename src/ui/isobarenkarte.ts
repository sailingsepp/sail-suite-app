import L from 'leaflet';
import { nf, tagKurz } from '@/core/time';
import { isobaren, glaettePfad } from '@/core/isobaren';
import { analysiereFronten, type Frontart } from '@/core/fronten';
import type { DruckGitter, Druckanalyse } from '@/core/druckfeld';
import type { Punkt } from '@/core/types';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { STRINGS } from './strings';

const NORMALDRUCK = 1013.25;

const REGION_HALBBREITE_LAT = 5;
const REGION_HALBBREITE_LON = 7;

const FARBE_HOCH = '#E08A3C';
const FARBE_TIEF = '#4FA3C7';
const FARBE_NORMAL = '#8FA6B2';

function farbe(hPa: number): string {
  if (hPa > NORMALDRUCK + 1) return FARBE_HOCH;
  if (hPa < NORMALDRUCK - 1) return FARBE_TIEF;
  return FARBE_NORMAL;
}

interface Karte {
  map: L.Map;
  ebene: L.LayerGroup;
}

let karte: Karte | null = null;
let container: HTMLDivElement | null = null;
let abzeichenEl: HTMLDivElement | null = null;

let kartenStand: { datum: string; stunde: number } | null = null;

function lokalisiereIsobar(): void {
  const dict = STRINGS[aktuelleSprache()];
  if (abzeichenEl) {
    const sp = aktuelleSprache();
    const stand = kartenStand
      ? ` · ${tagKurz(kartenStand.datum, sp)}, ${String(kartenStand.stunde).padStart(2, '0')}00 LT`
      : '';
    abzeichenEl.textContent = dict['isobar.badge']! + stand;
  }
  if (modal) {
    modal.setAttribute('aria-label', dict['isobar.modalAriaLabel']!);
    const kopf = modal.querySelector('.karten-modal-kopf span');
    if (kopf) kopf.textContent = dict['isobar.modalTitle']!;
    modal.querySelector('.karten-modal-schliessen')?.setAttribute('aria-label', dict['isobar.close']!);
  }
}
aufSprachwechsel(lokalisiereIsobar);

function holeContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'iso-map';
  }
  return container;
}

function baueKarte(): Karte {
  if (karte) return karte;
  const map = L.map(holeContainer(), {
    zoomControl: false,
    attributionControl: false,

    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    touchZoom: false, boxZoom: false, keyboard: false,

    maxBoundsViscosity: 1.0,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 8, crossOrigin: 'anonymous' }).addTo(map);
  const ebene = L.layerGroup().addTo(map);

  const abzeichen = document.createElement('div');
  abzeichen.className = 'iso-badge';
  holeContainer().appendChild(abzeichen);
  abzeichenEl = abzeichen;
  lokalisiereIsobar();
  karte = { map, ebene };
  return karte;
}

function beschriftung(zug: { lat: number; lon: number }[], hPa: number): L.Marker {
  const p = zug[Math.floor(zug.length / 2)]!;
  return L.marker([p.lat, p.lon], {
    interactive: false,
    icon: L.divIcon({
      className: 'iso-label',
      html: `<span style="color:${farbe(hPa)}">${nf(hPa, 0)}</span>`,
      iconSize: [34, 14], iconAnchor: [17, 7],
    }),
  });
}

function zentrumMarke(lat: number, lon: number, art: 'H' | 'T', hPa: number): L.Marker {
  return L.marker([lat, lon], {
    interactive: false,
    icon: L.divIcon({
      className: 'iso-zentrum',
      html: `<b class="iso-zentrum-buchstabe ${art === 'H' ? 'hoch' : 'tief'}">${art}</b>`
        + `<span class="iso-zentrum-wert">${nf(hPa, 0)}</span>`,
      iconSize: [40, 34], iconAnchor: [20, 17],
    }),
  });
}

const FRONT_FARBE: Record<Frontart, string> = {
  kalt: '#3B82D6',
  warm: '#D6453B',
  okklusion: '#A855C7',
  stationaer: '#3B82D6',
};

const SYMBOL_ABSTAND_GRAD = 0.8;

function frontSymbol(
  lat: number, lon: number, richtung: number, form: 'dreieck' | 'halbkreis', farbe: string,
): L.Marker {
  const d = form === 'dreieck'

    ? '<svg width="14" height="9" viewBox="0 0 14 9"><path d="M7 0 L14 9 L0 9 Z" fill="' + farbe + '"/></svg>'
    : '<svg width="14" height="9" viewBox="0 0 14 9"><path d="M0 9 A7 7 0 0 1 14 9 Z" fill="' + farbe + '"/></svg>';
  return L.marker([lat, lon], {
    interactive: false,
    icon: L.divIcon({
      className: 'front-symbol',

      html: `<div style="transform:rotate(${richtung}deg);transform-origin:50% 100%">${d}</div>`,
      iconSize: [14, 9], iconAnchor: [7, 9],
    }),
  });
}

function peilung(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dx = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  const dy = b.lat - a.lat;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function zeichneFronten(gitter: DruckGitter, analyse: Druckanalyse | null, ebene: L.LayerGroup): void {
  if (!gitter.fronten) return;
  const tief = analyse?.tief ? { lat: analyse.tief.lat, lon: analyse.tief.lon } : null;
  for (const front of analysiereFronten(gitter, gitter.fronten, tief)) {
    const farbe = FRONT_FARBE[front.art];

    const zug = glaettePfad(front.punkte);
    L.polyline(zug.map((p) => [p.lat, p.lon] as [number, number]), {
      color: farbe, weight: 2.6, opacity: 0.95, interactive: false,
      lineJoin: 'round', lineCap: 'round',
    }).addTo(ebene);

    let seitDemLetzten = Infinity;
    let n = 0;
    for (let i = 1; i < zug.length; i++) {
      const a = zug[i - 1]!, b = zug[i]!;
      seitDemLetzten += Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180));
      if (seitDemLetzten < SYMBOL_ABSTAND_GRAD) continue;
      seitDemLetzten = 0;

      const laengs = peilung(a, b);
      if (front.art === 'stationaer') {
        const rechts = (laengs + 90) % 360;
        frontSymbol(b.lat, b.lon, rechts, n % 2 ? 'halbkreis' : 'dreieck',
          n % 2 ? FRONT_FARBE.warm : FRONT_FARBE.kalt).addTo(ebene);
      } else {
        const form: 'dreieck' | 'halbkreis' = front.art === 'warm' ? 'halbkreis'
          : (front.art === 'kalt' ? 'dreieck' : (n % 2 ? 'halbkreis' : 'dreieck'));
        frontSymbol(b.lat, b.lon, front.zugrichtung, form, farbe).addTo(ebene);
      }
      n++;
    }
  }
}

function zeichne(gitter: DruckGitter, analyse: Druckanalyse | null, mitte: Punkt): void {
  const k = baueKarte();
  k.ebene.clearLayers();

  for (const linie of isobaren(gitter)) {
    for (const zug of linie.linien) {

      L.polyline(glaettePfad(zug).map((p) => [p.lat, p.lon] as [number, number]), {
        color: farbe(linie.hPa),
        weight: Math.abs(linie.hPa - NORMALDRUCK) < 1 ? 1.8 : 1.1,
        opacity: 0.95,
        interactive: false,
        lineJoin: 'round', lineCap: 'round',
      }).addTo(k.ebene);
    }

    for (const zug of linie.linien) {
      if (zug.length >= 3) beschriftung(zug, linie.hPa).addTo(k.ebene);
    }
  }

  zeichneFronten(gitter, analyse, k.ebene);

  if (analyse?.hoch) zentrumMarke(analyse.hoch.lat, analyse.hoch.lon, 'H', analyse.hoch.hPa).addTo(k.ebene);
  if (analyse?.tief) zentrumMarke(analyse.tief.lat, analyse.tief.lon, 'T', analyse.tief.hPa).addTo(k.ebene);

  L.circleMarker([mitte.lat, mitte.lon], {
    radius: 4, color: '#F2A93B', weight: 2, fillColor: '#F2A93B', fillOpacity: 1, interactive: false,
  }).addTo(k.ebene);

  letzteGitterBounds = L.latLngBounds(
    [gitter.lats[0]!, gitter.lons[0]!],
    [gitter.lats[gitter.lats.length - 1]!, gitter.lons[gitter.lons.length - 1]!],
  );

  const isobarenBounds = L.latLngBounds(
    [mitte.lat - REGION_HALBBREITE_LAT, mitte.lon - REGION_HALBBREITE_LON],
    [mitte.lat + REGION_HALBBREITE_LAT, mitte.lon + REGION_HALBBREITE_LON],
  );
  if (analyse?.hoch) isobarenBounds.extend([analyse.hoch.lat, analyse.hoch.lon]);
  if (analyse?.tief) isobarenBounds.extend([analyse.tief.lat, analyse.tief.lon]);
  letzteIsobarenBounds = isobarenBounds;
  letzteMitte = mitte;
}

let letzteGitterBounds: L.LatLngBounds | null = null;
let letzteIsobarenBounds: L.LatLngBounds | null = null;
let letzteMitte: Punkt | null = null;

const VORSCHAU_HERAUSZOOMEN = 1;

function passeAn(): void {
  const k = karte;
  if (!k || !letzteGitterBounds || !letzteIsobarenBounds || !letzteMitte) return;
  const gitterBounds = letzteGitterBounds, isoBounds = letzteIsobarenBounds, mitte = letzteMitte;
  requestAnimationFrame(() => {
    k.map.invalidateSize();
    const imDialog = !!modal && !modal.hidden;
    if (imDialog) {

      k.map.fitBounds(isoBounds, { padding: [12, 12] });
      k.map.setMinZoom(k.map.getZoom());
      k.map.setMaxBounds(isoBounds.pad(0.15));
      return;
    }

    k.map.setMinZoom(0);
    k.map.setMaxBounds(undefined);

    const fuellzoom = k.map.getBoundsZoom(gitterBounds, true);
    k.map.setView([mitte.lat, mitte.lon], Math.max(0, fuellzoom - VORSCHAU_HERAUSZOOMEN), { animate: false });
  });
}

let groessenWaechter: ResizeObserver | null = null;
function beobachteGroesse(el: HTMLElement): void {
  if (groessenWaechter || typeof ResizeObserver === 'undefined') return;
  groessenWaechter = new ResizeObserver((eintraege) => {
    const kasten = eintraege[0]?.contentRect;

    if (!kasten || kasten.width < 1 || kasten.height < 1) return;
    passeAn();
  });
  groessenWaechter.observe(el);
}

let modal: HTMLDivElement | null = null;
let bedienungGebunden = false;

const INTERAKTION = ['dragging', 'scrollWheelZoom', 'doubleClickZoom', 'touchZoom', 'boxZoom', 'keyboard'] as const;

function schalteInteraktion(an: boolean): void {
  if (!karte) return;
  for (const name of INTERAKTION) {
    const h = karte.map[name] as { enable(): void; disable(): void } | undefined;
    if (an) h?.enable(); else h?.disable();
  }
}

function holeModal(): HTMLDivElement {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'karten-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = '<div class="karten-modal-kopf">'
    + '<span></span>'
    + '<button type="button" class="karten-modal-schliessen">✕</button>'
    + '</div><div class="karten-modal-buehne"></div>';
  modal.querySelector('.karten-modal-schliessen')!.addEventListener('click', schliesse);
  document.body.appendChild(modal);
  lokalisiereIsobar();
  return modal;
}

function oeffne(): void {
  if (!karte || !container) return;
  const m = holeModal();
  m.querySelector('.karten-modal-buehne')!.appendChild(container);
  m.hidden = false;
  schalteInteraktion(true);
  passeAn();
  (m.querySelector('.karten-modal-schliessen') as HTMLElement).focus();
}

function schliesse(): void {
  if (!modal || modal.hidden || !container) return;
  modal.hidden = true;
  schalteInteraktion(false);
  const platzhalter = document.getElementById('isobaren-karte');
  if (platzhalter) {
    platzhalter.appendChild(container);
    passeAn();
  }
  platzhalter?.focus();
}

function bindeBedienung(): void {
  if (bedienungGebunden) return;
  bedienungGebunden = true;

  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#isobaren-karte')) oeffne();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { schliesse(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as HTMLElement).closest('#isobaren-karte')) {
      e.preventDefault();
      oeffne();
    }
  });
}

export function zeigeIsobarenkarte(
  gitter: DruckGitter | null, analyse: Druckanalyse | null, mitte: Punkt | null,
  stand: { datum: string; stunde: number } | null = null,
): void {
  const platzhalter = document.getElementById('isobaren-karte');
  if (!platzhalter) return;

  if (!gitter || !mitte) { platzhalter.remove(); return; }
  kartenStand = stand;
  lokalisiereIsobar();
  bindeBedienung();

  if (!modal || modal.hidden) platzhalter.appendChild(holeContainer());
  zeichne(gitter, analyse, mitte);
  passeAn();

  beobachteGroesse(holeContainer());
}
