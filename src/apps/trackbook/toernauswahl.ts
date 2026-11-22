import {
  aendereToern, aktuellerToern, holeToern as holeLokalenToern, beendeToern, laufendeFahrt,
  alleToerne,
  type Toern, type CrewMitglied,
} from '@/data/logdb';
import {
  holeToern as holeServerToern, holeAktivenToern, holeCrew,
  type ToernZeile, type CrewEintrag,
} from '@/data/toernApi';
import { liesSitzungsToken } from '@/shell/session';
import {
  ersteAblesung, letzteAblesung, uebernehmeEingabe, type Motorablesung,
} from '@/core/motorstunden';
import { summeLiter, tankvorgaengeAus, nurSumme } from '@/core/tankvorgaenge';
import { baueTankliste, type Tankliste } from '@/ui/tankliste';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { initUnterschrift, unterschriftLesen, leereUnterschrift } from './unterschrift';
import { STRINGS } from './strings';
import { funktionSchluessel } from '@/core/crewFunktion';



const $ = (id: string) => document.getElementById(id);


function feldZahl(v: number): string {
  return aktuelleSprache() === 'de' ? String(v).replace('.', ',') : String(v);
}

function wort(schluessel: string): string {
  return STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
}



let toernModal: ModalHandle | null = null;
let tankliste: Tankliste | null = null;
let sigModal: ModalHandle | null = null;



async function ladeUndZeigeAktiv(): Promise<void> {
  const keiner = $('tb-toern-keiner');
  const details = $('tb-toern-details');
  if (keiner) keiner.hidden = false;
  if (details) details.hidden = true;
  angezeigteToernId = null;
  void zeigeLetztenBeendeten();

  const token = liesSitzungsToken();
  
  
  if (!token) return;

  const abfrage = await holeAktivenToern(token);
  
  
  
  
  
  if (abfrage.lage !== 'geliefert' || !abfrage.toern) return;

  const serverToern = abfrage.toern;
  const echteCrew = await holeCrew(token, serverToern.id);
  
  
  const toern = (await aendereToern(serverToern.id,
    (bisherLokal) => baueLokalenToern(serverToern.id, serverToern, echteCrew, bisherLokal, true)))!;
  zeigeDetails(toern);
  aufToern(toern);
}


function crewEintragUebernehmen(m: CrewEintrag): CrewMitglied {
  const profil = m.profil;
  
  
  
  
  const vollesProfil = profil !== null && 'passnummer' in profil ? profil : null;
  const nachname = profil !== null && 'nachname' in profil ? profil.nachname : undefined;
  return {
    vorname: profil?.vorname ?? '',
    nachname: nachname ?? '',
    funktion: m.funktion,
    funktionForm: m.funktionForm ?? null,
    ...(vollesProfil?.passnummer ? { ausweis: vollesProfil.passnummer } : {}),
  };
}


function crewMitVollemNamen(m: CrewMitglied): boolean {
  return Boolean(m.vorname && m.nachname);
}


function baueLokalenToern(
  serverId: string, echterToern: ToernZeile, echteCrew: CrewEintrag[] | null,
  bisherLokal: Toern | null, serverBestaetigtAktiv = false,
): Toern {
  return {
    id: serverId,
    name: echterToern.name,
    schiff: echterToern.schiff,
    crew: (echteCrew ?? []).map(crewEintragUebernehmen).filter(crewMitVollemNamen),
    angelegt: bisherLokal?.angelegt ?? Date.now(),
    ...(echterToern.beschreibung ? { beschreibung: echterToern.beschreibung } : {}),
    ...(echterToern.revier ? { revier: echterToern.revier } : {}),
    ...(echterToern.von ? { von: echterToern.von } : {}),
    ...(echterToern.bis ? { bis: echterToern.bis } : {}),
    ...(bisherLokal?.unterschriften ? { unterschriften: bisherLokal.unterschriften } : {}),
    ...(bisherLokal?.motorstunden ? { motorstunden: bisherLokal.motorstunden } : {}),
    ...(bisherLokal?.dieselGetanktL !== undefined ? { dieselGetanktL: bisherLokal.dieselGetanktL } : {}),
    ...(bisherLokal?.tankvorgaenge ? { tankvorgaenge: bisherLokal.tankvorgaenge } : {}),
    ...(bisherLokal?.beendet && !serverBestaetigtAktiv ? { beendet: bisherLokal.beendet } : {}),
  };
}


