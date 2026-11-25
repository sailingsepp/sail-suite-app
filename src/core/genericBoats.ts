import { polarSpeed, FARR_BAVARIA_50, MAST_FACTOR } from './polar';
import type { BoatPolar } from './polar';
import { ORC_BOATS } from './boatPolars';

const LAENGE_FT: Record<string, number> = {
  'bavaria-38-match': 38, bavaria32: 32, bavaria33: 33, bavaria34: 34, bavaria38: 38,
  bavaria44: 44, bavaria50: 50,
  'beneteau-44-7': 44.7, beneteau375: 37.5, beneteau421: 42.1,
  'dufour-34': 34, 'dufour-36': 36, 'dufour-405': 40.5, dufour485: 48.5,
  elan37: 37, elan450: 45,
  'first-47-7': 47.7, gibsea442: 44.2, hanse400: 40, jeanneau41: 41,
  oceanis37: 37, swan391: 39.1, swan40: 40, swan44: 44, swan45: 45,
  swan46: 46, swan46cb: 46, swan60: 60,

};

interface Klasse { id: string; name: string; lo: number; hi: number }
const KLASSEN: Klasse[] = [
  { id: 'fahrtenyacht-39-45ft', name: 'Fahrtenyacht Monohull 39–45 ft', lo: 39, hi: 45 },
  { id: 'fahrtenyacht-45-50ft', name: 'Fahrtenyacht Monohull 45–50 ft', lo: 45, hi: 50 },
];

const FARR_ALS_10M: BoatPolar = {
  ...FARR_BAVARIA_50,
  id: 'farr-bavaria-50-10m-intern',
  referenceHeight: '10m',
  tws: FARR_BAVARIA_50.tws.map((t) => t / MAST_FACTOR),
};

function decktAb(b: BoatPolar, tws: number, twa: number): boolean {
  return tws >= b.tws[0]! && tws <= b.tws[b.tws.length - 1]!
    && twa >= b.twa[0]! && twa <= b.twa[b.twa.length - 1]!;
}

const TWA_RASTER = [30, 52, 60, 75, 90, 110, 120, 135, 150, 180];
const TWS_RASTER = [6, 8, 10, 12, 14, 16, 20, 25, 30];

function baueGenerischesBoot(k: Klasse): BoatPolar {
  const vergleichbar = ORC_BOATS.filter((b) => {
    const laenge = LAENGE_FT[b.id];
    return laenge != null && laenge >= k.lo && laenge <= k.hi;
  });
  const quellen = [FARR_ALS_10M, ...vergleichbar];

  const speed = TWA_RASTER.map((twa) => TWS_RASTER.map((tws) => {
    const beitraege = quellen.filter((b) => decktAb(b, tws, twa));
    const werte = (beitraege.length > 0 ? beitraege : [FARR_ALS_10M])
      .map((b) => polarSpeed(tws, twa, 1.0, b));
    const mittel = werte.reduce((a, v) => a + v, 0) / werte.length;
    return Math.round(mittel * 100) / 100;
  }));

  return {
    id: k.id,
    name: k.name,
    referenceHeight: '10m',
    sourceNote: `Generisch: Mittelwert aus der Farr-Bavaria-50-Referenz und ${vergleichbar.length} `
      + `vergleichbaren ORC-Polaren (${k.lo}–${k.hi} ft)`,
    tws: TWS_RASTER,
    twa: TWA_RASTER,
    speed,
  };
}

export const GENERIC_BOATS: readonly BoatPolar[] = KLASSEN.map(baueGenerischesBoot);
