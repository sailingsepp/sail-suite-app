import L from 'leaflet';
import type { WochenplanErgebnis } from '@/core/wochenplan';
import { kantenWeg, type Kandidatennetz } from '@/core/hafennetz';
import type { Punkt } from '@/core/types';
import { markenJeOrt, punktAufWeg, PFEIL_ANTEIL } from './karteGeometrie';
import { escapeHtml } from '@/core/html';

const KLASSE_ROUTE = 'vp-route';
const KLASSE_SCHATTEN = 'vp-route-schatten';
const KLASSE_GEWAEHLT = 'vp-route-gewaehlt';
const KLASSE_MARKE_AKTIV = 'vp-karte-marke-aktiv';

const gezeichnet: { linien: Map<number, L.Polyline[]>; marken: { marke: L.Marker; tage: readonly number[] }[] } = {
  linien: new Map(), marken: [],
};
let gewaehlterTag: number | null = null;
let tagWahl: ((tag: number) => void) | null = null;

function merkeLinie(linie: L.Polyline, tag: number): void {
  linie.on('add', () => linie.getElement()?.classList.toggle(KLASSE_GEWAEHLT, tag === gewaehlterTag));
  linie.on('click', () => tagWahl?.(tag));
  gezeichnet.linien.set(tag, [...(gezeichnet.linien.get(tag) ?? []), linie]);
}
function merkeMarke(marke: L.Marker, tage: readonly number[], beimKlick: number): void {
  marke.on('add', () => marke.getElement()?.classList.toggle(KLASSE_MARKE_AKTIV, gewaehlterTag != null && tage.includes(gewaehlterTag)));
  marke.on('click', () => tagWahl?.(beimKlick));
  gezeichnet.marken.push({ marke, tage });
}

export function setzeTagWahl(rueckruf: (tag: number) => void): void {
  tagWahl = rueckruf;
}

export function hebeTagHervor(tag: number | null): void {
  gewaehlterTag = tag;
  for (const [t, linien] of gezeichnet.linien) {
    for (const linie of linien) {
      linie.getElement()?.classList.toggle(KLASSE_GEWAEHLT, t === tag);
      if (t === tag) linie.bringToFront();
    }
  }
  for (const { marke, tage } of gezeichnet.marken) {
    marke.getElement()?.classList.toggle(KLASSE_MARKE_AKTIV, tag != null && tage.includes(tag));
  }
}

export interface KartenPlan {
  ergebnis: WochenplanErgebnis;
  netz: Kandidatennetz;

  gewaehlt?: boolean;

  aufZiehen?: (tag: number, punkt: Punkt) => void;
}

export function zeichnePlaene(gruppe: L.LayerGroup, plaene: readonly KartenPlan[]): void {
  gruppe.clearLayers();
  gezeichnet.linien.clear();
  gezeichnet.marken = [];
  for (const plan of plaene) zeichneEinenPlan(gruppe, plan);
  if (gewaehlterTag != null) hebeTagHervor(gewaehlterTag);
}

