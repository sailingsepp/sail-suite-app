import { sucheOrtsvorschlaege, type OrtsVorschlag } from '@/data/ortssuche';
import './ortsAutocomplete.css';
import { escapeHtml } from '@/core/html';

export function bindeOrtsAutocomplete(
  input: HTMLInputElement,
  aufAuswahl?: (vorschlag: OrtsVorschlag) => void,

  sprache: 'de' | 'en' | (() => 'de' | 'en') = 'de',
): void {
  const MIN_ZEICHEN = 3;
  const DEBOUNCE_MS = 400;

  const liste = document.createElement('ul');
  liste.className = 'orts-vorschlaege';
  liste.setAttribute('role', 'listbox');
  liste.hidden = true;
  input.insertAdjacentElement('afterend', liste);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('autocomplete', 'off');

  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let treffer: OrtsVorschlag[] = [];
  let aktiv = -1;

  function schliessen(): void {
    liste.hidden = true;
    liste.innerHTML = '';
    treffer = [];
    aktiv = -1;
    input.setAttribute('aria-expanded', 'false');
  }

  function auswaehlen(v: OrtsVorschlag): void {
    input.value = v.anzeige;
    schliessen();
    aufAuswahl?.(v);
  }

  function render(): void {
    if (!treffer.length) { schliessen(); return; }
    liste.innerHTML = treffer.map((v, i) =>
      `<li role="option" aria-selected="${i === aktiv}" class="${i === aktiv ? 'active' : ''}">${escapeHtml(v.anzeige)}</li>`,
    ).join('');
    liste.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    [...liste.children].forEach((li, i) => {
      li.addEventListener('mousedown', (e) => { e.preventDefault(); auswaehlen(treffer[i]!); });
    });
  }

  async function suchen(query: string): Promise<void> {
    controller?.abort();
    controller = new AbortController();
    treffer = await sucheOrtsvorschlaege(query, controller.signal, 8, typeof sprache === 'function' ? sprache() : sprache);
    aktiv = -1;
    render();
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
    else if (e.key === 'Enter') { if (aktiv >= 0) { e.preventDefault(); auswaehlen(treffer[aktiv]!); } }
    else if (e.key === 'Escape') { schliessen(); }
  });

  input.addEventListener('blur', () => setTimeout(schliessen, 150));
}
