import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { icon, type IconName } from '@/shell/icons';
import { initModal } from '@/shell/modal';
import { kursGrad, kursRw, nf, rwZeichen, uhrLtVon, hhmmInZone } from '@/core/time';
import { leseZahl } from '@/core/kompendium';
import { distNM } from '@/core/geo';
import { vtgAnnaeherung, vtgFreigeben, type VtgGebiet } from '@/core/vtgNaehe';
import { VTG_FLAECHEN, vtgInBox } from '@/core/messinaVtg';
import { verkehrJetzt } from '@/data/seekartenObjekte';
import { liesNavUrl, ohneNavParameter } from '@/core/navUebergabe';
import { positionText } from '@/core/koordinaten';
import type { Punkt } from '@/core/types';
import type { SpurPunkt } from '@/core/spur';
import {
  navWerte, pruefeFortschritt, nachholen, geglaetteteSog, rueckwegAusSpur, routenLaengeSm, messe, messeKette, xteBalkenProzent, steuerSeite, XTE_AUF_KURS_SM,
  STEHT_KN, PLANFAHRT_KN, PLANFAHRT_MIN_KN, PLANFAHRT_MAX_KN, planZeiten, zeitBisPassage,
  OFFTRACK_STUFEN_SM, offTrackTakt, type OffTrackStand, ANKUNFT_STUFEN_SM, ankunftSm, etaBand,
  type NavRoute, type NavWegpunkt, type NavWerte, type RoutenQuelle, type Gefahr,
} from '@/core/navigation';
import {
  planeRoute, pruefeRoute, ladeRoutenDaten, flachsteStelle, ABSTAENDE_SM,
  type RoutenDaten, type RoutenPruefung,
  startAusPosition, type PlanSchritt, type Untiefe,
} from '@/data/navroute';
import type { LogEintrag } from '@/data/logdb';
import { STRINGS } from './strings';
import { fetchSeegebiet, fetchStaatsnamen } from '@/data/seegebiete';
import { hoheitAusAntwort, stichprobenEntlang } from '@/core/seegrenze';
import { hoheitsStaat } from '@/briefing/seegebiet';
import { schengenGrenze, istGrenzuebertritt, kanon } from '@/core/grenzen';
import { streamRouteAus, type StreamRoute } from '@/core/streamRoute';
import { STAATSNAMEN } from '@/briefing/seegebiet';
import type { Zustand } from './aufzeichnung';
import {
  setzeKartenklick, zeichneAktiveRoute, zeichnePlan, zeichneGefahren, zeichneMessung, zeichneMob,
  zeichneAnkerVorschau, zeigePunkte, zeichneGriffe, zeichneUntiefe, type GriffAktionen,
} from './navkarte';
import { darfLoeschen, fuegeEin, loescheWegpunkt, verschiebe } from '@/core/routeBearbeiten';
import { macheWischbar, wischZeile, type Wischliste } from '@/shell/wischListe';
import { zielname } from '@/shell/zielname';
import { grenzenEntlang, fortschrittSm, grenzStand, type Grenzuebergang } from '@/core/routenGrenzen';
import { zoneAn, warneGrenzeVoraus, loggeGrenze } from './seegrenze';
import { istOnline } from './netz';
import { seekartenNamen } from '@/map/seekartenNamen';
import { zentriere, seezeichenAn, setzeSeezeichen, sichtbarerAusschnitt, karteZiehenNeu, karteObjekt, seekarteObjekt, kartenWinkel, radarObjekt, luftbildObjekt, kartenStil, setzeKartenStil } from './karte';
import { oeffneSeewetter } from './seewetter';
import { stoppeTon } from './ton';
import { sage, verwirf } from './ansage';
import { ANSAGE, annaeherungText, faelligeAnnaeherung, offTrackText, routeGestartet, vtgText, wegpunktText, ANNAEHERUNG_ANSAGEN_S } from '@/core/ansagen';
import { vorhaltJetzt } from './vorhalt';
import { initTimer, schalteTimer, timerOffen, timerPlatzNeu } from './timer';
import { initStoppuhr, schalteStoppuhr, stoppuhrOffen, stoppuhrPlatzNeu } from './stoppuhr';
import { wetterPanel, wetterkarteAus, wetterVorab, type WetterAnbindung } from './wetterkarte';
import { pruefeBlitze } from './blitzwache';
import { setzeKompass } from './kompassband';
import { nurLangDruck } from './langDruck';
import { initKartenObjekte } from './kartenObjekte';
import { initLeuchtfeuer, feuerBootGeaendert, feuerPlaetze, beiFeuerGezeichnet } from './leuchtfeuer';

export interface NavAnbindung {

  position(): Punkt | null;

  schnittSeit(ms: number): number | null;

  tiefgangM(): number | null;

  etappen(): Promise<{ wegpunkte: Punkt[]; vonName: string | null; nachName: string | null } | 'offline' | 'keine' | 'ohneToern'>;
  eintrag(e: Omit<LogEintrag, 'fahrt'>): void;
  aktiviereAnker(radiusM: number): void;
  hebeAnkerAuf(): void;

  vorladen(fortschritt: (text: string) => void): Promise<boolean>;
}

type Modus = 'log' | 'nav';
type Werkzeug = 'route' | 'gehezu' | 'messen' | 'anker' | 'rueckweg' | 'wetter' | 'karten' | 'log' | 'chrono' | 'karte';
const WERKZEUGE: { w: Werkzeug; icon: IconName }[] = [

  { w: 'route', icon: 'route' }, { w: 'gehezu', icon: 'zielpunkt' }, { w: 'wetter', icon: 'wind' }, { w: 'karte', icon: 'karten' },
  { w: 'messen', icon: 'messen' }, { w: 'chrono', icon: 'stoppuhr' }, { w: 'anker', icon: 'anker' }, { w: 'rueckweg', icon: 'rueckweg' },
];

const werkzeugListe = () => (einBildschirm()
  ? [{ w: 'log' as Werkzeug, icon: 'buch' as IconName }, ...WERKZEUGE.filter((x) => x.w !== 'anker')] : WERKZEUGE);

export type KachelWert = 'SOG' | 'COG' | 'HDG' | 'VOR' | 'SET' | 'DFT' | 'BRG' | 'DTW' | 'ETA' | 'TTG' | 'XTE' | 'VMG' | 'DTZ' | 'ETZ' | 'ETR' | 'AVG' | 'SOT' | 'LT' | 'UTC';
const ALLE_KACHELN: KachelWert[] = ['SOG', 'COG', 'HDG', 'VOR', 'SET', 'DFT', 'BRG', 'DTW', 'ETA', 'TTG', 'XTE', 'VMG', 'DTZ', 'ETZ', 'ETR', 'AVG', 'SOT', 'LT', 'UTC'];

const MODELL_KACHELN: ReadonlySet<KachelWert> = new Set(['HDG', 'VOR', 'SET', 'DFT']);

const ZUM_WEGPUNKT: ReadonlySet<KachelWert> = new Set(['BRG', 'DTW', 'ETA', 'TTG', 'XTE', 'VMG']);

const UHR_KACHELN: ReadonlySet<KachelWert> = new Set(['LT', 'UTC']);

const PLAETZE = 6;
const VORGABE: Record<'schmal' | 'breit', KachelWert[]> = {
  schmal: ['SOG', 'COG', 'DTW', 'ETA', 'BRG', 'TTG'], breit: ['SOG', 'COG', 'BRG', 'DTW', 'ETA', 'TTG'],
};

const K = {
  modus: 'sail-suite:nav-modus',
  route: 'sail-suite:nav-route',
  mob: 'sail-suite:nav-mob',
  kacheln: (l: string) => `sail-suite:nav-kacheln-${l}`,
  regionen: 'sail-suite:nav-regionen',
  planung: 'sail-suite:nav-planung',
  plan: 'sail-suite:nav-plan',
  leisteZu: 'sail-suite:nav-leiste-zu',

  grenzen: 'sail-suite:nav-grenzen',
};
function lies<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; }
}
function schreibe(k: string, v: unknown): void {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {  }
}

const $ = (id: string) => document.getElementById(id);
const sprache = () => aktuelleSprache();
const wort = (k: string): string => STRINGS[sprache()][k] ?? k;
const smEinheit = () => (sprache() === 'de' ? 'sm' : 'NM');
const uhr = (t: number) => uhrLtVon(t);
const hm = (s: number) => { const m = Math.round(s / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const breit = () => matchMedia('(min-width: 900px)').matches;

let an!: NavAnbindung;
let modus: Modus = 'log';
let route: NavRoute | null = lies<NavRoute>(K.route);
let mob: { lat: number | null; lon: number | null; t: number } | null = lies(K.mob);
let werkzeug: Werkzeug | null = null;
let z: Zustand | null = null;
let spur: SpurPunkt[] = [];
let werte: NavWerte | null = null;

interface Plan {
  punkte: NavWegpunkt[];
  quelle: RoutenQuelle;
  zielName: string;
  daten: RoutenDaten | null;
  pruefung: RoutenPruefung | null;
  ohneWeg: boolean;
  rechnet: boolean;

  flachste: Untiefe | null;
  meldung: string | null;

  startFest?: boolean;

  startSucht?: boolean;

  schritt?: PlanSchritt | null;

  grenze?: Grenze | null;
}

type Grenze = { von: string; nach: string; art: 'binnen' | 'aussen' | 'ohne'; international: boolean | null };
let plan: Plan | null = null;

let gewaehlt: number | null = null;
let aktivPruefung: { daten: RoutenDaten; pruefung: RoutenPruefung; versatz: number } | null = null;
let routeGeaendert = false;

const planung = {
  abstand: 0.2, fahrt: PLANFAHRT_KN, ab: null as number | null, offTrack: null as number | null,
  ...lies<{ abstand: number; fahrt: number; ab?: number | null; offTrack?: number | null }>(K.planung),
};

let band: { wp: { frueh: number; spaet: number } | null; ziel: { frueh: number; spaet: number } | null } = { wp: null, ziel: null };

let offTrack: OffTrackStand = { alarm: false, letzterTon: null };

const bootFuerPlan = (): Punkt | null => (z && z.betriebsart !== 'gestoppt' && !startAufKarte ? an.position() : null);

let startAufKarte = false;
const einBildschirm = () => document.documentElement.classList.contains('ein-an');

function startWahlMoeglich(): boolean {
  return einBildschirm() && !!z && z.betriebsart !== 'gestoppt';
}

function speicherePlan(): void {
  schreibe(K.plan, plan && plan.punkte.length >= 2
    ? { punkte: plan.punkte, quelle: plan.quelle, zielName: plan.zielName, startFest: !!plan.startFest } : null);
}

let messAbBoot = true;

let messPunkte: Punkt[] = [];
let messVerlauf: Punkt[][] = [];
const MESS_VERLAUF_MAX = 50;
function messMerken(): void {
  messVerlauf.push(messPunkte.map((q) => ({ ...q })));
  if (messVerlauf.length > MESS_VERLAUF_MAX) messVerlauf.shift();
}

let messGps: Punkt | null = null;
let messSucht = false;
const logLaeuft = () => !!z && z.betriebsart !== 'gestoppt';
const messBoot = (): Punkt | null => (logLaeuft() ? an.position() : null) ?? messGps;
function holeMessGps(): void {
  if (messSucht || messBoot()) return;
  messSucht = true;
  void gpsEinmal().catch(() => null).then((pos) => {
    messSucht = false;
    if (pos) messGps = pos;
    else if (!messBoot()) messAbBoot = false;
    if (werkzeug === 'messen') zeichnePanel();
  });
}
let ankerRadius = 40;
let vorladenText = '';

function setzeModus(m: Modus, merken = true): void {
  modus = m;
  document.documentElement.classList.toggle('nav-an', m === 'nav');
  karteZiehenNeu();
  for (const id of ['tb-nav-kopf', 'tb-nav-leiste']) $(id)?.toggleAttribute('hidden', m !== 'nav');
  $('btn-modus-log')?.setAttribute('aria-pressed', String(m === 'log'));
  $('btn-modus-nav')?.setAttribute('aria-pressed', String(m === 'nav'));
  if (m === 'log') schliesseWerkzeug();
  if (merken) schreibe(K.modus, m);
  window.scrollTo(0, 0);
  zeichneAlles();
}

function griff(id: string, ziel: Modus, richtung: 1 | -1): void {
  const el = $(id);
  if (!el) return;
  let y0: number | null = null;
  el.addEventListener('pointerdown', (e) => { y0 = e.clientY; el.setPointerCapture?.(e.pointerId); });
  el.addEventListener('pointerup', (e) => {
    if (y0 === null) return;
    const roh = e.clientY - y0;
    y0 = null;

    if (roh * richtung > 20 || Math.abs(roh) < 8) setzeModus(ziel);
  });
  el.addEventListener('pointercancel', () => { y0 = null; });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setzeModus(ziel); } });
}

const layout = (): 'schmal' | 'breit' => (breit() ? 'breit' : 'schmal');
function belegung(): KachelWert[] {
  const l = layout();
  const b = lies<KachelWert[]>(K.kacheln(l));
  if (!b || !b.every((x) => ALLE_KACHELN.includes(x)) || new Set(b).size !== b.length) return [...VORGABE[l]];
  if (b.length === PLAETZE) return b;
  if (b.length !== 4) return [...VORGABE[l]];

  const dazu = [...VORGABE[l], ...ALLE_KACHELN].filter((x, i, a) => !b.includes(x) && a.indexOf(x) === i);
  return [...b, ...dazu.slice(0, PLAETZE - 4)];
}

