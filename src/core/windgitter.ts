import type { StundenWind, Punkt } from './types';

const OPTIONALE_FELDER = ['wind_speed_80m', 'visibility', 'lifted_index'] as const;

export interface Windgitter {

  lats: readonly number[];

  lons: readonly number[];
  reihen: readonly (readonly StundenWind[])[];
}

export function imGitter(g: Windgitter, p: Punkt): boolean {
  return p.lat >= g.lats[0]! && p.lat <= g.lats[g.lats.length - 1]!
    && p.lon >= g.lons[0]! && p.lon <= g.lons[g.lons.length - 1]!;
}

function zellenIndex(achse: readonly number[], wert: number): number {
  for (let i = 0; i < achse.length - 1; i++) {
    if (wert < achse[i + 1]!) return i;
  }
  return Math.max(0, achse.length - 2);
}

export function windAmPunkt(g: Windgitter, p: Punkt): StundenWind | null {
  if (g.lats.length < 2 || g.lons.length < 2 || !imGitter(g, p)) return null;
  const i = zellenIndex(g.lats, p.lat), j = zellenIndex(g.lons, p.lon);
  const lat0 = g.lats[i]!, lat1 = g.lats[i + 1]!, lon0 = g.lons[j]!, lon1 = g.lons[j + 1]!;
  const ty = lat1 === lat0 ? 0 : (p.lat - lat0) / (lat1 - lat0);
  const tx = lon1 === lon0 ? 0 : (p.lon - lon0) / (lon1 - lon0);

  const ecken: { w: StundenWind; gewicht: number }[] = [
    { w: g.reihen[i]![j]!, gewicht: (1 - ty) * (1 - tx) },
    { w: g.reihen[i]![j + 1]!, gewicht: (1 - ty) * tx },
    { w: g.reihen[i + 1]![j]!, gewicht: ty * (1 - tx) },
    { w: g.reihen[i + 1]![j + 1]!, gewicht: ty * tx },
  ];
  const zeit = ecken[0]!.w.time;

  if (ecken.some((e) => e.w.time.length !== zeit.length || e.w.time[0] !== zeit[0])) return null;

  const gewichtet = (feld: (w: StundenWind) => number[] | undefined, h: number): number => {
    let summe = 0, gewichte = 0;
    for (const e of ecken) {
      const v = feld(e.w)?.[h];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      summe += v * e.gewicht;
      gewichte += e.gewicht;
    }
    return gewichte > 0 ? summe / gewichte : Number.NaN;
  };

  const n = zeit.length;
  const speed: number[] = [], dir: number[] = [], gust: number[] = [];
  const code: number[] = [], precip: number[] = [], cape: number[] = [];
  for (let h = 0; h < n; h++) {
    speed.push(gewichtet((w) => w.wind_speed_10m, h));
    gust.push(gewichtet((w) => w.wind_gusts_10m, h));
    precip.push(gewichtet((w) => w.precipitation, h));
    cape.push(gewichtet((w) => w.cape, h));

    const naechste = ecken.reduce((a, b) => (b.gewicht > a.gewicht ? b : a));
    code.push(naechste.w.weather_code[h] ?? 0);

    let x = 0, y = 0;
    for (const e of ecken) {
      const d = e.w.wind_direction_10m[h], s = e.w.wind_speed_10m[h];
      if (typeof d !== 'number' || typeof s !== 'number') continue;
      const rad = (d * Math.PI) / 180;
      x += Math.sin(rad) * s * e.gewicht;
      y += Math.cos(rad) * s * e.gewicht;
    }
    dir.push(x === 0 && y === 0 ? gewichtet((w) => w.wind_direction_10m, h) : ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360);
  }

  const ergebnis: StundenWind = {
    time: [...zeit], wind_speed_10m: speed, wind_direction_10m: dir, wind_gusts_10m: gust,
    weather_code: code, precipitation: precip, cape,
  };

  for (const feld of OPTIONALE_FELDER) {
    if (!ecken.every((e) => Array.isArray(e.w[feld]))) continue;
    const werte: (number | null)[] = [];
    for (let h = 0; h < n; h++) {
      const v = gewichtet((w) => w[feld] as number[] | undefined, h);
      werte.push(Number.isFinite(v) ? v : null);
    }
    ergebnis[feld] = werte;
  }
  return ergebnis;
}

export function gitterAchsen(
  box: { swLat: number; swLon: number; neLat: number; neLon: number }, schrittGrad: number,
): { lats: number[]; lons: number[] } {
  const achse = (von: number, bis: number): number[] => {
    const start = Math.floor(von / schrittGrad) * schrittGrad;
    const ende = Math.ceil(bis / schrittGrad) * schrittGrad;
    const werte: number[] = [];
    for (let v = start; v <= ende + 1e-9; v += schrittGrad) werte.push(Math.round(v * 1e6) / 1e6);
    return werte.length >= 2 ? werte : [start, start + schrittGrad];
  };
  return { lats: achse(box.swLat, box.neLat), lons: achse(box.swLon, box.neLon) };
}
