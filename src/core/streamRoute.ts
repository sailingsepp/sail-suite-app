import { destPoint, distNM } from './geo';


export interface StreamRoute {
  
  punkte: [number, number][];
  
  ziel: string | null;
  
  ankunft: number | null;
  
  restSm: number | null;
}


export const STREAM_ROUTE_PUNKTE_MAX = 300;


export function streamRouteAus(
  route: { wegpunkte: readonly { lat: number; lon: number; name: string }[]; naechster: number },
  werte: { etz: number | null; dtz: number | null } | null,
  platzhalter: readonly string[],
  
  zielName: string | null = null,
): StreamRoute | null {
  const wp = route.wegpunkte.slice(Math.max(0, route.naechster - 1)).slice(0, STREAM_ROUTE_PUNKTE_MAX);
  const b = route.wegpunkte.at(-1);
  if (wp.length < 2 || !b) return null;
  const r = (x: number) => Math.round(x * 1e5) / 1e5;
  return {
    punkte: wp.map((p) => [r(p.lat), r(p.lon)] as [number, number]),
    ziel: zielName?.trim() ? zielName.trim().slice(0, 200) : platzhalter.includes(b.name) || b.name.trim().length <= 1 ? null : b.name.trim().slice(0, 200),
    ankunft: werte?.etz != null && Number.isFinite(werte.etz) ? Math.round(werte.etz) : null,
    restSm: werte?.dtz != null && Number.isFinite(werte.dtz) ? Math.round(werte.dtz * 10) / 10 : null,
  };
}


export function kurslinienEnde(lat: number, lon: number, cog: number | null, sog: number | null, minuten = 60): [number, number] | null {
  if (cog == null || sog == null || !(sog >= 0.5)) return null;
  return destPoint(lat, lon, cog, (sog * minuten) / 60);
}


export function restUndAnkunft(
  r: StreamRoute,
  stand: { t: number; lat: number; lon: number; sog: number | null },
): { restSm: number | null; ankunft: number | null } {
  let restSm = r.restSm;
  if (restSm == null && r.punkte.length >= 2) {
    const [a, ...rest] = r.punkte.slice(1);
    let sm = distNM(stand.lat, stand.lon, a![0], a![1]);
    let vor = a!;
    for (const p of rest) { sm += distNM(vor[0], vor[1], p[0], p[1]); vor = p; }
    restSm = Math.round(sm * 10) / 10;
  }
  const ankunft = r.ankunft
    ?? (restSm != null && stand.sog != null && stand.sog >= 0.5 ? Math.round(stand.t + (restSm / stand.sog) * 3_600_000) : null);
  return { restSm, ankunft };
}
