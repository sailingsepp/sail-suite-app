import { icon } from '@/shell/icons';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { ausSpeicher, laeuft, mmss, neuerTimer, setzeDauer, stand, starte, stoppe, vonVorn, TIMER_MAX_S, type TimerZustand } from '@/core/timer';
import { stoppeTimerton, timerton } from './ton';
import { STRINGS } from './strings';


const SCHLUESSEL = 'sail-suite:nav-timer';
const wort = (k: string) => STRINGS[aktuelleSprache()][k] ?? k;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const ZEILE_PX = 30;

let z: TimerZustand = neuerTimer();
let offen = false;

let waehlt = false;
let el: HTMLElement | null = null;
let uhr = 0;
let geaendert: () => void = () => {};

function lies(): void {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as { offen?: boolean } & Partial<TimerZustand> | null;
    z = ausSpeicher(roh);
    offen = roh?.offen === true;
  } catch { z = neuerTimer(); offen = false; }
}
function schreibe(): void {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ ...z, offen })); } catch {  }
}

export function timerOffen(): boolean { return offen; }


export function schalteTimer(): void {
  if (offen) { schliesse(); return; }
  offen = true;
  waehlt = false;
  z = neuerTimer(0);
  schreibe();
  zeichne();
}

function schliesse(): void {
  offen = false;
  waehlt = false;
  z = { ...stoppe(stoppe(z, Date.now()), Date.now()) };
  schreibe();
  zeichne();
  geaendert();
}

function aktion(a: string): void {
  const jetzt = Date.now();
  
  stoppeTimerton();
  if (a === 'waehlen') { if (!laeuft(z)) waehlt = !waehlt; }
  else if (a === 'start') { waehlt = false; z = starte(z, jetzt); }
  else if (a === 'stopp') z = stoppe(z, jetzt);
  else if (a === 'wiederholen') { waehlt = false; z = vonVorn(z, jetzt); }
  schreibe();
  zeichne();
}


function takt(): void {
  const s = stand(z, Date.now());
  if (s.abgelaufen) {
    z = s.z;
    schreibe();
    timerton();
    zeichne();
    return;
  }
  const zeit = el?.querySelector('.tb-timer-zeit');
  if (zeit) zeit.textContent = mmss(s.restS);
}



const zwei = (n: number) => String(n).padStart(2, '0');
function rad(art: 'm' | 's', wert: number): string {
  const max = art === 'm' ? 60 : 59;
  const zeilen = Array.from({ length: max + 1 }, (_, k) => `<div class="tb-rad-z">${zwei(k)}</div>`).join('');
  return `<div class="tb-rad" data-rad="${art}" tabindex="0" role="spinbutton" aria-label="${esc(wort(art === 'm' ? 'timer.minuten' : 'timer.sekunden'))}"`
    + ` aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${wert}">${zeilen}</div>`;
}
const radWert = (r: HTMLElement) => Math.max(0, Math.min(r.dataset['rad'] === 'm' ? 60 : 59, Math.round(r.scrollTop / ZEILE_PX)));
function setzeRad(r: HTMLElement, wert: number, weich = false): void {
  r.scrollTo({ top: wert * ZEILE_PX, behavior: weich ? 'smooth' : 'auto' });
  r.setAttribute('aria-valuenow', String(wert));
}

function vonRaedern(): void {
  if (!el) return;
  const rm = el.querySelector<HTMLElement>('[data-rad="m"]'), rs = el.querySelector<HTMLElement>('[data-rad="s"]');
  if (!rm || !rs) return;
  const m = radWert(rm);
  let s = radWert(rs);
  if (m === 60 && s !== 0) { s = 0; setzeRad(rs, 0, true); }
  rm.setAttribute('aria-valuenow', String(m));
  rs.setAttribute('aria-valuenow', String(s));
  z = setzeDauer(z, Math.min(TIMER_MAX_S, m * 60 + s));
  schreibe();
  const zeit = el.querySelector('.tb-timer-zeit');
  if (zeit) zeit.textContent = mmss(z.restS);
  el.querySelector<HTMLButtonElement>('[data-t="stopp"]')?.setAttribute('disabled', '');
  for (const a of ['start', 'wiederholen']) el.querySelector<HTMLButtonElement>(`[data-t="${a}"]`)?.toggleAttribute('disabled', z.dauerS <= 0);
}
function bindeRaeder(): void {
  if (!el) return;
  for (const r of el.querySelectorAll<HTMLElement>('.tb-rad')) {
    let ruhe = 0;
    r.addEventListener('scroll', () => { window.clearTimeout(ruhe); ruhe = window.setTimeout(vonRaedern, 120); }, { passive: true });
    r.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      setzeRad(r, Math.max(0, Math.min(r.dataset['rad'] === 'm' ? 60 : 59, radWert(r) + (e.key === 'ArrowDown' ? 1 : -1))), true);
    });
  }
  const m = Math.floor(z.dauerS / 60), s = z.dauerS % 60;
  const rm = el.querySelector<HTMLElement>('[data-rad="m"]'), rs = el.querySelector<HTMLElement>('[data-rad="s"]');
  if (rm) setzeRad(rm, m);
  if (rs) setzeRad(rs, s);
}

