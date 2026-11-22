import { werteSpurAus, type Fix, type ManuellePause } from './spur';
import { antriebsbilanz, type AntriebWechsel } from './antriebsbilanz';
import { letzteMorgendaemmerung } from './tagesende';




export interface BerichtFahrt {
  fixe: Fix[];
  
  wechsel: AntriebWechsel[];
  
  manuellePausen?: ManuellePause[];
}

export interface Anteil {
  nm: number;
  
  prozent: number;
  stunden: number;
  
  knoten: number;
}

export interface Berichtsblock {
  nm: number;
  fahrzeitS: number;
  
  knoten: number;
  segel: Anteil;
  motor: Anteil;
  
  offen: Anteil;
}

export interface Navigatorbericht {
  gesamt: Berichtsblock;
  heute: Berichtsblock;
  
  heuteSeit: number | null;
}

const LEER_ANTEIL: Anteil = { nm: 0, prozent: 0, stunden: 0, knoten: 0 };
const LEER: Berichtsblock = {
  nm: 0, fahrzeitS: 0, knoten: 0,
  segel: { ...LEER_ANTEIL }, motor: { ...LEER_ANTEIL }, offen: { ...LEER_ANTEIL },
};


export function anteil(nm: number, sekunden: number, gesamtNM: number): Anteil {
  const stunden = sekunden / 3600;
  return {
    nm,
    prozent: gesamtNM > 0 ? (nm / gesamtNM) * 100 : 0,
    stunden,
    knoten: stunden > 0 ? nm / stunden : 0,
  };
}


export function berichtsblock(fahrten: BerichtFahrt[], vonT?: number): Berichtsblock {
  const b: Berichtsblock = {
    nm: 0, fahrzeitS: 0, knoten: 0,
    segel: { ...LEER_ANTEIL }, motor: { ...LEER_ANTEIL }, offen: { ...LEER_ANTEIL },
  };
  let segelNM = 0; let motorNM = 0; let offenNM = 0;
  let segelS = 0; let motorS = 0; let offenS = 0;

  for (const f of fahrten) {
    const fixe = vonT === undefined ? f.fixe : f.fixe.filter((x) => x.t >= vonT);
    if (fixe.length < 2) continue;
    
    
    
    const a = werteSpurAus(fixe, {}, f.manuellePausen ?? []);
    b.nm += a.streckeNM;
    b.fahrzeitS += a.fahrzeitS;
    const ab = antriebsbilanz(a.punkte, f.wechsel, a.luecken);
    segelNM += ab.segelNM; motorNM += ab.motorNM; offenNM += ab.offenNM;
    segelS += ab.segelS; motorS += ab.motorS; offenS += ab.offenS;
  }

  b.knoten = b.fahrzeitS > 0 ? b.nm / (b.fahrzeitS / 3600) : 0;
  b.segel = anteil(segelNM, segelS, b.nm);
  b.motor = anteil(motorNM, motorS, b.nm);
  b.offen = anteil(offenNM, offenS, b.nm);
  return b;
}


export function navigatorbericht(
  fahrten: BerichtFahrt[],
  jetzt: number,
  position: { lat: number; lon: number } | null,
): Navigatorbericht {
  const gesamt = fahrten.length ? berichtsblock(fahrten) : { ...LEER };
  const heuteSeit = position ? letzteMorgendaemmerung(position.lat, position.lon, jetzt) : null;
  
  
  const heute = heuteSeit === null ? { ...LEER } : berichtsblock(fahrten, heuteSeit);
  return { gesamt, heute, heuteSeit };
}
