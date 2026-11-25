import {
  fahrtenZuToern, ladeFixe, orteZurFahrt, speicherVerfuegbar, type Fahrt,
} from '@/data/logdb';
import { toernBilanz, type FahrtMitSpur, type Etappe as GefahreneEtappe } from '@/core/toernbilanz';
import type { Punkt } from '@/core/types';

export type GefahrenArt = 'ohneOrt' | 'amOrt' | 'nach' | 'vonNach';
export function gefahrenArt(g: { von: string | null; nach: string | null; nm: number }): GefahrenArt {
  if (!g.nach) return 'ohneOrt';
  if (g.nm < 0.05) return 'amOrt';
  return g.von ? 'vonNach' : 'nach';
}

export interface GefahrenerTag {
  tag: number;
  vonOrt: string | null;
  nachOrt: string | null;
  nm: number;
  nachPos: Punkt;
}

export function tagAusZeitstempel(toernVonIso: string, tMs: number): number {
  const von = new Date(`${toernVonIso}T00:00:00`);
  const t = new Date(tMs);
  const vonTag = new Date(von.getFullYear(), von.getMonth(), von.getDate()).getTime();
  const tTag = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((tTag - vonTag) / 86_400_000) + 1;
}

export function tagAusPlanDatum(toernVonIso: string, etappenDatumIso: string): number {
  return tagAusZeitstempel(toernVonIso, new Date(`${etappenDatumIso}T00:00:00`).getTime());
}

export function gefahreneTage(toernVonIso: string, etappen: readonly GefahreneEtappe[]): GefahrenerTag[] {
  return etappen
    .filter((e): e is GefahreneEtappe & { nachPos: Punkt } => e.nachPos != null)
    .map((e) => ({
      tag: tagAusZeitstempel(toernVonIso, e.von),
      vonOrt: e.vonOrt ?? null,
      nachOrt: e.nachOrt ?? null,
      nm: e.nm,
      nachPos: e.nachPos,
    }));
}

async function mitSpurAufbauen(fahrten: readonly Fahrt[]): Promise<FahrtMitSpur[]> {
  const raus: FahrtMitSpur[] = [];
  for (const f of fahrten) {
    const [fixe, orte] = await Promise.all([ladeFixe(f.id), orteZurFahrt(f.id)]);
    if (!fixe.length) continue;
    raus.push({
      id: f.id, fixe,
      ...(orte.start ? { vonOrt: orte.start } : {}),
      ...(orte.ziel ? { nachOrt: orte.ziel } : {}),
    });
  }
  return raus;
}

export async function holeGefahreneTage(toernId: string, toernVonIso: string): Promise<GefahrenerTag[]> {
  if (!speicherVerfuegbar()) return [];
  const fahrten = await fahrtenZuToern(toernId);
  if (!fahrten.length) return [];
  const mitSpur = await mitSpurAufbauen(fahrten);
  if (!mitSpur.length) return [];
  return gefahreneTage(toernVonIso, toernBilanz(mitSpur).etappen);
}

export interface GeplanteZeile {
  tag: number;
  vonName: string;
  nachName: string;
}

export interface VergleichsZeile {
  tag: number;
  geplant: { von: string; nach: string } | null;
  gefahren: { von: string | null; nach: string | null; nm: number } | null;

  weicht: boolean;
}

function gleicherOrt(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function vergleichePlanMitWirklichkeit(
  geplant: readonly GeplanteZeile[], gefahren: readonly GefahrenerTag[],
): VergleichsZeile[] {

  const geplantJeTag = new Map<number, GeplanteZeile>();
  for (const g of geplant) {
    const da = geplantJeTag.get(g.tag);
    geplantJeTag.set(g.tag, da ? { ...da, nachName: g.nachName } : g);
  }
  const gefahrenJeTag = new Map<number, GefahrenerTag>();
  for (const g of gefahren) {
    const da = gefahrenJeTag.get(g.tag);
    gefahrenJeTag.set(g.tag, da ? { ...da, nachOrt: g.nachOrt, nachPos: g.nachPos, nm: da.nm + g.nm } : g);
  }
  const tage = [...new Set([...geplantJeTag.keys(), ...gefahrenJeTag.keys()])].sort((a, b) => a - b);
  return tage.map((tag) => {
    const g = geplantJeTag.get(tag) ?? null;
    const f = gefahrenJeTag.get(tag) ?? null;
    return {
      tag,
      geplant: g ? { von: g.vonName, nach: g.nachName } : null,
      gefahren: f ? { von: f.vonOrt, nach: f.nachOrt, nm: f.nm } : null,
      weicht: !!(g && f?.nachOrt && !gleicherOrt(g.nachName, f.nachOrt)),
    };
  });
}

export function neuerStartpunkt(gefahren: readonly GefahrenerTag[]): { ort: Punkt; name: string | null } | null {
  const sortiert = [...gefahren].sort((a, b) => a.tag - b.tag);
  const letzte = sortiert[sortiert.length - 1];
  if (!letzte) return null;
  return { ort: letzte.nachPos, name: letzte.nachOrt };
}
