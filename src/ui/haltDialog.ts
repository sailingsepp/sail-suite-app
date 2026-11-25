import './haltDialog.css';
import { initModal, type ModalHandle } from '@/shell/modal';
import { HALT_MAX_MIN } from '@/core/halt';
import type { Sprache } from '@/core/types';

export interface HaltEingabe { min: number; text: string }

const TEXTE: Record<Sprache, Record<string, string>> = {
  de: {
    titel: 'Wegpunkt {n}: Aufenthalt?',
    hinweis: 'Liegt die Yacht hier eine Weile, etwa zum Tanken, rechnet die Tagesplanung die Ankunft und das Wetter danach mit dieser Zeit.',
    text: 'Was passiert dort?',
    platzhalter: 'z. B. Tankstopp, Badepause',
    dauer: 'Dauer (Minuten)',
    uebernehmen: 'Übernehmen',
    kein: 'Kein Aufenthalt',
    schliessen: 'Schließen',
    fehler: 'Bitte eine Dauer von 1 bis {max} Minuten angeben.',
  },
  en: {
    titel: 'Waypoint {n}: stop?',
    hinweis: 'If the yacht stays here for a while, for instance to refuel, CourseCast computes the arrival and the weather after that with this time.',
    text: 'What happens there?',
    platzhalter: 'e.g. fuel stop, swim break',
    dauer: 'Duration (minutes)',
    uebernehmen: 'Apply',
    kein: 'No stop',
    schliessen: 'Close',
    fehler: 'Please enter a duration of 1 to {max} minutes.',
  },
};

interface Bausatz {
  overlay: HTMLDivElement; titel: HTMLHeadingElement; hinweis: HTMLParagraphElement;
  textLabel: HTMLSpanElement; text: HTMLInputElement; dauerLabel: HTMLSpanElement; dauer: HTMLInputElement;
  fehler: HTMLParagraphElement; uebernehmen: HTMLButtonElement; kein: HTMLButtonElement; schliessen: HTMLButtonElement;
  handle: ModalHandle;
}
let bausatz: Bausatz | null = null;
let fertig: ((e: HaltEingabe | null) => void) | null = null;
let aktSprache: Sprache = 'de';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, klasse?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  return e;
}

function baue(): Bausatz {
  if (bausatz) return bausatz;
  const overlay = el('div', 'hd-overlay');
  overlay.hidden = true;
  const modal = el('div', 'hd-modal');
  modal.tabIndex = -1;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const kopf = el('div', 'hd-kopf');
  const titel = el('h2');
  titel.id = 'hd-titel';
  modal.setAttribute('aria-labelledby', titel.id);
  const schliessen = el('button', 'hd-schliessen');
  schliessen.type = 'button';
  schliessen.textContent = '✕';
  kopf.append(titel, schliessen);
  const hinweis = el('p', 'hd-hinweis');
  const textFeld = el('label', 'hd-feld');
  const textLabel = el('span');
  const text = el('input');
  text.type = 'text';
  text.maxLength = 80;
  text.autocomplete = 'off';
  textFeld.append(textLabel, text);
  const dauerFeld = el('label', 'hd-feld');
  const dauerLabel = el('span');
  const dauer = el('input');
  dauer.type = 'number';
  dauer.inputMode = 'numeric';
  dauer.min = '1';
  dauer.max = String(HALT_MAX_MIN);
  dauer.step = '5';
  dauerFeld.append(dauerLabel, dauer);
  const fehler = el('p', 'hd-fehler');
  fehler.setAttribute('role', 'alert');
  const aktionen = el('div', 'hd-aktionen');
  const uebernehmen = el('button', 'btn primary');
  uebernehmen.type = 'button';
  const kein = el('button', 'btn');
  kein.type = 'button';
  aktionen.append(uebernehmen, kein);
  modal.append(kopf, hinweis, textFeld, dauerFeld, fehler, aktionen);
  overlay.append(modal);
  document.body.append(overlay);

  const handle = initModal(modal, () => ende(null));
  bausatz = { overlay, titel, hinweis, textLabel, text, dauerLabel, dauer, fehler, uebernehmen, kein, schliessen, handle };

  const uebernimm = () => {
    const sprache = aktSprache;
    const min = Math.round(Number(dauer.value.replace(',', '.')));
    if (!Number.isFinite(min) || min < 1 || min > HALT_MAX_MIN) {
      fehler.textContent = TEXTE[sprache].fehler!.replace('{max}', String(HALT_MAX_MIN));
      dauer.focus();
      return;
    }
    ende({ min, text: text.value.trim() });
  };
  uebernehmen.addEventListener('click', uebernimm);
  for (const f of [text, dauer]) f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); uebernimm(); } });
  kein.addEventListener('click', () => ende(null));
  schliessen.addEventListener('click', () => ende(null));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) ende(null); });
  return bausatz;
}

function ende(e: HaltEingabe | null): void {
  if (!bausatz || bausatz.overlay.hidden) return;
  bausatz.overlay.hidden = true;
  bausatz.handle.beimSchliessen();
  const f = fertig;
  fertig = null;
  f?.(e);
}

export function frageHalt(nr: number, vorher: HaltEingabe | null | undefined, sprache: Sprache): Promise<HaltEingabe | null> {
  const b = baue();
  aktSprache = sprache;
  const t = TEXTE[sprache];
  b.titel.textContent = t.titel!.replace('{n}', String(nr));
  b.hinweis.textContent = t.hinweis!;
  b.textLabel.textContent = t.text!;
  b.text.placeholder = t.platzhalter!;
  b.dauerLabel.textContent = t.dauer!;
  b.uebernehmen.textContent = t.uebernehmen!;
  b.kein.textContent = t.kein!;
  b.schliessen.setAttribute('aria-label', t.schliessen!);
  b.text.value = vorher?.text ?? '';
  b.dauer.value = String(vorher?.min ?? 30);
  b.fehler.textContent = '';
  return new Promise((resolve) => {
    fertig = resolve;
    b.overlay.hidden = false;
    b.handle.beimOeffnen(undefined, b.text);
  });
}
