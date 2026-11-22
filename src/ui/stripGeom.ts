export interface StripSkala {

  startMs: number;

  stepMs: number;

  anzahl: number;

  spanMs: number;
}

export function stripSkala(zeiten: Date[]): StripSkala | null {
  if (zeiten.length < 2) return null;
  const startMs = zeiten[0]!.getTime();
  const endMs = zeiten[zeiten.length - 1]!.getTime();
  if (!(endMs > startMs)) return null;
  const stepMs = (endMs - startMs) / (zeiten.length - 1);
  return { startMs, stepMs, anzahl: zeiten.length, spanMs: zeiten.length * stepMs };
}

export function pctVonZeit(s: StripSkala, tMs: number): number {
  return ((tMs - s.startMs) / s.spanMs) * 100;
}

export function indexVonPct(s: StripSkala, pct: number): number {
  const i = Math.floor((pct / 100) * s.anzahl);
  return Math.min(s.anzahl - 1, Math.max(0, i));
}

export interface PfeilGeometrie {

  vonPct: number;

  bisPct: number;

  abgeschnitten: boolean;
}

export function pfeilGeometrie(s: StripSkala, abfahrtMs: number, ankunftMs: number): PfeilGeometrie {
  const vonPct = pctVonZeit(s, abfahrtMs);
  const rohBis = pctVonZeit(s, ankunftMs);
  return {
    vonPct,
    bisPct: Math.min(100, rohBis),
    abgeschnitten: rohBis > 100,
  };
}
