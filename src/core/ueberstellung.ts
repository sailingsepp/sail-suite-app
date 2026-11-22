export function istUeberstellung(start: unknown, ziel: unknown): boolean {
  const a = start as { lat?: unknown; lon?: unknown } | null, b = ziel as { lat?: unknown; lon?: unknown } | null;
  if (!a || !b || typeof a.lat !== 'number' || typeof a.lon !== 'number' || typeof b.lat !== 'number' || typeof b.lon !== 'number') return false;
  const k = Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((b.lat - a.lat) * 60, (b.lon - a.lon) * 60 * k) > 0.1;
}
