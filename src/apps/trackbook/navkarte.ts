import L from 'leaflet';
import { escapeHtml } from '@/core/html';
import { karteNeuMessen, karteObjekt, kartenWinkel, sichtPolster } from './karte';
import { bildschirmRichtung, freieRichtung, tooltipLage } from '@/core/beschriftungsSeite';
import type { Punkt } from '@/core/types';
import { XTE_AUF_KURS_SM, ANKUNFT_SM, type Gefahr, type NavRoute, type NavWegpunkt } from '@/core/navigation';
import { KONTUR, ROUTENFARBE, WERKZEUGFARBE } from './kartenfarben';
import { schenkelMitte } from '@/core/routeBearbeiten';



const ROT = '#E05A4F';
const ZUKUNFT = 'tb-zukunft';

const ROUTE_EBENE = 'tbRoute';

const NAMEN_EBENE = 'tbNamen';
const R = { interactive: false, pane: ROUTE_EBENE } as const;

let ebene: L.LayerGroup | null = null;
let planEbene: L.LayerGroup | null = null;
let griffEbene: L.LayerGroup | null = null;
let griffSchluessel = '';
let ziehtGerade = false;
let gefahrEbene: L.LayerGroup | null = null;
let messEbene: L.LayerGroup | null = null;
let mobEbene: L.LayerGroup | null = null;
let ankerEbene: L.LayerGroup | null = null;
let untiefeEbene: L.LayerGroup | null = null;
let klick: ((p: Punkt) => void) | null = null;

let klickArt: 'tipp' | 'punkt' = 'tipp';

function karte(): L.Map | null {
  const k = karteObjekt();
  if (k && !ebene) {
    k.createPane(ROUTE_EBENE).style.zIndex = '395';
    if (!k.getPane(NAMEN_EBENE)) k.createPane(NAMEN_EBENE).style.zIndex = '650';
    
    if (!k.getPane('tbMessText')) k.createPane('tbMessText').style.zIndex = '670';
    ebene = L.layerGroup().addTo(k);
    gefahrEbene = L.layerGroup().addTo(k);
    untiefeEbene = L.layerGroup().addTo(k);
    planEbene = L.layerGroup().addTo(k);
    messEbene = L.layerGroup().addTo(k);
    ankerEbene = L.layerGroup().addTo(k);
    mobEbene = L.layerGroup().addTo(k);
    griffEbene = L.layerGroup().addTo(k);
    k.on('click', (e: L.LeafletMouseEvent) => { if (klickArt === 'tipp') klick?.({ lat: e.latlng.lat, lon: e.latlng.lng }); });
    
    k.on('zoomend', () => { if (zuletztRoute) zeichneAktiveRoute(zuletztRoute.route, zuletztRoute.boot); });
  }
  return k;
}

let zuletztRoute: { route: NavRoute; boot: Punkt | null } | null = null;


const KORRIDOR_AB_PX = 18;


function korridorPx(m: L.Map, lat: number): number {
  const meterJePx = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** m.getZoom());
  return (2 * XTE_AUF_KURS_SM * 1852) / meterJePx;
}

const ll = (p: Punkt): L.LatLngTuple => [p.lat, p.lon];



export function setzeKartenklick(cb: ((p: Punkt) => void) | null, art: 'tipp' | 'punkt' = 'tipp'): void {
  const k = karte();
  klick = cb;
  klickArt = art;
  k?.getContainer().classList.toggle('tb-nav-zielt', !!cb && art === 'punkt');
}


export function kartenLangDruck(p: Punkt): boolean {
  if (!klick || klickArt !== 'punkt') return false;
  klick(p);
  return true;
}


