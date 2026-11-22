import { nf } from '@/core/time';
import { distNM } from '@/core/geo';
import {
  GRADIENT_FLACH, GRADIENT_KRAEFTIG, stroemungPasst,
  type Druckanalyse, type Druckzentrum,
} from '@/core/druckfeld';
import type { Sprache } from '@/core/types';

const REGIONEN: { name: string; nameEn: string; lat: number; lon: number }[] = [
  { name: 'den Azoren', nameEn: 'the Azores', lat: 38.0, lon: -27.0 },
  { name: 'dem Nordatlantik', nameEn: 'the North Atlantic', lat: 50.0, lon: -20.0 },
  { name: 'dem Seegebiet westlich Portugals', nameEn: 'the sea area west of Portugal', lat: 39.0, lon: -14.0 },
  { name: 'der Biskaya', nameEn: 'the Bay of Biscay', lat: 45.5, lon: -5.0 },
  { name: 'den Britischen Inseln', nameEn: 'the British Isles', lat: 53.5, lon: -3.0 },
  { name: 'der Nordsee', nameEn: 'the North Sea', lat: 56.0, lon: 3.0 },
  { name: 'Skandinavien', nameEn: 'Scandinavia', lat: 61.0, lon: 15.0 },
  { name: 'dem Baltikum', nameEn: 'the Baltic states', lat: 57.0, lon: 24.0 },
  { name: 'Frankreich', nameEn: 'France', lat: 47.0, lon: 2.5 },
  { name: 'Mitteleuropa', nameEn: 'Central Europe', lat: 50.5, lon: 11.0 },
  { name: 'Polen', nameEn: 'Poland', lat: 52.0, lon: 19.0 },
  { name: 'der Iberischen Halbinsel', nameEn: 'the Iberian Peninsula', lat: 40.0, lon: -4.0 },
  { name: 'dem Alpenraum', nameEn: 'the Alpine region', lat: 46.8, lon: 10.5 },
  { name: 'dem Golf von Löwen', nameEn: 'the Gulf of Lion', lat: 42.5, lon: 4.5 },
  { name: 'dem Golf von Genua', nameEn: 'the Gulf of Genoa', lat: 44.0, lon: 8.8 },
  { name: 'Oberitalien', nameEn: 'northern Italy', lat: 45.3, lon: 10.8 },
  { name: 'Korsika', nameEn: 'Corsica', lat: 42.2, lon: 9.1 },
  { name: 'Sardinien', nameEn: 'Sardinia', lat: 40.0, lon: 9.1 },
  { name: 'den Balearen', nameEn: 'the Balearic Islands', lat: 39.5, lon: 2.9 },
  { name: 'dem westlichen Mittelmeer', nameEn: 'the western Mediterranean', lat: 38.5, lon: 5.5 },
  { name: 'dem Tyrrhenischen Meer', nameEn: 'the Tyrrhenian Sea', lat: 39.8, lon: 12.3 },
  { name: 'Mittelitalien', nameEn: 'central Italy', lat: 42.5, lon: 12.6 },
  { name: 'Süditalien', nameEn: 'southern Italy', lat: 40.5, lon: 16.5 },
  { name: 'Sizilien', nameEn: 'Sicily', lat: 37.6, lon: 14.2 },
  { name: 'der nördlichen Adria', nameEn: 'the northern Adriatic', lat: 44.6, lon: 13.4 },
  { name: 'der mittleren Adria', nameEn: 'the central Adriatic', lat: 43.0, lon: 15.9 },
  { name: 'der südlichen Adria', nameEn: 'the southern Adriatic', lat: 41.5, lon: 18.2 },
  { name: 'dem Pannonischen Becken', nameEn: 'the Pannonian Basin', lat: 46.8, lon: 19.5 },
  { name: 'dem Balkan', nameEn: 'the Balkans', lat: 43.3, lon: 21.5 },
  { name: 'Rumänien', nameEn: 'Romania', lat: 45.5, lon: 25.0 },
  { name: 'der Ukraine', nameEn: 'Ukraine', lat: 49.0, lon: 31.0 },
  { name: 'dem Schwarzen Meer', nameEn: 'the Black Sea', lat: 43.3, lon: 34.0 },
  { name: 'dem Ionischen Meer', nameEn: 'the Ionian Sea', lat: 37.6, lon: 18.8 },
  { name: 'Griechenland', nameEn: 'Greece', lat: 39.3, lon: 22.0 },
  { name: 'der nördlichen Ägäis', nameEn: 'the northern Aegean', lat: 39.5, lon: 25.0 },
  { name: 'der südlichen Ägäis', nameEn: 'the southern Aegean', lat: 36.5, lon: 25.5 },
  { name: 'Kreta', nameEn: 'Crete', lat: 35.2, lon: 24.9 },
  { name: 'der Westtürkei', nameEn: 'western Turkey', lat: 38.5, lon: 28.5 },
  { name: 'Kleinasien', nameEn: 'Asia Minor', lat: 39.0, lon: 33.5 },
  { name: 'Zypern', nameEn: 'Cyprus', lat: 35.0, lon: 33.2 },
  { name: 'der Levante', nameEn: 'the Levant', lat: 34.0, lon: 36.5 },

  { name: 'Ostanatolien', nameEn: 'eastern Anatolia', lat: 39.5, lon: 40.0 },
  { name: 'dem Kaukasus', nameEn: 'the Caucasus', lat: 42.0, lon: 44.0 },
  { name: 'Syrien', nameEn: 'Syria', lat: 35.0, lon: 39.0 },
  { name: 'dem Irak', nameEn: 'Iraq', lat: 33.0, lon: 43.5 },
  { name: 'dem östlichen Mittelmeer', nameEn: 'the eastern Mediterranean', lat: 33.5, lon: 28.0 },
  { name: 'Ägypten', nameEn: 'Egypt', lat: 27.5, lon: 30.0 },
  { name: 'der Cyrenaika', nameEn: 'Cyrenaica', lat: 31.5, lon: 22.0 },
  { name: 'dem Golf von Syrte', nameEn: 'the Gulf of Sirte', lat: 31.5, lon: 18.0 },
  { name: 'Libyen', nameEn: 'Libya', lat: 28.0, lon: 15.5 },
  { name: 'Tunesien', nameEn: 'Tunisia', lat: 34.5, lon: 9.5 },
  { name: 'Algerien', nameEn: 'Algeria', lat: 32.5, lon: 3.0 },
  { name: 'Marokko', nameEn: 'Morocco', lat: 32.0, lon: -6.0 },
];

