import type { Punkt } from './types';

export type NavQuelle = 'coursecast' | 'voyagebook';
export const MAX_NAV_PUNKTE = 200;

export interface NavUebergabe {
  wegpunkte: Punkt[];
  vonName: string | null;
  nachName: string | null;
  quelle: NavQuelle | null;
}

export function navUrl(wegpunkte: readonly Punkt[], opt: { vonName?: string | null; nachName?: string | null; quelle: NavQuelle }): string {
  const route = wegpunkte.slice(0, MAX_NAV_PUNKTE).map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(';');
  const q = new URLSearchParams({ navroute: route, quelle: opt.quelle });
  if (opt.vonName) q.set('von', opt.vonName);
  if (opt.nachName) q.set('nach', opt.nachName);
  return `/trackbook/?${q.toString()}`;
}

export function liesNavUrl(search: string): NavUebergabe | null {
  const q = new URLSearchParams(search);
  const roh = q.get('navroute');
  if (!roh) return null;
  const teile = roh.split(';');
  if (teile.length < 2 || teile.length > MAX_NAV_PUNKTE) return null;
  const wegpunkte: Punkt[] = [];
  for (const t of teile) {
    const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(t);
    if (!m) return null;
    const lat = Number(m[1]), lon = Number(m[2]);
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
    wegpunkte.push({ lat, lon });
  }
  const quelle = q.get('quelle');
  const name = (k: string) => { const v = q.get(k)?.trim(); return v ? v.slice(0, 80) : null; };
  return {
    wegpunkte, vonName: name('von'), nachName: name('nach'),
    quelle: quelle === 'coursecast' || quelle === 'voyagebook' ? quelle : null,
  };
}

export function ohneNavParameter(search: string): string {
  const q = new URLSearchParams(search);
  for (const k of ['navroute', 'von', 'nach', 'quelle']) q.delete(k);
  const s = q.toString();
  return s ? `?${s}` : '';
}
