import { ereignisText, liegeZeitNachBewegung, liegenAmTagesbeginn, liegeEintragArt, type Liegeart } from '@/core/logbuchText';
import { windJetzt } from './wetter';
import { werteSpurAus, aktuelleFahrt, hatAbgelegt, dauerAb, ankunftsPause, stillstandAmEndeS, type Fix, type Luecke, type Pause, type ManuellePause } from '@/core/spur';
import { tagesendeEntscheidung, letzterVermerkAusLog, nachzuholenderTagesabschluss, spurSchweigtSeitDaemmerung, lagWaehrendSchweigen, SPUR_STILL_NACH_DAEMMERUNG_MS } from '@/core/tagesende';
import { nameAusNaehe } from '@/core/ortsmarken';
import { eintragSchluessel, mitVermerk, ohneVermerk, positionZurZeit, type ArtWahl } from '@/core/logbuchBearbeiten';
import { antriebsbilanz, wechselAusEintraegen } from '@/core/antriebsbilanz';
import { nf } from '@/core/time';
import { aktuelleSprache } from '@/shell/sprache';
import { tagesabschlussText, unterFahrtText } from './tagesendetext';
import { merkeOrtsmarke, loeseOrteAuf, beiNamenNachtrag } from './orte';
import {
  starteFahrt, beendeFahrt, laufendeFahrt, schreibeFix, ladeFixe, loescheFahrt,
  schreibeEintrag, aktualisiereEintrag, ladeEintraege, speicherZustand, speicherVerfuegbar,
  setzeWache, setzeAnkerwache, beendeToern, holeToern,
  setzeManuellePauseSeit, schliesseManuellePause, setzeOffeneUebernachtung, setzeAntriebNachAblegen, ortsmarken, alleOrte, alleFahrten,
  ordneEtappenToernZu, loescheEintrag, stelleEintragWieder, vermerkeGeloescht,
  loescheFehlstart, speichereOrt, uebernehmeFahrt,
  type Fahrt, type LogEintrag, type SpeicherZustand,
} from '@/data/logdb';
import { FEHLSTART_TROPEA, bezugVor, fernImFenster, imFenster, istFern, pausenZusammen, type Fenster } from '@/core/fehlstart';
import { SCHLUESSEL } from '@/shell/speicherschluessel';



export type WakeZustand = 'aktiv' | 'fehlt' | 'nicht-unterstuetzt';


export type Betriebsart = 'gestoppt' | 'laeuft' | 'pausiert' | 'pausiert-anker';

export interface Zustand {
  laeuft: boolean;
  betriebsart: Betriebsart;
  fahrt: Fahrt | null;
  
  wartetAufFix: boolean;
  
  fortgesetzt: boolean;
  sog: number;
  cog: number | null;
  streckeNM: number;
  
  dauerS: number;
  
  fahrzeitS: number;
  
  abgelegt: boolean;
  fixe: number;
  verworfen: number;
  luecken: Luecke[];
  
  pausen: Pause[];
  position: { lat: number; lon: number } | null;
  
  genauigkeitM: number | null;
  wake: WakeZustand;
  antrieb: 'segel' | 'motor' | null;
  eintraege: LogEintrag[];
  speicher: SpeicherZustand | null;
  
  fehler: string | null;
  
  ankerwache: { lat: number; lon: number; radiusM: number } | null;
  
  stillstandS: number;
}

const LEER: Zustand = {
  laeuft: false, betriebsart: 'gestoppt', fahrt: null, wartetAufFix: false, fortgesetzt: false,
  sog: 0, cog: null, streckeNM: 0, dauerS: 0, fahrzeitS: 0, abgelegt: false, fixe: 0, verworfen: 0,
  luecken: [], pausen: [], position: null, genauigkeitM: null, wake: 'fehlt', antrieb: null,
  eintraege: [], speicher: null, fehler: null, ankerwache: null, stillstandS: 0,
};

let z: Zustand = { ...LEER };
let fixe: Fix[] = [];
let watchId: number | null = null;
let takt: ReturnType<typeof setInterval> | null = null;
let wakeLock: WakeLockSentinel | null = null;
let melde: (z: Zustand) => void = () => {};

let nurLesen = false;
function nurLesenGesperrt(): boolean {
  return nurLesen;
}

export function setzeNurLesen(rueckmeldung: (z: Zustand) => void): void {
  nurLesen = true;
  melde = rueckmeldung;
  meldeZustand();
}

let toernId: string | null = null;

let manuellePausen: ManuellePause[] = [];

let manuellePauseSeit: number | null = null;

let wartetAufAblegenFix = false;

let ablegenBezug: { lat: number; lon: number } | null = null;

let offeneUebernachtung: NonNullable<Fahrt['offeneUebernachtung']> | null = null;

let antriebNachAblegen: 'segel' | 'motor' | null = null;

export function setzeToern(id: string | null): void {
  toernId = id;
}


export function aktuellerToernId(): string | null {
  return toernId ?? z.fahrt?.toern ?? null;
}


const AUSWERT_TAKT_MS = 2000;


const nachSpeicherRaeumen = (s: SpeicherZustand): void => {
  z.speicher = s;
  meldeZustand();
};

function meldeZustand(): void {
  melde({ ...z, luecken: [...z.luecken], pausen: [...z.pausen], eintraege: [...z.eintraege] });
}



export async function wachHolen(): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (!('wakeLock' in navigator)) {
    z.wake = 'nicht-unterstuetzt';
    meldeZustand();
    return;
  }
  if (wakeLock && !wakeLock.released) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    z.wake = 'aktiv';
    wakeLock.addEventListener('release', () => {
      z.wake = 'fehlt';
      meldeZustand();
    });
  } catch {
    
    
    z.wake = 'fehlt';
  }
  meldeZustand();
}

async function wachFreigeben(): Promise<void> {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    
  }
  wakeLock = null;
}




async function sichereEintrag(eintrag: LogEintrag): Promise<void> {
  try { await schreibeEintrag(eintrag); return; } catch {  }
  try { await schreibeEintrag(eintrag); } catch {
    z.fehler = 'fehler.eintragSpeichern';
    meldeZustand();
  }
}


async function protokolliereAblegen(t: number, lat: number, lon: number): Promise<void> {
  if (!z.fahrt) return;
  const eintrag: LogEintrag = { fahrt: z.fahrt.id, t, art: 'start', lat, lon, text: '' };
  await sichereEintrag(eintrag);
  z.eintraege.push(eintrag);
  if (antriebNachAblegen && z.antrieb === antriebNachAblegen) {
    
    
    const a: LogEintrag = { fahrt: z.fahrt.id, t: t + 1000, art: 'antrieb', lat, lon, text: antriebNachAblegen };
    await sichereEintrag(a);
    z.eintraege.push(a);
    antriebNachAblegen = null;
    await setzeAntriebNachAblegen(z.fahrt.id, null).catch(() => {});
  } else if (z.antrieb === null) await setzeAntrieb('motor', { t, lat, lon });
  meldeZustand();
}


