import type { Punkt, StundenMarine } from './types';
import { imGitter } from './windgitter';

export interface Seegangsgitter {
  lats: readonly number[];
  lons: readonly number[];
  reihen: readonly (readonly StundenMarine[])[];
}

type Feld = 'wave_height' | 'wave_period' | 'swell_wave_height' | 'swell_wave_period' | 'wind_wave_height' | 'wind_wave_period';

type Richtung = 'wave_direction' | 'swell_wave_direction' | 'wind_wave_direction';

function zellenIndex(achse: readonly number[], wert: number): number {
  for (let i = 0; i < achse.length - 1; i++) if (wert < achse[i + 1]!) return i;
  return Math.max(0, achse.length - 2);
}

const zahl = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function seegangAmPunkt(g: Seegangsgitter, p: Punkt): StundenMarine | null {
  if (g.lats.length < 2 || g.lons.length < 2 || !imGitter({ lats: g.lats, lons: g.lons, reihen: [] }, p)) return null;
  const i = zellenIndex(g.lats, p.lat), j = zellenIndex(g.lons, p.lon);
  const lat0 = g.lats[i]!, lat1 = g.lats[i + 1]!, lon0 = g.lons[j]!, lon1 = g.lons[j + 1]!;
  const ty = lat1 === lat0 ? 0 : (p.lat - lat0) / (lat1 - lat0);
  const tx = lon1 === lon0 ? 0 : (p.lon - lon0) / (lon1 - lon0);
  const ecken = [
    { m: g.reihen[i]![j]!, w: (1 - ty) * (1 - tx) },
    { m: g.reihen[i]![j + 1]!, w: (1 - ty) * tx },
    { m: g.reihen[i + 1]![j]!, w: ty * (1 - tx) },
    { m: g.reihen[i + 1]![j + 1]!, w: ty * tx },
  ];
  const zeit = ecken[0]!.m.time;
  if (ecken.some((e) => e.m.time.length !== zeit.length || e.m.time[0] !== zeit[0])) return null;
  const n = zeit.length;
  const aus = (feld: Feld): (number | null)[] => Array.from({ length: n }, (_, h) => {
    let s = 0, w = 0;
    for (const e of ecken) {
      const v = e.m[feld]?.[h];
      if (zahl(v) && e.w > 0) { s += v * e.w; w += e.w; }
    }
    return w > 0 ? s / w : null;
  });
  const richtung = (feld: Richtung, hoehe: Feld): (number | null)[] => Array.from({ length: n }, (_, h) => {
    let x = 0, y = 0, w = 0;
    for (const e of ecken) {
      const d = e.m[feld]?.[h], hs = e.m[hoehe]?.[h];
      if (!zahl(d) || e.w <= 0) continue;
      const g = e.w * (zahl(hs) && hs > 0 ? hs : 1e-6);
      x += g * Math.sin((d * Math.PI) / 180); y += g * Math.cos((d * Math.PI) / 180); w += g;
    }
    return w > 0 ? ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360 : null;
  });
  const leer = Array.from({ length: n }, () => null);
  const out: StundenMarine = {
    time: [...zeit],
    ocean_current_velocity: leer, ocean_current_direction: [...leer],
    wave_height: aus('wave_height'), wave_period: aus('wave_period'), wave_direction: richtung('wave_direction', 'wave_height'),
    swell_wave_height: aus('swell_wave_height'), swell_wave_period: aus('swell_wave_period'),
    swell_wave_direction: richtung('swell_wave_direction', 'swell_wave_height'),
  };

  if (ecken.some((e) => e.m.wind_wave_height)) {
    out.wind_wave_height = aus('wind_wave_height');
    out.wind_wave_period = aus('wind_wave_period');
    out.wind_wave_direction = richtung('wind_wave_direction', 'wind_wave_height');
  }
  return out;
}
