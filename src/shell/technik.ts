
import { ladePdfjs } from './handbuch';
import { initModal, type ModalHandle } from './modal';
import { aktuelleSprache, aufSprachwechsel } from './sprache';
import { woerter } from './strings';
import { icon } from './icons';
import { darfBildSpeichern } from '@/core/bild';
import { escapeHtml } from '@/core/html';
import { nf } from '@/core/time';
import {
  baueIndex, suche, seitenText, ohneTextAnteil, titelAusDateiname, normalisiere,
  type Suchindex, type Treffer,
} from '@/core/handbuchSuche';
import {
  GERAETE, ladeHandbuecher, ladeAlleSeiten, ladeDatei, speichereHandbuch, loescheHandbuch,
  handbuchKennung, geraetVorschlag, type Handbuch, type Geraet, type SeitenEintrag,
} from '@/data/technikAblage';
import './technik.css';

const wort = (s: string, e: Record<string, string | number> = {}): string =>
  (woerter(aktuelleSprache())[s] ?? s).replace(/\{(\w+)\}/g, (_, k: string) => String(e[k] ?? ''));
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

type PdfAufgabe = ReturnType<Awaited<ReturnType<typeof ladePdfjs>>['getDocument']>;


const OHNE_TEXT_AB = 0.5;

let handbuecher: Handbuch[] = [];
let index: Suchindex | null = null;
let indexLaedt: Promise<Suchindex> | null = null;
let holeYacht: () => string | null = () => null;
let datei: File | null = null;
let abbrechen = false;
let laeuft = false;
let suchUhr: ReturnType<typeof setTimeout> | null = null;
let letzteTreffer: Treffer[] = [];

let filterVonHand = false;

function mb(bytes: number): string {
  if (bytes < 1_048_576) return nf(Math.max(1, bytes / 1024), 0, aktuelleSprache()) + ' KB';
  return nf(bytes / 1_048_576, bytes < 10_485_760 ? 1 : 0, aktuelleSprache()) + ' MB';
}

function seitenName(h: Handbuch, seite: number): string {
  const name = h.seitenNamen?.[seite - 1];
  return name && name !== String(seite)
    ? wort('technik.seiteMitPdf', { name, nr: seite })
    : wort('technik.seite', { nr: seite });
}

function gleicheYacht(a: string, b: string): boolean {
  return normalisiere(a).replace(/\s+/g, ' ').trim() === normalisiere(b).replace(/\s+/g, ' ').trim();
}


function fuerYacht(yacht: string): Handbuch[] {
  return handbuecher.filter((h) => !h.yacht.trim() || gleicheYacht(h.yacht, yacht));
}

async function holeIndex(): Promise<Suchindex> {
  if (index) return index;
  if (!indexLaedt) {
    indexLaedt = ladeAlleSeiten().then((s) => {
      index = baueIndex(s);
      indexLaedt = null;
      return index;
    });
  }
  return indexLaedt;
}

function verwirfIndex(): void {
  index = null;
  indexLaedt = null;
}



function zeichneFilter(): void {
  const sel = $<HTMLSelectElement>('in-technik-filter');
  if (!sel) return;
  const vorher = sel.value;
  const yacht = holeYacht()?.trim() ?? '';
  const mitYacht = !!yacht && handbuecher.some((h) => h.yacht.trim() && gleicheYacht(h.yacht, yacht));
  const optionen: [string, string][] = [['alle', wort('technik.filterAlle')]];
  if (mitYacht) optionen.push(['yacht', wort('technik.filterYacht', { yacht })]);
  for (const h of handbuecher) optionen.push([`h:${h.id}`, h.titel]);
  sel.innerHTML = optionen.map(([w, t]) => `<option value="${escapeHtml(w)}">${escapeHtml(t)}</option>`).join('');
  const gibt = optionen.some(([w]) => w === vorher);
  sel.value = filterVonHand && gibt && vorher ? vorher : mitYacht ? 'yacht' : 'alle';
  sel.hidden = handbuecher.length < 2 && !mitYacht;
}

