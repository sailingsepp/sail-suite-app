import { distNM } from './geo';


export interface Zone {
  
  staat: string | null;
  
  hoheit?: string;
  awz?: string;
  hoheSee?: boolean;
}

export interface Grenzuebergang {
  lat: number;
  lon: number;
  
  sm: number;
  von: Zone;
  nach: Zone;
}

type P = { lat: number; lon: number };

const zonenSchluessel = (z: Zone): string => z.staat ?? 'international';


function kumuliert(punkte: readonly P[]): number[] {
  const c = [0];
  for (let i = 1; i < punkte.length; i++) c.push(c[i - 1]! + distNM(punkte[i - 1]!.lat, punkte[i - 1]!.lon, punkte[i]!.lat, punkte[i]!.lon));
  return c;
}


export function punktBei(punkte: readonly P[], sm: number, c: readonly number[] = kumuliert(punkte)): P {
  const gesamt = c.at(-1) ?? 0;
  const s = Math.max(0, Math.min(gesamt, sm));
  for (let i = 1; i < punkte.length; i++) {
    if (s <= c[i]! || i === punkte.length - 1) {
      const lang = c[i]! - c[i - 1]!;
      const f = lang > 0 ? (s - c[i - 1]!) / lang : 0;
      const a = punkte[i - 1]!, b = punkte[i]!;
      return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
    }
  }
  return punkte[0]!;
}


export async function grenzenEntlang(
  punkte: readonly P[], frage: (p: P) => Promise<Zone | undefined>,
  abstandSm = 5, schritte = 4, gleichzeitig = 4,
): Promise<{ liste: Grenzuebergang[]; fehlend: number }> {
  if (punkte.length < 2) return { liste: [], fehlend: 0 };
  let fehlend = 0;
  const sicher = (p: P) => frage(p).catch(() => { fehlend++; return undefined; });
  const c = kumuliert(punkte);
  const gesamt = c.at(-1)!;
  const n = Math.max(1, Math.ceil(gesamt / abstandSm));
  const stellen = Array.from({ length: n + 1 }, (_, k) => (gesamt * k) / n);
  const zonen: (Zone | undefined)[] = [];
  for (let k = 0; k < stellen.length; k += gleichzeitig) {
    zonen.push(...await Promise.all(stellen.slice(k, k + gleichzeitig).map((s) => sicher(punktBei(punkte, s, c)))));
  }
  const bekannt = stellen.map((s, k) => ({ s, z: zonen[k] })).filter((x): x is { s: number; z: Zone } => !!x.z);
  const aus: Grenzuebergang[] = [];
  for (let k = 1; k < bekannt.length; k++) {
    let a = bekannt[k - 1]!, b = bekannt[k]!;
    if (zonenSchluessel(a.z) === zonenSchluessel(b.z)) continue;
    const von = a.z, nach = b.z;
    for (let i = 0; i < schritte; i++) {
      const m = (a.s + b.s) / 2;
      const z = await sicher(punktBei(punkte, m, c));
      if (!z) break;
      if (zonenSchluessel(z) === zonenSchluessel(von)) a = { s: m, z }; else b = { s: m, z };
    }
    const s = (a.s + b.s) / 2;
    aus.push({ ...punktBei(punkte, s, c), sm: Math.round(s * 100) / 100, von, nach });
  }
  return { liste: aus, fehlend };
}


export function fortschrittSm(punkte: readonly P[], boot: P): { sm: number; abstandSm: number } {
  const c = kumuliert(punkte);
  let best = { sm: 0, abstandSm: Infinity };
  const k = Math.cos((boot.lat * Math.PI) / 180);
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1]!, b = punkte[i]!;
    const ax = (b.lon - a.lon) * k * 60, ay = (b.lat - a.lat) * 60;
    const px = (boot.lon - a.lon) * k * 60, py = (boot.lat - a.lat) * 60;
    const l2 = ax * ax + ay * ay;
    const f = l2 > 0 ? Math.max(0, Math.min(1, (px * ax + py * ay) / l2)) : 0;
    const d = Math.hypot(px - f * ax, py - f * ay);
    if (d < best.abstandSm) best = { sm: c[i - 1]! + f * (c[i]! - c[i - 1]!), abstandSm: d };
  }
  return best;
}


export const GRENZE_ROUTE_ABSTAND_SM = 3;


export function grenzStand(
  g: Pick<Grenzuebergang, 'sm'>, f: { sm: number; abstandSm: number }, sogKn: number | null, vorlaufMin = 12,
): 'warnen' | 'loggen' | null {
  if (f.abstandSm > GRENZE_ROUTE_ABSTAND_SM) return null;
  const rest = g.sm - f.sm;
  if (rest <= 0) return 'loggen';
  const vorlauf = Math.max(1, ((sogKn ?? 0) * vorlaufMin) / 60);
  return rest <= vorlauf ? 'warnen' : null;
}
