


export const NAH_KM = 40;

type P = readonly [number, number];

const REGIONEN: { gruppe: string; linie: P[] }[] = [
  
  { gruppe: 'Cataluña', linie: [[42.4274, 3.1589], [41.3826, 2.1771], [41.1172, 1.2546], [40.5439, 0.4808]] },
  
  { gruppe: 'Valencia y Murcia', linie: [[40.4704, 0.4746], [39.4697, -0.3763], [38.8408, 0.1061], [38.3436, -0.4882], [37.6155, -0.9875], [37.41, -1.5805]] },
  
  { gruppe: 'Andalucía Oriental y Melilla', linie: [[37.3608, -1.6637], [36.7212, -2.1932], [36.8686, -2.312], [36.7451, -3.5208], [36.7648, -4.4422], [36.377, -5.249]] },
  { gruppe: 'Andalucía Oriental y Melilla', linie: [[35.2919, -2.9409]] },
];

const BALEAREN = { gruppe: 'Illes Balears', s: 38.6404, n: 40.0946, w: 1.1573, o: 4.328, rand: 0.15 };

function abstandKm(lat: number, lon: number, a: P, b: P): number {
  const k = Math.cos((lat * Math.PI) / 180);
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = lon * k, py = lat;
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy) * 111.2;
}

function linieKm(lat: number, lon: number, linie: P[]): number {
  if (linie.length === 1) return abstandKm(lat, lon, linie[0]!, linie[0]!);
  let min = Infinity;
  for (let i = 1; i < linie.length; i++) min = Math.min(min, abstandKm(lat, lon, linie[i - 1]!, linie[i]!));
  return min;
}


export function aemetRegionAn(lat: number, lon: number): string | null {
  const b = BALEAREN;
  if (lat >= b.s - b.rand && lat <= b.n + b.rand && lon >= b.w - b.rand && lon <= b.o + b.rand) return b.gruppe;
  let best: { gruppe: string; km: number } | null = null;
  for (const r of REGIONEN) {
    const km = linieKm(lat, lon, r.linie);
    if (!best || km < best.km) best = { gruppe: r.gruppe, km };
  }
  return best && best.km <= NAH_KM ? best.gruppe : null;
}


export function aemetRegionenEntlang(punkte: { lat: number; lon: number }[]): string[] {
  const out: string[] = [];
  for (const p of punkte) {
    const g = aemetRegionAn(p.lat, p.lon);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}
