import type { Punkt } from './types';
import { distNM, kreuzungsZahl, istLandSeite } from './geo';

export interface Wassergitter {
  swLat: number;
  swLon: number;
  dLat: number;
  dLon: number;
  nx: number;
  ny: number;

  frei: Uint8Array;
  zelleSm: number;
}

export interface Box { swLat: number; swLon: number; neLat: number; neLon: number }

export interface Umfahrung {

  punkte: Punkt[];

  sm: number;

  umfahren: boolean;
}

export const MAX_ZELLEN = 1_500_000;

export const STUFEN: readonly { zelleSm: number; abstandZellen: number }[] = [
  { zelleSm: 0.05, abstandZellen: 1 },
  { zelleSm: 0.03, abstandZellen: 1 },
  { zelleSm: 0.03, abstandZellen: 0 },
];

export function boxUm(punkte: readonly Punkt[], randSm: number): Box {
  const lats = punkte.map((p) => p.lat), lons = punkte.map((p) => p.lon);
  const mitteLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = randSm / 60, dLon = randSm / (60 * Math.max(0.2, Math.cos((mitteLat * Math.PI) / 180)));
  return {
    swLat: Math.min(...lats) - dLat, swLon: Math.min(...lons) - dLon,
    neLat: Math.max(...lats) + dLat, neLon: Math.max(...lons) + dLon,
  };
}

export function randFuer(a: Punkt, b: Punkt): number {
  return Math.max(4, 0.4 * distNM(a.lat, a.lon, b.lat, b.lon));
}

export function randZweiterVersuch(a: Punkt, b: Punkt): number {
  return Math.max(distNM(a.lat, a.lon, b.lat, b.lon), 2 * randFuer(a, b));
}

export function baueWassergitter(
  box: Box, kueste: readonly [Punkt, Punkt][], zelleSm: number, abstandZellen: number,
): Wassergitter {
  const mitteLat = (box.swLat + box.neLat) / 2;
  const cosLat = Math.max(0.2, Math.cos((mitteLat * Math.PI) / 180));
  let zelle = zelleSm;
  let dLat = zelle / 60, dLon = zelle / (60 * cosLat);
  let nx = Math.ceil((box.neLon - box.swLon) / dLon), ny = Math.ceil((box.neLat - box.swLat) / dLat);
  if (nx * ny > MAX_ZELLEN) {
    const faktor = Math.sqrt((nx * ny) / MAX_ZELLEN);
    zelle *= faktor;
    dLat = zelle / 60; dLon = zelle / (60 * cosLat);
    nx = Math.ceil((box.neLon - box.swLon) / dLon); ny = Math.ceil((box.neLat - box.swLat) / dLat);
  }
  const gesperrt = new Uint8Array(nx * ny);
  const sperre = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < nx && y < ny) gesperrt[y * nx + x] = 1;
  };

  for (const [a, b] of kueste) {

    if (Math.max(a.lat, b.lat) < box.swLat || Math.min(a.lat, b.lat) > box.neLat
      || Math.max(a.lon, b.lon) < box.swLon || Math.min(a.lon, b.lon) > box.neLon) continue;
    const x0 = (a.lon - box.swLon) / dLon, y0 = (a.lat - box.swLat) / dLat;
    const x1 = (b.lon - box.swLon) / dLon, y1 = (b.lat - box.swLat) / dLat;
    const schritte = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3));
    let vx = Math.floor(x0), vy = Math.floor(y0);
    sperre(vx, vy);
    for (let s = 1; s <= schritte; s++) {
      const t = s / schritte;
      const cx = Math.floor(x0 + (x1 - x0) * t), cy = Math.floor(y0 + (y1 - y0) * t);
      if (cx !== vx && cy !== vy) sperre(cx, vy);
      sperre(cx, cy);
      vx = cx; vy = cy;
    }
  }

  const frei = new Uint8Array(nx * ny);
  if (abstandZellen <= 0) {
    for (let i = 0; i < frei.length; i++) frei[i] = gesperrt[i] ? 0 : 1;
  } else {

    const zeile = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        if (!gesperrt[y * nx + x]) continue;
        for (let d = -abstandZellen; d <= abstandZellen; d++) {
          const xx = x + d;
          if (xx >= 0 && xx < nx) zeile[y * nx + xx] = 1;
        }
      }
    }
    const voll = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        if (!zeile[y * nx + x]) continue;
        for (let d = -abstandZellen; d <= abstandZellen; d++) {
          const yy = y + d;
          if (yy >= 0 && yy < ny) voll[yy * nx + x] = 1;
        }
      }
    }
    for (let i = 0; i < frei.length; i++) frei[i] = voll[i] ? 0 : 1;
  }
  return { swLat: box.swLat, swLon: box.swLon, dLat, dLon, nx, ny, frei, zelleSm: zelle };
}

function zellMitte(g: Wassergitter, i: number): Punkt {
  const x = i % g.nx, y = Math.floor(i / g.nx);
  return { lat: g.swLat + (y + 0.5) * g.dLat, lon: g.swLon + (x + 0.5) * g.dLon };
}

function zellIndex(g: Wassergitter, p: Punkt): number | null {
  const x = Math.floor((p.lon - g.swLon) / g.dLon), y = Math.floor((p.lat - g.swLat) / g.dLat);
  if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) return null;
  return y * g.nx + x;
}

function kuesteNah(p: Punkt, kueste: readonly [Punkt, Punkt][], sm: number): [Punkt, Punkt][] {
  const dLat = sm / 60, dLon = sm / (60 * Math.max(0.2, Math.cos((p.lat * Math.PI) / 180)));
  return kueste.filter(([a, b]) => Math.max(a.lat, b.lat) >= p.lat - dLat && Math.min(a.lat, b.lat) <= p.lat + dLat
    && Math.max(a.lon, b.lon) >= p.lon - dLon && Math.min(a.lon, b.lon) <= p.lon + dLon) as [Punkt, Punkt][];
}

