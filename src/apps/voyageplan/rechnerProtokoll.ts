import type { Wunschziel, Endziel } from '@/core/wunschziele';
import type { Hafenknoten, Kandidatennetz } from '@/core/hafennetz';
import {
  kostenSchluessel, type WochenplanErgebnis, type WochenplanEtappe, type Kostenkarte,
} from '@/core/wochenplan';
import type { ReihungsSchritt } from '@/core/zielfunktion';
import type { Begruendungsspur } from '@/core/begruendung';
import type { UmkehrpunktErgebnis } from '@/core/rueckkehr';
import { entscheidendeKennzahlFuerTag, unbekannteStellenFuerEtappe } from '@/core/begruendung';
import type { OptionKennzahlen, Entscheidungspunkt, OptionsEmpfehlung } from '@/core/optionen';
import type { Punkt, SchiffConfig, Grenzwerte, Sprache } from '@/core/types';
import { distNM } from '@/core/geo';
import type { NachtVorgaben } from '@/core/bereitschaft';
import type { KostenkartenBericht } from './kostenkarte';
import type { PlanungEinstellungen } from './planung';

export interface RechnerAnfrage {
  start: { ort: Punkt; name: string };

  rueckgabehafen?: { ort: Punkt; name: string } | null;

  uebernahmeIso?: string | null;
  rueckgabeIso?: string | null;

  ohneUmkehrpunkt?: boolean;

  offenesEnde?: boolean;
  wunschziele: Wunschziel[];
  endziel: Endziel | null;

  zweiteOption?: OptionWunsch | null;
  gesamtFahrtage: number;

  startDatumIso: string;
  cfg: SchiffConfig;
  limits: Grenzwerte;
  obergrenzeSm: number | null;
  maxStundenProTag: number;
  sprache: Sprache;

  nachtVorgaben?: NachtVorgaben | null;

  planung?: Required<PlanungEinstellungen> | null;

  ruhetagIndizes?: readonly number[];
  zweiteOptionRuhetagIndizes?: readonly number[];

  zeitbudgetMs?: number | null;

  fixierungen?: readonly { tag: number; ort: Punkt; name: string }[];
}

export interface OptionWunsch {

  name: string;
  wunschziele: Wunschziel[];
  endziel: Endziel | null;
}

export interface OptionEingabe extends OptionWunsch {

  schluessel: string;
}

export const OPTION_SCHLUESSEL_1 = 'automatik';
export const OPTION_SCHLUESSEL_2 = 'automatik-2';

export const AUTOMATIK_SCHLUESSEL: readonly string[] = [OPTION_SCHLUESSEL_1, OPTION_SCHLUESSEL_2];

export interface OptionErgebnis {

  schluessel: string;
  name: string;
  ergebnis: WochenplanErgebnis | null;
  begruendung: Begruendungsspur | null;
  reihenfolge: readonly ReihungsSchritt[];

  umkehrpunkt: UmkehrpunktErgebnis | null;

  keinPlanGrund?: KeinPlanGrund;
}

export type KeinPlanGrund =

  | { art: 'poiOhneBasis'; name: string }

  | { art: 'ortOhneLiegeplatz'; name: string }

  | { art: 'grenzuebertritt'; name: string }

  | { art: 'tagesmeilenNull' }

  | { art: 'keineKandidaten' }

  | { art: 'keineHaefenGeladen' }

  | { art: 'keinWetter'; ohneWetter: number; kanten: number; kontingent?: 'tag' | 'stunde' }

  | { art: 'zielUnerreichbar'; name: string; lockerung?: Lockerung }

  | { art: 'zielOhneZufahrt'; name: string; lockerung?: Lockerung }

  | { art: 'unklar'; ohneWetter: number; kanten: number; lockerung?: Lockerung };

export type Lockerung =

  | { art: 'reserve'; tage: number; ruhetage?: number }
  | { art: 'umkehrpunkt' }
  | { art: 'ruhetage'; tage: number }
  | { art: 'ohneWunsch'; name: string }

  | {
    art: 'staerker'; naechte?: number;
    lang?: { tage: number; stunden: number; dunkelAblegen: number; ablegenErlaubt: boolean };

    beide?: boolean;
  }

  | { art: 'keine'; stunden: number; geprueftBis?: number; geprueftNaechte?: number }

  | { art: 'abstaende'; stunden: number; naechte: number };

