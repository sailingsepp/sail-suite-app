import L from 'leaflet';
import { escapeHtml } from '@/core/html';
import { addVtgEbene } from '@/map/vtg';
import { verkehrswegeAuf } from '@/map/verkehrswege';
import type { Luecke, SpurPunkt } from '@/core/spur';
import { antriebAbschnitte, type AntriebWechsel } from '@/core/antriebsbilanz';
import { destPoint, distNM, bearingDeg } from '@/core/geo';
import { addScaleControl } from '@/map/scale';
import { SPURFARBE } from '@/map/spurfarbe';
import { KONTUR, KURSLINIENFARBE, WERKZEUGFARBE } from './kartenfarben';
import { naechsteAusrichtung, drehweg } from '@/core/kursoben';
import { macheDrehbar, type Drehung } from '@/map/drehung';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { STRINGS } from './strings';
import { seekarteAuf, type Seekarte } from '@/map/seekarte';
import { bereiteZellen, kartenIndexJetzt } from '@/data/landKacheln';
import { einFingerScrollt } from '@/map/einFinger';
import { vorauslinie, landquerung, VORAUS_MIN } from '@/core/vorauslinie';
import { kuesteFuer, beiKuesteGeladen } from './vorausKueste';
import { luftbildAuf, type Luftbild } from '@/map/luftbild';
import { radarAuf, type RadarEbene } from '@/map/radar';

let karte: L.Map | null = null;
let drehung: Drehung | null = null;
let regelZiehen: () => void = () => {};
let spurLinien: L.Polyline[] = [];

export { SPURFARBE };
let lueckenLinien: L.Polyline[] = [];

let schiff: L.Marker | null = null;
let schiffKurs: number | null | undefined;
let vorausEbene: L.LayerGroup | null = null;
let voraus: { lat: number; lon: number; cog: number | null; sog: number | null; kdw: number | null } | null = null;
let seezeichen: L.TileLayer | null = null;
let folgt = true;
let aufFolgeWechsel: (folgt: boolean) => void = () => {};

let selbstGesetzt = false;

const STANDARD: L.LatLngTuple = [44.0, 14.5];

export function initKarte(behaelter: HTMLElement, meldeFolge: (folgt: boolean) => void): void {
  aufFolgeWechsel = meldeFolge;

  const flaeche = document.createElement('div');
  flaeche.className = 'tb-karte-flaeche';
  behaelter.appendChild(flaeche);
  karte = L.map(flaeche, { zoomControl: true, attributionControl: true }).setView(STANDARD, 9);
  drehung = macheDrehbar(karte, behaelter);
  zweizeiligeNamensnennung(karte);

  regelZiehen = einFingerScrollt(karte, () => !document.documentElement.classList.contains('nav-an'));

  seekarte = seekarteAuf(karte, () => navigator.onLine, () => drehung?.winkel() ?? 0);
  seekarte.ebene.on('load', keineKarteAnzeigen(karte, behaelter));

  if (!karte.getPane('tbSeezeichen')) karte.createPane('tbSeezeichen').style.zIndex = '250';
  seezeichen = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 19, crossOrigin: 'anonymous', attribution: '&copy; OpenSeaMap', pane: 'tbSeezeichen',
  });
  if (seezeichenGemerkt()) seezeichen.addTo(karte);

  luftbild = luftbildAuf(karte, { speicher: 'sail-suite:nav-luftbild', nennungsFeld: true });

  try { localStorage.removeItem('sail-suite:nav-radar'); } catch {  }
  radar = radarAuf(karte, { pane: 'tbRadar', zIndex: 230, feld: true });

  if (typeof ResizeObserver === 'function') new ResizeObserver(() => drehung?.neuMessen()).observe(behaelter);

  addScaleControl(karte);
  massstabNebenLeiste(behaelter);

  addVtgEbene(karte, { pfeile: false });

  verkehrswegeAuf(karte);

  karte.createPane('tbVoraus').style.zIndex = '410';

  if (!karte.getPane('tbNamen')) karte.createPane('tbNamen').style.zIndex = '650';
  vorausEbene = L.layerGroup().addTo(karte);

  karte.on('zoomend', zeichneVoraus);
  beiKuesteGeladen(zeichneVoraus);
  karte.on('dragstart', loeseFolgen);
  karte.on('zoomstart', () => { if (!selbstGesetzt) loeseFolgen(); });
}

