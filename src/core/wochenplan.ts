import type { Kandidatennetz } from './hafennetz';
import { saisonLage, type SaisonLage } from './season';
import type { BegruendungsSammler } from './begruendung';
import { distNM } from './geo';
import { RUNDREISE_NAEHE_SM, HEIMAT_NAEHE_SM, KURZER_FAHRTAG_SM, abstandZurLinieSm } from './zielfunktion';
import type { Punkt } from './types';
import { schutzStufe } from './shelter';
import { umlaufWinkel, fortschrittSm, RUECKSCHRITT_TOLERANZ_SM } from './gummiband';

export interface EtappenKennzahlen {
  totalHrs: number | null;
  vmgShareAnteil: number | null;
  motorShareAnteil: number | null;
  dunkelShareAnteil: number | null;
  maxWindKn: number | null;
  maxGustKn: number | null;
  maxHsM: number | null;

  schutzWellenanlaufNM: number | null;
  andrang: SaisonLage | null;
  modellUebereinstimmungProzent: number | null;

  revierSchutzhafen: boolean;

  ablegeZeitIso: string | null;

  lage: 'guenstig' | 'brauchbar' | 'unfahrbar' | null;

  gewitter?: true;

  ablegenImDunkeln?: true;
}

export const HAFENTAG_KENNZAHLEN: EtappenKennzahlen = {
  totalHrs: 0, vmgShareAnteil: null, motorShareAnteil: null, dunkelShareAnteil: null,
  maxWindKn: null, maxGustKn: null, maxHsM: null, schutzWellenanlaufNM: null,
  andrang: null, modellUebereinstimmungProzent: null, revierSchutzhafen: false, ablegeZeitIso: null, lage: null,
};

export function hafentagKennzahlen(
  vorige: WochenplanEtappe | undefined, datum: Date | null,
  amOrt: Pick<EtappenKennzahlen, 'schutzWellenanlaufNM' | 'revierSchutzhafen'> | null = null,

  dieseNacht: Pick<EtappenKennzahlen, 'schutzWellenanlaufNM' | 'revierSchutzhafen'> | null = null,
): EtappenKennzahlen {

  const quelle = dieseNacht && (dieseNacht.schutzWellenanlaufNM != null || dieseNacht.revierSchutzhafen) ? dieseNacht
    : vorige?.kennzahlen.schutzWellenanlaufNM != null || vorige?.kennzahlen.revierSchutzhafen
      ? vorige.kennzahlen : amOrt ?? vorige?.kennzahlen ?? null;
  return {
    ...HAFENTAG_KENNZAHLEN,
    schutzWellenanlaufNM: quelle?.schutzWellenanlaufNM ?? null,
    revierSchutzhafen: quelle?.revierSchutzhafen ?? false,
    andrang: datum ? saisonLage(datum) : null,
  };
}

function schutzJeOrtUndNacht(
  netz: Kandidatennetz, kosten: Kostenkarte,
): Map<string, Pick<EtappenKennzahlen, 'schutzWellenanlaufNM' | 'revierSchutzhafen'>> {
  const karte = new Map<string, Pick<EtappenKennzahlen, 'schutzWellenanlaufNM' | 'revierSchutzhafen'>>();
  for (const [schluessel, b] of kosten) {
    if (b.istNachtschlag || b.kennzahlen.schutzWellenanlaufNM == null) continue;
    const [kante, tag] = schluessel.split(':').map(Number) as [number, number];
    const nach = netz.kanten[kante]?.nach;
    if (nach == null) continue;
    const k = `${nach}|${tag}`;
    if (!karte.has(k)) karte.set(k, b.kennzahlen);
  }
  return karte;
}

export interface EtappenBewertung {

  score: number;
  sm: number;
  istNachtschlag: boolean;

  regime: 'gerechnet' | 'geruest';

  kennzahlen: EtappenKennzahlen;
}

export function kostenSchluessel(kanteIndex: number, tag: number): string {
  return `${kanteIndex}:${tag}`;
}

export type Kostenkarte = ReadonlyMap<string, EtappenBewertung>;

export interface PflichtOrt {
  tag: number;
  knotenIndex: number;
}

export interface WochenplanEingabe {
  netz: Kandidatennetz;
  startIndex: number;
  zielIndex: number;

  gesamtFahrtage: number;

  wunschzielKnoten: readonly number[];
  pflichtOrte?: readonly PflichtOrt[];
  kosten: Kostenkarte;

  erreichbar?: (knotenIndex: number, tag: number, offeneWunschzielKnoten: readonly number[]) => boolean;

  datumFuerTag?: (tag: number) => Date | null;

  nachtfahrtBudget?: number;

  ruhetagKnoten?: readonly number[];

  ersterTagFrei?: boolean;

  hafentagScore?: (knotenIndex: number, tag: number) => number;

  freieRunde?: { regelmassSm: number };

  liegeschutz?: ReadonlyMap<string, Pick<EtappenKennzahlen, 'schutzWellenanlaufNM' | 'revierSchutzhafen'>>;

