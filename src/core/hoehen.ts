export const KUESTENSTREIFEN_KM = 20;

export const SCHICHTEN_M = [100, 200, 400, 700, 1000, 1500] as const;

export const FLACH = 180;

export const SCHICHT_SCHRITT = 36;
export const HOEHE_FAKTOR = 100_000;

export function schichtIndex(hoeheM: number): number {
  let k = 0;
  while (k < SCHICHTEN_M.length && hoeheM >= SCHICHTEN_M[k]!) k++;
  return k;
}

export function streifenMaske(meer: Uint8Array, w: number, h: number, dxM: number, dyM: number, maxM: number): Uint8Array {
  const d = new Float32Array(w * h);
  const dd = Math.hypot(dxM, dyM);
  for (let k = 0; k < d.length; k++) d[k] = meer[k] ? 0 : Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      let v = d[k]!;
      if (x > 0) v = Math.min(v, d[k - 1]! + dxM);
      if (y > 0) {
        v = Math.min(v, d[k - w]! + dyM);
        if (x > 0) v = Math.min(v, d[k - w - 1]! + dd);
        if (x < w - 1) v = Math.min(v, d[k - w + 1]! + dd);
      }
      d[k] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const k = y * w + x;
      let v = d[k]!;
      if (x < w - 1) v = Math.min(v, d[k + 1]! + dxM);
      if (y < h - 1) {
        v = Math.min(v, d[k + w]! + dyM);
        if (x < w - 1) v = Math.min(v, d[k + w + 1]! + dd);
        if (x > 0) v = Math.min(v, d[k + w - 1]! + dd);
      }
      d[k] = v;
    }
  }
  const aus = new Uint8Array(w * h);
  for (let k = 0; k < d.length; k++) aus[k] = !meer[k] && d[k]! <= maxM ? 1 : 0;
  return aus;
}

export function linienFuerZoom(z: number): { abstand: number; zaehl: number } | null {
  if (z >= 13) return { abstand: 20, zaehl: 100 };
  if (z >= 12) return { abstand: 50, zaehl: 250 };
  if (z >= 10) return { abstand: 100, zaehl: 500 };
  return null;
}

export const HOEHEN_GLAETTEN_MAX_M = [8, 4] as const;

export type HoehenLinie = number[];

export function kodiereLinie(hoeheM: number, punkte: readonly [number, number][], faktor = HOEHE_FAKTOR): HoehenLinie {
  const aus: number[] = [Math.round(hoeheM)];
  let la = 0, lo = 0;
  punkte.forEach(([lon, lat], k) => {
    const a = Math.round(lat * faktor), o = Math.round(lon * faktor);
    if (k === 0) aus.push(a, o); else aus.push(a - la, o - lo);
    la = a; lo = o;
  });
  return aus;
}

export function dekodiereLinie(l: readonly number[], faktor = HOEHE_FAKTOR): { hoeheM: number; p: Float64Array } {
  const p = new Float64Array(l.length - 1);
  let a = 0, o = 0;
  for (let n = 1; n < l.length; n += 2) {
    a += l[n]!; o += l[n + 1]!;
    p[n - 1] = a / faktor; p[n] = o / faktor;
  }
  return { hoeheM: l[0]!, p };
}

export interface ReliefFarben {
  schichten: readonly (readonly [number, number, number, number])[];
  schatten: readonly [number, number, number]; schattenMax: number;
  licht: readonly [number, number, number]; lichtMax: number;
}

export const RELIEF_TAG: ReliefFarben = {
  schichten: [[0, 0, 0, 0], [160, 140, 110, 0.08], [160, 140, 110, 0.15], [150, 125, 95, 0.22], [140, 115, 85, 0.29], [130, 105, 75, 0.36], [120, 95, 65, 0.43]],
  schatten: [15, 40, 57], schattenMax: 0.6,
  licht: [255, 255, 255], lichtMax: 0.55,
};

export const RELIEF_NACHT: ReliefFarben = {
  schichten: [[0, 0, 0, 0], [196, 68, 44, 0.02], [196, 68, 44, 0.035], [196, 68, 44, 0.05], [196, 68, 44, 0.065], [196, 68, 44, 0.08], [196, 68, 44, 0.095]],
  schatten: [0, 0, 0], schattenMax: 0.6,
  licht: [196, 68, 44], lichtMax: 0.11,
};

export function reliefPunkt(rot: number, gruen: number, f: ReliefFarben, aus: Uint8ClampedArray, o: number): void {
  const s = f.schichten[Math.min(f.schichten.length - 1, Math.max(0, Math.round(gruen / SCHICHT_SCHRITT)))]!;
  const abw = (rot - FLACH) / FLACH;
  const dunkel = abw < 0;
  const farbe = dunkel ? f.schatten : f.licht;
  const a2 = Math.min(dunkel ? f.schattenMax : f.lichtMax, Math.abs(abw) * (dunkel ? 1 : 1.3));
  const a1 = s[3];
  const a = a2 + a1 * (1 - a2);
  if (a <= 0) { aus[o + 3] = 0; return; }
  for (let c = 0; c < 3; c++) aus[o + c] = (farbe[c]! * a2 + s[c]! * a1 * (1 - a2)) / a;
  aus[o + 3] = a * 255;
}
