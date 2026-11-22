import type { Punkt } from './types';
import { STAATEN_REGEL } from './grenzen';



export interface VorrechnungKandidat {
  name: string;
  art: 'marina' | 'hafen' | 'bucht';
  lat: number;
  lon: number;
}

export interface VorrechnungPaket {
  revier: string;
  
  bbox: [number, number, number, number];
  erstellt: string;
  kandidaten: VorrechnungKandidat[];
  
  inseln: Record<string, string[]>;
  
  staaten: Record<string, string[]>;
  
  staatenRegel?: number;
}

export interface VorrechnungManifest {
  erstellt: string;
  reviere: {
    id: string; bbox: [number, number, number, number]; datei: string; kandidaten: number;
    
    umgebung?: string; umgebungErstellt?: string;
    
    seekarte?: string; seekarteErstellt?: string;
  }[];
}


export const ortSchluessel = (p: Punkt): string => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;

export interface Box { swLat: number; swLon: number; neLat: number; neLon: number }


export function deckt(bbox: [number, number, number, number], b: Box): boolean {
  const [w, s, o, n] = bbox;
  return b.swLon >= w && b.neLon <= o && b.swLat >= s && b.neLat <= n;
}


export function passendesRevier(m: VorrechnungManifest, b: Box): VorrechnungManifest['reviere'][number] | null {
  return m.reviere.find((r) => deckt(r.bbox, b)) ?? null;
}


export function ueberlappung(bbox: [number, number, number, number], b: Box): number {
  const [w, s, o, n] = bbox;
  const breite = Math.min(o, b.neLon) - Math.max(w, b.swLon);
  const hoehe = Math.min(n, b.neLat) - Math.max(s, b.swLat);
  return breite > 0 && hoehe > 0 ? breite * hoehe : 0;
}


export function revierFuer(
  m: VorrechnungManifest, b: Box, teilweise = false,
): VorrechnungManifest['reviere'][number] | null {
  const ganz = passendesRevier(m, b);
  if (ganz || !teilweise) return ganz;
  let bestes: VorrechnungManifest['reviere'][number] | null = null;
  let flaeche = 0;
  for (const r of m.reviere) {
    const f = ueberlappung(r.bbox, b);
    if (f > flaeche) { flaeche = f; bestes = r; }
  }
  return bestes;
}


export function vereinePakete(pakete: readonly VorrechnungPaket[]): VorrechnungPaket | null {
  const [erstes] = pakete;
  if (!erstes) return null;
  if (pakete.length === 1) return erstes;
  const gesehen = new Set<string>();
  const kandidaten: VorrechnungKandidat[] = [];
  for (const p of pakete) {
    for (const k of p.kandidaten) {
      const s = `${ortSchluessel(k)}|${k.name}`;
      if (gesehen.has(s)) continue;
      gesehen.add(s);
      kandidaten.push(k);
    }
  }
  return {
    revier: pakete.map((p) => p.revier).join('+'), bbox: erstes.bbox, erstellt: erstes.erstellt, kandidaten,
    inseln: Object.assign({}, ...pakete.map((p) => p.inseln)) as Record<string, string[]>,
    staaten: Object.assign({}, ...pakete.map((p) => p.staaten)) as Record<string, string[]>,
    
    ...(pakete.every((p) => p.staatenRegel === erstes.staatenRegel) && erstes.staatenRegel != null
      ? { staatenRegel: erstes.staatenRegel } : {}),
  };
}


export function kandidatenInBox(p: VorrechnungPaket, b: Box): VorrechnungKandidat[] {
  return p.kandidaten.filter((k) => k.lat >= b.swLat && k.lat <= b.neLat && k.lon >= b.swLon && k.lon <= b.neLon);
}


export function inselnAusPaket(p: VorrechnungPaket | null, orte: readonly Punkt[]): { inseln: (string[] | null)[]; fehlend: number[] } {
  const inseln = orte.map((o) => (p ? p.inseln[ortSchluessel(o)] ?? null : null));
  return { inseln, fehlend: inseln.flatMap((x, i) => (x === null ? [i] : [])) };
}


export function staatAusPaket(p: VorrechnungPaket | null, ort: Punkt): string[] | undefined {
  
  
  if (!p || p.staatenRegel !== STAATEN_REGEL) return undefined;
  return p.staaten[ortSchluessel(ort)];
}