export const ANSCHLUSS_MAX_SM = 0.5;

export function liegtAnLand(p: Punkt, kueste: readonly [Punkt, Punkt][]): boolean {
  return istLandSeite(p, kuesteNah(p, kueste, ANSCHLUSS_MAX_SM + 3), 1) === true;
}

export function geradeUeberWasser(
  a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], aAnLand?: boolean,
): boolean {
  if (kueste.length === 0) return true;
  if (aAnLand ?? liegtAnLand(a, kueste)) return false;
  if (kreuzungsZahl(a, b, kueste as [Punkt, Punkt][]) !== 0) return false;

  return !amFluss(a, kueste) && !amFluss(b, kueste);
}

export function naechsteZelleDerFlaeche(
  g: Wassergitter, flaechen: Int32Array, flaecheId: number, p: Punkt, maxSm: number,
): Punkt | null {
  const cx = Math.floor((p.lon - g.swLon) / g.dLon), cy = Math.floor((p.lat - g.swLat) / g.dLat);
  const maxR = Math.ceil(maxSm / g.zelleSm);
  let beste: Punkt | null = null, besteSm = Infinity;
  for (let dy = -maxR; dy <= maxR; dy++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) continue;
      const i = y * g.nx + x;
      if (!g.frei[i] || flaechen[i] !== flaecheId) continue;
      const m = zellMitte(g, i);
      const sm = distNM(p.lat, p.lon, m.lat, m.lon);
      if (sm <= maxSm && sm < besteSm) { beste = m; besteSm = sm; }
    }
  }
  return beste;
}

export function anschlussZelle(
  g: Wassergitter, p: Punkt, kueste: readonly [Punkt, Punkt][],

  nurFlaeche?: number,
): number | null {
  const nah = kuesteNah(p, kueste, ANSCHLUSS_MAX_SM + 3);

  const anLand = istLandSeite(p, nah, 1) === true;
  const passt = (k: number) => (anLand ? k % 2 === 1 : k === 0);
  const flaechen = nurFlaeche === undefined ? null : wasserflaechen(g);
  const frei = (i: number) => g.frei[i] && (!flaechen || flaechen[i] === nurFlaeche);
  const mitte = zellIndex(g, p);
  if (mitte != null && frei(mitte) && passt(kreuzungsZahl(p, zellMitte(g, mitte), nah))) return mitte;
  const cx = Math.floor((p.lon - g.swLon) / g.dLon), cy = Math.floor((p.lat - g.swLat) / g.dLat);
  const maxR = Math.ceil(ANSCHLUSS_MAX_SM / g.zelleSm);
  for (let r = 1; r <= maxR; r++) {
    const ring: number[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) continue;
        const i = y * g.nx + x;
        if (frei(i)) ring.push(i);
      }
    }

    ring.sort((i, j) => {
      const a = zellMitte(g, i), b = zellMitte(g, j);
      return distNM(p.lat, p.lon, a.lat, a.lon) - distNM(p.lat, p.lon, b.lat, b.lon);
    });
    for (const i of ring) if (passt(kreuzungsZahl(p, zellMitte(g, i), nah))) return i;
  }
  return null;
}

class Heap {
  private daten: number[] = [];
  constructor(private f: Float32Array) {}
  get leer(): boolean { return this.daten.length === 0; }
  rein(i: number): void {
    const d = this.daten; d.push(i);
    let k = d.length - 1;
    while (k > 0) {
      const e = (k - 1) >> 1;
      if (this.f[d[e]!]! <= this.f[d[k]!]!) break;
      [d[e], d[k]] = [d[k]!, d[e]!]; k = e;
    }
  }
  raus(): number {
    const d = this.daten; const oben = d[0]!; const letzt = d.pop()!;
    if (d.length > 0) {
      d[0] = letzt;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < d.length && this.f[d[l]!]! < this.f[d[m]!]!) m = l;
        if (r < d.length && this.f[d[r]!]! < this.f[d[m]!]!) m = r;
        if (m === k) break;
        [d[m], d[k]] = [d[k]!, d[m]!]; k = m;
      }
    }
    return oben;
  }
}

interface Arbeit { gk: Float32Array; f: Float32Array; vor: Int32Array; stempel: Int32Array; zu: Int32Array; generation: number }
const arbeitJeGitter = new WeakMap<Wassergitter, Arbeit>();

export function suchePfad(g: Wassergitter, start: number, ziel: number): number[] | null {
  const n = g.nx * g.ny;
  let arbeit = arbeitJeGitter.get(g);
  if (!arbeit) {
    arbeit = { gk: new Float32Array(n), f: new Float32Array(n), vor: new Int32Array(n), stempel: new Int32Array(n), zu: new Int32Array(n), generation: 0 };
    arbeitJeGitter.set(g, arbeit);
  }
  const gen = ++arbeit.generation;
  const { gk, f, vor, stempel } = arbeit;
  const zuStempel = arbeit.zu;
  const kennt = (i: number) => stempel[i] === gen;
  const beruehre = (i: number) => { if (!kennt(i)) { stempel[i] = gen; gk[i] = Infinity; f[i] = Infinity; vor[i] = -1; } };
  const zu = { get: (i: number) => zuStempel[i] === gen, set: (i: number) => { zuStempel[i] = gen; } };
  const zxz = ziel % g.nx, zyz = Math.floor(ziel / g.nx);
  const h = (i: number) => {
    const dx = Math.abs((i % g.nx) - zxz), dy = Math.abs(Math.floor(i / g.nx) - zyz);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const heap = new Heap(f);
  beruehre(start);
  gk[start] = 0; f[start] = h(start); heap.rein(start);
  while (!heap.leer) {
    const i = heap.raus();
    if (zu.get(i)) continue;
    if (i === ziel) {
      const pfad: number[] = [];
      for (let k = i; k !== -1; k = vor[k]!) pfad.push(k);
      return pfad.reverse();
    }
    zu.set(i);
    const x = i % g.nx, y = Math.floor(i / g.nx);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.nx || yy >= g.ny) continue;
        const j = yy * g.nx + xx;
        if (!g.frei[j] || zu.get(j)) continue;
        if (dx && dy && (!g.frei[y * g.nx + xx] || !g.frei[yy * g.nx + x])) continue;
        beruehre(j);
        const neu = gk[i]! + (dx && dy ? Math.SQRT2 : 1);
        if (neu < gk[j]!) {
          gk[j] = neu; vor[j] = i; f[j] = neu + h(j); heap.rein(j);
        }
      }
    }
  }
  return null;
}