export function lockerungTextSchluessel(
  grund: KeinPlanGrund,
): { schluessel: string; werte: Record<string, string>; weitere?: string[] } | null {
  if (!('lockerung' in grund) || !grund.lockerung) return null;
  const l = grund.lockerung;
  switch (l.art) {

    case 'reserve': {
      const ruhe = l.ruhetage ?? 0;
      if (l.tage > 0 && ruhe > 0) {
        return { schluessel: 'automatik.lockerungReserveUndRuhe', werte: { n: String(l.tage), r: String(ruhe) } };
      }
      if (ruhe > 0) {
        return { schluessel: ruhe === 1 ? 'automatik.lockerungRuhetagRueckkehr1' : 'automatik.lockerungRuhetageRueckkehr', werte: { n: String(ruhe) } };
      }
      return { schluessel: l.tage === 1 ? 'automatik.lockerungReserve1' : 'automatik.lockerungReserve', werte: { n: String(l.tage) } };
    }
    case 'umkehrpunkt': return { schluessel: 'automatik.lockerungUmkehrpunkt', werte: {} };
    case 'ruhetage': return { schluessel: 'automatik.lockerungRuhetage', werte: { n: String(l.tage) } };
    case 'ohneWunsch': return { schluessel: 'automatik.lockerungOhneWunsch', werte: { name: l.name } };
    case 'staerker': {
      const teile: string[] = [];
      const werte: Record<string, string> = {};
      if (l.beide && l.naechte != null && l.lang) {
        teile.push('automatik.lockerungNachtUndLang');
        werte.n = String(l.naechte);
        werte.h = String(l.lang.stunden);
      } else if (l.naechte != null) {
        teile.push(l.naechte === 1 ? 'automatik.lockerungNacht1' : 'automatik.lockerungNacht');
        werte.n = String(l.naechte);
      }
      if (l.lang && !l.beide) {
        const oder = l.naechte != null ? 'Oder' : '';
        teile.push(l.lang.tage === 1 ? `automatik.lockerung${oder}Lang1` : `automatik.lockerung${oder}Lang`);
        werte.t = String(l.lang.tage);
        werte.h = String(l.lang.stunden);
        if (l.lang.dunkelAblegen > 0) {
          teile.push(l.lang.ablegenErlaubt
            ? (l.lang.dunkelAblegen === 1 ? 'automatik.lockerungDunkel1' : 'automatik.lockerungDunkel')
            : (l.lang.dunkelAblegen === 1 ? 'automatik.lockerungDunkelErlauben1' : 'automatik.lockerungDunkelErlauben'));
          werte.d = String(l.lang.dunkelAblegen);
        }
      }
      if (l.lang && l.beide && l.lang.dunkelAblegen > 0) {
        teile.push(l.lang.ablegenErlaubt
          ? (l.lang.dunkelAblegen === 1 ? 'automatik.lockerungDunkel1' : 'automatik.lockerungDunkel')
          : (l.lang.dunkelAblegen === 1 ? 'automatik.lockerungDunkelErlauben1' : 'automatik.lockerungDunkelErlauben'));
        werte.d = String(l.lang.dunkelAblegen);
      }
      return { schluessel: teile[0]!, werte, weitere: teile.slice(1) };
    }
    case 'abstaende': return { schluessel: 'automatik.lockerungAbstaende', werte: { h: String(l.stunden), n: String(l.naechte) } };
    case 'keine': return l.geprueftBis != null
      ? { schluessel: 'automatik.lockerungKeineGeprueft', werte: { h: String(l.stunden), bis: String(l.geprueftBis), n: String(l.geprueftNaechte ?? 0) } }
      : { schluessel: 'automatik.lockerungKeine', werte: { h: String(l.stunden) } };
  }
}

export function ermittleKeinPlanGrund(
  netz: Kandidatennetz, kosten: Kostenkarte, bericht: KostenkartenBericht,
  gesamtFahrtage: number, pflichtIndizes: readonly number[],
): KeinPlanGrund {
  const ohneWetter = bericht.fehlgeschlagen;
  if (netz.kanten.length === 0) return { art: 'keineKandidaten' };
  if (ohneWetter === bericht.kanten) return { art: 'keinWetter', ohneWetter, kanten: bericht.kanten };

  for (const index of pflichtIndizes) {
    const zufahrten = netz.kanten
      .map((kante, kanteIndex) => ({ kante, kanteIndex }))
      .filter(({ kante }) => kante.nach === index);
    const erreichbar = zufahrten.some(({ kanteIndex }) => Array
      .from({ length: gesamtFahrtage }, (_, i) => i + 1)
      .some((t) => kosten.has(kostenSchluessel(kanteIndex, t))));
    if (zufahrten.length === 0) {
      return { art: 'zielOhneZufahrt', name: netz.knoten[index]?.name ?? '?' };
    }
    if (!erreichbar) {
      return { art: 'zielUnerreichbar', name: netz.knoten[index]?.name ?? '?' };
    }
  }
  return { art: 'unklar', ohneWetter, kanten: bericht.kanten };
}

