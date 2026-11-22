import { naeherungen, vorschlagsZiele, schiffstyp, AIS_ALTER_ZEIGEN_AB_S, type AisNaeherung } from '@/core/ais';
import { holeAisZiele } from '@/data/ais';
import { kursRw, nf } from '@/core/time';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import type { AisAngabe, LogEintrag } from '@/data/logdb';
import { STRINGS } from './strings';
import { aisEintragText, warnungText, zielName } from './aistext';
import { istOnline, meldeErfolg, meldeFehlschlag } from './netz';
import { setzeAisZiele, leereAisZiele, type AisMarke } from './karte';
import { sirene, stoppeSirene } from './ton';

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;

const SCHALTER_KEY = 'sail-suite:ais-an';

const RADIUS_NM = 3;

const TAKT_MS = 30_000;

const EMPFANG_VERALTET_MS = 3 * TAKT_MS;

const FEHLER_RUHE_MS = 5 * 60_000;

const RUHE_NACH_QUITTUNG_MS = 10 * 60_000;

const LISTE_MAX = 15;
const KARTE_MAX = 40;

interface Lage {
  lat: number;
  lon: number;
  sog: number;
  cog: number;
}

let holeLage: (() => Lage | null) | null = null;
let aufEintrag: ((e: LogEintrag) => void) | null = null;
let fahrtJetzt: (() => string | null) | null = null;

let letzteZiele: AisNaeherung[] = [];
let letzterAbruf = 0;
let ruheBis = 0;
let laeuftAbruf = false;
let verbunden = false;

let ruht = false;

const quittiert = new Map<number, number>();
let offeneWarnung: AisNaeherung | null = null;

interface Empfang { t: number; lage: Lage }
let letzterEmpfang: Empfang | null = null;
let warnEmpfang: Empfang | null = null;
let listeModal: ModalHandle | null = null;
let warnModal: ModalHandle | null = null;

export function aisAn(): boolean {
  try {
    return localStorage.getItem(SCHALTER_KEY) === '1';
  } catch {
    return false;
  }
}

export function setzeAisAn(an: boolean): void {
  try {
    localStorage.setItem(SCHALTER_KEY, an ? '1' : '0');
  } catch {  }
  if (!an) {
    letzteZiele = [];
    leereAisZiele();
    schliesseWarnung();
  }
  zeichneZustand();
}

export function pruefeAis(): void {
  if (!aisAn() || laeuftAbruf) return;
  verwerfeVeraltete();
  if (ruht) { ruht = false; zeichneZustand(); }
  const jetzt = Date.now();
  if (jetzt < ruheBis || jetzt - letzterAbruf < TAKT_MS) return;
  rufeAb(true);
}

function verwerfeVeraltete(): void {
  if (!letzteZiele.length || !letzterEmpfang || Date.now() - letzterEmpfang.t <= EMPFANG_VERALTET_MS) return;
  letzteZiele = [];
  leereAisZiele();
  zeichneListe();
  zeichneZustand();
}

function holeVonHand(): void {
  if (!aisAn() || laeuftAbruf) return;
  if (!ruht) {
    letzterAbruf = 0;
    ruheBis = 0;
    pruefeAis();
    return;
  }
  rufeAb(false);
}

function rufeAb(mitWache: boolean): void {
  const jetzt = Date.now();

  if (!istOnline()) { zeichneZustand(); return; }
  const lage = holeLage?.();
  if (!lage) return;

  laeuftAbruf = true;
  letzterAbruf = jetzt;
  void (async () => {
    try {
      const antwort = await holeAisZiele(lage.lat, lage.lon, RADIUS_NM);
      if (!antwort) {
        meldeFehlschlag();
        ruheBis = Date.now() + FEHLER_RUHE_MS;
        verbunden = false;
        zeichneZustand();
        return;
      }
      meldeErfolg();
      verbunden = antwort.verbunden;
      letzteZiele = naeherungen(lage, antwort.ziele, RADIUS_NM);
      letzterEmpfang = { t: jetzt, lage };
      zeichneListe();
      zeichneKarte();
      zeichneZustand();
      if (mitWache) pruefeKollision();
    } finally {
      laeuftAbruf = false;
    }
  })();
}

export function aisRuhtLiegend(): void {
  if (ruht) return;
  ruht = true;
  letzteZiele = [];
  leereAisZiele();
  schliesseWarnung();
  zeichneListe();
  zeichneZustand();
}

function pruefeKollision(): void {
  if (!aisAn() || offeneWarnung) return;
  const jetzt = Date.now();
  const kandidat = letzteZiele.find((n) => {
    if (n.stufe !== 'eng') return false;
    const ruhe = quittiert.get(n.ziel.mmsi);
    return !ruhe || jetzt > ruhe;
  });
  if (!kandidat) return;
  zeigeWarnung(kandidat);
}

