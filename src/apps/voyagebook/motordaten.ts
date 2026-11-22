import {
  ersteAblesung, letzteAblesung, laufzeitSeitBeginn, uebernehmeEingabe,
} from '@/core/motorstunden';
import { summeLiter, tankvorgaengeAus } from '@/core/tankvorgaenge';
import { baueTankliste, type Tankliste } from '@/ui/tankliste';
import { nf } from '@/core/time';
import {
  holeToern as holeLokalenToern, aendereToern, speicherVerfuegbar, type Toern as LokalerToern,
} from '@/data/logdb';
import {
  gleicheMotordatenAb, schreibeMotordaten, merkeMotordaten, motordatenAus, setzeDieselInToern, type Motordaten,
} from '@/data/spurablage';
import type { ToernZeile } from '@/data/toernApi';
import { liesEigeneNutzerId } from '@/shell/session';
import { aktuelleSprache } from '@/shell/sprache';
import { STRINGS } from './strings';



const $ = (id: string) => document.getElementById(id);


function feldZahl(v: number): string {
  return aktuelleSprache() === 'de' ? String(v).replace('.', ',') : String(v);
}

function wort(schluessel: string): string {
  return STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
}

let token: string | null = null;
let toern: ToernZeile | null = null;
let werte: Motordaten = { motorstunden: [], dieselGetanktL: null };
let nachSpeichern: () => void = () => {};
let tankliste: Tankliste | null = null;

function zahl(id: string): number | undefined {
  const v = (($(id) as HTMLInputElement | null)?.value ?? '').trim();
  const n = Number(v.replace(',', '.'));
  return v && Number.isFinite(n) ? n : undefined;
}

function setz(id: string, v: number | undefined): void {
  const el = $(id) as HTMLInputElement | null;
  if (el) el.value = v === undefined ? '' : feldZahl(v);
}

async function lokalerToern(id: string): Promise<LokalerToern | null> {
  return speicherVerfuegbar() ? holeLokalenToern(id).catch(() => null) : null;
}


export async function ladeMotordaten(
  sitzung: string, t: ToernZeile, beiAenderung: () => void,
): Promise<void> {
  token = sitzung;
  toern = t;
  nachSpeichern = beiAenderung;
  const felder = $('vb-motor-felder');
  const keine = $('vb-motor-keine');
  const status = $('vb-motor-status');
  if (status) status.textContent = '';
  if (keine) keine.hidden = true;
  const lokal = await lokalerToern(t.id);
  const nutzerId = liesEigeneNutzerId();
  const m = nutzerId ? await gleicheMotordatenAb(sitzung, nutzerId, t.id, lokal) : null;
  if (toern?.id !== t.id) return;
  werte = m ?? motordatenAus(lokal);
  if (felder) felder.hidden = false;
  zeigeWerte(werte);
}

function zeigeWerte(m: Motordaten): void {
  const reihe = m.motorstunden;
  setz('in-motor-anfang', ersteAblesung(reihe)?.stand);
  setz('in-motor-ende', reihe.length > 1 ? letzteAblesung(reihe)?.stand : undefined);
  tankliste?.setze(tankvorgaengeAus(m));
  const lauf = laufzeitSeitBeginn(reihe);
  const laufEl = $('vb-motor-laufzeit');
  if (laufEl) {
    laufEl.hidden = lauf === null;
    if (lauf !== null) laufEl.textContent = wort('motor.laufzeit').replace('{h}', nf(lauf, 1, aktuelleSprache()));
  }
}

async function speichere(): Promise<void> {
  if (!token || !toern) return;
  const t = toern;
  const lokal = await lokalerToern(t.id);
  const status = $('vb-motor-status');
  const { reihe, fehler: motorFehler } = uebernehmeEingabe(
    werte.motorstunden, zahl('in-motor-anfang'), zahl('in-motor-ende'),
    lokal?.angelegt ?? Date.parse(t.angelegt), lokal?.beendet ?? Date.now(),
  );
  
  
  const tank = tankliste?.lies() ?? { vorgaenge: tankvorgaengeAus(werte), fehler: false };
  const dieselFehler = tank.fehler;
  const neu: Motordaten = {
    motorstunden: reihe.length ? reihe : werte.motorstunden,
    ...(dieselFehler
      ? { dieselGetanktL: werte.dieselGetanktL, ...(werte.tankvorgaenge ? { tankvorgaenge: werte.tankvorgaenge } : {}) }
      : { dieselGetanktL: summeLiter(tank.vorgaenge), tankvorgaenge: tank.vorgaenge }),
  };
  if (lokal) {
    
    await aendereToern(lokal.id, (jetzt) => (jetzt
      ? setzeDieselInToern({ ...jetzt, motorstunden: neu.motorstunden }, neu) : null)).catch(() => null);
  }
  const oben = await schreibeMotordaten(token, t.id, neu);
  const nutzerId = liesEigeneNutzerId();
  if (oben && nutzerId) merkeMotordaten(nutzerId, t.id, neu);
  
  
  if (!oben && !lokal) {
    if (status) status.textContent = wort('motor.fehlerNetz');
    return;
  }
  werte = neu;
  zeigeWerte(neu);
  if (status) {
    status.textContent = [
      motorFehler ? wort('motor.fehlerStunden') : '',
      dieselFehler ? wort('motor.fehlerDiesel') : '',
    ].filter(Boolean).join(' ') || wort(oben ? 'motor.gespeichert' : 'motor.gespeichertLokal');
  }
  nachSpeichern();
}


export function sperreTankliste(gesperrt: boolean): void {
  tankliste?.sperre(gesperrt);
}

export function initMotordaten(): void {
  const ort = $('vb-tankliste');
  if (ort) tankliste = baueTankliste(ort, aktuelleSprache, 'vb-tank');
  $('btn-motor-speichern')?.addEventListener('click', () => void speichere());
}
