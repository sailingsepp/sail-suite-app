import { KARTE_KACHEL_GRAD, landKachelName } from './kartenKacheln';


export const TIEFEN_M = [5, 10, 20, 50] as const;

export const BAENDER_BIS_M = [2, 2.5, 3, 3.5, 4, 5, 10, 20, 50] as const;

export const TIEFGANG_RESERVE_M = 1;
export const TIEFE_FAKTOR = 100_000;


export const LINIE_AB_ZOOM: Readonly<Record<(typeof TIEFEN_M)[number], number>> = { 5: 12, 10: 10, 20: 9, 50: 9 };
export const FLAECHEN_AB_ZOOM = 9;


export interface TiefenFarben {
  b5: string; b10: string; b20: string; b50: string; tiefgang: string; linie: string; linieFlach: string;
  
  zahl: string; zahlHalo: string;
  
  tiefgangStreifen: string;
}
export const TIEFEN_TAG: TiefenFarben = {
  b5: '#E9F5FC', b10: '#DCEEF9', b20: '#CEE6F6', b50: '#BFDDF2', tiefgang: '#FBE4EC',
  linie: 'rgba(40,96,150,.45)', linieFlach: 'rgba(20,80,140,.75)', zahl: '#1F5A8F', zahlHalo: '#E4F1FA',
  tiefgangStreifen: '#F2BED1',
};

export const TIEFEN_NACHT: TiefenFarben = {
  b5: '#220807', b10: '#190504', b20: '#110302', b50: '#0A0101', tiefgang: '#46102C',
  linie: 'rgba(196,68,44,.35)', linieFlach: 'rgba(196,68,44,.6)', zahl: '#C4442C', zahlHalo: '#0A0101',
  tiefgangStreifen: '#5E1A3E',
};


export function tiefgangStufe(tiefgangM: number | null | undefined): number | null {
  if (tiefgangM === null || tiefgangM === undefined || !Number.isFinite(tiefgangM) || tiefgangM <= 0) return null;
  const grenze = tiefgangM + TIEFGANG_RESERVE_M;
  return BAENDER_BIS_M.find((b) => b >= grenze - 1e-9) ?? BAENDER_BIS_M[BAENDER_BIS_M.length - 1]!;
}


export function bandFarbe(bisM: number, stufe: number | null, f: TiefenFarben): string {
  if (stufe !== null && bisM <= stufe + 1e-9) return f.tiefgang;
  return bisM <= 5 ? f.b5 : bisM <= 10 ? f.b10 : bisM <= 20 ? f.b20 : f.b50;
}

export function tiefeKachelName(i: number, j: number): string {
  return landKachelName(i, j).replace(/^land-/, 'tiefe-');
}


export function tiefenZellen(gebiete: readonly (readonly [number, number, number, number])[]): { i: number; j: number }[] {
  const g = KARTE_KACHEL_GRAD;
  const da = new Map<string, { i: number; j: number }>();
  for (const [w, s, o, n] of gebiete) {
    for (let i = Math.floor(s / g); i < Math.ceil(n / g); i++) {
      for (let j = Math.floor(w / g); j < Math.ceil(o / g); j++) da.set(`${i},${j}`, { i, j });
    }
  }
  return [...da.values()].sort((a, b) => a.i - b.i || a.j - b.j);
}


