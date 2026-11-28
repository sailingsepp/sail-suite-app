import L from 'leaflet';
import { karteObjekt, schiffPosition } from './karte';
import { kartenLangDruck } from './navkarte';
import { routeAktiv, routeHierher, yachtPosition, zielDerRoute } from './navigation';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { istLandJetzt } from '@/data/landKacheln';
import { feuerAm } from './leuchtfeuer';
import { feuerSteckbrief } from '@/briefing/feuerText';
import { objektAm, type KartenObjekt } from './kartenObjekte';
import { gefahrSteckbrief, hafenSteckbrief, tankstelleSteckbrief, tonneSteckbrief, TONNEN_TYPEN } from '@/briefing/seezeichenText';
import { aktuelleSprache } from '@/shell/sprache';
import { bearingDeg, distNM } from '@/core/geo';
import { kursRw, nf } from '@/core/time';
import type { NavRoute } from '@/core/navigation';
import { STRINGS } from './strings';
import { API_BASIS } from '@/shell/api';
import { istOnline } from './netz';

const STUFE_KEY = SCHLUESSEL.einBildschirmStufe;
const TREFFER_PX = 28;

const wort = (k: string) => STRINGS[aktuelleSprache()][k] ?? k;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

let stufe: 1 | 2 | 3 = 1;
function liesStufe(): 1 | 2 | 3 {
  try { const s = Number(localStorage.getItem(STUFE_KEY)); return s === 2 || s === 3 ? s : 1; } catch { return 1; }
}
function setzeStufe(s: 1 | 2 | 3): void {
  stufe = s;
  document.documentElement.dataset['ebStufe'] = String(s);
  try { localStorage.setItem(STUFE_KEY, String(s)); } catch {  }
  const griff = document.getElementById('tb-eb-griff');
  griff?.setAttribute('aria-expanded', String(s > 1));

  setTimeout(() => karteObjekt()?.invalidateSize(), 220);
}

function hole(ziel: HTMLElement, wahl: string): void {
  const el = document.querySelector<HTMLElement>(wahl);
  if (el) ziel.appendChild(el);
}

function baueSchublade(): void {
  const main = document.querySelector<HTMLElement>('main.tb');
  const karteWrap = document.querySelector<HTMLElement>('.tb-karte-wrap');
  if (!main || !karteWrap) return;
  const s = document.createElement('section');
  s.className = 'tb-eb-schublade';
  s.id = 'tb-eb-schublade';
  s.setAttribute('aria-label', wort('eb.schublade'));

  s.dataset['i18nAriaLabel'] = 'eb.schublade';
  s.innerHTML = `<div class="tb-eb-inhalt" id="tb-eb-inhalt">
    <button type="button" class="tb-eb-griff" id="tb-eb-griff" aria-controls="tb-eb-inhalt" aria-label="${esc(wort('eb.griff'))}" data-i18n-aria-label="eb.griff"><span class="tb-eb-strich"></span><span class="tb-eb-strich"></span></button>
    <div class="tb-eb-stufe1" id="tb-eb-stufe1"></div>
    <div class="tb-eb-scroll"><div class="tb-eb-mehr" id="tb-eb-stufe2"></div><div class="tb-eb-mehr" id="tb-eb-stufe3"></div></div>
  </div>`;
  karteWrap.after(s);
  const s1 = s.querySelector<HTMLElement>('#tb-eb-stufe1')!;
  const s2 = s.querySelector<HTMLElement>('#tb-eb-stufe2')!;
  const s3 = s.querySelector<HTMLElement>('#tb-eb-stufe3')!;
  hole(s1, '#tb-nav-leiste');

  for (const w of ['#tb-toern-zeile', '#tb-position', '#tb-position-bezug', '#tb-sonne', '#tb-mond', '#tb-gz-streifen', '#tb-ankerwache-status', '#tb-foto-meldung', '#tb-ais-zustand']) hole(s2, w);

  for (const w of ['#tb-warnblock', '#tb-zielwetter', '#tb-wetterkopf', '#tb-genauigkeit', '.tb-log', '#tb-luecken', '#tb-pausen', '#tb-spurlegende', '.tb-speicher', 'main.tb > .tb-footer']) hole(s3, w);
  bindeGriff(s.querySelector<HTMLButtonElement>('#tb-eb-griff')!);

  const miss = () => s.style.setProperty('--eb-h1', `${s1.offsetHeight}px`);
  if (typeof ResizeObserver === 'function') new ResizeObserver(miss).observe(s1);
  miss();

  const kopf = document.querySelector<HTMLElement>('.tb-nav-kopf');
  const hoch = window.matchMedia?.('(max-width: 899px) and (min-height: 501px)');
  const missFrei = () => {
    if (!kopf?.offsetHeight || !hoch?.matches) { s.style.removeProperty('--eb-max2'); return; }
    const frei = s.getBoundingClientRect().bottom - kopf.getBoundingClientRect().bottom - KOPF_LASCHE_PX - EB_LASCHE_PX;
    s.style.setProperty('--eb-max2', `${Math.max(120, Math.round(frei))}px`);
  };
  if (kopf && typeof ResizeObserver === 'function') new ResizeObserver(missFrei).observe(kopf);
  window.addEventListener('resize', missFrei);
  missFrei();
}