async function pruefeNochAktiv(vorhanden: Toern, token: string): Promise<boolean> {
  const abfrage = await holeAktivenToern(token);
  if (abfrage.lage !== 'geliefert') return true;
  if (abfrage.toern?.id === vorhanden.id) return true;
  const laufend = await laufendeFahrt();
  if (laufend && laufend.toern === vorhanden.id) {
    
    
    
    
    
    const neu = abfrage.toern;
    if (!neu) return true;
    const paar = `${vorhanden.id}>${neu.id}`;
    if (wechselAbgelehnt.has(paar)) return true;
    const frage = wort('toern.wechselFrage').replace('{alt}', vorhanden.name).replace('{neu}', neu.name);
    if (!confirm(frage)) { wechselAbgelehnt.add(paar); return true; }
    
    
    
    await beendeToern(vorhanden.id);
    location.reload();
    return false;
  }
  await beendeToern(vorhanden.id);
  aufToern(null);
  
  void ladeUndZeigeAktiv();
  return false;
}


const wechselAbgelehnt = new Set<string>();


async function aktualisiereLaufendenToernVomServer(vorhanden: Toern): Promise<void> {
  const token = liesSitzungsToken();
  if (!token) return;
  
  
  
  
  
  
  if (!(await pruefeNochAktiv(vorhanden, token))) return;
  const [echterToern, echteCrew] = await Promise.all([
    holeServerToern(token, vorhanden.id), holeCrew(token, vorhanden.id),
  ]);
  if (!echterToern) return;
  
  
  const toern = await aendereToern(vorhanden.id,
    (jetzt) => (jetzt ? baueLokalenToern(vorhanden.id, echterToern, echteCrew, jetzt) : null));
  if (!toern) return;
  
  
  
  zeigeDetails(toern);
  aufToern(toern);
}


setInterval(() => {
  void aktuellerToern().then((t) => {
    if (t) void aktualisiereLaufendenToernVomServer(t);
  });
}, 5 * 60_000);




let angezeigteToernId: string | null = null;


async function zeigeLetztenBeendeten(): Promise<void> {
  const knopf = $('btn-toern-letzter') as HTMLButtonElement | null;
  if (!knopf) return;
  const letzter = (await alleToerne().catch(() => [])).find((t) => t.beendet);
  knopf.hidden = !letzter;
  if (!letzter) return;
  knopf.textContent = wort('toern.letzterNachtragen').replace('{name}', letzter.name);
  knopf.dataset['toern'] = letzter.id;
}

function zeigeDetails(t: Toern): void {
  
  
  if (angezeigteToernId !== null && angezeigteToernId !== t.id) return;
  angezeigteToernId = t.id;
  const keiner = $('tb-toern-keiner');
  const details = $('tb-toern-details');
  if (keiner) keiner.hidden = true;
  if (details) details.hidden = false;
  const beendet = Boolean(t.beendet);
  ($('t-detail-beendet') as HTMLElement | null)?.toggleAttribute('hidden', !beendet);
  const jetztLabel = $('t-motorstunden-jetzt-label');
  if (jetztLabel) jetztLabel.textContent = wort(beendet ? 'toern.motorstundenEnde' : 'toern.motorstundenJetzt');

  const nameEl = $('t-detail-name');
  if (nameEl) nameEl.textContent = t.name;
  const infoEl = $('t-detail-info');
  if (infoEl) {
    infoEl.textContent = [t.revier, t.schiff.name].filter(Boolean).join(' · ');
  }

  const ablesungen = t.motorstunden ?? [];
  const setz = (id: string, v: number | undefined): void => {
    const el = $(id) as HTMLInputElement | null;
    if (el) el.value = v === undefined ? '' : feldZahl(v);
  };
  setz('t-motorstunden', ersteAblesung(ablesungen)?.stand);
  setz('t-motorstunden-jetzt', ablesungen.length > 1 ? letzteAblesung(ablesungen)?.stand : undefined);
  ($('t-motorstunden-fehler') as HTMLElement | null)?.setAttribute('hidden', '');
  tankliste?.setze(tankvorgaengeAus(t));
  ($('t-diesel-fehler') as HTMLElement | null)?.setAttribute('hidden', '');
  ungespeichert = false;

  const crewListe = $('t-crew-anzeige');
  if (crewListe) {
    crewListe.innerHTML = '';
    for (const m of t.crew) {
      const li = document.createElement('li');
      const name = [m.vorname, m.nachname].filter(Boolean).join(' ') || '–';
      li.textContent = `${name}: ${wort(funktionSchluessel(m.funktion, m.funktionForm))}`;
      crewListe.appendChild(li);
    }
  }

  unterschriften = { ...(t.unterschriften ?? {}) };
  zeigeUnterschriftsStand();
}

