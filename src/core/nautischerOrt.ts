import type { Punkt } from './types';

export type QuellenId = 'osm' | 'openseamap' | 'skipperguide' | 'emodnet' | 'nutzer';

export type Feldguete = 'A' | 'B' | 'C' | 'D';

export interface Quellenangabe {
  id: QuellenId;

  abgerufen: number;

  stand?: string;
  link?: string;
}

export interface Feldwert<T> {
  wert: T;
  quelle: QuellenId;
  guete: Feldguete;

  roh?: string;
}

export type Quellenlage = 'geliefert' | 'nichts_gefunden' | 'fehlgeschlagen' | 'nicht_gefragt';

export type OrtArt = 'marina' | 'hafen' | 'bucht' | 'boje' | 'poi';

export interface Zugang {
  maxTiefgangM?: Feldwert<number>;
  maxLaengeM?: Feldwert<number>;
  maxBreiteM?: Feldwert<number>;

  durchfahrtshoeheM?: Feldwert<number>;
}

export interface Liegen {
  liegeplaetze?: Feldwert<number>;
  trockenplaetze?: Feldwert<number>;
  mooringBojen?: Feldwert<number>;
  kaimauer?: Feldwert<number>;
  poller?: Feldwert<number>;
  gebuehrenpflichtig?: Feldwert<boolean>;
}

export interface Versorgung {
  strom?: Feldwert<boolean>;
  wasser?: Feldwert<boolean>;
  diesel?: Feldwert<boolean>;
  duschen?: Feldwert<boolean>;
  wc?: Feldwert<boolean>;
  waescherei?: Feldwert<boolean>;
  wlan?: Feldwert<boolean>;
  kran?: Feldwert<boolean>;
  slip?: Feldwert<boolean>;
  werft?: Feldwert<boolean>;
  faekalienannahme?: Feldwert<boolean>;
}

export interface Funk {
  vhfKanal?: Feldwert<string>;
  telefon?: Feldwert<string>;
  email?: Feldwert<string>;
  website?: Feldwert<string>;
}

export interface Seezeichen {
  position: Punkt;
  name?: string;

  art: string;

  kennung?: string;

  farbe?: string;
  periodeS?: number;
  tragweiteNM?: number;
  hoeheM?: number;

  sektorVonDeg?: number;
  sektorBisDeg?: number;
}

export interface NautischerOrt {
  id: string;
  position: Punkt;
  name: string | null;
  art: OrtArt;
  zugang: Zugang;
  liegen: Liegen;
  versorgung: Versorgung;
  funk: Funk;
  seezeichen: Seezeichen[];
  quellen: Quellenangabe[];

  lage: Partial<Record<QuellenId, Quellenlage>>;
}

export function darfEntscheiden(feld: Feldwert<unknown> | undefined): boolean {
  return feld !== undefined && (feld.guete === 'A' || feld.guete === 'B');
}

const GUETE_JE_TAG: Record<string, Feldguete> = {
  vhf: 'B',
  maxdraft: 'C', draft: 'C', maxlength: 'C', maxwidth: 'C',
  'seamark:bridge:clearance_height': 'C', maxheight: 'C',
  capacity: 'C', 'capacity:dry_storage': 'C',
  phone: 'C', email: 'C', website: 'C',
  power_supply: 'C', drinking_water: 'C', shower: 'C', toilets: 'C',
  internet_access: 'C', sanitary_dump_station: 'C', 'harbour:fuel_station': 'C',
  fee: 'D', opening_hours: 'D',
};

function guete(tag: string): Feldguete {
  return GUETE_JE_TAG[tag] ?? 'C';
}

