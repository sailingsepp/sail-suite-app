import type { Sprache } from '@/core/types';

let offeneAbschnitte: Set<string> = new Set(['wetter']);

const BRIEF_BREIT = 640;
const BRIEF_ENG = 480;

export function istOffen(id: string): boolean {
  return offeneAbschnitte.has(id);
}

let briefAufraeumen: (() => void) | null = null;

function scrollBehaelter(el: HTMLElement): HTMLElement | null {
  for (let e = el.parentElement; e; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY;
    if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e;
  }
  return null;
}

export function bindeBriefing(wurzel: ParentNode, sprache: Sprache): void {
  briefAufraeumen?.();
  const brief = wurzel.querySelector<HTMLElement>('.brief');
  if (!brief || !brief.querySelector('.brief-abschnitt')) return;
  const en = sprache === 'en';
  const karten = Array.from(brief.querySelectorAll<HTMLElement>('.brief-abschnitt'));
  const nav = Array.from(brief.querySelectorAll<HTMLButtonElement>('.brief-inhalt-knopf'));
  const alle = brief.querySelector<HTMLButtonElement>('.brief-alle');
  const breit = (): boolean => brief.classList.contains('brief-breit');

  const setzeOffen = (karte: HTMLElement, auf: boolean): void => {
    const kopf = karte.querySelector<HTMLButtonElement>('.brief-ab-kopf');
    const text = karte.querySelector<HTMLElement>('.brief-ab-text');
    kopf?.setAttribute('aria-expanded', String(auf));
    if (text) text.hidden = !auf;
  };
  const zeigeZustand = (): void => {
    for (const k of karten) setzeOffen(k, breit() || offeneAbschnitte.has(k.dataset['id'] ?? ''));
    const alleOffen = karten.every((k) => offeneAbschnitte.has(k.dataset['id'] ?? ''));
    if (alle) {
      alle.textContent = alleOffen ? (en ? 'Collapse all' : 'Alle zuklappen') : (en ? 'Expand all' : 'Alle aufklappen');
      alle.setAttribute('aria-expanded', String(alleOffen));
    }
  };
  for (const k of karten) {
    k.querySelector('.brief-ab-kopf')?.addEventListener('click', () => {
      if (breit()) return;
      const id = k.dataset['id'] ?? '';
      if (offeneAbschnitte.has(id)) offeneAbschnitte.delete(id); else offeneAbschnitte.add(id);
      zeigeZustand();
    });
  }
  alle?.addEventListener('click', () => {
    const alleOffen = karten.every((k) => offeneAbschnitte.has(k.dataset['id'] ?? ''));
    offeneAbschnitte = alleOffen ? new Set() : new Set(karten.map((k) => k.dataset['id'] ?? ''));
    zeigeZustand();
  });

  const markiere = (id: string): void => {
    for (const n of nav) {
      const an = n.dataset['ziel'] === id;
      n.classList.toggle('aktiv', an);
      if (an) n.setAttribute('aria-current', 'true'); else n.removeAttribute('aria-current');
    }
  };
  const behaelter = scrollBehaelter(brief);
  const oben = (): number => (behaelter ? behaelter.getBoundingClientRect().top : 0);
  for (const n of nav) {
    n.addEventListener('click', () => {
      const ziel = brief.querySelector<HTMLElement>(`#brief-ab-${n.dataset['ziel']}`);
      if (!ziel) return;
      const versatz = ziel.getBoundingClientRect().top - oben() - 12;
      if (behaelter) behaelter.scrollTo({ top: behaelter.scrollTop + versatz, behavior: 'smooth' });
      else window.scrollTo({ top: window.scrollY + versatz, behavior: 'smooth' });
      markiere(n.dataset['ziel'] ?? '');
      ziel.querySelector<HTMLElement>('.brief-ab-kopf')?.focus({ preventScroll: true });
    });
  }
  const beimScrollen = (): void => {
    if (!breit()) return;
    let aktuell = karten[0]?.dataset['id'] ?? '';
    for (const k of karten) if (k.getBoundingClientRect().top - oben() < 140) aktuell = k.dataset['id'] ?? aktuell;
    markiere(aktuell);
  };
  const quelle: HTMLElement | Window = behaelter ?? window;
  quelle.addEventListener('scroll', beimScrollen, { passive: true });

  const messen = (): void => {
    const w = brief.clientWidth;
    brief.classList.toggle('brief-breit', w >= BRIEF_BREIT);
    brief.classList.toggle('brief-eng', w < BRIEF_ENG);
    zeigeZustand();
    beimScrollen();
  };
  const ro = new ResizeObserver(messen);
  ro.observe(brief);
  messen();
  briefAufraeumen = () => { ro.disconnect(); quelle.removeEventListener('scroll', beimScrollen); };
}

