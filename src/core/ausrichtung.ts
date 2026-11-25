import { relAngle } from './geo';

export interface Windprobe {

  dir: number;
  speed: number;

  zeitIso?: string;
}

export function vorherrschendeWindrichtung(proben: readonly Windprobe[]): number | null {
  let summeX = 0, summeY = 0;
  for (const p of proben) {
    const rad = (p.dir * Math.PI) / 180;
    summeX += p.speed * Math.sin(rad);
    summeY += p.speed * Math.cos(rad);
  }
  if (Math.hypot(summeX, summeY) < 1e-9) return null;
  return ((Math.atan2(summeX, summeY) * 180) / Math.PI + 360) % 360;
}

function upwindGrad(etappenBearingDeg: number, vorherrschenderWindDeg: number): number {
  const gamma = relAngle(vorherrschenderWindDeg, etappenBearingDeg);
  return 1 - gamma / 180;
}

export function ausrichtungstermRundtoern(
  etappenBearingDeg: number, vorherrschenderWindDeg: number, zeitanteil: number,
): number {
  const z = Math.min(1, Math.max(0, zeitanteil));
  const grad = upwindGrad(etappenBearingDeg, vorherrschenderWindDeg);
  return (grad - 0.5) * (2 * z - 1);
}

export function ausrichtungstermEinweg(
  etappenBearingDeg: number, vorherrschenderWindDeg: number, zeitanteil: number,
): number {
  const z = Math.min(1, Math.max(0, zeitanteil));
  const grad = upwindGrad(etappenBearingDeg, vorherrschenderWindDeg);
  return grad * z;
}
