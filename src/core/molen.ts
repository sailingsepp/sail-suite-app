import type { Punkt } from './types';
import { distNM, kreuzungsZahl } from './geo';
import { baueWassergitter, boxUm, liegtAnLand, wegImGitter, type Wassergitter } from './landumfahrung';

export const MOLE_HALB_SM = 0.002;

export const HAFEN_STRECKE_SM = 2;

export const HAFEN_ZELLE_SM = 0.003;

const HAFEN_ABSTAND_ZELLEN = 2;

export const MOLE_ABSTAND_SM = 0.01;

const HINTER_MOLE_SM = 0.05;

const HAFEN_RAENDER_SM = [0.15, 0.5, 1] as const;

export interface MoleRoh { flaeche: boolean; p: ArrayLike<number> }

function flaeche(ring: readonly Punkt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!, q = ring[(i + 1) % ring.length]!;
    a += p.lon * q.lat - q.lon * p.lat;
  }
  return a / 2;
}

function alsRingKanten(ring: Punkt[]): [Punkt, Punkt][] {
  const r = flaeche(ring) >= 0 ? ring : [...ring].reverse();
  return r.map((p, i) => [p, r[(i + 1) % r.length]!] as [Punkt, Punkt]);
}

function linieAlsRing(pk: readonly Punkt[]): Punkt[] | null {
  const pts = pk.filter((p, i) => i === 0 || p.lat !== pk[i - 1]!.lat || p.lon !== pk[i - 1]!.lon);
  if (pts.length < 2) return null;
  const cos = Math.cos((pts[0]!.lat * Math.PI) / 180);
  const xy = pts.map((p) => [(p.lon - pts[0]!.lon) * 60 * cos, (p.lat - pts[0]!.lat) * 60] as [number, number]);
  const richt: [number, number][] = [];
  for (let i = 1; i < xy.length; i++) {
    const dx = xy[i]![0] - xy[i - 1]![0], dy = xy[i]![1] - xy[i - 1]![1], l = Math.hypot(dx, dy);
    richt.push([dx / l, dy / l]);
  }
  const h = MOLE_HALB_SM;
  const links: [number, number][] = [], rechts: [number, number][] = [];
  for (let i = 0; i < xy.length; i++) {
    const vor = richt[Math.max(0, i - 1)]!, nach = richt[Math.min(richt.length - 1, i)]!;

    let nx = -(vor[1] + nach[1]), ny = vor[0] + nach[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    const strecke = Math.min(3, 1 / Math.max(1e-6, nx * -nach[1] + ny * nach[0]));
    let [x, y] = xy[i]!;
    if (i === 0) { x -= nach[0] * h; y -= nach[1] * h; }
    if (i === xy.length - 1) { x += vor[0] * h; y += vor[1] * h; }
    links.push([x + nx * h * strecke, y + ny * h * strecke]);
    rechts.push([x - nx * h * strecke, y - ny * h * strecke]);
  }
  const zurueck = ([x, y]: [number, number]): Punkt => ({ lat: pts[0]!.lat + y / 60, lon: pts[0]!.lon + x / (60 * cos) });
  return [...links.map(zurueck), ...rechts.reverse().map(zurueck)];
}

export function molenAlsKueste(molen: readonly MoleRoh[]): [Punkt, Punkt][] {
  const aus: [Punkt, Punkt][] = [];
  for (const m of molen) {
    const pk: Punkt[] = [];
    for (let k = 0; k + 1 < m.p.length; k += 2) pk.push({ lat: m.p[k]!, lon: m.p[k + 1]! });
    if (m.flaeche) {
      const ring = pk.length > 1 && pk[0]!.lat === pk.at(-1)!.lat && pk[0]!.lon === pk.at(-1)!.lon ? pk.slice(0, -1) : pk;
      if (ring.length >= 3) aus.push(...alsRingKanten(ring));
      continue;
    }
    const ring = linieAlsRing(pk);
    if (ring) aus.push(...alsRingKanten(ring));
  }
  return aus;
}

function verdichtet(punkte: readonly Punkt[], bisSm: number, schritt: number): Punkt[] {
  const aus: Punkt[] = [punkte[0]!];
  let weg = 0;
  for (let i = 1; i < punkte.length && weg < bisSm; i++) {
    const a = punkte[i - 1]!, b = punkte[i]!;
    const d = distNM(a.lat, a.lon, b.lat, b.lon);
    const n = Math.max(1, Math.ceil(d / schritt));
    for (let k = 1; k <= n && weg < bisSm; k++) {
      aus.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n });
      weg += d / n;
    }
  }
  return aus;
}

