import { ohneSpruenge } from '@/core/livestream';
import { streamLogAuswahl } from '@/core/streamLog';
import '@/shell/tokens.css';
import 'leaflet/dist/leaflet.css';
import './style.css';
import L from 'leaflet';
import { aktuelleSprache } from '@/shell/sprache';
import { API_BASIS } from '@/shell/api';
import { setzeStreamProxy } from '@/data/fremdProxy';
import { escapeHtml } from '@/core/html';
import { kursGrad, nf, uhrLtVon, datumUhrLtVon, zeitzoneText } from '@/core/time';
import { positionText } from '@/core/koordinaten';
import { fotoOrtText, ortFuerPosition } from '@/core/standortName';
import { eintragArtName, eintragInhalt, type Liegeart } from '@/core/logbuchText';
import type { Sprache } from '@/core/types';
import { lateinisch } from '@/core/umschrift';
import { STRINGS } from './strings';
import { funktionSchluessel } from '@/core/crewFunktion';
import { fahrtmesser, kompass } from './instrumente';
import { yachtMarke, markePunkt, MARKE_PX, MARKE_ANKER } from './yachtMarke';
import { seeflagge, seeflaggeSvg, flaggeDesToerns } from '@/core/seeflaggen';
import { holeKanten, kantenBekannt } from './liegeplatz';
import { liegeLage, ANFAHRT_MIN_M } from '@/core/liegeplatz';
import { hafenUndOrt, ausfuehrlicher, glieder, kopfPaare } from './kopf';
import { beiZielname, zielname } from '@/shell/zielname';
import { meilenEinesTages, addiere, type Meilen } from './meilen';
import { tagMitLive } from './tagLive';
import { wetterKachel, wetterZurStunde } from './wetter';
import { holeStundenwetter } from '@/data/stundenwetter';
import type { Stundenwetter } from '@/core/zielwetter';
import { tagGruppen, brauchtTagTrenner, fahrtagZeit, fahrtagBereiche } from './tagLive';
import { distNM } from '@/core/geo';
import { festmachart, lage, lageNachTag, type Lage } from '@/core/lageSymbol';
import { revierName } from '@/briefing/region';
import { revierNachgezogen } from '@/core/revierzonen';
import { addScaleControl } from '@/map/scale';
import { SPURFARBE } from '@/map/spurfarbe';
import { antriebAbschnitte, wechselAusEintraegen } from '@/core/antriebsbilanz';
import { wechselStellen } from './spurAntrieb';
import { sonnenhoehe } from '@/core/sun';
import { hellerRand, mondhoehe, mondphase, mondzeiten } from '@/core/moon';
import { mondSvg } from '@/map/mondbild';
import { kurslinienEnde, restUndAnkunft, type StreamRoute } from '@/core/streamRoute';
import { initKommentare } from './kommentare';

type Punkt3 = [number, number, number];
interface Eintrag { t: number; art: string; text?: string; lat?: number | null; lon?: number | null; bild?: string; liegeart?: Liegeart }
interface Fahrt { id: string; begonnen: number; beendet: number | null; zeitzone?: string; name?: string; ziel?: string; streckeNM?: number | null }
interface Stand {
  t: number; lat: number; lon: number; sog: number | null; cog: number | null; streckeNM: number | null; fahrzeitS: number | null; betriebsart: string; antrieb: string | null;

  ort?: { name: string; lat: number; lon: number };

  route?: StreamRoute;
}
interface Live { fahrt: Fahrt; punkte: Punkt3[]; eintraege: Eintrag[]; stand: Stand; aktualisiert: string }
interface Hafen { name: string; lat: number; lon: number }
interface Seite {
  toern: {
    name: string; revier: string | null; von: string | null; bis: string | null; yachtnutzung: string;
    schiff: { name?: string; typ?: string; laengeM?: number; baujahr?: number; flagge?: string }; start_hafen: Hafen | null; rueckgabe_hafen: Hafen | null;
    beendet: string | null; archiviert: boolean; schiffFoto: string;

    status?: 'laeuft' | 'beendet' | null;
  };
  geteiltVon: { vorname: string; nachname: string } | null;
  crew: { vorname: string; nachname: string; funktion: string; funktionForm?: 'w' | 'm' | null }[];
  spuren: { fahrtId: string; beginn: number | null; ende: number | null }[];
  live: Live[];

  fotos: CrewFoto[];
}
interface CrewFoto { id: string; t: number; breite: number; hoehe: number; lat: number | null; lon: number | null; text: string | null; ort?: string; von: { vorname: string; nachname: string } | null }

interface Ort { art: string; name?: string; t?: number; lat?: number; lon?: number }
interface Tag { fahrt: Fahrt; punkte: Punkt3[]; eintraege: Eintrag[]; orte: Ort[] }

const NEU_LADEN_MS = 120_000;

const STAND_MS = 5_000;

const VERALTET_UNTERWEGS_MS = 2 * 60_000;

const sprache: Sprache = aktuelleSprache();
const wort = (s: string, ersatz: Record<string, string> = {}): string =>
  (STRINGS[sprache][s] ?? s).replace(/\{(\w+)\}/g, (_, k: string) => ersatz[k] ?? '');
const $ = (id: string) => document.getElementById(id);
const token = new URLSearchParams(location.search).get('t') ?? '';
const api = (pfad: string) => `${API_BASIS}/api/stream/${encodeURIComponent(token)}${pfad}`;

setzeStreamProxy(token);

document.documentElement.lang = sprache;

function uhrzeit(t: number, zone?: string): string {
  return uhrLtVon(t, zone);
}

function datum(t: number, zone?: string): string {
  const fmt = { weekday: 'short', day: 'numeric', month: 'numeric' } as const;
  try {
    return new Intl.DateTimeFormat(sprache === 'de' ? 'de-AT' : 'en-GB', { ...fmt, ...(zone ? { timeZone: zone } : {}) }).format(t);
  } catch {
    return new Intl.DateTimeFormat(sprache === 'de' ? 'de-AT' : 'en-GB', fmt).format(t);
  }
}

function kalender(iso: string | null): string {
  if (!iso) return '';
  const [j, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(sprache === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })
    .format(new Date(j!, m! - 1, d!));
}

