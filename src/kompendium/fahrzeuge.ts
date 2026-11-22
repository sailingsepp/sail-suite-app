import { LICHT, type Lichtfarbe } from './farben';
import {
  Iso, rumpfGrundriss, RUMPF_SEITE, RUMPF_SEITE_DUNKEL, RUMPF_DECK, AUFBAU, AUFBAU_DECK,
} from './iso';
import { esc, k, aufKreis } from './svg';
import type { Sprache } from '@/core/types';

const SEE = 'var(--panel-2)';
const MAST = 'var(--muted)';
const LEINE = 'var(--muted)';
const KIELWASSER = 'var(--muted)';

type Szene = (iso: Iso) => string;

function see(iso: Iso, x0: number, x1: number, y0: number, y1: number): string {
  return iso.pfad([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], SEE, 'none', 0);
}

function kielwasser(iso: Iso, x0: number, x1: number): string {
  const o: string[] = [];
  for (const dy of [-2.4, 2.4]) o.push(iso.linie([x0, dy * 0.5, 0], [x0 - 3.5, dy * 1.6, 0], KIELWASSER, 1, ' stroke-opacity=".45"'));
  o.push(iso.linie([x1 + 0.2, 0, 0], [x1 + 1.4, -1.6, 0], KIELWASSER, 1, ' stroke-opacity=".45"'));
  o.push(iso.linie([x1 + 0.2, 0, 0], [x1 + 1.4, 1.6, 0], KIELWASSER, 1, ' stroke-opacity=".45"'));
  return o.join('');
}

function rumpf(iso: Iso, L: number, B: number, fb: number, x0 = 0, y0 = 0, rechteckig = false): string {
  const o: [number, number][] = rechteckig
    ? [[x0, y0 + B / 2], [x0, y0 - B / 2], [x0 + L, y0 - B / 2], [x0 + L, y0 + B / 2]]
    : rumpfGrundriss(L, B).map(([a, b]) => [x0 + a, y0 + b]);
  return iso.prisma(o, 0, fb, RUMPF_SEITE, RUMPF_DECK, RUMPF_SEITE_DUNKEL);
}

function aufbau(iso: Iso, x0: number, x1: number, h: number, z0: number, z1: number): string {
  return iso.prisma([[x0, h], [x0, -h], [x1, -h], [x1, h]], z0, z1, AUFBAU, AUFBAU_DECK);
}

const mast = (iso: Iso, x: number, y: number, z0: number, z1: number) => iso.linie([x, y, z0], [x, y, z1], MAST, 2.2);
const L = (iso: Iso, x: number, y: number, z: number, c: Lichtfarbe, r = 5) => iso.licht(x, y, z, c, r);

function rhombus(iso: Iso, x: number, y: number, z: number): string {
  const [cx, cy] = iso.p(x, y, z);
  const s = 9;
  return `<polygon points="${k(cx)},${k(cy - s)} ${k(cx + s * 0.7)},${k(cy)} ${k(cx)},${k(cy + s)} ${k(cx - s * 0.7)},${k(cy)}" `
    + `fill="var(--bg)" stroke="${MAST}" stroke-width="1.2"/>`;
}

function segel(iso: Iso, xm: number, top: number, baumEnde: number, fb: number): string {
  return iso.pfad([[xm, 0, fb + 0.6], [xm, 0, top - 0.6], [baumEnde, 0, fb + 0.7]], 'var(--text)', 'var(--bg)', 0.6, ' fill-opacity=".38"')
    + iso.pfad([[xm + 3.2, 0, fb + 0.2], [xm + 0.1, 0, top - 1.6], [xm + 0.2, 0, fb + 0.6]], 'var(--text)', 'var(--bg)', 0.6, ' fill-opacity=".30"');
}

