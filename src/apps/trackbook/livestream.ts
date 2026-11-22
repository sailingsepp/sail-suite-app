import { liesSitzungsToken, liesEigeneNutzerId } from '@/shell/session';
import { streamBedarf, sendeLive } from '@/data/toernApi';
import { sichereBilderMitId } from '@/data/spurablage';
import { livePunkte, liveAnlass, logMerkmal, stoppZuMelden, LIVE_TAKT_MS, MIN_ABSTAND_MS, LIVE_EINTRAEGE_SENDEN_MAX, type Gemeldet } from '@/core/livestream';
import { alleFahrten, laufendeFahrt, ladeFixe } from '@/data/logdb';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { aktuellerZustand, aktuelleFixe } from './aufzeichnung';
import { routeFuerStream, routeSchluessel } from './navigation';
import { istOnline } from './netz';
import { standOrt } from './standortName';



const bestaetigtBis = new Map<string, number>();

const logBestaetigt = new Map<string, string>();
let laeuft = false;


let nochmal = false;


const BEDARF_MERKEN_MS = 5 * 60_000;
let bedarf: { toern: string; aktiv: boolean; bis: number } | null = null;


let gemeldet: Gemeldet | null = null;

let versuchtUm = 0;

async function schautJemand(token: string, toern: string): Promise<boolean> {
  if (bedarf && bedarf.toern === toern && Date.now() < bedarf.bis) return bedarf.aktiv;
  const aktiv = await streamBedarf(token, toern);
  if (aktiv === null) return false;
  bedarf = { toern, aktiv, bis: Date.now() + BEDARF_MERKEN_MS };
  return aktiv;
}

const sogVon = (z: ReturnType<typeof aktuellerZustand>) =>
  z.betriebsart === 'laeuft' && Number.isFinite(z.sog) ? Math.round(z.sog * 10) / 10 : null;

const LIEGE_ARTEN = new Set(['start', 'anlegen', 'ankern', 'treiben', 'liegeplatz', 'ankerplatz']);


function lageSchluessel(z: {
  betriebsart: string; antrieb: string | null; fahrt: { id: string } | null; eintraege: readonly { art: string; t: number }[];
}): string | null {
  const liegen = [...z.eintraege].reverse().find((e) => LIEGE_ARTEN.has(e.art));
  
  return z.fahrt ? `${z.fahrt.id}|${z.betriebsart}|${z.antrieb ?? ''}|${liegen ? `${liegen.art}@${liegen.t}` : ''}|${routeSchluessel()}` : null;
}


let gemeldeteLage: string | null = null;

let gemeldeterOrt: string | null = null;

let letztesMerkmal: string | null = null;