function filterAuswahl(): { handbuecher?: Set<string> } {
  const w = $<HTMLSelectElement>('in-technik-filter')?.value ?? 'alle';
  if (w === 'yacht') return { handbuecher: new Set(fuerYacht(holeYacht() ?? '').map((h) => h.id)) };
  if (w.startsWith('h:')) return { handbuecher: new Set([w.slice(2)]) };
  return {};
}



function zeichneListe(): void {
  const ul = $('tk-liste');
  if (!ul) return;
  if (!handbuecher.length) {
    ul.innerHTML = `<li class="tk-hinweis">${escapeHtml(wort('technik.leer'))}</li>`;
    return;
  }
  ul.innerHTML = handbuecher.map((h) => {
    const meta = [
      wort(`technik.geraet.${h.geraet}`),
      h.yacht.trim() || wort('technik.yachtAlle'),
      wort('technik.seiten', { n: h.seiten }),
      mb(h.bytes),
    ].map(escapeHtml).join(' · ');
    const scan = h.ohneText >= OHNE_TEXT_AB
      ? `<span class="tk-warnung">${escapeHtml(wort('technik.ohneText'))}</span>` : '';
    return `<li class="tk-handbuch">
      <div class="tk-handbuch-text"><strong>${escapeHtml(h.titel)}</strong><span>${meta}</span>${scan}</div>
      <div class="tk-handbuch-knoepfe">
        <button type="button" class="btn" data-technik-oeffnen="${escapeHtml(h.id)}">${escapeHtml(wort('technik.oeffnen'))}</button>
        <button type="button" class="btn ghost" data-technik-loeschen="${escapeHtml(h.id)}" aria-label="${escapeHtml(wort('technik.loeschenAria', { titel: h.titel }))}">${escapeHtml(wort('technik.loeschen'))}</button>
      </div></li>`;
  }).join('');
}

async function ladeListe(): Promise<void> {
  handbuecher = await ladeHandbuecher();
  zeichneListe();
  zeichneFilter();
}



function zeichneTreffer(treffer: Treffer[], anfrage: string): void {
  const ol = $('tk-treffer');
  const status = $('tk-suchstatus');
  if (!ol || !status) return;
  letzteTreffer = treffer;
  if (!anfrage.trim()) {
    ol.innerHTML = '';
    status.textContent = handbuecher.length ? '' : wort('technik.sucheOhneHandbuch');
    return;
  }
  if (!handbuecher.length) {
    ol.innerHTML = '';
    status.textContent = wort('technik.sucheOhneHandbuch');
    return;
  }
  status.textContent = treffer.length
    ? wort(treffer.length === 1 ? 'technik.einTreffer' : 'technik.treffer', { n: treffer.length })
    : wort('technik.keineTreffer');
  const nachId = new Map(handbuecher.map((h) => [h.id, h]));
  ol.innerHTML = treffer.map((t, i) => {
    const h = nachId.get(t.handbuch);
    if (!h) return '';
    const auszug = t.auszug.map((a) => (a.treffer ? `<mark>${escapeHtml(a.text)}</mark>` : escapeHtml(a.text))).join('');
    const teil = t.abgedeckt < t.begriffe
      ? `<span class="tk-teil">${escapeHtml(wort('technik.teilweise', { a: t.abgedeckt, b: t.begriffe }))}</span>` : '';
    return `<li><button type="button" class="tk-treffer-knopf" data-technik-treffer="${i}">
      <span class="tk-treffer-kopf"><strong>${escapeHtml(h.titel)}</strong> · ${escapeHtml(seitenName(h, t.seite))}${teil}</span>
      <span class="tk-auszug">${auszug}</span></button></li>`;
  }).join('');
}

async function sucheJetzt(): Promise<void> {
  const anfrage = $<HTMLInputElement>('in-technik-suche')?.value ?? '';
  if (!anfrage.trim() || !handbuecher.length) { zeichneTreffer([], anfrage); return; }
  const status = $('tk-suchstatus');
  if (!index && status) status.textContent = wort('technik.indexLaedt');
  const ix = await holeIndex();
  
  if (($<HTMLInputElement>('in-technik-suche')?.value ?? '') !== anfrage) return;
  zeichneTreffer(suche(ix, anfrage, filterAuswahl()), anfrage);
}

