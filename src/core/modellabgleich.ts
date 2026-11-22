
import type { StundenWind } from './types';

export const ABWEICHUNG_DEUTLICH_KN = 4;
export const ABWEICHUNG_STARK_KN = 8;

export const RICHTUNG_UNEINS_GRAD = 45;

export const STUNDE_VON = 6;
export const STUNDE_BIS = 21;

export interface Modellabgleich {
  
  mittelKn: number;
  
  mittelBetragKn: number;
  
  maxKn: number;
  maxUhrzeit: string;
  
  maxRechnungMehr: boolean;
  stufe: 'gering' | 'deutlich' | 'stark';
  
  richtungGrad: number;
  
  segelwindUneins: { von: string; bis: string; rechnungSegelt: boolean; stunden: number } | null;
  
  stunden: number;
  
  jeStunde: { uhr: string; r: number; v: number }[];
}

function mittel(a: number[]): number {
  return a.reduce((x, y) => x + y, 0) / a.length;
}


export function vergleicheModelle(
  rechnung: StundenWind[],
  vergleich: (StundenWind | null)[],
  dateStr: string,
  minSailWind: number | null = null,
): Modellabgleich | null {
  const paare = rechnung
    .map((r, i) => ({ r, v: vergleich[i] ?? null }))
    .filter((p): p is { r: StundenWind; v: StundenWind } => p.v !== null && p.v.time.length === p.r.time.length);
  if (paare.length === 0) return null;
  const idxs: number[] = [];
  paare[0]!.r.time.forEach((t, i) => {
    const stunde = Number(t.slice(11, 13));
    if (t.startsWith(dateStr) && stunde >= STUNDE_VON && stunde <= STUNDE_BIS) idxs.push(i);
  });
  if (idxs.length === 0) return null;

  const jeStunde = idxs.map((i) => {
    const rs: number[] = [], vs: number[] = [];
    let rx = 0, ry = 0, vx = 0, vy = 0;
    for (const { r, v } of paare) {
      const a = r.wind_speed_10m[i], b = v.wind_speed_10m[i];
      if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      rs.push(a); vs.push(b);
      const ra = (r.wind_direction_10m[i] ?? 0) * Math.PI / 180, va = (v.wind_direction_10m[i] ?? 0) * Math.PI / 180;
      rx += a * Math.sin(ra); ry += a * Math.cos(ra);
      vx += b * Math.sin(va); vy += b * Math.cos(va);
    }
    if (rs.length === 0) return null;
    return { uhr: paare[0]!.r.time[i]!.slice(11, 16), r: mittel(rs), v: mittel(vs), rx, ry, vx, vy };
  }).filter((s): s is NonNullable<typeof s> => s !== null);
  if (jeStunde.length === 0) return null;

  const diffs = jeStunde.map((s) => s.r - s.v);
  const mittelKn = mittel(diffs);
  const mittelBetragKn = mittel(diffs.map(Math.abs));
  let maxI = 0;
  diffs.forEach((d, i) => { if (Math.abs(d) > Math.abs(diffs[maxI]!)) maxI = i; });
  const stufe = mittelBetragKn >= ABWEICHUNG_STARK_KN ? 'stark'
    : mittelBetragKn >= ABWEICHUNG_DEUTLICH_KN ? 'deutlich' : 'gering';

  const rx = jeStunde.reduce((a, s) => a + s.rx, 0), ry = jeStunde.reduce((a, s) => a + s.ry, 0);
  const vx = jeStunde.reduce((a, s) => a + s.vx, 0), vy = jeStunde.reduce((a, s) => a + s.vy, 0);
  const rDir = (Math.atan2(rx, ry) * 180 / Math.PI + 360) % 360;
  const vDir = (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360;
  const richtungGrad = (rx === 0 && ry === 0) || (vx === 0 && vy === 0)
    ? 0 : Math.abs(((rDir - vDir + 540) % 360) - 180);

  let segelwindUneins: Modellabgleich['segelwindUneins'] = null;
  if (minSailWind != null) {
    
    
    
    let bester: { von: number; bis: number } | null = null;
    let lauf: { von: number; bis: number } | null = null;
    jeStunde.forEach((s, i) => {
      const uneins = (s.r >= minSailWind) !== (s.v >= minSailWind);
      if (!uneins) { lauf = null; return; }
      if (lauf) lauf.bis = i; else lauf = { von: i, bis: i };
      if (!bester || lauf.bis - lauf.von > bester.bis - bester.von) bester = lauf;
    });
    if (bester) {
      const b: { von: number; bis: number } = bester;
      const stunden = jeStunde.slice(b.von, b.bis + 1);
      const rechnungSegelt = stunden.filter((s) => s.r >= minSailWind).length * 2 >= stunden.length;
      segelwindUneins = { von: stunden[0]!.uhr, bis: stunden[stunden.length - 1]!.uhr, rechnungSegelt, stunden: stunden.length };
    }
  }

  return {
    mittelKn, mittelBetragKn, maxKn: Math.abs(diffs[maxI]!), maxUhrzeit: jeStunde[maxI]!.uhr,
    maxRechnungMehr: diffs[maxI]! > 0, stufe, richtungGrad, segelwindUneins, stunden: jeStunde.length,
    jeStunde: jeStunde.map((s) => ({ uhr: s.uhr, r: s.r, v: s.v })),
  };
}



export function segelwindWaehrend(m: Modellabgleich, von: Date, bis: Date): boolean {
  const u = m.segelwindUneins;
  if (!u) return false;
  const tag = von.toISOString().slice(0, 10);
  const vonMin = von.getUTCHours() * 60 + von.getUTCMinutes();
  const bisMin = bis.toISOString().slice(0, 10) === tag ? bis.getUTCHours() * 60 + bis.getUTCMinutes() : 24 * 60;
  const minuten = (uhr: string) => Number(uhr.slice(0, 2)) * 60 + Number(uhr.slice(3, 5));
  return minuten(u.bis) + 60 > vonMin && minuten(u.von) <= bisMin;
}

export function abstandWaehrend(m: Modellabgleich, von: Date, bis: Date): number | null {
  const tag = von.toISOString().slice(0, 10);
  const vonMin = von.getUTCHours() * 60 + von.getUTCMinutes();
  const bisMin = bis.toISOString().slice(0, 10) === tag ? bis.getUTCHours() * 60 + bis.getUTCMinutes() : 24 * 60;
  const beteiligt = m.jeStunde.filter((s) => {
    const beginn = Number(s.uhr.slice(0, 2)) * 60 + Number(s.uhr.slice(3, 5));
    return beginn + 60 > vonMin && beginn <= bisMin;
  });
  if (beteiligt.length === 0) return null;
  return mittel(beteiligt.map((s) => Math.abs(s.r - s.v)));
}
