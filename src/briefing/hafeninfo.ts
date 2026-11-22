import { nf } from '@/core/time';
import { escapeHtml } from '@/core/html';
import type { Sprache } from '@/core/types';
import type {
  Feldwert, NautischerOrt, Seezeichen, Versorgung,
} from '@/core/nautischerOrt';

export interface HafensteckbriefEingabe {
  ort: NautischerOrt;

  tiefgangM?: number;
}

const KENNUNG_NAME: Record<string, { de: string; en: string }> = {
  F: { de: 'Festfeuer', en: 'fixed' },
  Fl: { de: 'Blitzfeuer', en: 'flashing' },
  LFl: { de: 'Blitzfeuer lang', en: 'long flashing' },
  Q: { de: 'Funkelfeuer', en: 'quick' },
  VQ: { de: 'schnelles Funkelfeuer', en: 'very quick' },
  UQ: { de: 'sehr schnelles Funkelfeuer', en: 'ultra quick' },
  Iso: { de: 'Gleichtaktfeuer', en: 'isophase' },
  Oc: { de: 'unterbrochenes Feuer', en: 'occulting' },
  Mo: { de: 'Morsefeuer', en: 'morse' },
  Al: { de: 'Wechselfeuer', en: 'alternating' },
};

const FARB_KUERZEL: Record<string, string> = {
  red: 'R', green: 'G', white: 'W', yellow: 'Y', orange: 'Or',
  blue: 'Bu', violet: 'Vi', amber: 'Am',
};

const FARB_NAME: Record<string, { de: string; en: string }> = {
  red: { de: 'rot', en: 'red' },
  green: { de: 'grün', en: 'green' },
  white: { de: 'weiß', en: 'white' },
  yellow: { de: 'gelb', en: 'yellow' },
  orange: { de: 'orange', en: 'orange' },
  blue: { de: 'blau', en: 'blue' },
  violet: { de: 'violett', en: 'violet' },
  amber: { de: 'bernstein', en: 'amber' },
};

export function feuerKennung(z: Seezeichen, sprache: Sprache): string {
  const teile: string[] = [];
  if (z.kennung) teile.push(z.kennung);
  if (z.farbe) teile.push(FARB_KUERZEL[z.farbe] ?? z.farbe);
  if (z.periodeS !== undefined) teile.push(`${nf(z.periodeS, 0, sprache)}s`);
  const kurz = teile.join(' ');
  const zusatz: string[] = [];
  if (z.tragweiteNM !== undefined) zusatz.push(`${nf(z.tragweiteNM, 0, sprache)} sm`);
  if (z.hoeheM !== undefined) zusatz.push(`${nf(z.hoeheM, 0, sprache)} m`);
  return zusatz.length ? `${kurz}, ${zusatz.join(', ')}` : kurz;
}

function feuerName(z: Seezeichen, sprache: Sprache): string | null {
  const k = z.kennung ? KENNUNG_NAME[z.kennung] : undefined;
  const f = z.farbe ? FARB_NAME[z.farbe] : undefined;
  if (!k && !f) return null;
  const en = sprache === 'en';
  if (k && f) return en ? `${k.en} ${f.en}` : `${k.de} ${f.de}`;
  if (k) return en ? k.en : k.de;
  return en ? f!.en : f!.de;
}

export function describeAnsteuerungsfeuer(
  feuer: Seezeichen[], sprache: Sprache, maxGruppen = 3,
): string | null {

  const brauchbar = feuer.filter((z) => z.kennung !== undefined);
  if (!brauchbar.length) return null;
  const en = sprache === 'en';

  const gruppen: { z: Seezeichen; anzahl: number }[] = [];
  for (const z of brauchbar) {
    const gleich = gruppen.find((g) =>
      g.z.kennung === z.kennung && g.z.farbe === z.farbe
      && g.z.periodeS === z.periodeS && g.z.tragweiteNM === z.tragweiteNM
      && g.z.hoeheM === z.hoeheM && g.z.name === z.name);
    if (gleich) gleich.anzahl++; else gruppen.push({ z, anzahl: 1 });
  }

  const zeilen = gruppen.slice(0, maxGruppen).map(({ z, anzahl }) => {
    const kennung = feuerKennung(z, sprache);
    const name = feuerName(z, sprache);
    const bezeichnung = z.name ? `${z.name}: ` : '';
    const zahl = anzahl > 1 ? `${anzahl} × ` : '';
    return name
      ? `${bezeichnung}${zahl}${kennung} (${name})`
      : `${bezeichnung}${zahl}${kennung}`;
  });
  const kopf = en ? 'Lights on approach' : 'Feuer in der Ansteuerung';
  const vorbehalt = en
    ? 'From OpenStreetMap, not an official chart: check against the chart before you rely on it at night.'
    : 'Aus OpenStreetMap, keine amtliche Seekarte: vor der Nachtansteuerung gegen die Karte prüfen.';
  return `${kopf}: ${zeilen.join(' · ')}. ${vorbehalt}`;
}

