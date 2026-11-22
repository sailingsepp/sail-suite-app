import { distNM } from '@/core/geo';
import type { Punkt, Sprache } from '@/core/types';
import { findAnkerplatzName, findInselName } from './overpass';
import { reverseOrtKomponenten, reverseOrtKomponentenDe } from './geocode';
import { uebersetzeInsEnglische } from './translate';
import { holeUeberServer } from './fremdProxy';

export interface SkipperGuideEintrag {

  text: string;

  quelle: string;

  stand: string | null;

  textSprache?: Sprache;
}

export type SkipperGuideLage =

  | 'treffer'

  | 'kein-eintrag'

  | 'fehlgeschlagen';

export interface SkipperGuideSuche {
  eintrag: SkipperGuideEintrag | null;
  lage: SkipperGuideLage;
}

const SCHWELLE_NM = 2;

const TREFFER_JE_BEGRIFF = 3;
const MAX_KANDIDATEN = 6;

export function diakritikaFalten(s: string): string {

  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const NICHT_LATEINISCH = /[Ͱ-ϿЀ-ӿ֐-׿؀-ۿ]/;

export function istLateinschrift(s: string): boolean {
  return !NICHT_LATEINISCH.test(s);
}

const KOORD_RE_DMS = /(\d{1,3})_(\d{1,2}(?:[.,]\d+)?)_([NS])_(\d{1,3})_(\d{1,2}(?:[.,]\d+)?)_([EW])/;

const KOORD_RE_DEZ = /(\d{1,3}[.,]\d+)_([NS])_(\d{1,3}[.,]\d+)_([EW])/;

export function parseKoordinate(text: string): Punkt | null {
  const dms = KOORD_RE_DMS.exec(text);
  if (dms) {
    const [, latDeg, latMin, latH, lonDeg, lonMin, lonH] = dms;
    const lat = Number(latDeg) + Number(latMin!.replace(',', '.')) / 60;
    const lon = Number(lonDeg) + Number(lonMin!.replace(',', '.')) / 60;
    return { lat: latH === 'S' ? -lat : lat, lon: lonH === 'W' ? -lon : lon };
  }
  const dez = KOORD_RE_DEZ.exec(text);
  if (dez) {
    const [, latStr, latH, lonStr, lonH] = dez;
    const lat = Number(latStr!.replace(',', '.'));
    const lon = Number(lonStr!.replace(',', '.'));
    return { lat: latH === 'S' ? -lat : lat, lon: lonH === 'W' ? -lon : lon };
  }
  return null;
}

export interface WikiAbschnitt {

  titel: string | null;
  text: string;
}

const HEADING_RE = /^(={2,4})\s*(.+?)\s*\1\s*$/gm;

export function zerlegeAbschnitte(wikitext: string): WikiAbschnitt[] {
  const abschnitte: WikiAbschnitt[] = [];
  const treffer: { titel: string; start: number; textStart: number }[] = [];
  HEADING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADING_RE.exec(wikitext))) {
    treffer.push({ titel: m[2]!.trim(), start: m.index, textStart: m.index + m[0].length });
  }
  const introEnde = treffer.length ? treffer[0]!.start : wikitext.length;
  if (wikitext.slice(0, introEnde).trim()) abschnitte.push({ titel: null, text: wikitext.slice(0, introEnde) });
  for (let i = 0; i < treffer.length; i++) {
    const ende = i + 1 < treffer.length ? treffer[i + 1]!.start : wikitext.length;
    abschnitte.push({ titel: treffer[i]!.titel, text: wikitext.slice(treffer[i]!.textStart, ende) });
  }
  return abschnitte;
}

