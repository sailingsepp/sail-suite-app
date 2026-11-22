import { aktuelleSprache, aufSprachwechsel } from './sprache';
import { initModal, type ModalHandle } from './modal';
import { woerter } from './strings';
import { leseZahl } from '@/core/kompendium';
import { rechne } from '@/kompendium/rechner';
import type { Sprache } from '@/core/types';
import '@/kompendium/kompendium.css';

type Register = typeof import('@/kompendium/abschnitte');

const SPEICHER = 'sailwise:kompendium:abschnitt';
const $ = (id: string) => document.getElementById(id);
const wort = (k: string): string => woerter(aktuelleSprache())[k] ?? k;

const SPRUNGZIEL: Record<string, string> = { gezeiten: 'btn-gezeiten', funkspruch: 'btn-funkspruch' };

let register: Register | null = null;
let laden: Promise<Register | null> | null = null;
let modal: ModalHandle | null = null;
let aktiv: string | null = null;
let offen = false;

function ladeRegister(): Promise<Register | null> {
  if (register) return Promise.resolve(register);
  laden ??= import('@/kompendium/abschnitte')
    .then((m) => (register = m))
    .catch(() => { laden = null; return null; });
  return laden;
}

function gemerkt(): string | null {
  try { return localStorage.getItem(SPEICHER); } catch { return null; }
}
function merke(schluessel: string): void {
  try { localStorage.setItem(SPEICHER, schluessel); } catch {  }
}

function rechneKasten(kasten: HTMLElement): void {
  const werte: Record<string, number> = {};
  kasten.querySelectorAll<HTMLInputElement>('input[data-feld]').forEach((i) => { werte[i.dataset.feld!] = leseZahl(i.value); });
  const aus = kasten.querySelector('output');
  if (aus) aus.textContent = rechne(kasten.dataset.rechner ?? '', werte, aktuelleSprache());
}

function zeichneNav(r: Register, sprache: Sprache): void {
  const nav = $('kp-nav');
  if (!nav) return;
  nav.innerHTML = r.ABSCHNITTE.map((a) => `<button type="button" class="kp-chip" data-abschnitt="${a.schluessel}"`
    + `${a.schluessel === aktiv ? ' aria-current="true"' : ''}>${a.titel[sprache]}</button>`).join('');
  nav.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function zeichne(schluessel: string | null, nachOben = true): void {
  const r = register;
  const inhalt = $('kp-inhalt');
  if (!r || !inhalt) return;
  const sprache = aktuelleSprache();
  const a = r.abschnitt(schluessel);
  aktiv = a.schluessel;
  merke(aktiv);
  inhalt.innerHTML = r.zeichneAbschnitt(a, sprache)
    + `<p class="kp-hinweis">${wort('kompendium.hinweis')}</p>`;
  inhalt.querySelectorAll<HTMLElement>('.kp-rechner').forEach(rechneKasten);

  inhalt.querySelectorAll<HTMLElement>('[data-sprung]').forEach((b) => {
    if (!$(SPRUNGZIEL[b.dataset.sprung ?? ''] ?? '')) (b.closest('p') ?? b).remove();
  });
  zeichneNav(r, sprache);
  if (nachOben) inhalt.scrollTop = 0;
}

async function oeffne(): Promise<void> {
  const view = $('kp-view');
  const inhalt = $('kp-inhalt');
  if (!view || !inhalt) return;

  if ($('menu-panel')?.hidden === false) $('btn-menu')?.click();
  view.removeAttribute('hidden');
  offen = true;
  document.documentElement.classList.add('kp-offen');

  modal?.beimOeffnen($('btn-menu'), $('btn-kompendium-zu'));
  if (!register) inhalt.innerHTML = `<p class="kp-hinweis">${wort('kompendium.laedt')}</p>`;
  const r = await ladeRegister();
  if (!offen) return;
  if (!r) { inhalt.innerHTML = `<p class="kp-hinweis">${wort('kompendium.fehlt')}</p>`; return; }
  zeichne(aktiv ?? gemerkt());
}

function schliesse(): void {
  if (!offen) return;
  schliesseFoto();
  offen = false;
  $('kp-view')?.setAttribute('hidden', '');
  document.documentElement.classList.remove('kp-offen');
  modal?.beimSchliessen();
}

let fotoAusloeser: HTMLElement | null = null;

function fotoEbene(): HTMLElement | null {
  const view = $('kp-view');
  if (!view) return null;
  let ebene = view.querySelector<HTMLElement>('.kp-foto-gross');
  if (!ebene) {
    ebene = document.createElement('div');
    ebene.className = 'kp-foto-gross';
    ebene.hidden = true;
    ebene.setAttribute('role', 'dialog');
    ebene.setAttribute('aria-modal', 'true');
    ebene.innerHTML = '<img alt=""><p></p><button type="button">✕</button>';
    ebene.addEventListener('click', (ev) => { ev.stopPropagation(); schliesseFoto(); });
    ebene.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); schliesseFoto(); }
      if (ev.key === 'Tab') { ev.preventDefault(); ebene!.querySelector('button')?.focus(); }
    });
    view.appendChild(ebene);
  }
  return ebene;
}

