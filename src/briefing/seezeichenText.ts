import type { Sprache } from '@/core/types';
import { farbWort } from './feuerText';

export interface ObjektZeile { titel: string; text: string }
export interface ObjektSteckbrief { titel: string; art: string | null; zeilen: ObjektZeile[] }

type Tags = Readonly<Record<string, string>>;
type T = { de: string; en: string };
const w = (x: T | undefined, s: Sprache, roh: string) => (x ? x[s] : roh);
const gross = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
const zeile = (z: ObjektZeile[], titel: T, text: string | null | undefined, s: Sprache) => { if (text) z.push({ titel: titel[s], text }); };

function meter(roh: string | undefined, s: Sprache): string | null {
  const t = roh?.trim();
  if (!t) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*(m)?$/.exec(t);
  return m ? `${s === 'de' ? m[1]!.replace('.', ',') : m[1]!.replace(',', '.')} m` : t;
}

function groessterTiefgang(tags: Tags, s: Sprache): string | null {
  const werte = [tags['maxdraught'], tags['maxdraft']].filter((x): x is string => !!x?.trim());
  if (!werte.length) return null;
  const zahl = (x: string) => { const n = parseFloat(x.replace(',', '.')); return Number.isFinite(n) ? n : Infinity; };
  return meter([...werte].sort((a, b) => zahl(a) - zahl(b))[0], s);
}

const ART: Record<string, T> = {
  buoy_lateral: { de: 'Lateraltonne', en: 'lateral buoy' }, beacon_lateral: { de: 'Lateralbake', en: 'lateral beacon' },
  buoy_cardinal: { de: 'Kardinaltonne', en: 'cardinal buoy' }, beacon_cardinal: { de: 'Kardinalbake', en: 'cardinal beacon' },
  buoy_isolated_danger: { de: 'Einzelgefahrentonne', en: 'isolated danger buoy' }, beacon_isolated_danger: { de: 'Einzelgefahrenbake', en: 'isolated danger beacon' },
  buoy_safe_water: { de: 'Ansteuerungstonne', en: 'safe water buoy' }, beacon_safe_water: { de: 'Ansteuerungsbake', en: 'safe water beacon' },
  buoy_special_purpose: { de: 'Sondertonne', en: 'special purpose buoy' }, beacon_special_purpose: { de: 'Sonderbake', en: 'special purpose beacon' },
  rock: { de: 'Fels', en: 'rock' }, wreck: { de: 'Wrack', en: 'wreck' }, obstruction: { de: 'Hindernis', en: 'obstruction' },
};

export const TONNEN_TYPEN: readonly string[] = Object.keys(ART).filter((k) => k.startsWith('buoy_') || k.startsWith('beacon_'));
export const GEFAHR_TYPEN: readonly string[] = ['rock', 'wreck', 'obstruction'];

