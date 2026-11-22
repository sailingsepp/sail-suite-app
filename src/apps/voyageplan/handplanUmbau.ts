import type { EtappenWegpunkt, NeueEtappeDaten } from '@/data/toernApi';
import type { EtappeEntwurf } from './kontext';

const TAG_MS = 86_400_000;

export function ankunftsTag(e: Pick<EtappeEntwurf, 'datum' | 'ankunftDatum'>): string | null {
  return e.ankunftDatum ?? e.datum;
}

export function naechteUnterwegs(e: Pick<EtappeEntwurf, 'datum' | 'ankunftDatum'>): number {
  if (!e.datum || !e.ankunftDatum) return 0;
  return Math.max(0, Math.round((Date.parse(`${e.ankunftDatum}T00:00:00Z`) - Date.parse(`${e.datum}T00:00:00Z`)) / TAG_MS));
}

export function plusTage(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * TAG_MS).toISOString().slice(0, 10);
}

export function sortiereEtappen<T extends Pick<EtappeEntwurf, 'datum' | 'abfahrtZeit' | 'art'>>(etappen: readonly T[]): T[] {
  return etappen.map((e, i) => ({ e, i })).sort((a, b) => {
    if (!a.e.datum || !b.e.datum) return (a.e.datum ? 0 : 1) - (b.e.datum ? 0 : 1) || a.i - b.i;
    if (a.e.datum !== b.e.datum) return a.e.datum < b.e.datum ? -1 : 1;

    const ah = a.e.art === 'hafentag' ? 0 : 1, bh = b.e.art === 'hafentag' ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return (a.e.abfahrtZeit ?? '').localeCompare(b.e.abfahrtZeit ?? '') || a.i - b.i;
  }).map((x) => x.e);
}

export function letzterLiegeplatz(etappen: readonly EtappeEntwurf[]): { ort: EtappenWegpunkt; name: string; tag: string; zeit: string | null } | null {
  let best: EtappeEntwurf | null = null;
  for (const e of etappen) {
    const t = ankunftsTag(e);
    if (!t || e.wegpunkte.length === 0) continue;
    const bt = best ? ankunftsTag(best)! : '';
    if (!best || t > bt || (t === bt && (e.ankunftZeit ?? e.abfahrtZeit ?? '') >= (best.ankunftZeit ?? best.abfahrtZeit ?? ''))) best = e;
  }
  if (!best) return null;
  return {
    ort: best.wegpunkte[best.wegpunkte.length - 1]!,
    name: best.nachName || best.vonName || '',
    tag: ankunftsTag(best)!,
    zeit: best.art === 'hafentag' ? null : (best.ankunftZeit ?? null),
  };
}

export interface AbTagTeilung {

  behalten: EtappeEntwurf[];

  fest: EtappeEntwurf[];

  start: { ort: EtappenWegpunkt; name: string } | null;

  vonIso: string;

  abZeit: string | null;
}

export function teileAbTag(etappen: readonly EtappeEntwurf[], xIso: string): AbTagTeilung {
  const behalten = etappen.filter((e) => !e.datum || e.datum < xIso);
  const fest = etappen.filter((e) => e.datum != null && e.datum >= xIso && e.fixiert);
  const liegt = letzterLiegeplatz(behalten);
  let vonIso = xIso;
  let abZeit: string | null = null;
  if (liegt && liegt.tag >= xIso) {
    vonIso = liegt.tag;
    abZeit = liegt.zeit;
  }
  return { behalten, fest, start: liegt ? { ort: liegt.ort, name: liegt.name } : null, vonIso, abZeit };
}

export function alsNeueEtappe(e: EtappeEntwurf, nummer: number): NeueEtappeDaten {
  return {
    id: e.id, nummer, gewaehlt: e.gewaehlt, datum: e.datum,
    vonName: e.vonName || null, nachName: e.nachName || null,
    wegpunkte: e.wegpunkte, fixiert: e.fixiert, notiz: e.notiz,
    art: e.art ?? 'fahrt',
    abfahrtZeit: e.art === 'hafentag' ? null : (e.abfahrtZeit ?? null),
    ankunftDatum: e.art === 'hafentag' ? null : (e.ankunftDatum ?? null),
    ankunftZeit: e.art === 'hafentag' ? null : (e.ankunftZeit ?? null),
  };
}

export function ausNeuerEtappe(d: NeueEtappeDaten): EtappeEntwurf {
  return {
    id: d.id, vonName: d.vonName ?? '', nachName: d.nachName ?? '', datum: d.datum ?? null,
    notiz: d.notiz ?? null, wegpunkte: d.wegpunkte, fixiert: d.fixiert ?? false, gewaehlt: d.gewaehlt ?? false,
    art: d.art ?? (d.wegpunkte.length === 1 ? 'hafentag' : 'fahrt'),
    abfahrtZeit: d.abfahrtZeit ?? null, ankunftDatum: d.ankunftDatum ?? null, ankunftZeit: d.ankunftZeit ?? null,
  };
}

export function mitFestenEtappen(neu: readonly EtappeEntwurf[], fest: readonly EtappeEntwurf[]): EtappeEntwurf[] {
  const out = neu.map((e) => ({ ...e }));
  for (const f of fest) {
    const t = ankunftsTag(f);
    const treffer = out.find((e) => e.art !== 'hafentag' && ankunftsTag(e) === t);
    if (treffer) treffer.fixiert = true;
    else out.push(f);
  }
  return out;
}

export function hafentagVorschlag(etappen: readonly EtappeEntwurf[], start: { ort: EtappenWegpunkt; name: string } | null, vonIso: string | null): Pick<EtappeEntwurf, 'datum' | 'nachName' | 'wegpunkte'> {
  const liegt = letzterLiegeplatz(etappen);
  if (liegt) return { datum: plusTage(liegt.tag, 1), nachName: liegt.name, wegpunkte: [liegt.ort] };
  return { datum: vonIso, nachName: start?.name ?? '', wegpunkte: start ? [start.ort] : [] };
}
