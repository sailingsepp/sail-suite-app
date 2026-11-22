import { LICHT, type Lichtfarbe } from './farben';
import { esc, k } from './svg';
import type { Sprache } from '@/core/types';

export type Takt = readonly [number, Lichtfarbe | `*${Lichtfarbe}` | null];

export function wiederhole(teil: readonly Takt[], n: number): Takt[] {
  const raus: Takt[] = [];
  for (let i = 0; i < n; i++) raus.push(...teil);
  return raus;
}

export function zeitleiste(folge: readonly Takt[], periode: number, label: string, zeige = periode, breite = 300): string {
  const sc = breite / zeige;
  let t = 0;
  const out: string[] = [];
  while (t < zeige - 1e-9) {
    for (const [d, c] of folge) {
      if (t >= zeige - 1e-9) break;
      const dd = Math.min(d, zeige - t);
      if (c) {
        if (c.startsWith('*')) {
          out.push(`<rect x="${k(t * sc, 2)}" y="9" width="${k(dd * sc, 2)}" height="6" fill="${LICHT[c.slice(1) as Lichtfarbe]}" opacity=".55"/>`);
        } else {
          out.push(`<rect x="${k(t * sc, 2)}" y="3" width="${k(Math.max(dd * sc, 1.2), 2)}" height="18" rx="1.5" fill="${LICHT[c as Lichtfarbe]}"/>`);
        }
      }
      t += d;
    }
  }
  const striche: string[] = [];
  for (let i = 0; i <= Math.floor(zeige); i++) {
    striche.push(`<line x1="${k(i * sc)}" y1="24" x2="${k(i * sc)}" y2="${i % 5 ? 28 : 31}" stroke="var(--muted)" stroke-width="1"/>`);
  }
  const per = periode <= zeige
    ? `<line x1="0" y1="35" x2="${k(periode * sc)}" y2="35" stroke="var(--gelb)" stroke-width="1.5"/>` : '';
  return `<svg class="kp-tl kp-fach" viewBox="-2 0 ${breite + 4} 40" role="img" aria-label="${esc(label)}">`
    + `<rect x="0" y="0" width="${breite}" height="24" rx="3" fill="var(--bg)"/>${out.join('')}${striche.join('')}${per}</svg>`;
}

export function morse(code: string): string {
  let x = 0;
  const teile: string[] = [];
  for (const ch of code) {
    const w = ch === '–' ? 14 : 5;
    teile.push(`<rect x="${x}" y="2" width="${w}" height="5" rx="2.5" fill="currentColor"/>`);
    x += w + 4;
  }
  const b = Math.max(x - 4, 1);
  return `<svg class="kp-morse" viewBox="0 0 ${b} 9" width="${b}" height="9" aria-hidden="true">${teile.join('')}</svg>`;
}

export function schall(muster: string, sprache: Sprache): string {
  const BESCHRIFTUNG = sprache === 'en'
    ? { b: 'bell rung rapidly ~5 s', s: '3 strokes on the bell', g: 'gong ~5 s' }
    : { b: 'Glocke rasch ~5 s', s: '3 Glockenschläge', g: 'Gong ~5 s' };
  let x = 0;
  const teile: string[] = [];
  for (const ch of muster) {
    if (ch === '-') { teile.push(`<rect x="${x}" y="5" width="34" height="8" rx="4" class="kp-snd"/>`); x += 40; }
    else if (ch === '.') { teile.push(`<rect x="${x}" y="5" width="9" height="8" rx="4" class="kp-snd"/>`); x += 15; }
    else if (ch === '|') x += 10;
    else if (ch === 'b' || ch === 's' || ch === 'g') {
      const lab = BESCHRIFTUNG[ch];
      const w = 10 + lab.length * 6.6;
      teile.push(`<rect x="${x}" y="0" width="${k(w, 0)}" height="20" rx="10" class="kp-snd-b"/>`
        + `<text x="${k(x + w / 2, 0)}" y="14.5" text-anchor="middle" class="kp-snd-t">${esc(lab)}</text>`);
      x += w + 6;
    }
  }
  const b = k(Math.max(x, 1), 0);
  const label = sprache === 'en' ? 'Sound signal' : 'Schallsignal';
  return `<svg class="kp-schall" viewBox="0 0 ${b} 20" width="${b}" height="20" role="img" aria-label="${label}">${teile.join('')}</svg>`;
}
