const DB_NAME = 'leinen-los-tiefe';
const DB_VERSION = 1;
const STORE = 'profile';

export const MAX_EINTRAEGE = 60;

export interface TiefeEintrag<T> {
  wert: T;

  benutzt: number;
}

function verfuegbar(): boolean {
  return typeof indexedDB !== 'undefined';
}

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;

function oeffne(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (offen) return offen;
  offen = new Promise((res) => {
    if (!verfuegbar()) { res(null); return; }
    let anfrage: IDBOpenDBRequest;
    try {
      anfrage = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      res(null);
      return;
    }
    anfrage.onupgradeneeded = () => {
      const d = anfrage.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    };
    anfrage.onsuccess = () => { db = anfrage.result; res(db); };
    anfrage.onerror = () => res(null);
    anfrage.onblocked = () => res(null);
  });
  return offen;
}

export function schluessel(linie: string): string {

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < linie.length; i++) {
    const c = linie.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return (h1 >>> 0).toString(36) + '-' + (h2 >>> 0).toString(36) + '-' + linie.length.toString(36);
}

export async function ausCache<T>(id: string): Promise<T | null> {
  const d = await oeffne();
  if (!d) return null;
  try {
    const eintrag = await new Promise<TiefeEintrag<T> | undefined>((res, rej) => {
      const q = d.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      q.onsuccess = () => res(q.result as TiefeEintrag<T> | undefined);
      q.onerror = () => rej(q.error);
    });
    if (!eintrag) return null;

    void inCache(id, eintrag.wert).catch(() => {  });
    return eintrag.wert;
  } catch {
    return null;
  }
}

export async function inCache<T>(id: string, wert: T): Promise<void> {
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ wert, benutzt: Date.now() } satisfies TiefeEintrag<T>, id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    await aufraeumen(d);
  } catch {

  }
}

async function aufraeumen(d: IDBDatabase): Promise<void> {
  const schluessel = await new Promise<IDBValidKey[]>((res, rej) => {
    const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  if (schluessel.length <= MAX_EINTRAEGE) return;

  const alle = await new Promise<TiefeEintrag<unknown>[]>((res, rej) => {
    const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    q.onsuccess = () => res(q.result as TiefeEintrag<unknown>[]);
    q.onerror = () => rej(q.error);
  });
  const paare = schluessel.map((k, i) => ({ k, benutzt: alle[i]?.benutzt ?? 0 }))
    .sort((a, b) => a.benutzt - b.benutzt);
  const weg = paare.slice(0, paare.length - MAX_EINTRAEGE);
  const tx = d.transaction(STORE, 'readwrite');
  for (const p of weg) tx.objectStore(STORE).delete(p.k);
  await new Promise((res) => { tx.oncomplete = res; tx.onerror = res; });
}

export function _verbindungVergessen(): void {
  db = null;
  offen = null;
}
