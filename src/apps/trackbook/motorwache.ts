import { nf, uhrLtVon } from '@/core/time';
import { distNM } from '@/core/geo';
import { boatById } from '@/core/boats';
import type { BoatPolar } from '@/core/polar';
import type { SpurAuswertung } from '@/core/spur';
import { laufBeginn, vorschlag, type Beobachtung } from '@/core/motorerkennung';
import { beurteileKlang, KLANG, KLANG_HALTEN, type KlangBefund, type KlangMessung } from '@/core/antriebKlang';
import { OBERTON_K } from '@/core/motorklang';
import type { Toern } from '@/data/logdb';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { STRINGS } from './strings';
import { versorgeWetter, windJetzt } from './wetter';
import { sage, verwirf } from './ansage';
import { ANSAGE } from '@/core/ansagen';
import { klangJetzt, mikrofonSoll } from './mikrofon';
import type { Zustand } from './aufzeichnung';




const RUHE_NACH_NEIN_MS = 20 * 60_000;

const RUHE_NACH_HAND_MS = 5 * 60_000;

const BEOBACHTUNGEN_MAX = 200;

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;


interface WachBeobachtung extends Beobachtung {
  lat: number | null;
  lon: number | null;
}

let beobachtungen: WachBeobachtung[] = [];
let letzterTakt = 0;
let abgelehntBis = 0;
let offen: 'motor' | 'segel' | null = null;

let offenSeit: { t: number; lat: number; lon: number } | null = null;
let boot: BoatPolar | undefined;
let letzteMessung: KlangMessung | null = null;
let setzeAntriebFn: (a: 'segel' | 'motor', erkanntBei?: { t: number; lat: number; lon: number }) => void = () => {};


export function motorwacheToern(t: Toern | null): void {
  boot = t?.schiff?.polarId ? boatById(t.schiff.polarId) : undefined;
}


export function letzterKlang(): KlangMessung | null { return letzteMessung; }


function begruendung(
  was: 'motor' | 'segel', k: KlangMessung, sog: number, twa: number | null, seit: number, de: boolean,
): string {
  const kn = (x: number) => nf(x, 1, de ? 'de' : 'en');
  const ober = `${k.treffer}/${OBERTON_K}`;
  const uhr = uhrLtVon(seit);
  if (was === 'motor') {
    return de
      ? `Motorgeräusch seit ${uhr}: ${ober} Obertöne über dem Grundgeräusch bei ${kn(k.f0)} Hz, ${kn(sog)} kn Fahrt.`
      : `Engine sound since ${uhr}: ${ober} harmonics above the background at ${kn(k.f0)} Hz, ${kn(sog)} kn over ground.`;
  }
  const wind = twa === null ? '' : de
    ? `, ${Math.round(twa)}° zum vorhergesagten Wind`
    : `, ${Math.round(twa)}° off the forecast wind`;
  return de
    ? `Kein Motorgeräusch seit ${uhr} (${ober} Obertöne), ${kn(sog)} kn Fahrt${wind}.`
    : `No engine sound since ${uhr} (${ober} harmonics), ${kn(sog)} kn over ground${wind}.`;
}

function zeigeFrage(
  was: 'motor' | 'segel', k: KlangMessung, sog: number, twa: number | null,
  erkanntBei: { t: number; lat: number; lon: number },
): void {
  offen = was;
  offenSeit = erkanntBei;
  const de = aktuelleSprache() === 'de';
  const titel = $('tb-motor-titel');
  if (titel) titel.textContent = wort(was === 'motor' ? 'motorwache.frageMotor' : 'motorwache.frageSegel');
  const grund = $('tb-motor-grund');
  if (grund) grund.textContent = begruendung(was, k, sog, twa, erkanntBei.t, de);
  const ja = $('btn-motor-ja');
  if (ja) ja.textContent = wort(was === 'motor' ? 'motorwache.jaMotor' : 'motorwache.jaSegel');
  $('tb-motor-modal')?.removeAttribute('hidden');
  motorModal?.beimOeffnen();
  
  sagFrage(was);
}

let wiederholung: ReturnType<typeof setTimeout> | null = null;
function sagFrage(was: 'motor' | 'segel'): void {
  const text = was === 'motor' ? ANSAGE.motor : ANSAGE.segel;
  sage(text, 'frage', 30_000);
  if (wiederholung) clearTimeout(wiederholung);
  wiederholung = setTimeout(() => { wiederholung = null; if (offen === was) sage(text, 'frage', 30_000); }, 15_000);
}