  saatplaene?: readonly (readonly number[])[];

  offenesEnde?: boolean;

  kBeste: number;

  sammler?: BegruendungsSammler;
}

export interface WochenplanEtappe {

  tag: number;
  vonIndex: number;
  nachIndex: number;
  istHafentag: boolean;
  istNachtschlag: boolean;
  sm: number;
  score: number;

  regime: 'gerechnet' | 'geruest';

  kennzahlen: EtappenKennzahlen;
}

export interface WochenplanErgebnis {
  etappen: WochenplanEtappe[];
  gesamtScore: number;
}

interface PfadEintrag {
  score: number;
  etappen: readonly WochenplanEtappe[];
}

function vollstaendigeMaske(anzahlWunschziele: number): number {
  return anzahlWunschziele === 0 ? 0 : (1 << anzahlWunschziele) - 1;
}

function neueMaske(
  maske: number, knotenIndex: number, wunschzielKnoten: readonly number[],
  istHafentag = false, ruhetagKnoten: readonly number[] = [],
): number {
  const bit = wunschzielKnoten.indexOf(knotenIndex);
  if (bit === -1) return maske;
  if (ruhetagKnoten.includes(knotenIndex) && !istHafentag) return maske;
  return maske | (1 << bit);
}

function einfuegenTopK(
  liste: PfadEintrag[], kandidat: PfadEintrag, k: number, sammler?: BegruendungsSammler,
): void {
  let i = liste.length;
  while (i > 0 && liste[i - 1]!.score > kandidat.score) i--;
  liste.splice(i, 0, kandidat);
  if (liste.length <= k) return;
  const verdraengt = liste.pop()!;
  const letzte = verdraengt.etappen[verdraengt.etappen.length - 1];
  if (sammler && letzte && !letzte.istHafentag) {
    sammler.verworfen(letzte.tag, letzte.vonIndex, { nachIndex: letzte.nachIndex, grundArt: 'schlechter-score' });
  }
}