function restAb(punkte: readonly Punkt[], abSm: number, z: Punkt): Punkt[] {
  let weg = 0;
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1]!, b = punkte[i]!;
    weg += distNM(a.lat, a.lon, b.lat, b.lon);
    if (weg > abSm) return [z, ...punkte.slice(i)];
  }
  return [z];
}

export const HAFEN_ANSCHLUSS_SM = 0.04;

function freiImWasser(g: Wassergitter, p: Punkt, kueste: readonly [Punkt, Punkt][]): Punkt | null {
  const x0 = Math.floor((p.lon - g.swLon) / g.dLon), y0 = Math.floor((p.lat - g.swLat) / g.dLat);
  const mitte = (x: number, y: number): Punkt => ({ lat: g.swLat + (y + 0.5) * g.dLat, lon: g.swLon + (x + 0.5) * g.dLon });
  const frei = (x: number, y: number) => x >= 0 && y >= 0 && x < g.nx && y < g.ny && g.frei[y * g.nx + x] === 1;
  if (frei(x0, y0) && !liegtAnLand(p, kueste)) return p;
  const r = Math.ceil(HAFEN_ANSCHLUSS_SM / g.zelleSm);
  const kandidaten: { x: number; y: number; d: number }[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && frei(x0 + dx, y0 + dy)) kandidaten.push({ x: x0 + dx, y: y0 + dy, d: dx * dx + dy * dy });
  }
  kandidaten.sort((u, v) => u.d - v.d);
  for (const k of kandidaten) {
    const q = mitte(k.x, k.y);
    if (!liegtAnLand(q, kueste)) return q;
  }
  return null;
}

function feinerWeg(a: Punkt, z: Punkt, kueste: readonly [Punkt, Punkt][], molen: readonly [Punkt, Punkt][]): Punkt[] | null {
  for (const rand of HAFEN_RAENDER_SM) {
    const box = boxUm([a, z], rand);
    const lokal = [...kueste, ...molen].filter(([p, q]) => Math.max(p.lat, q.lat) >= box.swLat && Math.min(p.lat, q.lat) <= box.neLat
      && Math.max(p.lon, q.lon) >= box.swLon && Math.min(p.lon, q.lon) <= box.neLon) as [Punkt, Punkt][];

    for (const abstand of [HAFEN_ABSTAND_ZELLEN, 0]) {
      const g = baueWassergitter(box, lokal, HAFEN_ZELLE_SM, abstand);

      if (g.zelleSm > HAFEN_ZELLE_SM * 1.5) return null;

      const ab = freiImWasser(g, a, lokal);
      if (!ab) continue;
      const weg = wegImGitter(g, ab, z, lokal, undefined, 0);
      if (weg) return ab === a ? weg : [a, ...weg];
    }
  }
  return null;
}

function anfangOhneMolen(
  punkte: readonly Punkt[], kueste: readonly [Punkt, Punkt][], molen: readonly [Punkt, Punkt][], bisSm = HAFEN_STRECKE_SM,
): { punkte: Punkt[]; neuBis: Punkt } | null {
  if (punkte.length < 2 || bisSm <= 0) return null;
  const dicht = verdichtet(punkte, bisSm, 0.01);

  const sperre = [...molen, ...kueste] as [Punkt, Punkt][];
  let letzte = -1;
  for (let k = 1; k < dicht.length; k++) if (kreuzungsZahl(dicht[k - 1]!, dicht[k]!, sperre) > 0) letzte = k;
  if (letzte < 0) return null;
  const zi = Math.min(dicht.length - 1, letzte + Math.ceil(HINTER_MOLE_SM / 0.01));
  const a = dicht[0]!, z = dicht[zi]!;
  const aus = feinerWeg(a, z, kueste, molen);
  if (!aus) return null;
  let zuZ = 0;
  for (let k = 1; k <= zi; k++) zuZ += distNM(dicht[k - 1]!.lat, dicht[k - 1]!.lon, dicht[k]!.lat, dicht[k]!.lon);
  return { punkte: [...aus, ...restAb(punkte, zuZ, z).slice(1)], neuBis: z };
}

