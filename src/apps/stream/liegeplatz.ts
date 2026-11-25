import { kuesteAusKacheln } from '@/data/kuestenKacheln';
import { kantenAusOsm, LIEGE_MAX_M, type Kante } from '@/core/liegeplatz';

const OVERPASS = 'https://overpass-api.de/api/interpreter';

const RADIUS_M = LIEGE_MAX_M + 40;

const NEU_VERSUCH_MS = 120_000;

const fertig = new Map<string, { kanten: Kante[]; vollstaendig: boolean; t: number }>();
const laeuft = new Map<string, Promise<void>>();

const schluessel = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;

function stegAbfrage(lat: number, lon: number): string {
  const p = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  return `[out:json][timeout:20];(way(around:${RADIUS_M},${p})[man_made~"^(pier|quay|breakwater|groyne)$"];`
    + `way(around:${RADIUS_M},${p})["seamark:type"="mooring"];);out tags geom;`;
}

type Elemente = Parameters<typeof kantenAusOsm>[0];

async function stege(lat: number, lon: number, api: (pfad: string) => string): Promise<Kante[] | null> {
  const lies = async (r: Response): Promise<Kante[] | null> => {
    if (!r.ok) return null;
    const d = (await r.json()) as { elements?: Elemente; remark?: string };
    return d.remark?.includes('timed out') ? null : kantenAusOsm(d.elements ?? []);
  };
  try {
    const r = await fetch(api(`/stege?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`), { signal: AbortSignal.timeout(60_000) });
    const k = await lies(r);
    if (k) return k;
  } catch {  }
  try {
    return await lies(await fetch(OVERPASS, { method: 'POST', body: `data=${encodeURIComponent(stegAbfrage(lat, lon))}`, signal: AbortSignal.timeout(25_000) }));
  } catch {
    return null;
  }
}

async function kueste(lat: number, lon: number): Promise<Kante[] | null> {
  const dLat = RADIUS_M / 111_320, dLon = dLat / Math.cos((lat * Math.PI) / 180);
  try {
    const linien = await kuesteAusKacheln({ swLat: lat - dLat, swLon: lon - dLon, neLat: lat + dLat, neLon: lon + dLon });
    return linien ? linien.map(([a, b]) => ({ a, b, art: 'kueste' as const })) : null;
  } catch {
    return null;
  }
}

export function kantenBekannt(lat: number, lon: number): Kante[] | undefined {
  return fertig.get(schluessel(lat, lon))?.kanten;
}

export function holeKanten(lat: number, lon: number, api: (pfad: string) => string, fertigDann: () => void): void {
  const k = schluessel(lat, lon);
  const da = fertig.get(k);
  if (laeuft.has(k) || (da && (da.vollstaendig || Date.now() - da.t < NEU_VERSUCH_MS))) return;
  laeuft.set(k, (async () => {
    const [s, c] = await Promise.all([stege(lat, lon, api), kueste(lat, lon)]);
    laeuft.delete(k);
    if (s === null && c === null) return;

    fertig.set(k, { kanten: [...(s ?? []), ...(c ?? [])], vollstaendig: s !== null, t: Date.now() });
    fertigDann();
  })());
}