export function keinPlanTextSchluessel(grund: KeinPlanGrund): { schluessel: string; werte: Record<string, string> } {
  switch (grund.art) {
    case 'poiOhneBasis':
      return { schluessel: 'automatik.keinPlanPoi', werte: { name: grund.name } };
    case 'ortOhneLiegeplatz':
      return { schluessel: 'automatik.keinPlanOrt', werte: { name: grund.name } };
    case 'grenzuebertritt':
      return { schluessel: 'automatik.keinPlanGrenze', werte: { name: grund.name } };
    case 'tagesmeilenNull':
      return { schluessel: 'automatik.keinPlanTagesmeilenNull', werte: {} };
    case 'keineKandidaten':
      return { schluessel: 'automatik.keinPlanKeineKandidaten', werte: {} };
    case 'keineHaefenGeladen':
      return { schluessel: 'automatik.keinPlanKeineHaefen', werte: {} };
    case 'keinWetter':

      if (grund.kontingent) {
        return { schluessel: grund.kontingent === 'tag' ? 'automatik.keinPlanKontingentTag' : 'automatik.keinPlanKontingentStunde', werte: {} };
      }
      return { schluessel: 'automatik.keinPlanKeinWetter', werte: { n: String(grund.kanten) } };

    case 'zielUnerreichbar':
      return { schluessel: grund.lockerung ? 'automatik.keinPlanZielZuWeit' : 'automatik.keinPlanZiel', werte: { name: grund.name } };
    case 'zielOhneZufahrt':
      return { schluessel: grund.lockerung ? 'automatik.keinPlanZielZuWeit' : 'automatik.keinPlanZielOhneZufahrt', werte: { name: grund.name } };
    case 'unklar':
      return {
        schluessel: 'automatik.keinPlanUnklar',
        werte: { n: String(grund.ohneWetter), m: String(grund.kanten) },
      };
  }
}

export function ohneWetterTextSchluessel(
  bericht: KostenkartenBericht,
): { schluessel: string; werte: Record<string, string> } | null {
  if (bericht.fehlgeschlagen === 0) return null;
  return {
    schluessel: 'automatik.ohneWetter',
    werte: { n: String(bericht.fehlgeschlagen), m: String(bericht.kanten) },
  };
}

export function kuesteUnbekanntTextSchluessel(bericht: KostenkartenBericht): string | null {
  return bericht.kuesteUnbekannt ? 'automatik.kuesteUnbekannt' : null;
}

export function haefenTeilpaketTextSchluessel(bericht: KostenkartenBericht): string | null {
  return bericht.haefenTeilpaket ? 'automatik.haefenTeilpaket' : null;
}

export function haefenUnbekanntTextSchluessel(bericht: KostenkartenBericht): string | null {
  return bericht.haefenUnbekannt ? 'automatik.haefenUnbekannt' : null;
}

export function kuesteRueckfallTextSchluessel(bericht: KostenkartenBericht): string | null {
  return bericht.kuesteRueckfall ? 'automatik.kuesteRueckfall' : null;
}

export function zeitbudgetTextSchluessel(
  bericht: KostenkartenBericht,
): { schluessel: string; werte: Record<string, string> } | null {
  if (!bericht.zeitbudgetErreicht) return null;
  return {
    schluessel: 'automatik.zeitbudget',
    werte: { min: String(Math.round((bericht.zeitbudgetMs ?? 0) / 60_000)), n: String(bericht.uebersprungen), m: String(bericht.kanten) },
  };
}

export function netzGedeckeltTextSchluessel(
  bericht: KostenkartenBericht,
): { schluessel: string; werte: Record<string, string> } | null {
  if (!bericht.kandidatenGedeckelt) return null;
  return {
    schluessel: 'automatik.netzGedeckelt',
    werte: { vorher: String(bericht.kandidatenGedeckelt.vorher), n: String(bericht.kandidatenGedeckelt.behalten) },
  };
}

