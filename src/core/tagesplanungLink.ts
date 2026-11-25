import type { Punkt } from './types';

export function tagesplanungUrl(von: Punkt, nach: Punkt, datumIso: string, zwischen: readonly Punkt[] = []): string {
  const punkte = [von, ...ausgeduennt(zwischen, ZWISCHEN_MAX), nach];
  const route = punkte.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(';');
  return `/coursecast/?route=${encodeURIComponent(route)}&datum=${datumIso.slice(0, 10)}`;
}

export const ZWISCHEN_MAX = 60;

function ausgeduennt(p: readonly Punkt[], max: number): Punkt[] {
  if (p.length <= max) return [...p];
  return Array.from({ length: max }, (_, i) => p[Math.round((i * (p.length - 1)) / (max - 1))]!);
}
