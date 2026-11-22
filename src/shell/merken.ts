import { SCHLUESSEL } from './speicherschluessel';

const STORAGE_KEY = SCHLUESSEL.merken;
const SPRACHE_KEY = SCHLUESSEL.sprache;
const THEME_KEY = SCHLUESSEL.theme;

export function merktSich(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setzeMerktSich(an: boolean): void {
  if (an) {
    localStorage.setItem(STORAGE_KEY, '1');
  } else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SPRACHE_KEY);
    localStorage.removeItem(THEME_KEY);
  }
}
