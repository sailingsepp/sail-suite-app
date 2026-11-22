


export const NAH_KM = 100;

const ORT = {
  hopa: [41.3854, 41.4632],
  sinop: [42.0266, 35.1512],
  igneada: [41.8883, 27.9628],
  canakkale: [40.1463, 26.4029],
  cesme: [38.3244, 26.3030],
  fethiye: [36.6221, 29.1153],
  anamur: [36.0803, 32.8312],
  iskenderun: [36.5902, 36.1710],
} as const;


const ABSCHNITTE: { name: string; von: readonly [number, number]; bis: readonly [number, number] }[] = [
  { name: 'East Black Sea (Hopa - Sinop)', von: ORT.hopa, bis: ORT.sinop },
  { name: 'West Black Sea (Sinop - İğneada)', von: ORT.sinop, bis: ORT.igneada },
  { name: 'North Aegean (Çanakkale - Çeşme)', von: ORT.canakkale, bis: ORT.cesme },
  { name: 'South Aegean (Çeşme - Fethiye)', von: ORT.cesme, bis: ORT.fethiye },
  { name: 'West Mediterranean (Fehiye - Anamur)', von: ORT.fethiye, bis: ORT.anamur },
  { name: 'East Mediterranean (Anamur - İskenderun)', von: ORT.anamur, bis: ORT.iskenderun },
];

const MARMARA = { name: 'Marmara', s: 40.3013, n: 41.0779, w: 26.6925, o: 29.9421 };

function abstandKm(lat: number, lon: number, a: readonly [number, number], b: readonly [number, number]): number {
  const k = Math.cos((lat * Math.PI) / 180);
  const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = lon * k, py = lat;
  const dx = bx - ax, dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy) * 111.2;
}


export function mgmGebietAn(lat: number, lon: number): string | null {
  if (lat >= MARMARA.s && lat <= MARMARA.n && lon >= MARMARA.w && lon <= MARMARA.o) return MARMARA.name;
  let best: { name: string; km: number } | null = null;
  for (const a of ABSCHNITTE) {
    const km = abstandKm(lat, lon, a.von, a.bis);
    if (!best || km < best.km) best = { name: a.name, km };
  }
  return best && best.km <= NAH_KM ? best.name : null;
}


export function mgmGebieteEntlang(punkte: { lat: number; lon: number }[]): string[] {
  const out: string[] = [];
  for (const p of punkte) {
    const g = mgmGebietAn(p.lat, p.lon);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}
