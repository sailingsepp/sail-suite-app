import { vorTon, nachTon } from './mikrofon';
import { glockenKlang, KLANG_ANNAEHERUNG, KLANG_BESTAETIGUNG, KLANG_FRAGE, KLANG_TIMER, KLANG_WEGPUNKT, KLANG_ZIEL } from '@/core/toene';

const ABTASTRATE = 8000;
const TON_HOCH = 880;
const TON_TIEF = 587;
const WECHSEL_S = 0.28;
const DAUER_S = 2.5;
const WIEDERHOLUNG_MS = 12_000;

const SIRENE_TIEF = 500;
const SIRENE_HOCH = 1150;

const SIRENE_HUB_S = 0.9;
const SIRENE_DAUER_S = 3.6;

const SIRENE_WIEDERHOLUNG_MS = 8_000;

let element: HTMLAudioElement | null = null;
let sireneElement: HTMLAudioElement | null = null;
let frei = false;

const entsperrt = new WeakSet<HTMLAudioElement>();
let wiederholung: ReturnType<typeof setTimeout> | null = null;
let sireneWiederholung: ReturnType<typeof setInterval> | null = null;

const uebernommen = new WeakSet<HTMLAudioElement>();

function abspielen(a: HTMLAudioElement): void {
  uebernommen.add(a);
  a.muted = false;
  a.currentTime = 0;
  a.volume = 1;
  void a.play().catch(() => {  });
}

function alsWav(daten: Int16Array): string {
  const kopf = new ArrayBuffer(44);
  const dv = new DataView(kopf);
  const text = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(pos + i, s.charCodeAt(i));
  };
  text(0, 'RIFF');
  dv.setUint32(4, 36 + daten.byteLength, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, ABTASTRATE, true);
  dv.setUint32(28, ABTASTRATE * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  text(36, 'data');
  dv.setUint32(40, daten.byteLength, true);

  const alles = new Uint8Array(44 + daten.byteLength);
  alles.set(new Uint8Array(kopf), 0);
  alles.set(new Uint8Array(daten.buffer), 44);
  let roh = '';
  for (let i = 0; i < alles.length; i++) roh += String.fromCharCode(alles[i]!);
  return 'data:audio/wav;base64,' + btoa(roh);
}

function baueWav(): string {
  const n = Math.round(ABTASTRATE * DAUER_S);
  const daten = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / ABTASTRATE;
    const hoch = Math.floor(t / WECHSEL_S) % 2 === 0;

    const imAbschnitt = (t % WECHSEL_S) / WECHSEL_S;
    const rampe = Math.min(1, imAbschnitt * 12, (1 - imAbschnitt) * 12);
    const aus = Math.min(1, (DAUER_S - t) * 4);
    const wert = Math.sin(2 * Math.PI * (hoch ? TON_HOCH : TON_TIEF) * t) * rampe * aus * 0.85;
    daten[i] = Math.max(-32768, Math.min(32767, Math.round(wert * 32767)));
  }
  return alsWav(daten);
}

function baueSirene(): string {
  const n = Math.round(ABTASTRATE * SIRENE_DAUER_S);
  const daten = new Int16Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / ABTASTRATE;

    const imHub = (t % SIRENE_HUB_S) / SIRENE_HUB_S;
    const anteil = imHub < 0.5 ? imHub * 2 : (1 - imHub) * 2;
    const f = SIRENE_TIEF + (SIRENE_HOCH - SIRENE_TIEF) * anteil;
    phase += (2 * Math.PI * f) / ABTASTRATE;
    const ein = Math.min(1, t * 20);
    const aus = Math.min(1, (SIRENE_DAUER_S - t) * 8);
    const wert = Math.sin(phase) * ein * aus * 0.9;
    daten[i] = Math.max(-32768, Math.min(32767, Math.round(wert * 32767)));
  }
  return alsWav(daten);
}

