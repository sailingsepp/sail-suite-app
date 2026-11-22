import { vereinfache } from './kuestenKacheln';
import { KARTE_KACHEL_GRAD, landKachelName } from './kartenKacheln';
import type { GeoFeature, Inselflaeche } from './osmAuszug';
import { lateinisch } from './umschrift';
import { streifenMaske } from './hoehen';



export const SEEKARTE_FAKTOR = 1_000_000;

const STEG_TOLERANZ_M = 0.5;

export type StegArt = 'pier' | 'breakwater' | 'groyne' | 'quay';
const STEG_ARTEN = new Set<string>(['pier', 'breakwater', 'groyne', 'quay']);

export type StegRoh = [StegArt, 0 | 1, number, number[]];

export type NamenArt = 'stadt' | 'ort' | 'dorf' | 'hafen' | 'marina' | 'anker' | 'insel' | 'inselchen' | 'gipfel'
  | 'kap' | 'flugplatz' | 'windrad';

export type KartenName = [number, number, NamenArt, string, number | null, string?];

export type PisteRoh = [number, number[]];

export type VerkehrArt = 'faehre' | 'zone' | 'grenze' | 'fahrbahn';
export type VerkehrRoh = [VerkehrArt, 0 | 1, number[]];

export interface SeekartenPaket {
  revier: string;
  
  bbox: [number, number, number, number];
  erstellt: string;
  faktor: number;
  stege: StegRoh[];
  namen: KartenName[];
  
  orte?: OrtsFlaecheRoh[];
  strassen?: StrasseRoh[];
  
  pisten?: PisteRoh[];
  
  verkehr?: VerkehrRoh[];
}

type Pos = [number, number];

function kodiere(punkte: readonly Pos[], faktor = SEEKARTE_FAKTOR, toleranzM = STEG_TOLERANZ_M): number[] {
  const flach = new Float64Array(punkte.length * 2);
  punkte.forEach(([lon, lat], k) => { flach[2 * k] = lat; flach[2 * k + 1] = lon; });
  const v = vereinfache(flach, toleranzM);
  const ganz = Array.from(v, (x) => Math.round(x * faktor));
  const aus = [ganz[0]!, ganz[1]!];
  for (let k = 2; k < ganz.length; k += 2) aus.push(ganz[k]! - ganz[k - 2]!, ganz[k + 1]! - ganz[k - 1]!);
  return aus;
}


export function dekodiereSteg(k: readonly number[], faktor = SEEKARTE_FAKTOR): Float64Array {
  const p = new Float64Array(k.length);
  let lat = 0, lon = 0;
  for (let n = 0; n < k.length; n += 2) {
    lat += k[n]!; lon += k[n + 1]!;
    p[n] = lat / faktor; p[n + 1] = lon / faktor;
  }
  return p;
}


function breiteDm(t: Readonly<Record<string, string>>): number {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(m)?\s*$/.exec(t['width'] ?? '');
  const w = m ? Number(m[1]!.replace(',', '.')) : NaN;
  return Number.isFinite(w) && w > 0 && w < 200 ? Math.round(w * 10) : 0;
}

const geschlossen = (r: readonly Pos[]) => r.length >= 4 && r[0]![0] === r[r.length - 1]![0] && r[0]![1] === r[r.length - 1]![1];


export function stegeAus(f: GeoFeature): StegRoh[] {
  const p = f.properties ?? {};
  const art = typeof p['man_made'] === 'string' ? p['man_made'] : '';
  if (!STEG_ARTEN.has(art) || !f.geometry) return [];
  const t: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === 'string') t[k] = v;
  const b = breiteDm(t);
  const a = art as StegArt;
  const g = f.geometry;
  const aus: StegRoh[] = [];
  const linie = (r: Pos[]) => { if (r.length >= 2) aus.push([a, 0, b, kodiere(r)]); };
  const flaeche = (r: Pos[] | undefined) => { if (r && r.length >= 4) aus.push([a, 1, b, kodiere(r)]); };
  if (g.type === 'LineString') {
    const r = g.coordinates as Pos[];
    if (geschlossen(r) && t['area'] !== 'no') return [];
    linie(r);
  } else if (g.type === 'MultiLineString') {
    for (const r of g.coordinates as Pos[][]) linie(r);
  } else if (g.type === 'Polygon') {
    flaeche((g.coordinates as Pos[][])[0]);
  } else if (g.type === 'MultiPolygon') {
    for (const poly of g.coordinates as Pos[][][]) flaeche(poly[0]);
  }
  return aus;
}