function dauer(s: number): string {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

function vorWieLange(t: number): string {
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return wort('gerade');
  return min < 120 ? wort('vorMin', { n: String(min) }) : wort('vorStd', { n: String(Math.round(min / 60)) });
}

function name(p: { vorname: string; nachname: string }): string {
  return `${p.vorname} ${p.nachname}`.trim();
}

function strecke(f: Fahrt, orte: { art: string; name?: string }[] = []): string {
  if (f.name) return lateinisch(f.name);
  const von = orte.find((o) => o.art === 'start')?.name;
  const nach = orte.filter((o) => o.art === 'ziel').pop()?.name ?? f.ziel;
  return [von, nach].filter(Boolean).map((n) => lateinisch(n!)).join(' → ');
}

let karte: L.Map | null = null;
const ebeneTage = L.layerGroup();
const ebeneLive = L.layerGroup();
const ebeneOrte = L.layerGroup();
let hervorgehoben: L.Polyline | null = null;

let yachtPos: [number, number] | null = null;

let folgeYacht = true;

function setzeFolgen(an: boolean): void {
  folgeYacht = an;
  zeigeZurYacht();
}
function zeigeZurYacht(): void {
  document.querySelector<HTMLElement>('.st-zur-yacht')?.toggleAttribute('hidden', !yachtPos || folgeYacht);
}

function baueKarte(): L.Map {
  if (karte) return karte;

  const beruehrung = L.Browser.mobile || matchMedia('(pointer: coarse)').matches;
  karte = L.map('st-karte', { attributionControl: true, scrollWheelZoom: false, dragging: !beruehrung });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(karte);
  L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>',
  }).addTo(karte);
  ebeneTage.addTo(karte);
  ebeneOrte.addTo(karte);
  ebeneLive.addTo(karte);
  karte.on('dragstart', () => setzeFolgen(false));

  karte.getContainer().addEventListener('touchstart', (e) => { if (e.touches.length > 1) setzeFolgen(false); }, { passive: true });

  const ZurYacht = L.Control.extend({
    onAdd: () => {
      const knopf = L.DomUtil.create('button', 'st-zur-yacht');
      knopf.type = 'button';
      knopf.hidden = true;
      knopf.textContent = wort('zurYacht');
      L.DomEvent.disableClickPropagation(knopf);
      knopf.addEventListener('click', () => {
        if (!yachtPos || !karte) return;
        setzeFolgen(true);
        karte.setView(yachtPos, yachtZoom(karte));
      });
      return knopf;
    },
  });
  new ZurYacht({ position: 'topright' }).addTo(karte);

  karte.whenReady(() => addScaleControl(karte!));

  const Legende = L.Control.extend({
    onAdd: () => {
      const kasten = L.DomUtil.create('div', 'st-legende');
      const eintrag = (f: string, text: string) =>
        `<span><i style="background:${f}" aria-hidden="true"></i>${escapeHtml(text)}</span>`;
      kasten.innerHTML = eintrag(SPURFARBE.segel, wort('antrieb.segel')) + eintrag(SPURFARBE.motor, wort('antrieb.motor'))
        + eintrag(SPURFARBE.offen, wort('meilen.offen'));
      return kasten;
    },
  });
  new Legende({ position: 'bottomleft' }).addTo(karte);

  const zoomKlasse = () => karte!.getContainer().classList.toggle('st-wechsel-aus', karte!.getZoom() < WECHSEL_AB_ZOOM);
  karte.on('zoomend', zoomKlasse);
  karte.on('moveend', () => zielSeite());
  karte.whenReady(zoomKlasse);

  karte.createPane('st-nacht').style.zIndex = '300';
  nachtSchleier = L.rectangle([[-85, -540], [85, 540]], {
    pane: 'st-nacht', stroke: false, fillColor: '#0a1a4a', fillOpacity: 0.38, interactive: false,
  });
  const mond = L.DomUtil.create('div', 'st-mond', karte.getContainer());
  mond.hidden = true;
  mond.setAttribute('role', 'img');
  return karte;
}

let nachtSchleier: L.Rectangle | null = null;

const SONNE_UNTER_GRAD = -0.833;

function istDunkel(lat: number, lon: number): boolean {
  return sonnenhoehe(lat, lon, new Date()) < SONNE_UNTER_GRAD;
}

function setzeNacht(pos: { lat: number; lon: number } | null, zone?: string): void {
  if (!karte || !nachtSchleier) return;
  const nacht = !!pos && istDunkel(pos.lat, pos.lon);
  if (nacht && !karte.hasLayer(nachtSchleier)) nachtSchleier.addTo(karte);
  if (!nacht && karte.hasLayer(nachtSchleier)) nachtSchleier.remove();
  const mond = karte.getContainer().querySelector<HTMLElement>('.st-mond');
  if (!mond) return;
  mond.hidden = !nacht;
  if (nacht && pos) zeigeMond(mond, pos.lat, pos.lon, zone);
}

function zeigeMond(el: HTMLElement, lat: number, lon: number, zone?: string): void {
  const jetzt = new Date();
  const ph = mondphase(jetzt);
  const ueber = mondhoehe(lat, lon, jetzt) > 0;
  const zeiten = mondzeiten(lat, lon, jetzt);
  const naechster = ueber ? zeiten.unter : zeiten.auf;
  const prozent = Math.round(ph.beleuchtung * 100);

  const rand = ueber ? hellerRand(lat, lon, jetzt) : (ph.zunehmend === (lat >= 0) ? 270 : 90);
  el.innerHTML = mondSvg(ph.beleuchtung, rand, ueber);
  const text = [
    wort(`mond.${ph.name}`),
    wort('mond.beleuchtet', { p: String(prozent) }),
    wort(ueber ? 'mond.ueberHorizont' : 'mond.unterHorizont'),
    naechster ? wort(ueber ? 'mond.untergang' : 'mond.aufgang', { z: uhrzeit(naechster.getTime(), zone) }) : '',
  ].filter(Boolean).join(', ');
  el.setAttribute('aria-label', text);
  el.title = text;
}

const nachtPos = (live: Live | null) => (live && live.stand.betriebsart !== 'gestoppt' ? live.stand : null);

const latLngs = (p: Punkt3[]) => p.map((x) => [x[1], x[2]] as [number, number]);

const ZOOM_UNTERWEGS = 12;
function istUnterwegs(): boolean {
  const live = aktuellesLive;
  const l = live ? lageVon(live.stand, live.eintraege) : null;
  return !!live && live.stand.betriebsart === 'laeuft' && (l === 'segel' || l === 'motor');
}
function yachtZoom(k: L.Map): number {
  gezoomtUnterwegs = istUnterwegs();
  return gezoomtUnterwegs ? ZOOM_UNTERWEGS : k.getMaxZoom();
}

let gezoomtUnterwegs: boolean | null = null;

const WECHSEL_AB_ZOOM = 11;

function zeichneSpur(ebene: L.LayerGroup, alle: Punkt3[], eintraege: readonly Eintrag[], zone: string | undefined, heute: boolean): void {

  const punkte = ohneSpruenge(alle);
  if (punkte.length < 2) return;
  const p = punkte.map((x) => ({ t: x[0], lat: x[1], lon: x[2] }));
  for (const ab of antriebAbschnitte(p, wechselAusEintraegen([...eintraege]))) {
    L.polyline(ab.punkte.map((x) => [x.lat, x.lon] as [number, number]), {
      color: SPURFARBE[ab.antrieb ?? 'offen'], weight: heute ? 4 : 3, opacity: heute ? 1 : 0.75, interactive: false,
    }).addTo(ebene);
  }
  for (const w of wechselStellen(punkte, eintraege)) {
    const zeit = uhrzeit(w.t, zone);
    L.marker([w.lat, w.lon], {
      icon: L.divIcon({ className: 'st-wechsel', html: `<span style="border-color:${SPURFARBE[w.antrieb]}">${escapeHtml(zeit)}</span>`, iconSize: [0, 0] }),
      interactive: false, keyboard: false,
      title: `${zeit} ${wort(`antrieb.${w.antrieb}`)}`,
    }).addTo(ebene);
  }
}

function logListe(eintraege: Eintrag[], zone?: string): HTMLElement {

  const sortiert = streamLogAuswahl(eintraege).sort((a, b) => b.t - a.t);
  if (!sortiert.length) {
    const p = document.createElement('p');
    p.className = 'st-leer';
    p.textContent = wort('keinEintrag');
    return p;
  }
  const ul = document.createElement('ul');
  ul.className = 'st-log';

  const gruppen = tagGruppen(sortiert, (t) => tagIn(t, zone), tagIn(Date.now(), zone));
  const mitTrenner = brauchtTagTrenner(gruppen);
  for (const g of gruppen) {
    if (mitTrenner) {
      const li = document.createElement('li');
      li.className = 'st-log-tag';
      li.textContent = g.heute ? wort('tagHeute') : datum(g.eintraege[0]!.t, zone);
      ul.append(li);
    }
    for (const e of g.eintraege) ul.append(logZeile(e, zone));
  }
  return ul;
}

