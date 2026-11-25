import type { WochenplanEtappe } from './wochenplan';
import type { Kandidatennetz } from './hafennetz';
import { eintraegeFuerStrecke } from './revierzonen';

export type Herkunft =
  | { art: 'vorhersage'; modell: string; abrufzeitIso: string }
  | { art: 'reviersegelliteratur' }
  | { art: 'toernfuehrer'; werk: string; seite: number }
  | { art: 'eigene-erfahrung'; datumIso: string }
  | { art: 'modell-blind' }

  | { art: 'nutzervorgabe' };

export type BedingungsArt =
  | 'termin' | 'grenzwert' | 'tagesgrenze' | 'nachtfahrtbudget' | 'bereitschaft'
  | 'wunschziel' | 'fixierung' | 'ruhetag' | 'umkehrpunkt' | 'unfahrbar'
  | 'kein-kostenkarten-eintrag';

export interface BindendeBedingung {
  tag: number;
  art: BedingungsArt;

  parameter: Readonly<Record<string, string | number>>;
  herkunft: Herkunft;
}

export interface EntscheidendeKennzahl {
  tag: number;

  kennzahl: string;
  wert: number;
  einheit: string;
}

export interface VerworfeneAlternative {
  tag: number;

  nachIndex: number;
  grundArt: 'schlechter-score' | BedingungsArt;
}

export interface UnbekannteStelle {
  tag: number;
  art: 'jenseits-vorhersagehorizont' | 'modell-blind' | 'kennzahl-nicht-angebunden';
}

export interface TagesBegruendung {
  tag: number;
  bindend: readonly BindendeBedingung[];
  entscheidend: readonly EntscheidendeKennzahl[];
  verworfen: readonly VerworfeneAlternative[];
  unbekannt: readonly UnbekannteStelle[];
}

export interface Begruendungsspur {
  tage: readonly TagesBegruendung[];
}

export const VERWORFENE_MAX_JE_TAG = 3;

function zustandsSchluessel(knotenIndex: number, tag: number): string {
  return `${knotenIndex}|${tag}`;
}

export class BegruendungsSammler {
  private readonly bindendJeZustand = new Map<string, BindendeBedingung>();
  private readonly verworfenJeZustand = new Map<string, VerworfeneAlternative[]>();

  bindend(tag: number, knotenIndex: number, bedingung: Omit<BindendeBedingung, 'tag'>): void {

    this.bindendJeZustand.set(zustandsSchluessel(knotenIndex, tag), { tag, ...bedingung });
  }

  verworfen(tag: number, knotenIndex: number, alt: Omit<VerworfeneAlternative, 'tag'>): void {
    const schluessel = zustandsSchluessel(knotenIndex, tag);
    const liste = this.verworfenJeZustand.get(schluessel) ?? [];

    if (liste.some((v) => v.nachIndex === alt.nachIndex && v.grundArt === alt.grundArt)) return;
    liste.push({ tag, ...alt });
    this.verworfenJeZustand.set(schluessel, liste);
  }

  ergebnisFuerPlan(etappen: readonly WochenplanEtappe[]): Begruendungsspur {
    const tage: TagesBegruendung[] = etappen.map((etappe) => {
      const bindungsSchluessel = zustandsSchluessel(etappe.nachIndex, etappe.tag);
      const verwurfsSchluessel = zustandsSchluessel(etappe.vonIndex, etappe.tag);
      const bindung = this.bindendJeZustand.get(bindungsSchluessel);

      const verworfen = (this.verworfenJeZustand.get(verwurfsSchluessel) ?? [])
        .filter((v) => v.nachIndex !== etappe.nachIndex)
        .slice(0, VERWORFENE_MAX_JE_TAG);
      return {
        tag: etappe.tag,
        bindend: bindung ? [bindung] : [],
        entscheidend: [],
        verworfen,
        unbekannt: [],
      };
    });
    return { tage };
  }
}

export function entscheidendeKennzahlFuerTag(
  etappe: WochenplanEtappe, entscheidenderSchritt: string | null,
  vergleichsEtappe: WochenplanEtappe | null = null,
): EntscheidendeKennzahl | null {
  if (entscheidenderSchritt == null) return null;
  if (vergleichsEtappe && vergleichsEtappe.vonIndex === etappe.vonIndex
    && vergleichsEtappe.nachIndex === etappe.nachIndex && vergleichsEtappe.istHafentag === etappe.istHafentag) {
    return null;
  }
  const k = etappe.kennzahlen;
  const werte: Record<string, { wert: number | null; einheit: string }> = {
    gedeckte_naechte: { wert: k.schutzWellenanlaufNM, einheit: 'sm' },
    kreuzanteil: {
      wert: k.vmgShareAnteil != null && k.totalHrs != null ? k.vmgShareAnteil * k.totalHrs : null,
      einheit: 'h',
    },
    motoranteil: {
      wert: k.motorShareAnteil != null && k.totalHrs != null ? k.motorShareAnteil * k.totalHrs : null,
      einheit: 'h',
    },
    fahrzeit: { wert: k.totalHrs, einheit: 'h' },
  };
  const eintrag = werte[entscheidenderSchritt];
  if (!eintrag || eintrag.wert == null) return null;
  return { tag: etappe.tag, kennzahl: entscheidenderSchritt, wert: eintrag.wert, einheit: eintrag.einheit };
}

export function unbekannteStellenFuerEtappe(etappe: WochenplanEtappe, netz: Kandidatennetz): UnbekannteStelle[] {
  if (etappe.istHafentag) return [];
  if (etappe.regime === 'geruest') return [{ tag: etappe.tag, art: 'jenseits-vorhersagehorizont' }];

  const stellen: UnbekannteStelle[] = [];
  const von = netz.knoten[etappe.vonIndex]?.name;
  const nach = netz.knoten[etappe.nachIndex]?.name;
  if (von && nach && eintraegeFuerStrecke(von, nach).some((e) => e.folge === 'modell-blind')) {
    stellen.push({ tag: etappe.tag, art: 'modell-blind' });
  }
  if (etappe.kennzahlen.schutzWellenanlaufNM == null) {
    stellen.push({ tag: etappe.tag, art: 'kennzahl-nicht-angebunden' });
  }
  return stellen;
}
