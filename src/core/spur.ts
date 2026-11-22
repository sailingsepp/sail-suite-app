import { distNM, bearingDeg } from './geo';




export interface Fix {
  
  t: number;
  lat: number;
  lon: number;
  
  acc: number;
  
  speed?: number | null;
  
  heading?: number | null;
  
  quelle?: 'geraet' | 'import' | 'wachwechsel';
}


export interface SpurPunkt {
  
  t: number;
  lat: number;
  lon: number;
  
  acc: number;
  
  fixe: number;
  
  sog: number;
  
  cog: number | null;
  
  nm: number;
}


export interface Luecke {
  von: number;
  bis: number;
  
  dauer: number;
  
  sehneNM: number;
}


export interface Pause {
  von: number;
  bis: number;
  
  dauer: number;
  
  lat: number;
  lon: number;
}


export interface ManuellePause {
  von: number;
  bis: number;
}


export type EreignisArt = 'kurswechsel' | 'fahrtwechsel' | 'standort' | 'aufschiesser';


export interface Ereignis {
  art: EreignisArt;
  t: number;
  lat: number;
  lon: number;
  
  von: number;
  
  nach: number;
  
  windAus?: number;
}

export interface SpurAuswertung {
  
  punkte: SpurPunkt[];
  luecken: Luecke[];
  
  pausen: Pause[];
  
  laufAnfaenge: number[];
  ereignisse: Ereignis[];
  
  streckeNM: number;
  
  dauerS: number;
  
  fahrzeitS: number;
  
  beginnMs: number | null;
  endeMs: number | null;
  
  maxSog: number;
  
  verworfen: number;
}

export interface SpurOptionen {
  
  genauigkeitMaxM?: number;
  
  lueckeAbS?: number;
  
  fensterS?: number;
  
  schrittMinM?: number;
  
  kursAbKn?: number;
  
  kurswechselAbGrad?: number;
  
  fahrtwechselAbKn?: number;
  
  wechselHaltS?: number;
  
  pauseUnterKn?: number;
  
  pauseAbS?: number;
  
  standortAlleS?: number;
}


export const SPUR_VORGABEN: Required<SpurOptionen> = {
  genauigkeitMaxM: 50,
  lueckeAbS: 60,
  fensterS: 15,
  schrittMinM: 6,
  kursAbKn: 0.8,
  kurswechselAbGrad: 30,
  fahrtwechselAbKn: 1.5,
  wechselHaltS: 30,
  pauseUnterKn: 0.8,
  pauseAbS: 600,
  standortAlleS: 600,
};


const UNPLAUSIBEL_KN = 40;


function rauschSchwelle(a: Fenster, b: Fenster, untergrenzeM: number): number {
  const restA = (Number.isFinite(a.acc) ? a.acc : 0) / Math.sqrt(Math.max(1, a.fixe));
  const restB = (Number.isFinite(b.acc) ? b.acc : 0) / Math.sqrt(Math.max(1, b.fixe));
  return Math.max(untergrenzeM, 2 * Math.hypot(restA, restB));
}

const M_PRO_NM = 1852;


export function kursDifferenz(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}


export function filtereFixes(fixes: Fix[], opt: SpurOptionen = {}): { behalten: Fix[]; verworfen: number } {
  const o = { ...SPUR_VORGABEN, ...opt };
  const sortiert = [...fixes].sort((a, b) => a.t - b.t);
  const behalten: Fix[] = [];
  let verworfen = 0;

  for (const f of sortiert) {
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon) || !Number.isFinite(f.t)) {
      verworfen++;
      continue;
    }
    if (Number.isFinite(f.acc) && f.acc > o.genauigkeitMaxM) {
      verworfen++;
      continue;
    }
    const vor = behalten[behalten.length - 1];
    if (vor) {
      const dtS = (f.t - vor.t) / 1000;
      
      if (dtS <= 0) {
        verworfen++;
        continue;
      }
      const kn = distNM(vor.lat, vor.lon, f.lat, f.lon) / (dtS / 3600);
      
      
      if (dtS < o.lueckeAbS && kn > UNPLAUSIBEL_KN) {
        verworfen++;
        continue;
      }
    }
    behalten.push(f);
  }
  return { behalten, verworfen };
}

interface Fenster {
  
  t: number;
  
  von: number;
  
