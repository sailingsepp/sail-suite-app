export type Pkt = [number, number];
export interface KachelBox { s: number; w: number; n: number; o: number }
export interface LandAusKueste {

  ringe: number[][];

  hintergrund: 'gemischt' | null;

  fehler?: string;
}

const EPS = 1e-7;
const schluessel = (p: Pkt) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

export function flaeche(r: readonly Pkt[]): number {
  let a = 0;
  for (let k = 0; k < r.length - 1; k++) a += r[k]![1] * r[k + 1]![0] - r[k + 1]![1] * r[k]![0];
  return a / 2;
}

export function verbinde(stuecke: readonly Pkt[][]): Pkt[][] {
  const nachAnfang = new Map<string, number>();
  const nachEnde = new Map<string, number>();
  stuecke.forEach((s, i) => { nachAnfang.set(schluessel(s[0]!), i); nachEnde.set(schluessel(s[s.length - 1]!), i); });
  const benutzt = new Set<number>();
  const ketten: Pkt[][] = [];
  for (let i = 0; i < stuecke.length; i++) {
    if (benutzt.has(i)) continue;
    benutzt.add(i);
    let k = [...stuecke[i]!];
    for (;;) {
      if (schluessel(k[0]!) === schluessel(k[k.length - 1]!) && k.length > 2) break;
      const j = nachAnfang.get(schluessel(k[k.length - 1]!));
      if (j === undefined || benutzt.has(j)) break;
      benutzt.add(j); k = k.concat(stuecke[j]!.slice(1));
    }
    for (;;) {
      if (schluessel(k[0]!) === schluessel(k[k.length - 1]!) && k.length > 2) break;
      const j = nachEnde.get(schluessel(k[0]!));
      if (j === undefined || benutzt.has(j)) break;
      benutzt.add(j); k = stuecke[j]!.slice(0, -1).concat(k);
    }
    ketten.push(k);
  }
  return ketten;
}

function amRand(p: Pkt, b: KachelBox): boolean {
  return Math.abs(p[0] - b.s) < EPS || Math.abs(p[0] - b.n) < EPS || Math.abs(p[1] - b.w) < EPS || Math.abs(p[1] - b.o) < EPS;
}

function randLage(p: Pkt, b: KachelBox): number {
  const B = b.o - b.w, H = b.n - b.s;
  if (Math.abs(p[0] - b.s) < EPS && p[1] < b.o - EPS) return p[1] - b.w;
  if (Math.abs(p[1] - b.o) < EPS && p[0] < b.n - EPS) return B + (p[0] - b.s);
  if (Math.abs(p[0] - b.n) < EPS && p[1] > b.w + EPS) return B + H + (b.o - p[1]);
  return 2 * B + H + (b.n - p[0]);
}

export function landAusKueste(stuecke: readonly Pkt[][], b: KachelBox): LandAusKueste {
  const ketten = verbinde(stuecke);
  const ringe: number[][] = [];
  const offen: Pkt[][] = [];
  for (const k of ketten) {
    if (k.length > 2 && schluessel(k[0]!) === schluessel(k[k.length - 1]!)) ringe.push(k.flat());
    else if (amRand(k[0]!, b) && amRand(k[k.length - 1]!, b)) offen.push(k);
    else return { ringe: [], hintergrund: null, fehler: `Kette endet nicht am Rand (${schluessel(k[0]!)} → ${schluessel(k[k.length - 1]!)})` };
  }
  if (!offen.length) return { ringe, hintergrund: null };
  const B = b.o - b.w, H = b.n - b.s, U = 2 * (B + H);
  const ecken: [number, Pkt][] = [[0, [b.s, b.w]], [B, [b.s, b.o]], [B + H, [b.n, b.o]], [2 * B + H, [b.n, b.w]]];
  const anfang = offen.map((k) => randLage(k[0]!, b));
  const frei = new Set(offen.map((_, i) => i));
  while (frei.size) {
    const erste = frei.values().next().value as number;
    let i = erste;
    const ring: Pkt[] = [];
    for (let schritt = 0; schritt <= offen.length; schritt++) {
      frei.delete(i);
      ring.push(...offen[i]!);
      const ende = randLage(offen[i]![offen[i]!.length - 1]!, b);
      let naechste = -1, abstand = Infinity;
      anfang.forEach((t, j) => {
        const d = ((t - ende) % U + U) % U;
        if (d < abstand) { abstand = d; naechste = j; }
      });
      const dazwischen = ecken
        .map(([t, p]) => [((t - ende) % U + U) % U, p] as [number, Pkt])
        .filter(([d]) => d > EPS && d < abstand - EPS)
        .sort((x, y) => x[0] - y[0]);
      for (const [, p] of dazwischen) ring.push(p);
      if (naechste === erste || !frei.has(naechste)) break;
      i = naechste;
    }
    ring.push(ring[0]!);
    ringe.push(ring.flat());
  }
  return { ringe, hintergrund: 'gemischt' };
}

export function kachelRing(b: KachelBox): number[] {
  return [b.s, b.w, b.s, b.o, b.n, b.o, b.n, b.w, b.s, b.w];
}
