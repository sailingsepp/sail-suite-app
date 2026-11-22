import { aktuelleSprache, aufSprachwechsel } from './sprache';
import { woerter } from './strings';
import { aufLesestand } from './lesestand';
import { datumUhrLtVon } from '@/core/time';

let stand: number | null = null;
let leiste: HTMLElement | null = null;

let wieder = false;

const wort = (k: string): string => woerter(aktuelleSprache())[k] ?? k;

function zeitText(t: number): string {
  const sprache = aktuelleSprache();
  return datumUhrLtVon(t, sprache === 'en' ? 'en' : 'de', { day: '2-digit', month: '2-digit' });
}

function zeichne(): void {
  if (stand === null) return;
  if (!leiste) {
    leiste = document.createElement('div');
    leiste.className = 'offline-leiste';
    leiste.setAttribute('role', 'status');
    const kopf = document.querySelector('body > header');
    if (kopf) kopf.after(leiste); else document.body.prepend(leiste);
  }
  leiste.innerHTML = `<span>${(wieder ? wort('offline.wieder') : wort('offline.stand')).replace('{zeit}', zeitText(stand))}</span>`
    + (wieder ? `<button type="button" class="btn">${wort('offline.neuLaden')}</button>` : '');
  leiste.querySelector('button')?.addEventListener('click', () => window.location.reload());
}

export function initOfflineHinweis(): void {
  aufLesestand((zeit) => { stand = zeit; zeichne(); });
  window.addEventListener('online', () => { wieder = true; zeichne(); });
  window.addEventListener('offline', () => { wieder = false; zeichne(); });
  aufSprachwechsel(zeichne);
}
