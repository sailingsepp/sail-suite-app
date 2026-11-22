
import { distNM, bearingDeg, destPoint, kreuzungsZahl } from './geo';
import type { Punkt } from './types';
import { hafenausfahrt, liegtAnLand } from './landumfahrung';
import { startVorHafen } from './hafenstart';

export interface NavWegpunkt extends Punkt {
  name: string;
  
  radiusSm?: number;
}


export type RoutenQuelle = 'route' | 'gehezu' | 'plan' | 'rueckweg';

export interface NavRoute {
  
  wegpunkte: NavWegpunkt[];
  
  naechster: number;
  quelle: RoutenQuelle;
  gestartet: number;
}


export const ANKUNFT_SM = 0.05;

export const ANKUNFT_STUFEN_SM = [0.05, 0.1, 0.2, 0.5] as const;

export const ankunftSm = (wp: NavWegpunkt): number => (wp.radiusSm !== undefined && wp.radiusSm > 0 ? wp.radiusSm : ANKUNFT_SM);

export const VORBEI_SM = 0.5;

export const SOG_FENSTER_S = 90;

export const STEHT_KN = 0.3;



interface Xy { x: number; y: number }


function mercatorGrad(lat: number): number {
  const phi = (lat * Math.PI) / 180;
  return (Math.log(Math.tan(Math.PI / 4 + phi / 2)) * 180) / Math.PI;
}


function eben(p: Punkt, bezug: Punkt): Xy {
  const k = Math.cos((bezug.lat * Math.PI) / 180);
  return { x: (p.lon - bezug.lon) * 60 * k, y: (mercatorGrad(p.lat) - mercatorGrad(bezug.lat)) * 60 * k };
}


export function lageZurStrecke(p: Punkt, a: Punkt, b: Punkt): { t: number; seitlichSm: number; abstandSm: number } {
  const A = eben(a, p), B = eben(b, p);
  const dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    const d = Math.hypot(A.x, A.y);
    return { t: 0, seitlichSm: 0, abstandSm: d };
  }
  
  const t = (-A.x * dx - A.y * dy) / l2;
  const l = Math.sqrt(l2);
  
  
  const kreuz = (dx * -A.y - dy * -A.x) / l;
  const tk = Math.max(0, Math.min(1, t));
  const nx = A.x + tk * dx, ny = A.y + tk * dy;
  return { t, seitlichSm: -kreuz, abstandSm: Math.hypot(nx, ny) };
}



export interface NavWerte {
  
  brg: number | null;
  
  dtw: number | null;
  
  xte: number | null;
  
  vmg: number | null;
  
  dtz: number | null;
  
  ttgS: number | null;
  
  eta: number | null;
  
  etz: number | null;
  
  ttzS: number | null;
}

const LEER: NavWerte = { brg: null, dtw: null, xte: null, vmg: null, dtz: null, ttgS: null, eta: null, etz: null, ttzS: null };

export function routenLaengeSm(punkte: readonly Punkt[], ab = 0): number {
  let s = 0;
  for (let i = Math.max(1, ab + 1); i < punkte.length; i++) {
    s += distNM(punkte[i - 1]!.lat, punkte[i - 1]!.lon, punkte[i]!.lat, punkte[i]!.lon);
  }
  return s;
}


export function navWerte(boot: Punkt | null, sog: number | null, cog: number | null, route: NavRoute | null, jetzt: number): NavWerte {
  if (!boot || !route) return LEER;
  const i = route.naechster;
  const wp = route.wegpunkte[i];
  const vor = route.wegpunkte[i - 1];
  if (!wp || !vor) return LEER;
  const brg = bearingDeg(boot.lat, boot.lon, wp.lat, wp.lon);
  const dtw = distNM(boot.lat, boot.lon, wp.lat, wp.lon);
  const xte = lageZurStrecke(boot, vor, wp).seitlichSm;
  const dtz = dtw + routenLaengeSm(route.wegpunkte, i);
  const faehrt = sog !== null && sog >= STEHT_KN;
  const vmg = faehrt && cog !== null ? sog * Math.cos(((cog - brg) * Math.PI) / 180) : null;
  
  
  
  const ttgS = faehrt ? (dtw / sog) * 3600 : null;
  const ttzS = faehrt ? (dtz / sog) * 3600 : null;
  return {
    brg, dtw, xte, vmg, dtz, ttgS,
    eta: ttgS === null ? null : jetzt + ttgS * 1000,
    etz: ttzS === null ? null : jetzt + ttzS * 1000,
    ttzS,
  };
}