async function findePauseName(fahrtId: string, von: number, lat?: number | null, lon?: number | null): Promise<string | null> {
  const marken = await ortsmarken(fahrtId).catch(() => []);
  const treffer = marken.find((m) => m.art === 'pause' && Math.abs(m.t - von) < 120_000);
  if (treffer?.name) return treffer.name;
  
  
  if (lat == null || lon == null) return null;
  const alle = await alleOrte().catch(() => []);
  return nameAusNaehe({ lat, lon }, alle);
}


async function oeffneUebernachtung(ankerwache: boolean, liegeart?: Liegeart): Promise<void> {
  if (!z.fahrt) return;
  
  
  if (offeneUebernachtung?.liegeart === 'treiben' && ankerwache) {
    const nichtVor = (offeneUebernachtung.eintragT ?? 0) + 1000;
    offeneUebernachtung = { von: Date.now(), lat: z.position?.lat ?? null, lon: z.position?.lon ?? null, ankerwache, liegeart: 'anker' };
    await setzeOffeneUebernachtung(z.fahrt.id, offeneUebernachtung).catch(() => {});
    await schreibeLiegeEintrag(nichtVor);
    return;
  }
  if (offeneUebernachtung) {
    
    
    
    const gewaehlt = offeneUebernachtung.liegeart;
    if (ankerwache && !offeneUebernachtung.ankerwache && (!gewaehlt || gewaehlt === 'anker')) {
      offeneUebernachtung = { ...offeneUebernachtung, ankerwache: true };
      await setzeOffeneUebernachtung(z.fahrt.id, offeneUebernachtung).catch(() => {});
      
      const t = offeneUebernachtung.eintragT;
      const e = t != null
        ? z.eintraege.find((x) => (x.art === 'anlegen' || x.art === 'liegeplatz') && x.t === t) : undefined;
      if (e) {
        e.art = e.art === 'liegeplatz' ? 'ankerplatz' : 'ankern';
        await aktualisiereEintrag(e).catch(() => {});
        meldeZustand();
      }
    }
    return;
  }
  offeneUebernachtung = {
    von: Date.now(), lat: z.position?.lat ?? null, lon: z.position?.lon ?? null, ankerwache,
    ...(liegeart ? { liegeart } : {}),
  };
  await setzeOffeneUebernachtung(z.fahrt.id, offeneUebernachtung).catch(() => {});
  await schreibeLiegeEintrag();
}


function liegeArtDesStopps(episode: { ankerwache: boolean; liegeart?: Liegeart | undefined }): 'ankern' | 'anlegen' | 'treiben' {
  return episode.liegeart ? liegeEintragArt(episode.liegeart) : (episode.ankerwache ? 'ankern' : 'anlegen');
}


async function schreibeLiegeEintrag(nichtVor = 0): Promise<void> {
  const episode = offeneUebernachtung;
  if (!z.fahrt || !episode || episode.eintragT != null) return;
  const art = liegeArtDesStopps(episode);
  
  
  const letzte = fixe[fixe.length - 1];
  const p = letzte ? ankunftsPause(z.pausen, letzte.t, episode.von) : null;
  const t = Math.max(nichtVor, liegeZeitNachBewegung(z.eintraege, p?.von ?? episode.von));
  const lat = p?.lat ?? episode.lat;
  const lon = p?.lon ?? episode.lon;
  const name = await findePauseName(z.fahrt.id, t, lat, lon);
  const eintrag: LogEintrag = { fahrt: z.fahrt.id, t, art, lat, lon, text: name ?? '' };
  if (episode.liegeart) eintrag.liegeart = episode.liegeart;
  await sichereEintrag(eintrag);
  z.eintraege.push(eintrag);
  offeneUebernachtung = { ...episode, eintragT: t };
  await setzeOffeneUebernachtung(z.fahrt.id, offeneUebernachtung).catch(() => {});
  meldeZustand();
}


async function verwerfeUebernachtung(): Promise<void> {
  if (!offeneUebernachtung || !z.fahrt) { offeneUebernachtung = null; return; }
  offeneUebernachtung = null;
  await setzeOffeneUebernachtung(z.fahrt.id, null).catch(() => {});
}


async function loeseUebernachtungEin(fuerFahrtId: string): Promise<void> {
  const episode = offeneUebernachtung;
  if (!episode) return;
  offeneUebernachtung = null;
  
  if (episode.eintragT != null) return;
  const art = liegeArtDesStopps(episode);
  
  
  
  const letzte = fixe[fixe.length - 1];
  const p = letzte ? ankunftsPause(z.pausen, letzte.t, episode.von) : null;
  const t = liegeZeitNachBewegung(z.eintraege, p?.von ?? episode.von);
  const lat = p?.lat ?? episode.lat;
  const lon = p?.lon ?? episode.lon;
  const name = await findePauseName(fuerFahrtId, t, lat, lon);
  const eintrag: LogEintrag = { fahrt: fuerFahrtId, t, art, lat, lon, text: name ?? '' };
  if (episode.liegeart) eintrag.liegeart = episode.liegeart;
  await sichereEintrag(eintrag);
  if (z.fahrt?.id === fuerFahrtId) z.eintraege.push(eintrag);
}




function positionenStarten(): void {
  if (watchId !== null) return;
  if (!('geolocation' in navigator)) {
    z.fehler = 'fehler.gpsVerweigert';
    meldeZustand();
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const c = pos.coords;
      if (schweigenAbschluss) return;
      const fix: Fix = { t: pos.timestamp, lat: c.latitude, lon: c.longitude, acc: c.accuracy };
      if (schweigenBezug && fix.t > schweigenBezug.t) {
        const bezug = schweigenBezug;
        schweigenBezug = null;
        if (lagWaehrendSchweigen(bezug, fix)) {
          
          
          schweigenAbschluss = true;
          z.position = { lat: fix.lat, lon: fix.lon };
          void schliesseNachSchweigen(bezug.t).finally(() => { schweigenAbschluss = false; });
          return;
        }
      }
      if (c.speed !== null) fix.speed = c.speed;
      if (c.heading !== null) fix.heading = c.heading;

      const ersterFix = fixe.length === 0;
      fixe.push(fix);
      z.position = { lat: c.latitude, lon: c.longitude };
      z.genauigkeitM = Number.isFinite(c.accuracy) ? c.accuracy : null;
      z.wartetAufFix = false;
      
      
      if (ersterFix && z.fahrt) {
        void merkeOrtsmarke(z.fahrt.id, 'start', fix.t, fix.lat, fix.lon);
      }
      
      
      
      
      
      
      if (wartetAufAblegenFix && z.fahrt && hatAbgelegt(ablegenBezug, fix)) {
        wartetAufAblegenFix = false;
        ablegenBezug = null;
        void verwerfeUebernachtung();
        void protokolliereAblegen(fix.t, fix.lat, fix.lon);
      }
      
      if (z.fehler !== 'fehler.eintragSpeichern') z.fehler = null;
      if (z.fahrt) void schreibeFix(z.fahrt.id, fix).catch(() => { z.fehler = 'fehler.speicher'; });
    },
    (err) => {
      
      
      z.fehler = err.code === err.PERMISSION_DENIED ? 'fehler.gpsVerweigert' : 'fehler.gps';
      meldeZustand();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
  );
}

