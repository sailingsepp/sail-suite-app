import L from 'leaflet';
import { karteObjekt, folgeNicht } from './karte';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { icon, type IconName } from '@/shell/icons';
import { nf, datumUhrLtVon } from '@/core/time';
import type { Punkt } from '@/core/types';
import { windBarbSVG } from '@/map/barbs';
import { richtungAusgeschrieben } from '@/map/wetterbild';
import {
  WIND_STUFEN, REGEN_STUFEN, GEWITTER_FARBE, STROM_STUFEN, ausduennung, ersteStunde, flaechenStufen, flaechenWerte, hex,
  mercatorVerhaeltnis, regenFarbe, stromAn, stromFarbe, wetterAn, windFarbe, yachtNach, type WetterEbene, type WetterFeld,
} from '@/core/wetterkarte';
import {
  MESSINA_ENGE, messinaStromAnPunktUtc, messinaStromGitter, messinaZonenStrom, mischeMessina, stromImGitter, type StromGitter,
} from '@/core/messinaStrom';
import { stromAnimationAus, zeigeStromAnimation } from './stromAnimation';
import { distNM } from '@/core/geo';
import { ausschnittStand, istLandJetzt, ladeLandImGebiet } from '@/data/landKacheln';
import { ladeWetterkarte, type WetterLaden } from '@/data/wetterkarte';
import {
  BLITZ_ALTER_MIN, BLITZ_KARTE_MIN, BLITZ_RADIEN, BLITZ_SCHRITT_MIN, BLITZ_ZELLE_GRAD, altersStufe, naechsterBlitz, type Blitz, type BlitzBox,
} from '@/core/blitze';
import { holeBlitze } from '@/data/blitze';
import { routeVoraus } from '@/core/blitze';
import { blitzRadius, setzeBlitzRadius } from './blitzwache';



export interface WetterAnbindung {
  boot(): Punkt | null;
  
  rest(): Punkt[] | null;
  
  fahrtKn(): number;
  online(): boolean;
  wort(k: string): string;
  sprache(): 'de' | 'en';
  
  zeige(punkte: Punkt[]): void;
}

const EBENE_PANE = 'tbWetter';
const MERKER = SCHLUESSEL.navWetter;

const SCHRITT_MS = 1500;

const STROM_STUNDEN = 12;

const letzteStunde = () => (feld ? (ebene === 'strom' ? Math.min(feld.zeiten.length - 1, ersteIdx + STROM_STUNDEN) : feld.zeiten.length - 1) : 0);
const FAHNE_PX = 52;

type Merker = { ebene: WetterEbene; flaeche: boolean };
const gemerkt = ((): Merker => {
  try {
    const m = JSON.parse(localStorage.getItem(MERKER) ?? 'null') as Partial<Merker> | null;
    return { ebene: m?.ebene ?? 'wind', flaeche: m?.flaeche ?? true };
  } catch { return { ebene: 'wind', flaeche: true }; }
})();
const merke = () => { try { localStorage.setItem(MERKER, JSON.stringify({ ebene, flaeche })); } catch {  } };

let ebene: WetterEbene = gemerkt.ebene;
let flaeche = gemerkt.flaeche;
let feld: WetterFeld | null = null;
let stand: WetterLaden | null = null;
let laedt = false;
let stunde = 0;
let ersteIdx = 0;
let spielt = 0;
let an: WetterAnbindung | null = null;
let offen = false;

let gruppe: L.LayerGroup | null = null;
let bild: L.ImageOverlay | null = null;
let geist: L.Marker | null = null;

let geistWeg: L.Polyline | null = null;
let wegRenderer: L.Renderer | null = null;

let geistT: number | null = null;
let rahmen = 0;
const ruhigeBewegung = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let zoomGebunden = false;
let renderer: L.Renderer | null = null;


let blitzStand: { blitze: Blitz[]; neuester: number; box: BlitzBox } | null = null;
let blitzFehler: 'netz' | 'dienst' | null = null;
let blitzLaedt = false;
let blitzTakt = 0;

const BLITZ_BOX_MAX_GRAD = 8;
const BLITZ_FARBEN = ['#FFF35C', '#F2A93B', '#A8502E'] as const;

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const w = (k: string) => an?.wort(k) ?? k;
const loc = () => (an?.sprache() === 'en' ? 'en-GB' : 'de-AT');

function karte(): L.Map | null {
  const k = karteObjekt();
  if (!k) return null;
  if (!k.getPane(EBENE_PANE)) {
    const p = k.createPane(EBENE_PANE);
    p.style.zIndex = '390';
    p.style.pointerEvents = 'none';
  }
  if (!gruppe) gruppe = L.layerGroup().addTo(k);
  if (!renderer) renderer = L.svg({ pane: EBENE_PANE });
  if (!zoomGebunden) {
    zoomGebunden = true;
    k.on('zoomend', () => { if (offen) zeichneKarte(); });
    
    k.on('moveend', () => { if (offen && ebene === 'blitze' && !ausschnittGeladen()) void ladeBlitze(); });
    
    k.on('moveend', () => { if (offen && ebene === 'strom') { zeichneKarte(); aktualisiere(); } });
  }
  return k;
}


