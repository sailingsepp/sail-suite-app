import { FLAGGE } from './farben';
import { neueId, poly, rect, esc, type Punkt } from './svg';

const { rot: R, blau: B, gelb: Y, schwarz: K, weiss: W } = FLAGGE;

const RECHTECK: Punkt[] = [[0, 0], [60, 0], [60, 40], [0, 40]];
const DOPPELSTANDER: Punkt[] = [[0, 0], [60, 0], [44, 20], [60, 40], [0, 40]];
const WIMPEL: Punkt[] = [[0, 0], [60, 13], [60, 27], [0, 40]];
const DREIECK: Punkt[] = [[0, 0], [60, 20], [0, 40]];

const kreis = (cx: number, cy: number, r: number, f: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"/>`;
const schraeg = (f: string) => `<path d="M0 0L60 40M60 0L0 40" stroke="${f}" stroke-width="8"/>`;

function inhalt(code: string): string {
  const c: string[] = [];
  switch (code) {
    case 'A': c.push(rect(0, 0, 30, 40, W), rect(30, 0, 30, 40, B)); break;
    case 'B': c.push(rect(0, 0, 60, 40, R)); break;
    case 'C': [B, W, R, W, B].forEach((f, i) => c.push(rect(0, i * 8, 60, 8, f))); break;
    case 'D': c.push(rect(0, 0, 60, 40, Y), rect(0, 10, 60, 20, B)); break;
    case 'E': c.push(rect(0, 0, 60, 20, B), rect(0, 20, 60, 20, R)); break;
    case 'F': c.push(rect(0, 0, 60, 40, W), poly([[30, 0], [60, 20], [30, 40], [0, 20]], R)); break;
    case 'G': for (let i = 0; i < 6; i++) c.push(rect(i * 10, 0, 10, 40, i % 2 === 0 ? Y : B)); break;
    case 'H': c.push(rect(0, 0, 30, 40, W), rect(30, 0, 30, 40, R)); break;
    case 'I': c.push(rect(0, 0, 60, 40, Y), kreis(30, 20, 10, K)); break;
    case 'J': c.push(rect(0, 0, 60, 40, B), rect(0, 13.33, 60, 13.34, W)); break;
    case 'K': c.push(rect(0, 0, 30, 40, Y), rect(30, 0, 30, 40, B)); break;
    case 'L': c.push(rect(0, 0, 30, 20, Y), rect(30, 0, 30, 20, K), rect(0, 20, 30, 20, K), rect(30, 20, 30, 20, Y)); break;
    case 'M': c.push(rect(0, 0, 60, 40, B), schraeg(W)); break;
    case 'N':
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.push(rect(i * 15, j * 10, 15, 10, (i + j) % 2 === 0 ? B : W));
      break;
    case 'O': c.push(poly([[0, 0], [60, 40], [0, 40]], Y), poly([[0, 0], [60, 0], [60, 40]], R)); break;
    case 'P': c.push(rect(0, 0, 60, 40, B), rect(20, 13.33, 20, 13.34, W)); break;
    case 'Q': c.push(rect(0, 0, 60, 40, Y)); break;
    case 'R': c.push(rect(0, 0, 60, 40, R), rect(26, 0, 8, 40, Y), rect(0, 16, 60, 8, Y)); break;
    case 'S': c.push(rect(0, 0, 60, 40, W), rect(20, 13.33, 20, 13.34, B)); break;
    case 'T': c.push(rect(0, 0, 20, 40, R), rect(20, 0, 20, 40, W), rect(40, 0, 20, 40, B)); break;
    case 'U': c.push(rect(0, 0, 30, 20, R), rect(30, 0, 30, 20, W), rect(0, 20, 30, 20, W), rect(30, 20, 30, 20, R)); break;
    case 'V': c.push(rect(0, 0, 60, 40, W), schraeg(R)); break;
    case 'W': c.push(rect(0, 0, 60, 40, B), rect(10, 6.67, 40, 26.66, W), rect(20, 13.33, 20, 13.34, R)); break;
    case 'X': c.push(rect(0, 0, 60, 40, W), rect(26, 0, 8, 40, B), rect(0, 16, 60, 8, B)); break;
    case 'Y':
      for (let i = 0; i < 11; i++) {
        const c1 = i * 10;
        const c2 = c1 + 10;
        c.push(poly([[c1, 0], [c2, 0], [c2 - 40, 40], [c1 - 40, 40]], i % 2 === 0 ? Y : R));
      }
      break;
    case 'Z': c.push(poly([[0, 0], [60, 0], [30, 20]], Y), poly([[0, 0], [30, 20], [0, 40]], K),
      poly([[0, 40], [30, 20], [60, 40]], R), poly([[60, 0], [60, 40], [30, 20]], B)); break;

    case '1': c.push(rect(0, 0, 60, 40, W), kreis(20, 20, 8, R)); break;
    case '2': c.push(rect(0, 0, 60, 40, B), kreis(20, 20, 8, W)); break;
    case '3': c.push(rect(0, 0, 20, 40, R), rect(20, 0, 20, 40, W), rect(40, 0, 20, 40, B)); break;
    case '4': c.push(rect(0, 0, 60, 40, R), rect(16, 0, 8, 40, W), rect(0, 16, 60, 8, W)); break;
    case '5': c.push(rect(0, 0, 30, 40, Y), rect(30, 0, 30, 40, B)); break;
    case '6': c.push(rect(0, 0, 60, 20, K), rect(0, 20, 60, 20, W)); break;
    case '7': c.push(rect(0, 0, 60, 20, Y), rect(0, 20, 60, 20, R)); break;
    case '8': c.push(rect(0, 0, 60, 40, W), rect(16, 0, 8, 40, R), rect(0, 16, 60, 8, R)); break;
    case '9': c.push(rect(0, 0, 30, 20, W), rect(30, 0, 30, 20, K), rect(0, 20, 30, 20, R), rect(30, 20, 30, 20, Y)); break;
    case '0': c.push(rect(0, 0, 60, 40, Y), rect(20, 0, 20, 40, R)); break;
    case 'ANS': for (let i = 0; i < 5; i++) c.push(rect(i * 12, 0, 12, 40, i % 2 === 0 ? R : W)); break;
    case 'SUB1': c.push(poly(DREIECK, B), poly([[0, 7], [42, 20], [0, 33]], Y)); break;
    case 'SUB2': c.push(rect(0, 0, 30, 40, B), rect(30, 0, 30, 40, W)); break;
    case 'SUB3': c.push(rect(0, 0, 60, 40, W), rect(0, 13.33, 60, 13.34, K)); break;
    default: break;
  }
  return c.join('');
}

function form(code: string): Punkt[] {
  if (code === 'A' || code === 'B') return DOPPELSTANDER;
  if (/^[0-9]$/.test(code) || code === 'ANS') return WIMPEL;
  if (code.startsWith('SUB')) return DREIECK;
  return RECHTECK;
}

export function flaggeEingebettet(code: string, x = 0, y = 0, s = 1): string {
  const id = neueId('fl');
  const punkte = form(code).map(([a, b]) => `${a},${b}`).join(' ');
  return `<g transform="translate(${x},${y}) scale(${s})"><clipPath id="${id}"><polygon points="${punkte}"/></clipPath>`
    + `<g clip-path="url(#${id})">${inhalt(code)}</g>`
    + `<polygon points="${punkte}" fill="none" stroke="var(--muted)" stroke-width="${(1 / s).toFixed(2)}" stroke-linejoin="round"/></g>`;
}

export function flagge(code: string, breite: number, label: string): string {
  return `<svg class="kp-flagge kp-fach" viewBox="-1 -1 62 42" width="${breite}" role="img" aria-label="${esc(label)}">`
    + `${flaggeEingebettet(code)}</svg>`;
}