const BEDEUTUNG: Record<string, T> = {
  port: { de: 'Backbordzeichen: in Betonnungsrichtung (von See kommend) an Backbord lassen', en: 'port-hand mark: leave to port in the direction of buoyage (coming from seaward)' },
  starboard: { de: 'Steuerbordzeichen: in Betonnungsrichtung (von See kommend) an Steuerbord lassen', en: 'starboard-hand mark: leave to starboard in the direction of buoyage (coming from seaward)' },
  preferred_channel_starboard: { de: 'Abzweigung: bevorzugtes Fahrwasser an Steuerbord', en: 'channel division: preferred channel to starboard' },
  preferred_channel_port: { de: 'Abzweigung: bevorzugtes Fahrwasser an Backbord', en: 'channel division: preferred channel to port' },
  north: { de: 'Nord-Kardinal: befahrbares Wasser im Norden, nördlich passieren', en: 'north cardinal: navigable water to the north, pass north of it' },
  east: { de: 'Ost-Kardinal: befahrbares Wasser im Osten, östlich passieren', en: 'east cardinal: navigable water to the east, pass east of it' },
  south: { de: 'Süd-Kardinal: befahrbares Wasser im Süden, südlich passieren', en: 'south cardinal: navigable water to the south, pass south of it' },
  west: { de: 'West-Kardinal: befahrbares Wasser im Westen, westlich passieren', en: 'west cardinal: navigable water to the west, pass west of it' },
  isolated_danger: { de: 'Steht auf einer Einzelgefahr, rundum befahrbares Wasser: Abstand halten', en: 'marks an isolated danger with navigable water all round: keep clear' },
  safe_water: { de: 'Rundum befahrbares Wasser (Fahrwassermitte oder Ansteuerung)', en: 'navigable water all round (mid-channel or landfall)' },
  special_purpose: { de: 'Sonderzeichen: besonderes Gebiet oder Objekt (etwa Sperrgebiet, Badezone, Kabel, Regattabahn), Bedeutung aus der Seekarte', en: 'special mark: a special area or feature (such as a restricted area, bathing zone, cable, racing course), see the chart' },
};
const FORM: Record<string, T> = {
  can: { de: 'Stumpftonne', en: 'can' }, conical: { de: 'Spitztonne', en: 'conical' }, spherical: { de: 'Kugeltonne', en: 'spherical' },
  pillar: { de: 'Bakentonne (Pfeiler)', en: 'pillar' }, spar: { de: 'Spierentonne', en: 'spar' }, barrel: { de: 'Fasstonne', en: 'barrel' },
  'super-buoy': { de: 'Großtonne', en: 'super-buoy' }, stake: { de: 'Stange', en: 'stake' }, pole: { de: 'Stange', en: 'pole' },
  tower: { de: 'Turm', en: 'tower' }, lattice: { de: 'Gittermast', en: 'lattice' }, pile: { de: 'Pfahl', en: 'pile' }, cairn: { de: 'Steinhaufen', en: 'cairn' },
};
const TOPP: Record<string, T> = {
  'cone, point up': { de: 'Kegel, Spitze oben', en: 'cone, point up' }, 'cone, point down': { de: 'Kegel, Spitze unten', en: 'cone, point down' },
  '2 cones up': { de: 'zwei Kegel, Spitzen oben', en: 'two cones, points up' }, '2 cones down': { de: 'zwei Kegel, Spitzen unten', en: 'two cones, points down' },
  '2 cones base together': { de: 'zwei Kegel, Grundflächen zueinander', en: 'two cones, bases together' },
  '2 cones point together': { de: 'zwei Kegel, Spitzen zueinander', en: 'two cones, points together' },
  sphere: { de: 'Kugel', en: 'sphere' }, '2 spheres': { de: 'zwei Kugeln', en: 'two spheres' }, cylinder: { de: 'Zylinder', en: 'cylinder' },
  'x-shape': { de: 'liegendes Kreuz', en: 'x-shape' }, cross: { de: 'Kreuz', en: 'cross' }, board: { de: 'Tafel', en: 'board' },
};
const MUSTER: Record<string, T> = {
  horizontal: { de: 'waagrecht gestreift', en: 'horizontal bands' }, vertical: { de: 'senkrecht gestreift', en: 'vertical stripes' },
  diagonal: { de: 'schräg gestreift', en: 'diagonal stripes' }, squared: { de: 'kariert', en: 'squared' }, border: { de: 'Rand', en: 'border' },
};

const KOERPER: Record<string, T> = {
  black: { de: 'schwarz', en: 'black' }, grey: { de: 'grau', en: 'grey' }, brown: { de: 'braun', en: 'brown' }, pink: { de: 'rosa', en: 'pink' },
};
const farbe = (c: string, s: Sprache) => KOERPER[c]?.[s] ?? farbWort(c, s);

function farben(tags: Tags, praefix: string, s: Sprache): string | null {
  const c = tags[`${praefix}:colour`];
  if (!c) return null;
  const muster = tags[`${praefix}:colour_pattern`];
  const f = c.split(';').map((x) => farbe(x.trim(), s)).join(', ');
  return muster ? `${f} (${w(MUSTER[muster], s, muster)})` : f;
}

export function tonneSteckbrief(tags: Tags, s: Sprache): ObjektSteckbrief {
  const typ = tags['seamark:type'] ?? '';
  const kategorie = tags[`seamark:${typ}:category`];
  const bedeutungsSchluessel = typ.endsWith('isolated_danger') ? 'isolated_danger' : typ.endsWith('safe_water') ? 'safe_water'
    : typ.endsWith('special_purpose') ? 'special_purpose' : kategorie ?? '';
  const art = gross(w(ART[typ], s, typ));
  const z: ObjektZeile[] = [];
  zeile(z, { de: 'Bedeutung', en: 'Meaning' }, BEDEUTUNG[bedeutungsSchluessel]?.[s] ?? (kategorie ?? null), s);
  const form = tags[`seamark:${typ}:shape`];
  zeile(z, { de: 'Form', en: 'Shape' }, form ? w(FORM[form], s, form) : null, s);
  zeile(z, { de: 'Farbe', en: 'Colour' }, farben(tags, `seamark:${typ}`, s), s);
  const topp = tags['seamark:topmark:shape'];
  if (topp) zeile(z, { de: 'Toppzeichen', en: 'Topmark' }, `${w(TOPP[topp], s, topp)}${tags['seamark:topmark:colour'] ? `, ${farben(tags, 'seamark:topmark', s)}` : ''}`, s);
  zeile(z, { de: 'Hinweis', en: 'Note' }, tags['seamark:information'] ?? tags['seamark:information:en'], s);
  const titel = tags['seamark:name']?.trim() || tags['name']?.trim() || art;
  return { titel, art: titel === art ? null : art, zeilen: z };
}

