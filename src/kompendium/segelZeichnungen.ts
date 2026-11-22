import { Iso } from './iso';
import { esc, k, neueId } from './svg';
import {
  fahrzeug, rumpf, rigg, wasser, raster, strich, kurve, beschrift, segelFlaeche, zwischen,
  isoSvg, masse, imSchiff, RIGG, type Fahrzeug, type V3,
} from './yacht';
import type { T } from './bausteine';



const TEAL = 'var(--teal)';
const AMBER = 'var(--akzent)';
const TEXT = 'var(--text)';
const GRAU = 'var(--muted)';


function marker(...farben: string[]): { defs: string; id: (farbe: string) => string } {
  const ids = new Map<string, string>();
  const defs = farben.map((f) => {
    const id = neueId('mk');
    ids.set(f, id);
    return `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`
      + `<path d="M0 0L10 5L0 10Z" fill="${f}"/></marker>`;
  }).join('');
  return { defs: `<defs>${defs}</defs>`, id: (f) => ids.get(f)! };
}

function svg2d(w: number, h: number, label: string, inhalt: string, defs = ''): string {
  return `<svg class="kp-zeichnung" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${defs}`
    + `<rect width="${w}" height="${h}" fill="var(--panel-2)"/>${inhalt}</svg>`;
}

const tx = (x: number, y: number, s: string, klasse = 'kp-rr-l', anker = 'middle') =>
  `<text x="${k(x)}" y="${k(y)}" text-anchor="${anker}" class="${klasse}">${esc(s)}</text>`;
const ln = (x1: number, y1: number, x2: number, y2: number, farbe: string, b = 1.4, extra = '') =>
  `<line x1="${k(x1)}" y1="${k(y1)}" x2="${k(x2)}" y2="${k(y2)}" stroke="${farbe}" stroke-width="${b}" stroke-linecap="round"${extra}/>`;
const pfeil2d = (m: ReturnType<typeof marker>, x1: number, y1: number, x2: number, y2: number, farbe: string, b = 2, extra = '') =>
  ln(x1, y1, x2, y2, farbe, b, ` marker-end="url(#${m.id(farbe)})"${extra}`);
