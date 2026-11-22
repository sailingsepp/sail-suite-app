import type { Sprache } from '@/core/types';
import { escapeHtml } from '@/core/html';

const WOCHENTAG: Record<Sprache, readonly string[]> = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export function wochentagDatum(d: Date, sprache: Sprache): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${WOCHENTAG[sprache][d.getDay()]} ${p(d.getDate())}.${p(d.getMonth() + 1)}.`;
}

export function wochentagAusIso(iso: string | null | undefined, sprache: Sprache): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? wochentagDatum(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), sprache) : null;
}

const LABEL: Record<Sprache, Record<'tag' | 'strecke' | 'distanz' | 'ablegen' | 'dauer' | 'wind' | 'lage', string>> = {
  de: { tag: 'Tag', strecke: 'Strecke', distanz: 'Distanz', ablegen: 'Ablegen', dauer: 'Fahrzeit', wind: 'Wind/Böen', lage: 'Lage' },
  en: { tag: 'Day', strecke: 'Route', distanz: 'Distance', ablegen: 'Departure', dauer: 'Passage time', wind: 'Wind/gusts', lage: 'Conditions' },
};
const KOPF: Record<Sprache, readonly string[]> = {
  de: ['', 'Datum', 'Etappe', 'Distanz', 'Ablegen', 'Fahrzeit', 'Wind', 'Lage', ''],
  en: ['', 'Date', 'Leg', 'Distance', 'Departure', 'Time', 'Wind', 'Conditions', ''],
};
const AB: Record<Sprache, string> = { de: 'ab', en: 'dep.' };

export function tabellenKopfHtml(sprache: Sprache): string {
  return `<div class="vp-woche-kopfzeile" aria-hidden="true">${KOPF[sprache].map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</div>`;
}

export interface Tageszeile {

  tag: number;

  wann: string;

  route: string;

  ort?: string;

  klassen?: readonly string[];

  sm?: string | null;
  ablegen?: string | null;
  dauer?: string | null;
  wind?: string | null;

  lage?: { klasse: string; text: string } | null;

  routeZusatz?: string;

  link?: string;

  mehr?: string;
}

export function tageszeileHtml(z: Tageszeile, sprache: Sprache): string {
  const L = LABEL[sprache];
  const sr = (t: string): string => `<span class="vp-sr-only">${escapeHtml(t)}: </span>`;
  const wert = (klasse: string, label: string, v: string | null | undefined, leer = '–'): string =>
    v ? `<span class="${klasse}">${sr(label)}${escapeHtml(v)}</span>` : `<span class="${klasse} vp-leerwert"><span aria-hidden="true">${leer}</span></span>`;
  const ablegen = z.ablegen
    ? `<span class="vp-woche-ablegen">${sr(L.ablegen)}<span class="vp-nur-karte" aria-hidden="true">${AB[sprache]} </span>${escapeHtml(z.ablegen)}</span>`
    : '<span class="vp-woche-ablegen vp-leerwert"><span aria-hidden="true">–</span></span>';
  const lage = z.lage
    ? `<span class="vp-woche-lage vp-lage-${z.lage.klasse}"><span class="vp-woche-punkt" aria-hidden="true"></span>${escapeHtml(z.lage.text)}</span>`
    : '<span class="vp-woche-lage"></span>';
  return `<div class="${['vp-woche-zeile', ...(z.klassen ?? [])].join(' ')}" data-tag="${z.tag}"`
    + ` data-route="${escapeHtml(z.route)}" data-wann="${escapeHtml(z.wann)}"${z.ort ? ` data-ort="${escapeHtml(z.ort)}"` : ''}>`
    + `<span class="vp-woche-nr" aria-hidden="true">${z.tag}</span>`
    + `<span class="vp-woche-tag">${sr(L.tag)}${escapeHtml(z.wann)}</span>`
    + `<span class="vp-woche-namen"><button type="button" class="vp-woche-waehlen">${sr(L.strecke)}${escapeHtml(z.route)}</button>${z.routeZusatz ?? ''}</span>`
    + wert('vp-woche-sm', L.distanz, z.sm, '')
    + ablegen
    + wert('vp-woche-dauer', L.dauer, z.dauer)
    + wert('vp-woche-wind', L.wind, z.wind)
    + lage
    + `<span class="vp-woche-link">${z.link ?? ''}</span>`
    + (z.mehr ? `<div class="vp-woche-mehr">${z.mehr}</div>` : '')
    + '</div>';
}
