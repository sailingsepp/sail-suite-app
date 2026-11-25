import { API_BASIS } from '@/shell/api';

export type Netzlage = 'online' | 'offline';

const PROBE = `${API_BASIS}/api/health`;

const PROBE_ABSTAND_MS = 30_000;

const FEHLSCHLAEGE_BIS_OFFLINE = 2;

let lage: Netzlage = 'online';
let fehlschlaege = 0;
let letzteProbe = 0;
let probeLaeuft = false;
const hoerer = new Set<(l: Netzlage) => void>();

function setze(neu: Netzlage): void {
  if (neu === lage) return;
  lage = neu;
  for (const h of hoerer) h(lage);
}

export function meldeErfolg(): void {
  fehlschlaege = 0;
  setze('online');
}

export function meldeFehlschlag(): void {
  fehlschlaege++;
  if (fehlschlaege >= FEHLSCHLAEGE_BIS_OFFLINE) setze('offline');
}

export async function probe(erzwingen = false): Promise<Netzlage> {
  const jetzt = Date.now();
  if (probeLaeuft || (!erzwingen && jetzt - letzteProbe < PROBE_ABSTAND_MS)) return lage;
  probeLaeuft = true;
  letzteProbe = jetzt;
  try {
    const abbruch = new AbortController();
    const uhr = setTimeout(() => abbruch.abort(), 6000);
    await fetch(PROBE, { mode: 'no-cors', cache: 'no-store', signal: abbruch.signal });
    clearTimeout(uhr);
    meldeErfolg();
  } catch {
    meldeFehlschlag();
  } finally {
    probeLaeuft = false;
  }
  return lage;
}

export function netzlage(): Netzlage {
  return lage;
}

export function istOnline(): boolean {
  return lage === 'online';
}

export function aufNetzwechsel(fn: (l: Netzlage) => void): void {
  hoerer.add(fn);
  fn(lage);
}

export async function mitNetzlage<T>(aufruf: () => Promise<T>): Promise<T> {
  try {
    const raus = await aufruf();
    meldeErfolg();
    return raus;
  } catch (fehler) {
    meldeFehlschlag();
    throw fehler;
  }
}

export function initNetz(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => void probe(true));
  window.addEventListener('offline', () => {

    fehlschlaege = FEHLSCHLAEGE_BIS_OFFLINE;
    setze('offline');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void probe();
  });
  if (navigator.onLine === false) setze('offline');
  void probe(true);
}
