import type { Punkt } from './types';
import { distNM, relAngle } from './geo';



export interface UeberstellungsHalt {
  name: string;
  ort: Punkt;
  art: 'marina' | 'hafen' | 'bucht';
  
  s: number;
  
  abstandSm: number;
}

export interface UeberstellungsVorgaben {
  
  fahrtKn: number;
  
  tankReichweiteSm: number | null;
  
  motoranteil?: (vonS: number, bisS: number, abfahrt: number) => number;
  
  enge?: (vonS: number, bisS: number, abfahrt: number) => EngenDurchfahrt | null;
  
  maxHafennaechte: number | null;
  
  ruhetage: number;
  
  tankstoppStunden: number;
  
  tankstelleVon: number;
  tankstelleBis: number;
}

export const UEBERSTELLUNG_VORGABEN: Omit<UeberstellungsVorgaben, 'fahrtKn'> = {
  tankReichweiteSm: null, maxHafennaechte: null, ruhetage: 0,
  tankstoppStunden: 1.5, tankstelleVon: 8, tankstelleBis: 19,
};


export interface EngenDurchfahrt {
  name: string;
  
  zeit: number;
  wartenMs: number;
  
  strom: string;
  kn: number;
  mitlaufend: boolean;
  
  vorlaufSm: number;
  
  langsamKn: number | null;
}


export const TANK_SPIELRAUM = 0.1;

export type HaltArt = 'tanken' | 'nacht' | 'ruhetag' | 'ziel';

export interface UeberstellungsSchlag {
  vonIndex: number;
  nachIndex: number;
  
  abfahrt: number;
  ankunft: number;
  sm: number;
  
  motorSm: number;
  
  enge?: EngenDurchfahrt;
  
  halt: HaltArt;
  
  weiter: number;
  
  ruhetage?: number;
}

export interface UeberstellungsPlan {
  schlaege: UeberstellungsSchlag[];
  ankunft: number;
  gesamtSm: number;
  motorSm: number;
  hafennaechte: number;
  tankstopps: number;
  
  ruhetageOhneHalt: number;
}

const STUNDE = 3_600_000;


function naechsteOeffnung(t: number, von: number, bis: number): number {
  const d = new Date(t);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  if (h >= von && h < bis) return t;
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), von));
  return h < von ? x.getTime() : x.getTime() + 24 * STUNDE;
}

function engeImSchlag(
  v: UeberstellungsVorgaben, vonS: number, bisS: number, abfahrt: number, verschub: number,
): { enge?: EngenDurchfahrt } {
  const d = v.enge?.(vonS, bisS, abfahrt);
  return d ? { enge: { ...d, zeit: d.zeit + verschub } } : {};
}


export function schlagMotorSm(
  halte: readonly UeberstellungsHalt[], i: number, j: number, abfahrt: number, v: Pick<UeberstellungsVorgaben, 'motoranteil'>,
): number {
  const a = halte[i]!, b = halte[j]!;
  const lang = Math.abs(b.s - a.s);
  const anteil = v.motoranteil ? Math.max(0, Math.min(1, v.motoranteil(Math.min(a.s, b.s), Math.max(a.s, b.s), abfahrt))) : 1;
  return lang * anteil + a.abstandSm + b.abstandSm;
}


export function schlagSm(halte: readonly UeberstellungsHalt[], i: number, j: number): number {
  const a = halte[i]!, b = halte[j]!;
  return Math.abs(b.s - a.s) + a.abstandSm + b.abstandSm;
}


