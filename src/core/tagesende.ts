import { sonnenhoehe, sonnenzeiten, DAEMMERUNGSWINKEL } from './sun';
import { distNM } from './geo';



export type TagesendeEntscheidung = 'nichts' | 'abschliessen' | 'unter-fahrt';

export interface TagesendeLage {
  
  jetzt: number;
  
  position: { lat: number; lon: number } | null;
  
  fahrtBegonnen: number;
  
  unterwegs: boolean;
  
  letzterVermerk: number | null;
}

function datumStr(t: number): string {
  const d = new Date(t);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const tag = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${tag}`;
}


export const DAEMMERUNG_SPIEL_MS = 5 * 60_000;


export function letzteDaemmerung(lat: number, lon: number, jetzt: number): number | null {
  const winkel = DAEMMERUNGSWINKEL.buergerlich;
  let beste: number | null = null;
  for (const versatz of [0, -86400000]) {
    const zeiten = sonnenzeiten(lat, lon, datumStr(jetzt + versatz), winkel);
    if (!zeiten) continue;
    const unter = zeiten.unter.getTime();
    if (unter <= jetzt && (beste === null || unter > beste)) beste = unter;
  }
  return beste;
}


export function letzteMorgendaemmerung(lat: number, lon: number, jetzt: number): number | null {
  const winkel = DAEMMERUNGSWINKEL.buergerlich;
  let beste: number | null = null;
  for (const versatz of [0, -86400000]) {
    const zeiten = sonnenzeiten(lat, lon, datumStr(jetzt + versatz), winkel);
    if (!zeiten) continue;
    const auf = zeiten.auf.getTime();
    if (auf <= jetzt && (beste === null || auf > beste)) beste = auf;
  }
  return beste;
}


export function tagesendeEntscheidung(lage: TagesendeLage): TagesendeEntscheidung {
  const { jetzt, position, fahrtBegonnen, unterwegs, letzterVermerk } = lage;
  if (!position) return 'nichts';

  
  if (sonnenhoehe(position.lat, position.lon, new Date(jetzt)) >= DAEMMERUNGSWINKEL.buergerlich) {
    return 'nichts';
  }

  const daemmerung = letzteDaemmerung(position.lat, position.lon, jetzt);
  
  
  if (daemmerung === null) return 'nichts';

  
  
  if (fahrtBegonnen >= daemmerung - DAEMMERUNG_SPIEL_MS) return 'nichts';

  if (unterwegs) {
    return letzterVermerk !== null && letzterVermerk >= daemmerung ? 'nichts' : 'unter-fahrt';
  }
  return 'abschliessen';
}


export function letzterVermerkAusLog(
  eintraege: readonly { fahrt: string; t: number; art: string }[], fahrtId: string, imSpeicher: number | null = null,
): number | null {
  let t = imSpeicher;
  for (const e of eintraege) if (e.fahrt === fahrtId && e.art === 'tagesende' && (t === null || e.t > t)) t = e.t;
  return t;
}


export function ersteDaemmerungNach(lat: number, lon: number, t: number): number | null {
  const winkel = DAEMMERUNGSWINKEL.buergerlich;
  for (const versatz of [0, 86400000, 2 * 86400000]) {
    const zeiten = sonnenzeiten(lat, lon, datumStr(t + versatz), winkel);
    if (!zeiten) continue;
    const unter = zeiten.unter.getTime();
    if (unter > t) return unter;
  }
  return null;
}

export interface NachholLage {
  jetzt: number;
  position: { lat: number; lon: number } | null;
  fahrtBegonnen: number;
  
  lagSeit: number | null;
  
  letzterFix?: number | null;
}


export const SPUR_STILL_NACH_DAEMMERUNG_MS = 60 * 60_000;


export function spurSchweigtSeitDaemmerung(
  letzterFix: number | null | undefined, position: { lat: number; lon: number } | null, jetzt: number,
  mindestensMs = 0,
): number | null {
  if (letzterFix == null || !position) return null;
  const daemmerung = ersteDaemmerungNach(position.lat, position.lon, letzterFix);
  if (daemmerung === null || daemmerung > jetzt) return null;
  return jetzt - Math.max(letzterFix, daemmerung) >= mindestensMs ? letzterFix : null;
}


export const SCHWEIGEN_ORTSWECHSEL_NM = 1;


export function lagWaehrendSchweigen(
  letzter: { lat: number; lon: number }, neu: { lat: number; lon: number },
): boolean {
  return distNM(letzter.lat, letzter.lon, neu.lat, neu.lon) <= SCHWEIGEN_ORTSWECHSEL_NM;
}


export function nachzuholenderTagesabschluss(lage: NachholLage): { ende: number; neuBeginn: number } | null {
  const { jetzt, position, fahrtBegonnen } = lage;
  
  
  const lagSeit = lage.lagSeit ?? spurSchweigtSeitDaemmerung(lage.letzterFix, position, jetzt);
  if (!position || lagSeit === null) return null;
  const letzte = letzteDaemmerung(position.lat, position.lon, jetzt);
  if (letzte === null || fahrtBegonnen >= letzte - DAEMMERUNG_SPIEL_MS) return null;
  const ende = ersteDaemmerungNach(position.lat, position.lon, Math.max(lagSeit, fahrtBegonnen));
  if (ende === null || ende > jetzt) return null;
  return { ende, neuBeginn: Math.max(letzte, ende) };
}


export function naechsterSonnenwechsel(
  lat: number, lon: number, jetzt: number,
): { art: 'unter' | 'auf'; t: number } | null {
  const winkel = DAEMMERUNGSWINKEL.sonne;
  let unter: number | null = null;
  let auf: number | null = null;
  for (const versatz of [-86400000, 0, 86400000, 2 * 86400000]) {
    const zeiten = sonnenzeiten(lat, lon, datumStr(jetzt + versatz), winkel);
    if (!zeiten) continue;
    const u = zeiten.unter.getTime();
    const a = zeiten.auf.getTime();
    if (u > jetzt && (unter === null || u < unter)) unter = u;
    if (a > jetzt && (auf === null || a < auf)) auf = a;
  }
  if (unter === null && auf === null) return null;
  
  if (unter !== null && (auf === null || unter < auf)) return { art: 'unter', t: unter };
  return { art: 'auf', t: auf! };
}


export const ANGELEGT_FRAGE_NACH_S = 30 * 60;

export const ANGELEGT_RUHE_NACH_NEIN_MS = 60 * 60_000;


export function angelegtFrageFaellig(lage: {
  laeuft: boolean; stillstandS: number; jetzt: number; ruheBis: number; frageOffen: boolean;
}): boolean {
  return lage.laeuft && !lage.frageOffen && lage.jetzt >= lage.ruheBis && lage.stillstandS >= ANGELEGT_FRAGE_NACH_S;
}