function positionenStoppen(): void {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}




let tageswechsel = false;
let auswertungsKette: Promise<void> = Promise.resolve();
let offeneAuswertungen = 0;

function werteAus(): Promise<void> {
  if (tageswechsel) return Promise.resolve();
  offeneAuswertungen++;
  const lauf = auswertungsKette
    .then(() => (tageswechsel ? undefined : werteAusIntern()))
    .finally(() => { offeneAuswertungen--; });
  auswertungsKette = lauf.catch(() => {});
  return lauf;
}

async function werteAusIntern(): Promise<void> {
  
  
  const a = werteSpurAus(fixe, {}, manuellePausen, (t) => windJetzt(new Date(t))?.dir ?? null);
  
  
  
  const jetzt = aktuelleFahrt(fixe, Date.now());
  z.sog = jetzt.sog;
  z.cog = jetzt.cog;
  z.streckeNM = a.streckeNM;
  z.stillstandS = stillstandAmEndeS(a.punkte);
  z.dauerS = a.dauerS;
  z.fahrzeitS = a.fahrzeitS;
  
  
  
  const fahrt = z.fahrt;
  z.abgelegt = !!fahrt && (z.eintraege.some((e) => e.art === 'start')
    || !z.eintraege.some((e) => (e.art === 'liegeplatz' || e.art === 'ankerplatz') && e.t === fahrt.begonnen));
  
  
  const ablegen = fahrt ? z.eintraege.filter((e) => e.art === 'start' && e.fahrt === fahrt.id && e.t >= fahrt.begonnen)
    .reduce<number | null>((min, e) => (min === null || e.t < min ? e.t : min), null) : null;
  if (z.abgelegt && ablegen !== null) z.dauerS = dauerAb(a, ablegen);
  if (!z.abgelegt) {
    z.dauerS = 0;
    z.fahrzeitS = 0;
  } else if (manuellePauseSeit !== null && fixe.length > 0) {
    
    
    
    z.dauerS += Math.max(0, Date.now() - fixe[fixe.length - 1]!.t) / 1000;
  }
  z.pausen = a.pausen;
  
  
  
  if (z.fahrt) {
    for (const p of a.pausen) {
      void merkeOrtsmarke(z.fahrt.id, 'pause', p.von, p.lat, p.lon);
    }
  }
  z.fixe = fixe.length;
  z.verworfen = a.verworfen;
  z.luecken = a.luecken;

  
  
  
  
  
  
  
  if (z.fahrt) {
    
    
    const schon = new Set([...z.eintraege.map((x) => eintragSchluessel(x)), ...(z.fahrt.geloeschteEintraege ?? [])]);
    for (const e of a.ereignisse) {
      if (schon.has(`${e.art}@${e.t}`)) continue;
      const eintrag: LogEintrag = {
        fahrt: z.fahrt.id, t: e.t, art: e.art, lat: e.lat, lon: e.lon,
        text: ereignisText(e, aktuelleSprache()),
      };
      await sichereEintrag(eintrag);
      z.eintraege.push(eintrag);
    }
    
    
    for (const e of z.eintraege) {
      if (e.art !== 'anlegen' && e.art !== 'ankern') continue;
      
      if (e.bearbeitet) continue;
      const neuT = liegeZeitNachBewegung(z.eintraege, e.t);
      if (neuT === e.t) continue;
      if (offeneUebernachtung?.eintragT === e.t) {
        offeneUebernachtung = { ...offeneUebernachtung, eintragT: neuT };
        await setzeOffeneUebernachtung(z.fahrt.id, offeneUebernachtung).catch(() => {});
      }
      e.t = neuT;
      await aktualisiereEintrag(e).catch(() => {});
    }
  }
  meldeZustand();
}




const TAGESENDE_TAKT_MS = 60_000;
let tagesendeTakt: ReturnType<typeof setInterval> | null = null;

let schweigenBezug: { lat: number; lon: number; t: number } | null = null;

let schweigenAbschluss = false;

let vorSitzungLagSeit: number | null = null;
let letzterUnterFahrtVermerk: number | null = null;


function tagesbilanzText(): string {
  return tagesbilanzAus(fixe, manuellePausen, z.eintraege);
}


function tagesbilanzAus(fx: Fix[], pausen: ManuellePause[], eintraege: LogEintrag[]): string {
  const sprache = aktuelleSprache();
  const en = sprache === 'en';
  const a = werteSpurAus(fx, {}, pausen);
  const b = antriebsbilanz(a.punkte, wechselAusEintraegen(eintraege), a.luecken);
  const teile = [`${nf(a.streckeNM, 1, sprache)} ${en ? 'NM' : 'sm'}`];
  if (b.segelNM > 0.05) {
    teile.push(`${nf(b.segelNM, 1, sprache)} ${en ? 'NM under sail' : 'sm unter Segeln'}`);
  }
  if (b.motorNM > 0.05) {
    teile.push(`${nf(b.motorNM, 1, sprache)} ${en ? 'NM under engine' : 'sm unter Maschine'}`);
  }
  return teile.join(' · ');
}

async function schreibeAutomatikEintrag(text: string, t: number): Promise<void> {
  if (!z.fahrt) return;
  const eintrag: LogEintrag = {
    fahrt: z.fahrt.id, t, art: 'tagesende',
    lat: z.position?.lat ?? null, lon: z.position?.lon ?? null,
    text,
  };
  await sichereEintrag(eintrag);
  z.eintraege.push(eintrag);
}