function sichtFrei(g: Wassergitter, a: Punkt, b: Punkt): boolean {
  const ax = (a.lon - g.swLon) / g.dLon, ay = (a.lat - g.swLat) / g.dLat;
  const bx = (b.lon - g.swLon) / g.dLon, by = (b.lat - g.swLat) / g.dLat;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 3));
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const x = Math.floor(ax + (bx - ax) * t), y = Math.floor(ay + (by - ay) * t);
    if (x < 0 || y < 0 || x >= g.nx || y >= g.ny || !g.frei[y * g.nx + x]) return false;
  }
  return true;
}

export function glaette(g: Wassergitter, pfad: readonly number[]): Punkt[] {
  const p = pfad.map((i) => zellMitte(g, i));
  if (p.length <= 2) return p;
  const aus: Punkt[] = [p[0]!];
  let i = 0;
  while (i < p.length - 1) {
    let j = p.length - 1;
    while (j > i + 1 && !sichtFrei(g, p[i]!, p[j]!)) j--;
    aus.push(p[j]!);
    i = j;
  }
  return aus;
}

const STRAFF_SCHRITTE = 14;
const STRAFF_DURCHGAENGE = 40;
const STRAFF_MIN_SM = 0.01;

const STRAFF_DICHTE_SM = 0.5;
const STRAFF_MAX_PUNKTE = 300;
function verdichte(p: readonly Punkt[], zelleSm: number): Punkt[] {
  const gesamt = weglaenge(p);
  const schritt = Math.max(STRAFF_DICHTE_SM, 2 * zelleSm, gesamt / STRAFF_MAX_PUNKTE);
  const aus: Punkt[] = [p[0]!];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!, b = p[i]!;
    const n = Math.max(1, Math.round(distNM(a.lat, a.lon, b.lat, b.lon) / schritt));
    for (let k = 1; k <= n; k++) aus.push(zwischen(a, b, k / n));
  }
  return aus;
}
const zwischen = (p: Punkt, q: Punkt, t: number): Punkt => ({ lat: p.lat + (q.lat - p.lat) * t, lon: p.lon + (q.lon - p.lon) * t });
export function straffe(g: Wassergitter, punkte: readonly Punkt[]): Punkt[] {
  const p = verdichte(punkte, g.zelleSm);
  for (let d = 0; d < STRAFF_DURCHGAENGE && p.length > 2; d++) {
    const vorher = weglaenge(p);
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i - 1]!, m = p[i]!, b = p[i + 1]!;
      if (sichtFrei(g, a, b)) { p.splice(i, 1); i--; continue; }

      const rueck = (ziel: Punkt, von: Punkt): Punkt => {
        let lo = 0, hi = 1;
        for (let s = 0; s < STRAFF_SCHRITTE; s++) {
          const t = (lo + hi) / 2;
          if (sichtFrei(g, von, zwischen(m, ziel, t))) lo = t; else hi = t;
        }
        return zwischen(m, ziel, lo);
      };
      const zuB = rueck(b, a), zuA = rueck(a, b);
      const lang = (q: Punkt) => distNM(a.lat, a.lon, q.lat, q.lon) + distNM(q.lat, q.lon, b.lat, b.lon);
      const best = lang(zuB) <= lang(zuA) ? zuB : zuA;
      if (lang(best) < lang(m) - 1e-6) p[i] = best;
    }
    if (vorher - weglaenge(p) < STRAFF_MIN_SM) break;
  }
  return p;
}

function weglaenge(punkte: readonly Punkt[]): number {
  let sm = 0;
  for (let i = 1; i < punkte.length; i++) sm += distNM(punkte[i - 1]!.lat, punkte[i - 1]!.lon, punkte[i]!.lat, punkte[i]!.lon);
  return sm;
}

const flaechenJeGitter = new WeakMap<Wassergitter, Int32Array>();
export function wasserflaechen(g: Wassergitter): Int32Array {
  const vorhanden = flaechenJeGitter.get(g);
  if (vorhanden) return vorhanden;
  const n = g.nx * g.ny;
  const flaeche = new Int32Array(n).fill(-1);
  const stapel = new Int32Array(n);
  let naechste = 0;
  for (let s0 = 0; s0 < n; s0++) {
    if (!g.frei[s0] || flaeche[s0] !== -1) continue;
    let oben = 0;
    stapel[oben++] = s0; flaeche[s0] = naechste;
    while (oben > 0) {
      const i = stapel[--oben]!;
      const x = i % g.nx, y = (i - x) / g.nx;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= g.nx || yy >= g.ny) continue;
          const j = yy * g.nx + xx;
          if (!g.frei[j] || flaeche[j] !== -1) continue;
          if (dx && dy && (!g.frei[y * g.nx + xx] || !g.frei[yy * g.nx + x])) continue;
          flaeche[j] = naechste; stapel[oben++] = j;
        }
      }
    }
    naechste++;
  }
  flaechenJeGitter.set(g, flaeche);
  return flaeche;
}