function zeichneEinenPlan(gruppe: L.LayerGroup, plan: KartenPlan): void {
  const gedaempft = plan.gewaehlt === false;
  const deckkraft = gedaempft ? 0.35 : 0.9;

  for (const etappe of plan.ergebnis.etappen) {

    if (etappe.istHafentag) continue;
    const von = plan.netz.knoten[etappe.vonIndex];
    const nach = plan.netz.knoten[etappe.nachIndex];
    if (!von || !nach) continue;

    const weg = kantenWeg(plan.netz, etappe.vonIndex, etappe.nachIndex);
    const punkte = weg.map((p) => [p.lat, p.lon] as [number, number]);

    if (!gedaempft) L.polyline(punkte, { className: KLASSE_SCHATTEN, weight: 6, opacity: 0.35, interactive: false }).addTo(gruppe);
    const linie = L.polyline(punkte, {
      className: KLASSE_ROUTE,
      weight: gedaempft ? 2 : 3,
      opacity: deckkraft,

      dashArray: etappe.regime === 'geruest' ? '7 6' : undefined,

    }).bindTooltip(escapeHtml(`${etappe.tag}: ${von.name} → ${nach.name}`), { sticky: true }).addTo(gruppe);
    if (!gedaempft) merkeLinie(linie, etappe.tag);

    const pfeil = gedaempft ? null : punktAufWeg(weg, PFEIL_ANTEIL);
    if (pfeil) {
      L.marker([pfeil.punkt.lat, pfeil.punkt.lon], {
        icon: L.divIcon({
          className: 'vp-karte-pfeil',

          html: `<span aria-hidden="true" style="transform:rotate(${Math.round(pfeil.kursDeg - 90)}deg)">➤</span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 500,
      }).addTo(gruppe);
    }
  }

  for (const [knotenIndex, { tage, fahrtage }] of markenJeOrt(plan.ergebnis.etappen)) {
    const ort = plan.netz.knoten[knotenIndex];
    if (!ort) continue;
    const letzter = tage[tage.length - 1]!;

    const ziehbar = fahrtage.length === 1 && plan.aufZiehen != null;
    const text = tage.join('·');
    const breite = Math.max(22, 8 + text.length * 7);
    const marke = L.marker([ort.ort.lat, ort.ort.lon], {
      icon: L.divIcon({
        className: `vp-karte-marke${gedaempft ? ' vp-karte-marke-gedaempft' : ''}${ziehbar ? ' vp-karte-marke-ziehbar' : ''}`,
        html: `<span style="width:${breite}px;border-radius:11px">${text}</span>`,
        iconSize: [breite, 22],
        iconAnchor: [breite / 2, 11],
      }),

      zIndexOffset: gedaempft ? 0 : 1000 + letzter,
      title: `${ort.name} · ${text}`,
      draggable: ziehbar,
    }).addTo(gruppe);

    if (!gedaempft) merkeMarke(marke, tage, fahrtage[0] ?? tage[0]!);
    if (ziehbar) {

      marke.on('dragend', () => {
        const { lat, lng } = marke.getLatLng();
        plan.aufZiehen!(fahrtage[0]!, { lat, lon: lng });
      });
    }
  }
}

export function zeichneUeberstellung(
  gruppe: L.LayerGroup, schlaege: readonly { punkte: readonly Punkt[]; tag: number; titel: string }[],
  halte: readonly { ort: Punkt; text: string; titel: string; tag: number }[],
): void {
  gruppe.clearLayers();
  gezeichnet.linien.clear();
  gezeichnet.marken = [];
  for (const s of schlaege) {
    const punkte = s.punkte.map((p) => [p.lat, p.lon] as [number, number]);
    L.polyline(punkte, { className: KLASSE_SCHATTEN, weight: 6, opacity: 0.35, interactive: false }).addTo(gruppe);
    const linie = L.polyline(punkte, { className: KLASSE_ROUTE, weight: 3, opacity: 0.9 })

      .bindTooltip(escapeHtml(s.titel), { sticky: true }).addTo(gruppe);
    merkeLinie(linie, s.tag);
  }
  for (const h of halte) {
    const breite = Math.max(22, 8 + h.text.length * 7);
    const marke = L.marker([h.ort.lat, h.ort.lon], {
      icon: L.divIcon({
        className: 'vp-karte-marke',
        html: `<span style="width:${breite}px;border-radius:11px">${escapeHtml(h.text)}</span>`,
        iconSize: [breite, 22], iconAnchor: [breite / 2, 11],
      }),
      title: h.titel,
    }).addTo(gruppe);

    const tage = (h.text.match(/\d+/g) ?? [String(h.tag)]).map(Number);
    merkeMarke(marke, tage, tage[0]!);
  }
  if (gewaehlterTag != null) hebeTagHervor(gewaehlterTag);
}

export function passeAusschnittAn(karte: L.Map, gruppe: L.LayerGroup): void {
  const ebenen = gruppe.getLayers();
  if (ebenen.length === 0) return;
  const grenzen = L.featureGroup(ebenen as L.Layer[]).getBounds();

  if (grenzen.isValid()) karte.fitBounds(grenzen, { ...kartenRaender(karte), maxZoom: 12, animate: false });
}

export function kartenRaender(karte: L.Map): { paddingTopLeft: L.PointTuple; paddingBottomRight: L.PointTuple } {
  const g = karte.getSize();
  return {
    paddingTopLeft: [Math.min(50, g.x * 0.08), Math.min(40, g.y * 0.1)],
    paddingBottomRight: [Math.min(170, g.x * 0.25), Math.min(30, g.y * 0.08)],
  };
}