export function geglaetteteSog(
  punkte: readonly { t: number; sog: number }[], jetzt: number, fensterS = SOG_FENSTER_S,
  laufAnfaenge: readonly number[] = [],
): number | null {
  const ab = jetzt - fensterS * 1000;
  const anfang = new Set(laufAnfaenge);
  let s = 0, n = 0;
  for (let k = punkte.length - 1; k >= 0; k--) {
    const p = punkte[k]!;
    if (p.t < ab) break;
    if (anfang.has(p.t)) continue;
    s += p.sog;
    n++;
  }
  return n ? s / n : null;
}



export type Fortschritt =
  | { art: 'gleich' }
  | { art: 'weiter'; erreicht: number }
  | { art: 'ziel' };


export function pruefeFortschritt(route: NavRoute, boot: Punkt): Fortschritt {
  const i = route.naechster;
  const wp = route.wegpunkte[i], vor = route.wegpunkte[i - 1], nach = route.wegpunkte[i + 1];
  if (!wp || !vor) return { art: 'gleich' };
  const d = distNM(boot.lat, boot.lon, wp.lat, wp.lon);
  let erreicht = d <= ankunftSm(wp);
  if (!erreicht) {
    const B = eben(boot, wp), V = eben(vor, wp);
    const ein = norm({ x: -V.x, y: -V.y }); 
    let schwelle: Xy = ein;
    if (nach) {
      const N = eben(nach, wp);
      const aus = norm(N);
      
      const summe = norm({ x: ein.x + aus.x, y: ein.y + aus.y });
      if (Number.isFinite(summe.x)) schwelle = summe;
    }
    
    
    
    
    
    
    
    const vorDemWp = -(B.x * ein.x + B.y * ein.y);
    const halbierende = B.x * schwelle.x + B.y * schwelle.y > 0 && vorDemWp <= VORBEI_SM;
    erreicht = halbierende || B.x * ein.x + B.y * ein.y > 0;
  }
  if (!erreicht) return { art: 'gleich' };
  return i >= route.wegpunkte.length - 1 ? { art: 'ziel' } : { art: 'weiter', erreicht: i };
}






export function zeitBisPassage(route: NavRoute | null, boot: Punkt | null, sogKn: number | null, cogGrad: number | null): number | null {
  if (!route || !boot || sogKn === null || cogGrad === null || sogKn < STEHT_KN) return null;
  const i = route.naechster;
  const wp = route.wegpunkte[i], vor = route.wegpunkte[i - 1], nach = route.wegpunkte[i + 1];
  if (!wp || !vor) return null;
  if (pruefeFortschritt(route, boot).art !== 'gleich') return 0;
  const B = eben(boot, wp), V = eben(vor, wp);
  const r = (cogGrad * Math.PI) / 180;
  const v = { x: Math.sin(r) * sogKn / 3600, y: Math.cos(r) * sogKn / 3600 }; 
  const ein = norm({ x: -V.x, y: -V.y });
  let beste: number | null = null;
  const nimm = (t: number) => { if (t >= 0 && (beste === null || t < beste)) beste = t; };
  
  const ueber = (n: Xy): number | null => {
    const annaeherung = v.x * n.x + v.y * n.y;
    return annaeherung > 0 ? -(B.x * n.x + B.y * n.y) / annaeherung : null;
  };
  if (Number.isFinite(ein.x)) {
    const ts = ueber(ein);
    if (ts !== null) nimm(ts);
  }
  if (nach && Number.isFinite(ein.x)) {
    const aus = norm(eben(nach, wp));
    const summe = norm({ x: ein.x + aus.x, y: ein.y + aus.y });
    const th = Number.isFinite(summe.x) ? ueber(summe) : null;
    if (th !== null) {
      
      
      
      const vorDemWp = (t: number) => -((B.x + v.x * t) * ein.x + (B.y + v.y * t) * ein.y);
      if (vorDemWp(th) <= VORBEI_SM) nimm(th);
      else {
        const naeher = v.x * ein.x + v.y * ein.y;
        if (naeher > 0) {
          const t2 = (vorDemWp(0) - VORBEI_SM) / naeher;
          if (t2 >= th && (B.x + v.x * t2) * summe.x + (B.y + v.y * t2) * summe.y > 0) nimm(t2);
        }
      }
    }
  }
  
  const d = Math.hypot(B.x, B.y);
  const radius = ankunftSm(wp);
  if (d > radius) {
    const zu = -(v.x * B.x + v.y * B.y) / d;
    if (zu > 0) {
      const t = (d - radius) / zu;
      if (beste === null || t < beste) beste = t;
    }
  }
  return beste;
}



