
import type { Punkt } from './types';
import { distNM, bearingDeg } from './geo';
import { referenzfahrtKn, type RevierRandbedingungen } from './referenzfahrt';

export { referenzfahrtKn, vorgabeRevier, type RevierRandbedingungen } from './referenzfahrt';


export const WUNSCHZIELE_MAX = 8;

export type WunschzielArt = 'uebernachtung' | 'ruhetag' | 'poi';

export interface Wunschziel {
  ort: Punkt;
  name: string;
  art: WunschzielArt;
  
  ungenauerOrt?: boolean;
}


export interface Endziel {
  ort: Punkt;
  name: string;
  
  ungenauerOrt?: boolean;
}

export interface MachbarkeitEingabe {
  start: Punkt;
  startName: string;
  ziel: Punkt;
  zielName: string;
  wunschziele: Wunschziel[];
  endziel: Endziel | null;
  
  verfuegbareFahrtage: number;
  regelmassSm: number;
  
  obergrenzeSm: number | null;
  maxStundenProTag: number;
  revier: RevierRandbedingungen;
}

export interface EtappenLaenge {
  vonName: string;
  nachName: string;
  sm: number;
  zuLang: boolean;
}

export type MachbarkeitBefund = 'gehtMitLuft' | 'gehtKnapp' | 'gehtNicht';

export interface TeurerWunsch {
  name: string;
  ohneIhnMindestFahrtage: number;
  ersparnisTage: number;
}

export interface MachbarkeitGrund {
  art: 'reicht_nicht';
  fehlendeTage: number;
  teurerWunsch: TeurerWunsch | null;
}

export interface MachbarkeitErgebnis {
  befund: MachbarkeitBefund;
  
  reihenfolge: string[];
  gesamtSm: number;
  mindestFahrtage: number;
  
  reserveTage: number;
  etappen: EtappenLaenge[];
  zuLangeEtappen: EtappenLaenge[];
  teurerWunsch: TeurerWunsch | null;
  grund: MachbarkeitGrund | null;
}

interface Knoten { ort: Punkt; name: string }


const GLEICH_SM = 1e-9;

function kuerzesteKette(start: Knoten, ziel: Knoten, zwischenpunkte: readonly Knoten[]): { kette: Knoten[]; gesamtSm: number } {
  const n = zwischenpunkte.length;
  const d = (a: Knoten, b: Knoten): number => distNM(a.ort.lat, a.ort.lon, b.ort.lat, b.ort.lon);
  if (n === 0) return { kette: [start, ziel], gesamtSm: d(start, ziel) };

  const voll = (1 << n) - 1;
  const kosten: Float64Array[] = Array.from({ length: 1 << n }, () => new Float64Array(n).fill(Infinity));
  const vorgaenger: Int8Array[] = Array.from({ length: 1 << n }, () => new Int8Array(n).fill(-1));
  for (let j = 0; j < n; j++) kosten[1 << j]![j] = d(start, zwischenpunkte[j]!);

  for (let maske = 1; maske <= voll; maske++) {
    for (let j = 0; j < n; j++) {
      if (!(maske & (1 << j))) continue;
      const vorher = maske ^ (1 << j);
      if (vorher === 0) continue;
      let best = Infinity, bestI = -1;
      for (let i = 0; i < n; i++) {
        if (!(vorher & (1 << i))) continue;
        const k = kosten[vorher]![i]! + d(zwischenpunkte[i]!, zwischenpunkte[j]!);
        if (k < best - GLEICH_SM) { best = k; bestI = i; }
      }
      kosten[maske]![j] = best;
      vorgaenger[maske]![j] = bestI;
    }
  }

  let gesamtSm = Infinity, letzter = -1;
  for (let j = 0; j < n; j++) {
    const k = kosten[voll]![j]! + d(zwischenpunkte[j]!, ziel);
    if (k < gesamtSm - GLEICH_SM) { gesamtSm = k; letzter = j; }
  }

  const reihenfolge: Knoten[] = [];
  let maske = voll, j = letzter;
  while (j >= 0) {
    reihenfolge.unshift(zwischenpunkte[j]!);
    const i = vorgaenger[maske]![j]!;
    maske ^= 1 << j;
    j = i;
  }
  return { kette: [start, ...reihenfolge, ziel], gesamtSm };
}

interface Kernwerte {
  kette: Knoten[];
  gesamtSm: number;
  etappen: EtappenLaenge[];
  mindestFahrtage: number;
}

