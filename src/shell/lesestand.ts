import { API_BASIS } from './api';

const DB_NAME = 'sail-suite-lesestand';
const STORE = 'antworten';
const BESITZER = '__besitzer';

interface Eintrag { zeit: number; daten: unknown }

let aktiv = false;
let bereit: Promise<void> = Promise.resolve();
const hoerer = new Set<(zeit: number) => void>();

let aeltester: number | null = null;

function oeffne(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const anf = indexedDB.open(DB_NAME, 1);
      anf.onupgradeneeded = () => anf.result.createObjectStore(STORE);
      anf.onsuccess = () => res(anf.result);
      anf.onerror = () => res(null);
      anf.onblocked = () => res(null);
    } catch {
      res(null);
    }
  });
}

async function mitStore<T>(modus: IDBTransactionMode, tu: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await oeffne();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const tx = db.transaction(STORE, modus);
      const anf = tu(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); res(anf.result ?? null); };
      tx.onerror = () => { db.close(); res(null); };
      tx.onabort = () => { db.close(); res(null); };
    } catch {
      db.close();
      res(null);
    }
  });
}

async function pruefeBesitzer(): Promise<void> {
  let konto: string | null = null;
  try {
    const res = await fetch(`${API_BASIS}/api/me`, { credentials: 'include', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const j = await res.json() as { email?: string | null; username?: string | null };
    konto = j.email ?? j.username ?? null;
  } catch {
    return;
  }
  if (!konto) return;
  const bisher = await mitStore<unknown>('readonly', (s) => s.get(BESITZER));
  if (bisher === konto) return;
  await mitStore('readwrite', (s) => s.clear());
  await mitStore('readwrite', (s) => s.put(konto, BESITZER));
}

export function aktiviereLesestand(): void {
  if (aktiv) return;
  aktiv = true;
  bereit = pruefeBesitzer().catch(() => {});
}

export function lesestandAktiv(): boolean {
  return aktiv;
}

export const vorlaeufigUnbekannt = (status: number): boolean => status >= 500 || status === 429;

export function merkeLesestand(schluessel: string, daten: unknown): void {
  if (!aktiv || daten === null || daten === undefined) return;
  void bereit.then(() => mitStore('readwrite', (s) => s.put({ zeit: Date.now(), daten } satisfies Eintrag, schluessel)));
}

export async function lesestandRueckfall<T>(schluessel: string): Promise<T | null> {
  if (!aktiv) return null;
  await bereit;
  const e = await mitStore<Eintrag | undefined>('readonly', (s) => s.get(schluessel) as IDBRequest<Eintrag | undefined>);
  if (!e || typeof e.zeit !== 'number') return null;
  if (aeltester === null || e.zeit < aeltester) aeltester = e.zeit;
  for (const h of hoerer) h(aeltester);
  return e.daten as T;
}

export function aufLesestand(hoerer_: (zeit: number) => void): void {
  hoerer.add(hoerer_);
  if (aeltester !== null) hoerer_(aeltester);
}

export function loescheLesestand(): Promise<void> {
  return new Promise((res) => {
    try {
      const anf = indexedDB.deleteDatabase(DB_NAME);
      anf.onsuccess = () => res();
      anf.onerror = () => res();
      anf.onblocked = () => res();
    } catch {
      res();
    }
  });
}
