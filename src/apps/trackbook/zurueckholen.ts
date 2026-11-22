import {
  holeSpurListe, holeSpur, holeBildBlob, holeEigenenLiveStand, merkeAlsGesichert, type EigenerLive,
} from '@/data/spurablage';
import { bereinigeFahrt, type FahrtPayload } from '@/data/logSync';
import {
  aktuellerToern, fahrtenZuToern, uebernehmeFahrt, schreibeFixe, schreibeEintrag, merkeOrt, speichereBild,
  type Fahrt, type LogEintrag, type Ortsmarke,
} from '@/data/logdb';
import type { Fix } from '@/core/spur';




const MERKER = 'sail-suite:zurueckgeholt2:';

const DOPPELT_AB = 0.5;

const LIVE_ACC_M = 50;

const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch {  } };


export function schonAmGeraet(beginn: number, ende: number, lokale: readonly Pick<Fahrt, 'begonnen' | 'beendet'>[], jetzt = Date.now()): boolean {
  return lokale.some((f) => {
    const fe = f.beendet ?? jetzt;
    const gemeinsam = Math.min(ende, fe) - Math.max(beginn, f.begonnen);
    const kuerzer = Math.min(ende - beginn, fe - f.begonnen);
    return gemeinsam > 0 && (kuerzer <= 0 || gemeinsam / kuerzer > DOPPELT_AB);
  });
}


export function liveAlsFahrt(l: EigenerLive, toernId: string, weiterInPause = false): { fahrt: Fahrt; fixe: Fix[]; eintraege: LogEintrag[] } {
  const letzter = l.punkte.length ? l.punkte[l.punkte.length - 1]![0] : l.stand.t;
  const antrieb = l.fahrt.antrieb === 'segel' || l.fahrt.antrieb === 'motor' ? l.fahrt.antrieb : undefined;
  const offen = weiterInPause && l.fahrt.beendet === null;
  const fahrt: Fahrt = {
    id: l.fahrt.id, toern: toernId, begonnen: l.fahrt.begonnen,
    beendet: offen ? null : (l.fahrt.beendet ?? Math.max(letzter, l.stand.t)),
    ...(offen ? { manuellePauseSeit: l.fahrt.begonnen } : {}),
    ...(l.fahrt.zeitzone ? { zeitzone: l.fahrt.zeitzone } : {}),
    ...(l.fahrt.name ? { name: l.fahrt.name } : {}),
    ...(l.fahrt.ziel ? { ziel: l.fahrt.ziel } : {}),
    ...(antrieb ? { antrieb } : {}),
  };
  const fixe: Fix[] = l.punkte.length
    ? l.punkte.map(([t, lat, lon]) => ({ t, lat, lon, acc: LIVE_ACC_M }))
    : [{ t: l.fahrt.begonnen, lat: l.stand.lat, lon: l.stand.lon, acc: LIVE_ACC_M }];
  const eintraege = l.eintraege
    .filter((e): e is LogEintrag => !!e && typeof e === 'object' && typeof (e as LogEintrag).t === 'number' && typeof (e as LogEintrag).art === 'string')
    .map((e) => { const rest: LogEintrag = { ...e, fahrt: fahrt.id }; delete rest.id; return rest; });
  return { fahrt, fixe, eintraege };
}

async function lege(fahrt: Fahrt, fixe: Fix[], eintraege: LogEintrag[], orte: Ortsmarke[]): Promise<void> {
  await uebernehmeFahrt(fahrt);
  if (fixe.length) await schreibeFixe(fahrt.id, fixe);
  for (const e of eintraege) {
    const rest: LogEintrag = { ...e, fahrt: fahrt.id };
    delete rest.id;
    await schreibeEintrag(rest);
  }
  for (const o of orte) {
    const rest: Ortsmarke = { ...o, fahrt: fahrt.id };
    delete rest.id;
    await merkeOrt(rest);
  }
}


export async function holeFahrtenZurueck(token: string, nutzerId: string): Promise<number> {
  const toern = await aktuellerToern().catch(() => null);
  if (!toern || lies(MERKER + toern.id)) return 0;
  const liste = await holeSpurListe(token, toern.id);
  if (!liste) return 0;
  const lokale = await fahrtenZuToern(toern.id);
  const vorhanden = new Set(lokale.map((f) => f.id));
  let geholt = 0;
  let vollstaendig = true;
  for (const meta of liste) {
    if (!meta.eigene || vorhanden.has(meta.fahrtId)) continue;
    if (meta.beginn !== null && meta.ende !== null && schonAmGeraet(meta.beginn, meta.ende, lokale)) continue;
    const spur = await holeSpur(token, meta);
    if (!spur) { vollstaendig = false; continue; }
    const p: FahrtPayload = spur.payload;
    
    const fahrt = bereinigeFahrt(p?.fahrt);
    if (!fahrt) { vollstaendig = false; continue; }
    await lege({ ...fahrt, toern: toern.id }, Array.isArray(p.fixe) ? p.fixe : [],
      Array.isArray(p.eintraege) ? p.eintraege : [], Array.isArray(p.orte) ? p.orte : []);
    for (const b of spur.bilder) {
      const blob = await holeBildBlob(token, meta.fahrtId, meta.vonUserId, b.id);
      if (blob) await speichereBild({ id: b.id, fahrt: meta.fahrtId, t: b.t, blob, breite: b.breite, hoehe: b.hoehe, bytes: blob.size });
      else vollstaendig = false;
    }
    await merkeAlsGesichert(nutzerId, { ...fahrt, toern: toern.id });
    vorhanden.add(meta.fahrtId);
    geholt++;
  }
  
  const live = await holeEigenenLiveStand(token, toern.id);
  if (live === null) vollstaendig = false;
  
  const laeuftAmGeraet = (await fahrtenZuToern(toern.id)).some((f) => f.beendet === null);
  const juengste = (live ?? []).reduce<EigenerLive | null>((a, b) => (!a || b.fahrt.begonnen > a.fahrt.begonnen ? b : a), null);
  for (const l of live ?? []) {
    if (vorhanden.has(l.fahrt.id)) continue;
    const weiter = !laeuftAmGeraet && l === juengste && l.fahrt.beendet === null && l.stand.betriebsart === 'pausiert';
    const { fahrt, fixe, eintraege } = liveAlsFahrt(l, toern.id, weiter);
    if (schonAmGeraet(fahrt.begonnen, fahrt.beendet ?? l.stand.t, await fahrtenZuToern(toern.id))) continue;
    await lege(fahrt, fixe, eintraege, []);
    vorhanden.add(fahrt.id);
    geholt++;
  }
  if (vollstaendig) merke(MERKER + toern.id, String(Date.now()));
  return geholt;
}
