
import { holeKandidatenknotenImGebiet, holeKuestenlinienFuerNetz, dedupliziereHafenknoten } from '@/data/haefen';
import { openMeteoKontingentErschoepft } from '@/data/openMeteoNetz';
import { holeInselAbschnitteOderWirf, type InselAbschnitte } from '@/data/skipperguide';
import type { Hafenknoten } from '@/core/hafennetz';
import { holeWindgitter } from '@/data/revierwind';
import { findInselnFuerPunkte, istGolfName } from '@/data/overpass';
import {
  filtereSuchraum, filtereAnkerbuchten, baueKandidatennetz, begrenzeKandidaten, verbindeTeilnetze, ergaenzeNachtkanten, nachtBonusTage, NACHTSCHLAG_MAX_STUNDEN, korridorWege,
  MAX_KANDIDATEN, MAX_NACHBARN, KANDIDATEN_ZELLE_SM, kantenOhneVtg, type Kandidatennetz, type Hafenkante,
} from '@/core/hafennetz';
import {
  rechneVielfaeltigeWochenplaene, wiederholungsfreieKandidaten, kostenSchluessel, zerlegeRundreise, type WochenplanEingabe, type WochenplanErgebnis, type EtappenBewertung,
} from '@/core/wochenplan';
import { waehlePlaene, zaehleRueckwegAmHinweg, zaehleTageAmHeimathafen, zaehleUeberzaehligeHafentage, zaehleWiederholteLiegeplaetze, zaehleKurzeTage, HEIMAT_NAEHE_SM, UEBERNAHME_SPAET_AB_UHR, type ErklaertePraeferenzen, type ReihungsKontext } from '@/core/zielfunktion';
import { ausrichtungstermRundtoern, ausrichtungstermEinweg } from '@/core/ausrichtung';
import { waehleToernvorschlag, waehleToernvorschlaege, bildeKetteAufNetzAb, SAATPLAN_SCHWELLE_NM } from '@/core/saatplan';
import { huellenumfangSm, selbstkreuzungen, rueckschritte } from '@/core/gummiband';
import { seeweg, boxUm } from '@/core/landumfahrung';
import { schutzStufe } from '@/core/shelter';
import { revierVonPunkt } from '@/core/revierzonen';
import { bearingDeg } from '@/core/geo';
import type { Punkt } from '@/core/types';
import { BegruendungsSammler } from '@/core/begruendung';
import {
  kennzahlenJeOption, entscheidungspunkt, empfehleOption, heimwindAus, type Option, type EmpfehlungsEtappe,
} from '@/core/optionen';
import type { RevierRandbedingungen } from '@/core/referenzfahrt';
import type { Wunschziel } from '@/core/wunschziele';
import { umkehrpunkt, reichweiteAmTag, type UmkehrpunktTag, type UmkehrpunktErgebnis } from '@/core/rueckkehr';
import { nDate } from '@/core/time';
import { befuelleKostenkarte, liegeschutzJeOrtUndTag, parallelMitGrenze, NEBENLAEUFIGE_ABRUFE, WINDPROBEN_SCHRITT_H } from './kostenkarte';
import { fetchStaatsnamen } from '@/data/seegebiete';
import { holeVorrechnung } from '@/data/vorrechnung';
import { deckt, kandidatenInBox, inselnAusPaket, staatAusPaket } from '@/core/vorrechnung';
import { istKlarierGrenze, einklarierStunden, type Staatsnamen } from '@/core/grenzen';
import { SCORE_PRO_FAHRTSTUNDE } from '@/core/evaluate';
import { ordnePoiBasen, waehleOrtsbasis, abstecherWetter, poiOeffnungszeitenUrteil } from '@/core/poi';
import { holeOeffnungszeitenNaheOrt } from '@/data/poiOeffnungszeiten';
import { windAmPunkt } from '@/core/windgitter';
import { distNM } from '@/core/geo';
import { istZulaessig, type NachtVorgaben } from '@/core/bereitschaft';
import { holeModellUebereinstimmung } from './modellwetter';
import { gemerkt, neuerKostenkartenSpeicher, type KostenkartenSpeicher } from './zwischenspeicher';
import { mitVorgaben, nachtVorgabenAus, praeferenzenAus } from './planung';
import { NORMALWIND_KN } from './konstanten';
import { windrichtung } from './wunschliste';
import {
  type RechnerAnfrage, type RechnerAntwort, type OptionEingabe, type OptionErgebnis, type RechnerFortschritt,
  baueOptionsPflichtknoten, wunschzielIndizesJeOption, alleWunschzielArtigeListe, zielKnotenIndex,
  schaetzeMaxTagesetappeSm, suchraumHalbachseSm, suchraumHalbachseFuerKetteSm, suchraumBoundingBox, vervollstaendigeBegruendung,
  ZEITBUDGET_MS,
  ermittleKeinPlanGrund, type Lockerung, type KeinPlanGrund,
  K_BESTE, STANDARD_RADIUS_NM, OPTION_SCHLUESSEL_1, OPTION_SCHLUESSEL_2,
} from './rechnerProtokoll';


function rechneEineOption(
  option: OptionEingabe, wunschzielKnoten: readonly number[],
  eingabeBasis: Omit<WochenplanEingabe, 'wunschzielKnoten' | 'sammler'>,
  
  umkehrlinie: (ergebnis: WochenplanErgebnis, wunschzielKnoten: readonly number[]) => UmkehrpunktErgebnis | null,
  
  praeferenzen: ErklaertePraeferenzen,
  
  reihungsKontext: ReihungsKontext = {},
  
  langerTagAbSm: number | null = null,
  
  mindestHafentage = 0,
  
  regelmassSm: number | null = null,
): OptionErgebnis {
  const sammler = new BegruendungsSammler();
  const kennung = { schluessel: option.schluessel, name: option.name, umkehrpunkt: null };
  
  
  const freieRunde = regelmassSm != null && regelmassSm > 0 && option.wunschziele.length === 0 && !option.endziel;
  const eingabe: WochenplanEingabe = {
    ...eingabeBasis, wunschzielKnoten: [...wunschzielKnoten], sammler,
    ...(freieRunde ? { freieRunde: { regelmassSm: regelmassSm! } } : {}),
    ...(reihungsKontext.ankunftsTag != null ? { offenesEnde: true } : {}),
  };
  
  
  
  const wiederholteLiegeplaetze = (plan: WochenplanErgebnis, naeheSm = HEIMAT_NAEHE_SM): number => zaehleWiederholteLiegeplaetze(
    plan.etappen, eingabeBasis.startIndex, eingabeBasis.zielIndex, eingabeBasis.gesamtFahrtage,
    eingabeBasis.netz.knoten.map((k) => k.ort), naeheSm,
  );
  const kontext: ReihungsKontext = freieRunde ? {
    ...reihungsKontext, wiederholteLiegeplaetze: (plan) => wiederholteLiegeplaetze(plan),
    kurzeTage: (plan) => zaehleKurzeTage(plan.etappen, regelmassSm!),
  } : { ...reihungsKontext, wiederholteLiegeplaetze: (plan) => wiederholteLiegeplaetze(plan, 0) };
  
  
  
  
  
  
  const offenesEnde = reihungsKontext.ankunftsTag != null;
  const bisZurAnkunft = (p: WochenplanErgebnis): WochenplanErgebnis => {
    let n = p.etappen.length;
    while (n > 1 && p.etappen[n - 1]!.istHafentag && p.etappen[n - 1]!.vonIndex === eingabeBasis.zielIndex) n--;
    if (n === p.etappen.length) return p;
    const etappen = p.etappen.slice(0, n);
    return { etappen, gesamtScore: etappen.reduce((s, e) => s + e.score, 0) };
  };
  const roheKandidaten = rechneVielfaeltigeWochenplaene(eingabe)
    .map((p) => (offenesEnde ? bisZurAnkunft(p) : p))
    .filter((p) => p.etappen.filter((e) => e.istHafentag).length >= mindestHafentage);
  
  
  
  
  
  const einmal = (p: WochenplanErgebnis): boolean => wunschzielKnoten.every((k) => p.etappen.filter((e) =>
    !e.istHafentag && e.nachIndex === k && !(k === eingabeBasis.zielIndex && e.tag === eingabeBasis.gesamtFahrtage)).length <= 1);
  const gefiltert = roheKandidaten.filter(einmal);
  const kandidatenplaene = gefiltert.length > 0 ? gefiltert : roheKandidaten;
  if (kandidatenplaene.length === 0) return { ...kennung, ergebnis: null, begruendung: null, reihenfolge: [] };

  let gewaehlt = waehlePlaene(kandidatenplaene, praeferenzen, kontext);
  
  
  
  
  
  
  const sieger = gewaehlt.gereiht[0];
  
  if (!freieRunde && sieger && wiederholteLiegeplaetze(sieger, 0) > 0) {
    const folge = (p: WochenplanErgebnis): string => p.etappen.filter((e) => !e.istHafentag).map((e) => `${e.vonIndex}>${e.nachIndex}`).join(',');
    const bekannt = new Set(kandidatenplaene.map(folge));
    const dazu = wiederholungsfreieKandidaten(eingabe)
      .filter((p) => p.etappen.filter((e) => e.istHafentag).length >= mindestHafentage)
      .filter((p) => { const f = folge(p); if (bekannt.has(f)) return false; bekannt.add(f); return true; });
    gewaehlt = waehlePlaene([...kandidatenplaene, ...dazu], praeferenzen, { ...kontext, wiederholteLiegeplaetze: (plan) => wiederholteLiegeplaetze(plan, 0) });
  }
  const { gereiht, reihenfolge, entscheidend, zweitbester } = gewaehlt;
  if (gereiht.length === 0) return { ...kennung, ergebnis: null, begruendung: null, reihenfolge };

  const ergebnis = gereiht[0]!;
  const begruendung = vervollstaendigeBegruendung(
    sammler.ergebnisFuerPlan(ergebnis.etappen), ergebnis.etappen, entscheidend, eingabeBasis.netz,
    zweitbester?.etappen ?? [], langerTagAbSm,
  );
  return { ...kennung, ergebnis, begruendung, reihenfolge, umkehrpunkt: umkehrlinie(ergebnis, wunschzielKnoten) };
}


