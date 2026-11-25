import { holeStationen, type Wetterstation } from '@/data/stationen';
import { laufbandEintraege, laufbandQuellen, laufbandTeile, alleUnauffaellig, type LaufbandTeil } from '@/briefing/stationen';
import { distNM } from '@/core/geo';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { STRINGS } from './strings';
import { istOnline, meldeErfolg, meldeFehlschlag } from './netz';
import { warnungenAnPosition } from './seewetter';
import type { WarnTreffer } from '@/core/warnungen';
import { zeigeWarnblock } from './warnblock';
import { oeffneSeewetter } from './seewetter';
import { sage } from './ansage';
import { warnungText } from '@/core/ansagen';
import { aktuellerZustand } from './aufzeichnung';
import { SCHLUESSEL } from '@/shell/speicherschluessel';

const ABRUF_MS = 10 * 60_000;
const FEHLER_RUHE_MS = 2 * 60_000;
const NEU_AB_SM = 10;
const ZEICHNEN_MS = 30_000;
const MAX_ALTER_MS = 3 * 3600_000;

const MAX_ALTER_BOJE_MS = 6 * 3600_000;

const PX_JE_S = 45;
const TRENNER = '     ◆     ';

const ENDE = '      • • • • • • •      ';

type Lage = { lat: number; lon: number };

let holeLage: (() => Lage | null) | null = null;
let stationen: Wetterstation[] = [];
let abgerufenBei: Lage | null = null;
let letzterAbruf = 0;
let ruheBis = 0;
let laeuftAbruf = false;
let letztesZeichnen = 0;
let einzeln = 0;
let letzterText = '';

let warnSee = false, warnSeeBei = 0, warnAlarm = false, warnAlarmBei = 0;

let warnTreffer: WarnTreffer[] = [];

let warnBasis = false;
let warnGeprueftBei: Lage | null = null;
let letzteWarnPruefung = 0;
let laeuftWarn = false;
const WARN_GILT_MS = 3 * 3600_000;

export function wetterwarnungStufe(jetzt = Date.now()): 3 | 4 | null {
  const alarm = warnAlarm && jetzt - warnAlarmBei <= WARN_GILT_MS;
  const see = warnSee && jetzt - warnSeeBei <= WARN_GILT_MS;
  if (see || (alarm && warnTreffer.some((t) => t.stufe >= 4))) return 4;
  return alarm || see ? 3 : null;
}

export function wetterwarnungAktiv(jetzt = Date.now()): boolean {
  return (warnSee && jetzt - warnSeeBei <= WARN_GILT_MS) || (warnAlarm && jetzt - warnAlarmBei <= WARN_GILT_MS);
}

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string => STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
const ruhig = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function laufbandAn(): boolean {
  try { return localStorage.getItem(SCHLUESSEL.laufbandAus) !== '1'; } catch { return true; }
}
export function setzeLaufbandAn(an: boolean): void {
  try { if (an) localStorage.removeItem(SCHLUESSEL.laufbandAus); else localStorage.setItem(SCHLUESSEL.laufbandAus, '1'); } catch {  }
  letzterSchluessel = '';
  zeichne(true);
}

export function initStationen(lage: () => Lage | null): void {
  holeLage = lage;
  const schalter = $('in-laufband') as HTMLInputElement | null;
  if (schalter) {
    schalter.checked = laufbandAn();
    schalter.addEventListener('change', () => setzeLaufbandAn(schalter.checked));
  }
  const band = $('tb-laufband');
  band?.addEventListener('click', (e) => {

    if ((e.target as Element).closest('#tb-laufband-fest')) { oeffneSeewetter(); return; }
    if (ruhig()) { einzeln++; zeichne(true); return; }
    const an = band.getAttribute('aria-pressed') !== 'true';
    band.setAttribute('aria-pressed', String(an));
    band.classList.toggle('pausiert', an);
  });
  aufSprachwechsel(() => zeichne(true));

  document.querySelector('.tb-laufband-spur')?.addEventListener('animationiteration', () => {
    if (wartend) uebernimm(wartend.teile, wartend.quellen, wartend.zeile);
  });
}