export const NACHHOL_SM = 1;

export const NACHHOL_KURS_GRAD = 60;


export function nachholen(route: NavRoute, boot: Punkt, cogGrad: number | null, sogKn: number | null): number | null {
  const i = route.naechster;
  const wp = route.wegpunkte[i], vor = route.wegpunkte[i - 1];
  if (!wp || !vor || cogGrad === null || sogKn === null || sogKn < 1) return null;
  if (distNM(boot.lat, boot.lon, wp.lat, wp.lon) <= VORBEI_SM) return null;
  const neben = (a: Punkt, b: Punkt): { d: number; f: number } => {
    const B = eben(boot, a), E = eben(b, a);
    const l2 = E.x * E.x + E.y * E.y;
    const f = l2 > 0 ? (B.x * E.x + B.y * E.y) / l2 : 0;
    const t = Math.max(0, Math.min(1, f));
    return { d: Math.hypot(B.x - t * E.x, B.y - t * E.y), f };
  };
  const aktuell = neben(vor, wp).d;
  let bester: { k: number; d: number } | null = null;
  for (let k = i; k + 1 < route.wegpunkte.length; k++) {
    const a = route.wegpunkte[k]!, b = route.wegpunkte[k + 1]!;
    const n = neben(a, b);
    if (n.f <= 0 || n.f > 1 || n.d > NACHHOL_SM || n.d >= aktuell) continue;
    const abw = Math.abs(((cogGrad - bearingDeg(a.lat, a.lon, b.lat, b.lon)) % 360 + 540) % 360 - 180);
    if (abw > NACHHOL_KURS_GRAD) continue;
    if (!bester || n.d < bester.d) bester = { k, d: n.d };
  }
  return bester ? bester.k + 1 : null;
}

function norm(v: Xy): Xy {
  const l = Math.hypot(v.x, v.y);
  return l > 0 ? { x: v.x / l, y: v.y / l } : { x: NaN, y: NaN };
}


export function ohneStummel(
  punkte: readonly Punkt[],
  
  sperre: readonly [Punkt, Punkt][] = [],
): Punkt[] {
  const aus = [...punkte];
  const quer = (p: Punkt, q: Punkt) => (sperre.length ? kreuzungsZahl(p, q, sperre as [Punkt, Punkt][]) : 0);
  for (let i = aus.length - 2; i >= 1; i--) {
    const p = aus[i]!, n = aus[i + 1]!, v = aus[i - 1]!;
    if (distNM(p.lat, p.lon, n.lat, n.lon) >= ANKUNFT_SM) continue;
    if (sperre.length && quer(v, n) > quer(v, p) + quer(p, n)) continue;
    aus.splice(i, 1);
  }
  return aus;
}