export function folgeNicht(): void { loeseFolgen(); }

function loeseFolgen(): void {
  if (!folgt) return;
  folgt = false;
  aufFolgeWechsel(false);
}

function ansicht(mitte: L.LatLngExpression): void {
  if (!karte) return;
  selbstGesetzt = true;
  karte.setView(mitte, Math.max(karte.getZoom(), 13), { animate: false });
  selbstGesetzt = false;
}

export function zentriere(): void {
  folgt = true;
  aufFolgeWechsel(true);
  const ziel = schiff?.getLatLng();
  if (ziel) ansicht(ziel);

  if (modus === 'kurs') dreheAuf(obenKurs ?? 0);
}

export type Ausrichtung = 'nord' | 'kurs';

let modus: Ausrichtung = 'nord';

let obenKurs: number | null = null;
let aufDrehung: (bearing: number) => void = () => {};
let animation = 0;

export function alsKartenelement(el: HTMLElement): void {
  if (!karte) return;
  const Element = L.Control.extend({
    onAdd: () => {
      L.DomEvent.disableClickPropagation(el);
      return el;
    },
  });
  new Element({ position: 'topleft' }).addTo(karte);
}

export function setzeDrehRueckruf(cb: (bearing: number) => void): void {
  aufDrehung = cb;
  cb(drehung?.winkel() ?? 0);
}

export function ausrichtung(): Ausrichtung {
  return modus;
}

export function setzeAusrichtung(neu: Ausrichtung): void {
  modus = neu;

  if (neu === 'kurs') drehung?.setzeVergroessert(true);
  dreheAuf(neu === 'kurs' ? (obenKurs ?? 0) : 0);
}

export function setzeKurs(kurs: number | null): void {
  obenKurs = naechsteAusrichtung(obenKurs, kurs);
  if (modus === 'kurs' && folgt && obenKurs !== null) dreheAuf(obenKurs);
}

function dreheAuf(kurs: number): void {
  if (!drehung) return;
  const d = drehung;
  cancelAnimationFrame(animation);
  const start = d.winkel();
  const weg = drehweg(start, -kurs);
  const setze = (w: number): void => {
    d.setzeWinkel(w);
    aufDrehung(w);
  };
  const fertig = (): void => {

    if (modus === 'nord' && Math.abs(((d.winkel() % 360) + 360) % 360) < 0.5) { setze(0); d.setzeVergroessert(false); }
  };
  if (Math.abs(weg) < 0.5) { fertig(); return; }
  const ruhig = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (ruhig) { setze(start + weg); fertig(); return; }
  const DAUER_MS = 500;
  const t0 = performance.now();
  const schritt = (jetzt: number): void => {
    const a = Math.min(1, (jetzt - t0) / DAUER_MS);
    const e = a < 0.5 ? 2 * a * a : 1 - (-2 * a + 2) ** 2 / 2;
    setze(start + weg * e);
    if (a < 1) animation = requestAnimationFrame(schritt); else fertig();
  };
  animation = requestAnimationFrame(schritt);
}

export function kartenWinkel(): number {
  return drehung?.winkel() ?? 0;
}

export function sichtPolster(px: number): L.Point {
  return drehung?.sichtPolster(px) ?? L.point(px, px);
}

export function karteZiehenNeu(): void {
  regelZiehen();
}

export function karteNeuMessen(): void {
  drehung?.neuMessen();
}

export function zeichneSpur(punkte: SpurPunkt[], luecken: Luecke[], wechsel: readonly AntriebWechsel[] = []): void {
  if (!karte) return;

  const stuecke: SpurPunkt[][] = [[]];
  const sehnen: [L.LatLngTuple, L.LatLngTuple][] = [];
  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i]!;
    const vor = punkte[i - 1];
    const luecke = vor && luecken.find((l) => l.von >= vor.t && l.bis <= p.t);
    if (luecke && stuecke[stuecke.length - 1]!.length) {
      sehnen.push([[vor.lat, vor.lon], [p.lat, p.lon]]);
      stuecke.push([]);
    }
    stuecke[stuecke.length - 1]!.push(p);
  }

  for (const l of spurLinien) l.remove();
  spurLinien = [];
  for (const stueck of stuecke) {
    if (stueck.length < 2) continue;
    for (const ab of antriebAbschnitte(stueck, wechsel)) {
      spurLinien.push(L.polyline(ab.punkte.map((p) => [p.lat, p.lon] as L.LatLngTuple), {
        color: SPURFARBE[ab.antrieb ?? 'offen'], weight: 3, opacity: 0.9, className: 'tb-vergangenheit',
      }).addTo(karte));
    }
  }

  for (const l of lueckenLinien) l.remove();
  lueckenLinien = sehnen.map((s) =>
    L.polyline(s, { color: SPURFARBE.offen, weight: 2, opacity: 0.7, dashArray: '6 8', className: 'tb-vergangenheit' }).addTo(karte!));
}