  bis: number;
  lat: number;
  lon: number;
  acc: number;
  fixe: number;
}


function verdichte(fixes: Fix[], o: Required<SpurOptionen>): Fenster[] {
  const raus: Fenster[] = [];
  let gruppe: Fix[] = [];

  const schliesse = () => {
    if (!gruppe.length) return;
    const n = gruppe.length;
    raus.push({
      t: gruppe.reduce((s, f) => s + f.t, 0) / n,
      von: gruppe[0]!.t,
      bis: gruppe[n - 1]!.t,
      lat: gruppe.reduce((s, f) => s + f.lat, 0) / n,
      lon: gruppe.reduce((s, f) => s + f.lon, 0) / n,
      acc: gruppe.reduce((s, f) => s + (Number.isFinite(f.acc) ? f.acc : 0), 0) / n,
      fixe: n,
    });
    gruppe = [];
  };

  for (const f of fixes) {
    if (gruppe.length) {
      const seitAnfang = (f.t - gruppe[0]!.t) / 1000;
      const seitLetztem = (f.t - gruppe[gruppe.length - 1]!.t) / 1000;
      if (seitAnfang >= o.fensterS || seitLetztem >= o.lueckeAbS) schliesse();
    }
    gruppe.push(f);
  }
  schliesse();
  return raus;
}


function findeEreignisse(
  punkte: SpurPunkt[], o: Required<SpurOptionen>, windAus?: (t: number) => number | null,
): Ereignis[] {
  const raus: Ereignis[] = [];
  let kursBezug: number | null = null;
  let fahrtBezug: number | null = null;
  let kursSeit: { t: number; wert: number } | null = null;
  let fahrtSeit: { t: number; wert: number } | null = null;
  
  
  
  let letzterEintragT = punkte[0]?.t ?? 0;

  
  
  
  
  
  const fertig = punkte.slice(1, Math.max(1, punkte.length - 1));
  for (let i = 0; i < fertig.length; i++) {
    const p = fertig[i]!;
    
    if (p.cog === null) {
      kursSeit = null;
    } else if (kursBezug === null) {
      kursBezug = p.cog;
    } else if (kursDifferenz(p.cog, kursBezug) >= o.kurswechselAbGrad) {
      if (!kursSeit || kursDifferenz(p.cog, kursSeit.wert) >= o.kurswechselAbGrad) {
        kursSeit = { t: p.t, wert: p.cog };
      } else if ((p.t - kursSeit.t) / 1000 >= o.wechselHaltS) {
        raus.push({ art: 'kurswechsel', t: kursSeit.t, lat: p.lat, lon: p.lon, von: kursBezug, nach: p.cog });
        letzterEintragT = Math.max(letzterEintragT, kursSeit.t);
        kursBezug = p.cog;
        kursSeit = null;
      }
    } else {
      kursSeit = null;
    }

    
    if (fahrtBezug === null) {
      fahrtBezug = p.sog;
    } else if (Math.abs(p.sog - fahrtBezug) >= o.fahrtwechselAbKn) {
      if (!fahrtSeit || Math.abs(p.sog - fahrtSeit.wert) >= o.fahrtwechselAbKn) {
        fahrtSeit = { t: p.t, wert: p.sog };
      } else if ((p.t - fahrtSeit.t) / 1000 >= o.wechselHaltS) {
        raus.push({ art: 'fahrtwechsel', t: fahrtSeit.t, lat: p.lat, lon: p.lon, von: fahrtBezug, nach: p.sog });
        letzterEintragT = Math.max(letzterEintragT, fahrtSeit.t);
        fahrtBezug = p.sog;
        fahrtSeit = null;
      }
    } else {
      fahrtSeit = null;
    }

    
    
    
    
    if ((p.t - letzterEintragT) / 1000 >= o.standortAlleS && p.cog !== null && p.sog >= o.kursAbKn) {
      
      
      const mittel = mittelUeber(fertig, p.t - 120_000, i + 1);
      if (mittel) {
        raus.push({ art: 'standort', t: p.t, lat: p.lat, lon: p.lon, von: mittel.kurs, nach: mittel.fahrt });
        letzterEintragT = p.t;
      }
    }
  }
  raus.push(...findeAufschiesser(punkte.slice(0, Math.max(0, punkte.length - 1)), windAus));
  return raus.sort((a, b) => a.t - b.t);
}


