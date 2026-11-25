import type { RevierwissenEintrag, Revier } from './revierwissen';
import { REVIERWISSEN } from './revierwissen';
import { distNM } from './geo';
import { meeresgebietAm } from './meeresgebiete';

function inBox(lat: number, lon: number, swLat: number, neLat: number, swLon: number, neLon: number): boolean {
  return lat >= swLat && lat <= neLat && lon >= swLon && lon <= neLon;
}

const REVIER_BOXEN: Record<Revier, [swLat: number, neLat: number, swLon: number, neLon: number]> = {
  aegaeis: [34.5, 41.5, 22.5, 30.0],
  adria: [39.5, 46.0, 12.0, 20.5],
  ionisch: [35.5, 40.0, 17.5, 22.5],
  bonifacio: [41.1, 41.6, 8.6, 9.7],
  westmed: [38.5, 44.5, 1.0, 10.5],
};

export function revierVonPunkt(lat: number, lon: number): Revier | null {
  if (inBox(lat, lon, ...REVIER_BOXEN.aegaeis)) return 'aegaeis';
  if (inBox(lat, lon, ...REVIER_BOXEN.adria)) return 'adria';
  if (inBox(lat, lon, ...REVIER_BOXEN.ionisch)) return 'ionisch';
  if (inBox(lat, lon, ...REVIER_BOXEN.bonifacio)) return 'bonifacio';
  if (inBox(lat, lon, ...REVIER_BOXEN.westmed)) return 'westmed';
  return null;
}

const REVIER_NAMEN: Record<Revier, { de: string; en: string }> = {
  aegaeis: { de: 'Ägäis', en: 'Aegean' },
  adria: { de: 'Adria', en: 'Adriatic' },
  ionisch: { de: 'Ionisches Meer', en: 'Ionian Sea' },
  bonifacio: { de: 'Straße von Bonifacio', en: 'Strait of Bonifacio' },
  westmed: { de: 'Westliches Mittelmeer', en: 'Western Mediterranean' },
};

export function toernRevierText(
  land: string | null | undefined, lat: number, lon: number, sprache: 'de' | 'en' = 'de',
): string | null {
  const teile = [land?.trim() || null, seegebietName(lat, lon, sprache)].filter(Boolean);
  return teile.length ? teile.join(' · ') : null;
}

export function seegebietName(lat: number, lon: number, sprache: 'de' | 'en' = 'de'): string | null {
  const revier = revierVonPunkt(lat, lon);
  if (revier && revier !== 'westmed') return REVIER_NAMEN[revier][sprache];
  const g = meeresgebietAm(lat, lon);
  if (g) return sprache === 'en' ? g.en.charAt(0).toUpperCase() + g.en.slice(1) : g.de;
  return revier ? REVIER_NAMEN[revier][sprache] : null;
}

export function seegebietSchluessel(lat: number, lon: number): string | null {
  const revier = revierVonPunkt(lat, lon);
  if (revier && revier !== 'westmed') return revier;
  return meeresgebietAm(lat, lon)?.id ?? revier;
}

export function revierNachgezogen(
  revier: string | null | undefined,
  start: { lat: number; lon: number } | null | undefined,
  ziel: { lat: number; lon: number } | null | undefined,
): string | null {
  if (!revier) return revier ?? null;
  const teile = revier.split(REVIER_PFEIL);
  const neu = teile.map((teil, i) => {
    const p = i === 0 ? start : i === teile.length - 1 ? ziel : null;
    if (!p) return teil;
    for (const sprache of ['de', 'en'] as const) {
      const alt = REVIER_NAMEN.westmed[sprache];
      if (!teil.endsWith(alt)) continue;
      const name = seegebietName(p.lat, p.lon, sprache);
      return name ? teil.slice(0, teil.length - alt.length) + name : teil;
    }
    return teil;
  });
  return neu.join(REVIER_PFEIL);
}

export const REVIER_PFEIL = ' → ';

export function startRevierTeil(revier: string | null | undefined): string | null {
  const teil = revier?.split(REVIER_PFEIL)[0]?.trim();
  return teil || null;
}

export function toernRevierStrecke(
  startText: string | null,
  start: { lat: number; lon: number } | null,
  ziel: { lat: number; lon: number; land: string | null } | null,
  sprache: 'de' | 'en' = 'de',
): string | null {
  if (!ziel) return startText;
  const zielText = toernRevierText(ziel.land, ziel.lat, ziel.lon, sprache);
  if (!zielText) return startText;
  if (!startText) return zielText;
  const gleicheZone = !!start && seegebietSchluessel(start.lat, start.lon) === seegebietSchluessel(ziel.lat, ziel.lon);
  const gleichesLand = !ziel.land?.trim() || startText.includes(ziel.land.trim());
  if (zielText === startText || (gleicheZone && gleichesLand)) return startText;
  return `${startText}${REVIER_PFEIL}${zielText}`;
}

export type Wirkungsart = 'beziffert' | 'ausschluss' | 'schutz' | 'modellblind' | 'information';

export function wirkungsart(e: RevierwissenEintrag): Wirkungsart {
  switch (e.folge) {
    case 'zuschlag': return 'beziffert';
    case 'kein-liegeplatz': return 'ausschluss';
    case 'schutzhafen': return 'schutz';
    case 'modell-blind': return 'modellblind';
    case 'hinweis': return 'information';
  }
}

export function eintraegeFuerName(name: string): RevierwissenEintrag[] {
  const gesucht = name.trim().toLowerCase();
  return REVIERWISSEN.filter((e) => {
    const o = e.ortsbezug;
    if (o.art === 'ort') return o.name.toLowerCase() === gesucht;
    if (o.art === 'strecke') return o.von.toLowerCase() === gesucht || o.nach.toLowerCase() === gesucht;
    return false;
  });
}

export function eintraegeFuerPunkt(lat: number, lon: number): RevierwissenEintrag[] {
  const revier = revierVonPunkt(lat, lon);
  return REVIERWISSEN.filter((e) => {
    const o = e.ortsbezug;
    if (o.art === 'gebiet') return inBox(lat, lon, o.swLat, o.neLat, o.swLon, o.neLon);
    if (o.art === 'revier') return revier !== null && o.revier === revier;
    return false;
  });
}

export const PUNKT_TOLERANZ_SM = 0.5;

export function eintraegeFuerNahenPunkt(
  lat: number, lon: number, toleranzSm = PUNKT_TOLERANZ_SM,
): RevierwissenEintrag[] {
  return REVIERWISSEN.filter((e) => {
    const o = e.ortsbezug;
    if (o.art !== 'punkt') return false;
    return distNM(lat, lon, o.lat, o.lon) <= toleranzSm;
  });
}

export function eintraegeFuerStrecke(von: string, nach: string): RevierwissenEintrag[] {
  const a = von.trim().toLowerCase(), b = nach.trim().toLowerCase();
  return REVIERWISSEN.filter((e) => {
    const o = e.ortsbezug;
    if (o.art !== 'strecke') return false;
    const ov = o.von.toLowerCase(), on = o.nach.toLowerCase();
    return (ov === a && on === b) || (ov === b && on === a);
  });
}