function logZeile(e: Eintrag, zone?: string): HTMLLIElement {
  const li = document.createElement('li');
  const zeit = document.createElement('time');
  zeit.dateTime = new Date(e.t).toISOString();
  zeit.textContent = uhrzeit(e.t, zone);
  const text = document.createElement('div');
  text.className = 'st-log-text';
  const art = eintragArtName(e.art, sprache, e.liegeart);
  const inhalt = eintragInhalt(e.art, e.text, sprache);
  text.innerHTML = [art ? `<b>${escapeHtml(art)}</b>` : '', escapeHtml(inhalt)].filter(Boolean).join(' · ');
  if (e.art === 'foto' && e.bild) {
    const bild = document.createElement('img');
    bild.src = api(`/bild/${encodeURIComponent(e.bild)}`);
    bild.alt = inhalt || wort('foto');
    bild.loading = 'lazy';
    bild.className = 'st-foto';
    const link = document.createElement('a');
    link.href = bild.src;
    link.target = '_blank';
    link.rel = 'noopener';
    link.append(bild);

    bild.addEventListener('error', () => {
      const ersatz = document.createElement('span');
      ersatz.className = 'st-leer';
      ersatz.textContent = wort('fotoFehlt');
      link.replaceWith(ersatz);
    });
    text.append(link);
  }
  li.append(zeit, text);
  return li;
}

let alleFotos: CrewFoto[] = [];

const gezeigteFotos = new Set<string>();