export function zeichneAktiveRoute(route: NavRoute | null, boot: Punkt | null): void {
  if (!karte() || !ebene) return;
  ebene.clearLayers();
  zuletztRoute = route ? { route, boot } : null;
  if (!route) return;
  const wp = route.wegpunkte;
  const i = route.naechster;
  if (i > 1) {
    L.polyline(wp.slice(0, i).map(ll), { ...R, color: ROUTENFARBE, weight: 2, opacity: 0.45, dashArray: '4 6', className: `${ZUKUNFT} tb-route` }).addTo(ebene);
  }
  const rest = wp.slice(i - 1).map(ll);
  
  
  const breite = korridorPx(karte()!, wp[i]?.lat ?? wp[0]!.lat);
  if (breite >= KORRIDOR_AB_PX) {
    for (const [anteil, deckung] of [[1, 0.07], [0.75, 0.08]] as const) {
      L.polyline(rest, { ...R, color: ROUTENFARBE, weight: breite * anteil, opacity: deckung, lineCap: 'round', lineJoin: 'round', className: `${ZUKUNFT} tb-route-korridor` }).addTo(ebene);
    }
  }
  
  L.polyline(rest, { ...R, color: KONTUR, weight: 9, opacity: 0.7, className: `${ZUKUNFT} tb-route-kontur` }).addTo(ebene);
  L.polyline(rest, { ...R, color: ROUTENFARBE, weight: 6, opacity: 0.95, className: `${ZUKUNFT} tb-route` }).addTo(ebene);
  wp.forEach((p, k) => {
    if (k === 0) return;
    const aktiv = k === i;
    L.circleMarker(ll(p), {
      ...R, radius: aktiv ? 8 : 5, color: ROUTENFARBE, weight: 2, opacity: k < i ? 0.45 : 1,
      fillColor: aktiv ? ROUTENFARBE : '#FFFFFF', fillOpacity: k < i ? 0.45 : 1,
      className: `${ZUKUNFT} ${aktiv ? 'tb-route-wp-aktiv' : 'tb-route-wp'}`,
    }).bindTooltip(escapeHtml(p.name), { className: 'tb-nav-tip', pane: NAMEN_EBENE, permanent: aktiv, ...(aktiv ? namensLage(wp, k, boot) : { direction: 'top' }) }).addTo(ebene!);
  });
  
  const nw = wp[i];
  if (nw?.radiusSm !== undefined && nw.radiusSm > ANKUNFT_SM) {
    L.circle(ll(nw), { ...R, radius: nw.radiusSm * 1852, color: ROUTENFARBE, weight: 1.5, opacity: 0.8, fillOpacity: 0.06, dashArray: '4 4', className: `${ZUKUNFT} tb-route-kreis` }).addTo(ebene);
  }
  const naechster = wp[i];
  if (boot && naechster) {
    L.polyline([ll(boot), ll(naechster)], { ...R, color: ROUTENFARBE, weight: 2, dashArray: '2 6', className: `${ZUKUNFT} tb-route` }).addTo(ebene);
  }
}


function namensLage(wp: readonly NavWegpunkt[], k: number, boot: Punkt | null) {
  const m = karte()!;
  const dreh = kartenWinkel();
  const pt = (p: Punkt) => m.latLngToLayerPoint(ll(p));
  const hier = pt(wp[k]!);
  const r = (p: Punkt | null | undefined) => {
    if (!p) return null;
    const w = bildschirmRichtung(hier, pt(p));
    return w === null ? null : (w + dreh + 360) % 360;
  };
  const zumBoot = r(boot);
  const meiden = [zumBoot, zumBoot === null ? null : (zumBoot + 180) % 360, r(wp[k + 1]), r(wp[k - 1])];
  return tooltipLage(freieRichtung(meiden), 10);
}


export function zeichnePlan(punkte: readonly NavWegpunkt[] | null): void {
  if (!karte() || !planEbene) return;
  planEbene.clearLayers();
  
  if (punkte?.length === 1) {
    L.circleMarker(ll(punkte[0]!), { ...R, radius: 8, color: ROUTENFARBE, weight: 3, fillColor: '#FFFFFF', fillOpacity: 1, className: 'tb-route-wp' }).addTo(planEbene);
    return;
  }
  if (!punkte || punkte.length < 2) return;
  L.polyline(punkte.map(ll), { ...R, color: KONTUR, weight: 6, opacity: 0.6, className: 'tb-route-kontur' }).addTo(planEbene);
  L.polyline(punkte.map(ll), { ...R, color: ROUTENFARBE, weight: 3, dashArray: '8 6', className: 'tb-route' }).addTo(planEbene);
  L.circleMarker(ll(punkte[0]!), { ...R, radius: 7, color: ROUTENFARBE, weight: 2, fillColor: '#FFFFFF', fillOpacity: 1, className: 'tb-route-wp' }).addTo(planEbene);
}

export interface GriffAktionen {
  ziehen(k: number, p: Punkt): void;
  waehlen(k: number): void;
  einfuegen(nach: number, p: Punkt): void;
}


