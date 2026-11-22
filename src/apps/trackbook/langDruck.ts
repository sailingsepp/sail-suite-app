export const LANG_MS = 600;

const WEG_PX = 12;

export function nurLangDruck(knopf: HTMLButtonElement, aktion: () => void, kurz: () => void): void {
  knopf.style.setProperty('--lang-ms', `${LANG_MS}ms`);
  let uhr: number | null = null;
  let start: { x: number; y: number } | null = null;
  let ausgeloest = false;
  const ende = () => {
    if (uhr !== null) clearTimeout(uhr);
    uhr = null;
    start = null;
    knopf.classList.remove('drueckt');
  };
  knopf.addEventListener('pointerdown', (e) => {
    if (knopf.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    ausgeloest = false;
    start = { x: e.clientX, y: e.clientY };
    knopf.classList.add('drueckt');
    uhr = window.setTimeout(() => {
      ende();
      ausgeloest = true;
      try { navigator.vibrate?.(30); } catch {  }
      aktion();
    }, LANG_MS);
  });
  knopf.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > WEG_PX) ende();
  });
  knopf.addEventListener('pointerup', () => {
    const war = uhr !== null;
    ende();
    if (war && !ausgeloest && !knopf.disabled) kurz();
  });
  knopf.addEventListener('pointercancel', ende);
  knopf.addEventListener('pointerleave', ende);

  knopf.addEventListener('contextmenu', (e) => e.preventDefault());
  knopf.addEventListener('click', (e) => {

    if (e.detail !== 0) { e.preventDefault(); return; }
    if (!knopf.disabled) aktion();
  });
}