const hauptJeGitter = new WeakMap<Wassergitter, number | null>();
export function hauptflaeche(g: Wassergitter): number | null {
  if (hauptJeGitter.has(g)) return hauptJeGitter.get(g)!;
  const flaeche = wasserflaechen(g);
  const zaehler = new Map<number, number>();
  for (let i = 0; i < flaeche.length; i++) if (flaeche[i]! >= 0) zaehler.set(flaeche[i]!, (zaehler.get(flaeche[i]!) ?? 0) + 1);
  let haupt: number | null = null, groesse = 0;
  for (const [f, n] of zaehler) if (n > groesse) { haupt = f; groesse = n; }
  hauptJeGitter.set(g, haupt);
  return haupt;
}

export type AnschlussSpeicher = Map<Punkt, number | null>;

export interface Durchfahrt {
  name: string;
  enden: readonly [Punkt, Punkt];

  zelleSm: number;

  randSm?: number;

  kette?: readonly Punkt[];

  fluss?: true;
  zugang?: Punkt;
  zugangKette?: readonly Punkt[];

  bereich?: Box;
}

const P = (lat: number, lon: number): Punkt => ({ lat, lon });

export const DURCHFAHRTEN: readonly Durchfahrt[] = [
  {
    name: 'Kanal von Korinth', enden: [P(37.955, 22.9555), P(37.912, 23.016)], zelleSm: 0.003,
    kette: [P(37.91802, 23.00713), P(37.91202, 23.01601)],
  },
  { name: 'Rio-Andirrio-Brücke', enden: [P(38.300, 21.710), P(38.345, 21.800)], zelleSm: 0.02 },

  {
    name: 'Straße von Messina', enden: [P(38.320, 15.660), P(38.050, 15.570)], zelleSm: 0.05, randSm: 3,
    kette: [P(38.26458, 15.65429), P(38.21708, 15.62566)],
    bereich: { swLat: 38.05, swLon: 15.45, neLat: 38.32, neLon: 15.80 },
  },
  {
    name: 'Lefkas-Kanal', enden: [P(38.865, 20.720), P(38.765, 20.735)], zelleSm: 0.003,
    kette: [P(38.84698, 20.7217), P(38.84682, 20.72164), P(38.84567, 20.71913), P(38.84502, 20.71836),
      P(38.83772, 20.71439), P(38.83702, 20.71419), P(38.83467, 20.71406), P(38.83347, 20.71406),
      P(38.80667, 20.7276), P(38.79512, 20.72947), P(38.76503, 20.73498)],
  },
  {
    name: 'Euripos-Brücke', enden: [P(38.482, 23.585), P(38.440, 23.600)], zelleSm: 0.003,
    kette: [P(38.47502, 23.59135), P(38.47237, 23.59276), P(38.46427, 23.59123), P(38.46287, 23.5895),
      P(38.46237, 23.58937), P(38.46087, 23.58912), P(38.44862, 23.58733), P(38.44797, 23.58746),
      P(38.44752, 23.58791), P(38.44297, 23.59467), P(38.44297, 23.59627), P(38.44262, 23.59755), P(38.44062, 23.59991),
      P(38.44002, 23.59997)],
  },

  {
    name: 'Brindisi, innerer Hafen', enden: [P(40.648, 17.955), P(40.6436, 17.9488)], zelleSm: 0.003,
    kette: [P(40.64513, 17.9516), P(40.64442, 17.95061), P(40.64363, 17.94883)],
  },
  {

    name: 'Krka bis Skradin', enden: [P(43.712, 15.830), P(43.81434, 15.92042)], zelleSm: 0.003, randSm: 1.2,
    fluss: true, zugang: P(43.748, 15.868),

    zugangKette: [P(43.72426, 15.85903), P(43.72836, 15.87611), P(43.72836, 15.87773), P(43.72912, 15.87992),
      P(43.72941, 15.88), P(43.73854, 15.87636), P(43.74801, 15.86802)],
    kette: [
      P(43.7627, 15.84933), P(43.7652, 15.84874), P(43.7681, 15.84724), P(43.76872, 15.84689),
      P(43.7692, 15.8461), P(43.77022, 15.84432), P(43.77357, 15.84089), P(43.77413, 15.84065),
      P(43.77471, 15.8408), P(43.7751, 15.84112), P(43.77541, 15.84166), P(43.77631, 15.84648),
      P(43.77656, 15.84683), P(43.77704, 15.84693), P(43.78048, 15.84635), P(43.78083, 15.84648),
      P(43.78108, 15.84685), P(43.78312, 15.85085), P(43.78331, 15.85112), P(43.7835, 15.85122),
      P(43.7837, 15.8512), P(43.78861, 15.84917), P(43.789, 15.84906), P(43.78928, 15.84906),
      P(43.78955, 15.84919), P(43.78979, 15.84943), P(43.78995, 15.84983), P(43.79004, 15.85032),
      P(43.79001, 15.85347), P(43.7889, 15.85815), P(43.78888, 15.85852), P(43.7892, 15.86163),
      P(43.7896, 15.86306), P(43.79026, 15.86407), P(43.79497, 15.86856), P(43.8062, 15.87622),
      P(43.80835, 15.87758), P(43.80991, 15.88013), P(43.81024, 15.88304), P(43.80934, 15.8863),
      P(43.80728, 15.89054), P(43.80664, 15.89522), P(43.80726, 15.90501), P(43.80638, 15.90871),
      P(43.80691, 15.91066), P(43.80732, 15.91231), P(43.80856, 15.91579), P(43.8092, 15.91772),
      P(43.80961, 15.9184), P(43.81013, 15.91874), P(43.81301, 15.91916), P(43.81377, 15.91954),
    ],
  },
];

const FLUSS_NAEHE_SM = 0.3;

const flussQuerungen = new WeakMap<readonly [Punkt, Punkt][], Map<string, number[]>>();