export const STREIFEN_KM = 20;

export interface Kap { lat: number; lon: number; name: string }
export interface Flugplatz { lat: number; lon: number; name: string; icao: string }


function lageVon(f: GeoFeature): { lat: number; lon: number } | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === 'Point') { const [lon, lat] = g.coordinates as Pos; return { lat, lon }; }
  let s = Infinity, w = Infinity, n = -Infinity, o = -Infinity;
  const besuche = (x: unknown): void => {
    if (Array.isArray(x) && typeof x[0] === 'number') {
      const [lon, lat] = x as Pos;
      s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lon); o = Math.max(o, lon);
    } else if (Array.isArray(x)) x.forEach(besuche);
  };
  besuche((g as { coordinates: unknown }).coordinates);
  return Number.isFinite(s) ? { lat: (s + n) / 2, lon: (w + o) / 2 } : null;
}

const nameVon = (p: Record<string, unknown>) => (typeof p['name'] === 'string' ? p['name'].trim() : '');


export function kapAus(f: GeoFeature): Kap | null {
  const p = f.properties ?? {};
  if (p['natural'] !== 'cape') return null;
  const name = nameVon(p);
  const l = lageVon(f);
  return name && l ? { ...l, name: lateinisch(name) } : null;
}


export function flugplatzAus(f: GeoFeature): Flugplatz | null {
  const p = f.properties ?? {};
  if (p['aeroway'] !== 'aerodrome' || !f.geometry) return null;
  if (f.geometry.type === 'LineString' && geschlossen(f.geometry.coordinates as Pos[]) && p['area'] !== 'no') return null;
  const name = nameVon(p);
  const l = lageVon(f);
  if (!name || !l) return null;
  const icao = typeof p['icao'] === 'string' && /^[A-Z]{4}$/.test(p['icao'].trim()) ? p['icao'].trim() : '';
  return { ...l, name: lateinisch(name), icao };
}







export interface Windrad { lat: number; lon: number; hoeheM: number | null }


export function windradAus(f: GeoFeature): Windrad | null {
  const p = f.properties ?? {};
  if (f.geometry?.type !== 'Point') return null;
  const kat = typeof p['seamark:landmark:category'] === 'string' ? p['seamark:landmark:category'].split(/[;,]/) : [];
  if (p['generator:source'] !== 'wind' && !kat.some((k) => k.trim() === 'windmotor')) return null;
  const s = (k: string) => (typeof p[k] === 'string' ? p[k] : undefined);
  const nabe = hoeheM(s('height:hub')), rotor = hoeheM(s('rotor:diameter'));
  const spitze = nabe != null && rotor != null ? nabe + rotor / 2 : null;
  const werte = [spitze, hoeheM(s('height')), nabe, hoeheM(s('seamark:landmark:height'))].filter((x): x is number => x != null);
  const [lon, lat] = f.geometry.coordinates as Pos;
  return { lat, lon, hoeheM: werte.length ? Math.round(Math.max(...werte)) : null };
}


export function pisteAus(f: GeoFeature): PisteRoh | null {
  const p = f.properties ?? {};
  if (p['aeroway'] !== 'runway' || !f.geometry) return null;
  const t: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === 'string') t[k] = v;
  const g = f.geometry;
  
  if (g.type === 'LineString' && geschlossen(g.coordinates as Pos[]) && p['area'] !== 'no') return null;
  
  const r = g.type === 'LineString' ? g.coordinates as Pos[]
    : g.type === 'Polygon' ? (g.coordinates as Pos[][])[0]
      : g.type === 'MultiPolygon' ? (g.coordinates as Pos[][][])[0]?.[0] ?? null : null;
  return r && r.length >= 2 ? [breiteDm(t), kodiere(r)] : null;
}