async function schliesseTagAb(jetzt: number, neuBeginn = jetzt, lagSicher = false): Promise<void> {
  if (!z.fahrt || tageswechsel) return;
  tageswechsel = true;
  try {
    await auswertungsKette;
    await schliesseTagAbIntern(jetzt, neuBeginn, lagSicher);
  } finally {
    tageswechsel = false;
  }
}

async function schliesseTagAbIntern(jetzt: number, neuBeginn: number, lagSicher: boolean): Promise<void> {
  if (!z.fahrt) return;
  const alterAntrieb = z.antrieb;
  await schreibeAutomatikEintrag(tagesabschlussText(tagesbilanzText(), aktuelleSprache()), jetzt);
  const letzte = fixe[fixe.length - 1];
  
  
  if (letzte) {
    await merkeOrtsmarke(z.fahrt.id, 'ziel', letzte.t, letzte.lat, letzte.lon).catch(() => {});
  }
  
  
  
  
  
  
  const offenesFensterSeit = manuellePauseSeit;
  if (offenesFensterSeit !== null) {
    await schliesseManuellePause(z.fahrt.id, offenesFensterSeit, jetzt).catch(() => {});
  }
  
  
  
  const episodeVorher = offeneUebernachtung;
  await loeseUebernachtungEin(z.fahrt.id);
  
  
  
  const treibt = episodeVorher?.liegeart === 'treiben';
  const lag = !treibt && (lagSicher || z.betriebsart === 'pausiert' || z.betriebsart === 'pausiert-anker');
  const liegen = lag ? liegenAmTagesbeginn(z.eintraege, z.betriebsart === 'pausiert-anker') : null;
  const liegeLat = episodeVorher?.lat ?? letzte?.lat ?? z.position?.lat ?? null;
  const liegeLon = episodeVorher?.lon ?? letzte?.lon ?? z.position?.lon ?? null;
  await beendeFahrt(z.fahrt.id, jetzt, z.streckeNM);

  
  
  
  const neue = await starteFahrt(neuBeginn, undefined, z.fahrt.toern ?? toernId ?? undefined);
  z.fahrt = neue;
  
  
  
  if (z.ankerwache) await setzeAnkerwache(neue.id, z.ankerwache).catch(() => {});
  fixe = [];
  manuellePausen = [];
  if (offenesFensterSeit !== null) {
    manuellePauseSeit = neuBeginn;
    await setzeManuellePauseSeit(neue.id, neuBeginn).catch(() => {});
  }
  z.eintraege = [];
  z.luecken = [];
  z.pausen = [];
  z.streckeNM = 0;
  z.dauerS = 0;
  z.fahrzeitS = 0;
  z.fixe = 0;
  z.verworfen = 0;
  
  
  
  antriebNachAblegen = null;
  if (liegen) {
    const eintrag: LogEintrag = {
      fahrt: neue.id, t: neuBeginn, art: liegen.art, lat: liegeLat, lon: liegeLon, text: liegen.text,
      ...(liegen.liegeart ? { liegeart: liegen.liegeart } : {}),
    };
    await sichereEintrag(eintrag);
    z.eintraege.push(eintrag);
    offeneUebernachtung = {
      von: neuBeginn, lat: liegeLat, lon: liegeLon, ankerwache: liegen.art === 'ankerplatz', eintragT: neuBeginn,
      ...(liegen.liegeart ? { liegeart: liegen.liegeart } : {}),
    };
    await setzeOffeneUebernachtung(neue.id, offeneUebernachtung).catch(() => {});
    if (alterAntrieb) {
      z.antrieb = alterAntrieb;
      antriebNachAblegen = alterAntrieb;
      await setzeAntriebNachAblegen(neue.id, alterAntrieb).catch(() => {});
    }
    
    
    if (z.betriebsart === 'laeuft' && liegeLat != null && liegeLon != null) {
      wartetAufAblegenFix = true;
      ablegenBezug = { lat: liegeLat, lon: liegeLon };
    }
  } else if (alterAntrieb) {
    z.antrieb = alterAntrieb;
    const eintrag: LogEintrag = {
      fahrt: neue.id, t: neuBeginn, art: 'antrieb',
      lat: z.position?.lat ?? null, lon: z.position?.lon ?? null, text: alterAntrieb,
    };
    await sichereEintrag(eintrag);
    z.eintraege.push(eintrag);
  }
  
  
  
  const startLat = liegeLat ?? letzte?.lat ?? null;
  const startLon = liegeLon ?? letzte?.lon ?? null;
  if (startLat != null && startLon != null) {
    await merkeOrtsmarke(neue.id, 'start', neuBeginn, startLat, startLon).catch(() => {});
  }
  meldeZustand();
}


async function holeTagesabschlussNach(): Promise<void> {
  if (!z.fahrt) return;
  const letzte = fixe[fixe.length - 1];
  let lagSeit: number | null = null;
  if (manuellePauseSeit !== null) lagSeit = manuellePauseSeit;
  else if (offeneUebernachtung) lagSeit = offeneUebernachtung.von;
  else if (vorSitzungLagSeit !== null) lagSeit = vorSitzungLagSeit;
  else if (letzte) lagSeit = ankunftsPause(z.pausen, letzte.t, null)?.von ?? null;
  const position = z.position ?? (letzte ? { lat: letzte.lat, lon: letzte.lon } : null);
  
  
  if (lagSeit === null && schweigenBezug) return;
  const faellig = nachzuholenderTagesabschluss({
    jetzt: Date.now(), position, fahrtBegonnen: z.fahrt.begonnen, lagSeit,
    
    letzterFix: letzte?.t ?? null,
  });
  if (!faellig) return;
  if (!z.position && position) z.position = position;
  await schliesseTagAb(faellig.ende, faellig.neuBeginn, true);
  await werteAus();
}


async function schliesseNachSchweigen(letzterFixT: number): Promise<void> {
  if (!z.fahrt) return;
  const faellig = nachzuholenderTagesabschluss({
    jetzt: Date.now(), position: z.position, fahrtBegonnen: z.fahrt.begonnen, lagSeit: letzterFixT, letzterFix: letzterFixT,
  });
  if (!faellig) return;
  await schliesseTagAb(faellig.ende, faellig.neuBeginn, true);
  await werteAus();
}

