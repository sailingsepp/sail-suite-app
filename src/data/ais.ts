import type { AisZiel } from '@/core/ais';
import { API_BASIS } from '@/shell/api';

export interface AisAntwort {

  verbunden: boolean;
  radiusNM: number;
  ziele: AisZiel[];
}

export async function holeAisZiele(
  lat: number, lon: number, radiusNM = 3, basis = API_BASIS,
): Promise<AisAntwort | null> {
  try {
    const url = `${basis}/api/ais?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&r=${radiusNM}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as AisAntwort;
    if (!Array.isArray(j?.ziele)) return null;
    return j;
  } catch {
    return null;
  }
}