function spanne(eta: number, b: { frueh: number; spaet: number } | null): { kurz: string; lang: string } | null {
  if (!b || b.spaet - b.frueh < 120_000) return null;
  const min = (t: number) => Math.round((t - eta) / 60_000);
  const a = min(b.frueh); const z2 = min(b.spaet);
  const lang = Math.max(Math.abs(a), Math.abs(z2)) >= 60;
  const f = (m: number) => `${m < 0 ? '−' : m > 0 ? '+' : ''}${lang ? hm(Math.abs(m) * 60) : String(Math.abs(m))}`;
  return { kurz: `${f(a)}/${f(z2)} ${lang ? 'h' : 'min'}`, lang: `${hhmmInZone(b.frueh)}–${uhr(b.spaet)}` };
}

function kachelWert(k: KachelWert): { v: string; e: string; band?: { kurz: string; lang: string } | null } {
  const de = sprache();
  const w = werte;
  const sm = (x: number | null | undefined, d = 1) => (x == null ? '–' : nf(x, d, de));
  const sog = z?.laeuft && !z.wartetAufFix ? z.sog : null;
  switch (k) {
    case 'SOG': return { v: sm(sog), e: 'kn' };
    case 'COG': return { v: sog !== null && sog >= STEHT_KN && z?.cog != null ? kursGrad(z.cog, false) : '–', e: '°' };
    case 'BRG': return { v: w?.brg == null ? '–' : kursGrad(w.brg, false), e: rwZeichen(de) };
    case 'DTW': return { v: sm(w?.dtw), e: smEinheit() };

    case 'ETA': return { v: w?.eta == null ? '–' : hhmmInZone(w.eta), e: w?.eta == null ? '' : 'LT', band: w?.eta == null ? null : spanne(w.eta, band.wp) };
    case 'TTG': return { v: w?.ttgS == null ? '–' : hm(w.ttgS), e: 'h' };

    case 'XTE': return { v: w?.xte == null ? '–' : nf(Math.abs(w.xte), 2, de), e: w?.xte == null || !steuerSeite(w.xte) ? smEinheit() : `${smEinheit()} ${seite(w.xte)}` };
    case 'VMG': return { v: sm(w?.vmg), e: 'kn' };
    case 'DTZ': return { v: sm(w?.dtz), e: smEinheit() };
    case 'ETZ': return { v: w?.etz == null ? '–' : hhmmInZone(w.etz), e: w?.etz == null ? '' : 'LT', band: w?.etz == null ? null : spanne(w.etz, band.ziel) };
    case 'ETR': return { v: w?.ttzS == null ? '–' : hm(w.ttzS), e: 'h' };
    case 'LT': return { v: hhmmInZone(Date.now()), e: 'LT' };
    case 'UTC': return { v: hhmmInZone(Date.now(), 'UTC'), e: 'UTC' };
    case 'SOT': return { v: z?.fahrt && z.abgelegt ? nf(z.streckeNM, 1, de) : '–', e: smEinheit() };

    case 'AVG': return { v: sm(route ? an.schnittSeit(route.gestartet) : null), e: 'kn' };

    case 'HDG': {
      const h = sog !== null && sog >= STEHT_KN ? vorhaltJetzt()?.v ?? null : null;
      return { v: h ? kursGrad(h.kdw, false) : '–', e: rwZeichen(de) };
    }
    case 'VOR': {
      const h = sog !== null && sog >= STEHT_KN ? vorhaltJetzt()?.v ?? null : null;
      if (!h) return { v: '–', e: '°' };
      const w = Math.round(h.winkel);

      return { v: String(Math.abs(w)), e: w === 0 ? '°' : `°${wort(w > 0 ? 'nav.vor.stb' : 'nav.vor.bb')}` };
    }
    case 'SET': {
      const s = vorhaltJetzt()?.strom ?? null;
      return { v: s ? kursGrad(s.dir, false) : '–', e: '°' };
    }
    case 'DFT': {
      const s = vorhaltJetzt()?.strom ?? null;
      return { v: s ? nf(s.speed, 1, de) : '–', e: 'kn' };
    }
  }
}
const seite = (xte: number) => wort(xte >= 0 ? 'nav.stb' : 'nav.bb');

function zeichneKacheln(): void {
  const box = $('tb-nav-kacheln');
  if (!box) return;
  const lang = breit();
  const wp = route?.wegpunkte[route.naechster]?.name ?? null;
  const html = belegung().map((k, i) => {
    const { v, e, band: b } = kachelWert(k);
    const titel = lang ? `${k} · ${wort(`nav.k.${k}`)}` : k;

    const ziel = wp && ZUM_WEGPUNKT.has(k) ? wp : null;
    const name = ziel ? `${wort(`nav.k.${k}`)} ${ziel}` : wort(`nav.k.${k}`);
    return `<button type="button" class="tb-nav-kachel" data-platz="${i}" aria-label="${esc(`${name}: ${v} ${e}${b ? ` (${b.lang})` : ''}`)}">`
      + `<span class="tb-nav-kachel-kopf"><span class="tb-nav-kachel-k">${esc(titel)} ▾</span>`
      + (ziel ? `<span class="tb-nav-kachel-wp">→ ${esc(ziel)}</span>` : '')
      + (MODELL_KACHELN.has(k) ? `<span class="tb-nav-kachel-wp">${esc(wort('nav.modell'))}</span>` : '') + '</span>'
      + `<span class="tb-nav-kachel-v">${esc(v)}<small>${esc(e ? ` ${e}` : '')}</small></span>`
      + (b ? `<span class="tb-nav-kachel-band">${esc(b.kurz)}</span>` : '') + `</button>`;
  });
  box.innerHTML = html.slice(0, 4).join('');

  for (const i of [4, 5]) { const p = $(`tb-nav-platz-${i}`); if (p) p.innerHTML = html[i] ?? ''; }
  aktualisiereWahl();

  const sog = z?.laeuft && !z.wartetAufFix ? z.sog : null;
  setzeKompass($('tb-nav-kompass'), sog !== null && sog >= STEHT_KN && z?.cog != null ? z.cog : null, sprache(), wort('nav.kueg'));
}

function uhrTakt(): void {
  window.setInterval(() => { if (belegung().some((k) => UHR_KACHELN.has(k))) zeichneKacheln(); }, 30_000);
}

let wahlPlatz = 0;
const wahlEl = () => $('tb-nav-wahl');
const wahlModal = (() => {
  const el = document.getElementById('tb-nav-wahl');
  return el ? initModal(el, () => schliesseWahl()) : null;
})();

function wahlWert(k: KachelWert): string {
  const { v, e } = kachelWert(k);
  if (v === '–' || !e || e === k) return v;
  return e.startsWith('°') ? `${v}${e}` : `${v} ${e}`;
}

function oeffneWahl(platz: number): void {
  wahlPlatz = platz;
  const liste = $('tb-nav-wahl-liste');
  const jetzt = belegung();
  if (liste) {
    liste.innerHTML = ALLE_KACHELN.map((k) => `<button type="button" class="tb-nav-wahl-k${jetzt[platz] === k ? ' aktiv' : ''}" data-wert="${k}">`
      + `<span class="tb-nav-wahl-kopf"><b>${k}</b><em data-wahl-wert="${k}">${esc(wahlWert(k))}</em></span>`
      + `<span>${esc(wort(`nav.k.${k}`))}</span></button>`).join('');
  }
  wahlEl()?.removeAttribute('hidden');
  wahlModal?.beimOeffnen();
}
function aktualisiereWahl(): void {
  if (wahlEl()?.hasAttribute('hidden') !== false) return;
  for (const el of document.querySelectorAll<HTMLElement>('#tb-nav-wahl-liste [data-wahl-wert]')) {
    const t = wahlWert(el.dataset['wahlWert'] as KachelWert);
    if (el.textContent !== t) el.textContent = t;
  }
}
function schliesseWahl(): void {
  wahlEl()?.setAttribute('hidden', '');
  wahlModal?.beimSchliessen();
}

function waehle(k: KachelWert): void {
  const b = belegung();
  const alt = b.indexOf(k);
  if (alt >= 0) b[alt] = b[wahlPlatz]!;
  b[wahlPlatz] = k;
  schreibe(K.kacheln(layout()), b);
  schliesseWahl();
  zeichneKacheln();
}

function zeichneKopf(): void {
  const wp = $('tb-nav-wp');
  const naechster = route?.wegpunkte[route.naechster];
  if (wp) wp.hidden = !naechster;
  if (naechster) {
    const name = $('tb-nav-wp-name');
    if (name) name.textContent = `→ ${naechster.name}`;

    const x = werte?.xte ?? null;

    const korridor = $('tb-nav-xte-korridor');
    if (korridor) { korridor.style.left = `${xteBalkenProzent(-XTE_AUF_KURS_SM)}%`; korridor.style.right = `${100 - xteBalkenProzent(XTE_AUF_KURS_SM)}%`; }
    const punkt = $('tb-nav-xte-punkt');
    if (punkt) punkt.style.left = `${xteBalkenProzent(x)}%`;
    const text = $('tb-nav-xte-text');
    if (text) text.textContent = x == null ? 'XTE –' : `XTE ${nf(Math.abs(x), 2, sprache())} ${smEinheit()}${steuerSeite(x) ? ` ${seite(x)}` : ''}`;
    const steuer = $('tb-nav-xte-steuer');
    if (steuer) {
      const s = steuerSeite(x);
      steuer.dataset['seite'] = s ?? (x == null ? '' : 'kurs');
      steuer.textContent = x == null ? '' : s === 'stb' ? wort('nav.steuerStb') : s === 'bb' ? wort('nav.steuerBb') : wort('nav.aufKurs');
    }
  }
  const ruht = $('tb-nav-ruht');
  if (ruht) {
    const b = z?.betriebsart;
    const text = !route ? (breit() ? wort('nav.keineRoute') : '')
      : b === 'pausiert' ? wort('nav.ruhtPause')
        : b === 'pausiert-anker' ? wort('nav.ruhtAnker')
          : b === 'gestoppt' ? wort('nav.ruhtGestoppt')
            : z?.wartetAufFix ? wort('nav.wartetGps') : '';
    ruht.hidden = !text;
    ruht.textContent = text;
  }
  const liste = $('tb-nav-liste');

  if (liste && !wischtGerade()) liste.innerHTML = route ? `<p class="tb-nav-liste-k">${esc(wort('nav.routeTitel'))}</p>${wpRueckBox()}${schenkelListe()}` : '';
}

function schenkelListe(): string {
  if (!route) return '';
  const boot = an.position();
  const de = sprache();
  return route.wegpunkte.map((p, k) => {
    if (k === 0) return '';
    const vor = route!.wegpunkte[k - 1]!;
    const stand = k < route!.naechster ? 'erledigt' : k === route!.naechster ? 'aktuell' : 'folgt';
    let rechts: string;
    if (stand === 'aktuell' && boot) {
      const m = messe(boot, p);
      rechts = `${nf(m.sm, 1, de)} ${smEinheit()} · ${kursRw(m.kurs, de)}`;
    } else {
      const m = messe(vor, p);
      rechts = `${nf(m.sm, 1, de)} ${smEinheit()} · ${kursRw(m.kurs, de)}`;
    }
    const zeile = `<div class="tb-nav-schenkel ${stand}"><span class="tb-nav-schenkel-n">${k}</span>`
      + `<span class="tb-nav-schenkel-name">${esc(p.name)}</span><span class="tb-nav-schenkel-d">${rechts}</span></div>`;

    return darfLoeschen(route!.wegpunkte.length, k, route!.naechster)
      ? wischZeile(`${k}|${p.lat}|${p.lon}`, zeile, wort('nav.wpLoeschen')) : zeile;
  }).join('');
}

const wischListen: Wischliste[] = [];
const wischtGerade = (): boolean => wischListen.some((w) => w.beschaeftigt());

let wpRueck: { vorher: NavWegpunkt[]; naechster: number; gestartet: number; name: string; uhr: number } | null = null;
const WP_RUECK_MS = 8000;
const wpRueckGilt = () => !!wpRueck && !!route && route.gestartet === wpRueck.gestartet && route.naechster === wpRueck.naechster;
function wpRueckBox(): string {
  if (!wpRueckGilt()) return '';
  return `<div class="tb-nav-rueck" role="status"><span>${esc(wort('nav.wpGeloescht').replace('{name}', wpRueck!.name))}</span>`
    + `${knopf('wpRueck', wort('nav.rueckgaengig'))}</div>`;
}
function wpRueckgaengig(): void {
  if (!wpRueckGilt()) return;
  const v = wpRueck!;
  window.clearTimeout(v.uhr);
  wpRueck = null;
  routeGeaendertAuf(v.vorher);
}

function loescheAusListe(id: string): boolean {
  if (!route) return false;
  const [kText, lat, lon] = id.split('|');
  const k = Number(kText);
  const p = route.wegpunkte[k];
  if (!p || String(p.lat) !== lat || String(p.lon) !== lon) { zeichneAlles(); return false; }
  const neu = loescheWegpunkt(route.wegpunkte, k, route.naechster);
  if (!neu) return false;
  gewaehlt = null;
  for (const w of wischListen) w.schliesse();
  if (wpRueck) window.clearTimeout(wpRueck.uhr);
  wpRueck = {
    vorher: route.wegpunkte, naechster: route.naechster, gestartet: route.gestartet, name: p.name,
    uhr: window.setTimeout(() => { wpRueck = null; zeichneAlles(); }, WP_RUECK_MS),
  };
  routeGeaendertAuf(neu);
  return true;
}

