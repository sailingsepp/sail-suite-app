import { toernRevierText, toernRevierStrecke, seegebietSchluessel, REVIER_PFEIL } from '@/core/revierzonen';
import { landAmPunkt } from './geocode';

export async function revierFuerToern(o: {
  start: { lat: number; lon: number } | null;
  ziel: { lat: number; lon: number } | null;
  startText?: string | null;
  landStart?: string | null;
  landZiel?: string | null;
}, sprache: 'de' | 'en'): Promise<string | null> {
  let startText = o.startText ?? null;
  if (!startText && o.start) {
    const land = o.landStart ?? await landAmPunkt(o.start, sprache);
    startText = toernRevierText(land, o.start.lat, o.start.lon, sprache);
  }
  if (!o.ziel) return startText;
  const landZiel = o.landZiel ?? await landAmPunkt(o.ziel, sprache);
  return toernRevierStrecke(startText, o.start, { ...o.ziel, land: landZiel }, sprache);
}

export function zielrevierFehlt(t: {
  revier: string | null; start_hafen?: { lat: number; lon: number } | null; rueckgabe_hafen?: { lat: number; lon: number } | null;
}): boolean {
  const s = t.start_hafen, z = t.rueckgabe_hafen;
  if (!s || !z || (t.revier ?? '').includes(REVIER_PFEIL)) return false;
  const zs = seegebietSchluessel(s.lat, s.lon), zz = seegebietSchluessel(z.lat, z.lon);
  return zz !== null && zs !== zz;
}