export function vereinfacheLinie<T extends Punkt>(punkte: readonly T[], toleranzSm: number): T[] {
  if (punkte.length <= 2) return [...punkte];
  const behalten = new Uint8Array(punkte.length);
  behalten[0] = 1;
  behalten[punkte.length - 1] = 1;
  const stapel: [number, number][] = [[0, punkte.length - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop()!;
    let max = -1, wo = -1;
    for (let k = a + 1; k < b; k++) {
      const d = lageZurStrecke(punkte[k]!, punkte[a]!, punkte[b]!).abstandSm;
      if (d > max) { max = d; wo = k; }
    }
    if (max > toleranzSm && wo > 0) {
      behalten[wo] = 1;
      stapel.push([a, wo], [wo, b]);
    }
  }
  return punkte.filter((_, k) => behalten[k]);
}

export const RUECKWEG_TOLERANZ_SM = 0.05;


export function rueckwegAusSpur(spur: readonly Punkt[], boot: Punkt | null, namen: { wp: (n: number) => string; ziel: string }, toleranzSm = RUECKWEG_TOLERANZ_SM): NavWegpunkt[] {
  const rueck = [...spur].reverse();
  if (boot) rueck.unshift(boot);
  const einfach = vereinfacheLinie(rueck, toleranzSm);
  return einfach.map((p, k) => ({
    lat: p.lat, lon: p.lon,
    name: k === einfach.length - 1 ? namen.ziel : k === 0 ? '' : namen.wp(k),
  }));
}



export interface Gefahr extends Punkt {
  
  art: string;
  name: string;
  
  merkmale?: Readonly<Record<string, string>>;
}


export const GEFAHR_DURCH_SM = 0.05;
export const GEFAHR_NAH_SM = 0.6;

export interface GefahrenBefund {
  stufe: 'rot' | 'orange' | 'gruen';
  gefahr: Gefahr | null;
  abstandSm: number | null;
  
  schenkel: number | null;
}


export function pruefeGefahren(punkte: readonly Punkt[], gefahren: readonly Gefahr[]): GefahrenBefund {
  let beste: { g: Gefahr; d: number; s: number } | null = null;
  for (let s = 1; s < punkte.length; s++) {
    for (const g of gefahren) {
      const d = lageZurStrecke(g, punkte[s - 1]!, punkte[s]!).abstandSm;
      if (!beste || d < beste.d) beste = { g, d, s: s - 1 };
    }
  }
  if (!beste || beste.d >= GEFAHR_NAH_SM) return { stufe: 'gruen', gefahr: beste?.g ?? null, abstandSm: beste?.d ?? null, schenkel: beste?.s ?? null };
  return { stufe: beste.d < GEFAHR_DURCH_SM ? 'rot' : 'orange', gefahr: beste.g, abstandSm: beste.d, schenkel: beste.s };
}


export function gefahrAlsKueste(g: Punkt, radiusSm: number, ecken = 12): [Punkt, Punkt][] {
  const r = radiusSm / Math.cos(Math.PI / ecken);
  const ring: Punkt[] = [];
  for (let k = 0; k < ecken; k++) {
    const [lat, lon] = destPoint(g.lat, g.lon, 360 - (360 / ecken) * k, r);
    ring.push({ lat, lon });
  }
  return ring.map((p, k) => [p, ring[(k + 1) % ecken]!] as [Punkt, Punkt]);
}



export function messe(a: Punkt, b: Punkt): { kurs: number; sm: number } {
  return { kurs: bearingDeg(a.lat, a.lon, b.lat, b.lon), sm: distNM(a.lat, a.lon, b.lat, b.lon) };
}


export function messeKette(punkte: readonly Punkt[]): { schenkel: { kurs: number; sm: number }[]; summeSm: number } {
  const schenkel = punkte.slice(1).map((b, k) => messe(punkte[k]!, b));
  return { schenkel, summeSm: schenkel.reduce((s, x) => s + x.sm, 0) };
}


export const XTE_AUF_KURS_SM = 0.1;


export function steuerSeite(xteSm: number | null): 'stb' | 'bb' | null {
  if (xteSm === null || Math.abs(xteSm) < XTE_AUF_KURS_SM) return null;
  return xteSm < 0 ? 'stb' : 'bb';
}


export const XTE_BALKEN_VOLL_SM = 0.3;


export function xteBalkenProzent(xteSm: number | null, vollSm = XTE_BALKEN_VOLL_SM): number {
  if (xteSm === null) return 50;
  const c = Math.max(-1, Math.min(1, xteSm / vollSm));
  return 50 + c * 45;
}


export const PLANFAHRT_KN = 5;

export const PLANFAHRT_MIN_KN = 0.5;
export const PLANFAHRT_MAX_KN = 30;


export function planZeiten(sm: number, fahrtKn: number, abMs: number | null, jetztMs: number): { dauerS: number; abMs: number; ankunftMs: number } | null {
  if (!(sm > 0) || !(fahrtKn >= PLANFAHRT_MIN_KN && fahrtKn <= PLANFAHRT_MAX_KN)) return null;
  
  const ab = Math.floor((abMs ?? jetztMs) / 60_000) * 60_000;
  const dauerS = Math.round((sm / fahrtKn) * 60) * 60;
  return { dauerS, abMs: ab, ankunftMs: ab + dauerS * 1000 };
}


export function planStart(
  p: Punkt,
  kueste: readonly [Punkt, Punkt][] | null,
  hafen: { flaechen: readonly (readonly Punkt[])[]; molen: readonly [Punkt, Punkt][] } | null = null,
): { punkt: Punkt; ausfahrt: boolean } | null {
  if (!kueste?.length) return null;
  if (hafen?.flaechen.length) {
    const vor = startVorHafen(p, hafen.flaechen, [...kueste, ...hafen.molen], kueste);
    if (vor) return { punkt: vor, ausfahrt: true };
  }
  const anLand = liegtAnLand(p, kueste);
  const aus = hafenausfahrt(p, kueste);
  
  if (aus && !liegtAnLand(aus, kueste)) return { punkt: aus, ausfahrt: true };
  return anLand ? null : { punkt: p, ausfahrt: false };
}




export const OFFTRACK_STUFEN_SM: readonly (number | null)[] = [null, 0.1, 0.25, 0.5, 1];

export const OFFTRACK_ZURUECK_ANTEIL = 0.8;

export const OFFTRACK_WIEDERHOLUNG_MS = 2 * 60_000;

export interface OffTrackStand { alarm: boolean; letzterTon: number | null }
export interface OffTrackUrteil extends OffTrackStand {
  
  ton: boolean;
  
  neu: boolean;
}


export function offTrackTakt(xteSm: number | null, grenzeSm: number | null, vorher: OffTrackStand, jetzt: number): OffTrackUrteil {
  if (grenzeSm === null || xteSm === null) return { alarm: false, letzterTon: null, ton: false, neu: false };
  const ab = Math.round(Math.abs(xteSm) * 100) / 100;
  const alarm = vorher.alarm ? ab > grenzeSm * OFFTRACK_ZURUECK_ANTEIL : ab > grenzeSm;
  if (!alarm) return { alarm: false, letzterTon: null, ton: false, neu: false };
  const neu = !vorher.alarm;
  const ton = neu || vorher.letzterTon === null || jetzt - vorher.letzterTon >= OFFTRACK_WIEDERHOLUNG_MS;
  return { alarm: true, letzterTon: ton ? jetzt : vorher.letzterTon, ton, neu };
}




export const ETA_FENSTER_S = [600, 3600] as const;


export function etaBand(
  strecke: number | null, punkte: readonly { t: number; sog: number }[], jetzt: number, laufAnfaenge: readonly number[] = [],
): { frueh: number; spaet: number } | null {
  if (strecke === null || !punkte.length) return null;
  const fahrten: number[] = [];
  for (const f of ETA_FENSTER_S) {
    if (punkte[0]!.t > jetzt - f * 1000) return null;
    const v = geglaetteteSog(punkte, jetzt, f, laufAnfaenge);
    if (v === null || v < STEHT_KN) return null;
    fahrten.push(v);
  }
  const schnell = Math.max(...fahrten), langsam = Math.min(...fahrten);
  return { frueh: jetzt + (strecke / schnell) * 3_600_000, spaet: jetzt + (strecke / langsam) * 3_600_000 };
}