function mittelUeber(punkte: readonly SpurPunkt[], ab: number, bis = punkte.length, von = 0): { kurs: number; fahrt: number } | null {
  let x = 0, y = 0, summe = 0, n = 0;
  for (let k = bis - 1; k >= von && punkte[k]!.t >= ab; k--) {
    const q = punkte[k]!;
    summe += q.sog; n++;
    if (q.cog !== null) {
      x += Math.sin(q.cog * Math.PI / 180) * q.sog;
      y += Math.cos(q.cog * Math.PI / 180) * q.sog;
    }
  }
  if (!n || (x === 0 && y === 0)) return null;
  return { kurs: (Math.atan2(x, y) * 180 / Math.PI + 360) % 360, fahrt: summe / n };
}


export const AUFSCHIESSER = {
  vorlaufS: 120, vorlaufMinKn: 2.5, langsamKn: 2, langsamAnteil: 0.5,
  wiederKn: 2, hoechstensS: 600, windToleranzGrad: 50, ohneWindMinGrad: 60,
  minDrehGrad: 30,
} as const;

function findeAufschiesser(punkte: SpurPunkt[], windAus?: (t: number) => number | null): Ereignis[] {
  const A = AUFSCHIESSER;
  const raus: Ereignis[] = [];
  
  
  
  
  let lo = 0;
  for (let i = 1; i < punkte.length; i++) {
    const p = punkte[i]!;
    const grenze = p.t - A.vorlaufS * 1000;
    while (lo < i && punkte[lo]!.t < grenze) lo++;
    const anzahl = i - lo;
    if (anzahl < 2 || (p.t - punkte[lo]!.t) / 1000 < A.vorlaufS * 0.75) continue;
    let langsam = false;
    for (let k = lo; k < i; k++) {
      const q = punkte[k]!;
      if (q.sog < A.vorlaufMinKn || q.cog === null) { langsam = true; break; }
    }
    if (langsam) continue;
    const vorher = mittelUeber(punkte, -Infinity, i, lo);
    if (!vorher) continue;
    if (!(p.sog < A.langsamKn && p.sog < vorher.fahrt * A.langsamAnteil)) continue;

    
    let j = i + 1;
    while (j < punkte.length && punkte[j]!.sog < A.wiederKn) j++;
    if (j >= punkte.length) break;                     
    if ((punkte[j]!.t - p.t) / 1000 > A.hoechstensS) { i = j; continue; }

    
    
    
    let dreh: SpurPunkt | null = null;
    for (let k = Math.max(0, i - 2); k < j; k++) {
      const q = punkte[k]!;
      if (q.cog === null) continue;
      if (!dreh || kursDifferenz(q.cog, vorher.kurs) > kursDifferenz(dreh.cog!, vorher.kurs)) dreh = q;
    }
    if (!dreh) { i = j; continue; }
    const drehung = kursDifferenz(dreh.cog!, vorher.kurs);
    if (drehung < A.minDrehGrad) { i = j; continue; }
    
    
    const a0 = punkte[i - 1]!, a1 = punkte[j]!;
    const dtS = (a1.t - a0.t) / 1000;
    const mittelKn = dtS > 0 ? distNM(a0.lat, a0.lon, a1.lat, a1.lon) / (dtS / 3600) : Infinity;
    if (!(mittelKn < vorher.fahrt * A.langsamAnteil)) { i = j; continue; }
    const wind = windAus?.(p.t) ?? null;
    const passt = wind !== null
      ? kursDifferenz(dreh.cog!, wind) <= A.windToleranzGrad
      : drehung >= A.ohneWindMinGrad;
    if (passt) {
      const e: Ereignis = { art: 'aufschiesser', t: dreh.t, lat: dreh.lat, lon: dreh.lon, von: vorher.kurs, nach: dreh.cog! };
      if (wind !== null) e.windAus = wind;
      raus.push(e);
    }
    i = j;
  }
  return raus;
}


