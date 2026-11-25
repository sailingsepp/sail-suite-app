import L from 'leaflet';
import { SEKTOREN, TRENNZONEN, FAHRBAHN_PFEILE, KREISVERKEHR } from '@/core/messinaVtg';
import { MESSINA_EINFAHRT } from '@/core/messinaStrom';
import { aktuelleSprache } from '@/shell/sprache';

const FARBE = '#C2185B';
const AB_ZOOM = 10;

const TEXT = {
  de: {
    gebiet: 'Verkehrstrennungsgebiet Straße von Messina',
    sued: 'Südeinfahrt (38°08,9′ N)', nord: 'Nordeinfahrt (Capo Peloro bis Torre Cavallo)',
  },
  en: {
    gebiet: 'Traffic separation scheme, Strait of Messina',
    sued: 'Southern entrance (38°08.9′ N)', nord: 'Northern entrance (Capo Peloro to Torre Cavallo)',
  },
} as const;
const t = () => TEXT[aktuelleSprache()];

export function addVtgEbene(karte: L.Map, optionen: { pfeile?: boolean } = {}): L.LayerGroup {
  const ebene = L.layerGroup();
  const ll = (p: { lat: number; lon: number }): L.LatLngTuple => [p.lat, p.lon];
  for (const s of SEKTOREN) {
    L.polygon(s.map(ll), { color: FARBE, weight: 1.5, dashArray: '6 4', fillColor: FARBE, fillOpacity: 0.06 })
      .bindTooltip(() => t().gebiet, { sticky: true }).addTo(ebene);
  }
  for (const z of TRENNZONEN) {
    L.polygon(z.map(ll), { stroke: false, fillColor: FARBE, fillOpacity: 0.35, interactive: false }).addTo(ebene);
  }
  L.circle(ll(KREISVERKEHR.mitte), { radius: KREISVERKEHR.radiusSm * 1852, stroke: false, fillColor: FARBE, fillOpacity: 0.35, interactive: false }).addTo(ebene);
  for (const f of optionen.pfeile === false ? [] : FAHRBAHN_PFEILE) {
    L.marker(ll(f.ort), {
      interactive: false, keyboard: false,
      icon: L.divIcon({
        className: 'vtg-pfeil karte-mitdrehen', iconSize: [18, 18], iconAnchor: [9, 9],
        html: `<svg viewBox="0 0 18 18" width="18" height="18" style="transform:rotate(${f.kurs}deg)" aria-hidden="true"><path d="M9 1 L15 15 L9 11 L3 15 Z" fill="${FARBE}" fill-opacity="0.8"/></svg>`,
      }),
    }).addTo(ebene);
  }
  for (const [e, schluessel] of [[MESSINA_EINFAHRT.sued, 'sued'], [MESSINA_EINFAHRT.nord, 'nord']] as const) {
    L.polyline([ll(e.a), ll(e.b)], { color: FARBE, weight: 1, dashArray: '2 5', opacity: 0.9 })
      .bindTooltip(() => t()[schluessel], { sticky: true }).addTo(ebene);
  }
  const zeige = () => {
    if (karte.getZoom() >= AB_ZOOM) { if (!karte.hasLayer(ebene)) ebene.addTo(karte); }
    else if (karte.hasLayer(ebene)) karte.removeLayer(ebene);
  };
  karte.on('zoomend', zeige);
  zeige();
  return ebene;
}