const REGION_MAX_NM = 450;

export function benenneRegion(lat: number, lon: number, sprache: Sprache = 'de'): string | null {
  let beste: { name: string; nameEn: string } | null = null, kleinster = Infinity;
  for (const r of REGIONEN) {
    const d = distNM(lat, lon, r.lat, r.lon);
    if (d < kleinster) { kleinster = d; beste = r; }
  }
  if (kleinster > REGION_MAX_NM || !beste) return null;
  return sprache === 'en' ? beste.nameEn : beste.name;
}

const HIMMELSRICHTUNG = [
  'nördlich', 'nordöstlich', 'östlich', 'südöstlich',
  'südlich', 'südwestlich', 'westlich', 'nordwestlich',
];

const HIMMELSRICHTUNG_EN = [
  'northerly', 'north-easterly', 'easterly', 'south-easterly',
  'southerly', 'south-westerly', 'westerly', 'north-westerly',
];
const FLANKE = [
  'Nordflanke', 'Nordostflanke', 'Ostflanke', 'Südostflanke',
  'Südflanke', 'Südwestflanke', 'Westflanke', 'Nordwestflanke',
];
const FLANKE_EN = [
  'northern flank', 'north-eastern flank', 'eastern flank', 'south-eastern flank',
  'southern flank', 'south-western flank', 'western flank', 'north-western flank',
];
const NACH = [
  'Norden', 'Nordosten', 'Osten', 'Südosten',
  'Süden', 'Südwesten', 'Westen', 'Nordwesten',
];
const NACH_EN = [
  'north', 'north-east', 'east', 'south-east',
  'south', 'south-west', 'west', 'north-west',
];

function sektor(deg: number): number {
  return Math.round(((deg % 360) + 360) % 360 / 45) % 8;
}

function staerkeWort(gradient: number, sprache: Sprache = 'de'): string {
  if (sprache === 'en') {
    if (gradient >= GRADIENT_KRAEFTIG) return 'strong ';
    if (gradient >= GRADIENT_FLACH * 2) return 'moderate ';
    return '';
  }
  if (gradient >= GRADIENT_KRAEFTIG) return 'kräftigen ';
  if (gradient >= GRADIENT_FLACH * 2) return 'mäßigen ';
  return '';
}

function zentrumText(z: Druckzentrum, art: 'Hoch' | 'Tief', sprache: Sprache = 'de'): string | null {
  const region = benenneRegion(z.lat, z.lon, sprache);
  if (!region) return null;
  if (sprache === 'en') {
    const artEn = art === 'Hoch' ? 'High' : 'Low';
    return `${artEn} over ${region} (${nf(z.hPa, 0, 'en')} hPa)`;
  }
  return `${art} über ${region} (${nf(z.hPa, 0)} hPa)`;
}

