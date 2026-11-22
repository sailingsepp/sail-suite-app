import { API_BASIS } from '@/shell/api';


export interface Wetterstation {
  quelle: 'dhmz' | 'metar' | 'meteofrance' | 'esoh' | 'ispra' | 'insitu' | 'aemet';
  id: string;
  name: string;
  lat: number;
  lon: number;
  
  zeit: string;
  windKn: number | null;
  
  windDeg: number | null;
  boeKn: number | null;
  druckHpa: number | null;
  
  druckTendenzHpa: number | null;
  tempC: number | null;
  
  boje?: boolean;
  
  welleM?: number | null;
  wellePerS?: number | null;
  wasserC?: number | null;
}

export interface StationenAntwort {
  stationen: Wetterstation[];
  quellen: Partial<Record<'dhmz' | 'metar' | 'meteofrance' | 'esoh' | 'ispra' | 'insitu' | 'aemet', boolean>>;
}

export async function holeStationen(
  lat: number, lon: number, radiusNM = 30, basis = API_BASIS,
): Promise<StationenAntwort | null> {
  try {
    const url = `${basis}/api/stationen?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&r=${radiusNM}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as StationenAntwort;
    return Array.isArray(j?.stationen) ? j : null;
  } catch {
    return null;
  }
}
