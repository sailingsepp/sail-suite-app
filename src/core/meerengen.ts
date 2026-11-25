import { MEERENGEN_ROH, type MeerengeRoh } from './meerengenDaten';

export const PUFFER_KM = 0.15;
export const LAENGLICH_AB = 1.4;
export const ENDE_ANTEIL = 0.2;
export const QUER_ANTEIL = 0.35;
export const ENTLANG_MIN_KM = 0.926;
export const ENTLANG_ANTEIL = 0.2;
export const DURCH_WINKEL_GRAD = 120;
export const BESTAETIGUNG = 2;
const NEUBEGINN_PAUSE_MS = 12 * 3_600_000;
const NEUBEGINN_SPRUNG_KM = 185;

export interface Ort { t: number; lat: number; lon: number }
export interface Meerenge { id: string; de: string; en: string }

interface Flaeche { roh: MeerengeRoh; box: { s: number; n: number; w: number; o: number }; laenge: number; breite: number; laenglich: boolean }
const FLAECHEN: Flaeche[] = MEERENGEN_ROH.map((roh) => {
  let s = 90, n = -90, w = 180, o = -180;
  for (const r of roh.ringe) for (const [la, lo] of r) { s = Math.min(s, la); n = Math.max(n, la); w = Math.min(w, lo); o = Math.max(o, lo); }
  const rand = 0.01;
  const laenge = roh.achse.uMax - roh.achse.uMin, breite = roh.achse.vMax - roh.achse.vMin;
  return { roh, box: { s: s - rand, n: n + rand, w: w - rand, o: o + rand }, laenge, breite, laenglich: laenge >= LAENGLICH_AB * breite };
});

function xy(f: Flaeche, lat: number, lon: number): [number, number] {
  const a = f.roh.achse;
  return [(lon - a.lon0) * 111.32 * Math.cos((a.lat0 * Math.PI) / 180), (lat - a.lat0) * 110.57];
}
function uv(f: Flaeche, lat: number, lon: number): { u: number; v: number } {
  const [x, y] = xy(f, lat, lon);
  const a = f.roh.achse;
  return { u: x * a.ux + y * a.uy, v: -x * a.uy + y * a.ux };
}
function imRing(lat: number, lon: number, ring: [number, number][]): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ai, oi] = ring[i]!; const [aj, oj] = ring[j]!;
    if ((ai > lat) !== (aj > lat) && lon < ((oj - oi) * (lat - ai)) / (aj - ai) + oi) drin = !drin;
  }
  return drin;
}
function randAbstandKm(f: Flaeche, lat: number, lon: number): number {
  const [px, py] = xy(f, lat, lon);
  let min = Infinity;
  for (const r of f.roh.ringe) {
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, ay] = xy(f, r[i]![0], r[i]![1]); const [bx, by] = xy(f, r[i + 1]![0], r[i + 1]![1]);
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      min = Math.min(min, Math.hypot(ax + t * dx - px, ay + t * dy - py));
    }
  }
  return min;
}
function istDrin(f: Flaeche, lat: number, lon: number): boolean {
  if (lat < f.box.s || lat > f.box.n || lon < f.box.w || lon > f.box.o) return false;
  if (f.roh.ringe.some((r) => imRing(lat, lon, r))) return true;
  return randAbstandKm(f, lat, lon) <= PUFFER_KM;
}

export function meerengeAm(lat: number, lon: number): Meerenge | null {
  const f = FLAECHEN.find((x) => istDrin(x, lat, lon));
  return f ? { id: f.roh.id, de: f.roh.de, en: f.roh.en } : null;
}
export function meerengeNachId(id: string): Meerenge | null {
  const f = FLAECHEN.find((x) => x.roh.id === id);
  return f ? { id: f.roh.id, de: f.roh.de, en: f.roh.en } : null;
}

export interface EngeAktiv {
  id: string;

  ein: Ort | null;
  erster: Ort;

  uMin: number; uMax: number;
  einfahrtGeloggt: boolean;
  raus: Ort | null; rausPunkte: number;
}
export interface EngenStand { aktiv: EngeAktiv[]; kandidaten: { id: string; ab: Ort; punkte: number }[]; zuletzt: Ort | null }
export const LEERER_ENGEN_STAND: EngenStand = { aktiv: [], kandidaten: [], zuletzt: null };

export type EngenArt = 'einfahrt' | 'ausfahrt' | 'querung' | 'entlang';
export interface EngenEreignis { art: EngenArt; id: string; ort: Ort; bis?: number; sm?: number }

function km(a: Ort, b: Ort): number {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(d)));
}

