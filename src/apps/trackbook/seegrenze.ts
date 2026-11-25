import { destPoint } from '@/core/geo';
import { fetchSeegebiet } from '@/data/seegebiete';
import { eindeutschen, hoheitsStaat } from '@/briefing/seegebiet';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { sage } from './ansage';
import { grenzeText } from '@/core/ansagen';
import { grenzUrteil, hoheitAusAntwort, istHoheSee } from '@/core/seegrenze';
import type { Zone } from '@/core/routenGrenzen';
import type { LogEintrag } from '@/data/logdb';
import { hoheitAusKacheln, ladeHoheitImGebiet } from '@/data/hoheitKacheln';
import { schengenGrenze } from '@/core/grenzen';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import type { Zustand } from './aufzeichnung';

const $ = (id: string) => document.getElementById(id);

const PRUEF_TAKT_MS = 2 * 60_000;

const VORLAUF_MIN = 12;

const MIN_FAHRT_KN = 0.5;

const WARNUNG_ABSTAND_MS = 10 * 60_000;

let modal: ModalHandle | null = null;
let naechstePruefungAb = 0;
let letzteWarnungMs = 0;

let unterwegs = false;

function liesZuletzt(): string | null {
  try { return localStorage.getItem(SCHLUESSEL.seegrenzeZuletzt) || null; } catch { return null; }
}

function liesVerlassen(): { staat: string; t: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(SCHLUESSEL.seegrenzeVerlassen) ?? 'null') as { staat?: unknown; t?: unknown } | null;
    return v && typeof v.staat === 'string' && typeof v.t === 'number' ? { staat: v.staat, t: v.t } : null;
  } catch { return null; }
}
function merkeVerlassen(staat: string): void {
  try { localStorage.setItem(SCHLUESSEL.seegrenzeVerlassen, JSON.stringify({ staat, t: Date.now() })); } catch {  }
}
function merkeZuletzt(staat: string | null): void {
  try {
    if (staat) localStorage.setItem(SCHLUESSEL.seegrenzeZuletzt, staat);
  } catch {

  }
}

function zoneAus(a: Awaited<ReturnType<typeof fetchSeegebiet>>): Zone | undefined {
  const staat = hoheitAusAntwort(a, hoheitsStaat);
  if (staat === undefined || !a) return undefined;
  return staat ? { staat, ...(a.hoheit ? { hoheit: a.hoheit } : {}) } : { staat: null, ...(a.awz ? { awz: a.awz } : {}), ...(istHoheSee(a) ? { hoheSee: true } : {}) };
}

async function zoneOhneNetz(lat: number, lon: number): Promise<Zone | undefined> {
  const h = await hoheitAusKacheln(lat, lon).catch(() => undefined);
  if (!h) return undefined;
  if (!h.zone) return { staat: null };
  const staat = hoheitsStaat(h.zone.name);
  return staat ? { staat, hoheit: h.zone.name } : undefined;
}

let hoheitGeladen: { lat: number; lon: number; t: number } | null = null;
function ladeHoheitUm(pos: { lat: number; lon: number }): void {
  const jetzt = Date.now();
  if (hoheitGeladen && jetzt - hoheitGeladen.t < 3600_000
    && Math.abs(pos.lat - hoheitGeladen.lat) < 0.5 && Math.abs(pos.lon - hoheitGeladen.lon) < 0.5) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  hoheitGeladen = { lat: pos.lat, lon: pos.lon, t: jetzt };
  void ladeHoheitImGebiet({ swLat: pos.lat - 1.5, swLon: pos.lon - 1.5, neLat: pos.lat + 1.5, neLon: pos.lon + 1.5 })
    .then((ok) => { if (!ok) hoheitGeladen = null; }).catch(() => { hoheitGeladen = null; });
}

export async function zoneAn(p: { lat: number; lon: number }): Promise<Zone | undefined> {
  const a = await fetchSeegebiet(p.lat, p.lon);

  if (!a) throw new Error('Marine Regions ohne Antwort');
  return zoneAus(a);
}

export function zonenText(z: Zone, en = aktuelleSprache() === 'en'): string {
  const name = (n: string) => (en ? n : eindeutschen(n));
  if (z.staat && z.hoheit) return name(z.hoheit);
  if (z.hoheSee) return en ? 'high seas' : 'Hohe See';
  return `${en ? 'international waters' : 'internationale Gewässer'}${z.awz ? ` (${name(z.awz)})` : ''}`;
}

export function grenzLogText(von: Zone, nach: Zone): string {
  return `${aktuelleSprache() === 'en' ? 'Sea border' : 'Seegrenze'}: ${zonenText(von)} → ${zonenText(nach)}`;
}

let eintragen: ((e: Omit<LogEintrag, 'fahrt'>) => void) | null = null;

let zuletztGeloggt: { schluessel: string; t: number } | null = null;
const LOG_RUHE_MS = 30 * 60_000;