function findePausen(punkte: SpurPunkt[], luecken: Luecke[], o: Required<SpurOptionen>): Pause[] {
  const raus: Pause[] = [];
  let lauf: SpurPunkt[] = [];

  const schliesse = (): void => {
    if (lauf.length < 2) { lauf = []; return; }
    const von = lauf[0]!.t;
    const bis = lauf[lauf.length - 1]!.t;
    const dauer = (bis - von) / 1000;
    if (dauer >= o.pauseAbS) {
      raus.push({
        von, bis, dauer,
        lat: lauf.reduce((s, p) => s + p.lat, 0) / lauf.length,
        lon: lauf.reduce((s, p) => s + p.lon, 0) / lauf.length,
      });
    }
    lauf = [];
  };

  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i]!;
    const vor = punkte[i - 1];
    const ueberLuecke = vor && luecken.some((l) => l.von >= vor.t && l.bis <= p.t);
    if (ueberLuecke) schliesse();
    if (p.sog < o.pauseUnterKn) lauf.push(p);
    else schliesse();
  }
  schliesse();
  return raus;
}



const LUECKE_FAKTOR = 3;


function oertlicherTakt(abstaendeS: number[]): number[] {
  const UMKREIS = 5;
  return abstaendeS.map((_, i) => {
    const teil = abstaendeS
      .slice(Math.max(0, i - UMKREIS), Math.min(abstaendeS.length, i + UMKREIS + 1))
      .sort((a, b) => a - b);
    if (!teil.length) return 0;
    const m = teil.length >> 1;
    return teil.length % 2 ? teil[m]! : (teil[m - 1]! + teil[m]!) / 2;
  });
}


function ueberschneidenSich(vonA: number, bisA: number, vonB: number, bisB: number): boolean {
  return vonA < bisB && vonB < bisA;
}


export function vereinigePausen(pausen: Pause[]): Pause[] {
  const sortiert = [...pausen].sort((a, b) => a.von - b.von);
  const raus: Pause[] = [];
  for (const p of sortiert) {
    const letzte = raus[raus.length - 1];
    if (letzte && p.von <= letzte.bis) {
      if (p.bis > letzte.bis) {
        raus[raus.length - 1] = { ...letzte, bis: p.bis, dauer: (p.bis - letzte.von) / 1000 };
      }
    } else {
      raus.push({ ...p });
    }
  }
  return raus;
}


export const SPITZE_AB_KN = 12;


export const MAX_SOG_FENSTER = 5;


export function entferneSpitzen<T extends { t: number; lat: number; lon: number }>(
  punkte: T[], lueckeAbS = SPUR_VORGABEN.lueckeAbS,
): { behalten: T[]; entfernt: number } {
  if (punkte.length < 3) return { behalten: [...punkte], entfernt: 0 };
  const behalten: T[] = [punkte[0]!];
  let entfernt = 0;
  for (let i = 1; i < punkte.length - 1; i++) {
    const a = behalten[behalten.length - 1]!;
    const b = punkte[i]!;
    const c = punkte[i + 1]!;
    const dtAB = (b.t - a.t) / 1000;
    const dtBC = (c.t - b.t) / 1000;
    if (dtAB > 0 && dtBC > 0 && dtAB < lueckeAbS && dtBC < lueckeAbS) {
      const vAB = distNM(a.lat, a.lon, b.lat, b.lon) / (dtAB / 3600);
      const vBC = distNM(b.lat, b.lon, c.lat, c.lon) / (dtBC / 3600);
      const vAC = distNM(a.lat, a.lon, c.lat, c.lon) / ((dtAB + dtBC) / 3600);
      if (Math.min(vAB, vBC) > Math.max(SPITZE_AB_KN, 3 * vAC)) {
        entfernt++;
        continue;
      }
    }
    behalten.push(b);
  }
  behalten.push(punkte[punkte.length - 1]!);
  return { behalten, entfernt };
}


export function gehalteneHoechstfahrt(sog: number[], fenster = MAX_SOG_FENSTER): number {
  if (!sog.length) return 0;
  const median = (werte: number[]): number => {
    const s2 = [...werte].sort((x, y) => x - y);
    const m = s2.length >> 1;
    return s2.length % 2 ? s2[m]! : (s2[m - 1]! + s2[m]!) / 2;
  };
  if (sog.length <= fenster) return median(sog);
  let max = 0;
  for (let i = 0; i + fenster <= sog.length; i++) max = Math.max(max, median(sog.slice(i, i + fenster)));
  return max;
}