function zeichneLeiste(): void {
  if (!z) return;
  const b = z.betriebsart;
  const zustand = $('tb-nav-leiste-zustand');
  if (zustand) {
    const k = b === 'laeuft' ? 'nav.lLaeuft' : b === 'pausiert' ? 'nav.lPause' : b === 'pausiert-anker' ? 'nav.lAnker' : 'nav.lGestoppt';
    zustand.textContent = wort(k);
    zustand.dataset['zustand'] = b;
  }
  const summe = $('tb-nav-leiste-summe');
  if (summe) {
    summe.textContent = z.fahrt && z.abgelegt
      ? `${hm(z.dauerS)} h · ${nf(z.streckeNM, 1, sprache())} ${smEinheit()}` : '';
  }

  const erste = $('btn-nl-start') as HTMLButtonElement | null;
  if (erste) {
    const pause = b === 'laeuft';
    erste.dataset['ziel'] = pause ? 'btn-pause' : 'btn-start';
    erste.classList.toggle('t-pause', pause);
    erste.classList.toggle('t-start', !pause);
    const sym = erste.querySelector('.tb-nav-l-sym');
    if (sym) sym.innerHTML = icon(pause ? 'pause' : 'start');
  }

  for (const k of document.querySelectorAll<HTMLButtonElement>('.tb-nav-l')) {
    const ziel = $(k.dataset['ziel'] ?? '') as HTMLButtonElement | null;
    if (!ziel) continue;
    k.disabled = ziel.disabled;
    const txt = ziel.querySelector('.tb-transport-txt')?.textContent ?? ziel.textContent?.trim() ?? '';
    const ktxt = k.querySelector('.tb-nav-l-txt');
    if (ktxt && txt) ktxt.textContent = txt;
    k.setAttribute('aria-label', txt);
    k.title = `${txt} · ${wort('nav.langDrueckenTitel')}`;
    k.setAttribute('aria-pressed', ziel.getAttribute('aria-pressed') ?? 'false');
    if (!ziel.hasAttribute('aria-pressed')) k.removeAttribute('aria-pressed');
  }
}

function zeichneLeisteWerkzeuge(): void {
  const box = $('tb-nav-werkzeuge');
  if (!box) return;
  const ankerScharf = z?.betriebsart === 'pausiert-anker';

  const zu = lies<boolean>(K.leisteZu) === true;
  box.classList.toggle('zu', zu);
  const klapp = `<button type="button" class="tb-nav-wz tb-nav-wz-klapp" data-klapp aria-expanded="${!zu}" `
    + `aria-label="${esc(wort(zu ? 'nav.werkzeugeAuf' : 'nav.werkzeugeZu'))}">${icon('zurueck')}`
    + (zu ? `<span>${esc(wort('nav.werkzeuge'))}</span>` : '') + '</button>';
  const html = klapp + (zu ? '' : werkzeugListe().map(({ w, icon: ic }) => {

    const aktiv = w === 'chrono' ? chronoBaum || timerOffen() || stoppuhrOffen()
      : w === 'wetter' ? wetterBaum || werkzeug === 'wetter' || radarAn() : w === 'karte' ? kartenBaum : werkzeug === w;
    const auf = w === 'chrono' ? chronoBaum : w === 'wetter' ? wetterBaum : w === 'karte' ? kartenBaum : aktiv;
    return `<button type="button" class="tb-nav-wz${aktiv ? ' aktiv' : ''}${w === 'anker' && ankerScharf ? ' scharf' : ''}" data-werkzeug="${w}" aria-pressed="${aktiv}"`
      + `${w === 'log' || w === 'chrono' || w === 'wetter' || w === 'karte' ? ` aria-expanded="${auf}"` : ''}`

      + `${w === 'karte' ? ` data-stand="${luftbildObjekt()?.stand() ?? 'aus'}"` : ''}>${icon(ic)}<span>${esc(wort(`nav.w.${w}`))}</span></button>`;
  }).join(''));

  if (html !== letzteLeiste) {
    letzteLeiste = html;
    box.innerHTML = html;
  }
  zeichneBaum(box, !zu && werkzeug === 'log', 'log', logBaumInhalt);
  zeichneBaum(box, !zu && chronoBaum, 'chrono', chronoBaumInhalt);
  zeichneBaum(box, !zu && wetterBaum, 'wetter', wetterBaumInhalt);
  zeichneBaum(box, !zu && kartenBaum, 'karte', kartenBaumInhalt);
  timerPlatzNeu();
  stoppuhrPlatzNeu();
}
let letzteLeiste = '';
const letzterBaum = new Map<string, string>();

let chronoBaum = false;

let wetterBaum = false;

let kartenBaum = false;
const radarAn = (): boolean => radarObjekt()?.an() ?? false;
const luftbildAn = (): boolean => luftbildObjekt()?.an() ?? false;

function kartenBaumInhalt(): string {
  const lb = luftbildObjekt();
  const stand = lb?.stand() ?? 'aus';
  const luft = luftbildAn();
  const stil = kartenStil();
  const eintrag = (a: 'basis' | 'topo' | 'luftbild', ic: IconName, an: boolean, extra = '') =>
    `<button type="button" class="tb-nav-log-k${an ? ' an' : ''}" data-aktion="karte:${a}" aria-pressed="${an}"${extra}>`
    + `${icon(ic)}<span>${esc(wort(`nav.karte.${a}`))}</span></button>`;
  return eintrag('basis', 'karten', !luft && stil === 'basis')
    + eintrag('topo', 'gelaende', !luft && stil === 'topo')
    + eintrag('luftbild', 'luftbild', luft, ` data-stand="${stand}"`
      + (stand === 'fehlt' ? ` title="${esc(wort('nav.karte.luftbildFehlt'))}"` : ''));
}

function wetterBaumInhalt(): string {
  const karte = werkzeug === 'wetter', wx = radarAn();
  return `<button type="button" class="tb-nav-log-k${karte ? ' an' : ''}" data-aktion="wetter:karte" aria-pressed="${karte}">${icon('wind')}<span>${esc(wort('nav.wetter.karte'))}</span></button>`
    + `<button type="button" class="tb-nav-log-k${wx ? ' an' : ''}" data-aktion="wetter:wx" aria-pressed="${wx}" aria-label="${esc(wort('nav.wetter.wxLang'))}" title="${esc(wort('nav.wetter.wxLang'))}">${icon('radar')}<span>${esc(wort('nav.wetter.wx'))}</span></button>`

    + `<button type="button" class="tb-nav-log-k" data-aktion="wetter:seewetter">${icon('dokument')}<span>${esc(wort('nav.wetter.seewetter'))}</span></button>`;
}

function chronoBaumInhalt(): string {
  return ([['timer', 'glocke', timerOffen()], ['stoppuhr', 'stoppuhr', stoppuhrOffen()]] as const).map(([a, ic, an]) =>
    `<button type="button" class="tb-nav-log-k${an ? ' an' : ''}" data-aktion="chrono:${a}" aria-pressed="${an}">${icon(ic)}<span>${esc(wort(`nav.chrono.${a}`))}</span></button>`,
  ).join('');
}

const LOG_KNOEPFE = ['btn-eintrag', 'btn-foto', 'btn-ais-zeile', 'btn-wetter-zeile', 'btn-wachwechsel'];
function logBaumInhalt(): string {
  return LOG_KNOEPFE.map((id) => {
    const el = $(id) as HTMLButtonElement | null;
    if (!el) return '';
    return `<button type="button" class="tb-nav-log-k" data-aktion="log:${id}"${el.disabled ? ' disabled' : ''}>${el.innerHTML}</button>`;
  }).join('');
}

function zeichneBaum(box: HTMLElement, offen: boolean, w: 'log' | 'chrono' | 'wetter' | 'karte', inhalt: () => string): void {
  const id = `tb-nav-${w}-baum`;
  let baum = $(id);
  const k = box.querySelector<HTMLElement>(`[data-werkzeug="${w}"]`);
  const eltern = box.parentElement;
  if (!offen || !k || !eltern) { baum?.remove(); letzterBaum.delete(id); return; }
  if (!baum) {
    baum = document.createElement('div');
    baum.id = id;
    baum.className = 'tb-nav-log-baum';
    baum.setAttribute('role', 'group');
    baum.addEventListener('click', (e) => {
      const l = (e.target as Element).closest<HTMLButtonElement>('[data-aktion]');
      if (l && !l.disabled) aktion(l.dataset['aktion']!);
    });
    eltern.appendChild(baum);
  }
  baum.setAttribute('aria-label', wort(`nav.w.${w}`));
  const html = inhalt();
  if (html !== letzterBaum.get(id)) { baum.innerHTML = html; letzterBaum.set(id, html); }
  const er = eltern.getBoundingClientRect();
  const kr = k.getBoundingClientRect();
  const waagrecht = getComputedStyle(box).flexDirection.startsWith('row');
  baum.classList.toggle('waagrecht', waagrecht);
  if (waagrecht) {

    const links = Math.max(8, Math.min(kr.left - er.left, er.width - baum.offsetWidth - 8));
    baum.style.left = `${links}px`; baum.style.right = ''; baum.style.top = `${kr.bottom - er.top + 8}px`;
  } else {
    baum.style.right = `${er.right - kr.left + 8}px`; baum.style.left = ''; baum.style.top = `${Math.max(8, kr.top - er.top)}px`;
  }
}

function zeigeUeberPanel(punkte: readonly Punkt[]): void {
  requestAnimationFrame(() => {
    const panel = $('tb-nav-panel');
    if (!panel || panel.hidden) { zeigePunkte(punkte); return; }
    if (!breit()) { zeigePunkte(punkte, panel.offsetHeight); return; }

    const karteEl = document.querySelector<HTMLElement>('#tb-karte, .tb-karte-wrap');
    const links = karteEl ? Math.max(0, panel.getBoundingClientRect().right - karteEl.getBoundingClientRect().left) : 0;
    zeigePunkte(punkte, 0, links);
  });
}

function oeffneWerkzeug(w: Werkzeug): void {

  if (w === 'karte') {
    kartenBaum = !kartenBaum;
    chronoBaum = false;
    wetterBaum = false;
    if (kartenBaum && werkzeug === 'log') { werkzeugZu(); return; }
    zeichneLeisteWerkzeuge();
    return;
  }

  if (w === 'chrono') {
    chronoBaum = !chronoBaum;
    wetterBaum = false;
    kartenBaum = false;
    if (chronoBaum && werkzeug === 'log') { werkzeugZu(); return; }
    zeichneLeisteWerkzeuge();
    return;
  }

  if (w === 'wetter') {
    wetterBaum = !wetterBaum;
    chronoBaum = false;
    kartenBaum = false;
    if (wetterBaum && werkzeug === 'log') { werkzeugZu(); return; }
    zeichneLeisteWerkzeuge();
    return;
  }
  chronoBaum = false;
  wetterBaum = false;
  kartenBaum = false;
  if (werkzeug === w) { werkzeugZu(); return; }
  schliesseWerkzeug();
  werkzeug = w;
  if (w === 'anker') ankerRadius = z?.ankerwache?.radiusM ? Math.round(z.ankerwache.radiusM) : ankerRadius;
  if (w === 'route' && !route && !plan) neuerPlan(true);
  if (w === 'messen') { messPunkte = []; messVerlauf = []; messGps = null; if (messAbBoot) holeMessGps(); }
  zeichneAlles();

  if (w === 'route' && route && !plan) {
    const boot = an.position();
    zeigeUeberPanel([...(boot ? [boot] : []), ...route.wegpunkte.slice(route.naechster)]);
  }
}

function werkzeugZu(): void {
  schliesseWerkzeug();
  zeichneAlles();
}

function schliesseWerkzeug(): void {
  werkzeug = null;
  wetterkarteAus();
  setzeKartenklick(null);
  zeichneMessung([]);
  zeichneAnkerVorschau(null, 0);
  gewaehlt = null;
  zeichneGriffe(null, 0, null, null);
  if (route && routeGeaendert) {
    routeGeaendert = false;

    const wp = route.wegpunkte;
    const boot = an.position();
    const rest = [...(boot ? [boot] : wp.slice(route.naechster - 1, route.naechster)), ...wp.slice(route.naechster)];
    an.eintrag({
      t: Date.now(), art: 'navigation', lat: boot?.lat ?? null, lon: boot?.lon ?? null,
      text: wort('nav.logGeaendert').replace('{ziel}', wp.at(-1)!.name)
        .replace('{sm}', nf(routenLaengeSm(rest), 1, sprache())).replace('{n}', String(rest.length - 1)),
    });
  }
  if (!route) { plan = null; zeichnePlan(null); }
  zeichneGefahren([], () => '');
  zeigeHinweis(null);
}

function zeigeHinweis(text: string | null): void {
  const el = $('tb-nav-hinweis');
  if (!el) return;
  el.hidden = !text;
  el.textContent = text ?? '';
}

let toastUhr = 0;

const toastSchlange: string[] = [];
function toast(text: string): void {
  const el = $('tb-nav-toast');
  if (!el) return;
  if (!el.hidden) {
    if (el.textContent !== text && !toastSchlange.includes(text) && toastSchlange.length < 3) toastSchlange.push(text);
    return;
  }
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastUhr);
  toastUhr = window.setTimeout(() => {
    el.hidden = true;
    const naechste = toastSchlange.shift();
    if (naechste) toast(naechste);
  }, 3500);
}

