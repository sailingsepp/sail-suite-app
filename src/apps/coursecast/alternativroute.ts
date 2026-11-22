import type { Ablegezeit, Grenzwerte, Punkt, SchiffConfig, Sprache, Tageslicht } from '@/core/types';
import type { CopernicusGitter } from '@/core/copernicusMarine';
import {
  alternativKandidaten, lohntSich, grundDerAlternative, seitenRichtung, streckenlaengeSm,
  MIN_GEWINN_MIN, type RoutenKandidat,
} from '@/core/alternativroute';
import { sampleRoute, kreuzungsZahl } from '@/core/geo';
import { evaluateDeparture } from '@/core/evaluate';
import { windAmPunkt } from '@/core/windgitter';
import { boxUm } from '@/core/landumfahrung';
import { fmtDur, anzeigeMinuten, nf, uhrLt } from '@/core/time';
import { holeWindgitter } from '@/data/revierwind';
import { kuestenlinienUmGebiet } from '@/data/overpass';
import { fetchWindForPoints } from '@/data/openMeteo';
import { fetchCurrentForPoints } from '@/data/marine';

const GROB_SCHWELLE_MIN = MIN_GEWINN_MIN * 2 / 3;

export interface AlternativVorschlag {
  punkte: Punkt[];
  eigene: Ablegezeit;
  alternative: Ablegezeit;
  versatzSm: number;
  richtung: 'n' | 'o' | 's' | 'w';
  mehrSm: number;
}

export interface AlternativEingabe {
  strecke: Punkt[];
  best: Ablegezeit;
  cfg: SchiffConfig;
  limits: Grenzwerte;
  daylight: Tageslicht;
  utcOffsetSeconds: number;
  sampleStep: number;
  copernicusGitter: CopernicusGitter | null | undefined;
  mitStrom: boolean;
}

export async function sucheAlternativroute(e: AlternativEingabe): Promise<AlternativVorschlag | null> {
  const alle = alternativKandidaten(e.strecke);
  if (alle.length === 0) return null;
  const box = boxUm([...e.strecke, ...alle.flatMap((k) => k.bogen)], 3);

  const kueste = await kuestenlinienUmGebiet(box.swLat, box.swLon, box.neLat, box.neLon).catch(() => null);
  if (!kueste) return null;
  const aufWasser = alle.filter((k) => k.bogen.every((p, i) => i === 0 || kreuzungsZahl(k.bogen[i - 1]!, p, kueste.linien) === 0));
  if (aufWasser.length === 0) return null;

  const gitter = await holeWindgitter(box, schrittFuer(box)).catch(() => null);
  if (!gitter) return null;
  const l = streckenlaengeSm(e.strecke);
  const grobSchritt = Math.max(1, l / 20);
  const grob = (punkte: Punkt[]): Ablegezeit | null => {
    const pts = sampleRoute(punkte, grobSchritt);
    const wind = pts.map((p) => windAmPunkt(gitter.gitter, p));
    if (wind.some((w) => w == null)) return null;
    return evaluateDeparture(
      new Date(e.best.departure), pts, wind as NonNullable<typeof wind[number]>[], null, e.cfg, e.limits,
      e.daylight, e.utcOffsetSeconds, e.copernicusGitter,
    );
  };
  const eigeneGrob = grob(e.strecke);
  if (!eigeneGrob) return null;
  let bester: { k: RoutenKandidat; gewinn: number } | null = null;
  for (const k of aufWasser) {
    const a = grob(k.punkte);
    if (!a || a.safetyFail || a.hasStorm) continue;
    const gewinn = (eigeneGrob.totalHrs - a.totalHrs) * 60;
    if (gewinn >= GROB_SCHWELLE_MIN && (!bester || gewinn > bester.gewinn)) bester = { k, gewinn };
  }
  if (!bester) return null;

  const pts = sampleRoute(bester.k.punkte, e.sampleStep);
  const wind = await fetchWindForPoints(pts).catch(() => null);
  if (!wind) return null;
  const strom = e.mitStrom ? await fetchCurrentForPoints(pts, wind.zone ?? null).catch(() => null) : null;
  const alternative = evaluateDeparture(
    new Date(e.best.departure), pts, wind.hourly, strom, e.cfg, e.limits, e.daylight, e.utcOffsetSeconds, e.copernicusGitter,
  );
  if (!lohntSich(e.best, alternative)) return null;
  return {
    punkte: bester.k.punkte,
    eigene: e.best,
    alternative,
    versatzSm: bester.k.versatzSm,
    richtung: seitenRichtung(bester.k.richtungDeg),
    mehrSm: Math.max(0, streckenlaengeSm(bester.k.punkte) - l),
  };
}