const SZENEN: Record<string, { fn: Szene; s: number; ox: number; oy: number }> = {
  power: { s: 17, ox: 118, oy: 128, fn: (iso) => [
    see(iso, -4, 16, -5, 5), kielwasser(iso, 0, 12), rumpf(iso, 12, 3.6, 1.2), aufbau(iso, 1.4, 4.6, 1.3, 1.2, 2.8),
    mast(iso, 9.2, 0, 1.2, 4.6), mast(iso, 3.2, 0, 2.8, 6.4),
    L(iso, 0, 0, 1.5, 'W'), L(iso, 4.4, 1.55, 2.5, 'R'), L(iso, 4.4, -1.55, 2.5, 'G'), L(iso, 9.2, 0, 4.6, 'W'), L(iso, 3.2, 0, 6.4, 'W'),
  ].join('') },
  small_power: { s: 22, ox: 150, oy: 150, fn: (iso) => [
    see(iso, -3, 10, -4, 4), kielwasser(iso, 0, 7), rumpf(iso, 7, 2.6, 0.9), aufbau(iso, 2.0, 4.2, 0.9, 0.9, 1.9),
    mast(iso, 2.6, 0, 1.9, 3.6),
    L(iso, 5.6, 0.95, 1.05, 'R', 4), L(iso, 5.6, -0.95, 1.05, 'G', 4), L(iso, 2.6, 0, 3.6, 'W', 4.5),
  ].join('') },
  tow: { s: 11.5, ox: 185, oy: 118, fn: (iso) => [
    see(iso, -13, 17, -5, 5),
    rumpf(iso, 8, 3.0, 0.9, -12, 0, true), mast(iso, -6.2, 0, 0.9, 2.6), rhombus(iso, -6.2, 0, 2.9),
    L(iso, -12, 0, 1.1, 'W', 4), L(iso, -4.3, 1.5, 1.1, 'R', 4), L(iso, -4.3, -1.5, 1.1, 'G', 4),
    iso.linie([-4, 0, 0.6], [6.2, 0, 1.0], LEINE, 1.1, ' stroke-dasharray="3 2"'),
    rumpf(iso, 8, 3.0, 1.1, 6), aufbau(iso, 9.6, 12.0, 1.0, 1.1, 2.5),
    mast(iso, 12.6, 0, 1.1, 5.6), mast(iso, 7.0, 0, 1.1, 2.6), rhombus(iso, 12.6, 0.0, 6.0),
    L(iso, 6.2, 0, 1.4, 'W', 4), L(iso, 6.2, 0, 2.1, 'Y', 4), L(iso, 11.8, 1.0, 2.3, 'R', 4), L(iso, 11.8, -1.0, 2.3, 'G', 4),
    L(iso, 12.6, 0, 3.6, 'W', 4), L(iso, 12.6, 0, 4.5, 'W', 4), L(iso, 12.6, 0, 5.4, 'W', 4),
  ].join('') },
  sail_std: { s: 17, ox: 150, oy: 142, fn: (iso) => [
    see(iso, -3, 13, -4, 4), kielwasser(iso, 0, 10), rumpf(iso, 10, 3.0, 0.9), mast(iso, 6.3, 0, 0.9, 10.2),
    segel(iso, 6.3, 10.2, 1.2, 0.9),
    L(iso, 0, 0, 1.1, 'W', 4.5), L(iso, 8.9, 1.05, 1.0, 'R', 4.5), L(iso, 8.9, -1.05, 1.0, 'G', 4.5),
    L(iso, 6.3, 0, 9.9, 'R', 4.5), L(iso, 6.3, 0, 9.1, 'G', 4.5),
  ].join('') },
  sail_tri: { s: 17, ox: 150, oy: 142, fn: (iso) => [
    see(iso, -3, 13, -4, 4), kielwasser(iso, 0, 10), rumpf(iso, 10, 3.0, 0.9), mast(iso, 6.3, 0, 0.9, 10.2),
    segel(iso, 6.3, 10.2, 1.2, 0.9),
    `<g>${iso.licht(6.3, 0.15, 10.35, 'R', 4)}${iso.licht(6.3, -0.15, 10.35, 'G', 4)}${iso.licht(6.15, 0, 10.35, 'W', 3.2)}</g>`,
  ].join('') },
  trawler: { s: 17, ox: 135, oy: 130, fn: (iso) => [
    see(iso, -4, 15, -5, 5), kielwasser(iso, 0, 11), rumpf(iso, 11, 3.4, 1.1), aufbau(iso, 6.0, 8.6, 1.1, 1.1, 2.6),
    mast(iso, 9.6, 0, 1.1, 5.0), mast(iso, 3.0, 0, 1.1, 6.6),
    iso.linie([0, 0.5, 0.8], [-3.8, 1.2, 0], LEINE, 1, ' stroke-dasharray="3 2"'),
    iso.linie([0, -0.5, 0.8], [-3.8, -1.2, 0], LEINE, 1, ' stroke-dasharray="3 2"'),
    L(iso, 9.6, 0, 5.0, 'G'), L(iso, 9.6, 0, 4.1, 'W'), L(iso, 3.0, 0, 6.6, 'W'),
    L(iso, 8.4, 1.1, 2.4, 'R', 4), L(iso, 8.4, -1.1, 2.4, 'G', 4), L(iso, 0, 0, 1.4, 'W', 4),
  ].join('') },
  fisher: { s: 16, ox: 175, oy: 118, fn: (iso) => [
    see(iso, -9, 13, -6, 5), kielwasser(iso, 0, 9), rumpf(iso, 9, 3.0, 1.0), aufbau(iso, 2.0, 4.2, 1.0, 1.0, 2.3),
    mast(iso, 6.6, 0, 1.0, 4.8),

    iso.linie([1.5, -1.4, 1.0], [-6.5, -4.6, 0], LEINE, 1, ' stroke-dasharray="3 2"'),
    mast(iso, 3.0, -1.0, 1.0, 2.9),
    L(iso, 6.6, 0, 4.8, 'R'), L(iso, 6.6, 0, 3.9, 'W'), L(iso, 3.0, -1.0, 2.9, 'W', 4),
    L(iso, 7.6, 1.0, 1.2, 'R', 4), L(iso, 7.6, -1.0, 1.2, 'G', 4), L(iso, 0, 0, 1.3, 'W', 4),
  ].join('') },
  nuc: { s: 17, ox: 118, oy: 135, fn: (iso) => [
    see(iso, -4, 16, -5, 5), kielwasser(iso, 0, 12), rumpf(iso, 12, 3.6, 1.2), aufbau(iso, 1.4, 4.6, 1.3, 1.2, 2.8),
    mast(iso, 9.2, 0, 1.2, 5.6),
    L(iso, 9.2, 0, 5.6, 'R'), L(iso, 9.2, 0, 4.7, 'R'),
    L(iso, 0, 0, 1.5, 'W', 4), L(iso, 4.4, 1.55, 2.5, 'R', 4), L(iso, 4.4, -1.55, 2.5, 'G', 4),
  ].join('') },
  ram: { s: 17, ox: 118, oy: 140, fn: (iso) => [
    see(iso, -4, 16, -5, 5), kielwasser(iso, 0, 12), rumpf(iso, 12, 3.6, 1.2), aufbau(iso, 1.4, 4.6, 1.3, 1.2, 2.8),
    mast(iso, 9.2, 0, 1.2, 4.0), mast(iso, 3.2, 0, 2.8, 7.4),
    L(iso, 3.2, 0, 7.4, 'R'), L(iso, 3.2, 0, 6.5, 'W'), L(iso, 3.2, 0, 5.6, 'R'),
    L(iso, 9.2, 0, 4.0, 'W'), L(iso, 0, 0, 1.5, 'W', 4), L(iso, 4.4, 1.55, 2.5, 'R', 4), L(iso, 4.4, -1.55, 2.5, 'G', 4),
  ].join('') },
  diver: { s: 22, ox: 160, oy: 150, fn: (iso) => {
    const o = [see(iso, -3, 10, -4, 4), rumpf(iso, 7, 2.6, 0.9), mast(iso, 4.0, 0, 0.9, 5.0),
      L(iso, 4.0, 0, 5.0, 'R', 4.5), L(iso, 4.0, 0, 4.2, 'W', 4.5), L(iso, 4.0, 0, 3.4, 'R', 4.5)];

    ([[-1.5, -2.8], [-1.9, -3.1], [-1.3, -3.3]] as const).forEach(([dx, dy], i) => {
      const [cx, cy] = iso.p(dx, dy, 0);
      o.push(`<circle cx="${k(cx)}" cy="${k(cy)}" r="${k(2.2 - i * 0.4)}" fill="none" stroke="var(--teal)" stroke-width=".8"/>`);
    });
    return o.join('');
  } },
  pilot: { s: 19, ox: 140, oy: 140, fn: (iso) => [
    see(iso, -3, 12, -4, 4), kielwasser(iso, 0, 9), rumpf(iso, 9, 3.0, 1.0), aufbau(iso, 3.0, 5.6, 1.0, 1.0, 2.4),
    mast(iso, 4.3, 0, 2.4, 5.6),
    L(iso, 4.3, 0, 5.6, 'W', 4.5), L(iso, 4.3, 0, 4.8, 'R', 4.5),
    L(iso, 5.4, 1.0, 2.2, 'R', 4), L(iso, 5.4, -1.0, 2.2, 'G', 4), L(iso, 0, 0, 1.3, 'W', 4),
  ].join('') },
  mines: { s: 17, ox: 118, oy: 135, fn: (iso) => [
    see(iso, -4, 16, -5, 5), kielwasser(iso, 0, 12), rumpf(iso, 12, 3.6, 1.2), aufbau(iso, 3.0, 6.0, 1.3, 1.2, 2.8),
    mast(iso, 8.8, 0, 1.2, 6.2), mast(iso, 4.0, 0, 2.8, 7.2),
    iso.linie([8.8, -1.7, 4.6], [8.8, 1.7, 4.6], MAST, 1.6),
    L(iso, 8.8, 0, 6.2, 'G'), L(iso, 8.8, -1.7, 4.6, 'G'), L(iso, 8.8, 1.7, 4.6, 'G'),
    L(iso, 8.8, 0, 5.4, 'W', 4), L(iso, 4.0, 0, 7.2, 'W', 4),
    L(iso, 5.8, 1.3, 2.6, 'R', 4), L(iso, 5.8, -1.3, 2.6, 'G', 4), L(iso, 0, 0, 1.5, 'W', 4),
  ].join('') },
  draught: { s: 14.5, ox: 118, oy: 135, fn: (iso) => [
    see(iso, -4, 18, -5, 5), kielwasser(iso, 0, 14), rumpf(iso, 14, 4.0, 1.6), aufbau(iso, 0.8, 3.6, 1.6, 1.6, 3.6),
    mast(iso, 11.0, 0, 1.6, 5.0), mast(iso, 2.2, 0, 3.6, 8.2),
    L(iso, 11.0, 0, 5.0, 'W', 4.5), L(iso, 2.2, 0, 8.2, 'W', 4.5),
    L(iso, 2.2, 0, 7.3, 'R', 4), L(iso, 2.2, 0, 6.5, 'R', 4), L(iso, 2.2, 0, 5.7, 'R', 4),
    L(iso, 3.4, 1.6, 3.4, 'R', 4), L(iso, 3.4, -1.6, 3.4, 'G', 4), L(iso, 0, 0, 1.9, 'W', 4),
  ].join('') },
  police: { s: 22, ox: 150, oy: 150, fn: (iso) => [
    see(iso, -3, 10, -4, 4), kielwasser(iso, 0, 7), rumpf(iso, 7, 2.6, 0.9), aufbau(iso, 2.0, 4.2, 0.9, 0.9, 1.9),
    mast(iso, 2.6, 0, 1.9, 3.8),
    L(iso, 2.6, 0, 3.8, 'W', 4.5), L(iso, 2.6, 0, 3.1, 'Bu', 5),
    L(iso, 5.6, 0.95, 1.05, 'R', 4), L(iso, 5.6, -0.95, 1.05, 'G', 4),
  ].join('') },
  anchor: { s: 17, ox: 118, oy: 125, fn: (iso) => [
    see(iso, -4, 16, -5, 5),
    iso.linie([12, 0, 0.6], [15, 0.6, 0], LEINE, 1.1),
    rumpf(iso, 12, 3.6, 1.2), aufbau(iso, 1.4, 4.6, 1.3, 1.2, 2.8),
    mast(iso, 10.4, 0, 1.2, 4.2), mast(iso, 0.4, 0, 1.2, 3.2),
    L(iso, 10.4, 0, 4.2, 'W'), L(iso, 0.4, 0, 3.2, 'W'),
  ].join('') },
  aground: { s: 17, ox: 118, oy: 130, fn: (iso) => [
    see(iso, -4, 16, -5, 5),

    iso.pfad([[6, -4, 0], [16, -4, 0], [16, 3, 0], [8, 3, 0]], 'var(--gelb)', 'none', 0, ' opacity=".28"'),
    rumpf(iso, 12, 3.6, 1.2), aufbau(iso, 1.4, 4.6, 1.3, 1.2, 2.8),
    mast(iso, 10.4, 0, 1.2, 4.2), mast(iso, 3.2, 0, 2.8, 6.4), mast(iso, 0.4, 0, 1.2, 3.2),
    L(iso, 10.4, 0, 4.2, 'W'), L(iso, 0.4, 0, 3.2, 'W'), L(iso, 3.2, 0, 6.4, 'R'), L(iso, 3.2, 0, 5.5, 'R'),
  ].join('') },
};

