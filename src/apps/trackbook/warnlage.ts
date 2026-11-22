import { liesSitzungsToken } from '@/shell/session';
import { meldeWarnlage } from '@/data/toernApi';
import { aktuellerToernId, aktuelleFixe, aktuellerZustand } from './aufzeichnung';
import { warnlageAktuell } from './seewetter';
import { istOnline } from './netz';


const SCHLUESSEL = 'sail-suite:warnlage';
const TAKT_MS = 10 * 60_000;
const ERNEUERN_MS = 6 * 3600_000;

interface Gemeldet { toern: string; lage: string; zeit: number }

function gemeldet(): Gemeldet | null {
  try { return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? 'null') as Gemeldet | null; } catch { return null; }
}


async function ortungOhneFrage(): Promise<{ lat: number; lon: number } | null> {
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (st?.state !== 'granted') return null;
  } catch { return null; }
  return new Promise((fertig) => {
    navigator.geolocation.getCurrentPosition(
      (p) => fertig({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => fertig(null),
      { maximumAge: 30 * 60_000, timeout: 20_000, enableHighAccuracy: false },
    );
  });
}

async function position(ortung: boolean): Promise<{ lat: number; lon: number } | null> {
  const f = aktuelleFixe().at(-1);
  if (f) return { lat: f.lat, lon: f.lon };
  const z = aktuellerZustand();
  if (z.position) return z.position;
  const mitOrt = [...z.eintraege].reverse().find((e) => e.lat !== null && e.lon !== null);
  if (mitOrt) return { lat: mitOrt.lat!, lon: mitOrt.lon! };
  return ortung ? ortungOhneFrage() : null;
}

async function pruefe(): Promise<void> {
  if (!istOnline()) return;
  const token = liesSitzungsToken();
  const toern = aktuellerToernId();
  if (!token || !toern) return;
  const alt = gemeldet();
  
  const faellig = !alt || alt.toern !== toern || Date.now() - alt.zeit >= ERNEUERN_MS;
  const pos = await position(faellig).catch(() => null);
  if (!pos) return;
  const lage = await warnlageAktuell(pos).catch(() => null);
  if (!lage) return;
  const text = JSON.stringify(lage);
  if (alt && alt.toern === toern && alt.lage === text && Date.now() - alt.zeit < ERNEUERN_MS) return;
  if (await meldeWarnlage(token, toern, lage).catch(() => false)) {
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify({ toern, lage: text, zeit: Date.now() })); } catch {  }
  }
}

export function initWarnlage(): void {
  
  setTimeout(() => void pruefe(), 15_000);
  setInterval(() => void pruefe(), TAKT_MS);
  window.addEventListener('online', () => void pruefe());
  
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void pruefe(); });
}