function schrittFuer(box: { swLat: number; swLon: number; neLat: number; neLon: number }): number {
  const punkte = (s: number) => (Math.floor((box.neLat - box.swLat) / s) + 2) * (Math.floor((box.neLon - box.swLon) / s) + 2);
  return punkte(0.1) <= 300 ? 0.1 : 0.25;
}

const RICHTUNG = {
  de: { n: 'nördlich', o: 'östlich', s: 'südlich', w: 'westlich' },
  en: { n: 'further north', o: 'further east', s: 'further south', w: 'further west' },
} as const;

export function alternativText(v: AlternativVorschlag, sprache: Sprache): string {
  const en = sprache === 'en';
  const gewinn = anzeigeMinuten(v.eigene.totalHrs) - anzeigeMinuten(v.alternative.totalHrs);
  const prozent = (x: number) => String(Math.round(x * 100));
  const grund = grundDerAlternative(v.eigene, v.alternative);
  const d = nf(v.versatzSm, 0, sprache), mehr = nf(v.mehrSm, 1, sprache);
  const zeit = uhrLt(v.eigene.departure);
  const satz = en
    ? `Alternative route: about ${d} NM ${RICHTUNG.en[v.richtung]} the passage is about ${gewinn} min shorter when leaving at ${zeit} `
      + `(${fmtDur(v.alternative.totalHrs)} instead of ${fmtDur(v.eigene.totalHrs)}, ${mehr} NM further). `
    : `Alternativroute: Rund ${d} sm weiter ${RICHTUNG.de[v.richtung]} ist die Fahrt bei Ablegen um ${zeit} etwa ${gewinn} min kürzer `
      + `(${fmtDur(v.alternative.totalHrs)} statt ${fmtDur(v.eigene.totalHrs)}, ${mehr} sm mehr Weg). `;
  const warum = grund === 'motor'
    ? (en ? `There is more wind out there: ${prozent(v.alternative.motorShare)} % instead of ${prozent(v.eigene.motorShare)} % under engine.`
      : `Dort steht mehr Wind: ${prozent(v.alternative.motorShare)} % statt ${prozent(v.eigene.motorShare)} % unter Maschine.`)
    : grund === 'kreuzen'
      ? (en ? `The course lies better to the wind there: ${prozent(v.alternative.beatShare)} % instead of ${prozent(v.eigene.beatShare)} % beating.`
        : `Der Kurs liegt dort günstiger zum Wind: ${prozent(v.alternative.beatShare)} % statt ${prozent(v.eigene.beatShare)} % Kreuzen.`)

      : (en ? `The yacht is faster out there: average speed ${nf(v.alternative.avgSpeed, 1, 'en')} instead of ${nf(v.eigene.avgSpeed, 1, 'en')} kn.`
        : `Dort ist die Yacht schneller: Ø ${nf(v.alternative.avgSpeed, 1)} statt ${nf(v.eigene.avgSpeed, 1)} kn Fahrt.`);
  const vorbehalt = en
    ? ' Same forecast, checked only against the coastline: depths, shoals and restricted areas are not known to it, check against the chart.'
    : ' Dieselbe Vorhersage, nur gegen die Küstenlinie geprüft: Tiefen, Untiefen und Sperrgebiete kennt der Vorschlag nicht, bitte gegen die Seekarte prüfen.';
  return satz + warum + vorbehalt;
}
