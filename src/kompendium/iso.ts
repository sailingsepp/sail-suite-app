import { LICHT, type Lichtfarbe } from './farben';
import { neueId, k } from './svg';

const C30 = Math.cos(Math.PI / 6);
const S30 = 0.5;

export const RUMPF_SEITE = 'color-mix(in srgb, var(--text) 24%, var(--panel))';
export const RUMPF_SEITE_DUNKEL = 'color-mix(in srgb, var(--text) 17%, var(--panel))';
export const RUMPF_DECK = 'color-mix(in srgb, var(--text) 34%, var(--panel))';
export const AUFBAU = 'color-mix(in srgb, var(--text) 44%, var(--panel))';
export const AUFBAU_DECK = 'color-mix(in srgb, var(--text) 50%, var(--panel))';
export const KANTE = 'var(--bg)';

type P3 = readonly [number, number, number];

export class Iso {
  constructor(private s = 14, private ox = 0, private oy = 0) {}

  p(x: number, y: number, z: number): [number, number] {
    return [this.ox + (x + y) * C30 * this.s, this.oy + (x - y) * S30 * this.s - z * this.s];
  }

  pfad(pts: readonly P3[], fill: string, stroke = 'none', sw = 1, extra = ''): string {
    const p = pts.map((q) => this.p(q[0], q[1], q[2]));
    return `<polygon points="${p.map(([a, b]) => `${k(a)},${k(b)}`).join(' ')}" fill="${fill}" stroke="${stroke}" `
      + `stroke-width="${sw}" stroke-linejoin="round"${extra}/>`;
  }

  linie(a: P3, b: P3, stroke: string, sw = 1.4, extra = ''): string {
    const [x1, y1] = this.p(a[0], a[1], a[2]);
    const [x2, y2] = this.p(b[0], b[1], b[2]);
    return `<line x1="${k(x1)}" y1="${k(y1)}" x2="${k(x2)}" y2="${k(y2)}" stroke="${stroke}" stroke-width="${sw}" `
      + `stroke-linecap="round"${extra}/>`;
  }

  prisma(grundriss: readonly (readonly [number, number])[], z0: number, z1: number, seite: string, deck: string,
    seiteDunkel = seite): string {
    const out: string[] = [];
    const n = grundriss.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = grundriss[i]!;
      const [x2, y2] = grundriss[(i + 1) % n]!;
      const nx = y2 - y1;
      const ny = -(x2 - x1);
      if (nx - ny > 1e-6) {
        const farbe = Math.abs(nx) < Math.abs(ny) ? seite : seiteDunkel;
        out.push(this.pfad([[x1, y1, z0], [x2, y2, z0], [x2, y2, z1], [x1, y1, z1]], farbe, KANTE, 0.8));
      }
    }
    out.push(this.pfad(grundriss.map(([x, y]) => [x, y, z1] as const), deck, KANTE, 0.8));
    return out.join('');
  }

  licht(x: number, y: number, z: number, farbe: Lichtfarbe, r = 5.5): string {
    const [cx, cy] = this.p(x, y, z);
    const id = neueId('lg');
    const c = LICHT[farbe];
    return `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/>`
      + `<stop offset=".35" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`
      + `<circle cx="${k(cx)}" cy="${k(cy)}" r="${k(r * 3.2)}" fill="url(#${id})"/>`
      + `<circle cx="${k(cx)}" cy="${k(cy)}" r="${k(r * 0.62)}" fill="${c}" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/>`;
  }
}

export function rumpfGrundriss(L: number, B: number): [number, number][] {
  const h = B / 2;
  return [[0, h * 0.88], [0, -h * 0.88], [L * 0.68, -h], [L, 0], [L * 0.68, h]];
}