export function werteSpurAus(
  fixes: Fix[], opt: SpurOptionen = {}, manuellePausen: ManuellePause[] = [],
  
  windAus?: (t: number) => number | null,
): SpurAuswertung {
  const o = { ...SPUR_VORGABEN, ...opt };
  const { behalten, verworfen } = filtereFixes(fixes, o);
  
  
  const { behalten: fenster, entfernt: spitzen } = entferneSpitzen(verdichte(behalten, o), o.lueckeAbS);

  const punkte: SpurPunkt[] = [];
  const luecken: Luecke[] = [];
  
  const gesetztePausen: Pause[] = [];
  const laufAnfaenge: number[] = [];
  let streckeNM = 0;
  let dauerS = 0;
  
  let laufAnfang = fenster[0]?.von ?? 0;

  
  const abstaendeS = fenster.map((f, i) =>
    i === 0 ? 0 : (f.von - fenster[i - 1]!.bis) / 1000);
  const takte = oertlicherTakt(abstaendeS.slice(1));

  for (let i = 0; i < fenster.length; i++) {
    const f = fenster[i]!;
    const vor = fenster[i - 1];
    let sog = 0;
    let cog: number | null = null;

    if (vor) {
      
      
      
      
      const pauseS = (f.von - vor.bis) / 1000;
      const dtS = (f.t - vor.t) / 1000;
      const nm = distNM(vor.lat, vor.lon, f.lat, f.lon);
      const lueckeSchwelleS = Math.max(o.lueckeAbS, LUECKE_FAKTOR * (takte[i - 1] ?? 0));
      if (pauseS >= lueckeSchwelleS) {
        laufAnfaenge.push(f.t);
        
        
        
        
        
        if (manuellePausen.some((m) => ueberschneidenSich(vor.bis, f.von, m.von, m.bis))) {
          gesetztePausen.push({
            von: vor.bis, bis: f.von, dauer: pauseS,
            lat: (vor.lat + f.lat) / 2, lon: (vor.lon + f.lon) / 2,
          });
        } else {
          luecken.push({ von: vor.bis, bis: f.von, dauer: pauseS, sehneNM: nm });
          dauerS += vor.bis - laufAnfang;
          laufAnfang = f.von;
        }
      } else if (dtS > 0) {
        
        
        
        if (nm * M_PRO_NM >= rauschSchwelle(vor, f, o.schrittMinM)) {
          streckeNM += nm;
          sog = nm / (dtS / 3600);
          if (sog >= o.kursAbKn) cog = bearingDeg(vor.lat, vor.lon, f.lat, f.lon);
        }
      }
    }
    if (!vor) laufAnfaenge.push(f.t);
    punkte.push({ t: f.t, lat: f.lat, lon: f.lon, acc: f.acc, fixe: f.fixe, sog, cog, nm: streckeNM });
  }

  const letztes = fenster[fenster.length - 1];
  if (letztes) dauerS += letztes.bis - laufAnfang;
  dauerS /= 1000;

  const pausen = vereinigePausen([...gesetztePausen, ...findePausen(punkte, luecken, o)]);
  const pausenS = pausen.reduce((s, p) => s + p.dauer, 0);

  return {
    punkte, luecken, pausen, laufAnfaenge,
    ereignisse: findeEreignisse(punkte, o, windAus),
    streckeNM, dauerS,
    beginnMs: fenster[0]?.von ?? null, endeMs: letztes?.bis ?? null,
    
    
    fahrzeitS: Math.max(0, dauerS - pausenS),
    maxSog: gehalteneHoechstfahrt(punkte.map((p) => p.sog)),
    verworfen: verworfen + spitzen,
  };
}




export const ABLEGEN_ABSTAND_M = 50;

export const ABLEGEN_FAHRT_MS = 1;
const ABLEGEN_FAHRT_MIN_ABSTAND_M = 20;
const ABLEGEN_FAHRT_MAX_ACC_M = 30;



export function dauerAb(a: SpurAuswertung, abMs: number): number {
  if (a.beginnMs === null || a.endeMs === null || abMs <= a.beginnMs) return a.dauerS;
  if (abMs >= a.endeMs) return 0;
  const lueckenMs = a.luecken.reduce((s, l) => s + Math.max(0, l.bis - Math.max(l.von, abMs)), 0);
  return Math.max(0, (a.endeMs - abMs - lueckenMs) / 1000);
}