const VTG_ARTEN: Record<string, VerkehrArt> = {
  separation_zone: 'zone', separation_roundabout: 'zone',
  separation_line: 'grenze', separation_boundary: 'grenze', separation_crossing: 'grenze', precautionary_area: 'grenze',
  separation_lane: 'fahrbahn',
};

export const VERKEHR_TOLERANZ_M = 10;


export function verkehrAus(f: GeoFeature): VerkehrRoh[] {
  const p = f.properties ?? {};
  const art: VerkehrArt | undefined = p['route'] === 'ferry' ? 'faehre'
    : typeof p['seamark:type'] === 'string' && Object.hasOwn(VTG_ARTEN, p['seamark:type']) ? VTG_ARTEN[p['seamark:type']] : undefined;
  const g = f.geometry;
  if (!art || !g) return [];
  if (g.type === 'LineString') {
    const r = g.coordinates as Pos[];
    
    if (art !== 'faehre' && geschlossen(r) && p['area'] !== 'no') return [];
    return r.length >= 2 ? [[art, 0, kodiere(r, SEEKARTE_FAKTOR, VERKEHR_TOLERANZ_M)]] : [];
  }
  if (art === 'faehre') return [];
  const teile = g.type === 'Polygon' ? [g.coordinates as Pos[][]] : g.type === 'MultiPolygon' ? g.coordinates as Pos[][][] : [];
  return teile.flatMap((t) => (t[0] && t[0].length >= 4 ? [[art, 1, kodiere(t[0], SEEKARTE_FAKTOR, VERKEHR_TOLERANZ_M)] as VerkehrRoh] : []));
}


export function hoeheM(ele: string | undefined): number | null {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(m|ft|')?\s*$/i.exec(ele ?? '');
  if (!m) return null;
  const v = Number(m[1]!.replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0 || v > 9000) return null;
  return Math.round(/ft|'/i.test(m[2] ?? '') ? v * 0.3048 : v);
}

export interface Gipfel { lat: number; lon: number; name: string; hoeheM: number }


export function gipfelAus(f: GeoFeature): Gipfel | null {
  const p = f.properties ?? {};
  if (p['natural'] !== 'peak' || f.geometry?.type !== 'Point') return null;
  const name = typeof p['name'] === 'string' ? p['name'].trim() : '';
  const h = hoeheM(typeof p['ele'] === 'string' ? p['ele'] : undefined);
  if (!name || h == null) return null;
  const [lon, lat] = f.geometry.coordinates as Pos;
  return { lat, lon, name: lateinisch(name), hoeheM: h };
}


export function sichtweiteNM(hoeheMeter: number): number {
  return 2.07 * Math.sqrt(Math.max(0, hoeheMeter));
}


export const GIPFEL_RESERVE_NM = 5;


export const GIPFEL_KUESTE_MAX_KM = 20;

export const GIPFEL_UMKREIS_KM = 5;


export function gipfelVonSeeSichtbar(hoeheMeter: number, kuesteNM: number): boolean {
  return sichtweiteNM(hoeheMeter) > kuesteNM + GIPFEL_RESERVE_NM;
}


function ringKm2(r: readonly Pos[]): number {
  const lat0 = r[0]?.[1] ?? 0;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.54;
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0] * kx) * (r[i]![1] * ky) - (r[i]![0] * kx) * (r[j]![1] * ky);
  return Math.abs(a / 2);
}