const zahl = (id: string): number | undefined => {
  const v = (($(id) as HTMLInputElement | null)?.value ?? '').trim();
  const n = Number(v.replace(',', '.'));
  return v && Number.isFinite(n) ? n : undefined;
};


function motorstundenLesen(t: Toern, anfang: number | undefined, jetzt: number | undefined): { reihe: Motorablesung[]; fehler: boolean } {
  const { reihe, fehler } = uebernehmeEingabe(t.motorstunden ?? [], anfang, jetzt, t.angelegt, t.beendet ?? Date.now());
  ($('t-motorstunden-fehler') as HTMLElement | null)?.toggleAttribute('hidden', !fehler);
  return { reihe, fehler };
}


let ungespeichert = false;

let laufendesSpeichern: Promise<{ fehler: boolean }> | null = null;

function speichereJetzt(): Promise<{ fehler: boolean }> {
  const lauf = speichereMotorstunden();
  laufendesSpeichern = lauf;
  void lauf.finally(() => { if (laufendesSpeichern === lauf) laufendesSpeichern = null; });
  return lauf;
}


async function angezeigterToern(): Promise<Toern | null> {
  if (angezeigteToernId) return holeLokalenToern(angezeigteToernId).catch(() => null);
  return aktuellerToern();
}


function meldeWennLaufend(t: Toern): void {
  if (!t.beendet) aufToern(t);
}


async function speichereMotorstunden(): Promise<{ fehler: boolean }> {
  
  const anfang = zahl('t-motorstunden');
  const jetztStand = zahl('t-motorstunden-jetzt');
  ungespeichert = false;
  const angezeigt = await angezeigterToern();
  if (!angezeigt) return { fehler: false };
  
  
  
  const tank = tankliste?.lies();
  const dieselFehler = tank?.fehler ?? false;
  ($('t-diesel-fehler') as HTMLElement | null)?.toggleAttribute('hidden', !dieselFehler);
  
  let motorFehler = false;
  const aktualisiert = await aendereToern(angezeigt.id, (t) => {
    if (!t) return null;
    const { reihe: ablesungen, fehler } = motorstundenLesen(t, anfang, jetztStand);
    motorFehler = fehler;
    const neu: Toern = { ...t, ...(ablesungen.length ? { motorstunden: ablesungen } : {}) };
    if (tank && !dieselFehler) {
      const summe = summeLiter(tank.vorgaenge);
      if (summe === null) delete neu.dieselGetanktL;
      else neu.dieselGetanktL = summe;
      if (nurSumme(tank.vorgaenge)) delete neu.tankvorgaenge;
      else neu.tankvorgaenge = tank.vorgaenge;
    }
    return neu;
  });
  if (!aktualisiert) return { fehler: false };
  meldeWennLaufend(aktualisiert);
  const fehler = motorFehler || dieselFehler;
  
  if (fehler) ungespeichert = true;
  
  const status = $('t-motor-status');
  if (status) status.textContent = fehler ? '' : wort('toern.gespeichert');
  return { fehler };
}



let unterschriften: { skipper?: string; bewerber?: string } = {};
let sigRolle: 'skipper' | 'bewerber' = 'skipper';

function zeigeUnterschriftsStand(): void {
  for (const rolle of ['skipper', 'bewerber'] as const) {
    const el = $('sig-' + rolle + '-stand');
    if (!el) continue;
    const gesetzt = Boolean(unterschriften[rolle]);
    el.textContent = wort(gesetzt ? 'unterschrift.gesetzt' : 'unterschrift.offen');
    el.classList.toggle('gesetzt', gesetzt);
  }
}

function oeffneUnterschrift(rolle: 'skipper' | 'bewerber'): void {
  sigRolle = rolle;
  const titel = $('tb-sig-titel');
  if (titel) titel.textContent = wort('unterschrift.' + rolle);
  const modal = $('tb-sig-modal');
  modal?.removeAttribute('hidden');
  sigModal?.beimOeffnen();
  const flaeche = $('tb-sig-flaeche') as HTMLCanvasElement | null;
  if (!flaeche) return;
  requestAnimationFrame(() => initUnterschrift(flaeche));
}

