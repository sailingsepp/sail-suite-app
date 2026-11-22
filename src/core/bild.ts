export const MAX_KANTE = 1600;

export const QUALITAET = 0.8;

export interface Bildmass {
  breite: number;
  hoehe: number;
}

export type Speicherstufe = 'ok' | 'knapp' | 'kritisch';

export function zielGroesse(breite: number, hoehe: number, maxKante = MAX_KANTE): Bildmass {
  if (!(breite > 0) || !(hoehe > 0)) return { breite: 0, hoehe: 0 };
  const laengste = Math.max(breite, hoehe);
  if (laengste <= maxKante) return { breite: Math.round(breite), hoehe: Math.round(hoehe) };
  const faktor = maxKante / laengste;

  return {
    breite: Math.max(1, Math.round(breite * faktor)),
    hoehe: Math.max(1, Math.round(hoehe * faktor)),
  };
}

export function darfBildSpeichern(
  belegt: number, kontingent: number, bytes: number,
): { ok: boolean; lage: Speicherstufe } {
  if (!kontingent || !Number.isFinite(kontingent)) return { ok: true, lage: 'ok' };
  const nachher = (belegt + Math.max(0, bytes)) / kontingent;
  const lage: Speicherstufe = nachher >= 0.95 ? 'kritisch' : nachher >= 0.8 ? 'knapp' : 'ok';
  return { ok: lage !== 'kritisch', lage };
}

export function bildKennung(t: number, zufall: () => number = Math.random): string {
  const iso = new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const buchstaben = 'abcdefghijkmnpqrstuvwxyz23456789';
  let schwanz = '';
  for (let i = 0; i < 4; i++) schwanz += buchstaben[Math.floor(zufall() * buchstaben.length)];
  return 'b' + iso + '-' + schwanz;
}

export function aufnahmeZeit(
  lastModified: number | undefined, jetzt: number, fensterMs = 6 * 3600_000,
): number {
  if (!lastModified || !Number.isFinite(lastModified)) return jetzt;
  if (lastModified > jetzt + 60_000) return jetzt;
  if (jetzt - lastModified > fensterMs) return jetzt;
  return lastModified;
}