export function saeubereWikitext(text: string): string {
  let t = text;
  t = t.replace(/<gallery[\s\S]*?<\/gallery>/gi, '');
  t = t.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  t = t.replace(/<!--[\s\S]*?-->/g, '');

  for (let i = 0; i < 2; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  t = t.replace(/\[\[(?:Kategorie|Category|Bild|Image|Datei|File):[^\]]*\]\]/gi, '');
  t = t.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2');
  t = t.replace(/\[\[([^\]]*)\]\]/g, '$1');
  t = t.replace(/\[(https?:\/\/\S+)\s+([^\]]*)\]/g, '$2');
  t = t.replace(/\[(https?:\/\/\S+)\]/g, '');
  t = t.replace(/'''''([^']*)'''''/g, '$1');
  t = t.replace(/'''([^']*)'''/g, '$1');
  t = t.replace(/''([^']*)''/g, '$1');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

export interface SkipperGuideTreffer {
  seite: string;
  titel: string;
  text: string;
  distanzNM: number;
}

const MAX_ZEICHEN = 1200;

export function kuerzeAufSatzgrenze(text: string, maxLaenge = MAX_ZEICHEN): string {
  if (text.length <= maxLaenge) return text;
  const ausschnitt = text.slice(0, maxLaenge);
  const grenze = Math.max(ausschnitt.lastIndexOf('. '), ausschnitt.lastIndexOf('.\n'));
  return grenze > maxLaenge * 0.5 ? `${text.slice(0, grenze + 1).trim()} …` : `${ausschnitt.trim()} …`;
}

export function findeNaechstenAbschnitt(
  seiten: { titel: string; wikitext: string }[], ziel: Punkt,
): SkipperGuideTreffer | null {
  let bester: { seite: string; titel: string; rohtext: string; distanzNM: number } | null = null;
  for (const seite of seiten) {
    for (const a of zerlegeAbschnitte(seite.wikitext)) {
      const koord = parseKoordinate(a.text);
      if (!koord) continue;
      const d = distNM(ziel.lat, ziel.lon, koord.lat, koord.lon);
      if (d > SCHWELLE_NM) continue;
      if (!bester || d < bester.distanzNM) {
        bester = { seite: seite.titel, titel: a.titel ?? seite.titel, rohtext: a.text, distanzNM: d };
      }
    }
  }
  if (!bester) return null;

  let rohtext = bester.rohtext;
  if (bester.titel === bester.seite) {
    const seite = seiten.find((s) => s.titel === bester!.seite)!;
    const liege = zerlegeAbschnitte(seite.wikitext).find((a) => /^liegem/i.test(a.titel ?? ''));
    if (liege) rohtext = liege.text;
  }
  const sauber = kuerzeAufSatzgrenze(saeubereWikitext(rohtext));
  if (!sauber) return null;
  return { seite: bester.seite, titel: bester.titel, distanzNM: bester.distanzNM, text: sauber };
}

const API = 'https://www.skipperguide.de/api.php';

async function apiGet(params: Record<string, string>): Promise<unknown> {
  const url = `${API}?${new URLSearchParams({ ...params, format: 'json', origin: '*' }).toString()}`;
  const res = await holeUeberServer(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`SkipperGuide-Anfrage fehlgeschlagen (${res.status})`);
  return res.json();
}

interface SucheAntwort { query?: { search?: { title: string }[] } }
interface SeiteAntwort {
  query: { pages: Record<string, { revisions?: { timestamp: string; slots: { main: { '*': string } } }[] }> };
}

async function sucheKandidatenTitel(begriff: string): Promise<string[]> {
  const [voll, praefix] = await Promise.all([
    apiGet({ action: 'query', list: 'search', srsearch: begriff, srlimit: String(TREFFER_JE_BEGRIFF) })
      .then((roh) => (roh as SucheAntwort).query?.search?.map((s) => s.title) ?? [])
      .catch(() => [] as string[]),
    apiGet({ action: 'opensearch', search: begriff, limit: String(TREFFER_JE_BEGRIFF) })
      .then((roh) => ((roh as [string, string[], string[], string[]])[1]) ?? [])
      .catch(() => [] as string[]),
  ]);
  return [...new Set([...voll, ...praefix])];
}

async function holeSeite(titel: string): Promise<{ wikitext: string; stand: string } | null> {
  const roh = await apiGet({ action: 'query', titles: titel, prop: 'revisions', rvprop: 'content|timestamp', rvslots: 'main' });
  const j = roh as SeiteAntwort;
  const rev = Object.values(j.query.pages)[0]?.revisions?.[0];
  return rev ? { wikitext: rev.slots.main['*'], stand: rev.timestamp } : null;
}

export function formatStand(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export interface InselAbschnitt {

  name: string;
  ort: Punkt;

  text: string;
}

export interface InselAbschnitte {
  seite: string;
  quelle: string;
  stand: string | null;
  orte: InselAbschnitt[];
}

export function abschnitteMitKoordinate(seitentitel: string, wikitext: string): InselAbschnitt[] {
  const orte: InselAbschnitt[] = [];
  for (const a of zerlegeAbschnitte(wikitext)) {
    const koord = parseKoordinate(a.text);
    if (!koord) continue;
    const text = kuerzeAufSatzgrenze(saeubereWikitext(a.text));
    if (!text) continue;
    orte.push({ name: a.titel ?? seitentitel, ort: koord, text });
  }
  return orte;
}

export async function holeInselAbschnitte(seitentitel: string): Promise<InselAbschnitte | null> {
  try {
    return await holeInselAbschnitteOderWirf(seitentitel);
  } catch {
    return null;
  }
}

export async function holeInselAbschnitteOderWirf(seitentitel: string): Promise<InselAbschnitte | null> {
  const seite = await holeSeite(seitentitel);
  if (!seite) return null;
  const orte = abschnitteMitKoordinate(seitentitel, seite.wikitext);
  const quelle = `https://www.skipperguide.de/wiki/${encodeURIComponent(seitentitel.replace(/ /g, '_'))}`;
  return { seite: seitentitel, quelle, stand: formatStand(seite.stand), orte };
}

export async function sucheSkipperGuideEintrag(
  ziel: Punkt,
  sprache: Sprache = 'de',

  zusatzNamen?: Promise<(string | null | undefined)[]> | (string | null | undefined)[],
): Promise<SkipperGuideSuche> {
  try {
    const zusatz = zusatzNamen
      ? await Promise.resolve(zusatzNamen).catch(() => [] as (string | null | undefined)[])
      : [];
    const [anker, orteEn, orteDe] = await Promise.all([
      findAnkerplatzName(ziel).catch(() => null),
      reverseOrtKomponenten(ziel).catch(() => ({ ort: null, insel: null, gemeinde: null })),

      reverseOrtKomponentenDe(ziel).catch(() => ({ ort: null, insel: null, gemeinde: null })),
    ]);

    const inselNamen = (!orteDe.insel && !orteEn.insel)
      ? await findInselName(ziel).catch(() => [])
      : [];

    const basisNamen = [
      anker?.name,
      orteDe.ort, orteDe.insel, orteDe.gemeinde,
      orteEn.ort, orteEn.insel, orteEn.gemeinde,
      ...inselNamen,

      ...zusatz,
    ].filter((n): n is string => !!n && istLateinschrift(n));

    if (basisNamen.length === 0) return { eintrag: null, lage: 'fehlgeschlagen' };

    const suchbegriffe = [...new Set(basisNamen.flatMap((n) => [n, diakritikaFalten(n)]))];

    const titelSet = new Set<string>();
    for (const begriff of suchbegriffe) {
      for (const t of await sucheKandidatenTitel(begriff)) titelSet.add(t);
      if (titelSet.size >= MAX_KANDIDATEN) break;
    }
    if (titelSet.size === 0) return { eintrag: null, lage: 'kein-eintrag' };

    const geladen = await Promise.all(
      [...titelSet].slice(0, MAX_KANDIDATEN).map(async (titel) => ({ titel, seite: await holeSeite(titel) })),
    );
    const seiten = geladen
      .filter((g): g is { titel: string; seite: { wikitext: string; stand: string } } => !!g.seite)
      .map((g) => ({ titel: g.titel, wikitext: g.seite.wikitext }));
    if (seiten.length === 0) return { eintrag: null, lage: 'kein-eintrag' };

    const treffer = findeNaechstenAbschnitt(seiten, ziel);
    if (!treffer) return { eintrag: null, lage: 'kein-eintrag' };

    const standRoh = geladen.find((g) => g.titel === treffer.seite)?.seite?.stand;
    const quelle = `https://www.skipperguide.de/wiki/${encodeURIComponent(treffer.seite.replace(/ /g, '_'))}`;
    const stand = standRoh ? formatStand(standRoh) : null;

    if (sprache === 'en') {
      const uebersetzt = await uebersetzeInsEnglische(treffer.text);
      if (uebersetzt) {
        return { eintrag: { text: uebersetzt, quelle, stand, textSprache: 'en' }, lage: 'treffer' };
      }
    }
    return { eintrag: { text: treffer.text, quelle, stand, textSprache: 'de' }, lage: 'treffer' };
  } catch {

    return { eintrag: null, lage: 'fehlgeschlagen' };
  }
}
