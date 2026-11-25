import type { WochenplanErgebnis } from './wochenplan';
import { type Bereitschaft, wirkung } from './bereitschaft';
import { schutzStufe } from './shelter';
import type { SaisonLage } from './season';
import type { Punkt } from './types';
import { distNM } from './geo';

const ANDRANG_ORDINAL: Record<SaisonLage, number> = { ausserhalb: 0, rand: 1, haupt: 2, spitze: 3 };

export interface PlanKennzahlen {

  gesamtFahrzeitHrs: number;

  gesamtFahrzeitGeruestHrs: number;
  gesamtSm: number;

  kreuzanteilHrs: number;

  motoranteilHrs: number;
  gedeckteNaechte: number;
  offeneNaechte: number;

  ungeschuetzteNaechte: number;
  maxWindKn: number | null;
  maxGustKn: number | null;
  maxHsM: number | null;

  andrangSummeStufe: number | null;

  modellUebereinstimmungMinProzent: number | null;

  tageOhneKennzahl: number;

  ausrichtung: number | null;

  saatplanAbweichung: number | null;

  tageUeberRegelmass: number | null;

  langeTageAmStueck: number | null;

  naechteOhneBucht: number | null;

  rueckwegAmHinweg: number | null;

  tageAmHeimathafen: number | null;

  ueberzaehligeHafentage: number | null;

  laengsterTagHrs: number | null;

  wiederholteLiegeplaetze: number | null;

  kurzeTage: number | null;

  huellenumfangSm: number | null;

  ankunftsTag: number | null;

  selbstkreuzungen: number | null;

  rueckschritte: number | null;

  segelSm: number;

  wertungSm: number;
  tieBreakSchluessel: number;
}

export const KURZER_FAHRTAG_SM = 5;

export function zaehleUeberzaehligeHafentage(
  etappen: readonly { tag: number; istHafentag: boolean; sm: number }[], erlaubt: number, ersterTagFrei: boolean,
): number {
  const hafentage = etappen
    .filter((e) => (e.istHafentag || e.sm < KURZER_FAHRTAG_SM) && !(e.tag === 1 && ersterTagFrei)).length;
  return Math.max(0, hafentage - erlaubt);
}

export function zaehleWiederholteLiegeplaetze(
  etappen: readonly { tag: number; istHafentag: boolean; nachIndex: number }[],
  startIndex: number, zielIndex: number, gesamtFahrtage: number,

  orte: readonly Punkt[] = [], naeheSm = 0,
): number {
  const besucht: number[] = [startIndex];
  const nah = (a: number, b: number): boolean => {
    if (a === b) return true;
    const p = orte[a], q = orte[b];
    return p != null && q != null && distNM(p.lat, p.lon, q.lat, q.lon) < naeheSm;
  };
  let n = 0;
  for (const e of etappen) {
    if (e.istHafentag || (e.nachIndex === zielIndex && e.tag === gesamtFahrtage)) continue;
    if (besucht.some((b) => nah(b, e.nachIndex))) n++;
    besucht.push(e.nachIndex);
  }
  return n;
}

export function zaehleKurzeTage(
  etappen: readonly { istHafentag: boolean; sm: number }[], regelmassSm: number,
): number {
  return etappen.filter((e) => !e.istHafentag && e.sm < regelmassSm / 2).length;
}

export const HEIMAT_NAEHE_SM = 5;

export const UEBERNAHME_SPAET_AB_UHR = 15;

export function zaehleTageAmHeimathafen(
  orte: readonly { tag: number; ort: Punkt }[], heimat: readonly Punkt[], gesamtFahrtage: number,
  ersterTagFrei: boolean,
): number {
  return orte.filter(({ tag, ort }) => tag < gesamtFahrtage && !(tag === 1 && ersterTagFrei)
    && heimat.some((h) => distNM(ort.lat, ort.lon, h.lat, h.lon) < HEIMAT_NAEHE_SM)).length;
}

export const RUNDREISE_NAEHE_SM = 2.5;