const STUFE2_RUNDEN = 3;

const STUFE2_REST_MAX = 120;


const SKIPPERGUIDE_MAX_INSELN = 12;

const SKIPPERGUIDE_ZITAT_SM = 0.5;

export interface SkipperGuideZitat {
  name: string;
  ort: Punkt;
  text: string;
  seite: string;
  quelle: string;
  stand: string | null;
}

function ortSchluessel(p: Punkt): string {
  return `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
}


const SEEGEBIET_UMKREIS_GRAD = 0.05;


const GITTER_RAND_GRAD = 0.1;


const ORT_BASIS_MAX_SM = 20;

const ZUFAHRT_ERSATZ_MAX_SM = 5;


const FREIE_RUNDE_MAX_KANDIDATEN = 60;


const LANGE_TAGE_MAX_STUNDEN = 12;

const PROBE_NAECHTE = 2;

const PROBE_BUDGET_MS = 60_000;

function netzRechteck(netz: Kandidatennetz, rand: number): { swLat: number; swLon: number; neLat: number; neLon: number } {
  const lats = netz.knoten.map((k) => k.ort.lat), lons = netz.knoten.map((k) => k.ort.lon);
  return {
    swLat: Math.min(...lats) - rand, swLon: Math.min(...lons) - rand,
    neLat: Math.max(...lats) + rand, neLon: Math.max(...lons) + rand,
  };
}


function kanteZu(netz: Kandidatennetz, von: number, nach: number): number | null {
  const i = netz.kanten.findIndex((k) => k.von === von && k.nach === nach);
  return i >= 0 ? i : null;
}


function baueReihungsKontext(
  netz: Kandidatennetz, start: Punkt, gesamtFahrtage: number,
  windDeg: number | null, istEinweg: boolean, ziel: Punkt,
): ReihungsKontext {
  const kontext: ReihungsKontext = {};

  
  const uebernachtungen = (plan: WochenplanErgebnis): Punkt[] => [
    start, ...plan.etappen.filter((e) => !e.istHafentag).map((e) => netz.knoten[e.nachIndex]?.ort).filter((o): o is Punkt => o != null),
  ];
  kontext.huellenumfangSm = (plan) => huellenumfangSm(uebernachtungen(plan));
  kontext.selbstkreuzungen = (plan) => selbstkreuzungen(uebernachtungen(plan));
  
  
  if (istEinweg && distNM(start.lat, start.lon, ziel.lat, ziel.lon) >= HEIMAT_NAEHE_SM) {
    kontext.rueckschritte = (plan) => rueckschritte(uebernachtungen(plan), ziel);
  }

  
  
  if (!istEinweg) {
    kontext.rueckwegAmHinweg = (plan) => {
      const teile = zerlegeRundreise(netz, plan, 0, 0);
      return teile ? zaehleRueckwegAmHinweg(teile.hinweg, teile.rueckOrte) : 0;
    };
  }

  if (windDeg != null) {
    kontext.ausrichtung = (plan) => {
      let summe = 0;
      for (const e of plan.etappen) {
        if (e.istHafentag) continue;
        const von = netz.knoten[e.vonIndex]?.ort, nach = netz.knoten[e.nachIndex]?.ort;
        if (!von || !nach) continue;
        const kurs = bearingDeg(von.lat, von.lon, nach.lat, nach.lon);
        const zeitanteil = gesamtFahrtage > 1 ? (e.tag - 1) / (gesamtFahrtage - 1) : 0;
        summe += istEinweg
          ? ausrichtungstermEinweg(kurs, windDeg, zeitanteil)
          : ausrichtungstermRundtoern(kurs, windDeg, zeitanteil);
      }
      return summe;
    };
  }

  const revier = revierVonPunkt(start.lat, start.lon);
  if (revier === 'adria' || revier === 'aegaeis' || revier === 'ionisch') {
    const vorschlag = waehleToernvorschlag(revier, istEinweg ? 'einwegtoern' : 'rundtoern', start);
    const kette = vorschlag ? bildeKetteAufNetzAb(vorschlag, netz.knoten) : null;
    if (kette) {
      const orte = new Set(kette.knotenIndizes);
      kontext.saatplanAbweichung = (plan) => {
        const besucht = new Set(plan.etappen.map((e) => e.nachIndex));
        return [...orte].filter((k) => !besucht.has(k)).length;
      };
    }
  }
  return kontext;
}


function baueTrajektorie(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz, startIndex: number,
  wunschzielKnoten: readonly number[], wunschzielJeKnoten: ReadonlyMap<number, Wunschziel>,
): UmkehrpunktTag[] {
  const offenFuer = (besucht: ReadonlySet<number>): Wunschziel[] =>
    wunschzielKnoten.filter((k) => !besucht.has(k)).map((k) => wunschzielJeKnoten.get(k)!);

  const besucht = new Set<number>([startIndex]);
  const tage: UmkehrpunktTag[] = [
    { ort: netz.knoten[startIndex]!.ort, offeneWunschziele: offenFuer(besucht) },
  ];
  for (const etappe of ergebnis.etappen) {
    besucht.add(etappe.nachIndex);
    const knoten = netz.knoten[etappe.nachIndex];
    if (!knoten) continue;
    tage.push({ ort: knoten.ort, offeneWunschziele: offenFuer(besucht) });
  }
  return tage;
}

export async function rechne(
  anfrage: RechnerAnfrage,
  
  melde: (f: RechnerFortschritt) => void = () => {},
  
  speicher: KostenkartenSpeicher | null = null,
): Promise<RechnerAntwort> {
  
  if (anfrage.offenesEnde && !anfrage.ohneUmkehrpunkt) anfrage = { ...anfrage, ohneUmkehrpunkt: true };
  
  
  
  if (anfrage.obergrenzeSm != null && anfrage.obergrenzeSm < 1) {
    return {
      lage: 'keinPlanGefunden', grund: { art: 'tagesmeilenNull' },
      bericht: { kanten: 0, gerechnet: 0, keinFenster: 0, fehlgeschlagen: 0, nurGeruest: 0 },
    };
  }
  melde({ art: 'fortschritt', phase: 'haefen', schritt: 'kandidaten' });
  
  
  
  const zeitbudgetMs = anfrage.zeitbudgetMs ?? ZEITBUDGET_MS;
  const frist = Date.now() + zeitbudgetMs;
  const budgetErreicht = (): boolean => Date.now() >= frist;
  const option1: OptionEingabe = {
    schluessel: OPTION_SCHLUESSEL_1, name: 'Option 1',
    wunschziele: anfrage.wunschziele, endziel: anfrage.endziel,
  };
  
  
  
  const optionEingaben: OptionEingabe[] = anfrage.zweiteOption
    ? [option1, { ...anfrage.zweiteOption, schluessel: OPTION_SCHLUESSEL_2 }]
    : [option1];

  
  
  
  const planung = mitVorgaben(anfrage.planung);

  
  
  const rueckgabehafen = anfrage.rueckgabehafen ?? null;
  const pflichtKnoten = baueOptionsPflichtknoten(anfrage.start, optionEingaben, rueckgabehafen);
  const zielIndex = zielKnotenIndex(optionEingaben, rueckgabehafen != null);

  
  
  
  
  const fixierungen = anfrage.fixierungen ?? [];
  const pflichtOrte = fixierungen.map((f, i) => ({
    tag: f.tag, knotenIndex: pflichtKnoten.length + i,
  }));
  for (const f of fixierungen) pflichtKnoten.push({ name: f.name, ort: f.ort, art: 'hafen' });
  
  
  
  const zielOrt = rueckgabehafen?.ort ?? anfrage.start.ort;
  const maxTagesetappeSm = schaetzeMaxTagesetappeSm(anfrage.cfg, anfrage.maxStundenProTag, anfrage.obergrenzeSm);
  
  const halbachseKetteSm = suchraumHalbachseFuerKetteSm(
    maxTagesetappeSm, anfrage.gesamtFahrtage, anfrage.start.ort, zielOrt, pflichtKnoten.map((k) => k.ort),
  );
  
  
  
  const nurFreieRunde = optionEingaben.every((o) => o.wunschziele.length === 0 && !o.endziel);
  let halbachseSm = nurFreieRunde
    ? Math.min(suchraumHalbachseSm(maxTagesetappeSm, anfrage.gesamtFahrtage),
      Math.max(halbachseKetteSm, (planung.regelmassSm * anfrage.gesamtFahrtage) / 3))
    : halbachseKetteSm;
  
  
  
  
  
  let seewegPunkte: Punkt[] | null = null;
  let seewegSm = 0;
  if (anfrage.offenesEnde && rueckgabehafen) {
    const b0 = boxUm([anfrage.start.ort, zielOrt], 150);
    const { kuestenlinienRueckfall } = await import('@/data/kuestenlinienFallback');
    const k0 = await kuestenlinienRueckfall(b0.swLat, b0.swLon, b0.neLat, b0.neLon);
    seewegPunkte = k0 ? seeweg(anfrage.start.ort, zielOrt, k0, 150, 0.5, true) : null;
    if (seewegPunkte) {
      let l = 0;
      for (let i = 1; i < seewegPunkte.length; i++) l += distNM(seewegPunkte[i - 1]!.lat, seewegPunkte[i - 1]!.lon, seewegPunkte[i]!.lat, seewegPunkte[i]!.lon);
      seewegSm = l;
      halbachseSm = Math.max(halbachseSm, l / 2 + maxTagesetappeSm);
    }
  }
  const radiusNM = Math.max(STANDARD_RADIUS_NM, maxTagesetappeSm);

  
  
  
  
  
  
  const box = seewegPunkte
    ? boxUm([...seewegPunkte, ...pflichtKnoten.map((k) => k.ort)], Math.max(40, maxTagesetappeSm))
    : suchraumBoundingBox([anfrage.start.ort, zielOrt, ...pflichtKnoten.map((k) => k.ort)], halbachseSm);
  
  
  
  
  
  
  
  
  const paket = await gemerkt(speicher, 'vorrechnung-teil', box, () => holeVorrechnung(box, true)).catch(() => null);
  const ausPaket: Hafenknoten[] = paket
    
    ? kandidatenInBox(paket, box).filter((a) => !(a.art === 'bucht' && istGolfName(a.name)))
      .map((a) => ({ name: a.name, ort: { lat: a.lat, lon: a.lon }, art: a.art }))
    : [];
  const paketDecktGanz = paket != null && deckt(paket.bbox, box) && ausPaket.length > 0;
  const live: Hafenknoten[] = paketDecktGanz ? [] : await gemerkt(
    speicher, 'kandidaten', { box, radiusNM, anker: pflichtKnoten.map((k) => k.ort) },
    () => holeKandidatenknotenImGebiet(box, pflichtKnoten.map((k) => k.ort), radiusNM),
  ).catch((): Hafenknoten[] => []);
  const rohKandidaten = dedupliziereHafenknoten([...live, ...ausPaket]);
  
  
  const haefenNurTeilpaket = !paketDecktGanz && live.length === 0 && ausPaket.length > 0;
  const haefenUnbekannt = !paketDecktGanz && live.length === 0 && ausPaket.length === 0;
  
  
  
  
  const erlaubt = filtereAnkerbuchten(rohKandidaten, planung.ankerbuchtenGleichwertig);
  const imRaum = filtereSuchraum(erlaubt, anfrage.start.ort, zielOrt, halbachseSm);

  
  
  
  
  
  
  
  const alleWunschzielArtige = alleWunschzielArtigeListe(optionEingaben);
  const ortsbasisVorab = new Map<number, Wunschziel>();
  alleWunschzielArtige.forEach((w, i) => {
    if (w.art === 'poi' || !w.ungenauerOrt) return;
    const basis = waehleOrtsbasis(w.ort, imRaum, ORT_BASIS_MAX_SM);
    if (!basis) return;
    pflichtKnoten[i + 1] = { name: basis.name, ort: basis.ort, art: basis.art };
    ortsbasisVorab.set(i + 1, { ...w, ort: basis.ort, ungenauerOrt: false });
  });

  melde({ art: 'fortschritt', phase: 'haefen', schritt: 'kueste' });
  
  
  
  
  const kuesteErgebnis = await gemerkt(speicher, 'kueste', box, async () => {
    const ergebnis = await holeKuestenlinienFuerNetz(box.swLat, box.swLon, box.neLat, box.neLon);
    if (!ergebnis) throw new Error('Kuestenlinien nicht verfuegbar');
    return ergebnis;
  }).catch(() => null);
  const kueste = kuesteErgebnis?.linien ?? null;
  const kuesteRueckfall = kuesteErgebnis?.rueckfall ?? false;

  
  
  const bezugspunkte = [anfrage.start.ort, zielOrt, ...pflichtKnoten.map((k) => k.ort)];
  const korridor = [...korridorWege(bezugspunkte, kueste ?? []), ...(seewegPunkte ? [seewegPunkte] : [])];
  
  
  
  const zelleSm = nurFreieRunde ? Math.max(KANDIDATEN_ZELLE_SM, planung.regelmassSm / 3) : KANDIDATEN_ZELLE_SM;
  
  
  const maxKandidaten = nurFreieRunde ? FREIE_RUNDE_MAX_KANDIDATEN
    : Math.min(FREIE_RUNDE_MAX_KANDIDATEN, Math.max(MAX_KANDIDATEN, Math.ceil(seewegSm / 15)));
  
  
  
  const saatRevier = revierVonPunkt(anfrage.start.ort.lat, anfrage.start.ort.lon);
  const saatVorschlaege = saatRevier === 'adria' || saatRevier === 'aegaeis' || saatRevier === 'ionisch'
    ? waehleToernvorschlaege(saatRevier, rueckgabehafen != null ? 'einwegtoern' : 'rundtoern', anfrage.start.ort) : [];
  const saatKnoten: Hafenknoten[] = [];
  for (const o of saatVorschlaege.flatMap((v) => v.kette)) {
    let bester: Hafenknoten | null = null, d = SAATPLAN_SCHWELLE_NM;
    for (const k of imRaum) {
      const x = distNM(o.lat, o.lon, k.ort.lat, k.ort.lon);
      if (x <= d) { d = x; bester = k; }
    }
    if (bester && !saatKnoten.includes(bester)) saatKnoten.push(bester);
  }
  const gedeckelt = begrenzeKandidaten(imRaum, bezugspunkte, maxKandidaten, korridor, zelleSm);
  const kandidaten = [...gedeckelt, ...saatKnoten.filter((k) => !gedeckelt.includes(k))];
  const kandidatenGedeckelt = kandidaten.length < imRaum.length
    ? { vorher: imRaum.length, behalten: kandidaten.length } : null;

  const revier: RevierRandbedingungen = {
    boat: anfrage.cfg.boat, crewFactor: anfrage.cfg.crewFactor, motorSpeedKn: anfrage.cfg.motorSpeed,
    
    
    vorherrschenderWindDeg: windrichtung(anfrage.start.ort, anfrage.wunschziele, anfrage.endziel),
    vorherrschenderWindKn: NORMALWIND_KN,
  };
  
  
  
  
  
  
  const netzOsm = baueKandidatennetz(pflichtKnoten, kandidaten, revier, planung.maxStundenProTag, kueste ?? [], MAX_NACHBARN);
  melde({ art: 'fortschritt', phase: 'haefen', schritt: 'inseln' });
  
  const inselnBekannt = inselnAusPaket(paket, netzOsm.knoten.map((k) => k.ort));
  const inselnLive = inselnBekannt.fehlend.length === 0 ? [] : await gemerkt(speicher, 'inseln',
    inselnBekannt.fehlend.map((i) => netzOsm.knoten[i]!.ort),
    () => findInselnFuerPunkte(inselnBekannt.fehlend.map((i) => netzOsm.knoten[i]!.ort)));
  const inselnOsm: string[][] = inselnBekannt.inseln.map((x) => x ?? []);
  inselnBekannt.fehlend.forEach((i, j) => { inselnOsm[i] = inselnLive[j] ?? []; });
  const inselJeOrt = new Map(netzOsm.knoten.map((k, i) => [ortSchluessel(k.ort), inselnOsm[i] ?? []] as const));
  const inselNamen = [...new Set(inselnOsm.flat())].sort().slice(0, SKIPPERGUIDE_MAX_INSELN);
  if (inselNamen.length > 0) melde({ art: 'fortschritt', phase: 'haefen', schritt: 'skipperguide' });
  const inselSeiten = (await parallelMitGrenze(3, inselNamen.map((name) => () =>
    gemerkt(speicher, 'skipperguide', name, () => holeInselAbschnitteOderWirf(name))
      .catch((): InselAbschnitte | null => null))))
    .filter((s): s is InselAbschnitte => s != null);
  const zitate: SkipperGuideZitat[] = inselSeiten.flatMap((s) => s.orte.map((o) => ({
    name: o.name, ort: o.ort, text: o.text, seite: s.seite, quelle: s.quelle, stand: s.stand,
  })));
  const sgKnoten: Hafenknoten[] = filtereSuchraum(
    filtereAnkerbuchten(
      
      
      
      zitate.map((z) => ({ name: z.name, ort: z.ort, art: 'bucht' as const })),
      planung.ankerbuchtenGleichwertig,
    ),
    anfrage.start.ort, zielOrt, halbachseSm,
  );
  for (const z of zitate) {
    const seite = inselSeiten.find((s) => s.seite === z.seite);
    if (seite) inselJeOrt.set(ortSchluessel(z.ort), [seite.seite]);
  }
  
  const netzRoh = sgKnoten.length === 0 ? netzOsm : baueKandidatennetz(
    pflichtKnoten,
    
    dedupliziereHafenknoten([...begrenzeKandidaten(dedupliziereHafenknoten([...kandidaten, ...sgKnoten]), bezugspunkte, maxKandidaten, korridor, zelleSm), ...saatKnoten]),
    revier, planung.maxStundenProTag, kueste ?? [], MAX_NACHBARN,
  );

  
  
  
  
  const poiBasis = ordnePoiBasen(
    netzRoh, alleWunschzielArtige.flatMap((w, i) => (w.art === 'poi' ? [i + 1] : [])),
  );
  for (const [poi, basis] of poiBasis) {
    if (basis == null) {
      return {
        lage: 'keinPlanGefunden', grund: { art: 'poiOhneBasis', name: netzRoh.knoten[poi]!.name },
        bericht: { kanten: 0, gerechnet: 0, keinFenster: 0, fehlgeschlagen: 0, nurGeruest: 0 },
      };
    }
  }
  
  
  
  
  
  
  
  
  
  const ungenauIndizes = alleWunschzielArtige.flatMap(
    (w, i) => (w.art !== 'poi' && w.ungenauerOrt && !ortsbasisVorab.has(i + 1) ? [i + 1] : []),
  );
  const ortBasis = ordnePoiBasen(netzRoh, ungenauIndizes, ORT_BASIS_MAX_SM);
  for (const [ort, basis] of ortBasis) {
    if (basis == null) {
      return {
        lage: 'keinPlanGefunden', grund: { art: 'ortOhneLiegeplatz', name: netzRoh.knoten[ort]!.name },
        bericht: { kanten: 0, gerechnet: 0, keinFenster: 0, fehlgeschlagen: 0, nurGeruest: 0 },
      };
    }
  }
  
  
  
  
  
  
  
  const zufahrtErsatz: { wunsch: string; basis: string; sm: number }[] = [];
  const hatZufahrt = (j: number): boolean => netzRoh.kanten.some((k) => k.nach === j);
  alleWunschzielArtige.forEach((w, i) => {
    const j = i + 1;
    if (w.art === 'poi' || ortBasis.has(j) || hatZufahrt(j)) return;
    const p = netzRoh.knoten[j]!.ort;
    let beste: number | null = null, besteSm = Infinity;
    netzRoh.knoten.forEach((k, kIdx) => {
      if (kIdx === j || poiBasis.has(kIdx) || !hatZufahrt(kIdx)) return;
      const sm = distNM(p.lat, p.lon, k.ort.lat, k.ort.lon);
      if (sm <= ZUFAHRT_ERSATZ_MAX_SM && sm < besteSm) { beste = kIdx; besteSm = sm; }
    });
    if (beste == null) return; 
    ortBasis.set(j, beste);
    zufahrtErsatz.push({ wunsch: w.name, basis: netzRoh.knoten[beste]!.name, sm: besteSm });
  });
  
  const wunschzielJeKnoten = new Map<number, Wunschziel>();
  alleWunschzielArtige.forEach((w, i) => { if (w.art !== 'poi') wunschzielJeKnoten.set(i + 1, ortsbasisVorab.get(i + 1) ?? w); });
  alleWunschzielArtige.forEach((w, i) => {
    const basis = poiBasis.get(i + 1);
    if (w.art === 'poi' && basis != null && !wunschzielJeKnoten.has(basis)) wunschzielJeKnoten.set(basis, w);
  });
  alleWunschzielArtige.forEach((w, i) => {
    const basis = ortBasis.get(i + 1);
    if (w.art !== 'poi' && basis != null && !wunschzielJeKnoten.has(basis)) wunschzielJeKnoten.set(basis, w);
  });

  
  
  
  
  
  let staatenErledigt = 0;
  if (planung.grenzuebertritt !== 'gern') melde({ art: 'fortschritt', phase: 'haefen', schritt: 'staaten', erledigt: 0, gesamt: netzRoh.knoten.length });
  const staaten: Staatsnamen[] = planung.grenzuebertritt === 'gern'
    ? netzRoh.knoten.map(() => null)
    : await parallelMitGrenze(NEBENLAEUFIGE_ABRUFE, netzRoh.knoten.map((k) => () =>
      
      
      (staatAusPaket(paket, k.ort) !== undefined
        ? Promise.resolve<Staatsnamen>(staatAusPaket(paket, k.ort)!)
        : gemerkt(speicher, 'staat', k.ort, () => fetchStaatsnamen(k.ort.lat, k.ort.lon, SEEGEBIET_UMKREIS_GRAD)))
        .catch((): Staatsnamen => null)
        .finally(() => melde({ art: 'fortschritt', phase: 'haefen', schritt: 'staaten', erledigt: ++staatenErledigt, gesamt: netzRoh.knoten.length }))));
  const quertGrenze = (kante: { von: number; nach: number }): boolean =>
    istKlarierGrenze(staaten[kante.von] ?? null, staaten[kante.nach] ?? null);

  if (planung.grenzuebertritt === 'nie') {
    
    
    
    for (let i = 1; i < pflichtKnoten.length; i++) {
      if (istKlarierGrenze(staaten[0] ?? null, staaten[i] ?? null)) {
        return {
          lage: 'keinPlanGefunden', grund: { art: 'grenzuebertritt', name: netzRoh.knoten[i]!.name },
          bericht: { kanten: 0, gerechnet: 0, keinFenster: 0, fehlgeschlagen: 0, nurGeruest: 0 },
        };
      }
    }
  }
  
  
  
  
  const kanteErlaubt = (k: Hafenkante): boolean => !(planung.grenzuebertritt === 'nie' && quertGrenze(k))
    && !(planung.langeTage === 'nie' && k.sm > planung.regelmassSm)
    && !poiBasis.has(k.von) && !poiBasis.has(k.nach)
    && !ortBasis.has(k.von) && !ortBasis.has(k.nach);
  
  
  
  const ohneKanten = new Set([...poiBasis.keys(), ...ortBasis.keys()]);
  const netzTag: Kandidatennetz = verbindeTeilnetze(
    { knoten: netzRoh.knoten, kanten: netzRoh.kanten.filter(kanteErlaubt) },
    {
      revier, maxStundenProTag: planung.maxStundenProTag, kuestenlinien: kueste ?? [], erlaubt: kanteErlaubt,
      ausgeschlossen: ohneKanten,
    },
  );
  
  
  const nachtfahrtBudget = (anfrage.nachtVorgaben ?? nachtVorgabenAus(planung)).nachtfahrtBudget;
  
  const netz: Kandidatennetz = kantenOhneVtg(nachtfahrtBudget > 0
    ? ergaenzeNachtkanten(netzTag, {
      revier, maxStundenProTag: planung.maxStundenProTag, kuestenlinien: kueste ?? [], erlaubt: kanteErlaubt,
      ausgeschlossen: ohneKanten, immer: new Set(pflichtKnoten.map((_, i) => i)),
    })
    : netzTag, kueste ?? []);
  
  
  
  const einklarierAufschlag = planung.grenzuebertritt === 'wenn noetig'
    ? einklarierStunden(planung.maxStundenProTag) * SCORE_PRO_FAHRTSTUNDE : 0;
  const mitEinklarieren = <T extends { score: number }>(kanteIndex: number, b: T): T =>
    einklarierAufschlag > 0 && quertGrenze(netz.kanten[kanteIndex]!) ? { ...b, score: b.score + einklarierAufschlag } : b;

  const startDatum = new Date(`${anfrage.startDatumIso}T00:00:00`);
  
  
  const datumFuerTag = (tag: number): Date =>
    new Date(startDatum.getFullYear(), startDatum.getMonth(), startDatum.getDate() + tag - 1);

  
  
  
  const alsDatumStr = (d: Date): string => {
    const p2 = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  };
  const datumFuer = (tag: number): string => alsDatumStr(datumFuerTag(tag));
  const planTage = Array.from({ length: anfrage.gesamtFahrtage }, (_, i) => alsDatumStr(datumFuerTag(i + 1)));
  melde({ art: 'fortschritt', phase: 'haefen', schritt: 'ensemble' });
  const modellJeTag = await gemerkt(speicher, 'ensemble', { start: anfrage.start.ort, planTage },
    () => holeModellUebereinstimmung(anfrage.start.ort, planTage));

  
  
  
  
  
  
  const inselJeKnoten = new Map(netz.knoten.map((k, i) => [i, inselJeOrt.get(ortSchluessel(k.ort)) ?? []] as const));

  
  
  
  
  
  
  
  
  
  
  const gitterBox = netzRechteck(netz, GITTER_RAND_GRAD);
  melde({ art: 'fortschritt', phase: 'haefen', schritt: 'gitter' });
  
  
  
  
  
  
  
  const gitterPunkte = (s: number): number =>
    (Math.floor((gitterBox.neLat - gitterBox.swLat) / s) + 2) * (Math.floor((gitterBox.neLon - gitterBox.swLon) / s) + 2);
  const gitterSchritt = [0.25, 0.5, 1].find((s) => gitterPunkte(s) <= 400) ?? 1;
  const gitter = await gemerkt(speicher, 'gitter', { gitterBox, gitterSchritt }, async () => {
    const g = await holeWindgitter(gitterBox, gitterSchritt);
    if (!g) throw new Error('kein Windgitter');
    return g;
  }).catch(() => null);
  
  
  melde({ art: 'fortschritt', phase: 'haefen', schritt: 'netz', knoten: netz.knoten.length, kanten: netz.kanten.length, zeitbudgetMs });

  const nachtVorgaben = anfrage.nachtVorgaben ?? nachtVorgabenAus(planung);
  const raender = {
    uebernahme: anfrage.uebernahmeIso ? nDate(anfrage.uebernahmeIso) : null,
    rueckgabe: anfrage.rueckgabeIso ? nDate(anfrage.rueckgabeIso) : null,
  };
  const laufSpeicher = speicher ?? neuerKostenkartenSpeicher();
  const befuelle = (
    teilnetz: Kandidatennetz, mitGitter: boolean, phase: 'wetter' | 'nachrechnen',
    vorgaben: NachtVorgaben = nachtVorgaben, abbruch: () => boolean = budgetErreicht,
  ) => befuelleKostenkarte(
    teilnetz, anfrage.gesamtFahrtage, startDatum, anfrage.cfg, planung.grenzwerte, 'buergerlich', 30, 1,
    anfrage.sprache, kueste, vorgaben, new Date(), raender, modellJeTag, inselJeKnoten,
    
    (erledigt, gesamt, was) => melde(was === 'tageslicht'
      ? { art: 'fortschritt', phase: 'haefen', schritt: 'tageslicht', erledigt, gesamt }
      : { art: 'fortschritt', phase, erledigt, gesamt }),
    
    
    laufSpeicher, mitGitter ? gitter : null,
    { kreuzen: planung.kreuzen, motoren: planung.motoren },
    abbruch, zeitbudgetMs,
  );
  const { kosten: kostenStufe1, bericht: kartenBericht, vorherrschenderWindDeg, windproben } = await befuelle(netz, true, 'wetter');
  
  
  const liegeschutz = liegeschutzJeOrtUndTag(
    netz, gitter, kueste, inselJeKnoten, startDatum,
    Array.from({ length: anfrage.gesamtFahrtage }, (_, i) => i + 1),
  );
  const bericht = {
    ...(kueste == null
      ? { ...kartenBericht, kuesteUnbekannt: true as const }
      : kuesteRueckfall
        ? { ...kartenBericht, kuesteRueckfall: true as const }
        : kartenBericht),
    ...(kandidatenGedeckelt ? { kandidatenGedeckelt } : {}),
    ...(haefenNurTeilpaket ? { haefenTeilpaket: true as const } : {}),
    ...(haefenUnbekannt ? { haefenUnbekannt: true as const } : {}),
  };
  
  const ohneHaefenHinweis = (b: typeof bericht): typeof bericht => {
    const rest = { ...b };
    delete rest.haefenUnbekannt;
    return rest;
  };
  
  
  
  
  
  const ueberStunden = (b: EtappenBewertung): boolean =>
    b.regime === 'gerechnet' && b.kennzahlen.totalHrs != null
    && b.kennzahlen.totalHrs > (b.istNachtschlag ? NACHTSCHLAG_MAX_STUNDEN : planung.maxStundenProTag);
  const kosten = new Map([...kostenStufe1]
    .filter(([, b]) => !ueberStunden(b))
    .map(([schluessel, b]) => [schluessel, mitEinklarieren(Number(schluessel.split(':')[0]), b)] as const));
  melde({ art: 'fortschritt', phase: 'suche' });
  
  
  
  
  if (bericht.kanten > 0 && bericht.fehlgeschlagen === bericht.kanten) {
    const kontingent = openMeteoKontingentErschoepft();
    return {
      lage: 'keinPlanGefunden',
      grund: { art: 'keinWetter', ohneWetter: bericht.fehlgeschlagen, kanten: bericht.kanten, ...(kontingent ? { kontingent } : {}) },
      bericht,
    };
  }

  
  
  
  
  
  
  
  
  
  
  
  
  
  const reserve = planung.reserveTage + planung.freieRuhetage;
  
  
  
  
  
  
  
  
  
  const nachtTage = nachtBonusTage(nachtfahrtBudget, planung.maxStundenProTag);
  
  const baueErreichbar = (reserveTage: number, stunden = planung.maxStundenProTag, bonusTage = nachtTage) => {
  const reichweiteTag0 = new Map<string, number>();
  return (knotenIndex: number, tag: number, offeneIndizes: readonly number[]): boolean => {
    
    
    
    
    if (anfrage.ohneUmkehrpunkt) return true;
    const knoten = netz.knoten[knotenIndex];
    if (!knoten) return false;
    const schluessel = `${knotenIndex}|${offeneIndizes.join(',')}`;
    let r0 = reichweiteTag0.get(schluessel);
    if (r0 == null) {
      const offeneWunschziele = offeneIndizes.map((i) => wunschzielJeKnoten.get(i)!);
      
      
      r0 = reichweiteAmTag(
        knoten.ort, 0, anfrage.gesamtFahrtage, zielOrt, offeneWunschziele, revier,
        stunden, reserveTage,
      ) + bonusTage;
      reichweiteTag0.set(schluessel, r0);
    }
    return r0 - tag >= 0;
  };
  };
  const erreichbar = baueErreichbar(reserve);

  
  
  
  
  const pflichtIndizesJeOption = wunschzielIndizesJeOption(optionEingaben);
  const ruhetagKnoten = [
    ...(anfrage.ruhetagIndizes ?? []).map((i) => pflichtIndizesJeOption[0]?.[i]),
    ...(anfrage.zweiteOptionRuhetagIndizes ?? []).map((i) => pflichtIndizesJeOption[1]?.[i]),
  ].filter((k): k is number => k != null);
  
  
  
  
  const wunschzielKnotenJeOption = pflichtIndizesJeOption.map((liste) =>
    [...new Set(liste.map((k) => poiBasis.get(k) ?? ortBasis.get(k) ?? k))]);

  
  
  const ersterTagFrei = anfrage.uebernahmeIso != null
    && Number(anfrage.uebernahmeIso.slice(11, 13)) >= UEBERNAHME_SPAET_AB_UHR;
  const eingabeBasis = {
    netz, startIndex: 0, zielIndex, gesamtFahrtage: anfrage.gesamtFahrtage,
    kosten, kBeste: K_BESTE, erreichbar, datumFuerTag,
    
    
    nachtfahrtBudget,
    ruhetagKnoten,
    pflichtOrte,
    ersterTagFrei,
    liegeschutz,
    
    saatplaene: saatVorschlaege
      .map((v) => bildeKetteAufNetzAb(v, netz.knoten)?.knotenIndizes)
      .filter((k): k is number[] => k != null),
  };
  
  
  
  
  const umkehrlinie = (
    ergebnis: WochenplanErgebnis, wunschzielKnoten: readonly number[],
  ): UmkehrpunktErgebnis | null => {
    if (anfrage.ohneUmkehrpunkt) return null; 
    return umkehrpunkt(
      baueTrajektorie(ergebnis, netz, 0, wunschzielKnoten, wunschzielJeKnoten),
      zielOrt, anfrage.gesamtFahrtage, revier, planung.maxStundenProTag, reserve,
    );
  };
  
  
  const reihungsKontext: ReihungsKontext = {
    ...baueReihungsKontext(netz, anfrage.start.ort, anfrage.gesamtFahrtage, vorherrschenderWindDeg, rueckgabehafen != null, zielOrt),
    regelmassSm: planung.regelmassSm,
    
    
    ...(anfrage.offenesEnde ? { ankunftsTag: (plan: WochenplanErgebnis) => plan.etappen[plan.etappen.length - 1]?.tag ?? null } : {}),
    
    
    ueberzaehligeHafentage: (plan: WochenplanErgebnis) => zaehleUeberzaehligeHafentage(
      plan.etappen, planung.freieRuhetage + anfrage.wunschziele.filter((w) => w.art === 'ruhetag').length, ersterTagFrei,
    ),
    
    tageAmHeimathafen: (plan: WochenplanErgebnis) => zaehleTageAmHeimathafen(
      plan.etappen.map((e) => ({ tag: e.tag, ort: netz.knoten[e.nachIndex]!.ort })),
      [anfrage.start.ort, zielOrt], anfrage.gesamtFahrtage, ersterTagFrei,
    ),
    
    
    
    
    
    ...(planung.buchtenBevorzugt ? {
      naechteOhneBucht: (plan: WochenplanErgebnis) => plan.etappen.filter(
        (e) => !e.istNachtschlag && netz.knoten[e.nachIndex]?.art !== 'bucht',
      ).length,
    } : {}),
  };

  const rechneOptionen = (): OptionErgebnis[] => optionEingaben.map(
    (option, i) => rechneEineOption(
      option, wunschzielKnotenJeOption[i]!, eingabeBasis, umkehrlinie, praeferenzenAus(planung),
      reihungsKontext, planung.langeTage === 'wenn noetig' ? planung.regelmassSm : null,
      planung.freieRuhetage + optionEingaben[i]!.wunschziele.filter((w) => w.art === 'ruhetag').length,
      planung.regelmassSm,
    ),
  );
  let optionErgebnisse = rechneOptionen();

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  if (gitter && !budgetErreicht()) {
    const bestaetigt = new Set<number>();
    const rechneNach = async (kanten: number[]): Promise<boolean> => {
      const teilnetz: Kandidatennetz = { knoten: netz.knoten, kanten: kanten.map((k) => netz.kanten[k]!) };
      const { kosten: punktKosten, ausgaenge } = await befuelle(teilnetz, false, 'nachrechnen');
      let geaendert = false;
      kanten.forEach((k, i) => {
        bestaetigt.add(k);
        if (ausgaenge[i] === 'fehlgeschlagen') return;
        for (let t = 1; t <= anfrage.gesamtFahrtage; t++) {
          const neu = punktKosten.get(kostenSchluessel(i, t));
          const alt = kosten.get(kostenSchluessel(k, t));
          
          
          if (alt?.regime === 'geruest' || neu?.regime === 'geruest') continue;
          if (neu && !ueberStunden(neu)) kosten.set(kostenSchluessel(k, t), mitEinklarieren(k, neu));
          else if (alt) { kosten.delete(kostenSchluessel(k, t)); geaendert = true; }
        }
      });
      return geaendert;
    };
    let geaendert = true;
    for (let runde = 0; runde < STUFE2_RUNDEN && geaendert && !budgetErreicht(); runde++) {
      const offen = [...new Set(optionErgebnisse.flatMap((o) => (o.ergebnis?.etappen ?? [])
        .filter((e) => !e.istHafentag)
        .map((e) => kanteZu(netz, e.vonIndex, e.nachIndex))
        .filter((k): k is number => k != null && !bestaetigt.has(k))))];
      if (offen.length === 0) { geaendert = false; break; }
      geaendert = await rechneNach(offen);
      if (geaendert) optionErgebnisse = rechneOptionen();
    }
    if (geaendert) {
      const uebrige = netz.kanten.map((_, k) => k).filter((k) => !bestaetigt.has(k));
      
      if (uebrige.length > 0 && uebrige.length <= STUFE2_REST_MAX && !budgetErreicht()) {
        await rechneNach(uebrige);
        optionErgebnisse = rechneOptionen();
      } else if (uebrige.length > 0) {
        Object.assign(bericht, { nachrechnungUebersprungen: true as const });
      }
    }
  } else if (gitter) {
    Object.assign(bericht, { nachrechnungUebersprungen: true as const });
  }

  
  
  
  
  
  
  
  
  
  
  let fixierungBricht = false;
  if (!optionErgebnisse.some((o) => o.ergebnis !== null) && fixierungen.length > 0 && !anfrage.ohneUmkehrpunkt) {
    const ohneFilter = { ...eingabeBasis, erreichbar: () => true };
    const versuch = optionEingaben.map((option, i) => rechneEineOption(
      option, wunschzielKnotenJeOption[i]!, ohneFilter, umkehrlinie, praeferenzenAus(planung),
      reihungsKontext, planung.langeTage === 'wenn noetig' ? planung.regelmassSm : null,
      planung.freieRuhetage + optionEingaben[i]!.wunschziele.filter((w) => w.art === 'ruhetag').length,
      planung.regelmassSm,
    ));
    if (versuch.some((o) => o.ergebnis !== null)) {
      fixierungBricht = true;
      optionErgebnisse = versuch.map((o) => ({
        ...o, umkehrpunkt: o.umkehrpunkt ? { ...o.umkehrpunkt, gueltig: false } : o.umkehrpunkt,
      }));
    }
  }

  
  
  
  
  
  
  
  
  
  type Probe = { netz: Kandidatennetz; nacht: Map<string, EtappenBewertung>; lang: Map<string, EtappenBewertung> };
  let probe: Promise<Probe> | null = null;
  const holeProbe = (): Promise<Probe> => (probe ??= (async (): Promise<Probe> => {
    const opt = {
      revier, maxStundenProTag: planung.maxStundenProTag, kuestenlinien: kueste ?? [], erlaubt: kanteErlaubt, ausgeschlossen: ohneKanten,
      immer: new Set(pflichtKnoten.map((_, i) => i)),
    };
    const mitNacht = nachtfahrtBudget < PROBE_NAECHTE ? ergaenzeNachtkanten(netz, opt) : netz;
    const erweitert = kantenOhneVtg(planung.maxStundenProTag < LANGE_TAGE_MAX_STUNDEN
      ? ergaenzeNachtkanten(mitNacht, { ...opt, art: 'lang', bisStunden: LANGE_TAGE_MAX_STUNDEN }) : mitNacht, kueste ?? []);
    const frist = Date.now() + PROBE_BUDGET_MS;
    const rechneTeil = async (art: 'nacht' | 'lang', vorgaben: NachtVorgaben): Promise<Map<string, EtappenBewertung>> => {
      const indizes = erweitert.kanten
        .map((k, i) => (i >= netz.kanten.length && (art === 'nacht' ? k.nacht : k.lang) ? i : -1))
        .filter((i) => i >= 0);
      const out = new Map<string, EtappenBewertung>();
      if (indizes.length === 0) return out;
      const { kosten: teil } = await befuelle(
        { knoten: netz.knoten, kanten: indizes.map((i) => erweitert.kanten[i]!) }, true, 'nachrechnen', vorgaben,
        () => Date.now() >= frist,
      );
      const grenzKosten = planung.grenzuebertritt === 'wenn noetig' ? einklarierAufschlag : 0;
      indizes.forEach((k, i) => {
        const kante = erweitert.kanten[k]!;
        for (let t = 1; t <= anfrage.gesamtFahrtage; t++) {
          const b = teil.get(kostenSchluessel(i, t));
          if (b) out.set(kostenSchluessel(k, t), grenzKosten > 0 && quertGrenze(kante) ? { ...b, score: b.score + grenzKosten } : b);
        }
      });
      return out;
    };
    const nacht = await rechneTeil('nacht', { ...nachtVorgaben, nachtfahrtBudget: PROBE_NAECHTE });
    const lang = await rechneTeil('lang', { ...nachtVorgaben, nachtfahrtBudget: 0, ablegenBeiDunkelheit: 'gern' });
    return { netz: erweitert, nacht, lang };
  })());
  
  const probeKosten = (p: Probe, stunden: number, mitNacht: boolean): Map<string, EtappenBewertung> => {
    const passt = (b: EtappenBewertung): boolean => b.kennzahlen.totalHrs == null
      || b.kennzahlen.totalHrs <= (b.istNachtschlag ? NACHTSCHLAG_MAX_STUNDEN : stunden);
    const out = new Map(kosten);
    if (stunden > planung.maxStundenProTag) {
      for (const [s, b] of kostenStufe1) {
        if (!out.has(s) && b.regime === 'gerechnet' && !b.istNachtschlag && passt(b)) out.set(s, mitEinklarieren(Number(s.split(':')[0]), b));
      }
      
      for (const m of [p.lang, p.nacht]) for (const [s, b] of m) if (!b.istNachtschlag && passt(b)) out.set(s, b);
    }
    if (mitNacht) for (const [s, b] of p.nacht) if (b.istNachtschlag && passt(b)) out.set(s, b);
    return out;
  };

  const keinPlanGrund = async (pflichtIndizes: readonly number[], lockerIndex: number): Promise<KeinPlanGrund> => {
    const grundErmittelt = ermittleKeinPlanGrund(netz, kosten, bericht, anfrage.gesamtFahrtage, pflichtIndizes);
    
    
    const grundRoh: KeinPlanGrund = grundErmittelt.art === 'keineKandidaten' && haefenUnbekannt
      ? { art: 'keineHaefenGeladen' } : grundErmittelt;
    
    const kontingent = grundRoh.art === 'keinWetter' ? openMeteoKontingentErschoepft() : null;
    const grund = kontingent && grundRoh.art === 'keinWetter' ? { ...grundRoh, kontingent } : grundRoh;
    
    
    
    
    
    
    if (grund.art === 'unklar' || grund.art === 'zielUnerreichbar' || grund.art === 'zielOhneZufahrt') {
      const option = optionEingaben[lockerIndex]!;
      const wz = wunschzielKnotenJeOption[lockerIndex]!;
      const mindest = planung.freieRuhetage + option.wunschziele.filter((w) => w.art === 'ruhetag').length;
      const geht = (basis: typeof eingabeBasis, knoten: readonly number[], mindestHafentage: number) => rechneEineOption(
        option, knoten, basis, () => null, praeferenzenAus(planung), reihungsKontext, null, mindestHafentage,
        planung.regelmassSm,
      ).ergebnis !== null;
      let lockerung: Lockerung = { art: 'keine', stunden: planung.maxStundenProTag };
      
      const staerker = async (): Promise<Lockerung | null> => {
        const p = await holeProbe();
        const basis = (stunden: number, naechte: number, kostenkarte: Map<string, EtappenBewertung>): typeof eingabeBasis => ({
          ...eingabeBasis, netz: p.netz, kosten: kostenkarte, nachtfahrtBudget: naechte,
          erreichbar: baueErreichbar(reserve, stunden, nachtBonusTage(naechte, stunden)),
        });
        const plan = (b: typeof eingabeBasis) => rechneEineOption(
          option, wz, b, () => null, praeferenzenAus(planung), reihungsKontext, null, mindest, planung.regelmassSm,
        ).ergebnis;
        let naechte: number | undefined;
        if (p.nacht.size > 0) {
          const k = probeKosten(p, planung.maxStundenProTag, true);
          for (let n = nachtfahrtBudget + 1; n <= PROBE_NAECHTE && naechte == null; n++) {
            const e = plan(basis(planung.maxStundenProTag, n, k));
            if (e) naechte = e.etappen.filter((x) => x.istNachtschlag).length || n;
          }
        }
        let lang: { tage: number; stunden: number; dunkel: number } | undefined;
        for (let h = planung.maxStundenProTag + 1; h <= LANGE_TAGE_MAX_STUNDEN && !lang; h++) {
          const e = plan(basis(h, nachtfahrtBudget, probeKosten(p, h, false)));
          if (!e) continue;
          const lange = e.etappen.filter((x) => !x.istHafentag && !x.istNachtschlag && (x.kennzahlen.totalHrs ?? 0) > planung.maxStundenProTag);
          lang = { tage: Math.max(1, lange.length), stunden: h, dunkel: lange.filter((x) => x.kennzahlen.ablegenImDunkeln).length };
        }
        if (naechte == null && !lang) return null;
        return {
          art: 'staerker', ...(naechte != null ? { naechte } : {}),
          ...(lang ? {
            lang: {
              tage: lang.tage, stunden: lang.stunden, dunkelAblegen: lang.dunkel,
              ablegenErlaubt: istZulaessig(nachtVorgaben.ablegenBeiDunkelheit),
            },
          } : {}),
        };
      };
      if (grund.art !== 'unklar') {
        const mehr = await staerker();
        return mehr ? { ...grund, lockerung: mehr } : grund;
      }
      const ohneReserve = !anfrage.ohneUmkehrpunkt && reserve > 0 && geht({ ...eingabeBasis, erreichbar: baueErreichbar(0) }, wz, mindest);
      const mitMehr = ohneReserve ? null : await staerker();
      if (ohneReserve) {
        lockerung = { art: 'reserve', tage: planung.reserveTage, ruhetage: planung.freieRuhetage };
      } else if (mitMehr) {
        lockerung = mitMehr;
      } else if (mindest > 0 && geht(eingabeBasis, wz, 0)) {
        lockerung = { art: 'ruhetage', tage: mindest };
      } else if (!anfrage.ohneUmkehrpunkt && geht({ ...eingabeBasis, erreichbar: () => true }, wz, mindest)) {
        lockerung = { art: 'umkehrpunkt' };
      } else {
        
        
        
        
        const segelt = (knoten: readonly number[]) => rechneEineOption(
          option, knoten, eingabeBasis, () => null, praeferenzenAus(planung), reihungsKontext, null, mindest,
          planung.regelmassSm,
        ).ergebnis?.etappen.some((e) => !e.istHafentag) ?? false;
        for (const k of wz) {
          if (segelt(wz.filter((x) => x !== k))) {
            
            
            lockerung = { art: 'ohneWunsch', name: wunschzielJeKnoten.get(k)?.name ?? netz.knoten[k]?.name ?? '?' };
            break;
          }
        }
      }
      
      if (lockerung.art === 'keine' && planung.maxStundenProTag < LANGE_TAGE_MAX_STUNDEN) {
        lockerung = { ...lockerung, geprueftBis: LANGE_TAGE_MAX_STUNDEN, geprueftNaechte: Math.max(nachtfahrtBudget, PROBE_NAECHTE) };
      }
      return { ...grund, lockerung };
    }
    return grund;
  };

  
  
  
  
  
  
  const grenzen = planung.grenzwerte;
  const ueberGrenze = (s: { maxWindKn: number; maxGustKn: number } | undefined): boolean =>
    s != null && (s.maxWindKn >= grenzen.mean || s.maxGustKn >= grenzen.gust);
  const wetterTage = [...new Set([...liegeschutz].filter(([, s]) => ueberGrenze(s)).map(([k]) => Number(k.split('|')[1])))]
    .sort((a, b) => a - b);
  let abwetterOhneWunsch: { wuensche: string[]; tage: number[] } | null = null;
  if (!optionErgebnisse.some((o) => o.ergebnis !== null) && wetterTage.length > 0) {
    const option = optionEingaben[0]!, wz = wunschzielKnotenJeOption[0]!;
    const versuche = [...wz.map((k) => [k]), ...(wz.length > 1 ? [[...wz]] : [])];
    for (const weg of versuche) {
      const rest = wz.filter((x) => !weg.includes(x));
      const mindest = planung.freieRuhetage + option.wunschziele.filter((w, i) => w.art === 'ruhetag' && !weg.includes(wz[i]!)).length;
      const versuch = rechneEineOption(
        option, rest, eingabeBasis, umkehrlinie, praeferenzenAus(planung), reihungsKontext,
        planung.langeTage === 'wenn noetig' ? planung.regelmassSm : null, mindest, planung.regelmassSm,
      );
      if (!versuch.ergebnis?.etappen.some((e) => !e.istHafentag)) continue;
      optionErgebnisse = [versuch, ...optionErgebnisse.slice(1)];
      abwetterOhneWunsch = {
        wuensche: weg.map((k) => wunschzielJeKnoten.get(k)?.name ?? netz.knoten[k]?.name ?? '?'), tage: wetterTage,
      };
      break;
    }
  }

  const primaer = optionErgebnisse.find((o) => o.ergebnis !== null);
  if (!primaer?.ergebnis) {
    
    
    
    const grund = await keinPlanGrund(wunschzielKnotenJeOption.flat(), 0);
    return { lage: 'keinPlanGefunden', grund, bericht: grund.art === 'keineHaefenGeladen' ? ohneHaefenHinweis(bericht) : bericht };
  }
  
  
  
  if (haefenUnbekannt && !primaer.ergebnis.etappen.some((e) => !e.istHafentag)) {
    return { lage: 'keinPlanGefunden', grund: { art: 'keineHaefenGeladen' }, bericht: ohneHaefenHinweis(bericht) };
  }
  
  optionErgebnisse = await Promise.all(optionErgebnisse.map(async (o, i) => (o.ergebnis !== null ? o
    : { ...o, keinPlanGrund: await keinPlanGrund(wunschzielKnotenJeOption[i]!, i) })));

  const grenzuebertritte = primaer.ergebnis.etappen
    .filter((e) => !e.istHafentag && istKlarierGrenze(staaten[e.vonIndex] ?? null, staaten[e.nachIndex] ?? null))
    .map((e) => ({ tag: e.tag, vonName: netz.knoten[e.vonIndex]!.name, nachName: netz.knoten[e.nachIndex]!.name }));
  const grenzFeld = grenzuebertritte.length > 0 ? { grenzuebertritte } : {};
  
  
  
  const angelaufen = new Set(optionErgebnisse.flatMap((o) => (o.ergebnis?.etappen ?? []).flatMap((e) => [e.vonIndex, e.nachIndex])));
  const skipperGuide = [...angelaufen].flatMap((i) => {
    const k = netz.knoten[i]!;
    let bestes: SkipperGuideZitat | null = null, besteSm = SKIPPERGUIDE_ZITAT_SM;
    for (const z of zitate) {
      const sm = distNM(k.ort.lat, k.ort.lon, z.ort.lat, z.ort.lon);
      if (sm <= besteSm) { bestes = z; besteSm = sm; }
    }
    return bestes ? [{ knotenIndex: i, ...bestes }] : [];
  });
  if (skipperGuide.length > 0) Object.assign(grenzFeld, { skipperGuide });
  if (fixierungBricht) Object.assign(grenzFeld, { fixierungBrichtUmkehrpunkt: true });
  
  
  
  
  
  
  
  const poiBasen = await parallelMitGrenze(NEBENLAEUFIGE_ABRUFE, [...poiBasis].map(([poi, basis]) => async () => {
    const etappen = primaer.ergebnis!.etappen;
    const tag = etappen.find((e) => e.istHafentag && e.vonIndex === basis)?.tag
      ?? etappen.find((e) => !e.istHafentag && e.nachIndex === basis)?.tag ?? null;
    const p = netz.knoten[poi]!.ort, b = netz.knoten[basis!]!.ort;
    const datum = tag != null ? datumFuer(tag) : null;
    const wetter = datum && gitter ? abstecherWetter(windAmPunkt(gitter.gitter, p), datum) : null;
    const treffer = await holeOeffnungszeitenNaheOrt(p);
    const urteil = treffer && datum ? poiOeffnungszeitenUrteil(treffer.tagRoh, datum) : null;
    return {
      poi: netz.knoten[poi]!.name, basis: netz.knoten[basis!]!.name, tag,
      smJeWeg: distNM(b.lat, b.lon, p.lat, p.lon), wetter,
      ...(urteil ? { oeffnungszeiten: { quelle: treffer!.name, urteil } } : {}),
    };
  }));
  if (poiBasen.length > 0) Object.assign(grenzFeld, { poiBasen });
  if (zufahrtErsatz.length > 0) Object.assign(grenzFeld, { zufahrtErsatz });
  
  
  const wetterHafentage = primaer.ergebnis.etappen.filter((e) => e.istHafentag && wetterTage.includes(e.tag)
    && !netz.kanten.some((k, i) => k.von === e.nachIndex && kosten.has(kostenSchluessel(i, e.tag))))
    .map((e) => {
      const s = liegeschutz.get(`${e.nachIndex}|${e.tag}`);
      const schutz: 'revier' | 'geschuetzt' | 'teilweise' | 'offen' | null = s?.revierSchutzhafen ? 'revier'
        : s?.schutzWellenanlaufNM != null ? schutzStufe(s.schutzWellenanlaufNM) : null;
      return {
        tag: e.tag, ort: netz.knoten[e.nachIndex]!.name,
        windKn: s ? Math.round(s.maxWindKn) : null, boeKn: s ? Math.round(s.maxGustKn) : null,
        windDeg: s ? Math.round(s.windDeg) : null, schutz,
      };
    });
  if (wetterHafentage.length > 0) Object.assign(grenzFeld, { wetterHafentage });
  if (abwetterOhneWunsch) Object.assign(grenzFeld, { abwetterOhneWunsch });

  if (!anfrage.zweiteOption) {
    return {
      lage: 'gefunden', ergebnis: primaer.ergebnis, netz, reihenfolge: primaer.reihenfolge,
      begruendung: primaer.begruendung!, bericht, umkehrpunkt: primaer.umkehrpunkt, ...grenzFeld,
    };
  }
  
  const optionenFuerVergleich: Option[] = optionErgebnisse.map((o) => ({ name: o.name, plan: o.ergebnis }));
  
  
  const alsEmpfehlungsEtappen = (plan: WochenplanErgebnis | null): EmpfehlungsEtappe[] | null => plan?.etappen.map((e) => {
    const von = netz.knoten[e.vonIndex]!.ort, nach = netz.knoten[e.nachIndex]!.ort;
    return {
      tag: e.tag, kursDeg: bearingDeg(von.lat, von.lon, nach.lat, nach.lon), sm: e.sm, istHafentag: e.istHafentag,
      regime: e.regime, totalHrs: e.kennzahlen.totalHrs, motorShareAnteil: e.kennzahlen.motorShareAnteil,
    };
  }) ?? null;
  const empfehlung = empfehleOption(
    alsEmpfehlungsEtappen(optionErgebnisse[0]!.ergebnis), alsEmpfehlungsEtappen(optionErgebnisse[1]!.ergebnis),
    heimwindAus(windproben, anfrage.startDatumIso, anfrage.gesamtFahrtage, WINDPROBEN_SCHRITT_H),
    anfrage.gesamtFahrtage, rueckgabehafen == null,
  );
  return {
    lage: 'gefunden', ergebnis: primaer.ergebnis, netz, reihenfolge: primaer.reihenfolge,
    begruendung: primaer.begruendung!, bericht, umkehrpunkt: primaer.umkehrpunkt, ...grenzFeld,
    optionen: optionErgebnisse,
    vergleich: {
      kennzahlen: kennzahlenJeOption(optionenFuerVergleich),
      entscheidungspunkt: entscheidungspunkt(optionErgebnisse[0]!.ergebnis, optionErgebnisse[1]!.ergebnis),
      empfehlung,
    },
  };
}
