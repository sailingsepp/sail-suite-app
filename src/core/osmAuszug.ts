import type { OsmRoh } from './umgebung';
import type { Punkt } from './types';
import { istFeuer } from './leuchtfeuer';




export const SEEZEICHEN_TYPEN: readonly string[] = [
  'buoy_lateral', 'buoy_cardinal', 'buoy_isolated_danger', 'buoy_safe_water', 'buoy_special_purpose',
  'beacon_lateral', 'beacon_cardinal', 'beacon_isolated_danger', 'beacon_safe_water', 'beacon_special_purpose',
];


export const OSMIUM_FILTER: readonly string[] = [
  'nwr/leisure=marina',
  'nwr/seamark:type=harbour,anchorage,small_craft_facility,mooring',
  
  'nw/waterway=fuel',
  'nwr/natural=bay',
  
  
  'nw/seamark:light:character',
  'nw/seamark:light:1:character',
  
  'nw/seamark:type=light_major,light_minor,light_float,light_vessel',
  'nw/man_made=lighthouse',
  'nw/seamark:light:colour',
  'nw/seamark:light:1:colour',
  
  `nw/seamark:type=${SEEZEICHEN_TYPEN.join(',')}`,
  'n/place=city,town,village,hamlet',
  'wr/place=island,islet',
  
  'nw/man_made=pier,breakwater,groyne,quay',
  'n/natural=peak',
  
  'wr/landuse=residential,commercial,retail,industrial',
  'w/highway=motorway,trunk,primary,secondary,tertiary',
  
  'nw/natural=cape',
  'nwr/aeroway=aerodrome',
  'wr/aeroway=runway',
  
  
  'n/generator:source=wind',
  'n/seamark:landmark:category',
  
  
  'w/route=ferry',
  'nwr/seamark:type=separation_zone,separation_line,separation_boundary,separation_lane,separation_roundabout,separation_crossing,precautionary_area',
];

type Tags = Readonly<Record<string, string>>;


export function istSeeobjekt(t: Tags): boolean {
  const s = t['seamark:type'];
  return t['leisure'] === 'marina' || t['natural'] === 'bay'
    || s === 'harbour' || s === 'anchorage' || s === 'small_craft_facility' || s === 'mooring'
    || t['waterway'] === 'fuel'
    || istFeuer(t) || SEEZEICHEN_TYPEN.includes(s ?? '');
}

const SIEDLUNG = new Set(['city', 'town', 'village', 'hamlet']);
const INSEL = new Set(['island', 'islet']);


type Pos = [number, number];
export interface Geometrie {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon' | 'MultiLineString' | string;
  coordinates: unknown;
}

function allePunkte(g: Geometrie): Pos[] {
  const out: Pos[] = [];
  const lauf = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') out.push([c[0], c[1]]);
    else if (Array.isArray(c)) for (const x of c) lauf(x);
  };
  lauf(g.coordinates);
  return out;
}


export interface Inselflaeche { name: string; place: 'island' | 'islet'; polygone: Pos[][][] }

function polygoneAus(g: Geometrie): Pos[][][] {
  if (g.type === 'Polygon') return [g.coordinates as Pos[][]];
  if (g.type === 'MultiPolygon') return g.coordinates as Pos[][][];
  
  if (g.type === 'LineString') {
    const r = g.coordinates as Pos[];
    const a = r[0], b = r[r.length - 1];
    if (r.length >= 4 && a && b && a[0] === b[0] && a[1] === b[1]) return [[r]];
  }
  return [];
}

export interface GeoFeature {
  id?: string | number;
  geometry: Geometrie | null;
  properties: Record<string, unknown> | null;
}


