import L from 'leaflet';
import { escapeHtml } from '@/core/html';
import { luftbildAuf, luftbildKnopf } from '@/map/luftbild';
import { radarAuf, radarKnopf } from '@/map/radar';
import { seekarteAuf } from '@/map/seekarte';
import { seekartenNamen } from '@/map/seekartenNamen';
import { einFingerScrollt } from '@/map/einFinger';
import type { Punkt, Grenzwerte } from '@/core/types';
import { uhrLt, kursGrad, nf, hhmm } from '@/core/time';
import { windBarbSVG } from '@/map/barbs';
import { addScaleControl } from '@/map/scale';
import { addGraticule } from '@/map/graticule';
import { pruefeWegpunkt, pruefeStrecke } from '@/data/landcheck';
import type { VerlaufAbschnittBezug } from '@/briefing/profile';
import { addLocationSearch } from './search';
import { addStandortStart } from './standortStart';
import { addVtgEbene } from '@/map/vtg';
import { objektFensterAuf } from '@/map/objektFenster';
import { aktuelleSprache } from '@/shell/sprache';

export interface DunkelMarker {
  beginn: Date;
  ende: Date | null;
  beginnOrt: Punkt;
  endeOrt: Punkt | null;
  vonAnfangAn: boolean;

  strecke: Punkt[];
}

export interface AntriebMarker {
  beginn: Date;
  ende: Date | null;
  beginnOrt: Punkt;
  endeOrt: Punkt | null;
  unterMotor: boolean;

  strecke: Punkt[];
}

export interface SpitzenwertMarker {
  ort: Punkt;
  symbol: string;
  text: string;
}

export interface KritischMarker {
  strecke: Punkt[];
  punkt: Punkt;
  text: string;
}

export interface RoutenPunkt extends Punkt {
  marker: L.Marker | null;

  halt?: { min: number; text: string } | null;
}

const MARKE_Z_OFFSET = 10_000;

export interface LandMeldung {
  text: string;
  art: 'warnung' | 'info';
}

export interface TrackPunkt {
  lat: number;
  lon: number;
  nm: number;
  time: Date;
  dir: number;
  speed: number;
  gust: number;

  twa: number;

  awa: number;
  aws: number;
  underMotor: boolean;
  beating: boolean;
  gybing: boolean;

  steuerbordbug: boolean;

  hs?: number;
}

const ANKER = '<path d="M12 6.6v13.2M7.6 10.2h8.8M6 14.6c0 3.4 2.7 5.4 6 5.6 3.3-.2 6-2.2 6-5.6" '
  + 'stroke="#0B1E2D" stroke-width="2.1" stroke-linecap="round" fill="none"/>'
  + '<circle cx="12" cy="4.4" r="2.2" stroke="#0B1E2D" stroke-width="2" fill="none"/>';

const FLAGGE = (() => {
  let q = '<path d="M6.6 3.4v17.6" stroke="#0B1E2D" stroke-width="2.1" stroke-linecap="round"/>';
  const x0 = 8.2, y0 = 4.2, c = 3.4;
  for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) {
    if ((r + k) % 2) continue;
    q += `<rect x="${x0 + k * c}" y="${y0 + r * c}" width="${c}" height="${c}" fill="#0B1E2D"/>`;
  }
  q += `<rect x="${x0}" y="${y0}" width="${3 * c}" height="${2 * c}" fill="none" stroke="#0B1E2D" stroke-width="1.4"/>`;
  return q;
})();

