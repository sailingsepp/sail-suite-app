import type { Punkt } from '@/core/types';
import { boxUm, umfahreRoute, umfahreLand, randFuer, randZweiterVersuch, TEILUNG_TIEFE, type RoutenUmfahrung } from '@/core/landumfahrung';
import { vtgInBox, vtgAlsKueste, quertVtg } from '@/core/messinaVtg';
import { kuestenlinienUmGebiet } from './overpass';
import { molenAlsKueste, ohneMolen, HAFEN_STRECKE_SM, HAFEN_KUESTE_SM } from '@/core/molen';
import { molenUm } from './seekartenObjekte';


export interface UmfahreneRoute extends RoutenUmfahrung {
  kuesteFehlt: boolean;
  
  rueckfall: boolean;
  
  vtgBeachtet?: boolean;
  
  durchVtg?: number[];
}

export async function umfahreWegpunkte(wegpunkte: readonly Punkt[]): Promise<UmfahreneRoute> {
  if (wegpunkte.length < 2) {
    return { punkte: [...wegpunkte], umfahreneAbschnitte: [], ohneWeg: [], kuesteFehlt: false, rueckfall: false };
  }
  
  let rand = 4;
  for (let i = 1; i < wegpunkte.length; i++) rand = Math.max(rand, randFuer(wegpunkte[i - 1]!, wegpunkte[i]!));
  const box = boxUm(wegpunkte, rand);
  const kueste = await kuestenlinienUmGebiet(box.swLat, box.swLon, box.neLat, box.neLon);
  if (!kueste) {
    return { punkte: [...wegpunkte], umfahreneAbschnitte: [], ohneWeg: [], kuesteFehlt: true, rueckfall: false };
  }
  const r: UmfahreneRoute = vtgInBox(box)
    ? { ...umfahreMitVtg(wegpunkte, kueste.linien), kuesteFehlt: false, rueckfall: kueste.rueckfall }
    : { ...umfahreRoute(wegpunkte, kueste.linien), kuesteFehlt: false, rueckfall: kueste.rueckfall };
  const r2 = r.ohneWeg.length ? await zweiterVersuch(r, wegpunkte) : r;
  return durchHaefen(r2, wegpunkte);
}


export async function hafenDaten(punkte: readonly Punkt[]): Promise<{ kueste: [Punkt, Punkt][]; molen: [Punkt, Punkt][] }> {
  const [molenRoh, ...kuesten] = await Promise.all([
    molenUm(punkte, HAFEN_STRECKE_SM + 1).catch(() => []),
    ...punkte.map((p) => {
      const b = boxUm([p], HAFEN_KUESTE_SM);
      return kuestenlinienUmGebiet(b.swLat, b.swLon, b.neLat, b.neLon).catch(() => null);
    }),
  ]);
  const gesehen = new Set<string>();
  const kueste: [Punkt, Punkt][] = [];
  for (const k of kuesten) {
    if (!k || k.rueckfall) continue;
    for (const l of k.linien) {
      const s = `${l[0].lat},${l[0].lon},${l[1].lat},${l[1].lon}`;
      if (gesehen.has(s)) continue;
      gesehen.add(s);
      kueste.push(l);
    }
  }
  return { kueste, molen: molenAlsKueste(molenRoh) };
}


async function durchHaefen(r: UmfahreneRoute, wegpunkte: readonly Punkt[]): Promise<UmfahreneRoute> {
  if (!r.abschnitte?.length) return r;
  const { kueste, molen } = await hafenDaten(wegpunkte);
  if (!molen.length && !kueste.length) return r;
  const vtg = r.vtgBeachtet ? vtgAlsKueste() : [];
  const sperre = [...kueste, ...vtg];
  const umfahrene = new Set(r.umfahreneAbschnitte);
  let geaendert = false;
  const abschnitte = r.abschnitte.map((x, i) => {
    if (r.ohneWeg.includes(i)) return x;
    const neu = ohneMolen(x, sperre, molen);
    if (neu.length === x.length && neu.every((p, k) => p === x[k])) return x;
    geaendert = true;
    umfahrene.add(i);
    return neu;
  });
  if (!geaendert) return r;
  return {
    ...r, abschnitte, punkte: [abschnitte[0]![0]!, ...abschnitte.flatMap((x) => x.slice(1))],
    umfahreneAbschnitte: [...umfahrene].sort((x, y) => x - y),
  };
}