const KOPF_LASCHE_PX = 28;
const EB_LASCHE_PX = 43;

function bindeGriff(griff: HTMLButtonElement): void {
  let start: number | null = null;
  let gezogen = false;

  let schluckeBis = 0;
  document.addEventListener('click', (e) => {
    if (Date.now() < schluckeBis && !griff.contains(e.target as Node)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  griff.addEventListener('touchend', (e) => { if (gezogen) e.preventDefault(); }, { passive: false });
  griff.addEventListener('pointerdown', (e) => {
    start = e.clientY;
    gezogen = false;

    try { griff.setPointerCapture(e.pointerId); } catch {  }
  });
  griff.addEventListener('pointermove', (e) => { if (start !== null && Math.abs(e.clientY - start) > 12) gezogen = true; });
  griff.addEventListener('pointerup', (e) => {
    if (start === null) return;
    const dy = e.clientY - start;
    start = null;
    schluckeBis = Date.now() + 500;
    if (!gezogen) { setzeStufe(stufe === 3 ? 1 : ((stufe + 1) as 2 | 3)); return; }
    if (dy < -30) setzeStufe(Math.min(3, stufe + (dy < -220 ? 2 : 1)) as 1 | 2 | 3);
    else if (dy > 30) setzeStufe(Math.max(1, stufe - (dy > 220 ? 2 : 1)) as 1 | 2 | 3);
  });
  griff.addEventListener('pointercancel', () => { start = null; });

  griff.addEventListener('click', (e) => { if (e.detail === 0) setzeStufe(stufe === 3 ? 1 : ((stufe + 1) as 2 | 3)); });
  griff.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setzeStufe(Math.min(3, stufe + 1) as 1 | 2 | 3); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setzeStufe(Math.max(1, stufe - 1) as 1 | 2 | 3); }
  });
}

function nah(k: L.Map, a: L.LatLng, b: { lat: number; lon: number }): boolean {
  return k.latLngToContainerPoint(a).distanceTo(k.latLngToContainerPoint([b.lat, b.lon])) <= TREFFER_PX;
}

function liesRoute(): NavRoute | null {
  try { return JSON.parse(localStorage.getItem('sail-suite:nav-route') ?? 'null') as NavRoute | null; } catch { return null; }
}

let tippMarke: L.CircleMarker | null = null;
function schliesseFenster(): void {
  document.getElementById('tb-eb-fenster')?.remove();
  tippMarke?.remove();
  tippMarke = null;
}
function fenster(html: string): void {
  schliesseFenster();
  const wrap = document.querySelector<HTMLElement>('.tb-karte-wrap');
  if (!wrap) return;
  const f = document.createElement('section');
  f.id = 'tb-eb-fenster';
  f.className = 'tb-eb-fenster';
  f.setAttribute('role', 'dialog');
  f.innerHTML = `<button type="button" class="tb-eb-zu" aria-label="${esc(wort('eb.schliessen'))}">×</button>${html}`;
  f.querySelector('.tb-eb-zu')!.addEventListener('click', schliesseFenster);
  wrap.appendChild(f);
}

