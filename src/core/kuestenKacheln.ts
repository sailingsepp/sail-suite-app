import type { Punkt } from './types';

export const KACHEL_GRAD = 0.5;

export const FAKTOR = 1_000_000;

export interface KuestenIndex {
  erstellt: string;
  kachelGrad: number;
  faktor: number;

  gebiete: [number, number, number, number][];

  kacheln: string[];
}

export interface KuestenKachel {
  kachel: string;
  erstellt: string;
  faktor: number;
  linien: number[][];
}

export interface Box { swLat: number; swLon: number; neLat: number; neLon: number }

const zahl = (x: number): string => (x < 0 ? `m${-x}` : String(x));

export function kachelName(i: number, j: number): string {
  return `kueste-${zahl(i)}-${zahl(j)}`;
}

export function kachelnFuerBox(b: Box, g: number): { i: number; j: number; name: string }[] {
  const out: { i: number; j: number; name: string }[] = [];
  for (let i = Math.floor(b.swLat / g); i <= Math.floor(b.neLat / g); i++) {
    for (let j = Math.floor(b.swLon / g); j <= Math.floor(b.neLon / g); j++) out.push({ i, j, name: kachelName(i, j) });
  }
  return out;
}

export function decktBox(index: Pick<KuestenIndex, 'kachelGrad' | 'gebiete'>, b: Box): boolean {
  const g = index.kachelGrad;
  return kachelnFuerBox(b, g).every(({ i, j }) => {
    const lat = (i + 0.5) * g, lon = (j + 0.5) * g;
    return index.gebiete.some(([w, s, o, n]) => lon > w && lon < o && lat > s && lat < n);
  });
}

export function aufKachelkanten([w, s, o, n]: [number, number, number, number], g: number): [number, number, number, number] {
  return [Math.floor(w / g) * g, Math.floor(s / g) * g, Math.ceil(o / g) * g, Math.ceil(n / g) * g];
}

type Pos = [number, number];

export function zerlegeInKacheln(
  linien: Iterable<readonly Pos[]>, g: number, faktor: number, nur?: ReadonlySet<string>,
  ziel: Map<string, number[][]> = new Map(),
): Map<string, number[][]> {
  const rund = (x: number): number => Math.round(x * faktor);
  for (const linie of linien) {
    let stueck: number[] | null = null;
    let stueckKachel = '';
    const schliesse = (): void => {
      if (stueck && stueck.length >= 4 && (!nur || nur.has(stueckKachel))) {
        let liste = ziel.get(stueckKachel);
        if (!liste) ziel.set(stueckKachel, liste = []);
        liste.push(stueck);
      }
      stueck = null;
    };
    for (let k = 1; k < linie.length; k++) {
      const [lon1, lat1] = linie[k - 1]!, [lon2, lat2] = linie[k]!;

      const ts = [0, 1];
      const kanten = (a: number, b: number): void => {
        if (a === b) return;
        const lo = Math.min(a, b), hi = Math.max(a, b);
        for (let m = Math.ceil(lo / g); m * g < hi; m++) {
          const t = (m * g - a) / (b - a);
          if (t > 0 && t < 1) ts.push(t);
        }
      };
      kanten(lat1, lat2);
      kanten(lon1, lon2);
      ts.sort((x, y) => x - y);
      for (let q = 1; q < ts.length; q++) {
        const t0 = ts[q - 1]!, t1 = ts[q]!;
        if (t1 - t0 < 1e-12) continue;
        const pa = { lat: lat1 + (lat2 - lat1) * t0, lon: lon1 + (lon2 - lon1) * t0 };
        const pb = { lat: lat1 + (lat2 - lat1) * t1, lon: lon1 + (lon2 - lon1) * t1 };

        const mLat = (pa.lat + pb.lat) / 2, mLon = (pa.lon + pb.lon) / 2;
        const name = kachelName(Math.floor(mLat / g), Math.floor(mLon / g));
        const ba = [rund(pa.lat), rund(pa.lon)], bb = [rund(pb.lat), rund(pb.lon)];
        if (stueck === null || name !== stueckKachel) {
          schliesse();
          stueck = [ba[0]!, ba[1]!];
          stueckKachel = name;
        }
        const s: number[] = stueck;

        if (s[s.length - 2] !== bb[0] || s[s.length - 1] !== bb[1]) s.push(bb[0]!, bb[1]!);
      }
    }
    schliesse();
  }
  return ziel;
}

