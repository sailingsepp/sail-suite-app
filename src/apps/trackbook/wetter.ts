import { distNM, relAngle } from '@/core/geo';
import { windAt } from '@/data/openMeteo';
import { waveAt } from '@/data/marine';
import { merke, gemerkt } from '@/data/logdb';
import type { StundenWind, StundenMarine, Wind, Seegang } from '@/core/types';
import { istOnline } from './netz';
import { ABWEICHUNG_KN } from './wettertext';




export const ALTER_MAX_MS = 3 * 3600_000;

const ABSTAND_MAX_NM = 15;

const FEHLER_RUHE_MS = 10 * 60_000;
const SCHLUESSEL = 'wetter:wind';
const TAGE = 2;



export const ABWEICHUNG_KN_GENAUIGKEIT = ABWEICHUNG_KN;

export const ABWEICHUNG_GRAD_GENAUIGKEIT = 30;

const VERGLEICH_MAX_LEAD_MS = 12 * 3600_000;

export interface Genauigkeit {
  treffer: number;
  gesamt: number;
}

function genauigkeitSchluessel(fahrtId: string): string {
  return `wetter:genauigkeit:${fahrtId}`;
}


export function istTreffer(alterWind: Wind, neuerWind: Wind): boolean {
  const dSpeed = Math.abs(alterWind.speed - neuerWind.speed);
  const dDir = relAngle(alterWind.dir, neuerWind.dir);
  return dSpeed < ABWEICHUNG_KN_GENAUIGKEIT && dDir < ABWEICHUNG_GRAD_GENAUIGKEIT;
}


async function aktualisiereGenauigkeit(
  alt: Vorrat | null, neu: Vorrat, fahrtId: string | undefined, jetzt: number,
): Promise<void> {
  if (!alt || !fahrtId) return;
  const leadMs = jetzt - alt.geholt;
  if (leadMs <= 0 || leadMs > VERGLEICH_MAX_LEAD_MS) return;
  try {
    const alterWind = windAt(alt.hourly, new Date(jetzt));
    const neuerWind = windAt(neu.hourly, new Date(jetzt));
    const treffer = istTreffer(alterWind, neuerWind);
    const schluessel = genauigkeitSchluessel(fahrtId);
    const bisher = (await gemerkt<Genauigkeit>(schluessel)) ?? { treffer: 0, gesamt: 0 };
    const wert: Genauigkeit = {
      treffer: bisher.treffer + (treffer ? 1 : 0),
      gesamt: bisher.gesamt + 1,
    };
    await merke(schluessel, wert);
    genauigkeitCache = { fahrtId, wert };
  } catch {
    
  }
}

let genauigkeitCache: { fahrtId: string; wert: Genauigkeit } | null = null;
let genauigkeitLaedt = false;


export function genauigkeitJetzt(fahrtId: string): Genauigkeit | null {
  if (genauigkeitCache?.fahrtId === fahrtId) return genauigkeitCache.wert;
  if (!genauigkeitLaedt) {
    genauigkeitLaedt = true;
    void gemerkt<Genauigkeit>(genauigkeitSchluessel(fahrtId))
      .then((wert) => { if (wert) genauigkeitCache = { fahrtId, wert }; })
      .finally(() => { genauigkeitLaedt = false; });
  }
  return null;
}

interface Vorrat {
  lat: number;
  lon: number;
  geholt: number;
  hourly: StundenWind;
  
  marine?: StundenMarine | null;
}

let vorrat: Vorrat | null = null;
let geladen = false;
let laeuftAbruf = false;
let ruheBis = 0;


async function ausAblage(): Promise<Vorrat | null> {
  if (!geladen) {
    vorrat = await gemerkt<Vorrat>(SCHLUESSEL);
    geladen = true;
  }
  return vorrat;
}

function brauchtNeu(v: Vorrat | null, lat: number, lon: number, jetzt: number): boolean {
  if (!v) return true;
  if (jetzt - v.geholt > ALTER_MAX_MS) return true;
  return distNM(v.lat, v.lon, lat, lon) > ABSTAND_MAX_NM;
}

async function hole(lat: number, lon: number, fahrtId: string | undefined): Promise<void> {
  const wind = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,wind_speed_80m'
    
    
    + `&wind_speed_unit=kn&timezone=UTC&forecast_days=${TAGE}&models=ecmwf_ifs025`;
  
  
  
  const see = 'https://marine-api.open-meteo.com/v1/marine'
    + `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + '&hourly=wave_height,wave_period,wave_direction'
    + ',wind_wave_height,wind_wave_period,wind_wave_direction'
    + ',swell_wave_height,swell_wave_period,swell_wave_direction'
    + `&cell_selection=sea&timezone=UTC&forecast_days=${TAGE}`;

  const [wRes, sRes] = await Promise.all([fetch(wind), fetch(see).catch(() => null)]);
  if (!wRes.ok) throw new Error('Open-Meteo ' + wRes.status);
  const wDaten = (await wRes.json()) as { hourly: StundenWind };
  
  
  let marine: StundenMarine | null = null;
  if (sRes && sRes.ok) {
    try {
      marine = ((await sRes.json()) as { hourly: StundenMarine | null }).hourly ?? null;
    } catch { marine = null; }
  }
  const neu: Vorrat = { lat, lon, geholt: Date.now(), hourly: wDaten.hourly, marine };
  
  await aktualisiereGenauigkeit(vorrat, neu, fahrtId, neu.geholt);
  vorrat = neu;
  geladen = true;
  await merke(SCHLUESSEL, vorrat);
}


export function versorgeWetter(lat: number, lon: number, fahrtId?: string): void {
  void (async () => {
    if (laeuftAbruf || Date.now() < ruheBis || !istOnline()) return;
    const v = await ausAblage();
    if (!brauchtNeu(v, lat, lon, Date.now())) return;
    laeuftAbruf = true;
    try {
      await hole(lat, lon, fahrtId);
    } catch {
      
      
      ruheBis = Date.now() + FEHLER_RUHE_MS;
    } finally {
      laeuftAbruf = false;
    }
  })();
}


export function windJetzt(jetzt = new Date()): Wind | null {
  if (!vorrat) return null;
  try {
    return windAt(vorrat.hourly, jetzt);
  } catch {
    return null;
  }
}


export function seegangJetzt(jetzt = new Date()): Seegang | null {
  if (!vorrat?.marine) return null;
  try {
    const s = waveAt(vorrat.marine, jetzt);
    
    
    return s.hs > 0 ? s : null;
  } catch {
    return null;
  }
}


export function wetterGeholt(): number | null {
  return vorrat ? vorrat.geholt : null;
}


export async function initWetter(): Promise<void> {
  await ausAblage();
}
