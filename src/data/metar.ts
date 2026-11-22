import { API_BASIS } from '@/shell/api';


export interface MetarAntwort {
  metar: { id: string; roh: string; zeit: string; name: string | null } | null;
  erreichbar: boolean;
}

export async function holeMetar(icao: string, basis = API_BASIS): Promise<MetarAntwort | null> {
  try {
    const r = await fetch(`${basis}/api/metar?id=${encodeURIComponent(icao)}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as MetarAntwort;
    return j && typeof j.erreichbar === 'boolean' ? j : null;
  } catch {
    return null;
  }
}