function planeSuche(): void {
  if (suchUhr) clearTimeout(suchUhr);
  suchUhr = setTimeout(() => { void sucheJetzt(); }, 150);
}



function setzeStatus(text: string, fehler = false): void {
  const s = $('tk-status');
  if (!s) return;
  s.textContent = text;
  s.classList.toggle('tk-status-fehler', fehler);
}

function fuelleGeraete(): void {
  const sel = $<HTMLSelectElement>('in-technik-geraet');
  if (!sel) return;
  const vorher = sel.value;
  sel.innerHTML = GERAETE.map((g) => `<option value="${g}">${escapeHtml(wort(`technik.geraet.${g}`))}</option>`).join('');
  if (vorher) sel.value = vorher;
}

function zeigeFormular(f: File | null): void {
  datei = f;
  const form = $('tk-neu');
  if (!form) return;
  form.hidden = !f;
  $('btn-technik-datei')!.hidden = !!f;
  if (!f) return;
  $('tk-dateiname')!.textContent = `${f.name} · ${mb(f.size)}`;
  $<HTMLInputElement>('in-technik-titel')!.value = titelAusDateiname(f.name);
  $<HTMLSelectElement>('in-technik-geraet')!.value = geraetVorschlag(f.name);
  $<HTMLInputElement>('in-technik-yacht')!.value = holeYacht()?.trim() ?? '';
  setzeStatus('');
}

function istPdf(f: File): boolean {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
}

async function speicherFrei(bytes: number): Promise<boolean> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return true;
    return darfBildSpeichern(e.usage ?? 0, e.quota ?? 0, bytes).ok;
  } catch {
    return true;
  }
}

function sperreFormular(an: boolean): void {
  for (const id of ['in-technik-titel', 'in-technik-geraet', 'in-technik-yacht', 'btn-technik-indexieren']) {
    const el = $<HTMLInputElement>(id);
    if (el) el.disabled = an;
  }
}

async function indexiere(): Promise<void> {
  const f = datei;
  if (!f || laeuft) return;
  const titel = $<HTMLInputElement>('in-technik-titel')!.value.trim() || titelAusDateiname(f.name);
  const geraet = $<HTMLSelectElement>('in-technik-geraet')!.value as Geraet;
  const yacht = $<HTMLInputElement>('in-technik-yacht')!.value.trim();

  const doppelt = handbuecher.find((h) => h.dateiname === f.name && h.bytes === f.size);
  if (doppelt) { setzeStatus(wort('technik.doppelt', { titel: doppelt.titel }), true); return; }
  
  if (!(await speicherFrei(f.size * 1.3))) { setzeStatus(wort('technik.speicherVoll'), true); return; }

  laeuft = true;
  abbrechen = false;
  sperreFormular(true);
  setzeStatus(wort('technik.liest'));
  let aufgabe: PdfAufgabe | null = null;
  try {
    const lib = await ladePdfjs();
    aufgabe = lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) });
    const dok = await aufgabe.promise;
    const id = handbuchKennung();
    const seiten: SeitenEintrag[] = [];
    for (let n = 1; n <= dok.numPages; n++) {
      if (abbrechen) { setzeStatus(wort('technik.abgebrochen')); return; }
      const seite = await dok.getPage(n);
      const inhalt = await seite.getTextContent();
      seiten.push({ handbuch: id, seite: n, text: seitenText(inhalt.items as { str?: string; hasEOL?: boolean }[]) });
      seite.cleanup();
      if (n % 5 === 0 || n === dok.numPages) setzeStatus(wort('technik.fortschritt', { n, von: dok.numPages }));
    }
    let seitenNamen: string[] | null = null;
    try { seitenNamen = await dok.getPageLabels(); } catch { seitenNamen = null; }
    const h: Handbuch = {
      id, titel, geraet, yacht, dateiname: f.name, bytes: f.size, seiten: dok.numPages,
      seitenNamen, ohneText: ohneTextAnteil(seiten), angelegt: Date.now(),
    };
    try { await navigator.storage?.persist?.(); } catch {  }
    if (!(await speichereHandbuch(h, seiten, f))) { setzeStatus(wort('technik.speichernFehler'), true); return; }
    verwirfIndex();
    await ladeListe();
    zeigeFormular(null);
    setzeStatus(wort('technik.gespeichert', { titel, n: h.seiten })
      + (h.ohneText >= OHNE_TEXT_AB ? ' ' + wort('technik.ohneTextLang') : ''), h.ohneText >= OHNE_TEXT_AB);
    planeSuche();
  } catch (err) {
    const name = (err as { name?: string })?.name;
    setzeStatus(wort(name === 'PasswordException' ? 'technik.passwort' : 'technik.lesefehler'), true);
  } finally {
    laeuft = false;
    sperreFormular(false);
    void aufgabe?.destroy();
  }
}

