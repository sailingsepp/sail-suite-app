
import { distNM } from './geo';
import type { Kandidatennetz, Hafenknoten } from './hafennetz';
import type { StundenWind } from './types';
import { werteOeffnungszeiten, type OeffnungszeitenUrteil } from './oeffnungszeiten';
import { nDate } from './time';
import { vorherrschendeWindrichtung } from './ausrichtung';


export const ABSTECHER_VON_UHR = 10;
export const ABSTECHER_BIS_UHR = 16;

export interface AbstecherWetter {
  
  windKn: number;
  
  boeKn: number;
  
  richtungDeg: number | null;
}


export function abstecherWetter(wind: StundenWind | null, datumIso: string): AbstecherWetter | null {
  if (!wind) return null;
  const proben: { dir: number; speed: number; gust: number }[] = [];
  wind.time.forEach((t, i) => {
    if (!t.startsWith(datumIso)) return;
    const stunde = Number(t.slice(11, 13));
    if (stunde < ABSTECHER_VON_UHR || stunde >= ABSTECHER_BIS_UHR) return;
    const speed = wind.wind_speed_10m[i], dir = wind.wind_direction_10m[i], gust = wind.wind_gusts_10m[i];
    if (typeof speed !== 'number' || typeof dir !== 'number' || !Number.isFinite(speed)) return;
    proben.push({ dir, speed, gust: typeof gust === 'number' && Number.isFinite(gust) ? gust : speed });
  });
  if (proben.length === 0) return null;
  return {
    windKn: proben.reduce((s, p) => s + p.speed, 0) / proben.length,
    boeKn: Math.max(...proben.map((p) => p.gust)),
    richtungDeg: vorherrschendeWindrichtung(proben),
  };
}


export const POI_BASIS_MAX_SM = 6;


export const ORT_BASIS_BUCHT_MALUS_SM = 3;


export function waehleOrtsbasis(
  ort: { lat: number; lon: number }, kandidaten: readonly Hafenknoten[], maxSm: number,
): Hafenknoten | null {
  let beste: Hafenknoten | null = null, besteWert = Infinity;
  for (const k of kandidaten) {
    const sm = distNM(ort.lat, ort.lon, k.ort.lat, k.ort.lon);
    if (sm > maxSm) continue;
    const wert = sm + (k.art === 'bucht' ? ORT_BASIS_BUCHT_MALUS_SM : 0);
    if (wert < besteWert) { beste = k; besteWert = wert; }
  }
  return beste;
}


export function ordnePoiBasen(
  netz: Kandidatennetz, poiIndizes: readonly number[], maxSm = POI_BASIS_MAX_SM,
): Map<number, number | null> {
  const istPoi = new Set(poiIndizes);
  const ergebnis = new Map<number, number | null>();
  for (const poi of poiIndizes) {
    const p = netz.knoten[poi];
    if (!p) { ergebnis.set(poi, null); continue; }
    let beste: number | null = null, besteSm = Infinity;
    netz.knoten.forEach((k, i) => {
      if (istPoi.has(i)) return;
      const sm = distNM(p.ort.lat, p.ort.lon, k.ort.lat, k.ort.lon);
      if (sm <= maxSm && sm < besteSm) { beste = i; besteSm = sm; }
    });
    ergebnis.set(poi, beste);
  }
  return ergebnis;
}


export function poiOeffnungszeitenUrteil(tagRoh: string, datumIso: string): OeffnungszeitenUrteil | null {
  const d = nDate(`${datumIso}T12:00:00`);
  return werteOeffnungszeiten(tagRoh, d.getUTCDay(), d.getUTCMonth() + 1, ABSTECHER_VON_UHR, ABSTECHER_BIS_UHR);
}