async function pruefeTagesende(): Promise<void> {
  if (!z.fahrt || z.betriebsart === 'gestoppt') return;
  const jetzt = Date.now();
  
  
  
  if (z.betriebsart !== 'laeuft') schweigenBezug = null;
  const schweigt = z.betriebsart === 'laeuft'
    && spurSchweigtSeitDaemmerung(fixe[fixe.length - 1]?.t ?? null, z.position, jetzt, SPUR_STILL_NACH_DAEMMERUNG_MS) !== null;
  
  
  const letzterFix = fixe[fixe.length - 1];
  if (schweigt && letzterFix) {
    schweigenBezug ??= { lat: letzterFix.lat, lon: letzterFix.lon, t: letzterFix.t };
    return;
  }
  if (schweigenBezug) return;
  const was = tagesendeEntscheidung({
    jetzt,
    position: z.position,
    fahrtBegonnen: z.fahrt.begonnen,
    
    
    unterwegs: z.betriebsart === 'laeuft' && !schweigt,
    
    letzterVermerk: letzterVermerkAusLog(z.eintraege, z.fahrt.id, letzterUnterFahrtVermerk),
  });
  if (was === 'nichts') return;
  if (was === 'unter-fahrt') {
    letzterUnterFahrtVermerk = jetzt;
    await schreibeAutomatikEintrag(unterFahrtText(aktuelleSprache()), jetzt);
    meldeZustand();
    return;
  }
  await schliesseTagAb(jetzt, jetzt, schweigt);
}



async function laufeLos(fahrt: Fahrt, fortgesetzt: boolean, betriebsart: Betriebsart = 'laeuft'): Promise<void> {
  z.fahrt = fahrt;
  z.betriebsart = betriebsart;
  z.laeuft = betriebsart === 'laeuft' || betriebsart === 'pausiert-anker';
  z.fortgesetzt = fortgesetzt;
  
  
  
  
  z.wartetAufFix = true;
  z.antrieb = fahrt.antrieb ?? null;
  z.ankerwache = fahrt.ankerwache ?? null;
  
  
  if (betriebsart !== 'pausiert') {
    positionenStarten();
    await wachHolen();
  }
  if (takt) clearInterval(takt);
  takt = setInterval(() => { if (offeneAuswertungen === 0) void werteAus(); }, AUSWERT_TAKT_MS);
  if (tagesendeTakt) clearInterval(tagesendeTakt);
  tagesendeTakt = setInterval(() => void pruefeTagesende(), TAGESENDE_TAKT_MS);
  z.speicher = await speicherZustand(nachSpeicherRaeumen);
  await werteAus();
}

export async function starte(): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (z.betriebsart !== 'gestoppt') return;
  schweigenBezug = null;
  vorSitzungLagSeit = null;
  if (!speicherVerfuegbar()) {
    z.fehler = 'fehler.speicher';
    meldeZustand();
    return;
  }
  
  
  
  
  const toern = toernId ? await holeToern(toernId) : null;
  if (!toern || toern.beendet) toernId = null;
  fixe = [];
  manuellePausen = [];
  manuellePauseSeit = null;
  offeneUebernachtung = null;
  antriebNachAblegen = null;
  wartetAufAblegenFix = true;
  ablegenBezug = null;
  z = { ...LEER, eintraege: [] };
  const fahrt = await starteFahrt(Date.now(), undefined, toernId ?? undefined);
  await laufeLos(fahrt, false);
}


async function ankerwacheLoeschen(): Promise<void> {
  if (!z.fahrt || !z.ankerwache) return;
  z.ankerwache = null;
  await setzeAnkerwache(z.fahrt.id, null).catch(() => {});
}

export async function stoppe(): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (z.betriebsart === 'gestoppt' || !z.fahrt) return;
  await ankerwacheLoeschen();
  positionenStoppen();
  if (takt) clearInterval(takt);
  takt = null;
  if (tagesendeTakt) clearInterval(tagesendeTakt);
  tagesendeTakt = null;
  await wachFreigeben();
  const letzte = fixe[fixe.length - 1];
  if (!letzte) {
    
    
    
    
    
    
    
    
    
    
    await loescheFahrt(z.fahrt.id).catch(() => { z.fehler = 'fehler.speicher'; });
    z.fahrt = null;
    offeneUebernachtung = null;
  } else {
    
    
    
    
    
    
    
    await merkeOrtsmarke(z.fahrt.id, 'ziel', letzte.t, letzte.lat, letzte.lon).catch(() => {});
    
    
    await werteAus();
    
    
    
    
    
    
    
    if (!offeneUebernachtung && ankunftsPause(z.pausen, letzte.t, null)) {
      offeneUebernachtung = { von: letzte.t, lat: letzte.lat, lon: letzte.lon, ankerwache: false };
    }
    await loeseUebernachtungEin(z.fahrt.id);
    await beendeFahrt(z.fahrt.id, Date.now(), z.streckeNM).catch(() => { z.fehler = 'fehler.speicher'; });
  }
  
  void loeseOrteAuf();
  await werteAus();
  z.betriebsart = 'gestoppt';
  z.laeuft = false;
  z.wake = 'fehlt';
  meldeZustand();
}


export async function beendeToernJetzt(): Promise<void> {
  if (nurLesenGesperrt()) return;
  await stoppe();
  if (toernId) await beendeToern(toernId).catch(() => {});
}




async function oeffneManuellePauseFenster(): Promise<void> {
  if (!z.fahrt || manuellePauseSeit !== null) return;
  manuellePauseSeit = Date.now();
  await setzeManuellePauseSeit(z.fahrt.id, manuellePauseSeit).catch(() => {});
}


async function schliesseManuellePauseFenster(): Promise<void> {
  if (!z.fahrt || manuellePauseSeit === null) return;
  const von = manuellePauseSeit;
  const bis = Date.now();
  manuellePauseSeit = null;
  manuellePausen = [...manuellePausen, { von, bis }];
  await schliesseManuellePause(z.fahrt.id, von, bis).catch(() => {});
}


export async function pausiere(liegeart?: Liegeart): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (z.betriebsart !== 'laeuft') return;
  positionenStoppen();
  await wachFreigeben();
  await oeffneManuellePauseFenster();
  
  
  
  await oeffneUebernachtung(liegeart === 'anker', liegeart);
  ablegenBezug = z.position ? { ...z.position } : null;
  z.betriebsart = 'pausiert';
  z.laeuft = false;
  meldeZustand();
}


export async function fortsetzen(): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (z.betriebsart !== 'pausiert' && z.betriebsart !== 'pausiert-anker') return;
  await ankerwacheLoeschen();
  
  
  await schliesseManuellePauseFenster();
  if (offeneUebernachtung?.liegeart === 'treiben') {
    
    
    await verwerfeUebernachtung();
    wartetAufAblegenFix = false;
    ablegenBezug = null;
  } else {
    
    
    
    ablegenBezug = offeneUebernachtung?.lat != null && offeneUebernachtung.lon != null
      ? { lat: offeneUebernachtung.lat, lon: offeneUebernachtung.lon }
      : (z.position ? { ...z.position } : null);
    wartetAufAblegenFix = true;
  }
  positionenStarten();
  await wachHolen();
  z.betriebsart = 'laeuft';
  z.laeuft = true;
  meldeZustand();
}


