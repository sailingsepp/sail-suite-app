import { distNM } from '@/core/geo';
import {
  ortAusOsm, ergaenzeVersorgung, seezeichenAusOsm, ortArtAusTags,
  type NautischerOrt, type Seezeichen,
} from '@/core/nautischerOrt';
import type { Punkt } from '@/core/types';
import { ankerplatzAbfrage, type OverpassElement } from './overpass';

const ZUORDNUNG_M = 400;

const FEUER_M = 1000;

function position(el: OverpassElement): Punkt | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return lat == null || lon == null ? null : { lat, lon };
}

function meter(a: Punkt, b: Punkt): number {
  return distNM(a.lat, a.lon, b.lat, b.lon) * 1852;
}

function hauptobjekt(elemente: OverpassElement[], ziel: Punkt): OverpassElement | null {
  let bestes: OverpassElement | null = null;
  let besteTags = -1;
  for (const el of elemente) {
    const p = position(el);
    if (!p || meter(ziel, p) > ZUORDNUNG_M) continue;
    const art = ortArtAusTags(el.tags ?? {});
    if (art !== 'marina' && art !== 'hafen') continue;
    const anzahl = Object.keys(el.tags ?? {}).length;
    if (anzahl > besteTags) { bestes = el; besteTags = anzahl; }
  }
  return bestes;
}

function zaehleFestmacher(elemente: OverpassElement[], ziel: Punkt): {
  bojen: number; kaimauer: number; poller: number;
} {
  let bojen = 0, kaimauer = 0, poller = 0;
  for (const el of elemente) {
    if (el.tags?.['seamark:type'] !== 'mooring') continue;
    const p = position(el);
    if (!p || meter(ziel, p) > ZUORDNUNG_M) continue;
    switch (el.tags['seamark:mooring:category']) {
      case 'buoy': bojen++; break;
      case 'wall': kaimauer++; break;
      case 'bollard': poller++; break;
      default: break;
    }
  }
  return { bojen, kaimauer, poller };
}

function sammleFeuer(elemente: OverpassElement[], ziel: Punkt, maxAnzahl: number): Seezeichen[] {
  const feuer: Seezeichen[] = [];
  for (const el of elemente) {
    const p = position(el);
    if (!p || meter(ziel, p) > FEUER_M) continue;
    const z = seezeichenAusOsm(p, el.tags ?? {});
    if (z) feuer.push(z);
  }
  feuer.sort((a, b) => (b.tragweiteNM ?? -1) - (a.tragweiteNM ?? -1));
  return feuer.slice(0, maxAnzahl);
}

function versorgungsKategorien(elemente: OverpassElement[], ziel: Punkt): string[] {
  const roh: string[] = [];
  for (const el of elemente) {
    if (el.tags?.['seamark:type'] !== 'small_craft_facility') continue;
    const p = position(el);
    if (!p || meter(ziel, p) > ZUORDNUNG_M) continue;
    const kat = el.tags['seamark:small_craft_facility:category'];
    if (kat) roh.push(kat);
  }
  return roh;
}

export async function hafenSteckbrief(punkt: Punkt, maxFeuer = 12): Promise<NautischerOrt | null> {
  const abfrage = await ankerplatzAbfrage(punkt);
  if (!abfrage) return null;

  const jetzt = Date.now();
  const haupt = hauptobjekt(abfrage.elemente, punkt);
  const feuer = sammleFeuer(abfrage.elemente, punkt, maxFeuer);

  if (!haupt) {

    if (!feuer.length) {
      return {
        id: `punkt:${punkt.lat.toFixed(5)},${punkt.lon.toFixed(5)}`,
        position: punkt, name: null, art: 'poi',
        zugang: {}, liegen: {}, versorgung: {}, funk: {},
        seezeichen: [], quellen: [{ id: 'osm', abgerufen: jetzt }],
        lage: { osm: 'nichts_gefunden' },
      };
    }
    return {
      id: `punkt:${punkt.lat.toFixed(5)},${punkt.lon.toFixed(5)}`,
      position: punkt, name: null, art: 'poi',
      zugang: {}, liegen: {}, versorgung: {}, funk: {},
      seezeichen: feuer, quellen: [{ id: 'osm', abgerufen: jetzt }],
      lage: { osm: 'geliefert' },
    };
  }

  const p = position(haupt)!;
  let ort = ortAusOsm(`osm:${haupt.type}/${p.lat.toFixed(5)},${p.lon.toFixed(5)}`, p, haupt.tags ?? {}, jetzt);
  ort = ergaenzeVersorgung(ort, versorgungsKategorien(abfrage.elemente, punkt));

  const festmacher = zaehleFestmacher(abfrage.elemente, punkt);
  const liegen = { ...ort.liegen };
  if (festmacher.bojen) liegen.mooringBojen = { wert: festmacher.bojen, quelle: 'osm', guete: 'C' };
  if (festmacher.kaimauer) liegen.kaimauer = { wert: festmacher.kaimauer, quelle: 'osm', guete: 'C' };
  if (festmacher.poller) liegen.poller = { wert: festmacher.poller, quelle: 'osm', guete: 'C' };

  return { ...ort, liegen, seezeichen: feuer };
}
