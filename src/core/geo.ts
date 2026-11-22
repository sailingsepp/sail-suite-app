import type { Punkt, StreckenPunkt } from './types';

const R_NM = 3440.065;

export const toRad = (d: number): number => (d * Math.PI) / 180;
export const toDeg = (r: number): number => (r * 180) / Math.PI;

export function distNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R_NM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}



const mercatorBreite = (φ: number): number => Math.log(Math.tan(Math.PI / 4 + φ / 2));

function lonDifferenz(lon1: number, lon2: number): number {
  let Δλ = toRad(lon2 - lon1);
  if (Math.abs(Δλ) > Math.PI) Δλ = Δλ > 0 ? Δλ - 2 * Math.PI : Δλ + 2 * Math.PI;
  return Δλ;
}


export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const Δψ = mercatorBreite(toRad(lat2)) - mercatorBreite(toRad(lat1));
  return (toDeg(Math.atan2(lonDifferenz(lon1, lon2), Δψ)) + 360) % 360;
}


export function distLoxNM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = φ2 - φ1;
  const Δψ = mercatorBreite(φ2) - mercatorBreite(φ1);
  const q = Math.abs(Δψ) > 1e-12 ? Δφ / Δψ : Math.cos(φ1);
  const Δλ = lonDifferenz(lon1, lon2);
  return Math.sqrt(Δφ * Δφ + q * q * Δλ * Δλ) * R_NM;
}


export function destPoint(lat: number, lon: number, bearing: number, dNM: number): [number, number] {
  const δ = dNM / R_NM, θ = toRad(bearing);
  const φ1 = toRad(lat), λ1 = toRad(lon);
  let φ2 = φ1 + δ * Math.cos(θ);
  
  if (Math.abs(φ2) > Math.PI / 2) φ2 = φ2 > 0 ? Math.PI - φ2 : -Math.PI - φ2;
  const Δψ = mercatorBreite(φ2) - mercatorBreite(φ1);
  const q = Math.abs(Δψ) > 1e-12 ? (φ2 - φ1) / Δψ : Math.cos(φ1);
  const λ2 = λ1 + (δ * Math.sin(θ)) / q;
  return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
}

export function sampleRoute(waypoints: Punkt[], stepNM: number): StreckenPunkt[] {
  const first = waypoints[0]!;
  const points: StreckenPunkt[] = [{ lat: first.lat, lon: first.lon, cum: 0, course: null }];
  let cum = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!, b = waypoints[i + 1]!;
    
    
    const segDist = distLoxNM(a.lat, a.lon, b.lat, b.lon);
    const brg = bearingDeg(a.lat, a.lon, b.lat, b.lon);
    if (points.length === 1 && points[0]!.course === null) points[0]!.course = brg;
    let d = stepNM;
    while (d < segDist) {
      const [plat, plon] = destPoint(a.lat, a.lon, brg, d);
      points.push({ lat: plat, lon: plon, cum: cum + d, course: brg });
      d += stepNM;
    }
    cum += segDist;
    points.push({ lat: b.lat, lon: b.lon, cum, course: brg });
  }
  
  
  
  for (let i = 0; i < points.length - 1; i++) {
    points[i]!.course = bearingDeg(points[i]!.lat, points[i]!.lon, points[i + 1]!.lat, points[i + 1]!.lon);
  }
  return points;
}


export function uv(bearing: number): [number, number] {
  const r = toRad(bearing);
  return [Math.sin(r), Math.cos(r)];
}

export function bearingOf(x: number, y: number): number {
  return (toDeg(Math.atan2(x, y)) + 360) % 360;
}

export function relAngle(windDir: number, course: number): number {
  let diff = Math.abs(windDir - course) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}






function orientierung(p: Punkt, q: Punkt, r: Punkt): number {
  const wert = (q.lon - p.lon) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lon - p.lon);
  if (Math.abs(wert) < 1e-12) return 0;
  return wert > 0 ? 1 : -1;
}

function aufSegment(p: Punkt, q: Punkt, r: Punkt): boolean {
  return Math.min(p.lon, q.lon) <= r.lon && r.lon <= Math.max(p.lon, q.lon)
    && Math.min(p.lat, q.lat) <= r.lat && r.lat <= Math.max(p.lat, q.lat);
}


export function segmenteSchneidenSich(a1: Punkt, a2: Punkt, b1: Punkt, b2: Punkt): boolean {
  const o1 = orientierung(a1, a2, b1), o2 = orientierung(a1, a2, b2);
  const o3 = orientierung(b1, b2, a1), o4 = orientierung(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && aufSegment(a1, a2, b1)) return true;
  if (o2 === 0 && aufSegment(a1, a2, b2)) return true;
  if (o3 === 0 && aufSegment(b1, b2, a1)) return true;
  if (o4 === 0 && aufSegment(b1, b2, a2)) return true;
  return false;
}


export function kreuzungsZahl(von: Punkt, nach: Punkt, kuestenlinien: [Punkt, Punkt][]): number {
  return kuestenlinien.reduce((n, [c1, c2]) => n + (segmenteSchneidenSich(von, nach, c1, c2) ? 1 : 0), 0);
}

function punktZuSegmentAbstand(p: Punkt, a: Punkt, b: Punkt): number {
  const dx = b.lon - a.lon, dy = b.lat - a.lat;
  const laenge2 = dx * dx + dy * dy;
  if (laenge2 < 1e-15) return Math.hypot(p.lon - a.lon, p.lat - a.lat);
  const t = Math.max(0, Math.min(1, ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / laenge2));
  return Math.hypot(p.lon - (a.lon + t * dx), p.lat - (a.lat + t * dy));
}


export function istLandSeite(p: Punkt, kuestenlinien: [Punkt, Punkt][], k = 5): boolean | null {
  if (kuestenlinien.length === 0) return null;
  const naechste = kuestenlinien
    .map((seg): { seg: [Punkt, Punkt]; dist: number } => ({ seg, dist: punktZuSegmentAbstand(p, seg[0], seg[1]) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k);
  const landStimmen = naechste.filter(({ seg }) => orientierung(seg[0], seg[1], p) > 0).length;
  return landStimmen > naechste.length / 2;
}


export function naechsterWasserpunkt(
  landPunkt: Punkt, kuestenlinien: [Punkt, Punkt][], maxRadiusNM = 1.5,
): Punkt | null {
  const ringeNM = [0.03, 0.06, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5].filter((r) => r <= maxRadiusNM);
  const richtungen = 16;
  for (const radiusNM of ringeNM) {
    for (let i = 0; i < richtungen; i++) {
      const bearing = (360 / richtungen) * i;
      const [lat, lon] = destPoint(landPunkt.lat, landPunkt.lon, bearing, radiusNM);
      const kandidat = { lat, lon };
      if (istLandSeite(kandidat, kuestenlinien) === false) return kandidat;
    }
  }
  return null;
}