export async function aktiviereAnkerwache(
  ziel: { lat: number; lon: number; radiusM: number },
): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (!z.fahrt) return;
  
  
  await schliesseManuellePauseFenster();
  
  
  
  await oeffneUebernachtung(true);
  positionenStarten();
  await wachHolen();
  z.betriebsart = 'pausiert-anker';
  z.laeuft = true;
  z.ankerwache = ziel;
  await setzeAnkerwache(z.fahrt.id, ziel).catch(() => {});
  meldeZustand();
}


export async function hebeAnkerwacheAuf(): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (z.betriebsart !== 'pausiert-anker') return;
  await ankerwacheLoeschen();
  positionenStoppen();
  await wachFreigeben();
  
  
  await oeffneManuellePauseFenster();
  z.betriebsart = 'pausiert';
  z.laeuft = false;
  meldeZustand();
}



async function bereinigeFehlstart(f: Fenster = FEHLSTART_TROPEA): Promise<void> {
  try { if (localStorage.getItem(SCHLUESSEL.fehlstartBereinigt)) return; } catch { return; }
  const merken = () => { try { localStorage.setItem(SCHLUESSEL.fehlstartBereinigt, String(Date.now())); } catch {  } };
  
  if (Date.now() > f.bis + 30 * 86_400_000) { merken(); return; }
  const alle = await alleFahrten();
  const lauf = alle.find((x) => x.beendet === null);
  const toern = lauf?.toern;
  if (!toern) { merken(); return; }
  const fahrten = alle.filter((x) => x.toern === toern).sort((a, b) => a.begonnen - b.begonnen);
  const fixeJe = new Map<string, Fix[]>();
  for (const x of fahrten) fixeJe.set(x.id, await ladeFixe(x.id));
  const bezug = bezugVor([...fixeJe.values()].flat(), f);
  if (!bezug) { merken(); return; }
  const betroffen = fahrten.filter((x) => x.begonnen < f.bis && (x.beendet ?? Infinity) >= f.von);
  
  const vorher = (await Promise.all(fahrten.filter((x) => x.begonnen < f.von).map((x) => ladeEintraege(x.id)))).flat()
    .filter((e) => LIEGE_ARTEN_FS.has(e.art) && e.t < f.von).sort((a, b) => a.t - b.t).pop() ?? null;
  const liste: string[] = [];
  for (const fahrt of betroffen) {
    const fixe0 = fixeJe.get(fahrt.id) ?? [];
    const fixWeg = fernImFenster(fixe0, bezug, f);
    const eintraege = await ladeEintraege(fahrt.id);
    const ferne = fernImFenster(eintraege, bezug, f);
    const offen = fahrt.offeneUebernachtung ?? null;
    const offenFern = offen !== null && imFenster(offen.von, f) && istFern(offen, bezug, f.radiusNm);
    if (!fixWeg.length && !ferne.length && !offenFern) continue;
    const fixeNeu = fixe0.filter((x) => !fixWeg.includes(x));
    
    const zurueck = ferne.filter((e) => e.art === 'tagesende' || ((e.art === 'liegeplatz' || e.art === 'ankerplatz') && e.t === fahrt.begonnen));
    const weg = ferne.filter((e) => !zurueck.includes(e));
    const pausen = pausenZusammen(fahrt.manuellePausen ?? [], fahrt.manuellePauseSeit ?? null, fixeNeu.map((x) => x.t), f);
    const bleiben = eintraege.filter((e) => !weg.includes(e));
    for (const e of zurueck) {
      e.lat = bezug.lat;
      e.lon = bezug.lon;
      if (e.art === 'tagesende') e.text = tagesabschlussText(tagesbilanzAus(fixeNeu, pausen.pausen, bleiben), aktuelleSprache());
      else if (vorher) {
        e.text = vorher.text ?? '';
        if (vorher.liegeart) e.liegeart = vorher.liegeart; else delete e.liegeart;
      }
      await aktualisiereEintrag(e);
    }
    await loescheFehlstart(fahrt.id, fixWeg.map((x) => x.t), weg.map((e) => e.id).filter((id): id is number => id !== undefined));
    for (const o of fernImFenster(await ortsmarken(fahrt.id), bezug, f)) {
      const neu = { ...o, lat: bezug.lat, lon: bezug.lon };
      delete neu.name;
      delete neu.versucht;
      await speichereOrt(neu);
    }
    const neu: Fahrt = { ...fahrt, manuellePausen: pausen.pausen };
    delete neu.manuellePauseSeit;
    if (pausen.offenSeit !== null) neu.manuellePauseSeit = pausen.offenSeit;
    if (fahrt.beendet !== null && typeof fahrt.streckeNM === 'number') neu.streckeNM = werteSpurAus(fixeNeu, {}, pausen.pausen).streckeNM;
    const kopf = fahrt.wetterkopf;
    if (kopf && imFenster(kopf.ab ?? kopf.t, f) && weg.some((e) => e.art === 'start')) delete neu.wetterkopf;
    
    const antriebWeg = weg.find((e) => e.art === 'antrieb' && (e.text === 'segel' || e.text === 'motor')
      && weg.some((s) => s.art === 'start' && e.t === s.t + 1000));
    if (antriebWeg && !fahrt.antriebNachAblegen) neu.antriebNachAblegen = antriebWeg.text as 'segel' | 'motor';
    if (offen && (offenFern || (offen.eintragT != null && weg.some((e) => e.t === offen.eintragT)))) {
      
      const liegen = bleiben.filter((e) => LIEGE_ARTEN_FS.has(e.art)).sort((a, b) => a.t - b.t).pop() ?? vorher;
      neu.offeneUebernachtung = {
        von: liegen && liegen.fahrt === fahrt.id ? liegen.t : (pausen.offenSeit ?? offen.von),
        lat: bezug.lat, lon: bezug.lon,
        ankerwache: liegen ? liegen.art === 'ankern' || liegen.art === 'ankerplatz' : offen.ankerwache,
        ...(liegen && liegen.fahrt === fahrt.id ? { eintragT: liegen.t } : {}),
        ...(liegen?.liegeart ? { liegeart: liegen.liegeart } : {}),
      };
    }
    await uebernehmeFahrt(neu);
    liste.push(fahrt.id);
  }
  if (liste.length) {
    try { localStorage.setItem(SCHLUESSEL.liveErsetzen, JSON.stringify(liste)); } catch {  }
  }
  merken();
}
const LIEGE_ARTEN_FS = new Set(['anlegen', 'ankern', 'liegeplatz', 'ankerplatz']);

