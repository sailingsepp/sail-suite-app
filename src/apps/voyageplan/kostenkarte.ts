
import { sampleRoute, bearingDeg } from '@/core/geo';
import { berechneTagesfenster, type Tagesfenster } from '@/core/tagesfenster';
import {
  istZulaessig, anlegenBeiDunkelheitErlaubt, VORGABEN_5_1, type NachtVorgaben, type Bereitschaft,
} from '@/core/bereitschaft';
import { polarSpeed } from '@/core/polar';
import { SCORE_PRO_FAHRTSTUNDE } from '@/core/evaluate';
import { istUnfahrbarToern, STURM_BOE, STURM_MITTEL } from '@/briefing/verdict';
import { anzeigeKn } from '@/briefing/wind';
import { guenstigGrenze } from '@/briefing/window';
import { MIN_WIND as REVIER_MIN_WIND } from '@/briefing/terrain';
import {
  lokalwindFuerEtappe, bedingungAktiv, zuschlagKn, wirktAlsAusschluss, wirktAlsSchutz,
} from '@/briefing/revierwirkung';
import {
  eintraegeFuerStrecke, eintraegeFuerName, eintraegeFuerPunkt, eintraegeFuerNahenPunkt,
} from '@/core/revierzonen';
import type { RevierwissenEintrag } from '@/core/revierwissen';
import { fetchWindForPoints, fetchDaylight } from '@/data/openMeteo';
import { GERECHNET_BIS_TAG, NORMALWIND_KN, NORMALWIND_TWA } from './konstanten';
import { nDate, nowInRevier, naiveIso } from '@/core/time';
import {
  kostenSchluessel, type Kostenkarte, type EtappenBewertung, type EtappenKennzahlen,
} from '@/core/wochenplan';
import { saisonLage } from '@/core/season';
import { luvFetchNM, type Kuestenlinie } from '@/core/shelter';
import { nachtfenster, nachtwindRichtung } from '@/core/nachtwind';
import { vorherrschendeWindrichtung, type Windprobe } from '@/core/ausrichtung';
import { windAmPunkt } from '@/core/windgitter';
import type { RevierwindErgebnis } from '@/data/revierwind';
import {
  BEWERTUNGSREGEL_VERSION, stabilerSchluessel, stundenSchluessel, gemerkt, type KostenkartenSpeicher,
} from './zwischenspeicher';
import { kantenWeg, type Hafenknoten, type Kandidatennetz } from '@/core/hafennetz';
import type {
  SchiffConfig, Grenzwerte, Sprache, AnkerplatzArt, StreckenPunkt, StundenWind, Tageslicht,
  Ablegezeit,
} from '@/core/types';
import type { Daemmerungsstufe } from '@/core/sun';


function kennzahlenOhneWetter(datum: Date): EtappenKennzahlen {
  return {
    totalHrs: null, vmgShareAnteil: null, motorShareAnteil: null, dunkelShareAnteil: null,
    maxWindKn: null, maxGustKn: null, maxHsM: null, schutzWellenanlaufNM: null,
    andrang: saisonLage(datum), modellUebereinstimmungProzent: null, revierSchutzhafen: false,
    ablegeZeitIso: null, lage: null,
  };
}


const MODELL_BLIND_MALUS_FAKTOR = 1.2;


export const WINDPROBEN_SCHRITT_H = 3;


export const NEBENLAEUFIGE_ABRUFE = 6;


export async function parallelMitGrenze<T>(
  grenze: number, aufgaben: readonly (() => Promise<T>)[],
): Promise<T[]> {
  const ergebnis = new Array<T>(aufgaben.length);
  let naechste = 0;
  const arbeiter = async (): Promise<void> => {
    for (;;) {
      const i = naechste++;
      if (i >= aufgaben.length) return;
      ergebnis[i] = await aufgaben[i]!();
    }
  };
  await Promise.all(Array.from(
    { length: Math.max(1, Math.min(grenze, aufgaben.length)) }, () => arbeiter(),
  ));
  return ergebnis;
}