export function wetterPanel(inhalt: HTMLElement, a: WetterAnbindung): void {
  an = a;
  if (!offen) {
    offen = true;
    void lade(true);
  } else if (!feld && !laedt && stand?.fehler === 'ohneOrt' && (a.boot() || a.rest()?.length)) {
    
    void lade(true);
  }
  if (!inhalt.querySelector('.tb-wk')) baue(inhalt);
  if (ebene === 'blitze') starteBlitze();
  aktualisiere();
}


export function wetterkarteAus(): void {
  offen = false;
  stromAnimationAus();
  halte();
  stoppeBlitze();
  gruppe?.clearLayers();
  bild?.remove(); bild = null;
  geist?.remove(); geist = null;
  geistWeg?.remove(); geistWeg = null;
}


let vorabLaeuft = false;
let vorabAb = 0;
const VORAB_ERNEUT_MS = 10 * 60_000;
export function wetterVorab(punkte: Punkt[], sofort = false): void {
  if (vorabLaeuft || !punkte.length || (!sofort && Date.now() < vorabAb)) return;
  vorabLaeuft = true;
  vorabAb = Date.now() + VORAB_ERNEUT_MS;
  void ladeWetterkarte(punkte, true).then((r) => { if (r.neu && !offen) feld = r.feld; }).finally(() => { vorabLaeuft = false; });
}

async function lade(zeigen: boolean): Promise<void> {
  if (!an) return;
  const boot = an.boot();
  const rest = an.rest();
  const punkte = [...(boot ? [boot] : []), ...(rest ?? [])];
  laedt = true;
  aktualisiere();
  stand = await ladeWetterkarte(punkte, an.online());
  laedt = false;
  feld = stand.feld;
  if (feld) {
    ersteIdx = ersteStunde(feld.zeiten, Date.now());
    stunde = Math.max(ersteIdx, Math.min(stunde, feld.zeiten.length - 1));
  }
  if (!offen) return;
  
  if (zeigen && punkte.length && ebene !== 'blitze') an.zeige(punkte);
  zeichneKarte();
  aktualisiere();
}

const EBENEN_SYMBOL: Record<WetterEbene, IconName> = {
  wind: 'wind', boeen: 'boeen', regen: 'regen', gewitter: 'gewitter', blitze: 'blitz', strom: 'strom',
};

const mitFlaechenWahl = (e: WetterEbene) => e === 'wind' || e === 'boeen';

function baue(inhalt: HTMLElement): void {
  const chip = (e: WetterEbene) => `<button type="button" class="tb-wk-chip" data-wk-ebene="${e}" aria-label="${esc(w(`wk.${e}`))}" title="${esc(w(`wk.${e}`))}">${icon(EBENEN_SYMBOL[e])}</button>`;
  inhalt.innerHTML = `<div class="tb-wk">
    <div class="tb-wk-ebenen" role="group" aria-label="${esc(w('wk.ebenen'))}">
      ${(['wind', 'boeen', 'regen', 'gewitter', 'blitze', 'strom'] as const).map(chip).join('')}
      <button type="button" class="tb-wk-chip tb-wk-flaeche" data-wk-flaeche aria-label="${esc(w('wk.flaeche'))}" title="${esc(w('wk.flaeche'))}">${icon('flaeche')}</button>
    </div>
    <div class="tb-wk-zeit">
      <button type="button" class="tb-wk-play" data-wk-play></button>
      <input type="range" class="tb-wk-regler" min="0" max="0" step="1" value="0" aria-label="${esc(w('wk.zeit'))}">
      <output class="tb-wk-uhr"></output>
    </div>
    <div class="tb-wk-legende"></div>
    <p class="tb-wk-info"></p>
    <p class="tb-wk-stand"></p>
  </div>`;
  inhalt.querySelectorAll<HTMLButtonElement>('[data-wk-ebene]').forEach((b) => b.addEventListener('click', () => {
    ebene = b.dataset['wkEbene'] as WetterEbene;
    if (ebene === 'blitze') { halte(); starteBlitze(); } else stoppeBlitze();
    merke(); zeichneKarte(); aktualisiere();
  }));
  inhalt.querySelector('[data-wk-flaeche]')?.addEventListener('click', () => { flaeche = !flaeche; merke(); zeichneKarte(); aktualisiere(); });
  inhalt.querySelector('[data-wk-play]')?.addEventListener('click', () => { if (spielt) halte(); else spiele(); aktualisiere(); });
  inhalt.querySelector('.tb-wk-legende')?.addEventListener('change', (ev) => {
    const sel = ev.target as HTMLSelectElement;
    if (!sel.matches('.tb-wk-radius')) return;
    setzeBlitzRadius(Number(sel.value));
    zeichneKarte(); aktualisiere();
  });
  const regler = inhalt.querySelector<HTMLInputElement>('.tb-wk-regler')!;
  regler.addEventListener('input', () => { halte(); stunde = Number(regler.value); zeichneKarte(); aktualisiere(); geistInsBild(); });
}


