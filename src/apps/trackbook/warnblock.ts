import type { WarnTreffer } from '@/core/warnungen';
import { warnQuelle, warnTeil } from '@/briefing/warnungen';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { STRINGS } from './strings';
import { oeffneSeewetter } from './seewetter';
import { uhrLtVon } from '@/core/time';

export interface Warnlage { seewetter: boolean; treffer: WarnTreffer[]; geprueft: number }

const $ = (id: string) => document.getElementById(id);
const wort = (k: string): string => STRINGS[aktuelleSprache()][k] ?? k;
let lage: Warnlage | null = null;

export function zeigeWarnblock(l: Warnlage | null): void {
  lage = l && (l.seewetter || l.treffer.length) ? l : null;
  zeichne();
}

function zeichne(): void {
  const box = $('tb-warnblock');
  if (!box) return;
  box.hidden = !lage;
  if (!lage) { box.innerHTML = ''; return; }
  const sprache = aktuelleSprache();
  const stufe = lage.treffer.reduce((m, t) => Math.max(m, t.stufe), lage.seewetter ? 4 : 0);
  box.dataset['stufe'] = String(stufe);
  box.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = wort('warnblock.titel');
  box.appendChild(h);
  for (const t of lage.treffer) {
    const p = document.createElement('p');
    p.className = `tb-warnblock-zeile stufe-${t.stufe}`;
    const teil = warnTeil(t, sprache);
    p.textContent = teil.charAt(0).toUpperCase() + teil.slice(1);
    box.appendChild(p);
  }
  if (lage.seewetter) {
    const p = document.createElement('p');
    p.className = 'tb-warnblock-zeile';
    p.textContent = wort('warnblock.seewetter');
    box.appendChild(p);
  }
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'btn';
  k.textContent = wort('warnblock.bericht');
  k.addEventListener('click', () => oeffneSeewetter());
  box.appendChild(k);
  const q = document.createElement('p');
  q.className = 'tb-hinweis';
  const zeit = uhrLtVon(lage.geprueft);
  q.textContent = `${wort('warnblock.stand').replace('{uhr}', zeit)}${lage.treffer.length ? ` ${warnQuelle(sprache)}` : ''}`;
  box.appendChild(q);
}

export function initWarnblock(): void {
  aufSprachwechsel(zeichne);
}