async function sendeLiveStand(anlass: 'wechsel' | 'takt' = 'takt'): Promise<void> {
  if (laeuft) { nochmal = true; return; }
  const z = aktuellerZustand();
  const fahrt = z.fahrt;
  const token = liesSitzungsToken();
  
  
  const aktiv = z.laeuft || z.betriebsart === 'pausiert';
  if (!token || !istOnline() || !aktiv || !fahrt?.toern || !z.position) return;
  const lage = lageSchluessel(z);
  const fotos = neueFotos(z.eintraege, fotosOben);
  
  
  
  const logNeu = logBestaetigt.get(fahrt.id) !== logMerkmal(z.eintraege);
  const ort = standOrt(z.position);
  const ortNeu = (ort?.name ?? null) !== gemeldeterOrt;
  const ersetzenOffen = liesErsetzen().includes(fahrt.id);
  if (anlass === 'takt' && z.betriebsart !== 'laeuft' && lage === gemeldeteLage && !fotos.length && !logNeu && !ortNeu && !ersetzenOffen) return;
  laeuft = true;
  versuchtUm = Date.now();
  try {
    if (!(await schautJemand(token, fahrt.toern))) return;
    const nutzerId = liesEigeneNutzerId();
    if (fotos.length && nutzerId && (await sichereBilderMitId(token, nutzerId, fahrt.toern, fotos))) {
      for (const id of fotos) fotosOben.add(id);
    }
    const fixe = aktuelleFixe();
    
    const ersetzen = liesErsetzen().includes(fahrt.id);
    const punkte = livePunkte(fixe, ersetzen ? -Infinity : bestaetigtBis.get(fahrt.id) ?? -Infinity);
    const letzter = fixe[fixe.length - 1];
    const merkmal = logMerkmal(z.eintraege);
    const mitLog = logBestaetigt.get(fahrt.id) !== merkmal;
    const sog = sogVon(z);
    const cog = z.cog == null ? null : Math.round(z.cog);
    const route = routeFuerStream();
    const sendung = {
      fahrt: {
        id: fahrt.id, begonnen: fahrt.begonnen, beendet: fahrt.beendet,
        ...(fahrt.zeitzone ? { zeitzone: fahrt.zeitzone } : {}),
        ...(fahrt.name ? { name: fahrt.name } : {}),
        ...(fahrt.ziel ? { ziel: fahrt.ziel } : {}),
        ...(fahrt.antrieb ? { antrieb: fahrt.antrieb } : {}),
      },
      punkte,
      ...(ersetzen ? { ersetzen: true as const } : {}),
      stand: {
        
        t: z.betriebsart === 'pausiert' ? Date.now() : letzter?.t ?? Date.now(), lat: z.position.lat, lon: z.position.lon,
        
        
        sog, cog,
        streckeNM: Math.round(z.streckeNM * 10) / 10,
        fahrzeitS: Math.round(z.fahrzeitS),
        betriebsart: z.betriebsart, antrieb: z.antrieb,
        
        ...(ort ? { ort } : {}),
        
        ...(route ? { route } : {}),
      },
    };
    
    
    const eintraege = () => z.eintraege.slice(-LIVE_EINTRAEGE_SENDEN_MAX)
      .map((e) => { const kopie: Partial<typeof e> = { ...e }; delete kopie.id; return kopie; });
    
    let ergebnis = await sendeLive(token, fahrt.toern, mitLog || ersetzen ? { ...sendung, eintraege: eintraege() } : sendung);
    
    if (ergebnis === 'ungueltig' && !mitLog) ergebnis = await sendeLive(token, fahrt.toern, { ...sendung, eintraege: eintraege() });
    if (ergebnis === 'kein-stream') bedarf = { toern: fahrt.toern, aktiv: false, bis: Date.now() + BEDARF_MERKEN_MS };
    
    if (ergebnis === 'ersetzt') vergissErsetzen(fahrt.id);
    if (ergebnis !== 'ok' && ergebnis !== 'ersetzt') return;
    const juengster = punkte[punkte.length - 1];
    if (juengster) bestaetigtBis.set(fahrt.id, juengster[0]);
    logBestaetigt.set(fahrt.id, merkmal);
    gemeldet = { t: Date.now(), sog, cog };
    gemeldeteLage = lage;
    gemeldeterOrt = ort?.name ?? null;
  } finally {
    laeuft = false;
    if (nochmal) { nochmal = false; void sendeLiveStand('wechsel'); }
  }
}


function liesErsetzen(): string[] {
  try {
    const x = JSON.parse(localStorage.getItem(SCHLUESSEL.liveErsetzen) ?? '[]') as unknown;
    return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; }
}
function vergissErsetzen(id: string): void {
  const rest = liesErsetzen().filter((s) => s !== id);
  try {
    if (rest.length) localStorage.setItem(SCHLUESSEL.liveErsetzen, JSON.stringify(rest));
    else localStorage.removeItem(SCHLUESSEL.liveErsetzen);
  } catch {  }
}

let letzteLage: string | null = null;


const fotosOben = new Set<string>();
const fotosAngestossen = new Set<string>();

type MitBild = { art: string; bild?: string };
const neueFotos = (eintraege: readonly MitBild[], schon: ReadonlySet<string>): string[] =>
  eintraege.filter((e) => e.art === 'foto' && e.bild && !schon.has(e.bild)).map((e) => e.bild!);