const pfad = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${k(x)} ${k(y)}`).join(' ');




function profil(x0: number, y0: number, c: number, alpha: number, tiefe: number, lage = 0.45, n = 28): [number, number][] {
  const a = (alpha * Math.PI) / 180;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = t < lage ? (tiefe / lage ** 2) * (2 * lage * t - t * t) : (tiefe / (1 - lage) ** 2) * ((1 - 2 * lage) + 2 * lage * t - t * t);
    const px = t * c;
    const py = -y * c;
    pts.push([x0 + px * Math.cos(a) - py * Math.sin(a), y0 + px * Math.sin(a) + py * Math.cos(a)]);
  }
  return pts;
}


function stromlinie(p: [number, number][], abstand: number, vor = 70, nach = 60, abriss = 1): [number, number][] {
  const [x0, y0] = p[0]!;
  const [xe, ye] = p[p.length - 1]!;
  const dx = xe - p[p.length - 2]![0];
  const dy = ye - p[p.length - 2]![1];
  const l = Math.hypot(dx, dy);
  const anlauf: [number, number][] = [[x0 - vor, y0 - abstand], [x0 - vor * 0.35, y0 - abstand * 1.05]];
  const entlang = p.slice(0, Math.max(2, Math.round(p.length * abriss))).map(([x, y], i) => {
    const t = i / (p.length - 1);
    const f = abstand * (1 - 0.35 * Math.sin(Math.PI * t));
    return [x, y - f] as [number, number];
  });
  if (abriss < 1) return [...anlauf, ...entlang];
  const ende = entlang[entlang.length - 1]!;
  return [...anlauf, ...entlang, [ende[0] + (dx / l) * nach, ende[1] + (dy / l) * nach]];
}


export function zeichnungAuftriebWiderstand(t: T): string {
  const m = marker(TEXT, TEAL, GRAU);
  const p = profil(70, 92, 150, 14, 0.13);
  const linien = [26, 48, -22, -44].map((d) => `<path d="${pfad(stromlinie(p, d))}" fill="none" stroke="${GRAU}" stroke-width="1.2"/>`).join('');
  const segel = `<path d="${pfad(p)}" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`;
  const plus = [[110, 112], [150, 122]].map(([x, y]) => tx(x!, y!, '+', 'kp-rr-l kp-rr-amber')).join('');
  const minus = [[105, 70], [150, 76], [190, 90]].map(([x, y]) => tx(x!, y!, '−', 'kp-rr-l kp-rr-amber')).join('');
  const links = linien + segel + plus + minus
    + pfeil2d(m, 150, 100, 168, 34, TEAL, 2.4) + tx(178, 30, t('Auftrieb', 'Lift'), 'kp-rr-l', 'start')
    + pfeil2d(m, 8, 150, 50, 150, TEXT, 2) + tx(10, 168, t('scheinbarer Wind', 'apparent wind'), 'kp-rr-s', 'start')
    + tx(150, 205, t('Am Wind bis raumschots: Auftrieb', 'Close-hauled to broad reach: lift'), 'kp-rr-l');
  
  const ox = 330;
  const quer = `<path d="M${ox + 120} 40 Q${ox + 150} 100 ${ox + 120} 160" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`;
  const zu = [55, 80, 105, 130, 150].map((y) => pfeil2d(m, ox + 10, y, ox + 100, y, GRAU, 1.2)).join('');
  const wirbel = [[ox + 175, 70], [ox + 200, 105], [ox + 172, 135], [ox + 215, 150], [ox + 220, 62]].map(([x, y]) =>
    `<path d="M${x} ${y} a9 9 0 1 1 -9 -9 a5 5 0 1 1 5 5" fill="none" stroke="${GRAU}" stroke-width="1.1"/>`).join('');
  const rechts = zu + quer + wirbel + tx(ox + 108, 100, '+', 'kp-rr-l kp-rr-amber') + tx(ox + 160, 100, '−', 'kp-rr-l kp-rr-amber')
    + pfeil2d(m, ox + 135, 178, ox + 205, 178, TEAL, 2.4) + tx(ox + 212, 182, t('Widerstand', 'Drag'), 'kp-rr-l', 'start')
    + tx(ox + 135, 205, t('Vor dem Wind: Widerstand', 'Running: drag'), 'kp-rr-l');
  return svg2d(620, 215, t('Strömung am Segel: Auftrieb am Wind, Widerstand vor dem Wind', 'Flow over a sail: lift upwind, drag downwind'),
    links + ln(310, 10, 310, 205, 'var(--line)', 1) + rechts, m.defs);
}



const YACHT: Fahrzeug = { x: 0, y: 0, kurs: 90, art: 'segel', windAus: 130, L: 10 };


function schwerpunkt(dreiecke: readonly (readonly [V3, V3, V3])[]): V3 {
  let A = 0;
  const s = [0, 0, 0];
  for (const [a, b, c] of dreiecke) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const kr = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    const f = Math.hypot(kr[0]!, kr[1]!, kr[2]!) / 2;
    A += f;
    for (let i = 0; i < 3; i++) s[i]! += (f * (a[i]! + b[i]! + c[i]!)) / 3;
  }
  return [s[0]! / A, s[1]! / A, s[2]! / A];
}

function segelDruckpunkt(f: Fahrzeug): V3 {
  const r = rigg(f);
  return schwerpunkt([[r.baumFuss, r.mastTop, r.baumEnde], [r.hals, r.kopfVor, r.schothornVor]]);
}


export function zeichnungKraefte(t: T): string {
  const m = marker(TEXT, TEAL, AMBER, GRAU);
  const iso = new Iso(13, 150, 222);
  const sd = segelDruckpunkt(YACHT);
  const ld: V3 = [sd[0] - 0.8, 0, 0];
  const pf = (a: V3, b: V3, farbe: string, breite = 2.4, extra = '') => strich(iso, a, b, farbe, breite, ` marker-end="url(#${m.id(farbe)})"${extra}`);
  const plus = (a: V3, d: [number, number]): V3 => [a[0] + d[0], a[1] + d[1], a[2]];
  const ges = plus(sd, [2.6, 6.5]);
  const sw = (r: number): V3 => [sd[0] + r * Math.cos(0.44), sd[1] - r * Math.sin(0.44), sd[2]];
  const inhalt = wasser(iso, -7, 8, -7, 8) + raster(iso, -7, 8, 3)
    + pf(plus(ld, [0, 0]), plus(ld, [0, -6.5]), AMBER, 2.2, ' stroke-dasharray="5 3"')
    + fahrzeug(iso, YACHT)
    + pf([-5.1, 0, 0.5], [-7.7, 0, 0.5], GRAU, 1.8, ' stroke-dasharray="5 3"')
    + strich(iso, plus(sd, [2.6, 0]), ges, GRAU, 1, ' stroke-dasharray="3 3"') + strich(iso, plus(sd, [0, 6.5]), ges, GRAU, 1, ' stroke-dasharray="3 3"')
    + pf(sd, ges, TEXT, 2.6) + pf(sd, plus(sd, [2.6, 0]), TEAL, 2.6) + pf(sd, plus(sd, [0, 6.5]), AMBER, 2.6)
    + strich(iso, sw(9), sw(1.6), TEXT, 1.6, ` stroke-dasharray="6 4" marker-end="url(#${m.id(TEXT)})"`)
    + `<circle cx="${k(iso.p(sd[0], sd[1], sd[2])[0])}" cy="${k(iso.p(sd[0], sd[1], sd[2])[1])}" r="3.5" fill="${TEXT}"/>`
    + beschrift(iso, sw(9.4), t('scheinbarer Wind', 'apparent wind'), 'kp-rr-s kp-l-h', 'middle', 14)
    + beschrift(iso, ges, t('Gesamtkraft', 'Total force'), 'kp-rr-l kp-l-h', 'start', -6)
    + beschrift(iso, plus(sd, [2.9, 0]), t('Vortrieb', 'Drive'), 'kp-rr-l kp-l-h', 'start', 14)
    + beschrift(iso, plus(sd, [0, 6.8]), t('Querkraft', 'Side force'), 'kp-rr-l kp-l-h', 'end', -8)
    + beschrift(iso, plus(ld, [0.2, -6.8]), t('Lateralwiderstand', 'Lateral resistance'), 'kp-rr-l kp-l-h', 'middle', 16)
    + beschrift(iso, [-7.9, 0, 0.5], t('Rumpfwiderstand', 'Hull drag'), 'kp-rr-s kp-l-h', 'end', 4)
    + beschrift(iso, sd, 'SD', 'kp-rr-l kp-l-h', 'end', -8);
  return isoSvg(360, 300, t('Kräfte am Segel: Gesamtkraft, Vortrieb, Querkraft und Lateralwiderstand',
    'Forces on a sail: total force, drive, side force and lateral resistance'), inhalt, m.defs, 'kp-iso');
}


export function zeichnungWindgradient(t: T): string {
  const m = marker(TEXT, TEAL, GRAU, AMBER);
  const hoehen = [0.15, 0.4, 0.65, 0.9];
  const v = (h: number) => 34 + 96 * Math.pow(h, 0.18);
  const y = (h: number) => 210 - h * 180;
  const profilPfad = pfad(Array.from({ length: 30 }, (_, i) => { const h = 0.02 + (i / 29) * 0.96; return [30 + v(h), y(h)] as [number, number]; }));
  const links = ln(30, 214, 30, 20, GRAU, 1) + ln(26, 214, 180, 214, GRAU, 1)
    + `<path d="${profilPfad}" fill="none" stroke="${TEAL}" stroke-width="2"/>`
    + hoehen.map((h) => pfeil2d(m, 30, y(h), 30 + v(h) - 3, y(h), TEXT, 1.6)).join('')
    + tx(34, 16, t('Höhe', 'Height'), 'kp-rr-s', 'start') + tx(178, 232, t('wahrer Wind', 'true wind'), 'kp-rr-s', 'end');
  
  
  
  const drei = [[0.1, t('an Deck', 'at deck')], [0.5, t('halbe Höhe', 'mid mast')], [0.95, t('Masttopp', 'masthead')]] as const;
  const fahrt = 46;
  const rechts = drei.map(([h, name], i) => {
    const ox = 250 + i * 125;
    const oy = 40;
    const w = v(h) * 0.62;
    const wx = -w * Math.sin(Math.PI / 4);
    const wy = w * Math.cos(Math.PI / 4);
    const ex = ox + wx;
    const ey = oy + wy + fahrt;
    const winkel = Math.round((Math.atan2(-(ex - ox), ey - oy) * 180) / Math.PI);
    return pfeil2d(m, ox, oy, ox + wx, oy + wy, TEAL, 1.8) + pfeil2d(m, ox + wx, oy + wy, ex, ey, GRAU, 1.6)
      + pfeil2d(m, ox, oy, ex, ey, AMBER, 2.4)
      + tx(ox - 20, 190, name, 'kp-rr-l') + tx(ox - 20, 206, t(`${winkel}° zum Bug`, `${winkel}° off the bow`), 'kp-rr-s');
  }).join('')
    + tx(615, 232, t('blaugrün: wahrer Wind · grau: Fahrtwind · bernstein: scheinbarer Wind', 'teal: true wind · grey: wind from motion · amber: apparent wind'), 'kp-rr-s', 'end');
  return svg2d(620, 240, t('Windgradient: oben mehr Wind, der scheinbare Wind fällt oben raumer ein',
    'Wind gradient: more wind aloft, the apparent wind comes from further aft at the masthead'), links + ln(205, 10, 205, 215, 'var(--line)', 1) + rechts, m.defs);
}


export function zeichnungSpalt(t: T): string {
  const m = marker(GRAU, AMBER, TEXT);
  const vor = profil(110, 36, 150, 22, 0.12, 0.4);
  const gross = profil(232, 100, 230, 13, 0.11, 0.45);
  
  
  const bei = (p: [number, number][], x: number): number | null => {
    for (let i = 1; i < p.length; i++) {
      const [x1, y1] = p[i - 1]!;
      const [x2, y2] = p[i]!;
      if (x >= x1 && x <= x2) return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1 || 1);
    }
    return null;
  };
  const vLE = vor[0]!;
  const gTE = gross[gross.length - 1]!;
  const neigung = Math.tan((13 * Math.PI) / 180);
  const huelle = (x: number, oben: boolean): number => {
    if (x < vLE[0]) return vLE[1] + (vLE[0] - x) * 0.22;
    if (x > gTE[0]) return gTE[1] + (x - gTE[0]) * neigung;
    const ys = [bei(vor, x), bei(gross, x)].filter((y): y is number => y !== null);
    if (!ys.length) return vLE[1];
    return oben ? Math.min(...ys) : Math.max(...ys);
  };
  
  const linie = (f: (x: number) => number, fenster = 5) => {
    const roh: number[] = [];
    for (let x = 6; x <= 614; x += 6) roh.push(f(x));
    const pts = roh.map((_, i) => {
      const teil = roh.slice(Math.max(0, i - fenster), i + fenster + 1);
      return [6 + i * 6, teil.reduce((a, b) => a + b, 0) / teil.length] as [number, number];
    });
    return `<path d="${pfad(pts)}" fill="none" stroke="${GRAU}" stroke-width="1.2"/>`;
  };
  const spaltY = (x: number): number => {
    const v = bei(vor, x);
    const g = bei(gross, x);
    if (v !== null && g !== null) return (v + g) / 2;
    if (v !== null) return v + 14 * Math.min(1, (x - vLE[0]) / 40);
    if (g !== null) return g - 8;
    if (x < vLE[0]) return vLE[1] + 14 * Math.max(0, 1 - (vLE[0] - x) / 120) + (vLE[0] - x) * 0.22;
    return huelle(x, true) + 8;
  };
  const inhalt = linie((x) => huelle(x, true) - 22) + linie((x) => huelle(x, true) - 46) + linie(spaltY, 2)
    + linie((x) => huelle(x, false) + 24) + linie((x) => huelle(x, false) + 48)
    + `<path d="${pfad(vor)}" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="${pfad(gross)}" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`
    + pfeil2d(m, 40, 96, 84, 80, AMBER, 1.8) + tx(10, 16, t('Upwash: Vorsegel wird raumer angeströmt', 'Upwash: the headsail sees a freer wind'), 'kp-rr-l', 'start')
    + tx(230, 205, t('Spalt: Luft wird langsamer, Groß reißt später ab', 'Slot: air slows down, the main stalls later'), 'kp-rr-l', 'middle')
    + pfeil2d(m, 300, 186, 270, 112, AMBER, 1.4)
    + tx(400, 50, t('beschleunigte Abströmung', 'faster flow off'), 'kp-rr-s', 'start') + tx(400, 63, t('am Achterliek des Vorsegels', 'the headsail leech'), 'kp-rr-s', 'start')
    + tx(190, 84, t('Vorsegel', 'Headsail'), 'kp-rr-s kp-l-h', 'middle') + tx(380, 140, t('Großsegel', 'Mainsail'), 'kp-rr-s kp-l-h', 'middle');
  return svg2d(620, 215, t('Vorsegel und Großsegel: Upwash und Spalt', 'Headsail and mainsail: upwash and slot'), inhalt, m.defs);
}



type P2 = [number, number];

function flaecheUndMitte(poly: readonly P2[]): { A: number; c: P2 } {
  let A = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i]!;
    const [x2, y2] = poly[(i + 1) % poly.length]!;
    const kr = x1 * y2 - x2 * y1;
    A += kr;
    cx += (x1 + x2) * kr;
    cy += (y1 + y2) * kr;
  }
  A /= 2;
  return { A: Math.abs(A), c: A === 0 ? [0, 0] : [cx / (6 * A), cy / (6 * A)] };
}


function unterhalb(poly: readonly P2[], h: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ain = a[1] <= h;
    const bin = b[1] <= h;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (h - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, h]);
    }
  }
  return out;
}

const dreh = (p: P2, phi: number): P2 => {
  const a = (phi * Math.PI) / 180;
  return [p[0] * Math.cos(a) + p[1] * Math.sin(a), -p[0] * Math.sin(a) + p[1] * Math.cos(a)];
};


function gekraengt(rumpfPoly: readonly P2[], phi: number) {
  const A0 = flaecheUndMitte(unterhalb(rumpfPoly, 0)).A;
  const r = rumpfPoly.map((p) => dreh(p, phi));
  let lo = -3;
  let hi = 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (flaecheUndMitte(unterhalb(r, mid)).A < A0) lo = mid; else hi = mid;
  }
  const h = (lo + hi) / 2;
  return { r, h, B: flaecheUndMitte(unterhalb(r, h)).c };
}

function querschnitt(t: T, m: ReturnType<typeof marker>, ox: number, art: 'jolle' | 'kiel', phi: number): string {
  const jolle: P2[] = [[-0.95, 0.42], [-0.93, 0.08], [-0.8, -0.14], [-0.45, -0.27], [0, -0.3], [0.45, -0.27], [0.8, -0.14], [0.93, 0.08], [0.95, 0.42]];
  const kiel: P2[] = [[-0.6, 0.45], [-0.6, 0.1], [-0.5, -0.12], [-0.28, -0.26], [0, -0.3], [0.28, -0.26], [0.5, -0.12], [0.6, 0.1], [0.6, 0.45]];
  const form = art === 'jolle' ? jolle : kiel;
  const G0: P2 = art === 'jolle' ? [0, 0.32] : [0, -0.42];
  const { r, h, B } = gekraengt(form, phi);
  const G = dreh(G0, phi);
  const s = 82;
  const cy = 156;
  const X = (p: P2) => ox + p[0] * s;
  const Y = (p: P2) => cy - (p[1] - h) * s;
  const pts = (q: readonly P2[]) => q.map((p) => `${k(X(p))},${k(Y(p))}`).join(' ');
  const anhang: P2[] = art === 'jolle'
    ? [[-0.03, -0.3], [-0.03, -1.05], [0.03, -1.05], [0.03, -0.3]]
    : [[-0.05, -0.3], [-0.07, -0.95], [-0.16, -1.02], [-0.16, -1.12], [0.16, -1.12], [0.16, -1.02], [0.07, -0.95], [0.05, -0.3]];
  const mastFuss = dreh([0, 0.45], phi);
  const mastTop = dreh([0, 2.1], phi);
  const deckel: P2[] = [form[0]!, form[form.length - 1]!].map((p) => dreh(p, phi));
  return `<rect x="${ox - 150}" y="${cy}" width="300" height="${280 - cy}" fill="color-mix(in srgb, var(--teal) 14%, var(--panel-2))"/>`
    + ln(ox - 150, cy, ox + 150, cy, TEAL, 1.2)
    + `<polygon points="${pts(anhang.map((p) => dreh(p, phi)))}" fill="${GRAU}"/>`
    + `<polygon points="${pts(r)}" fill="color-mix(in srgb, var(--text) 24%, var(--panel))" stroke="var(--bg)" stroke-width="1"/>`
    + ln(X(deckel[0]!), Y(deckel[0]!), X(deckel[1]!), Y(deckel[1]!), 'var(--bg)', 1)
    + ln(X(mastFuss), Y(mastFuss), X(mastTop), Y(mastTop), RIGG, 2)
    + ln(X(G), Y(G) - 70, X(G), Y(G) + 60, GRAU, 1, ' stroke-dasharray="3 3"') + ln(X(B), Y(B) - 60, X(B), Y(B) + 40, GRAU, 1, ' stroke-dasharray="3 3"')
    + pfeil2d(m, X(G), Y(G), X(G), Y(G) + 44, TEXT, 2.2) + pfeil2d(m, X(B), Y(B), X(B), Y(B) - 44, TEAL, 2.2)
    + `<circle cx="${k(X(G))}" cy="${k(Y(G))}" r="4" fill="${TEXT}"/><circle cx="${k(X(B))}" cy="${k(Y(B))}" r="4" fill="${TEAL}"/>`
    + tx(X(G) - 8, Y(G) + 4, 'G', 'kp-rr-l kp-l-h', 'end') + tx(X(B) + 8, Y(B) + 4, 'B', 'kp-rr-l kp-l-h', 'start')
    + ln(X(G), Y(G) - 58, X(B), Y(G) - 58, AMBER, 2) + tx((X(G) + X(B)) / 2, Y(G) - 64, 'GZ', 'kp-rr-l kp-rr-amber')
    + tx(ox, 22, art === 'jolle' ? t('Jolle: Formstabilität', 'Dinghy: form stability') : t('Kielyacht: Gewichtsstabilität', 'Keelboat: weight stability'), 'kp-rr-l')
    + tx(ox, 38, t(`${phi}° Krängung`, `${phi}° of heel`), 'kp-rr-s');
}

export function zeichnungStabilitaet(t: T): string {
  const m = marker(TEXT, TEAL);
  return svg2d(620, 280, t('Form- und Gewichtsstabilität im Querschnitt: Schwerpunkt G, Auftriebsschwerpunkt B, aufrichtender Hebel GZ',
    'Form and weight stability in cross-section: centre of gravity G, centre of buoyancy B, righting lever GZ'),
  querschnitt(t, m, 155, 'jolle', 20) + ln(310, 0, 310, 280, 'var(--line)', 1) + querschnitt(t, m, 465, 'kiel', 40)
    + tx(310, 272, t('Auftriebsschwerpunkt aus dem eingetauchten Querschnitt berechnet', 'Centre of buoyancy computed from the immersed section'), 'kp-rr-s'), m.defs);
}


export function zeichnungHebelarm(t: T): string {
  const X = (w: number) => 50 + w * 3.05;
  const Y = (gz: number) => 150 - gz * 110;
  const jolle = (w: number) => (w <= 90 ? Math.sin((Math.PI * w) / 90) * (1 - 0.45 * (w / 90)) * 0.95 : -0.35 * Math.sin((Math.PI * (w - 90)) / 90));
  const kiel = (w: number) => (w <= 125 ? 0.78 * Math.sin((Math.PI * w) / 125) * (1 - 0.25 * (w / 125)) : -0.22 * Math.sin((Math.PI * (w - 125)) / 55));
  const kurve2 = (f: (w: number) => number) => pfad(Array.from({ length: 91 }, (_, i) => [X(i * 2), Y(f(i * 2))] as [number, number]));
  const achsen = ln(X(0), Y(0), X(180), Y(0), GRAU, 1) + ln(X(0), Y(-0.45), X(0), Y(1.15), GRAU, 1)
    + [0, 30, 60, 90, 120, 150, 180].map((w) => ln(X(w), Y(0) - 3, X(w), Y(0) + 3, GRAU, 1) + tx(X(w), Y(0) + 16, `${w}°`, 'kp-rr-s')).join('');
  const jMax = 33;
  const kMax = 57;
  return svg2d(620, 230, t('Hebelarmkurven einer Jolle und einer Kielyacht, schematisch', 'Righting lever curves of a dinghy and a keelboat, schematic'),
    achsen
    + `<path d="${kurve2(jolle)}" fill="none" stroke="${AMBER}" stroke-width="2.4"/>`
    + `<path d="${kurve2(kiel)}" fill="none" stroke="${TEAL}" stroke-width="2.4"/>`
    + tx(X(jMax), Y(jolle(jMax)) - 10, t('Jolle', 'Dinghy'), 'kp-rr-l kp-rr-amber')
    + tx(X(kMax) + 10, Y(kiel(kMax)) - 10, t('Kielyacht', 'Keelboat'), 'kp-rr-l', 'start')
    + `<circle cx="${k(X(90))}" cy="${k(Y(0))}" r="4" fill="${AMBER}"/><circle cx="${k(X(125))}" cy="${k(Y(0))}" r="4" fill="${TEAL}"/>`
    + tx(X(90), Y(0) - 10, t('Kenterpunkt', 'capsize'), 'kp-rr-s') + tx(X(125) + 6, Y(0) - 10, t('Stabilitätsumfang', 'limit of positive stability'), 'kp-rr-s', 'start')
    + tx(X(0) + 6, Y(1.15) + 4, t('aufrichtender Hebel GZ', 'righting lever GZ'), 'kp-rr-s', 'start')
    + tx(X(180), Y(0) + 34, t('Krängung', 'Heel'), 'kp-rr-s', 'end')
    + tx(X(180), 20, t('schematisch, kein bestimmtes Boot', 'schematic, not a particular boat'), 'kp-rr-s', 'end'));
}



type Kiel = 'lang' | 'flosse';

function lateralTeile(art: Kiel): { teile: P2[][]; ruder: P2[] } {
  if (art === 'lang') {
    return {
      teile: [[[4.6, 0], [3.8, -0.6], [2.6, -1.45], [-2.6, -1.65], [-3.55, -1.4], [-3.75, -0.3], [-4.6, 0]]],
      ruder: [[-3.55, -1.4], [-4.15, -1.35], [-4.3, -0.15], [-3.75, -0.3]],
    };
  }
  return {
    teile: [[[4.6, 0], [3.2, -0.42], [-3, -0.45], [-4.4, -0.15], [-4.6, 0]], [[0.95, -0.4], [-0.45, -0.4], [-0.85, -2.4], [0.15, -2.4]]],
    ruder: [[-3.45, -0.35], [-4.05, -0.35], [-3.95, -1.7], [-3.55, -1.7]],
  };
}

function lateralDruckpunkt(art: Kiel): P2 {
  const { teile, ruder } = lateralTeile(art);
  let A = 0;
  let x = 0;
  let y = 0;
  for (const p of [...teile, ruder]) {
    const f = flaecheUndMitte(p);
    A += f.A;
    x += f.A * f.c[0];
    y += f.A * f.c[1];
  }
  return [x / A, y / A];
}


function lateralSzene(t: T, art: Kiel, mitSegeln: boolean, label: string): string {
  const m = marker(AMBER);
  const s = mitSegeln ? 20 : 26;
  const w = mitSegeln ? 360 : 300;
  const hoehe = mitSegeln ? 360 : 170;
  const wl = mitSegeln ? 296 : 82;
  const X = (x: number) => w / 2 + x * s;
  const Y = (z: number) => wl - z * s;
  const poly = (p: readonly P2[], fill: string, extra = '') => `<polygon points="${p.map(([x, z]) => `${k(X(x))},${k(Y(z))}`).join(' ')}" fill="${fill}"${extra}/>`;
  const { teile, ruder } = lateralTeile(art);
  const ld = lateralDruckpunkt(art);
  const rumpfOben: P2[] = [[-4.6, 0], [-5, 1.05], [5.25, 1.35], [4.6, 0]];
  const punkt = (p: P2, farbe: string) => `<circle cx="${k(X(p[0]))}" cy="${k(Y(p[1]))}" r="4.5" fill="${farbe}" stroke="var(--bg)" stroke-width="1"/>`;
  let segel = '';
  if (mitSegeln) {
    const gross: P2[] = [[1.2, 2], [1.2, 13.4], [-3, 2.2]];
    const vor: P2[] = [[4.7, 1.3], [1.6, 11.6], [0.6, 1.7]];
    const fg = flaecheUndMitte(gross);
    const fv = flaecheUndMitte(vor);
    const sd: P2 = [(fg.c[0] * fg.A + fv.c[0] * fv.A) / (fg.A + fv.A), (fg.c[1] * fg.A + fv.c[1] * fv.A) / (fg.A + fv.A)];
    segel = poly(gross, 'var(--text)', ' fill-opacity=".26" stroke="var(--bg)" stroke-width="1"')
      + poly(vor, 'var(--text)', ' fill-opacity=".2" stroke="var(--bg)" stroke-width="1"')
      + ln(X(1.2), Y(1.2), X(1.2), Y(13.6), RIGG, 2.4) + ln(X(1.2), Y(2), X(-3.1), Y(2.2), RIGG, 2.2)
      + ln(X(sd[0]), Y(sd[1]), X(sd[0]), Y(-0.2), GRAU, 1, ' stroke-dasharray="3 3"')
      + ln(X(ld[0]), Y(ld[1]), X(ld[0]), Y(0.6), GRAU, 1, ' stroke-dasharray="3 3"')
      + ln(X(ld[0]), Y(0.35), X(sd[0]), Y(0.35), AMBER, 1.8, ` marker-start="url(#${m.id(AMBER)})" marker-end="url(#${m.id(AMBER)})"`)
      + tx((X(ld[0]) + X(sd[0])) / 2, Y(0.35) - 8, t('Vorlauf', 'Lead'), 'kp-rr-s kp-l-h')
      + punkt(sd, TEXT) + tx(X(sd[0]) + 9, Y(sd[1]) + 4, t('SD', 'CE'), 'kp-rr-l kp-l-h', 'start');
  }
  const wasser2 = `<rect x="0" y="${k(Y(0))}" width="${w}" height="${k(hoehe - Y(0))}" fill="color-mix(in srgb, var(--teal) 16%, var(--panel-2))" fill-opacity=".55"/>`;
  return svg2d(w, hoehe, label,
    teile.map((p) => poly(p, 'color-mix(in srgb, var(--akzent) 55%, var(--panel))', ' stroke="var(--bg)" stroke-width="1"')).join('')
    + poly(ruder, 'color-mix(in srgb, var(--akzent) 35%, var(--panel))', ' stroke="var(--bg)" stroke-width="1"')
    + wasser2 + ln(0, Y(0), w, Y(0), TEAL, 1.4)
    + poly(rumpfOben, 'color-mix(in srgb, var(--text) 24%, var(--panel))', ' stroke="var(--bg)" stroke-width="1"')
    + segel + punkt(ld, AMBER) + tx(X(ld[0]) + 9, Y(ld[1]) + 4, t('LD', 'CLR'), 'kp-rr-l kp-l-h', 'start'), m.defs);
}

export const zeichnungLangkiel = (t: T) => lateralSzene(t, 'lang', false, t('Langgestreckter Lateralplan (Langkieler)', 'Long keel'));
export const zeichnungFlosse = (t: T) => lateralSzene(t, 'flosse', false, t('Beschnittener Lateralplan: Flossenkiel und Spatenruder', 'Fin keel and spade rudder'));
export const zeichnungDruckpunkte = (t: T) => lateralSzene(t, 'flosse', true,
  t('Segeldruckpunkt SD vor dem Lateraldruckpunkt LD (Vorlauf)', 'Centre of effort ahead of the centre of lateral resistance (lead)'));


export function zeichnungGierig(t: T): string {
  const m = marker(TEXT, TEAL, AMBER, GRAU);
  const boot = (ox: number, oy: number) => `<path d="M${ox - 95} ${oy - 18} L${ox + 40} ${oy - 22} Q${ox + 95} ${oy - 12} ${ox + 110} ${oy} `
    + `Q${ox + 95} ${oy + 12} ${ox + 40} ${oy + 22} L${ox - 95} ${oy + 18} Z" fill="color-mix(in srgb, var(--text) 18%, var(--panel))" stroke="var(--bg)"/>`;
  const dot = (x: number, y: number, farbe: string, s: string) => `<circle cx="${x}" cy="${y}" r="4" fill="${farbe}"/>` + tx(x, y - 9, s, 'kp-rr-s');
  const dreh = (x: number, y: number, r: number, imUhr: boolean, farbe: string) => {
    const a = imUhr ? `M${x - r} ${y} A${r} ${r} 0 0 1 ${x} ${y - r}` : `M${x - r} ${y} A${r} ${r} 0 0 0 ${x} ${y + r}`;
    return `<path d="${a}" fill="none" stroke="${farbe}" stroke-width="2" marker-end="url(#${m.id(farbe)})"/>`;
  };
  
  const a = 155;
  const links = boot(a, 120) + dot(a + 25, 120, TEXT, t('SD', 'CE')) + dot(a - 15, 120, AMBER, t('LD', 'CLR'))
    + pfeil2d(m, a + 25, 120, a + 25, 175, AMBER, 2.2) + pfeil2d(m, a - 15, 120, a - 15, 65, AMBER, 2.2)
    + dreh(a + 120, 120, 22, false, GRAU) + tx(a, 210, t('SD vor LD: dreht nach Lee', 'CE ahead of CLR: turns to leeward'), 'kp-rr-l')
    + tx(a + 30, 192, t('Querkraft', 'side force'), 'kp-rr-s', 'start') + tx(a - 18, 52, t('Lateralwiderstand', 'lateral resistance'), 'kp-rr-s', 'middle');
  const b = 465;
  const rechts = boot(b, 120) + dot(b - 10, 150, TEXT, '') + tx(b - 10, 166, t('SD bei Krängung', 'CE when heeled'), 'kp-rr-s')
    + dot(b - 10, 120, AMBER, t('LD', 'CLR'))
    + pfeil2d(m, b - 10, 150, b + 50, 150, TEAL, 2.2) + pfeil2d(m, b - 10, 120, b - 70, 120, GRAU, 2.2)
    + tx(b + 56, 154, t('Vortrieb', 'drive'), 'kp-rr-s', 'start') + tx(b - 76, 116, t('Widerstand', 'drag'), 'kp-rr-s', 'end')
    + dreh(b + 120, 120, 22, true, GRAU) + tx(b, 210, t('Krängung: dreht nach Luv', 'Heel: turns to windward'), 'kp-rr-l');
  const wind = pfeil2d(m, 300, 14, 300, 50, TEXT, 2) + tx(310, 30, 'Wind', 'kp-rr-w', 'start');
  return svg2d(620, 225, t('Leegierig und luvgierig: Drehmomente aus Querkraft und Lateralwiderstand, aus Vortrieb und Widerstand',
    'Lee helm and weather helm: turning moments from side force and lateral resistance, and from drive and drag'), links + rechts + wind
    + ln(310, 60, 310, 220, 'var(--line)', 1), m.defs);
}




