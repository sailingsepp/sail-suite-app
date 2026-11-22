import { ortsangabeLogbuch } from '@/data/places';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { aktuelleSprache } from '@/shell/sprache';



const MAX = 20;
const ERNEUT_MS = 2 * 60_000;

type Eintrag = { name: string | null; vollstaendig: boolean };
let speicher: Record<string, Eintrag> | null = null;
const laeuft = new Set<string>();
const versucht = new Map<string, number>();
const hoerer: (() => void)[] = [];

function lies(): Record<string, Eintrag> {
  if (speicher) return speicher;
  try { speicher = JSON.parse(localStorage.getItem(SCHLUESSEL.zielNamen) ?? '{}') as Record<string, Eintrag>; } catch { speicher = {}; }
  return speicher;
}

function merke(k: string, e: Eintrag): void {
  const s = lies();
  delete s[k];
  s[k] = e;
  const schluessel = Object.keys(s);
  for (const alt of schluessel.slice(0, Math.max(0, schluessel.length - MAX))) delete s[alt];
  try { localStorage.setItem(SCHLUESSEL.zielNamen, JSON.stringify(s)); } catch {  }
}


export function beiZielname(fn: () => void): void { hoerer.push(fn); }


export function zielname(lat: number, lon: number): string | null {
  const sprache = aktuelleSprache();
  
  const k = `${lat.toFixed(4)},${lon.toFixed(4)},${sprache},2`;
  const e = lies()[k];
  if ((!e || !e.vollstaendig) && !laeuft.has(k) && Date.now() - (versucht.get(k) ?? 0) >= ERNEUT_MS) {
    laeuft.add(k);
    versucht.set(k, Date.now());
    void ortsangabeLogbuch({ lat, lon }, sprache)
      .then((r) => {
        
        if (r.name || r.vollstaendig) merke(k, { name: r.name ?? e?.name ?? null, vollstaendig: r.vollstaendig });
        for (const fn of hoerer) fn();
      })
      .catch(() => {  })
      .finally(() => laeuft.delete(k));
  }
  return e?.name ?? null;
}