export type RechnerAntwort =
  | {
      lage: 'gefunden'; ergebnis: WochenplanErgebnis; netz: Kandidatennetz;
      reihenfolge: readonly ReihungsSchritt[]; begruendung: Begruendungsspur;

      bericht: KostenkartenBericht;

      umkehrpunkt: UmkehrpunktErgebnis | null;

      optionen?: readonly OptionErgebnis[];

      vergleich?: {
        kennzahlen: readonly OptionKennzahlen[]; entscheidungspunkt: Entscheidungspunkt;

        empfehlung?: OptionsEmpfehlung | null;
      } | null;

      grenzuebertritte?: readonly { tag: number; vonName: string; nachName: string }[];

      zufahrtErsatz?: readonly { wunsch: string; basis: string; sm: number }[];

      wetterHafentage?: readonly {
        tag: number; ort: string; windKn: number | null; boeKn: number | null; windDeg: number | null;
        schutz: 'revier' | 'geschuetzt' | 'teilweise' | 'offen' | null;
      }[];

      abwetterOhneWunsch?: { wuensche: readonly string[]; tage: readonly number[] };
      poiBasen?: readonly {
        poi: string; basis: string;

        tag: number | null;
        smJeWeg: number;

        wetter: { windKn: number; boeKn: number; richtungDeg: number | null } | null;

        oeffnungszeiten?: {

          quelle: string | null;
          urteil: { urteil: 'ganztag' | 'teilweise' | 'zu'; intervalle: readonly string[] };
        };
      }[];

      fixierungBrichtUmkehrpunkt?: true;

      skipperGuide?: readonly {
        knotenIndex: number; name: string; text: string; seite: string; quelle: string; stand: string | null;
      }[];
    }

  | { lage: 'keinPlanGefunden'; grund: KeinPlanGrund; bericht: KostenkartenBericht }
  | { lage: 'fehler'; text: string }

  | { lage: 'abgebrochen' };

export interface RechnerFortschritt {
  art: 'fortschritt';

  phase: 'haefen' | 'wetter' | 'suche' | 'nachrechnen';

  schritt?: 'kandidaten' | 'kueste' | 'inseln' | 'skipperguide' | 'staaten' | 'ensemble' | 'gitter' | 'tageslicht' | 'netz';

  erledigt?: number;
  gesamt?: number;

  knoten?: number;
  kanten?: number;

  zeitbudgetMs?: number;
}

export type RechnerNachricht = RechnerAntwort | RechnerFortschritt;

export function istFortschritt(n: RechnerNachricht): n is RechnerFortschritt {
  return (n as RechnerFortschritt).art === 'fortschritt';
}

export const K_BESTE = 20;

export const STANDARD_RADIUS_NM = 8;

export function baueePflichtknoten(
  start: { ort: Punkt; name: string }, wunschziele: readonly Wunschziel[], endziel: Endziel | null,
): Hafenknoten[] {
  const knoten: Hafenknoten[] = [{ name: start.name, ort: start.ort, art: 'hafen' }];
  for (const w of wunschziele) knoten.push({ name: w.name, ort: w.ort, art: 'hafen' });
  if (endziel) knoten.push({ name: endziel.name, ort: endziel.ort, art: 'hafen' });
  return knoten;
}

export function wunschzielArtigeListe(wunschziele: readonly Wunschziel[], endziel: Endziel | null): Wunschziel[] {
  const liste = [...wunschziele];
  if (endziel) {
    liste.push({
      ort: endziel.ort, name: endziel.name, art: 'uebernachtung',
      ...(endziel.ungenauerOrt ? { ungenauerOrt: true } : {}),
    });
  }
  return liste;
}

export function wunschzielIndizes(wunschziele: readonly Wunschziel[], endziel: Endziel | null): number[] {
  const indizes = wunschziele.map((_, i) => i + 1);
  if (endziel) indizes.push(wunschziele.length + 1);
  return indizes;
}

export function baueOptionsPflichtknoten(
  start: { ort: Punkt; name: string }, optionen: readonly OptionWunsch[],

  rueckgabehafen?: { ort: Punkt; name: string } | null,
): Hafenknoten[] {
  const knoten: Hafenknoten[] = [{ name: start.name, ort: start.ort, art: 'hafen' }];
  for (const option of optionen) {
    for (const w of option.wunschziele) knoten.push({ name: w.name, ort: w.ort, art: 'hafen' });
    if (option.endziel) knoten.push({ name: option.endziel.name, ort: option.endziel.ort, art: 'hafen' });
  }
  if (rueckgabehafen) knoten.push({ name: rueckgabehafen.name, ort: rueckgabehafen.ort, art: 'hafen' });
  return knoten;
}

