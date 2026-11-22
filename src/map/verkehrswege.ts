import L from 'leaflet';
import { vtgInBox } from '@/core/messinaVtg';
import { ladeSeekartenObjekte, verkehrJetzt, type Verkehrsweg } from '@/data/seekartenObjekte';
import { istNacht } from './seekarte';


export const FAEHREN_AB_ZOOM = 8;
export const VTG_AB_ZOOM = 9;
const PANE = 'verkehrswege';
const FARBE = { tag: '#6F7F89', nacht: '#9A3A28' } as const;

export function verkehrswegeAuf(karte: L.Map, netz: () => boolean = () => navigator.onLine): void {
  if (!karte.getPane(PANE)) karte.createPane(PANE).style.zIndex = '230';
  const leinwand = L.canvas({ pane: PANE, padding: 0.3 });
  const gruppe = L.layerGroup().addTo(karte);

  function linie(punkte: L.LatLngExpression[], stil: L.PolylineOptions): void {
    L.polyline(punkte, { renderer: leinwand, interactive: false, pane: PANE, ...stil }).addTo(gruppe);
  }

  
  function pfeil(w: Verkehrsweg, farbe: string): void {
    const n = w.p.length / 2;
    if (n < 2) return;
    const i = Math.max(0, Math.floor(n / 2) - 1);
    const a = karte.latLngToLayerPoint([w.p[2 * i]!, w.p[2 * i + 1]!]);
    const b = karte.latLngToLayerPoint([w.p[2 * i + 2]!, w.p[2 * i + 3]!]);
    const d = b.subtract(a), len = Math.hypot(d.x, d.y);
    if (len < 1) return;
    const ux = d.x / len, uy = d.y / len, m = a.add(b).divideBy(2);
    const spitze = L.point(m.x + ux * 7, m.y + uy * 7);
    const links = L.point(m.x - ux * 5 - uy * 6, m.y - uy * 5 + ux * 6);
    const rechts = L.point(m.x - ux * 5 + uy * 6, m.y - uy * 5 - ux * 6);
    linie([links, spitze, rechts].map((p) => karte.layerPointToLatLng(p)), { color: farbe, weight: 2, opacity: 0.7 });
  }

  function zeichne(): void {
    gruppe.clearLayers();
    const z = karte.getZoom();
    if (z < FAEHREN_AB_ZOOM) return;
    const b = karte.getBounds().pad(0.2);
    const box = { swLat: b.getSouth(), swLon: b.getWest(), neLat: b.getNorth(), neLon: b.getEast() };
    const farbe = istNacht() ? FARBE.nacht : FARBE.tag;
    for (const w of verkehrJetzt(box)) {
      if (w.art !== 'faehre') {
        if (z < VTG_AB_ZOOM || vtgInBox({ swLat: w.s, swLon: w.w, neLat: w.n, neLon: w.o })) continue;
      }
      const pts: L.LatLngTuple[] = [];
      for (let k = 0; k < w.p.length; k += 2) pts.push([w.p[k]!, w.p[k + 1]!]);
      if (w.art === 'faehre') linie(pts, { color: farbe, weight: 1.6, opacity: 0.55, dashArray: '10 7' });
      else if (w.art === 'grenze') linie(pts, { color: farbe, weight: 1.2, opacity: 0.6, dashArray: '5 5' });
      else if (w.art === 'zone') {
        if (w.flaeche) L.polygon(pts, { renderer: leinwand, interactive: false, pane: PANE, stroke: false, fillColor: farbe, fillOpacity: 0.18 }).addTo(gruppe);
        else linie(pts, { color: farbe, weight: 4, opacity: 0.25 });
      } else {
        linie(pts, { color: farbe, weight: 1.2, opacity: 0.55, dashArray: '2 6' });
        if (!w.flaeche) pfeil(w, farbe);
      }
    }
  }

  let geplant = 0;
  function bald(): void {
    if (geplant) return;
    geplant = window.setTimeout(() => {
      geplant = 0;
      zeichne();
      if (karte.getZoom() < FAEHREN_AB_ZOOM) return;
      const b = karte.getBounds().pad(0.2);
      void ladeSeekartenObjekte({ swLat: b.getSouth(), swLon: b.getWest(), neLat: b.getNorth(), neLon: b.getEast() }, netz())
        .then((neu) => { if (neu) zeichne(); }, () => undefined);
    }, 150);
  }
  karte.on('moveend zoomend', bald);
  window.addEventListener('online', bald);
  new MutationObserver(() => zeichne()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  bald();
}