function imRing(lon: number, lat: number, r: readonly Pos[]): boolean {
  let drin = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!, [xj, yj] = r[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}


export function inselBeschriftung(f: Inselflaeche): { lat: number; lon: number; km2: number } | null {
  let groesst: Pos[] | null = null, km2 = 0, summe = 0;
  for (const poly of f.polygone) {
    const r = poly[0];
    if (!r || r.length < 4) continue;
    const a = ringKm2(r);
    summe += a;
    if (a > km2) { km2 = a; groesst = r; }
  }
  if (!groesst) return null;
  let lon = 0, lat = 0;
  const n = groesst.length - 1;
  for (let i = 0; i < n; i++) { lon += groesst[i]![0]; lat += groesst[i]![1]; }
  lon /= n; lat /= n;
  if (!imRing(lon, lat, groesst)) {
    const xs: number[] = [];
    for (let i = 0, j = groesst.length - 1; i < groesst.length; j = i++) {
      const [xi, yi] = groesst[i]!, [xj, yj] = groesst[j]!;
      if ((yi > lat) !== (yj > lat)) xs.push(((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    let best = -1;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1]! - xs[k]! > best) { best = xs[k + 1]! - xs[k]!; lon = (xs[k]! + xs[k + 1]!) / 2; }
    }
  }
  return { lat, lon, km2: summe };
}


export function aufKachelrand(a1: number, o1: number, a2: number, o2: number): boolean {
  const g = KARTE_KACHEL_GRAD, e = 1e-7;
  const rand = (v: number) => Math.abs(v / g - Math.round(v / g)) < e;
  return (rand(a1) && rand(a2) && Math.abs(a1 - a2) < e) || (rand(o1) && rand(o2) && Math.abs(o1 - o2) < e);
}


export function kuestenAbstandM(lat: number, lon: number, ringe: (name: string) => readonly Float64Array[] | null, maxM: number): number {
  const g = KARTE_KACHEL_GRAD;
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180), ky = 110_540;
  const i0 = Math.floor(lat / g), j0 = Math.floor(lon / g);
  const zelleM = g * Math.min(kx, ky);
  let best = Infinity;
  for (let s = 0; ; s++) {
    
    if ((s - 1) * zelleM > Math.min(best, maxM)) break;
    for (let di = -s; di <= s; di++) {
      for (let dj = -s; dj <= s; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== s) continue;
        for (const r of ringe(landKachelName(i0 + di, j0 + dj)) ?? []) {
          for (let k = 2; k < r.length; k += 2) {
            const a1 = r[k - 2]!, o1 = r[k - 1]!, a2 = r[k]!, o2 = r[k + 1]!;
            if (aufKachelrand(a1, o1, a2, o2)) continue;
            const ax = (o1 - lon) * kx, ay = (a1 - lat) * ky, bx = (o2 - lon) * kx, by = (a2 - lat) * ky;
            const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
            const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
            const d = Math.hypot(ax + t * dx, ay + t * dy);
            if (d < best) best = d;
          }
        }
      }
    }
    if (s > 200) break;
  }
  return best <= maxM ? best : Infinity;
}


export const ORT_KUESTE_KM: Record<'stadt' | 'ort' | 'dorf', number> = { stadt: 10, ort: 5, dorf: 3 };

export const PLACE_ART: Record<string, 'stadt' | 'ort' | 'dorf'> = { city: 'stadt', town: 'ort', village: 'dorf' };


export function plaetze(t: Readonly<Record<string, string>>): number | null {
  const v = Number((t['capacity'] ?? '').trim());
  return Number.isInteger(v) && v > 0 && v < 10_000 ? v : null;
}


export function hafenArt(t: Readonly<Record<string, string>>): 'marina' | 'hafen' | null {
  const kat = t['seamark:harbour:category'] ?? '';
  if (t['leisure'] === 'marina' || kat === 'marina' || kat === 'marina_no_facilities') return 'marina';
  if (t['seamark:type'] === 'harbour') return 'hafen';
  return null;
}



export const WINDRAD_DOPPELT_M = 30;

export function ohneDoppelte(namen: readonly KartenName[], m = 1000): KartenName[] {
  const aus: KartenName[] = [];
  const gruppe = (a: NamenArt) => (a === 'marina' || a === 'hafen' ? 'h' : a);
  
  const je = new Map<string, KartenName[]>();
  for (const x of namen) {
    const k = `${gruppe(x[2])}|${x[3].toLocaleLowerCase('hr')}`;
    const da = je.get(k) ?? [];
    const kx = 111_320 * Math.cos((x[0] * Math.PI) / 180);
    
    const r = x[2] === 'windrad' ? WINDRAD_DOPPELT_M : m;
    if (da.some((y) => Math.hypot((y[1] - x[1]) * kx, (y[0] - x[0]) * 110_540) < r)) continue;
    da.push(x);
    je.set(k, da);
    aus.push(x);
  }
  return aus;
}





