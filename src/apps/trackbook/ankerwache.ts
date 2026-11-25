import { nf } from '@/core/time';
import { ankerkette } from '@/core/tiefe';
import type { Fix } from '@/core/spur';
import {
  pruefePosition, bewerteFolge, sollWeiterleiten, ohnePositionSeit, istNeuerFix, fixAlterSek,
  genauigkeitZeigen, schwojSpur, type AnkerwacheBefund, type AnkerwacheStufe, type WeiterleitungsMeldung,
} from '@/core/ankerwache';
import type { LogEintrag } from '@/data/logdb';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import {
  holeNotfallkontakt, schreibeNotfallkontakt, sendeNotfallkontaktBestaetigung, sendeAnkeralarm, type AnkeralarmFelder,
} from '@/data/toernApi';
import { aktuelleSprache } from '@/shell/sprache';
import { liesSitzungsToken } from '@/shell/session';
import { icon } from '@/shell/icons';
import { initModal, type ModalHandle } from '@/shell/modal';
import { STRINGS } from './strings';
import { ankersirene, stoppeAnkersirene, warnton } from './ton';
import { zeichneAnkerkreis, entferneAnkerkreis, setzeAnkerAenderung, zeichneSchwojspur } from './karte';
import { ankerwacheEintragText, ankerwacheAlarmText } from './ankerwachetext';
import type { Zustand } from './aufzeichnung';

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;

const STANDARD_RADIUS_M = 30;

const ALARM_WIEDERHOLUNG_MS = 5 * 60_000;

const BEFUNDE_MAX = 20;

let holePosition: () => { lat: number; lon: number } | null = () => null;
let aktiviereFn: (ziel: { lat: number; lon: number; radiusM: number }) => Promise<void> = async () => {};
let fahrtJetzt: () => string | null = () => null;
let aufEintrag: (e: LogEintrag) => void = () => {};

let holeSchiffLaenge: () => number | undefined = () => undefined;

let hebeAnkerwacheAufFn: () => Promise<void> = async () => {};

let anfangsPosition: { lat: number; lon: number } | null = null;
let pending: { lat: number; lon: number; radiusM: number } | null = null;
let phase: 'aus' | 'einrichten' | 'aktiv' = 'aus';

let gezeichnetesZiel: { lat: number; lon: number; radiusM: number } | null = null;

let befunde: AnkerwacheBefund[] = [];

let gewerteterFixT: number | null = null;

let aktivSeit: number | null = null;

let ohnePositionGemeldet: number | null = null;
let stufe: AnkerwacheStufe = 'ruhig';
let alarmOffen = false;
let letzteAlarmMeldung = 0;

let notfallkontakt: { email: string; aktiv: boolean; bestaetigt: boolean | null } = { email: '', aktiv: false, bestaetigt: null };

let kontaktLinkSeit: number | null = null;

let kontaktVersandFehler = false;

const ERNEUT_SENDEN_NACH_MS = 15 * 60_000;

let letzteWeiterleitungsMeldung: WeiterleitungsMeldung | null = ladeDrossel();

function ladeDrossel(): WeiterleitungsMeldung | null {
  try {
    const m = JSON.parse(localStorage.getItem(SCHLUESSEL.ankerDrossel) ?? 'null') as WeiterleitungsMeldung | null;
    return m && Number.isFinite(m.abstandM) && Number.isFinite(m.zeitpunkt) ? m : null;
  } catch { return null; }
}

function setzeDrossel(m: WeiterleitungsMeldung | null): void {
  letzteWeiterleitungsMeldung = m;
  try {
    if (m) localStorage.setItem(SCHLUESSEL.ankerDrossel, JSON.stringify(m));
    else localStorage.removeItem(SCHLUESSEL.ankerDrossel);
  } catch {  }
}

let einrichtungsKontext: 'neu' | 'bearbeiten' = 'neu';

let setupModal: ModalHandle | null = null;
let alarmModal: ModalHandle | null = null;

function zahl(id: string): number | undefined {
  const el = $(id) as HTMLInputElement | null;
  const v = el?.value.trim() ?? '';
  const n = Number(v.replace(',', '.'));
  return v && Number.isFinite(n) ? n : undefined;
}

function schliesseSetup(): void {
  $('tb-anker-setup-modal')?.setAttribute('hidden', '');
  setupModal?.beimSchliessen();
}

