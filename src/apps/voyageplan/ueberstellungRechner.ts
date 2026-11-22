import type { Punkt } from '@/core/types';
import { distNM, sampleRoute } from '@/core/geo';
import { seeweg, boxUm } from '@/core/landumfahrung';
import { wegOhneVtg } from '@/core/messinaVtg';
import {
  planeUeberstellung, aufDemWeg, motoranteilAusWind, type WindProbe, type UeberstellungsHalt, type UeberstellungsPlan, type UeberstellungsVorgaben,
} from '@/core/ueberstellungsplan';
import { kandidatenInBox } from '@/core/vorrechnung';
import { holeVorrechnung } from '@/data/vorrechnung';
import { istGolfName } from '@/data/overpass';
import { fetchWindForPoints } from '@/data/openMeteo';
import { MESSINA_ENGE, messinaPlaner, naivNachUtc, langsameFahrt } from '@/core/messinaStrom';
import type { EngenDurchfahrt } from '@/core/ueberstellungsplan';




export const WIND_PROBE_SM = 30;


export const HALT_MAX_ABSTAND_SM = 50;

export interface UeberstellungsAnfrage {
  start: { ort: Punkt; name: string };
  ziel: { ort: Punkt; name: string };
  
  abfahrtIso: string;
  vorgaben: UeberstellungsVorgaben;
  
  minSegelKn?: number;
}

export interface UeberstellungsErgebnis {
  plan: UeberstellungsPlan | null;
  halte: UeberstellungsHalt[];
  weg: Punkt[];
  
  wegGerade: boolean;
  
  vorhersageBis: number | null;
}


const ENGE_ABSTAND_SM = 2;


function punktBei(weg: readonly Punkt[], s: number): Punkt {
  let lauf = 0;
  for (let i = 1; i < weg.length; i++) {
    const a = weg[i - 1]!, b = weg[i]!, d = distNM(a.lat, a.lon, b.lat, b.lon);
    if (lauf + d >= s) { const t = d > 0 ? (s - lauf) / d : 0; return { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) }; }
    lauf += d;
  }
  return weg[weg.length - 1]!;
}


function messinaEnge(weg: readonly Punkt[], startNaiv: number, fahrtKn: number): ((vonS: number, bisS: number, abfahrt: number) => EngenDurchfahrt | null) | null {
  const lage = aufDemWeg(MESSINA_ENGE, weg);
  if (lage.abstandSm > ENGE_ABSTAND_SM) return null;
  const sE = lage.s;
  const nachNorden = punktBei(weg, sE + 5).lat > punktBei(weg, sE - 5).lat;
  const start = naivNachUtc(startNaiv);
  const planer = messinaPlaner(start - 24 * 3_600_000, start + 40 * 24 * 3_600_000);
  const merk = new Map<string, EngenDurchfahrt | null>();
  return (vonS, bisS, abfahrt) => {
    if (sE <= vonS || sE >= bisS) return null;
    const schluessel = `${vonS}|${abfahrt}`;
    if (merk.has(schluessel)) return merk.get(schluessel)!;
    const tNaiv = abfahrt + ((sE - vonS) / fahrtKn) * 3_600_000;
    const d = planer(naivNachUtc(tNaiv), nachNorden);
    const ergebnis = d ? {
      name: 'Straße von Messina', zeit: tNaiv + d.wartenMs, wartenMs: d.wartenMs, strom: d.strom.art, kn: d.strom.kn,
      mitlaufend: d.strom.art === (nachNorden ? 'montante' : 'scendente'),
      vorlaufSm: sE - vonS, langsamKn: langsameFahrt(sE - vonS, fahrtKn, d.wartenMs),
    } : null;
    merk.set(schluessel, ergebnis);
    return ergebnis;
  };
}


async function holeWindProben(weg: readonly Punkt[]): Promise<WindProbe[] | null> {
  
  const alle = sampleRoute([...weg], WIND_PROBE_SM);
  const punkte = alle.filter((p, i) => i === 0 || Math.floor(p.cum / WIND_PROBE_SM) > Math.floor(alle[i - 1]!.cum / WIND_PROBE_SM));
  const hole = () => fetchWindForPoints(punkte);
  try {
    const wind = await hole().catch(async () => { await new Promise((ok) => setTimeout(ok, 2000)); return hole(); });
    return punkte.map((p, i) => {
      const h = wind.hourly[i]!;
      return {
        s: p.cum, kurs: p.course ?? 0, zeit: h.time.map((t) => Date.parse(`${t}Z`)),
        kn: h.wind_speed_10m, richtung: h.wind_direction_10m,
      };
    });
  } catch {
    return null;
  }
}


