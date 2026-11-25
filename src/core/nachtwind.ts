import { vorherrschendeWindrichtung, type Windprobe } from './ausrichtung';
import { nDate, localDateStr } from './time';
import type { StundenWind, Tageslicht } from './types';

export interface Nachtfenster {
  von: Date;
  bis: Date;
}

export function nachtfenster(ankunft: Date, tageslicht: Tageslicht): Nachtfenster {
  const heuteIdx = tageslicht.time.indexOf(localDateStr(ankunft));
  const sunset = heuteIdx >= 0 ? nDate(tageslicht.sunset[heuteIdx]!) : null;
  const von = sunset && sunset.getTime() > ankunft.getTime() ? sunset : ankunft;

  for (let i = 0; i < tageslicht.time.length; i++) {
    const sunrise = nDate(tageslicht.sunrise[i]!);
    if (sunrise.getTime() > von.getTime()) return { von, bis: sunrise };
  }
  return { von, bis: new Date(von.getTime() + 10 * 3600_000) };
}

export function nachtwindRichtung(hourly: StundenWind, fenster: Nachtfenster): number | null {
  const proben: Windprobe[] = [];
  hourly.time.forEach((t, i) => {
    const zeit = nDate(t).getTime();
    if (zeit >= fenster.von.getTime() && zeit <= fenster.bis.getTime()) {
      proben.push({ dir: hourly.wind_direction_10m[i]!, speed: hourly.wind_speed_10m[i]! });
    }
  });
  if (proben.length < 2) return null;
  return vorherrschendeWindrichtung(proben);
}

export function nachtwindStaerke(hourly: StundenWind, fenster: Nachtfenster): { windKn: number; boeKn: number } | null {
  let windKn = 0, boeKn = 0, n = 0;
  hourly.time.forEach((t, i) => {
    const zeit = nDate(t).getTime();
    if (zeit < fenster.von.getTime() || zeit > fenster.bis.getTime()) return;
    windKn = Math.max(windKn, hourly.wind_speed_10m[i]!);
    boeKn = Math.max(boeKn, hourly.wind_gusts_10m[i]!);
    n++;
  });
  return n < 2 ? null : { windKn, boeKn };
}
