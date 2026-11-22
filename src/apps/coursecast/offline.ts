import type { Punkt, Sprache } from '@/core/types';
import { bindeBriefing } from '@/ui/briefingAnsicht';
import { escapeHtml } from '@/core/html';
import { uhrLtVon } from '@/core/time';

export const SPEICHER_SCHLUESSEL = 'sail-suite:letztes-briefing';

const MAX_ZEICHEN = 1_500_000;

export interface GespeichertesBriefing {

  gerechnet: string;

  datenVon: string | null;

  datum: string;
  sprache: Sprache;
  route: Punkt[];

  wegpunkte?: Punkt[];
  titel: string;

  html: Record<string, string>;
}

export const BEREICHE = ['strip', 'strip-labels', 'strip-sonne-labels', 'strip-fahrt-labels', 'rec-card', 'table'] as const;

export function abbild(): Record<string, string> {
  const html: Record<string, string> = {};
  for (const id of BEREICHE) {
    const e = document.getElementById(id);
    if (!e) continue;
    const kopie = e.cloneNode(true) as HTMLElement;
    kopie.querySelectorAll(OHNE).forEach((n) => n.remove());
    html[id] = kopie.innerHTML;
  }
  return html;
}

export const OHNE = '.brief-head-actions, #isobaren-karte, .brief-audio-fehler';

export function speichere(b: GespeichertesBriefing, speicher: Pick<Storage, 'setItem' | 'removeItem'> = localStorage): boolean {
  try {
    const text = JSON.stringify(b);
    if (text.length > MAX_ZEICHEN) { speicher.removeItem(SPEICHER_SCHLUESSEL); return false; }
    speicher.setItem(SPEICHER_SCHLUESSEL, text);
    return true;
  } catch {
    return false;
  }
}

export function lies(speicher: Pick<Storage, 'getItem'> = localStorage): GespeichertesBriefing | null {
  try {
    const roh = speicher.getItem(SPEICHER_SCHLUESSEL);
    if (!roh) return null;
    const b = JSON.parse(roh) as GespeichertesBriefing;
    return b && typeof b.gerechnet === 'string' && b.html && Array.isArray(b.route) ? b : null;
  } catch {
    return null;
  }
}

export function passtZu(b: GespeichertesBriefing, wegpunkte: readonly Punkt[], datum: string): boolean {
  const ref = b.wegpunkte ?? b.route;
  if (b.datum !== datum || ref.length !== wegpunkte.length) return false;

  return ref.every((p, i) => Math.abs(p.lat - wegpunkte[i]!.lat) < 1e-4 && Math.abs(p.lon - wegpunkte[i]!.lon) < 1e-4);
}

export type Grund = 'netz' | 'dienst';

export function altersHinweis(b: GespeichertesBriefing, jetzt: Date, sprache: Sprache, grund: Grund = 'netz'): string {
  const en = sprache === 'en';
  const g = new Date(b.gerechnet);
  const stunden = Math.max(0, Math.round((jetzt.getTime() - g.getTime()) / 3_600_000));
  const tag = g.toLocaleDateString(en ? 'en-GB' : 'de-AT', { day: '2-digit', month: '2-digit' });
  const uhr = uhrLtVon(g.getTime());
  const alter = stunden < 1
    ? (en ? 'less than an hour ago' : 'vor weniger als einer Stunde')
    : stunden === 1 ? (en ? '1 hour ago' : 'vor 1 Stunde') : (en ? `${stunden} hours ago` : `vor ${stunden} Stunden`);

  const von = b.datenVon?.replace(/^(\d{2}):(\d{2})$/, '$1$2 LT') ?? null;
  const daten = von ? (en ? `, data from ${von}` : `, Daten von ${von}`) : '';
  const kopf = grund === 'dienst'
    ? (en ? 'Weather service not responding' : 'Wetterdienst antwortet nicht')
    : (en ? 'No connection' : 'Kein Netz');
  return en
    ? `${kopf}: this is the last briefing, calculated on ${tag} at ${uhr} (${alter}${daten}). The forecast may have changed since. It is shown read-only; the time bar cannot recalculate.`
    : `${kopf}: Das ist das letzte Briefing, gerechnet am ${tag} um ${uhr} (${alter}${daten}). Die Vorhersage kann sich seither geändert haben. Es steht nur zum Lesen da, der Zeitbalken rechnet nicht neu.`;
}

export function zeige(b: GespeichertesBriefing, jetzt: Date, sprache: Sprache, grund: Grund = 'netz'): void {
  const $ = (id: string): HTMLElement => document.getElementById(id)!;
  $('brief-titel').textContent = b.titel;
  for (const id of BEREICHE) { const e = document.getElementById(id); if (e) e.innerHTML = b.html[id] ?? ''; }
  $('strip-hinweis').innerHTML = '';
  const strip = $('strip');
  strip.removeAttribute('tabindex');
  strip.setAttribute('aria-disabled', 'true');
  strip.classList.add('strip-alt');
  $('rec-card').insertAdjacentHTML('afterbegin', `<div class="offline-hinweis" role="status">${escapeHtml(altersHinweis(b, jetzt, sprache, grund))}</div>`);

  bindeBriefing($('rec-card'), sprache);
  $('results').style.display = 'block';
}