export function naivAlsZeit(iso: string): number {
  const [d, z = '10:00'] = iso.split('T');
  const [j, m, t] = d!.split('-').map(Number);
  const [h, min] = z.split(':').map(Number);
  return Date.UTC(j!, m! - 1, t!, h ?? 10, min ?? 0);
}


export const SEEWEG_RAENDER_SM = [150, 300, 450] as const;


export async function suchSeeweg(von: Punkt, nach: Punkt): Promise<Punkt[] | null> {
  const { kuestenlinienRueckfall } = await import('@/data/kuestenlinienFallback');
  const { KUESTE_OSM_BOX: abdeckung } = await import('@/core/kuestenlinienOsm');
  for (const rand of SEEWEG_RAENDER_SM) {
    
    const b = boxUm([von, nach], rand);
    const kueste = await kuestenlinienRueckfall(Math.max(b.swLat, abdeckung.s), Math.max(b.swLon, abdeckung.w),
      Math.min(b.neLat, abdeckung.n), Math.min(b.neLon, abdeckung.e));
    if (!kueste) return null;
    const weg = seeweg(von, nach, kueste, rand, 0.5, true);
    
    if (weg) return wegOhneVtg(weg, kueste) ?? weg;
  }
  return null;
}

export async function rechneUeberstellung(a: UeberstellungsAnfrage): Promise<UeberstellungsErgebnis> {
  const gefunden = await suchSeeweg(a.start.ort, a.ziel.ort);
  const weg = gefunden ?? [a.start.ort, a.ziel.ort];

  const box = boxUm(weg, HALT_MAX_ABSTAND_SM + 5);
  const paket = await holeVorrechnung(box, true).catch(() => null);
  const roh = paket ? kandidatenInBox(paket, box) : [];
  const L = aufDemWeg(a.ziel.ort, weg).s;
  const kandidaten: UeberstellungsHalt[] = [];
  for (const k of roh) {
    if (k.art === 'bucht' || istGolfName(k.name)) continue;
    const lage = aufDemWeg({ lat: k.lat, lon: k.lon }, weg);
    if (lage.abstandSm > HALT_MAX_ABSTAND_SM || lage.s <= 0.5 || lage.s >= L - 0.5) continue;
    kandidaten.push({ name: k.name, ort: { lat: k.lat, lon: k.lon }, art: k.art, s: lage.s, abstandSm: lage.abstandSm });
  }
  kandidaten.sort((x, y) => x.s - y.s);
  
  const ausgeduennt: UeberstellungsHalt[] = [];
  for (const k of kandidaten) {
    const vorige = ausgeduennt[ausgeduennt.length - 1];
    if (vorige && k.s - vorige.s < 2 && distNM(k.ort.lat, k.ort.lon, vorige.ort.lat, vorige.ort.lon) < 3) {
      const besser = (k.art === 'marina' ? 0 : 1) + k.abstandSm / 10 < (vorige.art === 'marina' ? 0 : 1) + vorige.abstandSm / 10;
      if (besser) ausgeduennt[ausgeduennt.length - 1] = k;
      continue;
    }
    ausgeduennt.push(k);
  }
  const halte: UeberstellungsHalt[] = [
    { name: a.start.name, ort: a.start.ort, art: 'marina', s: 0, abstandSm: 0 },
    ...ausgeduennt,
    { name: a.ziel.name, ort: a.ziel.ort, art: 'marina', s: L, abstandSm: 0 },
  ];
  
  const proben = a.vorgaben.tankReichweiteSm != null && a.minSegelKn != null && gefunden ? await holeWindProben(weg) : null;
  const vorgaben: UeberstellungsVorgaben = proben
    ? { ...a.vorgaben, motoranteil: motoranteilAusWind(proben, a.vorgaben.fahrtKn, a.minSegelKn!) }
    : { ...a.vorgaben };
  const enge = gefunden ? messinaEnge(weg, naivAlsZeit(a.abfahrtIso), a.vorgaben.fahrtKn) : null;
  if (enge) vorgaben.enge = enge;
  const vorhersageBis = proben ? Math.min(...proben.map((p) => p.zeit[p.zeit.length - 1] ?? 0)) : null;
  return { plan: planeUeberstellung(halte, naivAlsZeit(a.abfahrtIso), vorgaben), halte, weg, wegGerade: !gefunden, vorhersageBis };
}


export function wegStueck(weg: readonly Punkt[], von: number, bis: number): Punkt[] {
  const out: Punkt[] = [];
  let lauf = 0;
  for (let i = 0; i < weg.length; i++) {
    if (i > 0) lauf += distNM(weg[i - 1]!.lat, weg[i - 1]!.lon, weg[i]!.lat, weg[i]!.lon);
    if (lauf > von && lauf < bis) out.push(weg[i]!);
  }
  return out;
}
