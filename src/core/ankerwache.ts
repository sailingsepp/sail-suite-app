import { distNM, bearingDeg } from './geo';



export interface AnkerwacheZiel {
  lat: number;
  lon: number;
  radiusM: number;
}

export type AnkerwacheStufe = 'ruhig' | 'alarm';

export interface AnkerwacheBefund {
  
  abstandM: number;
  
  peilung: number;
  
  aussen: boolean;
  
  genauigkeitM?: number;
}


export const GENAUIGKEIT_ZEIGEN_AB_RADIUS = 0.25;
export const genauigkeitZeigen = (b: Pick<AnkerwacheBefund, 'genauigkeitM'>, radiusM: number): boolean =>
  (b.genauigkeitM ?? 0) > GENAUIGKEIT_ZEIGEN_AB_RADIUS * radiusM;

export interface AnkerwacheOptionen {
  
  alarmAbFixe?: number;
  
  ruhigAbFixe?: number;
}

export const ANKERWACHE_VORGABEN: Required<AnkerwacheOptionen> = {
  alarmAbFixe: 3,
  ruhigAbFixe: 5,
};


export const OHNE_FIX_WARNUNG_MS = 2 * 60_000;


export function ohnePositionSeit(
  jetzt: number, letzterFixT: number | null, aktivSeit: number, grenzeMs = OHNE_FIX_WARNUNG_MS,
): number | null {
  const seit = Math.max(letzterFixT ?? -Infinity, aktivSeit);
  return jetzt - seit > grenzeMs ? seit : null;
}


export const FIX_ALTER_ZEIGEN_AB_MS = 30_000;


export function fixAlterSek(jetzt: number, letzterFixT: number | null, abMs = FIX_ALTER_ZEIGEN_AB_MS): number | null {
  if (letzterFixT === null) return null;
  const alter = jetzt - letzterFixT;
  if (!(alter >= abMs)) return null;
  return Math.floor(alter / 5000) * 5;
}


export function istNeuerFix(fixT: number, gewerteterT: number | null): boolean {
  return gewerteterT === null || fixT > gewerteterT;
}


export function pruefePosition(
  ziel: AnkerwacheZiel, lat: number, lon: number, accM: number,
): AnkerwacheBefund {
  const abstandM = distNM(ziel.lat, ziel.lon, lat, lon) * 1852;
  const peilung = bearingDeg(ziel.lat, ziel.lon, lat, lon);
  
  
  
  const aussen = abstandM - Math.max(0, accM) > ziel.radiusM;
  return { abstandM, peilung, aussen, genauigkeitM: Math.max(0, accM) };
}


export function bewerteFolge(
  befunde: AnkerwacheBefund[], bisherigeStufe: AnkerwacheStufe,
  opt: AnkerwacheOptionen = {},
): AnkerwacheStufe {
  const o = { ...ANKERWACHE_VORGABEN, ...opt };
  const zielAnzahl = bisherigeStufe === 'ruhig' ? o.alarmAbFixe : o.ruhigAbFixe;
  const letzte = befunde.slice(-zielAnzahl);
  if (letzte.length < zielAnzahl) return bisherigeStufe;
  if (bisherigeStufe === 'ruhig') {
    return letzte.every((b) => b.aussen) ? 'alarm' : 'ruhig';
  }
  return letzte.every((b) => !b.aussen) ? 'ruhig' : 'alarm';
}




export interface WeiterleitungsMeldung {
  
  abstandM: number;
  
  zeitpunkt: number;
}

export interface WeiterleitungsOptionen {
  
  minAbstandMs?: number;
  
  eskalationM?: number;
}

export const WEITERLEITUNG_VORGABEN: Required<WeiterleitungsOptionen> = {
  minAbstandMs: 15 * 60_000,
  eskalationM: 25,
};


export function sollWeiterleiten(
  abstandM: number, letzteMeldung: WeiterleitungsMeldung | null, jetzt: number,
  opt: WeiterleitungsOptionen = {},
): boolean {
  if (!letzteMeldung) return true;
  const o = { ...WEITERLEITUNG_VORGABEN, ...opt };
  if (jetzt - letzteMeldung.zeitpunkt >= o.minAbstandMs) return true;
  if (abstandM >= letzteMeldung.abstandM + o.eskalationM) return true;
  return false;
}




export const SCHWOJSPUR_MS = 3 * 3_600_000;

export const SCHWOJSPUR_GENAUIGKEIT_ANTEIL = 0.5;


export const SCHWOJSPUR_UMKREIS = 3;


export function schwojSpur(
  fixe: readonly { t: number; lat: number; lon: number; acc?: number }[], ziel: AnkerwacheZiel, jetzt: number,
): { lat: number; lon: number }[] {
  const ab = jetzt - SCHWOJSPUR_MS;
  const genau = Math.max(10, ziel.radiusM * SCHWOJSPUR_GENAUIGKEIT_ANTEIL);
  const umkreisSm = (ziel.radiusM * SCHWOJSPUR_UMKREIS) / 1852;
  const sortiert = [...fixe].filter((f) => f.t <= jetzt).sort((a, b) => a.t - b.t);
  const aus: { lat: number; lon: number }[] = [];
  for (let k = sortiert.length - 1; k >= 0; k--) {
    const f = sortiert[k]!;
    if (f.t < ab) break;
    if (f.acc !== undefined && Number.isFinite(f.acc) && f.acc > genau) continue;
    if (distNM(f.lat, f.lon, ziel.lat, ziel.lon) > umkreisSm) break;
    aus.push({ lat: f.lat, lon: f.lon });
  }
  return aus.reverse();
}
