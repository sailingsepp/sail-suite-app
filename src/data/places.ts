import type { Punkt, Sprache } from '@/core/types';
import { findAnkerplatzName, ankerplatzAbfrage, naechsterImRadius, umgebungFuerLogbuch, inselAmLandpunkt, inselMitNamen, gemeindeAmPunkt } from './overpass';
import { reverseOrt, reverseOrtFuerLogbuch } from './geocode';
import { mitArtwort, logbuchOrtsname, ortKandidatInDerNaehe, ortGegenUmgebung, ORT_FERN_SM } from '@/core/ortsname';
import { bearingDeg, distNM } from '@/core/geo';
import { richtungKurz } from '@/core/zielwetter';

export async function ortsbezeichnung(punkt: Punkt, sprache: Sprache = 'de'): Promise<string | null> {
  const anker = await findAnkerplatzName(punkt);
  if (anker) {
    const bucht = sprache === 'en' ? 'Bay' : 'Bucht';

    return anker.art === 'marina' ? mitArtwort('marina', 'Marina', anker.name) : mitArtwort('bucht', bucht, anker.name);
  }
  return reverseOrt(punkt);
}

const LIEGEPLATZ_M = 500;

export async function ortsangabeLogbuch(
  punkt: Punkt, sprache: Sprache = 'de',
): Promise<{ name: string | null; vollstaendig: boolean; protokoll: string[] }> {

  const protokoll: string[] = [];
  const [abfrage, teile] = await Promise.all([

    ankerplatzAbfrage(punkt, true).catch(() => null),
    reverseOrtFuerLogbuch(punkt, sprache),
  ]);
  if (teile.fehler) throw new Error('Nominatim nicht erreichbar');
  let vollstaendig = abfrage !== null;
  protokoll.push(`Nominatim: ${Object.entries(teile.roh ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || '–'}`);
  protokoll.push(`Overpass Liegeplatz: ${abfrage === null ? 'nicht erreichbar' : (abfrage.treffer.length ? abfrage.treffer.map((x) => x.name ?? '?').slice(0, 4).join(', ') : '–')}`);
  const treffer = abfrage ? naechsterImRadius(abfrage.treffer, LIEGEPLATZ_M) : null;
  const anker = treffer?.name ? { art: treffer.art, name: treffer.name } : null;
  let insel = teile.insel;
  let ort = teile.ortschaft ?? teile.ort;
  let ortNahe = false;
  let ortAbstand: { sm: number; richtung: string } | null = null;

  if (!insel || !ort || !anker) {
    try {
      const u = await umgebungFuerLogbuch(punkt, sprache);
      protokoll.push(`Ufer: Insel ${u.insel ?? '–'}, Landpunkt ${u.landpunkt ? 'ja' : 'nein'}, Orte ${u.orte.length}`);
      if (!insel) insel = u.insel;

      if (!insel && u.landpunkt) insel = await inselAmLandpunkt(u.landpunkt, sprache);
      let k: ReturnType<typeof ortKandidatInDerNaehe> = null;
      if (!ort) {
        k = ortKandidatInDerNaehe(punkt, u.orte);
        ort = k ? (k.nameSprache ?? k.name) : null;
        ortNahe = !!ort;
      } else if (!anker) {
        const g = ortGegenUmgebung(punkt, ort, u.orte);
        protokoll.push(`Ort „${ort}“ gegen Siedlungen geprüft: ${g.kandidat ? `ersetzt durch ${g.ort}` : g.ort ? 'liegt nah' : 'keine Siedlung im Umkreis'}`);
        ort = g.ort; ortNahe = g.ortNahe; k = g.kandidat;
      }
      if (k) {

        ortAbstand = { sm: distNM(k.lat, k.lon, punkt.lat, punkt.lon), richtung: richtungKurz(bearingDeg(k.lat, k.lon, punkt.lat, punkt.lon), sprache) };
        if (!insel && ortAbstand.sm >= ORT_FERN_SM) insel = await inselAmLandpunkt({ lat: k.lat, lon: k.lon }, sprache).catch(() => null);
      }
    } catch {
      vollstaendig = false;
      protokoll.push('Ufer: nicht erreichbar');
    }
  }

  let hauptinsel: string | null = null;
  let g = teile.gemeinde?.trim();

  if (insel && !g) {
    try {
      g = (await gemeindeAmPunkt(punkt))?.trim();
      protokoll.push(`Gemeinde laut OSM-Grenze: ${g ?? '–'}`);
    } catch {
      vollstaendig = false;
      protokoll.push('Gemeinde laut OSM-Grenze: nicht erreichbar');
    }
  }
  if (insel && g && g.toLocaleLowerCase('hr') !== insel.toLocaleLowerCase('hr')) {
    try {
      if (await inselMitNamen(punkt, g)) hauptinsel = g;
      protokoll.push(`Hauptinsel „${g}": ${hauptinsel ? 'als Insel bestätigt' : 'keine Insel dieses Namens in 20 km'}`);
    } catch {
      vollstaendig = false;
      protokoll.push(`Hauptinsel „${g}": nicht erreichbar`);
    }
  } else {
    protokoll.push(`Hauptinsel: nicht geprüft (Insel ${insel ?? '–'}, Gemeinde ${g ?? '–'})`);
  }
  const bucht = sprache === 'en' ? 'Bay' : 'Bucht';
  const liegeplatz = anker
    ? (anker.art === 'marina' ? mitArtwort('marina', 'Marina', anker.name) : mitArtwort('bucht', bucht, anker.name))
    : null;
  const name = logbuchOrtsname({ liegeplatz, art: anker?.art ?? null, ort, ortNahe, ortAbstand, insel, hauptinsel, sprache });
  return { name, vollstaendig, protokoll };
}
