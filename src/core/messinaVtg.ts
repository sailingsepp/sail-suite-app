import type { Punkt } from './types';
import { destPoint, distNM, segmenteSchneidenSich } from './geo';
import { umfahreLand, randFuer, TEILUNG_TIEFE } from './landumfahrung';

const grad = (g: number, m: number) => g + m / 60;
const P = (latG: number, latM: number, lonG: number, lonM: number): Punkt => ({ lat: grad(latG, latM), lon: grad(lonG, lonM) });

const NORDSEKTOR: Punkt[] = [
  P(38, 13.840, 15, 37.450), P(38, 15.540, 15, 42.000), P(38, 16.240, 15, 42.800),
  P(38, 17.040, 15, 39.898), P(38, 15.940, 15, 39.850), P(38, 14.540, 15, 35.950), P(38, 13.140, 15, 35.550),
];

const SUEDSEKTOR: Punkt[] = [
  P(38, 11.840, 15, 35.100), P(38, 10.840, 15, 34.800), P(38, 8.940, 15, 33.350),
  P(38, 8.940, 15, 38.350), P(38, 10.840, 15, 37.450), P(38, 11.833, 15, 37.450),
];

export const TRENNZONEN: readonly Punkt[][] = [
  [P(38, 16.676, 15, 41.186), P(38, 15.797, 15, 40.770), P(38, 14.242, 15, 36.556), P(38, 13.464, 15, 36.437),
    P(38, 13.545, 15, 36.656), P(38, 14.133, 15, 36.747), P(38, 15.678, 15, 40.933), P(38, 16.623, 15, 41.381)],
  [P(38, 11.833, 15, 36.147), P(38, 8.938, 15, 35.698), P(38, 8.938, 15, 35.905), P(38, 11.833, 15, 36.354)],
];

export const SEKTOREN: readonly Punkt[][] = [NORDSEKTOR, SUEDSEKTOR];

export const FAHRBAHN_PFEILE: readonly { ort: Punkt; kurs: number }[] = [
  { ort: P(38, 14.700, 15, 38.700), kurs: 60 },
  { ort: P(38, 15.500, 15, 39.200), kurs: 245 },
  { ort: P(38, 10.300, 15, 36.900), kurs: 5 },
  { ort: P(38, 10.300, 15, 35.400), kurs: 195 },
];

export const KREISVERKEHR = { mitte: P(38, 12.680, 15, 36.400), radiusSm: 250 / 1852 };

export const VTG_SUEDGRENZE_LAT = grad(38, 8.940);

export const N1 = { mitte: P(38, 17.040, 15, 41.480), radiusSm: 1.3 };

function flaeche(ring: readonly Punkt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!, q = ring[(i + 1) % ring.length]!;
    a += p.lon * q.lat - q.lon * p.lat;
  }
  return a / 2;
}

const gegenUhr = (ring: Punkt[]): Punkt[] => (flaeche(ring) >= 0 ? ring : [...ring].reverse());

function kreis(mitte: Punkt, radiusSm: number, ecken = 16): Punkt[] {
  const r = radiusSm / Math.cos(Math.PI / ecken);
  const ring: Punkt[] = [];
  for (let k = 0; k < ecken; k++) {
    const [lat, lon] = destPoint(mitte.lat, mitte.lon, 360 - (360 / ecken) * k, r);
    ring.push({ lat, lon });
  }
  return ring;
}

export const VTG_FLAECHEN: readonly Punkt[][] = [
  gegenUhr(NORDSEKTOR), gegenUhr(SUEDSEKTOR), gegenUhr(kreis(KREISVERKEHR.mitte, KREISVERKEHR.radiusSm)),
];

export const KAP_ABSTAND_SM = 0.1;
const KAP_PELORO: readonly Punkt[] = [
  { lat: 38.26785, lon: 15.65308 }, { lat: 38.26906, lon: 15.65244 }, { lat: 38.27027, lon: 15.65031 },
];

function huelleLonLat(punkte: readonly Punkt[]): Punkt[] {
  const p = [...punkte].sort((a, b) => a.lon - b.lon || a.lat - b.lat);
  const kreuz = (o: Punkt, a: Punkt, b: Punkt) => (a.lon - o.lon) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lon - o.lon);
  const unten: Punkt[] = [], oben: Punkt[] = [];
  for (const q of p) {
    while (unten.length >= 2 && kreuz(unten[unten.length - 2]!, unten[unten.length - 1]!, q) <= 0) unten.pop();
    unten.push(q);
  }
  for (const q of [...p].reverse()) {
    while (oben.length >= 2 && kreuz(oben[oben.length - 2]!, oben[oben.length - 1]!, q) <= 0) oben.pop();
    oben.push(q);
  }
  return [...unten.slice(0, -1), ...oben.slice(0, -1)];
}