export type KantenAusgang = 'gerechnet' | 'kein-fenster' | 'fehlgeschlagen' | 'nur-geruest';



export interface HarteBereitschaften {
  kreuzen: Bereitschaft;
  motoren: Bereitschaft;
}

export interface KostenkartenBericht {
  
  kanten: number;
  gerechnet: number;
  keinFenster: number;
  fehlgeschlagen: number;
  nurGeruest: number;
  
  kuesteUnbekannt?: true;
  
  zeitbudgetErreicht?: true;
  zeitbudgetMs?: number;
  uebersprungen?: number;
  
  kandidatenGedeckelt?: { vorher: number; behalten: number };
  
  nachrechnungUebersprungen?: true;
  
  kuesteRueckfall?: true;
  
  haefenTeilpaket?: true;
  
  haefenUnbekannt?: true;
}

export interface KostenkartenErgebnis {
  kosten: Kostenkarte;
  
  bericht: KostenkartenBericht;
  
  vorherrschenderWindDeg: number | null;
  
  windproben: readonly Windprobe[];
  
  ausgaenge: readonly KantenAusgang[];
}



export function nachtOderLangerTag(f: Tagesfenster, dateStr: string, nachtfahrtBudget: number): Tagesfenster {
  if (!f.istNachtschlag) return f;
  const amTag = f.results.filter((r) => r.arrival.toISOString().slice(0, 10) === dateStr);
  const nachts = f.results.filter((r) => r.arrival.toISOString().slice(0, 10) > dateStr);
  if (nachtfahrtBudget > 0 && nachts.length > 0) return { ...f, results: nachts, best: nachts[0]! };
  return { ...f, results: amTag, best: amTag[0] ?? null, istNachtschlag: false };
}

function legtImDunkelnAb(f: Tagesfenster, ablegen: Date): boolean {
  if (!f.hellVon || !f.hellBis) return false;
  return ablegen < f.hellVon || ablegen > f.hellBis;
}


function ankerplatzArtVon(knoten: { art: 'marina' | 'hafen' | 'bucht' }): AnkerplatzArt {
  if (knoten.art === 'marina') return 'marina';
  if (knoten.art === 'bucht') return 'bucht';
  return null;
}


export interface ToernRaender {
  
  uebernahme?: Date | null;
  
  rueckgabe?: Date | null;
}


function besteAblegezeit(f: Tagesfenster, spaetesteAnkunft: Date | null): Ablegezeit | null {
  if (!spaetesteAnkunft) return f.best;
  return f.results.find((r) => r.arrival <= spaetesteAnkunft) ?? null;
}


function zielortEintraege(
  knoten: Hafenknoten, inseln: readonly string[],
): RevierwissenEintrag[] {
  const alle = [
    ...eintraegeFuerName(knoten.name),
    ...inseln.flatMap((insel) => eintraegeFuerName(insel)),
    ...eintraegeFuerPunkt(knoten.ort.lat, knoten.ort.lon),
    ...eintraegeFuerNahenPunkt(knoten.ort.lat, knoten.ort.lon),
  ];
  return [...new Set(alle)];
}


export interface Liegeschutz {
  
  schutzWellenanlaufNM: number | null;
  
  revierSchutzhafen: boolean;
  
  maxWindKn: number;
  maxGustKn: number;
  
  windDeg: number;
}


const LIEGE_TAG_VON = 8, LIEGE_TAG_BIS = 20, LIEGE_NACHT_BIS = 7;