export function rechneWochenplaene(eingabe: WochenplanEingabe): WochenplanErgebnis[] {
  const { netz, startIndex, zielIndex, gesamtFahrtage, wunschzielKnoten, kosten, kBeste } = eingabe;
  const pflichtOrte = eingabe.pflichtOrte ?? [];
  const erreichbar = eingabe.erreichbar ?? (() => true);
  const datumFuerTag = eingabe.datumFuerTag ?? ((): Date | null => null);
  const nachtfahrtBudget = eingabe.nachtfahrtBudget ?? Infinity;
  const ruhetagKnoten = eingabe.ruhetagKnoten ?? [];
  const sammler = eingabe.sammler;
  const volleMaske = vollstaendigeMaske(wunschzielKnoten.length);
  const schutzAmOrt = schutzJeOrtUndNacht(netz, kosten);

  const pflichtProTag = new Map<number, number>();
  for (const p of pflichtOrte) pflichtProTag.set(p.tag, p.knotenIndex);

  const ausgehendeKanten = new Map<number, { index: number; nach: number }[]>();
  netz.kanten.forEach((k, index) => {
    const liste = ausgehendeKanten.get(k.von) ?? [];
    liste.push({ index, nach: k.nach });
    ausgehendeKanten.set(k.von, liste);
  });

  const tag0 = new Map<string, PfadEintrag[]>();
  const startMaske = neueMaske(0, startIndex, wunschzielKnoten);
  const offeneAmStart = wunschzielKnoten.filter((_, i) => (startMaske & (1 << i)) === 0);
  if (erreichbar(startIndex, 0, offeneAmStart) && (!pflichtProTag.has(0) || pflichtProTag.get(0) === startIndex)) {
    tag0.set(`${startIndex}|0|${startMaske}|0`, [{ score: 0, etappen: [] }]);
  }
  const dpNachTag = new Map<number, Map<string, PfadEintrag[]>>();
  dpNachTag.set(0, tag0);

  for (let t = 0; t < gesamtFahrtage; t++) {
    const zustaendeHeute = dpNachTag.get(t);
    if (!zustaendeHeute) continue;

    for (const [schluessel, pfade] of zustaendeHeute) {
      const [knotenStr, , maskeStr, naechteStr] = schluessel.split('|');
      const knotenIndex = Number(knotenStr), maske = Number(maskeStr);
      const naechte = Number(naechteStr);

      const fuegeUebergangHinzu = (
        nachIndex: number, ankunftsTag: number, istHafentag: boolean, istNachtschlag: boolean,
        sm: number, score: number, regime: 'gerechnet' | 'geruest', kennzahlen: EtappenKennzahlen,
      ): void => {
        if (ankunftsTag > gesamtFahrtage) return;

        const naechteDanach = naechte + (istNachtschlag ? 1 : 0);
        if (naechteDanach > nachtfahrtBudget) {
          sammler?.verworfen(ankunftsTag, knotenIndex, { nachIndex, grundArt: 'nachtfahrtbudget' });
          return;
        }
        const pflicht = pflichtProTag.get(ankunftsTag);
        if (pflicht != null) {
          if (pflicht !== nachIndex) {
            sammler?.verworfen(ankunftsTag, knotenIndex, { nachIndex, grundArt: 'fixierung' });
            return;
          }

          sammler?.bindend(ankunftsTag, nachIndex, { art: 'fixierung', parameter: {}, herkunft: { art: 'nutzervorgabe' } });
        }

        const neueMaskeWert = neueMaske(maske, nachIndex, wunschzielKnoten, istHafentag, ruhetagKnoten);
        const offeneWunschzielKnoten = wunschzielKnoten.filter((_, i) => (neueMaskeWert & (1 << i)) === 0);
        if (!erreichbar(nachIndex, ankunftsTag, offeneWunschzielKnoten)) {
          sammler?.verworfen(ankunftsTag, knotenIndex, { nachIndex, grundArt: 'umkehrpunkt' });
          return;
        }

        const neuerSchluessel = `${nachIndex}|${ankunftsTag}|${neueMaskeWert}|${naechteDanach}`;
        const ziel = dpNachTag.get(ankunftsTag) ?? new Map<string, PfadEintrag[]>();
        dpNachTag.set(ankunftsTag, ziel);
        const bisher = ziel.get(neuerSchluessel) ?? [];
        ziel.set(neuerSchluessel, bisher);

        for (const p of pfade) {

          const kennzahlenHier = istHafentag
            ? hafentagKennzahlen(p.etappen[p.etappen.length - 1], datumFuerTag(ankunftsTag), schutzAmOrt.get(`${nachIndex}|${ankunftsTag}`) ?? null,
              eingabe.liegeschutz?.get(`${nachIndex}|${ankunftsTag}`) ?? null)
            : kennzahlen;
          const etappe: WochenplanEtappe = { tag: ankunftsTag, vonIndex: knotenIndex, nachIndex, istHafentag, istNachtschlag, sm, score, regime, kennzahlen: kennzahlenHier };
          einfuegenTopK(bisher, { score: p.score + score, etappen: [...p.etappen, etappe] }, kBeste, sammler);
        }
      };

      fuegeUebergangHinzu(knotenIndex, t + 1, true, false, 0, eingabe.hafentagScore?.(knotenIndex, t + 1) ?? 0, 'gerechnet', HAFENTAG_KENNZAHLEN);

      for (const { index, nach } of ausgehendeKanten.get(knotenIndex) ?? []) {
        const eintrag = kosten.get(kostenSchluessel(index, t + 1));
        if (!eintrag) {

          sammler?.verworfen(t + 1, knotenIndex, { nachIndex: nach, grundArt: 'kein-kostenkarten-eintrag' });
          continue;
        }
        const ankunftsTag = t + (eintrag.istNachtschlag ? 2 : 1);
        fuegeUebergangHinzu(nach, ankunftsTag, false, eintrag.istNachtschlag, eintrag.sm, eintrag.score, eintrag.regime, eintrag.kennzahlen);
      }
    }
  }

  const endPraefix = `${zielIndex}|${gesamtFahrtage}|${volleMaske}|`;
  const endZustaende = dpNachTag.get(gesamtFahrtage);
  const endPfade: PfadEintrag[] = [];
  for (const [schluessel, pfade] of endZustaende ?? []) {
    if (schluessel.startsWith(endPraefix)) endPfade.push(...pfade);
  }

  return endPfade
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, kBeste)
    .map((p) => ({ etappen: [...p.etappen], gesamtScore: p.score }));
}

const RAND_SKALARISIERUNGEN: ReadonlyArray<(e: EtappenBewertung) => number> = [

  (e) => e.kennzahlen.totalHrs ?? e.score,

  (e) => {
    const h = e.kennzahlen.totalHrs;
    return h != null && e.kennzahlen.vmgShareAnteil != null ? e.kennzahlen.vmgShareAnteil * h + 0.1 * h : e.score;
  },

  (e) => Math.min(e.kennzahlen.schutzWellenanlaufNM ?? SCHUTZ_KAPPE_NM, SCHUTZ_KAPPE_NM)
    + 0.1 * (e.kennzahlen.totalHrs ?? 0),
];

const SCHUTZ_KAPPE_NM = 20;

export const K_JE_RANDLAUF = 5;

