import { sonnenzeiten, DAEMMERUNGSWINKEL } from './sun';
import { distNM } from './geo';
import type { Luecke, Pause, SpurPunkt } from './spur';

export interface Nachtfahrt {

  von: number;
  bis: number;

  dauer: number;

  nm: number;

  sonnenuntergang: number;
  sonnenaufgang: number;
}

export interface Nachtansteuerung {
  t: number;
  lat: number;
  lon: number;
  sonnenuntergang: number;
  sonnenaufgang: number;
}

export interface NachtBilanz {

  nachtfahrten: Nachtfahrt[];
  nachtansteuerungen: Nachtansteuerung[];

  fahrtage: number;

  naechteUnterwegs: number;
}

export interface NachtOptionen {

  mindestdauerH?: number;

  ansteuerungAbstandH?: number;

  fahrtAbKn?: number;

  utcOffsetSeconds?: number;
}

export const NACHT_VORGABEN: Required<NachtOptionen> = {
  mindestdauerH: 3,
  ansteuerungAbstandH: 2,
  fahrtAbKn: 0.8,
  utcOffsetSeconds: 0,
};

const H = 3_600_000;
const TAG = 86_400_000;

interface Abschnitt {
  von: number;
  bis: number;
  punkte: SpurPunkt[];
}

export function fahrtabschnitte(
  punkte: SpurPunkt[],
  luecken: Luecke[],
  pausen: Pause[],
  fahrtAbKn: number,
): Abschnitt[] {
  const raus: Abschnitt[] = [];
  let lauf: SpurPunkt[] = [];

  const schliesse = (): void => {
    if (lauf.length >= 2) {
      raus.push({ von: lauf[0]!.t, bis: lauf[lauf.length - 1]!.t, punkte: lauf });
    }
    lauf = [];
  };

  for (let i = 0; i < punkte.length; i++) {
    const p = punkte[i]!;
    const vor = punkte[i - 1];
    const ueberLuecke = vor && luecken.some((l) => l.von >= vor.t && l.bis <= p.t);
    const inPause = pausen.some((pa) => p.t >= pa.von && p.t <= pa.bis);
    if (ueberLuecke || inPause) schliesse();
    if (!inPause && p.sog >= fahrtAbKn) lauf.push(p);
    else if (!inPause) schliesse();
  }
  schliesse();
  return raus;
}

function datumStr(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function nachtGrenzen(
  tag: number,
  punkte: SpurPunkt[],
): { unter: number; auf: number } | null {
  const naechsterPunkt = (t: number): SpurPunkt | undefined =>
    punkte.reduce<SpurPunkt | undefined>(
      (best, p) => (!best || Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best),
      undefined,
    );

  const grob = naechsterPunkt(tag + 18 * H);
  if (!grob) return null;
  const erst = sonnenzeiten(grob.lat, grob.lon, datumStr(tag), DAEMMERUNGSWINKEL.sonne);
  if (!erst) return null;

  const beiUntergang = naechsterPunkt(erst.unter.getTime()) ?? grob;
  const unter = sonnenzeiten(
    beiUntergang.lat, beiUntergang.lon, datumStr(tag), DAEMMERUNGSWINKEL.sonne,
  );
  if (!unter) return null;

  const beiAufgang = naechsterPunkt(unter.unter.getTime() + 8 * H) ?? beiUntergang;
  const auf = sonnenzeiten(
    beiAufgang.lat, beiAufgang.lon, datumStr(tag + TAG), DAEMMERUNGSWINKEL.sonne,
  );
  if (!auf) return null;

  return { unter: unter.unter.getTime(), auf: auf.auf.getTime() };
}

export function nachtBilanz(
  punkte: SpurPunkt[],
  luecken: Luecke[],
  pausen: Pause[],
  ankuenfte: { t: number; lat: number; lon: number }[] = [],
  opt: NachtOptionen = {},
): NachtBilanz {
  const o = { ...NACHT_VORGABEN, ...opt };
  const abschnitte = fahrtabschnitte(punkte, luecken, pausen, o.fahrtAbKn);
  if (!punkte.length) {
    return { nachtfahrten: [], nachtansteuerungen: [], fahrtage: 0, naechteUnterwegs: 0 };
  }

  const tage = new Set<string>();
  for (const a of abschnitte) {
    for (let t = a.von; t <= a.bis; t += TAG) tage.add(datumStr(t + o.utcOffsetSeconds * 1000));
    tage.add(datumStr(a.bis + o.utcOffsetSeconds * 1000));
  }

  const nachtfahrten: Nachtfahrt[] = [];
  let naechteUnterwegs = 0;
  const ersterTag = Date.parse(datumStr(punkte[0]!.t) + 'T00:00:00Z') - TAG;
  const letzterTag = Date.parse(datumStr(punkte[punkte.length - 1]!.t) + 'T00:00:00Z');

  for (let tag = ersterTag; tag <= letzterTag; tag += TAG) {
    const grenzen = nachtGrenzen(tag, punkte);
    if (!grenzen) continue;
    const { unter, auf } = grenzen;

    let laengster: { von: number; bis: number } | null = null;
    let gefahrenInNacht = false;
    for (const a of abschnitte) {
      const von = Math.max(a.von, unter);
      const bis = Math.min(a.bis, auf);
      if (bis <= von) continue;
      gefahrenInNacht = true;
      if (!laengster || bis - von > laengster.bis - laengster.von) laengster = { von, bis };
    }
    if (gefahrenInNacht) naechteUnterwegs++;
    if (!laengster) continue;

    const dauer = (laengster.bis - laengster.von) / 1000;
    if (dauer < o.mindestdauerH * 3600) continue;

    let nm = 0;
    for (let i = 1; i < punkte.length; i++) {
      const p = punkte[i]!;
      const vor = punkte[i - 1]!;
      if (p.t <= unter || vor.t >= auf) continue;
      if (luecken.some((l) => l.von >= vor.t && l.bis <= p.t)) continue;
      nm += distNM(vor.lat, vor.lon, p.lat, p.lon);
    }

    nachtfahrten.push({
      von: laengster.von, bis: laengster.bis, dauer, nm,
      sonnenuntergang: unter, sonnenaufgang: auf,
    });
  }

  const nachtansteuerungen: Nachtansteuerung[] = [];
  for (const an of ankuenfte) {
    const grenzen =
      nachtGrenzen(Date.parse(datumStr(an.t) + 'T00:00:00Z'), punkte) ??
      nachtGrenzen(Date.parse(datumStr(an.t - TAG) + 'T00:00:00Z'), punkte);
    if (!grenzen) continue;

    for (const tag of [an.t - TAG, an.t]) {
      const g = nachtGrenzen(Date.parse(datumStr(tag) + 'T00:00:00Z'), punkte);
      if (!g) continue;
      const frueheste = g.unter + o.ansteuerungAbstandH * H;
      const spaeteste = g.auf - o.ansteuerungAbstandH * H;
      if (an.t > frueheste && an.t <= spaeteste) {
        nachtansteuerungen.push({
          t: an.t, lat: an.lat, lon: an.lon,
          sonnenuntergang: g.unter, sonnenaufgang: g.auf,
        });
        break;
      }
    }
  }

  return { nachtfahrten, nachtansteuerungen, fahrtage: tage.size, naechteUnterwegs };
}