async function loesche(id: string): Promise<void> {
  const h = handbuecher.find((x) => x.id === id);
  if (!h) return;
  if (!window.confirm(wort('technik.loeschenFrage', { titel: h.titel }))) return;
  if (!(await loescheHandbuch(id))) { setzeStatus(wort('technik.speichernFehler'), true); return; }
  if (ansicht.handbuch?.id === id) schliesseAnsicht();
  verwirfIndex();
  await ladeListe();
  setzeStatus(wort('technik.geloescht', { titel: h.titel }));
  planeSuche();
}



const ansicht: {
  el: HTMLDivElement | null; griff: ModalHandle | null; handbuch: Handbuch | null; aufgabe: PdfAufgabe | null;
  seite: number; markiere: Set<string>; zeichnet: number;
} = { el: null, griff: null, handbuch: null, aufgabe: null, seite: 1, markiere: new Set(), zeichnet: 0 };

function holeAnsicht(): HTMLDivElement {
  if (ansicht.el) return ansicht.el;
  const m = document.createElement('div');
  m.className = 'handbuch-modal tk-ansicht';
  m.hidden = true;
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-modal', 'true');
  m.innerHTML = `<div class="handbuch-modal-kopf">
      <span class="tk-ansicht-titel"></span>
      <span class="handbuch-modal-knoepfe">
        <button type="button" class="handbuch-modal-teilen tk-zurueck">‹</button>
        <span class="tk-seitenzahl" aria-live="polite"></span>
        <button type="button" class="handbuch-modal-teilen tk-weiter">›</button>
        <button type="button" class="handbuch-modal-schliessen">✕</button>
      </span></div>
    <div class="handbuch-modal-buehne"><div class="handbuch-modal-seiten"></div></div>`;
  m.querySelector('.handbuch-modal-schliessen')!.addEventListener('click', schliesseAnsicht);
  m.querySelector('.tk-zurueck')!.addEventListener('click', () => blaettere(-1));
  m.querySelector('.tk-weiter')!.addEventListener('click', () => blaettere(1));
  m.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') blaettere(-1);
    if (e.key === 'ArrowRight') blaettere(1);
  });
  document.body.appendChild(m);
  ansicht.el = m;
  ansicht.griff = initModal(m, schliesseAnsicht);
  return m;
}

function beschrifteAnsicht(): void {
  const m = ansicht.el;
  const h = ansicht.handbuch;
  if (!m || !h) return;
  m.querySelector('.tk-ansicht-titel')!.textContent = h.titel;
  m.querySelector('.tk-seitenzahl')!.textContent = `${seitenName(h, ansicht.seite)} / ${h.seiten}`;
  const z = m.querySelector<HTMLButtonElement>('.tk-zurueck')!;
  const w = m.querySelector<HTMLButtonElement>('.tk-weiter')!;
  z.setAttribute('aria-label', wort('technik.vorige'));
  w.setAttribute('aria-label', wort('technik.naechste'));
  z.disabled = ansicht.seite <= 1;
  w.disabled = ansicht.seite >= h.seiten;
  m.querySelector('.handbuch-modal-schliessen')!.setAttribute('aria-label', wort('technik.schliessen'));
}

function blaettere(d: number): void {
  const h = ansicht.handbuch;
  if (!h) return;
  const neu = Math.min(h.seiten, Math.max(1, ansicht.seite + d));
  if (neu === ansicht.seite) return;
  ansicht.seite = neu;
  beschrifteAnsicht();
  void zeichneSeite();
}