export function hatAbgelegt(bezug: { lat: number; lon: number } | null, fix: Fix): boolean {
  if (!bezug) return true;
  const m = distNM(bezug.lat, bezug.lon, fix.lat, fix.lon) * M_PRO_NM;
  const acc = Number.isFinite(fix.acc) ? fix.acc : 0;
  if (m - acc >= ABLEGEN_ABSTAND_M) return true;
  return fix.speed != null && fix.speed >= ABLEGEN_FAHRT_MS
    && acc <= ABLEGEN_FAHRT_MAX_ACC_M && m >= ABLEGEN_FAHRT_MIN_ABSTAND_M;
}


export function ankunftsPause(pausen: Pause[], endeT: number, stoppT: number | null): Pause | null {
  const TOLERANZ_MS = 120_000;
  if (stoppT != null) {
    const drin = pausen.find((p) => p.von - TOLERANZ_MS <= stoppT && stoppT <= p.bis + TOLERANZ_MS);
    if (drin) return drin;
  }
  const letzte = pausen[pausen.length - 1];
  return letzte && letzte.bis >= endeT - TOLERANZ_MS ? letzte : null;
}


export function stillstandAmEndeS(punkte: readonly SpurPunkt[], unterKn = SPUR_VORGABEN.pauseUnterKn): number {
  const letzter = punkte[punkte.length - 1];
  if (!letzter || letzter.sog >= unterKn) return 0;
  let beginn = letzter.t;
  for (let i = punkte.length - 2; i >= 0; i--) {
    if (punkte[i]!.sog >= unterKn) break;
    beginn = punkte[i]!.t;
  }
  return (letzter.t - beginn) / 1000;
}


export const GLEICHER_ORT_NM = 0.1;
export function lueckenAmSelbenOrt(luecken: readonly Luecke[], maxNM = GLEICHER_ORT_NM): number {
  return luecken.filter((l) => l.sehneNM < maxNM).reduce((s, l) => s + l.dauer, 0);
}




export const LIVE_FENSTER_S = 30;

export const LIVE_MIN_FIXE = 5;

export const LIVE_MIN_S = 10;

const SIGMA_JE_ACHSE = 0.662;

export const LIVE_FENSTER_STUFEN_S = [LIVE_FENSTER_S, 20, LIVE_MIN_S] as const;

export const LIVE_STREUUNG_MAX = 9;

export const LIVE_SD_MAX_KN = 1;

const LIVE_GERAET_SPIELRAUM_MS = 1;


export function aktuelleFahrt(
  fixes: readonly Fix[],
  
  jetzt?: number,
  opt: SpurOptionen = {},
): { sog: number; cog: number | null } {
  const o = { ...SPUR_VORGABEN, ...opt };
  const keine = { sog: 0, cog: null };
  let ende = -Infinity;
  for (const f of fixes) if (Number.isFinite(f.t) && f.t > ende) ende = f.t;
  if (!Number.isFinite(ende)) return keine;
  if (jetzt !== undefined && (jetzt - ende) / 1000 >= o.lueckeAbS) return keine;
  
  
  
  
  
  
  
  
  const sortiert = fixes
    .filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon) && Number.isFinite(f.t)
      && f.t >= ende - LIVE_FENSTER_S * 1000 && !(Number.isFinite(f.acc) && f.acc > o.genauigkeitMaxM))
    .sort((x, y) => y.t - x.t);
  if (sortiert.length === 0) return keine;
  const accOder = (f: Fix) => (Number.isFinite(f.acc) && f.acc > 0 ? f.acc : o.genauigkeitMaxM);
  const kette = (ab: number): Fix[] => {
    const k: Fix[] = [];
    for (let j = ab; j < sortiert.length; j++) {
      const f = sortiert[j]!, nach = k[k.length - 1];
      if (nach) {
        const dtS = (nach.t - f.t) / 1000;
        if (dtS <= 0) continue;
        if (dtS >= o.lueckeAbS) break;
        
        
        const toleranzM = 4 * SIGMA_JE_ACHSE * Math.hypot(accOder(f), accOder(nach));
        if (distNM(f.lat, f.lon, nach.lat, nach.lon) * M_PRO_NM - toleranzM > UNPLAUSIBEL_KN * M_PRO_NM / 3600 * dtS) break;
      }
      k.push(f);
    }
    return k.reverse();
  };
  let teilKette = kette(0);
  
  
  
  if (teilKette.length <= 2) {
    let n = 0;
    while (n < sortiert.length && sortiert[n]!.t >= teilKette[0]!.t) n++;
    const davor = kette(n);
    if (davor.length >= LIVE_MIN_FIXE) teilKette = davor;
  }

  
  
  for (const fensterS of LIVE_FENSTER_STUFEN_S) {
    const teil = teilKette.filter((f) => f.t >= ende - fensterS * 1000);
    if (teil.length < LIVE_MIN_FIXE || (ende - teil[0]!.t) / 1000 < LIVE_MIN_S) return keine;
    const g = ausgleichsgerade(teil, o.genauigkeitMaxM);
    if (!g) return keine;
    const v = Math.hypot(g.vx, g.vy);
    if (g.streuung > LIVE_STREUUNG_MAX || !geraetPasst(teil, v)) continue;
    if (v < 2 * Math.SQRT2 * g.sd || v < o.schrittMinM / o.fensterS) return keine;
    if (g.sd * 3600 / M_PRO_NM > LIVE_SD_MAX_KN) return keine;
    const sog = v * 3600 / M_PRO_NM;
    const cog = sog >= o.kursAbKn ? (Math.atan2(g.vx, g.vy) * 180 / Math.PI + 360) % 360 : null;
    return { sog, cog };
  }
  return keine;
}