function querungenEntlang(d: Durchfahrt, kueste: readonly [Punkt, Punkt][]): number[] {
  let je = flussQuerungen.get(kueste);
  if (!je) { je = new Map(); flussQuerungen.set(kueste, je); }
  const da = je.get(d.name);
  if (da) return da;
  const k = flussKette(d);
  const summe = [0];
  for (let i = 1; i < k.length; i++) summe.push(summe[i - 1]! + kreuzungsZahl(k[i - 1]!, k[i]!, kueste as [Punkt, Punkt][]));
  je.set(d.name, summe);
  return summe;
}

function flussKette(d: Durchfahrt): Punkt[] {
  return [d.zugang!, ...(d.kette ?? []), d.enden[1]];
}

function flussZugang(d: Durchfahrt, kueste: readonly [Punkt, Punkt][], vereinfacht: boolean): Punkt[] | null {
  const weg = durchfahrtsWegAusKueste({ ...d, name: `${d.name}:zugang`, enden: [d.enden[0], d.zugang!] }, kueste);
  if (weg || !vereinfacht || !d.zugangKette) return weg;
  return [d.enden[0], ...d.zugangKette, d.zugang!];
}

export function amFluss(p: Punkt, kueste: readonly [Punkt, Punkt][]): { d: Durchfahrt; i: number } | null {
  for (const d of DURCHFAHRTEN) {
    if (!d.fluss) continue;
    const k = flussKette(d);
    let i = -1, best = FLUSS_NAEHE_SM;
    for (let j = 1; j < k.length; j++) {
      const x = distNM(p.lat, p.lon, k[j]!.lat, k[j]!.lon);
      if (x <= best) { best = x; i = j; }
    }
    if (i < 0) continue;
    const q = kreuzungsZahl(p, k[i]!, kueste as [Punkt, Punkt][]) + querungenEntlang(d, kueste)[i]!;
    if (q % 2 === 1) return { d, i };
  }
  return null;
}

const DURCHFAHRT_RAND_SM = 0.3;

const DURCHFAHRT_UMWEG_MAX = 3;

const DURCHFAHRT_GEWINN_MIN = 0.9;

const teilwege = new WeakMap<Wassergitter, Map<string, Punkt[] | null>>();

const durchfahrtsWege = new WeakMap<readonly [Punkt, Punkt][], Map<string, Punkt[] | null>>();

export function durchfahrtsWeg(d: Durchfahrt, kueste: readonly [Punkt, Punkt][], vereinfacht = false): Punkt[] | null {

  if (d.fluss) {
    if (!vereinfacht && querungenEntlang(d, kueste).at(-1) !== 1) return null;
    const zugang = flussZugang(d, kueste, vereinfacht);
    return zugang ? [...zugang, ...flussKette(d).slice(1)] : null;
  }
  const weg = durchfahrtsWegAusKueste(d, kueste);
  if (weg || !vereinfacht || !d.kette) return weg;
  return [d.enden[0], ...d.kette, d.enden[1]];
}

function durchfahrtsWegAusKueste(d: Durchfahrt, kueste: readonly [Punkt, Punkt][]): Punkt[] | null {
  let je = durchfahrtsWege.get(kueste);
  if (!je) { je = new Map(); durchfahrtsWege.set(kueste, je); }
  if (je.has(d.name)) return je.get(d.name)!;
  const box = boxUm(d.enden, d.randSm ?? DURCHFAHRT_RAND_SM);
  const lokal = kueste.filter(([p, q]) => Math.max(p.lat, q.lat) >= box.swLat && Math.min(p.lat, q.lat) <= box.neLat
    && Math.max(p.lon, q.lon) >= box.swLon && Math.min(p.lon, q.lon) <= box.neLon) as [Punkt, Punkt][];
  const weg = lokal.length === 0 ? null
    : wegImGitterDirekt(baueWassergitter(box, lokal, d.zelleSm, 0), d.enden[0], d.enden[1], lokal);
  je.set(d.name, weg);
  return weg;
}

export function wegImGitter(
  g: Wassergitter, a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], speicher?: AnschlussSpeicher, tiefe = 2,
  vereinfacht = false,
): Punkt[] | null {
  let bester = wegImGitterDirekt(g, a, b, kueste, speicher);
  if (tiefe <= 0) return bester;
  let besterSm = bester ? weglaenge(bester) : Infinity;
  const luft = distNM(a.lat, a.lon, b.lat, b.lon);
  const imGitter = (p: Punkt) => p.lat > g.swLat && p.lat < g.swLat + g.ny * g.dLat
    && p.lon > g.swLon && p.lon < g.swLon + g.nx * g.dLon;
  let gemerkt = teilwege.get(g);
  if (!gemerkt) { gemerkt = new Map(); teilwege.set(g, gemerkt); }
  const teil = (p: Punkt, q: Punkt): Punkt[] | null => {
    const schluessel = `${p.lat},${p.lon}>${q.lat},${q.lon}|${tiefe}|${vereinfacht}`;
    if (gemerkt!.has(schluessel)) return gemerkt!.get(schluessel)!;
    const w = geradeUeberWasser(p, q, kueste) ? [p, q] : wegImGitter(g, p, q, kueste, speicher, tiefe - 1, vereinfacht);
    gemerkt!.set(schluessel, w);
    return w;
  };
  for (const d of DURCHFAHRTEN) {
    if (d.fluss || !imGitter(d.enden[0]) || !imGitter(d.enden[1])) continue;
    for (const umgekehrt of [false, true]) {
      const e = d.enden[umgekehrt ? 1 : 0], f = d.enden[umgekehrt ? 0 : 1];
      const schranke = distNM(a.lat, a.lon, e.lat, e.lon) + distNM(e.lat, e.lon, f.lat, f.lon) + distNM(f.lat, f.lon, b.lat, b.lon);
      if (schranke >= DURCHFAHRT_GEWINN_MIN * besterSm || schranke > DURCHFAHRT_UMWEG_MAX * luft + 10) continue;
      const durch = durchfahrtsWeg(d, kueste, vereinfacht);
      if (!durch) continue;
      const hin = teil(a, e);
      if (!hin) continue;
      const weiter = teil(f, b);
      if (!weiter) continue;
      const weg = [...hin, ...(umgekehrt ? [...durch].reverse() : durch).slice(1), ...weiter.slice(1)];
      const sm = weglaenge(weg);
      if (sm < besterSm) { bester = entferneDoppelte(weg, kueste); besterSm = sm; }
    }
  }
  return bester ?? flussWeg(a, b, kueste, vereinfacht, (p, q) => (imGitter(p) && imGitter(q) ? teil(p, q) : null));
}

