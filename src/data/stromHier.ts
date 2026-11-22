import type { StundenMarine, Strom } from '@/core/types';
import { distNM } from '@/core/geo';
import { currentAt } from './marine';
import { holeOpenMeteoJson } from './openMeteoNetz';


const SCHLUESSEL = 'sail-suite:nav-strom';

const NEU_SM = 3;

const NEU_MS = 3 * 3600_000;

const PAUSE_MS = 5 * 60_000;

interface Ablage { lat: number; lon: number; geholt: number; hourly: StundenMarine }

let ablage: Ablage | null = null;
let versucht = 0;
let laeuft = false;

function lies(): Ablage | null {
  try {
    const x = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Ablage | null;
    return x && Array.isArray(x.hourly?.time) && Array.isArray(x.hourly?.ocean_current_velocity) ? x : null;
  } catch { return null; }
}

async function hole(lat: number, lon: number): Promise<void> {
  laeuft = true;
  versucht = Date.now();
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
      + '&hourly=ocean_current_velocity,ocean_current_direction&cell_selection=sea&timezone=GMT&forecast_days=2';
    const d = await holeOpenMeteoJson(url) as { hourly?: StundenMarine | null };
    if (d?.hourly && Array.isArray(d.hourly.time) && Array.isArray(d.hourly.ocean_current_velocity)) {
      ablage = { lat, lon, geholt: Date.now(), hourly: d.hourly };
      try { localStorage.setItem(SCHLUESSEL, JSON.stringify(ablage)); } catch {  }
    }
  } catch {
    
  } finally {
    laeuft = false;
  }
}


export function stromHier(lat: number, lon: number, jetzt = Date.now()): Strom | null {
  ablage ??= lies();
  const nah = ablage && distNM(ablage.lat, ablage.lon, lat, lon) <= NEU_SM;
  if (!laeuft && jetzt - versucht >= PAUSE_MS && (!nah || jetzt - ablage!.geholt >= NEU_MS)) void hole(lat, lon);
  if (!nah || !ablage) return null;
  const ende = Date.parse(`${ablage.hourly.time.at(-1)}Z`);
  if (!(jetzt <= ende)) return null;
  const s = currentAt(ablage.hourly, new Date(jetzt));
  return s.valid ? s : null;
}
