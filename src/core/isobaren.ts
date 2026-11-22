import type { DruckGitter } from './druckfeld';

export interface Isobare {
  hPa: number;

  linien: { lat: number; lon: number }[][];
}

const VERFEINERUNG = 8;

const LINIEN_MIN = 4;
const LINIEN_MAX = 12;

const STUFEN = [1, 2, 4, 5, 10, 20];

export function isobarenStufe(spanne: number): number {
  for (const s of STUFEN) if (spanne / s <= LINIEN_MAX) return s;
  return STUFEN[STUFEN.length - 1]!;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function randWert(a: number[], i: number): number {
  if (i >= 0 && i < a.length) return a[i]!;
  return i < 0
    ? 2 * a[0]! - a[1]!
    : 2 * a[a.length - 1]! - a[a.length - 2]!;
}

function verfeinereReihe(werte: number[], faktor: number): number[] {
  if (werte.length < 2) return [...werte];
  const out: number[] = [];
  for (let i = 0; i < werte.length - 1; i++) {
    for (let k = 0; k < faktor; k++) {
      out.push(catmullRom(randWert(werte, i - 1), randWert(werte, i), randWert(werte, i + 1), randWert(werte, i + 2), k / faktor));
    }
  }
  out.push(werte[werte.length - 1]!);
  return out;
}

function verfeinereAchse(koord: number[], faktor: number): number[] {
  if (koord.length < 2) return [...koord];
  const out: number[] = [];
  for (let i = 0; i < koord.length - 1; i++) {
    for (let k = 0; k < faktor; k++) out.push(koord[i]! + (koord[i + 1]! - koord[i]!) * (k / faktor));
  }
  out.push(koord[koord.length - 1]!);
  return out;
}

export function verfeinereGitter(g: DruckGitter, faktor = VERFEINERUNG): DruckGitter | null {
  const voll: number[][] = [];
  for (const reihe of g.druck) {
    const r: number[] = [];
    for (const v of reihe) { if (v == null) return null; r.push(v); }
    voll.push(r);
  }
  if (voll.length < 2 || (voll[0]?.length ?? 0) < 2) return null;

  const zeilenFein = voll.map((r) => verfeinereReihe(r, faktor));
  const lonsFein = verfeinereAchse(g.lons, faktor);
  const latsFein = verfeinereAchse(g.lats, faktor);

  const druck: number[][] = latsFein.map(() => new Array<number>(lonsFein.length));
  for (let j = 0; j < lonsFein.length; j++) {
    const spalte = zeilenFein.map((r) => r[j]!);
    const spalteFein = verfeinereReihe(spalte, faktor);
    for (let i = 0; i < latsFein.length; i++) druck[i]![j] = spalteFein[i]!;
  }
  return { lats: latsFein, lons: lonsFein, druck };
}

interface Segment { a: { lat: number; lon: number }; b: { lat: number; lon: number } }

function schnitt(v1: number, v2: number, c1: number, c2: number, L: number): number {
  const d = v2 - v1;
  return Math.abs(d) < 1e-12 ? c1 : c1 + (c2 - c1) * ((L - v1) / d);
}

function segmente(g: DruckGitter, L: number): Segment[] {
  const out: Segment[] = [];
  const p = g.druck as number[][];
  for (let i = 0; i < g.lats.length - 1; i++) {
    for (let j = 0; j < g.lons.length - 1; j++) {
      const lat0 = g.lats[i]!, lat1 = g.lats[i + 1]!;
      const lon0 = g.lons[j]!, lon1 = g.lons[j + 1]!;

      const ul = p[i]![j]!, ur = p[i]![j + 1]!, or_ = p[i + 1]![j + 1]!, ol = p[i + 1]![j]!;
      let fall = (ul >= L ? 1 : 0) | (ur >= L ? 2 : 0) | (or_ >= L ? 4 : 0) | (ol >= L ? 8 : 0);
      if (fall === 0 || fall === 15) continue;

      const unten = { lat: lat0, lon: schnitt(ul, ur, lon0, lon1, L) };
      const rechts = { lat: schnitt(ur, or_, lat0, lat1, L), lon: lon1 };
      const oben = { lat: lat1, lon: schnitt(ol, or_, lon0, lon1, L) };
      const links = { lat: schnitt(ul, ol, lat0, lat1, L), lon: lon0 };

      if (fall === 5 || fall === 10) {

        const mitte = (ul + ur + or_ + ol) / 4;
        if ((fall === 5 && mitte < L) || (fall === 10 && mitte >= L)) fall = fall === 5 ? 10 : 5;
        if (fall === 5) { out.push({ a: links, b: unten }, { a: rechts, b: oben }); continue; }
        out.push({ a: links, b: oben }, { a: unten, b: rechts }); continue;
      }

      switch (fall) {
        case 1: case 14: out.push({ a: links, b: unten }); break;
        case 2: case 13: out.push({ a: unten, b: rechts }); break;
        case 3: case 12: out.push({ a: links, b: rechts }); break;
        case 4: case 11: out.push({ a: rechts, b: oben }); break;
        case 6: case 9: out.push({ a: unten, b: oben }); break;
        case 7: case 8: out.push({ a: links, b: oben }); break;
      }
    }
  }
  return out;
}

function verbinde(segs: Segment[]): { lat: number; lon: number }[][] {
  const key = (p: { lat: number; lon: number }) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  const offen = new Map<string, Segment[]>();
  for (const s of segs) {
    for (const k of [key(s.a), key(s.b)]) {
      const liste = offen.get(k) ?? [];
      liste.push(s);
      offen.set(k, liste);
    }
  }
  const benutzt = new Set<Segment>();
  const zuege: { lat: number; lon: number }[][] = [];

  const anhaengen = (zug: { lat: number; lon: number }[], vorwaerts: boolean): void => {
    for (;;) {
      const ende = vorwaerts ? zug[zug.length - 1]! : zug[0]!;
      const kandidaten = offen.get(key(ende)) ?? [];
      const naechste = kandidaten.find((s) => !benutzt.has(s));
      if (!naechste) return;
      benutzt.add(naechste);
      const weiter = key(naechste.a) === key(ende) ? naechste.b : naechste.a;
      if (vorwaerts) zug.push(weiter); else zug.unshift(weiter);

      if (key(zug[0]!) === key(zug[zug.length - 1]!)) return;
    }
  };

  for (const s of segs) {
    if (benutzt.has(s)) continue;
    benutzt.add(s);
    const zug = [s.a, s.b];
    anhaengen(zug, true);
    anhaengen(zug, false);
    if (zug.length >= 2) zuege.push(zug);
  }
  return zuege;
}

export function konturZuege(g: DruckGitter, niveau: number): { lat: number; lon: number }[][] {
  return verbinde(segmente(g, niveau));
}

export function glaettePfad(
  punkte: { lat: number; lon: number }[], durchgaenge = 2,
): { lat: number; lon: number }[] {
  if (punkte.length < 3) return punkte;
  const erster = punkte[0]!, letzter = punkte[punkte.length - 1]!;
  const geschlossen = erster.lat === letzter.lat && erster.lon === letzter.lon;

  let p = geschlossen ? punkte.slice(0, -1) : punkte;
  for (let d = 0; d < durchgaenge && p.length >= 3; d++) {
    const out: { lat: number; lon: number }[] = [];
    if (!geschlossen) out.push(p[0]!);
    const kanten = geschlossen ? p.length : p.length - 1;
    for (let i = 0; i < kanten; i++) {
      const a = p[i]!, b = p[(i + 1) % p.length]!;
      out.push({ lat: 0.75 * a.lat + 0.25 * b.lat, lon: 0.75 * a.lon + 0.25 * b.lon });
      out.push({ lat: 0.25 * a.lat + 0.75 * b.lat, lon: 0.25 * a.lon + 0.75 * b.lon });
    }
    if (!geschlossen) out.push(p[p.length - 1]!);
    p = out;
  }
  return geschlossen ? [...p, p[0]!] : p;
}

export function isobaren(g: DruckGitter, faktor = VERFEINERUNG): Isobare[] {
  const fein = verfeinereGitter(g, faktor);
  if (!fein) return [];
  const werte = (fein.druck as number[][]).flat();
  const min = Math.min(...werte), max = Math.max(...werte);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];

  const stufe = isobarenStufe(max - min);
  const out: Isobare[] = [];
  const ersteStufe = Math.ceil(min / stufe) * stufe;
  for (let L = ersteStufe; L <= max; L += stufe) {
    const linien = verbinde(segmente(fein, L)).filter((z) => z.length >= 3);
    if (linien.length) out.push({ hPa: Math.round(L * 10) / 10, linien });
    if (out.length > LINIEN_MAX + LINIEN_MIN) break;
  }
  return out;
}