export function zielKnotenIndex(
  optionen: readonly OptionWunsch[], hatRueckgabehafen: boolean,
): number {
  if (!hatRueckgabehafen) return 0;
  return 1 + optionen.reduce((n, o) => n + o.wunschziele.length + (o.endziel ? 1 : 0), 0);
}

export function wunschzielIndizesJeOption(optionen: readonly OptionWunsch[]): number[][] {
  const ergebnis: number[][] = [];
  let naechsterIndex = 1;
  for (const option of optionen) {
    const anzahl = option.wunschziele.length + (option.endziel ? 1 : 0);
    ergebnis.push(Array.from({ length: anzahl }, (_, i) => naechsterIndex + i));
    naechsterIndex += anzahl;
  }
  return ergebnis;
}

export function alleWunschzielArtigeListe(optionen: readonly OptionWunsch[]): Wunschziel[] {
  return optionen.flatMap((option) => wunschzielArtigeListe(option.wunschziele, option.endziel));
}

export function schaetzeMaxTagesetappeSm(
  cfg: SchiffConfig, maxStundenProTag: number, obergrenzeSm: number | null,
): number {
  if (obergrenzeSm != null) return obergrenzeSm;
  return Math.max(cfg.motorSpeed, cfg.speedKn) * maxStundenProTag;
}

export function suchraumHalbachseSm(maxTagesetappeSm: number, gesamtFahrtage: number): number {
  return (maxTagesetappeSm * gesamtFahrtage) / 2;
}

export function suchraumHalbachseFuerKetteSm(
  maxTagesetappeSm: number, gesamtFahrtage: number, start: Punkt, ziel: Punkt, pflichtpunkte: readonly Punkt[],
): number {
  const woche = suchraumHalbachseSm(maxTagesetappeSm, gesamtFahrtage);
  const kette = Math.max(
    distNM(start.lat, start.lon, ziel.lat, ziel.lon) / 2,
    ...pflichtpunkte.map((p) => (distNM(start.lat, start.lon, p.lat, p.lon) + distNM(p.lat, p.lon, ziel.lat, ziel.lon)) / 2),
  );
  return Math.min(woche, kette + maxTagesetappeSm);
}

export const ZEITBUDGET_MS = 6 * 60_000;

export interface BoundingBox {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}

export function vervollstaendigeBegruendung(
  spur: Begruendungsspur, etappen: readonly WochenplanEtappe[], entscheidend: ReihungsSchritt | null,
  netz: Kandidatennetz,

  zweitbesteEtappen: readonly WochenplanEtappe[] = [],

  langerTagAbSm: number | null = null,
): Begruendungsspur {
  const etappeJeTag = new Map(etappen.map((e) => [e.tag, e]));
  const zweitbesteJeTag = new Map(zweitbesteEtappen.map((e) => [e.tag, e]));
  return {
    tage: spur.tage.map((tagesBegruendung) => {
      const etappe = etappeJeTag.get(tagesBegruendung.tag);
      const kennzahl = etappe
        ? entscheidendeKennzahlFuerTag(etappe, entscheidend, zweitbesteJeTag.get(tagesBegruendung.tag) ?? null)
        : null;
      const unbekannt = etappe ? unbekannteStellenFuerEtappe(etappe, netz) : [];

      const langerTag = etappe && langerTagAbSm != null && !etappe.istHafentag && etappe.sm > langerTagAbSm
        ? [{ tag: etappe.tag, kennzahl: 'langer_tag', wert: etappe.sm, einheit: 'sm' }] : [];
      return { ...tagesBegruendung, entscheidend: [...langerTag, ...(kennzahl ? [kennzahl] : [])], unbekannt };
    }),
  };
}

export function suchraumBoundingBox(pflichtpunkte: readonly Punkt[], halbachseSm: number): BoundingBox {
  const lats = pflichtpunkte.map((p) => p.lat);
  const lons = pflichtpunkte.map((p) => p.lon);
  const mittlereBreiteRad = (Math.min(...lats) + Math.max(...lats)) / 2 * (Math.PI / 180);
  const latPolsterGrad = halbachseSm / 60;
  const lonPolsterGrad = halbachseSm / (60 * Math.max(Math.cos(mittlereBreiteRad), 0.1));
  return {
    swLat: Math.min(...lats) - latPolsterGrad, swLon: Math.min(...lons) - lonPolsterGrad,
    neLat: Math.max(...lats) + latPolsterGrad, neLon: Math.max(...lons) + lonPolsterGrad,
  };
}