function zeigeWarnung(n: AisNaeherung): void {
  offeneWarnung = n;
  warnEmpfang = letzterEmpfang;
  const el = $('tb-ais-warnung');
  const text = $('tb-ais-warnung-text');
  if (text) text.textContent = warnungText(n, aktuelleSprache());
  el?.removeAttribute('hidden');
  warnModal?.beimOeffnen();
  sirene();
}

function schliesseWarnung(quittiere = false): void {
  stoppeSirene();
  if (quittiere && offeneWarnung) {
    quittiert.set(offeneWarnung.ziel.mmsi, Date.now() + RUHE_NACH_QUITTUNG_MS);
  }
  offeneWarnung = null;
  warnEmpfang = null;
  $('tb-ais-warnung')?.setAttribute('hidden', '');
  warnModal?.beimSchliessen();
}

function zeichneZustand(): void {
  const zeile = $('tb-ais-zustand');
  if (!zeile) return;
  if (!aisAn()) { zeile.hidden = true; return; }
  zeile.hidden = false;
  if (ruht) { zeile.textContent = wort('ais.zustandRuht'); return; }
  if (!istOnline()) { zeile.textContent = wort('ais.zustandOffline'); return; }
  if (!verbunden && letzterAbruf > 0) { zeile.textContent = wort('ais.zustandKeinRelais'); return; }
  if (letzterAbruf === 0) { zeile.textContent = wort('ais.zustandWartet'); return; }
  zeile.textContent = wort('ais.zustandZiele').replace('{n}', String(letzteZiele.length));
}

function zeichneKarte(): void {
  const sprache = aktuelleSprache();
  setzeAisZiele(letzteZiele.slice(0, KARTE_MAX).map((n) => {
    const marke: AisMarke = {
      lat: n.ziel.lat, lon: n.ziel.lon, text: zielName(n, sprache), stufe: n.stufe,
    };
    if (n.ziel.cog !== undefined) marke.cog = n.ziel.cog;
    return marke;
  }));
}

function zeichneListe(): void {
  const liste = $('tb-ais-liste');
  if (!liste) return;
  liste.innerHTML = '';
  const sprache = aktuelleSprache();
  const en = sprache === 'en';

  if (letzteZiele.length === 0) {
    const p = document.createElement('p');
    p.className = 'tb-hinweis';

    if (letzterAbruf === 0) p.textContent = wort('ais.zustandWartet');
    else if (!verbunden) p.textContent = wort('ais.zustandKeinRelais');
    else p.textContent = wort('ais.keineZiele');
    liste.appendChild(p);
    return;
  }

  const gezeigt = letzteZiele.slice(0, LISTE_MAX);
  for (const n of gezeigt) {
    const zeile = document.createElement('button');
    zeile.type = 'button';

    zeile.className = `btn tb-gross tb-ais-zeile tb-ais-${n.stufe}`;

    const kopf = document.createElement('div');
    kopf.className = 'tb-ais-name';
    const typ = schiffstyp(n.ziel.typ, sprache);
    kopf.textContent = typ ? `${zielName(n, sprache)} · ${typ}` : zielName(n, sprache);

    const zahlen = document.createElement('div');
    zahlen.className = 'tb-ais-zahlen';
    const smEinheit = en ? 'NM' : 'sm';
    const teile = [`${nf(n.abstandNM, 1, sprache)} ${smEinheit}`,
      kursRw(n.peilung, aktuelleSprache())];
    if (n.ziel.sog !== undefined) teile.push(`${nf(n.ziel.sog, 1, sprache)} kn`);

    if (n.alterS !== undefined && n.alterS >= AIS_ALTER_ZEIGEN_AB_S) {
      teile.push(wort('ais.alter').replace('{min}', String(Math.floor(n.alterS / 60))));
    }
    if (n.cpaNM !== null && n.tcpaMin !== null && n.tcpaMin >= 0) {
      teile.push(en
        ? `CPA ${nf(n.cpaNM, 1, sprache)} ${smEinheit} / ${Math.round(n.tcpaMin)} min`
        : `CPA ${nf(n.cpaNM, 1, sprache)} ${smEinheit} in ${Math.round(n.tcpaMin)} min`);
    }
    zahlen.textContent = teile.join(' · ');

    zeile.append(kopf, zahlen);
    zeile.addEventListener('click', () => uebernimm(n));
    liste.appendChild(zeile);
  }

  if (letzteZiele.length > gezeigt.length) {
    const p = document.createElement('p');
    p.className = 'tb-hinweis';
    p.textContent = wort('ais.weitere')
      .replace('{n}', String(letzteZiele.length - gezeigt.length));
    liste.appendChild(p);
  }
}

