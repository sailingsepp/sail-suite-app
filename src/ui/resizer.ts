import { SCHLUESSEL } from '@/shell/speicherschluessel';

const STORAGE_KEY = SCHLUESSEL.seitenleiste;
const RESIZER_WIDTH = 6;
const MIN_SIDEBAR = 360;
const MAX_SIDEBAR = 900;
const MIN_MAP = 360;
const KEY_STEP = 24;

const RESULTS_SIDEBAR = 820;

function clampWidth(width: number, appWidth: number): number {
  const max = Math.min(MAX_SIDEBAR, appWidth - RESIZER_WIDTH - MIN_MAP);
  return Math.min(Math.max(width, MIN_SIDEBAR), Math.max(MIN_SIDEBAR, max));
}

export function widenForResults(): void {
  if (localStorage.getItem(STORAGE_KEY)) return;
  const app = document.querySelector<HTMLElement>('.app');
  if (!app) return;
  const rect = app.getBoundingClientRect();
  if (rect.width === 0) return;
  document.documentElement.style.setProperty('--sidebar-width', `${clampWidth(RESULTS_SIDEBAR, rect.width)}px`);
}

export function initColResizer(onResize?: () => void): void {
  const resizer = document.getElementById('col-resizer');
  const app = document.querySelector<HTMLElement>('.app');
  const sidebar = document.querySelector<HTMLElement>('.col-side');
  if (!resizer || !app || !sidebar) return;

  const apply = (width: number): void => {
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    resizer.setAttribute('aria-valuenow', String(Math.round(width)));
  };

  const stored = Number(localStorage.getItem(STORAGE_KEY));
  if (stored > 0) apply(clampWidth(stored, app.getBoundingClientRect().width));

  let dragging = false;
  let rafId = 0;

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const rect = app.getBoundingClientRect();
      apply(clampWidth(rect.right - e.clientX - RESIZER_WIDTH, rect.width));
      onResize?.();
    });
  };

  const stopDragging = (): void => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(STORAGE_KEY, String(Math.round(sidebar.getBoundingClientRect().width)));
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  };

  resizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
  });

  resizer.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const rect = app.getBoundingClientRect();
    const current = sidebar.getBoundingClientRect().width;
    const delta = e.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP;
    const width = clampWidth(current + delta, rect.width);
    apply(width);
    onResize?.();
    localStorage.setItem(STORAGE_KEY, String(Math.round(width)));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth < 900) return;
    const rect = app.getBoundingClientRect();
    const current = sidebar.getBoundingClientRect().width;
    const clamped = clampWidth(current, rect.width);
    if (Math.abs(clamped - current) > 1) apply(clamped);
  });
}

const HOEHE_KEY = SCHLUESSEL.kartenhoehe;
const MIN_MAP_HEIGHT = 180;

const MIN_REST_HEIGHT = 150;

function clampHeight(hoehe: number, spalteHoehe: number): number {
  const max = Math.max(MIN_MAP_HEIGHT, spalteHoehe - MIN_REST_HEIGHT);
  return Math.min(Math.max(hoehe, MIN_MAP_HEIGHT), max);
}

export function initRowResizer(onResize?: () => void): void {
  const resizer = document.getElementById('row-resizer');
  const colMap = document.getElementById('col-map');
  const map = document.getElementById('map');
  if (!resizer || !colMap || !map) return;

  const apply = (hoehe: number): void => {
    document.documentElement.style.setProperty('--map-height', `${Math.round(hoehe)}px`);
    colMap.setAttribute('data-map-height', '');
    resizer.setAttribute('aria-valuenow', String(Math.round(hoehe)));
  };

  const spalteHoehe = (): number => colMap.getBoundingClientRect().height;

  const gespeichert = Number(localStorage.getItem(HOEHE_KEY));
  if (gespeichert > 0) apply(clampHeight(gespeichert, spalteHoehe()));

  let ziehend = false;
  let rafId = 0;

  const onPointerMove = (e: PointerEvent): void => {
    if (!ziehend || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      const oben = map.getBoundingClientRect().top;
      apply(clampHeight(e.clientY - oben, spalteHoehe()));
      onResize?.();
    });
  };

  const stopDragging = (): void => {
    if (!ziehend) return;
    ziehend = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem(HOEHE_KEY, String(Math.round(map.getBoundingClientRect().height)));
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
  };

  resizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    ziehend = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDragging);
  });

  resizer.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const aktuell = map.getBoundingClientRect().height;
    const delta = e.key === 'ArrowUp' ? -KEY_STEP : KEY_STEP;
    const hoehe = clampHeight(aktuell + delta, spalteHoehe());
    apply(hoehe);
    onResize?.();
    localStorage.setItem(HOEHE_KEY, String(Math.round(hoehe)));
  });

  window.addEventListener('resize', () => {
    if (!colMap.hasAttribute('data-map-height')) return;
    const aktuell = map.getBoundingClientRect().height;
    const geklemmt = clampHeight(aktuell, spalteHoehe());
    if (Math.abs(geklemmt - aktuell) > 1) { apply(geklemmt); onResize?.(); }
  });
}