function zeichne(): void {
  window.clearInterval(uhr);
  uhr = 0;
  if (!offen || !el) { if (el) el.hidden = true; return; }
  const s = stand(z, Date.now());
  if (s.abgelaufen) { z = s.z; schreibe(); }
  const l = laeuft(z);
  if (l) waehlt = false;
  
  const knopf = (a: string, bild: string, text: string, extra = '') =>
    `<button type="button" class="tb-timer-k" data-t="${a}" aria-label="${esc(text)}" title="${esc(text)}"${extra}>${bild}</button>`;
  el.hidden = false;
  el.classList.toggle('laeuft', l);
  el.classList.toggle('abgelaufen', z.abgelaufen);
  el.classList.toggle('waehlt', waehlt);
  el.setAttribute('aria-label', wort('timer.titel'));
  
  el.innerHTML = `<button type="button" class="tb-timer-zeit" data-t="waehlen" aria-expanded="${waehlt}"`
    + ` title="${esc(wort('timer.einstellen'))}"${l ? ' disabled' : ''}>${mmss(s.restS)}</button>`
    + (waehlt ? `<div class="tb-raeder">${rad('m', Math.floor(z.dauerS / 60))}<span aria-hidden="true">:</span>${rad('s', z.dauerS % 60)}</div>` : '')
    + `<div class="tb-timer-knoepfe">`
    + knopf('start', icon('start'), wort('timer.start'), l || z.dauerS <= 0 ? ' disabled' : '')
    
    + knopf('stopp', icon('stop'), wort('timer.stopp'), !l && z.restS >= z.dauerS && !z.abgelaufen ? ' disabled' : '')
    
    + knopf('wiederholen', icon('wiederholen'), wort('timer.wiederholen'), z.dauerS <= 0 ? ' disabled' : '')
    + '</div>';
  if (waehlt) bindeRaeder();
  if (l) uhr = window.setInterval(takt, 250);
  platziere();
}



type Kasten = { l: number; t: number; r: number; b: number };

const HINDERNISSE = '#tb-eb-menue, #btn-mob, #tb-nav-werkzeuge, #tb-nav-log-baum, #tb-nav-chrono-baum, .leaflet-top.leaflet-left, #tb-nav-hinweis, #tb-nav-kopf-griff';


function platziere(): void { if (el) platziereAufKarte(el); }


export function platziereAufKarte(el: HTMLElement, weitere = ''): void {
  if (el.hidden) return;
  const wrap = el.parentElement;
  if (!wrap) return;
  const w = wrap.getBoundingClientRect();
  const breite = el.offsetWidth, hoehe = el.offsetHeight;
  const rand = 8;
  
  const kaesten: Kasten[] = [...document.querySelectorAll<HTMLElement>(weitere ? `${HINDERNISSE}, ${weitere}` : HINDERNISSE)]
    .filter((e) => e !== el && !e.hidden && e.offsetWidth > 0 && getComputedStyle(e).visibility !== 'hidden')
    .map((e) => { const r = e.getBoundingClientRect(); return { l: r.left - w.left, t: r.top - w.top, r: r.right - w.left, b: r.bottom - w.top }; })
    .filter((k) => k.b > 0 && k.t < w.height && k.r > 0 && k.l < w.width);
  const oben = [rand, ...kaesten.map((k) => k.b + rand)].filter((t) => t + hoehe < w.height).sort((a, b) => a - b);
  for (const t of oben) {
    
    const belegt = kaesten.filter((k) => k.b > t && k.t < t + hoehe).map((k) => [k.l - rand, k.r + rand] as const).sort((a, b) => a[0] - b[0]);
    const frei: [number, number][] = [];
    let x = rand;
    for (const [a, b] of belegt) { if (a > x) frei.push([x, a]); x = Math.max(x, b); }
    if (x < w.width - rand) frei.push([x, w.width - rand]);
    const mitte = w.width / 2;
    const passend = frei.filter(([a, b]) => b - a >= breite)
      .map(([a, b]) => Math.min(Math.max(mitte - breite / 2, a), b - breite))
      .sort((p, q) => Math.abs(p + breite / 2 - mitte) - Math.abs(q + breite / 2 - mitte));
    if (passend.length) { el.style.left = `${Math.round(passend[0]!)}px`; el.style.top = `${Math.round(t)}px`; return; }
  }
  el.style.left = `${Math.round(Math.max(rand, (w.width - breite) / 2))}px`;
  el.style.top = `${rand}px`;
}


export function initTimer(aenderung: () => void): void {
  geaendert = aenderung;
  const wrap = document.querySelector<HTMLElement>('.tb-karte-wrap');
  if (!wrap) return;
  el = document.createElement('section');
  el.id = 'tb-timer';
  el.className = 'tb-timer';
  el.setAttribute('role', 'group');
  el.hidden = true;
  wrap.appendChild(el);
  el.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLButtonElement>('[data-t]');
    if (k && !k.disabled) aktion(k.dataset['t']!);
  });
  lies();
  
  
  if (z.endeUm !== null && Date.now() >= z.endeUm && Date.now() - z.endeUm < 60_000) timerton();
  zeichne();
  aufSprachwechsel(zeichne);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => platziere()).observe(wrap);
  
  document.addEventListener('visibilitychange', () => { if (!document.hidden && laeuft(z)) takt(); });
}


export function timerPlatzNeu(): void { platziere(); }
