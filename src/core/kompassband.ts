export const KOMPASS_PX_JE_GRAD = 3;
export const KOMPASS_VON = -360;
export const KOMPASS_BIS = 720;

export type MarkenArt = 'stark' | 'zahl' | 'strich';
export interface Marke { grad: number; lang: boolean; art: MarkenArt; text: string }

export function kompassMarken(): Marke[] {
  const aus: Marke[] = [];
  for (let d = KOMPASS_VON; d <= KOMPASS_BIS; d += 5) {
    const g = ((d % 360) + 360) % 360;
    if (g % 10 !== 0) { aus.push({ grad: d, lang: false, art: 'strich', text: '' }); continue; }
    aus.push({ grad: d, lang: true, art: g % 30 === 0 ? 'stark' : 'zahl', text: String(g).padStart(3, '0') });
  }
  return aus;
}

export function kuerzesterWeg(von: number, nach: number): number {
  const d = ((((nach - von) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

export function naehereAn(angezeigt: number, ziel: number, dtMs: number, tauMs = 300): number {
  const d = kuerzesterWeg(angezeigt, ziel);
  const f = Math.abs(d) < 0.05 ? 1 : 1 - Math.exp(-dtMs / tauMs);
  return (((angezeigt + d * f) % 360) + 360) % 360;
}

export function bandVersatz(kurs: number, breitePx: number): number {
  return breitePx / 2 - (kurs - KOMPASS_VON) * KOMPASS_PX_JE_GRAD;
}
