import { windAt } from '@/data/openMeteo';
import { stromAn, loeseAbschnitt, seegangAn } from '@/core/evaluate';
import type { CopernicusGitter } from '@/core/copernicusMarine';
import type { StreckenPunkt, StundenWind, StundenMarine, SchiffConfig } from '@/core/types';
import type { TrackPunkt } from './map';


export function routeWindTrack(
  departure: Date,
  points: StreckenPunkt[],
  windData: StundenWind[],
  curData: (StundenMarine | null)[] | null,
  cfg: SchiffConfig,
  
  copernicusGitter: CopernicusGitter | null | undefined,
  
  utcOffsetSeconds: number,
): TrackPunkt[] {
  const track: TrackPunkt[] = [];
  let tHrs = 0;
  
  let haltHrs = 0;
  
  
  
  let letzteLage: Pick<TrackPunkt, 'twa' | 'awa' | 'aws' | 'underMotor' | 'beating' | 'gybing' | 'steuerbordbug'> = {
    twa: 0, awa: 0, aws: 0, underMotor: false, beating: false, gybing: false, steuerbordbug: true,
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (p.halt && p.halt.min > 0 && i > 0 && i < points.length - 1) haltHrs += p.halt.min / 60;
    const t = new Date(departure.getTime() + (tHrs + haltHrs) * 3600 * 1000);
    const w = windAt(windData[i]!, t);
    
    const wv = seegangAn(copernicusGitter, curData?.[i] ?? null, p.lat, p.lon, t, utcOffsetSeconds);
    const see = wv.valid ? { hs: wv.hs } : {};
    if (i < points.length - 1) {
      const cur = stromAn(copernicusGitter, curData?.[i] ?? null, p.lat, p.lon, t, cfg.useCurrent, utcOffsetSeconds);
      const course = p.course ?? points[Math.max(0, i - 1)]!.course ?? 0;
      const seg = loeseAbschnitt(course, w, cur, cfg, p.lat, p.lon, t);
      
      
      const relativ = ((w.dir - seg.heading) % 360 + 360) % 360;
      letzteLage = {
        twa: seg.twa, awa: seg.awa, aws: seg.aws,
        underMotor: seg.underMotor, beating: seg.beating, gybing: seg.gybing,
        steuerbordbug: relativ < 180,
      };
      track.push({ lat: p.lat, lon: p.lon, nm: p.cum, time: t, dir: w.dir, speed: w.speed, gust: w.gust, ...letzteLage, ...see });

      
      
      const segNM = points[i + 1]!.cum - p.cum;
      const tEnde = new Date(t.getTime() + (segNM / seg.sog) * 3600 * 1000);
      const w2 = windAt(windData[i + 1]!, tEnde);
      const p2 = points[i + 1]!;
      const cur2 = stromAn(copernicusGitter, curData?.[i + 1] ?? null, p2.lat, p2.lon, tEnde, cfg.useCurrent, utcOffsetSeconds);
      const seg2 = loeseAbschnitt(course, w2, cur2, cfg, p2.lat, p2.lon, tEnde);
      tHrs += segNM / 2 * (1 / seg.sog + 1 / seg2.sog);
    } else {
      track.push({ lat: p.lat, lon: p.lon, nm: p.cum, time: t, dir: w.dir, speed: w.speed, gust: w.gust, ...letzteLage, ...see });
    }
  }
  return track;
}
