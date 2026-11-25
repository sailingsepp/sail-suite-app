import {
  Iso, rumpfGrundriss, RUMPF_SEITE, RUMPF_SEITE_DUNKEL, RUMPF_DECK, AUFBAU, AUFBAU_DECK, KANTE,
} from './iso';
import { esc, k } from './svg';

export type V3 = readonly [number, number, number];

export const SEE = 'var(--panel-2)';
export const SEGEL = 'var(--text)';
const GELB_SEITE = 'color-mix(in srgb, var(--gelb) 38%, var(--panel))';
const GELB_SEITE_DUNKEL = 'color-mix(in srgb, var(--gelb) 28%, var(--panel))';
const GELB_DECK = 'color-mix(in srgb, var(--gelb) 52%, var(--panel))';
export const RIGG = 'var(--muted)';

const MARKE_SEITE = '#F6F8FA';
const MARKE_SEITE_DUNKEL = '#DDE3E8';
const MARKE_DECK = '#B9C4CD';
const MARKE_AUFBAU = '#E9EEF2';
const MARKE_AUFBAU_DECK = '#D2DAE0';
const MARKE_LINIE = '#0B1E2D';

export function richtung(grad: number): [number, number] {
  const a = (grad * Math.PI) / 180;
  return [Math.sin(a), Math.cos(a)];
}

export function windZumBug(windAus: number, kurs: number): number {
  let a = (((windAus - kurs) % 360) + 360) % 360;
  if (a > 180) a -= 360;
  return a;
}

export function baumWinkel(windWinkel: number): number {
  const a = Math.abs(windWinkel);
  return Math.max(8, Math.min(85, (a - 35) * 0.55 + 8));
}

export interface Fahrzeug {
  x: number; y: number;

  kurs: number;
  art: 'segel' | 'motor';

  L?: number;

  windAus?: number;

  hervor?: boolean;

  marke?: boolean;

  schmetterling?: boolean;

  baum?: number;

  vorBack?: boolean;

  ohneVorsegel?: boolean;

  ohneSegel?: boolean;

  baumSeite?: number;
}

export function imSchiff(f: Fahrzeug, lx: number, ly: number, z: number): V3 {
  const [ux, uy] = richtung(f.kurs);
  return [f.x + lx * ux - ly * uy, f.y + lx * uy + ly * ux, z];
}

export const tiefe = (p: { x: number; y: number }) => p.x - p.y;

export function pz(iso: Iso, p: V3): string {
  const [a, b] = iso.p(p[0], p[1], p[2]);
  return `${k(a)},${k(b)}`;
}

export function flaeche(iso: Iso, pts: readonly V3[], fill: string, extra = ''): string {
  return `<polygon points="${pts.map((p) => pz(iso, p)).join(' ')}" fill="${fill}"${extra}/>`;
}

export function strich(iso: Iso, a: V3, b: V3, farbe: string, breite = 1.4, extra = ''): string {
  const [x1, y1] = iso.p(a[0], a[1], a[2]);
  const [x2, y2] = iso.p(b[0], b[1], b[2]);
  return `<line x1="${k(x1)}" y1="${k(y1)}" x2="${k(x2)}" y2="${k(y2)}" stroke="${farbe}" stroke-width="${breite}" `
    + `stroke-linecap="round"${extra}/>`;
}

export function kurve(iso: Iso, a: V3, c: V3, b: V3, farbe: string, breite = 2, extra = ''): string {
  return `<path d="M${pz(iso, a)} Q${pz(iso, c)} ${pz(iso, b)}" fill="none" stroke="${farbe}" stroke-width="${breite}" `
    + `stroke-linecap="round"${extra}/>`;
}

export function beschrift(iso: Iso, p: V3, text: string, klasse = 'kp-rr-l', anker = 'middle', dy = 0): string {
  const [x, y] = iso.p(p[0], p[1], p[2]);
  return `<text x="${k(x)}" y="${k(y + dy)}" text-anchor="${anker}" class="${klasse}">${esc(text)}</text>`;
}

export function wasser(iso: Iso, x0: number, x1: number, y0: number, y1: number, fill = SEE): string {
  return flaeche(iso, [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], fill);
}

export function raster(iso: Iso, von: number, bis: number, schritt: number): string {
  const out: string[] = [];
  for (let v = von; v <= bis + 1e-6; v += schritt) {
    out.push(strich(iso, [v, von, 0], [v, bis, 0], 'var(--line)', 0.6));
    out.push(strich(iso, [von, v, 0], [bis, v, 0], 'var(--line)', 0.6));
  }
  return out.join('');
}