export function rechneVielfaeltigeWochenplaene(eingabe: WochenplanEingabe): WochenplanErgebnis[] {
  const haupt = rechneWochenplaene(eingabe);
  if (eingabe.kosten.size === 0) return haupt;

  const hauptScore = new Map<EtappenKennzahlen, number>();
  for (const e of eingabe.kosten.values()) hauptScore.set(e.kennzahlen, e.score);

  const ohneSammler: WochenplanEingabe = { ...eingabe };
  delete ohneSammler.sammler;
  const alle: WochenplanErgebnis[] = [...haupt];
  for (const skalar of RAND_SKALARISIERUNGEN) {
    const randKosten = new Map<string, EtappenBewertung>();
    for (const [k, e] of eingabe.kosten) randKosten.set(k, { ...e, score: skalar(e) });
    for (const plan of rechneWochenplaene({ ...ohneSammler, kosten: randKosten, kBeste: K_JE_RANDLAUF })) {
      const etappen = plan.etappen.map((e) => (e.istHafentag ? e : { ...e, score: hauptScore.get(e.kennzahlen) ?? e.score }));
      alle.push({ etappen, gesamtScore: etappen.reduce((s, e) => s + e.score, 0) });
    }
  }

  const vorbild = haupt[0];
  const rundKosten = vorbild ? rundreiseKosten(eingabe, vorbild) : null;
  if (rundKosten) {
    for (const plan of rechneWochenplaene({ ...ohneSammler, kosten: rundKosten, kBeste: K_JE_RANDLAUF })) alle.push(plan);
  }

  const woche = wocheNutzenEingabe(ohneSammler);

  const wocheAusgeglichen = woche ? {
    ...woche,
    kosten: new Map([...woche.kosten].map(([k, b]) => {
      const h = b.kennzahlen.totalHrs;
      const basis = eingabe.kosten.get(k)?.score ?? b.score;
      return [k, { ...b, score: b.score - basis + (h != null ? h * h * (basis / Math.max(h, 0.5)) : basis) }] as const;
    })),
  } : null;
  for (const w of [woche, wocheAusgeglichen]) {
    if (!w) continue;
    for (const plan of rechneWochenplaene(w)) {
      const etappen = plan.etappen.map((e) => (e.istHafentag ? { ...e, score: 0 } : { ...e, score: hauptScore.get(e.kennzahlen) ?? e.score }));
      alle.push({ etappen, gesamtScore: etappen.reduce((s, e) => s + e.score, 0) });
    }
  }

  if (woche) {
    for (const plan of rechneWochenplaene({ ...woche, kosten: ohneOffeneNaechte(woche.kosten) })) {
      const etappen = plan.etappen.map((e) => (e.istHafentag ? { ...e, score: 0 } : { ...e, score: hauptScore.get(e.kennzahlen) ?? e.score }));
      alle.push({ etappen, gesamtScore: etappen.reduce((s, e) => s + e.score, 0) });
    }
  }

  if (eingabe.freieRunde) alle.push(...freieRundeKandidaten(ohneSammler, eingabe.freieRunde.regelmassSm));

  if (eingabe.offenesEnde) alle.push(...ankunftsKandidaten(ohneSammler, hauptScore));

  if (woche) alle.push(...gummibandKandidaten(ohneSammler, woche, hauptScore));

  for (const plan of [...alle]) {
    const getauscht = schutzTausch(ohneSammler, plan);
    if (getauscht) alle.push(getauscht);
  }

  const besteJeFolge = new Map<string, WochenplanErgebnis>();
  for (const plan of alle) {
    const folge = plan.etappen.filter((e) => !e.istHafentag).map((e) => `${e.vonIndex}>${e.nachIndex}`).join(',');
    const bisher = besteJeFolge.get(folge);
    if (!bisher || plan.gesamtScore < bisher.gesamtScore) besteJeFolge.set(folge, plan);
  }
  return [...besteJeFolge.values()].sort((a, b) => a.gesamtScore - b.gesamtScore);
}

export function zerlegeRundreise(
  netz: Kandidatennetz, plan: WochenplanErgebnis, startIndex: number, zielIndex: number,
): { hinweg: Punkt[]; rueckOrte: Punkt[]; wendeTag: number } | null {
  const start = netz.knoten[startIndex]?.ort;
  if (!start) return null;
  const fahrten = plan.etappen.filter((e) => !e.istHafentag);
  let wende: WochenplanEtappe | null = null, wendeSm = -1;
  for (const e of fahrten) {
    const o = netz.knoten[e.nachIndex]?.ort;
    if (!o || e.nachIndex === zielIndex) continue;
    const sm = distNM(start.lat, start.lon, o.lat, o.lon);
    if (sm > wendeSm) { wende = e; wendeSm = sm; }
  }
  if (!wende) return null;
  const wendeTag = wende.tag;
  const hinweg: Punkt[] = [];
  for (const e of fahrten.filter((f) => f.tag <= wendeTag)) {
    const von = netz.knoten[e.vonIndex]?.ort, nach = netz.knoten[e.nachIndex]?.ort;
    if (!von || !nach) continue;
    const kante = netz.kanten.find((k) => k.von === e.vonIndex && k.nach === e.nachIndex);
    hinweg.push(von, ...(kante?.ueber ?? []), nach);
  }
  const nachWende = fahrten.filter((f) => f.tag > wendeTag);
  const rueckOrte = nachWende.slice(0, -1)
    .map((e) => netz.knoten[e.nachIndex]?.ort)
    .filter((o): o is Punkt => o != null);
  return { hinweg, rueckOrte, wendeTag };
}

