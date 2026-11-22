import type { Tankvorgang } from '@/core/tankvorgaenge';
import type { Fix } from '@/core/spur';
import { ergaenzeAblesung, type Motorablesung } from '@/core/motorstunden';
import type { Liegeart } from '@/core/logbuchText';

import { geraeteZone } from '@/core/time';
import { opakeKachelnRaeumen } from './kachelnRaeumen';



const DB_NAME = 'sail-suite-trackbook';

const DB_NAME_ALT = 'sailwise-trackbook';
const DB_VERSION = 4;

const MIGRATIONS_MARKE = '_migriert_von_sailwise_2026-08';


export interface Toern {
  id: string;
  name: string;
  beschreibung?: string;
  
  revier?: string;
  
  von?: string;
  bis?: string;
  schiff: Schiff;
  crew: CrewMitglied[];
  angelegt: number;
  
  beendet?: number;
  
  unterschriften?: { skipper?: string; bewerber?: string };
  
  motorstunden?: Motorablesung[];
  
  dieselGetanktL?: number;
  
  tankvorgaenge?: Tankvorgang[];
}


export interface Schiff {
  name?: string;
  
  typ?: string;
  
  mmsi?: string;
  
  flagge?: string;
  
  polarId?: string;
  
  polarGuete?: 'exakt' | 'aehnlich' | 'geschaetzt';
  segeljacht?: boolean;
  
  laengeM?: number;
  
  lwlM?: number;
  breiteM?: number;
  tiefgangM?: number;
  
  verdraengungT?: number;
  segelflaecheM2?: number;
  motorPS?: number;
  baujahr?: number;
}


export interface CrewMitglied {
  vorname: string;
  nachname: string;
  funktion: 'skipper' | 'co-skipper' | 'navigator' | 'smutje' | 'deckshand' | 'pax';
  
  funktionForm?: 'w' | 'm' | null;
  
  ausweis?: string;
  anBordSeit?: number;
  anBordBis?: number;
}


export { istWachfaehig } from '@/core/bereitschaft';


export interface Ortsmarke {
  id?: number;
  fahrt: string;
  
  art: 'start' | 'ziel' | 'pause';
  t: number;
  lat: number;
  lon: number;
  
  name?: string;
  
  versucht?: number;
  
  nameForm?: number;
}


export interface Fahrt {
  id: string;
  
  toern?: string;
  
  begonnen: number;
  
  zeitzone?: string;
  
  beendet: number | null;
  
  name?: string;
  
  ziel?: string;
  
  antrieb?: 'segel' | 'motor';
  
  streckeNM?: number;
  
  antriebNachAblegen?: 'segel' | 'motor';
  
  wache?: string;
  
  
  wetterkopf?: { t: number; text: string; ort?: string; ab?: number };
  
  ankerwache?: { lat: number; lon: number; radiusM: number } | null;
  
  manuellePausen?: { von: number; bis: number }[];
  
  geloeschteEintraege?: string[];
  
  manuellePauseSeit?: number;
  
  offeneUebernachtung?: {
    von: number; lat: number | null; lon: number | null; ankerwache: boolean;
    
    eintragT?: number;
    
    liegeart?: Liegeart;
  } | null;
}

export type EintragArt =
  | 'hand'
  | 'start'
  | 'ziel'
  | 'ankern'
  | 'anlegen'
  | 'liegeplatz'
  | 'ankerplatz'
  | 'kurswechsel'
  | 'fahrtwechsel'
  
  | 'standort'
  
  | 'aufschiesser'
  
  | 'treiben'
  | 'antrieb'
  | 'wetter'
  | 'foto'
  | 'import'
  | 'luecke'
  
  | 'ais'
  
  | 'ankerwache'
  
  | 'tagesende'
  
  | 'navigation'
  
  | 'mob'
  
  | 'tanken';


export interface Bild {
  id: string;
  fahrt: string;
  t: number;
  
  blob: Blob;
  breite: number;
  hoehe: number;
  bytes: number;
}



export interface AisAngabe {
  quelle: 'ais';
  
  mmsi: number;
  name?: string;
  
  typ?: number;
  
  ziel?: string;
  
  sogKn?: number;
  
