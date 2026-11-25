import type { Tageszeit } from '@/core/types';
import { sonnenzeiten, DAEMMERUNGSWINKEL } from '@/core/sun';
import { localDateStr } from '@/core/time';
import { merktSich } from './merken';
import { SCHLUESSEL } from './speicherschluessel';

export type TagWahl = Tageszeit | 'auto';

const STORAGE_KEY = SCHLUESSEL.theme;
const STANDARD_ORT = { lat: 44.0, lon: 14.5 };

const AUTO_PRUEF_INTERVALL_MS = 60_000;

function gemerkterOrt(): { lat: number; lon: number } | null {
  try {
    const o = JSON.parse(localStorage.getItem(SCHLUESSEL.themeOrt) ?? 'null') as { lat?: unknown; lon?: unknown } | null;
    return o && typeof o.lat === 'number' && typeof o.lon === 'number' && Math.abs(o.lat) <= 90 && Math.abs(o.lon) <= 180 ? { lat: o.lat, lon: o.lon } : null;
  } catch { return null; }
}

let referenzOrt = { ...STANDARD_ORT };

export function setzeReferenzOrt(ort: { lat: number; lon: number } | null, merken = false): void {
  referenzOrt = ort ?? { ...STANDARD_ORT };
  if (ort && merken) {
    try { localStorage.setItem(SCHLUESSEL.themeOrt, JSON.stringify({ lat: Math.round(ort.lat * 100) / 100, lon: Math.round(ort.lon * 100) / 100 })); } catch {  }
  }
  if (wahl === 'auto') wendeThemeAn(aktuellesTheme());
}

export function nimmGemerktenOrt(): void {
  const o = gemerkterOrt();
  if (o) referenzOrt = o;
}

function erkanntesTheme(): Tageszeit {
  const jetzt = new Date();
  const zeiten = sonnenzeiten(referenzOrt.lat, referenzOrt.lon, localDateStr(jetzt), DAEMMERUNGSWINKEL.buergerlich);
  if (!zeiten) return 'tag';
  return jetzt < zeiten.auf || jetzt >= zeiten.unter ? 'nacht' : 'tag';
}

function geleseneWahl(): TagWahl {
  if (!merktSich()) return 'auto';
  const w = localStorage.getItem(STORAGE_KEY);
  return w === 'tag' || w === 'nacht' || w === 'auto' ? w : 'auto';
}

let wahl: TagWahl = geleseneWahl();

let tagErzwungen = false;

export function aktuellesTheme(): Tageszeit {
  if (tagErzwungen) return 'tag';
  return wahl === 'auto' ? erkanntesTheme() : wahl;
}

export function erzwingeTagesansicht(an: boolean): void {
  if (tagErzwungen === an) return;
  tagErzwungen = an;
  wendeThemeAn(aktuellesTheme());
}

function wendeThemeAn(theme: Tageszeit): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function markiereAktivenThemeButton(): void {
  document.querySelectorAll<HTMLButtonElement>('#menu-theme-options .menu-choice-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset['themeChoice'] === wahl);
  });
}

export function setzeTheme(neu: TagWahl): void {

  tagErzwungen = false;
  wahl = neu;
  if (merktSich()) localStorage.setItem(STORAGE_KEY, neu);
  wendeThemeAn(aktuellesTheme());
  markiereAktivenThemeButton();
}

export function sichereThemeWahl(): void {
  if (merktSich()) localStorage.setItem(STORAGE_KEY, wahl);
}

export function initTheme(): void {
  wendeThemeAn(aktuellesTheme());
  markiereAktivenThemeButton();

  const panel = document.getElementById('menu-panel') as HTMLDivElement | null;
  const toggle = document.getElementById('btn-menu');
  panel?.querySelectorAll<HTMLButtonElement>('#menu-theme-options .menu-choice-btn').forEach((b) => {
    b.addEventListener('click', () => {
      setzeTheme(b.dataset['themeChoice'] as TagWahl);
      panel.hidden = true;
      toggle?.setAttribute('aria-expanded', 'false');
    });
  });

  setInterval(() => {
    if (wahl === 'auto') wendeThemeAn(aktuellesTheme());
  }, AUTO_PRUEF_INTERVALL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wahl === 'auto') wendeThemeAn(aktuellesTheme());
  });
}
