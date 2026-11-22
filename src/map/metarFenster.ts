import { uhrUtc } from '@/core/time';
import './metarFenster.css';
import { initModal, type ModalHandle } from '@/shell/modal';
import { aktuelleSprache } from '@/shell/sprache';
import { escapeHtml } from '@/core/html';
import { metarKlartext } from '@/briefing/metar';
import { holeMetar } from '@/data/metar';
import type { Sprache } from '@/core/types';



const TEXTE: Record<Sprache, Record<string, string>> = {
  de: {
    laedt: 'METAR wird geladen.', keine: 'Keine aktuelle Meldung.', weg: 'METAR-Dienst nicht erreichbar.',
    offline: 'Ohne Netz nicht abrufbar.', beobachtet: 'beobachtet', vor: 'vor', alt: 'älter als 3 h',
    quelle: 'Quelle: NOAA Aviation Weather Center', schliessen: 'Schließen', roh: 'Rohtext',
  },
  en: {
    laedt: 'Loading METAR.', keine: 'No current report.', weg: 'METAR service not reachable.',
    offline: 'Not available offline.', beobachtet: 'observed', vor: '', alt: 'older than 3 h',
    quelle: 'Source: NOAA Aviation Weather Center', schliessen: 'Close', roh: 'Raw report',
  },
};


const ALT_MS = 3 * 3600_000;

interface Bausatz { overlay: HTMLDivElement; titel: HTMLHeadingElement; inhalt: HTMLDivElement; x: HTMLButtonElement; handle: ModalHandle }
let bausatz: Bausatz | null = null;
let lauf = 0;

function baue(): Bausatz {
  if (bausatz) return bausatz;
  const overlay = document.createElement('div');
  overlay.className = 'mf-overlay';
  overlay.hidden = true;
  overlay.innerHTML = '<div class="mf-modal" role="dialog" aria-modal="true" aria-labelledby="mf-titel" tabindex="-1">'
    + '<div class="mf-kopf"><h2 id="mf-titel"></h2><button type="button" class="mf-x">✕</button></div>'
    + '<div class="mf-inhalt" aria-live="polite"></div></div>';
  document.body.append(overlay);
  const modal = overlay.querySelector<HTMLDivElement>('.mf-modal')!;
  const handle = initModal(modal, schliesseMetar);
  const x = overlay.querySelector<HTMLButtonElement>('.mf-x')!;
  x.addEventListener('click', schliesseMetar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) schliesseMetar(); });
  bausatz = { overlay, titel: overlay.querySelector('h2')!, inhalt: overlay.querySelector('.mf-inhalt')!, x, handle };
  return bausatz;
}

export function schliesseMetar(): void {
  if (!bausatz || bausatz.overlay.hidden) return;
  lauf++;
  bausatz.overlay.hidden = true;
  bausatz.handle.beimSchliessen();
}

function alterText(ms: number, s: Sprache): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const d = min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
  return s === 'de' ? `vor ${d}` : `${d} ago`;
}


export async function oeffneMetar(icao: string, name: string): Promise<void> {
  const b = baue();
  const s = aktuelleSprache();
  const tx = TEXTE[s];
  const meinLauf = ++lauf;
  b.titel.textContent = name || icao;
  b.x.setAttribute('aria-label', tx['schliessen']!);
  b.inhalt.innerHTML = `<p class="mf-zeit">${escapeHtml(icao)}</p><p class="mf-hinweis">${escapeHtml(tx['laedt']!)}</p>`;
  if (b.overlay.hidden) { b.overlay.hidden = false; b.handle.beimOeffnen(document.activeElement as HTMLElement | null, b.x); }
  if (!navigator.onLine) { b.inhalt.innerHTML = `<p class="mf-zeit">${escapeHtml(icao)}</p><p class="mf-hinweis">${escapeHtml(tx['offline']!)}</p>`; return; }
  const a = await holeMetar(icao);
  if (meinLauf !== lauf) return;
  const fuss = `<p class="mf-quelle">${escapeHtml(tx['quelle']!)}</p>`;
  if (!a || !a.metar) {
    b.inhalt.innerHTML = `<p class="mf-zeit">${escapeHtml(icao)}</p><p class="mf-hinweis">${escapeHtml(tx[a ? (a.erreichbar ? 'keine' : 'weg') : 'weg']!)}</p>${fuss}`;
    return;
  }
  const k = metarKlartext(a.metar.roh, s);
  const zeit = new Date(a.metar.zeit);
  const alter = Date.now() - zeit.getTime();
  const uhr = uhrUtc(zeit);
  const kopf = `${escapeHtml(icao)} · ${escapeHtml(tx['beobachtet']!)} ${uhr}, ${escapeHtml(alterText(alter, s))}`
    + (alter > ALT_MS ? ` · <span class="mf-alt">${escapeHtml(tx['alt']!)}</span>` : '');
  const zeilen = k.zeilen.map((z) => `<dt>${escapeHtml(z.titel)}</dt><dd>${escapeHtml(z.text)}</dd>`).join('');
  b.inhalt.innerHTML = `<p class="mf-zeit">${kopf}</p><dl class="mf-liste">${zeilen}</dl>`
    + `<p class="mf-roh-titel">${escapeHtml(tx['roh']!)}</p><code class="mf-roh">${escapeHtml(a.metar.roh)}</code>${fuss}`;
}
