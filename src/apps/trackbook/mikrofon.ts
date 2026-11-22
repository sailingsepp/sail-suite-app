
import { klangMessung } from '@/core/motorklang';
import type { KlangMessung } from '@/core/antriebKlang';

const SCHALTER_KEY = 'sail-suite:motorklang-an';

const PUFFER_S = 3;

export type MikrofonStatus = 'aus' | 'wartet' | 'tippen' | 'laeuft' | 'verweigert' | 'fehlt';

interface Mitschnitt {
  ctx: AudioContext;
  stream: MediaStream;
  quelle: MediaStreamAudioSourceNode;
  proc: ScriptProcessorNode;
  stumm: GainNode;
}

let m: Mitschnitt | null = null;
let puffer: Float32Array | null = null;
let fs = 48000;
let schreib = 0;
let gefuellt = 0;
let oeffnet = false;
let soll = false;

let schonBis = 0;
let status: MikrofonStatus = 'aus';

let tonBis = 0;
const tonLaeuft = (): boolean => Date.now() < tonBis;
const hoerer = new Set<(s: MikrofonStatus) => void>();

function setzeStatus(s: MikrofonStatus): void {
  if (s === status) return;
  status = s;
  for (const h of hoerer) h(s);
}

export function mikrofonStatus(): MikrofonStatus { return status; }
export function aufMikrofonStatus(fn: (s: MikrofonStatus) => void): void { hoerer.add(fn); }

export function motorklangAn(): boolean {
  try { return localStorage.getItem(SCHALTER_KEY) === '1'; } catch { return false; }
}
export function setzeMotorklangAn(an: boolean): void {
  try { localStorage.setItem(SCHALTER_KEY, an ? '1' : '0'); } catch {  }
  if (!an) schliesse('aus');
}

function sitzung(typ: 'play-and-record' | 'playback'): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = typ;
  } catch {  }
}

function schliesse(neu: MikrofonStatus): void {
  if (m) {
    try { m.proc.disconnect(); m.quelle.disconnect(); m.stumm.disconnect(); } catch {  }
    m.stream.getTracks().forEach((t) => t.stop());
    void m.ctx.close().catch(() => {});
    m = null;
    sitzung('playback');
  }
  puffer = null;
  gefuellt = 0;
  setzeStatus(neu);
}

async function oeffne(): Promise<void> {
  if (m || oeffnet || tonLaeuft()) return;
  if (!navigator.mediaDevices?.getUserMedia) { setzeStatus('fehlt'); return; }
  oeffnet = true;
  try {
    sitzung('play-and-record');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    });
    if (!soll || tonLaeuft()) { stream.getTracks().forEach((t) => t.stop()); sitzung('playback'); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    await ctx.resume().catch(() => {});
    const quelle = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const stumm = ctx.createGain();
    stumm.gain.value = 0;
    fs = ctx.sampleRate;
    puffer = new Float32Array(Math.round(fs * PUFFER_S));
    schreib = 0;
    gefuellt = 0;
    proc.onaudioprocess = (e) => {
      const x = e.inputBuffer.getChannelData(0);
      const p = puffer;
      if (!p) return;
      for (let i = 0; i < x.length; i++) {
        p[schreib] = x[i]!;
        schreib = (schreib + 1) % p.length;
      }
      gefuellt = Math.min(p.length, gefuellt + x.length);
    };
    quelle.connect(proc);
    proc.connect(stumm);
    stumm.connect(ctx.destination);
    m = { ctx, stream, quelle, proc, stumm };
    setzeStatus(ctx.state === 'running' ? 'laeuft' : 'tippen');
  } catch (e) {
    sitzung('playback');
    const name = (e as { name?: string })?.name;
    setzeStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'verweigert' : 'tippen');
  } finally {
    oeffnet = false;
  }
}


export function mikrofonSoll(an: boolean): void {
  if (!an && Date.now() < schonBis) return;
  soll = an && motorklangAn();
  if (!soll) { if (m || status !== 'aus') schliesse('aus'); return; }
  if (!m && status === 'aus') setzeStatus('tippen');
  if (m && m.ctx.state !== 'running') setzeStatus('tippen');
}


export function mikrofonStarten(): void {
  if (!motorklangAn()) return;
  soll = true;
  schonBis = Date.now() + 15_000;
  beiBeruehrung();
}


export function beiBeruehrung(): void {
  if (!soll || tonLaeuft()) return;
  if (!m) { void oeffne(); return; }
  if (m.ctx.state !== 'running') {
    void m.ctx.resume().then(() => setzeStatus(m?.ctx.state === 'running' ? 'laeuft' : 'tippen')).catch(() => {});
  }
}


export function vorTon(dauerMs = 15_000): void {
  tonBis = Math.max(tonBis, Date.now() + dauerMs);
  if (m) schliesse(soll ? 'tippen' : 'aus');
}

export function nachTon(): void {
  tonBis = 0;
}


export function klangJetzt(): KlangMessung | null {
  if (!m || !puffer || m.ctx.state !== 'running' || gefuellt < puffer.length) return null;
  if (status !== 'laeuft') setzeStatus('laeuft');
  
  const x = new Float32Array(puffer.length);
  x.set(puffer.subarray(schreib));
  x.set(puffer.subarray(0, schreib), puffer.length - schreib);
  return klangMessung(x, fs);
}


export function initMikrofon(): void {
  document.addEventListener('pointerdown', beiBeruehrung, { passive: true });
  
  
  
  document.addEventListener('click', beiBeruehrung, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && m && m.ctx.state !== 'running') setzeStatus('tippen');
  });
}
