import { wechselAusEintraegen, type Antrieb } from '@/core/antriebsbilanz';



type Punkt3 = readonly [number, number, number];

export interface WechselStelle { t: number; lat: number; lon: number; antrieb: Antrieb }

export function wechselStellen(punkte: readonly Punkt3[], eintraege: readonly { t: number; art: string; text?: string }[]): WechselStelle[] {
  if (punkte.length < 2) return [];
  const anfang = punkte[0]![0];
  const ende = punkte[punkte.length - 1]![0];
  const raus: WechselStelle[] = [];
  let bisher: Antrieb | null = null;
  for (const w of wechselAusEintraegen([...eintraege])) {
    const vorher = bisher;
    bisher = w.antrieb;
    if (vorher === null || vorher === w.antrieb || w.t < anfang || w.t > ende) continue;
    const i = punkte.findIndex((p) => p[0] >= w.t);
    const b = punkte[i]!;
    const a = punkte[Math.max(0, i - 1)]!;
    const f = b[0] > a[0] ? (w.t - a[0]) / (b[0] - a[0]) : 0;
    raus.push({ t: w.t, lat: a[1] + (b[1] - a[1]) * f, lon: a[2] + (b[2] - a[2]) * f, antrieb: w.antrieb });
  }
  return raus;
}
