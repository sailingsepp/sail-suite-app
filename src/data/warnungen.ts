import { API_BASIS } from '@/shell/api';
import { pruefeWarnDaten, type WarnDaten } from '@/core/warnungen';

export async function holeWarnungen(rahmen: [number, number, number, number], basis = API_BASIS): Promise<WarnDaten | null> {
  try {
    const r = await fetch(`${basis}/api/warnungen?bbox=${rahmen.join(',')}`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    if (!r.ok) return null;
    return pruefeWarnDaten(await r.json());
  } catch {
    return null;
  }
}