export function zelleHatTiefenlinien(tiefen: ArrayLike<number>): boolean {
  let min = Infinity, max = -Infinity;
  for (let k = 0; k < tiefen.length; k++) {
    const t = tiefen[k]!;
    if (Number.isNaN(t)) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (max <= 0) return false; 
  return min < TIEFEN_M[TIEFEN_M.length - 1]!;
}


export function zahlAbZoom(tiefeM: number): number | null {
  const ab = LINIE_AB_ZOOM[tiefeM as keyof typeof LINIE_AB_ZOOM];
  return ab === undefined ? null : Math.max(11, ab + 1);
}


export const ZAHL_ABSTAND_PX = 300;

const ZAHL_START: Readonly<Record<number, number>> = { 5: 0.5, 10: 0.8, 20: 0.2, 50: 0.35 };

export interface ZahlStelle { x: number; y: number; winkel: number }


export function zahlStellen(xy: ArrayLike<number>, tiefeM: number, abstandPx = ZAHL_ABSTAND_PX): ZahlStelle[] {
  const n = xy.length / 2;
  if (n < 2) return [];
  let gesamt = 0;
  for (let k = 1; k < n; k++) gesamt += Math.hypot(xy[2 * k]! - xy[2 * k - 2]!, xy[2 * k + 1]! - xy[2 * k - 1]!);
  if (gesamt < abstandPx) return [];
  const aus: ZahlStelle[] = [];
  let ziel = abstandPx * (ZAHL_START[tiefeM] ?? 0.5);
  let bisher = 0;
  for (let k = 1; k < n && ziel <= gesamt; k++) {
    const ax = xy[2 * k - 2]!, ay = xy[2 * k - 1]!, bx = xy[2 * k]!, by = xy[2 * k + 1]!;
    const lang = Math.hypot(bx - ax, by - ay);
    while (lang > 0 && ziel <= bisher + lang) {
      const t = (ziel - bisher) / lang;
      let w = Math.atan2(by - ay, bx - ax);
      if (w > Math.PI / 2) w -= Math.PI; else if (w <= -Math.PI / 2) w += Math.PI;
      aus.push({ x: ax + t * (bx - ax), y: ay + t * (by - ay), winkel: w });
      ziel += abstandPx;
    }
    bisher += lang;
  }
  return aus;
}


export function aufrechterWinkel(winkel: number, drehungRad: number): number {
  let s = winkel + drehungRad;
  s = ((s % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (s > Math.PI) s -= 2 * Math.PI;
  if (s > Math.PI / 2) s -= Math.PI; else if (s <= -Math.PI / 2) s += Math.PI;
  return s - drehungRad;
}


export const ZAHL_NEU_AB_GRAD = 20;


export const HAFEN_PUFFER_M = 250;

export const STREIFEN_ABSTAND_PX = 6;


export function hafenPufferPx(latDeg: number, z: number): number {
  const mpp = (40_075_016.686 * Math.cos((latDeg * Math.PI) / 180)) / (256 * 2 ** z);
  return HAFEN_PUFFER_M / mpp;
}


export function streifenLagen(x0: number, y0: number, von: number, bis: number, abstand = STREIFEN_ABSTAND_PX): number[] {
  const rest = (((x0 + y0) % abstand) + abstand) % abstand;
  const erste = Math.ceil((von + rest) / abstand) * abstand - rest;
  const aus: number[] = [];
  for (let c = erste; c <= bis; c += abstand) aus.push(c);
  return aus;
}



export const GLAETTEN_AB_ZOOM = 12;

export const GLAETTEN_MAX_M = [30, 15] as const;
const RAND_EPS = 1e-6;
const M_JE_GRAD = 111_320;

export function glaetteTiefenzug(
  p: Float64Array, zu: boolean, zelle: { s: number; w: number; n: number; o: number }, maxM: readonly number[] = GLAETTEN_MAX_M,
): Float64Array {
  const n = p.length / 2;
  if (n < 3) return p;
  const lat = (i: number) => p[2 * i]!, lon = (i: number) => p[2 * i + 1]!;
  
  const ring = zu || (lat(0) === lat(n - 1) && lon(0) === lon(n - 1));
  const m = ring && lat(0) === lat(n - 1) && lon(0) === lon(n - 1) ? n - 1 : n; 
  const fest = (i: number) => aufZellrand(lat(i), lon(i), zelle);

  const cosLat = Math.cos((((zelle.s + zelle.n) / 2) * Math.PI) / 180);
  
  const schneide = (aus: number[], la: number, lo: number, lb: number, ob: number, grenze: number): void => {
    const laengeM = Math.hypot((lb - la) * M_JE_GRAD, (ob - lo) * M_JE_GRAD * cosLat);
    const t = laengeM > 0 ? Math.min(0.25, grenze / laengeM) : 0.25;
    aus.push(la + t * (lb - la), lo + t * (ob - lo), lb - t * (lb - la), ob - t * (ob - lo));
  };

  
  const offen = (a: number[]): number[] => {
    let z = a;
    for (let d = 0; d < maxM.length && z.length >= 6; d++) {
      const aus = [z[0]!, z[1]!];
      for (let i = 0; i + 3 < z.length; i += 2) schneide(aus, z[i]!, z[i + 1]!, z[i + 2]!, z[i + 3]!, maxM[d]!);
      aus.push(z[z.length - 2]!, z[z.length - 1]!);
      z = aus;
    }
    return z;
  };

  
  const schliesse = (z: number[]): Float64Array => Float64Array.from(zu ? z : [...z, z[0]!, z[1]!]);

  if (!ring) {
    
    const aus: number[] = [];
    let start = 0;
    for (let i = 1; i < n; i++) {
      if (i < n - 1 && !fest(i)) continue;
      const abschnitt: number[] = [];
      for (let k = start; k <= i; k++) abschnitt.push(lat(k), lon(k));
      const g = offen(abschnitt);
      for (let k = aus.length ? 2 : 0; k < g.length; k++) aus.push(g[k]!);
      start = i;
    }
    return Float64Array.from(aus);
  }

  const feste: number[] = [];
  for (let i = 0; i < m; i++) if (fest(i)) feste.push(i);
  if (!feste.length) {
    
    let z: number[] = [];
    for (let i = 0; i < m; i++) z.push(lat(i), lon(i));
    for (let d = 0; d < maxM.length; d++) {
      const aus: number[] = [];
      const k = z.length / 2;
      for (let i = 0; i < k; i++) {
        const j = (i + 1) % k;
        schneide(aus, z[2 * i]!, z[2 * i + 1]!, z[2 * j]!, z[2 * j + 1]!, maxM[d]!);
      }
      z = aus;
    }
    return schliesse(z);
  }
  
  const aus: number[] = [];
  for (let f = 0; f < feste.length; f++) {
    const von = feste[f]!, bis = feste[(f + 1) % feste.length]!;
    
    const schritte = (bis - von + m) % m || m;
    const abschnitt: number[] = [];
    for (let s = 0; s <= schritte; s++) { const k = (von + s) % m; abschnitt.push(lat(k), lon(k)); }
    const g = offen(abschnitt);
    
    for (let q = 0; q < g.length - 2; q++) aus.push(g[q]!);
  }
  return schliesse(aus);
}


export function aufZellrand(lat: number, lon: number, zelle: { s: number; w: number; n: number; o: number }): boolean {
  return Math.abs(lat - zelle.s) < RAND_EPS || Math.abs(lat - zelle.n) < RAND_EPS
    || Math.abs(lon - zelle.w) < RAND_EPS || Math.abs(lon - zelle.o) < RAND_EPS;
}

export type KurvenBefehl = ['M' | 'L', number, number] | ['Q', number, number, number, number] | ['Z'];


export function kurvenBefehle(xy: ArrayLike<number>, ring: boolean, fest: (i: number) => boolean): KurvenBefehl[] {
  const n = xy.length / 2;
  const x = (i: number) => xy[2 * i]!, y = (i: number) => xy[2 * i + 1]!;
  const mitte = (i: number, j: number): [number, number] => [(x(i) + x(j)) / 2, (y(i) + y(j)) / 2];
  const aus: KurvenBefehl[] = [];
  if (n < 3) {
    for (let i = 0; i < n; i++) aus.push([i ? 'L' : 'M', x(i), y(i)]);
    if (ring && n) aus.push(['Z']);
    return aus;
  }
  const schritt = (i: number, naechster: number) => {
    if (fest(i)) { aus.push(['L', x(i), y(i)]); return; }
    const [mx, my] = mitte(i, naechster);
    aus.push(['Q', x(i), y(i), mx, my]);
  };
  if (!ring) {
    aus.push(['M', x(0), y(0)]);
    for (let i = 1; i < n - 1; i++) schritt(i, i + 1);
    aus.push(['L', x(n - 1), y(n - 1)]);
    return aus;
  }
  let start = -1;
  for (let i = 0; i < n; i++) if (fest(i)) { start = i; break; }
  if (start < 0) {
    const [sx, sy] = mitte(n - 1, 0);
    aus.push(['M', sx, sy]);
    for (let i = 0; i < n; i++) schritt(i, (i + 1) % n);
  } else {
    aus.push(['M', x(start), y(start)]);
    for (let k = 1; k < n; k++) { const i = (start + k) % n; schritt(i, (i + 1) % n); }
    aus.push(['L', x(start), y(start)]);
  }
  aus.push(['Z']);
  return aus;
}