export function loggeGrenze(von: Zone, nach: Zone, pos: { lat: number; lon: number }, t = Date.now()): void {
  const schluessel = `${von.staat ?? 'int'}>${nach.staat ?? 'int'}`;
  if (zuletztGeloggt && zuletztGeloggt.schluessel === schluessel && t - zuletztGeloggt.t < LOG_RUHE_MS) return;
  zuletztGeloggt = { schluessel, t };
  eintragen?.({ t, art: 'navigation', lat: pos.lat, lon: pos.lon, text: grenzLogText(von, nach) });
}

export function warneGrenzeVoraus(von: Zone, nach: Zone, minuten: number): void {
  letzteWarnungMs = Date.now();
  if (von.staat && !nach.staat) merkeVerlassen(von.staat);
  const bisher = von.staat ?? liesZuletzt();
  zeigeWarnung(von, nach, nach.staat && bisher ? schengenGrenze(bisher, nach.staat) : null, minuten);
}

let zoneZuletzt: Zone | null = null;

async function pruefeUndWarne(pos: { lat: number; lon: number }, cogDeg: number, sogKn: number): Promise<void> {
  unterwegs = true;
  try {
    const distNM = sogKn * (VORLAUF_MIN / 60);
    const [vlat, vlon] = destPoint(pos.lat, pos.lon, cogDeg, distNM);
    const [jetzt, voraus] = await Promise.all([
      fetchSeegebiet(pos.lat, pos.lon),
      fetchSeegebiet(vlat, vlon),
    ]);

    const zJetzt = jetzt ? zoneAus(jetzt) : await zoneOhneNetz(pos.lat, pos.lon);
    const zVoraus = voraus ? zoneAus(voraus) : await zoneOhneNetz(vlat, vlon);

    if (zJetzt) {
      if (zoneZuletzt && (zoneZuletzt.staat ?? 'int') !== (zJetzt.staat ?? 'int')) loggeGrenze(zoneZuletzt, zJetzt, pos);
      zoneZuletzt = zJetzt;
    }
    if (!zJetzt || !zVoraus) return;
    const staatJetzt = zJetzt.staat, staatVoraus = zVoraus.staat;
    const bisher = staatJetzt ?? liesZuletzt();
    const urteil = grenzUrteil(liesZuletzt(), staatJetzt, staatVoraus, liesVerlassen(), Date.now());
    merkeZuletzt(urteil.zuletzt);
    if (!urteil.warnen || Date.now() - letzteWarnungMs < WARNUNG_ABSTAND_MS) return;
    if (urteil.art === 'verlassen' && staatJetzt) {

      letzteWarnungMs = Date.now();
      merkeVerlassen(staatJetzt);
      zeigeWarnung(zJetzt, zVoraus, null);
      return;
    }
    if (!staatVoraus) return;
    letzteWarnungMs = Date.now();

    zeigeWarnung(zJetzt, zVoraus, bisher ? schengenGrenze(bisher, staatVoraus) : null);
  } finally {
    unterwegs = false;
  }
}

export function pruefeSeegrenze(z: Zustand): void {
  if (unterwegs) return;
  const jetzt = Date.now();
  if (jetzt < naechstePruefungAb) return;
  if (z.position) ladeHoheitUm(z.position);
  if (!z.position || z.cog === null || z.sog < MIN_FAHRT_KN) return;
  naechstePruefungAb = jetzt + PRUEF_TAKT_MS;
  void pruefeUndWarne(z.position, z.cog, z.sog);
}

function zeigeWarnung(von: Zone, nach: Zone, schengen: 'binnen' | 'aussen' | 'ohne' | null, minuten = VORLAUF_MIN): void {
  const textEl = $('tb-seegrenze-warnung-text');
  if (textEl) {
    const en = aktuelleSprache() === 'en';
    const zusatz = !schengen ? ''
      : schengen === 'binnen'
        ? (en ? ' Both in the Schengen area: no border control.' : ' Beide im Schengen-Raum: keine Grenzkontrolle.')
        : schengen === 'aussen'
          ? (en ? ' Schengen external border: clear out and in.' : ' Schengen-Außengrenze: aus- und einklarieren.')
          : (en ? ' Clear out and in.' : ' Aus- und einklarieren.');
    const m = Math.max(1, Math.round(minuten));
    textEl.textContent = (en
      ? `Course prediction: in about ${m} minutes, possible crossing: ${zonenText(von, en)} → ${zonenText(nach, en)}.`
      : `Kursvorhersage: in rund ${m} Minuten möglicher Wechsel: ${zonenText(von, en)} → ${zonenText(nach, en)}.`) + zusatz;
  }
  $('tb-seegrenze-warnung')?.removeAttribute('hidden');
  modal?.beimOeffnen();

  sage(grenzeText(zonenText(von, true), zonenText(nach, true), minuten, schengen), 'frage', 5 * 60_000);
}

function schliesseWarnung(): void {
  $('tb-seegrenze-warnung')?.setAttribute('hidden', '');
  modal?.beimSchliessen();
}

export function initSeegrenze(eintrag?: (e: Omit<LogEintrag, 'fahrt'>) => void): void {
  eintragen = eintrag ?? null;
  const el = $('tb-seegrenze-warnung');
  if (el) modal = initModal(el, schliesseWarnung);
  $('btn-seegrenze-warnung-weg')?.addEventListener('click', schliesseWarnung);
}