export function liegeschutzJeOrtUndTag(
  netz: Kandidatennetz, gitter: RevierwindErgebnis | null, kueste: Kuestenlinie | null,
  inselJeKnoten: ReadonlyMap<number, readonly string[]>, startDatum: Date, tage: readonly number[],
): Map<string, Liegeschutz> {
  const out = new Map<string, Liegeschutz>();
  if (!gitter) return out;
  netz.knoten.forEach((knoten, i) => {
    const hourly = windAmPunkt(gitter.gitter, knoten.ort);
    if (!hourly) return;
    const eintraege = zielortEintraege(knoten, inselJeKnoten.get(i) ?? []);
    for (const t of tage) {
      const datum = datumPlusTage(startDatum, t - 1);
      const tagStr = alsDatumStr(datum), folgeStr = alsDatumStr(datumPlusTage(startDatum, t));
      let maxWind = 0, maxGust = 0, gustFactor = 1, x = 0, y = 0, n = 0;
      hourly.time.forEach((zeit, h) => {
        if (!zeit.startsWith(tagStr)) return;
        const stunde = Number(zeit.slice(11, 13));
        if (stunde < LIEGE_TAG_VON || stunde > LIEGE_TAG_BIS) return;
        const v = hourly.wind_speed_10m[h]!, g = hourly.wind_gusts_10m[h]!, d = hourly.wind_direction_10m[h]!;
        maxWind = Math.max(maxWind, v); maxGust = Math.max(maxGust, g);
        if (v > 0) gustFactor = Math.max(gustFactor, g / v);
        x += v * Math.sin((d * Math.PI) / 180); y += v * Math.cos((d * Math.PI) / 180); n++;
      });
      if (n === 0) continue;
      const windDeg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
      const lokalwind = lokalwindFuerEtappe({
        avgWindDir: windDeg, maxWind, gustFactor, midLat: knoten.ort.lat, midLon: knoten.ort.lon,
        beatShare: 0, departure: nDate(`${tagStr}T12:00`),
      }, datum.getMonth() + 1);
      const nachtwind = nachtwindRichtung(hourly, {
        von: nDate(`${tagStr}T${String(LIEGE_TAG_BIS).padStart(2, '0')}:00`),
        bis: nDate(`${folgeStr}T${String(LIEGE_NACHT_BIS).padStart(2, '0')}:00`),
      });
      out.set(`${i}|${t}`, {
        schutzWellenanlaufNM: nachtwind == null || kueste == null ? null : luvFetchNM(knoten.ort, nachtwind, kueste),
        revierSchutzhafen: eintraege.some((e) => wirktAlsSchutz(e, lokalwind, maxWind)),
        maxWindKn: maxWind, maxGustKn: maxGust, windDeg,
      });
    }
  });
  return out;
}


export function zuschlagReisst(windKn: number, boeKn: number, limits: { mean: number; gust: number }): boolean {
  return anzeigeKn(windKn) >= STURM_MITTEL || anzeigeKn(boeKn) >= STURM_BOE || windKn > limits.mean || boeKn > limits.gust;
}

function datumPlusTage(basis: Date, tage: number): Date {
  return new Date(basis.getFullYear(), basis.getMonth(), basis.getDate() + tage);
}

function alsDatumStr(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}


export function kehreStrecke(punkte: readonly StreckenPunkt[]): StreckenPunkt[] {
  const gesamtSm = punkte[punkte.length - 1]?.cum ?? 0;
  const rueck: StreckenPunkt[] = punkte
    .map((p) => ({ lat: p.lat, lon: p.lon, cum: gesamtSm - p.cum, course: p.course }))
    .reverse();
  for (let i = 0; i < rueck.length - 1; i++) {
    rueck[i]!.course = bearingDeg(rueck[i]!.lat, rueck[i]!.lon, rueck[i + 1]!.lat, rueck[i + 1]!.lon);
  }
  if (rueck.length >= 2) rueck[rueck.length - 1]!.course = rueck[rueck.length - 2]!.course;
  return rueck;
}


interface Knotenpaar {
  
  a: number;
  b: number;
  
  kanten: { index: number; vorwaerts: boolean }[];
}


