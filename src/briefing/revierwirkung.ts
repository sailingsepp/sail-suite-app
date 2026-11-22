import type { RevierwissenEintrag, Wirkung } from '@/core/revierwissen';
import { beaufort, beaufortUntergrenzeKn } from './wind';
import { erkannterLokalwind, type WindKey } from './localWinds';
import type { LokalwindLage } from './localWinds';
import type { Synoptik } from './synoptik';

const STARK_SCHWELLE_KN = 25;

function windKeyFuerBasis(basis: string): WindKey | null {
  switch (basis) {
    case 'Meltemi': return 'Meltemi';
    case 'Bora': return 'Bora';
    case 'Loddos': return 'Loddos';

    case 'Notos': return 'Notos';

    case 'Jugo':
    case 'Schirokko':
      return 'Jugo';
    default:
      return null;
  }
}

export function bedingungAktiv(bedingung: string | null, lokalwind: WindKey | null, maxWindKn: number): boolean {
  if (bedingung == null) return true;
  const windAb = /^Wind ab (\d+(?:[.,]\d+)?) kn$/.exec(bedingung);
  if (windAb) return maxWindKn >= Number(windAb[1]!.replace(',', '.'));
  const starkMatch = /^(.+) (?:stark|schwer)$/.exec(bedingung);
  const basis = starkMatch ? starkMatch[1]! : bedingung;
  const key = windKeyFuerBasis(basis);
  if (key == null || lokalwind !== key) return false;
  return starkMatch ? maxWindKn >= STARK_SCHWELLE_KN : true;
}

export function lokalwindFuerEtappe(b: LokalwindLage, monat: number, syn?: Synoptik | null): WindKey | null {
  return erkannterLokalwind(b, monat, syn);
}

export function zuschlagKn(wirkung: Wirkung, aktuelleWindKn: number): number {
  if (wirkung.einheit === 'Bft') {
    const zielBft = beaufort(aktuelleWindKn) + wirkung.bis;
    return Math.max(0, beaufortUntergrenzeKn(zielBft) - aktuelleWindKn);
  }
  if (wirkung.einheit === '%') return aktuelleWindKn * (wirkung.bis / 100);
  return 0;
}

export function wirktAlsAusschluss(
  eintrag: RevierwissenEintrag, lokalwind: WindKey | null, maxWindKn: number,
  minAusschlussWindKn: number, crewZumutbarkeitProzent: number | null,
): boolean {
  if (eintrag.folge !== 'kein-liegeplatz') return false;
  if (maxWindKn < minAusschlussWindKn) return false;
  if (!bedingungAktiv(eintrag.bedingung, lokalwind, maxWindKn)) return false;
  if (
    eintrag.abErfahrungProzent != null && crewZumutbarkeitProzent != null
    && crewZumutbarkeitProzent >= eintrag.abErfahrungProzent
  ) return false;
  return true;
}

export function wirktAlsSchutz(eintrag: RevierwissenEintrag, lokalwind: WindKey | null, maxWindKn: number): boolean {
  if (eintrag.folge !== 'schutzhafen') return false;
  return bedingungAktiv(eintrag.bedingung, lokalwind, maxWindKn);
}
