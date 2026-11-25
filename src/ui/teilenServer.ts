import type { BriefingAbschnitt } from '@/briefing';
import { aktuelleSprache } from '@/shell/sprache';
import { liesSitzungsToken, liesEigeneNutzerId } from '@/shell/session';
import { holeToerne, schreibeBriefing, type ToernZeile, type BriefingQuelle } from '@/data/toernApi';
import { escapeHtml } from '@/core/html';

let toerneCache: ToernZeile[] | null = null;

const LOKALER_SPEICHER_SCHLUESSEL = 'sail-suite:briefing-toern';

async function holeEigeneOffeneToerne(token: string): Promise<ToernZeile[]> {
  if (toerneCache) return toerneCache;
  const eigeneId = liesEigeneNutzerId();
  const alle = await holeToerne(token);
  if (!alle) return [];
  const gefiltert = alle.filter((t) => t.besitzer === eigeneId && !t.archiviert_am);
  toerneCache = gefiltert;
  return gefiltert;
}

export function initServerTeilen(abschnitte: BriefingAbschnitt[], datum: Date, quelle: BriefingQuelle = 'coursecast'): void {
  const btn = document.getElementById('btn-teilen-crew') as HTMLButtonElement | null;
  const panel = document.getElementById('teilen-panel') as HTMLDivElement | null;
  const auswahl = document.getElementById('teilen-toern-auswahl') as HTMLSelectElement | null;
  const bestaetigen = document.getElementById('btn-teilen-bestaetigen') as HTMLButtonElement | null;
  const status = document.getElementById('teilen-status');
  if (!btn || !panel || !auswahl || !bestaetigen || !status) return;

  const token = liesSitzungsToken();
  if (!token) { btn.hidden = true; return; }
  btn.hidden = false;

  const en = aktuelleSprache() === 'en';
  status.textContent = '';

  const setzePanelOffen = (offen: boolean): void => {
    panel.hidden = !offen;
    btn.setAttribute('aria-expanded', String(offen));
  };

  btn.onclick = () => {
    void (async () => {
      if (!panel.hidden) { setzePanelOffen(false); return; }
      status.textContent = en ? 'Loading your voyages …' : 'Lädt deine Törns …';
      setzePanelOffen(true);
      const toerne = await holeEigeneOffeneToerne(token);
      if (toerne.length === 0) {
        status.textContent = en
          ? 'No voyage of yours in VoyageBook yet: create one there first.'
          : 'Noch kein eigener Törn in TörnBuch: leg dort zuerst einen an.';
        auswahl.hidden = true;
        bestaetigen.hidden = true;
        return;
      }
      auswahl.hidden = false;
      bestaetigen.hidden = false;
      status.textContent = '';

      auswahl.innerHTML = toerne.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
      const gemerkt = localStorage.getItem(LOKALER_SPEICHER_SCHLUESSEL);
      if (gemerkt && toerne.some((t) => t.id === gemerkt)) auswahl.value = gemerkt;
    })();
  };

  bestaetigen.onclick = () => {
    void (async () => {
      const toernId = auswahl.value;
      if (!toernId) return;
      const titel = document.getElementById('brief-titel')?.textContent?.trim()
        || (en ? 'CourseCast: Briefing' : 'Tagesplanung: Briefing');
      bestaetigen.disabled = true;
      status.textContent = en ? 'Sharing …' : 'Teilt …';
      const fuerDatum = `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}-${String(datum.getUTCDate()).padStart(2, '0')}`;
      const ok = await schreibeBriefing(token, toernId, titel, abschnitte, fuerDatum, quelle);
      bestaetigen.disabled = false;
      if (!ok) {
        status.textContent = en
          ? 'Sharing failed: please try again later.'
          : 'Teilen fehlgeschlagen: bitte später erneut versuchen.';
        return;
      }
      try { localStorage.setItem(LOKALER_SPEICHER_SCHLUESSEL, toernId); } catch {  }
      status.textContent = en ? '✓ Shared.' : '✓ Geteilt.';
      window.setTimeout(() => setzePanelOffen(false), 1500);
    })();
  };
}
