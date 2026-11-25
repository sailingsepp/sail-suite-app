import { inselDesNaechstenUfers, landpunktAmUfer, type UferWay, type InselRelation } from '@/core/ufer';
import { distNM } from '@/core/geo';
import type { Punkt, AnkerplatzArt } from '@/core/types';
import { osmNameInSprache, type OrtKandidat } from '@/core/ortsname';
import { ohneVerwaltungswort } from './geocode';
import { ausCache, inCache, erweitert, PUFFER_GRAD } from './kuestenCache';
import { overpassUeberServer } from './fremdProxy';
import { umgebungLokal, ladeUmgebungFuer } from './umgebung';
import { elementeImUmkreis } from '@/core/umgebung';
import { istSeeobjekt } from '@/core/osmAuszug';
import { kuesteAusKacheln, kuesteAusKachelnMitBudget } from './kuestenKacheln';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export interface OverpassElement {
  type: 'node' | 'way' | 'relation' | 'area';
  id?: number;

  members?: { type: string; ref: number; role?: string }[];
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };

  geometry?: { lat: number; lon: number }[];

  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Record<string, string>;
}

class OverpassUeberlastet extends Error {}

export async function queryOverpass(ql: string, timeoutMs = 8000): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {

    let ueberServer: unknown | null;
    try {
      ueberServer = await overpassUeberServer(ql, controller.signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new OverpassUeberlastet('Overpass-Anfrage (eigener Server): Client-Timeout');
      }
      throw err;
    }
    if (ueberServer) {
      const data = ueberServer as { elements?: OverpassElement[]; remark?: string };
      if (overpassAbbruch(data.remark)) throw new OverpassUeberlastet('Overpass-Abbruch: ' + data.remark);
      return data.elements ?? [];
    }
    let res: Response;
    try {
      res = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new OverpassUeberlastet('Overpass-Anfrage: Client-Timeout');
      }
      throw err;
    }
    if (!res.ok) {
      const msg = 'Overpass-Anfrage fehlgeschlagen (' + res.status + ')';
      if (res.status === 429 || res.status === 503 || res.status === 504) throw new OverpassUeberlastet(msg);
      throw new Error(msg);
    }
    const data = await res.json() as { elements?: OverpassElement[]; remark?: string };

    if (overpassAbbruch(data.remark)) throw new OverpassUeberlastet('Overpass-Abbruch: ' + data.remark);
    return data.elements ?? [];
  } finally {
    clearTimeout(timer);
  }
}

export function overpassAbbruch(remark: string | undefined): boolean {
  return !!remark && /runtime error|timed out|out of memory/i.test(remark);
}

