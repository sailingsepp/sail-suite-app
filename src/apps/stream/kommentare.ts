import { datumUhrLtVon } from '@/core/time';
import { escapeHtml } from '@/core/html';
import type { Sprache } from '@/core/types';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { macheWischbar, wischZeile } from '@/shell/wischListe';



export interface Kommentar { id: string; name: string; text: string; t: string }


export const NAME_MAX = 60;
export const TEXT_MAX = 1000;


export function kommentarZeit(iso: string, sprache: Sprache): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return datumUhrLtVon(d.getTime(), sprache === 'de' ? 'de' : 'en', { weekday: 'short', day: 'numeric', month: 'numeric' });
}


export function blasenHtml(liste: readonly Kommentar[], sprache: Sprache, leer: string, loeschen?: string): string {
  if (!liste.length) return `<p class="st-leer">${escapeHtml(leer)}</p>`;
  return `<ol class="st-blasen">${liste.map((k) => {
    const inhalt = `<p class="st-blase-kopf"><b>${escapeHtml(k.name)}</b> <time datetime="${escapeHtml(k.t)}">${escapeHtml(kommentarZeit(k.t, sprache))}</time></p>`
      + `<p class="st-blase">${escapeHtml(k.text)}</p>`;
    return `<li class="st-blase-zeile">${loeschen ? wischZeile(k.id, inhalt, loeschen) : inhalt}</li>`;
  }).join('')}</ol>`;
}

interface Umgebung {
  api: (pfad: string) => string;
  wort: (s: string, ersatz?: Record<string, string>) => string;
  sprache: Sprache;
}


function angemeldet(): boolean {
  try { return document.cookie.split(';').some((c) => c.trim().startsWith('angemeldet=') && c.trim().length > 'angemeldet='.length); } catch { return false; }
}


export function anmeldeZiel(hier: string): string {
  return `/?login=1&next=${encodeURIComponent(hier)}`;
}

function liesName(): string {
  try { return localStorage.getItem(SCHLUESSEL.streamName) ?? ''; } catch { return ''; }
}
function merkeName(n: string): void {
  try { localStorage.setItem(SCHLUESSEL.streamName, n); } catch {  }
}


export function initKommentare(u: Umgebung): { lade: () => Promise<void> } {
  const $ = (id: string) => document.getElementById(id);
  const kopfKnopf = $('st-kommentieren') as HTMLButtonElement;
  const kachel = $('st-kommentare-bereich')!;
  const liste = $('st-kommentare')!;
  const dialog = $('st-kommentar-dialog') as HTMLDialogElement;
  const form = $('st-kommentar-form') as HTMLFormElement;
  const feldName = $('st-kommentar-name') as HTMLInputElement;
  const feldText = $('st-kommentar-text') as HTMLTextAreaElement;
  const meldung = $('st-kommentar-meldung')!;
  const senden = $('st-kommentar-senden') as HTMLButtonElement;
  let anzahl = 0;
  let darfLoeschen = false;

  feldName.maxLength = NAME_MAX;
  feldText.maxLength = TEXT_MAX;

  const zeigeAnzahl = () => { kopfKnopf.textContent = u.wort('kommentieren.n', { n: String(anzahl) }); };
  zeigeAnzahl();

  const zeige = (k: readonly Kommentar[]) => {
    anzahl = k.length;
    zeigeAnzahl();
    liste.innerHTML = blasenHtml(k, u.sprache, u.wort('kommentare.leer'), darfLoeschen ? u.wort('kommentar.loeschen') : undefined);
  };

  
  macheWischbar(liste, (id, knopf) => {
    if (!window.confirm(u.wort('kommentar.loeschenFrage'))) return false;
    knopf.disabled = true;
    void (async () => {
      try {
        const r = await fetch(u.api(`/kommentare/${encodeURIComponent(id)}`), { method: 'DELETE', credentials: 'include' });
        if (!r.ok && r.status !== 404) window.alert(u.wort('kommentar.loeschenFehler'));
      } catch {
        window.alert(u.wort('kommentar.loeschenFehler'));
      }
      await lade();
    })();
    return true;
  });

  const oeffne = () => {
    meldung.textContent = '';
    if (!feldName.value) feldName.value = liesName();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    (feldName.value ? feldText : feldName).focus();
  };
  const schliesse = () => { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); };

  
  kopfKnopf.addEventListener('click', () => {
    kachel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
  $('st-kommentar-neu')!.addEventListener('click', oeffne);
  $('st-kommentar-abbrechen')!.addEventListener('click', schliesse);
  
  dialog.addEventListener('click', (e) => { if (e.target === dialog) schliesse(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = feldName.value.trim(), text = feldText.value.trim();
    if (!name || !text) { meldung.textContent = u.wort('kommentar.fehlt'); return; }
    senden.disabled = true;
    meldung.textContent = '';
    void (async () => {
      try {
        const r = await fetch(u.api('/kommentare'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, text }),
        });
        if (r.status === 429) { meldung.textContent = u.wort('kommentar.zuViele'); return; }
        if (!r.ok) { meldung.textContent = u.wort('kommentar.fehler'); return; }
        merkeName(name);
        feldText.value = '';
        schliesse();
        await lade();
        liste.lastElementChild?.lastElementChild?.scrollIntoView({ block: 'nearest' });
      } catch {
        meldung.textContent = u.wort('kommentar.fehler');
      } finally {
        senden.disabled = false;
      }
    })();
  });

  async function lade(): Promise<void> {
    try {
      
      const r = await fetch(u.api('/kommentare'), { credentials: 'include' });
      if (r.status === 404 || r.status === 410) { kachel.hidden = true; kopfKnopf.hidden = true; return; }
      if (!r.ok) return;
      const d = (await r.json()) as { kommentare: Kommentar[]; darfLoeschen?: boolean };
      darfLoeschen = d.darfLoeschen === true;
      
      
      const zeile = $('st-kommentar-anmelden-zeile');
      const link = $('st-kommentar-anmelden') as HTMLAnchorElement | null;
      if (zeile && link) {
        zeile.hidden = darfLoeschen || angemeldet();
        link.href = anmeldeZiel(location.pathname + location.search);
      }
      kachel.hidden = false;
      kopfKnopf.hidden = false;
      zeige(d.kommentare);
    } catch {  }
  }

  return { lade };
}