function ungerichtetePaare(netz: Kandidatennetz): Knotenpaar[] {
  const paare = new Map<string, Knotenpaar>();
  netz.kanten.forEach((kante, index) => {
    const a = Math.min(kante.von, kante.nach), b = Math.max(kante.von, kante.nach);
    const schluessel = `${a}-${b}`;
    let paar = paare.get(schluessel);
    if (!paar) {
      paar = { a, b, kanten: [] };
      paare.set(schluessel, paar);
    }
    paar.kanten.push({ index, vorwaerts: kante.von === a });
  });
  return [...paare.values()];
}


interface Lauf {
  netz: Kandidatennetz;
  kosten: Map<string, EtappenBewertung>;
  gerechneteTage: readonly number[];
  gesamtFahrtage: number;
  modellJeTag: ReadonlyMap<string, number>;
  inselJeKnoten: ReadonlyMap<number, readonly string[]>;
  
  windproben: Windprobe[];
  speicher: KostenkartenSpeicher | null;
  gitter: RevierwindErgebnis | null;
  
  harteBereitschaften: HarteBereitschaften;
  raender: ToernRaender;
  startDatum: Date;
  cfg: SchiffConfig;
  limits: Grenzwerte;
  daemmerung: Daemmerungsstufe;
  stepMin: number;
  sprache: Sprache;
  
  kueste: Kuestenlinie | null;
  vorgaben: NachtVorgaben;
  tageslichtJeKnoten: ReadonlyMap<number, Tageslicht>;
}


interface Streckenwetter {
  
  schluessel: string;
  punkte: StreckenPunkt[];
  windData: StundenWind[];
  utcOffsetSeconds: number;
  forecastEnd: Date;
}


