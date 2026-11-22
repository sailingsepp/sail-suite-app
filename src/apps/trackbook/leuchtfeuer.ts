import L from 'leaflet';
import { karteObjekt, seezeichenAn } from './karte';
import { bearingDeg } from '@/core/geo';
import type { Punkt } from '@/core/types';
import { feuerAusTags, istFeuer, imSektor, sichtbarerSektor, verdunkelt, taktSchluessel, type Feuer, type FeuerFarbe, type Sektor } from '@/core/leuchtfeuer';
import { umgebungLokal, ladeUmgebungFuer } from '@/data/umgebung';
import type { UmgebungPaket } from '@/core/umgebung';
import { escapeHtml } from '@/core/html';


const PANE = 'tbFeuer';

const ZOOM_AB = 10;

const TEXT_ALLE_AB = 13;
const TEXT_GROSS_AB = 11;
const HOECHSTENS = 300;
const NACHLADEN_PAUSE_MS = 10 * 60_000;

const FARBE: Record<FeuerFarbe, string> = {
  red: '#FF3B30', green: '#30D158', white: '#FFFFFF', yellow: '#FFD60A', orange: '#FF9F0A', blue: '#64D2FF', violet: '#BF5AF2',
};

const VERDUNKELT = '#8A939A';

let gruppe: L.LayerGroup | null = null;
let gebunden = false;
let stil: HTMLStyleElement | null = null;
const animationen = new Map<string, string>();
const feuerJeRevier = new Map<string, Feuer[]>();
let boot: () => Punkt | null = () => null;
let online: () => boolean = () => false;
let nachladenAb = 0;
let laedt = false;

export interface FeuerPlatz { lat: number; lon: number; text: string | null; seite: 'rechts' | 'links' | null }
let plaetze: FeuerPlatz[] = [];
const nachZeichnen: (() => void)[] = [];
export function feuerPlaetze(): readonly FeuerPlatz[] { return plaetze; }
export function beiFeuerGezeichnet(cb: () => void): void { nachZeichnen.push(cb); }
function gezeichnet(neu: FeuerPlatz[]): void {
  const vorher = plaetze;
  plaetze = neu;
  if (vorher.length || neu.length) for (const cb of nachZeichnen) cb();
}

const aktiv = () => {
  const h = document.documentElement;
  return h.classList.contains('nav-an') && h.getAttribute('data-theme') === 'nacht';
};
const ruhig = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;


function animation(s: Sektor): string {
  const k = taktSchluessel(s);
  const da = animationen.get(k);
  if (da) return da;
  const name = `tb-feuer-${animationen.size}`;
  let t = 0;
  const schritte: string[] = [];
  for (const x of s.takte) {
    const pct = (t / s.periode) * 100;
    schritte.push(`${pct.toFixed(3)}%{opacity:${x.h};color:${FARBE[x.farbe]}}`);
    t += x.s;
  }
  const erster = s.takte[0]!;
  schritte.push(`100%{opacity:${erster.h};color:${FARBE[erster.farbe]}}`);
  if (!stil) { stil = document.createElement('style'); stil.id = 'tb-feuer-takte'; document.head.appendChild(stil); }
  stil.appendChild(document.createTextNode(`@keyframes ${name}{${schritte.join('')}}\n`));
  animationen.set(k, name);
  return name;
}