export function zeichnungAnstellwinkel(t: T): string {
  const m = marker(GRAU, TEXT);
  const panel = (ox: number, alpha: number, art: 'dicht' | 'gut' | 'offen', titel: string) => {
    const p = profil(ox + 30, 90, 130, alpha, 0.12);
    const sehne = ln(p[0]![0], p[0]![1], p[p.length - 1]![0], p[p.length - 1]![1], GRAU, 1, ' stroke-dasharray="4 3"');
    const wind = ln(ox + 30, 90, ox + 175, 90, GRAU, 1, ' stroke-dasharray="2 4"');
    const zu = pfeil2d(m, ox + 2, 70, ox + 24, 70, TEXT, 1.6) + pfeil2d(m, ox + 2, 110, ox + 24, 110, TEXT, 1.6);
    const oben = art === 'dicht'
      ? `<path d="${pfad(stromlinie(p, 18, 30, 40, 0.35))}" fill="none" stroke="${GRAU}" stroke-width="1.2"/>`
        + [[ox + 95, 70], [ox + 125, 78], [ox + 150, 92]].map(([x, y]) => `<path d="M${x} ${y} a7 7 0 1 1 -7 -7 a4 4 0 1 1 4 4" fill="none" stroke="${GRAU}" stroke-width="1.1"/>`).join('')
      : `<path d="${pfad(stromlinie(p, 18, 30, 40))}" fill="none" stroke="${GRAU}" stroke-width="1.2"/>`;
    const unten = `<path d="${pfad(stromlinie(p, -18, 30, 40))}" fill="none" stroke="${GRAU}" stroke-width="1.2"/>`;
    const segel = art === 'offen'
      ? `<path d="${pfad(p.map(([x, y], i) => (i < 9 ? [x, y + Math.sin(i * 1.7) * 5] : [x, y]) as [number, number]))}" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`
      : `<path d="${pfad(p)}" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`;
    const bogen = `<path d="M${ox + 90} 90 A60 60 0 0 1 ${k(ox + 30 + 60 * Math.cos((alpha * Math.PI) / 180))} ${k(90 + 60 * Math.sin((alpha * Math.PI) / 180))}" fill="none" stroke="${AMBER}" stroke-width="1.4"/>`;
    const hinweis = art === 'dicht' ? t('Strömung reißt in Lee ab', 'flow separates to leeward')
      : art === 'offen' ? t('Vorliek killt', 'luff flutters') : t('Strömung liegt an', 'attached flow');
    return wind + sehne + oben + unten + segel + zu + bogen + tx(ox + 100, 98 + alpha * 1.4, 'α', 'kp-rr-l kp-rr-amber', 'start')
      + tx(ox + 100, 170, titel, 'kp-rr-l') + tx(ox + 100, 186, hinweis, 'kp-rr-s');
  };
  return svg2d(620, 200, t('Anstellwinkel: zu dicht, richtig, zu offen', 'Angle of attack: over-trimmed, right, under-trimmed'),
    panel(0, 30, 'dicht', t('zu dicht', 'over-trimmed')) + panel(207, 15, 'gut', t('richtig', 'right')) + panel(414, 4, 'offen', t('zu offen', 'under-trimmed'))
    + ln(206, 20, 206, 190, 'var(--line)', 1) + ln(413, 20, 413, 190, 'var(--line)', 1)
    + tx(8, 18, t('gestrichelt: Sehne · α: Anstellwinkel zum scheinbaren Wind', 'dashed: chord · α: angle of attack to the apparent wind'), 'kp-rr-s', 'start'), m.defs);
}


