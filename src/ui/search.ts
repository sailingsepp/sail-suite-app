import L from 'leaflet';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { STRINGS } from './strings';
import { holeUeberServer } from '@/data/fremdProxy';
import { escapeHtml } from '@/core/html';


interface NominatimTreffer {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

const MIN_ZEICHEN = 3;
const DEBOUNCE_MS = 400;

export function addLocationSearch(map: L.Map): void {
  const SearchControl = L.Control.extend({
    onAdd(): HTMLElement {
      const container = L.DomUtil.create('div', 'search-control');
      container.innerHTML = `
        <input type="text" class="search-input" placeholder="" aria-label="">
        <ul class="search-results" role="listbox" hidden></ul>
      `;
      
      
      
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);

      const input = container.querySelector<HTMLInputElement>('.search-input')!;
      const list = container.querySelector<HTMLUListElement>('.search-results')!;

      function lokalisiere(): void {
        const dict = STRINGS[aktuelleSprache()];
        input.placeholder = dict['search.placeholder']!;
        input.setAttribute('aria-label', dict['search.ariaLabel']!);
      }
      lokalisiere();
      aufSprachwechsel(lokalisiere);
      let timer: ReturnType<typeof setTimeout> | null = null;
      let controller: AbortController | null = null;
      let treffer: NominatimTreffer[] = [];
      let aktiv = -1;

      function schliessen(): void {
        list.hidden = true;
        list.innerHTML = '';
        treffer = [];
        aktiv = -1;
      }

      function auswaehlen(t: NominatimTreffer): void {
        const [s, n, w, e] = t.boundingbox.map(Number) as [number, number, number, number];
        map.fitBounds([[s, w], [n, e]], { maxZoom: 15, padding: [20, 20] });
        input.value = t.display_name;
        schliessen();
      }

      function render(): void {
        if (!treffer.length) { schliessen(); return; }
        
        list.innerHTML = treffer.map((t, i) =>
          `<li role="option" aria-selected="${i === aktiv}" class="${i === aktiv ? 'active' : ''}">${escapeHtml(t.display_name)}</li>`,
        ).join('');
        list.hidden = false;
        [...list.children].forEach((li, i) => {
          li.addEventListener('mousedown', (e) => { e.preventDefault(); auswaehlen(treffer[i]!); });
        });
      }

      async function suchen(query: string): Promise<void> {
        controller?.abort();
        controller = new AbortController();
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6`;
          const res = await holeUeberServer(url, { signal: controller.signal });
          if (!res.ok) { schliessen(); return; }
          treffer = await res.json() as NominatimTreffer[];
          aktiv = -1;
          render();
        } catch {
          
          
        }
      }

      input.addEventListener('input', () => {
        if (timer) clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < MIN_ZEICHEN) { schliessen(); return; }
        timer = setTimeout(() => void suchen(query), DEBOUNCE_MS);
      });

      input.addEventListener('keydown', (e) => {
        if (!treffer.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); aktiv = Math.min(aktiv + 1, treffer.length - 1); render(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); aktiv = Math.max(aktiv - 1, 0); render(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (aktiv >= 0) auswaehlen(treffer[aktiv]!); }
        else if (e.key === 'Escape') { schliessen(); }
      });

      input.addEventListener('blur', () => {
        
        
        setTimeout(schliessen, 150);
      });

      return container;
    },
  });

  map.addControl(new SearchControl({ position: 'topleft' }));
}