  cog?: number;
  
  abstandNM?: number;
  peilung?: number;
  
  cpaNM?: number;
  tcpaMin?: number;
  
  gemeldet?: number;
}


export interface AnkerwacheAngabe {
  
  abstandM: number;
  
  peilung: number;
  radiusM: number;
}

export interface WetterAngabe {
  quelle: 'vorhersage' | 'beobachtet';
  
  windKn?: number;
  
  windAus?: number;
  boeKn?: number;
  
  welleM?: number;
  wellePeriodeS?: number;
  
  modell?: string;
  abgerufen?: number;
}


export interface LogEintrag {
  
  id?: number;
  fahrt: string;
  t: number;
  art: EintragArt;
  lat: number | null;
  lon: number | null;
  text?: string;
  
  wetter?: WetterAngabe;
  
  bild?: string;
  
  ais?: AisAngabe;
  
  ankerwache?: AnkerwacheAngabe;
  
  liegeart?: Liegeart;
  
  bearbeitet?: true;
}




export function neueFahrtId(t: number, zufall: () => number = Math.random): string {
  const iso = new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  
  
  
  const buchstaben = 'abcdefghijkmnpqrstuvwxyz23456789';
  let schwanz = '';
  for (let i = 0; i < 4; i++) schwanz += buchstaben[Math.floor(zufall() * buchstaben.length)];
  return iso + '-' + schwanz;
}


export function laufendeAus(fahrten: Fahrt[]): Fahrt | null {
  const offen = fahrten.filter((f) => f.beendet === null);
  if (!offen.length) return null;
  return offen.reduce((a, b) => (b.begonnen > a.begonnen ? b : a));
}

export type SpeicherLage = 'ok' | 'knapp' | 'kritisch';


export function speicherLage(belegt: number, kontingent: number): SpeicherLage {
  if (!kontingent || !Number.isFinite(kontingent)) return 'ok';
  const anteil = belegt / kontingent;
  if (anteil >= 0.95) return 'kritisch';
  if (anteil >= 0.8) return 'knapp';
  return 'ok';
}


export const BYTE_JE_FIX = 120;
export function reichweiteStunden(frei: number, fixeJeSekunde = 1): number {
  if (frei <= 0) return 0;
  return frei / (BYTE_JE_FIX * fixeJeSekunde * 3600);
}



export function speicherVerfuegbar(): boolean {
  return typeof indexedDB !== 'undefined';
}

let db: IDBDatabase | null = null;

function anfrage<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function oeffneLog(): Promise<IDBDatabase> {
  if (db) return db;
  const geoeffnet = await new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('fahrten')) {
        d.createObjectStore('fahrten', { keyPath: 'id' });
      }
      
      
      
      if (!d.objectStoreNames.contains('toerne')) {
        d.createObjectStore('toerne', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('fixe')) {
        
        
        
        
        const s = d.createObjectStore('fixe', { autoIncrement: true });
        s.createIndex('fahrt_t', ['fahrt', 't']);
      }
      if (!d.objectStoreNames.contains('eintraege')) {
        const s = d.createObjectStore('eintraege', { keyPath: 'id', autoIncrement: true });
        s.createIndex('fahrt_t', ['fahrt', 't']);
      }
      
      if (!d.objectStoreNames.contains('orte')) {
        const s = d.createObjectStore('orte', { keyPath: 'id', autoIncrement: true });
        s.createIndex('fahrt_t', ['fahrt', 't']);
      }
      
      
      
      
      if (!d.objectStoreNames.contains('bilder')) {
        const s = d.createObjectStore('bilder', { keyPath: 'id' });
        s.createIndex('fahrt_t', ['fahrt', 't']);
      }
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  await migriereAltenNamenFallsNoetig(geoeffnet);
  db = geoeffnet;
  return db;
}


const STORES_MIT_KEYPATH = ['fahrten', 'toerne', 'eintraege', 'orte', 'bilder'] as const;

const STORES_OHNE_KEYPATH = ['fixe', 'meta'] as const;