function hole(): HTMLAudioElement {
  if (element) return element;
  element = new Audio(baueWav());
  element.preload = 'auto';

  element.hidden = true;
  document.body.appendChild(element);
  return element;
}

export function entsperreTon(): void {
  if (frei) return;
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {  }

  const elemente = [hole(), holeSirene(), holeAnkerElement(), holeSprache(), ...HINWEISE.map(holeHinweis)]
    .filter((a) => !entsperrt.has(a));
  if (!elemente.length) { frei = true; return; }
  for (const a of elemente) {

    a.muted = true;
    void a.play().then(() => {
      entsperrt.add(a);
      if (elemente.every((e) => entsperrt.has(e))) frei = true;

      if (uebernommen.has(a)) return;
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    }).catch(() => {

      if (!uebernommen.has(a)) a.muted = false;
    });
  }
}

export function entsperreBeiBeruehrung(): void {
  const los = (): void => {
    entsperreTon();
    if (frei) { document.removeEventListener('touchend', los, true); document.removeEventListener('click', los, true); }
  };
  document.addEventListener('touchend', los, true);
  document.addEventListener('click', los, true);
}

export function warnton(): void {
  stoppeTon();
  const spiele = (): void => {

    vorTon();
    abspielen(hole());
    if (typeof navigator.vibrate === 'function') navigator.vibrate([400, 150, 400, 150, 700]);
  };
  spiele();
  wiederholung = setTimeout(spiele, WIEDERHOLUNG_MS);
}

export function stoppeTon(): void {
  nachTon();
  if (wiederholung) clearTimeout(wiederholung);
  wiederholung = null;
  if (element) {
    element.pause();
    element.currentTime = 0;
  }
}

function holeSirene(): HTMLAudioElement {
  if (sireneElement) return sireneElement;
  sireneElement = new Audio(baueSirene());
  sireneElement.preload = 'auto';
  sireneElement.hidden = true;
  document.body.appendChild(sireneElement);
  return sireneElement;
}

export function sirene(): void {
  stoppeSirene();
  const spiele = (): void => {

    vorTon();
    abspielen(holeSirene());

    if (typeof navigator.vibrate === 'function') navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
  };
  spiele();
  sireneWiederholung = setInterval(spiele, SIRENE_WIEDERHOLUNG_MS);
}

export function stoppeSirene(): void {
  nachTon();
  if (sireneWiederholung) clearInterval(sireneWiederholung);
  sireneWiederholung = null;
  if (sireneElement) {
    sireneElement.pause();
    sireneElement.currentTime = 0;
  }
}

const ANKER_TON = 740;
const ANKER_PULS_S = 0.22;
const ANKER_PAUSE_S = 0.18;
const ANKER_PULSE = 3;
const ANKER_DAUER_S = ANKER_PULSE * (ANKER_PULS_S + ANKER_PAUSE_S);

const ANKER_WIEDERHOLUNG_MS = 8_000;

let ankerElement: HTMLAudioElement | null = null;
let ankerWiederholung: ReturnType<typeof setInterval> | null = null;

function baueAnkerwacheWav(): string {
  const n = Math.round(ABTASTRATE * ANKER_DAUER_S);
  const daten = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / ABTASTRATE;
    const imZyklus = t % (ANKER_PULS_S + ANKER_PAUSE_S);
    if (imZyklus >= ANKER_PULS_S) { daten[i] = 0; continue; }

    const rampe = Math.min(1, imZyklus * 30, (ANKER_PULS_S - imZyklus) * 30);
    const wert = Math.sin(2 * Math.PI * ANKER_TON * t) * rampe * 0.85;
    daten[i] = Math.max(-32768, Math.min(32767, Math.round(wert * 32767)));
  }
  return alsWav(daten);
}

function holeAnkerElement(): HTMLAudioElement {
  if (ankerElement) return ankerElement;
  ankerElement = new Audio(baueAnkerwacheWav());
  ankerElement.preload = 'auto';
  ankerElement.hidden = true;
  document.body.appendChild(ankerElement);
  return ankerElement;
}