export function rundreiseKosten(eingabe: WochenplanEingabe, vorbild: WochenplanErgebnis): Kostenkarte | null {
  const { netz, startIndex, zielIndex, kosten } = eingabe;
  if (startIndex !== zielIndex) return null;
  const teile = zerlegeRundreise(netz, vorbild, startIndex, zielIndex);
  if (!teile || teile.hinweg.length < 2) return null;
  const gesperrt = new Set<number>();
  netz.knoten.forEach((k, i) => {
    if (i === startIndex || i === zielIndex) return;
    if (abstandZurLinieSm(k.ort, teile.hinweg) < RUNDREISE_NAEHE_SM) gesperrt.add(i);
  });
  if (gesperrt.size === 0) return null;
  const ergebnis = new Map<string, EtappenBewertung>();
  for (const [schluessel, b] of kosten) {
    const [kante, tag] = schluessel.split(':').map(Number) as [number, number];
    if (tag > teile.wendeTag && gesperrt.has(netz.kanten[kante]?.nach ?? -1)) continue;
    ergebnis.set(schluessel, b);
  }
  return ergebnis.size < kosten.size ? ergebnis : null;
}

export function wocheNutzenEingabe(eingabe: WochenplanEingabe): WochenplanEingabe | null {
  const { netz, startIndex, zielIndex, kosten, gesamtFahrtage } = eingabe;
  if (kosten.size === 0) return null;
  let aufschlag = 0;
  for (const b of kosten.values()) aufschlag = Math.max(aufschlag, b.score);
  if (aufschlag <= 0) return null;
  const heimat = [netz.knoten[startIndex]?.ort, netz.knoten[zielIndex]?.ort].filter((o): o is Punkt => o != null);
  const nahe = netz.knoten.map((k) => heimat.some((h) => distNM(k.ort.lat, k.ort.lon, h.lat, h.lon) < HEIMAT_NAEHE_SM));
  const zaehlt = (knoten: number, tag: number) => tag < gesamtFahrtage && !(tag === 1 && eingabe.ersterTagFrei) && nahe[knoten] === true;
  const teuer = new Map<string, EtappenBewertung>();
  for (const [schluessel, b] of kosten) {
    const [kante, tag] = schluessel.split(':').map(Number) as [number, number];
    const nach = netz.kanten[kante]?.nach ?? -1;

    const kurz = b.sm < KURZER_FAHRTAG_SM && !(tag === 1 && eingabe.ersterTagFrei);

    const s = b.kennzahlen.schutzWellenanlaufNM;
    const offen = !b.istNachtschlag && !b.kennzahlen.revierSchutzhafen && s != null && schutzStufe(s) === 'offen';
    const extra = (zaehlt(nach, tag) ? aufschlag : 0) + (kurz ? aufschlag : 0) + (offen ? aufschlag : 0);
    teuer.set(schluessel, extra > 0 ? { ...b, score: b.score + extra } : b);
  }
  return {
    ...eingabe, kosten: teuer, kBeste: K_JE_RANDLAUF,
    hafentagScore: (knoten, tag) => (tag === 1 && eingabe.ersterTagFrei ? 0 : aufschlag * (zaehlt(knoten, tag) ? 2 : 1)),
  };
}

export function ohneOffeneNaechte(kosten: Kostenkarte): Map<string, EtappenBewertung> {
  const gedeckt = new Map<string, EtappenBewertung>();
  for (const [schluessel, b] of kosten) {
    const s = b.kennzahlen.schutzWellenanlaufNM;
    const offen = !b.istNachtschlag && !b.kennzahlen.revierSchutzhafen && s != null && schutzStufe(s) === 'offen';
    if (!offen) gedeckt.set(schluessel, b);
  }
  return gedeckt;
}

export const FREIE_RUNDE_VERSUCHE = 8;

export function ersteWiederholung(
  plan: WochenplanErgebnis, startIndex: number, zielIndex: number, gesamtFahrtage: number,

  netz: Kandidatennetz | null = null, naeheSm = 0,
): { knoten: number; ersterTag: number } | null {
  const besucht = new Map<number, number>([[startIndex, 0]]);
  const nah = (a: number, b: number): boolean => {
    if (a === b) return true;
    const p = netz?.knoten[a]?.ort, q = netz?.knoten[b]?.ort;
    return p != null && q != null && distNM(p.lat, p.lon, q.lat, q.lon) < naeheSm;
  };
  for (const e of plan.etappen) {
    if (e.istHafentag) continue;
    if (e.nachIndex === zielIndex && e.tag === gesamtFahrtage) continue;
    for (const [k, tag] of besucht) if (nah(k, e.nachIndex)) return { knoten: k, ersterTag: tag };
    besucht.set(e.nachIndex, e.tag);
  }
  return null;
}