export async function initAufzeichnung(rueckmeldung: (z: Zustand) => void): Promise<void> {
  melde = rueckmeldung;
  if (!speicherVerfuegbar()) {
    z.fehler = 'fehler.speicher';
    meldeZustand();
    return;
  }
  
  
  await ordneEtappenToernZu().catch(() => 0);
  
  await bereinigeFehlstart().catch(() => {});
  const fahrt = await laufendeFahrt();
  if (fahrt?.toern && !toernId) toernId = fahrt.toern;
  if (!fahrt) {
    z.speicher = await speicherZustand(nachSpeicherRaeumen);
    meldeZustand();
    return;
  }
  
  
  
  
  
  
  
  
  
  if (fahrt.toern) {
    const toern = await holeToern(fahrt.toern);
    if (!toern || toern.beendet) {
      const fixeAlt = await ladeFixe(fahrt.id);
      const letzterFix = fixeAlt[fixeAlt.length - 1];
      
      
      if (letzterFix) {
        await beendeFahrt(fahrt.id, letzterFix.t).catch(() => {});
      } else {
        await loescheFahrt(fahrt.id).catch(() => {});
      }
      z.speicher = await speicherZustand(nachSpeicherRaeumen);
      meldeZustand();
      return;
    }
  }
  fixe = await ladeFixe(fahrt.id);
  manuellePausen = [...(fahrt.manuellePausen ?? [])];
  manuellePauseSeit = fahrt.manuellePauseSeit ?? null;
  
  
  
  offeneUebernachtung = fahrt.offeneUebernachtung ?? null;
  antriebNachAblegen = fahrt.antriebNachAblegen ?? null;
  
  
  
  
  schweigenBezug = null;
  vorSitzungLagSeit = null;
  const vorSitzung = fixe[fixe.length - 1];
  if (vorSitzung && manuellePauseSeit === null && !offeneUebernachtung && !fahrt.ankerwache
    && spurSchweigtSeitDaemmerung(vorSitzung.t, { lat: vorSitzung.lat, lon: vorSitzung.lon }, Date.now()) !== null) {
    vorSitzungLagSeit = ankunftsPause(werteSpurAus(fixe, {}, manuellePausen).pausen, vorSitzung.t, null)?.von ?? null;
    if (vorSitzungLagSeit === null) schweigenBezug = { lat: vorSitzung.lat, lon: vorSitzung.lon, t: vorSitzung.t };
  }
  z.eintraege = await ladeEintraege(fahrt.id);
  
  
  
  const lagBeimLaden = fahrt.manuellePauseSeit != null || !!fahrt.ankerwache;
  const uebernommen = z.eintraege.find((e) => e.art === 'antrieb' && e.t === fahrt.begonnen);
  if (lagBeimLaden && uebernommen && !antriebNachAblegen
      && !z.eintraege.some((e) => e.art === 'start' || (e.art === 'antrieb' && e !== uebernommen))
      && (uebernommen.text === 'motor' || uebernommen.text === 'segel')) {
    antriebNachAblegen = uebernommen.text;
    await setzeAntriebNachAblegen(fahrt.id, antriebNachAblegen).catch(() => {});
    const vorher = (await alleFahrten().catch(() => [] as Fahrt[]))
      .filter((f) => f.id !== fahrt.id && f.begonnen < fahrt.begonnen)
      .sort((a, b) => b.begonnen - a.begonnen)[0];
    const alte = vorher ? await ladeEintraege(vorher.id).catch(() => []) : [];
    const liegen = liegenAmTagesbeginn(alte, !!fahrt.ankerwache);
    uebernommen.art = liegen.art;
    uebernommen.text = liegen.text;
    if (liegen.liegeart) uebernommen.liegeart = liegen.liegeart;
    await aktualisiereEintrag(uebernommen).catch(() => {});
    if (!offeneUebernachtung) {
      offeneUebernachtung = {
        von: fahrt.begonnen, lat: uebernommen.lat, lon: uebernommen.lon,
        ankerwache: liegen.art === 'ankerplatz', eintragT: fahrt.begonnen,
      };
      await setzeOffeneUebernachtung(fahrt.id, offeneUebernachtung).catch(() => {});
    }
  }
  
  
  
  
  
  for (const e of z.eintraege) {
    if (e.t !== fahrt.begonnen || (e.art !== 'anlegen' && e.art !== 'ankern')) continue;
    e.art = e.art === 'ankern' ? 'ankerplatz' : 'liegeplatz';
    await aktualisiereEintrag(e).catch(() => {});
  }
  
  
  
  
  
  
  const letzterAntrieb = [...z.eintraege]
    .filter((e) => e.art === 'antrieb' && (e.text === 'segel' || e.text === 'motor'))
    .sort((a, b) => a.t - b.t)
    .pop();
  const wiederAufgenommen: Fahrt = letzterAntrieb
    ? { ...fahrt, antrieb: letzterAntrieb.text as 'segel' | 'motor' }
    : (antriebNachAblegen ? { ...fahrt, antrieb: antriebNachAblegen } : fahrt);
  
  
  
  
  
  
  
  
  
  
  const anfangsBetriebsart: Betriebsart = wiederAufgenommen.ankerwache
    ? 'pausiert-anker'
    : (manuellePauseSeit !== null ? 'pausiert' : 'laeuft');
  
  
  
  
  
  
  
  
  
  const warWirklichPausiert = manuellePauseSeit !== null || offeneUebernachtung !== null;
  if (anfangsBetriebsart === 'laeuft' && manuellePauseSeit !== null) {
    const von = manuellePauseSeit;
    const bis = Date.now();
    manuellePauseSeit = null;
    manuellePausen = [...manuellePausen, { von, bis }];
    await schliesseManuellePause(wiederAufgenommen.id, von, bis).catch(() => {});
  }
  
  
  
  
  
  if (anfangsBetriebsart === 'laeuft' && warWirklichPausiert && offeneUebernachtung?.liegeart === 'treiben') {
    
    await verwerfeUebernachtung();
  } else if (anfangsBetriebsart === 'laeuft' && warWirklichPausiert) {
    wartetAufAblegenFix = true;
    const letzterFix = fixe[fixe.length - 1];
    ablegenBezug = offeneUebernachtung?.lat != null && offeneUebernachtung.lon != null
      ? { lat: offeneUebernachtung.lat, lon: offeneUebernachtung.lon }
      : (letzterFix ? { lat: letzterFix.lat, lon: letzterFix.lon } : null);
  }
  if (anfangsBetriebsart === 'pausiert') {
    
    
    const letzterFix = fixe[fixe.length - 1];
    const lat = offeneUebernachtung?.lat ?? letzterFix?.lat;
    const lon = offeneUebernachtung?.lon ?? letzterFix?.lon;
    if (lat != null && lon != null) {
      z.position = { lat, lon };
      ablegenBezug = { lat, lon };
    }
  }
  await laufeLos(wiederAufgenommen, true, anfangsBetriebsart);
  
  
  
  
  await schreibeLiegeEintrag().catch(() => {});
  await holeTagesabschlussNach().catch(() => {});
}




