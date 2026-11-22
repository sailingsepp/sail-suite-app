import { nf, localDateStr, uhrLtVon } from '@/core/time';
import { describeRevierWetter, ohneRevierkunde } from '@/briefing/overview';
import { fetchWindForPoints, fetchDaylight } from '@/data/openMeteo';
import { fetchCurrentForPoints } from '@/data/marine';
import { setzeWetterkopf, type Fahrt, type LogEintrag, type WetterAngabe } from '@/data/logdb';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal } from '@/shell/modal';
import { sicheresBriefingFragment } from '@/ui/sicheresHtml';
import { vorhersageText, beobachtungText, MODELL, wetterkopfVeraltet, letztesAblegen } from './wettertext';
import { STRINGS } from './strings';
import { windJetzt, seegangJetzt, wetterGeholt, genauigkeitJetzt, ALTER_MAX_MS,
  ABWEICHUNG_KN_GENAUIGKEIT, ABWEICHUNG_GRAD_GENAUIGKEIT } from './wetter';
import { istOnline } from './netz';
import type { Zustand } from './aufzeichnung';

export { vorhersageText, beobachtungText };

const TAKT_MS = 60 * 60_000;

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;

let letzterEintrag = 0;
let kopfLaeuft = false;
let kopfVersucht = 0;

let aufEintrag: (e: LogEintrag) => void = () => {};

let aufKopf: (kopf: NonNullable<Fahrt['wetterkopf']>) => void = () => {};

function uhr(t: number): string {
  return uhrLtVon(t);
}

export function vorhersageJetzt(): WetterAngabe | null {
  const w = windJetzt();
  if (!w) return null;
  const s = seegangJetzt();
  const angabe: WetterAngabe = { quelle: 'vorhersage', modell: MODELL };
  angabe.windKn = w.speed;
  angabe.windAus = w.dir;
  if (w.gust > 0) angabe.boeKn = w.gust;
  if (s) {
    angabe.welleM = s.hs;
    if (s.tp) angabe.wellePeriodeS = s.tp;
  }
  const geholt = wetterGeholt();
  if (geholt) angabe.abgerufen = geholt;
  return angabe;
}

export async function erzeugeWetterkopf(
  fahrt: Fahrt, lat: number, lon: number, ab: number | null = null,
): Promise<NonNullable<Fahrt['wetterkopf']> | null> {
  const punkt = { lat, lon, cum: 0, course: null };
  const [wind, marine, tageslicht] = await Promise.all([
    fetchWindForPoints([punkt]),
    fetchCurrentForPoints([punkt]).catch(() => [null]),
    fetchDaylight(lat, lon).catch(() => null),
  ]);
  const text = describeRevierWetter(
    wind.hourly, localDateStr(new Date()), punkt, punkt, marine, tageslicht, null, aktuelleSprache(),
    undefined, undefined,

    false,
  );
  if (!text) return null;
  const kopf = { t: Date.now(), text, ...(ab !== null ? { ab } : {}) };
  await setzeWetterkopf(fahrt.id, kopf);
  return kopf;
}

export function zeigeWetterkopf(fahrt: Fahrt | null): void {
  const abschnitt = $('tb-wetterkopf');
  const inhalt = $('tb-wetterkopf-text');
  if (!abschnitt || !inhalt) return;
  const kopf = fahrt?.wetterkopf;
  abschnitt.hidden = !kopf;
  if (!kopf) return;

  inhalt.replaceChildren(sicheresBriefingFragment(ohneRevierkunde(kopf.text)));
  const stand = $('tb-wetterkopf-stand');
  if (stand) {
    stand.textContent = wort('wetter.kopfStand').replace('{z}', uhr(kopf.t));
  }
}

const GENAUIGKEIT_MIN_ANZAHL = 2;

export function zeigeGenauigkeit(fahrt: Fahrt | null): void {
  const abschnitt = $('tb-genauigkeit');
  const zeile = $('tb-genauigkeit-zeile');
  if (!abschnitt || !zeile) return;
  const g = fahrt ? genauigkeitJetzt(fahrt.id) : null;
  const zeigen = !!g && g.gesamt >= GENAUIGKEIT_MIN_ANZAHL;
  abschnitt.hidden = !zeigen;
  if (!zeigen || !g) return;

  zeile.textContent = wort('wetter.genauigkeitZeile')
    .replace('{kn}', String(ABWEICHUNG_KN_GENAUIGKEIT))
    .replace('{grad}', String(ABWEICHUNG_GRAD_GENAUIGKEIT))
    .replace('{treffer}', String(g.treffer))
    .replace('{gesamt}', String(g.gesamt));
}