export function liveBeiZustand(z: {
  betriebsart: string; antrieb: string | null; fahrt: { id: string } | null; eintraege: readonly { art: string; t: number; bild?: string }[];
  laeuft: boolean; sog: number; cog: number | null;
}): void {
  const lage = lageSchluessel(z);
  
  
  const fotos = neueFotos(z.eintraege, fotosAngestossen);
  if (fotos.length) {
    const ersterAufruf = letzteLage === null;
    for (const id of fotos) fotosAngestossen.add(id);
    if (!ersterAufruf) { letzteLage = lage; void sendeLiveStand('wechsel'); return; }
  }
  if (lage !== letzteLage) {
    const ersterAufruf = letzteLage === null;
    letzteLage = lage;
    
    if (!ersterAufruf && lage) { void sendeLiveStand('wechsel'); return; }
  }
  
  const merkmal = logMerkmal(z.eintraege);
  if (merkmal !== letztesMerkmal) {
    const ersterAufruf = letztesMerkmal === null;
    letztesMerkmal = merkmal;
    if (!ersterAufruf && lage) { void sendeLiveStand('wechsel'); return; }
  }
  if (!z.fahrt || z.betriebsart !== 'laeuft' || !z.laeuft || !gemeldet || Date.now() - versuchtUm < MIN_ABSTAND_MS) return;
  const jetzt: Gemeldet = { t: Date.now(), sog: Number.isFinite(z.sog) ? Math.round(z.sog * 10) / 10 : null, cog: z.cog == null ? null : Math.round(z.cog) };
  if (liveAnlass(gemeldet, jetzt)) void sendeLiveStand();
}


let stoppLaeuft = false;
export async function meldeStopp(): Promise<void> {
  const token = liesSitzungsToken();
  if (stoppLaeuft || !token || !istOnline() || aktuellerZustand().betriebsart !== 'gestoppt') return;
  stoppLaeuft = true;
  try {
    let gemeldet: string | null = null;
    try { gemeldet = localStorage.getItem(SCHLUESSEL.stoppGemeldet); } catch {  }
    const fahrt = stoppZuMelden(await alleFahrten(), Boolean(await laufendeFahrt()), gemeldet, Date.now());
    if (!fahrt?.toern || !(await schautJemand(token, fahrt.toern))) return;
    const fixe = await ladeFixe(fahrt.id);
    const letzter = fixe[fixe.length - 1];
    if (!letzter) return;
    const ergebnis = await sendeLive(token, fahrt.toern, {
      fahrt: {
        id: fahrt.id, begonnen: fahrt.begonnen, beendet: fahrt.beendet,
        ...(fahrt.zeitzone ? { zeitzone: fahrt.zeitzone } : {}),
        ...(fahrt.name ? { name: fahrt.name } : {}),
        ...(fahrt.ziel ? { ziel: fahrt.ziel } : {}),
      },
      punkte: [],
      
      
      stand: {
        t: letzter.t, lat: letzter.lat, lon: letzter.lon, sog: null, cog: null,
        streckeNM: typeof fahrt.streckeNM === 'number' ? Math.round(fahrt.streckeNM * 10) / 10 : null,
        fahrzeitS: null, betriebsart: 'gestoppt', antrieb: null,
      },
    });
    if (ergebnis === 'ok') {
      try { localStorage.setItem(SCHLUESSEL.stoppGemeldet, fahrt.id); } catch {  }
    }
  } catch {
    
  } finally {
    stoppLaeuft = false;
  }
}

export function initLivestream(): void {
  
  
  setInterval(() => { void sendeLiveStand(); void meldeStopp(); }, LIVE_TAKT_MS);
  
  
  setTimeout(() => { void sendeLiveStand(); void meldeStopp(); }, 20_000);
  window.addEventListener('online', () => { void sendeLiveStand(); void meldeStopp(); });
}