function zeigeFoto(knopf: HTMLElement): void {
  const ebene = fotoEbene();
  if (!ebene) return;
  const text = knopf.dataset.fotoText ?? '';
  fotoAusloeser = knopf;
  ebene.setAttribute('aria-label', text);
  const bild = ebene.querySelector('img')!;
  bild.src = knopf.dataset.foto ?? '';
  bild.alt = text;
  ebene.querySelector('p')!.textContent = text;
  const zu = ebene.querySelector('button')!;
  zu.setAttribute('aria-label', aktuelleSprache() === 'en' ? 'Close photo' : 'Foto schließen');
  ebene.hidden = false;
  zu.focus();
}

function schliesseFoto(): void {
  const ebene = $('kp-view')?.querySelector<HTMLElement>('.kp-foto-gross');
  if (!ebene || ebene.hidden) return;
  ebene.hidden = true;
  fotoAusloeser?.focus();
  fotoAusloeser = null;
}

async function fotosVorladen(): Promise<void> {
  try {
    const { BEAUFORT_FOTOS } = await import('@/kompendium/beaufortFotos');
    for (const url of BEAUFORT_FOTOS) {
      if (!navigator.onLine) return;
      await fetch(url).catch(() => undefined);
    }
  } catch {  }
}

function sanftesScrollen(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function initKompendium(): void {
  const view = $('kp-view');
  if (!view) return;
  modal = initModal(view, schliesse);
  $('btn-kompendium')?.addEventListener('click', () => void oeffne());
  $('btn-kompendium-zu')?.addEventListener('click', schliesse);

  view.addEventListener('touchstart', () => {}, { passive: true });

  view.addEventListener('click', (ev) => {
    const ziel = ev.target;
    if (!(ziel instanceof Element)) return;
    const foto = ziel.closest<HTMLElement>('.kp-bft-foto');
    if (foto) { zeigeFoto(foto); return; }
    const chip = ziel.closest<HTMLElement>('[data-abschnitt]');
    if (chip && view.contains(chip)) { zeichne(chip.dataset.abschnitt ?? null); return; }
    const anker = ziel.closest<HTMLElement>('[data-anker]');
    if (anker) {
      document.getElementById(anker.dataset.anker ?? '')?.scrollIntoView({ behavior: sanftesScrollen(), block: 'start' });
      return;
    }
    const sprung = ziel.closest<HTMLElement>('[data-sprung]');
    if (sprung) {

      const knopf = $(SPRUNGZIEL[sprung.dataset.sprung ?? ''] ?? '');
      schliesse();
      knopf?.click();
    }
  });

  const aufBild = (ev: Event) => ev.target instanceof Element && ev.target.closest('svg, img') !== null;
  view.addEventListener('contextmenu', (ev) => { if (aufBild(ev)) ev.preventDefault(); });
  view.addEventListener('dragstart', (ev) => { if (aufBild(ev)) ev.preventDefault(); });
  view.addEventListener('input', (ev) => {
    const ziel = ev.target;
    if (!(ziel instanceof HTMLInputElement)) return;
    const kasten = ziel.closest<HTMLElement>('.kp-rechner');
    if (kasten) rechneKasten(kasten);
  });

  aufSprachwechsel(() => { if (offen && register) zeichne(aktiv, false); });

  const vorladen = () => { if (navigator.onLine) void ladeRegister().then((r) => { if (r) void fotosVorladen(); }); };
  const leerlauf = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (leerlauf) leerlauf(vorladen, { timeout: 15_000 });
  else setTimeout(vorladen, 5_000);
}