function spiele(): void {
  if (!feld) return;
  if (stunde >= letzteStunde()) stunde = ersteIdx;
  if (ruhigeBewegung()) {
    spielt = window.setInterval(() => {
      if (!feld || !offen || stunde >= letzteStunde()) { halte(); aktualisiere(); return; }
      stunde++;
      zeichneKarte();
      aktualisiere();
      geistInsBild();
    }, SCHRITT_MS);
    return;
  }
  const f = feld;
  geistT = f.zeiten[stunde]!;
  let zuletzt = performance.now();
  spielt = -1;
  const schritt = (jetzt: number) => {
    if (!feld || feld !== f || !offen || spielt === 0) return;
    const ende = f.zeiten[letzteStunde()]!;
    geistT = Math.min(ende, geistT! + ((jetzt - zuletzt) / SCHRITT_MS) * 3600_000);
    zuletzt = jetzt;
    let idx = stunde;
    while (idx < f.zeiten.length - 1 && f.zeiten[idx + 1]! <= geistT) idx++;
    if (idx !== stunde) { stunde = idx; zeichneKarte(); aktualisiere(); }
    else { const k = karte(); if (k) zeichneGeist(k); }
    geistInsBild();
    if (geistT >= ende) { halte(); aktualisiere(); return; }
    rahmen = requestAnimationFrame(schritt);
  };
  rahmen = requestAnimationFrame(schritt);
}
function halte(): void {
  if (spielt > 0) clearInterval(spielt);
  if (rahmen) cancelAnimationFrame(rahmen);
  spielt = 0;
  rahmen = 0;
  
  if (geistT !== null) { geistT = null; const k = karte(); if (k && offen) zeichneGeist(k); }
}


function geistInsBild(): void {
  const k = karte();
  if (!k || !geist) return;
  const panel = document.getElementById('tb-nav-panel');
  const r = panel && !panel.hidden ? panel.getBoundingClientRect() : null;
  const kr = k.getContainer().getBoundingClientRect();
  const breit = typeof matchMedia === 'function' && matchMedia('(min-width: 900px)').matches;
  const unten = r && !breit ? Math.max(0, kr.bottom - r.top) : 0;
  const links = r && breit ? Math.max(0, r.right - kr.left) : 0;
  const p = k.latLngToContainerPoint(geist.getLatLng());
  const rand = 40;
  if (p.x >= rand + links && p.x <= kr.width - rand && p.y >= rand && p.y <= kr.height - rand - unten) return;
  folgeNicht();
  k.panInside(geist.getLatLng(), { paddingTopLeft: L.point(rand + links, rand), paddingBottomRight: L.point(rand, rand + unten), animate: false });
}

const uhrzeit = (t: number) => datumUhrLtVon(t, loc() === 'en-GB' ? 'en' : 'de', { weekday: 'short' });