export function abstandZurLinieSm(p: Punkt, linie: readonly Punkt[]): number {
  if (linie.length === 0) return Infinity;
  if (linie.length === 1) return distNM(p.lat, p.lon, linie[0]!.lat, linie[0]!.lon);
  const cos = Math.cos((p.lat * Math.PI) / 180);
  const xy = (q: Punkt): [number, number] => [(q.lon - p.lon) * 60 * cos, (q.lat - p.lat) * 60];
  let min = Infinity;
  for (let i = 1; i < linie.length; i++) {
    const [ax, ay] = xy(linie[i - 1]!), [bx, by] = xy(linie[i]!);
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

export function zaehleRueckwegAmHinweg(
  hinweg: readonly Punkt[], rueckOrte: readonly Punkt[], naeheSm: number = RUNDREISE_NAEHE_SM,
): number {
  return rueckOrte.filter((o) => abstandZurLinieSm(o, hinweg) < naeheSm).length;
}

export interface ReihungsKontext {
  ausrichtung?: (plan: WochenplanErgebnis) => number | null;
  saatplanAbweichung?: (plan: WochenplanErgebnis) => number | null;

  regelmassSm?: number;

  naechteOhneBucht?: (plan: WochenplanErgebnis) => number | null;

  rueckwegAmHinweg?: (plan: WochenplanErgebnis) => number | null;

  tageAmHeimathafen?: (plan: WochenplanErgebnis) => number | null;

  ueberzaehligeHafentage?: (plan: WochenplanErgebnis) => number | null;

  wiederholteLiegeplaetze?: (plan: WochenplanErgebnis) => number | null;

  kurzeTage?: (plan: WochenplanErgebnis) => number | null;

  huellenumfangSm?: (plan: WochenplanErgebnis) => number | null;

  ankunftsTag?: (plan: WochenplanErgebnis) => number | null;

  selbstkreuzungen?: (plan: WochenplanErgebnis) => number | null;

  rueckschritte?: (plan: WochenplanErgebnis) => number | null;
}

export function planKennzahlen(plan: WochenplanErgebnis, kontext: ReihungsKontext = {}): PlanKennzahlen {
  let gesamtFahrzeitHrs = 0, gesamtFahrzeitGeruestHrs = 0, gesamtSm = 0, kreuzanteilHrs = 0, motoranteilHrs = 0;
  let gedeckteNaechte = 0, offeneNaechte = 0, ungeschuetzteNaechte = 0;
  let maxWindKn: number | null = null, maxGustKn: number | null = null, maxHsM: number | null = null;
  let andrangSumme = 0, andrangBekannt = false;
  let modellMin: number | null = null;
  let tageOhneKennzahl = 0, tieBreakSchluessel = 0;
  let laengsterTagHrs: number | null = null;
  let segelSm = 0, wertungSm = 0;
  const deckel = kontext.regelmassSm != null && kontext.regelmassSm > 0 ? kontext.regelmassSm : Infinity;

  for (const etappe of plan.etappen) {
    const k = etappe.kennzahlen;
    gesamtSm += etappe.sm;
    tieBreakSchluessel += etappe.nachIndex;

    if (!etappe.istHafentag && k.totalHrs != null) laengsterTagHrs = Math.max(laengsterTagHrs ?? 0, k.totalHrs);
    if (k.totalHrs == null) tageOhneKennzahl++;
    else if (etappe.regime === 'geruest') gesamtFahrzeitGeruestHrs += k.totalHrs;
    else gesamtFahrzeitHrs += k.totalHrs;
    if (k.vmgShareAnteil != null && k.totalHrs != null) kreuzanteilHrs += k.vmgShareAnteil * k.totalHrs;
    if (k.motorShareAnteil != null && k.totalHrs != null) motoranteilHrs += k.motorShareAnteil * k.totalHrs;
    if (!etappe.istHafentag) {
      const sm = Math.min(etappe.sm, deckel);
      wertungSm += sm;
      segelSm += sm * (1 - (k.motorShareAnteil ?? 0.5));
    }
    if (k.maxWindKn != null) maxWindKn = maxWindKn == null ? k.maxWindKn : Math.max(maxWindKn, k.maxWindKn);
    if (k.maxGustKn != null) maxGustKn = maxGustKn == null ? k.maxGustKn : Math.max(maxGustKn, k.maxGustKn);
    if (k.maxHsM != null) maxHsM = maxHsM == null ? k.maxHsM : Math.max(maxHsM, k.maxHsM);
    if (k.modellUebereinstimmungProzent != null) {
      modellMin = modellMin == null ? k.modellUebereinstimmungProzent : Math.min(modellMin, k.modellUebereinstimmungProzent);
    }

    if (etappe.istNachtschlag) continue;

    if (k.andrang != null) { andrangSumme += ANDRANG_ORDINAL[k.andrang]; andrangBekannt = true; }

    if (k.revierSchutzhafen) { gedeckteNaechte++; }
    else if (k.schutzWellenanlaufNM == null) { ungeschuetzteNaechte++; }
    else if (schutzStufe(k.schutzWellenanlaufNM) === 'offen') offeneNaechte++;
    else gedeckteNaechte++;
  }

  return {
    gesamtFahrzeitHrs, gesamtFahrzeitGeruestHrs, gesamtSm, kreuzanteilHrs, motoranteilHrs,
    gedeckteNaechte, offeneNaechte, ungeschuetzteNaechte,
    maxWindKn, maxGustKn, maxHsM,
    andrangSummeStufe: andrangBekannt ? andrangSumme : null,
    modellUebereinstimmungMinProzent: modellMin,
    tageOhneKennzahl,
    ausrichtung: kontext.ausrichtung?.(plan) ?? null,
    saatplanAbweichung: kontext.saatplanAbweichung?.(plan) ?? null,
    tageUeberRegelmass: kontext.regelmassSm == null ? null
      : plan.etappen.filter((e) => !e.istHafentag && e.sm > kontext.regelmassSm!).length,
    langeTageAmStueck: kontext.regelmassSm == null ? null : (() => {
      let folgen = 0;
      for (let i = 1; i < plan.etappen.length; i++) {
        const a = plan.etappen[i - 1]!, b = plan.etappen[i]!;
        const lang = (e: typeof a): boolean => !e.istHafentag && e.sm > kontext.regelmassSm!;
        if (lang(a) && lang(b)) folgen++;
      }
      return folgen;
    })(),
    naechteOhneBucht: kontext.naechteOhneBucht?.(plan) ?? null,
    rueckwegAmHinweg: kontext.rueckwegAmHinweg?.(plan) ?? null,
    tageAmHeimathafen: kontext.tageAmHeimathafen?.(plan) ?? null,
    ueberzaehligeHafentage: kontext.ueberzaehligeHafentage?.(plan) ?? null,
    laengsterTagHrs,
    wiederholteLiegeplaetze: kontext.wiederholteLiegeplaetze?.(plan) ?? null,
    kurzeTage: kontext.kurzeTage?.(plan) ?? null,
    huellenumfangSm: kontext.huellenumfangSm?.(plan) ?? null,
    selbstkreuzungen: kontext.selbstkreuzungen?.(plan) ?? null,
    rueckschritte: kontext.rueckschritte?.(plan) ?? null,
    ankunftsTag: kontext.ankunftsTag?.(plan) ?? null,
    segelSm,
    wertungSm,
    tieBreakSchluessel,
  };
}

const PARETO_ACHSEN: ReadonlyArray<{ feld: keyof PlanKennzahlen; richtung: 'min' | 'max' }> = [
  { feld: 'gesamtFahrzeitHrs', richtung: 'min' },

  { feld: 'gesamtFahrzeitGeruestHrs', richtung: 'min' },

  { feld: 'wertungSm', richtung: 'max' },
  { feld: 'kreuzanteilHrs', richtung: 'min' },
  { feld: 'motoranteilHrs', richtung: 'min' },
  { feld: 'offeneNaechte', richtung: 'min' },
  { feld: 'maxWindKn', richtung: 'min' },
  { feld: 'maxGustKn', richtung: 'min' },
  { feld: 'maxHsM', richtung: 'min' },
  { feld: 'andrangSummeStufe', richtung: 'min' },
  { feld: 'modellUebereinstimmungMinProzent', richtung: 'max' },

  { feld: 'tageUeberRegelmass', richtung: 'min' },

  { feld: 'rueckwegAmHinweg', richtung: 'min' },

  { feld: 'tageAmHeimathafen', richtung: 'min' },

  { feld: 'ueberzaehligeHafentage', richtung: 'min' },

  { feld: 'laengsterTagHrs', richtung: 'min' },

  { feld: 'wiederholteLiegeplaetze', richtung: 'min' },
  { feld: 'kurzeTage', richtung: 'min' },

  { feld: 'huellenumfangSm', richtung: 'max' },
  { feld: 'selbstkreuzungen', richtung: 'min' },

  { feld: 'rueckschritte', richtung: 'min' },

  { feld: 'ankunftsTag', richtung: 'min' },
  { feld: 'segelSm', richtung: 'max' },
];

export const NICHT_PARETO_FELDER: ReadonlyArray<keyof PlanKennzahlen> = [
  'gedeckteNaechte', 'ungeschuetzteNaechte', 'tageOhneKennzahl', 'tieBreakSchluessel', 'gesamtSm',
];

export function dominiert(a: PlanKennzahlen, b: PlanKennzahlen): boolean {
  let mindestensEinmalBesser = false;
  for (const { feld, richtung } of PARETO_ACHSEN) {
    const av = a[feld] as number | null;
    const bv = b[feld] as number | null;
    if (av == null || bv == null) continue;
    const besser = richtung === 'min' ? av < bv : av > bv;
    const schlechter = richtung === 'min' ? av > bv : av < bv;
    if (schlechter) return false;
    if (besser) mindestensEinmalBesser = true;
  }
  return mindestensEinmalBesser;
}

export function paretoFilter(plaene: readonly PlanKennzahlen[]): number[] {
  const ueberlebende: number[] = [];
  for (let i = 0; i < plaene.length; i++) {
    let dominiertVonAnderem = false;
    for (let j = 0; j < plaene.length; j++) {
      if (i !== j && dominiert(plaene[j]!, plaene[i]!)) { dominiertVonAnderem = true; break; }
    }
    if (!dominiertVonAnderem) ueberlebende.push(i);
  }
  return ueberlebende;
}

export const REIHUNGS_SCHRITTE = [
  'gedeckte_naechte',

  'ankunft',

  'wiederholungen',

  'hafentage',

  'buchten',

  'kreuzungsfrei', 'huelle', 'segelmeilen', 'meilen',
  'kurze_tage',

  'heimathafen',

  'laengster_tag',
  'rundreise',
  'kreuzanteil', 'motoranteil', 'fahrzeit',

  'lange_folge', 'lange_tage',

  'ausrichtung', 'saatplan',
] as const;
export type ReihungsSchritt = typeof REIHUNGS_SCHRITTE[number];

export const AUSGESCHRIEBENE_REIHENFOLGE: ReadonlyArray<{ schritt: string; begruendung: string }> = [
  { schritt: 'Sicherheit', begruendung: 'ist ohnehin Ebene 1. Steht hier nur, damit die Reihenfolge vollständig ist' },
  { schritt: 'Termin einhalten', begruendung: 'ohne Rückgabe kein Plan' },
  { schritt: 'Wunschziele', begruendung: 'ist ebenfalls ohnehin Ebene 1, ein Plan, der eines auslässt, ist "geht nicht", kein schlechterer Plan' },
  { schritt: 'gedeckte Nächte', begruendung: 'die Nacht ist die Zeit ohne Ausweichmöglichkeit' },
  { schritt: 'Früh ankommen', begruendung: 'nur bei einer Überstellung ohne Enddatum: Der erste Tag am Ziel ist das Ende des Törns' },
  { schritt: 'Kein Yo-yo', begruendung: 'kein Liegeplatz doppelt, keine Etappen, die sich kreuzen, und beim Einwegtörn kein Schlag zurück gegen die Fahrtrichtung: je ein Punkt; mit Wunschziel zählt nur derselbe Liegeplatz' },
  { schritt: 'Buchten bevorzugen', begruendung: 'nur mit gesetzter Präferenz: ohne sie ein No-op, kein stilles Gewicht' },
  { schritt: 'Jeden Tag fahren', begruendung: 'Hafentage über die eingestellten Ruhetage hinaus: Ruhetage 0 heißt jeden Tag fahren' },
  { schritt: 'Kreuzungsfrei', begruendung: 'ein Gummiband kreuzt sich nie: bei gleich viel Yo-yo die Runde mit weniger Kreuzungen' },
  { schritt: 'Gummiband', begruendung: 'die Länge des Gummibands um alle Übernachtungen: Pendeln macht es nicht länger, eine Runde schon' },
  { schritt: 'Gesegelte Meilen', begruendung: 'so viel segeln wie möglich: Meilen mal Segelanteil' },
  { schritt: 'Meilen', begruendung: 'so viel Meilen wie möglich: wer weniger fahren will, stellt Ruhetage ein' },
  { schritt: 'Keine Hüpfer', begruendung: 'nur in der freien Runde ohne Wunschziel: Fahrtage unter dem halben Regelmaß' },
  { schritt: 'Törn nutzen', begruendung: 'Tage am Heimathafen sind verschenkter Törn: außer am letzten und, bei später Übernahme, am ersten Tag' },
  { schritt: 'Längster Fahrtag', begruendung: 'ein freier Tag teilt eine lange Etappe: die längste Tagesfahrzeit, auf eine halbe Stunde genau' },
  { schritt: 'Rundreise', begruendung: 'ein Rückweg über dieselben Liegeplätze ist kein Törn: Übernachtungen nahe einer früheren zählen' },
  { schritt: 'Kreuzanteil', begruendung: 'das, was eine Crew als "anstrengend" erlebt' },
  { schritt: 'Motoranteil', begruendung: 'ein Segeltörn soll gesegelt werden' },
  { schritt: 'Fahrzeit', begruendung: 'früher anzukommen ist selten der Zweck' },
  { schritt: 'lange Tage am Stück', begruendung: 'zwei lange Tage hintereinander sind mehr als zweimal ein langer Tag: abschaltbar' },
  { schritt: 'lange Tage', begruendung: 'Tage über dem Regelmaß: vor die Komfortzeilen gezogen, sobald „lange Tage" auf „wenn\'s sein muss" steht' },
  { schritt: 'Ausrichtung', begruendung: 'gegen den Wind hinaus, mit dem Wind heim: bricht Gleichstände' },
  { schritt: 'Saatplan', begruendung: 'der Saatplan entscheidet nie: bricht nur Gleichstände' },
];

export interface ErklaertePraeferenzen {
  kreuzen?: Bereitschaft;
  motoren?: Bereitschaft;
  langeTage?: Bereitschaft;

  hoechstensEinLangerTagAmStueck?: boolean;
}

const PRAEFERENZ_SCHRITT: ReadonlyArray<{ key: 'kreuzen' | 'motoren' | 'langeTage'; schritt: ReihungsSchritt }> = [
  { key: 'kreuzen', schritt: 'kreuzanteil' },
  { key: 'motoren', schritt: 'motoranteil' },

  { key: 'langeTage', schritt: 'lange_tage' },
];

const WOCHEN_SCHRITTE: readonly ReihungsSchritt[] = [
  'gedeckte_naechte', 'ankunft', 'wiederholungen', 'hafentage', 'buchten', 'kreuzungsfrei', 'huelle', 'segelmeilen', 'meilen', 'kurze_tage', 'heimathafen',
];

export function reihenfolgeFuer(praeferenzen: ErklaertePraeferenzen): readonly ReihungsSchritt[] {
  const vorgezogen: ReihungsSchritt[] = [];
  for (const { key, schritt } of PRAEFERENZ_SCHRITT) {
    const b = praeferenzen[key];
    if (b && wirkung(b) !== 'neutral' && !vorgezogen.includes(schritt)) vorgezogen.push(schritt);
  }

  if (vorgezogen.includes('lange_tage')) vorgezogen.splice(vorgezogen.indexOf('lange_tage'), 0, 'lange_folge');

  const rest = REIHUNGS_SCHRITTE.filter((s) => !vorgezogen.includes(s));
  const nachWoche = Math.max(...WOCHEN_SCHRITTE.map((s) => rest.indexOf(s))) + 1;
  const alle = [...rest.slice(0, nachWoche), ...vorgezogen, ...rest.slice(nachWoche)];
  return praeferenzen.hoechstensEinLangerTagAmStueck === false ? alle.filter((s) => s !== 'lange_folge') : alle;
}

const WERT_FUER: Record<ReihungsSchritt, (p: PlanKennzahlen) => number> = {
  gedeckte_naechte: (p) => p.offeneNaechte,

  buchten: (p) => p.naechteOhneBucht ?? 0,

  hafentage: (p) => p.ueberzaehligeHafentage ?? 0,

  wiederholungen: (p) => (p.wiederholteLiegeplaetze ?? 0) + (p.selbstkreuzungen ?? 0) + (p.rueckschritte ?? 0),
  kurze_tage: (p) => p.kurzeTage ?? 0,

  kreuzungsfrei: (p) => p.selbstkreuzungen ?? 0,
  ankunft: (p) => p.ankunftsTag ?? 0,
  huelle: (p) => -(p.huellenumfangSm ?? 0),
  segelmeilen: (p) => -p.segelSm,
  meilen: (p) => -p.wertungSm,
  heimathafen: (p) => p.tageAmHeimathafen ?? 0,
  rundreise: (p) => p.rueckwegAmHinweg ?? 0,
  laengster_tag: (p) => p.laengsterTagHrs ?? 0,
  kreuzanteil: (p) => p.kreuzanteilHrs,
  motoranteil: (p) => p.motoranteilHrs,

  fahrzeit: (p) => p.gesamtFahrzeitHrs + p.gesamtFahrzeitGeruestHrs,
  lange_tage: (p) => p.tageUeberRegelmass ?? 0,
  lange_folge: (p) => p.langeTageAmStueck ?? 0,

  ausrichtung: (p) => p.ausrichtung ?? 0,
  saatplan: (p) => p.saatplanAbweichung ?? 0,
};

export const REIHUNGS_TOLERANZ: Record<ReihungsSchritt, number> = {
  gedeckte_naechte: 0,

  buchten: 0,

  hafentage: 0,
  wiederholungen: 0,
  kurze_tage: 0,

  kreuzungsfrei: 0,

  ankunft: 0,
  huelle: 5,
  segelmeilen: 5,
  meilen: 5,
  heimathafen: 0,
  rundreise: 0,

  laengster_tag: 0.5,
  kreuzanteil: 0.25,
  motoranteil: 0.25,
  fahrzeit: 0.25,

  lange_tage: 0,
  lange_folge: 0,

  ausrichtung: 0,
  saatplan: 0,
};

export function vergleichePlaene(
  a: PlanKennzahlen, b: PlanKennzahlen, reihenfolge: readonly ReihungsSchritt[],
): number {
  for (const schritt of reihenfolge) {
    const diff = WERT_FUER[schritt](a) - WERT_FUER[schritt](b);
    if (Math.abs(diff) > REIHUNGS_TOLERANZ[schritt]) return diff;
  }
  return a.tieBreakSchluessel - b.tieBreakSchluessel;
}

export function entscheidenderSchritt(
  a: PlanKennzahlen, b: PlanKennzahlen, reihenfolge: readonly ReihungsSchritt[],
): ReihungsSchritt | null {
  for (const schritt of reihenfolge) {
    if (Math.abs(WERT_FUER[schritt](a) - WERT_FUER[schritt](b)) > REIHUNGS_TOLERANZ[schritt]) return schritt;
  }
  return null;
}

export interface ZielfunktionErgebnis {

  ueberlebende: readonly WochenplanErgebnis[];

  gereiht: readonly WochenplanErgebnis[];

  reihenfolge: readonly ReihungsSchritt[];

  entscheidend: ReihungsSchritt | null;

  zweitbester: WochenplanErgebnis | null;
}

export function waehlePlaene(
  kandidaten: readonly WochenplanErgebnis[], praeferenzen: ErklaertePraeferenzen = {},
  kontext: ReihungsKontext = {},
): ZielfunktionErgebnis {
  const kennzahlen = kandidaten.map((k) => planKennzahlen(k, kontext));
  const ueberlebendeIndizes = paretoFilter(kennzahlen);
  const ueberlebende = ueberlebendeIndizes.map((i) => kandidaten[i]!);
  const ueberlebendeKennzahlen = ueberlebendeIndizes.map((i) => kennzahlen[i]!);
  const reihenfolge = reihenfolgeFuer(praeferenzen);

  const geordnet = ueberlebende
    .map((plan, idx) => ({ plan, kennzahlen: ueberlebendeKennzahlen[idx]! }))
    .sort((x, y) => vergleichePlaene(x.kennzahlen, y.kennzahlen, reihenfolge));

  const entscheidend = geordnet.length >= 2
    ? entscheidenderSchritt(geordnet[0]!.kennzahlen, geordnet[1]!.kennzahlen, reihenfolge) : null;
  return {
    ueberlebende, gereiht: geordnet.map((g) => g.plan), reihenfolge,
    entscheidend, zweitbester: geordnet[1]?.plan ?? null,
  };
}
