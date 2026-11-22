import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { nf, uhrLtVon } from '@/core/time';
import type { Punkt } from '@/core/types';
import { richtungAusgeschrieben } from '@/map/wetterbild';
import {
  BLITZ_RADIUS_VORGABE, BLITZ_RADIEN, BLITZ_SCHRITT_MIN, BLITZ_VORAUS_H, BLITZ_VORAUS_MIN_SM, BLITZ_WARN_MIN,
  blitzLage, boxUm, routeVoraus, sollWarnen, type BlitzLage,
} from '@/core/blitze';
import { holeBlitze } from '@/data/blitze';
import type { LogEintrag } from '@/data/logdb';
import { sage } from './ansage';
import { blitzText as blitzAnsage } from '@/core/ansagen';

const PRUEF_MS = BLITZ_SCHRITT_MIN * 60_000;
const FEHLER_PAUSE_MS = 10 * 60_000;

let naechstePruefung = 0;
let laeuft = false;
let modal: ModalHandle | null = null;
const $ = (id: string) => document.getElementById(id);

export function blitzRadius(): number {
  try {
    const v = Number(localStorage.getItem(SCHLUESSEL.blitzRadius));
    return localStorage.getItem(SCHLUESSEL.blitzRadius) !== null && (BLITZ_RADIEN as readonly number[]).includes(v) ? v : BLITZ_RADIUS_VORGABE;
  } catch { return BLITZ_RADIUS_VORGABE; }
}
export function setzeBlitzRadius(sm: number): void {
  try { localStorage.setItem(SCHLUESSEL.blitzRadius, String(sm)); } catch {  }
  naechstePruefung = 0;
}

function zuletzt(): { t: number; sm: number } | null {
  try { return JSON.parse(localStorage.getItem(SCHLUESSEL.blitzGewarnt) ?? 'null') as { t: number; sm: number } | null; } catch { return null; }
}
function merke(t: number, sm: number): void {
  try { localStorage.setItem(SCHLUESSEL.blitzGewarnt, JSON.stringify({ t, sm })); } catch {  }
}

const uhr = (t: number) => uhrLtVon(t);

export function blitzText(l: BlitzLage, en = aktuelleSprache() === 'en'): string {
  const sm = nf(l.sm, l.sm < 10 ? 1 : 0, en ? 'en' : 'de');
  const zeit = uhr(l.t);
  if (l.art === 'yacht') {
    const r = richtungAusgeschrieben(l.peilung, en ? 'en' : 'de');
    return en
      ? `Lightning observed by satellite ${sm} NM ${r} of the yacht (EUMETSAT, ${zeit}).`
      : `Blitze laut Satellit ${sm} sm ${r} der Yacht (EUMETSAT, ${zeit}).`;
  }
  const v = nf(l.voraus, 0, en ? 'en' : 'de');
  return en
    ? `Lightning observed by satellite ${sm} NM off the route, ${v} NM ahead (EUMETSAT, ${zeit}).`
    : `Blitze laut Satellit ${sm} sm neben der Route, ${v} sm voraus (EUMETSAT, ${zeit}).`;
}

function zeige(text: string): void {
  const el = $('tb-blitz-warnung');
  if (!el) return;
  if (!modal) {
    modal = initModal(el, schliesse);
    $('btn-blitz-warnung-weg')?.addEventListener('click', schliesse);
  }
  const t = $('tb-blitz-warnung-text');
  if (t) t.textContent = text;
  el.removeAttribute('hidden');
  modal.beimOeffnen();
}
function schliesse(): void {
  $('tb-blitz-warnung')?.setAttribute('hidden', '');
  modal?.beimSchliessen();
}

export function pruefeBlitze(
  boot: Punkt | null, rest: Punkt[] | null, fahrtKn: number, aktiv: boolean, online: boolean,
  eintrag: (e: Omit<LogEintrag, 'fahrt'>) => void, jetzt = Date.now(),
): void {
  const radius = blitzRadius();
  if (!boot || !aktiv || !online || radius <= 0 || laeuft || jetzt < naechstePruefung) return;
  laeuft = true;
  naechstePruefung = jetzt + PRUEF_MS;
  const voraus = rest && rest.length >= 2 ? routeVoraus([boot, ...rest.slice(1)], Math.max(BLITZ_VORAUS_MIN_SM, fahrtKn * BLITZ_VORAUS_H)) : null;
  const box = boxUm([boot, ...(voraus ?? [])], radius + 2);
  if (!box) { laeuft = false; return; }
  void holeBlitze(box, BLITZ_WARN_MIN, jetzt).then(({ blitze }) => {
    const lage = blitzLage(blitze, boot, voraus, radius);
    if (!lage || !sollWarnen(lage, zuletzt(), jetzt)) return;
    merke(jetzt, lage.sm);
    eintrag({ t: jetzt, art: 'wetter', lat: boot.lat, lon: boot.lon, text: blitzText(lage), wetter: { quelle: 'beobachtet' } });
    zeige(blitzText(lage));

    sage(lage.art === 'yacht'
      ? blitzAnsage(lage.sm, richtungAusgeschrieben(lage.peilung, 'en'), null)
      : blitzAnsage(lage.sm, null, lage.voraus), 'frage', 5 * 60_000);
  }).catch(() => { naechstePruefung = jetzt + FEHLER_PAUSE_MS; }).finally(() => { laeuft = false; });
}

export function _vergessen(): void { naechstePruefung = 0; laeuft = false; }
