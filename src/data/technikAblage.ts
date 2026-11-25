export type Geraet =
  | 'funk' | 'plotter' | 'autopilot' | 'instrumente' | 'motor' | 'elektrik' | 'versorgung' | 'sonstiges';
export const GERAETE: readonly Geraet[] = ['funk', 'plotter', 'autopilot', 'instrumente', 'motor', 'elektrik', 'versorgung', 'sonstiges'];

export interface Handbuch {
  id: string;
  titel: string;
  geraet: Geraet;

  yacht: string;
  dateiname: string;
  bytes: number;
  seiten: number;

  seitenNamen?: string[] | null;

  ohneText: number;
  angelegt: number;
}

export interface SeitenEintrag { handbuch: string; seite: number; text: string }

const DB_NAME = 'sail-suite-technik';
const DB_VERSION = 1;

let offen: Promise<IDBDatabase | null> | null = null;

function oeffne(): Promise<IDBDatabase | null> {
  if (offen) return offen;
  offen = new Promise((res) => {
    if (typeof indexedDB === 'undefined') { res(null); return; }
    let q: IDBOpenDBRequest;
    try { q = indexedDB.open(DB_NAME, DB_VERSION); } catch { res(null); return; }
    q.onupgradeneeded = () => {
      const d = q.result;
      if (!d.objectStoreNames.contains('handbuecher')) d.createObjectStore('handbuecher', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('seiten')) {
        const s = d.createObjectStore('seiten', { keyPath: ['handbuch', 'seite'] });
        s.createIndex('handbuch', 'handbuch');
      }
      if (!d.objectStoreNames.contains('dateien')) d.createObjectStore('dateien', { keyPath: 'id' });
    };
    q.onsuccess = () => res(q.result);
    q.onerror = () => res(null);
    q.onblocked = () => res(null);
  });
  return offen;
}

function alle<T>(d: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((res) => {
    try {
      const q = d.transaction(store, 'readonly').objectStore(store).getAll();
      q.onsuccess = () => res(q.result as T[]);
      q.onerror = () => res([]);
    } catch { res([]); }
  });
}

export async function ladeHandbuecher(): Promise<Handbuch[]> {
  const d = await oeffne();
  if (!d) return [];
  return (await alle<Handbuch>(d, 'handbuecher')).sort((a, b) => a.titel.localeCompare(b.titel));
}

export async function ladeAlleSeiten(): Promise<SeitenEintrag[]> {
  const d = await oeffne();
  if (!d) return [];
  return alle<SeitenEintrag>(d, 'seiten');
}

export async function ladeDatei(id: string): Promise<Blob | null> {
  const d = await oeffne();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const q = d.transaction('dateien', 'readonly').objectStore('dateien').get(id);
      q.onsuccess = () => res((q.result as { blob?: Blob } | undefined)?.blob ?? null);
      q.onerror = () => res(null);
    } catch { res(null); }
  });
}

export async function speichereHandbuch(h: Handbuch, seiten: SeitenEintrag[], blob: Blob): Promise<boolean> {
  const d = await oeffne();
  if (!d) return false;
  return new Promise((res) => {
    try {
      const tx = d.transaction(['handbuecher', 'seiten', 'dateien'], 'readwrite');
      tx.objectStore('handbuecher').put(h);
      const s = tx.objectStore('seiten');
      for (const e of seiten) s.put(e);
      tx.objectStore('dateien').put({ id: h.id, blob });
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
      tx.onabort = () => res(false);
    } catch { res(false); }
  });
}

export async function aendereHandbuch(h: Handbuch): Promise<boolean> {
  const d = await oeffne();
  if (!d) return false;
  return new Promise((res) => {
    try {
      const tx = d.transaction('handbuecher', 'readwrite');
      tx.objectStore('handbuecher').put(h);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    } catch { res(false); }
  });
}

export async function loescheHandbuch(id: string): Promise<boolean> {
  const d = await oeffne();
  if (!d) return false;
  return new Promise((res) => {
    try {
      const tx = d.transaction(['handbuecher', 'seiten', 'dateien'], 'readwrite');
      tx.objectStore('handbuecher').delete(id);
      tx.objectStore('dateien').delete(id);
      tx.objectStore('seiten').delete(IDBKeyRange.bound([id, -Infinity], [id, Infinity]));
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    } catch { res(false); }
  });
}

export function handbuchKennung(t = Date.now(), zufall: () => number = Math.random): string {
  const z = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += z[Math.floor(zufall() * z.length)];
  return 'h' + t.toString(36) + '-' + s;
}

export function geraetVorschlag(dateiname: string): Geraet {
  const n = dateiname.toLowerCase();
  const passt = (...w: string[]) => w.some((x) => n.includes(x));
  if (passt('vhf', 'ukw', 'radio', 'funk', 'dsc', 'gx', 'ais')) return 'funk';
  if (passt('autopilot', 'pilot', 'evolution', 'ev-')) return 'autopilot';
  if (passt('plotter', 'chart', 'mfd', 'axiom', 'zeus', 'vulcan', 'gpsmap', 'echomap', 'navigat')) return 'plotter';
  if (passt('motor', 'engine', 'volvo', 'yanmar', 'nanni', 'diesel', 'outboard', 'aussenborder')) return 'motor';
  if (passt('watermaker', 'wassermacher', 'toilet', 'heater', 'webasto', 'eberspaecher', 'fridge', 'pump', 'windlass', 'ankerwinde')) return 'versorgung';
  if (passt('wind', 'instrument', 'depth', 'echolot', 'speed', 'tacktick', 'triton', 'i70')) return 'instrumente';
  if (passt('batter', 'inverter', 'charger', 'victron', 'mastervolt', 'solar', 'elektr', 'electric')) return 'elektrik';
  return 'sonstiges';
}