function rechneKante(
  lauf: Lauf, kanteIndex: number, von: Hafenknoten, nach: Hafenknoten, nachIndex: number,
  wetter: Streckenwetter, daylight: Tageslicht,
): KantenAusgang {
  const { punkte, windData, utcOffsetSeconds, forecastEnd } = wetter;
  const jetzt = nowInRevier(utcOffsetSeconds);
  let eingetragen = 0;

  
  
  
  
  const streckeEintraege = eintraegeFuerStrecke(von.name, nach.name);
  const zielEintraege = zielortEintraege(nach, lauf.inselJeKnoten.get(nachIndex) ?? []);
  const crewZumutbarkeitProzent = lauf.cfg.crewZumutbarkeit != null ? lauf.cfg.crewZumutbarkeit * 100 : null;

  for (const t of lauf.gerechneteTage) {
    const datum = datumPlusTage(lauf.startDatum, t - 1);
    const dateStr = alsDatumStr(datum);

    
    
    
    
    const bewertungSchluessel = lauf.speicher ? stabilerSchluessel({
      v: BEWERTUNGSREGEL_VERSION, wetter: wetter.schluessel, dateStr,
      von: [von.name, von.ort], nach: [nach.name, nach.ort, nach.art],
      inseln: lauf.inselJeKnoten.get(nachIndex) ?? [], modell: lauf.modellJeTag.get(dateStr) ?? null,
      cfg: lauf.cfg, limits: lauf.limits, vorgaben: lauf.vorgaben, harte: lauf.harteBereitschaften,
      daemmerung: lauf.daemmerung, stepMin: lauf.stepMin,
      uebernahme: t === 1 ? lauf.raender.uebernahme ?? null : null,
      rueckgabe: t >= lauf.gesamtFahrtage - 1 ? lauf.raender.rueckgabe ?? null : null,
      kueste: lauf.kueste?.length ?? null,
    }) : null;
    if (bewertungSchluessel && lauf.speicher!.bewertung.hat(bewertungSchluessel)) {
      const gemerkt = lauf.speicher!.bewertung.hole(bewertungSchluessel) ?? null;
      if (gemerkt) { lauf.kosten.set(kostenSchluessel(kanteIndex, t), gemerkt); eingetragen++; }
      continue;
    }
    
    
    
    const merkeKeine = (): void => { if (bewertungSchluessel) lauf.speicher!.bewertung.lege(bewertungSchluessel, null); };
    
    
    
    
    const uebernahme = lauf.raender.uebernahme;
    const jetztHier = t === 1 && uebernahme && uebernahme > jetzt ? uebernahme : jetzt;
    const f = nachtOderLangerTag(berechneTagesfenster(
      dateStr, lauf.daemmerung, lauf.stepMin, punkte[0]!, punkte, windData, null, lauf.cfg, lauf.limits,
      daylight, utcOffsetSeconds, forecastEnd, jetztHier, lauf.sprache,
    ), dateStr, lauf.vorgaben.nachtfahrtBudget);
    
    
    
    const gegenRueckgabe = t === lauf.gesamtFahrtage || (f.istNachtschlag && t === lauf.gesamtFahrtage - 1);
    const b = besteAblegezeit(f, gegenRueckgabe ? lauf.raender.rueckgabe ?? null : null);
    
    if (!b || istUnfahrbarToern(b)) { merkeKeine(); continue; } 
    
    
    
    
    
    
    if (lauf.harteBereitschaften.kreuzen === 'nie' && b.beatShare > 0) { merkeKeine(); continue; }
    if (lauf.harteBereitschaften.motoren === 'nie' && b.motorShare > 0) { merkeKeine(); continue; }
    
    
    const sm = lauf.netz.kanten[kanteIndex]!.sm;

    
    
    
    
    
    
    

    
    
    if (f.istNachtschlag && lauf.vorgaben.nachtfahrtBudget === 0) { merkeKeine(); continue; }

    
    
    
    if (legtImDunkelnAb(f, b.departure) && !istZulaessig(lauf.vorgaben.ablegenBeiDunkelheit)) { merkeKeine(); continue; }

    
    
    
    
    
    
    
    if (b.isDaylight === false
        && !anlegenBeiDunkelheitErlaubt(lauf.vorgaben.anlegenBeiDunkelheit, ankerplatzArtVon(nach))) { merkeKeine(); continue; }
    

    const monat = datum.getMonth() + 1;
    const lokalwind = lokalwindFuerEtappe(b, monat);

    
    
    
    
    const zuschlagKnWert = Math.max(0, ...streckeEintraege
      .filter((e) => e.folge === 'zuschlag' && e.wirkung && bedingungAktiv(e.bedingung, lokalwind, b.maxWind))
      .map((e) => zuschlagKn(e.wirkung!, b.maxWind)));
    const effektiverWindKn = b.maxWind + zuschlagKnWert;
    const effektiverGustKn = b.maxGust + zuschlagKnWert;
    
    
    
    
    if (zuschlagReisst(effektiverWindKn, effektiverGustKn, lauf.limits)) { merkeKeine(); continue; }

    
    
    
    
    const ausgeschlossen = zielEintraege.some((e) => wirktAlsAusschluss(
      e, lokalwind, b.maxWind, REVIER_MIN_WIND, crewZumutbarkeitProzent,
    ));
    if (ausgeschlossen) { merkeKeine(); continue; }

    
    
    const revierSchutzhafen = zielEintraege.some((e) => wirktAlsSchutz(e, lokalwind, b.maxWind));

    
    
    
    
    
    
    const modellBlindAktiv = streckeEintraege
      .some((e) => e.folge === 'modell-blind' && bedingungAktiv(e.bedingung, lokalwind, b.maxWind));
    const score = modellBlindAktiv ? b.score * MODELL_BLIND_MALUS_FAKTOR : b.score;

    
    
    
    
    
    
    const zielWind = windData[windData.length - 1];
    const nachtwind = zielWind ? nachtwindRichtung(zielWind, nachtfenster(b.arrival, daylight)) : null;
    
    const schutzWellenanlaufNM = nachtwind == null || lauf.kueste == null
      ? null : luvFetchNM(nach.ort, nachtwind, lauf.kueste);

    const bewertung: EtappenBewertung = {
      score, sm, istNachtschlag: f.istNachtschlag, regime: 'gerechnet',
      kennzahlen: {
        ...kennzahlenOhneWetter(datum),
        totalHrs: b.totalHrs, vmgShareAnteil: b.vmgShare, motorShareAnteil: b.motorShare,
        dunkelShareAnteil: b.dunkelShare, maxWindKn: b.maxWind, maxGustKn: b.maxGust, maxHsM: b.maxHs,
        schutzWellenanlaufNM, revierSchutzhafen,
        
        
        modellUebereinstimmungProzent: lauf.modellJeTag.get(dateStr) ?? null,
        
        
        
        
        
        ablegeZeitIso: naiveIso(b.departure),
        
        ...(legtImDunkelnAb(f, b.departure) ? { ablegenImDunkeln: true as const } : {}),
        
        
        lage: b.hasStorm || b.score > guenstigGrenze(b) ? 'brauchbar' : 'guenstig',
        
        ...(b.hasStorm ? { gewitter: true as const } : {}),
      },
    };
    lauf.kosten.set(kostenSchluessel(kanteIndex, t), bewertung);
    if (bewertungSchluessel) lauf.speicher!.bewertung.lege(bewertungSchluessel, bewertung);
    eingetragen++;
  }
  return eingetragen > 0 ? 'gerechnet' : 'kein-fenster';
}