export function oeffneAnkerwacheSetup(): void {
  const pos = holePosition();
  if (!pos) return;
  anfangsPosition = pos;
  einrichtungsKontext = phase === 'aktiv' ? 'bearbeiten' : 'neu';

  for (const el of document.querySelectorAll<HTMLElement>('.tb-anker-nur-neu')) {
    el.hidden = einrichtungsKontext === 'bearbeiten';
  }

  for (const el of document.querySelectorAll<HTMLElement>('.tb-anker-nur-bearbeiten')) {
    el.hidden = einrichtungsKontext !== 'bearbeiten';
  }
  const weiterKnopf = $('btn-anker-weiter');
  if (weiterKnopf) {
    weiterKnopf.textContent = wort(
      einrichtungsKontext === 'bearbeiten' ? 'ankerwache.kontaktSpeichern' : 'ankerwache.weiter',
    );
  }

  if (einrichtungsKontext === 'neu') {
    const tiefeFeld = $('in-anker-tiefe') as HTMLInputElement | null;
    if (tiefeFeld) tiefeFeld.value = '';

    const laengeFeld = $('in-anker-laenge') as HTMLInputElement | null;
    if (laengeFeld) {
      const laenge = holeSchiffLaenge();
      laengeFeld.value = laenge != null ? String(laenge) : '';
    }
    const radiusFeld = $('in-anker-radius') as HTMLInputElement | null;
    if (radiusFeld) radiusFeld.value = String(STANDARD_RADIUS_M);
    const vorschlagZeile = $('tb-anker-vorschlag-text');
    if (vorschlagZeile) vorschlagZeile.textContent = '';
  }
  fuelleKontaktFelder();
  $('tb-anker-setup-modal')?.removeAttribute('hidden');
  setupModal?.beimOeffnen();
}

async function ladeNotfallkontakt(): Promise<void> {
  const token = liesSitzungsToken();
  if (!token) return;
  const daten = await holeNotfallkontakt(token);
  if (daten) {
    notfallkontakt = { email: daten.email ?? '', aktiv: daten.aktiv, bestaetigt: daten.bestaetigt ?? null };
    const seit = daten.linkGesendetAm ? Date.parse(daten.linkGesendetAm) : NaN;
    kontaktLinkSeit = Number.isFinite(seit) ? seit : null;
    if (kontaktLinkSeit !== null || daten.bestaetigt) kontaktVersandFehler = false;
  }
  renderWeiterleitungsKnopf();
  zeigeKontaktStatus();
}

