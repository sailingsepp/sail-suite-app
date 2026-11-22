import L from 'leaflet';
import { API_BASIS } from '@/shell/api';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { icon } from '@/shell/icons';


export type LuftbildStand = 'aus' | 'laedt' | 'an' | 'fehlt';

export interface Luftbild {
  stand(): LuftbildStand;
  an(): boolean;
  setze(an: boolean): Promise<void>;
  
  beiWechsel(f: () => void): void;
}

const TEXT = {
  de: { luftbild: 'Luftbild', laedt: 'Luftbild lädt', fehlt: 'Luftbild nicht verfügbar', quellen: 'Quellen' },
  en: { luftbild: 'Aerial imagery', laedt: 'Aerial imagery loading', fehlt: 'Aerial imagery unavailable', quellen: 'Sources' },
} as const;
const t = () => TEXT[aktuelleSprache() === 'en' ? 'en' : 'de'];

export const LUFTBILD_PANE = 'luftbild';

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


export function luftbildNennung(quellen: string, sprache: 'de' | 'en'): string {
  return `Powered by <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> · ${TEXT[sprache].quellen}: ${escHtml(quellen)}`;
}

export function luftbildAuf(karte: L.Map, opt: { speicher: string; nennungsFeld: boolean }): Luftbild {
  if (!karte.getPane(LUFTBILD_PANE)) karte.createPane(LUFTBILD_PANE).style.zIndex = '220';
  let ebene: L.TileLayer | null = null;
  let zustand: LuftbildStand = 'aus';
  let quellen = '';
  let feld: L.Control | null = null;
  let gesetzteNennung = '';
  const rueckrufe: (() => void)[] = [];
  const melde = () => { for (const f of rueckrufe) f(); };

  const nennung = () => luftbildNennung(quellen, aktuelleSprache() === 'en' ? 'en' : 'de');
  function zeigeNennung(an: boolean): void {
    if (!opt.nennungsFeld) {
      if (gesetzteNennung) karte.attributionControl?.removeAttribution(gesetzteNennung);
      gesetzteNennung = an ? nennung() : '';
      if (an) karte.attributionControl?.addAttribution(gesetzteNennung);
      return;
    }
    if (!an) { feld?.remove(); return; }
    if (!feld) {
      const Feld = L.Control.extend({
        onAdd: () => {
          const el = L.DomUtil.create('div', 'leaflet-control-attribution leaflet-control luftbild-nennung');
          L.DomEvent.disableClickPropagation(el);
          return el;
        },
      });
      feld = new Feld({ position: 'bottomleft' });
    }
    feld.addTo(karte);
    const el = feld.getContainer();
    if (el) el.innerHTML = nennung();
  }

  async function setze(an: boolean): Promise<void> {
    try { localStorage.setItem(opt.speicher, an ? '1' : '0'); } catch {  }
    if (!an) {
      ebene?.remove();
      zeigeNennung(false);
      zustand = 'aus';
      melde();
      return;
    }
    if (ebene) { ebene.addTo(karte); zeigeNennung(true); zustand = 'an'; melde(); return; }
    zustand = 'laedt';
    melde();
    try {
      const r = await fetch(`${API_BASIS}/api/luftbildkarte`, { signal: AbortSignal.timeout(20_000) });
      const d = r.ok ? await r.json() as { kacheln?: unknown; quellen?: unknown; maxZoom?: unknown } : null;
      if (!d || typeof d.kacheln !== 'string' || typeof d.quellen !== 'string' || !d.quellen) throw new Error('ohne Ebene');
      if (zustand !== 'laedt') return;
      quellen = d.quellen;
      ebene = L.tileLayer(d.kacheln, {
        pane: LUFTBILD_PANE, maxZoom: 19, maxNativeZoom: Math.min(typeof d.maxZoom === 'number' ? d.maxZoom : 19, 19),
        crossOrigin: 'anonymous',
      });
      ebene.addTo(karte);
      zeigeNennung(true);
      zustand = 'an';
    } catch {
      if (zustand === 'laedt') zustand = 'fehlt';
    }
    melde();
  }

  aufSprachwechsel(() => { if (zustand === 'an') zeigeNennung(true); });
  let gemerkt = false;
  try { gemerkt = localStorage.getItem(opt.speicher) === '1'; } catch {  }
  if (gemerkt) void setze(true);

  return {
    stand: () => zustand,
    an: () => zustand === 'an' || zustand === 'laedt',
    setze,
    beiWechsel: (f) => { rueckrufe.push(f); },
  };
}


export function luftbildKnopf(lb: Luftbild, klasse: string): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = `luftbild-knopf ${klasse}`;
  k.innerHTML = `${icon('luftbild')}<span class="luftbild-strich" aria-hidden="true"></span>`;
  const beschrifte = () => {
    const s = lb.stand();
    const text = s === 'laedt' ? t().laedt : s === 'fehlt' ? t().fehlt : t().luftbild;
    k.title = text;
    k.setAttribute('aria-label', text);
    k.setAttribute('aria-pressed', String(s === 'an'));
    k.dataset['stand'] = s;
  };
  k.addEventListener('click', (e) => { e.stopPropagation(); void lb.setze(!lb.an()); });
  lb.beiWechsel(beschrifte);
  aufSprachwechsel(beschrifte);
  beschrifte();
  return k;
}