export function planeUeberstellung(
  halte: readonly UeberstellungsHalt[], start: number, v: UeberstellungsVorgaben,
): UeberstellungsPlan | null {
  const n = halte.length;
  if (n < 2 || v.fahrtKn <= 0) return null;
  const ziel = n - 1;
  const maxN = v.maxHafennaechte ?? n;
  
  type Eintrag = { weiter: number; vorI: number; vorK: number; halt: HaltArt; ankunft: number };
  const beste: (Eintrag | undefined)[][] = halte.map(() => []);
  beste[0]![0] = { weiter: start, vorI: -1, vorK: -1, halt: 'tanken', ankunft: start };
  let bestZiel: { ankunft: number; vorI: number; vorK: number; stopps: number } | null = null;
  const stoppsBis = new Map<string, number>([['0|0', 0]]);
  const grenze = v.tankReichweiteSm != null ? v.tankReichweiteSm * (1 + TANK_SPIELRAUM) : null;

  for (let i = 0; i < ziel; i++) {
    for (let k = 0; k <= maxN; k++) {
      const e = beste[i]![k];
      if (!e) continue;
      const stopps = stoppsBis.get(`${i}|${k}`) ?? 0;
      for (let j = i + 1; j <= ziel; j++) {
        const sm = schlagSm(halte, i, j);
        if (grenze != null && schlagMotorSm(halte, i, j, e.weiter, v) > grenze) {
          
          if (!v.motoranteil && halte[j]!.s - halte[i]!.s > grenze) break;
          continue;
        }
        
        const ankunft = e.weiter + (sm / v.fahrtKn) * STUNDE + (v.enge?.(halte[i]!.s, halte[j]!.s, e.weiter)?.wartenMs ?? 0);
        if (j === ziel) {
          if (!bestZiel || ankunft < bestZiel.ankunft - 60_000
            || (Math.abs(ankunft - bestZiel.ankunft) <= 60_000 && stopps < bestZiel.stopps)) {
            bestZiel = { ankunft, vorI: i, vorK: k, stopps };
          }
          continue;
        }
        
        if (halte[j]!.art === 'bucht') continue;
        const offen = naechsteOeffnung(ankunft, v.tankstelleVon, v.tankstelleBis);
        const nacht = offen - ankunft > 6 * STUNDE;
        const k2 = k + (nacht ? 1 : 0);
        if (k2 > maxN) continue;
        const weiter = offen + v.tankstoppStunden * STUNDE;
        const bisher = beste[j]![k2];
        if (!bisher || weiter < bisher.weiter) {
          beste[j]![k2] = { weiter, vorI: i, vorK: k, halt: nacht ? 'nacht' : 'tanken', ankunft };
          stoppsBis.set(`${j}|${k2}`, stopps + 1);
        }
      }
    }
  }
  if (!bestZiel) return null;

  
  const kette: { i: number; k: number; ankunft: number; halt: HaltArt; weiter: number }[] = [];
  kette.push({ i: ziel, k: bestZiel.vorK, ankunft: bestZiel.ankunft, halt: 'ziel', weiter: bestZiel.ankunft });
  let i = bestZiel.vorI, k = bestZiel.vorK;
  while (i > 0) {
    const e = beste[i]![k]!;
    kette.push({ i, k, ankunft: e.ankunft, halt: e.halt, weiter: e.weiter });
    const vi = e.vorI, vk = e.vorK;
    i = vi; k = vk;
  }
  kette.push({ i: 0, k: 0, ankunft: start, halt: 'tanken', weiter: start });
  kette.reverse();

  
  const halteIdx = kette.slice(1, -1).map((_, x) => x + 1);
  let verschub = 0;
  
  
  const ruheAn = new Map<number, number>();
  for (let r = 0; r < v.ruhetage && halteIdx.length > 0; r++) {
    const x = halteIdx[Math.floor(((r + 0.5) * halteIdx.length) / v.ruhetage)]!;
    ruheAn.set(x, (ruheAn.get(x) ?? 0) + 1);
  }
  const schlaege: UeberstellungsSchlag[] = [];
  for (let x = 1; x < kette.length; x++) {
    const a = kette[x - 1]!, b = kette[x]!;
    
    
    
    const enge = engeImSchlag(v, halte[a.i]!.s, halte[b.i]!.s, a.weiter, verschub);
    const abfahrt = a.weiter + verschub + (enge.enge?.wartenMs ?? 0);
    const ankunft = b.ankunft + verschub;
    const ruhe = ruheAn.get(x) ?? 0;
    verschub += ruhe * 24 * STUNDE;
    schlaege.push({
      vonIndex: a.i, nachIndex: b.i, abfahrt, ankunft, sm: schlagSm(halte, a.i, b.i),
      motorSm: schlagMotorSm(halte, a.i, b.i, a.weiter, v), ...enge,
      halt: ruhe > 0 ? 'ruhetag' : b.halt, weiter: b.weiter + verschub,
      ...(ruhe > 1 ? { ruhetage: ruhe } : {}),
    });
  }
  const letzte = schlaege[schlaege.length - 1]!;
  const ruheNaechte = [...ruheAn.values()].reduce((n, x) => n + x, 0);
  return {
    schlaege, ankunft: letzte.ankunft, gesamtSm: schlaege.reduce((s, x) => s + x.sm, 0),
    motorSm: schlaege.reduce((s, x) => s + x.motorSm, 0),
    hafennaechte: schlaege.filter((x) => x.halt === 'nacht').length + ruheNaechte,
    tankstopps: schlaege.filter((x) => x.halt === 'tanken' || x.halt === 'nacht' || x.halt === 'ruhetag').length,
    ruhetageOhneHalt: Math.max(0, v.ruhetage - ruheNaechte),
  };
}