function flussWeg(
  a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], vereinfacht: boolean,
  suche: (p: Punkt, q: Punkt) => Punkt[] | null,
): Punkt[] | null {
  const fa = amFluss(a, kueste), fb = amFluss(b, kueste);
  if (!fa && !fb) return null;
  const d = (fa ?? fb)!.d;
  if (!durchfahrtsWeg(d, kueste, vereinfacht)) return null;
  const k = flussKette(d);
  if (fa && fb) {
    if (fa.d !== fb.d) return null;
    const teil = fa.i <= fb.i ? k.slice(fa.i, fb.i + 1) : k.slice(fb.i, fa.i + 1).reverse();
    return entferneDoppelte([a, ...teil, b], kueste);
  }

  const zumZugang = (q: Punkt): Punkt[] | null => {
    const direkt = suche(q, k[0]!);
    if (direkt) return direkt;
    const zugang = flussZugang(d, kueste, vereinfacht);
    const see = zugang ? suche(q, zugang[0]!) : null;
    return see && zugang ? [...see, ...zugang.slice(1)] : null;
  };
  if (fb) {
    const hin = zumZugang(a);
    return hin ? entferneDoppelte([...hin, ...k.slice(1, fb.i + 1), b], kueste) : null;
  }
  const zurueck = zumZugang(b);
  return zurueck ? entferneDoppelte([a, ...k.slice(1, fa!.i + 1).reverse(), ...[...zurueck].reverse()], kueste) : null;
}

function wegImGitterDirekt(
  g: Wassergitter, a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], speicher?: AnschlussSpeicher,
): Punkt[] | null {
  const anschluss = (q: Punkt): number | null => {
    if (speicher?.has(q)) return speicher.get(q)!;
    const z = anschlussZelle(g, q, kueste);
    speicher?.set(q, z);
    return z;
  };
  let sa = anschluss(a), sb = anschluss(b);
  const flaeche = wasserflaechen(g);

  if (sa == null || sb == null || flaeche[sa] !== flaeche[sb]) {
    const haupt = hauptflaeche(g);
    if (haupt == null) return null;
    if (sa == null || flaeche[sa] !== haupt) sa = anschlussZelle(g, a, kueste, haupt);
    if (sb == null || flaeche[sb] !== haupt) sb = anschlussZelle(g, b, kueste, haupt);
    if (sa == null || sb == null) return null;
  }
  const pfad = suchePfad(g, sa, sb);
  if (!pfad) return null;
  const mitte = straffe(g, glaette(g, pfad));
  const punkte = [a, ...mitte, b];

  for (let i = 2; i < punkte.length - 1; i++) {
    const p = punkte[i - 1]!, q = punkte[i]!;
    if (kreuzungsZahl(p, q, kuesteNah({ lat: (p.lat + q.lat) / 2, lon: (p.lon + q.lon) / 2 }, kueste,
      distNM(p.lat, p.lon, q.lat, q.lon) / 2 + 1)) > 0) return null;
  }
  return entferneDoppelte(punkte, kueste);
}

function entferneDoppelte(punkte: Punkt[], kueste?: readonly [Punkt, Punkt][]): Punkt[] {
  const quer = (p: Punkt, q: Punkt) => kreuzungsZahl(p, q, kuesteNah({ lat: (p.lat + q.lat) / 2, lon: (p.lon + q.lon) / 2 },
    kueste!, distNM(p.lat, p.lon, q.lat, q.lon) / 2 + 1));
  const aus: Punkt[] = [];
  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i]!, vor = aus[aus.length - 1];
    if (vor && i < punkte.length - 1 && distNM(p.lat, p.lon, vor.lat, vor.lon) <= 0.02) {
      const nach = punkte[i + 1]!;
      if (!kueste || quer(vor, nach) === quer(vor, p) + quer(p, nach)) continue;
    }
    aus.push(p);
  }
  return aus;
}

export function umfahreLand(
  a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], teilung = TEILUNG_TIEFE,

  randSm = randFuer(a, b),

  engeMitVtg = false,
): Umfahrung | null {
  if (geradeUeberWasser(a, b, kueste)) {
    return { punkte: [a, b], sm: distNM(a.lat, a.lon, b.lat, b.lon), umfahren: false };
  }
  const imGitter = inStufen(a, b, kueste, boxUm([a, b], randSm), distNM(a.lat, a.lon, b.lat, b.lon), engeMitVtg);
  if (imGitter) return imGitter;
  return ohneGitterweg(a, b, kueste, teilung);
}

function inStufen(a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], box: Box, luft: number, engeMitVtg = false): Umfahrung | null {
  let bester: Umfahrung | null = null;
  for (const stufe of STUFEN) {
    const g = baueWassergitter(box, kueste, stufe.zelleSm, stufe.abstandZellen);
    const weg = wegImGitter(g, a, b, kueste);
    if (!weg) continue;
    const sm = weglaenge(weg);
    if (!bester || sm < bester.sm) bester = { punkte: weg, sm, umfahren: true };

    if (bester.sm <= UMWEG_FEINER * luft && !rueckZumEnde(weg, a, b) && !(engeMitVtg && durchEngeMitBereich(weg))) return bester;
  }
  return bester;
}