function ausgleichsgerade(
  teil: readonly Fix[],
  genauigkeitMaxM: number,
): { vx: number; vy: number; sd: number; streuung: number } | null {
  const bezug = teil[teil.length - 1]!;
  const mProGradLat = 111_320;
  const mProGradLon = 111_320 * Math.cos(bezug.lat * Math.PI / 180);
  let sw = 0, st = 0, sx = 0, sy = 0;
  const p = teil.map((f) => {
    const acc = Number.isFinite(f.acc) && f.acc > 0 ? f.acc : genauigkeitMaxM;
    const w = 1 / (SIGMA_JE_ACHSE * acc) ** 2;
    const t = (f.t - bezug.t) / 1000;
    const x = (f.lon - bezug.lon) * mProGradLon;
    const y = (f.lat - bezug.lat) * mProGradLat;
    sw += w; st += w * t; sx += w * x; sy += w * y;
    return { w, t, x, y };
  });
  const tm = st / sw, xm = sx / sw, ym = sy / sw;
  let stt = 0, stx = 0, sty = 0;
  for (const q of p) {
    const dt = q.t - tm;
    stt += q.w * dt * dt;
    stx += q.w * dt * (q.x - xm);
    sty += q.w * dt * (q.y - ym);
  }
  if (!(stt > 0)) return null;
  const vx = stx / stt, vy = sty / stt;
  let chi = 0;
  for (const q of p) {
    const dt = q.t - tm;
    chi += q.w * ((q.x - xm - vx * dt) ** 2 + (q.y - ym - vy * dt) ** 2);
  }
  const freiheit = 2 * p.length - 4;
  return { vx, vy, sd: Math.sqrt(1 / stt), streuung: freiheit > 0 ? chi / freiheit : 0 };
}


function geraetPasst(teil: readonly Fix[], vMs: number): boolean {
  const gemeldet = teil.map((f) => f.speed).filter((v): v is number => v != null && Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  if (gemeldet.length < 3) return true;
  const median = gemeldet[Math.floor(gemeldet.length / 2)]!;
  return vMs <= 2 * median + LIVE_GERAET_SPIELRAUM_MS;
}


export const SCHNITT_MIN_S = 300;


export function schnittSeit(
  fixe: readonly Fix[], seitMs: number, manuellePausen: ManuellePause[] = [],
): { kn: number; sm: number; fahrzeitS: number } | null {
  const ab = fixe.filter((f) => f.t >= seitMs);
  if (ab.length < 2) return null;
  const a = werteSpurAus(ab, {}, manuellePausen.filter((p) => p.bis >= seitMs));
  if (a.fahrzeitS < SCHNITT_MIN_S || a.streckeNM <= 0) return null;
  return { kn: a.streckeNM / (a.fahrzeitS / 3600), sm: a.streckeNM, fahrzeitS: a.fahrzeitS };
}