async function holeTageslichtJeKnoten(
  netz: Kandidatennetz, speicher: KostenkartenSpeicher | null,
  melde: (erledigt: number, gesamt: number) => void = () => {},
): Promise<Map<number, Tageslicht>> {
  const ziele = [...new Set(netz.kanten.map((k) => k.nach))];
  const map = new Map<number, Tageslicht>();
  let erledigt = 0;
  melde(0, ziele.length);
  await parallelMitGrenze(NEBENLAEUFIGE_ABRUFE, ziele.map((index) => async (): Promise<void> => {
    const knoten = netz.knoten[index];
    if (!knoten) return;
    try {
      map.set(index, await gemerkt(speicher, 'tageslicht', knoten.ort,
        () => fetchDaylight(knoten.ort.lat, knoten.ort.lon)));
    } catch {
      
      
    } finally {
      melde(++erledigt, ziele.length);
    }
  }));
  return map;
}


export async function befuelleKostenkarte(
  netz: Kandidatennetz, gesamtFahrtage: number, startDatum: Date,
  cfg: SchiffConfig, limits: Grenzwerte, daemmerung: Daemmerungsstufe, stepMin: number,
  sampleStepNM: number, sprache: Sprache,
  
  kueste: Kuestenlinie | null,
  
  vorgaben: NachtVorgaben = VORGABEN_5_1,
  heute: Date = new Date(),
  
  raender: ToernRaender = {},
  
  modellJeTag: ReadonlyMap<string, number> = new Map(),
  
  inselJeKnoten: ReadonlyMap<number, readonly string[]> = new Map(),
  
  meldeFortschritt: (erledigt: number, gesamt: number, was?: 'wetter' | 'tageslicht') => void = () => {},
  
  speicher: KostenkartenSpeicher | null = null,
  
  gitter: RevierwindErgebnis | null = null,
  
  harteBereitschaften: HarteBereitschaften = { kreuzen: 'gern', motoren: 'gern' },
  
  abbruch: () => boolean = () => false,
  zeitbudgetMs = 0,
): Promise<KostenkartenErgebnis> {
  const grenzTag = datumPlusTage(heute, GERECHNET_BIS_TAG);
  
  
  
  const heuteTag = datumPlusTage(heute, 0);
  const gerechnet = (datum: Date): boolean => datum >= heuteTag && datum <= grenzTag;
  const kosten = new Map<string, EtappenBewertung>();

  
  
  
  const gerechneteTage = Array.from({ length: gesamtFahrtage }, (_, i) => i + 1)
    .filter((t) => gerechnet(datumPlusTage(startDatum, t - 1)));

  
  
  
  const ausgaenge = new Array<KantenAusgang>(netz.kanten.length).fill('nur-geruest');
  const windproben: Windprobe[] = [];
  let uebersprungen = 0;
  if (gerechneteTage.length > 0) {
    const tageslichtJeKnoten = await holeTageslichtJeKnoten(netz, speicher, (e, g) => meldeFortschritt(e, g, 'tageslicht'));
    const lauf: Lauf = {
      netz, kosten, gerechneteTage, gesamtFahrtage, modellJeTag, inselJeKnoten, windproben, speicher, gitter, harteBereitschaften, raender, startDatum, cfg, limits,
      daemmerung, stepMin, sprache, kueste, vorgaben, tageslichtJeKnoten,
    };
    const paare = ungerichtetePaare(netz);
    let erledigt = 0;
    meldeFortschritt(0, paare.length, 'wetter');
    await parallelMitGrenze(NEBENLAEUFIGE_ABRUFE, paare.map((paar) => async (): Promise<void> => {
      
      
      if (abbruch()) {
        for (const k of paar.kanten) { ausgaenge[k.index] = 'fehlgeschlagen'; uebersprungen++; }
        meldeFortschritt(++erledigt, paare.length, 'wetter');
        return;
      }
      const ausgang = await rechnePaar(lauf, paar, sampleStepNM);
      for (const k of paar.kanten) ausgaenge[k.index] = ausgang[k.index] ?? 'fehlgeschlagen';
      meldeFortschritt(++erledigt, paare.length, 'wetter');
    }));
  }

  
  
  
  const normalwindKn = Math.max(polarSpeed(NORMALWIND_KN, NORMALWIND_TWA, cfg.crewFactor, cfg.boat), cfg.motorSpeed);
  const faktor = aufschlagFaktor(kosten);
  netz.kanten.forEach((kante, kanteIndex) => {
    for (let t = 1; t <= gesamtFahrtage; t++) {
      const datum = datumPlusTage(startDatum, t - 1);
      if (gerechnet(datum)) continue; 
      const geschaetzteFahrzeitHrs = kante.sm / normalwindKn;
      
      
      kosten.set(kostenSchluessel(kanteIndex, t), {
        score: geschaetzteFahrzeitHrs * SCORE_PRO_FAHRTSTUNDE * faktor,
        sm: kante.sm, istNachtschlag: kante.nacht === true, regime: 'geruest',
        kennzahlen: { ...kennzahlenOhneWetter(datum), totalHrs: geschaetzteFahrzeitHrs },
      });
    }
  });

  const bericht: KostenkartenBericht = uebersprungen > 0
    ? { ...zaehleAusgaenge(ausgaenge), zeitbudgetErreicht: true, zeitbudgetMs, uebersprungen }
    : zaehleAusgaenge(ausgaenge);
  return {
    kosten, bericht, ausgaenge,
    vorherrschenderWindDeg: windproben.length > 0 ? vorherrschendeWindrichtung(windproben) : null,
    windproben,
  };
}