export function sichtbarAb(art: NamenArt, wert: number | null): number {
  switch (art) {
    case 'stadt': return 8;
    case 'ort': return 10;
    case 'dorf': return 11;
    
    case 'hafen': case 'marina': return 8;
    case 'anker': return 9;
    case 'gipfel': { const h = wert ?? 0; return h >= 800 ? 9 : h >= 500 ? 11 : h >= 250 ? 12 : 13; }
    case 'flugplatz': return 9;
    case 'kap': return 10;
    
    case 'windrad': return 11;
    case 'insel': case 'inselchen': {
      const km2 = wert ?? 0;
      return km2 >= 100 ? 8 : km2 >= 10 ? 9 : km2 >= 1 ? 10 : km2 >= 0.1 ? 11 : 12;
    }
  }
}


export const HAEFEN_ZUERST_AB_ZOOM = 12;


export function vorrang(art: NamenArt, wert: number | null, zoom = HAEFEN_ZUERST_AB_ZOOM): number {
  const hafen = zoom >= HAEFEN_ZUERST_AB_ZOOM;
  const stufe: Record<NamenArt, number> = hafen
    ? { marina: 1, hafen: 1, anker: 2, stadt: 3, insel: 4, inselchen: 4, flugplatz: 5, kap: 6, gipfel: 7, ort: 8, dorf: 9, windrad: 10 }
    : { stadt: 1, insel: 2, inselchen: 2, marina: 3, hafen: 3, anker: 4, flugplatz: 5, kap: 6, gipfel: 7, ort: 8, dorf: 9, windrad: 10 };
  
  const innen = art === 'insel' || art === 'inselchen' || art === 'gipfel' || ((art === 'marina' || art === 'hafen') && wert)
    ? 1 / (1 + (wert ?? 0)) : 0.5;
  return stufe[art] + Math.min(0.999, innen);
}

export interface Kasten { x0: number; y0: number; x1: number; y1: number }


export function ohneUeberlappung(lagen: readonly (readonly Kasten[])[], belegt: readonly Kasten[] = []): number[] {
  const voll: Kasten[] = [...belegt];
  const frei = (b: Kasten) => voll.every((a) => b.x1 <= a.x0 || b.x0 >= a.x1 || b.y1 <= a.y0 || b.y0 >= a.y1);
  return lagen.map((l) => {
    const k = l.findIndex(frei);
    if (k >= 0) voll.push(l[k]!);
    return k;
  });
}




export interface OsmPunkt { lat: number; lon: number; tags: Readonly<Record<string, string>> }


