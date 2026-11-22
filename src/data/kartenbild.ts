import { waehleAusschnitt, kachelnFuer, KACHEL_PX, type Ausschnitt } from '@/core/kachelkarte';


export interface Kartenbild {
  datenUri: string;
  ausschnitt: Ausschnitt;
  seezeichen: boolean;
}


async function ladeKachel(url: string, zeitMs: number): Promise<HTMLImageElement | null> {
  try {
    const antwort = await fetch(url, { mode: 'cors', signal: AbortSignal.timeout(zeitMs) });
    if (!antwort.ok) return null;
    const ou = URL.createObjectURL(await antwort.blob());
    return await new Promise((res) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(ou); res(img); };
      img.onerror = () => { URL.revokeObjectURL(ou); res(null); };
      img.src = ou;
    });
  } catch {
    return null;
  }
}

export async function kartenbild(
  punkte: readonly { lat: number; lon: number }[], breitePx: number, hoehePx: number,
): Promise<Kartenbild | null> {
  const a = waehleAusschnitt(punkte, breitePx, hoehePx);
  if (!a) return null;
  const kacheln = kachelnFuer(a);
  const canvas = document.createElement('canvas');
  canvas.width = breitePx;
  canvas.height = hoehePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#aad3df'; 
  ctx.fillRect(0, 0, breitePx, hoehePx);

  const grund = await Promise.all(kacheln.map((k) =>
    ladeKachel(`https://tile.openstreetmap.org/${k.z}/${k.x}/${k.y}.png`, 15_000)));
  if (!grund.some(Boolean)) return null;
  grund.forEach((img, i) => { if (img) ctx.drawImage(img, kacheln[i]!.dx, kacheln[i]!.dy, KACHEL_PX, KACHEL_PX); });

  
  
  let seezeichen = false;
  const see = await Promise.all(kacheln.map((k) =>
    ladeKachel(`https://tiles.openseamap.org/seamark/${k.z}/${k.x}/${k.y}.png`, 10_000)));
  if (see.some(Boolean)) {
    const probe = document.createElement('canvas');
    probe.width = breitePx;
    probe.height = hoehePx;
    const pctx = probe.getContext('2d');
    if (pctx) {
      see.forEach((img, i) => { if (img) pctx.drawImage(img, kacheln[i]!.dx, kacheln[i]!.dy, KACHEL_PX, KACHEL_PX); });
      try {
        pctx.getImageData(0, 0, 1, 1); 
        ctx.drawImage(probe, 0, 0);
        seezeichen = true;
      } catch {  }
    }
  }

  try {
    return { datenUri: canvas.toDataURL('image/jpeg', 0.86), ausschnitt: a, seezeichen };
  } catch {
    return null; 
  }
}