export function zeichnungProfiltiefe(t: T): string {
  const m = marker(GRAU);
  const panel = (ox: number, tiefe: number, lage: number, titel: string, werte: string) => {
    const c = 240;
    const p = profil(ox + 30, 120, c, 0, tiefe, lage);
    const xs = ox + 30 + c * lage;
    const ys = 120 - tiefe * c;
    return `<path d="${pfad(p)}" fill="none" stroke="${TEXT}" stroke-width="3" stroke-linecap="round"/>`
      + ln(ox + 30, 128, ox + 30 + c, 128, TEAL, 1.4) + tx(ox + 30 + c / 2, 146, t('b: Sehne', 'b: chord'), 'kp-rr-s')
      + ln(xs, 120, xs, ys, AMBER, 2) + tx(xs + 6, (120 + ys) / 2 + 4, 'a', 'kp-rr-l kp-rr-amber', 'start')
      + tx(xs, ys - 8, t('Scheitel', 'max. depth'), 'kp-rr-s')
      + tx(ox + 30 + c / 2, 30, titel, 'kp-rr-l') + tx(ox + 30 + c / 2, 46, werte, 'kp-rr-s');
  };
  return svg2d(620, 185, t('Profiltiefe a im Verhältnis zur Sehne b und Lage des Scheitels', 'Depth a relative to chord b, and draft position'),
    panel(0, 0.15, 0.5, t('Leichtwind: tief', 'Light air: deep'), t('a/b 13–16 %, Scheitel bei 50 %', 'a/b 13–16%, draft at 50%'))
    + ln(310, 20, 310, 175, 'var(--line)', 1)
    + panel(310, 0.1, 0.45, t('Starkwind: flach', 'Heavy air: flat'), t('a/b 9–12 %, Scheitel bei 45 %', 'a/b 9–12%, draft at 45%')), m.defs);
}