export function ankersirene(): void {
  stoppeAnkersirene();
  const spiele = (): void => {

    vorTon();
    abspielen(holeAnkerElement());

    if (typeof navigator.vibrate === 'function') navigator.vibrate([250, 150, 250, 150, 250]);
  };
  spiele();
  ankerWiederholung = setInterval(spiele, ANKER_WIEDERHOLUNG_MS);
}

export function stoppeAnkersirene(): void {
  nachTon();
  if (ankerWiederholung) clearInterval(ankerWiederholung);
  ankerWiederholung = null;
  if (ankerElement) {
    ankerElement.pause();
    ankerElement.currentTime = 0;
  }
}

type Hinweis = 'bestaetigung' | 'frage' | 'wegpunkt' | 'ziel' | 'annaeherung' | 'timer';
const HINWEISE: Hinweis[] = ['bestaetigung', 'frage', 'wegpunkt', 'ziel', 'annaeherung', 'timer'];
const KLAENGE = {
  bestaetigung: KLANG_BESTAETIGUNG, frage: KLANG_FRAGE, wegpunkt: KLANG_WEGPUNKT, ziel: KLANG_ZIEL,
  annaeherung: KLANG_ANNAEHERUNG, timer: KLANG_TIMER,
};
const hinweisElemente = new Map<Hinweis, HTMLAudioElement>();

function holeHinweis(h: Hinweis): HTMLAudioElement {
  const da = hinweisElemente.get(h);
  if (da) return da;
  const k = KLAENGE[h];
  const a = new Audio(alsWav(glockenKlang(k.noten, k.dauerS, k.tauS, ABTASTRATE)));
  a.preload = 'auto';
  a.hidden = true;
  document.body.appendChild(a);
  hinweisElemente.set(h, a);
  return a;
}

function hinweis(h: Hinweis): void {

  vorTon(Math.ceil(KLAENGE[h].dauerS * 1000) + 500);
  abspielen(holeHinweis(h));
}

export function timerton(): void { hinweis('timer'); }

export function stoppeTimerton(): void {
  const a = hinweisElemente.get('timer');
  if (a && !a.paused) { a.pause(); a.currentTime = 0; nachTon(); }
}

let sprachElement: HTMLAudioElement | null = null;
const STILLE = alsWav(new Int16Array(400));
function holeSprache(): HTMLAudioElement {
  if (sprachElement) return sprachElement;
  sprachElement = new Audio(STILLE);
  sprachElement.preload = 'auto';
  sprachElement.hidden = true;
  document.body.appendChild(sprachElement);
  return sprachElement;
}

export function spracheFrei(): boolean { return !!sprachElement && entsperrt.has(sprachElement); }

export function spieleSprache(wav: Blob, dauerMs: number): Promise<boolean> {
  const a = holeSprache();
  const url = URL.createObjectURL(wav);
  vorTon(dauerMs + 500);
  return new Promise<boolean>((ok) => {
    let fertig = false;
    const ende = (gespielt: boolean): void => {
      if (fertig) return;
      fertig = true;
      a.removeEventListener('ended', zuEnde);
      a.removeEventListener('error', fehler);
      URL.revokeObjectURL(url);
      ok(gespielt);
    };
    const zuEnde = (): void => ende(true);
    const fehler = (): void => ende(false);
    a.addEventListener('ended', zuEnde);
    a.addEventListener('error', fehler);
    uebernommen.add(a);
    a.muted = false;
    a.src = url;
    a.volume = 1;
    void a.play().catch(() => ende(false));

    setTimeout(() => ende(true), dauerMs + 3000);
  });
}

export function ersatzton(art: 'bestaetigung' | 'frage' | 'wegpunkt' | 'ziel' | 'annaeherung'): void { hinweis(art); }