export function baueSeekarte(
  e: {
    revier: string; bbox: [number, number, number, number]; erstellt: string;
    stege: readonly StegRoh[]; gipfel: readonly Gipfel[]; orte: readonly OsmPunkt[]; haefen: readonly OsmPunkt[];
    inseln: readonly Inselflaeche[];
    ortsflaechen?: readonly OrtsFlaecheRoh[]; strassen?: readonly StrasseRoh[];
    
    kaps?: readonly Kap[]; flugplaetze?: readonly Flugplatz[]; pisten?: readonly PisteRoh[];
    metar?: (icao: string) => boolean | null;
    
    windraeder?: readonly Windrad[];
    
    verkehr?: readonly VerkehrRoh[];
  },
  kuesteM: (lat: number, lon: number, maxM: number) => number | null,
): SeekartenPaket {
  const namen: KartenName[] = [];
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  for (const h of e.haefen) {
    const name = (h.tags['name'] ?? h.tags['seamark:name'] ?? '').trim();
    
    if (h.tags['seamark:type'] === 'anchorage') {
      if (kuesteM(h.lat, h.lon, 0) !== null) namen.push([r6(h.lat), r6(h.lon), 'anker', lateinisch(name), null]);
      continue;
    }
    const art = hafenArt(h.tags);
    if (!art || !name || kuesteM(h.lat, h.lon, 0) === null) continue;
    namen.push([r6(h.lat), r6(h.lon), art, lateinisch(name), plaetze(h.tags)]);
  }
  for (const o of e.orte) {
    const art = PLACE_ART[o.tags['place'] ?? ''];
    const name = (o.tags['name'] ?? '').trim();
    if (!art || !name) continue;
    const d = kuesteM(o.lat, o.lon, ORT_KUESTE_KM[art] * 1000);
    if (d === null || !Number.isFinite(d)) continue;
    namen.push([r6(o.lat), r6(o.lon), art, lateinisch(name), null]);
  }
  for (const i of e.inseln) {
    const b = inselBeschriftung(i);
    if (!b || kuesteM(b.lat, b.lon, 0) === null) continue;
    namen.push([r6(b.lat), r6(b.lon), i.place === 'island' ? 'insel' : 'inselchen', lateinisch(i.name), Math.round(b.km2 * 100) / 100]);
  }
  const gipfel: Gipfel[] = [];
  for (const g of e.gipfel) {
    const maxM = Math.min((sichtweiteNM(g.hoeheM) - GIPFEL_RESERVE_NM) * 1852, GIPFEL_KUESTE_MAX_KM * 1000);
    if (maxM <= 0) continue;
    const d = kuesteM(g.lat, g.lon, maxM);
    if (d === null || !Number.isFinite(d) || !gipfelVonSeeSichtbar(g.hoeheM, d / 1852)) continue;
    gipfel.push(g);
  }
  
  gipfel.sort((a, b) => b.hoeheM - a.hoeheM);
  const behalten: Gipfel[] = [];
  for (const g of gipfel) {
    const kx = 111.32 * Math.cos((g.lat * Math.PI) / 180);
    if (behalten.some((h) => Math.hypot((h.lon - g.lon) * kx, (h.lat - g.lat) * 110.54) < GIPFEL_UMKREIS_KM)) continue;
    behalten.push(g);
    namen.push([r6(g.lat), r6(g.lon), 'gipfel', g.name, g.hoeheM]);
  }
  
  const imStreifen = (lat: number, lon: number) => {
    const d = kuesteM(lat, lon, STREIFEN_KM * 1000);
    return d !== null && Number.isFinite(d);
  };
  for (const c of e.kaps ?? []) if (imStreifen(c.lat, c.lon)) namen.push([r6(c.lat), r6(c.lon), 'kap', c.name, null]);
  for (const a of e.flugplaetze ?? []) {
    if (!imStreifen(a.lat, a.lon)) continue;
    const m = a.icao && e.metar ? e.metar(a.icao) : null;
    namen.push([r6(a.lat), r6(a.lon), 'flugplatz', a.name, m === null ? null : m ? 1 : 0, a.icao]);
  }
  
  for (const t of e.windraeder ?? []) if (imStreifen(t.lat, t.lon)) namen.push([r6(t.lat), r6(t.lon), 'windrad', '', t.hoeheM]);
  const pisten = (e.pisten ?? []).filter((p) => imStreifen(p[1][0]! / SEEKARTE_FAKTOR, p[1][1]! / SEEKARTE_FAKTOR));
  namen.sort((a, b) => vorrang(a[2], a[4]) - vorrang(b[2], b[4]));
  return {
    revier: e.revier, bbox: e.bbox, erstellt: e.erstellt, faktor: SEEKARTE_FAKTOR, stege: [...e.stege], namen: ohneDoppelte(namen),
    ...(e.ortsflaechen ? { orte: [...e.ortsflaechen] } : {}), ...(e.strassen ? { strassen: [...e.strassen] } : {}),
    ...(e.pisten ? { pisten } : {}),
    ...(e.verkehr ? { verkehr: [...e.verkehr] } : {}),
  };
}






export const ORT_STREIFEN_KM = 3;

const ORT_TOLERANZ_M = 4;


export type OrtsArt = 0 | 1 | 2;
const ORTS_ART: Record<string, OrtsArt> = { residential: 0, commercial: 1, retail: 1, industrial: 2 };

