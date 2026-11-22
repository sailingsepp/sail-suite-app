import { API_BASIS } from '@/shell/api';
import { radarAntwort, type RadarDaten } from '@/core/radar';

export async function holeRadar(): Promise<RadarDaten> {
  const r = await fetch(`${API_BASIS}/api/radar`, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!r.ok) throw new Error(`Radar ${r.status}`);
  const d = radarAntwort(await r.json());
  if (!d) throw new Error('Radar: Antwort unbrauchbar');
  return d;
}

export const radarBildUrl = (d: RadarDaten): string => `${API_BASIS}${d.bild}`;