export function describeGrosswetterlage(a: Druckanalyse | null, windVon: number, sprache: Sprache = 'de',

  thermisch = true): string | null {
  if (!a) return null;

  const hochTxt = a.hoch ? zentrumText(a.hoch, 'Hoch', sprache) : null;
  const tiefTxt = a.tief ? zentrumText(a.tief, 'Tief', sprache) : null;
  const passt = stroemungPasst(a.stroemungVon, windVon);
  const HIMMEL = sprache === 'en' ? HIMMELSRICHTUNG_EN : HIMMELSRICHTUNG;
  const stroemung = a.stroemungVon !== null
    ? sprache === 'en'
      ? `${staerkeWort(a.gradient, 'en')}${HIMMEL[sektor(a.stroemungVon)]}`
      : `${staerkeWort(a.gradient)}${HIMMEL[sektor(a.stroemungVon)]}en`
    : null;

  if (a.gradient < GRADIENT_FLACH) {

    const beide = hochTxt && tiefTxt && a.hoch && a.tief
      && benenneRegion(a.hoch.lat, a.hoch.lon) !== benenneRegion(a.tief.lat, a.tief.lon);
    const rand = beide
      ? (sprache === 'en' ? `${hochTxt} and a ${tiefTxt}` : `${hochTxt} und einem ${tiefTxt}`)
      : (hochTxt ?? tiefTxt);

    if (sprache === 'en') {
      const rest = thermisch ? 'the wind is mostly thermal (land and sea breeze).' : 'and under the thick cloud no thermal breeze sets in either.';
      return rand
        ? `The situation is governed by a ${rand}; over the sailing area itself the pressure is `
          + `flat. Little contrast, ${rest}`
        : `Flat pressure distribution over the sailing area: little pressure contrast, ${rest}`;
    }
    const rest = thermisch ? 'der Wind entsteht überwiegend thermisch (Land- und Seewind).' : 'und bei dichter Bewölkung kommt auch keine thermische Brise in Gang.';
    return rand
      ? `Die Lage wird von einem ${rand} bestimmt; über dem Revier selbst ist der Druck `
        + `flach verteilt. Kaum Gegensatz, ${rest}`
      : `Flache Druckverteilung über dem Revier: kaum Druckgegensatz, ${rest}`;
  }

  if (hochTxt && tiefTxt && a.hoch && a.tief
      && benenneRegion(a.hoch.lat, a.hoch.lon) !== benenneRegion(a.tief.lat, a.tief.lon)) {
    if (sprache === 'en') {
      return passt && stroemung
        ? `Between a ${hochTxt} and a ${tiefTxt}, the sailing area lies in a ${stroemung} flow.`
        : `A ${hochTxt} and a ${tiefTxt} govern the synoptic situation. The forecast wind departs `
          + 'from this background flow. Locally, coastline shape and thermal effects set the direction.';
    }
    return passt && stroemung
      ? `Zwischen einem ${hochTxt} und einem ${tiefTxt} liegt das Revier in einer ${stroemung} Strömung.`
      : `Ein ${hochTxt} und ein ${tiefTxt} bestimmen die Großwetterlage. Der vorhergesagte `
        + 'Wind weicht von dieser Grundströmung ab: im Revier prägen Küstenform und Thermik die Richtung.';
  }

  const einzelZentrum = a.hoch && hochTxt ? { z: a.hoch, txt: hochTxt } : (a.tief && tiefTxt ? { z: a.tief, txt: tiefTxt } : null);
  if (einzelZentrum) {

    const FLANKEN = sprache === 'en' ? FLANKE_EN : FLANKE;
    const flanke = FLANKEN[sektor(einzelZentrum.z.peilung + 180)]!;
    if (sprache === 'en') {
      return passt && stroemung
        ? `A ${einzelZentrum.txt} governs the situation; the sailing area lies on its ${flanke} in a ${stroemung} flow.`
        : `A ${einzelZentrum.txt} governs the situation; the sailing area lies on its ${flanke}.`;
    }
    return passt && stroemung
      ? `Ein ${einzelZentrum.txt} bestimmt die Lage; das Revier liegt an seiner ${flanke} in einer ${stroemung} Strömung.`
      : `Ein ${einzelZentrum.txt} bestimmt die Lage; das Revier liegt an seiner ${flanke}.`;
  }

  const NACHRICHTUNG = sprache === 'en' ? NACH_EN : NACH;
  if (a.anstiegNach !== null && passt && stroemung) {
    return sprache === 'en'
      ? `No well-defined pressure centre within range: the pressure rises towards the `
        + `${NACHRICHTUNG[sektor(a.anstiegNach)]}, and the sailing area lies in a ${stroemung} background flow.`
      : `Kein ausgeprägtes Druckzentrum in Reichweite: der Luftdruck nimmt nach `
        + `${NACHRICHTUNG[sektor(a.anstiegNach)]} hin zu, das Revier liegt in einer ${stroemung} Grundströmung.`;
  }
  if (a.anstiegNach !== null) {
    return sprache === 'en'
      ? `No well-defined pressure centre within range: the pressure rises towards the `
        + `${NACHRICHTUNG[sektor(a.anstiegNach)]}.`
      : `Kein ausgeprägtes Druckzentrum in Reichweite: der Luftdruck nimmt nach `
        + `${NACHRICHTUNG[sektor(a.anstiegNach)]} hin zu.`;
  }
  return null;
}
