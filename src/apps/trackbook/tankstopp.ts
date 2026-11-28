import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { nf } from '@/core/time';
import { leseZahl } from '@/core/kompendium';
import { summeLiter, tankvorgaengeAus, type Tankvorgang } from '@/core/tankvorgaenge';
import { istTankMerker, liegtStill, sollTankstoppFragen, tankstoppText, TANKSTOPP_WEG_M, type TankMerker, type Tankstelle } from '@/core/tankstelle';
import { distNM } from '@/core/geo';
import type { Fix } from '@/core/spur';
import { tankstelleNeben } from '@/data/tankstelle';
import { aktuellerToern, aendereToern } from '@/data/logdb';
import type { Liegeart } from '@/core/logbuchText';
import { aktuellerZustand, ergaenzeEintrag, type Zustand } from './aufzeichnung';
import { STRINGS } from './strings';

const $ = (id: string): HTMLElement | null => document.getElementById(id);

function wort(schluessel: string): string {
  return STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
}

function text(schluessel: string, s: Tankstelle | TankMerker): string {
  return wort(schluessel)
    .replace('{name}', s.name ? `${s.name}, ` : '')
    .replace('{m}', nf(Math.max(1, Math.round(s.abstandM)), 0, aktuelleSprache()));
}

let suche: Promise<Tankstelle | null | undefined> | null = null;
let offen: TankMerker | null = null;
let modal: ModalHandle | null = null;
let nachSpeichern: () => void = () => {};

function liesMerker(): TankMerker | null {
  try {
    const roh = localStorage.getItem(SCHLUESSEL.tankstelle);
    const m: unknown = roh ? JSON.parse(roh) : null;
    return istTankMerker(m) ? m : null;
  } catch {
    return null;
  }
}

function schreibeMerker(m: TankMerker | null): void {
  try {
    if (m) localStorage.setItem(SCHLUESSEL.tankstelle, JSON.stringify(m));
    else localStorage.removeItem(SCHLUESSEL.tankstelle);
  } catch {

  }
}

export function sucheTankstelle(): void {
  const hinweis = $('tb-liegeart-tankstelle');
  if (hinweis) hinweis.hidden = true;
  const pos = aktuellerZustand().position;
  suche = pos ? tankstelleNeben(pos) : null;
  void suche?.then((s) => {
    if (!s || !hinweis) return;
    hinweis.textContent = text('tank.hinweis', s);
    hinweis.hidden = false;
  });
}

export async function merkeTankstelle(liegeart: Liegeart): Promise<void> {
  const lauf = suche;
  suche = null;
  const fahrt = aktuellerZustand().fahrt?.id;
  if (!lauf || !fahrt || liegeart === 'treiben') return;
  const t = Date.now();
  const s = await lauf.catch(() => undefined);
  if (s) schreibeMerker({ fahrt, t, lat: s.lat, lon: s.lon, name: s.name, abstandM: s.abstandM });
}

export function nachWeiterfahren(): void {
  const m = liesMerker();
  schreibeMerker(null);
  if (!m || !sollTankstoppFragen(m, aktuellerZustand().fahrt?.id ?? null, Date.now())) return;
  offen = m;
  const frage = $('tb-tank-frage');
  if (frage) frage.textContent = text('tank.frage', m);
  const feld = $('in-tank-liter') as HTMLInputElement | null;
  if (feld) feld.value = '';
  $('tb-tank-fehler')?.setAttribute('hidden', '');
  $('tb-tank-modal')?.removeAttribute('hidden');
  modal?.beimOeffnen();
  feld?.focus();
}

let gesuchtFuer: number | null = null;

let wiederAb = 0;
const WIEDER_NACH_MS = 60_000;

export function beobachteUnterwegs(z: Zustand, fixe: readonly Fix[]): void {
  if (z.betriebsart !== 'laeuft' || !z.fahrt) return;
  const jetzt = Date.now();
  let m = liesMerker();

  if (m && !sollTankstoppFragen(m, z.fahrt.id, jetzt)) { schreibeMerker(null); m = null; }
  if (m) {
    if (z.position && distNM(z.position.lat, z.position.lon, m.lat, m.lon) * 1852 > TANKSTOPP_WEG_M) nachWeiterfahren();
    return;
  }
  const still = liegtStill(fixe, jetzt);
  if (!still || gesuchtFuer === still.seit || jetzt < wiederAb) return;
  gesuchtFuer = still.seit;
  const fahrt = z.fahrt.id;
  void tankstelleNeben({ lat: still.lat, lon: still.lon }).then((s) => {

    if (s === undefined) { if (gesuchtFuer === still.seit) gesuchtFuer = null; wiederAb = Date.now() + WIEDER_NACH_MS; return; }
    if (s && aktuellerZustand().fahrt?.id === fahrt && !liesMerker()) {
      schreibeMerker({ fahrt, t: still.seit, lat: s.lat, lon: s.lon, name: s.name, abstandM: s.abstandM });
    }
  }).catch(() => { if (gesuchtFuer === still.seit) gesuchtFuer = null; wiederAb = Date.now() + WIEDER_NACH_MS; });
}

function schliesse(): void {
  offen = null;
  $('tb-tank-modal')?.setAttribute('hidden', '');
  modal?.beimSchliessen();
}

async function trageAmToernEin(v: Tankvorgang): Promise<void> {
  const t = await aktuellerToern();
  if (!t) return;
  await aendereToern(t.id, (jetzt) => {
    if (!jetzt) return null;
    const vorgaenge = [...tankvorgaengeAus(jetzt), v];
    const summe = summeLiter(vorgaenge);
    return { ...jetzt, tankvorgaenge: vorgaenge, ...(summe !== null ? { dieselGetanktL: summe } : {}) };
  });
}

async function eintragen(): Promise<void> {
  const m = offen;
  const liter = leseZahl((($('in-tank-liter') as HTMLInputElement | null)?.value) ?? '');
  if (!m) return;
  if (!(liter > 0 && liter < 100_000)) {
    $('tb-tank-fehler')?.removeAttribute('hidden');
    return;
  }
  schliesse();
  const jetzt = new Date();
  const datum = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
  const l = Math.round(liter * 10) / 10;
  await trageAmToernEin({ datum, liter: l, ort: m.name ? m.name.slice(0, 100) : null }).catch(() => {});
  await ergaenzeEintrag({
    fahrt: m.fahrt, t: jetzt.getTime(), art: 'tanken', lat: m.lat, lon: m.lon,
    text: tankstoppText(l, m.name, aktuelleSprache()),
  }).catch(() => {});
  nachSpeichern();
}

export function initTankstopp(beiGespeichert: () => void): void {
  nachSpeichern = beiGespeichert;
  const el = $('tb-tank-modal');
  if (el) modal = initModal(el, schliesse);
  $('btn-tank-ok')?.addEventListener('click', () => void eintragen());
  $('btn-tank-nein')?.addEventListener('click', schliesse);
  $('in-tank-liter')?.addEventListener('input', () => $('tb-tank-fehler')?.setAttribute('hidden', ''));
  $('in-tank-liter')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void eintragen();
  });
}
