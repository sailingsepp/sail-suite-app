import type { Punkt } from './types';

export interface Landmaske {
  swLat: number; swLon: number; dLat: number; dLon: number; nx: number; ny: number;

  art: Uint8Array;
  zelleSm: number;
}

const MAX_ZELLEN = 600_000;

export function baueLandmaske(
  box: { swLat: number; swLon: number; neLat: number; neLon: number }, kueste: readonly [Punkt, Punkt][], zelleSm = 1,
): Landmaske {
  const cosLat = Math.max(0.2, Math.cos((((box.swLat + box.neLat) / 2) * Math.PI) / 180));
  let zelle = zelleSm;
  let dLat = zelle / 60, dLon = zelle / (60 * cosLat);
  let nx = Math.max(1, Math.ceil((box.neLon - box.swLon) / dLon)), ny = Math.max(1, Math.ceil((box.neLat - box.swLat) / dLat));
  if (nx * ny > MAX_ZELLEN) {
    zelle *= Math.sqrt((nx * ny) / MAX_ZELLEN);
    dLat = zelle / 60; dLon = zelle / (60 * cosLat);
    nx = Math.ceil((box.neLon - box.swLon) / dLon); ny = Math.ceil((box.neLat - box.swLat) / dLat);
  }
  const n = nx * ny;
  const art = new Uint8Array(n).fill(1);

  const stuecke = new Map<number, number[]>();
  const merke = (x: number, y: number, s: number) => {
    if (x < 0 || y < 0 || x >= nx || y >= ny) return;
    const i = y * nx + x;
    art[i] = 0;
    let l = stuecke.get(i);
    if (!l) { l = []; stuecke.set(i, l); }
    if (l[l.length - 1] !== s) l.push(s);
  };
  kueste.forEach(([a, b], s) => {
    if (Math.max(a.lat, b.lat) < box.swLat || Math.min(a.lat, b.lat) > box.neLat
      || Math.max(a.lon, b.lon) < box.swLon || Math.min(a.lon, b.lon) > box.neLon) return;
    const x0 = (a.lon - box.swLon) / dLon, y0 = (a.lat - box.swLat) / dLat;
    const x1 = (b.lon - box.swLon) / dLon, y1 = (b.lat - box.swLat) / dLat;
    const schritte = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 3));
    let vx = Math.floor(x0), vy = Math.floor(y0);
    merke(vx, vy, s);
    for (let k = 1; k <= schritte; k++) {
      const t = k / schritte;
      const cx = Math.floor(x0 + (x1 - x0) * t), cy = Math.floor(y0 + (y1 - y0) * t);
      if (cx !== vx && cy !== vy) merke(cx, vy, s);
      merke(cx, cy, s);
      vx = cx; vy = cy;
    }
  });

  const flaeche = new Int32Array(n).fill(-1);
  const stapel = new Int32Array(n);
  const stimmen: { land: number; wasser: number }[] = [];
  const cos = cosLat;
  for (let s0 = 0; s0 < n; s0++) {
    if (art[s0] === 0 || flaeche[s0] !== -1) continue;
    const id = stimmen.length;
    const st = { land: 0, wasser: 0 };
    stimmen.push(st);
    let oben = 0;
    stapel[oben++] = s0; flaeche[s0] = id;
    while (oben > 0) {
      const i = stapel[--oben]!;
      const x = i % nx, y = (i - x) / nx;
      let amUfer = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
        const j = yy * nx + xx;
        if (art[j] === 0) { amUfer = true; continue; }
        if (flaeche[j] === -1) { flaeche[j] = id; stapel[oben++] = j; }
      }
      if (!amUfer) continue;

      const p = { lat: box.swLat + (y + 0.5) * dLat, lon: box.swLon + (x + 0.5) * dLon };
      let best = Infinity, seite = 0;
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
        for (const s of stuecke.get(yy * nx + xx) ?? []) {
          const [a, b] = kueste[s]!;
          const ax = (a.lon - p.lon) * cos, ay = a.lat - p.lat, bx = (b.lon - p.lon) * cos, by = b.lat - p.lat;
          const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
          if (l2 === 0) continue;
          const t = Math.max(0, Math.min(1, -(ax * ex + ay * ey) / l2));
          const d = Math.hypot(ax + t * ex, ay + t * ey);

          if (d < best) { best = d; seite = ex * (0 - ay) - ey * (0 - ax); }
        }
      }
      if (seite > 0) st.land++; else if (seite < 0) st.wasser++;
    }
  }
  for (let i = 0; i < n; i++) {
    if (art[i] === 0) continue;
    const st = stimmen[flaeche[i]!]!;
    art[i] = st.land > st.wasser ? 2 : st.wasser > st.land ? 1 : 3;
  }
  return { swLat: box.swLat, swLon: box.swLon, dLat, dLon, nx, ny, art, zelleSm: zelle };
}

export function landStueckSm(m: Landmaske, a: Punkt, b: Punkt): number {
  const cos = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const sm = Math.hypot((b.lat - a.lat) * 60, (b.lon - a.lon) * 60 * cos);
  const schritte = Math.max(1, Math.ceil(sm / (m.zelleSm / 2)));
  const je = sm / schritte;
  let laengstes = 0, lauf = 0;
  for (let k = 0; k <= schritte; k++) {
    const t = k / schritte;
    const x = Math.floor((a.lon + t * (b.lon - a.lon) - m.swLon) / m.dLon);
    const y = Math.floor((a.lat + t * (b.lat - a.lat) - m.swLat) / m.dLat);
    if (x < 0 || y < 0 || x >= m.nx || y >= m.ny) { lauf = 0; continue; }
    const z = m.art[y * m.nx + x]!;
    if (z === 2) { lauf += je; laengstes = Math.max(laengstes, lauf); } else if (z !== 0) lauf = 0;
  }
  return laengstes;
}