export function pruefeStationen(): void {
  const lage = holeLage?.();
  if (!lage) { verstecke(); return; }
  const jetzt = Date.now();
  const weit = abgerufenBei != null && distNM(lage.lat, lage.lon, abgerufenBei.lat, abgerufenBei.lon) > NEU_AB_SM;
  if (!laeuftAbruf && istOnline() && jetzt >= ruheBis && (weit || jetzt - letzterAbruf >= ABRUF_MS)) rufeAb(lage);
  const warnWeit = warnGeprueftBei != null && distNM(lage.lat, lage.lon, warnGeprueftBei.lat, warnGeprueftBei.lon) > NEU_AB_SM;
  if (!laeuftWarn && istOnline() && (warnWeit || jetzt - letzteWarnPruefung >= ABRUF_MS)) pruefeWarnung(lage);
  if (jetzt - letztesZeichnen >= ZEICHNEN_MS) zeichne(false);
}

function rufeAb(lage: Lage): void {
  laeuftAbruf = true;
  letzterAbruf = Date.now();
  void (async () => {
    try {
      const antwort = await holeStationen(lage.lat, lage.lon);
      if (!antwort) { meldeFehlschlag(); ruheBis = Date.now() + FEHLER_RUHE_MS; return; }
      meldeErfolg();
      stationen = antwort.stationen;
      abgerufenBei = lage;
      zeichne(false);
    } finally {
      laeuftAbruf = false;
    }
  })();
}

function pruefeWarnung(lage: Lage): void {
  laeuftWarn = true;
  letzteWarnPruefung = Date.now();
  void warnungenAnPosition(lage).then((w) => {
    const jetzt = Date.now();
    if (w.seewetter !== null) { warnSee = w.seewetter; warnSeeBei = jetzt; }
    const vorher = wetterwarnungAktiv(jetzt);
    if (w.meteoalarm !== null) {
      warnTreffer = w.meteoalarm.filter((t) => t.stufe >= 3);
      warnAlarm = warnTreffer.length > 0;
      warnAlarmBei = jetzt;
    }
    warnGeprueftBei = lage;
    const aktiv = wetterwarnungAktiv(jetzt);
    zeigeWarnblock(aktiv ? { seewetter: warnSee, treffer: warnAlarm ? warnTreffer : [], geprueft: jetzt } : null);

    const ersteSicht = !warnBasis;
    if (w.seewetter !== null || w.meteoalarm !== null) warnBasis = true;
    if (aktiv && !vorher && !ersteSicht && aktuellerZustand().betriebsart === 'laeuft') {
      const s = warnAlarm ? (warnTreffer.some((t) => t.stufe >= 4) ? 4 : 3) : null;
      sage(warnungText(s), 'frage', 10 * 60_000);
    }
    zeichne(true);
  }).catch(() => {  }).finally(() => { laeuftWarn = false; });
}

function verstecke(): void {
  const band = $('tb-laufband');
  if (band && !band.hidden) { band.hidden = true; document.body.classList.remove('mit-laufband'); }
}

let letzterSchluessel = '';

let wartend: { teile: LaufbandTeil[][]; quellen: string; zeile: string } | null = null;

function setzeTeile(el: HTMLElement, teile: readonly (readonly LaufbandTeil[])[], quellen: string): void {
  const knoten: (Node | string)[] = [];
  teile.forEach((station, i) => {
    if (i > 0) knoten.push(TRENNER);
    station.forEach((t, k) => {
      if (k > 0) knoten.push(' · ');
      if (t.stufe === 'gelb' || t.stufe === 'rot') {
        const sp = document.createElement('span');
        sp.className = `tb-laufband-${t.stufe}`;
        sp.textContent = t.text;
        knoten.push(sp);
      } else knoten.push(t.text);
    });
  });
  if (quellen) knoten.push(TRENNER, quellen, ENDE);
  el.replaceChildren(...knoten);
}

