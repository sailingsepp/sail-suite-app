import type { StundenWind, StundenMarine } from '@/core/types';

export const DRUCK_ANSTIEG_STARKWIND = 2;

export const DRUCK_NIVEAU_MELTEMI_STARK = 1018;

export const DRUCK_FALL_KALTFRONT = 3;

export const DRUCK_FALL_JUGO_FALLE = 2;

export const SICHT_DIESIG_M = 5000;

export interface Synoptik {

  druckAnstieg3h: number | null;

  druckFall3h: number | null;

  druckNiveau: number | null;

  wolken: number | null;

  sichtMin: number | null;

  sichtAenderung: number | null;

  taupunkt: number | null;

  sst: number | null;
}

const LEER: Synoptik = {
  druckAnstieg3h: null, druckFall3h: null, druckNiveau: null,
  wolken: null, sichtMin: null, sichtAenderung: null, taupunkt: null, sst: null,
};

function mittel(a: number[]): number | null {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
}

function tagIndizes(zeiten: string[], dateStr: string): number[] {
  const out: number[] = [];
  zeiten.forEach((t, i) => { if (t.startsWith(dateStr)) out.push(i); });
  return out;
}

export function drucktendenz(
  hourly: StundenWind, dateStr: string,
): { anstieg: number | null; fall: number | null; niveau: number | null } {
  const p = hourly.pressure_msl;
  if (!p) return { anstieg: null, fall: null, niveau: null };
  const idxs = tagIndizes(hourly.time, dateStr);
  if (idxs.length === 0) return { anstieg: null, fall: null, niveau: null };

  let anstieg = 0, fall = 0;
  let hatWert = false;
  for (const i of idxs) {
    const jetzt = p[i], vorher = i >= 3 ? p[i - 3] : undefined;
    if (jetzt == null || vorher == null) continue;
    hatWert = true;
    const d = jetzt - vorher;
    if (d > anstieg) anstieg = d;
    if (-d > fall) fall = -d;
  }
  const letzte = [...idxs].reverse().find((i) => p[i] != null);
  return {
    anstieg: hatWert ? anstieg : null,
    fall: hatWert ? fall : null,
    niveau: letzte !== undefined ? p[letzte]! : null,
  };
}

export function synoptik(
  windData: StundenWind[], dateStr: string,
  curData?: (StundenMarine | null)[] | null,
): Synoptik {
  const start = windData[0];
  if (!start) return LEER;
  const idxs = tagIndizes(start.time, dateStr);
  if (idxs.length === 0) return LEER;

  const { anstieg, fall, niveau } = drucktendenz(start, dateStr);

  const wolken = start.cloud_cover
    ? mittel(idxs.map((i) => start.cloud_cover![i]).filter((v): v is number => v != null))
    : null;

  const taupunkt = start.dew_point_2m
    ? mittel(idxs
      .filter((i) => { const h = Number(start.time[i]!.slice(11, 13)); return h >= 9 && h <= 20; })
      .map((i) => start.dew_point_2m![i]).filter((v): v is number => v != null))
    : null;

  let sichtMin: number | null = null;
  for (const h of windData) {
    if (!h.visibility) continue;
    for (const i of tagIndizes(h.time, dateStr)) {
      const v = h.visibility[i];
      if (v == null) continue;
      if (sichtMin === null || v < sichtMin) sichtMin = v;
    }
  }

  let sichtAenderung: number | null = null;
  if (start.visibility) {
    const werte = idxs.map((i) => start.visibility![i]).filter((v): v is number => v != null);
    if (werte.length >= 2) sichtAenderung = werte[werte.length - 1]! - werte[0]!;
  }

  let sst: number | null = null;
  const marine = curData?.[0];
  if (marine?.sea_surface_temperature) {
    const werte = tagIndizes(marine.time, dateStr)
      .map((i) => marine.sea_surface_temperature![i]).filter((v): v is number => v != null);
    sst = mittel(werte);
  }

  return {
    druckAnstieg3h: anstieg, druckFall3h: fall, druckNiveau: niveau,
    wolken, sichtMin, sichtAenderung, taupunkt, sst,
  };
}
