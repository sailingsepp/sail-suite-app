import type { Kurs } from '@/core/bordkasse';
import { SCHLUESSEL } from '@/shell/speicherschluessel';

const BASIS = 'https://api.frankfurter.dev/v2/rates';

type Ablage = Record<string, Record<string, Kurs>>;

function liesAblage(): Ablage {
  try {
    const s = JSON.parse(localStorage.getItem(SCHLUESSEL.wechselkurse) ?? '{}') as unknown;
    return s && typeof s === 'object' && !Array.isArray(s) ? (s as Ablage) : {};
  } catch { return {}; }
}
function merke(waehrung: string, gefragt: string, k: Kurs): void {
  try {
    const a = liesAblage();
    const je = a[waehrung] ?? {};
    je[gefragt] = k;

    a[waehrung] = Object.fromEntries(Object.entries(je).sort(([x], [y]) => y.localeCompare(x)).slice(0, 60));
    localStorage.setItem(SCHLUESSEL.wechselkurse, JSON.stringify(a));
  } catch {  }
}

export function gemerkterKurs(waehrung: string, bis: string): Kurs | null {
  const je = liesAblage()[waehrung];
  if (!je) return null;
  const tag = Object.keys(je).filter((d) => d <= bis).sort().at(-1);
  return tag ? je[tag]! : null;
}

const laufend = new Map<string, Promise<Kurs | null>>();

export async function holeKurs(waehrung: string, datum: string): Promise<Kurs | null> {
  if (waehrung === 'EUR') return { eurJe: 1, datum };
  const genau = liesAblage()[waehrung]?.[datum];
  if (genau) return genau;
  const schluessel = `${waehrung}|${datum}`;
  if (!laufend.has(schluessel)) {
    laufend.set(schluessel, (async () => {
      try {
        const url = `${BASIS}?base=EUR&quotes=${encodeURIComponent(waehrung)}&date=${datum}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!r.ok) return null;
        const zeilen = (await r.json()) as { date?: string; quote?: string; rate?: number }[];
        const z = Array.isArray(zeilen) ? zeilen.find((x) => x.quote === waehrung) : undefined;
        if (!z || typeof z.rate !== 'number' || !(z.rate > 0) || typeof z.date !== 'string') return null;
        const k: Kurs = { eurJe: z.rate, datum: z.date.slice(0, 10) };
        merke(waehrung, datum, k);
        return k;
      } catch { return null; } finally { laufend.delete(schluessel); }
    })());
  }
  return (await laufend.get(schluessel)!) ?? gemerkterKurs(waehrung, datum);
}