function zeigeFeuer(k: L.Map, f: { lat: number; lon: number; tags: Readonly<Record<string, string>>; sichtbar: number | null }): void {
  const sp = aktuelleSprache();
  const b = feuerSteckbrief(f.tags, sp, f.sichtbar);
  const liste = (z: { titel: string; text: string }[]) => z.length
    ? `<dl class="tb-feuer-liste">${z.map((x) => `<dt>${esc(x.titel)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>` : '';
  const boot = yachtPosition();
  const lage = boot ? (() => {
    const sm = distNM(boot.lat, boot.lon, f.lat, f.lon);
    return `${nf(sm, sm < 10 ? 1 : 0, sp)} ${sp === 'de' ? 'sm' : 'NM'} · ${kursRw(bearingDeg(boot.lat, boot.lon, f.lat, f.lon), sp)}`;
  })() : null;
  let html = `<h3>${esc(b.titel)}</h3>`;
  if (b.art) html += `<p class="tb-eb-leise">${esc(b.art)}</p>`;
  if (lage) html += `<p>${esc(lage)}</p>`;

  if (TONNEN_TYPEN.includes(f.tags['seamark:type'] ?? '')) {
    const hinweis = sp === 'de' ? 'Hinweis' : 'Note';
    html += liste(tonneSteckbrief(f.tags, sp).zeilen.filter((z) => z.titel !== hinweis));
  }
  for (const s of b.sektoren) {
    if (s.nr !== null && b.sektoren.length > 1) {
      html += `<p class="tb-feuer-sektor${s.sichtbar ? ' sichtbar' : ''}">${esc(`${wort('eb.sektor')} ${s.nr}${s.sichtbar ? ` · ${wort('eb.sichtbar')}` : ''}`)}</p>`;
    }
    html += liste(s.zeilen);
  }
  html += liste(b.zeilen);
  html += `<p class="tb-eb-leise">${esc(wort('eb.feuerQuelle'))}</p>`;
  fenster(html);
  tippMarke = L.circleMarker([f.lat, f.lon], { pane: 'tbNamen', radius: 10, className: 'tb-eb-tipp', interactive: false }).addTo(k);
}

function zeigeObjekt(k: L.Map, o: KartenObjekt): void {

  if (o.art === 'tonne' && Object.keys(o.tags).some((x) => x.startsWith('seamark:light'))) { zeigeFeuer(k, { lat: o.lat, lon: o.lon, tags: o.tags, sichtbar: null }); return; }
  const sp = aktuelleSprache();
  const b = o.art === 'tonne' ? tonneSteckbrief(o.tags, sp)
    : o.art === 'gefahr' ? gefahrSteckbrief(o.gefahr.art, o.gefahr.name, o.gefahr.merkmale ?? {}, sp)
      : o.art === 'hafen' ? hafenSteckbrief(o.tags, o.dienste, sp) : tankstelleSteckbrief(o.tags, sp);
  const boot = yachtPosition();
  let html = `<h3>${esc(b.titel)}</h3>`;
  if (b.art) html += `<p class="tb-eb-leise">${esc(b.art)}</p>`;
  if (boot) {
    const sm = distNM(boot.lat, boot.lon, o.lat, o.lon);
    html += `<p>${esc(`${nf(sm, sm < 10 ? 1 : 0, sp)} ${sp === 'de' ? 'sm' : 'NM'} · ${kursRw(bearingDeg(boot.lat, boot.lon, o.lat, o.lon), sp)}`)}</p>`;
  }
  if (b.zeilen.length) html += `<dl class="tb-feuer-liste">${b.zeilen.map((x) => `<dt>${esc(x.titel)}</dt><dd>${esc(x.text)}</dd>`).join('')}</dl>`;
  const route = (o.art === 'hafen' || o.art === 'tankstelle') && !!boot;

  if (o.art === 'hafen') html += '<div class="tb-eb-luftbild"></div>';

  if (o.art === 'hafen') html += '<div class="tb-eb-webcams" hidden></div>';
  if (route) {
    if (routeAktiv()) html += `<p class="tb-eb-leise">${esc(wort('nav.gehezuErsetzt'))}</p>`;
    html += `<button type="button" class="tb-nav-k primaer tb-eb-route">${esc(wort('eb.route'))}</button>`;
  }
  html += `<p class="tb-eb-leise">${esc(wort('eb.feuerQuelle'))}</p>`;
  fenster(html);
  tippMarke = L.circleMarker([o.lat, o.lon], { pane: 'tbNamen', radius: 10, className: 'tb-eb-tipp', interactive: false }).addTo(k);
  document.querySelector<HTMLButtonElement>('#tb-eb-fenster .tb-eb-route')?.addEventListener('click', () => {
    schliesseFenster();
    routeHierher({ lat: o.lat, lon: o.lon });
  });
  const lbBox = document.querySelector<HTMLElement>('#tb-eb-fenster .tb-eb-luftbild');
  if (lbBox) zeigeLuftbild(lbBox, o.lat, o.lon, b.titel);
  const wcBox = document.querySelector<HTMLElement>('#tb-eb-fenster .tb-eb-webcams');
  if (wcBox) void zeigeWebcams(wcBox, o.lat, o.lon, b.titel);
}

interface Webcam {
  id: string; titel: string; abstandM: number; aktualisiert: string;
  vorschau: string; breite: number; hoehe: number; player: string; seite: string;
}

const windyAdresse = (s: unknown, ursprung: string): s is string => typeof s === 'string' && s.startsWith(ursprung);

async function zeigeWebcams(box: HTMLElement, lat: number, lon: number, hafen: string): Promise<void> {
  if (!istOnline()) return;
  let kameras: Webcam[];
  try {
    const r = await fetch(`${API_BASIS}/api/webcams?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return;
    const d = await r.json() as { kameras?: unknown };
    kameras = (Array.isArray(d.kameras) ? d.kameras as Webcam[] : []).filter((k) => k && typeof k.titel === 'string'
      && windyAdresse(k.vorschau, 'https://imgproxy.windy.com/') && windyAdresse(k.player, 'https://webcams.windy.com/')
      && windyAdresse(k.seite, 'https://windy.com/webcams/'));
  } catch {
    return;
  }
  if (!kameras.length || !box.isConnected) return;
  const sp = aktuelleSprache();
  const jetzt = Date.now();
  const alter = (iso: string): string => {
    const min = Math.max(0, Math.round((jetzt - Date.parse(iso)) / 60_000));
    return min < 90 ? wort('eb.webcamMin').replace('{n}', String(min)) : wort('eb.webcamH').replace('{n}', nf(min / 60, 0, sp));
  };
  const titel = document.createElement('p');
  titel.className = 'tb-eb-webcams-titel';
  titel.textContent = wort('eb.webcams');
  const liste = document.createElement('div');
  liste.className = 'tb-eb-webcams-liste';
  for (const k of kameras) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'tb-eb-webcam';
    knopf.setAttribute('aria-label', `${wort('eb.webcamGross')}: ${k.titel}`);
    const bild = document.createElement('img');
    bild.alt = k.titel;
    bild.decoding = 'async';
    bild.loading = 'lazy';
    bild.referrerPolicy = 'no-referrer';
    bild.width = Math.min(400, Number(k.breite) || 400);
    bild.height = Math.min(400, Number(k.hoehe) || 224);
    bild.src = k.vorschau;
    const unter = document.createElement('span');
    unter.className = 'tb-eb-webcam-text';
    unter.textContent = `${k.titel} · ${alter(k.aktualisiert)} · ${nf(Number(k.abstandM) || 0, 0, sp)} m`;
    bild.addEventListener('error', () => { knopf.remove(); if (!liste.childElementCount) box.hidden = true; });
    knopf.append(bild, unter);
    knopf.addEventListener('click', () => { zeigeWebcamGross(k, hafen); });
    liste.appendChild(knopf);
  }
  box.replaceChildren(titel, liste, windyNennung());
  box.hidden = false;
}