function anlaufSatz(e: HafensteckbriefEingabe, sprache: Sprache): string | null {
  const en = sprache === 'en';
  const { ort } = e;
  const teile: string[] = [];

  const kanal = ort.funk.vhfKanal;
  if (kanal) {
    teile.push(en ? `call on VHF ${kanal.wert}` : `Anruf auf UKW-Kanal ${kanal.wert}`);
  }
  const plaetze = ort.liegen.liegeplaetze;
  if (plaetze) {
    teile.push(en
      ? `${nf(plaetze.wert, 0, sprache)} berths`
      : `${nf(plaetze.wert, 0, sprache)} Liegeplätze`);
  }

  const tiefgang = ort.zugang.maxTiefgangM;
  if (tiefgang) {

    const wert = `${nf(tiefgang.wert, 1, sprache)} m`;
    if (e.tiefgangM !== undefined && tiefgang.wert < e.tiefgangM + 0.5) {
      teile.push(en
        ? `max. draught ${wert}: tight for our ${nf(e.tiefgangM, 1, sprache)} m, worth a call ahead`
        : `max. Tiefgang ${wert}: bei unseren ${nf(e.tiefgangM, 1, sprache)} m knapp, besser vorher anrufen`);
    } else {
      teile.push(en ? `max. draught ${wert}` : `max. Tiefgang ${wert}`);
    }
  }

  if (!teile.length) return null;
  const satz = teile.join(', ');
  return `${satz.charAt(0).toUpperCase()}${satz.slice(1)}.`;
}

function festmacheSatz(ort: NautischerOrt, sprache: Sprache): string | null {
  const en = sprache === 'en';
  const teile: string[] = [];
  const bojen = ort.liegen.mooringBojen;
  const kaimauer = ort.liegen.kaimauer;
  const poller = ort.liegen.poller;
  if (bojen) {
    teile.push(en
      ? `${nf(bojen.wert, 0, sprache)} mooring buoy${bojen.wert === 1 ? '' : 's'}`
      : `${nf(bojen.wert, 0, sprache)} Mooringboje${bojen.wert === 1 ? '' : 'n'}`);
  }
  if (kaimauer) {
    teile.push(en ? 'quay wall' : 'Kaimauer');
  }
  if (poller && !kaimauer) {
    teile.push(en ? 'bollards' : 'Poller');
  }
  if (!teile.length) return null;
  return en
    ? `Recorded for making fast: ${teile.join(', ')}.`
    : `Zum Festmachen erfasst: ${teile.join(', ')}.`;
}

const VERSORGUNG_NAME: Record<keyof Versorgung, { de: string; en: string }> = {
  wasser: { de: 'Wasser', en: 'water' },
  strom: { de: 'Landstrom', en: 'shore power' },
  diesel: { de: 'Diesel', en: 'diesel' },
  duschen: { de: 'Duschen', en: 'showers' },
  wc: { de: 'WC', en: 'toilets' },
  waescherei: { de: 'Wäscherei', en: 'laundry' },
  wlan: { de: 'WLAN', en: 'wi-fi' },
  kran: { de: 'Kran', en: 'crane' },
  slip: { de: 'Slip', en: 'slipway' },
  werft: { de: 'Werft', en: 'boatyard' },
  faekalienannahme: { de: 'Fäkalienannahme', en: 'pump-out' },
};

const VERSORGUNG_REIHENFOLGE: (keyof Versorgung)[] = [
  'wasser', 'diesel', 'strom', 'duschen', 'wc', 'waescherei',
  'faekalienannahme', 'kran', 'slip', 'werft', 'wlan',
];

function versorgungsSatz(ort: NautischerOrt, sprache: Sprache): string | null {
  const en = sprache === 'en';
  const da: string[] = [];
  for (const schluessel of VERSORGUNG_REIHENFOLGE) {
    const feld = ort.versorgung[schluessel] as Feldwert<boolean> | undefined;
    if (feld?.wert === true) da.push(en ? VERSORGUNG_NAME[schluessel].en : VERSORGUNG_NAME[schluessel].de);
  }
  if (!da.length) return null;
  return en
    ? `Ashore: ${da.join(', ')}.`
    : `An Land: ${da.join(', ')}.`;
}

export function describeHafensteckbrief(e: HafensteckbriefEingabe, sprache: Sprache): string | null {

  if (e.ort.lage.osm === 'fehlgeschlagen' || e.ort.lage.osm === 'nicht_gefragt') return null;

  const fakten = [
    anlaufSatz(e, sprache),
    festmacheSatz(e.ort, sprache),
    versorgungsSatz(e.ort, sprache),
  ].filter((s): s is string => s !== null);
  const feuerText = describeAnsteuerungsfeuer(e.ort.seezeichen, sprache);

  if (!fakten.length && !feuerText) return null;

  const herkunft = fakten.length && !feuerText
    ? (sprache === 'en' ? 'All figures per OpenStreetMap.' : 'Alle Angaben laut OpenStreetMap.')
    : null;

  return escapeHtml([...fakten, herkunft, feuerText].filter((s): s is string => s !== null).join(' '));
}