export function zeichnungTwist(t: T): string {
  const m = marker(TEXT);
  const panel = (ox: number, unten: number, oben: number, titel: string, hinweis: string) => {
    const mx = ox + 70;
    const my = 52;
    const n = 4;
    const schnitte = Array.from({ length: n }, (_, i) => {
      const s = i / (n - 1);
      const beta = unten + (oben - unten) * s;
      const c = 125 * (1 - 0.4 * s);
      const p = profil(mx, my, c, 90 - beta, 0.12, 0.45);
      const ende = p[p.length - 1]!;
      return `<path d="${pfad(p)}" fill="none" stroke="${TEXT}" stroke-width="${i === 0 ? 2.8 : 2}" stroke-opacity="${0.45 + 0.55 * s}" stroke-linecap="round"/>`
        + tx(ende[0] + 6, ende[1] + 4, i === 0 ? t('unten', 'foot') : i === n - 1 ? t('oben', 'head') : '', 'kp-rr-s', 'start');
    }).join('');
    return ln(mx, 30, mx, 205, GRAU, 1, ' stroke-dasharray="4 4"') + `<circle cx="${mx}" cy="${my}" r="4.5" fill="${RIGG}"/>`
      + schnitte + tx(ox + 150, 20, titel, 'kp-rr-l') + tx(ox + 150, 36, hinweis, 'kp-rr-s');
  };
  return svg2d(620, 215, t('Twist von oben gesehen: Profilschnitte in vier Höhen, wenig und viel Twist',
    'Twist seen from above: sections at four heights, little and lots of twist'),
  panel(0, 8, 13, t('Wenig Twist', 'Little twist'), t('Achterliek geschlossen: Höhe', 'Leech closed: pointing'))
    + ln(310, 10, 310, 205, 'var(--line)', 1)
    + panel(310, 8, 36, t('Viel Twist', 'Lots of twist'), t('Achterliek offen: oben weniger Druck', 'Leech open: less power aloft'))
    + pfeil2d(m, 24, 60, 44, 96, TEXT, 1.8) + tx(10, 56, 'Wind', 'kp-rr-w', 'start')
    + tx(615, 208, t('Mast oben, Mittschiffslinie gestrichelt', 'Mast at the top, centreline dashed'), 'kp-rr-s', 'end'), m.defs);
}


