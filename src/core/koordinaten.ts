import type { Sprache } from './types';

const MINUTEN_STELLEN = 3;

function halbkreis(wert: number, positiv: string, negativ: string, gradStellen: number, sprache: Sprache): string {
  const richtung = wert < 0 ? negativ : positiv;
  const betrag = Math.abs(wert);

  const faktor = 10 ** MINUTEN_STELLEN;
  const minutenGesamt = Math.round(betrag * 60 * faktor) / faktor;
  const grad = Math.floor(minutenGesamt / 60);
  const minuten = minutenGesamt - grad * 60;

  const m = minuten.toFixed(MINUTEN_STELLEN);
  const mText = sprache === 'en' ? m : m.replace('.', ',');
  return `${String(grad).padStart(gradStellen, '0')}° ${mText.padStart(MINUTEN_STELLEN + 3, '0')}′ ${richtung}`;
}

export function breiteText(lat: number, sprache: Sprache = 'de'): string {
  return halbkreis(lat, 'N', 'S', 2, sprache);
}

export function laengeText(lon: number, sprache: Sprache = 'de'): string {

  return halbkreis(lon, 'E', 'W', 3, sprache);
}

export function positionText(lat: number, lon: number, sprache: Sprache = 'de'): string {
  return `${breiteText(lat, sprache)}   ${laengeText(lon, sprache)}`;
}

export type KoordinatenParseErgebnis =
  | { ok: true; punkte: { lat: number; lon: number }[] }
  | { ok: false; ungueltigeZeile: string };

export function parseKoordinatenEingabe(text: string): KoordinatenParseErgebnis {
  const zeilen = text.split('\n').map((z) => z.trim()).filter(Boolean);
  const punkte: { lat: number; lon: number }[] = [];
  for (const zeile of zeilen) {
    const teile = zeile.split(/[,;\s]+/).filter(Boolean);
    const lat = teile[0] !== undefined ? Number(teile[0]) : NaN;
    const lon = teile[1] !== undefined ? Number(teile[1]) : NaN;
    if (teile.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { ok: false, ungueltigeZeile: zeile };
    }
    punkte.push({ lat, lon });
  }
  return { ok: true, punkte };
}
