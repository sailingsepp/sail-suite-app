import { bearingDeg, distNM } from './geo';
import { logbuchOrtsname, mitArtwort, ortInDerNaehe, ORT_FERN_SM, type OrtKandidat } from './ortsname';
import { richtungKurz } from './zielwetter';
import { ortSchluessel } from './vorrechnung';
import { lateinisch } from './umschrift';
import type { Punkt, Sprache } from './types';




export type UmgebungElement = [number, number, Record<string, string>];

export type UmgebungOrt = [number, number, string, string, string | null, string | null, (string | null)?];

export interface UmgebungPaket {
  revier: string;
  
  bbox: [number, number, number, number];
  erstellt: string;
  
  elemente: UmgebungElement[];
  
  orte: UmgebungOrt[];
  
  inseln: Record<string, string[]>;
}


export const ORT_NAEHE_KM = 10;


const UNNOETIG = /^(name:(?!de$|en$)|alt_name|old_name|official_name|loc_name|int_name|short_name|nat_name|reg_name|wikidata|wikipedia|wikimedia_commons|source|note|fixme|FIXME|description|image|mapillary|ref:|is_in|addr:|population|census|gnis:|created_by|check_date:|survey|start_date|subject:|brand:)/;

export function kompaktiereTags(tags: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(tags).filter(([k]) => !UNNOETIG.test(k)));
}


export function liegeplatzArt(tags: Readonly<Record<string, string>>): 'marina' | 'bucht' | null {
  if (tags['leisure'] === 'marina' || tags['seamark:type'] === 'harbour') return 'marina';
  if (tags['seamark:type'] === 'anchorage' || tags['natural'] === 'bay') return 'bucht';
  return null;
}


export function decktUmkreis(p: Pick<UmgebungPaket, 'bbox'>, punkt: Punkt, radiusM: number): boolean {
  const [w, s, o, n] = p.bbox;
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(Math.cos(punkt.lat * Math.PI / 180), 0.1));
  return punkt.lat - dLat >= s && punkt.lat + dLat <= n && punkt.lon - dLon >= w && punkt.lon + dLon <= o;
}

const M_PRO_NM = 1852;


export function elementeImUmkreis(
  p: UmgebungPaket, punkt: Punkt, radiusM: number,
): { type: 'node'; lat: number; lon: number; tags: Record<string, string> }[] {
  const grenzeNM = radiusM / M_PRO_NM;
  const out: { type: 'node'; lat: number; lon: number; tags: Record<string, string> }[] = [];
  for (const [lat, lon, tags] of p.elemente) {
    
    if (Math.abs(lat - punkt.lat) * 60 > grenzeNM) continue;
    if (distNM(punkt.lat, punkt.lon, lat, lon) <= grenzeNM) out.push({ type: 'node', lat, lon, tags });
  }
  return out;
}


export function orteImUmkreis(
  p: UmgebungPaket, punkt: Punkt, radiusM: number, sprache: Sprache,
): (OrtKandidat & { insel: string | null })[] {
  const grenzeNM = radiusM / M_PRO_NM;
  const out: (OrtKandidat & { insel: string | null })[] = [];
  for (const [lat, lon, place, name, nameEn, nameDe, insel] of p.orte) {
    if (Math.abs(lat - punkt.lat) * 60 > grenzeNM) continue;
    if (distNM(punkt.lat, punkt.lon, lat, lon) > grenzeNM) continue;
    out.push({ lat, lon, place, name, nameSprache: (sprache === 'en' ? nameEn : nameDe) ?? undefined, insel: insel ?? null });
  }
  return out;
}


const LIEGEPLATZ_M = 500;

const ORT_M = 8000;

const IM_ORT_M = 1500;

const ORTSINSEL_M = 3704;