function warte(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOverpassMitWiederholung(ql: string, timeoutMs: number, versuche = 3, pauseMs = 3000): Promise<OverpassElement[]> {
  for (let versuch = 1; ; versuch++) {
    try {
      return await queryOverpass(ql, timeoutMs);
    } catch (err) {
      if (!(err instanceof OverpassUeberlastet) || versuch >= versuche) throw err;
      await warte(pauseMs);
    }
  }
}

function klassifiziere(tags: Record<string, string>): AnkerplatzArt {
  if (tags['leisure'] === 'marina' || tags['seamark:type'] === 'harbour') return 'marina';
  if (tags['seamark:type'] === 'anchorage' || tags['natural'] === 'bay') return 'bucht';
  return null;
}

export interface AnkerplatzTreffer {
  art: 'marina' | 'bucht';
  name: string | null;

  dist: number;
}

const ANKER_RADIUS_M = 1000;

const ANKER_CACHE = new Map<string, Promise<AnkerplatzAbfrage | null>>();

function ankerSchluessel(p: Punkt): string {
  return `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}

export interface AnkerplatzAbfrage {
  treffer: AnkerplatzTreffer[];
  elemente: OverpassElement[];
}

async function sucheAnkerplaetze(punkt: Punkt, radiusM: number, geduldig = false): Promise<AnkerplatzAbfrage | null> {
  const r = Math.round(radiusM);
  const um = `(around:${r},${punkt.lat},${punkt.lon})`;
  const ql = `[out:json][timeout:${geduldig ? 25 : 8}];(`
    + `node["seamark:type"="harbour"]${um};`
    + `way["seamark:type"="harbour"]${um};`
    + `node["leisure"="marina"]${um};`
    + `way["leisure"="marina"]${um};`
    + `node["seamark:type"="anchorage"]${um};`
    + `node["natural"="bay"]${um};`
    + `way["natural"="bay"]${um};`

    + `node["seamark:type"="small_craft_facility"]${um};`
    + `node["seamark:type"="mooring"]${um};`

    + `node["seamark:light:character"]${um};`
    + `node["seamark:light:1:character"]${um};`
    + `);out tags center;`;

  const lokal = await umgebungLokal(punkt, r);
  if (lokal) return alsAbfrage(punkt, elementeImUmkreis(lokal, punkt, r));
  try {

    const elemente = geduldig ? await queryOverpassMitWiederholung(ql, 30_000, 2) : await queryOverpass(ql);
    return alsAbfrage(punkt, elemente);
  } catch {

    const vomServer = await ladeUmgebungFuer(punkt, r).catch(() => null);
    if (vomServer) return alsAbfrage(punkt, elementeImUmkreis(vomServer, punkt, r));
    return null;
  }
}

function alsAbfrage(punkt: Punkt, elemente: OverpassElement[]): AnkerplatzAbfrage {
  const treffer: AnkerplatzTreffer[] = [];
  for (const el of elemente) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const art = klassifiziere(el.tags ?? {});
    if (!art) continue;
    treffer.push({ art, name: el.tags?.name ?? null, dist: distNM(punkt.lat, punkt.lon, lat, lon) });
  }
  return { treffer, elemente };
}

export function ankerplatzAbfrage(punkt: Punkt, geduldig = false): Promise<AnkerplatzAbfrage | null> {
  const key = ankerSchluessel(punkt);
  const vorhanden = ANKER_CACHE.get(key);
  if (vorhanden) return vorhanden;
  const lauf = sucheAnkerplaetze(punkt, ANKER_RADIUS_M, geduldig).then((ergebnis) => {

    if (ergebnis === null) ANKER_CACHE.delete(key);
    return ergebnis;
  });
  ANKER_CACHE.set(key, lauf);
  return lauf;
}

export function naechsterImRadius(treffer: AnkerplatzTreffer[], radiusM: number): AnkerplatzTreffer | null {
  const grenzeNM = radiusM / 1852;
  let naechste: AnkerplatzTreffer | null = null;
  for (const t of treffer) {
    if (t.dist > grenzeNM) continue;
    if (!naechste || t.dist < naechste.dist) naechste = t;
  }
  return naechste;
}

async function naechsterTreffer(punkt: Punkt, radiusM: number): Promise<AnkerplatzTreffer | null> {

  const alle = radiusM > ANKER_RADIUS_M
    ? await sucheAnkerplaetze(punkt, radiusM)
    : await ankerplatzAbfrage(punkt);
  return alle ? naechsterImRadius(alle.treffer, radiusM) : null;
}

export async function findAnkerplatzArt(punkt: Punkt, radiusM = 600): Promise<AnkerplatzArt> {
  const nah = await naechsterTreffer(punkt, radiusM);
  if (nah) return nah.art;

  return artAusTitel(await naechsterTreffer(punkt, ANKER_RADIUS_M));
}

export function artAusTitel(titel: AnkerplatzTreffer | null): AnkerplatzArt {
  return titel?.name && titel.art === 'marina' ? 'marina' : null;
}

export async function findAnkerplatzName(punkt: Punkt, radiusM = ANKER_RADIUS_M): Promise<{ art: 'marina' | 'bucht'; name: string } | null> {
  const treffer = await naechsterTreffer(punkt, radiusM);
  if (!treffer?.name) return null;
  return { art: treffer.art, name: treffer.name };
}

export async function findInselName(punkt: Punkt, radiusNM = 4): Promise<string[]> {
  const r = Math.round(radiusNM * 1852);
  const ql = `[out:json][timeout:8];`
    + `way(around:${r},${punkt.lat},${punkt.lon})["natural"="coastline"]->.c;`
    + `(.c;.c <;);out tags;`;
  try {
    const elemente = await queryOverpass(ql);
    const namen = new Set<string>();
    for (const el of elemente) {
      if (el.tags?.place === 'island' && el.tags.name) namen.add(el.tags.name);
    }
    return [...namen];
  } catch {
    return [];
  }
}

export async function inselAmUfer(punkt: Punkt, radiusNM = 0.5): Promise<string | null> {
  const r = Math.round(radiusNM * 1852);
  const ql = `[out:json][timeout:8];`
    + `way(around:${r},${punkt.lat},${punkt.lon})["natural"="coastline"]->.c;`
    + `.c out geom;`
    + `rel(bw.c)["place"~"^(island|islet)$"];out body;`;
  const elemente = await queryOverpass(ql);
  const ways: UferWay[] = [];
  const inseln: InselRelation[] = [];
  for (const el of elemente) {
    if (el.type === 'way' && el.id != null && el.geometry) ways.push({ id: el.id, geometry: el.geometry, tags: el.tags });
    else if (el.type === 'relation' && el.tags?.name && el.members) {
      inseln.push({ name: el.tags.name, wayIds: el.members.filter((m) => m.type === 'way').map((m) => m.ref) });
    }
  }
  return inselDesNaechstenUfers(punkt, ways, inseln);
}

export async function umgebungFuerLogbuch(
  punkt: Punkt, sprache: 'de' | 'en', uferNM = 2, ortM = 8000,
): Promise<{ insel: string | null; orte: OrtKandidat[]; landpunkt: Punkt | null }> {
  const r = Math.round(uferNM * 1852);

  const ql = `[out:json][timeout:25];`
    + `way(around:${r},${punkt.lat},${punkt.lon})["natural"="coastline"]->.c;`
    + `.c out geom;`
    + `rel(bw.c)["place"~"^(island|islet)$"];out body;`
    + `node(around:${ortM},${punkt.lat},${punkt.lon})["place"~"^(city|town|village|hamlet)$"]["name"];out body;`;
  const elemente = await queryOverpassMitWiederholung(ql, 30_000, 2);
  const ways: UferWay[] = [];
  const inseln: InselRelation[] = [];
  const orte: OrtKandidat[] = [];
  for (const el of elemente) {
    if (el.type === 'way' && el.id != null && el.geometry) ways.push({ id: el.id, geometry: el.geometry, tags: el.tags });
    else if (el.type === 'relation' && el.tags?.name && el.members) {
      inseln.push({ name: osmNameInSprache(el.tags, sprache)!, wayIds: el.members.filter((m) => m.type === 'way').map((m) => m.ref) });
    } else if (el.type === 'node' && el.lat != null && el.lon != null && el.tags?.name && el.tags.place) {
      orte.push({ lat: el.lat, lon: el.lon, place: el.tags.place, name: el.tags.name, nameSprache: el.tags[`name:${sprache}`] });
    }
  }
  return { insel: inselDesNaechstenUfers(punkt, ways, inseln), orte, landpunkt: landpunktAmUfer(punkt, ways) };
}

export async function inselMitNamen(punkt: Punkt, name: string, radiusM = 20_000): Promise<boolean> {
  const n = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const um = `(around:${radiusM},${punkt.lat},${punkt.lon})["place"="island"]["name"="${n}"]`;
  const ql = `[out:json][timeout:25];(node${um};way${um};rel${um};);out tags;`;
  const elemente = await queryOverpassMitWiederholung(ql, 30_000, 2);
  return elemente.some((e) => e.tags?.name === name);
}

export async function gemeindeAmPunkt(punkt: Punkt): Promise<string | null> {
  const ql = `[out:json][timeout:25];is_in(${punkt.lat},${punkt.lon})->.a;`
    + `area.a["boundary"="administrative"]["admin_level"~"^(7|8)$"]["name"];out tags;`;
  const elemente = await queryOverpassMitWiederholung(ql, 30_000, 2);
  const namen = elemente.flatMap((e) => (e.tags?.name ? [{ name: e.tags.name, stufe: e.tags.admin_level }] : []));
  const mitWort = namen.find((e) => ohneVerwaltungswort(e.name) !== e.name);
  const treffer = mitWort ?? namen.find((e) => e.stufe === '7');
  return treffer ? ohneVerwaltungswort(treffer.name) : null;
}

export async function inselAmLandpunkt(punkt: Punkt, sprache: 'de' | 'en' = 'de'): Promise<string | null> {
  const ql = `[out:json][timeout:25];is_in(${punkt.lat},${punkt.lon})->.a;`
    + `area.a["place"~"^(island|islet)$"]["name"];out tags;`;
  const elemente = await queryOverpassMitWiederholung(ql, 30_000, 2);
  const flaechen = elemente.filter((e) => e.tags?.name && e.tags.place);

  const insel = flaechen.find((e) => e.tags!.place === 'island') ?? flaechen[0];
  return osmNameInSprache(insel?.tags, sprache);
}

export async function findInselnFuerPunkte(punkte: readonly Punkt[]): Promise<string[][]> {
  try {
    return await findInselnFuerPunkteOderWirf(punkte);
  } catch {
    return punkte.map((): string[] => []);
  }
}

export async function findInselnFuerPunkteOderWirf(punkte: readonly Punkt[]): Promise<string[][]> {
  if (punkte.length === 0) return [];
  const teile = punkte.map((p, i) =>
    `is_in(${p.lat.toFixed(5)},${p.lon.toFixed(5)})->.a${i};`
    + `area.a${i}[place~"^(island|islet)$"]["name"];out tags;`
    + `make trenner idx="${i}";out;`);
  const ql = `[out:json][timeout:25];${teile.join('')}`;
  const elemente = await queryOverpassMitWiederholung(ql, 30_000);
  const ergebnis = punkte.map((): string[] => []);
  let aktuell: string[] = [];
  let trenner = 0;
  for (const el of elemente) {
    const art = (el as { type: string }).type;
    if (art === 'trenner') {
      trenner++;
      const idx = Number(el.tags?.idx);
      if (Number.isInteger(idx) && idx >= 0 && idx < ergebnis.length) ergebnis[idx] = aktuell;
      aktuell = [];
    } else if (el.tags?.name) {
      aktuell.push(el.tags.name);
    }
  }

  if (trenner < punkte.length) throw new Error('Overpass is_in: unvollstaendige Antwort');
  return ergebnis;
}

function gradPuffer(latRef: number, nm: number): { dLat: number; dLon: number } {
  const dLat = nm / 60;
  const dLon = nm / (60 * Math.max(0.2, Math.cos((latRef * Math.PI) / 180)));
  return { dLat, dLon };
}

export interface Zeitbudget { timeoutMs: number; versuche: number; pauseMs: number }
const BUDGET_HINTERGRUND: Zeitbudget = { timeoutMs: 20_000, versuche: 3, pauseMs: 3000 };
export const BUDGET_INTERAKTIV: Zeitbudget = { timeoutMs: 12_000, versuche: 2, pauseMs: 2000 };

async function fetchKuestenlinien(
  s: number, w: number, n: number, e: number, budget: Zeitbudget,
): Promise<[Punkt, Punkt][] | null> {
  const box = { s, w, n, e };
  const aufKacheln = await kuesteAusKacheln({ swLat: s, swLon: w, neLat: n, neLon: e });
  if (aufKacheln) return aufKacheln;
  const gespeichert = await ausCache(box);
  if (gespeichert) return gespeichert;

  const gross = erweitert(box, PUFFER_GRAD);
  const ql = `[out:json][timeout:20];way["natural"="coastline"]`
    + `(${gross.s},${gross.w},${gross.n},${gross.e});out geom;`;
  try {
    const elemente = await queryOverpassMitWiederholung(ql, budget.timeoutMs, budget.versuche, budget.pauseMs);
    const linien: [Punkt, Punkt][] = [];
    for (const el of elemente) {
      const geo = el.geometry;
      if (!geo) continue;
      for (let i = 0; i < geo.length - 1; i++) {
        linien.push([{ lat: geo[i]!.lat, lon: geo[i]!.lon }, { lat: geo[i + 1]!.lat, lon: geo[i + 1]!.lon }]);
      }
    }

    void inCache(gross, linien);
    return linien;
  } catch {
    return null;
  }
}

export async function kuestenlinienUmPunkt(
  punkt: Punkt, radienNM: number[] = [1.5, 4, 10], budget: Zeitbudget = BUDGET_HINTERGRUND,
): Promise<[Punkt, Punkt][]> {
  for (const radiusNM of radienNM) {
    const { dLat, dLon } = gradPuffer(punkt.lat, radiusNM);
    const linien = await fetchKuestenlinien(
      punkt.lat - dLat, punkt.lon - dLon, punkt.lat + dLat, punkt.lon + dLon, budget,
    );

    if (linien === null) return [];
    if (linien.length) return linien;
  }
  return [];
}

export interface Ausweichziel {
  name: string;
  art: 'marina' | 'hafen' | 'bucht';
  lat: number;
  lon: number;
}

const GOLF_NAME = /^(κόλπος|kolpos|kólpos|golfo|golfe|gulf)(\s|$)|(^|\s)körfezi$/iu;

export const istGolfName = (name: string): boolean => GOLF_NAME.test(name.trim());

export const BUCHT_MAX_KM = 5;

function diagonaleKm(b: OverpassElement['bounds']): number | null {
  if (!b) return null;
  const dy = (b.maxlat - b.minlat) * 111.32;
  const dx = (b.maxlon - b.minlon) * 111.32 * Math.cos((((b.minlat + b.maxlat) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

function klassifiziereAusweich(tags: Record<string, string>, bounds?: OverpassElement['bounds']): Ausweichziel['art'] | null {
  if (tags['leisure'] === 'marina') return 'marina';
  if (tags['seamark:type'] === 'harbour') return 'hafen';
  if (tags['seamark:type'] === 'anchorage') return 'bucht';
  if (tags['natural'] === 'bay') {
    if (istGolfName(tags['name'] ?? '')) return null;
    const d = diagonaleKm(bounds);
    if (d != null && d > BUCHT_MAX_KM) return null;
    return 'bucht';
  }
  return null;
}

export async function findAusweichziele(
  punkt: Punkt, radiusNM = 8,
  budget: Zeitbudget = { timeoutMs: 20_000, versuche: 3, pauseMs: 3000 },
  wirfBeiFehler = false,
): Promise<Ausweichziel[]> {
  const r = Math.round(radiusNM * 1852);
  const um = `(around:${r},${punkt.lat},${punkt.lon})`;

  const ql = `[out:json][timeout:20];(`
    + `node["leisure"="marina"]${um};way["leisure"="marina"]${um};`
    + `node["seamark:type"="harbour"]${um};way["seamark:type"="harbour"]${um};`
    + `node["seamark:type"="anchorage"]${um};`
    + `node["natural"="bay"]${um};way["natural"="bay"]${um};`
    + `);out tags center;`;

  const lokal = await umgebungLokal(punkt, r);
  if (lokal) return alsAusweichziele(elementeImUmkreis(lokal, punkt, r));
  try {
    const elemente = await queryOverpassMitWiederholung(ql, budget.timeoutMs, budget.versuche, budget.pauseMs);
    return alsAusweichziele(elemente);
  } catch (err) {
    const vomServer = await ladeUmgebungFuer(punkt, r).catch(() => null);
    if (vomServer) return alsAusweichziele(elementeImUmkreis(vomServer, punkt, r));
    if (wirfBeiFehler) throw err;
    return [];
  }
}

export function alsAusweichziele(elemente: OverpassElement[]): Ausweichziel[] {
  const out: Ausweichziel[] = [];
  for (const el of elemente) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.['name'];
    if (lat == null || lon == null || !name) continue;
    const art = klassifiziereAusweich(el.tags ?? {}, el.bounds);
    if (!art) continue;
    out.push({ name, art, lat, lon });
  }
  return out;
}

export async function ausweichzieleImGebiet(
  swLat: number, swLon: number, neLat: number, neLon: number,
): Promise<Ausweichziel[]> {
  try {
    return await ausweichzieleImGebietOderWirf(swLat, swLon, neLat, neLon);
  } catch {
    return [];
  }
}

export async function ausweichzieleImGebietOderWirf(
  swLat: number, swLon: number, neLat: number, neLon: number,
): Promise<Ausweichziel[]> {
  const box = `(${swLat.toFixed(4)},${swLon.toFixed(4)},${neLat.toFixed(4)},${neLon.toFixed(4)})`;

  const ql = `[out:json][timeout:40];(`
    + `node["leisure"="marina"]${box};way["leisure"="marina"]${box};`
    + `node["seamark:type"="harbour"]${box};way["seamark:type"="harbour"]${box};`
    + `node["seamark:type"="anchorage"]${box};`
    + `node["natural"="bay"]${box};way["natural"="bay"]${box};`
    + `);out tags center;`;
  const elemente = await queryOverpassMitWiederholung(ql, 45_000);
  const out: Ausweichziel[] = [];
  for (const el of elemente) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const name = el.tags?.['name'];
    if (lat == null || lon == null || !name) continue;
    const art = klassifiziereAusweich(el.tags ?? {});
    if (!art) continue;
    out.push({ name, art, lat, lon });
  }
  return out;
}

export async function umgebungImGebietOderWirf(
  swLat: number, swLon: number, neLat: number, neLon: number,
): Promise<{ elemente: OverpassElement[]; orte: OverpassElement[] }> {
  const box = `(${swLat.toFixed(4)},${swLon.toFixed(4)},${neLat.toFixed(4)},${neLon.toFixed(4)})`;
  const seezeichen = `[out:json][timeout:60];(`
    + `node["seamark:type"="harbour"]${box};way["seamark:type"="harbour"]${box};`
    + `node["leisure"="marina"]${box};way["leisure"="marina"]${box};`
    + `node["seamark:type"="anchorage"]${box};`
    + `node["natural"="bay"]${box};way["natural"="bay"]${box};`
    + `node["seamark:type"="small_craft_facility"]${box};`
    + `node["waterway"="fuel"]${box};`
    + `node["seamark:type"="mooring"]${box};`
    + `node["seamark:light:character"]${box};way["seamark:light:character"]${box};`
    + `node["seamark:light:1:character"]${box};way["seamark:light:1:character"]${box};`

    + `nw["seamark:type"~"^(light_(major|minor|float|vessel)|(buoy|beacon)_(lateral|cardinal|isolated_danger|safe_water|special_purpose))$"]${box};`
    + `nw["man_made"="lighthouse"]${box};nw["seamark:light:colour"]${box};nw["seamark:light:1:colour"]${box};`
    + `);out tags center;`;
  const orte =`[out:json][timeout:60];node["place"~"^(city|town|village|hamlet)$"]${box};out tags;`;
  const e = await queryOverpassMitWiederholung(seezeichen, 70_000);
  const o = await queryOverpassMitWiederholung(orte, 70_000);

  return { elemente: e.filter((el) => !el.tags || istSeeobjekt(el.tags)), orte: o };
}

export async function kuestenlinienUmStrecke(
  a: Punkt, b: Punkt, pufferNM = 0.3, budget: Zeitbudget = BUDGET_HINTERGRUND,
): Promise<[Punkt, Punkt][]> {
  const mitte = { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
  const { dLat, dLon } = gradPuffer(mitte.lat, pufferNM);
  return await fetchKuestenlinien(
    Math.min(a.lat, b.lat) - dLat, Math.min(a.lon, b.lon) - dLon,
    Math.max(a.lat, b.lat) + dLat, Math.max(a.lon, b.lon) + dLon, budget,
  ) ?? [];
}

export interface KuestenlinienGebiet {
  linien: [Punkt, Punkt][];
  rueckfall: boolean;

  vereinfachtM?: number;
}

export const MAX_STRECKEN_GEBIET = 25_000;

export async function kuestenlinienUmGebiet(
  swLat: number, swLon: number, neLat: number, neLon: number, budget: Zeitbudget = BUDGET_HINTERGRUND,
): Promise<KuestenlinienGebiet | null> {

  const kacheln = await kuesteAusKachelnMitBudget({ swLat, swLon, neLat, neLon }, MAX_STRECKEN_GEBIET);
  if (kacheln) return { linien: kacheln.linien, rueckfall: false, vereinfachtM: kacheln.toleranzM };
  const linien = await fetchKuestenlinien(swLat, swLon, neLat, neLon, budget);
  const { kuestenlinienRueckfall } = await import('./kuestenlinienFallback');
  if (linien !== null && linien.length <= MAX_STRECKEN_GEBIET) return { linien, rueckfall: false };

  const rueckfall = await kuestenlinienRueckfall(swLat, swLon, neLat, neLon);
  if (rueckfall !== null) return { linien: rueckfall, rueckfall: true };
  return linien !== null ? { linien, rueckfall: false } : null;
}
