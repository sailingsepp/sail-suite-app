export const TIMER_MIN_S = 0;
export const TIMER_MAX_S = 3600;

export const TIMER_VORGABE = 5;

export interface TimerZustand {

  dauerS: number;

  endeUm: number | null;

  restS: number;

  abgelaufen: boolean;
}

export function neuerTimer(min = TIMER_VORGABE): TimerZustand {
  const dauerS = klemmeSekunden(min * 60);
  return { dauerS, endeUm: null, restS: dauerS, abgelaufen: false };
}

export const klemmeSekunden = (s: number): number => Math.min(TIMER_MAX_S, Math.max(TIMER_MIN_S, Math.round(s)));
export const laeuft = (z: TimerZustand): boolean => z.endeUm !== null;

export function setzeDauer(z: TimerZustand, sekunden: number): TimerZustand {
  if (laeuft(z)) return z;
  const dauerS = klemmeSekunden(sekunden);
  return { ...z, dauerS, restS: dauerS, abgelaufen: false };
}

export function starte(z: TimerZustand, jetzt: number): TimerZustand {
  if (laeuft(z) || z.dauerS <= 0) return z;
  const rest = z.abgelaufen || z.restS <= 0 ? z.dauerS : z.restS;
  return { ...z, endeUm: jetzt + rest * 1000, restS: rest, abgelaufen: false };
}

export function vonVorn(z: TimerZustand, jetzt: number): TimerZustand {
  if (z.dauerS <= 0) return z;
  return { ...z, endeUm: jetzt + z.dauerS * 1000, restS: z.dauerS, abgelaufen: false };
}

export function stoppe(z: TimerZustand, jetzt: number): TimerZustand {
  if (laeuft(z)) return { ...z, endeUm: null, restS: Math.max(0, (z.endeUm! - jetzt) / 1000) };
  return { ...z, restS: z.dauerS, abgelaufen: false };
}

export function stand(z: TimerZustand, jetzt: number): { z: TimerZustand; restS: number; abgelaufen: boolean } {
  if (!laeuft(z)) return { z, restS: z.abgelaufen ? 0 : z.restS, abgelaufen: false };
  const rest = (z.endeUm! - jetzt) / 1000;
  if (rest > 0) return { z, restS: rest, abgelaufen: false };
  return { z: { ...z, endeUm: null, restS: 0, abgelaufen: true }, restS: 0, abgelaufen: true };
}

export function mmss(s: number): string {
  const g = Math.max(0, Math.ceil(s - 1e-6));
  return `${String(Math.floor(g / 60)).padStart(2, '0')}:${String(g % 60).padStart(2, '0')}`;
}

export function ausSpeicher(x: unknown): TimerZustand {
  const z = x as Partial<TimerZustand> | null;
  if (!z || typeof z.dauerS !== 'number' || !Number.isFinite(z.dauerS)) return neuerTimer();
  const dauerS = klemmeSekunden(z.dauerS);
  return {
    dauerS,
    endeUm: typeof z.endeUm === 'number' && Number.isFinite(z.endeUm) ? z.endeUm : null,
    restS: typeof z.restS === 'number' && Number.isFinite(z.restS) ? Math.min(dauerS, Math.max(0, z.restS)) : dauerS,
    abgelaufen: z.abgelaufen === true,
  };
}