export function ohneWiederholungKandidaten(
  eingabe: WochenplanEingabe, basis: WochenplanEingabe, grundlage: ReadonlyMap<string, EtappenBewertung>,
  hauptScore: ReadonlyMap<EtappenKennzahlen, number>, versuche = FREIE_RUNDE_VERSUCHE,

  naeheSm = HEIMAT_NAEHE_SM,
): WochenplanErgebnis[] {
  const { netz, startIndex, zielIndex, gesamtFahrtage } = eingabe;
  const nahe = (a: number, b: number): boolean => {
    if (a === b) return true;
    const p = netz.knoten[a]?.ort, q = netz.knoten[b]?.ort;
    return p != null && q != null && distNM(p.lat, p.lon, q.lat, q.lon) < naeheSm;
  };
  const ergebnisse: WochenplanErgebnis[] = [];
  const sperren: { knoten: number; ersterTag: number }[] = [];
  for (let versuch = 0; versuch < versuche; versuch++) {
    const kosten = new Map<string, EtappenBewertung>();
    for (const [schluessel, b] of grundlage) {
      const [kante, tag] = schluessel.split(':').map(Number) as [number, number];
      const nach = netz.kanten[kante]?.nach ?? -1;
      const ankunft = tag + (b.istNachtschlag ? 1 : 0);
      const gesperrt = sperren.some((s) => nahe(s.knoten, nach) && ankunft > s.ersterTag)
        && !(nach === zielIndex && ankunft === gesamtFahrtage);
      if (!gesperrt) kosten.set(schluessel, b);
    }
    const plaene = rechneWochenplaene({ ...basis, kosten, kBeste: K_JE_RANDLAUF });
    for (const plan of plaene) {
      const etappen = plan.etappen.map((e) => (e.istHafentag ? { ...e, score: 0 } : { ...e, score: hauptScore.get(e.kennzahlen) ?? e.score }));
      ergebnisse.push({ etappen, gesamtScore: etappen.reduce((s, e) => s + e.score, 0) });
    }
    const bester = plaene[0];
    if (!bester) break;
    const wiederholung = ersteWiederholung(bester, startIndex, zielIndex, gesamtFahrtage, netz, naeheSm);
    if (!wiederholung) break;
    sperren.push(wiederholung);
  }
  return ergebnisse;
}

export function wiederholungsfreieKandidaten(eingabe: WochenplanEingabe): WochenplanErgebnis[] {
  const ohneSammler: WochenplanEingabe = { ...eingabe };
  delete ohneSammler.sammler;
  const woche = wocheNutzenEingabe(ohneSammler);
  if (!woche) return [];
  const hauptScore = new Map<EtappenKennzahlen, number>();
  for (const e of eingabe.kosten.values()) hauptScore.set(e.kennzahlen, e.score);
  return [woche.kosten, ohneOffeneNaechte(woche.kosten)]
    .flatMap((grundlage) => ohneWiederholungKandidaten(ohneSammler, woche, grundlage, hauptScore, FREIE_RUNDE_VERSUCHE, 0));
}

export function freieRundeKandidaten(eingabe: WochenplanEingabe, regelmassSm: number): WochenplanErgebnis[] {
  const basis = wocheNutzenEingabe(eingabe);
  if (!basis || regelmassSm <= 0) return [];
  let aufschlag = 0;
  for (const b of eingabe.kosten.values()) aufschlag = Math.max(aufschlag, b.score);
  const hauptScore = new Map<EtappenKennzahlen, number>();
  for (const e of eingabe.kosten.values()) hauptScore.set(e.kennzahlen, e.score);

  const regelmaessig = new Map<string, EtappenBewertung>();
  for (const [schluessel, b] of basis.kosten) {
    const fehlt = Math.max(0, regelmassSm - b.sm) / regelmassSm;
    regelmaessig.set(schluessel, fehlt > 0 ? { ...b, score: b.score + 2 * aufschlag * fehlt * fehlt } : b);
  }

  const ergebnisse: WochenplanErgebnis[] = [];

  for (const grundlage of [regelmaessig, ohneOffeneNaechte(regelmaessig)]) {
    ergebnisse.push(...ohneWiederholungKandidaten(eingabe, basis, grundlage, hauptScore));
  }
  return ergebnisse;
}

export const SCHUTZ_TAUSCH_NAEHE_SM = 3;

const SAATPLAN_MAX_ORTE = 8;

export function meilenKosten(woche: WochenplanEingabe): Map<string, EtappenBewertung> {
  let maxSm = 0, aufschlag = 0;
  for (const b of woche.kosten.values()) { maxSm = Math.max(maxSm, b.sm); aufschlag = Math.max(aufschlag, b.score); }
  const out = new Map<string, EtappenBewertung>();
  for (const [k, b] of woche.kosten) {
    const segel = b.sm * (1 - (b.kennzahlen.motorShareAnteil ?? 0.5));
    out.set(k, maxSm > 0 ? { ...b, score: b.score - 2 * aufschlag * (segel / maxSm) } : b);
  }
  return out;
}

