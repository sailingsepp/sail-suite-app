import { initModal } from './modal';
import { icon } from './icons';
import { aktuelleSprache } from './sprache';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;
export function ladePdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string;
      return lib;
    });
  }
  return pdfjsPromise;
}

let modal: HTMLDivElement | null = null;
let griff: ReturnType<typeof initModal> | null = null;
let seiten: HTMLDivElement | null = null;
let geladeneHref = '';
let aktuellerSchliessRueckruf: (() => void) | null = null;

let pdfDatei: File | null = null;
let pdfDateiPromise: Promise<File | null> | null = null;

const englisch = () => document.documentElement.lang === 'en';

function dateiname(href: string): string {
  const teil = new URL(href, location.href).pathname.split('/').pop() || '';
  return decodeURIComponent(teil) || (englisch() ? 'Handbook.pdf' : 'Handbuch.pdf');
}

function ladeDatei(href: string): void {
  pdfDatei = null;
  pdfDateiPromise = fetch(href)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => {
      const datei = new File([b], dateiname(href), { type: 'application/pdf' });
      if (geladeneHref === href) pdfDatei = datei;
      return datei;
    })
    .catch(() => null);
}

function herunterladen(datei: File): void {
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = datei.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function teile(): Promise<void> {
  const href = geladeneHref;
  if (!href) return;
  const datei = pdfDatei ?? await (pdfDateiPromise ?? Promise.resolve(null));
  if (!datei) {
    window.open(href, '_blank', 'noopener');
    return;
  }
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [datei] })) {
    try {
      await nav.share({ files: [datei], title: datei.name });
      return;
    } catch (err) {

      if ((err as DOMException)?.name === 'AbortError') return;
    }
  }
  herunterladen(datei);
}

function beschrifte(): void {
  if (!modal) return;
  const en = englisch();
  const teilenKnopf = modal.querySelector('.handbuch-modal-teilen')!;
  const text = en ? 'Share or save PDF' : 'PDF teilen oder sichern';
  teilenKnopf.setAttribute('aria-label', text);
  teilenKnopf.setAttribute('title', text);
  modal.querySelector('.handbuch-modal-schliessen')!.setAttribute('aria-label', en ? 'Close' : 'Schließen');
}

function holeModal(): HTMLDivElement {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'handbuch-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = '<div class="handbuch-modal-kopf">'
    + '<span></span>'
    + '<span class="handbuch-modal-knoepfe">'
    + `<button type="button" class="handbuch-modal-teilen">${icon('teilen')}</button>`
    + '<button type="button" class="handbuch-modal-schliessen" aria-label="Schließen">✕</button>'
    + '</span></div><div class="handbuch-modal-buehne"><div class="handbuch-modal-seiten"></div></div>';
  seiten = modal.querySelector('.handbuch-modal-seiten');
  modal.querySelector('.handbuch-modal-schliessen')!.addEventListener('click', schliesse);
  modal.querySelector('.handbuch-modal-teilen')!.addEventListener('click', () => { void teile(); });
  document.body.appendChild(modal);
  griff = initModal(modal, schliesse);
  return modal;
}

async function zeichnePdf(href: string): Promise<void> {
  if (!seiten) return;
  const en = aktuelleSprache() === 'en';
  seiten.textContent = en ? 'Loading …' : 'Lädt …';
  try {
    const lib = await ladePdfjs();
    const dok = await lib.getDocument({ url: href }).promise;
    seiten.textContent = '';

    const zielBreite = seiten.clientWidth || 320;
    for (let n = 1; n <= dok.numPages; n++) {
      const seite = await dok.getPage(n);
      const basis = seite.getViewport({ scale: 1 });
      const skala = (zielBreite / basis.width) * (window.devicePixelRatio || 1);
      const viewport = seite.getViewport({ scale: skala });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      canvas.className = 'handbuch-modal-seite';
      const ctx = canvas.getContext('2d')!;
      seiten.appendChild(canvas);
      await seite.render({ canvasContext: ctx, viewport, canvas }).promise;
    }
  } catch (err) {
    console.error('Handbuch-PDF konnte nicht gerendert werden', err);
    seiten.innerHTML = '';
    const hinweis = document.createElement('p');
    hinweis.className = 'handbuch-modal-fehler';
    hinweis.textContent = en ? 'The handbook could not be shown.' : 'Das Handbuch ließ sich nicht anzeigen.';
    const ersatzlink = document.createElement('a');
    ersatzlink.href = href;
    ersatzlink.target = '_blank';
    ersatzlink.rel = 'noopener';
    ersatzlink.textContent = en ? 'Open in a new tab' : 'In neuem Tab öffnen';
    ersatzlink.className = 'handbuch-modal-ersatzlink';
    seiten.append(hinweis, ersatzlink);
  }
}

function oeffneModal(href: string, ausloeser: HTMLElement, aufSchliessen: (() => void) | null): void {
  const m = holeModal();
  m.hidden = false;
  griff!.beimOeffnen(ausloeser);
  aktuellerSchliessRueckruf = aufSchliessen;
  beschrifte();

  if (geladeneHref !== href) {
    geladeneHref = href;
    ladeDatei(href);
    void zeichnePdf(href);
  }
}

function schliesse(): void {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  griff!.beimSchliessen();
  const rueckruf = aktuellerSchliessRueckruf;
  aktuellerSchliessRueckruf = null;
  if (rueckruf) rueckruf();
}

export function initHandbuchModal(knopfId = 'btn-handbuch'): void {
  const gefunden = document.getElementById(knopfId) as HTMLAnchorElement | null;
  if (!gefunden) return;
  const link = gefunden;

  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (!standalone) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();
    oeffneModal(link.href, link, null);
  });
}

export function oeffneHandbuchImmer(href: string, ausloeser: HTMLElement, aufSchliessen: () => void): void {
  oeffneModal(href, ausloeser, aufSchliessen);
}