export function masse(L: number) {
  return { B: L * 0.32, fb: L * 0.11, mast: L * 0.12, H: L * 1.25, baum: L * 0.42, zBaum: L * 0.2 };
}

export function rumpf(iso: Iso, f: Fahrzeug): string {
  const L = f.L ?? 8;
  const m = masse(L);
  const welt = (pts: [number, number][]) => pts.map(([a, b]) => { const p = imSchiff(f, a, b, 0); return [p[0], p[1]] as [number, number]; });
  const grund = welt(rumpfGrundriss(L, m.B).map(([a, b]) => [a - L / 2, b] as [number, number]));
  const out = [f.marke
    ? iso.prisma(grund, 0, m.fb, MARKE_SEITE, MARKE_DECK, MARKE_SEITE_DUNKEL)
    : iso.prisma(grund, 0, m.fb, f.hervor ? GELB_SEITE : RUMPF_SEITE, f.hervor ? GELB_DECK : RUMPF_DECK,
      f.hervor ? GELB_SEITE_DUNKEL : RUMPF_SEITE_DUNKEL)];
  if (f.art === 'motor') {
    const h = m.B * 0.34;
    out.push(iso.prisma(welt([[-L * 0.28, h], [-L * 0.28, -h], [L * 0.02, -h], [L * 0.02, h]]), m.fb, m.fb + L * 0.12, AUFBAU, AUFBAU_DECK));
    out.push(strich(iso, imSchiff(f, -L * 0.1, 0, m.fb + L * 0.12), imSchiff(f, -L * 0.1, 0, m.fb + L * 0.42), RIGG, 1.8));
  } else {
    const h = m.B * 0.3;
    out.push(iso.prisma(welt([[-L * 0.2, h], [-L * 0.2, -h], [L * 0.12, -h], [L * 0.12, h]]), m.fb, m.fb + L * 0.05,
      f.marke ? MARKE_AUFBAU : AUFBAU, f.marke ? MARKE_AUFBAU_DECK : AUFBAU_DECK));
  }
  return out.join('');
}

export interface Rigg {
  mastFuss: V3; mastTop: V3; hals: V3; kopfVor: V3;
  baumFuss: V3; baumEnde: V3; schothornVor: V3;

  seite: number;
}

export function rigg(f: Fahrzeug, baumGrad?: number): Rigg {
  const L = f.L ?? 8;
  const m = masse(L);
  const ww = windZumBug(f.windAus ?? f.kurs + 45, f.kurs);
  const seite = f.baumSeite ?? (ww >= 0 ? 1 : -1);
  const b = ((baumGrad ?? f.baum ?? baumWinkel(ww)) * Math.PI) / 180;
  const xm = m.mast;
  const vorSeite = f.schmetterling || f.vorBack ? -seite : seite;
  const bv = f.schmetterling ? (80 * Math.PI) / 180 : f.vorBack ? (14 * Math.PI) / 180 : Math.min(b * 0.9 + 0.03, 1.3);
  const lv = L * 0.4;
  const hals: V3 = imSchiff(f, L * 0.47, 0, m.fb);
  return {
    mastFuss: imSchiff(f, xm, 0, m.fb),
    mastTop: imSchiff(f, xm, 0, m.fb + m.H),
    hals,
    kopfVor: imSchiff(f, xm + L * 0.05, 0, m.fb + m.H * 0.86),
    baumFuss: imSchiff(f, xm, 0, m.zBaum),
    baumEnde: imSchiff(f, xm - m.baum * Math.cos(b), seite * m.baum * Math.sin(b), m.zBaum + L * 0.02),
    schothornVor: imSchiff(f, L * 0.47 - lv * Math.cos(bv), vorSeite * lv * Math.sin(bv), m.fb + L * 0.06),
    seite,
  };
}

export function segelFlaeche(iso: Iso, pts: readonly V3[], hervor = false, deckung = 0.34): string {
  return flaeche(iso, pts, hervor ? 'var(--gelb)' : SEGEL,
    ` fill-opacity="${hervor ? 0.5 : deckung}" stroke="${hervor ? 'var(--gelb)' : 'var(--bg)'}" stroke-width=".8" stroke-linejoin="round"`);
}

