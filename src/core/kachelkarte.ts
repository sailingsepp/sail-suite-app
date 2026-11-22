

export const KACHEL_PX = 256;


export function weltPx(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = KACHEL_PX * 2 ** z;
  const sinLat = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n,
  };
}

export interface Ausschnitt {
  z: number;
  
  x0: number;
  y0: number;
  breitePx: number;
  hoehePx: number;
}


export function waehleAusschnitt(
  punkte: readonly { lat: number; lon: number }[],
  breitePx: number, hoehePx: number, randAnteil = 0.1, maxZoom = 15, minZoom = 3,
): Ausschnitt | null {
  if (!punkte.length) return null;
  const nutzB = breitePx * (1 - 2 * randAnteil);
  const nutzH = hoehePx * (1 - 2 * randAnteil);
  let z = maxZoom;
  for (; z > minZoom; z--) {
    const p = punkte.map((q) => weltPx(q.lat, q.lon, z));
    const spanX = Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x));
    const spanY = Math.max(...p.map((q) => q.y)) - Math.min(...p.map((q) => q.y));
    if (spanX <= nutzB && spanY <= nutzH) break;
  }
  const p = punkte.map((q) => weltPx(q.lat, q.lon, z));
  const mx = (Math.max(...p.map((q) => q.x)) + Math.min(...p.map((q) => q.x))) / 2;
  const my = (Math.max(...p.map((q) => q.y)) + Math.min(...p.map((q) => q.y))) / 2;
  return { z, x0: mx - breitePx / 2, y0: my - hoehePx / 2, breitePx, hoehePx };
}


export function kachelnFuer(a: Ausschnitt): { x: number; y: number; z: number; dx: number; dy: number }[] {
  const n = 2 ** a.z;
  const raus: { x: number; y: number; z: number; dx: number; dy: number }[] = [];
  const kx0 = Math.floor(a.x0 / KACHEL_PX), kx1 = Math.floor((a.x0 + a.breitePx - 1) / KACHEL_PX);
  const ky0 = Math.floor(a.y0 / KACHEL_PX), ky1 = Math.floor((a.y0 + a.hoehePx - 1) / KACHEL_PX);
  for (let ky = ky0; ky <= ky1; ky++) {
    if (ky < 0 || ky >= n) continue;
    for (let kx = kx0; kx <= kx1; kx++) {
      
      const x = ((kx % n) + n) % n;
      raus.push({ x, y: ky, z: a.z, dx: kx * KACHEL_PX - a.x0, dy: ky * KACHEL_PX - a.y0 });
    }
  }
  return raus;
}


export function imBild(a: Ausschnitt, lat: number, lon: number): { x: number; y: number } {
  const w = weltPx(lat, lon, a.z);
  return { x: w.x - a.x0, y: w.y - a.y0 };
}
