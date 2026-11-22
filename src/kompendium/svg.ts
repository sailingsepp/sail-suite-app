import { escapeHtml } from '@/core/html';

let zaehler = 0;

export function neueId(praefix = 'kp'): string {
  zaehler += 1;
  return `kp-${praefix}${zaehler}`;
}

export const esc = escapeHtml;

export type Punkt = readonly [number, number];

export function k(n: number, stellen = 1): string {
  return Number(n.toFixed(stellen)).toString();
}

export function poly(pts: readonly Punkt[], fill: string, extra = ''): string {
  return `<polygon points="${pts.map(([x, y]) => `${k(x, 2)},${k(y, 2)}`).join(' ')}" fill="${fill}"${extra}/>`;
}

export function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${k(x, 2)}" y="${k(y, 2)}" width="${k(w, 2)}" height="${k(h, 2)}" fill="${fill}"/>`;
}

export function aufKreis(cx: number, cy: number, r: number, grad: number): Punkt {
  const a = (grad * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

export function pfeile(): { defs: string; grau: string; akzent: string; text: string } {
  const grau = neueId('pf');
  const akzent = neueId('pf');
  const text = neueId('pf');
  const m = (id: string, farbe: string) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" `
    + `markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${farbe}"/></marker>`;
  return {
    defs: `<defs>${m(grau, 'var(--muted)')}${m(akzent, 'var(--gelb)')}${m(text, 'var(--text)')}</defs>`,
    grau, akzent, text,
  };
}