export function ortsnameAusUmgebung(p: UmgebungPaket, punkt: Punkt, sprache: Sprache): string | null {
  let liegeplatz: { name: string; art: 'marina' | 'bucht'; lat: number; lon: number } | null = null;
  let d = Infinity;
  for (const el of elementeImUmkreis(p, punkt, LIEGEPLATZ_M)) {
    const art = liegeplatzArt(el.tags);
    if (!art) continue;
    const x = distNM(punkt.lat, punkt.lon, el.lat, el.lon);
    
    
    
    if (x < d) { d = x; liegeplatz = el.tags['name'] ? { name: lateinisch(el.tags['name']), art, lat: el.lat, lon: el.lon } : null; }
  }
  const orte = orteImUmkreis(p, punkt, ORT_M, sprache);
  const ort = ortInDerNaehe(punkt, orte);
  const ortPunkt = ort ? orte.find((o) => (o.nameSprache ?? o.name) === ort) : undefined;
  const ortNahe = !!ortPunkt && distNM(punkt.lat, punkt.lon, ortPunkt.lat, ortPunkt.lon) * M_PRO_NM > IM_ORT_M;
  const ortAbstandM = ortPunkt ? distNM(punkt.lat, punkt.lon, ortPunkt.lat, ortPunkt.lon) * M_PRO_NM : Infinity;
  const insel = (liegeplatz ? (p.inseln[ortSchluessel(liegeplatz)]?.[0] ?? null) : null)
    
    ?? (ortPunkt && (ortAbstandM <= ORTSINSEL_M || ortAbstandM / M_PRO_NM >= ORT_FERN_SM) ? ortPunkt.insel : null);
  const bucht = sprache === 'en' ? 'Bay' : 'Bucht';
  const text = liegeplatz
    ? (liegeplatz.art === 'marina' ? mitArtwort('marina', 'Marina', liegeplatz.name) : mitArtwort('bucht', bucht, liegeplatz.name))
    : null;
  
  
  
  const l = (x: string | null): string | null => (x ? lateinisch(x) : x);
  
  const ortAbstand = ortPunkt && ortNahe
    ? { sm: ortAbstandM / M_PRO_NM, richtung: richtungKurz(bearingDeg(ortPunkt.lat, ortPunkt.lon, punkt.lat, punkt.lon), sprache) } : null;
  return logbuchOrtsname({ liegeplatz: l(text), art: liegeplatz?.art ?? null, ort: l(ort), ortNahe, ortAbstand, insel: l(insel), hauptinsel: null, sprache });
}


export interface OsmRoh {
  type: string; id?: number; lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Record<string, string>;
}

const r5 = (x: number): number => Math.round(x * 1e5) / 1e5;
const lage = (el: OsmRoh): [number, number] | null => {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return lat == null || lon == null ? null : [lat, lon];
};


export function baueUmgebung(
  revier: string, bbox: [number, number, number, number],
  e: { elemente: readonly OsmRoh[]; orte: readonly OsmRoh[] }, inselnJeOrt: Readonly<Record<string, string[]>>,
): UmgebungPaket {
  const elemente: UmgebungPaket['elemente'] = [];
  const inseln: UmgebungPaket['inseln'] = {};
  
  const zellen = new Map<string, [number, number][]>();
  for (const el of e.elemente) {
    const pos = lage(el);
    if (!pos || !el.tags) continue;
    const lat = r5(pos[0]), lon = r5(pos[1]);
    elemente.push([lat, lon, kompaktiereTags(el.tags)]);
    if (!liegeplatzArt(el.tags)) continue;
    const z = `${Math.floor(lat * 10)},${Math.floor(lon * 10)}`;
    zellen.set(z, [...(zellen.get(z) ?? []), [lat, lon]]);
    
    
    const insel = el.tags['name'] ? inselnJeOrt[ortSchluessel({ lat: pos[0], lon: pos[1] })] : undefined;
    if (insel) inseln[ortSchluessel({ lat, lon })] = insel;
  }
  const grenzeNM = ORT_NAEHE_KM / 1.852;
  const nahAmWasser = (lat: number, lon: number): boolean => {
    const zl = Math.floor(lat * 10), zo = Math.floor(lon * 10);
    
    for (let a = -1; a <= 1; a++) {
      for (let b = -2; b <= 2; b++) {
        for (const [la, lo] of zellen.get(`${zl + a},${zo + b}`) ?? []) {
          if (distNM(lat, lon, la, lo) <= grenzeNM) return true;
        }
      }
    }
    return false;
  };
  const orte: UmgebungPaket['orte'] = [];
  for (const el of e.orte) {
    const t = el.tags;
    if (!t?.['name'] || !t['place'] || el.lat == null || el.lon == null) continue;
    if (!nahAmWasser(el.lat, el.lon)) continue;
    orte.push([r5(el.lat), r5(el.lon), t['place'], t['name'], t['name:en'] ?? null, t['name:de'] ?? null]);
  }
  return { revier, bbox, erstellt: new Date().toISOString(), elemente, orte, inseln };
}