export function zeichnungBedienung(t: T): string {
  const B = 480;
  const H = 330;
  const iso = new Iso(15, 246, 262);
  const f: Fahrzeug = { ...YACHT, windAus: 125 };
  const r = rigg(f, 8);
  const L = 10;
  const mm = masse(L);
  const heck = imSchiff(f, -L / 2 + 0.2, 0, mm.fb);
  const traveller: [V3, V3] = [imSchiff(f, -L * 0.3, -mm.B * 0.45, mm.fb + 0.1), imSchiff(f, -L * 0.3, mm.B * 0.45, mm.fb + 0.1)];
  const wagen = imSchiff(f, -L * 0.3, mm.B * 0.12, mm.fb + 0.1);
  const schotPunkt = zwischen(r.baumFuss, r.baumEnde, 0.82);
  const nieder: [V3, V3] = [zwischen(r.baumFuss, r.baumEnde, 0.28), imSchiff(f, mm.mast, 0, mm.fb + 0.25)];
  const hole = imSchiff(f, L * 0.02, mm.B * 0.36, mm.fb + 0.05);
  const cunning = imSchiff(f, mm.mast, 0, mm.zBaum + 0.45);
  const segel = segelFlaeche(iso, [r.hals, r.kopfVor, r.schothornVor], false, 0.2) + strich(iso, r.mastFuss, r.mastTop, RIGG, 1.8)
    + strich(iso, r.baumFuss, r.baumEnde, RIGG, 1.8) + segelFlaeche(iso, [r.baumFuss, r.mastTop, r.baumEnde], false, 0.24);
  const leine = (a: V3, b: V3, farbe = AMBER) => strich(iso, a, b, farbe, 1.8);
  
  
  const anker: { p: V3; text: string; rechts: boolean }[] = [
    { p: r.mastTop, text: t('Fall', 'Halyard'), rechts: false },
    { p: zwischen(r.mastTop, heck, 0.4), text: t('Achterstag', 'Backstay'), rechts: false },
    { p: r.baumEnde, text: t('Unterliekstrecker', 'Outhaul'), rechts: false },
    { p: zwischen(schotPunkt, wagen, 0.5), text: t('Großschot', 'Mainsheet'), rechts: false },
    { p: traveller[0], text: 'Traveller', rechts: false },
    { p: zwischen(nieder[0], nieder[1], 0.5), text: t('Baumniederholer', 'Boom vang'), rechts: false },
    { p: cunning, text: 'Cunningham', rechts: true },
    { p: zwischen(r.hals, r.kopfVor, 0.55), text: t('Vorstag', 'Forestay'), rechts: true },
    { p: zwischen(r.schothornVor, hole, 0.5), text: t('Vorschot', 'Jib sheet'), rechts: true },
    { p: hole, text: t('Holepunkt', 'Jib lead'), rechts: true },
  ];
  const spalte = (rechts: boolean) => {
    const liste = anker.filter((a) => a.rechts === rechts).map((a) => ({ ...a, xy: iso.p(a.p[0], a.p[1], a.p[2]) }))
      .sort((a, b) => a.xy[1] - b.xy[1]);
    let frei = 16;
    return liste.map((a) => {
      const y = Math.max(frei, a.xy[1]);
      frei = y + 19;
      const xl = rechts ? B - 96 : 128;
      return ln(a.xy[0], a.xy[1], xl, y - 4, GRAU, 0.9) + `<circle cx="${k(a.xy[0])}" cy="${k(a.xy[1])}" r="2.6" fill="${AMBER}"/>`
        + tx(rechts ? xl + 4 : xl - 4, y, a.text, 'kp-rr-l kp-l-h', rechts ? 'start' : 'end');
    }).join('');
  };
  const inhalt = wasser(iso, -7, 7, -5, 5) + raster(iso, -7, 7, 3.5) + rumpf(iso, f) + segel
    + leine(r.mastTop, heck, GRAU) + leine(r.hals, r.kopfVor, GRAU)
    + strich(iso, traveller[0], traveller[1], TEXT, 3) + leine(schotPunkt, wagen) + leine(nieder[0], nieder[1]) + leine(r.schothornVor, hole)
    + spalte(false) + spalte(true);
  return isoSvg(B, H, t('Bedienelemente an Großsegel und Vorsegel', 'Controls on mainsail and headsail'), inhalt, '', 'kp-iso');
}