function punktIcon(art: 'start' | 'ziel' | 'wp', nummer: number): L.DivIcon {
  const farbe = art === 'start' ? '#3FAE6A' : (art === 'ziel' ? '#E1584B' : '#2DA8A0');
  const gross = art !== 'wp';
  const R = gross ? 15 : 11, S = R * 2 + 6;
  const inhalt = art === 'start' ? ANKER
    : art === 'ziel' ? FLAGGE
      : `<text x="12" y="16.4" text-anchor="middle" font-size="12" font-weight="700"
                    font-family="-apple-system,sans-serif" fill="#0B1E2D">${nummer}</text>`;
  const html =
    `<svg width="${S}" height="${S}" viewBox="${-S / 2} ${-S / 2} ${S} ${S}">`
    + `<circle r="${R + 1.5}" fill="#0B1E2D" opacity=".55"/>`
    + `<circle r="${R}" fill="${farbe}" stroke="#0B1E2D" stroke-width="2"/>`
    + `<g transform="scale(${(R * 1.9) / 24}) translate(-12,-12)">${inhalt}</g>`
    + `</svg>`;
  return L.divIcon({ className: 'pt-icon', html, iconSize: [S, S], iconAnchor: [S / 2, S / 2] });
}

export class RouteMap {
  readonly map: L.Map;
  route: RoutenPunkt[] = [];
  private routeLine: L.Polyline | null = null;

  private alternativLine: L.Polyline | null = null;
  private barbLayer: L.LayerGroup;
  private nachtLayer: L.LayerGroup;
  private antriebLayer: L.LayerGroup;
  private spitzenLayer: L.LayerGroup;
  private kritischLayer: L.LayerGroup;
  private lastTrack: TrackPunkt[] | null = null;
  private lastLimits: Grenzwerte | null = null;

  private lastAbschnitte: VerlaufAbschnittBezug[] | null = null;
  private onChange: () => void;
  private onWarnung: (meldungen: LandMeldung[]) => void;

  private landCheckToken = 0;