function zahl(roh: string | undefined): number | null {
  if (!roh) return null;

  const treffer = /-?\d+(?:[.,]\d+)?/.exec(roh);
  if (!treffer) return null;
  const n = Number(treffer[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function jaNein(roh: string | undefined): boolean | undefined {
  if (roh === undefined) return undefined;
  const v = roh.trim().toLowerCase();
  if (v === 'yes' || v === 'true' || v === '1') return true;
  if (v === 'no' || v === 'false' || v === '0') return false;

  return v.length > 0 ? true : undefined;
}

function feld<T>(wert: T | null | undefined, tag: string, roh?: string): Feldwert<T> | undefined {
  if (wert === null || wert === undefined) return undefined;
  const f: Feldwert<T> = { wert, quelle: 'osm', guete: guete(tag) };
  if (roh !== undefined && roh !== String(wert)) f.roh = roh;
  return f;
}

function setze<O, K extends keyof O>(ziel: O, schluessel: K, wert: O[K] | undefined): void {
  if (wert !== undefined) ziel[schluessel] = wert;
}

export function ortArtAusTags(tags: Record<string, string>): OrtArt {
  if (tags['leisure'] === 'marina') return 'marina';
  if (tags['seamark:type'] === 'harbour') return 'hafen';
  if (tags['seamark:type'] === 'anchorage' || tags['natural'] === 'bay') return 'bucht';
  if (tags['seamark:type'] === 'mooring') return 'boje';
  return 'poi';
}

export function ortAusOsm(
  id: string, position: Punkt, tags: Record<string, string>, abgerufen: number,
): NautischerOrt {
  const zugang: Zugang = {};

  const tiefgang = [tags['maxdraft'], tags['maxdraught'], tags['draft']]
    .map((r) => ({ n: zahl(r), roh: r }))
    .filter((x): x is { n: number; roh: string } => x.n !== null)
    .sort((a, b) => a.n - b.n)[0];
  if (tiefgang) setze(zugang, 'maxTiefgangM', feld(tiefgang.n, 'maxdraft', tiefgang.roh));
  setze(zugang, 'maxLaengeM', feld(zahl(tags['maxlength']), 'maxlength', tags['maxlength']));
  setze(zugang, 'maxBreiteM', feld(zahl(tags['maxwidth']), 'maxwidth', tags['maxwidth']));
  const hoehe = tags['seamark:bridge:clearance_height'] ?? tags['maxheight'];
  setze(zugang, 'durchfahrtshoeheM', feld(zahl(hoehe), 'seamark:bridge:clearance_height', hoehe));

  const liegen: Liegen = {};
  setze(liegen, 'liegeplaetze', feld(zahl(tags['capacity']), 'capacity', tags['capacity']));
  setze(liegen, 'trockenplaetze', feld(zahl(tags['capacity:dry_storage']), 'capacity:dry_storage', tags['capacity:dry_storage']));
  setze(liegen, 'gebuehrenpflichtig', feld(jaNein(tags['fee']), 'fee', tags['fee']));

  const versorgung: Versorgung = {};
  setze(versorgung, 'strom', feld(jaNein(tags['power_supply']), 'power_supply', tags['power_supply']));
  setze(versorgung, 'wasser', feld(jaNein(tags['drinking_water']), 'drinking_water', tags['drinking_water']));
  setze(versorgung, 'duschen', feld(jaNein(tags['shower']), 'shower', tags['shower']));
  setze(versorgung, 'wc', feld(jaNein(tags['toilets']), 'toilets', tags['toilets']));
  setze(versorgung, 'wlan', feld(jaNein(tags['internet_access']), 'internet_access', tags['internet_access']));
  setze(versorgung, 'diesel', feld(jaNein(tags['harbour:fuel_station']), 'harbour:fuel_station', tags['harbour:fuel_station']));
  setze(versorgung, 'faekalienannahme', feld(jaNein(tags['sanitary_dump_station']), 'sanitary_dump_station', tags['sanitary_dump_station']));

  const funk: Funk = {};

  setze(funk, 'vhfKanal', feld(tags['vhf'], 'vhf'));
  setze(funk, 'telefon', feld(tags['phone'], 'phone'));
  setze(funk, 'email', feld(tags['email'], 'email'));
  setze(funk, 'website', feld(tags['website'], 'website'));

  const quelle: Quellenangabe = { id: 'osm', abgerufen };
  if (tags['check_date']) quelle.stand = tags['check_date'];

  return {
    id,
    position,
    name: tags['name'] ?? tags['seamark:name'] ?? null,
    art: ortArtAusTags(tags),
    zugang, liegen, versorgung, funk,
    seezeichen: [],
    quellen: [quelle],
    lage: { osm: 'geliefert' },
  };
}

const FACILITY_FELD: Record<string, keyof Versorgung> = {
  fuel_station: 'diesel',
  boat_hoist: 'kran',
  crane: 'kran',
  slipway: 'slip',
  boatyard: 'werft',
  toilets: 'wc',
  showers: 'duschen',
  laundrette: 'waescherei',
  water: 'wasser',
  electricity: 'strom',
  sewerage_disposal: 'faekalienannahme',

};

export function ergaenzeVersorgung(ort: NautischerOrt, kategorien: string[]): NautischerOrt {
  const versorgung: Versorgung = { ...ort.versorgung };
  for (const roh of kategorien) {
    for (const teil of roh.split(';')) {
      const schluessel = FACILITY_FELD[teil.trim()];
      if (!schluessel) continue;

      if (versorgung[schluessel] !== undefined) continue;
      (versorgung as Record<string, Feldwert<boolean>>)[schluessel] =
        { wert: true, quelle: 'osm', guete: 'C', roh: teil.trim() };
    }
  }
  return { ...ort, versorgung };
}

export function seezeichenAusOsm(position: Punkt, tags: Record<string, string>): Seezeichen | null {

  const p = (name: string): string | undefined =>
    tags[`seamark:light:${name}`] ?? tags[`seamark:light:1:${name}`];

  const kennung = p('character');
  const farbe = p('colour');
  if (!kennung && !farbe) return null;

  const art = tags['seamark:type'] ?? 'light_minor';
  const z: Seezeichen = { position, art };
  const name = tags['seamark:name'] ?? tags['name'];
  if (name) z.name = name;
  if (kennung) z.kennung = kennung;
  if (farbe) z.farbe = farbe;
  const periode = zahl(p('period'));
  if (periode !== null) z.periodeS = periode;
  const tragweite = zahl(p('range'));
  if (tragweite !== null) z.tragweiteNM = tragweite;
  const hoehe = zahl(p('height'));
  if (hoehe !== null) z.hoeheM = hoehe;
  const von = zahl(p('sector_start'));
  if (von !== null) z.sektorVonDeg = von;
  const bis = zahl(p('sector_end'));
  if (bis !== null) z.sektorBisDeg = bis;
  return z;
}

export interface Zusammengefuehrt<T> {

  massgeblich: Feldwert<T>;

  alle: Feldwert<T>[];

  widersprueche: boolean;
}

export function zusammenfuehren(
  werte: (Feldwert<number> | undefined)[],
  richtung: 'kleiner_ist_unguenstiger' | 'groesser_ist_unguenstiger',
): Zusammengefuehrt<number> | null {
  const vorhanden = werte.filter((w): w is Feldwert<number> => w !== undefined);
  if (!vorhanden.length) return null;
  const sortiert = [...vorhanden].sort((a, b) =>
    richtung === 'kleiner_ist_unguenstiger' ? a.wert - b.wert : b.wert - a.wert);
  return {
    massgeblich: sortiert[0]!,
    alle: vorhanden,
    widersprueche: vorhanden.some((w) => w.wert !== vorhanden[0]!.wert),
  };
}
