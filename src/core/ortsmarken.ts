import { distNM } from './geo';

export const NAME_TRAEGT_M = 300;

export const ABLEGEN_NAME_TRAEGT_M = 1852;

export function nameRadiusM(art: string, radiusM = NAME_TRAEGT_M): number {
  return art === 'start' ? Math.max(radiusM, ABLEGEN_NAME_TRAEGT_M) : radiusM;
}

const M_PRO_NM = 1852;

interface Ort { lat: number; lon: number; name?: string | undefined }

export function nameAusNaehe(ort: Ort, bekannte: readonly Ort[], radiusM = NAME_TRAEGT_M): string | null {
  let best: { name: string; m: number } | null = null;
  for (const b of bekannte) {
    if (!b.name) continue;
    const m = distNM(ort.lat, ort.lon, b.lat, b.lon) * M_PRO_NM;
    if (m <= radiusM && (!best || m < best.m)) best = { name: b.name, m };
  }
  return best?.name ?? null;
}

export const ORTS_EINTRAEGE = ['start', 'anlegen', 'ankern', 'liegeplatz', 'ankerplatz', 'treiben'] as const;

interface Eintrag { art: string; lat: number | null; lon: number | null; text?: string | undefined; bearbeitet?: true | undefined }

export function eintraegeOhneName<T extends Eintrag>(
  eintraege: readonly T[], ort: Ort, radiusM = NAME_TRAEGT_M,

  alterName?: string,
): T[] {
  return eintraege.filter((e) =>
    (ORTS_EINTRAEGE as readonly string[]).includes(e.art)

    && !e.bearbeitet
    && (!e.text || (alterName !== undefined && e.text === alterName))
    && e.lat !== null && e.lon !== null
    && distNM(ort.lat, ort.lon, e.lat, e.lon) * M_PRO_NM <= nameRadiusM(e.art, radiusM));
}

export function eintraegeOhneMarke<T extends Eintrag & { fahrt: string; t: number }>(
  eintraege: readonly T[], marken: readonly (Ort & { fahrt: string })[], tagesbeginn: number,
  radiusM = NAME_TRAEGT_M,
): { eintrag: T; art: 'start' | 'pause' }[] {
  const raus: { eintrag: T; art: 'start' | 'pause' }[] = [];
  for (const e of eintraege) {
    if (!(ORTS_EINTRAEGE as readonly string[]).includes(e.art) || e.text) continue;
    if (e.lat === null || e.lon === null) continue;
    const lat = e.lat, lon = e.lon;
    const gedeckt = marken.some((m) => m.fahrt === e.fahrt
      && distNM(lat, lon, m.lat, m.lon) * M_PRO_NM <= nameRadiusM(e.art, radiusM));
    if (!gedeckt) raus.push({ eintrag: e, art: e.t === tagesbeginn || e.art === 'start' ? 'start' : 'pause' });
  }
  return raus;
}

export function abfrageReihenfolge<T extends { art: string; t: number }>(offen: readonly T[]): T[] {
  const rang = (a: string) => (a === 'start' || a === 'ziel' ? 0 : 1);
  return [...offen].sort((a, b) => rang(a.art) - rang(b.art) || b.t - a.t);
}

export function wartezeitMs(art: string): number {
  return art === 'start' || art === 'ziel' ? 2 * 60_000 : 10 * 60_000;
}

export const NAMENSFORM = 11;

export function darfNamenErsetzen(alterName: string | undefined, vollstaendig: boolean): boolean {
  return vollstaendig || !alterName;
}

export const NEUFASSUNG_TAGE = 21;

export function brauchtAbfrage(
  m: { name?: string | undefined; nameForm?: number | undefined; t: number; versucht?: number | undefined; art: string },
  jetzt: number,
): boolean {
  const veraltet = !!m.name && (m.nameForm ?? 1) < NAMENSFORM && jetzt - m.t < NEUFASSUNG_TAGE * 86_400_000;
  if (m.name && !veraltet) return false;
  return !m.versucht || jetzt - m.versucht > wartezeitMs(m.art);
}

const LIEGE_EINTRAEGE: readonly string[] = ['anlegen', 'ankern', 'liegeplatz', 'ankerplatz'];

export function ablegeOrtAusVorlauf<T extends Eintrag>(eintraege: readonly T[], i: number): string | null {
  const ab = eintraege[i];
  if (!ab || ab.art !== 'start' || ab.text || ab.lat === null || ab.lon === null) return null;
  for (let j = i - 1; j >= 0; j--) {
    const e = eintraege[j]!;
    if (e.art === 'start') return null;
    if (!LIEGE_EINTRAEGE.includes(e.art)) continue;
    if (!e.text || e.lat === null || e.lon === null) return null;
    return distNM(ab.lat, ab.lon, e.lat, e.lon) * M_PRO_NM <= ABLEGEN_NAME_TRAEGT_M ? e.text : null;
  }
  return null;
}
