import type { BriefingAbschnitt } from '@/briefing';
import type { Sprache } from '@/core/types';
import type { VoiceId } from '@diffusionstudio/vits-web';
import { vorleseHaeppchen } from '@/briefing/vorlesen';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { icon, type IconName } from '@/shell/icons';

type VitsWeb = typeof import('@diffusionstudio/vits-web');

const STIMMEN: Record<Sprache, { id: VoiceId; name: string }> = {
  de: { id: 'de_DE-thorsten-medium', name: 'Horst-Uwe' },
  en: { id: 'en_GB-alba-medium', name: 'Ellen' },
};

let modul: Promise<VitsWeb> | null = null;
function ladeModul(): Promise<VitsWeb> {
  if (!modul) modul = import('@diffusionstudio/vits-web');
  return modul;
}

function unterstuetzt(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator
    && typeof navigator.storage.getDirectory === 'function';
}

let generation = 0;
let sequenzLaeuft = false;
let laufendesAudio: HTMLAudioElement | null = null;
let aktivBtn: HTMLButtonElement | null = null;
let aktivFehlerEl: HTMLElement | null = null;
let laufendeStimme: { id: VoiceId; name: string; sprache: Sprache } | null = null;

function stoppen(): void {
  generation++;
  sequenzLaeuft = false;
  if (laufendesAudio) { laufendesAudio.pause(); laufendesAudio = null; }
}

let vorleseAudio: HTMLAudioElement | null = null;
function holeAudio(): HTMLAudioElement {
  if (vorleseAudio) return vorleseAudio;
  const a = document.createElement('audio');
  a.hidden = true;
  a.preload = 'auto';
  document.body.appendChild(a);
  a.addEventListener('play', () => {
    if (laufendeStimme && laufendesAudio === a) aktualisiereKnopf('pause', fortschrittsText('pause', laufendeStimme.sprache, laufendeStimme.name));
  });
  a.addEventListener('pause', () => {

    if (!a.ended && laufendeStimme && laufendesAudio === a) aktualisiereKnopf('start', fortschrittsText('weiter', laufendeStimme.sprache, laufendeStimme.name));
  });
  vorleseAudio = a;
  return a;
}

