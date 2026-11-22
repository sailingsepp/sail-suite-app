import type { Punkt } from './types';



export interface Kante {
  a: Punkt;
  b: Punkt;
  
  art: 'kueste' | 'steg';
  
  halbeBreiteM?: number;
}

export interface LiegeLage {
  
  kurs: number;
  
  lat: number;
  lon: number;
  
  seite: 'bb' | 'stb' | null;
  
  abstandM: number;
}


export const LIEGE_MAX_M = 20;

const SEITE_SICHER_M = 1.5;

export const ANFAHRT_MIN_M = 30;

export const STEG_HALBE_BREITE_M = 1.5;

const M_JE_GRAD = 111_320;

function ebene(bezug: Punkt) {
  const c = Math.cos((bezug.lat * Math.PI) / 180);
  return {
    hin: (p: Punkt): [number, number] => [(p.lon - bezug.lon) * c * M_JE_GRAD, (p.lat - bezug.lat) * M_JE_GRAD],
    zurueck: (x: number, y: number): Punkt => ({ lat: bezug.lat + y / M_JE_GRAD, lon: bezug.lon + x / (c * M_JE_GRAD) }),
  };
}

const peilung = (x: number, y: number): number => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
const winkelAbstand = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

interface Treffer { k: Kante; fx: number; fy: number; ux: number; uy: number; d: number }


function naechste(kanten: readonly Kante[], hin: (q: Punkt) => [number, number]): Treffer | null {
  let best: Treffer | null = null;
  for (const k of kanten) {
    const [ax, ay] = hin(k.a), [bx, by] = hin(k.b);
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) continue;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    const fx = ax + t * dx, fy = ay + t * dy;
    const d = Math.hypot(fx, fy) - (k.halbeBreiteM ?? 0);
    if (!best || d < best.d) {
      const l = Math.sqrt(l2);
      best = { k, fx, fy, ux: dx / l, uy: dy / l, d };
    }
  }
  return best;
}


export function liegeLage(
  p: Punkt, art: 'heck' | 'bug' | 'laengsseits', kanten: readonly Kante[],
  anfahrt: Punkt | null = null, anfahrtKurs: number | null = null,
): LiegeLage | null {
  const { hin, zurueck } = ebene(p);
  const t = naechste(kanten, hin);
  if (!t || t.d > LIEGE_MAX_M) return null;
  const { fx, fy, ux, uy } = t;
  
  const rx = uy, ry = -ux;
  let seite: 1 | -1;
  if (t.k.art === 'kueste') {
    seite = 1;
  } else {
    
    const vx = -fx, vy = -fy;
    const quer = vx * rx + vy * ry;
    if (Math.abs(quer) >= SEITE_SICHER_M || !anfahrt) seite = quer >= 0 ? 1 : -1;
    else {
      const [qx, qy] = hin(anfahrt);
      seite = (qx - fx) * rx + (qy - fy) * ry >= 0 ? 1 : -1;
    }
  }
  const nx = seite * rx, ny = seite * ry;
  const versatz = t.k.halbeBreiteM ?? 0;
  const kai = zurueck(fx + nx * versatz, fy + ny * versatz);
  const abstandM = Math.max(0, t.d);
  if (art === 'heck') return { kurs: peilung(nx, ny), lat: kai.lat, lon: kai.lon, seite: null, abstandM };
  if (art === 'bug') return { kurs: peilung(-nx, -ny), lat: kai.lat, lon: kai.lon, seite: null, abstandM };
  
  const vor = peilung(ux, uy), zurueckK = (vor + 180) % 360;
  const kurs = anfahrtKurs != null && winkelAbstand(anfahrtKurs, zurueckK) < winkelAbstand(anfahrtKurs, vor) ? zurueckK : vor;
  
  const kr = (kurs * Math.PI) / 180;
  const stbX = Math.cos(kr), stbY = -Math.sin(kr);
  const seiteKai = -nx * stbX - ny * stbY > 0 ? 'stb' : 'bb';
  return { kurs, lat: kai.lat, lon: kai.lon, seite: seiteKai, abstandM };
}


export function kantenAusOsm(
  elemente: readonly { type: string; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }[],
): Kante[] {
  const out: Kante[] = [];
  for (const e of elemente) {
    const g = e.geometry;
    if (e.type !== 'way' || !g || g.length < 2) continue;
    const t = e.tags ?? {};
    const geschlossen = g.length > 3 && g[0]!.lat === g[g.length - 1]!.lat && g[0]!.lon === g[g.length - 1]!.lon;
    const kueste = t['natural'] === 'coastline';
    const halbeBreiteM = !kueste && !geschlossen && t['man_made'] === 'pier' ? STEG_HALBE_BREITE_M : 0;
    for (let i = 1; i < g.length; i++) {
      out.push({ a: { lat: g[i - 1]!.lat, lon: g[i - 1]!.lon }, b: { lat: g[i]!.lat, lon: g[i]!.lon }, art: kueste ? 'kueste' : 'steg', halbeBreiteM });
    }
  }
  return out;
}
