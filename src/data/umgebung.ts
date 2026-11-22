import type { Punkt } from '@/core/types';
import type { VorrechnungManifest } from '@/core/vorrechnung';
import { decktUmkreis, type UmgebungPaket } from '@/core/umgebung';
import { API_BASIS } from '@/shell/api';

const DB_NAME = 'sail-suite-umgebung';
const DB_VERSION = 1;
const STORE = 'pakete';

let db: IDBDatabase | null = null;
let offen: Promise<IDBDatabase | null> | null = null;

const geladen = new Map<string, UmgebungPaket>();

const abgeglichen = new Map<string, Promise<UmgebungPaket | null>>();
let manifestLauf: Promise<VorrechnungManifest | null> | null = null;
let alleLokal: Promise<UmgebungPaket[]> | null = null;

function oeffne(): Promise<IDBDatabase | null> {
  if (db) return Promise.resolve(db);
  if (offen) return offen;
  offen = new Promise((res) => {
    if (typeof indexedDB === 'undefined') { res(null); return; }
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

function alleAusSpeicher(): Promise<UmgebungPaket[]> {
  if (alleLokal) return alleLokal;
  alleLokal = (async () => {
    const d = await oeffne();
    if (!d) return [];
    try {
      return await new Promise<UmgebungPaket[]>((res, rej) => {
        const q = d.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        q.onsuccess = () => res((q.result as UmgebungPaket[] | undefined) ?? []);
        q.onerror = () => rej(q.error);
      });
    } catch {
      return [];
    }
  })();
  return alleLokal;
}

async function lege(p: UmgebungPaket): Promise<void> {
  geladen.set(p.revier, p);
  alleLokal = null;
  const d = await oeffne();
  if (!d) return;
  try {
    await new Promise<void>((res, rej) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(p, p.revier);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {

  }
}

export async function umgebungLokal(punkt: Punkt, radiusM: number): Promise<UmgebungPaket | null> {
  for (const p of geladen.values()) if (decktUmkreis(p, punkt, radiusM)) return p;
  for (const p of await alleAusSpeicher()) {
    if (decktUmkreis(p, punkt, radiusM)) {
      geladen.set(p.revier, p);
      return p;
    }
  }
  return null;
}

function holeManifest(): Promise<VorrechnungManifest | null> {
  if (manifestLauf) return manifestLauf;
  manifestLauf = (async () => {
    try {
      const r = await fetch(`${API_BASIS}/api/vorrechnung/manifest`, { signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return null;
      return (await r.json()) as VorrechnungManifest;
    } catch {
      return null;
    }
  })().then((m) => {
    if (!m) manifestLauf = null;
    return m;
  });
  return manifestLauf;
}

export async function ladeUmgebungFuer(punkt: Punkt, radiusM = 0): Promise<UmgebungPaket | null> {
  const m = await holeManifest();
  const eintrag = m?.reviere.find((r) => r.umgebung && decktUmkreis({ bbox: r.bbox }, punkt, radiusM));
  if (!eintrag?.umgebung) return null;
  const id = eintrag.id;
  const lauf = abgeglichen.get(id);
  if (lauf) return lauf;
  const neu = (async () => {
    const vorhanden = geladen.get(id) ?? (await alleAusSpeicher()).find((p) => p.revier === id) ?? null;
    if (vorhanden && vorhanden.erstellt >= (eintrag.umgebungErstellt ?? '')) return vorhanden;
    try {
      const datei = eintrag.umgebung!.replace(/\.json$/, '');
      const r = await fetch(`${API_BASIS}/api/vorrechnung/${encodeURIComponent(datei)}`, { signal: AbortSignal.timeout(60_000) });
      if (!r.ok) return vorhanden;
      const p = (await r.json()) as UmgebungPaket;
      if (!Array.isArray(p.elemente) || !Array.isArray(p.orte)) return vorhanden;
      await lege(p);
      return p;
    } catch {
      return vorhanden;
    }
  })();
  abgeglichen.set(id, neu);
  neu.then((p) => { if (!p) abgeglichen.delete(id); }, () => abgeglichen.delete(id));
  return neu;
}

export async function umgebungFuerUmkreis(punkt: Punkt, radiusM: number): Promise<UmgebungPaket | null> {
  return (await umgebungLokal(punkt, radiusM)) ?? (await ladeUmgebungFuer(punkt, radiusM));
}