function zeichne(sofort: boolean): void {
  letztesZeichnen = Date.now();
  const lage = holeLage?.();
  const band = $('tb-laufband'), text = $('tb-laufband-text'), kopie = $('tb-laufband-kopie'), sr = $('tb-laufband-sr');
  const fest = $('tb-laufband-fest');
  if (!lage || !band || !text || !kopie || !sr) return;
  const jetzt = Date.now();
  const frisch = stationen.filter((s) => jetzt - Date.parse(s.zeit) <= (s.boje ? MAX_ALTER_BOJE_MS : MAX_ALTER_MS));
  const warnung = wetterwarnungAktiv(jetzt) ? wort('stationen.warnung') : '';
  if (frisch.length === 0 && !warnung) { verstecke(); return; }

  if (!laufbandAn() && !warnung) { verstecke(); letzterSchluessel = ''; return; }
  const sprache = aktuelleSprache();
  const eintraege = laufbandEintraege(frisch, lage, jetzt, sprache);
  const teile = laufbandTeile(frisch, lage, jetzt, sprache);
  const quellen = frisch.length ? laufbandQuellen(frisch, sprache) : '';

  band.classList.toggle('gruen', !warnung && alleUnauffaellig(teile));
  band.classList.toggle('warnung', !!warnung);

  const stufe = warnung ? wetterwarnungStufe(jetzt) : null;
  band.classList.toggle('warnung-rot', stufe === 4);
  band.classList.toggle('warnung-orange', stufe === 3);

  if (fest && fest.textContent !== warnung) {
    fest.textContent = warnung;
    fest.hidden = !warnung;
    fest.title = warnung ? wort('stationen.warnungTitel') : '';

    requestAnimationFrame(() => band.style.setProperty('--fest-breite', warnung ? `${fest.offsetWidth}px` : '0px'));
  }
  const srText = `${wort('stationen.titel')}: ${[warnung, ...eintraege, quellen].filter(Boolean).join('. ')}`;
  if (sr.textContent !== srText) sr.textContent = srText;
  const label = ruhig() ? wort('stationen.weiter') : wort('stationen.anhalten');
  if (band.getAttribute('aria-label') !== label) band.setAttribute('aria-label', label);
  if (ruhig()) {
    band.classList.add('ruhig');
    const i = einzeln % (eintraege.length + 1);
    if (i < teile.length) setzeTeile(text, [teile[i]!], ''); else text.textContent = quellen;
    kopie.textContent = '';
  } else {
    band.classList.remove('ruhig');

    const zeile = frisch.length ? [...eintraege, quellen].join(TRENNER) + ENDE : '';
    const schluessel = zeile + JSON.stringify(teile.map((t) => t.map((x) => x.stufe)));
    if (schluessel === letzterSchluessel && !sofort) return;
    letzterSchluessel = schluessel;

    if (!band.hidden && letzterText && !sofort) wartend = { teile, quellen, zeile };
    else uebernimm(teile, quellen, zeile);
  }
  if (band.hidden) { band.hidden = false; document.body.classList.add('mit-laufband'); }
}

function uebernimm(teile: LaufbandTeil[][], quellen: string, zeile: string): void {
  wartend = null;
  const band = $('tb-laufband'), text = $('tb-laufband-text'), kopie = $('tb-laufband-kopie');
  if (!band || !text || !kopie) return;
  setzeTeile(text, teile, quellen);
  setzeTeile(kopie, teile, quellen);

  if (zeile.length !== letzterText.length) {
    const setze = () => band.style.setProperty('--laufband-dauer', `${Math.max(20, text.scrollWidth / PX_JE_S)}s`);

    if (text.scrollWidth > 0) setze(); else requestAnimationFrame(setze);
  }
  letzterText = zeile;
}
