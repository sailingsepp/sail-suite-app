import type { Sprache } from '@/core/types';
import { woerter, appTitel, appBeschreibung, SUITE } from './strings';
import { merktSich } from './merken';
import { SCHLUESSEL } from './speicherschluessel';
import { devTitel, devAppName, devIconMarkieren } from './umgebung';



export type SpracheWahl = Sprache | 'auto';

const STORAGE_KEY = SCHLUESSEL.sprache;

export function erkannteSprache(): Sprache {
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function geleseneWahl(): SpracheWahl {
  if (!merktSich()) return 'auto';
  const w = localStorage.getItem(STORAGE_KEY);
  return w === 'de' || w === 'en' || w === 'auto' ? w : 'auto';
}

let wahl: SpracheWahl = geleseneWahl();

export function aktuelleSprache(): Sprache {
  return wahl === 'auto' ? erkannteSprache() : wahl;
}

function attribut(el: Element, attr: string, wert: string): void {
  el.setAttribute(attr, wert);
}


export function lokalisiereChrome(sprache: Sprache): void {
  const dict = woerter(sprache);
  const lookup = (schluessel: string): string | undefined => dict[schluessel];

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const wert = lookup(el.dataset['i18n']!);
    if (wert !== undefined) el.textContent = wert;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const wert = lookup(el.dataset['i18nHtml']!);
    if (wert !== undefined) el.innerHTML = wert;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const wert = lookup(el.dataset['i18nTitle']!);
    if (wert !== undefined) attribut(el, 'title', wert);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const wert = lookup(el.dataset['i18nPlaceholder']!);
    if (wert !== undefined) attribut(el, 'placeholder', wert);
  });
  
  
  const version = document.querySelector('meta[name="app-version"]')?.getAttribute('content');
  document.querySelectorAll<HTMLElement>('.suite-version').forEach((el) => {
    const name = appTitel(sprache).split(':')[0]!.trim();
    el.textContent = version ? `${name} · ${dict['footer.version'] ?? 'Version'} ${version}` : name;
  });
  
  document.querySelectorAll<HTMLElement>('.menu-titel-version').forEach((el) => { el.textContent = version ? `v${version}` : ''; });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    const wert = lookup(el.dataset['i18nAriaLabel']!);
    if (wert !== undefined) attribut(el, 'aria-label', wert);
  });
  
  
  
  document.querySelectorAll<HTMLAnchorElement>('[data-i18n-href]').forEach((el) => {
    const wert = lookup(el.dataset['i18nHref']!);
    if (wert !== undefined) attribut(el, 'href', wert);
  });

  document.documentElement.lang = sprache;
  
  document.title = devTitel(appTitel(sprache));
  document.querySelector('meta[name="description"]')?.setAttribute('content', appBeschreibung(sprache));
  document.querySelector('meta[name="application-name"]')?.setAttribute('content', SUITE[sprache]);
  const appTitle = dict['header.title'];
  if (appTitle !== undefined) {
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', devAppName(appTitle));
  }
  zeigeVersionImTitel();
  
  devIconMarkieren();
}


function zeigeVersionImTitel(): void {
  const version = document.querySelector('meta[name="app-version"]')?.getAttribute('content');
  const titel = document.querySelector('header h1');
  if (!version || !titel || titel.querySelector('.kopf-version')) return;
  const span = document.createElement('span');
  span.className = 'kopf-version';
  span.textContent = `v${version}`;
  titel.append(' ', span);
}


type SprachwechselListener = () => void;
const sprachwechselListener: SprachwechselListener[] = [];

export function aufSprachwechsel(fn: SprachwechselListener): void {
  sprachwechselListener.push(fn);
}


function markiereAktivenSprachButton(): void {
  document.querySelectorAll<HTMLButtonElement>('#menu-lang-options .menu-choice-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset['lang'] === wahl);
  });
}

export function setzeSprache(neu: SpracheWahl): void {
  wahl = neu;
  if (merktSich()) localStorage.setItem(STORAGE_KEY, neu);
  lokalisiereChrome(aktuelleSprache());
  markiereAktivenSprachButton();
  sprachwechselListener.forEach((fn) => fn());
}


export function sichereSpracheWahl(): void {
  if (merktSich()) localStorage.setItem(STORAGE_KEY, wahl);
}


function initMenu(): void {
  const toggle = document.getElementById('btn-menu') as HTMLButtonElement | null;
  const panel = document.getElementById('menu-panel') as HTMLDivElement | null;
  if (!toggle || !panel) return;

  
  
  
  
  
  
  toggle.addEventListener('touchstart', () => {}, { passive: true });

  function oeffnen(): void {
    panel!.hidden = false;
    toggle!.setAttribute('aria-expanded', 'true');
  }
  function schliessen(): void {
    if (panel!.hidden) return;
    panel!.hidden = true;
    toggle!.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', () => { if (panel!.hidden) oeffnen(); else schliessen(); });
  document.addEventListener('click', (e) => {
    const ziel = e.target as Node;
    
    
    
    
    
    
    if (!panel!.hidden && !panel!.contains(ziel) && !toggle!.contains(ziel)) schliessen();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel!.hidden) { schliessen(); toggle!.focus(); }
  });

  panel.querySelectorAll<HTMLButtonElement>('#menu-lang-options .menu-choice-btn').forEach((b) => {
    b.addEventListener('click', () => {
      setzeSprache(b.dataset['lang'] as SpracheWahl);
      schliessen();
    });
  });
}


export function initSprache(): void {
  initMenu();
  markiereAktivenSprachButton();
  lokalisiereChrome(aktuelleSprache());
}
