import L from 'leaflet';
import { karteObjekt, seezeichenAn } from './karte';
import { ladeUmgebungFuer, umgebungLokal } from '@/data/umgebung';
import { gefahrenImGebiet } from '@/data/navroute';
import { distNM } from '@/core/geo';
import type { Gefahr } from '@/core/navigation';
import type { Punkt } from '@/core/types';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { STRINGS } from './strings';
import { GEFAHR_TYPEN, TONNEN_TYPEN, diensteVon } from '@/briefing/seezeichenText';

const PANE = 'tbObjekte';
export const OBJEKTE_ZOOM_AB = 12;

const HAFEN_ZOOM_AB = 11;
const TREFFER_PX = 44;

const DIENSTE_M = 500;

type Tags = Readonly<Record<string, string>>;
type Element = readonly [number, number, Tags];
export type KartenObjekt =
  | { art: 'tonne'; lat: number; lon: number; tags: Tags }
  | { art: 'gefahr'; lat: number; lon: number; gefahr: Gefahr }
  | { art: 'hafen'; lat: number; lon: number; tags: Tags; dienste: string[] }
  | { art: 'tankstelle'; lat: number; lon: number; tags: Tags };

let gruppe: L.LayerGroup | null = null;
let gebunden = false;
let online: () => boolean = () => navigator.onLine;
let gefahren: Gefahr[] = [];
let geplant = 0;

let lauf = 0;

const istTonne = (t: Tags) => TONNEN_TYPEN.includes(t['seamark:type'] ?? '');
const istTankstelle = (t: Tags) => t['waterway'] === 'fuel' || (t['seamark:small_craft_facility:category'] ?? '').split(';').includes('fuel_station')
  || (t['amenity'] === 'fuel' && !!t['seamark:type']);
const istHafen = (t: Tags) => t['leisure'] === 'marina' || t['seamark:type'] === 'harbour';
const eigeneSymbole = () => !seezeichenAn() || !online();

async function paketAn(p: Punkt) {
  return await umgebungLokal(p, 0).catch(() => null) ?? (online() ? await ladeUmgebungFuer(p).catch(() => null) : null);
}

export function initKartenObjekte(netz: () => boolean): void {
  online = netz;
  const k = karteObjekt();
  if (!k || gebunden) return;
  gebunden = true;
  if (!k.getPane(PANE)) k.createPane(PANE).style.zIndex = '254';
  gruppe = L.layerGroup().addTo(k);
  luecke = lueckeAnlegen(k);
  k.on('moveend zoomend', bald);
  k.on('layeradd layerremove', bald);
  bald();
}

let luecke: HTMLElement | null = null;
function lueckeAnlegen(k: L.Map): HTMLElement {
  const el = L.DomUtil.create('div', 'tb-gefahr-luecke');
  el.hidden = true;
  el.setAttribute('role', 'status');
  const beschrifte = () => { el.textContent = STRINGS[aktuelleSprache()]['karte.gefahrenLuecke'] ?? ''; };
  beschrifte();
  aufSprachwechsel(beschrifte);
  const Hinweis = L.Control.extend({ onAdd: () => el });
  new Hinweis({ position: 'bottomleft' }).addTo(k);
  return el;
}

function bald(): void {
  if (geplant) return;
  geplant = window.setTimeout(() => { geplant = 0; void zeichne(); }, 200);
}

const IALA_A: Record<string, string> = {
  port: 'red', starboard: 'green', preferred_channel_port: 'green;red;green', preferred_channel_starboard: 'red;green;red',
  north: 'black;yellow', east: 'black;yellow;black', south: 'yellow;black', west: 'yellow;black;yellow',
  isolated_danger: 'black;red;black', safe_water: 'red;white', special_purpose: 'yellow',
};