async function migriereAltenNamenFallsNoetig(neu: IDBDatabase): Promise<void> {
  const marke = await anfrage(
    neu.transaction('meta').objectStore('meta').get(MIGRATIONS_MARKE) as IDBRequest<boolean | undefined>,
  );
  if (marke) return;

  
  
  
  
  
  
  
  if (typeof indexedDB.databases === 'function') {
    const alle = await indexedDB.databases();
    if (alle.some((eintrag) => eintrag.name === DB_NAME_ALT)) {
      await kopiereAlteAblage(neu);
      await new Promise<void>((res, rej) => {
        const r = indexedDB.deleteDatabase(DB_NAME_ALT);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
        
        
        
        
      });
    }
  }

  await schreibeMigrationsMarke(neu);
}

function schreibeMigrationsMarke(neu: IDBDatabase): Promise<void> {
  const tx = neu.transaction('meta', 'readwrite');
  tx.objectStore('meta').put(true, MIGRATIONS_MARKE);
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function kopiereAlteAblage(neu: IDBDatabase): Promise<void> {
  const alt = await new Promise<IDBDatabase>((res, rej) => {
    
    
    
    const r = indexedDB.open(DB_NAME_ALT);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  try {
    for (const name of STORES_MIT_KEYPATH) {
      if (!alt.objectStoreNames.contains(name) || !neu.objectStoreNames.contains(name)) continue;
      const werte = await anfrage(alt.transaction(name).objectStore(name).getAll() as IDBRequest<unknown[]>);
      if (!werte.length) continue;
      const tx = neu.transaction(name, 'readwrite');
      const store = tx.objectStore(name);
      for (const wert of werte) store.put(wert);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
    for (const name of STORES_OHNE_KEYPATH) {
      if (!alt.objectStoreNames.contains(name) || !neu.objectStoreNames.contains(name)) continue;
      const eintraege = await new Promise<Array<{ schluessel: IDBValidKey; wert: unknown }>>((res, rej) => {
        const ergebnis: Array<{ schluessel: IDBValidKey; wert: unknown }> = [];
        const zeiger = alt.transaction(name).objectStore(name).openCursor();
        zeiger.onsuccess = () => {
          const c = zeiger.result;
          if (c) {
            ergebnis.push({ schluessel: c.primaryKey, wert: c.value as unknown });
            c.continue();
          } else {
            res(ergebnis);
          }
        };
        zeiger.onerror = () => rej(zeiger.error);
      });
      if (!eintraege.length) continue;
      const tx = neu.transaction(name, 'readwrite');
      const store = tx.objectStore(name);
      for (const { schluessel, wert } of eintraege) store.put(wert, schluessel);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    }
  } finally {
    alt.close();
  }
}

interface AbgelegterFix extends Fix {
  fahrt: string;
}


export async function speichereToern(toern: Toern): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('toerne', 'readwrite');
  tx.objectStore('toerne').put(toern);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function aendereToern(id: string, aendern: (t: Toern | null) => Toern | null): Promise<Toern | null> {
  const d = await oeffneLog();
  const tx = d.transaction('toerne', 'readwrite');
  const store = tx.objectStore('toerne');
  let ergebnis: Toern | null = null;
  const anf = store.get(id) as IDBRequest<Toern | undefined>;
  anf.onsuccess = () => {
    const vorher = anf.result ?? null;
    const neu = aendern(vorher);
    if (neu) store.put(neu);
    ergebnis = neu ?? vorher;
  };
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error('Törn nicht geändert'));
  });
  return ergebnis;
}

export async function alleToerne(): Promise<Toern[]> {
  const d = await oeffneLog();
  const alle = await anfrage(d.transaction('toerne').objectStore('toerne').getAll() as IDBRequest<Toern[]>);
  return (alle ?? []).sort((a, b) => b.angelegt - a.angelegt);
}

export async function holeToern(id: string): Promise<Toern | null> {
  const d = await oeffneLog();
  const t = await anfrage(
    d.transaction('toerne').objectStore('toerne').get(id) as IDBRequest<Toern | undefined>,
  );
  return t ?? null;
}


export async function aktuellerToern(): Promise<Toern | null> {
  
  
  
  return (await alleToerne()).find((t) => !t.beendet) ?? null;
}


export async function starteFahrt(t = Date.now(), name?: string, toern?: string): Promise<Fahrt> {
  const d = await oeffneLog();
  const fahrt: Fahrt = {
    id: neueFahrtId(t), begonnen: t, beendet: null,
    ...(name ? { name } : {}), ...(toern ? { toern } : {}),
    ...(geraeteZone() ? { zeitzone: geraeteZone()! } : {}),
  };
  const tx = d.transaction('fahrten', 'readwrite');
  tx.objectStore('fahrten').put(fahrt);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return fahrt;
}

export async function beendeFahrt(id: string, t = Date.now(), streckeNM?: number): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) store.put({ ...fahrt, beendet: t, ...(streckeNM != null && Number.isFinite(streckeNM) ? { streckeNM: Math.round(streckeNM * 10) / 10 } : {}) });
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}