function istRunde(e: WochenplanEingabe): boolean {
  if (e.startIndex === e.zielIndex) return true;
  const a = e.netz.knoten[e.startIndex]?.ort, b = e.netz.knoten[e.zielIndex]?.ort;
  return a != null && b != null && distNM(a.lat, a.lon, b.lat, b.lon) < HEIMAT_NAEHE_SM;
}

export function umlaufKosten(
  e: WochenplanEingabe, kosten: ReadonlyMap<string, EtappenBewertung>, richtung: 1 | -1,
): Map<string, EtappenBewertung> {
  const orte = e.netz.knoten.map((k) => k.ort);
  const runde = istRunde(e);
  let rang: number[];
  if (runde) {
    rang = umlaufWinkel(orte, e.startIndex, richtung);
  } else {
    const a = orte[e.startIndex]!, b = orte[e.zielIndex]!;
    rang = orte.map((p) => fortschrittSm(a, b, p));
  }
  const out = new Map<string, EtappenBewertung>();
  for (const [schluessel, b] of kosten) {
    const [kante, tag] = schluessel.split(':').map(Number) as [number, number];
    const k = e.netz.kanten[kante];
    if (!k) continue;
    const ankunft = tag + (b.istNachtschlag ? 1 : 0);
    if (k.nach === e.zielIndex) {
      if (runde && ankunft !== e.gesamtFahrtage) continue;
      out.set(schluessel, b);
      continue;
    }
    if (k.nach === e.startIndex) continue;
    const ok = runde ? rang[k.nach]! > rang[k.von]! : rang[k.nach]! >= rang[k.von]! - RUECKSCHRITT_TOLERANZ_SM;
    if (ok) out.set(schluessel, b);
  }
  return out;
}

function mitHauptScore(plan: WochenplanErgebnis, hauptScore: ReadonlyMap<EtappenKennzahlen, number>): WochenplanErgebnis {
  const etappen = plan.etappen.map((e) => (e.istHafentag ? { ...e, score: 0 } : { ...e, score: hauptScore.get(e.kennzahlen) ?? e.score }));
  return { etappen, gesamtScore: etappen.reduce((s, e) => s + e.score, 0) };
}

function nachtGedeckt(k: EtappenKennzahlen): boolean {
  if (k.revierSchutzhafen) return true;
  return k.schutzWellenanlaufNM != null && schutzStufe(k.schutzWellenanlaufNM) !== 'offen';
}

export function schutzTausch(e: WochenplanEingabe, plan: WochenplanErgebnis, naeheSm = SCHUTZ_TAUSCH_NAEHE_SM): WochenplanErgebnis | null {
  const kante = new Map<string, number>();
  e.netz.kanten.forEach((k, i) => kante.set(`${k.von}>${k.nach}`, i));
  const wunsch = new Set(e.wunschzielKnoten);
  const etappen = [...plan.etappen];
  let getauscht = false;
  for (let i = 0; i < etappen.length - 1; i++) {
    const hin = etappen[i]!, weiter = etappen[i + 1]!;
    if (hin.istHafentag || hin.istNachtschlag || weiter.istHafentag || weiter.istNachtschlag) continue;
    if (nachtGedeckt(hin.kennzahlen) || wunsch.has(hin.nachIndex) || hin.nachIndex === e.zielIndex) continue;
    const hier = e.netz.knoten[hin.nachIndex]?.ort;
    if (!hier) continue;
    let bester: { m: number; a: EtappenBewertung; b: EtappenBewertung } | null = null;
    e.netz.knoten.forEach((k, m) => {
      if (m === hin.nachIndex || m === hin.vonIndex || m === weiter.nachIndex) return;
      if (distNM(hier.lat, hier.lon, k.ort.lat, k.ort.lon) > naeheSm) return;
      const ka = kante.get(`${hin.vonIndex}>${m}`), kb = kante.get(`${m}>${weiter.nachIndex}`);
      if (ka == null || kb == null) return;
      const a = e.kosten.get(kostenSchluessel(ka, hin.tag)), b = e.kosten.get(kostenSchluessel(kb, weiter.tag));
      if (!a || !b || a.istNachtschlag || b.istNachtschlag || !nachtGedeckt(a.kennzahlen)) return;
      const s = a.kennzahlen.revierSchutzhafen ? -1 : a.kennzahlen.schutzWellenanlaufNM ?? Infinity;
      const sb = bester ? (bester.a.kennzahlen.revierSchutzhafen ? -1 : bester.a.kennzahlen.schutzWellenanlaufNM ?? Infinity) : Infinity;
      if (!bester || s < sb) bester = { m, a, b };
    });
    if (!bester) continue;
    const { m, a, b } = bester as { m: number; a: EtappenBewertung; b: EtappenBewertung };
    etappen[i] = { ...hin, nachIndex: m, sm: a.sm, score: a.score, regime: a.regime, kennzahlen: a.kennzahlen };
    etappen[i + 1] = { ...weiter, vonIndex: m, sm: b.sm, score: b.score, regime: b.regime, kennzahlen: b.kennzahlen };
    getauscht = true;
  }
  return getauscht ? { etappen, gesamtScore: etappen.reduce((s, x) => s + x.score, 0) } : null;
}