export type OrtsFlaecheRoh = [OrtsArt, number[][]];


export type StrassenKlasse = 0 | 1 | 2 | 3;
const STRASSEN_KLASSE: Record<string, StrassenKlasse> = { motorway: 0, trunk: 0, primary: 1, secondary: 2, tertiary: 3 };

export type StrasseRoh = [StrassenKlasse, number[]];


export const STRASSEN_AB_ZOOM: Record<StrassenKlasse, number> = { 0: 11, 1: 11, 2: 12, 3: 13 };
export const ORTE_AB_ZOOM = 10;


export function ortsflaecheAus(f: GeoFeature, nahe: (lat: number, lon: number) => boolean): OrtsFlaecheRoh[] {
  const p = f.properties ?? {};
  const art = typeof p['landuse'] === 'string' ? ORTS_ART[p['landuse']] : undefined;
  if (art === undefined || !f.geometry) return [];
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Pos[][]]
    : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates as Pos[][][] : [];
  const aus: OrtsFlaecheRoh[] = [];
  for (const poly of polys) {
    const aussen = poly[0];
    if (!aussen || aussen.length < 4 || !aussen.some(([lon, lat]) => nahe(lat, lon))) continue;
    const ringe = poly.filter((r) => r.length >= 4).map((r) => kodiere(r, SEEKARTE_FAKTOR, ORT_TOLERANZ_M)).filter((r) => r.length >= 6);
    if (ringe.length) aus.push([art, ringe]);
  }
  return aus;
}


export function strassenAus(f: GeoFeature, nahe: (lat: number, lon: number) => boolean): StrasseRoh[] {
  const p = f.properties ?? {};
  const klasse = typeof p['highway'] === 'string' ? STRASSEN_KLASSE[p['highway']] : undefined;
  if (klasse === undefined || !f.geometry) return [];
  const linien = f.geometry.type === 'LineString' ? [f.geometry.coordinates as Pos[]]
    : f.geometry.type === 'MultiLineString' ? f.geometry.coordinates as Pos[][] : [];
  const aus: StrasseRoh[] = [];
  for (const l of linien) {
    let stueck: Pos[] = [];
    const fertig = () => { if (stueck.length >= 2) aus.push([klasse, kodiere(stueck, SEEKARTE_FAKTOR, ORT_TOLERANZ_M)]); stueck = []; };
    for (const q of l) {
      if (nahe(q[1], q[0])) stueck.push(q); else fertig();
    }
    fertig();
  }
  return aus;
}


export function kuestenNaheRaster(
  ringe: Iterable<Float64Array>, box: { s: number; w: number; n: number; o: number }, schritt: number, maxM: number,
): (lat: number, lon: number) => boolean {
  const w = Math.ceil((box.o - box.w) / schritt), h = Math.ceil((box.n - box.s) / schritt);
  const kueste = new Uint8Array(w * h);
  const setze = (lat: number, lon: number) => {
    const x = Math.floor((lon - box.w) / schritt), y = Math.floor((box.n - lat) / schritt);
    if (x >= 0 && x < w && y >= 0 && y < h) kueste[y * w + x] = 1;
  };
  for (const r of ringe) {
    for (let k = 2; k < r.length; k += 2) {
      const a1 = r[k - 2]!, o1 = r[k - 1]!, a2 = r[k]!, o2 = r[k + 1]!;
      if (aufKachelrand(a1, o1, a2, o2)) continue;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(a2 - a1), Math.abs(o2 - o1)) / (schritt / 2)));
      for (let t = 0; t <= n; t++) setze(a1 + ((a2 - a1) * t) / n, o1 + ((o2 - o1) * t) / n);
    }
  }
  const dy = schritt * 110_540, dx = schritt * 111_320 * Math.cos((((box.s + box.n) / 2) * Math.PI) / 180);
  const streifen = streifenMaske(kueste, w, h, dx, dy, maxM);
  return (lat, lon) => {
    const x = Math.floor((lon - box.w) / schritt), y = Math.floor((box.n - lat) / schritt);
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const k = y * w + x;
    return kueste[k] === 1 || streifen[k] === 1;
  };
}
