export interface Motorablesung {

  t: number;

  stand: number;
}

function gueltig(stand: number): boolean {
  return Number.isFinite(stand) && stand >= 0;
}

function sortiert(alle: Motorablesung[]): Motorablesung[] {
  return [...alle].sort((a, b) => a.t - b.t);
}

export function ersteAblesung(alle: Motorablesung[]): Motorablesung | null {
  return sortiert(alle)[0] ?? null;
}

export function letzteAblesung(alle: Motorablesung[]): Motorablesung | null {
  const s = sortiert(alle);
  return s[s.length - 1] ?? null;
}

export function laufzeitSeitBeginn(alle: Motorablesung[]): number | null {
  const s = sortiert(alle);
  if (s.length < 2) return null;
  return s[s.length - 1]!.stand - s[0]!.stand;
}

function nachbarn(alle: Motorablesung[], t: number): { vor: Motorablesung | null; nach: Motorablesung | null } {
  const s = sortiert(alle);
  let vor: Motorablesung | null = null;
  let nach: Motorablesung | null = null;
  for (const a of s) {
    if (a.t <= t) vor = a;
    else if (nach === null) nach = a;
  }
  return { vor, nach };
}

export function istPlausibel(alle: Motorablesung[], stand: number, t = Number.POSITIVE_INFINITY): boolean {
  if (!gueltig(stand)) return false;
  const { vor, nach } = nachbarn(alle, t);
  if (vor && stand < vor.stand) return false;
  if (nach && stand > nach.stand) return false;
  return true;
}

export function ergaenzeAblesung(alle: Motorablesung[], neu: Motorablesung): Motorablesung[] {
  if (!Number.isFinite(neu.t) || !istPlausibel(alle, neu.stand, neu.t)) return alle;
  const { vor } = nachbarn(alle, neu.t);
  if (vor && vor.stand === neu.stand) return alle;
  return sortiert([...alle, neu]);
}

export function setzeAnfangsstand(
  alle: Motorablesung[],
  stand: number,
  t: number,
): Motorablesung[] {
  if (!gueltig(stand)) return alle;
  const s = sortiert(alle);
  if (s.length === 0) return Number.isFinite(t) ? [{ t, stand }] : alle;
  const zweite = s[1];
  if (zweite && stand > zweite.stand) return alle;
  return [{ t: s[0]!.t, stand }, ...s.slice(1)];
}

export function uebernehmeEingabe(
  alle: Motorablesung[],
  anfang: number | undefined,
  jetzt: number | undefined,
  angelegt: number,
  t: number,
): { reihe: Motorablesung[]; fehler: boolean } {
  let reihe = alle;
  let fehler = false;
  if (anfang !== undefined) {
    const neu = setzeAnfangsstand(reihe, anfang, angelegt);
    if (neu === reihe && ersteAblesung(reihe)?.stand !== anfang) fehler = true;
    reihe = neu;
  }
  if (jetzt !== undefined) {
    const korrigiert = korrigiereLetzte(reihe, jetzt);
    if (korrigiert) reihe = korrigiert;
    else if (!istPlausibel(reihe, jetzt, t)) fehler = true;
    else reihe = ergaenzeAblesung(reihe, { t, stand: jetzt });
  }
  return { reihe, fehler };
}

export function korrigiereLetzte(alle: Motorablesung[], stand: number): Motorablesung[] | null {
  if (!gueltig(stand)) return null;
  const s = sortiert(alle);
  if (s.length < 2) return null;
  const letzte = s[s.length - 1]!;
  const davor = s[s.length - 2]!;
  if (stand >= letzte.stand || stand < davor.stand) return null;
  return [...s.slice(0, -1), { t: letzte.t, stand }];
}