function abschluss(f: Flaeche, a: EngeAktiv, aus: Ort): EngenEreignis[] {
  const id = f.roh.id;
  if (a.einfahrtGeloggt) return [{ art: 'ausfahrt', id, ort: aus }];
  const start = a.ein ?? a.erster;
  const uE = uv(f, start.lat, start.lon), uA = uv(f, aus.lat, aus.lon);
  const laengsweg = a.uMax - a.uMin;
  const entlang = (): EngenEreignis[] => (laengsweg >= Math.max(ENTLANG_MIN_KM, ENTLANG_ANTEIL * f.laenge)
    ? [{ art: 'entlang', id, ort: start, bis: aus.t, sm: Math.round((laengsweg / 1.852) * 10) / 10 }] : []);
  if (f.laenglich) {
    const mitte = (f.roh.achse.vMin + f.roh.achse.vMax) / 2;
    const seitenwechsel = (uE.v > mitte) !== (uA.v > mitte) && Math.abs(uA.v - uE.v) >= 0.3 * f.breite;
    if (a.ein && seitenwechsel && Math.abs(uA.u - uE.u) <= QUER_ANTEIL * f.laenge) return [{ art: 'querung', id, ort: a.ein, bis: aus.t }];
    return entlang();
  }
  if (!a.ein) return [];
  const [cx, cy] = [0, 0];
  const [ex, ey] = xy(f, a.ein.lat, a.ein.lon), [ax, ay] = xy(f, aus.lat, aus.lon);
  const winkel = Math.abs(((Math.atan2(ay - cy, ax - cx) - Math.atan2(ey - cy, ex - cx)) * 180) / Math.PI);
  const zwischen = winkel > 180 ? 360 - winkel : winkel;
  return zwischen >= DURCH_WINKEL_GRAD ? [{ art: 'einfahrt', id, ort: a.ein }, { art: 'ausfahrt', id, ort: aus }] : [];
}

export function engenSchritt(stand: EngenStand, ort: Ort): { stand: EngenStand; ereignisse: EngenEreignis[] } {
  const neubeginn = !stand.zuletzt || ort.t - stand.zuletzt.t > NEUBEGINN_PAUSE_MS || km(stand.zuletzt, ort) > NEUBEGINN_SPRUNG_KM;
  const aktiv: EngeAktiv[] = neubeginn ? [] : stand.aktiv.map((a) => ({ ...a }));
  let kandidaten = neubeginn ? [] : stand.kandidaten.map((k) => ({ ...k }));
  const ereignisse: EngenEreignis[] = [];
  for (const f of FLAECHEN) {
    const id = f.roh.id;
    const drin = istDrin(f, ort.lat, ort.lon);
    const a = aktiv.find((x) => x.id === id);
    if (a) {
      if (drin) {
        const { u } = uv(f, ort.lat, ort.lon);
        a.uMin = Math.min(a.uMin, u); a.uMax = Math.max(a.uMax, u); a.raus = null; a.rausPunkte = 0;
      } else {
        a.raus = a.raus ?? ort; a.rausPunkte += 1;
        if (a.rausPunkte >= BESTAETIGUNG) {
          ereignisse.push(...abschluss(f, a, a.raus));
          aktiv.splice(aktiv.indexOf(a), 1);
        }
      }
      continue;
    }
    if (!drin) { kandidaten = kandidaten.filter((k) => k.id !== id); continue; }
    const { u } = uv(f, ort.lat, ort.lon);
    if (neubeginn) {
      aktiv.push({ id, ein: null, erster: ort, uMin: u, uMax: u, einfahrtGeloggt: false, raus: null, rausPunkte: 0 });
      continue;
    }
    const k = kandidaten.find((x) => x.id === id);
    if (k) k.punkte += 1; else kandidaten.push({ id, ab: ort, punkte: 1 });
    const kk = k ?? kandidaten.at(-1)!;
    if (kk.punkte < BESTAETIGUNG) continue;
    kandidaten = kandidaten.filter((x) => x.id !== id);
    const uEin = uv(f, kk.ab.lat, kk.ab.lon).u;
    const anteil = f.laenge > 0 ? (uEin - f.roh.achse.uMin) / f.laenge : 0.5;
    const amEnde = f.laenglich && (anteil <= ENDE_ANTEIL || anteil >= 1 - ENDE_ANTEIL);
    aktiv.push({ id, ein: kk.ab, erster: kk.ab, uMin: Math.min(uEin, u), uMax: Math.max(uEin, u), einfahrtGeloggt: amEnde, raus: null, rausPunkte: 0 });
    if (amEnde) ereignisse.push({ art: 'einfahrt', id, ort: kk.ab });
  }
  ereignisse.sort((x, y) => x.ort.t - y.ort.t);
  return { stand: { aktiv, kandidaten, zuletzt: ort }, ereignisse };
}
