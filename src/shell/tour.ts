import { aktuelleSprache, aufSprachwechsel } from './sprache';
import { tourSchritte } from './strings';
import { SCHLUESSEL } from './speicherschluessel';

const STORAGE_KEY = SCHLUESSEL.tourGesehen;

const ICONS = ['⛵', '🗺️', '⚓', '📋', '🧭', '⚠️'];

function schonGesehen(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

function markiereGesehen(): void {
  localStorage.setItem(STORAGE_KEY, '1');
}

let modal: HTMLDivElement | null = null;
let schrittIndex = 0;
let ausloeser: HTMLElement | null = null;

function fokussierbareElemente(): HTMLElement[] {
  if (!modal) return [];
  return [...modal.querySelectorAll<HTMLElement>('button:not([disabled])')];
}

function rendere(): void {
  if (!modal) return;
  const schritte = tourSchritte(aktuelleSprache());
  const schritt = schritte[schrittIndex];
  if (!schritt) return;

  modal.querySelector('.tour-icon')!.textContent = ICONS[schrittIndex] ?? '⛵';
  modal.querySelector('.tour-schritt')!.textContent =
    `${schrittIndex + 1} / ${schritte.length}`;
  modal.querySelector('.tour-titel')!.textContent = schritt.titel;
  modal.querySelector('.tour-text')!.textContent = schritt.text;

  const dots = modal.querySelectorAll<HTMLSpanElement>('.tour-dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === schrittIndex));

  const zurueckBtn = modal.querySelector<HTMLButtonElement>('.tour-zurueck')!;
  zurueckBtn.disabled = schrittIndex === 0;

  const letzter = schrittIndex === schritte.length - 1;
  const weiterBtn = modal.querySelector<HTMLButtonElement>('.tour-weiter')!;
  const en = aktuelleSprache() === 'en';
  weiterBtn.textContent = letzter ? (en ? "Let's go!" : 'Los geht’s!') : (en ? 'Next' : 'Weiter');
  zurueckBtn.textContent = en ? 'Back' : 'Zurück';

  modal.querySelector('.tour-close')!.setAttribute('aria-label', en ? 'Skip introduction' : 'Einführung überspringen');
  modal.setAttribute('aria-label', en ? 'App introduction' : 'App-Einführung');
}

function schliesse(): void {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  markiereGesehen();
  ausloeser?.focus();
}

function weiter(): void {
  const anzahl = tourSchritte(aktuelleSprache()).length;
  if (schrittIndex >= anzahl - 1) { schliesse(); return; }
  schrittIndex++;
  rendere();
}

function zurueck(): void {
  if (schrittIndex === 0) return;
  schrittIndex--;
  rendere();
}

function holeModal(): HTMLDivElement {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'tour-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="tour-card">
      <button type="button" class="tour-close">✕</button>
      <div class="tour-icon"></div>
      <p class="tour-schritt"></p>
      <h2 class="tour-titel"></h2>
      <p class="tour-text"></p>
      <div class="tour-dots">${tourSchritte(aktuelleSprache()).map(() => '<span class="tour-dot"></span>').join('')}</div>
      <div class="tour-nav">
        <button type="button" class="btn ghost tour-zurueck">Zurück</button>
        <button type="button" class="btn primary tour-weiter">Weiter</button>
      </div>
    </div>
  `;
  modal.querySelector('.tour-close')!.addEventListener('click', schliesse);
  modal.querySelector('.tour-zurueck')!.addEventListener('click', zurueck);
  modal.querySelector('.tour-weiter')!.addEventListener('click', weiter);

  modal.addEventListener('click', (e) => { if (e.target === modal) schliesse(); });
  document.body.appendChild(modal);
  return modal;
}

function oeffne(quelle: HTMLElement | null): void {
  ausloeser = quelle;
  schrittIndex = 0;
  const m = holeModal();
  rendere();
  m.hidden = false;
  m.querySelector<HTMLButtonElement>('.tour-weiter')!.focus();
}

document.addEventListener('keydown', (e) => {
  if (!modal || modal.hidden) return;
  if (e.key === 'Escape') { schliesse(); return; }
  if (e.key === 'ArrowRight') { weiter(); return; }
  if (e.key === 'ArrowLeft') { zurueck(); return; }

  if (e.key === 'Tab') {
    const els = fokussierbareElemente();
    if (els.length === 0) return;
    const erster = els[0]!, letzter = els[els.length - 1]!;
    if (e.shiftKey && document.activeElement === erster) { e.preventDefault(); letzter.focus(); }
    else if (!e.shiftKey && document.activeElement === letzter) { e.preventDefault(); erster.focus(); }
  }
});

aufSprachwechsel(() => { if (modal && !modal.hidden) rendere(); });

export function initTour(): void {
  const btn = document.getElementById('btn-tour');
  if (btn) {
    btn.addEventListener('click', () => {

      const panel = document.getElementById('menu-panel');
      if (panel) panel.hidden = true;
      document.getElementById('btn-menu')?.setAttribute('aria-expanded', 'false');
      oeffne(btn);
    });
  }
  if (!schonGesehen()) oeffne(null);
}
