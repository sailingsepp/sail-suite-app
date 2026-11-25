import { distNM } from './geo';

export const ZEITZONE_BIS_SM = 300;

export function naechsteZeitzone(
  lat: number, lon: number, stationen: readonly { lat: number; lon: number; zeitzone?: string | null }[],
  bisSm = ZEITZONE_BIS_SM,
): string | null {
  let beste: string | null = null;
  let d = bisSm;
  for (const s of stationen) {
    if (!s.zeitzone) continue;
    const x = distNM(lat, lon, s.lat, s.lon);
    if (x < d) { d = x; beste = s.zeitzone; }
  }
  return beste;
}

export function tagInZone(t: number, zone: string | null): string {
  if (zone) {
    try {

      return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
    } catch {  }
  }
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