export function gummibandKandidaten(
  eingabe: WochenplanEingabe, woche: WochenplanEingabe, hauptScore: ReadonlyMap<EtappenKennzahlen, number>,
): WochenplanErgebnis[] {
  const mk = meilenKosten(woche);
  const basis: WochenplanEingabe = { ...woche, kosten: mk, kBeste: K_JE_RANDLAUF };
  const out: WochenplanErgebnis[] = [];

  const naehe = eingabe.freieRunde ? HEIMAT_NAEHE_SM : 0;

  for (const kosten of [mk, ohneOffeneNaechte(mk)]) {
    for (const richtung of [1, -1] as const) {
      for (const p of rechneWochenplaene({ ...basis, kosten: umlaufKosten(eingabe, kosten, richtung) })) out.push(mitHauptScore(p, hauptScore));
    }
    out.push(...ohneWiederholungKandidaten(eingabe, { ...basis, kosten }, kosten, hauptScore, FREIE_RUNDE_VERSUCHE, naehe));
  }

  const wunsch = new Set(eingabe.wunschzielKnoten);
  const erreichbar = basis.erreichbar;
  const nurWunschziele = erreichbar
    ? { erreichbar: (k: number, t: number, offen: readonly number[]) => erreichbar(k, t, offen.filter((i) => wunsch.has(i))) }
    : {};
  for (const kette of eingabe.saatplaene ?? []) {
    const orte = [...new Set(kette.filter((k) => k !== eingabe.startIndex && k !== eingabe.zielIndex))];
    const pflicht = [...new Set([...eingabe.wunschzielKnoten, ...orte])];
    if (orte.length === 0 || pflicht.length > SAATPLAN_MAX_ORTE) continue;
    for (const p of rechneWochenplaene({ ...basis, ...nurWunschziele, wunschzielKnoten: pflicht })) out.push(mitHauptScore(p, hauptScore));
  }
  return out;
}

export function ankunftsKandidaten(
  eingabe: WochenplanEingabe, hauptScore: ReadonlyMap<EtappenKennzahlen, number>,
): WochenplanErgebnis[] {
  let aufschlag = 0;
  for (const b of eingabe.kosten.values()) aufschlag = Math.max(aufschlag, b.score);
  if (aufschlag <= 0) aufschlag = 1;
  const { zielIndex } = eingabe;
  const teuer = new Map<string, EtappenBewertung>();
  for (const [k, b] of eingabe.kosten) teuer.set(k, { ...b, score: b.score + 2 * aufschlag * (b.istNachtschlag ? 2 : 1) });
  const basis: WochenplanEingabe = {
    ...eingabe, kBeste: K_JE_RANDLAUF,
    hafentagScore: (knoten) => (knoten === zielIndex ? 0 : 2 * aufschlag),
  };

  const schutz = schutzJeOrtUndNacht(eingabe.netz, eingabe.kosten);
  const liegtOffen = (knoten: number, tag: number): boolean => {
    const heute = eingabe.liegeschutz?.get(`${knoten}|${tag}`);
    const q = heute && (heute.schutzWellenanlaufNM != null || heute.revierSchutzhafen) ? heute : schutz.get(`${knoten}|${tag}`);
    return !!q && !q.revierSchutzhafen && q.schutzWellenanlaufNM != null && schutzStufe(q.schutzWellenanlaufNM) === 'offen';
  };
  const sperre = 2 * aufschlag * 1000 * Math.max(1, eingabe.gesamtFahrtage);
  const gedeckt: WochenplanEingabe = {
    ...basis, kosten: ohneOffeneNaechte(teuer),
    hafentagScore: (knoten, tag) => (knoten === zielIndex ? 0 : liegtOffen(knoten, tag) ? sperre : 2 * aufschlag),
  };

  const budget = eingabe.nachtfahrtBudget;
  const naechte = budget != null && Number.isFinite(budget) && budget > 0
    ? Array.from({ length: Math.floor(budget) + 1 }, (_, i) => i) : [undefined];
  const out: WochenplanErgebnis[] = [];
  const gesehen = new Set<string>();
  for (const n of naechte) {
    for (const lauf of [{ ...basis, kosten: teuer }, gedeckt]) {
      for (const p of rechneWochenplaene(n == null ? lauf : { ...lauf, nachtfahrtBudget: n })) {

        if (lauf === gedeckt && p.gesamtScore >= sperre) continue;
        const schluessel = p.etappen.map((e) => `${e.tag}:${e.vonIndex}>${e.nachIndex}${e.istHafentag ? 'h' : ''}`).join('|');
        if (gesehen.has(schluessel)) continue;
        gesehen.add(schluessel);
        out.push(mitHauptScore(p, hauptScore));
      }
    }
  }
  return out;
}