export async function setzeFahrtZiel(id: string, ziel: string): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    
    
    const rest = { ...fahrt };
    delete rest.ziel;
    store.put(ziel ? { ...rest, ziel } : rest);
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function setzeWache(id: string, wache: string): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    const rest = { ...fahrt };
    delete rest.wache;
    store.put(wache ? { ...rest, wache } : rest);
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function setzeAnkerwache(
  id: string, ankerwache: { lat: number; lon: number; radiusM: number } | null,
): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    const rest = { ...fahrt };
    delete rest.ankerwache;
    store.put(ankerwache ? { ...rest, ankerwache } : rest);
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function setzeManuellePauseSeit(id: string, seit: number | null): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    const rest = { ...fahrt };
    delete rest.manuellePauseSeit;
    store.put(seit !== null ? { ...rest, manuellePauseSeit: seit } : rest);
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function schliesseManuellePause(id: string, von: number, bis: number): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    const rest = { ...fahrt };
    delete rest.manuellePauseSeit;
    const manuellePausen = [...(fahrt.manuellePausen ?? []), { von, bis }];
    store.put({ ...rest, manuellePausen });
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function setzeAntriebNachAblegen(id: string, wert: 'segel' | 'motor' | null): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    const rest = { ...fahrt };
    delete rest.antriebNachAblegen;
    store.put(wert ? { ...rest, antriebNachAblegen: wert } : rest);
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function setzeOffeneUebernachtung(
  id: string, wert: NonNullable<Fahrt['offeneUebernachtung']> | null,
): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) {
    const rest = { ...fahrt };
    delete rest.offeneUebernachtung;
    store.put(wert ? { ...rest, offeneUebernachtung: wert } : rest);
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function setzeMotorstand(id: string, stand: number, t = Date.now()): Promise<Toern | null> {
  return aendereToern(id, (toern) => {
    if (!toern) return null;
    
    
    const bisher = toern.motorstunden ?? [];
    const ergaenzt = ergaenzeAblesung(bisher, { t, stand });
    return ergaenzt === bisher ? null : { ...toern, motorstunden: ergaenzt };
  });
}


export async function merke<T>(schluessel: string, wert: T): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('meta', 'readwrite');
  tx.objectStore('meta').put(wert, schluessel);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function gemerkt<T>(schluessel: string): Promise<T | null> {
  const d = await oeffneLog();
  const w = await anfrage(
    d.transaction('meta').objectStore('meta').get(schluessel) as IDBRequest<T | undefined>,
  );
  return w ?? null;
}


export async function setzeWetterkopf(id: string, kopf: NonNullable<Fahrt['wetterkopf']>): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  const fahrt = (await anfrage(store.get(id) as IDBRequest<Fahrt | undefined>)) ?? null;
  if (fahrt) store.put({ ...fahrt, wetterkopf: kopf });
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function laufendeFahrt(): Promise<Fahrt | null> {
  const d = await oeffneLog();
  const alle = await anfrage(d.transaction('fahrten').objectStore('fahrten').getAll() as IDBRequest<Fahrt[]>);
  return laufendeAus(alle ?? []);
}


export async function beendeToern(id: string, t = Date.now()): Promise<void> {
  await aendereToern(id, (toern) => (toern ? { ...toern, beendet: t } : null));
}


export function fehlendeToernZuordnung(
  fahrten: readonly Pick<Fahrt, 'id' | 'toern' | 'begonnen' | 'beendet'>[],
  toernEnde: ReadonlyMap<string, number>,
): Map<string, string> {
  const raus = new Map<string, string>();
  let vorher: { toern: string | null; beendet: number | null } | null = null;
  for (const f of [...fahrten].sort((a, b) => a.begonnen - b.begonnen)) {
    let toern = f.toern ?? null;
    if (!toern && vorher?.toern && vorher.beendet != null && vorher.beendet <= f.begonnen) {
      const ende = toernEnde.get(vorher.toern);
      if (ende === undefined || ende > f.begonnen) {
        toern = vorher.toern;
        raus.set(f.id, toern);
      }
    }
    vorher = { toern, beendet: f.beendet };
  }
  return raus;
}


export async function ordneEtappenToernZu(): Promise<number> {
  const [fahrten, toerne] = await Promise.all([alleFahrten(), alleToerne()]);
  const ende = new Map<string, number>();
  for (const t of toerne) if (t.beendet != null) ende.set(t.id, t.beendet);
  const nachtrag = fehlendeToernZuordnung(fahrten, ende);
  if (nachtrag.size === 0) return 0;
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const store = tx.objectStore('fahrten');
  for (const f of fahrten) {
    const toern = nachtrag.get(f.id);
    if (toern) store.put({ ...f, toern });
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return nachtrag.size;
}


export async function fahrtenZuToern(toern: string): Promise<Fahrt[]> {
  return (await alleFahrten()).filter((f) => f.toern === toern).sort((a, b) => a.begonnen - b.begonnen);
}

export async function alleFahrten(): Promise<Fahrt[]> {
  const d = await oeffneLog();
  const alle = await anfrage(d.transaction('fahrten').objectStore('fahrten').getAll() as IDBRequest<Fahrt[]>);
  return (alle ?? []).sort((a, b) => b.begonnen - a.begonnen);
}


export async function uebernehmeFahrt(fahrt: Fahrt): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  tx.objectStore('fahrten').put(fahrt);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}



export async function schreibeFixe(fahrt: string, fixe: Fix[]): Promise<void> {
  if (!fixe.length) return;
  const d = await oeffneLog();
  const tx = d.transaction('fixe', 'readwrite');
  const store = tx.objectStore('fixe');
  for (const fix of fixe) store.add({ ...fix, fahrt } satisfies AbgelegterFix);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function schreibeFix(fahrt: string, fix: Fix): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fixe', 'readwrite');
  tx.objectStore('fixe').add({ ...fix, fahrt } satisfies AbgelegterFix);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function anzahlFixe(fahrt: string): Promise<number> {
  const d = await oeffneLog();
  const index = d.transaction('fixe').objectStore('fixe').index('fahrt_t');
  return anfrage(index.count(IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity])));
}