function baueAngabe(n: AisNaeherung): AisAngabe {
  const a: AisAngabe = { quelle: 'ais', mmsi: n.ziel.mmsi, gemeldet: n.ziel.gemeldet };
  if (n.ziel.name) a.name = n.ziel.name;
  if (n.ziel.typ !== undefined) a.typ = n.ziel.typ;
  if (n.ziel.ziel) a.ziel = n.ziel.ziel;
  if (n.ziel.sog !== undefined) a.sogKn = n.ziel.sog;
  if (n.ziel.cog !== undefined) a.cog = n.ziel.cog;
  a.abstandNM = n.abstandNM;
  a.peilung = n.peilung;
  if (n.cpaNM !== null) a.cpaNM = n.cpaNM;
  if (n.tcpaMin !== null) a.tcpaMin = n.tcpaMin;
  return a;
}

function uebernimm(n: AisNaeherung, empfang: Empfang | null = letzterEmpfang): void {
  const fahrt = fahrtJetzt?.();
  const lage = empfang?.lage ?? holeLage?.();
  if (!fahrt) return;
  aufEintrag?.({
    fahrt,
    t: empfang?.t ?? Date.now(),
    art: 'ais',
    lat: lage?.lat ?? null,
    lon: lage?.lon ?? null,
    text: aisEintragText(n, aktuelleSprache()),
    ais: baueAngabe(n),
  });
  const status = $('tb-ais-status');
  if (status) status.textContent = wort('ais.uebernommen').replace('{s}', zielName(n, aktuelleSprache()));
}

function uebernimmVorschlag(): void {
  const ziele = vorschlagsZiele(letzteZiele);
  for (const n of ziele) uebernimm(n);
  const status = $('tb-ais-status');
  if (status && ziele.length > 1) {
    status.textContent = wort('ais.uebernommenMehrere').replace('{n}', String(ziele.length));
  }
}

export function initAis(
  lage: () => Lage | null,
  fahrt: () => string | null,
  eintragen: (e: LogEintrag) => void,
): void {
  holeLage = lage;
  fahrtJetzt = fahrt;
  aufEintrag = eintragen;

  const listeEl = $('tb-ais-modal');
  const schliesseListe = (): void => {
    listeEl?.setAttribute('hidden', '');
    listeModal?.beimSchliessen();

    if (ruht) { letzteZiele = []; leereAisZiele(); }
  };
  if (listeEl) listeModal = initModal(listeEl, schliesseListe);

  const warnEl = $('tb-ais-warnung');
  if (warnEl) warnModal = initModal(warnEl, () => schliesseWarnung(true));

  $('btn-ais-zeile')?.addEventListener('click', () => {
    listeEl?.removeAttribute('hidden');
    listeModal?.beimOeffnen();
    const status = $('tb-ais-status');
    if (status) status.textContent = '';
    if (!aisAn()) {
      zeichneListeAus();
      return;
    }
    zeichneListe();
    if (ruht && status) status.textContent = wort('ais.vonHandRuht');
    holeVonHand();
  });
  $('btn-ais-weg')?.addEventListener('click', schliesseListe);
  $('btn-ais-vorschlag')?.addEventListener('click', uebernimmVorschlag);

  $('btn-ais-warnung-weg')?.addEventListener('click', () => schliesseWarnung(true));

  $('btn-ais-warnung-log')?.addEventListener('click', () => {
    if (offeneWarnung) uebernimm(offeneWarnung, warnEmpfang);
    schliesseWarnung(true);
  });

  const schalter = $('in-ais-an') as HTMLInputElement | null;
  if (schalter) {
    schalter.checked = aisAn();
    schalter.addEventListener('change', () => {
      setzeAisAn(schalter.checked);
      if (schalter.checked) { letzterAbruf = 0; ruheBis = 0; pruefeAis(); }
      const listeOffen = listeEl && !listeEl.hasAttribute('hidden');
      if (listeOffen) { if (schalter.checked) zeichneListe(); else zeichneListeAus(); }
    });
  }

  zeichneZustand();
}

function zeichneListeAus(): void {
  const liste = $('tb-ais-liste');
  if (!liste) return;
  liste.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'tb-hinweis';
  p.textContent = wort('ais.ausgeschaltet');
  liste.appendChild(p);
}

export function aisNeuZeichnen(): void {
  zeichneZustand();
  if ($('tb-ais-modal') && !$('tb-ais-modal')!.hasAttribute('hidden')) {
    if (aisAn()) zeichneListe(); else zeichneListeAus();
  }
}