export function zeichnungHolepunkt(t: T): string {
  const panel = (ox: number, lage: 'vorn' | 'gut' | 'achtern') => {
    const tack: P2 = [ox + 178, 186];
    const kopf: P2 = [ox + 82, 44];
    const schothorn: P2 = [ox + 46, 172];
    const holeX = lage === 'vorn' ? ox + 40 : lage === 'gut' ? ox + 27 : ox + 12;
    const hole: P2 = [holeX, 196];
    
    const fuss = lage === 'vorn' ? 20 : lage === 'gut' ? 9 : 2;
    const leech = lage === 'vorn' ? -3 : lage === 'gut' ? 6 : 20;
    const mitte = (a: P2, b: P2, aus: number, nx: number, ny: number): P2 => [(a[0] + b[0]) / 2 + nx * aus, (a[1] + b[1]) / 2 + ny * aus];
    const fussC = mitte(tack, schothorn, fuss, 0, 1);
    const lx = schothorn[0] - kopf[0];
    const ly = schothorn[1] - kopf[1];
    const ll = Math.hypot(lx, ly);
    const leechC = mitte(kopf, schothorn, leech, -ly / ll, lx / ll);
    const segel = `<path d="M${tack[0]} ${tack[1]} L${kopf[0]} ${kopf[1]} Q${k(leechC[0])} ${k(leechC[1])} ${schothorn[0]} ${schothorn[1]} `
      + `Q${k(fussC[0])} ${k(fussC[1])} ${tack[0]} ${tack[1]} Z" fill="var(--text)" fill-opacity=".16" stroke="${TEXT}" stroke-width="1.6"/>`;
    
    const dx = schothorn[0] - hole[0];
    const dy = schothorn[1] - hole[1];
    const vx = tack[0] - kopf[0];
    const vy = tack[1] - kopf[1];
    const den = dx * vy - dy * vx;
    const s = ((kopf[0] - hole[0]) * vy - (kopf[1] - hole[1]) * vx) / den;
    const treff: P2 = [hole[0] + dx * s, hole[1] + dy * s];
    const titel = lage === 'vorn' ? t('Holepunkt vorn', 'Lead forward') : lage === 'gut' ? t('richtig', 'right') : t('Holepunkt achtern', 'Lead aft');
    const hinweis = lage === 'vorn' ? t('Achterliek dicht, Unterliek bauchig', 'leech tight, foot full')
      : lage === 'gut' ? t('Zug gleichmäßig verteilt', 'load evenly spread') : t('Achterliek offen, Unterliek flach', 'leech open, foot flat');
    return ln(ox + 14, 196, ox + 196, 196, GRAU, 2) + segel
      + ln(hole[0], hole[1], schothorn[0], schothorn[1], AMBER, 2) + ln(schothorn[0], schothorn[1], treff[0], treff[1], AMBER, 1, ' stroke-dasharray="3 3"')
      + `<circle cx="${hole[0]}" cy="${hole[1]}" r="4" fill="${AMBER}"/><circle cx="${k(treff[0])}" cy="${k(treff[1])}" r="2.6" fill="${AMBER}"/>`
      + tx(ox + 103, 20, titel, 'kp-rr-l') + tx(ox + 103, 222, hinweis, 'kp-rr-s');
  };
  return svg2d(620, 232, t('Holepunkt der Vorschot: vorn, richtig, achtern', 'Jib lead: forward, right, aft'),
    panel(0, 'vorn') + ln(206, 10, 206, 225, 'var(--line)', 1) + panel(207, 'gut') + ln(413, 10, 413, 225, 'var(--line)', 1) + panel(414, 'achtern'));
}