export function aufDemWeg(p: Punkt, weg: readonly Punkt[]): { s: number; abstandSm: number } {
  let bestS = 0, bestD = Infinity, lauf = 0;
  for (let i = 1; i < weg.length; i++) {
    const a = weg[i - 1]!, b = weg[i]!;
    const k = Math.cos((a.lat * Math.PI) / 180);
    const ax = 0, ay = 0, bx = (b.lon - a.lon) * 60 * k, by = (b.lat - a.lat) * 60;
    const px = (p.lon - a.lon) * 60 * k, py = (p.lat - a.lat) * 60;
    const l2 = bx * bx + by * by;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / l2));
    const d = Math.hypot(px - t * bx, py - t * by);
    const seg = distNM(a.lat, a.lon, b.lat, b.lon);
    if (d < bestD) { bestD = d; bestS = lauf + t * seg; }
    lauf += seg;
  }
  return { s: bestS, abstandSm: bestD };
}


export const UEBERSTELLUNG_SEGEL_TWA_MIN = 50;


export interface WindProbe {
  
  s: number;
  
  kurs: number;
  zeit: readonly number[];
  kn: readonly number[];
  
  richtung: readonly number[];
}


export function motoranteilAusWind(
  proben: readonly WindProbe[], fahrtKn: number, minSegelKn: number,
): (vonS: number, bisS: number, abfahrt: number) => number {
  const H = STUNDE;
  return (vonS, bisS, abfahrt) => {
    let drin = proben.filter((p) => p.s >= vonS && p.s <= bisS);
    if (drin.length === 0 && proben.length > 0) {
      const mitte = (vonS + bisS) / 2;
      drin = [proben.reduce((a, b) => (Math.abs(b.s - mitte) < Math.abs(a.s - mitte) ? b : a))];
    }
    if (drin.length === 0) return 1;
    let motor = 0;
    for (const p of drin) {
      const t = abfahrt + ((p.s - vonS) / fahrtKn) * H;
      const i = p.zeit.length > 0 ? Math.round((t - p.zeit[0]!) / H) : -1;
      const kn = p.kn[i], richtung = p.richtung[i];
      const segelbar = i >= 0 && i < p.zeit.length && kn != null && richtung != null
        && kn >= minSegelKn && relAngle(richtung, p.kurs) >= UEBERSTELLUNG_SEGEL_TWA_MIN;
      if (!segelbar) motor++;
    }
    return motor / drin.length;
  };
}