export const SZENEN_SCHLUESSEL = Object.keys(SZENEN);

export function szene(schluessel: string, label: string): string {
  const s = SZENEN[schluessel];
  if (!s) return '';
  const iso = new Iso(s.s, s.ox, s.oy);
  return `<svg class="kp-iso kp-fach" viewBox="0 0 420 250" role="img" aria-label="${esc(label)}">`
    + `<rect width="420" height="250" fill="var(--bg)"/>${s.fn(iso)}</svg>`;
}

export function horizontboegen(sprache: Sprache): string {
  const T = sprache === 'en'
    ? ['Masthead light 225°', 'Sternlight 135°', '22.5° abaft', 'the beam', '112.5°', 'Arcs of visibility of the navigation lights, plan view']
    : ['Topplicht 225°', 'Hecklicht 135°', '22,5° achterlicher', 'als querab', '112,5°', 'Horizontbögen der Positionslichter in Draufsicht'];
  const cx = 150;
  const cy = 150;
  const bogen = (a0: number, a1: number, r: number, farbe: string, deckung: number): string => {
    const [x0, y0] = aufKreis(cx, cy, r, a0);
    const [x1, y1] = aufKreis(cx, cy, r, a1);
    const gross = ((a1 - a0) % 360 + 360) % 360 > 180 ? 1 : 0;
    return `<path d="M${cx} ${cy} L${k(x0)} ${k(y0)} A${r} ${r} 0 ${gross} 1 ${k(x1)} ${k(y1)} Z" fill="${farbe}" `
      + `fill-opacity="${deckung}" stroke="${farbe}" stroke-opacity=".9" stroke-width="1.2"/>`;
  };
  const marke = (a: number, r: number, t: string): string => {
    const [x, y] = aufKreis(cx, cy, r, a);
    return `<text x="${k(x)}" y="${k(y)}" class="kp-sec-l" text-anchor="middle">${t}</text>`;
  };
  const o = [
    '<rect width="300" height="300" fill="var(--bg)"/>',
    bogen(-112.5, 112.5, 132, LICHT.W, 0.10),
    bogen(112.5, 247.5, 96, LICHT.W, 0.22),
    bogen(0, 112.5, 96, LICHT.G, 0.28),
    bogen(-112.5, 0, 96, LICHT.R, 0.28),
    `<path d="M150 118 L162 136 L162 178 L138 178 L138 136 Z" fill="${RUMPF_DECK}" stroke="var(--text)" stroke-width="1"/>`,
    marke(0, 140, T[0]!), marke(58, 70, T[4]!), marke(-58, 70, T[4]!), marke(180, 84, T[1]!),
    `<text x="294" y="204" class="kp-sec-l" text-anchor="end">${T[2]}</text>`,
    `<text x="294" y="218" class="kp-sec-l" text-anchor="end">${T[3]}</text>`,
    '<line x1="150" y1="150" x2="290" y2="150" stroke="var(--muted)" stroke-dasharray="2 3" stroke-width=".8"/>',
    '<line x1="150" y1="150" x2="10" y2="150" stroke="var(--muted)" stroke-dasharray="2 3" stroke-width=".8"/>',
  ];
  return `<svg class="kp-iso kp-sektoren kp-fach" viewBox="0 0 300 300" role="img" aria-label="${esc(T[5]!)}">${o.join('')}</svg>`;
}