function tagIn(t: number, zone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { ...(zone ? { timeZone: zone } : {}), year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

function fotoRaster(fotos: CrewFoto[], zone?: string): HTMLElement | null {
  if (!fotos.length) return null;
  const ul = document.createElement('ul');
  ul.className = 'st-fotos';
  for (const f of [...fotos].sort((a, b) => b.t - a.t)) {
    gezeigteFotos.add(f.id);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = api(`/foto/${encodeURIComponent(f.id)}`);
    a.target = '_blank';
    a.rel = 'noopener';
    const img = document.createElement('img');
    img.src = a.href;
    img.alt = f.text ?? wort('foto');
    img.loading = 'lazy';
    a.append(img);
    const unter = document.createElement('p');

    const ort = fotoOrtText({ ...f, ort: f.ort ? lateinisch(f.ort) : null }, sprache);
    unter.textContent = [uhrzeit(f.t, zone), ort, f.von ? name(f.von) : null, f.text].filter(Boolean).join(' · ');
    li.append(a, unter);
    ul.append(li);
  }
  return ul;
}

const fotosAm = (tag: string, zone?: string) => alleFotos.filter((f) => tagIn(f.t, zone) === tag);

function standOrtText(s: Stand): string {
  const name = ortFuerPosition(s, s.ort);
  return name ? lateinisch(name) : positionText(s.lat, s.lon, sprache);
}

let bootOrt: string | null = null;

function zeile(beschriftung: string, wert: string): string {
  return `<div class="st-zeile"><dt>${escapeHtml(beschriftung)}</dt><dd>${escapeHtml(wert)}</dd></div>`;
}

let schiffName = '';

let schiffFlaggeCode: string | null = null;

function zeigeToern(s: Seite): void {
  const t = s.toern;
  schiffName = lateinisch(t.schiff.name ?? '').trim();
  const flagge = flaggeDesToerns(t.schiff, t.revier);
  schiffFlaggeCode = flagge ?? null;
  $('st-name')!.textContent = t.name;

  const status = $('st-status')!;
  status.hidden = !t.status;
  status.textContent = t.status ? wort(`status.${t.status}`) : '';
  status.dataset['status'] = t.status ?? '';
  document.title = `${t.name} · ${wort('titel')}`;

  const link = '<a href="https://sail-suite.app/" target="_blank" rel="noopener">sail-suite.app</a>';
  $('st-geteilt')!.innerHTML = s.geteiltVon
    ? wort('geteiltVon', { n: escapeHtml(name(s.geteiltVon)), link })
    : wort('geteiltUeber', { link });

  $('st-toern-daten')!.innerHTML = [
    t.schiff.name ? zeile(wort('name'), lateinisch(t.schiff.name)) : '',
    seeflagge(flagge)
      ? `<div class="st-zeile"><dt>${escapeHtml(wort('flagge'))}</dt><dd>${flaggeVorweg(flagge, 14)}${escapeHtml(seeflagge(flagge)!.name[sprache])}</dd></div>`
      : flagge ? zeile(wort('flagge'), flagge) : '',
    t.schiff.typ ? zeile(wort('typ'), t.schiff.typ) : '',
    t.schiff.baujahr ? zeile(wort('baujahr'), String(t.schiff.baujahr)) : '',
    t.schiff.laengeM ? zeile(wort('laenge'), `${nf(t.schiff.laengeM, 1, sprache)} m`) : '',
    zeile(wort('nutzung'), wort(`yachtnutzung.${t.yachtnutzung}`)),
  ].join('');
  const foto = $('st-schiff-foto') as HTMLImageElement | null;
  if (foto && !foto.dataset.geladen) {
    foto.dataset.geladen = '1';
    foto.src = `${API_BASIS}${t.schiffFoto}`;
    foto.alt = t.schiff.name ?? wort('schiff');
    foto.addEventListener('load', () => { foto.hidden = false; });
  }
  const crew = $('st-crew')!;
  $('st-crew-bereich')!.hidden = !s.crew.some((c) => name(c));
  crew.replaceChildren(...s.crew.filter((c) => name(c)).map((c) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(name(c))}</span><span class="st-funktion">${escapeHtml(wort(funktionSchluessel(c.funktion, c.funktionForm)))}</span>`;
    return li;
  }));
}

interface Ortsangabe { name: string; lat: number; lon: number; t: number }

const HAFEN_NAEHE_M = 1000;

const abstandM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) * 60 * 1852;

function ortsangaben(tage: readonly Tag[], live: Live | null): Ortsangabe[] {
  const aus: Ortsangabe[] = [];
  for (const tag of tage) {
    for (const o of tag.orte) {
      if (o.name && o.lat != null && o.lon != null) aus.push({ name: lateinisch(o.name), lat: o.lat, lon: o.lon, t: o.t ?? tag.fahrt.begonnen });
    }
  }
  for (const e of live?.eintraege ?? []) {
    if (e.text && e.lat != null && e.lon != null && ['start', 'anlegen', 'ankern', 'liegeplatz', 'ankerplatz'].includes(e.art)) {
      aus.push({ name: lateinisch(e.text), lat: e.lat, lon: e.lon, t: e.t });
    }
  }
  return aus.sort((a, b) => a.t - b.t);
}

function naechsteAngabe(p: Hafen, angaben: readonly Ortsangabe[]): string | null {
  let best: Ortsangabe | null = null;
  for (const a of angaben) if (abstandM(p, a) < HAFEN_NAEHE_M && (!best || abstandM(p, a) < abstandM(p, best))) best = a;
  return best?.name ?? null;
}

function hafenAngabe(p: Hafen, angaben: readonly Ortsangabe[]): string | null {
  const aus = naechsteAngabe(p, angaben);
  return glieder(aus).length >= 3 ? aus : ausfuehrlicher(aus, zielname(p.lat, p.lon));
}

function routeZiel(r: StreamRoute): string | null {
  const z = r.punkte[r.punkte.length - 1]!;
  const n = glieder(r.ziel).length >= 3 ? r.ziel ?? null : ausfuehrlicher(r.ziel ?? null, zielname(z[0], z[1]));
  return n ? lateinisch(n) : null;
}

let letzterKopf: Parameters<typeof zeigeKopf> | null = null;

beiZielname(() => {
  if (letzterKopf) zeigeKopf(...letzterKopf);
  if (aktuellesLive) zeigeAktuell(aktuellesLive);
});

function kopfFeld(beschriftung: string, wert: string, vorweg = ''): string {
  return `<div class="st-kopf-feld"><dt>${escapeHtml(beschriftung)}</dt><dd>${vorweg}${escapeHtml(wert)}</dd></div>`;
}

const flaggeVorweg = (code: string | undefined, px: number) => {
  const svg = seeflaggeSvg(code, px, sprache);
  return svg ? `${svg} ` : '';
};

function zeigeKopf(s: Seite, tage: readonly Tag[], live: Live | null): void {
  letzterKopf = [s, tage, live];
  const t = s.toern;
  const angaben = ortsangaben(tage, live);
  const zeitraum = t.von && t.bis ? wort('bis', { a: kalender(t.von), b: kalender(t.bis) }) : kalender(t.von ?? t.bis);
  const start = t.start_hafen
    ? hafenUndOrt(lateinisch(t.start_hafen.name), hafenAngabe(t.start_hafen, angaben))
    : hafenUndOrt(null, tage[0]?.orte.find((o) => o.art === 'start')?.name ?? angaben[0]?.name ?? null);
  const letzterTag = tage[tage.length - 1];
  const ziel = t.rueckgabe_hafen
    ? hafenUndOrt(lateinisch(t.rueckgabe_hafen.name), hafenAngabe(t.rueckgabe_hafen, angaben))
    : t.beendet && letzterTag ? hafenUndOrt(null, letzterTag.orte.filter((o) => o.art === 'ziel').pop()?.name ?? null) : '';
  const bezug = yachtPos ?? (t.start_hafen ? [t.start_hafen.lat, t.start_hafen.lon] as [number, number] : null);
  const seegebiet = !t.revier && bezug ? revierName(bezug[0], bezug[1], sprache) : null;
  const gross = (x: string) => x.charAt(0).toLocaleUpperCase(sprache) + x.slice(1);

  $('st-kopf-daten')!.innerHTML = kopfPaare([
    [
      zeitraum ? kopfFeld(wort('zeitraum'), zeitraum) : '',

      t.revier ? kopfFeld(wort('revier'), revierNachgezogen(t.revier, t.start_hafen, t.rueckgabe_hafen) ?? t.revier)
        : seegebiet ? kopfFeld(wort('seegebiet'), gross(seegebiet)) : '',
    ],
    [start ? kopfFeld(wort('start'), lateinisch(start)) : '', ziel ? kopfFeld(wort('ziel'), lateinisch(ziel)) : ''],
    [
      t.schiff.name ? kopfFeld(wort('schiffName'), lateinisch(t.schiff.name), flaggeVorweg(flaggeDesToerns(t.schiff, t.revier), 14)) : '',
      t.schiff.typ ? kopfFeld(wort('typ'), t.schiff.typ) : '',
    ],
  ]);
}

function routeZeilen(s: Stand, unterwegs: boolean, zone: string | undefined): string[] {
  const r = s.route;
  if (!r || s.betriebsart === 'gestoppt') return [];
  const z = r.punkte[r.punkte.length - 1]!;

  const { restSm, ankunft } = restUndAnkunft(r, { t: s.t, lat: s.lat, lon: s.lon, sog: unterwegs ? s.sog : null });
  return [
    zeile(wort('route.ziel'), routeZiel(r) ?? positionText(z[0], z[1], sprache)),
    restSm != null ? zeile(wort('route.rest'), `${nf(restSm, 1, sprache)} ${wort('sm')}`) : '',
    unterwegs && ankunft != null ? zeile(wort('route.ankunft'), `${datum(ankunft, zone)}, ${uhrzeit(ankunft, zone)}`) : '',
  ];
}

function zeigeAktuell(live: Live | null): void {
  const box = $('st-aktuell')!;
  box.hidden = !live;
  const instrumente = $('st-instrumente')!;
  instrumente.hidden = !live;
  if (!live) return;
  const s = live.stand;

  const l = lageVon(s, live.eintraege);
  const unterwegs = s.betriebsart === 'laeuft' && (l === 'segel' || l === 'motor');
  instrumente.innerHTML = fahrtmesser(unterwegs ? s.sog : null, sprache) + kompass(unterwegs ? s.cog : null, sprache);
  const zone = live.fahrt.zeitzone;
  $('st-stand')!.textContent = `${wort('stand')} ${uhrzeit(s.t, zone)} (${vorWieLange(s.t)})`;
  $('st-werte')!.innerHTML = [

    zeile(wort('position'), standOrtText(s)),
    unterwegs && s.sog != null ? zeile(wort('fahrt'), `${nf(s.sog, 1, sprache)} ${wort('kn')}`) : '',
    unterwegs && s.cog != null ? zeile(wort('kurs'), kursGrad(s.cog)) : '',

    s.streckeNM ? zeile(wort('streckeHeute'), `${nf(s.streckeNM, 1, sprache)} ${wort('sm')}`) : '',
    s.fahrzeitS ? zeile(wort('fahrzeit'), dauer(s.fahrzeitS)) : '',
    unterwegs && s.antrieb ? zeile(wort('antrieb'), wort(`antrieb.${s.antrieb}`)) : '',

    ...routeZeilen(s, unterwegs, zone),
  ].join('');

  $('st-zustand')!.textContent = s.betriebsart === 'pausiert' || s.betriebsart === 'pausiert-anker'
    ? lageText(l, live.eintraege) : wort(`zustand.${s.betriebsart}`);

  const grenze = VERALTET_UNTERWEGS_MS;
  const veraltet = $('st-veraltet')!;
  veraltet.hidden = Date.now() - s.t < grenze || s.betriebsart !== 'laeuft';
  veraltet.textContent = wort('veraltet', { n: String(grenze / 60_000) });

  const heuteTag = tagIn(Date.now(), zone);
  const fz = liveFahrtagZeit(live);
  const laufTitel = tagIn(fz, zone) === heuteTag
    ? wort('heute') : wort('laeuftSeit', { tag: datum(fz, zone) });
  $('st-heute-titel')!.textContent = [wort('logbuch'), laufTitel, strecke(live.fahrt)].filter(Boolean).join(' · ');

  const zt = zeitzoneText(Date.now(), zone, sprache === 'de' ? 'de' : 'en');
  $('st-heute-zone')!.textContent = zt ? `LT = ${zt}` : '';
  const heuteFotos = fotoRaster(fotosAm(tagIn(fz, zone), zone), zone);
  $('st-heute-log')!.replaceChildren(...(heuteFotos ? [heuteFotos] : []), logListe(live.eintraege, zone));
}

function lageText(l: Lage, eintraege: readonly Eintrag[]): string {
  const art = l === 'angelegt' || l === 'liegeplatz' ? festmachart(eintraege) : null;
  return wort(art ? `lage.fest.${art}` : LAGE_WORT[l]);
}

const LAGE_WORT: Record<Lage, string> = {
  segel: 'lage.segel', motor: 'lage.motor', ankernd: 'lage.anker', treibend: 'lage.treibend',
  angelegt: 'lage.fest', liegeplatz: 'lage.fest',
};

function lageVon(stand: Stand, eintraege: readonly Eintrag[]): Lage {
  const betriebsart = stand.betriebsart as Parameters<typeof lage>[0]['betriebsart'];
  const antrieb = stand.antrieb === 'segel' || stand.antrieb === 'motor' ? stand.antrieb : null;
  return lage({ betriebsart, antrieb, abgelegt: eintraege.some((e) => e.art === 'start'), eintraege }) ?? lageNachTag(eintraege);
}

function zeichneBoot(lat: number, lon: number, kurs: number | null, l: Lage, text: string, anker: [number, number] = MARKE_ANKER): void {
  const name = schiffName ? `<span class="st-boot-name">${escapeHtml(schiffName)}<small>${escapeHtml(text)}</small></span>` : `<span class="st-boot-name st-boot-nur">${escapeHtml(text)}</span>`;

  const lichter = (l === 'segel' || l === 'motor') && istDunkel(lat, lon) ? l : null;
  const boot = L.divIcon({ className: 'st-boot', html: yachtMarke(kurs, l === 'segel', lichter, schiffFlaggeCode) + name, iconSize: [MARKE_PX, MARKE_PX], iconAnchor: anker });
  L.marker([lat, lon], { icon: boot, keyboard: false, title: [schiffName, text, bootOrt ?? positionText(lat, lon, sprache)].filter(Boolean).join(' · ') })
    .addTo(ebeneLive);
}

function zeichneBootAmPlatz(
  lat: number, lon: number, kurs: number | null, l: Lage, eintraege: readonly Eintrag[], punkte: readonly Punkt3[], neu: () => void,
): void {
  const text = lageText(l, eintraege);
  const art = l === 'angelegt' || l === 'liegeplatz' ? festmachart(eintraege) : null;
  if (art === 'heck' || art === 'bug' || art === 'laengsseits') {
    const kanten = kantenBekannt(lat, lon);
    holeKanten(lat, lon, api, neu);

    let anfahrt: { lat: number; lon: number } | null = null;
    for (let i = punkte.length - 1; i >= 0; i--) {
      const q = punkte[i]!;
      if (distNM(lat, lon, q[1], q[2]) * 1852 >= ANFAHRT_MIN_M) { anfahrt = { lat: q[1], lon: q[2] }; break; }
    }
    const am = kanten ? liegeLage({ lat, lon }, art, kanten, anfahrt, punkte.length >= 2 ? kursAm([...punkte]) : null) : null;
    if (am) {
      const teil = art === 'laengsseits' ? am.seite ?? 'stb' : art;
      zeichneBoot(am.lat, am.lon, am.kurs, l, text, markePunkt(am.kurs, teil));
      return;
    }
  }
  zeichneBoot(lat, lon, kurs, l, text);
}

function zeichneLive(live: Live | null): void {
  ebeneLive.clearLayers();
  setzeNacht(nachtPos(live), live?.fahrt.zeitzone);
  if (!live || !karte) return;
  const s = live.stand;
  const l = lageVon(s, live.eintraege);

  zeichneRoute(s, l);
  zeichneSpur(ebeneLive, live.punkte, live.eintraege, live.fahrt.zeitzone, true);
  bootOrt = ortFuerPosition(s, s.ort) ? standOrtText(s) : null;
  zeichneBootAmPlatz(s.lat, s.lon, s.cog ?? null, l, live.eintraege, live.punkte, () => { if (aktuellesLive === live) zeichneLive(live); });
}

const ROUTE_FARBE = '#D6409F';
const KURS_FARBE = '#3B7DD8';

let zielMarke: L.Marker | null = null;
function zielSeite(): void {
  const el = zielMarke?.getElement();
  if (!karte || !zielMarke || !el) return;

  let x: number;
  try { x = karte.latLngToContainerPoint(zielMarke.getLatLng()).x; } catch { return; }
  el.classList.toggle('st-ziel-links', x > karte.getSize().x / 2);
}

function zeichneRoute(s: Stand, l: Lage): void {
  zielMarke = null;
  if (s.betriebsart === 'gestoppt') return;
  const r = s.route;
  if (r && r.punkte.length >= 2) {
    L.polyline(r.punkte, { color: ROUTE_FARBE, weight: 3, opacity: 0.45, dashArray: '6 8', interactive: false, className: 'st-route' }).addTo(ebeneLive);
    const z = r.punkte[r.punkte.length - 1]!;
    L.circleMarker(z, { radius: 6, color: ROUTE_FARBE, weight: 2, opacity: 0.6, fillColor: '#FFFFFF', fillOpacity: 0.6, interactive: false, className: 'st-route' }).addTo(ebeneLive);
  }
  const unterwegs = s.betriebsart === 'laeuft' && (l === 'segel' || l === 'motor');
  if (r && r.punkte.length >= 2) {

    const z = r.punkte[r.punkte.length - 1]!;
    const { ankunft } = restUndAnkunft(r, { t: s.t, lat: s.lat, lon: s.lon, sog: unterwegs ? s.sog : null });
    const zone = aktuellesLive?.fahrt.zeitzone;
    const name = routeZiel(r);
    const zeit = unterwegs && ankunft != null ? `${wort('route.ankunftKurz')} ${datum(ankunft, zone)}, ${uhrzeit(ankunft, zone)}` : null;
    if (name || zeit) {
      zielMarke = L.marker(z, {
        icon: L.divIcon({ className: 'st-ziel', html: `<span>${name ? `<b>${escapeHtml(name)}</b>` : ''}${zeit ? `<small>${escapeHtml(zeit)}</small>` : ''}</span>`, iconSize: [0, 0] }),
        interactive: false, keyboard: false,
      }).on('add', () => zielSeite()).addTo(ebeneLive);
      zielSeite();
    }
  }
  const ende = unterwegs ? kurslinienEnde(s.lat, s.lon, s.cog, s.sog) : null;
  if (ende) L.polyline([[s.lat, s.lon], ende], { color: KURS_FARBE, weight: 2, opacity: 0.55, dashArray: '2 6', interactive: false, className: 'st-kurslinie' }).addTo(ebeneLive);
}

let letzterTag: Tag | null = null;
function zeichneLetztenTag(tag: Tag): void {
  letzterTag = tag;
  ebeneLive.clearLayers();
  const ende = tag.punkte[tag.punkte.length - 1];
  setzeNacht(ende ? { lat: ende[1], lon: ende[2] } : null, tag.fahrt.zeitzone);
  if (!karte || tag.punkte.length === 0) return;
  zeichneSpur(ebeneLive, tag.punkte, tag.eintraege, tag.fahrt.zeitzone, true);
  const letzter = tag.punkte[tag.punkte.length - 1]!;
  const nachTag = lageNachTag(tag.eintraege);
  bootOrt = null;
  zeichneBootAmPlatz(letzter[1], letzter[2], kursAm(tag.punkte), nachTag, tag.eintraege, tag.punkte, () => {
    if (!aktuellesLive && letzterTag === tag) zeichneLetztenTag(tag);
  });
}

function kursAm(p: Punkt3[]): number | null {
  const b = p[p.length - 1]!;
  for (let i = p.length - 2; i >= 0; i--) {
    const a = p[i]!;
    const dy = b[1] - a[1];
    const dx = (b[2] - a[2]) * Math.cos((b[1] * Math.PI) / 180);
    if (Math.hypot(dx, dy) * 60 * 1852 < 50) continue;
    return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  }
  return null;
}

const tageCache = new Map<string, Tag>();

const tagStand = new Map<string, string>();

let fruehereLive = new Map<string, Live>();

let mitSpur = new Set<string>();

async function holeTag(sp: { fahrtId: string; ende: number | null }): Promise<Tag | null> {

  const live = fruehereLive.get(sp.fahrtId) ?? (aktuellesLive?.fahrt.id === sp.fahrtId ? aktuellesLive : null);
  const stand = `${sp.ende ?? ''}|${live?.stand.t ?? ''}`;
  const bekannt = tageCache.get(sp.fahrtId);
  if (bekannt && tagStand.get(sp.fahrtId) === stand) return bekannt;
  let spur: Tag | null = null;
  if (mitSpur.has(sp.fahrtId)) {
    try {
      const r = await fetch(api(`/spur/${encodeURIComponent(sp.fahrtId)}`));
      if (r.ok) spur = (await r.json()) as Tag;
    } catch {  }
    if (!spur && !live) return bekannt ?? null;
  }
  const tag = tagMitLive(spur, live);
  if (!tag) return null;
  tageCache.set(sp.fahrtId, tag);
  tagStand.set(sp.fahrtId, stand);
  return tag;
}

function hebeHervor(tag: Tag): void {
  if (!karte || tag.punkte.length < 2) return;
  setzeFolgen(false);
  hervorgehoben?.remove();

  hervorgehoben = L.polyline(latLngs(ohneSpruenge(tag.punkte)), { color: '#0B1E2D', weight: 10, opacity: 0.35, interactive: false }).addTo(karte);
  hervorgehoben.bringToBack();
  karte.fitBounds(hervorgehoben.getBounds(), { padding: [24, 24] });
}

function liveFahrtagZeit(live: Live): number {
  const punkte: Punkt3[] = live.punkte.length ? live.punkte : [[live.stand.t, live.stand.lat, live.stand.lon]];
  return fahrtagZeit(live.fahrt.begonnen, live.eintraege, punkte);
}

type Spur = Seite['spuren'][number];

function tagSpanne(sp: Spur): { von: number | null; bis: number | null; zone: string | undefined } {
  const tag = tageCache.get(sp.fahrtId);

  const live = fruehereLive.get(sp.fahrtId) ?? (aktuellesLive?.fahrt.id === sp.fahrtId ? aktuellesLive : null);
  const ersatz = live ? { lat: live.stand.lat, lon: live.stand.lon } : null;
  const von = tag ? fahrtagZeit(tag.fahrt.begonnen, tag.eintraege, tag.punkte, ersatz) : sp.beginn;
  const letzter = tag?.punkte[tag.punkte.length - 1]?.[0];
  return { von, bis: letzter ?? sp.ende ?? von, zone: tag?.fahrt.zeitzone };
}

function tagNummern(s: Seite): { von: number; bis: number }[] {
  return fahrtagBereiche(s.spuren.map((sp) => {
    const { von, bis, zone } = tagSpanne(sp);
    const v = von !== null ? tagIn(von, zone) : '';
    return { von: v, bis: bis !== null ? tagIn(Math.max(bis, von ?? bis), zone) : v };
  }));
}

function tagTitel(sp: Spur, nr: { von: number; bis: number } | undefined, i: number): string {
  const tag = tageCache.get(sp.fahrtId);
  const { von, bis, zone } = tagSpanne(sp);
  const route = tag ? strecke(tag.fahrt, tag.orte) : '';
  const mehr = !!nr && nr.bis > nr.von;
  const titel = mehr ? wort('tage', { von: String(nr.von), bis: String(nr.bis) })
    : wort('tag', { n: String(nr && nr.von > 0 ? nr.von : i + 1) });
  const wann = von === null ? '' : mehr && bis !== null ? `${datum(von, zone)}–${datum(bis, zone)}` : datum(von, zone);
  const laeuft = aktuellesLive?.fahrt.id === sp.fahrtId ? wort('tagLaeuft') : '';
  return [titel, wann, route, laeuft].filter(Boolean).join(' · ');
}

function beschrifteTage(s: Seite): void {
  const titel = [...$('st-tage')!.querySelectorAll<HTMLElement>('details > summary')];
  const nummern = tagNummern(s);
  s.spuren.forEach((sp, i) => { const t = titel[i]; if (t) t.textContent = tagTitel(sp, nummern[i], i); });
}

function zeigeTage(s: Seite): void {
  const liste = $('st-tage')!;
  $('st-tage-bereich')!.hidden = s.spuren.length === 0;

  const offen = new Set([...liste.querySelectorAll<HTMLDetailsElement>('details[open]')].map((d) => d.dataset.fahrt));
  const nummern = tagNummern(s);
  liste.replaceChildren(...s.spuren.map((sp, i) => {
    const d = document.createElement('details');
    d.dataset.fahrt = sp.fahrtId;
    const titel = document.createElement('summary');
    titel.textContent = tagTitel(sp, nummern[i], i);
    const inhalt = document.createElement('div');
    inhalt.className = 'st-tag-inhalt';
    d.append(titel, inhalt);
    const lade = async () => {
      if (inhalt.dataset.geladen) { const t = tageCache.get(sp.fahrtId); if (t) hebeHervor(t); return; }
      inhalt.textContent = wort('tagLaedt');
      const tag = await holeTag(sp);
      if (!tag) { inhalt.textContent = wort('tagFehler'); return; }
      inhalt.dataset.geladen = '1';
      beschrifteTage(s);
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = 'st-knopf';
      knopf.textContent = wort('aufKarte');
      knopf.addEventListener('click', () => { hebeHervor(tag); $('st-karte')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      const tagFotos = fotoRaster(fotosAm(tagIn(fahrtagZeit(tag.fahrt.begonnen, tag.eintraege, tag.punkte), tag.fahrt.zeitzone), tag.fahrt.zeitzone), tag.fahrt.zeitzone);
      inhalt.replaceChildren(knopf, ...(tagFotos ? [tagFotos] : []), logListe(tag.eintraege, tag.fahrt.zeitzone));
      zeigeUebrigeFotos();
      hebeHervor(tag);
    };
    d.addEventListener('toggle', () => { if (d.open) void lade(); });
    if (offen.has(sp.fahrtId)) { d.open = true; }
    return d;
  }));
}

async function zeichneAlleTage(s: Seite): Promise<Tag[]> {
  ebeneTage.clearLayers();
  const tage = (await Promise.all(s.spuren.map((sp) => holeTag(sp)))).filter((t): t is Tag => t !== null);
  for (const t of tage) zeichneSpur(ebeneTage, t.punkte, t.eintraege, t.fahrt.zeitzone, false);
  return tage.sort((a, b) => a.fahrt.begonnen - b.fahrt.begonnen);
}

const LIEGE_EINTRAEGE = new Set(['anlegen', 'ankern', 'treiben']);

const GLEICHER_PLATZ_M = 200;

interface Platz { lat: number; lon: number; nacht: boolean; name: string; zeilen: string[] }

function zeichneOrte(tage: Tag[], live: Live | null, beendet: boolean): void {
  ebeneOrte.clearLayers();
  if (!karte) return;
  const plaetze: Platz[] = [];
  const dazu = (lat: number, lon: number, nacht: boolean, name: string, zeile: string) => {
    const da = plaetze.find((p) => Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos((lat * Math.PI) / 180)) * 60 * 1852 < GLEICHER_PLATZ_M);
    if (!da) { plaetze.push({ lat, lon, nacht, name, zeilen: [zeile] }); return; }
    da.nacht ||= nacht;
    da.name ||= name;
    da.zeilen.push(zeile);
  };
  tage.forEach((tag, i) => {
    const zone = tag.fahrt.zeitzone;
    for (const o of tag.orte) {
      if (o.art !== 'pause' || o.lat == null || o.lon == null || o.t == null) continue;
      dazu(o.lat, o.lon, false, o.name ? lateinisch(o.name) : '', `${wort('ort.pause')} · ${datum(o.t, zone)} ${uhrzeit(o.t, zone)}`);
    }
    const ziel = tag.orte.filter((o) => o.art === 'ziel' && o.lat != null && o.lon != null).pop();
    const letzter = tag.punkte[tag.punkte.length - 1];
    const lat = ziel?.lat ?? letzter?.[1];
    const lon = ziel?.lon ?? letzter?.[2];
    const t = ziel?.t ?? letzter?.[0] ?? tag.fahrt.beendet;
    if (lat == null || lon == null || t == null) return;
    const naechster = tage[i + 1]?.fahrt.begonnen ?? live?.fahrt.begonnen;
    const ankunft = beendet && naechster == null;
    const nacht = !ankunft && (naechster == null || tagIn(naechster, zone) !== tagIn(t, zone));
    const art = ankunft ? wort('ort.ankunft') : nacht ? wort('ort.nacht') : wort('ort.pause');
    dazu(lat, lon, nacht, ziel?.name ? lateinisch(ziel.name) : '',
      `${art} · ${datum(t, zone)} ${uhrzeit(t, zone)} · ${lageText(lageNachTag(tag.eintraege), tag.eintraege)}`);
  });
  if (live) {
    const zone = live.fahrt.zeitzone;
    for (const e of live.eintraege) {
      if (!LIEGE_EINTRAEGE.has(e.art) || e.lat == null || e.lon == null) continue;
      dazu(e.lat, e.lon, false, eintragInhalt(e.art, e.text, sprache),
        `${eintragArtName(e.art, sprache, e.liegeart)} · ${datum(e.t, zone)} ${uhrzeit(e.t, zone)}`);
    }
  }
  for (const p of plaetze) {
    const name = p.name || positionText(p.lat, p.lon, sprache);
    const icon = L.divIcon({ className: `st-ort${p.nacht ? ' st-ort-nacht' : ''}`, html: '<span aria-hidden="true"></span>',
      iconSize: p.nacht ? [16, 16] : [12, 12] });
    L.marker([p.lat, p.lon], { icon, keyboard: false, title: name })
      .bindPopup(`<b>${escapeHtml(name)}</b><br>${p.zeilen.map(escapeHtml).join('<br>')}`)
      .addTo(ebeneOrte);
  }
}

function zeigeUebrigeFotos(): void {
  const bereich = $('st-fotos-bereich')!;
  const ziel = $('st-fotos-uebrig')!;
  const rest = alleFotos.filter((f) => !gezeigteFotos.has(f.id));
  bereich.hidden = rest.length === 0;
  const tage = new Map<string, CrewFoto[]>();
  for (const f of rest) tage.set(tagIn(f.t), [...(tage.get(tagIn(f.t)) ?? []), f]);
  ziel.replaceChildren(...[...tage.entries()].sort(([a], [b]) => b.localeCompare(a)).flatMap(([, fotos]) => {
    const kopf = document.createElement('h3');
    kopf.textContent = datum(fotos[0]!.t);
    const raster = fotoRaster(fotos);
    for (const f of fotos) gezeigteFotos.delete(f.id);
    return raster ? [kopf, raster] : [kopf];
  }));
}

const ebeneFotos = L.layerGroup();

function zeichneFotos(): void {
  ebeneFotos.clearLayers();
  if (!karte) return;
  ebeneFotos.addTo(karte);
  for (const f of alleFotos) {
    if (f.lat === null || f.lon === null) continue;
    L.marker([f.lat, f.lon], { icon: L.divIcon({ className: 'st-foto-marke', html: '<span aria-hidden="true">📷</span>', iconSize: [24, 24], iconAnchor: [12, 12] }), keyboard: false })
      .bindTooltip(`${uhrzeit(f.t)}${f.text ? ` · ${escapeHtml(f.text)}` : ''}`)
      .on('click', () => window.open(api(`/foto/${encodeURIComponent(f.id)}`), '_blank', 'noopener'))
      .addTo(ebeneFotos);
  }
}

let ersterAufbau = true;

let zoomVoll = true;

let tageMeilen: { id: string; m: Meilen }[] = [];

function zeigeMeilen(live: Live | null): void {

  const tage = tageMeilen.filter((t) => t.id !== live?.fahrt.id).map((t) => t.m);
  const m = addiere(...tage, ...(live ? [meilenEinesTages(ohneSpruenge(live.punkte), live.eintraege, live.stand.streckeNM)] : []));
  const zeile = $('st-meilen')!;
  zeile.hidden = m.gesamtNM <= 0;
  const sm = (x: number) => `${nf(x, 1, sprache)} ${wort('sm')}`;

  const teil = (x: number, s: string, farbe: string) => `<span class="st-meilen-teil" style="--farbe:${farbe}">`
    + `<i aria-hidden="true"></i><b>${escapeHtml(sm(x))}</b> ${escapeHtml(wort(s))}</span>`;
  zeile.setAttribute('aria-label', wort('meilen.label', { g: sm(m.gesamtNM), m: sm(m.motorNM), s: sm(m.segelNM) }));
  zeile.innerHTML = `<span class="st-meilen-gesamt">${escapeHtml(sm(m.gesamtNM))}<small>${escapeHtml(wort('meilen.gesamt'))}</small></span>`
    + teil(m.segelNM, 'meilen.segel', SPURFARBE.segel) + teil(m.motorNM, 'meilen.motor', SPURFARBE.motor)
    + (m.offenNM >= 0.05 ? teil(m.offenNM, 'meilen.offen', SPURFARBE.offen) : '');
}

const WETTER_MS = 30 * 60_000;
const WETTER_SM = 2;
let wetter: { w: Stundenwetter; t: number; lat: number; lon: number } | null = null;
let wetterLaedt = false;

async function zeigeWetter(pos: [number, number] | null): Promise<void> {
  const kachel = $('st-wetter')!;
  if (!pos) { kachel.hidden = true; return; }
  const frisch = wetter && Date.now() - wetter.t < WETTER_MS && distNM(wetter.lat, wetter.lon, pos[0], pos[1]) <= WETTER_SM
    && wetterZurStunde(wetter.w, Date.now());
  if (!frisch && !wetterLaedt) {
    wetterLaedt = true;
    const w = await holeStundenwetter(pos[0], pos[1]);
    wetterLaedt = false;
    if (w) wetter = { w, t: Date.now(), lat: pos[0], lon: pos[1] };
  }
  const jetzt = wetter ? wetterZurStunde(wetter.w, Date.now()) : null;
  kachel.hidden = !jetzt;
  if (jetzt) kachel.innerHTML = wetterKachel(jetzt, sprache);
}

let aktuellesLive: Live | null = null;
let laedt = false;

async function lade(): Promise<void> {
  if (laedt) return;
  laedt = true;
  try { await ladeSeite(); } finally { laedt = false; }
}

async function ladeSeite(): Promise<void> {
  const meldung = $('st-meldung')!;
  if (!token) { meldung.textContent = wort('nichtFrei'); return; }
  let roh: Seite;
  try {
    const r = await fetch(api(''));
    if (r.status === 404) { meldung.textContent = wort('nichtFrei'); $('st-inhalt')!.hidden = true; return; }

    if (r.status === 410) {
      const bis = ((await r.json().catch(() => ({}))) as { bis?: string }).bis;
      const zeit = bis ? datumUhrLtVon(Date.parse(bis), sprache === 'de' ? 'de' : 'en', { weekday: 'short', day: 'numeric', month: 'numeric' }) : '';
      meldung.textContent = zeit ? wort('abgelaufen', { zeit }) : wort('abgelaufenOhne');
      $('st-inhalt')!.hidden = true;
      $('st-kommentieren')?.setAttribute('hidden', '');
      return;
    }
    if (!r.ok) throw new Error(String(r.status));
    roh = (await r.json()) as Seite;
  } catch {
    if (ersterAufbau) meldung.textContent = wort('fehler');
    return;
  }
  meldung.textContent = '';
  $('st-inhalt')!.hidden = false;

  const live = roh.live.length ? [...roh.live].sort((a, b) => b.stand.t - a.stand.t)[0]! : null;

  mitSpur = new Set(roh.spuren.map((sp) => sp.fahrtId));
  fruehereLive = new Map(roh.live.filter((l) => l !== live).map((l) => [l.fahrt.id, l]));
  const ohneSpur = [...fruehereLive.values()].filter((l) => !mitSpur.has(l.fahrt.id))
    .map((l) => ({ fahrtId: l.fahrt.id, beginn: l.fahrt.begonnen, ende: l.stand.t }));
  const spuren = [...roh.spuren, ...ohneSpur].sort((a, b) => (a.beginn ?? 0) - (b.beginn ?? 0));
  const s: Seite = { ...roh, spuren: live ? spuren.filter((sp) => sp.fahrtId !== live.fahrt.id) : spuren };
  zeigeToern(s);
  alleFotos = s.fotos ?? [];
  gezeigteFotos.clear();
  aktuellesLive = live;
  const hatAufzeichnung = live !== null || s.spuren.length > 0;
  $('st-keine')!.hidden = hatAufzeichnung;
  $('st-karte-bereich')!.hidden = !hatAufzeichnung;
  zeigeAktuell(live);
  zeigeKopf(s, [...tageCache.values()].filter((t) => t.fahrt.id !== live?.fahrt.id).sort((a, b) => a.fahrt.begonnen - b.fahrt.begonnen), live);

  const sTage: Seite = live
    ? { ...s, spuren: [...s.spuren, { fahrtId: live.fahrt.id, beginn: live.fahrt.begonnen, ende: live.stand.t }] }
    : s;
  zeigeTage(sTage);
  zeigeUebrigeFotos();
  if (!hatAufzeichnung) return;
  const k = baueKarte();
  k.invalidateSize();
  zeichneLive(live);
  zeichneFotos();
  const tage = await zeichneAlleTage(s);
  beschrifteTage(sTage);

  tageMeilen = tage.map((t) => ({
    id: t.fahrt.id,
    m: meilenEinesTages(ohneSpruenge(t.punkte), t.eintraege, fruehereLive.get(t.fahrt.id)?.stand.streckeNM ?? t.fahrt.streckeNM ?? null),
  }));
  zeigeMeilen(live);
  zeichneOrte(tage, live, !!s.toern.beendet);
  let ruhend: Punkt3 | null = null;
  if (!live && !s.toern.beendet && tage.length) {
    const tag = tage[tage.length - 1]!;
    zeichneLetztenTag(tag);
    ruhend = tag.punkte[tag.punkte.length - 1] ?? null;
  }

  yachtPos = live ? [live.stand.lat, live.stand.lon] : ruhend ? [ruhend[1], ruhend[2]] : null;
  void zeigeWetter(yachtPos);
  zeigeZurYacht();
  zeigeKopf(s, tage, live);
  if (yachtPos && zoomVoll) {
    setzeFolgen(true);
    k.setView(yachtPos, yachtZoom(k));
  } else if (yachtPos && !ersterAufbau && folgeYacht) k.panTo(yachtPos);
  else if (ersterAufbau) {
    const grenzen = L.featureGroup([...ebeneTage.getLayers(), ...ebeneLive.getLayers()] as L.Layer[]).getBounds();
    if (grenzen.isValid()) k.fitBounds(grenzen, { padding: [24, 24] });
  }
  zoomVoll = false;
  ersterAufbau = false;
}

interface StandAntwort {
  live: { fahrtId: string; stand: Stand; punkte: Punkt3[]; eintraege: { anzahl: number; letzter: number } } | null;
}

async function holeStand(): Promise<void> {
  if (laedt || document.hidden || !token) return;
  const bisher = aktuellesLive;
  const seit = bisher?.punkte[bisher.punkte.length - 1]?.[0];
  let a: StandAntwort;
  try {
    const r = await fetch(api(`/stand${seit != null ? `?seit=${seit}` : ''}`));
    if (r.status === 410) { void lade(); return; }
    if (!r.ok) return;
    a = (await r.json()) as StandAntwort;
  } catch {
    return;
  }
  if (laedt || aktuellesLive !== bisher) return;
  const neu = a.live;
  if (!neu && !bisher) return;
  if (!neu || !bisher || neu.fahrtId !== bisher.fahrt.id) { void lade(); return; }
  const letzterBekannt = bisher.eintraege.reduce((m, e) => Math.max(m, e.t), 0);
  if (neu.eintraege.anzahl !== bisher.eintraege.length || neu.eintraege.letzter !== letzterBekannt) { void lade(); return; }
  if (neu.stand.t === bisher.stand.t && !neu.punkte.length) { zeigeAktuell(bisher); setzeNacht(nachtPos(bisher), bisher.fahrt.zeitzone); return; }
  const ende = bisher.punkte[bisher.punkte.length - 1]?.[0] ?? -Infinity;
  bisher.punkte.push(...neu.punkte.filter((p) => p[0] > ende));
  bisher.stand = neu.stand;
  zeigeAktuell(bisher);
  zeichneLive(bisher);
  zeigeMeilen(bisher);
  yachtPos = [neu.stand.lat, neu.stand.lon];
  if (karte && folgeYacht) {
    if (gezoomtUnterwegs !== null && istUnterwegs() !== gezoomtUnterwegs) karte.setView(yachtPos, yachtZoom(karte));
    else karte.panTo(yachtPos);
  }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) void holeStand(); });

const kommentare = initKommentare({ api, wort, sprache });
$('st-neu')?.addEventListener('click', () => { zoomVoll = true; void lade(); void kommentare.lade(); });
$('st-neu')!.textContent = wort('aktualisieren');
for (const el of document.querySelectorAll<HTMLElement>('[data-st]')) el.textContent = wort(el.dataset.st!);
$('st-meldung')!.textContent = wort('laedt');
void lade();
if (token) void kommentare.lade();
setInterval(() => { void lade(); if (token) void kommentare.lade(); }, NEU_LADEN_MS);
setInterval(() => void holeStand(), STAND_MS);
