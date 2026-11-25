import { icon } from '@/shell/icons';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import {
  intervall, mittel, neueStoppuhr, sekundenText, stoppuhrAusSpeicher, stoppuhrLaeuft, stoppuhrReset, stoppuhrStart,
  stoppuhrStopp, uhrText, verstrichen, zwischenzeit, type StoppuhrZustand,
} from '@/core/stoppuhr';
import { platziereAufKarte } from './timer';
import { STRINGS } from './strings';

const SCHLUESSEL = 'sail-suite:nav-stoppuhr';
const sprache = () => aktuelleSprache();
const wort = (k: string) => STRINGS[sprache()][k] ?? k;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const SIGNAL = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">'
  + '<circle cx="12" cy="12" r="3.2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';

let z: StoppuhrZustand = neueStoppuhr();
let offen = false;
let el: HTMLElement | null = null;
let uhr = 0;
let geaendert: () => void = () => {};

function lies(): void {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as { offen?: boolean } | null;
    z = stoppuhrAusSpeicher(roh);
    offen = roh?.offen === true;
  } catch { z = neueStoppuhr(); offen = false; }
}
function schreibe(): void {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ ...z, offen })); } catch {  }
}

export function stoppuhrOffen(): boolean { return offen; }

export function schalteStoppuhr(): void {
  offen = !offen;
  z = offen ? neueStoppuhr() : stoppuhrStopp(z, Date.now());
  schreibe();
  zeichne();
  geaendert();
}

function aktion(a: string): void {
  const jetzt = Date.now();
  if (a === 'startstopp') z = stoppuhrLaeuft(z) ? stoppuhrStopp(z, jetzt) : stoppuhrStart(z, jetzt);
  else if (a === 'zwischen') z = zwischenzeit(z, jetzt);
  else if (a === 'intervall') z = intervall(z, jetzt);
  else if (a === 'reset') z = stoppuhrReset();
  schreibe();
  zeichne();
}

function takt(): void {
  const zeit = el?.querySelector('.tb-timer-zeit');
  if (zeit) zeit.textContent = uhrText(verstrichen(z, Date.now()), sprache());
}

function liste(): string {
  const s = sprache();
  const zeilen: string[] = [];
  z.zwischen.forEach((t, i) => zeilen.push(`<li><span>${esc(wort('stoppuhr.zw'))} ${i + 1}</span><b>${esc(uhrText(t, s))}</b></li>`));
  z.intervalle.forEach((t, i) => zeilen.push(`<li><span>${i + 1}</span><b>${esc(sekundenText(t, s))}</b></li>`));
  const m = mittel(z.intervalle);
  if (!zeilen.length) return '';
  return `<ol class="tb-uhr-liste">${zeilen.join('')}</ol>`
    + (m !== null ? `<p class="tb-uhr-mittel"><span>Ø</span><b>${esc(sekundenText(m, s))}</b></p>` : '');
}

function zeichne(): void {
  window.clearInterval(uhr);
  uhr = 0;
  if (!offen || !el) { if (el) el.hidden = true; return; }
  const l = stoppuhrLaeuft(z);
  const leer = !l && z.bisherMs === 0 && !z.zwischen.length && !z.intervalle.length;
  const knopf = (a: string, bild: string, text: string, extra = '') =>
    `<button type="button" class="tb-timer-k" data-s="${a}" aria-label="${esc(text)}" title="${esc(text)}"${extra}>${bild}</button>`;
  el.hidden = false;
  el.classList.toggle('laeuft', l);
  el.setAttribute('aria-label', wort('stoppuhr.titel'));
  const vorher = el.querySelector('.tb-uhr-liste')?.scrollTop;
  el.innerHTML = `<div class="tb-timer-zeit" role="timer">${esc(uhrText(verstrichen(z, Date.now()), sprache()))}</div>`
    + '<div class="tb-timer-knoepfe tb-uhr-knoepfe">'
    + knopf('startstopp', icon(l ? 'stop' : 'start'), wort(l ? 'stoppuhr.stopp' : 'stoppuhr.start'), ` data-an="${l}"`)
    + knopf('zwischen', icon('zielflagge'), wort('stoppuhr.zwischen'), l ? '' : ' disabled')
    + knopf('intervall', SIGNAL, wort('stoppuhr.intervall'))
    + knopf('reset', icon('undo'), wort('stoppuhr.reset'), leer ? ' disabled' : '')
    + '</div>' + liste();

  const ol = el.querySelector<HTMLElement>('.tb-uhr-liste');
  if (ol) ol.scrollTop = vorher != null && vorher < ol.scrollHeight - ol.clientHeight - 40 ? vorher : ol.scrollHeight;
  if (l) uhr = window.setInterval(takt, 100);
  platziere();
}

function platziere(): void { if (el) platziereAufKarte(el, '#tb-timer:not([hidden])'); }

export function initStoppuhr(aenderung: () => void): void {
  geaendert = aenderung;
  const wrap = document.querySelector<HTMLElement>('.tb-karte-wrap');
  if (!wrap) return;
  el = document.createElement('section');
  el.id = 'tb-stoppuhr';
  el.className = 'tb-timer tb-stoppuhr';
  el.setAttribute('role', 'group');
  el.hidden = true;
  wrap.appendChild(el);

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const k = (e.target as Element).closest<HTMLButtonElement>('[data-s]');
    if (k && !k.disabled) { e.preventDefault(); aktion(k.dataset['s']!); }
  });

  el.addEventListener('click', (e) => {
    if ((e as PointerEvent).pointerType) return;
    const k = (e.target as Element).closest<HTMLButtonElement>('[data-s]');
    if (k && !k.disabled && e.detail === 0) aktion(k.dataset['s']!);
  });
  lies();
  zeichne();
  aufSprachwechsel(zeichne);
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => platziere());
    ro.observe(wrap);
    const timer = document.getElementById('tb-timer');
    if (timer) ro.observe(timer);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && stoppuhrLaeuft(z)) takt(); });
}

export function stoppuhrPlatzNeu(): void { platziere(); }