function tonneSvg(t: Tags): string {
  const typ = t['seamark:type'] ?? '';
  const farben = (t[`seamark:${typ}:colour`] ?? IALA_A[t[`seamark:${typ}:category`] ?? typ.replace(/^(buoy|beacon)_/, '')] ?? 'grey').split(';').map((x) => x.trim());
  const css: Record<string, string> = { red: '#D3302F', green: '#1E9E4A', yellow: '#F2C318', black: '#1A1A1A', white: '#FFFFFF', orange: '#F08A1C', grey: '#8A979E' };
  const bake = typ.startsWith('beacon_');
  const b = bake ? 4 : 8, x = (12 - b) / 2, oben = 6, h = 12;
  const senkrecht = t[`seamark:${typ}:colour_pattern`] === 'vertical' || (!t[`seamark:${typ}:colour`] && typ.endsWith('safe_water'));
  const baender = farben.map((f, i) => (senkrecht
    ? `<rect x="${x + (b / farben.length) * i}" y="${oben}" width="${b / farben.length}" height="${h}" fill="${css[f] ?? '#8A979E'}"/>`
    : `<rect x="${x}" y="${oben + (h / farben.length) * i}" width="${b}" height="${h / farben.length}" fill="${css[f] ?? '#8A979E'}"/>`)).join('');
  const topp = t['seamark:topmark:shape'] ?? '';
  const k = '#1A1A1A';
  const toppSvg = topp === '2 cones up' ? `<path d="M3 4 6 0 9 4ZM3 6 6 2 9 6Z" fill="${k}"/>`
    : topp === '2 cones down' ? `<path d="M3 0h6L6 4ZM3 2h6L6 6Z" fill="${k}"/>`
      : topp === '2 cones base together' ? `<path d="M6 0 9 3 6 6 3 3Z" fill="${k}"/>`
        : topp === '2 cones point together' ? `<path d="M3 0h6L6 3ZM6 3 9 6H3Z" fill="${k}"/>`
          : topp === '2 spheres' ? `<circle cx="6" cy="1.5" r="1.5" fill="${k}"/><circle cx="6" cy="4.5" r="1.5" fill="${k}"/>`
            : topp === 'sphere' ? `<circle cx="6" cy="3" r="2.2" fill="${css[(t['seamark:topmark:colour'] ?? 'red').split(';')[0]!] ?? k}"/>`
              : topp === 'x-shape' ? `<path d="M3.5 1 8.5 6M8.5 1 3.5 6" stroke="${css['yellow']}" stroke-width="1.6"/>`
                : topp === 'cone, point up' ? `<path d="M3.5 6 6 1 8.5 6Z" fill="${css['green']}"/>`
                  : topp === 'cylinder' ? `<rect x="3.5" y="1.5" width="5" height="4.5" fill="${css['red']}"/>` : '';
  return `<svg viewBox="0 0 12 18" width="14" height="21" aria-hidden="true">${toppSvg}<g stroke="#0B1E2D" stroke-width=".6">${baender}</g>`
    + `<rect x="${x}" y="${oben}" width="${b}" height="${h}" fill="none" stroke="#0B1E2D" stroke-width=".8"/></svg>`;
}

function gefahrSvg(g: Gefahr): string {
  const stand = g.merkmale?.[`seamark:${g.art}:water_level`] ?? '';
  if (g.art === 'rock') {
    return /^(submerged|always_under_water|below_mwl)$/.test(stand)
      ? '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2v12M2 8h12" stroke="#0B1E2D" stroke-width="1.6"/></svg>'
      : '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" stroke="#0B1E2D" stroke-width="1.5"/></svg>';
  }
  if (g.art === 'wreck') {
    return '<svg viewBox="0 0 20 14" width="20" height="14" aria-hidden="true"><path d="M1 7h18M6 3v8M10 2v10M14 3v8" stroke="#0B1E2D" stroke-width="1.5"/></svg>';
  }
  return '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="rgba(11,30,45,.08)" stroke="#0B1E2D" stroke-width="1.4" stroke-dasharray="2 2"/></svg>';
}

const TANK_SVG = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="8" fill="#D9861C" stroke="#fff" stroke-width="1.4"/>'
  + '<path d="M5.5 13V5h5v8M5.5 8h5M10.5 6l2 2v4" fill="none" stroke="#0B1E2D" stroke-width="1.3"/></svg>';

function marke(lat: number, lon: number, html: string, klasse: string, w: number, h: number): void {
  L.marker([lat, lon], {
    pane: PANE, interactive: false, keyboard: false,
    icon: L.divIcon({ className: `tb-objekt ${klasse}`, html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] }),
  }).addTo(gruppe!);
}

