import L from 'leaflet';
import { stromImGitter, type StromGitter } from '@/core/messinaStrom';
import { hex, stromFarbe } from '@/core/wetterkarte';



const PX_JE_KN = 7;
const LEBEN_S: [number, number] = [3, 7];
const PX_JE_PARTIKEL = 700;
const MAX_PARTIKEL = 800;
const VERBLASSEN = 0.94;

interface Partikel { lat: number; lon: number; alter: number; leben: number }

let karte: L.Map | null = null;
let leinwand: HTMLCanvasElement | null = null;
let gitter: StromGitter | null = null;
let partikel: Partikel[] = [];
let rahmen = 0;
let zuletzt = 0;
let ruht = false;
let dpr = 1;

const ruhigeBewegung = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function gitterGrenzen(g: StromGitter): L.LatLngBounds {
  return L.latLngBounds([g.lat0, g.lon0], [g.lat0 + (g.zeilen - 1) * g.dLat, g.lon0 + (g.spalten - 1) * g.dLon]);
}


function sichtFeld(): L.LatLngBounds | null {
  if (!karte || !gitter) return null;
  const s = karte.getBounds(), b = gitterGrenzen(gitter);
  if (!s.intersects(b)) return null;
  return L.latLngBounds(
    [Math.max(s.getSouth(), b.getSouth()), Math.max(s.getWest(), b.getWest())],
    [Math.min(s.getNorth(), b.getNorth()), Math.min(s.getEast(), b.getEast())],
  );
}

function neuerPartikel(f: L.LatLngBounds): Partikel | null {
  for (let n = 0; n < 20; n++) {
    const lat = f.getSouth() + Math.random() * (f.getNorth() - f.getSouth());
    const lon = f.getWest() + Math.random() * (f.getEast() - f.getWest());
    if (gitter && stromImGitter(gitter, lat, lon)) {
      return { lat, lon, alter: 0, leben: LEBEN_S[0] + Math.random() * (LEBEN_S[1] - LEBEN_S[0]) };
    }
  }
  return null;
}


function neuAufsetzen(): void {
  if (!karte || !leinwand) return;
  const groesse = karte.getSize();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  leinwand.width = Math.round(groesse.x * dpr);
  leinwand.height = Math.round(groesse.y * dpr);
  leinwand.style.width = `${groesse.x}px`;
  leinwand.style.height = `${groesse.y}px`;
  L.DomUtil.setPosition(leinwand, karte.containerPointToLayerPoint([0, 0]));
  leinwand.getContext('2d')?.clearRect(0, 0, leinwand.width, leinwand.height);
  const f = sichtFeld();
  partikel = [];
  if (!f) return;
  const a = karte.latLngToContainerPoint(f.getNorthWest()), b = karte.latLngToContainerPoint(f.getSouthEast());
  const flaeche = Math.abs(b.x - a.x) * Math.abs(b.y - a.y);
  const n = Math.min(MAX_PARTIKEL, Math.round(flaeche / PX_JE_PARTIKEL));
  for (let i = 0; i < n; i++) {
    const p = neuerPartikel(f);
    if (p) { p.alter = Math.random() * p.leben; partikel.push(p); }
  }
}

function schritt(jetzt: number): void {
  rahmen = 0;
  if (!karte || !leinwand || !gitter) return;
  const dt = Math.min(0.05, Math.max(0, (jetzt - (zuletzt || jetzt)) / 1000));
  zuletzt = jetzt;
  const ctx = leinwand.getContext('2d');
  if (ctx && !ruht) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = `rgba(0,0,0,${VERBLASSEN})`;
    ctx.fillRect(0, 0, leinwand.width, leinwand.height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 2.6 * dpr;
    ctx.lineCap = 'round';
    const f = sichtFeld();
    for (let i = 0; i < partikel.length; i++) {
      const p = partikel[i]!;
      p.alter += dt;
      const s = stromImGitter(gitter, p.lat, p.lon);
      if (!s || p.alter > p.leben || !f) {
        const neu = f ? neuerPartikel(f) : null;
        if (neu) partikel[i] = neu;
        continue;
      }
      const a = karte.latLngToContainerPoint([p.lat, p.lon]);
      const b = L.point(a.x + s.u * PX_JE_KN * dt, a.y - s.v * PX_JE_KN * dt);
      const ll = karte.containerPointToLatLng(b);
      p.lat = ll.lat; p.lon = ll.lng;
      ctx.strokeStyle = hex(stromFarbe(Math.hypot(s.u, s.v)));
      ctx.beginPath();
      ctx.moveTo(a.x * dpr, a.y * dpr);
      ctx.lineTo(b.x * dpr, b.y * dpr);
      ctx.stroke();
    }
  }
  rahmen = requestAnimationFrame(schritt);
}

const beiBeginn = () => { ruht = true; if (leinwand) leinwand.style.visibility = 'hidden'; };
const beiEnde = () => { ruht = false; neuAufsetzen(); if (leinwand) leinwand.style.visibility = ''; };


export function zeigeStromAnimation(k: L.Map, pane: string, g: StromGitter | null): void {
  if (!g || ruhigeBewegung()) { stromAnimationAus(); return; }
  const neuesGitter = gitter !== g;
  gitter = g;
  if (karte !== k || !leinwand) {
    stromAnimationAus();
    gitter = g;
    karte = k;
    leinwand = L.DomUtil.create('canvas', 'tb-wk-partikel leaflet-zoom-hide', k.getPane(pane));
    leinwand.style.pointerEvents = 'none';
    k.on('movestart zoomstart', beiBeginn);
    k.on('moveend zoomend resize viewreset', beiEnde);
    neuAufsetzen();
  } else if (neuesGitter && partikel.length === 0) neuAufsetzen();
  if (!rahmen) { zuletzt = 0; rahmen = requestAnimationFrame(schritt); }
}

export function stromAnimationAus(): void {
  if (rahmen) cancelAnimationFrame(rahmen);
  rahmen = 0;
  if (karte) { karte.off('movestart zoomstart', beiBeginn); karte.off('moveend zoomend resize viewreset', beiEnde); }
  leinwand?.remove();
  leinwand = null; karte = null; gitter = null; partikel = []; ruht = false;
}