function feuerAus(p: UmgebungPaket): Feuer[] {
  const da = feuerJeRevier.get(`${p.revier}|${p.erstellt}`);
  if (da) return da;
  const f: Feuer[] = [];
  
  
  const gesehen = new Set<string>();
  for (const [lat, lon, tags] of p.elemente) {
    if (!tags['seamark:light:character'] && !tags['seamark:light:1:character']) continue;
    const x = feuerAusTags(lat, lon, tags);
    if (!x) continue;
    const k = `${lat.toFixed(5)},${lon.toFixed(5)},${x.sektoren.map((s) => s.kennung).join('/')}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    f.push(x);
  }
  feuerJeRevier.set(`${p.revier}|${p.erstellt}`, f);
  return f;
}


interface FeuerOhne { lat: number; lon: number; farbe: FeuerFarbe | null; gross: boolean }
const ohneJeRevier = new Map<string, FeuerOhne[]>();
function feuerOhneKennung(p: UmgebungPaket): FeuerOhne[] {
  const da = ohneJeRevier.get(`${p.revier}|${p.erstellt}`);
  if (da) return da;
  const f: FeuerOhne[] = [];
  const gesehen = new Set<string>();
  for (const [lat, lon, tags] of p.elemente) {
    if (!istFeuer(tags) || feuerAusTags(lat, lon, tags)) continue;
    const k = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    const roh = (tags['seamark:light:colour'] ?? tags['seamark:light:1:colour'] ?? '').split(/[;,]/)[0]!.trim().toLowerCase();
    const farbe = (roh in FARBE ? roh : null) as FeuerFarbe | null;
    f.push({ lat, lon, farbe, gross: tags['seamark:type'] === 'light_major' || tags['man_made'] === 'lighthouse' });
  }
  ohneJeRevier.set(`${p.revier}|${p.erstellt}`, f);
  return f;
}


const phase = (f: Feuer, periode: number) => (((Math.abs(Math.sin(f.lat * 12.9898 + f.lon * 78.233)) * 43758.5453) % 1) * periode);

async function zeichne(): Promise<void> {
  const k = karteObjekt();
  if (!k || !gruppe) return;
  if (!aktiv() || k.getZoom() < ZOOM_AB) { gruppe.clearLayers(); gezeichnet([]); return; }
  const mitte = k.getCenter();
  const punkt = { lat: mitte.lat, lon: mitte.lng };
  let paket = await umgebungLokal(punkt, 0).catch(() => null);
  if (!paket && online() && !laedt && Date.now() >= nachladenAb) {
    laedt = true;
    nachladenAb = Date.now() + NACHLADEN_PAUSE_MS;
    paket = await ladeUmgebungFuer(punkt).catch(() => null);
    laedt = false;
  }
  gruppe.clearLayers();
  if (!paket || !aktiv()) { gezeichnet([]); return; }
  const sicht = k.getBounds().pad(0.1);
  const b = boot();
  const imBild = feuerAus(paket).filter((f) => sicht.contains([f.lat, f.lon]))
    .sort((a, c) => Number(c.gross) - Number(a.gross)).slice(0, HOECHSTENS);
  const still = ruhig();
  const zoom = k.getZoom();
  
  
  const kaesten: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const frei = (b: { x0: number; y0: number; x1: number; y1: number }) =>
    kaesten.every((a) => b.x1 < a.x0 || b.x0 > a.x1 || b.y1 < a.y0 || b.y0 > a.y1);
  const textSeite = (f: Feuer, text: string): 'rechts' | 'links' | null => {
    if (!(zoom >= TEXT_ALLE_AB || (f.gross && zoom >= TEXT_GROSS_AB))) return null;
    const p = k.latLngToContainerPoint([f.lat, f.lon]);
    const breite = text.length * 8.6 + 12;
    const rechts = { x0: p.x + 10, y0: p.y - 10, x1: p.x + 10 + breite, y1: p.y + 10 };
    const links = { x0: p.x - 10 - breite, y0: p.y - 10, x1: p.x - 10, y1: p.y + 10 };
    if (frei(rechts)) { kaesten.push(rechts); return 'rechts'; }
    if (frei(links)) { kaesten.push(links); return 'links'; }
    return null;
  };
  const neu: FeuerPlatz[] = [];
  for (const f of imBild) {
    const s = sichtbarerSektor(f, b);
    
    
    if (verdunkelt(f, b)) {
      L.marker([f.lat, f.lon], {
        pane: PANE, interactive: false, keyboard: false,
        icon: L.divIcon({ className: `tb-feuer ohne${f.gross ? ' gross' : ''}`, iconSize: [14, 14], iconAnchor: [7, 7], html: `<span style="color:${VERDUNKELT}" title="${escapeHtml(s.kennung)}"></span>` }),
      }).addTo(gruppe);
      continue;
    }
    
    
    
    const anim = still ? '' : `animation:${animation(s)} ${s.periode.toFixed(3)}s step-end ${(-phase(f, s.periode)).toFixed(2)}s infinite;`;
    const farbe = FARBE[s.takte.find((t) => t.h > 0)?.farbe ?? s.farben[0]!];
    const seite = textSeite(f, s.kennung);
    neu.push({ lat: f.lat, lon: f.lon, text: seite ? s.kennung : null, seite });
    L.marker([f.lat, f.lon], {
      pane: PANE, interactive: false, keyboard: false,
      icon: L.divIcon({
        className: `tb-feuer${f.gross ? ' gross' : ''}`, iconSize: [14, 14], iconAnchor: [7, 7],
        html: `<span style="color:${farbe};${anim}" title="${escapeHtml(s.kennung)}"></span>${seite
          ? `<b class="tb-feuer-text${seite === 'links' ? ' links' : ''}" style="color:${farbe}" data-lat="${f.lat}" data-lon="${f.lon}">${escapeHtml(s.kennung)}</b>` : ''}`,
      }),
    }).addTo(gruppe);
  }
  
  
  for (const f of feuerOhneKennung(paket).filter((x) => sicht.contains([x.lat, x.lon])).slice(0, HOECHSTENS)) {
    const farbe = FARBE[f.farbe ?? 'white'];
    L.marker([f.lat, f.lon], {
      pane: PANE, interactive: false, keyboard: false,
      icon: L.divIcon({ className: `tb-feuer ohne${f.gross ? ' gross' : ''}`, iconSize: [14, 14], iconAnchor: [7, 7], html: `<span style="color:${farbe}"></span>` }),
    }).addTo(gruppe);
  }
  gezeichnet(neu);
}

let geplant = 0;
function bald(): void {
  if (geplant) return;
  geplant = window.setTimeout(() => { geplant = 0; void zeichne(); }, 150);
}


export function initLeuchtfeuer(position: () => Punkt | null, netz: () => boolean): void {
  boot = position;
  online = netz;
  const k = karteObjekt();
  if (!k || gebunden) return;
  gebunden = true;
  if (!k.getPane(PANE)) k.createPane(PANE).style.zIndex = '255';
  gruppe = L.layerGroup().addTo(k);
  k.on('moveend zoomend', bald);
  new MutationObserver(bald).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  bald();
}


let zuletztBoot = 0;
export function feuerBootGeaendert(): void {
  if (!aktiv() || Date.now() - zuletztBoot < 30_000) return;
  zuletztBoot = Date.now();
  bald();
}



export const FEUER_TREFFER_PX = 44;

export async function feuerAm(
  k: L.Map, ll: L.LatLng, radiusPx = FEUER_TREFFER_PX, client: { x: number; y: number } | null = null,
): Promise<{ lat: number; lon: number; tags: Readonly<Record<string, string>>; sichtbar: number | null } | null> {
  if (k.getZoom() < ZOOM_AB || !(aktiv() || seezeichenAn())) return null;
  
  const punkt = { lat: ll.lat, lon: ll.lng };
  const paket = await umgebungLokal(punkt, 0).catch(() => null) ?? (online() ? await ladeUmgebungFuer(punkt).catch(() => null) : null);
  if (!paket) return null;
  
  let ziel = ll;
  if (client) {
    for (const el of k.getContainer().querySelectorAll<HTMLElement>('.tb-feuer-text[data-lat]')) {
      const r = el.getBoundingClientRect();
      if (client.x >= r.left - 8 && client.x <= r.right + 8 && client.y >= r.top - 8 && client.y <= r.bottom + 8) {
        ziel = L.latLng(Number(el.dataset['lat']), Number(el.dataset['lon']));
        break;
      }
    }
  }
  const p0 = k.latLngToContainerPoint(ziel);
  let bestes: { lat: number; lon: number; tags: Readonly<Record<string, string>> } | null = null;
  let bestD = radiusPx;
  for (const [lat, lon, tags] of paket.elemente) {
    
    if (!istFeuer(tags)) continue;
    const d = k.latLngToContainerPoint([lat, lon]).distanceTo(p0);
    if (d <= bestD) { bestD = d; bestes = { lat, lon, tags }; }
  }
  if (!bestes) return null;
  const b = boot();
  let sichtbar: number | null = null;
  if (b) {
    const peilung = bearingDeg(b.lat, b.lon, bestes.lat, bestes.lon);
    const t = bestes.tags;
    const nummern = [...new Set(Object.keys(t).map((x) => /^seamark:light:(\d+):/.exec(x)?.[1]).filter((x): x is string => !!x).map(Number))].sort((a, c) => a - c);
    for (const n of nummern) {
      const von = Number(t[`seamark:light:${n}:sector_start`] ?? t['seamark:light:sector_start']);
      const bis = Number(t[`seamark:light:${n}:sector_end`] ?? t['seamark:light:sector_end']);
      if (Number.isFinite(von) && Number.isFinite(bis) && imSektor({ von, bis }, peilung)) { sichtbar = n; break; }
    }
  }
  return { ...bestes, sichtbar };
}
