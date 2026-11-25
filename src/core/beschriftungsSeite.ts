const RICHTUNGEN = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export function bildschirmRichtung(a: { x: number; y: number }, b: { x: number; y: number }): number | null {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
}

const abstand = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

export function freieRichtung(meiden: readonly (number | null)[]): number {
  const r = meiden.filter((x): x is number => x !== null);
  if (r.length === 0) return 0;
  let beste = 0, min = -1, summe = -1;
  for (const w of RICHTUNGEN) {
    const ab = r.map((x) => abstand(w, x));
    const m = Math.min(...ab), s = ab.reduce((a, b) => a + b, 0);
    if (m > min + 1e-9 || (Math.abs(m - min) <= 1e-9 && s > summe + 1e-9)) { beste = w; min = m; summe = s; }
  }
  return beste;
}

export function tooltipLage(richtung: number, abstandPx: number): { direction: 'top' | 'bottom' | 'left' | 'right'; offset: [number, number] } {
  const sx = Math.sin(richtung * Math.PI / 180), cy = Math.cos(richtung * Math.PI / 180);
  if (sx > 0.3) return { direction: 'right', offset: [abstandPx, Math.round(-cy * abstandPx * 1.6)] };
  if (sx < -0.3) return { direction: 'left', offset: [-abstandPx, Math.round(-cy * abstandPx * 1.6)] };
  return cy > 0 ? { direction: 'top', offset: [0, -abstandPx] } : { direction: 'bottom', offset: [0, abstandPx] };
}