export function setzePosition(lat: number, lon: number, cog: number | null = null): void {
  if (!karte) return;
  const kurs = cog === null ? null : Math.round(cog);
  if (!schiff) {

    if (!karte.getPane('tbSchiff')) karte.createPane('tbSchiff').style.zIndex = '660';
    schiff = L.marker([lat, lon], { interactive: false, keyboard: false, zIndexOffset: 900, pane: 'tbSchiff' }).addTo(karte);
  } else {
    schiff.setLatLng([lat, lon]);
  }
  if (kurs !== schiffKurs) {
    schiffKurs = kurs;
    schiff.setIcon(L.divIcon({
      className: 'tb-schiff karte-mitdrehen',
      html: kurs === null
        ? '<span class="tb-schiff-punkt"></span>'
        : `<svg viewBox="0 0 18 24" width="18" height="24" style="transform:rotate(${kurs}deg)"><path d="M9 1L17 23L9 18L1 23Z"/></svg>`,
      iconSize: [24, 24], iconAnchor: [12, 12],
    }));
  }
  if (folgt) ansicht([lat, lon]);
}

const VORAUSFARBE = KURSLINIENFARBE;

const LAND_FREI_PX = 60;

const KDW_PX = 70;
const ZUKUNFT = 'tb-zukunft';

export function setzeVorauslinie(lat: number, lon: number, cog: number | null, sog: number | null, kdw: number | null = null): void {
  voraus = { lat, lon, cog, sog, kdw };
  zeichneVoraus();
}

export function entferneVorauslinie(): void {
  voraus = null;
  vorausEbene?.clearLayers();
}