async function zeichne(): Promise<void> {
  const k = karteObjekt();
  if (!k || !gruppe) return;
  const nr = ++lauf;
  gruppe.clearLayers();
  if (k.getZoom() < OBJEKTE_ZOOM_AB) { if (luecke) luecke.hidden = true; return; }
  const sicht = k.getBounds().pad(0.1);
  const box = { swLat: sicht.getSouth(), swLon: sicht.getWest(), neLat: sicht.getNorth(), neLon: sicht.getEast() };
  const c = k.getCenter();
  const [paket, gef] = await Promise.all([
    paketAn({ lat: c.lat, lon: c.lng }),
    gefahrenImGebiet(box, !online()).catch(() => ({ gefahren: [] as Gefahr[], unvollstaendig: true })),
  ]);
  if (nr !== lauf) return;
  gefahren = gef.gefahren;
  if (luecke) luecke.hidden = !(gef.unvollstaendig && eigeneSymbole() && k.getZoom() >= OBJEKTE_ZOOM_AB);
  if (!eigeneSymbole() || k.getZoom() < OBJEKTE_ZOOM_AB) return;
  gruppe.clearLayers();
  for (const g of gefahren) marke(g.lat, g.lon, gefahrSvg(g), `gefahr ${g.art}`, 20, 18);
  for (const [lat, lon, t] of (paket?.elemente ?? []) as readonly Element[]) {
    if (!sicht.contains([lat, lon])) continue;
    if (istTonne(t)) marke(lat, lon, tonneSvg(t), 'tonne', 14, 21);
    else if (istTankstelle(t)) marke(lat, lon, TANK_SVG, 'tankstelle', 18, 18);
  }
}

export async function objektAm(k: L.Map, ll: L.LatLng, client: { x: number; y: number } | null): Promise<KartenObjekt | null> {
  const z = k.getZoom();
  if (z < HAFEN_ZOOM_AB) return null;
  let ziel = ll;
  if (client) {

    const trifft = (r: DOMRect) => r.width > 0 && client.x >= r.left - 6 && client.x <= r.right + 6 && client.y >= r.top - 6 && client.y <= r.bottom + 6;
    for (const el of k.getContainer().querySelectorAll<HTMLElement>('.tb-kn[data-lat]')) {
      if ([el, ...el.querySelectorAll<HTMLElement>('*')].some((x) => trifft(x.getBoundingClientRect()))) {
        ziel = L.latLng(Number(el.dataset['lat']), Number(el.dataset['lon']));
        break;
      }
    }
  }
  const p0 = k.latLngToContainerPoint(ziel);
  const paket = await paketAn({ lat: ziel.lat, lon: ziel.lng });
  let bestes: KartenObjekt | null = null;
  let bestD = TREFFER_PX;
  const pruefe = (o: KartenObjekt) => {
    const d = k.latLngToContainerPoint([o.lat, o.lon]).distanceTo(p0);
    if (d <= bestD) { bestD = d; bestes = o; }
  };
  const elemente = (paket?.elemente ?? []) as readonly Element[];
  for (const [lat, lon, tags] of elemente) {
    if (z >= OBJEKTE_ZOOM_AB && istTonne(tags)) pruefe({ art: 'tonne', lat, lon, tags });
    else if (z >= OBJEKTE_ZOOM_AB && istTankstelle(tags) && !istHafen(tags)) pruefe({ art: 'tankstelle', lat, lon, tags });
    else if (istHafen(tags)) pruefe({ art: 'hafen', lat, lon, tags, dienste: [] });
  }
  if (z >= OBJEKTE_ZOOM_AB) {

    const d = 0.01;
    const um = gefahren.length ? gefahren
      : (await gefahrenImGebiet({ swLat: ziel.lat - d, swLon: ziel.lng - d, neLat: ziel.lat + d, neLon: ziel.lng + d }, !online()).catch(() => null))?.gefahren ?? [];
    for (const g of um) if (GEFAHR_TYPEN.includes(g.art)) pruefe({ art: 'gefahr', lat: g.lat, lon: g.lon, gefahr: g });
  }
  const o = bestes as KartenObjekt | null;
  if (o?.art === 'hafen') {
    const dienste = new Set<string>();
    for (const [lat, lon, tags] of elemente) {
      if (distNM(o.lat, o.lon, lat, lon) * 1852 <= DIENSTE_M) for (const x of diensteVon(tags)) dienste.add(x);
    }
    o.dienste = [...dienste];
  }
  return o;
}