const WASSERSTAND: Record<string, T> = {
  'part-submerged': { de: 'bei Hochwasser teilweise unter Wasser', en: 'partly submerged at high water' },
  dry: { de: 'immer trocken', en: 'always dry' }, always_dry: { de: 'immer trocken', en: 'always dry' },
  submerged: { de: 'immer unter Wasser', en: 'always under water' }, always_under_water: { de: 'immer unter Wasser', en: 'always under water' },
  covers: { de: 'fällt trocken und wird überspült', en: 'covers and uncovers' }, awash: { de: 'an der Wasseroberfläche (wäscht über)', en: 'awash' },
  floods: { de: 'wird überflutet', en: 'subject to flooding' }, floating: { de: 'schwimmend', en: 'floating' },
  above_mwl: { de: 'über mittlerem Wasserstand', en: 'above mean water level' }, below_mwl: { de: 'unter mittlerem Wasserstand', en: 'below mean water level' },
};
const WRACK: Record<string, T> = {
  'non-dangerous': { de: 'nicht gefährlich', en: 'non-dangerous' }, dangerous: { de: 'gefährlich', en: 'dangerous' },
  distributed_remains: { de: 'verstreute Wrackteile', en: 'distributed remains' }, mast_showing: { de: 'Masten sichtbar', en: 'mast showing' },
  hull_showing: { de: 'Rumpf sichtbar', en: 'hull showing' },
};
const HINDERNIS: Record<string, T> = {
  foul_ground: { de: 'unreiner Grund', en: 'foul ground' }, foul_area: { de: 'unreines Gebiet', en: 'foul area' },
  fish_haven: { de: 'künstliches Riff', en: 'fish haven' }, ground_tackle: { de: 'Ankergeschirr', en: 'ground tackle' },
  wellhead: { de: 'Bohrlochkopf', en: 'wellhead' }, diffuser: { de: 'Auslass', en: 'diffuser' }, stump: { de: 'Baumstumpf', en: 'stump' },
  boom: { de: 'Sperre (Schwimmbaum)', en: 'boom' }, ice_boom: { de: 'Eissperre', en: 'ice boom' }, crib: { de: 'Steinkasten', en: 'crib' },
};

export function gefahrSteckbrief(art: string, name: string, tags: Tags, s: Sprache): ObjektSteckbrief {
  const a = gross(w(ART[art], s, art));
  const z: ObjektZeile[] = [];
  const stand = tags[`seamark:${art}:water_level`];
  zeile(z, { de: 'Wasserstand', en: 'Water level' }, stand ? w(WASSERSTAND[stand], s, stand) : null, s);
  const kat = tags[`seamark:${art}:category`];
  if (kat) zeile(z, { de: 'Kategorie', en: 'Category' }, w((art === 'wreck' ? WRACK : HINDERNIS)[kat], s, kat), s);
  const tiefe = tags[`seamark:${art}:depth`] ?? tags['depth'];
  zeile(z, { de: 'Tiefe darüber', en: 'Depth over it' }, tiefe ? `${tiefe.replace('.', s === 'de' ? ',' : '.')} m` : null, s);
  zeile(z, { de: 'Hinweis', en: 'Note' }, tags['seamark:information'] ?? tags['description'], s);
  const titel = name.trim() || a;
  return { titel, art: titel === a ? null : a, zeilen: z };
}

const HAFENART: Record<string, T> = {
  marina: { de: 'Marina', en: 'marina' }, marina_no_facilities: { de: 'Marina ohne Versorgung', en: 'marina without facilities' },
  fishing: { de: 'Fischereihafen', en: 'fishing harbour' }, ferry: { de: 'Fährhafen', en: 'ferry harbour' },
  container: { de: 'Containerhafen', en: 'container harbour' }, roro: { de: 'Ro-Ro-Hafen', en: 'ro-ro harbour' },
  bulk: { de: 'Massenguthafen', en: 'bulk harbour' }, tanker: { de: 'Tankerhafen', en: 'tanker harbour' },
  cargo: { de: 'Handelshafen', en: 'cargo harbour' }, naval: { de: 'Marinehafen', en: 'naval harbour' },
  military: { de: 'Militärhafen', en: 'military harbour' }, passenger: { de: 'Passagierhafen', en: 'passenger harbour' },
  harbour: { de: 'Hafen', en: 'harbour' },
};
const DIENST: Record<string, T> = {
  fuel_station: { de: 'Tankstelle', en: 'fuel' }, water_tap: { de: 'Wasser', en: 'water' }, electricity: { de: 'Strom', en: 'electricity' },
  toilets: { de: 'Toiletten', en: 'toilets' }, showers: { de: 'Duschen', en: 'showers' }, slipway: { de: 'Slipanlage', en: 'slipway' },
  boat_hoist: { de: 'Kran', en: 'boat hoist' }, boatyard: { de: 'Werft', en: 'boatyard' }, chandler: { de: 'Bootszubehör', en: 'chandler' },
  provisions: { de: 'Proviant', en: 'provisions' }, refuse_bin: { de: 'Müll', en: 'refuse' }, pharmacy: { de: 'Apotheke', en: 'pharmacy' },
  visitor_berth: { de: 'Gastliegeplätze', en: 'visitor berths' }, pump_out: { de: 'Fäkalienabsaugung', en: 'pump-out' },
  restaurant: { de: 'Restaurant', en: 'restaurant' },
};