export function zeichnungTelltales(t: T): string {
  const panel = (ox: number, art: 'gut' | 'luv' | 'lee', titel: string, tun: string) => {
    const vorliek = ln(ox + 40, 30, ox + 70, 160, TEXT, 3);
    const tuch = `<path d="M${ox + 40} 30 L${ox + 70} 160 L${ox + 175} 160 Z" fill="var(--text)" fill-opacity=".14"/>`;
    const faden = (y: number) => {
      const x = ox + 40 + ((y - 30) / 130) * 30 + 16;
      const luv = art === 'luv' ? `M${x} ${y} q8 -10 4 -20 q-4 -6 4 -12` : `M${x} ${y} q14 -2 28 0`;
      const lee = art === 'lee' ? `M${x} ${y} q6 8 2 18 q-3 6 3 12` : `M${x} ${y + 1} q14 3 28 1`;
      return `<path d="${luv}" fill="none" stroke="${TEAL}" stroke-width="2"/><path d="${lee}" fill="none" stroke="${AMBER}" stroke-width="2" stroke-dasharray="4 2"/>`
        + `<circle cx="${k(x)}" cy="${y}" r="2.2" fill="${TEXT}"/>`;
    };
    return tuch + vorliek + faden(70) + faden(110) + tx(ox + 103, 184, titel, 'kp-rr-l') + tx(ox + 103, 200, tun, 'kp-rr-s');
  };
  return svg2d(620, 210, t('Telltales am Vorliek: beide waagerecht, Luvfaden steigt, Leefaden steigt',
    'Luff telltales: both streaming, windward one lifting, leeward one lifting'),
  panel(0, 'gut', t('beide wehen aus', 'both stream aft'), t('richtig getrimmt', 'trimmed right'))
    + panel(207, 'luv', t('Luvfaden steigt', 'windward lifts'), t('dichter holen oder abfallen', 'trim in or bear away'))
    + panel(414, 'lee', t('Leefaden steigt', 'leeward lifts'), t('fieren oder anluven', 'ease or luff up'))
    + tx(8, 18, t('durchgezogen: Luvfaden · gestrichelt: Leefaden', 'solid: windward telltale · dashed: leeward telltale'), 'kp-rr-s', 'start'));
}


export function zeichnungKurs(t: T, windwinkel: number, titel: string): string {
  const m = marker(TEXT);
  const iso = new Iso(11, 150, 168);
  const kurs = 90;
  const windAus = kurs + windwinkel;
  const f: Fahrzeug = { x: 0, y: 0, kurs, art: 'segel', windAus, L: 10, schmetterling: windwinkel >= 170 };
  const [ux, uy] = [Math.sin((windAus * Math.PI) / 180), Math.cos((windAus * Math.PI) / 180)];
  const c: V3 = [-3, -5, 0];
  const a: V3 = [c[0] + ux * 2.2, c[1] + uy * 2.2, 0];
  const b: V3 = [c[0] - ux * 2.2, c[1] - uy * 2.2, 0];
  let extra = '';
  if (windwinkel >= 170) {
    const r = rigg(f);
    const bug = imSchiff(f, 4.8, 0, 1.2);
    const cockpit = imSchiff(f, -2.6, -0.9, 1.2);
    extra = kurve(iso, r.baumEnde, [r.baumEnde[0] + 2, r.baumEnde[1] * 0.4, 1.4], bug, AMBER, 1.6)
      + strich(iso, bug, cockpit, AMBER, 1.2, ' stroke-dasharray="4 3"')
      + beschrift(iso, zwischen(r.baumEnde, bug, 0.5), t('Bullenstander', 'Preventer'), 'kp-rr-s kp-l-h', 'middle', -6);
  }
  const inhalt = wasser(iso, -6, 6, -6, 6) + raster(iso, -6, 6, 3)
    + strich(iso, a, b, TEXT, 2.2, ` marker-end="url(#${m.id(TEXT)})"`) + beschrift(iso, a, 'Wind', 'kp-rr-w kp-l-h', 'middle', -8)
    + fahrzeug(iso, f) + extra;
  return isoSvg(300, 244, titel, inhalt, m.defs, 'kp-iso');
}


export function zeichnungVorsegel(t: T): string {
  const m = marker(GRAU);
  const X = (x: number) => 120 + x * 26;
  const Y = (y: number) => 214 - y * 15;
  const T0: P2 = [4, 0];
  const H: P2 = [0.15, 11.2];
  const ul = Math.hypot(H[0] - T0[0], H[1] - T0[1]);
  const u: P2 = [(H[0] - T0[0]) / ul, (H[1] - T0[1]) / ul];
  const n: P2 = [-u[1], u[0]]; 
  const J = T0[0];
  
  const segel = (faktor: number) => {
    const lp = faktor * J;
    const pz = 0.5 - n[1] * lp;
    const s = pz / u[1];
    const P: P2 = [T0[0] + u[0] * s, T0[1] + u[1] * s];
    const C: P2 = [P[0] + n[0] * lp, P[1] + n[1] * lp];
    return { P, C };
  };
  const g = segel(1.55);
  const f = segel(1.0);
  const dreieck = (C: P2, farbe: string, deckung: number) => `<polygon points="${k(X(T0[0]))},${k(Y(T0[1]))} ${k(X(H[0]))},${k(Y(H[1]))} ${k(X(C[0]))},${k(Y(C[1]))}" `
    + `fill="${farbe}" fill-opacity="${deckung}" stroke="${farbe}" stroke-width="1.2"/>`;
  const mass = (x1: number, y1: number, x2: number, y2: number) => ln(x1, y1, x2, y2, GRAU, 1, ` marker-start="url(#${m.id(GRAU)})" marker-end="url(#${m.id(GRAU)})"`);
  const tabelle = [
    [t('Genua 1', 'No. 1 genoa'), t('um 155 %', 'about 155%')],
    [t('Genua 2', 'No. 2 genoa'), t('125–140 %', '125–140%')],
    [t('Fock', 'Working jib'), t('bis 100 %', 'up to 100%')],
    [t('Sturmfock', 'Storm jib'), t('höchstens 5 % von I²', 'at most 5% of I²')],
  ].map(([a, b], i) => tx(390, 70 + i * 22, a!, 'kp-rr-l', 'start') + tx(608, 70 + i * 22, b!, 'kp-rr-l', 'end')).join('');
  return svg2d(620, 250, t('Vorsegelmaße: J, I, LP und Überlappung LP/J', 'Headsail measurements: J, I, LP and overlap LP/J'),
    ln(X(-4.2), Y(0), X(5.4), Y(0), GRAU, 2) + ln(X(0), Y(0), X(0), Y(12.6), RIGG, 3)
    + dreieck(g.C, 'var(--text)', 0.12) + dreieck(f.C, TEAL, 0.24)
    + ln(X(g.P[0]), Y(g.P[1]), X(g.C[0]), Y(g.C[1]), AMBER, 1.8, ' stroke-dasharray="5 3"')
    + tx(X((g.P[0] + g.C[0]) / 2) - 6, Y((g.P[1] + g.C[1]) / 2) - 6, 'LP', 'kp-rr-l kp-rr-amber kp-l-h', 'end')
    + tx(X(g.C[0]), Y(g.C[1]) + 18, t('Genua', 'Genoa'), 'kp-rr-s') + tx(X(f.C[0]) + 4, Y(f.C[1]) - 8, t('Fock', 'Jib'), 'kp-rr-s', 'start')
    + mass(X(0), Y(-1), X(J), Y(-1)) + tx(X(J / 2), Y(-1) + 16, 'J', 'kp-rr-l')
    + mass(X(5.0), Y(0), X(5.0), Y(H[1])) + tx(X(5.0) + 8, Y(H[1] / 2), 'I', 'kp-rr-l', 'start')
    + tx(390, 40, t('Überlappung LP/J', 'Overlap LP/J'), 'kp-rr-l', 'start') + tabelle
    + tx(390, 176, t('J: Mastvorderkante bis Vorstag an Deck', 'J: front of mast to forestay at deck'), 'kp-rr-s', 'start')
    + tx(390, 192, t('I: Höhe des Vorstags am Mast', 'I: height of the forestay on the mast'), 'kp-rr-s', 'start')
    + tx(390, 208, t('LP: Lot vom Schothorn auf das Vorliek', 'LP: perpendicular from clew to luff'), 'kp-rr-s', 'start'), m.defs);
}