export function zeichneGriffe(punkte: readonly NavWegpunkt[] | null, fest: number, gewaehlt: number | null, a: GriffAktionen | null): void {
  if (!karte() || !griffEbene) return;
  
  if (ziehtGerade) return;
  const schluessel = punkte && a ? `${fest}|${gewaehlt}|${punkte.map((q) => `${q.lat},${q.lon}`).join(';')}` : '';
  if (schluessel === griffSchluessel) return;
  griffSchluessel = schluessel;
  griffEbene.clearLayers();
  if (!punkte || !a || punkte.length < 2) return;
  const ab = Math.max(fest - 1, 0);
  const vorschau = L.polyline([], { color: ROUTENFARBE, weight: 3, dashArray: '4 6', opacity: 0.9, interactive: false }).addTo(griffEbene);
  const zeige = (liste: L.LatLng[]) => vorschau.setLatLngs(liste);
  const basis = () => punkte.map((q) => L.latLng(q.lat, q.lon));
  for (let k = ab; k < punkte.length - 1; k++) {
    const m = schenkelMitte(punkte[k]!, punkte[k + 1]!);
    const plus = L.marker(ll(m), {
      draggable: true, autoPanOnFocus: false, keyboard: false, zIndexOffset: 500,
      icon: L.divIcon({ className: 'tb-nav-wp-griff', html: '<span class="tb-nav-wp-plus">+</span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
    }).addTo(griffEbene);
    plus.on('click', () => a.einfuegen(k, m));
    plus.on('dragstart', () => { ziehtGerade = true; });
    plus.on('drag', () => { const l = basis(); l.splice(k + 1, 0, plus.getLatLng()); zeige(l.slice(k, k + 3)); });
    plus.on('dragend', () => { ziehtGerade = false; const q = plus.getLatLng(); a.einfuegen(k, { lat: q.lat, lon: q.lng }); });
  }
  for (let k = Math.max(fest, 1); k < punkte.length; k++) {
    const ziel = k === punkte.length - 1;
    const klasse = `${ziel ? 'tb-nav-wp-ziel' : 'tb-nav-wp-zwischen'}${k === gewaehlt ? ' gewaehlt' : ''}`;
    const m = L.marker(ll(punkte[k]!), {
      draggable: true, autoPanOnFocus: false, keyboard: false, zIndexOffset: 1000,
      icon: L.divIcon({ className: 'tb-nav-wp-griff', html: `<span class="${klasse}">${ziel ? 'B' : k}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
    }).addTo(griffEbene);
    m.on('click', () => a.waehlen(k));
    m.on('dragstart', () => { ziehtGerade = true; });
    m.on('drag', () => { const l = basis(); l[k] = m.getLatLng(); zeige(l.slice(Math.max(k - 1, 0), k + 2)); });
    m.on('dragend', () => { ziehtGerade = false; const q = m.getLatLng(); a.ziehen(k, { lat: q.lat, lon: q.lng }); });
  }
}

export function zeichneGefahren(gefahren: readonly Gefahr[], name: (g: Gefahr) => string): void {
  if (!karte() || !gefahrEbene) return;
  gefahrEbene.clearLayers();
  for (const g of gefahren) {
    L.circleMarker(ll(g), { radius: 8, color: ROT, weight: 2, fillColor: ROT, fillOpacity: 0.15 })
      
      .bindTooltip(escapeHtml(name(g)), { direction: 'top', className: 'tb-nav-tip', pane: NAMEN_EBENE }).addTo(gefahrEbene);
  }
}


export function zeichneUntiefe(u: { lat: number; lon: number; text: string } | null): void {
  if (!karte() || !untiefeEbene) return;
  untiefeEbene.clearLayers();
  if (!u) return;
  L.marker(ll(u), {
    interactive: false, keyboard: false, zIndexOffset: 500,
    icon: L.divIcon({ className: 'tb-nav-untiefe', html: `<span class="tb-nav-untiefe-raute"></span><span class="tb-nav-untiefe-text">${u.text}</span>`, iconSize: [20, 20], iconAnchor: [10, 10] }),
  }).addTo(untiefeEbene);
}


export interface MessZiehen {
  
  ersterFest: boolean;
  
  text: (a: Punkt, b: Punkt) => string;
  
  summe: (kette: readonly Punkt[]) => string;
  
  beginn: () => void;
  gezogen: (i: number, p: Punkt, fertig: boolean) => void;
}

let messZieht = false;
let messSchluessel = '';


export function zeichneMessung(kette: readonly Punkt[], z: MessZiehen | null = null): void {
  if (!karte() || !messEbene || messZieht) return;
  const schluessel = `${kette.map((q) => `${q.lat},${q.lon}`).join(';')}|${z ? (z.ersterFest ? 2 : 1) : 0}|${z && kette.length > 1 ? z.summe(kette) + z.text(kette[0]!, kette[1]!) : ''}`;
  if (schluessel === messSchluessel && messEbene.getLayers().length) return;
  messSchluessel = schluessel;
  messEbene.clearLayers();
  if (!kette.length) return;
  const punkte = kette.map((q) => L.latLng(q.lat, q.lon));
  const linie = kette.length > 1
    ? L.polyline(punkte, { color: WERKZEUGFARBE, weight: 2, dashArray: '6 6', interactive: false }).addTo(messEbene) : null;
  const mitte = (x: L.LatLng, y: L.LatLng) => L.latLng((x.lat + y.lat) / 2, (x.lng + y.lng) / 2);
  const textIcon = (t: string, klasse = '') => L.divIcon({
    className: `tb-nav-mess-text${klasse}`, html: `<span>${escapeHtml(t)}</span>`, iconSize: [0, 0], iconAnchor: [0, 0],
  });
  const alsPunkt = (l: L.LatLng): Punkt => ({ lat: l.lat, lon: l.lng });
  const schenkelText = (k: number) => (z ? z.text(alsPunkt(punkte[k]!), alsPunkt(punkte[k + 1]!)) : '');
  const etiketten = z ? punkte.slice(1).map((_, k) => L.marker(mitte(punkte[k]!, punkte[k + 1]!), {
    pane: 'tbMessText', interactive: false, keyboard: false, icon: textIcon(schenkelText(k)),
  }).addTo(messEbene!)) : [];
  
  const summe = z && kette.length > 2
    ? L.marker(punkte.at(-1)!, { pane: 'tbMessText', interactive: false, keyboard: false, icon: textIcon(z.summe(kette), ' summe') }).addTo(messEbene)
    : null;
  const marken = punkte.map((l, i) => {
    const ziehbar = !!z && !(i === 0 && z.ersterFest);
    return L.marker(l, {
      draggable: ziehbar, interactive: ziehbar, autoPanOnFocus: false, keyboard: false, zIndexOffset: 900,
      icon: L.divIcon({ className: `tb-nav-mess-punkt${ziehbar ? ' ziehbar' : ''}`, html: '<span></span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
    }).addTo(messEbene!);
  });
  if (!z) return;
  marken.forEach((m, i) => {
    if (i === 0 && z.ersterFest) return;
    m.on('dragstart', () => { messZieht = true; z.beginn(); });
    m.on('drag', () => {
      punkte[i] = m.getLatLng();
      linie?.setLatLngs(punkte);
      for (const k of [i - 1, i]) {
        if (k >= 0 && k < etiketten.length) etiketten[k]!.setLatLng(mitte(punkte[k]!, punkte[k + 1]!)).setIcon(textIcon(schenkelText(k)));
      }
      summe?.setLatLng(punkte.at(-1)!).setIcon(textIcon(z.summe(punkte.map(alsPunkt)), ' summe'));
      z.gezogen(i, alsPunkt(punkte[i]!), false);
    });
    m.on('dragend', () => {
      messZieht = false;
      z.gezogen(i, alsPunkt(m.getLatLng()), true);
    });
  });
}

export function zeichneMob(mob: Punkt | null, boot: Punkt | null): void {
  if (!karte() || !mobEbene) return;
  mobEbene.clearLayers();
  if (!mob) return;
  if (boot) L.polyline([ll(boot), ll(mob)], { color: ROT, weight: 3, interactive: false }).addTo(mobEbene);
  L.marker(ll(mob), {
    interactive: false, keyboard: false, zIndexOffset: 1000,
    icon: L.divIcon({ className: 'tb-nav-mob-marke', html: '<span>MOB</span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
  }).addTo(mobEbene);
}


export function zeichneAnkerVorschau(mitte: Punkt | null, radiusM: number): void {
  if (!karte() || !ankerEbene) return;
  ankerEbene.clearLayers();
  if (mitte) L.circle(ll(mitte), { radius: radiusM, color: WERKZEUGFARBE, weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(ankerEbene);
}


export function zeigePunkte(punkte: readonly Punkt[], untenPx = 0, linksPx = 0): void {
  const k = karte();
  if (!k || punkte.length < 1) return;
  karteNeuMessen();
  if (punkte.length === 1) { k.setView(ll(punkte[0]!), Math.max(k.getZoom(), 13), { animate: false }); return; }
  
  const rand = sichtPolster(40);
  k.fitBounds(L.latLngBounds(punkte.map(ll)), {
    
    paddingTopLeft: L.point(rand.x + linksPx, rand.y), paddingBottomRight: L.point(rand.x, rand.y + untenPx), maxZoom: 15, animate: false,
  });
}
