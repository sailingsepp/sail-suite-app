import type { Fix } from './spur';

export const IMPORT_GENAUIGKEIT_M = 5;

export interface ImportErgebnis {
  fixe: Fix[];

  gelesen: number;
  verworfen: number;

  name?: string;
}

function brauchbar(f: Partial<Fix>): f is Fix {
  return Number.isFinite(f.t) && Number.isFinite(f.lat) && Number.isFinite(f.lon)
    && Math.abs(f.lat as number) <= 90 && Math.abs(f.lon as number) <= 180;
}

function sortiereUndEntdopple(fixe: Fix[]): Fix[] {
  const sortiert = [...fixe].sort((a, b) => a.t - b.t);
  const raus: Fix[] = [];
  for (const f of sortiert) {

    if (raus.length && raus[raus.length - 1]!.t === f.t) continue;
    raus.push(f);
  }
  return raus;
}

export type ImportFehlerArt = 'kein-gpx' | 'keine-spur' | 'kein-rmc' | 'unbekannt';
export class ImportFehler extends Error {
  constructor(readonly art: ImportFehlerArt, text: string) { super(text); this.name = 'ImportFehler'; }
}

export function leseGpxSpur(text: string): ImportErgebnis {
  if (!/<gpx[\s>]/i.test(text)) {
    throw new ImportFehler('kein-gpx', 'Die Datei sieht nicht nach GPX aus.');
  }
  const fixe: Fix[] = [];
  let gelesen = 0;
  let verworfen = 0;

  const punktRegex = /<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt>/gi;
  let m: RegExpExecArray | null;
  while ((m = punktRegex.exec(text)) !== null) {
    gelesen++;
    const attr = m[1] ?? '';
    const inhalt = m[2] ?? '';
    const lat = parseFloat(/\blat\s*=\s*["']([^"']+)["']/i.exec(attr)?.[1] ?? '');
    const lon = parseFloat(/\blon\s*=\s*["']([^"']+)["']/i.exec(attr)?.[1] ?? '');
    const zeitText = /<(?:\w+:)?time>([^<]+)<\/(?:\w+:)?time>/i.exec(inhalt)?.[1]?.trim();

    const t = zeitText ? Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(zeitText) || !zeitText.includes('T') ? zeitText : `${zeitText}Z`) : NaN;
    const kandidat = { t, lat, lon, acc: IMPORT_GENAUIGKEIT_M, quelle: 'import' as const };
    if (brauchbar(kandidat)) fixe.push(kandidat);
    else verworfen++;
  }

  if (gelesen === 0) {
    throw new ImportFehler('keine-spur', 'In der Datei steht keine aufgezeichnete Spur (<trkpt>). '
      + 'Eine geplante Route (<rte>) ist keine Spur.');
  }
  const name = /<(?:\w+:)?trk\b[^>]*>[\s\S]*?<(?:\w+:)?name>([^<]+)<\/(?:\w+:)?name>/i
    .exec(text)?.[1]?.trim();
  return { fixe: sortiereUndEntdopple(fixe), gelesen, verworfen, ...(name ? { name } : {}) };
}

function nmeaGrad(wert: string, richtung: string): number {
  if (!wert) return NaN;
  const punkt = wert.indexOf('.');
  const gradStellen = punkt >= 0 ? punkt - 2 : wert.length - 2;
  if (gradStellen < 1) return NaN;
  const grad = parseInt(wert.slice(0, gradStellen), 10);
  const minuten = parseFloat(wert.slice(gradStellen));
  if (!Number.isFinite(grad) || !Number.isFinite(minuten)) return NaN;
  const v = grad + minuten / 60;
  return /^[SW]$/i.test(richtung) ? -v : v;
}

function pruefsummeOk(satz: string): boolean {
  const stern = satz.lastIndexOf('*');
  if (stern < 0 || stern + 3 > satz.length) return true;
  const soll = parseInt(satz.slice(stern + 1, stern + 3), 16);
  if (!Number.isFinite(soll)) return true;
  let ist = 0;
  for (let i = 1; i < stern; i++) ist ^= satz.charCodeAt(i);
  return ist === soll;
}

export function leseNmeaSpur(text: string): ImportErgebnis {
  const zeilen = text.split(/\r?\n/);
  const fixe: Fix[] = [];
  let gelesen = 0;
  let verworfen = 0;

  for (const roh of zeilen) {
    const zeile = roh.trim();
    if (!/^\$[A-Z]{2}RMC,/i.test(zeile)) continue;
    gelesen++;
    if (!pruefsummeOk(zeile)) { verworfen++; continue; }

    const t = zeile.split('*')[0]!.split(',');
    const [, uhrzeit, status, breite, nS, laenge, eW, fahrtKn, kursGrad, datum] = t;
    if (status !== 'A') { verworfen++; continue; }

    if (!/^\d{6}(\.\d+)?$/.test(uhrzeit ?? '') || !/^\d{6}$/.test(datum ?? '')) { verworfen++; continue; }

    const hh = Number(uhrzeit?.slice(0, 2));
    const mm = Number(uhrzeit?.slice(2, 4));
    const ss = Number(uhrzeit?.slice(4));
    const tag = Number(datum?.slice(0, 2));
    const monat = Number(datum?.slice(2, 4));
    const jahr2 = Number(datum?.slice(4, 6));
    if (![hh, mm, ss, tag, monat, jahr2].every(Number.isFinite)) { verworfen++; continue; }
    const jahr = jahr2 >= 70 ? 1900 + jahr2 : 2000 + jahr2;
    const zeit = Date.UTC(jahr, monat - 1, tag, hh, mm, Math.floor(ss),
      Math.round((ss % 1) * 1000));

    const kandidat: Fix = {
      t: zeit,
      lat: nmeaGrad(breite ?? '', nS ?? ''),
      lon: nmeaGrad(laenge ?? '', eW ?? ''),
      acc: IMPORT_GENAUIGKEIT_M,
      quelle: 'import',
    };

    const kn = parseFloat(fahrtKn ?? '');
    if (Number.isFinite(kn)) kandidat.speed = (kn * 1852) / 3600;
    const kurs = parseFloat(kursGrad ?? '');
    if (Number.isFinite(kurs)) kandidat.heading = kurs;

    if (brauchbar(kandidat)) fixe.push(kandidat);
    else verworfen++;
  }

  if (gelesen === 0) {
    throw new ImportFehler('kein-rmc', 'In der Datei steht kein RMC-Satz. '
      + 'Nur RMC führt Datum, Zeit und Position zusammen.');
  }
  return { fixe: sortiereUndEntdopple(fixe), gelesen, verworfen };
}

export function leseFremdspur(text: string): ImportErgebnis {
  if (/<gpx[\s>]/i.test(text)) return leseGpxSpur(text);
  if (/\$[A-Z]{2}(RMC|GGA|VTG),/i.test(text)) return leseNmeaSpur(text);
  throw new ImportFehler('unbekannt', 'Unbekanntes Format: erwartet wird GPX oder eine NMEA-0183-Mitschrift.');
}