async function speichereUnterschrift(bild: string): Promise<void> {
  unterschriften[sigRolle] = bild;
  const t = await angezeigterToern();
  if (t) {
    const aktualisiert = await aendereToern(t.id, (jetzt) => (jetzt ? { ...jetzt, unterschriften: { ...unterschriften } } : null));
    if (aktualisiert) meldeWennLaufend(aktualisiert);
  }
  zeigeUnterschriftsStand();
  leereUnterschrift();
  $('tb-sig-modal')?.setAttribute('hidden', '');
  sigModal?.beimSchliessen();
}



let aufToern: (t: Toern | null) => void = () => {};


export function oeffneToernFenster(toernId?: string): void {
  const laden = toernId ? holeLokalenToern(toernId).catch(() => null) : aktuellerToern();
  void laden.then((t) => {
    $('tb-toern-modal')?.removeAttribute('hidden');
    toernModal?.beimOeffnen();
    const status = $('t-motor-status');
    if (status) status.textContent = '';
    angezeigteToernId = null;
    if (t) zeigeDetails(t);
    else void ladeUndZeigeAktiv();
  });
}


async function schliesseToernFenster(): Promise<void> {
  
  const details = $('tb-toern-details');
  if (laufendesSpeichern && (await laufendesSpeichern).fehler) return;
  if (ungespeichert && details && !details.hidden) {
    const { fehler } = await speichereJetzt();
    if (fehler) return;
  }
  const nochOhneAktiven = ($('tb-toern-keiner') as HTMLElement | null)?.hidden === false;
  $('tb-toern-modal')?.setAttribute('hidden', '');
  toernModal?.beimSchliessen();
  angezeigteToernId = null;
  if (nochOhneAktiven) aufToern(null);
}


export async function initToernAuswahl(melde: (t: Toern | null) => void): Promise<Toern | null> {
  aufToern = melde;

  const toernModalEl = $('tb-toern-modal');
  if (toernModalEl) toernModal = initModal(toernModalEl, schliesseToernFenster);
  const sigModalEl = $('tb-sig-modal');
  if (sigModalEl) {
    sigModal = initModal(sigModalEl, () => {
      sigModalEl.setAttribute('hidden', '');
      sigModal?.beimSchliessen();
    });
  }

  $('btn-toern')?.addEventListener('click', () => oeffneToernFenster());
  $('btn-toern-weg')?.addEventListener('click', () => void schliesseToernFenster());
  $('btn-toern-letzter')?.addEventListener('click', (e) => {
    const id = (e.currentTarget as HTMLElement).dataset['toern'];
    if (id) oeffneToernFenster(id);
  });
  $('btn-toern-fertig')?.addEventListener('click', () => void schliesseToernFenster());
  $('btn-motorstunden-speichern')?.addEventListener('click', () => void speichereJetzt());
  
  
  const eingaben = (z: EventTarget | null) => z instanceof HTMLInputElement
    && (z.id === 't-motorstunden' || z.id === 't-motorstunden-jetzt' || Boolean(z.closest('#t-tankliste')));
  const details = $('tb-toern-details');
  details?.addEventListener('input', (e) => { if (eingaben(e.target)) ungespeichert = true; });
  details?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement | null)?.closest?.('#t-tankliste .tank-weg')) { ungespeichert = true; void speichereJetzt(); }
  });
  details?.addEventListener('change', (e) => { if (eingaben(e.target) && ungespeichert) void speichereJetzt(); });
  const tankOrt = $('t-tankliste');
  if (tankOrt) tankliste = baueTankliste(tankOrt, aktuelleSprache, 't-tank');

  $('btn-sig-skipper')?.addEventListener('click', () => oeffneUnterschrift('skipper'));
  $('btn-sig-bewerber')?.addEventListener('click', () => oeffneUnterschrift('bewerber'));
  $('btn-sig-leeren')?.addEventListener('click', () => leereUnterschrift());
  $('btn-sig-weg')?.addEventListener('click', () => {
    $('tb-sig-modal')?.setAttribute('hidden', '');
    sigModal?.beimSchliessen();
  });
  $('btn-sig-ok')?.addEventListener('click', () => {
    const bild = unterschriftLesen();
    if (!bild) {
      alert(wort('unterschrift.leer'));
      return;
    }
    void speichereUnterschrift(bild);
  });

  const vorhanden = await aktuellerToern();
  
  
  if (!vorhanden) oeffneToernFenster();
  else {
    
    
    
    
    melde(vorhanden);
    
    void aktualisiereLaufendenToernVomServer(vorhanden);
  }
  return vorhanden;
}