function stilleWav(): string {
  const n = 400, bytes = new Uint8Array(44 + n * 2), d = new DataView(bytes.buffer);
  const text = (o: number, t: string): void => { for (let i = 0; i < t.length; i++) bytes[o + i] = t.charCodeAt(i); };
  text(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
  text(36, 'data'); d.setUint32(40, n * 2, true);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return 'data:audio/wav;base64,' + btoa(bin);
}

function entsperreAudio(a: HTMLAudioElement): void {
  try {

    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch {  }
  a.src = stilleWav();
  void a.play().catch(() => {  });
}

function spieleAb(a: HTMLAudioElement, wav: Blob): Promise<void> {
  const url = URL.createObjectURL(wav);
  return new Promise<void>((resolve, reject) => {
    const fertig = (): void => {
      a.removeEventListener('loadeddata', geladen);
      a.removeEventListener('ended', zuEnde);
      a.removeEventListener('error', fehler);
      URL.revokeObjectURL(url);
    };
    const geladen = (): void => { a.play().catch((e: unknown) => { fertig(); reject(e); }); };
    const zuEnde = (): void => { fertig(); resolve(); };
    const fehler = (): void => { fertig(); reject(new Error('Wiedergabefehler bei der Sprachausgabe')); };
    a.addEventListener('loadeddata', geladen);
    a.addEventListener('ended', zuEnde);
    a.addEventListener('error', fehler);
    a.src = url;
  });
}

function fehlerZeigen(text: string): void {
  if (!aktivFehlerEl) return;
  aktivFehlerEl.textContent = text;
  aktivFehlerEl.removeAttribute('hidden');
}

function aktualisiereKnopf(iconName: IconName, text: string, disabled = false): void {
  if (!aktivBtn) return;
  aktivBtn.innerHTML = icon(iconName) + `<span class="brief-aktion-text">${text}</span>`;
  aktivBtn.disabled = disabled;
}

function fortschrittsText(zustand: 'pause' | 'weiter', sprache: Sprache, name: string): string {
  const wort = sprache === 'en'
    ? (zustand === 'pause' ? 'Pause' : 'Resume')
    : (zustand === 'pause' ? 'Pause' : 'Weiter');
  return `${wort} · ${name}`;
}

let letzteAbschnitte: BriefingAbschnitt[] | null = null;
let sprachwechselGebunden = false;

export function initVorlesen(abschnitte: BriefingAbschnitt[]): void {
  letzteAbschnitte = abschnitte;
  if (!sprachwechselGebunden) {
    sprachwechselGebunden = true;

    aufSprachwechsel(() => { if (!sequenzLaeuft && letzteAbschnitte) initVorlesen(letzteAbschnitte); });
  }
  const btn = document.getElementById('btn-vorlesen') as HTMLButtonElement | null;
  const fehlerEl = document.getElementById('brief-audio-fehler');
  if (!btn) return;
  aktivBtn = btn;
  aktivFehlerEl = fehlerEl;

  if (sequenzLaeuft && laufendeStimme) {
    const stimme = laufendeStimme;
    const spracheLaufend = stimme.sprache;
    fehlerEl?.setAttribute('hidden', '');
    aktualisiereKnopf(
      laufendesAudio ? (laufendesAudio.paused ? 'start' : 'pause') : 'lautsprecher',
      laufendesAudio
        ? fortschrittsText(laufendesAudio.paused ? 'weiter' : 'pause', spracheLaufend, stimme.name)
        : (spracheLaufend === 'en' ? 'Loading …' : 'Wird geladen …'),
      laufendesAudio === null,
    );
    btn.title = spracheLaufend === 'en'
      ? `Playing back with "${stimme.name}": Piper (open source), running locally in the browser.`
      : `Sprachausgabe von „${stimme.name}" läuft: Piper (Open Source), lokal im Browser.`;
    btn.onclick = () => { void klick(abschnitte); };
    return;
  }

  stoppen();
  fehlerEl?.setAttribute('hidden', '');
  const sprache = aktuelleSprache();
  const stimme = STIMMEN[sprache];
  const kannDas = unterstuetzt();
  btn.innerHTML = icon('lautsprecher') + `<span class="brief-aktion-text">${sprache === 'en' ? 'Read aloud' : 'Vorlesen'}</span>`;
  btn.disabled = !kannDas;
  btn.title = sprache === 'en'
    ? (kannDas ? stimme.name : 'This browser does not support the local file storage the voice needs.')
    : (kannDas ? stimme.name : 'Dieser Browser unterstützt die für die Sprachausgabe nötige lokale Dateiablage nicht.');
  btn.onclick = () => { void klick(abschnitte); };
}

async function klick(abschnitte: BriefingAbschnitt[]): Promise<void> {
  if (sequenzLaeuft) {

    if (laufendesAudio) {
      if (laufendesAudio.paused) void laufendesAudio.play();
      else laufendesAudio.pause();
    }
    return;
  }

  const sprache = aktuelleSprache();
  const stimme = STIMMEN[sprache];
  laufendeStimme = { ...stimme, sprache };

  aktivFehlerEl?.setAttribute('hidden', '');
  const audio = holeAudio();
  entsperreAudio(audio);
  sequenzLaeuft = true;
  const meineGeneration = ++generation;
  aktualisiereKnopf('lautsprecher', sprache === 'en' ? 'Loading …' : 'Wird geladen …', true);

  try {
    const tts = await ladeModul();
    const schonDa = await tts.stored();
    if (!schonDa.includes(stimme.id)) {
      await tts.download(stimme.id, (fortschritt) => {
        if (meineGeneration !== generation) return;
        const pct = fortschritt.total > 0 ? Math.round((fortschritt.loaded / fortschritt.total) * 100) : 0;
        aktualisiereKnopf(
          'lautsprecher',
          sprache === 'en' ? `Loading ${stimme.name} … ${pct}%` : `${stimme.name} lädt … ${pct}%`,
          true,
        );
      });
    }
    if (meineGeneration !== generation) return;

    const haeppchen = vorleseHaeppchen(abschnitte, sprache);

    for (let i = 0; i < haeppchen.length; i++) {
      if (meineGeneration !== generation) return;
      if (i === 0) aktualisiereKnopf('lautsprecher', sprache === 'en' ? 'Getting ready …' : 'Wird vorbereitet …', true);
      const wav = await tts.predict({ text: haeppchen[i]!, voiceId: stimme.id });
      if (meineGeneration !== generation) return;

      laufendesAudio = audio;
      aktualisiereKnopf('pause', fortschrittsText('pause', sprache, stimme.name));
      await spieleAb(audio, wav);
      laufendesAudio = null;
    }

    if (meineGeneration === generation) {
      aktualisiereKnopf('lautsprecher', sprache === 'en' ? 'Read aloud again' : 'Nochmal vorlesen');
    }
  } catch (err) {
    if (meineGeneration !== generation) return;

    console.error('Sprachausgabe fehlgeschlagen', err);
    fehlerZeigen(sprache === 'en'
      ? 'Voice playback isn\'t available right now: the speech model could not be loaded or played.'
      : 'Sprachausgabe momentan nicht möglich: Sprachmodell konnte nicht geladen oder nicht abgespielt werden.');
    aktualisiereKnopf('lautsprecher', sprache === 'en' ? 'Read aloud' : 'Vorlesen');
  } finally {

    if (meineGeneration === generation) {
      sequenzLaeuft = false;
      laufendesAudio = null;
      laufendeStimme = null;
    }
  }
}