export const KAP_PELORO_FLAECHE: readonly Punkt[] = gegenUhr(huelleLonLat(KAP_PELORO.flatMap((m) => kreis(m, KAP_ABSTAND_SM))));

const RAHMEN = { s: 38.10, n: 38.32, w: 15.50, e: 15.76 };

export function vtgInBox(b: { swLat: number; swLon: number; neLat: number; neLon: number }): boolean {
  return b.swLat <= RAHMEN.n && b.neLat >= RAHMEN.s && b.swLon <= RAHMEN.e && b.neLon >= RAHMEN.w;
}

const KANTE_SM = 0.03;

export function vtgAlsKueste(mitKap = true): [Punkt, Punkt][] {
  const aus: [Punkt, Punkt][] = [];

  for (const ring of mitKap ? [...VTG_FLAECHEN, KAP_PELORO_FLAECHE] : VTG_FLAECHEN) {
    ring.forEach((p, i) => {
      const q = ring[(i + 1) % ring.length]!;
      const n = Math.max(1, Math.ceil(distNM(p.lat, p.lon, q.lat, q.lon) / KANTE_SM));
      for (let k = 0; k < n; k++) {
        const a = { lat: p.lat + ((q.lat - p.lat) * k) / n, lon: p.lon + ((q.lon - p.lon) * k) / n };
        const b = { lat: p.lat + ((q.lat - p.lat) * (k + 1)) / n, lon: p.lon + ((q.lon - p.lon) * (k + 1)) / n };
        aus.push([a, b]);
      }
    });
  }
  return aus;
}

function imRing(p: Punkt, ring: readonly Punkt[]): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) drin = !drin;
  }
  return drin;
}

export function imVtg(p: Punkt): boolean {
  return VTG_FLAECHEN.some((ring) => imRing(p, ring));
}

export function quertVtg(a: Punkt, b: Punkt): boolean {
  if (imVtg(a) || imVtg(b)) return true;
  return VTG_FLAECHEN.some((ring) => ring.some((p, i) => segmenteSchneidenSich(a, b, p, ring[(i + 1) % ring.length]!)));
}

const NEU_RAND_SM = 3;

export function wegOhneVtg(weg: readonly Punkt[], kueste: readonly [Punkt, Punkt][]): Punkt[] | null {
  if (weg.length < 2 || !weg.some((p, i) => i > 0 && quertVtg(weg[i - 1]!, p))) return null;

  const dicht: { p: Punkt; eck: boolean }[] = [{ p: weg[0]!, eck: true }];
  for (let i = 1; i < weg.length; i++) {
    const a = weg[i - 1]!, b = weg[i]!;
    const n = Math.ceil(distNM(a.lat, a.lon, b.lat, b.lon));
    for (let k = 1; k < n; k++) dicht.push({ p: { lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n }, eck: false });
    dicht.push({ p: b, eck: true });
  }
  const rLat = NEU_RAND_SM / 60, rLon = NEU_RAND_SM / (60 * Math.cos((38.2 * Math.PI) / 180));
  const nahe = (p: Punkt) => p.lat >= RAHMEN.s - rLat && p.lat <= RAHMEN.n + rLat && p.lon >= RAHMEN.w - rLon && p.lon <= RAHMEN.e + rLon;
  const iA = dicht.findIndex((x) => nahe(x.p));
  let iB = -1;
  for (let i = dicht.length - 1; i >= 0; i--) if (nahe(dicht[i]!.p)) { iB = i; break; }
  if (iA < 0) return null;
  const ia = Math.max(0, iA - 1), ib = Math.min(dicht.length - 1, iB + 1);
  const u = umfahreLand(dicht[ia]!.p, dicht[ib]!.p, [...kueste, ...vtgAlsKueste()], TEILUNG_TIEFE, randFuer(dicht[ia]!.p, dicht[ib]!.p), true);
  if (!u) return null;
  return [
    ...dicht.slice(0, ia).filter((x) => x.eck).map((x) => x.p),
    ...u.punkte,
    ...dicht.slice(ib + 1).filter((x) => x.eck).map((x) => x.p),
  ];
}
