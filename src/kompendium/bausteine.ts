import { quellen } from './daten';
import { esc, neueId } from './svg';
import type { Sprache } from '@/core/types';

export type T = (de: string, en: string) => string;
export const tFuer = (sprache: Sprache): T => (de, en) => (sprache === 'en' ? en : de);

export function quelle(sprache: Sprache, ...schluessel: string[]): string {
  const q = quellen(sprache);
  const links = schluessel.map((k) => {
    const e = q[k];
    if (!e) throw new Error(`Quelle ${k} fehlt (${sprache})`);
    return `<a href="${esc(e[1])}" target="_blank" rel="noopener">${esc(e[0])}</a>`;
  });
  return `<p class="kp-src">${sprache === 'en' ? 'Source' : 'Quelle'}: ${links.join('; ')}</p>`;
}

export function feldwert(n: number, sprache: Sprache): string {
  return sprache === 'en' ? String(n) : String(n).replace('.', ',');
}

export interface Feld { name: string; label: string; wert: number }

export function rechner(art: string, felder: readonly Feld[], sprache: Sprache): string {
  const f = felder.map((x) => {
    const id = neueId('in');
    return `<label for="${id}">${x.label}<input id="${id}" type="text" inputmode="decimal" autocomplete="off" `
      + `spellcheck="false" data-feld="${x.name}" value="${feldwert(x.wert, sprache)}"></label>`;
  }).join('');
  return `<div class="kp-rechner" data-rechner="${art}">${f}<output aria-live="polite"></output></div>`;
}