export function pruefeWetterlog(z: Zustand): void {

  if (z.betriebsart !== 'laeuft' || !z.fahrt) return;

  const fahrt = z.fahrt;
  if (wetterkopfVeraltet(fahrt.wetterkopf, z.eintraege) && !kopfLaeuft && istOnline() && z.position
      && Date.now() - kopfVersucht > 10 * 60_000) {
    kopfLaeuft = true;
    kopfVersucht = Date.now();

    const ab = letztesAblegen(z.eintraege);
    const abEintrag = ab === null ? null : z.eintraege.find((e) => e.art === 'start' && e.t === ab && e.lat != null && e.lon != null);
    void erzeugeWetterkopf(fahrt, abEintrag?.lat ?? z.position.lat, abEintrag?.lon ?? z.position.lon, ab)
      .then((kopf) => {
        if (!kopf) return;

        aufKopf(kopf);
        zeigeWetterkopf({ ...fahrt, wetterkopf: kopf });
      })
      .catch(() => {  })
      .finally(() => { kopfLaeuft = false; });
  }

  if (!letzterEintrag) {
    letzterEintrag = z.eintraege.reduce((neuster, e) =>
      e.art === 'wetter' && e.wetter?.quelle === 'vorhersage' && e.t > neuster ? e.t : neuster, 0);
  }

  const jetzt = Date.now();
  if (jetzt - letzterEintrag < TAKT_MS) return;
  const angabe = vorhersageJetzt();
  if (!angabe) return;

  if (angabe.abgerufen && jetzt - angabe.abgerufen > ALTER_MAX_MS && istOnline()) return;
  letzterEintrag = jetzt;

  aufEintrag({
    fahrt: fahrt.id, t: jetzt, art: 'wetter',
    lat: z.position?.lat ?? null, lon: z.position?.lon ?? null,
    text: vorhersageText(angabe, aktuelleSprache()),
    wetter: angabe,
  });
}

export function wetterlogZuruecksetzen(): void {
  letzterEintrag = 0;
  kopfVersucht = 0;
}

export function initWetterlog(
  fahrtJetzt: () => { id: string; position: { lat: number; lon: number } | null } | null,
  eintragen: (e: LogEintrag) => void,
  kopfMerken: (kopf: NonNullable<Fahrt['wetterkopf']>) => void,
): void {
  aufEintrag = eintragen;
  aufKopf = kopfMerken;

  const wetterModalEl = $('tb-wetter-modal') as HTMLElement | null;
  const schliesseWetterModal = (): void => {
    wetterModalEl?.setAttribute('hidden', '');
    wetterModal?.beimSchliessen();
  };
  const wetterModal = wetterModalEl ? initModal(wetterModalEl, schliesseWetterModal) : null;

  const zahl = (id: string): number | undefined => {
    const el = $(id) as HTMLInputElement | null;
    const v = el?.value.trim() ?? '';
    const n = Number(v.replace(',', '.'));
    return v && Number.isFinite(n) ? n : undefined;
  };

  const oeffneWetterModal = (): void => {

    const v = vorhersageJetzt();
    const setz = (id: string, wertV: number | undefined, stellen: number) => {
      const el = $(id) as HTMLInputElement | null;
      if (el) el.value = wertV == null ? '' : nf(wertV, stellen, 'en');
    };
    setz('in-wetter-wind', v?.windKn, 0);
    setz('in-wetter-aus', v?.windAus == null ? undefined : Math.round(v.windAus), 0);
    setz('in-wetter-boe', v?.boeKn, 0);
    setz('in-wetter-welle', v?.welleM, 1);
    const hinweis = $('tb-wetter-vorhersage');
    if (hinweis) {
      hinweis.textContent = v
        ? vorhersageText(v, aktuelleSprache())
        : wort('wetter.keineVorhersage');
    }
    wetterModalEl?.removeAttribute('hidden');
    wetterModal?.beimOeffnen();
  };
  $('btn-wetter-zeile')?.addEventListener('click', oeffneWetterModal);

  $('btn-wetter-weg')?.addEventListener('click', schliesseWetterModal);

  $('btn-wetter-ok')?.addEventListener('click', () => {
    const ziel = fahrtJetzt();
    schliesseWetterModal();
    if (!ziel) return;
    const angabe: WetterAngabe = { quelle: 'beobachtet' };
    const wind = zahl('in-wetter-wind');
    const aus = zahl('in-wetter-aus');
    const boe = zahl('in-wetter-boe');
    const welle = zahl('in-wetter-welle');
    if (wind != null) angabe.windKn = wind;
    if (aus != null) angabe.windAus = aus;
    if (boe != null) angabe.boeKn = boe;
    if (welle != null) angabe.welleM = welle;
    if (wind == null && welle == null) return;

    aufEintrag({
      fahrt: ziel.id, t: Date.now(), art: 'wetter',
      lat: ziel.position?.lat ?? null, lon: ziel.position?.lon ?? null,
      text: beobachtungText(angabe, vorhersageJetzt(), aktuelleSprache()),
      wetter: angabe,
    });
  });
}