function zeigeKontaktStatus(): void {
  const el = $('tb-anker-kontakt-status');
  const erneut = $('btn-anker-kontakt-erneut') as HTMLButtonElement | null;
  if (!el) return;
  const feld = ($('in-anker-kontakt-email') as HTMLInputElement | null)?.value.trim() ?? notfallkontakt.email;
  const gespeichert = notfallkontakt.email.trim();
  if (!gespeichert || notfallkontakt.bestaetigt === null || feld.toLowerCase() !== gespeichert.toLowerCase()) {
    el.hidden = true;
    if (erneut) erneut.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = notfallkontakt.bestaetigt ? wort('ankerwache.kontaktBestaetigt')
    : kontaktVersandFehler ? wort('ankerwache.kontaktVersandFehler')
      : kontaktLinkSeit !== null ? wort('ankerwache.kontaktAusstehend').replace('{email}', gespeichert)
        : wort('ankerwache.kontaktOhneLink').replace('{email}', gespeichert);
  if (erneut) {
    erneut.hidden = notfallkontakt.bestaetigt === true
      || (!kontaktVersandFehler && kontaktLinkSeit !== null && Date.now() - kontaktLinkSeit < ERNEUT_SENDEN_NACH_MS);
  }
}

async function sendeBestaetigungErneut(): Promise<void> {
  const token = liesSitzungsToken();
  const knopf = $('btn-anker-kontakt-erneut') as HTMLButtonElement | null;
  if (!token || !knopf) return;
  knopf.disabled = true;
  const ergebnis = await sendeNotfallkontaktBestaetigung(token);
  knopf.disabled = false;
  kontaktVersandFehler = ergebnis === 'fehlgeschlagen';
  await ladeNotfallkontakt();
  zeigeKontaktStatus();
}

function fuelleKontaktFelder(): void {
  const emailFeld = $('in-anker-kontakt-email') as HTMLInputElement | null;
  if (emailFeld) emailFeld.value = notfallkontakt.email;
  const aktivFeld = $('in-anker-kontakt-aktiv') as HTMLInputElement | null;
  if (aktivFeld) {
    aktivFeld.checked = notfallkontakt.aktiv;
    aktivFeld.disabled = notfallkontakt.email.trim() === '';
  }
  zeigeKontaktStatus();
}

async function speichereKontaktAusSetup(): Promise<void> {
  const token = liesSitzungsToken();
  if (!token) return;
  const emailFeld = $('in-anker-kontakt-email') as HTMLInputElement | null;
  const aktivFeld = $('in-anker-kontakt-aktiv') as HTMLInputElement | null;
  const email = emailFeld?.value.trim() ?? '';
  const aktiv = (aktivFeld?.checked ?? false) && email !== '';
  const gleich = email.toLowerCase() === notfallkontakt.email.trim().toLowerCase();

  notfallkontakt = { email, aktiv, bestaetigt: gleich ? notfallkontakt.bestaetigt : (email ? false : null) };
  if (!gleich) { kontaktVersandFehler = false; kontaktLinkSeit = null; }
  renderWeiterleitungsKnopf();
  const { ok, bestaetigungGesendet } = await schreibeNotfallkontakt(token, email || null, aktiv);

  if (bestaetigungGesendet !== null) kontaktVersandFehler = !bestaetigungGesendet;

  if (ok) await ladeNotfallkontakt();
  else zeigeKontaktStatus();
}

async function toggleWeiterleitung(): Promise<void> {
  const token = liesSitzungsToken();
  if (!token) { zeigeWeiterleitungsErgebnis('nicht-angemeldet'); return; }
  if (!notfallkontakt.email) { oeffneAnkerwacheSetup(); return; }

  const neu = !notfallkontakt.aktiv;
  const vorher = notfallkontakt;
  notfallkontakt = { ...notfallkontakt, aktiv: neu };
  renderWeiterleitungsKnopf();
  const { ok } = await schreibeNotfallkontakt(token, notfallkontakt.email, neu);
  if (!ok) {

    notfallkontakt = vorher;
    renderWeiterleitungsKnopf();
  }
}

function berechneVorschlag(): void {
  const tiefe = zahl('in-anker-tiefe');
  if (tiefe == null) return;
  const verhaeltnisFeld = $('in-anker-verhaeltnis') as HTMLSelectElement | null;
  const verhaeltnis = Number(verhaeltnisFeld?.value ?? '5');
  const laenge = zahl('in-anker-laenge');
  const r = ankerkette(tiefe, { verhaeltnis, ...(laenge != null ? { laengeM: laenge } : {}) });
  const radiusFeld = $('in-anker-radius') as HTMLInputElement | null;
  if (radiusFeld) radiusFeld.value = String(Math.round(r.schwojkreisM));
  const vorschlagZeile = $('tb-anker-vorschlag-text');
  if (vorschlagZeile) {
    const de = aktuelleSprache() === 'de';
    vorschlagZeile.textContent = wort('ankerwache.vorschlagZeile')
      .replace('{kette}', nf(r.ketteM, 0, de ? 'de' : 'en'))
      .replace('{radius}', nf(r.schwojkreisM, 0, de ? 'de' : 'en'));
  }
}

function aktualisiereAktionsleiste(): void {
  const leiste = $('tb-anker-radius-zeile');
  if (!leiste || !pending) return;
  const de = aktuelleSprache() === 'de';
  leiste.textContent = wort('ankerwache.radiusZeile').replace('{radius}', nf(pending.radiusM, 0, de ? 'de' : 'en'));
}

function starteZeichnen(radiusM: number): void {
  if (!anfangsPosition) return;
  pending = { lat: anfangsPosition.lat, lon: anfangsPosition.lon, radiusM };
  phase = 'einrichten';
  zeichneAnkerkreis(anfangsPosition.lat, anfangsPosition.lon, radiusM);
  registriereZiehen();
  aktualisiereAktionsleiste();
  $('tb-anker-aktionen')?.removeAttribute('hidden');
}

function registriereZiehen(): void {
  setzeAnkerAenderung((lat, lon, radiusM) => {
    pending = { lat, lon, radiusM };
    if (phase === 'aktiv') void aktiviereFn(pending);
    else aktualisiereAktionsleiste();
  });
}

function loeseAlarm(befund: AnkerwacheBefund, lat: number, lon: number): void {
  alarmOffen = true;
  letzteAlarmMeldung = Date.now();
  const text = $('tb-anker-alarm-text');
  if (text) text.textContent = ankerwacheAlarmText(befund, aktuelleSprache());
  $('tb-anker-alarm-modal')?.removeAttribute('hidden');
  alarmModal?.beimOeffnen();
  ankersirene();

  const fahrt = fahrtJetzt();
  if (fahrt && gezeichnetesZiel) {
    aufEintrag({
      fahrt, t: Date.now(), art: 'ankerwache', lat, lon,
      text: ankerwacheEintragText(befund, aktuelleSprache()),
      ankerwache: { abstandM: befund.abstandM, peilung: befund.peilung, radiusM: gezeichnetesZiel.radiusM },
    });
  }

  versucheWeiterleitung(befund, lat, lon);
}

function schliesseAlarm(): void {
  alarmOffen = false;
  stoppeAnkersirene();
  $('tb-anker-alarm-modal')?.setAttribute('hidden', '');
  alarmModal?.beimSchliessen();
}

type WeiterleitungsStatus = 'sendet' | 'gesendet' | 'fehlgeschlagen' | 'unbestaetigt' | 'inaktiv' | 'nicht-angemeldet';

function zeigeWeiterleitungsErgebnis(status: WeiterleitungsStatus): void {
  const el = $('tb-anker-weiterleitung-ergebnis') as HTMLElement | null;
  if (!el) return;

  if (status === 'inaktiv') { el.hidden = true; return; }
  el.hidden = false;
  const schluessel: Record<Exclude<WeiterleitungsStatus, 'inaktiv'>, string> = {
    sendet: 'ankerwache.weiterleitungSendet',
    gesendet: 'ankerwache.weiterleitungGesendet',
    fehlgeschlagen: 'ankerwache.weiterleitungFehlgeschlagen',
    unbestaetigt: 'ankerwache.weiterleitungUnbestaetigt',
    'nicht-angemeldet': 'ankerwache.weiterleitungNichtAngemeldet',
  };
  el.textContent = wort(schluessel[status]);
}

function versucheWeiterleitung(befund: AnkerwacheBefund, lat: number, lon: number): void {
  const token = liesSitzungsToken();
  if (!token) { zeigeWeiterleitungsErgebnis('nicht-angemeldet'); return; }
  if (!notfallkontakt.aktiv || !notfallkontakt.email || !gezeichnetesZiel) {
    zeigeWeiterleitungsErgebnis('inaktiv');
    return;
  }
  if (!sollWeiterleiten(befund.abstandM, letzteWeiterleitungsMeldung, Date.now())) return;

  setzeDrossel({ abstandM: befund.abstandM, zeitpunkt: Date.now() });
  zeigeWeiterleitungsErgebnis('sendet');
  const felder: AnkeralarmFelder = {
    abstandM: befund.abstandM, radiusM: gezeichnetesZiel.radiusM, peilungGrad: befund.peilung,
    lat, lon, zeitpunkt: new Date().toISOString(), sprache: aktuelleSprache(),
  };
  void sendeAnkeralarm(token, felder).then((ergebnis) => {
    zeigeWeiterleitungsErgebnis(ergebnis);
    if (ergebnis === 'unbestaetigt') { notfallkontakt = { ...notfallkontakt, bestaetigt: false }; renderWeiterleitungsKnopf(); }
  });
}

function renderWeiterleitungsKnopf(): void {
  const knopf = $('btn-anker-weiterleitung-toggle') as HTMLButtonElement | null;
  if (!knopf) return;
  if (!liesSitzungsToken()) {
    knopf.innerHTML = icon('brief') + `<span>${wort('ankerwache.weiterleitungNichtAngemeldet')}</span>`;
    knopf.disabled = true;
    return;
  }
  knopf.disabled = false;
  if (!notfallkontakt.email) {
    knopf.innerHTML = icon('brief') + `<span>${wort('ankerwache.weiterleitungEinrichten')}</span>`;
    knopf.classList.remove('aktiv');
    return;
  }

  const schluessel = !notfallkontakt.aktiv ? 'ankerwache.weiterleitungAus'
    : notfallkontakt.bestaetigt === false ? 'ankerwache.weiterleitungAusstehend' : 'ankerwache.weiterleitungEin';
  knopf.innerHTML = icon('brief') + `<span>${wort(schluessel)}</span>`;
  knopf.classList.toggle('aktiv', notfallkontakt.aktiv);
}

function zeigeOhnePosition(z: Zustand, seit: number): void {
  const textEl = $('tb-ankerwache-status-text');
  if (!textEl || !z.ankerwache) return;
  const min = Math.max(1, Math.floor((Date.now() - seit) / 60_000));
  textEl.textContent = wort('ankerwache.statusOhneFix')
    .replace('{min}', String(min))
    .replace('{radius}', nf(z.ankerwache.radiusM, 0, aktuelleSprache()));
}

function zeigeStatus(z: Zustand, letzterFixT: number | null = null): void {
  const el = $('tb-ankerwache-status') as HTMLElement | null;
  const textEl = $('tb-ankerwache-status-text');
  if (!el) return;
  if (z.betriebsart !== 'pausiert-anker' || !z.ankerwache) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const de = aktuelleSprache() === 'de';
  const letzter = befunde[befunde.length - 1];
  if (textEl) {
    const gps = letzter && genauigkeitZeigen(letzter, z.ankerwache.radiusM)
      ? ' ' + wort('ankerwache.genauigkeit').replace('{acc}', nf(letzter.genauigkeitM ?? 0, 0, de ? 'de' : 'en')) : '';

    const alter = fixAlterSek(Date.now(), letzterFixT);
    const alt = alter !== null ? ' ' + wort('ankerwache.fixAlter').replace('{s}', String(alter)) : '';
    textEl.textContent = letzter
      ? wort('ankerwache.statusZeile')
        .replace('{abstand}', nf(letzter.abstandM, 0, de ? 'de' : 'en'))
        .replace('{radius}', nf(z.ankerwache.radiusM, 0, de ? 'de' : 'en')) + gps + alt
      : wort('ankerwache.statusOhnePosition').replace('{radius}', nf(z.ankerwache.radiusM, 0, de ? 'de' : 'en'));
  }
  renderWeiterleitungsKnopf();
}

let schwojGezeichnet = 0;

export function pruefeAnkerwache(z: Zustand, letzterFix: Fix | undefined, fixe: readonly Fix[] = []): void {
  zeigeStatus(z, letzterFix?.t ?? null);

  if (z.betriebsart !== 'pausiert-anker' || !z.ankerwache) {

    if (phase === 'aktiv' && gezeichnetesZiel) {
      phase = 'aus';
      pending = null;
      gezeichnetesZiel = null;
      entferneAnkerkreis();
      $('tb-anker-aktionen')?.setAttribute('hidden', '');
    }
    if (befunde.length || stufe !== 'ruhig' || alarmOffen) {
      befunde = [];
      stufe = 'ruhig';
      setzeDrossel(null);
      schliesseAlarm();
    }
    gewerteterFixT = null;
    aktivSeit = null;
    ohnePositionGemeldet = null;
    return;
  }

  const ziel = z.ankerwache;
  if (!gezeichnetesZiel || gezeichnetesZiel.lat !== ziel.lat || gezeichnetesZiel.lon !== ziel.lon
      || gezeichnetesZiel.radiusM !== ziel.radiusM) {

    zeichneAnkerkreis(ziel.lat, ziel.lon, ziel.radiusM);
    registriereZiehen();
    $('tb-anker-aktionen')?.setAttribute('hidden', '');
    gezeichnetesZiel = ziel;
    schwojGezeichnet = 0;
  }
  phase = 'aktiv';
  aktivSeit ??= Date.now();

  if (Date.now() - schwojGezeichnet > 30_000) {
    schwojGezeichnet = Date.now();
    zeichneSchwojspur(schwojSpur(fixe, ziel, Date.now()));
  }

  const ohne = ohnePositionSeit(Date.now(), letzterFix?.t ?? null, aktivSeit);
  if (ohne !== null) {
    if (ohnePositionGemeldet === null || Date.now() - ohnePositionGemeldet > ALARM_WIEDERHOLUNG_MS) {
      ohnePositionGemeldet = Date.now();
      warnton();
    }
    zeigeOhnePosition(z, ohne);
  } else {
    ohnePositionGemeldet = null;
  }

  if (!letzterFix) return;

  if (!istNeuerFix(letzterFix.t, gewerteterFixT)) {
    if (stufe === 'alarm' && !alarmOffen && Date.now() - letzteAlarmMeldung > ALARM_WIEDERHOLUNG_MS) {
      const b = befunde[befunde.length - 1];
      if (b) loeseAlarm(b, letzterFix.lat, letzterFix.lon);
    }
    return;
  }
  gewerteterFixT = letzterFix.t;
  const befund = pruefePosition(ziel, letzterFix.lat, letzterFix.lon, letzterFix.acc);
  befunde.push(befund);
  if (befunde.length > BEFUNDE_MAX) befunde = befunde.slice(-BEFUNDE_MAX);

  const neu = bewerteFolge(befunde, stufe);
  if (neu === 'alarm' && stufe === 'ruhig') {
    stufe = 'alarm';
    loeseAlarm(befund, letzterFix.lat, letzterFix.lon);
  } else if (neu === 'ruhig' && stufe === 'alarm') {
    stufe = 'ruhig';

    setzeDrossel(null);
    if (alarmOffen) schliesseAlarm();
  } else if (stufe === 'alarm' && !alarmOffen && Date.now() - letzteAlarmMeldung > ALARM_WIEDERHOLUNG_MS) {

    loeseAlarm(befund, letzterFix.lat, letzterFix.lon);
  }
}

export function initAnkerwache(
  position: () => { lat: number; lon: number } | null,
  aktiviere: (ziel: { lat: number; lon: number; radiusM: number }) => Promise<void>,
  fahrt: () => string | null,
  eintragen: (e: LogEintrag) => void,
  schiffLaenge: () => number | undefined,
  hebeAuf: () => Promise<void>,
): void {
  holePosition = position;
  aktiviereFn = aktiviere;
  fahrtJetzt = fahrt;
  aufEintrag = eintragen;
  holeSchiffLaenge = schiffLaenge;
  hebeAnkerwacheAufFn = hebeAuf;

  const setupEl = $('tb-anker-setup-modal');
  if (setupEl) setupModal = initModal(setupEl, schliesseSetup);
  const alarmEl = $('tb-anker-alarm-modal');
  if (alarmEl) alarmModal = initModal(alarmEl, schliesseAlarm);

  $('btn-anker-vorschlag')?.addEventListener('click', berechneVorschlag);
  $('btn-anker-setup-weg')?.addEventListener('click', schliesseSetup);

  $('btn-anker-beenden')?.addEventListener('click', () => {
    if (!confirm(wort('ankerwache.aufhebenFrage'))) return;
    schliesseSetup();
    void hebeAnkerwacheAufFn();
  });
  $('btn-anker-weiter')?.addEventListener('click', () => {
    void (async () => {
      await speichereKontaktAusSetup();

      if (einrichtungsKontext === 'bearbeiten') {
        schliesseSetup();
        return;
      }
      const radius = zahl('in-anker-radius') ?? STANDARD_RADIUS_M;
      schliesseSetup();
      starteZeichnen(radius);
    })();
  });

  const kontaktEmailFeld = $('in-anker-kontakt-email') as HTMLInputElement | null;
  const kontaktAktivFeld = $('in-anker-kontakt-aktiv') as HTMLInputElement | null;
  kontaktEmailFeld?.addEventListener('input', () => {
    const leer = kontaktEmailFeld.value.trim() === '';
    if (kontaktAktivFeld) {
      kontaktAktivFeld.disabled = leer;
      if (leer) kontaktAktivFeld.checked = false;
    }
    zeigeKontaktStatus();
  });

  $('btn-anker-aktivieren')?.addEventListener('click', () => {
    if (!pending) return;
    phase = 'aktiv';
    void aktiviereFn(pending);
    $('tb-anker-aktionen')?.setAttribute('hidden', '');
  });
  $('btn-anker-abbrechen')?.addEventListener('click', () => {
    phase = 'aus';
    pending = null;
    entferneAnkerkreis();
    $('tb-anker-aktionen')?.setAttribute('hidden', '');
  });

  $('btn-anker-alarm-weg')?.addEventListener('click', () => schliesseAlarm());
  $('btn-anker-weiterleitung-toggle')?.addEventListener('click', () => void toggleWeiterleitung());
  $('btn-anker-kontakt-erneut')?.addEventListener('click', () => void sendeBestaetigungErneut());

  void ladeNotfallkontakt();
}