function zeichneVoraus(): void {
  if (!karte || !vorausEbene) return;
  vorausEbene.clearLayers();
  if (!voraus || voraus.cog === null || voraus.sog === null) return;
  const { lat, lon, cog, sog, kdw } = voraus;
  const p0 = karte.latLngToLayerPoint([lat, lon]);

  if (kdw !== null) {
    const [hl, ho] = destPoint(lat, lon, kdw, 0.1);
    const ph = karte.latLngToLayerPoint([hl, ho]);
    const d = p0.distanceTo(ph) || 1;
    const ende = karte.layerPointToLatLng(L.point(p0.x + ((ph.x - p0.x) / d) * KDW_PX, p0.y + ((ph.y - p0.y) / d) * KDW_PX));
    L.polyline([[lat, lon], ende], { color: KONTUR, weight: 4, opacity: 0.5, interactive: false, className: `${ZUKUNFT} tb-kurs-kontur`, pane: 'tbVoraus' }).addTo(vorausEbene);
    L.polyline([[lat, lon], ende], { color: VORAUSFARBE, weight: 2, opacity: 0.9, dashArray: '5 5', interactive: false, className: `${ZUKUNFT} tb-kurs tb-kdw`, pane: 'tbVoraus' }).addTo(vorausEbene);
  }
  const [la1, lo1] = destPoint(lat, lon, cog, sog / 60);
  const pxJeMin = p0.distanceTo(karte.latLngToLayerPoint([la1, lo1]));
  const voll = vorauslinie(lat, lon, cog, sog, pxJeMin);
  if (!voll) return;

  const kueste = kuesteFuer({ lat, lon }, { lat: voll.ende[0], lon: voll.ende[1] });
  const t = kueste ? landquerung({ lat, lon }, { lat: voll.ende[0], lon: voll.ende[1] }, kueste) : null;
  const landMin = t === null ? null : t * VORAUS_MIN;
  const v = landMin === null ? voll : vorauslinie(lat, lon, cog, sog, pxJeMin, landMin)!;
  L.polyline([[lat, lon], v.ende], { color: KONTUR, weight: 4, opacity: 0.6, interactive: false, className: `${ZUKUNFT} tb-kurs-kontur`, pane: 'tbVoraus' }).addTo(vorausEbene);
  L.polyline([[lat, lon], v.ende], { color: VORAUSFARBE, weight: 2, opacity: 0.9, interactive: false, className: `${ZUKUNFT} tb-kurs`, pane: 'tbVoraus' }).addTo(vorausEbene);
  const pe = karte.latLngToLayerPoint(v.ende);

  const pv = karte.latLngToLayerPoint(voll.ende);
  const laenge = p0.distanceTo(pv) || 1;
  const qx = (-(pv.y - p0.y) / laenge) * 7, qy = ((pv.x - p0.x) / laenge) * 7;
  for (const st of v.striche) {
    const p = karte.latLngToLayerPoint([st.lat, st.lon]);
    const a = karte.layerPointToLatLng(L.point(p.x - qx, p.y - qy));
    const b = karte.layerPointToLatLng(L.point(p.x + qx, p.y + qy));
    L.polyline([a, b], { color: VORAUSFARBE, weight: 2, opacity: 0.9, interactive: false, className: `${ZUKUNFT} tb-kurs`, pane: 'tbVoraus' }).addTo(vorausEbene);

    if (st.beschriftet && !(landMin !== null && p.distanceTo(pe) < LAND_FREI_PX)) {

      const r = qx < 0 || (qx === 0 && qy < 0) ? -1 : 1;
      const ort = karte.layerPointToLatLng(L.point(p.x + r * qx * 1.6, p.y + r * qy * 1.6));
      L.marker(ort, {
        interactive: false, keyboard: false, pane: 'tbNamen',
        icon: L.divIcon({ className: 'tb-voraus-marke', html: `<span>${st.min} min</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
      }).addTo(vorausEbene);
    }
  }
  if (landMin !== null) {
    const a = karte.layerPointToLatLng(L.point(pe.x - qx * 1.6, pe.y - qy * 1.6));
    const b = karte.layerPointToLatLng(L.point(pe.x + qx * 1.6, pe.y + qy * 1.6));
    L.polyline([a, b], { color: VORAUSFARBE, weight: 4, opacity: 1, interactive: false, className: `${ZUKUNFT} tb-kurs`, pane: 'tbVoraus' }).addTo(vorausEbene);
    const r = qx < 0 || (qx === 0 && qy < 0) ? -1 : 1;
    const ort = karte.layerPointToLatLng(L.point(pe.x + r * qx * 2.4, pe.y + r * qy * 2.4));
    L.marker(ort, {
      interactive: false, keyboard: false, pane: 'tbNamen',
      zIndexOffset: 1000,
      icon: L.divIcon({ className: 'tb-voraus-marke land', html: `<span>Land ${Math.round(landMin)} min</span>`, iconSize: [0, 0], iconAnchor: [0, 0] }),
    }).addTo(vorausEbene);
  }
}

export function schiffPosition(): { lat: number; lon: number } | null {
  const p = schiff?.getLatLng();
  return p ? { lat: p.lat, lon: p.lng } : null;
}

function zweizeiligeNamensnennung(k: L.Map): void {
  const ctl = k.attributionControl as (L.Control.Attribution & {
    _update?: () => void; _attributions?: Record<string, number>; _container?: HTMLElement; options: { prefix?: string | false };
  }) | undefined;
  if (!ctl) return;
  ctl._update = function (this: typeof ctl) {
    if (!this || !this._container) return;
    const quellen = Object.keys(this._attributions ?? {}).filter((x) => this._attributions![x]);

    const zeilen = [...(quellen[0] ?? '').split(', '), quellen.slice(1).join(', ')].filter(Boolean);
    this._container.innerHTML = zeilen.join('<br>');
  };
  ctl.getContainer()?.classList.add('tb-namen-zweizeilig');
  ctl._update.call(ctl);
}

function massstabNebenLeiste(behaelter: HTMLElement): void {
  const leiste = document.getElementById('tb-nav-werkzeuge');
  if (!leiste) return;
  let geplant = 0;
  const pruefe = (): void => {
    geplant = 0;
    const m = behaelter.querySelector<HTMLElement>('.scale-line');
    if (!m) return;
    m.style.marginRight = '';
    const a = m.getBoundingClientRect(), b = leiste.getBoundingClientRect();
    if (!b.width || !b.height || a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) return;
    m.style.marginRight = `${10 + Math.ceil(a.right - b.left) + 8}px`;
  };
  const bald = (): void => { if (!geplant) geplant = requestAnimationFrame(pruefe); };
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(bald);
    ro.observe(leiste);
    ro.observe(behaelter);
  }
  new MutationObserver(bald).observe(leiste, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  new MutationObserver(bald).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', bald);
  karte?.on('resize', bald);
  bald();
}

export function karteObjekt(): L.Map | null {
  return karte;
}

let seekarte: Seekarte | null = null;
export function seekarteObjekt(): Seekarte | null {
  return seekarte;
}

const SEEZEICHEN_KEY = 'sail-suite:nav-seezeichen';
function seezeichenGemerkt(): boolean {
  try { return localStorage.getItem(SEEZEICHEN_KEY) !== '0'; } catch { return true; }
}
export function seezeichenAn(): boolean {
  return !!(karte && seezeichen && karte.hasLayer(seezeichen));
}
export function setzeSeezeichen(an: boolean): void {
  if (!karte || !seezeichen) return;
  if (an) seezeichen.addTo(karte); else seezeichen.remove();
  try { localStorage.setItem(SEEZEICHEN_KEY, an ? '1' : '0'); } catch {  }
}

let luftbild: Luftbild | null = null;
export function luftbildObjekt(): Luftbild | null {
  return luftbild;
}

let radar: RadarEbene | null = null;
export function radarObjekt(): RadarEbene | null {
  return radar;
}

export function folgtDerSpur(): boolean {
  return folgt;
}

let aisEbene: L.LayerGroup | null = null;

export interface AisMarke {
  lat: number;
  lon: number;

  cog?: number;

  text: string;

  stufe: 'fern' | 'nah' | 'eng';
}

export function setzeAisZiele(marken: AisMarke[]): void {
  if (!karte) return;
  if (!aisEbene) aisEbene = L.layerGroup().addTo(karte);
  aisEbene.clearLayers();

  const farbe: Record<AisMarke['stufe'], string> = {
    fern: '#89A3AF', nah: '#F2A93B', eng: '#E1584B',
  };

  for (const m of marken) {
    const f = farbe[m.stufe];
    if (m.cog === undefined) {
      L.circleMarker([m.lat, m.lon], {
        radius: 5, color: f, weight: 2, fillColor: f, fillOpacity: 0.5, interactive: false,
      }).bindTooltip(escapeHtml(m.text), { direction: 'top' }).addTo(aisEbene);
      continue;
    }

    const icon = L.divIcon({
      className: 'tb-ais-marke karte-mitdrehen',
      html: `<span style="transform:rotate(${Math.round(m.cog)}deg); border-bottom-color:${f}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([m.lat, m.lon], { icon, interactive: false, keyboard: false })
      .bindTooltip(escapeHtml(m.text), { direction: 'top' })
      .addTo(aisEbene);
  }
}

export function leereAisZiele(): void {
  aisEbene?.clearLayers();
}

export function sichtbarerAusschnitt(): { sued: number; west: number; nord: number; ost: number } | null {

  if (!karte) return null;
  const b = karte.getBounds();
  return { sued: b.getSouth(), west: b.getWest(), nord: b.getNorth(), ost: b.getEast() };
}

let ankerKreis: L.Circle | null = null;
let ankerMitteMarke: L.Marker | null = null;
let ankerRandMarke: L.Marker | null = null;

let ankerPeilung = 90;
let aufAnkerAenderung: (lat: number, lon: number, radiusM: number) => void = () => {};

export function zeichneAnkerkreis(lat: number, lon: number, radiusM: number): void {
  if (!karte) return;
  entferneAnkerkreis();
  ankerPeilung = 90;

  ankerKreis = L.circle([lat, lon], {
    radius: radiusM, color: WERKZEUGFARBE, weight: 2, fillColor: WERKZEUGFARBE, fillOpacity: 0.12,
  }).addTo(karte);

  ankerMitteMarke = L.marker([lat, lon], {
    draggable: true, autoPanOnFocus: false,
    icon: L.divIcon({
      className: 'tb-anker-griff tb-anker-mitte', html: '<span>⚓</span>', iconSize: [44, 44], iconAnchor: [22, 22],
    }),
  }).addTo(karte);

  const [randLat, randLon] = destPoint(lat, lon, ankerPeilung, radiusM / 1852);
  ankerRandMarke = L.marker([randLat, randLon], {
    draggable: true, autoPanOnFocus: false,
    icon: L.divIcon({
      className: 'tb-anker-griff tb-anker-rand', html: '', iconSize: [44, 44], iconAnchor: [22, 22],
    }),
  }).addTo(karte);

  ankerMitteMarke.on('drag', () => {
    if (!ankerKreis || !ankerRandMarke) return;
    const m = ankerMitteMarke!.getLatLng();
    ankerKreis.setLatLng(m);

    const [rl, ro] = destPoint(m.lat, m.lng, ankerPeilung, ankerKreis.getRadius() / 1852);
    ankerRandMarke.setLatLng([rl, ro]);
    melde();
  });
  ankerRandMarke.on('drag', () => {
    if (!ankerKreis || !ankerMitteMarke) return;
    const m = ankerMitteMarke.getLatLng();
    const r = ankerRandMarke!.getLatLng();
    const neuerRadiusM = distNM(m.lat, m.lng, r.lat, r.lng) * 1852;
    ankerKreis.setRadius(neuerRadiusM);

    ankerPeilung = bearingDeg(m.lat, m.lng, r.lat, r.lng);
    melde();
  });

  function melde(): void {
    if (!ankerKreis || !ankerMitteMarke) return;
    const m = ankerMitteMarke.getLatLng();
    aufAnkerAenderung(m.lat, m.lng, ankerKreis.getRadius());
  }
}

export function setzeAnkerAenderung(cb: (lat: number, lon: number, radiusM: number) => void): void {
  aufAnkerAenderung = cb;
}

let schwojLinie: L.Polyline | null = null;
let schwojLetzter: L.CircleMarker | null = null;
export function zeichneSchwojspur(punkte: readonly { lat: number; lon: number }[]): void {
  if (!karte) return;
  schwojLinie?.remove(); schwojLinie = null;
  schwojLetzter?.remove(); schwojLetzter = null;
  if (punkte.length < 2) return;
  const ll = punkte.map((p) => [p.lat, p.lon] as [number, number]);
  schwojLinie = L.polyline(ll, { color: WERKZEUGFARBE, weight: 1.5, opacity: 0.8, interactive: false, className: 'tb-schwojspur' }).addTo(karte);
  schwojLetzter = L.circleMarker(ll[ll.length - 1]!, { radius: 3, color: WERKZEUGFARBE, weight: 1.5, fillOpacity: 0, interactive: false }).addTo(karte);
}

export function entferneAnkerkreis(): void {
  schwojLinie?.remove(); schwojLinie = null;
  schwojLetzter?.remove(); schwojLetzter = null;
  ankerKreis?.remove(); ankerKreis = null;
  ankerMitteMarke?.remove(); ankerMitteMarke = null;
  ankerRandMarke?.remove(); ankerRandMarke = null;
}

function keineKarteAnzeigen(k: L.Map, behaelter: HTMLElement): () => void {
  const hinweis = document.createElement('div');
  hinweis.className = 'tb-keine-karte';
  hinweis.hidden = true;
  hinweis.setAttribute('role', 'status');
  const beschrifte = () => { hinweis.textContent = STRINGS[aktuelleSprache()]['karte.keine'] ?? 'Keine Karte'; };
  beschrifte();
  aufSprachwechsel(beschrifte);
  behaelter.appendChild(hinweis);
  const pruefe = () => {
    const b = k.getBounds();
    const box = { swLat: b.getSouth(), swLon: b.getWest(), neLat: b.getNorth(), neLon: b.getEast() };

    hinweis.hidden = !kartenIndexJetzt() ? false : bereiteZellen(box).length > 0;
  };
  let uhr = 0;
  k.on('movestart', () => { window.clearTimeout(uhr); });
  k.on('moveend', () => { window.clearTimeout(uhr); uhr = window.setTimeout(pruefe, 2500); });

  window.setTimeout(pruefe, 8000);
  return pruefe;
}