function ohneGitterweg(a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], teilung: number): Umfahrung | null {

  if (teilung > 0) {

    const ausA = hafenausfahrt(a, kueste), ausB = hafenausfahrt(b, kueste);
    const start = ausA ?? a, ende = ausB ?? b;
    const fertig = (mitte: Punkt[]): Umfahrung => {
      const punkte = entferneDoppelte([...(ausA ? [a] : []), ...mitte, ...(ausB ? [b] : [])], kueste);
      return { punkte, sm: weglaenge(punkte), umfahren: true };
    };
    if (ausA || ausB) {
      const u = umfahreLand(start, ende, kueste, 0);
      if (u) return fertig(u.punkte);
    }
    const mitte = ueberHilfspunkte(start, ende, kueste);
    if (mitte) return fertig(mitte);
  }
  return null;
}

export function ueberHilfspunkte(
  start: Punkt, ende: Punkt, kueste: readonly [Punkt, Punkt][], abstaende: readonly number[] = TEILUNG_ABSTAND_SM,
): Punkt[] | null {
  const d = distNM(start.lat, start.lon, ende.lat, ende.lon);
  let bester: { punkte: Punkt[]; sm: number } | null = null;
  for (const abstand of abstaende) {
    if (d < 2 * abstand + 2) continue;
    const ta = wasserNahe(entlang(start, ende, abstand / d), kueste);
    const tb = wasserNahe(entlang(ende, start, abstand / d), kueste);
    if (!ta || !tb) continue;
    const stuecke: Umfahrung[] = [];
    for (const [p, q] of [[start, ta], [ta, tb], [tb, ende]] as const) {
      const u = umfahreLand(p, q, kueste, 0);
      if (!u) break;
      stuecke.push(u);
    }
    if (stuecke.length < 3) continue;
    const punkte = [start, ...stuecke.flatMap((u) => u.punkte.slice(1))];
    const sm = weglaenge(punkte);
    if (!bester || sm < bester.sm) bester = { punkte, sm };
  }
  return bester?.punkte ?? null;
}

const imBereich = (p: Punkt, x: Box) => p.lat >= x.swLat && p.lat <= x.neLat && p.lon >= x.swLon && p.lon <= x.neLon;

function rueckZumEnde(weg: readonly Punkt[], a: Punkt, b: Punkt): boolean {
  return DURCHFAHRTEN.some((d) => d.bereich && (imBereich(a, d.bereich) || imBereich(b, d.bereich))
    && weg.some((p) => d.enden.some((e) => distNM(p.lat, p.lon, e.lat, e.lon) <= 0.05)));
}

function durchEngeMitBereich(weg: readonly Punkt[]): boolean {
  return DURCHFAHRTEN.some((d) => d.bereich && weg.some((p) => imBereich(p, d.bereich!)));
}

export const UMWEG_FEINER = 1.5;

export const TEILUNG_ABSTAND_SM = [3, 6, 1.5, 10, 15] as const;
export const TEILUNG_TIEFE = 1;

export const HAFENAUSFAHRT_MAX_SM = 1;

export const HAFENBECKEN_MAX_SM2 = 0.25;

export function hafenausfahrt(p: Punkt, kueste: readonly [Punkt, Punkt][]): Punkt | null {

  const g = baueWassergitter(boxUm([p], 3), kueste, 0.03, 0);
  const flaeche = wasserflaechen(g);
  const haupt = hauptflaeche(g);
  if (haupt == null) return null;
  const z = zellIndex(g, p);
  if (z != null && g.frei[z]) {
    const f = flaeche[z]!;
    if (f === haupt) return null;
    let zellen = 0;
    for (let i = 0; i < flaeche.length; i++) if (flaeche[i] === f) zellen++;
    if (zellen * g.zelleSm * g.zelleSm >= HAFENBECKEN_MAX_SM2) return null;
  }
  const draussen = naechsteZelleDerFlaeche(g, flaeche, haupt, p, HAFENAUSFAHRT_MAX_SM);

  return draussen && landStreckeSm(p, draussen, kueste) <= HAFENAUSFAHRT_LAND_MAX_SM ? draussen : null;
}

export const HAFENAUSFAHRT_LAND_MAX_SM = 0.08;