  constructor(containerId: string, onChange: () => void, onWarnung: (meldungen: LandMeldung[]) => void) {
    this.onChange = onChange;
    this.onWarnung = onWarnung;
    this.map = L.map(containerId, { zoomControl: true }).setView([44.0, 14.5], 8);

    einFingerScrollt(this.map);

    if (document.readyState === 'complete') requestAnimationFrame(() => this.map.invalidateSize());
    else window.addEventListener('load', () => this.map.invalidateSize());
    this.barbLayer = L.layerGroup().addTo(this.map);

    this.antriebLayer = L.layerGroup().addTo(this.map);
    this.spitzenLayer = L.layerGroup().addTo(this.map);
    this.kritischLayer = L.layerGroup().addTo(this.map);
    this.nachtLayer = L.layerGroup().addTo(this.map);

    const seekarte = seekarteAuf(this.map);
    seekartenNamen(this.map, seekarte, { netz: () => navigator.onLine });

    if (!this.map.getPane('ccSeezeichen')) this.map.createPane('ccSeezeichen').style.zIndex = '250';
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
      maxZoom: 19, crossOrigin: 'anonymous', attribution: '&copy; OpenSeaMap', pane: 'ccSeezeichen',
    }).addTo(this.map);

    const luftbild = luftbildAuf(this.map, { speicher: 'sail-suite:cc-luftbild', nennungsFeld: true });
    const Knopf = L.Control.extend({
      onAdd: () => {
        const k = luftbildKnopf(luftbild, 'cc-luftbild-knopf');
        L.DomEvent.disableClickPropagation(k);
        return k;
      },
    });
    new Knopf({ position: 'topright' }).addTo(this.map);

    const radar = radarAuf(this.map, { pane: 'ccRadar', zIndex: 230, speicher: 'sail-suite:cc-radar', feld: true });
    const RadarKnopf = L.Control.extend({
      onAdd: () => {
        const k = radarKnopf(radar, 'cc-luftbild-knopf');
        L.DomEvent.disableClickPropagation(k);
        return k;
      },
    });
    new RadarKnopf({ position: 'topright' }).addTo(this.map);
    addLocationSearch(this.map);
    addScaleControl(this.map);
    addGraticule(this.map);

    addVtgEbene(this.map);

    addStandortStart(this.map, (lat, lon) => this.setzeStart(lat, lon));

    const setze = (p: { lat: number; lon: number }): void => {
      this.route.push({ lat: p.lat, lon: p.lon, marker: null });
      this.redrawPoints();
      void this.pruefeRoute();
    };

    const objekte = objektFensterAuf(this.map, {
      aktion: { text: () => (aktuelleSprache() === 'de' ? 'Wegpunkt hier' : 'Waypoint here'), beimKlick: setze },
    });
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      void objekte.tipp(e).then((offen) => { if (!offen) setze({ lat: e.latlng.lat, lon: e.latlng.lng }); });
    });
    this.map.on('zoomend', () => this.drawBarbs());
  }

  setzeStart(lat: number, lon: number): void {
    const start = this.route[0];
    if (start) { start.lat = lat; start.lon = lon; }
    else this.route.push({ lat, lon, marker: null });
    this.redrawPoints();
    this.map.setView([lat, lon], Math.max(this.map.getZoom(), 13));
    void this.pruefeRoute();
  }

  undo(): void {
    const weg = this.route.pop();
    if (weg?.marker) this.map.removeLayer(weg.marker);
    this.redrawPoints();
    void this.pruefeRoute();
  }

  reset(): void {
    this.route.forEach((p) => { if (p.marker) this.map.removeLayer(p.marker); });
    this.route = [];
    if (this.routeLine) { this.map.removeLayer(this.routeLine); this.routeLine = null; }
    this.lastTrack = null;
    this.barbLayer.clearLayers();
    this.antriebLayer.clearLayers();
    this.spitzenLayer.clearLayers();
    this.kritischLayer.clearLayers();
    this.nachtLayer.clearLayers();
    this.redrawPoints();
    void this.pruefeRoute();
  }

  redrawPoints(): void {
    this.route.forEach((p, i) => {
      if (p.marker) this.map.removeLayer(p.marker);
      const istStart = i === 0;
      const istZiel = i === this.route.length - 1 && this.route.length > 1;
      const art = istStart ? 'start' : (istZiel ? 'ziel' : 'wp');
      const en = aktuelleSprache() === 'en';

      const halt = !istStart && !istZiel && p.halt ? ` · ${p.halt.text ? `${p.halt.text}, ` : ''}${p.halt.min} min` : '';
      const name = (istStart ? 'Start' : (istZiel ? (en ? 'Destination' : 'Ziel') : (en ? 'Waypoint ' : 'Wegpunkt ') + i)) + halt;

      p.marker = L.marker([p.lat, p.lon], { icon: punktIcon(art, i), keyboard: false, draggable: true })
        .addTo(this.map).bindTooltip(escapeHtml(name), { direction: 'top', offset: [0, -16] });
      p.marker.on('dragend', () => {
        const pos = p.marker!.getLatLng();
        p.lat = pos.lat; p.lon = pos.lng;
        this.redrawPoints();
        void this.pruefeRoute();
      });
    });
    this.onChange();
  }

  private async pruefeRoute(): Promise<void> {
    const token = ++this.landCheckToken;
    if (this.route.length === 0) { this.onWarnung([]); return; }
    const en = aktuelleSprache() === 'en';
    const wegpunktName = (i: number, istStart: boolean, istZiel: boolean): string =>
      istStart ? 'Start' : (istZiel ? (en ? 'Destination' : 'Ziel') : (en ? 'Waypoint ' : 'Wegpunkt ') + i);

    this.onWarnung([{ text: en ? 'Land/water check running …' : 'Land-/Wasser-Prüfung läuft …', art: 'info' }]);

    const wegpunktPruefungen = await Promise.all(this.route.map((p) => pruefeWegpunkt(p)));
    if (token !== this.landCheckToken) return;

    if (wegpunktPruefungen.every((pr) => !pr.geprueft)) {
      this.onWarnung([{
        art: 'info',
        text: en
          ? '<b>The land/water check could not run</b>. The coastline data (OpenStreetMap) is '
            + 'currently unavailable. No warning appearing here does <b>not</b> mean the points are '
            + 'in the water: please check against the nautical chart yourself.'
          : '<b>Die Land-/Wasser-Prüfung konnte nicht durchgeführt werden</b>. Die '
            + 'Küstenlinien-Daten (OpenStreetMap) sind gerade nicht abrufbar. Dass keine Warnung '
            + 'erscheint, heißt hier <b>nicht</b>, dass die Punkte im Wasser liegen: bitte selbst '
            + 'gegen die Seekarte prüfen.',
      }]);
      return;
    }

    const warnungen: LandMeldung[] = [];
    let verschoben = false;
    wegpunktPruefungen.forEach((pr, i) => {
      if (!pr.aufLand) return;
      const istStart = i === 0, istZiel = i === this.route.length - 1 && this.route.length > 1;
      const name = wegpunktName(i, istStart, istZiel);
      if (pr.korrektur) {
        this.route[i]!.lat = pr.korrektur.lat;
        this.route[i]!.lon = pr.korrektur.lon;
        verschoben = true;
        warnungen.push({
          text: en ? `${name} was on land, moved to the nearest water point.` : `${name} lag an Land, auf die nächste Wasserstelle verschoben.`,
          art: 'warnung',
        });
      } else {
        warnungen.push({ text: en ? `${name} is on land: please move it.` : `${name} liegt an Land: bitte verschieben.`, art: 'warnung' });
      }
    });
    if (verschoben) this.redrawPoints();

    if (this.route.length >= 2) {
      const strecken = this.route.slice(0, -1);
      const segmentPruefungen = await Promise.all(
        strecken.map((p, i) => pruefeStrecke(p, this.route[i + 1]!)),
      );
      if (token !== this.landCheckToken) return;

      const querend = segmentPruefungen.reduce<string[]>((acc, quertLand, i) => {
        if (!quertLand) return acc;
        const istStart = i === 0, istZiel = i + 1 === this.route.length - 1 && this.route.length > 1;
        acc.push(`${wegpunktName(i, istStart, false)}–${wegpunktName(i + 1, false, istZiel)}`);
        return acc;
      }, []);
      if (querend.length) {
        const alle = querend.length === segmentPruefungen.length;
        const und = en ? ' and ' : ' und ';
        const liste = querend.length > 1 ? querend.slice(0, -1).join(', ') + und + querend[querend.length - 1] : querend[0]!;
        const wer = alle
          ? (en ? 'The route crosses' : 'Die Strecke quert')
          : (en ? `${querend.length > 1 ? 'Legs' : 'Leg'} ${liste} ${querend.length > 1 ? 'cross' : 'crosses'}`
            : `${querend.length > 1 ? 'Die Abschnitte' : 'Der Abschnitt'} ${liste} ${querend.length > 1 ? 'queren' : 'quert'}`);
        warnungen.push({
          text: en
            ? `${wer} land. The calculation routes around it along the coast (coastline only, no depths, shoals or restricted areas).`
            : `${wer} Land. Die Berechnung führt entlang der Küste herum (nur Küstenlinie, ohne Tiefen, Untiefen und Sperrgebiete).`,
          art: 'info',
        });
      }
    }

    const ungeprueft = wegpunktPruefungen.reduce<string[]>((acc, pr, i) => {
      if (pr.geprueft) return acc;
      const istStart = i === 0, istZiel = i === this.route.length - 1 && this.route.length > 1;
      acc.push(wegpunktName(i, istStart, istZiel));
      return acc;
    }, []);
    if (ungeprueft.length) {
      warnungen.push({
        art: 'info',
        text: en
          ? `No coastline data was available for ${ungeprueft.join(', ')}: not checked there.`
          : `Für ${ungeprueft.join(', ')} lagen keine Küstenlinien-Daten vor: dort wurde nicht geprüft.`,
      });
    }

    this.onWarnung(warnungen);
  }

  drawRoute(waypoints: Punkt[]): void {
    if (this.routeLine) this.map.removeLayer(this.routeLine);
    this.setAlternative(null);
    this.barbLayer.clearLayers();
    this.routeLine = L.polyline(waypoints.map((p) => [p.lat, p.lon]), { color: '#F2A93B', weight: 3, opacity: .9 }).addTo(this.map);
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [30, 30] });
  }

  setAlternative(punkte: Punkt[] | null): void {
    if (this.alternativLine) { this.map.removeLayer(this.alternativLine); this.alternativLine = null; }
    if (!punkte || punkte.length < 2) return;
    this.alternativLine = L.polyline(punkte.map((p) => [p.lat, p.lon]), {
      color: '#2DA8A0', weight: 3, opacity: 0.9, dashArray: '8 7', interactive: false,
    }).addTo(this.map);
  }

  setRoute(points: (Punkt & { halt?: RoutenPunkt['halt'] })[]): void {
    this.route.forEach((p) => { if (p.marker) this.map.removeLayer(p.marker); });
    this.route = points.map((p) => ({ lat: p.lat, lon: p.lon, marker: null, ...(p.halt !== undefined ? { halt: p.halt } : {}) }));
    this.redrawPoints();
    void this.pruefeRoute();
    if (this.route.length) {
      const bounds = L.latLngBounds(this.route.map((p): [number, number] => [p.lat, p.lon]));
      this.map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  private barbSize(): number {
    const z = this.map.getZoom();
    const zoomF = Math.max(0.9, Math.min(1.7, 1 + (z - 9) * 0.11));
    const mobil = window.innerWidth < 700 ? 1.25 : 1;
    return Math.round(64 * zoomF * mobil);
  }

  setTrack(track: TrackPunkt[], limits: Grenzwerte, abschnitte: VerlaufAbschnittBezug[] | null = null): void {
    this.lastTrack = track;
    this.lastLimits = limits;
    this.lastAbschnitte = abschnitte;
    this.drawBarbs();
  }

  setDunkelphasen(phasen: DunkelMarker[]): void {
    this.nachtLayer.clearLayers();
    const en = aktuelleSprache() === 'en';
    for (const p of phasen) {
      if (p.strecke.length > 1) {
        L.polyline(p.strecke.map((q) => [q.lat, q.lon] as [number, number]), {
          color: '#0B1B33', weight: 7, opacity: 0.55, interactive: false,
        }).addTo(this.nachtLayer);
      }
      const marke = (ort: Punkt, zeichen: string, text: string) => {
        L.marker([ort.lat, ort.lon], {
          icon: L.divIcon({ className: 'nacht-marke', html: `<span>${zeichen}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
          interactive: true, keyboard: false, zIndexOffset: MARKE_Z_OFFSET,
        }).bindTooltip(text, { direction: 'top', offset: [0, -10] }).addTo(this.nachtLayer);
      };
      if (!p.vonAnfangAn) {
        marke(p.beginnOrt, '🌙', en ? `It gets dark here, ${uhrLt(p.beginn)}` : `Hier wird es dunkel, ${uhrLt(p.beginn)}`);
      }
      if (p.endeOrt && p.ende) {
        marke(p.endeOrt, '☀', en ? `It gets light here again, ${uhrLt(p.ende)}` : `Hier wird es wieder hell, ${uhrLt(p.ende)}`);
      }
    }
  }

  setAntriebsphasen(phasen: AntriebMarker[]): void {
    this.antriebLayer.clearLayers();
    phasen.forEach((p, i) => {
      if (p.strecke.length > 1) {
        L.polyline(p.strecke.map((q) => [q.lat, q.lon] as [number, number]), {

          color: p.unterMotor ? '#7E96A3' : '#3FAE6A', weight: 5, opacity: 0.55, interactive: false,
        }).addTo(this.antriebLayer);
      }
      if (i === 0) return;

      const rand = p.unterMotor ? '#7E96A3' : '#3FAE6A';
      L.marker([p.beginnOrt.lat, p.beginnOrt.lon], {
        icon: L.divIcon({
          className: 'antrieb-marke',
          html: `<span style="border-color:${rand}">${p.unterMotor ? '⚙' : '⛵'}</span>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        }),
        interactive: true, keyboard: false, zIndexOffset: MARKE_Z_OFFSET,
      }).bindTooltip(aktuelleSprache() === 'en'
        ? `From here under ${p.unterMotor ? 'engine' : 'sail'}: ${uhrLt(p.beginn)}`
        : `Ab hier ${p.unterMotor ? 'unter Maschine' : 'unter Segel'}: ${uhrLt(p.beginn)}`,
        { direction: 'top', offset: [0, -10] }).addTo(this.antriebLayer);
    });
  }

  setSpitzenwerte(marker: SpitzenwertMarker[]): void {
    this.spitzenLayer.clearLayers();
    for (const m of marker) {
      L.marker([m.ort.lat, m.ort.lon], {
        icon: L.divIcon({
          className: 'spitzen-marke',
          html: `<span>${m.symbol}</span>`,
          iconSize: [26, 26], iconAnchor: [13, 13],
        }),
        interactive: true, keyboard: false, zIndexOffset: MARKE_Z_OFFSET,
      }).bindTooltip(m.text, { direction: 'top', offset: [0, -10] }).addTo(this.spitzenLayer);
    }
  }

  setKritisch(abschnitte: KritischMarker[]): void {
    this.kritischLayer.clearLayers();
    for (const a of abschnitte) {
      if (a.strecke.length > 1) {
        L.polyline(a.strecke.map((q) => [q.lat, q.lon] as [number, number]), {
          color: '#E1584B', weight: 9, opacity: 0.85, dashArray: '10 8', lineCap: 'butt', interactive: true,
        }).bindTooltip(a.text, { sticky: true }).addTo(this.kritischLayer);
      }
      L.marker([a.punkt.lat, a.punkt.lon], {
        icon: L.divIcon({ className: 'kritisch-marke', html: '<span>⚠</span>', iconSize: [30, 30], iconAnchor: [15, 15] }),
        interactive: true, keyboard: false, zIndexOffset: MARKE_Z_OFFSET + 10,
      }).bindTooltip(a.text, { direction: 'top', offset: [0, -12] }).addTo(this.kritischLayer);
    }
  }

  drawBarbs(): void {
    this.barbLayer.clearLayers();
    if (!this.lastTrack || !this.lastLimits) return;
    const limits = this.lastLimits;
    const px = this.barbSize();
    this.lastTrack.forEach((tp) => {
      const col = tp.gust >= limits.gust ? '#E1584B'
        : (tp.speed >= limits.mean ? '#F2A93B' : '#7FD8D0');

      const rad = tp.dir * Math.PI / 180;
      const schaftZeigtNachUnten = Math.cos(rad) < 0;

      const abstand = 0.22 + 0.10 * Math.abs(Math.sin(rad));
      const labelTop = Math.round(px * (schaftZeigtNachUnten ? 0.5 - abstand : 0.5 + abstand));
      const icon = L.divIcon({
        className: 'barb',
        html: windBarbSVG(tp.dir, tp.speed, tp.lat, col, px)
          + `<div class="barb-lbl" style="top:${labelTop}px; font-size:${Math.max(10, Math.round(px * 0.19))}px">${hhmm(tp.time)}</div>`,
        iconSize: [px, px], iconAnchor: [px / 2, px / 2],
      });

      let abschnitt: string | null = null;
      if (this.lastAbschnitte) {
        for (const a of this.lastAbschnitte) {
          if (a.von.getTime() <= tp.time.getTime()) abschnitt = a.bezeichnung;
        }
      }
      const sprache = aktuelleSprache();
      const kopf = sprache === 'en'
        ? `${uhrLt(tp.time)} · NM ${nf(tp.nm, 1, 'en')}<br>`
          + `Wind ${tp.speed.toFixed(0)} kn from ${kursGrad(tp.dir)} · Gusts ${tp.gust.toFixed(0)} kn`
        : `${uhrLt(tp.time)} · sm ${nf(tp.nm, 1)}<br>`
          + `Wind ${tp.speed.toFixed(0)} kn aus ${kursGrad(tp.dir)} · Böen ${tp.gust.toFixed(0)} kn`;
      L.marker([tp.lat, tp.lon], { icon, interactive: true, keyboard: false })
        .bindTooltip(kopf + (abschnitt ? `<br><i>${abschnitt}</i>` : ''),
          { direction: 'top', offset: [0, -px * 0.35] })
        .addTo(this.barbLayer);
    });
  }
}