export async function ladeFixe(fahrt: string): Promise<Fix[]> {
  const d = await oeffneLog();
  const index = d.transaction('fixe').objectStore('fixe').index('fahrt_t');
  const bereich = IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity]);
  const treffer = await anfrage(index.getAll(bereich) as IDBRequest<AbgelegterFix[]>);
  
  
  
  
  
  return (treffer ?? []).map((t) => {
    const fix: Fix = { t: t.t, lat: t.lat, lon: t.lon, acc: t.acc };
    if (t.speed !== undefined) fix.speed = t.speed;
    if (t.heading !== undefined) fix.heading = t.heading;
    
    
    
    
    if (t.quelle !== undefined) fix.quelle = t.quelle;
    return fix;
  });
}


export async function loescheFehlstart(fahrt: string, fixZeiten: readonly number[], eintragIds: readonly number[]): Promise<void> {
  if (!fixZeiten.length && !eintragIds.length) return;
  const d = await oeffneLog();
  const tx = d.transaction(['fixe', 'eintraege'], 'readwrite');
  const index = tx.objectStore('fixe').index('fahrt_t');
  for (const t of new Set(fixZeiten)) {
    const c = index.openCursor(IDBKeyRange.only([fahrt, t]));
    c.onsuccess = () => {
      const cursor = c.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
  }
  for (const id of eintragIds) tx.objectStore('eintraege').delete(id);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function merkeOrt(marke: Ortsmarke): Promise<void> {
  const vorhanden = await ortsmarken(marke.fahrt);
  if (vorhanden.some((o) => o.art === marke.art && Math.abs(o.t - marke.t) < 60_000)) return;
  const d = await oeffneLog();
  const tx = d.transaction('orte', 'readwrite');
  tx.objectStore('orte').add(marke);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function ortsmarken(fahrt: string): Promise<Ortsmarke[]> {
  const d = await oeffneLog();
  const index = d.transaction('orte').objectStore('orte').index('fahrt_t');
  const bereich = IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity]);
  return (await anfrage(index.getAll(bereich) as IDBRequest<Ortsmarke[]>)) ?? [];
}


export async function orteZurFahrt(
  fahrt: string,
): Promise<{ start?: string; ziel?: string; pausen: Ortsmarke[] }> {
  return orteAusMarken(await ortsmarken(fahrt));
}


export function orteAusMarken(
  marken: Ortsmarke[],
): { start?: string; ziel?: string; pausen: Ortsmarke[] } {
  const raus: { start?: string; ziel?: string; pausen: Ortsmarke[] } = {
    pausen: marken.filter((m) => m.art === 'pause').sort((a, b) => a.t - b.t),
  };
  const start = marken.find((m) => m.art === 'start')?.name;
  const ziel = marken.find((m) => m.art === 'ziel')?.name;
  if (start) raus.start = start;
  if (ziel) raus.ziel = ziel;
  return raus;
}


export async function offeneOrte(): Promise<Ortsmarke[]> {
  const d = await oeffneLog();
  const alle = await anfrage(d.transaction('orte').objectStore('orte').getAll() as IDBRequest<Ortsmarke[]>);
  return (alle ?? []).filter((o) => !o.name);
}


export async function alleOrte(): Promise<Ortsmarke[]> {
  const d = await oeffneLog();
  return (await anfrage(d.transaction('orte').objectStore('orte').getAll() as IDBRequest<Ortsmarke[]>)) ?? [];
}

export async function speichereOrt(marke: Ortsmarke): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('orte', 'readwrite');
  tx.objectStore('orte').put(marke);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function schreibeEintrag(eintrag: LogEintrag): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('eintraege', 'readwrite');
  const q = tx.objectStore('eintraege').add(eintrag);
  
  
  
  
  q.onsuccess = () => { eintrag.id = q.result as number; };
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function aktualisiereEintrag(eintrag: LogEintrag): Promise<void> {
  if (eintrag.id === undefined) return;
  const d = await oeffneLog();
  const tx = d.transaction('eintraege', 'readwrite');
  tx.objectStore('eintraege').put(eintrag);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function loescheEintrag(eintrag: LogEintrag, schluessel: string): Promise<void> {
  if (eintrag.id === undefined) return;
  const d = await oeffneLog();
  const tx = d.transaction(['eintraege', 'fahrten'], 'readwrite');
  tx.objectStore('eintraege').delete(eintrag.id);
  const fahrten = tx.objectStore('fahrten');
  const q = fahrten.get(eintrag.fahrt) as IDBRequest<Fahrt | undefined>;
  q.onsuccess = () => {
    const f = q.result;
    if (!f) return;
    const liste = f.geloeschteEintraege ?? [];
    if (!liste.includes(schluessel)) fahrten.put({ ...f, geloeschteEintraege: [...liste, schluessel] });
  };
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function stelleEintragWieder(eintrag: LogEintrag, schluessel: string): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction(['eintraege', 'fahrten'], 'readwrite');
  tx.objectStore('eintraege').put(eintrag);
  const fahrten = tx.objectStore('fahrten');
  const q = fahrten.get(eintrag.fahrt) as IDBRequest<Fahrt | undefined>;
  q.onsuccess = () => {
    const f = q.result;
    if (f?.geloeschteEintraege?.includes(schluessel)) {
      fahrten.put({ ...f, geloeschteEintraege: f.geloeschteEintraege.filter((x) => x !== schluessel) });
    }
  };
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function vermerkeGeloescht(fahrtId: string, schluessel: string): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('fahrten', 'readwrite');
  const fahrten = tx.objectStore('fahrten');
  const q = fahrten.get(fahrtId) as IDBRequest<Fahrt | undefined>;
  q.onsuccess = () => {
    const f = q.result;
    if (!f) return;
    const liste = f.geloeschteEintraege ?? [];
    if (!liste.includes(schluessel)) fahrten.put({ ...f, geloeschteEintraege: [...liste, schluessel] });
  };
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function loescheBild(id: string): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('bilder', 'readwrite');
  tx.objectStore('bilder').delete(id);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export async function ladeEintraege(fahrt: string): Promise<LogEintrag[]> {
  const d = await oeffneLog();
  const index = d.transaction('eintraege').objectStore('eintraege').index('fahrt_t');
  const bereich = IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity]);
  return (await anfrage(index.getAll(bereich) as IDBRequest<LogEintrag[]>)) ?? [];
}




export async function speichereBild(bild: Bild): Promise<void> {
  const d = await oeffneLog();
  const tx = d.transaction('bilder', 'readwrite');
  tx.objectStore('bilder').put(bild);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}


export async function holeBild(id: string): Promise<Bild | null> {
  const d = await oeffneLog();
  return new Promise((res, rej) => {
    const q = d.transaction('bilder', 'readonly').objectStore('bilder').get(id);
    q.onsuccess = () => res((q.result as Bild | undefined) ?? null);
    q.onerror = () => rej(q.error);
  });
}



export async function bildIdsVon(fahrt: string): Promise<string[]> {
  const d = await oeffneLog();
  const index = d.transaction('bilder', 'readonly').objectStore('bilder').index('fahrt_t');
  const keys = await anfrage(index.getAllKeys(IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity])));
  return (keys ?? []).map(String);
}

