import type { Sprache } from '@/core/types';
import { meeresgebietAm } from '@/core/meeresgebiete';

interface RevierZone {
  name: string;
  phrase: string;
  nameEn: string;
  phraseEn: string;
  la1: number; la2: number;
  lo1: number; lo2: number;
}

const ZONEN: RevierZone[] = [

  { name: 'Kornaten', phrase: 'in den Kornaten', nameEn: 'Kornati Islands', phraseEn: 'in the Kornati Islands', la1: 43.70, la2: 44.08, lo1: 15.05, lo2: 15.45 },
  { name: 'obere Adria', phrase: 'in der oberen Adria', nameEn: 'upper Adriatic', phraseEn: 'in the upper Adriatic', la1: 44.3, la2: 45.8, lo1: 12.3, lo2: 15.3 },
  { name: 'Norddalmatien', phrase: 'in Norddalmatien', nameEn: 'northern Dalmatia', phraseEn: 'in northern Dalmatia', la1: 43.65, la2: 44.3, lo1: 14.8, lo2: 16.0 },
  { name: 'Mitteldalmatien', phrase: 'in Mitteldalmatien', nameEn: 'central Dalmatia', phraseEn: 'in central Dalmatia', la1: 42.85, la2: 43.65, lo1: 15.3, lo2: 17.3 },
  { name: 'Süddalmatien', phrase: 'in Süddalmatien', nameEn: 'southern Dalmatia', phraseEn: 'in southern Dalmatia', la1: 42.35, la2: 42.85, lo1: 17.0, lo2: 18.35 },

  { name: 'nördliche Sporaden', phrase: 'in den nördlichen Sporaden', nameEn: 'northern Sporades', phraseEn: 'in the northern Sporades', la1: 38.9, la2: 39.9, lo1: 23.2, lo2: 24.3 },
  { name: 'Saronischer Golf', phrase: 'im Saronischen Golf', nameEn: 'Saronic Gulf', phraseEn: 'in the Saronic Gulf', la1: 37.15, la2: 38.05, lo1: 23.0, lo2: 23.75 },
  { name: 'nördliche Kykladen', phrase: 'in den nördlichen Kykladen', nameEn: 'northern Cyclades', phraseEn: 'in the northern Cyclades', la1: 37.3, la2: 38.05, lo1: 24.2, lo2: 25.9 },
  { name: 'südliche Kykladen', phrase: 'in den südlichen Kykladen', nameEn: 'southern Cyclades', phraseEn: 'in the southern Cyclades', la1: 36.2, la2: 37.3, lo1: 24.3, lo2: 25.9 },
  { name: 'nördliche Ägäis', phrase: 'in der nördlichen Ägäis', nameEn: 'northern Aegean', phraseEn: 'in the northern Aegean', la1: 38.6, la2: 41.0, lo1: 23.5, lo2: 26.8 },
  { name: 'Dodekanes', phrase: 'im Dodekanes', nameEn: 'Dodecanese', phraseEn: 'in the Dodecanese', la1: 35.8, la2: 36.95, lo1: 26.6, lo2: 28.6 },
  { name: 'Kreta', phrase: 'auf Kreta', nameEn: 'Crete', phraseEn: 'off Crete', la1: 34.6, la2: 35.75, lo1: 23.3, lo2: 26.4 },
  { name: 'Ionisches Meer', phrase: 'im Ionischen Meer', nameEn: 'Ionian Sea', phraseEn: 'in the Ionian Sea', la1: 37.5, la2: 39.9, lo1: 19.3, lo2: 21.3 },

  { name: 'türkische Ägäisküste', phrase: 'an der türkischen Ägäisküste', nameEn: 'Turkish Aegean coast', phraseEn: 'off the Turkish Aegean coast', la1: 36.6, la2: 38.6, lo1: 26.7, lo2: 28.7 },
  { name: 'lykische Küste', phrase: 'an der lykischen Küste', nameEn: 'Lycian coast', phraseEn: 'off the Lycian coast', la1: 35.9, la2: 37.0, lo1: 28.6, lo2: 31.6 },

  { name: 'Straße von Bonifacio', phrase: 'in der Straße von Bonifacio', nameEn: 'Strait of Bonifacio', phraseEn: 'in the Strait of Bonifacio', la1: 41.15, la2: 41.55, lo1: 8.7, lo2: 9.6 },
  { name: 'Korsika', phrase: 'auf Korsika', nameEn: 'Corsica', phraseEn: 'off Corsica', la1: 41.3, la2: 43.1, lo1: 8.4, lo2: 9.7 },
  { name: 'Golfe du Lion', phrase: 'im Golfe du Lion', nameEn: 'Gulf of Lion', phraseEn: 'in the Gulf of Lion', la1: 42.3, la2: 43.7, lo1: 3.0, lo2: 5.6 },
  { name: 'Côte d’Azur', phrase: 'an der Côte d’Azur', nameEn: 'Côte d’Azur', phraseEn: 'on the Côte d’Azur', la1: 42.9, la2: 43.9, lo1: 5.6, lo2: 7.6 },

  { name: 'Golf von Neapel', phrase: 'im Golf von Neapel', nameEn: 'Gulf of Naples', phraseEn: 'in the Gulf of Naples', la1: 40.4, la2: 40.9, lo1: 13.75, lo2: 14.65 },
  { name: 'Äolische Inseln', phrase: 'auf den Äolischen Inseln', nameEn: 'Aeolian Islands', phraseEn: 'in the Aeolian Islands', la1: 38.3, la2: 38.9, lo1: 14.3, lo2: 15.5 },
  { name: 'Toskanischer Archipel', phrase: 'im Toskanischen Archipel', nameEn: 'Tuscan Archipelago', phraseEn: 'in the Tuscan Archipelago', la1: 42.1, la2: 43.15, lo1: 9.6, lo2: 11.05 },
  { name: 'Costa Smeralda', phrase: 'an der Costa Smeralda', nameEn: 'Costa Smeralda', phraseEn: 'on the Costa Smeralda', la1: 40.8, la2: 41.3, lo1: 9.05, lo2: 9.75 },
  { name: 'Sardinien', phrase: 'auf Sardinien', nameEn: 'Sardinia', phraseEn: 'off Sardinia', la1: 38.8, la2: 41.3, lo1: 8.0, lo2: 9.9 },
  { name: 'Sizilien', phrase: 'auf Sizilien', nameEn: 'Sicily', phraseEn: 'off Sicily', la1: 36.5, la2: 38.3, lo1: 12.2, lo2: 15.7 },
  { name: 'ligurische Küste', phrase: 'an der ligurischen Küste', nameEn: 'Ligurian coast', phraseEn: 'off the Ligurian coast', la1: 43.1, la2: 44.5, lo1: 6.5, lo2: 10.0 },

  { name: 'Costa Brava', phrase: 'an der Costa Brava', nameEn: 'Costa Brava', phraseEn: 'on the Costa Brava', la1: 41.0, la2: 42.5, lo1: 2.0, lo2: 3.35 },
  { name: 'Balearen', phrase: 'auf den Balearen', nameEn: 'Balearic Islands', phraseEn: 'in the Balearics', la1: 38.6, la2: 40.15, lo1: 1.0, lo2: 4.4 },
  { name: 'Costa del Sol', phrase: 'an der Costa del Sol', nameEn: 'Costa del Sol', phraseEn: 'on the Costa del Sol', la1: 35.7, la2: 36.9, lo1: -5.5, lo2: -1.0 },

  { name: 'türkische Mittelmeerküste', phrase: 'an der türkischen Mittelmeerküste', nameEn: 'Turkish Mediterranean coast', phraseEn: 'off the Turkish Mediterranean coast', la1: 35.5, la2: 38.6, lo1: 26.5, lo2: 32.0 },
];