function rechneKernwerte(
  eingabe: MachbarkeitEingabe,
  wunschziele: readonly Wunschziel[],
): Kernwerte {
  const start: Knoten = { ort: eingabe.start, name: eingabe.startName };
  const ziel: Knoten = { ort: eingabe.ziel, name: eingabe.zielName };
  const zwischenpunkte: Knoten[] = wunschziele.map((w) => ({ ort: w.ort, name: w.name }));
  if (eingabe.endziel) zwischenpunkte.push({ ort: eingabe.endziel.ort, name: eingabe.endziel.name });

  const { kette, gesamtSm } = kuerzesteKette(start, ziel, zwischenpunkte);

  const etappen: EtappenLaenge[] = [];
  let totalStunden = 0;
  for (let i = 0; i < kette.length - 1; i++) {
    const a = kette[i]!, b = kette[i + 1]!;
    const sm = distNM(a.ort.lat, a.ort.lon, b.ort.lat, b.ort.lon);
    const bearing = bearingDeg(a.ort.lat, a.ort.lon, b.ort.lat, b.ort.lon);
    const kn = referenzfahrtKn(bearing, eingabe.revier);
    const stunden = sm / kn;
    const zuLang = (eingabe.obergrenzeSm != null && sm > eingabe.obergrenzeSm) || stunden > eingabe.maxStundenProTag;
    etappen.push({ vonName: a.name, nachName: b.name, sm, zuLang });
    totalStunden += stunden;
  }

  const ruhetage = wunschziele.filter((w) => w.art === 'ruhetag').length;
  const mindestFahrtage = Math.ceil(totalStunden / eingabe.maxStundenProTag) + ruhetage;

  return { kette, gesamtSm, etappen, mindestFahrtage };
}


function berechneTeurenWunsch(eingabe: MachbarkeitEingabe, mitAllenMindestFahrtage: number): TeurerWunsch | null {
  if (eingabe.wunschziele.length < 1) return null;
  let teuerster: TeurerWunsch | null = null;
  for (const w of eingabe.wunschziele) {
    const rest = eingabe.wunschziele.filter((x) => x !== w);
    const { mindestFahrtage: ohneIhn } = rechneKernwerte(eingabe, rest);
    const ersparnis = mitAllenMindestFahrtage - ohneIhn;
    if (!teuerster || ersparnis > teuerster.ersparnisTage) {
      teuerster = { name: w.name, ohneIhnMindestFahrtage: ohneIhn, ersparnisTage: ersparnis };
    }
  }
  return teuerster;
}


export function pruefeMachbarkeit(eingabe: MachbarkeitEingabe): MachbarkeitErgebnis {
  const anzahl = eingabe.wunschziele.length + (eingabe.endziel ? 1 : 0);
  if (anzahl > WUNSCHZIELE_MAX) {
    throw new Error(
      `Zu viele Wunschziele/Endziele (${anzahl}): WUNSCHZIELE_MAX ist ${WUNSCHZIELE_MAX} (§5.5).`,
    );
  }

  const { kette, gesamtSm, etappen, mindestFahrtage } = rechneKernwerte(eingabe, eingabe.wunschziele);
  const reserveTage = eingabe.verfuegbareFahrtage - mindestFahrtage;
  const zuLangeEtappen = etappen.filter((e) => e.zuLang);

  let befund: MachbarkeitBefund;
  if (reserveTage < 0) befund = 'gehtNicht';
  
  
  
  else if (reserveTage === 0) befund = 'gehtKnapp';
  else befund = 'gehtMitLuft';

  const teurerWunsch = befund !== 'gehtMitLuft' ? berechneTeurenWunsch(eingabe, mindestFahrtage) : null;
  const grund: MachbarkeitGrund | null = befund === 'gehtNicht'
    ? { art: 'reicht_nicht', fehlendeTage: -reserveTage, teurerWunsch }
    : null;

  return {
    befund,
    reihenfolge: kette.map((k) => k.name),
    gesamtSm,
    mindestFahrtage,
    reserveTage,
    etappen,
    zuLangeEtappen,
    teurerWunsch,
    grund,
  };
}


export function mindestFahrtageMitWunschzielen(
  start: Punkt, startName: string, ziel: Punkt, zielName: string,
  wunschziele: readonly Wunschziel[],
  revier: RevierRandbedingungen, maxStundenProTag: number,
): number {
  const eingabe: MachbarkeitEingabe = {
    start, startName, ziel, zielName,
    wunschziele: [...wunschziele],
    endziel: null,
    verfuegbareFahrtage: 0, obergrenzeSm: null, regelmassSm: 0,
    maxStundenProTag, revier,
  };
  return rechneKernwerte(eingabe, wunschziele).mindestFahrtage;
}