async function zweiterVersuch(r: UmfahreneRoute, wegpunkte: readonly Punkt[]): Promise<UmfahreneRoute> {
  if (!r.abschnitte) return r;
  const abschnitte = r.abschnitte.map((x) => [...x]);
  const ohneWeg: number[] = [], umfahrene = new Set(r.umfahreneAbschnitte), durchVtg = new Set(r.durchVtg ?? []);
  let rueckfall = r.rueckfall, vtgBeachtet = r.vtgBeachtet;
  for (const i of r.ohneWeg) {
    const a = wegpunkte[i]!, b = wegpunkte[i + 1]!;
    const rand = randZweiterVersuch(a, b);
    const box = boxUm([a, b], rand);
    const kueste = await kuestenlinienUmGebiet(box.swLat, box.swLon, box.neLat, box.neLon).catch(() => null);
    if (!kueste) { ohneWeg.push(i); continue; }
    const mitVtg = vtgInBox(box);
    const u = (mitVtg ? umfahreLand(a, b, [...kueste.linien, ...vtgAlsKueste()], TEILUNG_TIEFE, rand, true) : null)
      ?? umfahreLand(a, b, kueste.linien, TEILUNG_TIEFE, rand);
    if (!u) { ohneWeg.push(i); continue; }
    abschnitte[i] = u.punkte;
    durchVtg.delete(i);
    if (u.umfahren) umfahrene.add(i);
    if (mitVtg) {
      vtgBeachtet = true;
      if (u.punkte.some((p, k) => k > 0 && quertVtg(u.punkte[k - 1]!, p))) durchVtg.add(i);
    }
    rueckfall ||= kueste.rueckfall;
  }
  const punkte = abschnitte.length ? [abschnitte[0]![0]!, ...abschnitte.flatMap((x) => x.slice(1))] : [...wegpunkte];
  return {
    ...r, punkte, abschnitte, ohneWeg, rueckfall,
    umfahreneAbschnitte: [...umfahrene].sort((x, y) => x - y),
    ...(vtgBeachtet ? { vtgBeachtet: true, durchVtg: [...durchVtg].sort((x, y) => x - y) } : {}),
  };
}


export function umfahreMitVtg(wegpunkte: readonly Punkt[], kueste: readonly [Punkt, Punkt][]): RoutenUmfahrung & { vtgBeachtet: true; durchVtg: number[] } {
  const sperre = [...kueste, ...vtgAlsKueste()];
  const punkte: Punkt[] = wegpunkte.length ? [wegpunkte[0]!] : [];
  const umfahreneAbschnitte: number[] = [], ohneWeg: number[] = [], durchVtg: number[] = [], abschnitte: Punkt[][] = [];
  for (let i = 1; i < wegpunkte.length; i++) {
    const a = wegpunkte[i - 1]!, b = wegpunkte[i]!;
    let u = umfahreLand(a, b, sperre, TEILUNG_TIEFE, randFuer(a, b), true);
    if (!u) u = umfahreLand(a, b, kueste);
    if (!u) { ohneWeg.push(i - 1); punkte.push(b); abschnitte.push([a, b]); if (quertVtg(a, b)) durchVtg.push(i - 1); continue; }
    if (u.umfahren) umfahreneAbschnitte.push(i - 1);
    if (u.punkte.some((p, k) => k > 0 && quertVtg(u!.punkte[k - 1]!, p))) durchVtg.push(i - 1);
    punkte.push(...u.punkte.slice(1));
    abschnitte.push(u.punkte);
  }
  return { punkte, umfahreneAbschnitte, ohneWeg, vtgBeachtet: true, durchVtg, abschnitte };
}
