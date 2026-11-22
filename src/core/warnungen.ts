import { distNM } from './geo';

export type WarnTyp = 'wind' | 'gewitter' | 'nebel' | 'kueste' | 'see';
export type WarnStufe = 2 | 3 | 4;
export type Flaeche = [number, number][][][];

export interface Wetterwarnung {
  id: string;

  land: string;
  typ: WarnTyp;
  stufe: WarnStufe;

  von: string;
  bis: string;
  gebiet: string;
  emma: string;
  ereignis: string;
  absender: string;
  gesendet: string;

  rahmen: [number, number, number, number];
}

export interface WarnDaten {
  stand: string | null;
  warnungen: Wetterwarnung[];
  flaechen: Record<string, Flaeche>;
}

export const NAEHE_SM = 12;

const TYPEN = new Set<WarnTyp>(['wind', 'gewitter', 'nebel', 'kueste', 'see']);

export function pruefeWarnDaten(j: unknown): WarnDaten | null {
  const o = j as { stand?: unknown; warnungen?: unknown; flaechen?: unknown } | null;
  if (!o || !Array.isArray(o.warnungen) || typeof o.flaechen !== 'object' || o.flaechen === null) return null;
  const warnungen = (o.warnungen as Partial<Wetterwarnung>[]).filter((w): w is Wetterwarnung =>
    typeof w?.id === 'string' && typeof w.land === 'string' && TYPEN.has(w.typ as WarnTyp)
    && (w.stufe === 2 || w.stufe === 3 || w.stufe === 4) && typeof w.von === 'string' && typeof w.bis === 'string'
    && Number.isFinite(Date.parse(w.von)) && Number.isFinite(Date.parse(w.bis))
    && typeof w.gebiet === 'string' && typeof w.emma === 'string' && typeof w.absender === 'string'
    && Array.isArray(w.rahmen) && w.rahmen.length === 4 && w.rahmen.every((x) => typeof x === 'number'));
  return { stand: typeof o.stand === 'string' ? o.stand : null, warnungen, flaechen: o.flaechen as Record<string, Flaeche> };
}

function imRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let innen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) innen = !innen;
  }
  return innen;
}

function abstandZuStrecke(lat: number, lon: number, a: [number, number], b: [number, number]): number {
  const k = Math.cos((lat * Math.PI) / 180);
  const ax = (a[0] - lon) * k, ay = a[1] - lat, bx = (b[0] - lon) * k, by = b[1] - lat;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
  return distNM(lat, lon, lat + ay + t * dy, lon + (ax + t * dx) / k);
}

export function punktBetroffen(
  p: { lat: number; lon: number }, w: Pick<Wetterwarnung, 'rahmen'>, flaeche: Flaeche | undefined, naheSm = NAEHE_SM,
): boolean {
  const rLat = naheSm / 60, rLon = rLat / Math.max(0.2, Math.cos((p.lat * Math.PI) / 180));
  const [x0, y0, x1, y1] = w.rahmen;
  if (p.lon < x0 - rLon || p.lon > x1 + rLon || p.lat < y0 - rLat || p.lat > y1 + rLat) return false;
  if (!flaeche?.length) return true;
  for (const poly of flaeche) {
    const [aussen, ...loecher] = poly;
    if (aussen && imRing(p.lon, p.lat, aussen) && !loecher.some((l) => imRing(p.lon, p.lat, l))) return true;
  }
  for (const poly of flaeche) {
    for (const ring of poly) {
      for (let i = 0; i + 1 < ring.length; i++) if (abstandZuStrecke(p.lat, p.lon, ring[i]!, ring[i + 1]!) <= naheSm) return true;
    }
  }
  return false;
}

export interface WarnTreffer {
  typ: WarnTyp;
  stufe: WarnStufe;

  gebiete: string[];

  land: string;
  absender: string[];

  von: string;
  bis: string;
}

const REIHE: WarnTyp[] = ['wind', 'see', 'kueste', 'gewitter', 'nebel'];

export function warnungenFuer(
  daten: WarnDaten | null, punkte: readonly { lat: number; lon: number }[], vonMs: number, bisMs: number,
): WarnTreffer[] {
  if (!daten || !punkte.length) return [];
  const gruppen = new Map<string, WarnTreffer & { erste: number }>();
  for (const w of daten.warnungen) {
    if (Date.parse(w.bis) <= vonMs || Date.parse(w.von) >= bisMs) continue;
    const i = punkte.findIndex((p) => punktBetroffen(p, w, daten.flaechen[w.emma]));
    if (i < 0) continue;
    const k = `${w.typ}:${w.stufe}:${w.land}`;
    const g = gruppen.get(k);
    if (!g) {
      gruppen.set(k, { typ: w.typ, stufe: w.stufe, gebiete: [w.gebiet], land: w.land, absender: [w.absender], von: w.von, bis: w.bis, erste: i });
      continue;
    }
    if (!g.gebiete.includes(w.gebiet)) g.gebiete.push(w.gebiet);
    if (!g.absender.includes(w.absender)) g.absender.push(w.absender);
    if (w.von < g.von) g.von = w.von;
    if (w.bis > g.bis) g.bis = w.bis;
    g.erste = Math.min(g.erste, i);
  }
  return [...gruppen.values()]
    .sort((a, b) => b.stufe - a.stufe || REIHE.indexOf(a.typ) - REIHE.indexOf(b.typ) || a.erste - b.erste)
    .map((g): WarnTreffer => ({ typ: g.typ, stufe: g.stufe, gebiete: g.gebiete, land: g.land, absender: g.absender, von: g.von, bis: g.bis }));
}

export function rahmenUm(punkte: readonly { lat: number; lon: number }[]): [number, number, number, number] | null {
  if (!punkte.length) return null;
  const lats = punkte.map((p) => p.lat), lons = punkte.map((p) => p.lon);
  const r = (x: number) => Math.round(x * 100) / 100;
  return [r(Math.min(...lats)), r(Math.min(...lons)), r(Math.max(...lats)), r(Math.max(...lons))];
}

export const LAND_ZONE: Record<string, string> = {
  ES: 'Europe/Madrid', FR: 'Europe/Paris', IT: 'Europe/Rome', MT: 'Europe/Malta', SI: 'Europe/Ljubljana', HR: 'Europe/Zagreb',
  BA: 'Europe/Sarajevo', ME: 'Europe/Podgorica', AL: 'Europe/Tirane', GR: 'Europe/Athens', CY: 'Asia/Nicosia',
};