function windyNennung(): HTMLElement {
  const p = document.createElement('p');
  p.className = 'tb-eb-leise tb-eb-webcams-quelle';
  const a = document.createElement('a');
  a.href = 'https://www.windy.com/';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = wort('eb.webcamQuelle');
  const b = document.createElement('a');
  b.href = 'https://www.windy.com/webcams/add';
  b.target = '_blank';
  b.rel = 'noopener';
  b.textContent = wort('eb.webcamHinzu');
  p.append(a, ' · ', b);
  return p;
}

function schliesseWebcamGross(): boolean {
  const el = document.getElementById('tb-webcam-gross');
  if (!el) return false;
  el.remove();
  return true;
}
function zeigeWebcamGross(k: Webcam, hafen: string): void {
  schliesseWebcamGross();
  const el = document.createElement('section');
  el.id = 'tb-webcam-gross';
  el.className = 'tb-luftbild-gross tb-webcam-gross';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${wort('eb.webcams')}: ${k.titel}`);
  el.innerHTML = `<header class="tb-luftbild-gross-kopf"><h2>${esc(k.titel || hafen)}</h2>`
    + `<button type="button" class="tb-eb-zu" aria-label="${esc(wort('eb.schliessen'))}">×</button></header>`
    + '<div class="tb-luftbild-gross-flaeche tb-webcam-flaeche"></div><p class="tb-luftbild-gross-fuss"></p>';
  const rahmen = document.createElement('iframe');
  rahmen.src = k.player;
  rahmen.title = k.titel;
  rahmen.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
  rahmen.setAttribute('allow', 'fullscreen');
  rahmen.referrerPolicy = 'no-referrer';
  rahmen.loading = 'eager';
  el.querySelector('.tb-webcam-flaeche')!.appendChild(rahmen);
  const fuss = el.querySelector<HTMLElement>('.tb-luftbild-gross-fuss')!;
  const seite = document.createElement('a');
  seite.href = k.seite;
  seite.target = '_blank';
  seite.rel = 'noopener';
  seite.textContent = wort('eb.webcamSeite');
  fuss.append(windyNennung(), seite);
  document.body.appendChild(el);
  el.querySelector('.tb-eb-zu')!.addEventListener('click', () => { schliesseWebcamGross(); });
  (el.querySelector('.tb-eb-zu') as HTMLButtonElement).focus();
}

function zeigeLuftbild(box: HTMLElement, lat: number, lon: number, titel: string): void {
  const status = document.createElement('p');
  status.className = 'tb-eb-leise';
  if (!istOnline()) {
    status.textContent = wort('eb.luftbildOffline');
    box.replaceChildren(status);
    return;
  }
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.className = 'tb-eb-luftbild-bild';
  knopf.setAttribute('aria-label', wort('eb.luftbildGross'));
  const bild = document.createElement('img');
  bild.alt = wort('eb.luftbild');
  bild.decoding = 'async';
  bild.src = `${API_BASIS}/api/luftbild?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`;
  knopf.appendChild(bild);

  const hinweis = document.createElement('p');
  hinweis.className = 'tb-eb-leise tb-eb-luftbild-hinweis';
  hinweis.textContent = wort(beruehrung() ? 'eb.luftbildTippen' : 'eb.luftbildKlicken');
  status.textContent = wort('eb.luftbildLaedt');
  bild.addEventListener('load', () => { status.textContent = wort('eb.luftbildQuelle'); });
  bild.addEventListener('error', () => {
    knopf.remove();
    hinweis.remove();
    status.textContent = wort(istOnline() ? 'eb.luftbildFehlt' : 'eb.luftbildOffline');
  });
  knopf.addEventListener('click', () => { if (bild.naturalWidth) zeigeLuftbildGross(bild, titel); });
  box.replaceChildren(hinweis, knopf, status);
}

function beruehrung(): boolean {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return 'ontouchstart' in window; }
}

let grossKarte: L.Map | null = null;
function schliesseLuftbildGross(): boolean {
  const el = document.getElementById('tb-luftbild-gross');
  if (!el) return false;
  grossKarte?.remove();
  grossKarte = null;
  el.remove();
  return true;
}
function zeigeLuftbildGross(bild: HTMLImageElement, titel: string): void {
  schliesseLuftbildGross();
  const el = document.createElement('section');
  el.id = 'tb-luftbild-gross';
  el.className = 'tb-luftbild-gross';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `${wort('eb.luftbild')}: ${titel}`);
  el.innerHTML = `<header class="tb-luftbild-gross-kopf"><h2>${esc(titel)}</h2>`
    + `<button type="button" class="tb-eb-zu" aria-label="${esc(wort('eb.schliessen'))}">×</button></header>`
    + `<div class="tb-luftbild-gross-flaeche"></div><p class="tb-luftbild-gross-fuss">${esc(wort('eb.luftbildQuelle'))}</p>`;
  document.body.appendChild(el);
  el.querySelector('.tb-eb-zu')!.addEventListener('click', () => { schliesseLuftbildGross(); });
  const flaeche = el.querySelector<HTMLElement>('.tb-luftbild-gross-flaeche')!;
  const h = bild.naturalHeight, w = bild.naturalWidth;
  const grenzen = L.latLngBounds([0, 0], [h, w]);
  grossKarte = L.map(flaeche, { crs: L.CRS.Simple, attributionControl: false, zoomSnap: 0, zoomDelta: 0.5, maxBoundsViscosity: 1, minZoom: -5 });
  L.imageOverlay(bild.src, grenzen).addTo(grossKarte);
  grossKarte.fitBounds(grenzen);
  const start = grossKarte.getZoom();
  grossKarte.setMinZoom(start);
  grossKarte.setMaxZoom(start + 2);
  grossKarte.setMaxBounds(grenzen);
  (el.querySelector('.tb-eb-zu') as HTMLButtonElement).focus();
}

function frageRoute(k: L.Map, p: { lat: number; lon: number }): void {
  if (document.getElementById('tb-nav-panel')?.hidden === false) return;
  const boot = yachtPosition();
  const sp = aktuelleSprache();
  let html = `<h3>${esc(wort('eb.routeFrage'))}</h3>`;
  if (boot) {
    const sm = distNM(boot.lat, boot.lon, p.lat, p.lon);
    html += `<p>${esc(`${nf(sm, sm < 10 ? 1 : 0, sp)} ${sp === 'de' ? 'sm' : 'NM'} · ${kursRw(bearingDeg(boot.lat, boot.lon, p.lat, p.lon), sp)}`)}</p>`;
    if (routeAktiv()) html += `<p class="tb-eb-leise">${esc(wort('nav.gehezuErsetzt'))}</p>`;
    html += `<button type="button" class="tb-nav-k primaer tb-eb-route">${esc(wort('eb.route'))}</button>`;
  } else {
    html += `<p>${esc(wort('nav.keinePos'))}</p>`;
  }
  fenster(html);
  tippMarke = L.circleMarker([p.lat, p.lon], { pane: 'tbNamen', radius: 8, className: 'tb-eb-tipp', interactive: false }).addTo(k);
  document.querySelector<HTMLButtonElement>('#tb-eb-fenster .tb-eb-route')?.addEventListener('click', () => {
    schliesseFenster();
    routeHierher(p);
  });
}

const LANG_MS = 600;

const LANG_TOLERANZ_PX = 15;

function beschriftungGetippt(k: L.Map, client: { x: number; y: number } | null, sel: string, ziel?: { lat: number; lon: number }): boolean {
  if (!client) return false;
  const p = ziel ? k.latLngToContainerPoint([ziel.lat, ziel.lon]) : null;
  return [...k.getContainer().querySelectorAll<HTMLElement>(`${sel}[data-lat]`)].some((el) => {
    const teile = [el, ...el.querySelectorAll<HTMLElement>('*')].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0);
    if (!teile.some((r) => client.x >= r.left - 6 && client.x <= r.right + 6 && client.y >= r.top - 6 && client.y <= r.bottom + 6)) return false;
    if (!p) return true;
    return k.latLngToContainerPoint([Number(el.dataset['lat']), Number(el.dataset['lon'])]).distanceTo(p) <= 44;
  });
}

export function hafenVorFeuer(
  k: L.Map, ll: L.LatLng, client: { x: number; y: number } | null, hafen: { lat: number; lon: number }, feuer: { lat: number; lon: number },
): boolean {
  if (beschriftungGetippt(k, client, '.tb-kn', hafen)) return true;
  if (beschriftungGetippt(k, client, '.tb-feuer-text')) return false;
  const p = k.latLngToContainerPoint(ll);
  return k.latLngToContainerPoint([hafen.lat, hafen.lon]).distanceTo(p) < k.latLngToContainerPoint([feuer.lat, feuer.lon]).distanceTo(p);
}

function bindeLangDruck(k: L.Map, beiLang: (ll: L.LatLng, aufObjekt: boolean) => void): { geschluckt: () => boolean } {
  const el = k.getContainer();
  const finger = new Map<number, { x: number; y: number }>();
  let uhr = 0, schlucken = false;
  const ab = () => { window.clearTimeout(uhr); uhr = 0; };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    ab();
    schlucken = false;
    if (finger.size !== 1) return;

    const ziel = e.target as Element;
    if (ziel.closest('button, a, input, .leaflet-control, .tb-nav-mess-punkt, .tb-nav-wp-griff')) return;
    const aufObjekt = !!ziel.closest('.leaflet-interactive');
    const { clientX, clientY } = e;
    uhr = window.setTimeout(() => {
      uhr = 0;
      if (finger.size !== 1) return;
      schlucken = true;
      beiLang(k.mouseEventToLatLng({ clientX, clientY } as MouseEvent), aufObjekt);
    }, LANG_MS);
  });
  el.addEventListener('pointermove', (e) => {
    const s = finger.get(e.pointerId);
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > LANG_TOLERANZ_PX) ab();
  });
  const los = (e: PointerEvent) => { finger.delete(e.pointerId); ab(); };
  el.addEventListener('pointerup', los);
  el.addEventListener('pointercancel', los);
  k.on('zoomstart movestart', ab);

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if ((e as PointerEvent).pointerType === 'touch' || schlucken || uhr) return;
    const ziel = e.target as Element;
    if (ziel.closest('button, a, input, .leaflet-control, .tb-nav-mess-punkt, .tb-nav-wp-griff')) return;
    beiLang(k.mouseEventToLatLng(e), !!ziel.closest('.leaflet-interactive'));
  });
  return { geschluckt: () => { const s2 = schlucken; schlucken = false; return s2; } };
}

function bindeFenster(): void {
  const k = karteObjekt();
  if (!k) return;

  const lang = bindeLangDruck(k, (ll, aufObjekt) => {

    if (kartenLangDruck({ lat: ll.lat, lon: ll.lng })) { navigator.vibrate?.(15); return; }
    if (aufObjekt || document.getElementById('tb-nav-panel')?.hidden === false) return;
    schliesseFenster();

    if (istLandJetzt(ll.lat, ll.lng) === true) return;
    navigator.vibrate?.(15);
    frageRoute(k, { lat: ll.lat, lon: ll.lng });
  });

  let warte = 0;
  k.on('dblclick zoomstart movestart', () => { window.clearTimeout(warte); warte = 0; });
  k.on('click', (e: L.LeafletMouseEvent) => {

    if (lang.geschluckt()) return;

    if (document.getElementById('tb-nav-panel')?.hidden === false) return;

    const warOffen = !!document.getElementById('tb-eb-fenster');
    schliesseFenster();
    const ziel = zielDerRoute();
    if (ziel && nah(k, e.latlng, ziel)) {
      const zw = document.getElementById('tb-zielwetter');
      const inhalt = zw && !zw.hidden && zw.innerHTML.trim() ? zw.innerHTML : `<p>${esc(wort('eb.keinZielwetter'))}</p>`;
      fenster(`<div class="tb-zielwetter tb-eb-zw">${inhalt}</div>`);
      return;
    }
    const boot = schiffPosition();
    if (boot && nah(k, e.latlng, boot)) {
      const t = (id: string) => document.getElementById(id)?.textContent?.trim() ?? '';
      const zeilen = [t('tb-position'), t('tb-lage-text'), `${wort('kachel.sog')}: ${t('w-sog')}`, `${wort('kachel.cog')}: ${t('w-cog')}`]
        .filter((x) => x && !x.endsWith(': '));
      fenster(`<h3>${esc(wort('eb.yacht'))}</h3>${zeilen.map((z) => `<p>${esc(z)}</p>`).join('')}`);
      return;
    }
    const r = liesRoute();
    const wp = r?.wegpunkte.find((w) => nah(k, e.latlng, w));
    if (wp) {
      const zeilen: string[] = [];
      if (boot) {
        const sm = distNM(boot.lat, boot.lon, wp.lat, wp.lon);
        zeilen.push(`${nf(sm, sm < 10 ? 1 : 0, aktuelleSprache())} ${aktuelleSprache() === 'de' ? 'sm' : 'NM'} · ${kursRw(bearingDeg(boot.lat, boot.lon, wp.lat, wp.lon), aktuelleSprache())}`);
      }
      fenster(`<h3>${esc(wp.name)}</h3>${zeilen.map((z) => `<p>${esc(z)}</p>`).join('')}`);
      return;
    }
    if (warOffen) return;
    window.clearTimeout(warte);
    warte = window.setTimeout(() => {
      warte = 0;
      void (async () => {

        const ev = e.originalEvent as MouseEvent | undefined;
        const client = ev && typeof ev.clientX === 'number' ? { x: ev.clientX, y: ev.clientY } : null;
        const f = await feuerAm(k, e.latlng, undefined, client).catch(() => null);

        const o = await objektAm(k, e.latlng, client).catch(() => null);

        if (f && !(o?.art === 'hafen' && hafenVorFeuer(k, e.latlng, client, o, f))) { zeigeFeuer(k, f); return; }
        if (o) zeigeObjekt(k, o);

      })();
    }, 300);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !schliesseWebcamGross() && !schliesseLuftbildGross()) schliesseFenster(); });
}

const SCHMAL = '(max-width: 899px)';

function initKartenmenue(): void {
  const wrap = document.querySelector<HTMLElement>('header .menu-wrap');
  const panel = document.getElementById('menu-panel');
  const karte = document.querySelector<HTMLElement>('.tb-karte-wrap');
  const nutzerPanel = document.getElementById('user-panel');
  const nutzerKnopf = document.getElementById('btn-user');
  if (!wrap || !panel || !karte || !nutzerPanel) return;
  const heim = { eltern: wrap.parentElement!, vor: wrap.nextSibling };
  const halter = document.createElement('div');
  halter.id = 'tb-eb-menue';
  halter.className = 'tb-eb-menue';
  karte.appendChild(halter);

  const zurueck = document.querySelector<HTMLElement>('header .header-back');
  const alle = (zurueck?.cloneNode(true) as HTMLAnchorElement | undefined) ?? document.createElement('a');
  alle.className = 'menu-link';
  alle.id = 'tb-eb-alleapps';
  alle.href = '/';
  if (!zurueck) alle.textContent = wort('eb.alleApps');

  const konto = document.createElement('details');
  konto.className = 'menu-gruppe';
  konto.setAttribute('name', 'tb-menue');
  konto.innerHTML = `<summary><span data-i18n="eb.konto">${esc(wort('eb.konto'))}</span></summary><div class="menu-gruppe-inhalt" id="tb-eb-konto"></div>`;
  const kontoInhalt = konto.querySelector<HTMLElement>('#tb-eb-konto')!;
  const nutzerTeile = [...nutzerPanel.children];
  const anmelden = document.createElement('button');
  anmelden.type = 'button';
  anmelden.className = 'menu-link';
  anmelden.textContent = wort('eb.anmelden');
  anmelden.dataset['i18n'] = 'eb.anmelden';
  anmelden.addEventListener('click', () => nutzerKnopf?.click());

  const passe = () => {
    if (panel.hidden || !halter.contains(panel)) return;
    panel.style.maxHeight = `${Math.max(160, innerHeight - panel.getBoundingClientRect().top - 12)}px`;
  };

  new MutationObserver(() => { halter.classList.toggle('offen', !panel.hidden); passe(); })
    .observe(panel, { attributes: true, attributeFilter: ['hidden'] });

  const mq = matchMedia(SCHMAL);
  const setze = () => {
    if (mq.matches) {
      halter.appendChild(wrap);

      const titel = panel.querySelector('.menu-titel');
      if (titel) titel.after(alle); else panel.prepend(alle);
      const angemeldet = !!nutzerKnopf?.classList.contains('angemeldet');
      if (angemeldet) for (const t of nutzerTeile) kontoInhalt.appendChild(t);
      else kontoInhalt.replaceChildren(anmelden);
      panel.appendChild(konto);
    } else {
      heim.eltern.insertBefore(wrap, heim.vor);
      alle.remove();
      konto.remove();
      for (const t of nutzerTeile) nutzerPanel.appendChild(t);
      panel.style.maxHeight = '';
    }
  };
  setze();
  mq.addEventListener('change', setze);
}

function bildschirmFesthalten(): void {
  const tippt = (): boolean => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  };
  const zurueck = (): void => {
    if (tippt()) return;
    if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
    if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
  };
  const spaeter = (): void => { window.setTimeout(zurueck, 150); };
  document.addEventListener('focusout', spaeter);
  window.visualViewport?.addEventListener('resize', spaeter);
  window.addEventListener('scroll', spaeter, { passive: true });
}

const KOPF_KEY = SCHLUESSEL.navKopfKlein;
function setzeKopf(klein: boolean): void {
  document.documentElement.dataset['kopf'] = klein ? 'klein' : 'voll';
  try { localStorage.setItem(KOPF_KEY, klein ? '1' : '0'); } catch {  }
  document.getElementById('tb-nav-kopf-griff')?.setAttribute('aria-expanded', String(!klein));
}
const kopfKlein = () => document.documentElement.dataset['kopf'] === 'klein';
function baueKopfGriff(): void {
  const kopf = document.getElementById('tb-nav-kopf');
  if (!kopf || document.getElementById('tb-nav-kopf-griff')) return;
  const griff = document.createElement('button');
  griff.type = 'button';
  griff.id = 'tb-nav-kopf-griff';
  griff.className = 'tb-kopf-griff';
  griff.setAttribute('aria-controls', 'tb-nav-kacheln tb-nav-wp');
  griff.dataset['i18nAriaLabel'] = 'nav.kopfGriff';
  griff.setAttribute('aria-label', wort('nav.kopfGriff'));
  griff.innerHTML = '<span class="tb-eb-strich"></span><span class="tb-eb-strich"></span>';
  kopf.appendChild(griff);
  let start: number | null = null;
  let gezogen = false;
  let schluckeBis = 0;
  document.addEventListener('click', (e) => {
    if (Date.now() < schluckeBis && !griff.contains(e.target as Node)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  griff.addEventListener('touchend', (e) => { if (gezogen) e.preventDefault(); }, { passive: false });
  griff.addEventListener('pointerdown', (e) => {
    start = e.clientY;
    gezogen = false;
    try { griff.setPointerCapture(e.pointerId); } catch {  }
  });
  griff.addEventListener('pointermove', (e) => { if (start !== null && Math.abs(e.clientY - start) > 12) gezogen = true; });
  griff.addEventListener('pointerup', (e) => {
    if (start === null) return;
    const dy = e.clientY - start;
    start = null;
    schluckeBis = Date.now() + 500;
    if (!gezogen) { setzeKopf(!kopfKlein()); return; }
    if (dy < -30) setzeKopf(true);
    else if (dy > 30) setzeKopf(false);
  });
  griff.addEventListener('pointercancel', () => { start = null; });
  griff.addEventListener('click', (e) => { if (e.detail === 0) setzeKopf(!kopfKlein()); });
  griff.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setzeKopf(true); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setzeKopf(false); }
  });
  let klein = false;
  try { klein = localStorage.getItem(KOPF_KEY) === '1'; } catch {  }
  setzeKopf(klein);
}

export function initEinBildschirm(): void {
  const html = document.documentElement;
  html.classList.add('ein-an');

  if (!html.classList.contains('nav-an')) document.getElementById('btn-nav-auf')?.click();
  new MutationObserver(() => {
    if (!html.classList.contains('nav-an')) document.getElementById('btn-nav-auf')?.click();
  }).observe(html, { attributes: true, attributeFilter: ['class'] });
  baueSchublade();
  setzeStufe(liesStufe());
  baueKopfGriff();
  initKartenmenue();
  bindeFenster();
  bildschirmFesthalten();

  const werkzeug = document.getElementById('tb-nav-panel');
  if (werkzeug) {
    const merke = () => html.classList.toggle('eb-werkzeug-offen', !werkzeug.hidden);
    new MutationObserver(merke).observe(werkzeug, { attributes: true, attributeFilter: ['hidden'] });
    merke();
  }
}
