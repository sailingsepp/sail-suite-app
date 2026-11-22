import {
  bildMass, blitzeAusBild, neuesterSchritt, schritte, type Blitz, type BlitzBox,
} from '@/core/blitze';


const WMS = 'https://view.eumetsat.int/geoserver/ows';
const CAPS = 'https://view.eumetsat.int/geoserver/mtg_fd/li_afa/ows?service=WMS&request=GetCapabilities&version=1.3.0';
const EBENE = 'mtg_fd:li_afa';

const CAPS_NEU_MS = 2 * 60_000;
const ZEITLIMIT_MS = 20_000;
const BILDER_MAX = 200;

let neuester: { t: number; geholt: number } | null = null;
const bilder = new Map<string, Blitz[]>();

export function blitzBildUrl(b: BlitzBox, t: number): string {
  const { breite, hoehe } = bildMass(b);
  
  return `${WMS}?service=WMS&version=1.3.0&request=GetMap&layers=${EBENE}&styles=&crs=EPSG:4326`
    + `&bbox=${b.s},${b.w},${b.n},${b.o}&width=${breite}&height=${hoehe}&format=image/png&transparent=true`
    + `&time=${new Date(t).toISOString().replace('.000Z', 'Z')}`;
}

async function holeNeuesten(jetzt: number): Promise<number | null> {
  if (neuester && jetzt - neuester.geholt < CAPS_NEU_MS) return neuester.t;
  const r = await fetch(CAPS, { signal: AbortSignal.timeout(ZEITLIMIT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const t = neuesterSchritt(await r.text());
  if (t !== null) neuester = { t, geholt: jetzt };
  return t;
}


export type Entpacker = (blob: Blob, breite: number, hoehe: number) => Promise<ArrayLike<number>>;
const canvasEntpacker: Entpacker = async (blob, breite, hoehe) => {
  const bmp = await createImageBitmap(blob);
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(breite, hoehe) : Object.assign(document.createElement('canvas'), { width: breite, height: hoehe });
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('kein Canvas');
  ctx.drawImage(bmp, 0, 0, breite, hoehe);
  bmp.close?.();
  return ctx.getImageData(0, 0, breite, hoehe).data;
};

async function holeSchritt(b: BlitzBox, t: number, entpacke: Entpacker): Promise<Blitz[]> {
  const url = blitzBildUrl(b, t);
  const da = bilder.get(url);
  if (da) return da;
  const r = await fetch(url, { signal: AbortSignal.timeout(ZEITLIMIT_MS) });
  if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/png')) throw new Error(`HTTP ${r.status}`);
  const { breite, hoehe } = bildMass(b);
  const blitze = blitzeAusBild(await entpacke(await r.blob(), breite, hoehe), breite, hoehe, b, t);
  if (bilder.size >= BILDER_MAX) bilder.delete(bilder.keys().next().value!);
  bilder.set(url, blitze);
  return blitze;
}

export type BlitzStand = { blitze: Blitz[]; neuester: number; fehlend: number };


export async function holeBlitze(b: BlitzBox, fensterMin: number, jetzt = Date.now(), entpacke: Entpacker = canvasEntpacker): Promise<BlitzStand> {
  const t = await holeNeuesten(jetzt);
  if (t === null) throw new Error('kein Zeitschritt');
  let fehlend = 0;
  const alle = await Promise.all(schritte(t, fensterMin).map((s) => holeSchritt(b, s, entpacke).catch(() => { fehlend++; return [] as Blitz[]; })));
  if (fehlend === alle.length) throw new Error('keine Bilder');
  return { blitze: alle.flat(), neuester: t, fehlend };
}



export function _vergessen(): void { neuester = null; bilder.clear(); }