export async function bilderVon(fahrt: string): Promise<Bild[]> {
  const d = await oeffneLog();
  return new Promise((res, rej) => {
    const index = d.transaction('bilder', 'readonly').objectStore('bilder').index('fahrt_t');
    const q = index.getAll(IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity]));
    q.onsuccess = () => res(q.result as Bild[]);
    q.onerror = () => rej(q.error);
  });
}

export async function loescheFahrt(fahrt: string): Promise<void> {
  const d = await oeffneLog();
  
  
  
  
  
  const tx = d.transaction(['fahrten', 'fixe', 'eintraege', 'bilder', 'orte'], 'readwrite');
  tx.objectStore('fahrten').delete(fahrt);
  for (const name of ['fixe', 'eintraege', 'bilder', 'orte'] as const) {
    const index = tx.objectStore(name).index('fahrt_t');
    const bereich = IDBKeyRange.bound([fahrt, -Infinity], [fahrt, Infinity]);
    const zeiger = index.openCursor(bereich);
    zeiger.onsuccess = () => {
      const c = zeiger.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
  }
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

export interface SpeicherZustand {
  dauerhaft: boolean;
  belegt: number;
  kontingent: number;
  lage: SpeicherLage;
  
  reichweiteH: number;
}


export async function speicherZustand(
  
  nachRaeumen?: (s: SpeicherZustand) => void,
): Promise<SpeicherZustand> {
  let dauerhaft = false;
  let belegt = 0;
  let kontingent = 0;
  const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (s?.persisted) {
    try {
      dauerhaft = await s.persisted();
      if (!dauerhaft && s.persist) dauerhaft = await s.persist();
    } catch {
      
    }
  }
  const messen = async (): Promise<void> => {
    if (!s?.estimate) return;
    try {
      const e = await s.estimate();
      belegt = e.usage ?? 0;
      kontingent = e.quota ?? 0;
    } catch {
      
    }
  };
  await messen();
  
  
  
  
  if (speicherLage(belegt, kontingent) !== 'ok') {
    void opakeKachelnRaeumen().then((n) => {
      if (n > 0 && nachRaeumen) void speicherZustand().then(nachRaeumen);
    });
  }
  return {
    dauerhaft,
    belegt,
    kontingent,
    lage: speicherLage(belegt, kontingent),
    reichweiteH: reichweiteStunden(kontingent - belegt),
  };
}


export function _verbindungVergessen(): void {
  db = null;
}