export function kodiere(stueck: readonly number[]): number[] {
  const out = [stueck[0]!, stueck[1]!];
  for (let i = 2; i < stueck.length; i += 2) out.push(stueck[i]! - stueck[i - 2]!, stueck[i + 1]! - stueck[i - 1]!);
  return out;
}

export interface DekodierteKachel {
  stuecke: { p: Float64Array; s: number; w: number; n: number; o: number }[];

  grob?: Map<number, DekodierteKachel>;
}

export function vereinfache(p: Float64Array, toleranzM: number): Float64Array {
  const n = p.length / 2;
  if (n <= 2 || toleranzM <= 0) return p;
  const ky = 110_540, kx = 111_320 * Math.cos((p[0]! * Math.PI) / 180);
  const behalten = new Uint8Array(n);
  behalten[0] = 1;
  behalten[n - 1] = 1;
  const stapel: [number, number][] = [[0, n - 1]];
  const tol2 = toleranzM * toleranzM;
  while (stapel.length) {
    const [a, b] = stapel.pop()!;
    const ax = p[2 * a + 1]! * kx, ay = p[2 * a]! * ky, bx = p[2 * b + 1]! * kx, by = p[2 * b]! * ky;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let max = -1, wo = -1;
    for (let i = a + 1; i < b; i++) {
      const px = p[2 * i + 1]! * kx - ax, py = p[2 * i]! * ky - ay;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / l2));
      const ex = px - t * dx, ey = py - t * dy, d2 = ex * ex + ey * ey;
      if (d2 > max) { max = d2; wo = i; }
    }
    if (max > tol2 && wo > 0) {
      behalten[wo] = 1;
      stapel.push([a, wo], [wo, b]);
    }
  }
  let m = 0;
  for (let i = 0; i < n; i++) if (behalten[i]) m++;
  const out = new Float64Array(2 * m);
  for (let i = 0, j = 0; i < n; i++) if (behalten[i]) { out[j++] = p[2 * i]!; out[j++] = p[2 * i + 1]!; }
  return out;
}

export function grobeKachel(k: DekodierteKachel, toleranzM: number): DekodierteKachel {
  if (toleranzM <= 0) return k;
  const schon = k.grob?.get(toleranzM);
  if (schon) return schon;
  const neu: DekodierteKachel = { stuecke: k.stuecke.map((st) => ({ ...st, p: vereinfache(st.p, toleranzM) })) };
  (k.grob ??= new Map()).set(toleranzM, neu);
  return neu;
}

export function dekodiere(k: Pick<KuestenKachel, 'faktor' | 'linien'>): DekodierteKachel {
  const stuecke: DekodierteKachel['stuecke'] = [];
  for (const l of k.linien) {
    const p = new Float64Array(l.length);
    let lat = 0, lon = 0, s = Infinity, w = Infinity, n = -Infinity, o = -Infinity;
    for (let i = 0; i < l.length; i += 2) {
      lat += l[i]!;
      lon += l[i + 1]!;
      const a = lat / k.faktor, b = lon / k.faktor;
      p[i] = a;
      p[i + 1] = b;
      if (a < s) s = a;
      if (a > n) n = a;
      if (b < w) w = b;
      if (b > o) o = b;
    }
    if (p.length >= 4) stuecke.push({ p, s, w, n, o });
  }
  return { stuecke };
}

export function streckenInBox(kacheln: Iterable<DekodierteKachel>, b: Box): [Punkt, Punkt][] {
  const out: [Punkt, Punkt][] = [];
  for (const k of kacheln) {
    for (const st of k.stuecke) {
      if (st.n < b.swLat || st.s > b.neLat || st.o < b.swLon || st.w > b.neLon) continue;
      const p = st.p;
      for (let i = 2; i < p.length; i += 2) {
        const la1 = p[i - 2]!, lo1 = p[i - 1]!, la2 = p[i]!, lo2 = p[i + 1]!;
        if (Math.max(la1, la2) < b.swLat || Math.min(la1, la2) > b.neLat
          || Math.max(lo1, lo2) < b.swLon || Math.min(lo1, lo2) > b.neLon) continue;
        out.push([{ lat: la1, lon: lo1 }, { lat: la2, lon: lo2 }]);
      }
    }
  }
  return out;
}