export function landStreckeSm(p: Punkt, q: Punkt, kueste: readonly [Punkt, Punkt][]): number {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const x = (r: Punkt) => (r.lon - p.lon) * cosLat, y = (r: Punkt) => r.lat - p.lat;
  const dx = x(q), dy = y(q);
  const ts: number[] = [];
  for (const [c1, c2] of kueste) {
    const ex = x(c2) - x(c1), ey = y(c2) - y(c1);
    const nenner = dx * ey - dy * ex;
    if (Math.abs(nenner) < 1e-15) continue;
    const t = (x(c1) * ey - y(c1) * ex) / nenner;
    const u = (x(c1) * dy - y(c1) * dx) / nenner;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((m, n) => m - n);
  const laenge = distNM(p.lat, p.lon, q.lat, q.lon);
  let land = liegtAnLand(p, kueste), von = 0, summe = 0, erstes = land;
  for (const t of [...ts, 1]) {
    if (land && !erstes) summe += (t - von) * laenge;
    if (land) erstes = false;
    land = !land; von = t;
  }
  return summe;
}

function entlang(a: Punkt, b: Punkt, f: number): Punkt {
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
}

function wasserNahe(p: Punkt, kueste: readonly [Punkt, Punkt][]): Punkt | null {
  const linien = kueste as [Punkt, Punkt][];
  if (istLandSeite(p, linien) === false) return p;
  const cosLat = Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
  for (let r = 0.25; r <= 6; r += 0.25) {
    for (let i = 0; i < 16; i++) {
      const w = (i * Math.PI) / 8;
      const q = { lat: p.lat + (r / 60) * Math.cos(w), lon: p.lon + (r / 60) * Math.sin(w) / cosLat };
      if (istLandSeite(q, linien) === false) return q;
    }
  }
  return null;
}

export interface RoutenUmfahrung {
  punkte: Punkt[];

  umfahreneAbschnitte: number[];

  ohneWeg: number[];

  abschnitte?: Punkt[][];
}

export function umfahreRoute(wegpunkte: readonly Punkt[], kueste: readonly [Punkt, Punkt][]): RoutenUmfahrung {
  const punkte: Punkt[] = wegpunkte.length ? [wegpunkte[0]!] : [];
  const umfahreneAbschnitte: number[] = [], ohneWeg: number[] = [], abschnitte: Punkt[][] = [];
  for (let i = 1; i < wegpunkte.length; i++) {
    const a = wegpunkte[i - 1]!, b = wegpunkte[i]!;
    const u = umfahreLand(a, b, kueste);
    if (!u) { ohneWeg.push(i - 1); punkte.push(b); abschnitte.push([a, b]); continue; }
    if (u.umfahren) umfahreneAbschnitte.push(i - 1);
    punkte.push(...u.punkte.slice(1));
    abschnitte.push(u.punkte);
  }
  return { punkte, umfahreneAbschnitte, ohneWeg, abschnitte };
}

const SEEWEG_FLAECHE_MIN_SM2 = 25;

export function seeweg(
  a: Punkt, b: Punkt, kueste: readonly [Punkt, Punkt][], randSm = 150, zelleSm = 0.5,

  vereinfacht = false,
): Punkt[] | null {
  if (kueste.length === 0) return null;

  const ueberFluss = flussWeg(a, b, kueste, vereinfacht, (p, q) => seeweg(p, q, kueste, randSm, zelleSm, vereinfacht));
  if (ueberFluss) return ueberFluss;
  const g = baueWassergitter(boxUm([a, b], randSm), kueste, zelleSm, 0);
  const flaeche = wasserflaechen(g);
  const groesse = new Map<number, number>();
  for (let z = 0; z < flaeche.length; z++) if (flaeche[z]! >= 0 && g.frei[z]) groesse.set(flaeche[z]!, (groesse.get(flaeche[z]!) ?? 0) + 1);
  const haupt = [...groesse].sort((x, y) => y[1] - x[1])[0]?.[0];
  if (haupt == null) return null;

  const gross = new Set([...groesse].filter(([, n]) => n * g.zelleSm * g.zelleSm >= SEEWEG_FLAECHE_MIN_SM2).map(([f]) => f));
  gross.add(haupt);
  const mitte = (x: number, y: number): Punkt => ({ lat: g.swLat + (y + 0.5) * g.dLat, lon: g.swLon + (x + 0.5) * g.dLon });
  const naechste = (q: Punkt): Punkt | null => {
    const qx = Math.floor((q.lon - g.swLon) / g.dLon), qy = Math.floor((q.lat - g.swLat) / g.dLat);
    for (let r = 0; r <= 40; r++) {
      let beste: Punkt | null = null, d = Infinity;
      for (let y = qy - r; y <= qy + r; y++) {
        for (let x = qx - r; x <= qx + r; x++) {
          if (Math.max(Math.abs(x - qx), Math.abs(y - qy)) !== r || x < 0 || y < 0 || x >= g.nx || y >= g.ny) continue;
          const z = y * g.nx + x;
          if (!g.frei[z] || !gross.has(flaeche[z]!)) continue;
          const p = mitte(x, y);
          const dd = Math.hypot(p.lat - q.lat, (p.lon - q.lon) * Math.cos((q.lat * Math.PI) / 180));
          if (dd < d) { d = dd; beste = p; }
        }
      }
      if (beste) return beste;
    }
    return null;
  };
  const a2 = naechste(a), b2 = naechste(b);
  if (!a2 || !b2) return null;
  const weg = wegImGitter(g, a2, b2, kueste, undefined, 2, vereinfacht);
  if (weg) return [a, ...weg, b];

  const angebunden = (q: Punkt): boolean => {
    const s = anschlussZelle(g, q, kueste);
    return s != null && gross.has(flaeche[s]!);
  };
  const va = angebunden(a) ? null : anlauf(a, kueste, g, angebunden, vereinfacht);
  const vb = angebunden(b) ? null : anlauf(b, kueste, g, angebunden, vereinfacht);
  if (!va && !vb) return null;
  const kern = wegImGitter(g, va ? va[va.length - 1]! : a2, vb ? vb[vb.length - 1]! : b2, kueste, undefined, 2, vereinfacht);
  if (!kern) return null;
  return entferneDoppelte([...(va ? va.slice(0, -1) : [a]), ...kern, ...(vb ? [...vb].reverse().slice(1) : [b])], kueste);
}

const ANLAUF_RAND_SM = 6;
const ANLAUF_ZELLE_SM = 0.04;

function anlauf(
  p: Punkt, kueste: readonly [Punkt, Punkt][], g: Wassergitter, angebunden: (q: Punkt) => boolean, vereinfacht: boolean,
): Punkt[] | null {
  const fein = baueWassergitter(boxUm([p], ANLAUF_RAND_SM), kueste, ANLAUF_ZELLE_SM, 0);
  const start = anschlussZelle(fein, p, kueste);
  if (start == null) return null;
  const flaeche = wasserflaechen(fein);
  const kandidaten: { q: Punkt; d: number }[] = [];
  for (let z = 0; z < flaeche.length; z++) {
    if (!fein.frei[z] || flaeche[z] !== flaeche[start]) continue;
    const q = zellMitte(fein, z);
    kandidaten.push({ q, d: distNM(p.lat, p.lon, q.lat, q.lon) });
  }
  kandidaten.sort((x, y) => x.d - y.d);

  const geprueft = new Set<number>();
  for (const { q } of kandidaten) {
    const grob = zellIndex(g, q);
    if (grob == null || geprueft.has(grob)) continue;
    geprueft.add(grob);
    if (!g.frei[grob] || !angebunden(q)) continue;
    const weg = wegImGitter(fein, p, q, kueste, undefined, 0, vereinfacht);
    if (weg) return weg;
  }
  return null;
}