function streckenAbstandSm(a: Punkt, b: Punkt, c: Punkt, d: Punkt): number {
  const cos = Math.cos((a.lat * Math.PI) / 180);
  const x = (p: Punkt): [number, number] => [(p.lon - a.lon) * 60 * cos, (p.lat - a.lat) * 60];
  const A = x(a), B = x(b), C = x(c), D = x(d);
  const kreuz = (o: number[], p: number[], q: number[]) => (p[0]! - o[0]!) * (q[1]! - o[1]!) - (p[1]! - o[1]!) * (q[0]! - o[0]!);
  if (kreuz(A, B, C) * kreuz(A, B, D) < 0 && kreuz(C, D, A) * kreuz(C, D, B) < 0) return 0;
  const zuStrecke = (p: number[], u: number[], v: number[]) => {
    const dx = v[0]! - u[0]!, dy = v[1]! - u[1]!, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0]! - u[0]!) * dx + (p[1]! - u[1]!) * dy) / l2)) : 0;
    return Math.hypot(u[0]! + t * dx - p[0]!, u[1]! + t * dy - p[1]!);
  };
  return Math.min(zuStrecke(A, C, D), zuStrecke(B, C, D), zuStrecke(C, A, B), zuStrecke(D, A, B));
}

const STRAFFEN_DANACH_SM = 2;

const STRAFFEN_SCHRITT_SM = 0.05;

function straffeAnfang(punkte: readonly Punkt[], bis: number, kueste: readonly [Punkt, Punkt][], molen: readonly [Punkt, Punkt][]): Punkt[] {
  if (bis < 1) return [...punkte];

  const kand: Punkt[] = punkte.slice(0, bis + 1);
  let rest = STRAFFEN_DANACH_SM, i = bis, ende = punkte.length - 1;
  for (; i < punkte.length - 1 && rest > 0; i++) {
    const p = punkte[i]!, q = punkte[i + 1]!;
    const d = distNM(p.lat, p.lon, q.lat, q.lon);
    const n = Math.max(1, Math.ceil(d / STRAFFEN_SCHRITT_SM));
    for (let k = 1; k <= n; k++) {
      if (rest - (d * k) / n < 0) { ende = i; break; }
      kand.push(k === n ? q : { lat: p.lat + ((q.lat - p.lat) * k) / n, lon: p.lon + ((q.lon - p.lon) * k) / n });
    }
    rest -= d;
    if (rest < 0) break;
  }
  if (rest >= 0) ende = punkte.length - 1;

  let s = 90, w = 180, n = -90, o = -180;
  for (const p of kand) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); o = Math.max(o, p.lon); }
  const nah = [...kueste, ...molen].filter(([p, q]) => Math.max(p.lat, q.lat) >= s && Math.min(p.lat, q.lat) <= n
    && Math.max(p.lon, q.lon) >= w && Math.min(p.lon, q.lon) <= o) as [Punkt, Punkt][];
  const molenNah = nah.filter((k) => molen.includes(k));

  const quert = (p: Punkt, q: Punkt) => kreuzungsZahl(p, q, nah) > 0 || molenNah.some(([u, v]) => streckenAbstandSm(p, q, u, v) < MOLE_ABSTAND_SM);
  const aus: Punkt[] = [kand[0]!];
  let k = 0;
  if (kand.length > 1 && quert(kand[0]!, kand[1]!)) { aus.push(kand[1]!); k = 1; }
  while (k < kand.length - 1) {
    let j = k + 1;
    for (let m = kand.length - 1; m > k + 1; m--) if (!quert(kand[k]!, kand[m]!)) { j = m; break; }
    aus.push(kand[j]!);
    k = j;
  }

  const letzter = kand[kand.length - 1]!;
  const ab = punkte.indexOf(letzter);
  return [...aus, ...punkte.slice(ab >= 0 ? ab + 1 : ende + 1)];
}

export const HAFEN_KUESTE_SM = 5;

export function ohneMolen(punkte: readonly Punkt[], kueste: readonly [Punkt, Punkt][], molen: readonly [Punkt, Punkt][]): Punkt[] {
  if ((!molen.length && !kueste.length) || punkte.length < 2) return [...punkte];
  const v = anfangOhneMolen(punkte, kueste, molen);
  const vorn = v?.punkte ?? [...punkte];

  const laenge = (p: readonly Punkt[]) => p.slice(1).reduce((s, q, i) => s + distNM(p[i]!.lat, p[i]!.lon, q.lat, q.lon), 0);
  let bis = HAFEN_STRECKE_SM;
  if (v) {
    const k = vorn.indexOf(v.neuBis);
    bis = Math.min(bis, laenge(vorn.slice(k)) - 0.01);
  }
  const hinten = anfangOhneMolen([...vorn].reverse(), kueste, molen, bis);
  if (!v && !hinten) return vorn;
  let aus = hinten ? straffeAnfang(hinten.punkte, hinten.punkte.indexOf(hinten.neuBis), kueste, molen).reverse() : vorn;
  if (v) {
    const k = aus.indexOf(v.neuBis);
    if (k >= 0) aus = straffeAnfang(aus, k, kueste, molen);
  }
  return aus;
}