export function ausFeature(f: GeoFeature): { element: OsmRoh | null; insel: Inselflaeche | null } {
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.properties ?? {})) {
    if (typeof v === 'string' && !k.startsWith('@')) tags[k] = v;
  }
  if (!f.geometry) return { element: null, insel: null };
  const id = String(f.id ?? '');
  
  
  
  const roh = Number(id.slice(1));
  const flaeche = id[0] === 'a' && Number.isFinite(roh);
  const art = id[0] === 'w' || (flaeche && roh % 2 === 0) ? 'way' : id[0] === 'r' || flaeche ? 'relation' : 'node';
  const nummer = flaeche ? Math.floor(roh / 2) : roh;
  const idTeil = Number.isFinite(nummer) && id.length > 1 ? { id: nummer } : {};
  const place = tags['place'];
  const insel = place && INSEL.has(place) && tags['name']
    ? { name: tags['name'], place: place as 'island' | 'islet', polygone: polygoneAus(f.geometry) }
    : null;
  const gewollt = istSeeobjekt(tags) || (place != null && SIEDLUNG.has(place) && f.geometry.type === 'Point');
  if (!gewollt) return { element: null, insel: insel && insel.polygone.length ? insel : null };
  if (f.geometry.type === 'Point') {
    const [lon, lat] = f.geometry.coordinates as Pos;
    return { element: { type: 'node', ...idTeil, lat, lon, tags }, insel: null };
  }
  const p = allePunkte(f.geometry);
  if (p.length === 0) return { element: null, insel: null };
  let w = Infinity, s = Infinity, o = -Infinity, n = -Infinity;
  for (const [lon, lat] of p) {
    if (lon < w) w = lon;
    if (lon > o) o = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  
  
  return {
    element: { type: art, ...idTeil, center: { lat: (s + n) / 2, lon: (w + o) / 2 }, bounds: { minlat: s, minlon: w, maxlat: n, maxlon: o }, tags },
    insel: null,
  };
}


export function istOrtschaft(el: OsmRoh): boolean {
  return el.type === 'node' && el.tags?.['place'] != null && SIEDLUNG.has(el.tags['place']);
}

function imRing(lon: number, lat: number, ring: readonly Pos[]): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}


export function punktInFlaeche(p: Punkt, polygone: readonly Pos[][][]): boolean {
  return polygone.some(([aussen, ...loecher]) =>
    !!aussen && imRing(p.lon, p.lat, aussen) && !loecher.some((l) => imRing(p.lon, p.lat, l)));
}


function abstandZurStreckeM(p: Punkt, a: Pos, b: Pos): number {
  const kx = 111_320 * Math.cos(p.lat * Math.PI / 180), ky = 110_540;
  const ax = (a[0] - p.lon) * kx, ay = (a[1] - p.lat) * ky;
  const bx = (b[0] - p.lon) * kx, by = (b[1] - p.lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}


export function inselAmUfer(punkte: readonly Punkt[], flaechen: readonly Inselflaeche[], maxM = 3704): (string | null)[] {
  const gradLat = maxM / 110_540;
  const boxen = flaechen.map((f) => {
    let w = Infinity, s = Infinity, o = -Infinity, n = -Infinity;
    for (const poly of f.polygone) for (const [lon, lat] of poly[0] ?? []) {
      if (lon < w) w = lon;
      if (lon > o) o = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
    return { f, w, s, o, n };
  });
  return punkte.map((p) => {
    const gradLon = maxM / (111_320 * Math.max(Math.cos(p.lat * Math.PI / 180), 0.1));
    const nah = boxen.filter((b) => p.lon >= b.w - gradLon && p.lon <= b.o + gradLon && p.lat >= b.s - gradLat && p.lat <= b.n + gradLat);
    const drin = nah.filter((b) => punktInFlaeche(p, b.f.polygone)).map((b) => b.f);
    const innen = drin.find((f) => f.place === 'island') ?? drin[0];
    if (innen) return innen.name;
    let best: string | null = null;
    let d = maxM;
    for (const { f } of nah) {
      for (const poly of f.polygone) {
        const ring = poly[0] ?? [];
        for (let i = 1; i < ring.length; i++) {
          const x = abstandZurStreckeM(p, ring[i - 1]!, ring[i]!);
          if (x < d) { d = x; best = f.name; }
        }
      }
    }
    return best;
  });
}


export function inselnFuer(punkte: readonly Punkt[], flaechen: readonly Inselflaeche[]): string[][] {
  
  const mitBox = flaechen.map((f) => {
    let w = Infinity, s = Infinity, o = -Infinity, n = -Infinity;
    for (const poly of f.polygone) for (const [lon, lat] of poly[0] ?? []) {
      if (lon < w) w = lon;
      if (lon > o) o = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
    return { f, w, s, o, n };
  });
  return punkte.map((p) => {
    const treffer = mitBox
      .filter((b) => p.lon >= b.w && p.lon <= b.o && p.lat >= b.s && p.lat <= b.n && punktInFlaeche(p, b.f.polygone))
      .map((b) => b.f);
    return [...treffer.filter((f) => f.place === 'island'), ...treffer.filter((f) => f.place === 'islet')]
      .map((f) => f.name)
      .filter((name, i, alle) => alle.indexOf(name) === i);
  });
}