function zeichnePanel(): void {
  const panel = $('tb-nav-panel');
  const titel = $('tb-nav-panel-titel');
  const inhalt = $('tb-nav-panel-inhalt');
  if (!panel || !titel || !inhalt) return;
  panel.hidden = !werkzeug || modus !== 'nav' || werkzeug === 'log';
  panel.classList.toggle('tb-nav-panel-wk', werkzeug === 'wetter');
  panel.classList.toggle('tb-nav-panel-mess', werkzeug === 'messen');
  if (!werkzeug || modus !== 'nav') { setzeKartenklick(null); return; }

  if (werkzeug === 'log') { setzeKartenklick(() => werkzeugZu()); zeigeHinweis(null); return; }
  const w = werkzeug;
  const titelKey = w === 'route' && route && !plan ? 'nav.t.aktiv' : `nav.t.${w}`;
  titel.textContent = wort(titelKey);
  let html = '';
  setzeKartenklick(null);
  zeigeHinweis(null);
  if (w === 'route' && route && !plan && wischtGerade()) return;
  if (w === 'route') html = route && !plan ? panelAktiv() : panelPlan();
  else if (w === 'gehezu') html = panelGeheZu();
  else if (w === 'messen') html = panelMessen();
  else if (w === 'anker') html = panelAnker();
  else if (w === 'rueckweg') html = panelRueckweg();
  else if (w === 'wetter') { wetterPanel(inhalt, wetterAnbindung); return; }
  else html = panelKarten();
  inhalt.innerHTML = html;
}

const knopf = (aktion: string, text: string, klasse = '', aus = false) =>
  `<button type="button" class="tb-nav-k ${klasse}" data-aktion="${aktion}"${aus ? ' disabled' : ''}>${esc(text)}</button>`;

function offTrackChip(): string {
  const g = planung.offTrack;
  const wert = g === null ? wort('nav.offTrackAus') : wort('nav.offTrackAb').replace('{sm}', nf(g, g < 0.25 ? 1 : 2, sprache()));
  return `<button type="button" class="tb-nav-chip" data-aktion="offTrack">${esc(wort('nav.chipOffTrack').replace('{wert}', wert))}</button>`;
}

function panelAktiv(): string {
  setzeKartenklick(() => { if (gewaehlt !== null) { gewaehlt = null; zeichneAlles(); } });
  let pruefung = '';
  if (aktivPruefung) {
    const { daten, versatz } = aktivPruefung;
    const pr = aktivPruefung.pruefung;
    pruefung = gefahrenBox({
      punkte: [], quelle: 'route', zielName: '', daten, ohneWeg: false, rechnet: false, flachste: null, meldung: null,
      pruefung: { ...pr, ueberLand: pr.ueberLand.map((i) => i + versatz), durchVtg: pr.durchVtg.map((i) => i + versatz) },
      grenze: grenzeAktiv(),
    });
  } else {

    const g = grenzeAktiv();
    if (g) pruefung = `<p class="tb-nav-box ${g.art === 'binnen' ? 'gruen' : 'orange'}">${g.art === 'binnen' ? '✓ ' : '⚠ '}${esc(grenzText(g))}</p>`;
  }
  return `${auswahlBox()}${wpRueckBox()}<div class="tb-nav-schenkel-liste">${schenkelListe()}</div>${pruefung}`
    + `<div class="tb-nav-chips">${offTrackChip()}</div>${bearbeitenHinweis()}`

    + `<div class="tb-nav-k2">${knopf('wpWeiter', wort('nav.wpWeiter'), '', !route || route.naechster >= route.wegpunkte.length - 1)}</div>`
    + `<div class="tb-nav-k2">${knopf('neuPlanen', wort('nav.neuPlanen'))}${knopf('routeEnde', wort('nav.beenden'), 'rot')}</div>`;
}

function wegpunktWeiter(): void {
  if (!route || route.naechster >= route.wegpunkte.length - 1) return;
  const alt = route.wegpunkte[route.naechster]!.name;
  const neu = route.wegpunkte[route.naechster + 1]!.name;
  if (!window.confirm(wort('nav.wpWeiterFrage').replace('{alt}', alt).replace('{neu}', neu))) return;
  route = { ...route, naechster: route.naechster + 1 };
  schreibe(K.route, route);
  const boot = an.position();
  an.eintrag({ t: Date.now(), art: 'navigation', lat: boot?.lat ?? null, lon: boot?.lon ?? null, text: wort('nav.logWpHand').replace('{name}', alt) });
  toast(wort('nav.toastWpHand').replace('{name}', neu));
  werte = navWerte(boot, letzteFahrt.sog, letzteFahrt.cog, route, Date.now());
  zeichneAlles();
}

const tagDatum = (t: number) => new Date(t).toLocaleDateString(sprache() === 'de' ? 'de-AT' : 'en-GB',
  { weekday: 'short', day: 'numeric', month: 'numeric' });