function aktualisiere(): void {
  const box = document.querySelector<HTMLElement>('.tb-wk');
  if (!box || !an) return;
  box.querySelectorAll<HTMLButtonElement>('[data-wk-ebene]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['wkEbene'] === ebene)));
  const fl = box.querySelector<HTMLButtonElement>('[data-wk-flaeche]')!;
  fl.disabled = !mitFlaechenWahl(ebene);
  fl.setAttribute('aria-pressed', String(flaeche && !fl.disabled));
  const titel = document.getElementById('tb-nav-panel-titel');
  if (titel) titel.textContent = `${w('nav.t.wetter')} · ${w(`wk.${ebene}`)}`;
  box.querySelector<HTMLElement>('.tb-wk-zeit')!.hidden = ebene === 'blitze';
  const play = box.querySelector<HTMLButtonElement>('[data-wk-play]')!;
  play.innerHTML = icon(spielt ? 'pause' : 'start');
  play.setAttribute('aria-label', w(spielt ? 'wk.halt' : 'wk.abspielen'));
  const regler = box.querySelector<HTMLInputElement>('.tb-wk-regler')!;
  const uhr = box.querySelector<HTMLOutputElement>('.tb-wk-uhr')!;
  const n = feld?.zeiten.length ?? 0;
  regler.disabled = play.disabled = !feld;
  regler.min = String(ersteIdx);
  regler.max = String(Math.max(ersteIdx, Math.min(n - 1, letzteStunde())));
  if (feld && stunde > letzteStunde()) stunde = letzteStunde();
  regler.value = String(stunde);
  if (feld) {
    const t = feld.zeiten[stunde]!;
    const plus = Math.round((t - Date.now()) / 3600_000);
    uhr.textContent = `${uhrzeit(t)}${plus > 0 ? ` (+${plus} h)` : ''}`;
  } else uhr.textContent = '–';
  const leg = box.querySelector<HTMLElement>('.tb-wk-legende')!;
  const neu = legende();
  if (leg.dataset['html'] !== neu) { leg.innerHTML = neu; leg.dataset['html'] = neu; }
  box.querySelector<HTMLElement>('.tb-wk-info')!.textContent = info();
  box.querySelector<HTMLElement>('.tb-wk-stand')!.textContent = standText();
}

function standText(): string {
  if (ebene === 'blitze') {
    if (blitzStand) return `${w('wk.blitzStand').replace('{zeit}', uhrzeit(blitzStand.neuester))} · ${w('wk.blitzQuelle')}${blitzLaedt ? ` · ${w('wk.blitzLaedt')}` : ''}`;
    return blitzFehler === 'netz' ? w('wk.blitzNurNetz') : blitzFehler === 'dienst' ? w('wk.blitzFehler') : w('wk.blitzLaedt');
  }
  if (laedt && !feld) return w('wk.laedt');
  if (!feld) return w(stand?.fehler === 'kontingent' ? 'wk.kontingent' : stand?.fehler === 'netz' ? 'wk.keineDaten' : stand?.fehler === 'ohneOrt' ? 'wk.ohneOrt' : 'wk.laedt');
  const quelle = ebene === 'strom'
    ? (feld.reihen.strom ? w('wk.quelleStrom') : w('wk.stromFehlt')) + (messinaImBild() ? ` · ${w('wk.quelleMessina')}` : '')
    : w(feld.modell === 'ecmwf_ifs025' ? 'wk.quelleEcmwf' : 'wk.quelleStandard');
  const vor = `${w('wk.stand')} ${uhrzeit(feld.geholt)}`;
  const zusatz = laedt ? ` · ${w('wk.laedt')}` : stand?.fehler === 'kontingent' ? ` · ${w('wk.kontingent')}` : '';
  return `${vor} · ${quelle}${zusatz}`;
}


function ort(): { p: Punkt; geist: ReturnType<typeof yachtNach> } | null {
  if (!feld || !an) return null;
  const rest = an.rest();
  const boot = an.boot();
  const stunden = Math.max(0, ((geistT ?? feld.zeiten[stunde]!) - Date.now()) / 3600_000);
  
  const g = rest && rest.length >= 2 ? yachtNach(rest, an.fahrtKn(), stunden) : null;
  const p = g?.p ?? boot;
  return p ? { p, geist: g } : null;
}

function info(): string {
  if (ebene === 'blitze') {
    if (!blitzStand || !an) return '';
    const boot = an.boot();
    const n = boot ? naechsterBlitz(blitzStand.blitze, boot) : null;
    if (!n) return blitzStand.blitze.length ? '' : w('wk.blitzKeine');
    const s = an.sprache();
    return w('wk.blitzNaechste').replace('{sm}', nf(n.sm, n.sm < 10 ? 1 : 0, s))
      .replace('{richtung}', richtungAusgeschrieben(n.peilung, s)).replace('{zeit}', uhrzeit(n.t));
  }
  if (ebene === 'strom') return stromInfo();
  const o = ort();
  if (!o || !feld || !an) return '';
  const x = wetterAn(feld, stunde, o.p.lat, o.p.lon);
  if (!x) return '';
  const s = an.sprache();
  const teile = [w('wk.infoWind').replace('{kn}', String(Math.round(x.kn))).replace('{von}', richtungAusgeschrieben(x.von, s))];
  if (x.boeenKn !== null) teile.push(w('wk.infoBoeen').replace('{kn}', String(Math.round(x.boeenKn))));
  if (x.regenMm !== null && x.regenMm >= 0.1) teile.push(w('wk.infoRegen').replace('{mm}', nf(x.regenMm, 1, s)));
  if (x.gewitter) teile.push(w(x.gewitter === 'gewitter' ? 'wk.gewitterStufe' : 'wk.neigungStufe'));
  const wer = o.geist ? (o.geist.amZiel ? w('wk.amZiel') : w('wk.yachtUnterwegs').replace('{sm}', nf(o.geist.sm, 1, s))) : w('wk.yacht');
  return `${wer}: ${teile.join(' · ')}`;
}


const stromZeit = () => (feld ? feld.zeiten[stunde]! : Date.now());


function stromBei(lat: number, lon: number, t: number): { speed: number; dir: number } | null {
  const modell = feld ? stromAn(feld, stunde, lat, lon) : null;
  const m = messinaStromAnPunktUtc(lat, lon, t);
  return m ? mischeMessina(modell ?? { speed: 0, dir: 0, valid: false }, m) : modell;
}

function stromInfo(): string {
  if (!an) return '';
  const o = ort() ?? (an.boot() ? { p: an.boot()!, geist: null } : null);
  if (!o) return '';
  const st = stromBei(o.p.lat, o.p.lon, stromZeit());
  if (!st) return '';
  const s = an.sprache();
  const wer = o.geist ? (o.geist.amZiel ? w('wk.amZiel') : w('wk.yachtUnterwegs').replace('{sm}', nf(o.geist.sm, 1, s))) : w('wk.yacht');
  return `${wer}: ${w('wk.infoStrom').replace('{kn}', nf(st.speed, 1, s)).replace('{nach}', richtungAusgeschrieben(st.dir, s))}`;
}


const MESSINA_FELD_SM = 12;

const MESSINA_FELD_GRAD = 0.004;


function messinaImBild(): boolean {
  const k = karteObjekt();
  if (!k) return false;
  const r = MESSINA_FELD_SM / 60, c = Math.cos((MESSINA_ENGE.lat * Math.PI) / 180);
  return k.getBounds().intersects(L.latLngBounds([MESSINA_ENGE.lat - r, MESSINA_ENGE.lon - r / c], [MESSINA_ENGE.lat + r, MESSINA_ENGE.lon + r / c]));
}


let messinaFeld: { t: number; mitModell: boolean; landBereit: boolean; g: StromGitter } | null = null;
let landLaedt = false;
function messinaBox() {
  const r = MESSINA_FELD_SM / 60, c = Math.cos((MESSINA_ENGE.lat * Math.PI) / 180);
  return { swLat: MESSINA_ENGE.lat - r, swLon: MESSINA_ENGE.lon - r / c, neLat: MESSINA_ENGE.lat + r, neLon: MESSINA_ENGE.lon + r / c };
}
function messinaGitter(t: number): StromGitter {
  const mitModell = !!feld?.reihen.strom;
  const box = messinaBox();
  const landBereit = ausschnittStand(box) !== 'fehlt';
  if (!landBereit && !landLaedt) {
    landLaedt = true;
    void ladeLandImGebiet(box, an?.online() ?? false).finally(() => {
      landLaedt = false;
      if (ausschnittStand(box) === 'fehlt') return;
      messinaFeld = null;
      if (offen && ebene === 'strom') zeichneKarte();
    });
  }
  if (messinaFeld && messinaFeld.t === t && messinaFeld.mitModell === mitModell && messinaFeld.landBereit === landBereit) return messinaFeld.g;
  const f = feld;
  const modell = mitModell && f ? (lat: number, lon: number) => stromAn(f, stunde, lat, lon) : null;
  const g = messinaStromGitter(t, MESSINA_FELD_SM, MESSINA_FELD_GRAD, modell, (lat, lon) => istLandJetzt(lat, lon) !== true);
  messinaFeld = { t, mitModell, landBereit, g };
  return g;
}

function legende(): string {
  if (ebene === 'blitze') {
    const [a, b] = BLITZ_ALTER_MIN;
    const stufen = [`< ${a}`, `${a}–${b}`, `${b}–${BLITZ_KARTE_MIN + 15}`];
    const felder = stufen.map((t, i) => `<span class="tb-wk-feld"><i class="tb-wk-punkt" style="background:${BLITZ_FARBEN[i]}"></i>${t}</span>`).join('')
      + `<span class="tb-wk-einheit">${esc(w('wk.blitzAlter'))}</span>`;
    const r = blitzRadius();
    const optionen = BLITZ_RADIEN.map((sm) => `<option value="${sm}"${sm === r ? ' selected' : ''}>${sm ? `${sm} ${an?.sprache() === 'en' ? 'NM' : 'sm'}` : esc(w('wk.blitzAus'))}</option>`).join('');
    return felder + `<label class="tb-wk-warnen">${esc(w('wk.blitzWarnen'))} <select class="tb-wk-radius">${optionen}</select></label>`;
  }
  if (ebene === 'gewitter') {
    const fl = (s: 'neigung' | 'gewitter') => {
      const [[r, g, b], a] = GEWITTER_FARBE[s];
      return `<span class="tb-wk-feld"><i style="background:rgba(${r},${g},${b},${Math.min(1, a + 0.3)})"></i>${esc(w(s === 'gewitter' ? 'wk.gewitterStufe' : 'wk.neigungStufe'))}</span>`;
    };
    return fl('neigung') + fl('gewitter');
  }
  if (ebene === 'strom') {
    const max = 5;
    const verlauf = STROM_STUFEN.map(([kn, c]) => `${hex(c)} ${Math.round((kn / max) * 100)}%`).join(', ');
    const marken = [0, 1, 2, 3, 4, 5].map((kn) => `<span style="left:${(kn / max) * 100}%">${kn}</span>`).join('');
    return `<div class="tb-wk-skala"><div class="tb-wk-verlauf" style="background:linear-gradient(90deg, ${verlauf})"></div>`
      + `<div class="tb-wk-marken">${marken}</div></div><span class="tb-wk-einheit">kn</span>`;
  }
  if (ebene === 'regen') {
    return REGEN_STUFEN.map(([mm, [r, g, b]]) => `<span class="tb-wk-feld"><i style="background:rgb(${r},${g},${b})"></i>${nf(mm, mm < 1 ? 1 : 0, an?.sprache() ?? 'de')}</span>`).join('')
      + `<span class="tb-wk-einheit">${esc(w('wk.mm'))}</span>`;
  }
  const max = 50;
  const verlauf = WIND_STUFEN.map(([kn, c]) => `${hex(c)} ${Math.round((kn / max) * 100)}%`).join(', ');
  const marken = [0, 10, 20, 30, 40].map((kn) => `<span style="left:${(kn / max) * 100}%">${kn}</span>`).join('');
  return `<div class="tb-wk-skala"><div class="tb-wk-verlauf" style="background:linear-gradient(90deg, ${verlauf})"></div>`
    + `<div class="tb-wk-marken">${marken}</div></div><span class="tb-wk-einheit">kn</span>`;
}



function zeichneKarte(): void {
  const k = karte();
  if (!k || !gruppe) return;
  gruppe.clearLayers();
  if (!offen || ebene !== 'strom') stromAnimationAus();
  if (offen && ebene === 'blitze') { bild?.remove(); bild = null; geist?.remove(); geist = null; geistWeg?.remove(); geistWeg = null; zeichneBlitze(); return; }
  if (offen && ebene === 'strom') {
    bild?.remove(); bild = null;
    zeichneStrom(k);
    if (feld) zeichneGeist(k); else { geist?.remove(); geist = null; geistWeg?.remove(); geistWeg = null; }
    return;
  }
  if (!offen || !feld) { bild?.remove(); bild = null; geist?.remove(); geist = null; geistWeg?.remove(); geistWeg = null; return; }
  zeichneFlaeche(k);
  if (ebene === 'wind' || ebene === 'boeen') zeichneFahnen(k);
  zeichneGeist(k);
}

function zeichneFlaeche(k: L.Map): void {
  const f = feld!;
  const mitFlaeche = ebene === 'regen' || ebene === 'gewitter' || (flaeche && mitFlaechenWahl(ebene));
  if (!mitFlaeche || f.lats.length < 2 || f.lons.length < 2) { bild?.remove(); bild = null; return; }
  const breite = Math.min(320, (f.lons.length - 1) * 16);
  const hoehe = Math.max(2, Math.min(480, Math.round(breite * mercatorVerhaeltnis(f))));
  const c = document.createElement('canvas');
  c.width = breite; c.height = hoehe;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(breite, hoehe);
  const d = img.data;
  if (ebene === 'gewitter') {
    const st = flaechenStufen(f, stunde, breite, hoehe);
    for (let q = 0; q < st.length; q++) {
      if (!st[q]) continue;
      const [[r, g, b], a] = GEWITTER_FARBE[st[q] === 2 ? 'gewitter' : 'neigung'];
      d.set([r, g, b, Math.round(a * 255)], q * 4);
    }
  } else {
    const werte = flaechenWerte(f, ebene === 'regen' || ebene === 'boeen' ? ebene : 'wind', stunde, breite, hoehe);
    for (let q = 0; q < werte.length; q++) {
      const v = werte[q]!;
      if (Number.isNaN(v)) continue;
      if (ebene === 'regen') {
        const rf = regenFarbe(v);
        if (rf) d.set([...rf[0], Math.round(rf[1] * 255)], q * 4);
      } else d.set([...windFarbe(v), 150], q * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  const grenzen = L.latLngBounds([f.lats[0]!, f.lons[0]!], [f.lats.at(-1)!, f.lons.at(-1)!]);
  const url = c.toDataURL();
  if (bild) bild.setUrl(url);
  else bild = L.imageOverlay(url, grenzen, { pane: EBENE_PANE, interactive: false, className: 'tb-wk-bild' }).addTo(k);
  bild.setBounds(grenzen);
}

function zeichneFahnen(k: L.Map): void {
  const f = feld!;
  const m = f.lons.length;
  const a = k.latLngToContainerPoint([f.lats[0]!, f.lons[0]!]);
  const b = k.latLngToContainerPoint([f.lats[0]!, f.lons[Math.min(1, m - 1)]!]);
  const schritt = ausduennung(Math.abs(b.x - a.x));
  const sicht = k.getBounds().pad(0.1);
  const reihe = ebene === 'boeen' ? f.reihen.boeen : f.reihen.wind;
  for (let i = 0; i < f.lats.length; i += schritt) {
    for (let j = 0; j < m; j += schritt) {
      const lat = f.lats[i]!, lon = f.lons[j]!;
      if (!sicht.contains([lat, lon])) continue;
      const kk = i * m + j;
      const kn = reihe[kk]?.[stunde], von = f.reihen.richtung[kk]?.[stunde];
      if (typeof kn !== 'number' || typeof von !== 'number') continue;
      const farbe = flaeche ? '#FFFFFF' : hex(windFarbe(kn));
      L.marker([lat, lon], {
        pane: EBENE_PANE, interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'tb-wk-fahne karte-mitdrehen', html: windBarbSVG(von, kn, lat, farbe, FAHNE_PX), iconSize: [FAHNE_PX, FAHNE_PX], iconAnchor: [FAHNE_PX / 2, FAHNE_PX / 2] }),
      }).addTo(gruppe!);
    }
  }
}

const STROM_PX = 26;

function stromPfeil(lat: number, lon: number, kn: number, nach: number, messina: boolean, klein = false): void {
  const farbe = hex(stromFarbe(kn));
  const px = klein ? 20 : STROM_PX;
  const html = `<svg viewBox="0 0 20 20" width="${px}" height="${px}" style="transform:rotate(${Math.round(nach)}deg)">`
    + `<path d="M10 2L15.5 9.5H12V18H8V9.5H4.5Z" fill="${farbe}" stroke="#0B1E2D" stroke-width="${klein ? 1.4 : 1.2}" stroke-linejoin="round"/></svg>`
    + (klein ? '' : `<span>${nf(kn, 1, an?.sprache() ?? 'de')}</span>`);
  L.marker([lat, lon], {
    pane: EBENE_PANE, interactive: false, keyboard: false,
    icon: L.divIcon({
      className: `tb-wk-strom karte-mitdrehen${messina ? ' messina' : ''}${klein ? ' klein' : ''}`, html,
      iconSize: klein ? [px, px] : [px + 10, px + 12], iconAnchor: klein ? [px / 2, px / 2] : [(px + 10) / 2, px / 2],
    }),
  }).addTo(gruppe!);
}


const FELD_PX = 44;
function zeichneMessinaFeld(k: L.Map, t: number): void {
  const g = messinaGitter(t);
  const sicht = k.getBounds();
  const mitWert: L.Point[] = [];
  const gross = (lat: number, lon: number, kn: number, nach: number) => {
    if (!sicht.pad(0.05).contains([lat, lon])) return;
    stromPfeil(lat, lon, kn, nach, true);
    mitWert.push(k.latLngToContainerPoint([lat, lon]));
  };
  if (k.getZoom() >= 12) for (const z of messinaZonenStrom(t)) gross(z.ort.lat, z.ort.lon, z.kn, z.nach);
  else {
    const e = stromImGitter(g, MESSINA_ENGE.lat, MESSINA_ENGE.lon);
    if (e) gross(MESSINA_ENGE.lat, MESSINA_ENGE.lon, Math.hypot(e.u, e.v), ((Math.atan2(e.u, e.v) * 180) / Math.PI + 360) % 360);
  }
  const groesse = k.getSize();
  for (let y = FELD_PX / 2; y < groesse.y; y += FELD_PX) {
    for (let x = FELD_PX / 2; x < groesse.x; x += FELD_PX) {
      if (mitWert.some((p) => Math.abs(p.x - x) < 26 && Math.abs(p.y - y) < 30)) continue;
      const ll = k.containerPointToLatLng([x, y]);
      const s = stromImGitter(g, ll.lat, ll.lng);
      if (!s) continue;
      const kn = Math.hypot(s.u, s.v);
      if (kn < 0.05) continue;
      stromPfeil(ll.lat, ll.lng, kn, ((Math.atan2(s.u, s.v) * 180) / Math.PI + 360) % 360, true, true);
    }
  }
  zeigeStromAnimation(k, EBENE_PANE, g);
}


function zeichneStrom(k: L.Map): void {
  const t = stromZeit();
  const sicht = k.getBounds().pad(0.1);
  const f = feld;
  if (f?.reihen.strom && f.reihen.stromNach) {
    const m = f.lons.length;
    const a = k.latLngToContainerPoint([f.lats[0]!, f.lons[0]!]);
    const b = k.latLngToContainerPoint([f.lats[0]!, f.lons[Math.min(1, m - 1)]!]);
    const schritt = ausduennung(Math.abs(b.x - a.x), 64);
    for (let i = 0; i < f.lats.length; i += schritt) {
      for (let j = 0; j < m; j += schritt) {
        const lat = f.lats[i]!, lon = f.lons[j]!;
        if (!sicht.contains([lat, lon]) || istLandJetzt(lat, lon) === true) continue;
        
        if (distNM(lat, lon, MESSINA_ENGE.lat, MESSINA_ENGE.lon) < MESSINA_FELD_SM) continue;
        const kk = i * m + j;
        const kn = f.reihen.strom[kk]?.[stunde], nach = f.reihen.stromNach[kk]?.[stunde];
        if (typeof kn !== 'number' || typeof nach !== 'number') continue;
        const mm = messinaStromAnPunktUtc(lat, lon, t);
        const st = mm ? mischeMessina({ speed: kn, dir: nach, valid: true }, mm) : { speed: kn, dir: nach };
        stromPfeil(lat, lon, st.speed, st.dir, false);
      }
    }
  }
  if (messinaImBild() && k.getZoom() >= 9) zeichneMessinaFeld(k, t);
  else stromAnimationAus();
}


function zeichneGeist(k: L.Map): void {
  const o = ort();
  const rest = an?.rest();
  if (!o?.geist || !feld || !rest) { geist?.remove(); geist = null; geistWeg?.remove(); geistWeg = null; return; }
  const { p, kurs, sm } = o.geist;
  const weg = routeVoraus(rest, sm).map((q) => L.latLng(q.lat, q.lon));
  if (!wegRenderer) wegRenderer = L.svg({ pane: 'tbNamen' });
  if (!k.getPane('tbNamen')) k.createPane('tbNamen').style.zIndex = '650';
  if (!geistWeg) {
    geistWeg = L.polyline(weg, { pane: 'tbNamen', renderer: wegRenderer, interactive: false, color: '#0B1E2D', weight: 3, dashArray: '2 6', lineCap: 'round', className: 'tb-wk-geist-weg' }).addTo(k);
  } else geistWeg.setLatLngs(weg);
  const t = geistT ?? feld.zeiten[stunde]!;
  const html = `<svg viewBox="0 0 18 24" width="22" height="29" style="transform:rotate(${Math.round(kurs)}deg)"><path d="M9 1L17 23L9 18L1 23Z"/></svg>`
    + `<span class="tb-wk-geist-zeit">${esc(uhrzeit(t))}</span>`;
  const ic = L.divIcon({ className: 'tb-wk-geist karte-mitdrehen', html, iconSize: [24, 24], iconAnchor: [12, 12] });
  if (!geist) {
    if (!k.getPane('tbNamen')) k.createPane('tbNamen').style.zIndex = '650';
    geist = L.marker([p.lat, p.lon], { pane: 'tbNamen', interactive: false, keyboard: false, icon: ic }).addTo(k);
  } else {
    geist.setLatLng([p.lat, p.lon]);
    geist.setIcon(ic);
  }
}



function sichtBox(): BlitzBox | null {
  const k = karteObjekt();
  if (!k) return null;
  const b = k.getBounds().pad(0.1);
  const mLat = (b.getNorth() + b.getSouth()) / 2, mLon = (b.getEast() + b.getWest()) / 2;
  const hLat = Math.min(BLITZ_BOX_MAX_GRAD / 2, (b.getNorth() - b.getSouth()) / 2);
  const hLon = Math.min(BLITZ_BOX_MAX_GRAD / 2, (b.getEast() - b.getWest()) / 2);
  const r = (x: number, auf: boolean) => (auf ? Math.ceil(x * 10) : Math.floor(x * 10)) / 10;
  return { s: r(Math.max(-70, mLat - hLat), false), n: r(Math.min(70, mLat + hLat), true), w: r(mLon - hLon, false), o: r(mLon + hLon, true) };
}

function ausschnittGeladen(): boolean {
  const s = sichtBox();
  const b = blitzStand?.box;
  return !!s && !!b && s.s >= b.s && s.n <= b.n && s.w >= b.w && s.o <= b.o;
}

async function ladeBlitze(): Promise<void> {
  if (!an || blitzLaedt) return;
  if (!an.online()) { blitzFehler = 'netz'; aktualisiere(); return; }
  const box = sichtBox();
  if (!box) return;
  blitzLaedt = true;
  aktualisiere();
  try {
    const r = await holeBlitze(box, BLITZ_KARTE_MIN);
    blitzStand = { blitze: r.blitze, neuester: r.neuester, box };
    blitzFehler = null;
  } catch {
    blitzFehler = 'dienst';
  } finally {
    blitzLaedt = false;
  }
  if (offen && ebene === 'blitze') { zeichneKarte(); aktualisiere(); }
}


function zeigeBlitzUmgebung(): void {
  const boot = an?.boot();
  if (!boot || !an) return;
  const r = (blitzRadius() || 15) / 60;
  const c = Math.max(0.2, Math.cos((boot.lat * Math.PI) / 180));
  an.zeige([{ lat: boot.lat + r, lon: boot.lon }, { lat: boot.lat - r, lon: boot.lon }, { lat: boot.lat, lon: boot.lon + r / c }, { lat: boot.lat, lon: boot.lon - r / c }]);
}

function starteBlitze(): void {
  if (blitzTakt) return;
  zeigeBlitzUmgebung();
  
  window.setTimeout(() => { if (offen && ebene === 'blitze') void ladeBlitze(); }, 400);
  blitzTakt = window.setInterval(() => { if (offen && ebene === 'blitze') void ladeBlitze(); }, BLITZ_SCHRITT_MIN * 60_000);
}
function stoppeBlitze(): void {
  if (blitzTakt) clearInterval(blitzTakt);
  blitzTakt = 0;
}

function zeichneBlitze(): void {
  if (!gruppe || !renderer) return;
  const jetzt = Date.now();
  const boot = an?.boot();
  const radius = blitzRadius();
  if (boot && radius > 0) {
    L.circle([boot.lat, boot.lon], {
      radius: radius * 1852, pane: EBENE_PANE, renderer, interactive: false, fill: false,
      color: '#F2A93B', weight: 2, dashArray: '6 6', className: 'tb-wk-radiuskreis',
    }).addTo(gruppe);
  }
  if (!blitzStand) return;
  
  const zellen = new Map<string, Blitz>();
  for (const b of blitzStand.blitze) {
    const k = `${b.lat}|${b.lon}`;
    const da = zellen.get(k);
    if (!da || b.t > da.t) zellen.set(k, b);
  }
  const sortiert = [...zellen.values()].sort((a, b) => a.t - b.t);
  
  const h = BLITZ_ZELLE_GRAD / 2;
  for (const b of sortiert) {
    L.rectangle([[b.lat - h, b.lon - h], [b.lat + h, b.lon + h]], {
      pane: EBENE_PANE, renderer, interactive: false, stroke: false,
      fillColor: BLITZ_FARBEN[altersStufe(b.t, jetzt)], fillOpacity: 0.65, className: 'tb-wk-blitz',
    }).addTo(gruppe);
  }
}


export function _zustand(): { ebene: WetterEbene; flaeche: boolean; stunde: number; feld: WetterFeld | null } {
  return { ebene, flaeche, stunde, feld };
}