export async function neuerEintrag(text = '', t = Date.now()): Promise<LogEintrag | null> {
  if (nurLesenGesperrt()) return null;
  if (!z.fahrt) return null;
  
  const zurueck = Math.abs(Date.now() - t) > 120_000;
  const pos = zurueck ? positionZurZeit(fixe, t) : z.position;
  const eintrag: LogEintrag = {
    fahrt: z.fahrt.id, t, art: 'hand',
    lat: pos?.lat ?? null, lon: pos?.lon ?? null,
    ...(text ? { text } : {}),
  };
  await schreibeEintrag(eintrag);
  
  let i = z.eintraege.length;
  while (i > 0 && z.eintraege[i - 1]!.t > t) i--;
  z.eintraege.splice(i, 0, eintrag);
  meldeZustand();
  return eintrag;
}


export async function setzeAntrieb(
  antrieb: 'segel' | 'motor',
  erkanntBei?: { t: number; lat: number | null; lon: number | null },
): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (!z.fahrt || z.antrieb === antrieb) return;
  z.antrieb = antrieb;
  if (antriebNachAblegen) {
    antriebNachAblegen = null;
    await setzeAntriebNachAblegen(z.fahrt.id, null).catch(() => {});
  }
  const eintrag: LogEintrag = {
    fahrt: z.fahrt.id, t: erkanntBei?.t ?? Date.now(), art: 'antrieb',
    lat: erkanntBei?.lat ?? z.position?.lat ?? null, lon: erkanntBei?.lon ?? z.position?.lon ?? null,
    text: antrieb,
  };
  await schreibeEintrag(eintrag);
  z.eintraege.push(eintrag);
  meldeZustand();
}


export async function setzeWacheFuerFahrt(wache: string): Promise<void> {
  if (nurLesenGesperrt()) return;
  if (!z.fahrt) return;
  z.fahrt = { ...z.fahrt, wache };
  await setzeWache(z.fahrt.id, wache);
  meldeZustand();
}


export async function ergaenzeEintrag(eintrag: LogEintrag): Promise<void> {
  if (nurLesenGesperrt()) return;
  
  
  
  
  
  await schreibeEintrag(eintrag);
  
  
  if (z.fahrt && eintrag.fahrt === z.fahrt.id) {
    z.eintraege.push(eintrag);
    meldeZustand();
  }
}




beiNamenNachtrag((e) => {
  if (!z.fahrt || e.fahrt !== z.fahrt.id) return;
  const hier = z.eintraege.find((x) => (e.id !== undefined && x.id === e.id) || (x.t === e.t && x.art === e.art));
  if (hier && !hier.text) {
    hier.text = e.text ?? '';
    meldeZustand();
  }
});


export async function ergaenzeEintragText(eintrag: LogEintrag, text: string): Promise<void> {
  if (nurLesenGesperrt()) return;
  eintrag.text = text;
  await aktualisiereEintrag(eintrag);
  meldeZustand();
}


export async function bearbeiteEintrag(
  eintrag: LogEintrag, text: string, t: number,
  
  artWahl?: ArtWahl,
): Promise<void> {
  if (nurLesenGesperrt()) return;
  const alt = eintragSchluessel(eintrag);
  const altArt = eintrag.art;
  const hier = z.eintraege.find((x) => x === eintrag || (eintrag.id !== undefined && x.id === eintrag.id)) ?? eintrag;
  hier.text = text;
  hier.bearbeitet = true;
  const artNeu = artWahl && (artWahl.art !== hier.art || artWahl.liegeart !== hier.liegeart);
  if (artWahl && artNeu) {
    hier.art = artWahl.art;
    if (artWahl.liegeart) hier.liegeart = artWahl.liegeart;
    else delete hier.liegeart;
  }
  if (t !== hier.t || hier.art !== altArt) {
    hier.t = t;
    await vermerkeGeloescht(hier.fahrt, alt).catch(() => {});
    if (z.fahrt && z.fahrt.id === hier.fahrt) {
      z.fahrt = { ...z.fahrt, geloeschteEintraege: mitVermerk(z.fahrt.geloeschteEintraege, alt) };
    }
  }
  await aktualisiereEintrag(hier);
  meldeZustand();
}


export async function loescheEintragVonHand(eintrag: LogEintrag): Promise<() => Promise<void>> {
  if (nurLesenGesperrt()) return async () => {};
  const schluessel = eintragSchluessel(eintrag);
  const kopie: LogEintrag = { ...eintrag };
  await loescheEintrag(eintrag, schluessel);
  z.eintraege = z.eintraege.filter((x) => x !== eintrag && !(eintrag.id !== undefined && x.id === eintrag.id));
  if (z.fahrt && z.fahrt.id === eintrag.fahrt) {
    z.fahrt = { ...z.fahrt, geloeschteEintraege: mitVermerk(z.fahrt.geloeschteEintraege, schluessel) };
  }
  meldeZustand();
  return async () => {
    await stelleEintragWieder(kopie, schluessel);
    if (z.fahrt && z.fahrt.id === kopie.fahrt) {
      z.fahrt = { ...z.fahrt, geloeschteEintraege: ohneVermerk(z.fahrt.geloeschteEintraege, schluessel) };
      z.eintraege.push(kopie);
    }
    meldeZustand();
  };
}


export function aktualisiereFahrt(teil: Partial<Fahrt>): void {
  if (nurLesenGesperrt()) return;
  if (!z.fahrt) return;
  z.fahrt = { ...z.fahrt, ...teil };
  meldeZustand();
}


export function uebernehmeFixe(neue: Fix[]): void {
  if (nurLesenGesperrt()) return;
  if (!neue.length) return;
  fixe = [...fixe, ...neue].sort((a, b) => a.t - b.t);
  z.fixe = fixe.length;
  meldeZustand();
}


export function aktuelleFixe(): Fix[] {
  return fixe;
}


export function aktuelleManuellePausen(): ManuellePause[] {
  return manuellePausen;
}

export function aktuellerZustand(): Zustand {
  return z;
}


if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && z.laeuft) void wachHolen();
  });
}
