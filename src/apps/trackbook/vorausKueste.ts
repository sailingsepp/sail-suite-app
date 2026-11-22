import { kuestenlinienUmGebiet, BUDGET_INTERAKTIV } from '@/data/overpass';
import type { Punkt } from '@/core/types';




const HALB_GRAD = 0.25;

const PAUSE_MS = 120_000;

interface Ausschnitt { s: number; w: number; n: number; e: number; linien: [Punkt, Punkt][] }

let geladen: Ausschnitt | null = null;
let laedt = false;
let gescheitertBis = 0;
let aufGeladen: () => void = () => {};

export function beiKuesteGeladen(cb: () => void): void {
  aufGeladen = cb;
}

const enthaelt = (a: Ausschnitt, p: Punkt) => p.lat > a.s && p.lat < a.n && p.lon > a.w && p.lon < a.e;


export function kuesteFuer(von: Punkt, nach: Punkt): [Punkt, Punkt][] | null {
  if (geladen && enthaelt(geladen, von) && enthaelt(geladen, nach)) return geladen.linien;
  if (!laedt && Date.now() >= gescheitertBis) void lade(von);
  return null;
}

async function lade(mitte: Punkt): Promise<void> {
  laedt = true;
  const dLon = HALB_GRAD / Math.max(Math.cos((mitte.lat * Math.PI) / 180), 0.2);
  const s = mitte.lat - HALB_GRAD, n = mitte.lat + HALB_GRAD, w = mitte.lon - dLon, e = mitte.lon + dLon;
  try {
    const k = await kuestenlinienUmGebiet(s, w, n, e, BUDGET_INTERAKTIV);
    if (k) {
      geladen = { s, w, n, e, linien: k.linien };
      aufGeladen();
    } else gescheitertBis = Date.now() + PAUSE_MS;
  } catch {
    gescheitertBis = Date.now() + PAUSE_MS;
  } finally {
    laedt = false;
  }
}