export function fahrzeug(iso: Iso, f: Fahrzeug): string {
  const out = [rumpf(iso, f)];
  if (f.art === 'segel' && f.ohneSegel) {
    const r = rigg(f, 0);
    const linie = f.marke ? MARKE_LINIE : RIGG;
    const m = masse(f.L ?? 8);
    const heck = imSchiff(f, -(f.L ?? 8) * 0.46, 0, m.fb);
    out.push(strich(iso, heck, r.mastTop, linie, 0.7), strich(iso, r.hals, r.kopfVor, linie, 0.9),
      strich(iso, r.mastFuss, r.mastTop, linie, 1.8), strich(iso, r.baumFuss, r.baumEnde, linie, 1.8));
  } else if (f.art === 'segel') {
    const r = rigg(f);
    const tuch = (pts: readonly V3[], deckung: number) => (f.marke
      ? flaeche(iso, pts, '#fff', ` fill-opacity=".92" stroke="${MARKE_LINIE}" stroke-width=".7" stroke-linejoin="round"`)
      : segelFlaeche(iso, pts, f.hervor, deckung));
    const rigg2 = f.marke ? MARKE_LINIE : RIGG;
    const vor = f.ohneVorsegel ? strich(iso, r.hals, r.kopfVor, rigg2, 1) : tuch([r.hals, r.kopfVor, r.schothornVor], 0.28);
    const gross = tuch([r.baumFuss, r.mastTop, r.baumEnde], 0.34);

    const tVor = tiefe({ x: (r.hals[0] + r.schothornVor[0]) / 2, y: (r.hals[1] + r.schothornVor[1]) / 2 });
    const tGross = tiefe({ x: (r.baumFuss[0] + r.baumEnde[0]) / 2, y: (r.baumFuss[1] + r.baumEnde[1]) / 2 });
    const segel = tVor < tGross ? [vor, gross] : [gross, vor];
    out.push(segel[0]!, strich(iso, r.mastFuss, r.mastTop, rigg2, 1.6), strich(iso, r.baumFuss, r.baumEnde, rigg2, 1.6), segel[1]!);
  }
  return out.join('');
}

export function profilSegel(iso: Iso, vorliek: readonly V3[], achterliek: readonly V3[], tiefen: readonly number[],
  lee: number, lage = 0.45, farbe = SEGEL, deckung = 0.3, linien = 'var(--bg)'): string {
  const n = vorliek.length;
  const kurvenPunkt = (i: number): V3 => {
    const a = vorliek[i]!;
    const b = achterliek[i]!;
    const cx = b[0] - a[0];
    const cy = b[1] - a[1];
    const len = Math.hypot(cx, cy) || 1;

    let nx = -cy / len;
    let ny = cx / len;
    if (ny * lee < 0) { nx = -nx; ny = -ny; }
    const d = 2 * (tiefen[i] ?? 0) * len;
    return [a[0] + cx * lage + nx * d, a[1] + cy * lage + ny * d, a[2] + (b[2] - a[2]) * lage];
  };
  const umriss = [...vorliek.map((p) => pz(iso, p)), ...[...achterliek].reverse().map((p) => pz(iso, p))];
  const out = [`<polygon points="${umriss.join(' ')}" fill="${farbe}" fill-opacity="${deckung}" stroke="${linien}" stroke-width=".8" stroke-linejoin="round"/>`];
  for (let i = 0; i < n; i++) {
    out.push(kurve(iso, vorliek[i]!, kurvenPunkt(i), achterliek[i]!, 'var(--text)', i === 0 || i === n - 1 ? 1.2 : 0.9,
      ' stroke-opacity=".75"'));
  }
  return out.join('');
}

export function zwischen(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function isoSvg(breite: number, hoehe: number, label: string, inhalt: string, defs = '', klasse = 'kp-iso'): string {
  return `<svg class="${klasse}" viewBox="0 0 ${breite} ${hoehe}" role="img" aria-label="${esc(label)}">${defs}`
    + `<rect width="${breite}" height="${hoehe}" fill="var(--panel-2)"/>${inhalt}</svg>`;
}

export { KANTE };

export function anker(iso: Iso, bug: V3, grund: V3, farbe = 'var(--akzent)'): string {
  const [x, y] = iso.p(grund[0], grund[1], grund[2]);
  const zeichen = `<g transform="translate(${k(x)},${k(y)})" stroke="${farbe}" stroke-width="2" fill="none" stroke-linecap="round">`
    + '<circle cx="0" cy="-9" r="2.4"/><line x1="0" y1="-6.6" x2="0" y2="6"/><line x1="-4" y1="-3" x2="4" y2="-3"/>'
    + '<path d="M-6 1 Q-5 6 0 6 Q5 6 6 1"/></g>';
  return strich(iso, bug, grund, farbe, 1.6, ' stroke-dasharray="2 2"') + zeichen;
}
