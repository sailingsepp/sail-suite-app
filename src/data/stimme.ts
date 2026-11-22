import type { VoiceId } from '@diffusionstudio/vits-web';

export const STIMME_ID: VoiceId = 'en_GB-alba-medium';
export const STIMME_NAME = 'Ellen';

interface Konfig {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  speaker_id_map: Record<string, number>;
}
type Ort = typeof import('onnxruntime-web');
interface Bereit { ort: Ort; sitzung: import('onnxruntime-web').InferenceSession; konfig: Konfig; wasmBasis: string }

let laden: Promise<Bereit> | null = null;

export function stimmeMoeglich(): boolean {
  return typeof navigator !== 'undefined' && 'storage' in navigator && typeof navigator.storage.getDirectory === 'function';
}

async function ordner(): Promise<FileSystemDirectoryHandle> {
  return (await navigator.storage.getDirectory()).getDirectoryHandle('piper', { create: true });
}

async function datei(url: string, fortschritt?: (anteil: number) => void): Promise<Blob> {
  const name = url.split('/').at(-1)!;
  const dir = await ordner();
  try {
    const f = await (await dir.getFileHandle(name)).getFile();
    if (f.size > 0) return f;
  } catch {  }
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`Stimme: ${name} ${r.status}`);
  const gesamt = Number(r.headers.get('Content-Length') ?? 0);
  const leser = r.body.getReader();
  const teile: Uint8Array[] = [];
  let geladen = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    teile.push(value);
    geladen += value.length;
    if (gesamt > 0) fortschritt?.(geladen / gesamt);
  }
  const blob = new Blob(teile as BlobPart[]);

  try {
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(blob);
    await w.close();
  } catch {  }
  return blob;
}

export function ladeStimme(fortschritt?: (anteil: number) => void): Promise<void> {
  if (!laden) {
    laden = (async (): Promise<Bereit> => {
      const vits = await import('@diffusionstudio/vits-web');
      const pfad = vits.PATH_MAP[STIMME_ID];

      const basis = `${vits.HF_BASE}/${pfad}`;
      const [modell, konfigBlob] = await Promise.all([datei(basis, fortschritt), datei(`${basis}.json`)]);
      const konfig = JSON.parse(await konfigBlob.text()) as Konfig;
      const ort = await import('onnxruntime-web');
      ort.env.allowLocalModels = false;
      ort.env.wasm.wasmPaths = vits.ONNX_BASE;

      ort.env.wasm.numThreads = 1;
      const sitzung = await ort.InferenceSession.create(new Uint8Array(await modell.arrayBuffer()));
      return { ort, sitzung, konfig, wasmBasis: vits.WASM_BASE };
    })();
    laden.catch(() => { laden = null; });
  }
  return laden.then(() => undefined);
}

async function phoneme(text: string, b: Bereit): Promise<number[]> {
  const { createPiperPhonemize } = await import('piper-phonemize-intern');
  return new Promise<number[]>((ok, fehler) => {
    void createPiperPhonemize({
      print: (zeile) => {
        try { ok((JSON.parse(zeile) as { phoneme_ids: number[] }).phoneme_ids); } catch (e) { fehler(e); }
      },
      printErr: (zeile) => fehler(new Error(zeile)),
      locateFile: (d) => (d.endsWith('.wasm') ? `${b.wasmBasis}.wasm` : d.endsWith('.data') ? `${b.wasmBasis}.data` : d),
    }).then((m) => m.callMain(['-l', b.konfig.espeak.voice, '--input', JSON.stringify([{ text: text.trim() }]), '--espeak_data', '/espeak-ng-data']))
      .catch(fehler);
  });
}

export const VORLAUF_MS = 400;

export function alsWav(daten: Float32Array, rate: number): Blob {
  const vorlauf = Math.round((rate * VORLAUF_MS) / 1000);
  const n = vorlauf + daten.length;
  const kopf = 44, dv = new DataView(new ArrayBuffer(kopf + n * 2));
  const text = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  text(36, 'data'); dv.setUint32(40, n * 2, true);

  for (let i = 0; i < daten.length; i++) {
    const s = Math.max(-1, Math.min(1, daten[i]!));
    dv.setInt16(kopf + (vorlauf + i) * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return new Blob([dv.buffer], { type: 'audio/wav' });
}

let kette: Promise<unknown> = Promise.resolve();

export function sprich(text: string): Promise<Blob> {
  const lauf = kette.then(async () => {
    await ladeStimme();
    const b = await laden!;
    const ids = await phoneme(text, b);
    const { ort, sitzung, konfig } = b;
    const eingabe: Record<string, import('onnxruntime-web').Tensor> = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from([konfig.inference.noise_scale, konfig.inference.length_scale, konfig.inference.noise_w]), [3]),
    };
    if (Object.keys(konfig.speaker_id_map).length) eingabe['sid'] = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
    const aus = await sitzung.run(eingabe);
    return alsWav(aus['output']!.data as Float32Array, konfig.audio.sample_rate);
  });
  kette = lauf.catch(() => undefined);
  return lauf;
}