export function diensteVon(tags: Tags): string[] {
  const d = new Set<string>();
  for (const x of (tags['seamark:small_craft_facility:category'] ?? '').split(';')) if (x.trim()) d.add(x.trim() === 'shower' ? 'showers' : x.trim());
  if (tags['waterway'] === 'fuel' || tags['amenity'] === 'fuel') d.add('fuel_station');
  if (tags['waterway'] === 'water_point' || tags['amenity'] === 'drinking_water') d.add('water_tap');
  if (tags['amenity'] === 'toilets') d.add('toilets');
  if (tags['amenity'] === 'shower') d.add('showers');
  if (tags['leisure'] === 'slipway') d.add('slipway');
  if (tags['waterway'] === 'boatyard') d.add('boatyard');
  if (tags['power_supply'] === 'yes') d.add('electricity');
  if (tags['sanitary_dump_station'] === 'yes') d.add('pump_out');
  return [...d];
}

export function hafenSteckbrief(tags: Tags, dienste: readonly string[], s: Sprache): ObjektSteckbrief {
  const kat = tags['seamark:harbour:category'] ?? (tags['leisure'] === 'marina' ? 'marina' : 'harbour');
  const art = gross(w(HAFENART[kat], s, kat));
  const z: ObjektZeile[] = [];
  zeile(z, { de: 'UKW', en: 'VHF' }, tags['vhf'] ?? tags['contact:vhf'] ?? tags['seamark:radio_station:channel'], s);
  zeile(z, { de: 'Telefon', en: 'Phone' }, tags['phone'] ?? tags['contact:phone'], s);
  zeile(z, { de: 'Liegeplätze', en: 'Berths' }, tags['capacity'], s);
  zeile(z, { de: 'Länge bis', en: 'Max. length' }, tags['maxlength'] ? `${tags['maxlength']} m` : null, s);
  zeile(z, { de: 'Tiefgang bis', en: 'Max. draught' }, groessterTiefgang(tags, s), s);
  zeile(z, { de: 'Wassertiefe', en: 'Water depth' }, meter(tags['depth'], s), s);
  const alle = [...new Set([...dienste, ...diensteVon(tags)])].filter((d) => DIENST[d]).map((d) => DIENST[d]![s]);
  zeile(z, { de: 'Versorgung', en: 'Facilities' }, alle.length ? alle.join(', ') : null, s);
  zeile(z, { de: 'Betreiber', en: 'Operator' }, tags['operator'], s);
  zeile(z, { de: 'Website', en: 'Website' }, tags['website'] ?? tags['contact:website'], s);
  const titel = tags['name']?.trim() || tags['seamark:name']?.trim() || art;
  return { titel, art: titel === art ? null : art, zeilen: z };
}

export function tankstelleSteckbrief(tags: Tags, s: Sprache): ObjektSteckbrief {
  const art = s === 'de' ? 'Tankstelle' : 'Fuel station';
  const z: ObjektZeile[] = [];
  const ja = (k: string) => tags[k] === 'yes';
  const sorten = [ja('fuel:diesel') ? 'Diesel' : null, Object.keys(tags).some((k) => /^fuel:(octane_\d+|gasoline|e5|e10)$/.test(k) && tags[k] === 'yes') ? (s === 'de' ? 'Benzin' : 'petrol') : null].filter(Boolean);
  zeile(z, { de: 'Kraftstoff', en: 'Fuel' }, sorten.length ? sorten.join(', ') : null, s);
  zeile(z, { de: 'Öffnungszeiten', en: 'Opening hours' }, tags['opening_hours'], s);
  zeile(z, { de: 'Telefon', en: 'Phone' }, tags['phone'] ?? tags['contact:phone'], s);
  zeile(z, { de: 'Marke', en: 'Brand' }, tags['name'] && tags['brand'] && tags['brand'] !== tags['name'] ? tags['brand'] : null, s);
  const titel = tags['name']?.trim() || tags['brand']?.trim() || art;
  return { titel, art: titel === art ? null : art, zeilen: z };
}
