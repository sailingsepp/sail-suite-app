import { distNM } from './geo';


export interface GrenzUrteil {
  warnen: boolean;
  zuletzt: string | null;
  
  art?: 'eintritt' | 'verlassen';
}


export const VERLASSEN_RUHE_MS = 60 * 60_000;

export function grenzUrteil(
  zuletzt: string | null, jetzt: string | null, voraus: string | null,
  verlassen: { staat: string; t: number } | null = null, nunMs = 0,
): GrenzUrteil {
  const bisher = jetzt ?? zuletzt;
  if (voraus && voraus !== bisher) return { warnen: true, zuletzt: voraus, art: 'eintritt' };
  if (jetzt && voraus === null) {
    const ruhig = verlassen?.staat === jetzt && nunMs - verlassen.t < VERLASSEN_RUHE_MS;
    return { warnen: !ruhig, zuletzt: bisher, art: 'verlassen' };
  }
  return { warnen: false, zuletzt: bisher };
}


export function hoheitAusAntwort(
  a: { hoheit?: string; awz?: string; alle?: readonly { name: string; art: string }[] } | null,
  staat: (hoheit: string) => string | null,
): string | null | undefined {
  if (!a) return undefined;
  if (a.hoheit) return staat(a.hoheit) ?? undefined;
  if (a.awz) return null;
  return istHoheSee(a) ? null : undefined;
}


export function istHoheSee(a: { hoheit?: string; awz?: string; alle?: readonly { name: string; art: string }[] }): boolean {
  if (a.hoheit || a.awz) return false;
  const alle = a.alle ?? [];
  if (alle.some((e) => e.art.toLowerCase() === 'nation')) return false;
  return alle.some((e) => e.art.toLowerCase() === 'iho sea area' || /^high seas\b/i.test(e.name));
}


export function stichprobenEntlang(
  punkte: readonly { lat: number; lon: number }[], abstandSm = 10, min = 3, max = 12,
): { lat: number; lon: number }[] {
  if (punkte.length < 2) return [];
  const schenkel = punkte.slice(1).map((b, i) => distNM(punkte[i]!.lat, punkte[i]!.lon, b.lat, b.lon));
  const gesamt = schenkel.reduce((s, x) => s + x, 0);
  if (!(gesamt > 0)) return [];
  const n = Math.max(min, Math.min(max, Math.round(gesamt / abstandSm)));
  const aus: { lat: number; lon: number }[] = [];
  for (let k = 1; k <= n; k++) {
    let rest = (gesamt * k) / (n + 1);
    for (let i = 0; i < schenkel.length; i++) {
      const s = schenkel[i]!;
      if (rest <= s || i === schenkel.length - 1) {
        const f = s > 0 ? Math.min(1, rest / s) : 0;
        const a = punkte[i]!, b = punkte[i + 1]!;
        aus.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });
        break;
      }
      rest -= s;
    }
  }
  return aus;
}