function lokalFeld(t: number): string {
  const d = new Date(t);
  const zw = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zw(d.getMonth() + 1)}-${zw(d.getDate())}T${zw(d.getHours())}:${zw(d.getMinutes())}`;
}

function planZeitenHtml(sm: number, schenkel: number): string {
  const de = sprache();
  const z0 = planZeiten(sm, planung.fahrt, planung.ab, Date.now());
  const ab = planung.ab;
  let html = `<div class="tb-nav-planfelder">`
    + `<label class="tb-nav-feld"><span>${esc(wort('nav.planFahrt'))}</span>`
    + `<span class="tb-nav-feld-zeile"><input type="text" inputmode="decimal" data-feld="fahrt" value="${esc(nf(planung.fahrt, 1, de))}" aria-label="${esc(wort('nav.planFahrt'))}"><small>kn</small></span></label>`
    + `<label class="tb-nav-feld"><span>${esc(wort('nav.planAb'))}</span>`
    + `<span class="tb-nav-feld-zeile"><input type="datetime-local" data-feld="ab" value="${ab === null ? '' : lokalFeld(ab)}" aria-label="${esc(wort('nav.planAb'))}">`
    + `<button type="button" class="tb-nav-chip" data-aktion="abJetzt"${ab === null ? ' disabled' : ''}>${esc(wort('nav.planJetzt'))}</button></span></label>`
    + `</div>`;
  if (z0) {
    html += `<dl class="tb-nav-planwerte">`
      + `<div><dt>${esc(wort('nav.planMeilen'))}</dt><dd>${nf(sm, 1, de)} ${smEinheit()}<small>${esc(schenkel === 1 ? wort('nav.planSub1') : wort('nav.planSub').replace('{n}', String(schenkel)))}</small></dd></div>`
      + `<div><dt>${esc(wort('nav.planDauer'))}</dt><dd>${hm(z0.dauerS)} h</dd></div>`
      + `<div><dt>${esc(wort('nav.planAnkunft'))}</dt><dd>${esc(uhr(z0.ankunftMs))}<small>${esc(tagDatum(z0.ankunftMs))}</small></dd></div>`
      + `</dl>`;
    if (ab === null) html += `<p class="tb-nav-leise">${esc(wort('nav.planAbJetzt').replace('{zeit}', uhr(z0.abMs)))}</p>`;
  }
  return html;
}

function schrittText(s: PlanSchritt | null | undefined): string {
  if (!s) return wort('nav.planRechnet');
  if (s.phase === 'kueste') return wort('nav.schrittKueste');
  if (s.phase === 'weg') return wort('nav.schrittWeg');
  return wort('nav.schrittGefahren').replace('{n}', String(s.n)).replace('{m}', String(s.von));
}

function panelPlan(): string {
  const de = sprache();
  const p = plan;
  if (!p) return '';
  const ohneStart = p.punkte.length === 0;
  if (!p.meldung && p.punkte.length < 2) {
    setzeKartenklick(zielGetippt, 'punkt');
    zeigeHinweis(wort(!ohneStart ? 'nav.zielTippen' : p.startSucht ? 'nav.startSucht' : 'nav.startTippen'));
  } else if (p.quelle === 'route') {
    setzeKartenklick(zielGetippt, 'punkt');
  }
  const b = p.punkte.at(-1);
  const start = p.punkte[0];
  const eigen = !!start && start.name === wort('nav.eigenePos');
  const aText = !start ? wort(p.startSucht ? 'nav.startSucht' : 'nav.startTippen') : eigen ? wort('nav.eigenePos') : start.name;
  let html = `<div class="tb-nav-ab"><span class="tb-nav-ab-m a">A</span>${esc(aText)}${eigen ? '<small>GPS</small>' : ''}</div>`
    + `<div class="tb-nav-ab ziel"><span class="tb-nav-ab-m b">B</span>${esc(p.punkte.length >= 2 && b ? p.zielName : wort('nav.zielTippen'))}</div>`
    + auswahlBox();
  if (p.meldung) html += `<p class="tb-nav-box orange">${esc(p.meldung)}</p>`;
  if (p.rechnet) html += `<p class="tb-nav-leise" role="status">${esc(schrittText(p.schritt))}</p>`;
  if (p.punkte.length >= 2 && !p.rechnet) {
    speicherePlan();
    const sm = routenLaengeSm(p.punkte);
    html += planZeitenHtml(sm, p.punkte.length - 1);
    html += gefahrenBox(p);
    const tg = an.tiefgangM();
    html += `<div class="tb-nav-chips">`
      + `<button type="button" class="tb-nav-chip" data-aktion="abstand">${esc(wort('nav.chipAbstand').replace('{sm}', nf(planung.abstand, 1, de)))}</button>`
      + `<span class="tb-nav-chip">${esc(tg ? wort('nav.chipTiefgang').replace('{m}', nf(tg, 1, de)) : wort('nav.chipTiefgangOhne'))}</span>`
      + offTrackChip() + `</div>`
      + bearbeitenHinweis();
  }
  if (p.startFest && !p.startSucht) {
    html += `<div class="tb-nav-k2">${knopf('startGps', wort('nav.startGps'))}${knopf('neuerStart', wort('nav.startKarte'))}</div>`;
  } else if (!p.startFest && p.quelle === 'route' && !p.rechnet && startWahlMoeglich()) {
    html += knopf('neuerStart', wort('nav.startKarte'));
  }
  html += `<div class="tb-nav-k2">${knopf('ausPlan', wort('nav.ausPlan'))}${knopf('ausTrack', wort('nav.ausTrack'))}</div>`;
  html += knopf('starten', wort('nav.starten'), 'primaer', !(p.punkte.length >= 2 && !p.rechnet));
  html += `<p class="tb-nav-leise">${esc(wort('nav.seekarte'))}</p>`;
  return html;
}

function gefahrenBox(p: Plan): string {
  const de = sprache();
  const zeilen: { stufe: 'rot' | 'orange' | 'gruen'; text: string; aktion?: string }[] = [];
  const pr = p.pruefung;
  const name = (g: Gefahr | null) => (g ? (g.name || wort(`nav.gefahr.${g.art}`)) : '');
  if (p.ohneWeg) zeilen.push({ stufe: 'rot', text: wort('nav.gefOhneWeg') });
  if (pr?.ueberLand.length) zeilen.push({ stufe: 'rot', text: wort('nav.gefLand').replace('{n}', String(pr.ueberLand[0]! + 1)) });
  if (pr?.durchVtg.length) zeilen.push({ stufe: 'orange', text: wort('nav.gefVtg').replace('{n}', String(pr.durchVtg[0]! + 1)) });
  if (pr?.gefahr.stufe === 'rot') zeilen.push({ stufe: 'rot', text: wort('nav.gefRot').replace('{name}', name(pr.gefahr.gefahr)) });
  else if (pr?.gefahr.stufe === 'orange') {
    zeilen.push({ stufe: 'orange', text: wort('nav.gefOrange').replace('{name}', name(pr.gefahr.gefahr)).replace('{sm}', nf(pr.gefahr.abstandSm ?? 0, 2, de)) });
  }
  if (p.daten && !p.daten.kueste) zeilen.push({ stufe: 'orange', text: wort('nav.gefOhneKueste') });
  else if (p.daten?.kuesteVereinfacht) zeilen.push({ stufe: 'orange', text: wort('nav.kuesteGrob') });
  if (p.daten?.gefahrenUnvollstaendig) zeilen.push({ stufe: 'orange', text: wort('nav.gefUnvollst') });
  const tg = an.tiefgangM();
  if (zuFlach(p)) {
    const u = p.flachste!;

    zeilen.push({ stufe: 'orange', aktion: 'zeigeUntiefe', text: wort('nav.tiefe').replace('{m}', nf(u.m, 1, de)).replace('{sm}', nf(u.sm, 1, de)).replace('{t}', nf(tg!, 1, de)) });
  }
  if (!zeilen.length) zeilen.push({ stufe: 'gruen', text: wort('nav.gefGruen') });

  if (p.grenze) zeilen.push({ stufe: p.grenze.art === 'binnen' ? 'gruen' : 'orange', text: grenzText(p.grenze) });
  return zeilen.map((z2) => z2.aktion
    ? `<button type="button" class="tb-nav-box tb-nav-box-knopf ${z2.stufe}" data-aktion="${z2.aktion}">⚠ ${esc(z2.text)}</button>`
    : `<p class="tb-nav-box ${z2.stufe}">${z2.stufe === 'gruen' ? '✓ ' : '⚠ '}${esc(z2.text)}</p>`).join('');
}

function panelGeheZu(): string {
  setzeKartenklick(geheZuGetippt, 'punkt');
  zeigeHinweis(wort('nav.zielTippen'));
  return `<p class="tb-nav-leise">${esc(wort('nav.gehezuText'))}</p>${route ? `<p class="tb-nav-box orange">${esc(wort('nav.gehezuErsetzt'))}</p>` : ''}`;
}

function panelMessen(): string {
  setzeKartenklick(messTipp, 'punkt');
  const de = sprache();
  const boot = messBoot();
  const kette = messKette();
  zeichneMessung(kette, messZiehen);
  const sub = kette.length >= 2 ? wort('nav.messRw')
    : messAbBoot && !boot ? wort(messSucht ? 'nav.startSucht' : 'nav.keinePos')
      : wort(messAbBoot || messPunkte.length ? 'nav.messWeiter' : 'nav.messErster');
  if (kette.length < 2) zeigeHinweis(sub);

  const schenkel = kette.length > 2
    ? `<ol class="tb-nav-mess-liste">${messeKette(kette).schenkel.map((m, k) => `<li><span>${k + 1}</span>`
      + `<span>${esc(kursRw(m.kurs, de))}</span><span>${esc(`${nf(m.sm, 2, de)} ${smEinheit()}`)}</span></li>`).join('')}</ol>` : '';

  const art = (aktion: string, an2: boolean, text: string) =>
    `<button type="button" class="tb-nav-chip${an2 ? ' an' : ''}" data-aktion="${aktion}" aria-pressed="${an2}">${esc(text)}</button>`;

  return `<div class="tb-nav-mess-kopf"><p class="tb-nav-gross" id="tb-nav-mess-wert" title="${esc(wort('nav.messRw'))}">${esc(messWert(kette))}</p>`
    + `<div class="tb-nav-chips">${art('messYacht', messAbBoot, wort('nav.messAbYacht'))}${art('messPunkte', !messAbBoot, wort('nav.messPunkte'))}</div></div>`
    + `<p class="tb-nav-leise tb-nav-mess-sub">${esc(sub)}</p>${schenkel}`
    + `<div class="tb-nav-k2">${knopf('messZurueck', wort('nav.rueckgaengig'), '', !messVerlauf.length)}${knopf('messNeu', wort('nav.messNeu'), '', !messPunkte.length)}</div>`;
}

function panelAnker(): string {
  const scharf = z?.betriebsart === 'pausiert-anker';
  const de = sprache();
  if (!scharf) zeichneAnkerVorschau(an.position(), ankerRadius);
  else zeichneAnkerVorschau(null, 0);
  const ohneFahrt = z?.betriebsart === 'gestoppt' || !an.position();
  const status = scharf
    ? wort('nav.ankerStatusAn').replace('{m}', nf(z?.ankerwache?.radiusM ?? ankerRadius, 0, de))
    : ohneFahrt ? wort('nav.ankerOhneLog') : wort('nav.ankerStatusAus');
  return (scharf ? '' : `<div class="tb-nav-radius"><span>${esc(wort('nav.schwojkreis'))}</span>`
      + `<button type="button" class="tb-nav-pm" data-aktion="radiusMinus" aria-label="−5 m">−</button>`
      + `<b>${ankerRadius} m</b><button type="button" class="tb-nav-pm" data-aktion="radiusPlus" aria-label="+5 m">+</button></div>`)
    + `<p class="tb-nav-leise">${esc(status)}</p>`
    + (scharf ? knopf('ankerAus', wort('nav.ankerAus'), 'rot') : knopf('ankerScharf', wort('nav.ankerScharf'), 'primaer', ohneFahrt))
    + (scharf || ohneFahrt ? '' : knopf('ankerDetails', wort('nav.ankerDetails')));
}

function rueckwegPunkte(): NavWegpunkt[] {
  return rueckwegAusSpur(spur, an.position(), {
    wp: (n) => wort('nav.wp').replace('{n}', String(n)), ziel: wort('nav.ablegepunkt'),
  });
}

function panelRueckweg(): string {
  const r = spur.length >= 2 ? rueckwegPunkte() : [];

  if (r.length < 2 || routenLaengeSm(r) < RUECKWEG_MIN_SM) return `<p class="tb-nav-leise">${esc(wort('nav.rueckLeer'))}</p>`;
  return `<p class="tb-nav-leise">${esc(wort('nav.rueckText').replace('{n}', String(r.length - 1)).replace('{sm}', nf(routenLaengeSm(r), 1, sprache())))}</p>`
    + knopf('ausTrack', wort('nav.alsRoute'), 'primaer');
}

interface Region { box: { sued: number; west: number; nord: number; ost: number }; zeit: number }
function regionen(): Region[] { return lies<Region[]>(K.regionen) ?? []; }
const enthaelt = (r: Region, p: Punkt) => p.lat >= r.box.sued && p.lat <= r.box.nord && p.lon >= r.box.west && p.lon <= r.box.ost;

export function merkeRegion(box: Region['box']): void {
  const neu = [{ box, zeit: Date.now() }, ...regionen()].slice(0, 12);
  schreibe(K.regionen, neu);
}

function panelKarten(): string {
  const boot = an.position();
  const liste = regionen().map((r, i) => {
    const aktiv = boot && enthaelt(r, boot);
    const datum = new Date(r.zeit).toLocaleDateString(sprache() === 'de' ? 'de-AT' : 'en-GB');
    return `<div class="tb-nav-region"><span>${esc(wort('nav.regionName').replace('{n}', String(i + 1)))}<small>${esc(wort('nav.regionStand').replace('{d}', datum))}</small></span>`
      + `<span class="tb-nav-region-s ${aktiv ? 'aktiv' : ''}">${esc(wort(aktiv ? 'nav.regionAktiv' : 'nav.regionGeladen'))}</span></div>`;
  }).join('');
  return `<p class="tb-nav-leise">${esc(wort('nav.kartenText'))}</p>${liste}`
    + (vorladenText ? `<p class="tb-nav-leise">${esc(vorladenText)}</p>` : '')
    + knopf('vorladen', wort('nav.kartenLaden'), 'primaer')
    + `<button type="button" class="tb-nav-k zeile" data-aktion="seezeichen">${esc(wort('nav.seezeichen'))}`
    + `<b class="${seezeichenAn() ? 'an' : ''}">${esc(wort(seezeichenAn() ? 'nav.an' : 'nav.aus'))}</b></button>`;
}

function neuerPlan(wiederherstellen = false, gps = true): void {
  const gemerkt = wiederherstellen ? lies<{ punkte: NavWegpunkt[]; quelle: RoutenQuelle; zielName: string; startFest: boolean }>(K.plan) : null;
  if (gemerkt && gemerkt.startFest && gemerkt.punkte.length >= 2) {

    if (einBildschirm() && z && z.betriebsart !== 'gestoppt') startAufKarte = true;
    planAus(gemerkt.punkte, gemerkt.quelle, gemerkt.zielName);
    if (plan) plan.startFest = gemerkt.startFest;
    return;
  }
  const boot = bootFuerPlan();
  plan = {
    punkte: boot ? [{ ...boot, name: wort('nav.eigenePos') }] : [],
    quelle: 'route', zielName: wort('nav.ziel'), daten: null, pruefung: null, ohneWeg: false, rechnet: false,
    flachste: null, meldung: null, startFest: !boot,
  };
  if (!boot && gps) startAusGps(plan);
}

function gpsEinmal(): Promise<Punkt | null> {
  return new Promise((fertig) => {
    if (!('geolocation' in navigator)) { fertig(null); return; }

    const frist = setTimeout(() => fertig(null), 25_000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(frist); fertig({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      () => { clearTimeout(frist); fertig(null); },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  });
}

function startAusGps(lauf: Plan): void {
  lauf.startSucht = true;
  void gpsEinmal()
    .then((pos) => (pos ? startAusPosition(pos) : null))
    .catch(() => null)
    .then((s) => {
      lauf.startSucht = false;
      if (plan !== lauf) return;
      if (s && lauf.punkte.length === 0) {
        lauf.punkte = [{ ...s.punkt, name: wort(s.ausfahrt ? 'nav.ausfahrt' : 'nav.eigenePos') }];
      } else if (!s && lauf.punkte.length === 0) {
        toast(wort('nav.startOhneGps'));
      }
      zeichneAlles();
    });
}

function zielGetippt(p: Punkt): void {
  gewaehlt = null;
  const boot = bootFuerPlan();

  if (!boot && (!plan || !plan.startFest || plan.punkte.length === 0)) {
    plan = {
      punkte: [{ ...p, name: wort('nav.start') }], quelle: 'route', zielName: wort('nav.ziel'), daten: null, pruefung: null,
      ohneWeg: false, rechnet: false, flachste: null, meldung: null, startFest: true,
    };
    zeichneAlles();
    return;
  }
  const a = boot ?? plan!.punkte[0]!;
  const aName = boot ? wort('nav.eigenePos') : (plan!.punkte[0]!.name || wort('nav.start'));
  plan = {
    punkte: [{ ...a, name: aName }, { ...p, name: wort('nav.ziel') }],
    quelle: 'route', zielName: wort('nav.ziel'), daten: null, pruefung: null, ohneWeg: false, rechnet: true, flachste: null, meldung: null,
    startFest: !boot,
  };
  zeichneAlles();
  const lauf = plan;
  const melde = (s: PlanSchritt) => {
    if (plan !== lauf) return;
    lauf.schritt = s;
    if (werkzeug === 'route') zeichnePanel();
  };
  const benenne = (pk: readonly { lat: number; lon: number }[]): NavWegpunkt[] => pk.map((q, k) => ({
    lat: q.lat, lon: q.lon,
    name: k === 0 ? aName : k === pk.length - 1 ? lauf.zielName : wort('nav.wp').replace('{n}', String(k)),
  }));

  const vorlaeufig = (pk: { lat: number; lon: number }[]) => {
    if (plan !== lauf || !lauf.rechnet) return;
    lauf.punkte = benenne(pk);
    zeichneAlles();
  };
  void planeRoute(a, p, planung.abstand, melde, vorlaeufig).then((r) => {
    if (plan !== lauf) return;
    lauf.schritt = null;
    lauf.punkte = benenne(r.punkte);
    lauf.daten = r.daten;
    lauf.ohneWeg = r.ohneWeg;
    lauf.rechnet = false;
    pruefePlan();
    zeigeUeberPanel(lauf.punkte);
  });
}

function zuFlach(p: Plan): boolean {
  const tg = an.tiefgangM();
  return !!p.flachste && !!tg && p.flachste.m < tg + 1;
}

function pruefePlan(): void {
  if (!plan) return;
  if (plan.daten) plan.pruefung = pruefeRoute(plan.punkte, plan.daten);
  zeichneAlles();
  const lauf = plan;
  void flachsteStelle(lauf.punkte).then((u) => { if (plan === lauf) { lauf.flachste = u; zeichneAlles(); } });
  void grenzeDerRoute(lauf.punkte).then((g) => { if (plan === lauf) { lauf.grenze = g; zeichneAlles(); } });
}

const staatenJeOrt = new Map<string, Promise<string[] | null>>();
function staatenAm(p: Punkt): Promise<string[] | null> {
  const k = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
  let v = staatenJeOrt.get(k);
  if (!v) {
    v = fetchStaatsnamen(p.lat, p.lon, 0.05).catch(() => { staatenJeOrt.delete(k); return null; });
    staatenJeOrt.set(k, v);
  }
  return v;
}
function grenzText(g: Grenze): string {
  return wort(`nav.grenze.${g.art}`).replace('{von}', g.von).replace('{nach}', g.nach)
    + (g.international ? ` ${wort('nav.grenze.international')}` : '');
}

async function internationalUnterwegs(punkte: readonly Punkt[]): Promise<boolean | null> {
  const proben = stichprobenEntlang(punkte);
  const urteile = await Promise.all(proben.map((p) => fetchSeegebiet(p.lat, p.lon).then((a) => hoheitAusAntwort(a, hoheitsStaat)).catch(() => undefined)));
  if (urteile.some((u) => u === null)) return true;
  return urteile.some((u) => u !== undefined) ? false : null;
}

let aktivGrenze: { key: string; g: Grenze | null } | null = null;
function grenzeAktiv(melden = false): Grenze | null {
  const a = route?.wegpunkte[0], b = route?.wegpunkte.at(-1);
  if (!route || !a || !b) return null;
  const key = `${route.gestartet}:${b.lat.toFixed(4)},${b.lon.toFixed(4)}`;
  if (aktivGrenze?.key === key) return aktivGrenze.g;
  aktivGrenze = { key, g: null };
  void grenzeDerRoute(route.wegpunkte).then((g) => {
    if (aktivGrenze?.key !== key) return;
    aktivGrenze.g = g;
    if (g && melden) toast(grenzText(g));
    zeichneAlles();
  });
  return null;
}

function staatAnzeige(name: string): string {
  const k = kanon(name);
  const e = Object.values(STAATSNAMEN).find((x) => kanon(x.en) === k);
  return e ? e[sprache()] : name;
}
async function grenzeDerRoute(punkte: readonly Punkt[]): Promise<Grenze | null> {
  const a = punkte[0], b = punkte.at(-1);
  if (!a || !b || punkte.length < 2) return null;
  const [sa, sb] = await Promise.all([staatenAm(a), staatenAm(b)]);
  if (!istGrenzuebertritt(sa, sb)) return null;
  return { von: staatAnzeige(sa![0]!), nach: staatAnzeige(sb![0]!), art: schengenGrenze(sa![0]!, sb![0]!), international: await internationalUnterwegs(punkte) };
}

function planAus(punkte: NavWegpunkt[], quelle: RoutenQuelle, zielName: string): void {
  plan = { punkte, quelle, zielName, daten: null, pruefung: null, ohneWeg: false, rechnet: true, flachste: null, meldung: null };
  werkzeug = 'route';
  gewaehlt = null;
  zeichneAlles();
  zeigeUeberPanel(punkte);
  const lauf = plan;
  void ladeRoutenDaten(punkte).then((d) => {
    if (plan !== lauf) return;
    lauf.daten = d;
    lauf.rechnet = false;
    pruefePlan();
  });
}

function planGeaendert(punkte: NavWegpunkt[]): void {
  if (!plan) return;
  plan.punkte = punkte;
  plan.zielName = punkte.at(-1)!.name || plan.zielName;
  const b = plan.daten?.box;
  if (plan.daten && b && punkte.some((p) => p.lat < b.swLat || p.lat > b.neLat || p.lon < b.swLon || p.lon > b.neLon)) {
    const lauf = plan;
    zeichneAlles();
    void ladeRoutenDaten(lauf.punkte).then((d) => { if (plan === lauf) { lauf.daten = d; pruefePlan(); } });
    return;
  }
  pruefePlan();
}

function routeGeaendertAuf(wegpunkte: NavWegpunkt[]): void {
  if (!route) return;
  route = { ...route, wegpunkte };
  schreibe(K.route, route);
  routeGeaendert = true;
  zeichneAlles();
  const lauf = route;
  const versatz = route.naechster - 1;
  const rest = wegpunkte.slice(versatz);
  void ladeRoutenDaten(rest).then((daten) => {
    if (route !== lauf) return;
    aktivPruefung = { daten, pruefung: pruefeRoute(rest, daten), versatz };
    zeichneAlles();
  });
}

function bearbeitet(): { punkte: NavWegpunkt[]; fest: number; setze: (p: NavWegpunkt[]) => void } | null {
  if (modus !== 'nav' || werkzeug !== 'route') return null;
  if (plan) return plan.punkte.length >= 2 && !plan.rechnet ? { punkte: plan.punkte, fest: plan.startFest ? 0 : 1, setze: planGeaendert } : null;
  if (route) return { punkte: route.wegpunkte, fest: route.naechster, setze: routeGeaendertAuf };
  return null;
}

const griffAktionen: GriffAktionen = {
  ziehen(k, p) {
    const b = bearbeitet();
    const neu = b && verschiebe(b.punkte, k, p, b.fest);
    if (b && neu) { gewaehlt = k; b.setze(neu); }
  },
  waehlen(k) {
    gewaehlt = gewaehlt === k ? null : k;
    zeichneAlles();
  },
  einfuegen(nach, p) {
    const b = bearbeitet();
    const neu = b && fuegeEin(b.punkte, nach, p, (q) => ({ lat: q.lat, lon: q.lon, name: 'WP 0' }), b.fest);
    if (b && neu) { gewaehlt = nach + 1; b.setze(neu); }
  },
};

function loescheGewaehlten(): void {
  const b = bearbeitet();
  if (!b || gewaehlt === null) return;
  const neu = loescheWegpunkt(b.punkte, gewaehlt, b.fest);
  if (!neu) return;
  gewaehlt = null;
  b.setze(neu);
}

function zeichneBearbeitung(): void {
  const b = bearbeitet();
  if (gewaehlt !== null && (!b || gewaehlt < b.fest || gewaehlt >= b.punkte.length)) gewaehlt = null;
  zeichneGriffe(b?.punkte ?? null, b?.fest ?? 0, gewaehlt, b ? griffAktionen : null);
}

function auswahlBox(): string {
  const b = bearbeitet();
  if (!b || gewaehlt === null) return '';
  const p = b.punkte[gewaehlt]!;

  const kreis = gewaehlt > 0
    ? `<div class="tb-nav-chips"><button type="button" class="tb-nav-chip" data-aktion="wpRadius">${esc(wort('nav.chipRadius')
      .replace('{sm}', nf(ankunftSm(p), 2, sprache())))}</button></div>` : '';
  return `<div class="tb-nav-k2"><p class="tb-nav-gewaehlt">${esc(wort('nav.wpGewaehlt').replace('{name}', p.name))}</p>`
    + `${knopf('wpLoeschen', wort('nav.wpLoeschen'), 'rot', !darfLoeschen(b.punkte.length, gewaehlt, b.fest))}</div>${kreis}`;
}

const bearbeitenHinweis = (): string => (bearbeitet() ? `<p class="tb-nav-leise">${esc(wort('nav.ziehenHinweis'))}</p>` : '');

async function ausToernplanung(): Promise<void> {
  const boot = bootFuerPlan();
  if (plan) { plan.meldung = null; plan.rechnet = true; zeichnePanel(); }
  const e = await an.etappen();
  if (typeof e === 'string') {
    neuerPlan();
    plan!.meldung = wort(e === 'offline' ? 'nav.planOffline' : e === 'ohneToern' ? 'nav.keinToern' : 'nav.planFehlt');
    zeichneAlles();
    return;
  }
  planAus(streckeAlsPunkte(e.wegpunkte, e.vonName, boot), 'plan', e.nachName ?? wort('nav.ziel'));
}

function streckeAlsPunkte(wegpunkte: readonly Punkt[], vonName: string | null, boot: Punkt | null, nachName?: string | null): NavWegpunkt[] {
  const ziel = nachName ?? wort('nav.ziel');
  const punkte: NavWegpunkt[] = boot ? [{ ...boot, name: wort('nav.eigenePos') }] : [];
  wegpunkte.forEach((p, k) => {
    if (k === 0 && boot && distNM(p.lat, p.lon, boot.lat, boot.lon) < 0.3) return;
    const letzter = k === wegpunkte.length - 1;
    const name = letzter ? ziel : k === 0 ? (vonName ?? wort('nav.start')) : wort('nav.wp').replace('{n}', String(punkte.length));
    punkte.push({ lat: p.lat, lon: p.lon, name });
  });
  return punkte;
}

function uebernimmAusAdresse(): boolean {
  const u = liesNavUrl(location.search);
  if (!u) return false;
  history.replaceState(history.state, '', location.pathname + ohneNavParameter(location.search) + location.hash);
  const punkte = streckeAlsPunkte(u.wegpunkte, u.vonName, an.position(), u.nachName);
  if (punkte.length < 2) return false;
  setzeModus('nav', false);
  planAus(punkte, 'plan', u.nachName ?? wort('nav.ziel'));
  toast(wort(u.quelle === 'coursecast' ? 'nav.toastAusTagesplanung' : u.quelle === 'voyagebook' ? 'nav.toastAusToernbuch' : 'nav.toastUebernommen'));
  return true;
}

const RUECKWEG_MIN_SM = 0.1;

function ausTrack(): void {
  const r = rueckwegPunkte();
  if (r.length < 2 || routenLaengeSm(r) < RUECKWEG_MIN_SM) {
    if (plan) { plan.meldung = wort('nav.rueckLeer'); zeichnePanel(); }
    return;
  }
  r[0] = { ...r[0]!, name: wort('nav.eigenePos') };
  planAus(r, 'rueckweg', wort('nav.ablegepunkt'));
}

function logAnwerfen(): boolean {
  const b = z?.betriebsart;
  if (b === 'laeuft') return true;
  const start = $('btn-start') as HTMLButtonElement | null;
  if (b === 'pausiert-anker') return true;
  if (start && !start.disabled) { start.click(); return true; }
  return false;
}

function starteRoute(punkte: NavWegpunkt[], quelle: RoutenQuelle): void {
  route = { wegpunkte: punkte, naechster: 1, quelle, gestartet: Date.now() };
  schreibe(K.route, route);
  startAufKarte = false;
  plan = null;
  schreibe(K.plan, null);
  zeichnePlan(null);
  gewaehlt = null;
  aktivPruefung = null;
  routeGeaendert = false;
  const lief = logAnwerfen();
  const ziel = punkte.at(-1)!;
  an.eintrag({
    t: Date.now(), art: 'navigation', lat: punkte[0]!.lat, lon: punkte[0]!.lon,
    text: wort(quelle === 'gehezu' ? 'nav.logGehezu' : 'nav.logStart')
      .replace('{ziel}', ziel.name).replace('{sm}', nf(routenLaengeSm(punkte), 1, sprache()))
      .replace('{n}', String(punkte.length - 1)),
  });
  sage(routeGestartet(ziel.name, routenLaengeSm(punkte), quelle === 'gehezu'));
  toast(lief ? wort(quelle === 'gehezu' ? 'nav.toastGehezu' : 'nav.toastAktiv').replace('{sm}', nf(routenLaengeSm(punkte), 1, sprache())) : wort('nav.toastOhneLog'));
  schliesseWerkzeug();
  zeichneAlles();
  zeigePunkte(punkte);
  grenzeAktiv(true);
}

function beendeRoute(eintragText: string | null): void {
  if (!route) return;
  setzeAnnaeherung(null, Date.now());
  const boot = an.position();
  if (eintragText) an.eintrag({ t: Date.now(), art: 'navigation', lat: boot?.lat ?? null, lon: boot?.lon ?? null, text: eintragText });
  route = null;
  aktivPruefung = null;
  routeGeaendert = false;
  schreibe(K.route, null);
  zeichneAktiveRoute(null, null);
  zeichneGefahren([], () => '');
}

let letzteFahrt: { sog: number | null; cog: number | null } = { sog: null, cog: null };

export function routeFuerStream(): StreamRoute | null {
  if (!route) return null;
  const platzhalter = ['nav.ziel', 'nav.punkt'].flatMap((k) => [STRINGS.de[k], STRINGS.en[k]]).filter((x): x is string => !!x);

  const b = route.wegpunkte.at(-1);
  return streamRouteAus(route, navWerte(an.position(), letzteFahrt.sog, letzteFahrt.cog, route, Date.now()), platzhalter, b ? zielname(b.lat, b.lon) : null);
}

export function routeSchluessel(): string {
  const b = route?.wegpunkte.at(-1);
  return route && b ? `${route.gestartet}:${route.naechster}:${route.wegpunkte.length}:${zielname(b.lat, b.lon) ?? ''}` : '';
}

export function zielDerRoute(): { lat: number; lon: number; name: string; etz: number | null } | null {
  const b = route?.wegpunkte.at(-1);

  const platzhalter = b && ['nav.ziel', 'nav.punkt'].some((k) => b.name === STRINGS.de[k] || b.name === STRINGS.en[k]);
  return b ? { lat: b.lat, lon: b.lon, name: platzhalter ? '' : b.name, etz: werte?.etz ?? null } : null;
}

export function navStopp(): void {
  if (!route) return;
  route = null;
  schreibe(K.route, null);
  zeichneAlles();
}

export function yachtPosition(): Punkt | null {
  return an ? an.position() : null;
}
export function routeAktiv(): boolean {
  return !!route;
}
export function routeHierher(p: Punkt): void {
  geheZuGetippt(p);
}

function geheZuGetippt(p: Punkt): void {
  const boot = an.position();
  if (!boot) { toast(wort('nav.keinePos')); return; }
  const zielName = wort('nav.punkt');
  starteRoute([{ ...boot, name: wort('nav.eigenePos') }, { ...p, name: zielName }], 'gehezu');
  const lauf = route;
  void planeRoute(boot, p, planung.abstand).then((r) => {
    if (!route || route !== lauf) return;
    if (r.ohneWeg) {
      aktivPruefung = { daten: r.daten, pruefung: pruefeRoute(route.wegpunkte, r.daten), versatz: 0 };
      toast(wort('nav.gefOhneWeg'));
      zeichneAlles();
      return;
    }
    if (!r.daten.kueste) { toast(wort('nav.gehezuOhneKueste')); return; }
    if (r.gerade) {

      aktivPruefung = { daten: r.daten, pruefung: pruefeRoute(route.wegpunkte, r.daten), versatz: 0 };
      zeichneAlles();
      return;
    }
    const wegpunkte: NavWegpunkt[] = r.punkte.map((q, k) => ({
      lat: q.lat, lon: q.lon,
      name: k === 0 ? wort('nav.eigenePos') : k === r.punkte.length - 1 ? zielName : wort('nav.wp').replace('{n}', String(k)),
    }));
    route = { ...route, wegpunkte, naechster: 1 };
    schreibe(K.route, route);
    aktivPruefung = { daten: r.daten, pruefung: pruefeRoute(wegpunkte, r.daten), versatz: 0 };
    const sm = nf(routenLaengeSm(wegpunkte), 1, sprache());
    an.eintrag({
      t: Date.now(), art: 'navigation', lat: boot.lat, lon: boot.lon,
      text: wort('nav.logGehezuUmfahren').replace('{sm}', sm).replace('{n}', String(wegpunkte.length - 1)),
    });
    toast(wort('nav.toastGehezuUmfahren').replace('{sm}', sm));
    zeichneAlles();
  }).catch(() => {});
}

function messText(a: Punkt, b: Punkt): string {
  const m = messe(a, b);
  return `${kursRw(m.kurs, sprache())} · ${nf(m.sm, 2, sprache())} ${smEinheit()}`;
}

function messSumme(kette: readonly Punkt[]): string {
  return `Σ ${nf(messeKette(kette).summeSm, 2, sprache())} ${smEinheit()}`;
}

function messKette(): Punkt[] {
  const boot = messAbBoot ? messBoot() : null;
  return boot ? [boot, ...messPunkte] : [...messPunkte];
}

function messWert(kette: readonly Punkt[]): string {
  if (kette.length < 2) return '–';
  return kette.length === 2 ? messText(kette[0]!, kette[1]!) : messSumme(kette);
}

const messZiehen = {
  get ersterFest() { return messAbBoot && !!messBoot(); },
  text: messText,
  summe: messSumme,
  beginn: messMerken,
  gezogen(i: number, p: Punkt, fertig: boolean) {
    const k = i - (messAbBoot && messBoot() ? 1 : 0);
    if (k >= 0 && k < messPunkte.length) messPunkte[k] = p;
    const feld = $('tb-nav-mess-wert');
    if (feld) feld.textContent = messWert(messKette());
    if (fertig) zeichnePanel();
  },
};

function messTipp(p: Punkt): void {
  messMerken();
  messPunkte.push(p);
  zeichnePanel();
}

function loeseMob(): void {
  const boot = an.position();
  mob = { lat: boot?.lat ?? null, lon: boot?.lon ?? null, t: Date.now() };
  schreibe(K.mob, mob);

  an.eintrag({ t: mob.t, art: 'mob', lat: mob.lat, lon: mob.lon, text: mob.lat !== null && mob.lon !== null ? positionText(mob.lat, mob.lon, sprache()) : wort('nav.mobOhnePos') });
  sage(ANSAGE.mob, 'frage', 60_000, true);
  toast(wort('nav.toastMob'));
  zeichneMobLeiste();
}

function zeichneMobLeiste(): void {
  const leiste = $('tb-nav-mob-leiste');
  if (!leiste) return;
  leiste.hidden = !mob;
  const boot = an.position();
  const ort = mob && mob.lat !== null && mob.lon !== null ? { lat: mob.lat, lon: mob.lon } : null;
  zeichneMob(ort, boot);
  if (!mob) return;
  const kopf = $('tb-nav-mob-kopf');

  const kurz = typeof window !== 'undefined' && window.innerWidth < 400;
  if (kopf) kopf.textContent = wort(kurz ? 'nav.mobKopfKurz' : 'nav.mobKopf').replace('{min}', String(Math.floor((Date.now() - mob.t) / 60_000)));
  const wert = $('tb-nav-mob-wert');
  if (wert) {
    wert.textContent = ort && boot
      ? `${kursRw(messe(boot, ort).kurs, sprache())} · ${nf(distNM(boot.lat, boot.lon, ort.lat, ort.lon) * 1852, 0, sprache())} m`
      : wort('nav.mobOhnePos');
  }
}

function zeichneAlles(): void {
  if (!an) return;
  zeichneKacheln();
  zeichneKopf();
  zeichneLeiste();
  zeichneLeisteWerkzeuge();
  zeichnePanel();
  zeichneMobLeiste();
  zeichneAktiveRoute(route, an.position());
  if (plan) {
    zeichnePlan(plan.punkte);
    zeichneGefahren(plan.daten?.gefahren ?? [], (g) => g.name || wort(`nav.gefahr.${g.art}`));
  } else if (route && aktivPruefung && werkzeug === 'route' && modus === 'nav') {
    zeichneGefahren(aktivPruefung.daten.gefahren, (g) => g.name || wort(`nav.gefahr.${g.art}`));
  }
  zeichneBearbeitung();

  zeichneUntiefe(plan && zuFlach(plan) ? { lat: plan.flachste!.lat, lon: plan.flachste!.lon, text: `${nf(plan.flachste!.m, 1, sprache())} m` } : null);
  const chip = $('tb-nav-offline');
  if (chip) {
    const boot = an.position();
    const da = !!boot && regionen().some((r) => enthaelt(r, boot));
    chip.hidden = !da;
    chip.textContent = `● ${wort('nav.offlineChip')}`;
  }
}

type RoutenGrenze = Grenzuebergang & { gewarnt?: boolean; geloggt?: boolean };
let routenGrenzen: { key: string; liste: RoutenGrenze[]; vollstaendig?: boolean } | null = lies(K.grenzen);
let grenzenLaufen = false;
let grenzenVersuchAb = 0;
const GRENZEN_ERNEUT_MS = 10 * 60_000;

function routenGeometrie(r: NavRoute): string {
  return `${r.gestartet}:${r.wegpunkte.map((w) => `${w.lat.toFixed(4)},${w.lon.toFixed(4)}`).join(';')}`;
}

function sorgeFuerGrenzen(boot: Punkt | null): void {
  if (!route || grenzenLaufen || Date.now() < grenzenVersuchAb || !istOnline()) return;
  const key = routenGeometrie(route);

  if (routenGrenzen?.key === key && routenGrenzen.vollstaendig !== false) return;
  grenzenLaufen = true;
  const punkte = route.wegpunkte.map((w) => ({ lat: w.lat, lon: w.lon }));
  const alt = routenGrenzen?.key === key ? routenGrenzen.liste : [];
  void grenzenEntlang(punkte, zoneAn).then(({ liste, fehlend }) => {
    if (!route || routenGeometrie(route) !== key) return;
    const schon = boot ? fortschrittSm(punkte, boot) : null;
    const neu: RoutenGrenze[] = liste.map((g) => {

      const vorher = alt.find((a) => (a.von.staat ?? '') === (g.von.staat ?? '') && (a.nach.staat ?? '') === (g.nach.staat ?? '') && Math.abs(a.sm - g.sm) <= 2);
      if (vorher?.geloggt || (schon && schon.abstandSm <= 3 && g.sm <= schon.sm)) return { ...g, gewarnt: true, geloggt: true };
      return vorher?.gewarnt ? { ...g, gewarnt: true } : g;
    });

    if (fehlend > 0 && !liste.length && !alt.length) return;
    routenGrenzen = { key, liste: neu, vollstaendig: fehlend === 0 };
    schreibe(K.grenzen, routenGrenzen);
  }).catch(() => { grenzenVersuchAb = Date.now() + GRENZEN_ERNEUT_MS; }).finally(() => { grenzenLaufen = false; });
  grenzenVersuchAb = Date.now() + GRENZEN_ERNEUT_MS;
}

function pruefeRoutenGrenzen(boot: Punkt, sog: number | null, jetzt: number): void {
  if (!route || !routenGrenzen || routenGrenzen.key !== routenGeometrie(route)) return;
  const f = fortschrittSm(route.wegpunkte, boot);
  let geaendert = false;
  for (const g of routenGrenzen.liste) {
    if (g.geloggt) continue;
    const stand = grenzStand(g, f, sog);
    if (stand === 'loggen') {
      loggeGrenze(g.von, g.nach, boot, jetzt);
      g.geloggt = true; g.gewarnt = true; geaendert = true;
    } else if (stand === 'warnen' && !g.gewarnt) {
      const minuten = sog && sog > 0.5 ? ((g.sm - f.sm) / sog) * 60 : 12;
      warneGrenzeVoraus(g.von, g.nach, minuten);
      g.gewarnt = true; geaendert = true;
    }
  }
  if (geaendert) schreibe(K.grenzen, routenGrenzen);
}

function restFuerWetter(): Punkt[] | null {
  const boot = an.position();
  if (route) {
    const wp = route.wegpunkte;
    return [...(boot ? [boot] : wp.slice(Math.max(0, route.naechster - 1), route.naechster)), ...wp.slice(route.naechster)]
      .map((p) => ({ lat: p.lat, lon: p.lon }));
  }
  return plan && plan.punkte.length >= 2 ? plan.punkte.map((p) => ({ lat: p.lat, lon: p.lon })) : null;
}
const wetterAnbindung: WetterAnbindung = {
  boot: () => an.position(),
  rest: restFuerWetter,
  fahrtKn: () => (letzteFahrt.sog !== null && letzteFahrt.sog >= 2 ? letzteFahrt.sog : planung.fahrt),
  online: () => istOnline(),
  wort,
  sprache,
  zeige: (punkte) => zeigeUeberPanel(punkte),
};

let annaeherung: { tS: number; um: number } | null = null;
let tickUhr = 0;
let angesagt: { wp: string; gesagt: Set<number> } | null = null;
function setzeAnnaeherung(tS: number | null, jetzt: number): void {
  annaeherung = tS === null ? null : { tS, um: jetzt };
  window.clearTimeout(tickUhr);
  tickUhr = 0;
  tickeAnnaeherung();
}
function tickeAnnaeherung(): void {
  tickUhr = 0;
  if (!annaeherung) return;
  const jetzt = Date.now();
  const rest = annaeherung.tS - (jetzt - annaeherung.um) / 1000;
  if (rest <= 0) return;
  if (!route) return;
  const wp = route.wegpunkte[route.naechster];
  if (!wp) return;
  const schluessel = `${route.gestartet}:${route.naechster}`;
  if (angesagt?.wp !== schluessel) angesagt = { wp: schluessel, gesagt: new Set() };
  const s = faelligeAnnaeherung(rest, angesagt.gesagt);
  if (s !== null) {
    for (const g of ANNAEHERUNG_ANSAGEN_S) if (g >= s) angesagt.gesagt.add(g);

    sage(annaeherungText(wp.name, s, route.naechster === route.wegpunkte.length - 1), 'annaeherung', 15_000);
  }

  const naechste = ANNAEHERUNG_ANSAGEN_S.find((g) => g < rest && !angesagt!.gesagt.has(g));
  if (naechste !== undefined) tickUhr = window.setTimeout(tickeAnnaeherung, Math.max(200, (rest - naechste) * 1000));
}

let vtgZuletzt = 0;
const vtgGesagt = new Set<string>();
function pruefeVtg(boot: { lat: number; lon: number }, cog: number | null, sog: number | null, jetzt: number): void {
  if (jetzt - vtgZuletzt < 20_000) return;
  vtgZuletzt = jetzt;
  const box = { swLat: boot.lat - 0.1, swLon: boot.lon - 0.13, neLat: boot.lat + 0.1, neLon: boot.lon + 0.13 };
  const gebiete: VtgGebiet[] = [];
  const messina = vtgInBox(box);
  if (messina) gebiete.push({ id: 'messina', linien: VTG_FLAECHEN.map((f) => [...f, f[0]!]), name: 'Strait of Messina' });
  const linien: { lat: number; lon: number }[][] = [];
  for (const w of verkehrJetzt(box)) {
    if (w.art === 'faehre') continue;

    if (messina && vtgInBox({ swLat: w.s, swLon: w.w, neLat: w.n, neLon: w.o })) continue;
    const l: { lat: number; lon: number }[] = [];
    for (let k = 0; k < w.p.length; k += 2) l.push({ lat: w.p[k]!, lon: w.p[k + 1]! });
    if (l.length) linien.push(l);
  }
  if (linien.length) gebiete.push({ id: 'osm', linien });
  vtgFreigeben(boot, vtgGesagt, gebiete);
  const t = vtgAnnaeherung(boot, cog, sog, gebiete, vtgGesagt);
  if (!t) return;
  vtgGesagt.add(t.gebiet.id);
  sage(vtgText(t.sm, t.gebiet.name), 'frage', 2 * 60_000);
}

function sageWegpunkt(name: string, nachgeholt: boolean): void {
  if (!route) return;
  const n = route.wegpunkte[route.naechster];
  if (!n) return;

  const eta = werte?.eta != null ? new Date(werte.eta) : null;
  sage(wegpunktText(name, {
    name: n.name, istZiel: route.naechster === route.wegpunkte.length - 1, sm: werte?.dtw ?? null, brg: werte?.brg ?? null,
    eta: eta ? { h: eta.getHours(), m: eta.getMinutes() } : null,
  }, nachgeholt), 'wegpunkt');
}

export function navTakt(neu: Zustand, punkte: SpurPunkt[], laufAnfaenge: readonly number[] = []): void {
  z = neu;
  spur = punkte;
  const boot = an.position();
  const jetzt = Date.now();

  const sog = neu.laeuft && !neu.wartetAufFix ? geglaetteteSog(punkte.slice(0, -1), jetzt, undefined, laufAnfaenge) ?? neu.sog : null;
  letzteFahrt = { sog, cog: neu.laeuft ? neu.cog : null };
  werte = navWerte(boot, sog, neu.laeuft ? neu.cog : null, route, jetzt);

  const inFahrt = neu.betriebsart === 'laeuft' && !neu.wartetAufFix;
  band = inFahrt ? { wp: etaBand(werte?.dtw ?? null, punkte, jetzt, laufAnfaenge), ziel: etaBand(werte?.dtz ?? null, punkte, jetzt, laufAnfaenge) } : { wp: null, ziel: null };

  sorgeFuerGrenzen(boot);

  if (route && istOnline()) wetterVorab(restFuerWetter() ?? []);
  feuerBootGeaendert();

  pruefeBlitze(boot, route ? restFuerWetter() : null, wetterAnbindung.fahrtKn(), neu.betriebsart !== 'gestoppt', istOnline(), an.eintrag);
  if (boot && neu.betriebsart === 'laeuft' && !neu.wartetAufFix) pruefeRoutenGrenzen(boot, sog, jetzt);
  if (boot && neu.betriebsart === 'laeuft' && !neu.wartetAufFix) pruefeVtg(boot, neu.cog, sog, jetzt);

  if (route && boot && neu.betriebsart === 'laeuft' && !neu.wartetAufFix) {
    const f = pruefeFortschritt(route, boot);
    if (f.art === 'weiter') {
      const name = route.wegpunkte[f.erreicht]!.name;
      route = { ...route, naechster: route.naechster + 1 };
      schreibe(K.route, route);
      an.eintrag({ t: jetzt, art: 'navigation', lat: boot.lat, lon: boot.lon, text: wort('nav.logWp').replace('{name}', name) });
      toast(wort('nav.toastWp').replace('{name}', name));
      werte = navWerte(boot, sog, neu.cog, route, jetzt);
      sageWegpunkt(name, false);
    } else if (f.art === 'ziel') {
      const name = route.wegpunkte.at(-1)!.name;
      beendeRoute(wort('nav.logZiel').replace('{name}', name));
      toast(wort('nav.toastZiel'));
      verwirf((t) => / in (three|one|thirty) /.test(t));
      sage(ANSAGE.ziel, 'ziel');
      werte = navWerte(boot, sog, neu.cog, null, jetzt);
    } else {

      const k = nachholen(route, boot, neu.cog, sog);
      if (k !== null) {
        const name = route.wegpunkte[k - 1]!.name;
        route = { ...route, naechster: k };
        schreibe(K.route, route);
        an.eintrag({ t: jetzt, art: 'navigation', lat: boot.lat, lon: boot.lon, text: wort('nav.logWpNachgeholt').replace('{name}', name) });
        toast(wort('nav.toastWpNachgeholt').replace('{name}', route.wegpunkte[k]!.name));
        werte = navWerte(boot, sog, neu.cog, route, jetzt);
        sageWegpunkt(name, true);
      }
    }
  }

  const faehrt = !!route && !!boot && neu.betriebsart === 'laeuft' && !neu.wartetAufFix;
  const ot = offTrackTakt(faehrt ? werte?.xte ?? null : null, planung.offTrack, offTrack, jetzt);
  offTrack = { alarm: ot.alarm, letzterTon: ot.letzterTon };
  if (ot.ton && werte?.xte != null && boot) {
    const sm = nf(Math.abs(werte.xte), 2, sprache());
    toast(wort('nav.toastOffTrack').replace('{sm}', sm).replace('{seite}', seite(werte.xte)));
    sage(offTrackText(werte.xte), 'frage', 30_000);
    if (ot.neu) {
      an.eintrag({ t: jetzt, art: 'navigation', lat: boot.lat, lon: boot.lon,
        text: wort('nav.logOffTrack').replace('{sm}', sm).replace('{seite}', seite(werte.xte)).replace('{g}', nf(planung.offTrack ?? 0, 2, sprache())) });
    }
  }

  setzeAnnaeherung(route && boot && neu.betriebsart === 'laeuft' && !neu.wartetAufFix
    ? zeitBisPassage(route, boot, sog, neu.laeuft ? neu.cog : null) : null, jetzt);
  zeichneKacheln();
  zeichneKopf();
  zeichneLeiste();
  zeichneMobLeiste();
  zeichneAktiveRoute(route, boot);

  if (werkzeug === 'anker' || werkzeug === 'messen') zeichnePanel();
  zeichneLeisteWerkzeuge();
}

export function initNavigation(anbindung: NavAnbindung): void {
  an = anbindung;

  radarObjekt()?.beiWechsel(() => { letzteLeiste = ''; zeichneLeisteWerkzeuge(); });

  luftbildObjekt()?.beiWechsel(() => { letzteLeiste = ''; zeichneLeisteWerkzeuge(); });

  schreibe(K.leisteZu, true);

  initLeuchtfeuer(() => an.position(), () => istOnline());

  initKartenObjekte(() => istOnline());
  uhrTakt();

  initTimer(() => { letzteLeiste = ''; zeichneLeisteWerkzeuge(); });

  initStoppuhr(() => { letzteLeiste = ''; zeichneLeisteWerkzeuge(); });

  const k = karteObjekt(), sk = seekarteObjekt();
  if (k && sk) {
    const namen = seekartenNamen(k, sk, { netz: () => istOnline(), winkel: kartenWinkel, belegt: feuerPlaetze });
    beiFeuerGezeichnet(namen.neu);
  }

  const kopf = document.querySelector<HTMLElement>('body > header');
  if (kopf && typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (kopf.offsetHeight) document.documentElement.style.setProperty('--tb-kopf-h', `${kopf.offsetHeight}px`);
    }).observe(kopf);
  }
  griff('btn-nav-griff-auf', 'nav', -1);
  $('btn-nav-auf')?.addEventListener('click', () => setzeModus('nav'));
  $('btn-log-auf')?.addEventListener('click', () => setzeModus('log'));
  $('btn-modus-log')?.addEventListener('click', () => setzeModus('log'));
  $('btn-modus-nav')?.addEventListener('click', () => setzeModus('nav'));
  $('btn-nav-zentrieren')?.addEventListener('click', () => zentriere());
  $('btn-mob')?.addEventListener('click', loeseMob);
  $('btn-mob-log')?.addEventListener('click', loeseMob);
  $('btn-mob-aus')?.addEventListener('click', () => {
    mob = null;
    schreibe(K.mob, null);
    stoppeTon();
    zeichneMobLeiste();
  });
  $('btn-nav-panel-zu')?.addEventListener('click', werkzeugZu);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (chronoBaum) { chronoBaum = false; zeichneLeisteWerkzeuge(); }
    if (werkzeug === 'log') werkzeugZu();
  });

  $('tb-nav-werkzeuge')?.addEventListener('scroll', () => {
    const box = $('tb-nav-werkzeuge');
    if (box) { zeichneBaum(box, werkzeug === 'log', 'log', logBaumInhalt); zeichneBaum(box, chronoBaum, 'chrono', chronoBaumInhalt); }
  }, { passive: true });
  $('btn-nav-wahl-zu')?.addEventListener('click', schliesseWahl);

  $('btn-karten')?.addEventListener('click', () => {
    if ($('menu-panel')?.hidden === false) $('btn-menu')?.click();
    if (werkzeug !== 'karten') oeffneWerkzeug('karten');
  });
  wahlEl()?.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLElement>('[data-wert]');
    if (k) waehle(k.dataset['wert'] as KachelWert);
    else if (e.target === wahlEl()) schliesseWahl();
  });
  $('tb-nav-kompassreihe')?.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLElement>('[data-platz]');
    if (k) oeffneWahl(Number(k.dataset['platz']));
  });
  $('tb-nav-kacheln')?.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLElement>('[data-platz]');
    if (k) oeffneWahl(Number(k.dataset['platz']));
  });
  $('tb-nav-werkzeuge')?.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-klapp]')) {
      schreibe(K.leisteZu, lies<boolean>(K.leisteZu) === true ? null : true);
      zeichneLeisteWerkzeuge();
      ($('tb-nav-werkzeuge')?.querySelector('[data-klapp]') as HTMLElement | null)?.focus();
      return;
    }
    const k = (e.target as Element).closest<HTMLElement>('[data-werkzeug]');
    if (k) oeffneWerkzeug(k.dataset['werkzeug'] as Werkzeug);
  });

  for (const k of document.querySelectorAll<HTMLButtonElement>('.tb-nav-l')) {
    nurLangDruck(k, () => ($(k.dataset['ziel'] ?? '') as HTMLButtonElement | null)?.click(), () => toast(wort('nav.langDruecken')));
  }
  for (const id of ['tb-nav-panel-inhalt', 'tb-nav-liste']) {
    const el = $(id);
    if (el) wischListen.push(macheWischbar(el, (wid) => loescheAusListe(wid)));
  }

  $('tb-nav-liste')?.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLElement>('[data-aktion]');
    if (k && !(k as HTMLButtonElement).disabled) aktion(k.dataset['aktion']!);
  });
  $('tb-nav-panel-inhalt')?.addEventListener('click', (e) => {
    const k = (e.target as Element).closest<HTMLElement>('[data-aktion]');
    if (!k || (k as HTMLButtonElement).disabled) return;
    aktion(k.dataset['aktion']!);
  });

  $('tb-nav-panel-inhalt')?.addEventListener('change', (e) => {
    const el = (e.target as Element).closest<HTMLInputElement>('input[data-feld]');
    if (!el) return;
    if (el.dataset['feld'] === 'fahrt') {
      const v = leseZahl(el.value);
      if (Number.isFinite(v) && v >= PLANFAHRT_MIN_KN && v <= PLANFAHRT_MAX_KN) planung.fahrt = Math.round(v * 10) / 10;
      else toast(wort('nav.planFahrtUngueltig').replace('{min}', nf(PLANFAHRT_MIN_KN, 1, sprache())).replace('{max}', String(PLANFAHRT_MAX_KN)));
    } else if (el.dataset['feld'] === 'ab') {
      const t = el.value ? new Date(el.value).getTime() : NaN;
      planung.ab = Number.isFinite(t) ? t : null;
    }
    schreibe(K.planung, planung);
    zeichnePanel();
  });
  aufSprachwechsel(zeichneAlles);
  matchMedia('(min-width: 900px)').addEventListener('change', zeichneAlles);
  setInterval(() => { if (mob) zeichneMobLeiste(); }, 15_000);

  const gemerkt = lies<Modus>(K.modus);
  setzeModus(route ? 'nav' : gemerkt === 'nav' ? 'nav' : 'log', false);

  uebernimmAusAdresse();
}

function aktion(a: string): void {

  if (a.startsWith('karte:')) {
    kartenBaum = false;
    const lb = luftbildObjekt();
    if (a === 'karte:luftbild') { if (lb && !lb.an()) void lb.setze(true); } else {
      if (lb?.an()) void lb.setze(false);
      setzeKartenStil(a === 'karte:basis' ? 'basis' : 'topo');
    }
    letzteLeiste = '';
    zeichneLeisteWerkzeuge();
    return;
  }
  if (a === 'wetter:karte') {
    wetterBaum = false;
    if (werkzeug === 'wetter') { werkzeugZu(); return; }
    schliesseWerkzeug();
    werkzeug = 'wetter';
    zeichneAlles();
    return;
  }
  if (a === 'wetter:seewetter') {
    wetterBaum = false;
    letzteLeiste = '';
    zeichneLeisteWerkzeuge();
    oeffneSeewetter();
    return;
  }
  if (a === 'wetter:wx') {
    wetterBaum = false;
    const r = radarObjekt();
    if (r) void r.setze(!r.an());
    letzteLeiste = '';
    zeichneLeisteWerkzeuge();
    return;
  }
  if (a.startsWith('chrono:')) {
    chronoBaum = false;
    if (a === 'chrono:timer') schalteTimer(); else schalteStoppuhr();
    letzteLeiste = '';
    zeichneLeisteWerkzeuge();
    return;
  }
  if (a.startsWith('log:')) {
    const ziel = $(a.slice(4)) as HTMLButtonElement | null;
    werkzeugZu();
    ziel?.click();
    return;
  }
  switch (a) {
    case 'neuPlanen': {
      const boot = an.position();
      if (!route || !boot) return;
      const rest = route.wegpunkte.slice(route.naechster);
      planAus([{ ...boot, name: wort('nav.eigenePos') }, ...rest], route.quelle === 'gehezu' ? 'route' : route.quelle, rest.at(-1)?.name ?? wort('nav.ziel'));
      return;
    }
    case 'wpWeiter': wegpunktWeiter(); return;
    case 'routeEnde':
      beendeRoute(wort('nav.logEnde'));
      toast(wort('nav.toastBeendet'));
      schliesseWerkzeug();
      zeichneAlles();
      return;
    case 'ausPlan': void ausToernplanung(); return;
    case 'ausTrack': ausTrack(); return;
    case 'starten': if (plan && plan.punkte.length >= 2) starteRoute(plan.punkte, plan.quelle); return;
    case 'wpLoeschen': loescheGewaehlten(); return;
    case 'wpRadius': {
      const b = bearbeitet();
      if (!b || gewaehlt === null || gewaehlt === 0) return;
      const k = gewaehlt;
      const jetzt = ankunftSm(b.punkte[k]!);
      const i = ANKUNFT_STUFEN_SM.findIndex((x) => Math.abs(x - jetzt) < 1e-9);
      const neu = ANKUNFT_STUFEN_SM[(i + 1) % ANKUNFT_STUFEN_SM.length]!;
      b.setze(b.punkte.map((q, n) => (n === k ? { ...q, radiusSm: neu } : q)));
      zeichneAlles();
      return;
    }
    case 'offTrack': {
      const i = OFFTRACK_STUFEN_SM.indexOf(planung.offTrack);
      planung.offTrack = OFFTRACK_STUFEN_SM[(i + 1) % OFFTRACK_STUFEN_SM.length] ?? null;
      schreibe(K.planung, planung);
      offTrack = { alarm: false, letzterTon: null };
      zeichnePanel();
      return;
    }
    case 'abstand': {
      const i = ABSTAENDE_SM.indexOf(planung.abstand as typeof ABSTAENDE_SM[number]);
      planung.abstand = ABSTAENDE_SM[(i + 1) % ABSTAENDE_SM.length]!;
      schreibe(K.planung, planung);

      const b = plan?.punkte.at(-1);
      if (plan?.quelle === 'route' && b && plan.punkte.length >= 2) zielGetippt(b);
      else zeichnePanel();
      return;
    }
    case 'abJetzt':
      planung.ab = null;
      schreibe(K.planung, planung);
      zeichnePanel();
      return;
    case 'zeigeUntiefe': {
      const u = plan?.flachste;

      if (u) zeigeUeberPanel([{ lat: u.lat - 0.008, lon: u.lon - 0.012 }, { lat: u.lat + 0.008, lon: u.lon + 0.012 }]);
      return;
    }
    case 'neuerStart':
    case 'startGps':
      startAufKarte = a === 'neuerStart' && !!z && z.betriebsart !== 'gestoppt' && einBildschirm();
      schreibe(K.plan, null);
      plan = null;
      neuerPlan(false, a === 'startGps');
      zeichneAlles();
      return;

    case 'messYacht': case 'messPunkte':
      messAbBoot = a === 'messYacht';
      if (messAbBoot) holeMessGps();
      zeichnePanel(); return;
    case 'wpRueck': wpRueckgaengig(); return;
    case 'messZurueck': { const v = messVerlauf.pop(); if (v) messPunkte = v; zeichnePanel(); return; }
    case 'messNeu': if (messPunkte.length) { messMerken(); messPunkte = []; } zeichnePanel(); return;
    case 'radiusMinus': ankerRadius = Math.max(15, ankerRadius - 5); zeichnePanel(); return;
    case 'radiusPlus': ankerRadius = Math.min(150, ankerRadius + 5); zeichnePanel(); return;
    case 'ankerScharf': an.aktiviereAnker(ankerRadius); zeichneAnkerVorschau(null, 0); return;
    case 'ankerAus': an.hebeAnkerAuf(); return;
    case 'ankerDetails': ($('btn-pause-anker') as HTMLButtonElement | null)?.click(); return;
    case 'vorladen':
      vorladenText = wort('nav.kartenLaeuft');
      zeichnePanel();
      {

        const b = sichtbarerAusschnitt();
        const um = restFuerWetter() ?? (b ? [{ lat: b.sued, lon: b.west }, { lat: b.nord, lon: b.ost }] : []);
        if (istOnline()) wetterVorab(um, true);
      }
      void an.vorladen((t) => { vorladenText = t; if (werkzeug === 'karten') zeichnePanel(); }).then((ok) => {
        const box = sichtbarerAusschnitt();
        if (ok && box) merkeRegion(box);
        zeichneAlles();
      });
      return;
    case 'seezeichen': setzeSeezeichen(!seezeichenAn()); zeichnePanel(); return;
  }
}