const BECKEN: Record<string, Omit<RevierZone, 'la1' | 'la2' | 'lo1' | 'lo2'>> = {
  '28b': { name: 'Alborán-Meer', phrase: 'im Alborán-Meer', nameEn: 'Alboran Sea', phraseEn: 'in the Alboran Sea' },
  '28c': { name: 'Balearenmeer', phrase: 'im Balearenmeer', nameEn: 'Balearic Sea', phraseEn: 'in the Balearic Sea' },
  '28d': { name: 'Ligurisches Meer', phrase: 'im Ligurischen Meer', nameEn: 'Ligurian Sea', phraseEn: 'in the Ligurian Sea' },
  '28e': { name: 'Tyrrhenisches Meer', phrase: 'im Tyrrhenischen Meer', nameEn: 'Tyrrhenian Sea', phraseEn: 'in the Tyrrhenian Sea' },
  '28f': { name: 'Ionisches Meer', phrase: 'im Ionischen Meer', nameEn: 'Ionian Sea', phraseEn: 'in the Ionian Sea' },
  '28g': { name: 'Adria', phrase: 'in der Adria', nameEn: 'Adriatic', phraseEn: 'in the Adriatic' },
  '28h': { name: 'Ägäis', phrase: 'in der Ägäis', nameEn: 'Aegean', phraseEn: 'in the Aegean' },
  '28A': { name: 'westliches Mittelmeer', phrase: 'im westlichen Mittelmeer', nameEn: 'western Mediterranean', phraseEn: 'in the western Mediterranean' },
  '28B': { name: 'östliches Mittelmeer', phrase: 'im östlichen Mittelmeer', nameEn: 'eastern Mediterranean', phraseEn: 'in the eastern Mediterranean' },
};

function findZone(lat: number, lon: number): RevierZone | null {
  for (const z of ZONEN) {
    if (lat >= z.la1 && lat <= z.la2 && lon >= z.lo1 && lon <= z.lo2) return z;
  }
  const g = meeresgebietAm(lat, lon);
  const b = g ? BECKEN[g.id] : undefined;
  return b ? { ...b, la1: lat, la2: lat, lo1: lon, lo2: lon } : null;
}

export function revierName(lat: number, lon: number, sprache: Sprache = 'de'): string | null {
  const z = findZone(lat, lon);
  return z ? (sprache === 'en' ? z.nameEn : z.name) : null;
}

export function revierPhrase(lat: number, lon: number, sprache: Sprache = 'de'): string {

  const z = findZone(lat, lon);
  if (sprache === 'en') return z?.phraseEn ?? 'here';
  return z?.phrase ?? 'hier';
}

export function revierSpanne(startLat: number, startLon: number, zielLat: number, zielLon: number, sprache: Sprache = 'de'): string {
  const start = findZone(startLat, startLon);
  const ziel = findZone(zielLat, zielLon);
  if (sprache === 'en') {
    if (!start && !ziel) return 'here';
    if (!ziel || !start || start.nameEn === ziel.nameEn) return (start ?? ziel)!.phraseEn;
    return `${start.nameEn} to ${ziel.nameEn}`;
  }
  if (!start && !ziel) return 'hier';
  if (!ziel || !start || start.name === ziel.name) return (start ?? ziel)!.phrase;
  return `${start.name} bis ${ziel.name}`;
}