function aufschlagFaktor(kosten: ReadonlyMap<string, EtappenBewertung>): number {
  let scoreSumme = 0, stundenSumme = 0;
  for (const eintrag of kosten.values()) {
    if (eintrag.regime !== 'gerechnet' || eintrag.kennzahlen.totalHrs == null) continue;
    scoreSumme += eintrag.score;
    stundenSumme += eintrag.kennzahlen.totalHrs;
  }
  const reinerStundenanteil = stundenSumme * SCORE_PRO_FAHRTSTUNDE;
  if (reinerStundenanteil <= 0) return 1;
  return scoreSumme / reinerStundenanteil;
}


async function rechnePaar(
  lauf: Lauf, paar: Knotenpaar, sampleStepNM: number,
): Promise<Record<number, KantenAusgang>> {
  const alle = (ausgang: KantenAusgang): Record<number, KantenAusgang> =>
    Object.fromEntries(paar.kanten.map((k) => [k.index, ausgang]));

  const a = lauf.netz.knoten[paar.a], b = lauf.netz.knoten[paar.b];
  if (!a || !b) return alle('fehlgeschlagen');

  try {
    
    
    const weg = kantenWeg(lauf.netz, paar.a, paar.b);
    const punkte = sampleRoute(weg, sampleStepNM);
    
    
    
    
    const wetterSchluessel = weg.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|')
      + `|${sampleStepNM}|${stundenSchluessel(new Date())}`;
    
    
    
    
    const ausGitter = lauf.gitter ? punkte.map((p) => windAmPunkt(lauf.gitter!.gitter, p)) : null;
    const gitterDeckt = ausGitter != null && ausGitter.every((w) => w != null);
    let abruf = gitterDeckt
      ? Promise.resolve({ hourly: ausGitter as StundenWind[], utcOffsetSeconds: lauf.gitter!.utcOffsetSeconds })
      : lauf.speicher?.wetter.hole(wetterSchluessel);
    if (!abruf) {
      abruf = fetchWindForPoints(punkte);
      if (lauf.speicher) {
        const speicher = lauf.speicher;
        speicher.wetter.lege(wetterSchluessel, abruf);
        abruf.catch(() => speicher.wetter.entferne(wetterSchluessel));
      }
    }
    const { hourly: windData, utcOffsetSeconds } = await abruf;
    const zeitreihe = windData[0]?.time;
    
    
    if (!zeitreihe || zeitreihe.length === 0) return alle('fehlgeschlagen');
    
    
    
    
    
    const forecastEnd = nDate(zeitreihe[zeitreihe.length - 1]!);

    const erste = windData[0];
    if (erste) {
      for (let i = 0; i < erste.time.length; i += WINDPROBEN_SCHRITT_H) {
        const dir = erste.wind_direction_10m[i], speed = erste.wind_speed_10m[i];
        if (typeof dir === 'number' && typeof speed === 'number') { const zeitIso = erste.time[i]; lauf.windproben.push(zeitIso ? { dir, speed, zeitIso } : { dir, speed }); }
      }
    }

    const quelle = gitterDeckt ? 'gitter' : 'punkt';
    const hin: Streckenwetter = { schluessel: `${wetterSchluessel}|${quelle}|hin`, punkte, windData, utcOffsetSeconds, forecastEnd };
    
    
    let zurueck: Streckenwetter | null = null;

    const ergebnis: Record<number, KantenAusgang> = {};
    for (const kante of paar.kanten) {
      const netzkante = lauf.netz.kanten[kante.index]!;
      const von = lauf.netz.knoten[netzkante.von]!, nach = lauf.netz.knoten[netzkante.nach]!;
      const daylight = lauf.tageslichtJeKnoten.get(netzkante.nach);
      if (!daylight) { ergebnis[kante.index] = 'fehlgeschlagen'; continue; }
      if (!kante.vorwaerts && !zurueck) {
        zurueck = {
          schluessel: `${wetterSchluessel}|${quelle}|zurueck`,
          punkte: kehreStrecke(punkte), windData: [...windData].reverse(), utcOffsetSeconds, forecastEnd,
        };
      }
      const wetter = kante.vorwaerts ? hin : zurueck!;
      ergebnis[kante.index] = rechneKante(lauf, kante.index, von, nach, netzkante.nach, wetter, daylight);
    }
    return ergebnis;
  } catch {
    
    
    
    return alle('fehlgeschlagen');
  }
}

function zaehleAusgaenge(ausgaenge: readonly KantenAusgang[]): KostenkartenBericht {
  const zaehle = (was: KantenAusgang): number => ausgaenge.filter((a) => a === was).length;
  return {
    kanten: ausgaenge.length,
    gerechnet: zaehle('gerechnet'),
    keinFenster: zaehle('kein-fenster'),
    fehlgeschlagen: zaehle('fehlgeschlagen'),
    nurGeruest: zaehle('nur-geruest'),
  };
}