function schliesseFrage(): void {
  offen = null;
  offenSeit = null;
  if (wiederholung) { clearTimeout(wiederholung); wiederholung = null; }
  verwirf((t) => t === ANSAGE.motor || t === ANSAGE.segel);
  $('tb-motor-modal')?.setAttribute('hidden', '');
  motorModal?.beimSchliessen();
}

let motorModal: ModalHandle | null = null;


export function pruefeMotorwache(z: Zustand, a: SpurAuswertung): void {
  
  const laeuft = z.betriebsart === 'laeuft';
  mikrofonSoll(laeuft);
  if (!laeuft) return;

  
  if (z.position) versorgeWetter(z.position.lat, z.position.lon, z.fahrt?.id);
  if (offen) return;

  const jetzt = Date.now();
  if (jetzt - letzterTakt < KLANG.taktMs) return;
  letzterTakt = jetzt;

  const klang = klangJetzt();
  letzteMessung = klang;
  if (!klang) return;

  const wind = windJetzt();
  const start = a.punkte[0];
  const pos = z.position;
  const befund: KlangBefund = beurteileKlang({
    klang,
    sog: z.wartetAufFix ? null : z.sog,
    cog: z.cog,
    wind: wind ? { aus: wind.dir, kn: wind.speed, kn80: wind.speed80 ?? null } : null,
    ...(boot ? { boot } : {}),
    abstandStartNM: start && pos ? distNM(start.lat, start.lon, pos.lat, pos.lon) : null,
  });
  beobachtungen.push({ t: jetzt, urteil: befund.urteil, lat: pos?.lat ?? null, lon: pos?.lon ?? null });
  if (beobachtungen.length > BEOBACHTUNGEN_MAX) beobachtungen = beobachtungen.slice(-BEOBACHTUNGEN_MAX);

  const was = vorschlag(beobachtungen, z.antrieb, abgelehntBis, jetzt, KLANG_HALTEN);
  if (!was || !pos) return;
  const twa = wind && z.cog !== null ? Math.abs(((z.cog - wind.dir + 540) % 360) - 180) : null;
  zeigeFrage(was, klang, z.sog, twa, wechselBei(z, was, { t: jetzt, lat: pos.lat, lon: pos.lon }));
}


function wechselBei(
  z: Zustand, was: 'motor' | 'segel', jetzt: { t: number; lat: number; lon: number },
): { t: number; lat: number; lon: number } {
  const beginn = laufBeginn(beobachtungen, was);
  const ab = beginn ? beobachtungen.indexOf(beginn) : -1;
  const mitOrt = ab < 0 ? undefined
    : beobachtungen.slice(ab).find((b) => b.urteil === was && b.lat !== null && b.lon !== null);
  let t = beginn?.t ?? jetzt.t;
  const untergrenze = Math.max(
    z.fahrt?.begonnen ?? 0,
    ...z.eintraege.filter((e) => e.art === 'antrieb').map((e) => e.t + 1),
  );
  t = Math.min(jetzt.t, Math.max(t, untergrenze));
  return mitOrt ? { t, lat: mitOrt.lat!, lon: mitOrt.lon! } : { ...jetzt, t };
}


export function motorwacheVonHand(): void {
  beobachtungen = [];
  abgelehntBis = Date.now() + RUHE_NACH_HAND_MS;
  schliesseFrage();
}


export function motorwacheZuruecksetzen(): void {
  beobachtungen = [];
  letzterTakt = 0;
  abgelehntBis = 0;
  schliesseFrage();
}

export function initMotorwache(
  setzeAntrieb: (a: 'segel' | 'motor', erkanntBei?: { t: number; lat: number; lon: number }) => void,
): void {
  setzeAntriebFn = setzeAntrieb;
  const modalEl = $('tb-motor-modal');
  if (modalEl) motorModal = initModal(modalEl, schliesseFrage);

  $('btn-motor-ja')?.addEventListener('click', () => {
    const was = offen;
    
    const erkanntBei = offenSeit;
    schliesseFrage();
    if (was) setzeAntriebFn(was, erkanntBei ?? undefined);
    
    
    beobachtungen = [];
  });

  $('btn-motor-nein')?.addEventListener('click', () => {
    schliesseFrage();
    abgelehntBis = Date.now() + RUHE_NACH_NEIN_MS;
    beobachtungen = [];
  });
}