function schliesseAnsicht(): void {
  const m = ansicht.el;
  if (!m || m.hidden) return;
  m.hidden = true;
  ansicht.griff?.beimSchliessen();
  ansicht.zeichnet++;
}

async function oeffneSeite(h: Handbuch, seite: number, markiere: string[], ausloeser: HTMLElement): Promise<void> {
  const m = holeAnsicht();
  if (ansicht.handbuch?.id !== h.id) {
    void ansicht.aufgabe?.destroy();
    ansicht.aufgabe = null;
  }
  ansicht.handbuch = h;
  ansicht.seite = seite;
  ansicht.markiere = new Set(markiere);
  m.hidden = false;
  ansicht.griff?.beimOeffnen(ausloeser);
  beschrifteAnsicht();
  await zeichneSeite();
}

async function zeichneSeite(): Promise<void> {
  const m = ansicht.el;
  const h = ansicht.handbuch;
  if (!m || !h) return;
  const lauf = ++ansicht.zeichnet;
  const buehne = m.querySelector<HTMLDivElement>('.handbuch-modal-seiten')!;
  buehne.textContent = wort('technik.laedt');
  try {
    const lib = await ladePdfjs();
    if (!ansicht.aufgabe) {
      const blob = await ladeDatei(h.id);
      if (!blob) throw new Error('Datei fehlt');
      ansicht.aufgabe = lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const dok = await ansicht.aufgabe.promise;
    const seite = await dok.getPage(ansicht.seite);
    if (lauf !== ansicht.zeichnet) return;
    
    const breite = Math.min(900, (buehne.clientWidth || 320) - 20);
    const basis = seite.getViewport({ scale: 1 });
    const dpr = window.devicePixelRatio || 1;
    const viewport = seite.getViewport({ scale: (breite / basis.width) * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.className = 'handbuch-modal-seite';
    canvas.style.width = `${breite}px`;
    const ctx = canvas.getContext('2d')!;
    await seite.render({ canvasContext: ctx, viewport, canvas }).promise;
    if (lauf !== ansicht.zeichnet) return;
    if (ansicht.markiere.size) {
      const inhalt = await seite.getTextContent();
      markiereAufSeite(ctx, lib.Util, viewport, inhalt.items as TextStueck[],
        inhalt.styles as Record<string, { fontFamily?: string }>, ansicht.markiere);
    }
    if (lauf !== ansicht.zeichnet) return;
    buehne.replaceChildren(canvas);
    m.querySelector('.handbuch-modal-buehne')?.scrollTo?.({ top: 0 });
  } catch {
    if (lauf !== ansicht.zeichnet) return;
    buehne.textContent = wort('technik.anzeigeFehler');
  }
}

interface TextStueck { str?: string; transform?: number[]; width?: number; fontName?: string }


function markiereAufSeite(
  ctx: CanvasRenderingContext2D,
  util: { transform: (a: number[], b: number[]) => number[] },
  viewport: { transform: number[]; scale: number },
  stuecke: TextStueck[],
  stile: Record<string, { fontFamily?: string }>,
  markiere: ReadonlySet<string>,
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 196, 0, 0.38)';
  for (const s of stuecke) {
    if (!s.str || !s.transform || !s.width) continue;
    if (Math.abs(s.transform[1]!) > 1e-3 || Math.abs(s.transform[2]!) > 1e-3) continue;
    const tx = util.transform(viewport.transform, s.transform);
    const hoehe = Math.hypot(tx[2]!, tx[3]!);
    const breite = s.width * viewport.scale;
    ctx.font = `${Math.max(1, Math.round(hoehe))}px ${stile[s.fontName ?? '']?.fontFamily ?? 'sans-serif'}`;
    const voll = ctx.measureText(s.str).width || 1;
    for (const m of s.str.matchAll(/[\p{L}\p{N}]+/gu)) {
      if (!markiere.has(normalisiere(m[0]))) continue;
      const x = tx[4]! + breite * (ctx.measureText(s.str.slice(0, m.index)).width / voll);
      const w = breite * (ctx.measureText(m[0]).width / voll);
      ctx.fillRect(x - 1, tx[5]! - hoehe * 0.95, w + 2, hoehe * 1.2);
    }
  }
  ctx.restore();
}




function inhalt(): string {
  const t = (s: string) => escapeHtml(wort(s));
  return `<div class="tk-spalte">
      <section class="tk-karte" aria-labelledby="tk-titel-suche">
        <h3 id="tk-titel-suche" data-i18n="technik.sucheTitel">${t('technik.sucheTitel')}</h3>
        <div class="tk-suchzeile">
          <input type="search" id="in-technik-suche" enterkeyhint="search" autocomplete="off"
            data-i18n-aria-label="technik.suchePlatzhalter" aria-label="${t('technik.suchePlatzhalter')}"
            data-i18n-placeholder="technik.suchePlatzhalter" placeholder="${t('technik.suchePlatzhalter')}">
          <select id="in-technik-filter" data-i18n-aria-label="technik.filter" aria-label="${t('technik.filter')}"></select>
        </div>
        <p class="tk-status" id="tk-suchstatus" role="status" aria-live="polite"></p>
        <ol class="tk-treffer" id="tk-treffer"></ol>
      </section>
    </div>
    <div class="tk-spalte">
      <section class="tk-karte" aria-labelledby="tk-titel-liste">
        <h3 id="tk-titel-liste" data-i18n="technik.listeTitel">${t('technik.listeTitel')}</h3>
        <p class="tk-hinweis" data-i18n="technik.listeHinweis">${t('technik.listeHinweis')}</p>
        <ul class="tk-liste" id="tk-liste"></ul>
        <div class="tk-aktionen">
          <button type="button" class="btn primary" id="btn-technik-datei">${icon('import')}<span data-i18n="technik.hinzufuegen">${t('technik.hinzufuegen')}</span></button>
          <input type="file" id="in-technik-datei" accept="application/pdf,.pdf" hidden>
        </div>
        <div class="tk-neu" id="tk-neu" hidden>
          <p class="tk-dateiname" id="tk-dateiname"></p>
          <label><span data-i18n="technik.bezeichnung">${t('technik.bezeichnung')}</span>
            <input type="text" id="in-technik-titel" autocomplete="off"></label>
          <label><span data-i18n="technik.geraet">${t('technik.geraet')}</span>
            <select id="in-technik-geraet"></select></label>
          <label><span data-i18n="technik.yacht">${t('technik.yacht')}</span>
            <input type="text" id="in-technik-yacht" autocomplete="off" data-i18n-placeholder="technik.yachtAlle" placeholder="${t('technik.yachtAlle')}"></label>
          <div class="tk-aktionen">
            <button type="button" class="btn primary" id="btn-technik-indexieren" data-i18n="technik.indexieren">${t('technik.indexieren')}</button>
            <button type="button" class="btn" id="btn-technik-abbrechen" data-i18n="technik.abbrechen">${t('technik.abbrechen')}</button>
          </div>
        </div>
        <p class="tk-status" id="tk-status" role="status" aria-live="polite"></p>
      </section>
    </div>`;
}

let panel: HTMLDivElement | null = null;


function zeigeIn(behaelter: HTMLElement): void {
  if (!panel) {
    panel = document.createElement('div');
    panel.className = 'tk-spalten';
    panel.id = 'tk-panel';
    panel.innerHTML = inhalt();
    behaelter.appendChild(panel);
    verdrahte();
    return;
  }
  if (panel.parentElement !== behaelter) behaelter.appendChild(panel);
}



let fenster: HTMLDivElement | null = null;
let fensterGriff: ModalHandle | null = null;

function holeFenster(): HTMLDivElement {
  if (fenster) return fenster;
  const v = document.createElement('div');
  v.className = 'tk-view';
  v.id = 'tk-view';
  v.hidden = true;
  v.tabIndex = -1;
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-labelledby', 'tk-titel');
  v.innerHTML = `<header class="tk-kopf">
      <h2 id="tk-titel" data-i18n="technik.titel">${escapeHtml(wort('technik.titel'))}</h2>
      <button type="button" class="tk-x" id="btn-technik-zu" data-i18n-aria-label="technik.fensterZu"
        aria-label="${escapeHtml(wort('technik.fensterZu'))}">×</button>
    </header>
    <div class="tk-rumpf"></div>`;
  document.body.appendChild(v);
  v.querySelector('#btn-technik-zu')!.addEventListener('click', schliesseFenster);
  
  v.addEventListener('touchstart', () => {}, { passive: true });
  fenster = v;
  fensterGriff = initModal(v, schliesseFenster);
  return v;
}

function schliesseMenue(): void {
  
  if (document.getElementById('menu-panel')?.hidden === false) document.getElementById('btn-menu')?.click();
}

function oeffneFenster(): void {
  const v = holeFenster();
  zeigeIn(v.querySelector<HTMLElement>('.tk-rumpf')!);
  schliesseMenue();
  v.hidden = false;
  document.documentElement.classList.add('tk-offen');
  
  fensterGriff?.beimOeffnen(document.getElementById('btn-menu'), $('btn-technik-zu'));
  aufgeschlagen();
}

function schliesseFenster(): void {
  if (!fenster || fenster.hidden) return;
  schliesseAnsicht();
  fenster.hidden = true;
  document.documentElement.classList.remove('tk-offen');
  fensterGriff?.beimSchliessen();
}



function aufgeschlagen(): void {
  filterVonHand = false;
  void ladeListe().then(planeSuche);
}

let verdrahtet = false;

function verdrahte(): void {
  if (verdrahtet) return;
  verdrahtet = true;
  fuelleGeraete();

  $('in-technik-suche')?.addEventListener('input', planeSuche);
  $('in-technik-suche')?.addEventListener('search', planeSuche);
  $('in-technik-filter')?.addEventListener('change', () => { filterVonHand = true; planeSuche(); });

  $('btn-technik-datei')?.addEventListener('click', () => $<HTMLInputElement>('in-technik-datei')?.click());
  $('in-technik-datei')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    input.value = '';
    if (!f) return;
    if (!istPdf(f)) { setzeStatus(wort('technik.keinPdf'), true); return; }
    zeigeFormular(f);
    $('in-technik-titel')?.focus();
  });
  $('btn-technik-indexieren')?.addEventListener('click', () => { void indexiere(); });
  $('btn-technik-abbrechen')?.addEventListener('click', () => {
    if (laeuft) { abbrechen = true; return; }
    zeigeFormular(null);
    setzeStatus('');
  });

  $('tk-liste')?.addEventListener('click', (e) => {
    const ziel = e.target as HTMLElement;
    const oeffnen = ziel.closest<HTMLElement>('[data-technik-oeffnen]');
    if (oeffnen) {
      const h = handbuecher.find((x) => x.id === oeffnen.dataset['technikOeffnen']);
      if (h) void oeffneSeite(h, 1, [], oeffnen);
      return;
    }
    const weg = ziel.closest<HTMLElement>('[data-technik-loeschen]');
    if (weg) void loesche(weg.dataset['technikLoeschen']!);
  });
  $('tk-treffer')?.addEventListener('click', (e) => {
    const knopf = (e.target as HTMLElement).closest<HTMLElement>('[data-technik-treffer]');
    if (!knopf) return;
    const t = letzteTreffer[Number(knopf.dataset['technikTreffer'])];
    const h = t && handbuecher.find((x) => x.id === t.handbuch);
    if (t && h) void oeffneSeite(h, t.seite, t.markiere, knopf);
  });

  aufSprachwechsel(() => {
    fuelleGeraete();
    zeichneListe();
    zeichneFilter();
    if (ansicht.el && !ansicht.el.hidden) beschrifteAnsicht();
    void sucheJetzt();
  });

  void ladeListe();
}


export function initTechnik(opt: {
  yacht?: () => string | null;
  reiter?: { behaelter: HTMLElement; knopf: HTMLElement | null; offen: () => boolean; zeige: () => void };
} = {}): void {
  if (opt.yacht) holeYacht = opt.yacht;
  const r = opt.reiter;
  r?.knopf?.addEventListener('click', () => { zeigeIn(r.behaelter); aufgeschlagen(); });
  document.getElementById('btn-technik')?.addEventListener('click', () => {
    if (!r || !r.offen()) { oeffneFenster(); return; }
    schliesseMenue();
    r.zeige();
    zeigeIn(r.behaelter);
    aufgeschlagen();
    r.behaelter.scrollIntoView({ block: 'start' });
  });
}
