import type { EtappeDaten } from '@/data/toernApi';
import type { Punkt } from '@/core/types';
import { distNM } from '@/core/geo';
import { eigenerOptionsName } from '@/core/optionen';

export { eigenerOptionsName };

export const PLAN_SCHLUESSEL = ['automatik', 'automatik-2', 'plan'] as const;

export interface PlanAuswahl {
  schluessel: string;
  etappen: EtappeDaten[];

  name: string | null;

  andereOption: { schluessel: string; name: string | null } | null;
}

export function waehlePlan(plaene: ReadonlyMap<string, EtappeDaten[]>): PlanAuswahl | null {
  const vorhanden = PLAN_SCHLUESSEL.filter((s) => (plaene.get(s)?.length ?? 0) > 0);
  if (vorhanden.length === 0) return null;
  const gewaehlt = vorhanden.find((s) => s !== 'plan' && plaene.get(s)![0]!.gewaehlt);
  const schluessel = gewaehlt ?? vorhanden[0]!;
  const andere = vorhanden.find((s) => s !== schluessel && s !== 'plan') ?? null;
  return {
    schluessel,
    etappen: [...plaene.get(schluessel)!].sort((a, b) => a.nummer - b.nummer),
    name: eigenerOptionsName(plaene.get(schluessel)![0]!.anzeigename),
    andereOption: andere ? { schluessel: andere, name: eigenerOptionsName(plaene.get(andere)![0]!.anzeigename) } : null,
  };
}

export interface PlanZeile {

  tag: number;
  datum: string | null;
  vonName: string;
  nachName: string;
  istHafentag: boolean;
  sm: number | null;
  von: Punkt | null;
  nach: Punkt | null;

  wegpunkte: Punkt[];
}

export function planZeile(e: EtappeDaten): PlanZeile {
  const erster = e.wegpunkte[0] ?? null, letzter = e.wegpunkte[e.wegpunkte.length - 1] ?? null;
  const istHafentag = e.wegpunkte.length < 2;
  return {
    tag: e.nummer + 1, datum: e.datum,
    vonName: e.von_name ?? '', nachName: e.nach_name ?? '',
    istHafentag,
    sm: !istHafentag && erster && letzter ? distNM(erster.lat, erster.lon, letzter.lat, letzter.lon) : null,
    von: istHafentag ? null : erster, nach: istHafentag ? null : letzter,
    wegpunkte: istHafentag ? [] : e.wegpunkte.map((p) => ({ lat: p.lat, lon: p.lon })),
  };
}
