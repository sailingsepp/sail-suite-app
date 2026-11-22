import {
  holeCrew, teileFahrt, holeUebergaben, nehmeUebergabeAn, type CrewEintrag, type UebergabeMeta,
} from '@/data/toernApi';
import { baueFahrtPayload, bereinigeFahrt, type FahrtPayload } from '@/data/logSync';
import {
  aktuellerToern, alleFahrten, uebernehmeFahrt, schreibeFixe, schreibeEintrag, merkeOrt, ladeFixe,
  type LogEintrag, type Ortsmarke, type Fahrt,
} from '@/data/logdb';
import { mischeSpur } from '@/core/spurmischen';
import { aktuelleSprache } from '@/shell/sprache';
import { liesSitzungsToken } from '@/shell/session';
import { initModal, type ModalHandle } from '@/shell/modal';
import { STRINGS } from './strings';



const $ = (id: string) => document.getElementById(id);

function wort(schluessel: string): string {
  return STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
}

let syncModal: ModalHandle | null = null;

let geladeneCrew: CrewEintrag[] = [];

function schliesseSyncModal(): void {
  $('tb-sync-modal')?.setAttribute('hidden', '');
  syncModal?.beimSchliessen();
}

function anzeigename(m: CrewEintrag): string {
  const p = m.profil;
  if (p && 'nachname' in p) {
    const teile = [p.vorname, p.nachname].filter(Boolean);
    if (teile.length) return teile.join(' ');
  }
  if (p?.vorname) return p.vorname;
  return wort('sync.unbekanntesMitglied');
}



async function ladeSendeListe(token: string, toernId: string): Promise<void> {
  const liste = $('tb-sync-senden-liste');
  const leer = $('tb-sync-senden-leer');
  if (!liste) return;
  liste.innerHTML = '';

  const crew = await holeCrew(token, toernId);
  geladeneCrew = crew ?? [];
  const empfaenger = geladeneCrew.filter((m) => m.userId && !m.istIchSelbst);

  if (leer) leer.hidden = empfaenger.length > 0;
  for (const m of empfaenger) {
    const zeile = document.createElement('div');
    zeile.className = 'tb-sync-zeile';
    const name = document.createElement('span');
    name.textContent = anzeigename(m);
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'btn tb-gross';
    knopf.textContent = wort('sync.senden');
    knopf.addEventListener('click', () => void sendeAn(token, toernId, m.id, knopf));
    zeile.append(name, knopf);
    liste.appendChild(zeile);
  }
}

async function sendeAn(token: string, toernId: string, mitgliedId: string, knopf: HTMLButtonElement): Promise<void> {
  const fahrt = (await laufendeOderLetzteFahrt());
  if (!fahrt) {
    zeigeStatus('sync.sendenNichts');
    return;
  }
  knopf.disabled = true;
  const payload = await baueFahrtPayload(fahrt);
  const ok = await teileFahrt(token, toernId, mitgliedId, payload);
  knopf.disabled = false;
  zeigeStatus(ok ? 'sync.sendenErfolg' : 'sync.sendenFehler');
}

async function laufendeOderLetzteFahrt(): Promise<Fahrt | null> {
  const fahrten = await alleFahrten();
  return fahrten.sort((a, b) => b.begonnen - a.begonnen)[0] ?? null;
}



async function ladeEingangsListe(token: string): Promise<void> {
  const liste = $('tb-sync-eingang-liste');
  const leer = $('tb-sync-eingang-leer');
  if (!liste) return;
  liste.innerHTML = '';

  const eingang = await holeUebergaben(token);
  const offen = eingang ?? [];
  if (leer) leer.hidden = offen.length > 0;
  for (const u of offen) {
    const zeile = document.createElement('div');
    zeile.className = 'tb-sync-zeile';
    const name = document.createElement('span');
    const absender = geladeneCrew.find((m) => m.userId === u.vonUserId);
    name.textContent = absender ? anzeigename(absender) : wort('sync.unbekannterAbsender');
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'btn primary tb-gross';
    knopf.textContent = wort('sync.annehmen');
    knopf.addEventListener('click', () => void nimmAn(token, u, knopf));
    zeile.append(name, knopf);
    liste.appendChild(zeile);
  }
}


async function uebernimmLokal(roh: FahrtPayload): Promise<boolean> {
  
  
  
  const fahrt = bereinigeFahrt((roh as Partial<FahrtPayload> | null)?.fahrt);
  if (!fahrt) return false;
  const payload: FahrtPayload = {
    fahrt,
    fixe: Array.isArray(roh.fixe) ? roh.fixe : [],
    eintraege: Array.isArray(roh.eintraege) ? roh.eintraege : [],
    orte: Array.isArray(roh.orte) ? roh.orte : [],
  };
  const bisherige = await alleFahrten();
  const lokalVorhanden = bisherige.find((f) => f.id === payload.fahrt.id);

  if (!lokalVorhanden) {
    await uebernehmeFahrt(payload.fahrt);
    if (payload.fixe.length) {
      await schreibeFixe(payload.fahrt.id, payload.fixe.map((f) => ({ ...f, quelle: 'wachwechsel' as const })));
    }
    for (const eintrag of payload.eintraege) {
      const rest: LogEintrag = { ...eintrag };
      delete rest.id;
      await schreibeEintrag(rest);
    }
  } else {
    const eigeneFixe = await ladeFixe(payload.fahrt.id);
    const { fixe: gemischt } = mischeSpur(eigeneFixe, payload.fixe);
    const neue = gemischt
      .filter((f) => f.quelle === 'import')
      .map((f) => ({ ...f, quelle: 'wachwechsel' as const }));
    if (neue.length) await schreibeFixe(payload.fahrt.id, neue);
  }
  for (const ort of payload.orte) {
    const rest: Ortsmarke = { ...ort };
    delete rest.id;
    await merkeOrt(rest); 
  }
  return true;
}

async function nimmAn(token: string, u: UebergabeMeta, knopf: HTMLButtonElement): Promise<void> {
  knopf.disabled = true;
  const ergebnis = await nehmeUebergabeAn(token, u.id);
  if (!ergebnis) {
    knopf.disabled = false;
    zeigeStatus('sync.annehmenFehler');
    return;
  }
  if (!(await uebernimmLokal(ergebnis.payload as FahrtPayload))) {
    knopf.disabled = false;
    zeigeStatus('sync.annehmenFehler');
    return;
  }
  zeigeStatus('sync.annehmenErfolg');
  await ladeEingangsListe(token);
}



function zeigeStatus(schluessel: string): void {
  const el = $('tb-sync-status');
  if (el) el.textContent = wort(schluessel);
}

async function oeffneDatensicherung(): Promise<void> {
  $('tb-sync-modal')?.removeAttribute('hidden');
  syncModal?.beimOeffnen();
  zeigeStatus('');

  const token = liesSitzungsToken();
  const toern = await aktuellerToern();
  if (!token || !toern) {
    
    
    
    zeigeStatus('sync.keinToernOderSitzung');
    return;
  }
  await ladeSendeListe(token, toern.id);
  await ladeEingangsListe(token);
}

export function initDatensicherung(): void {
  const syncModalEl = $('tb-sync-modal');
  if (syncModalEl) syncModal = initModal(syncModalEl, schliesseSyncModal);

  
  
  $('btn-wachwechsel')?.addEventListener('click', () => void oeffneDatensicherung());
  $('btn-sync-weg')?.addEventListener('click', schliesseSyncModal);
}
