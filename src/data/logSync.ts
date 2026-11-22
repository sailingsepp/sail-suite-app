import type { Fahrt, LogEintrag, Ortsmarke } from './logdb';
import { ladeFixe, ladeEintraege, ortsmarken } from './logdb';
import type { Fix } from '@/core/spur';
import { LIEGEARTEN, type Liegeart } from '@/core/logbuchText';

export interface FahrtPayload {
  fahrt: Fahrt;
  fixe: Fix[];
  eintraege: LogEintrag[];
  orte: Ortsmarke[];
}

const istZahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const istText = (x: unknown): x is string => typeof x === 'string';
const istAntrieb = (x: unknown): x is 'segel' | 'motor' => x === 'segel' || x === 'motor';
const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function bereinigeFahrt(roh: unknown): Fahrt | null {
  if (!istObjekt(roh) || !istText(roh['id']) || !roh['id'] || !istZahl(roh['begonnen'])) return null;
  const f: Fahrt = {
    id: roh['id'],
    begonnen: roh['begonnen'],
    beendet: istZahl(roh['beendet']) ? roh['beendet'] : null,
  };
  if (istText(roh['toern'])) f.toern = roh['toern'];
  if (istText(roh['zeitzone'])) f.zeitzone = roh['zeitzone'];
  if (istText(roh['name'])) f.name = roh['name'];
  if (istText(roh['ziel'])) f.ziel = roh['ziel'];
  if (istText(roh['wache'])) f.wache = roh['wache'];
  if (istAntrieb(roh['antrieb'])) f.antrieb = roh['antrieb'];
  if (istAntrieb(roh['antriebNachAblegen'])) f.antriebNachAblegen = roh['antriebNachAblegen'];
  if (istZahl(roh['streckeNM'])) f.streckeNM = roh['streckeNM'];
  if (istZahl(roh['manuellePauseSeit'])) f.manuellePauseSeit = roh['manuellePauseSeit'];
  const kopf = roh['wetterkopf'];
  if (istObjekt(kopf) && istZahl(kopf['t']) && istText(kopf['text'])) {
    f.wetterkopf = {
      t: kopf['t'], text: kopf['text'],
      ...(istText(kopf['ort']) ? { ort: kopf['ort'] } : {}),
      ...(istZahl(kopf['ab']) ? { ab: kopf['ab'] } : {}),
    };
  }
  const anker = roh['ankerwache'];
  if (anker === null) f.ankerwache = null;
  else if (istObjekt(anker) && istZahl(anker['lat']) && istZahl(anker['lon']) && istZahl(anker['radiusM'])) {
    f.ankerwache = { lat: anker['lat'], lon: anker['lon'], radiusM: anker['radiusM'] };
  }
  const pausen = roh['manuellePausen'];
  if (Array.isArray(pausen)) {
    f.manuellePausen = pausen
      .filter((p): p is { von: number; bis: number } => istObjekt(p) && istZahl(p['von']) && istZahl(p['bis']))
      .map((p) => ({ von: p.von, bis: p.bis }));
  }
  const geloescht = roh['geloeschteEintraege'];
  if (Array.isArray(geloescht)) f.geloeschteEintraege = geloescht.filter(istText);
  const offen = roh['offeneUebernachtung'];
  if (offen === null) f.offeneUebernachtung = null;
  else if (istObjekt(offen) && istZahl(offen['von']) && typeof offen['ankerwache'] === 'boolean') {
    const lat = offen['lat'], lon = offen['lon'], liegeart = offen['liegeart'];
    f.offeneUebernachtung = {
      von: offen['von'], lat: istZahl(lat) ? lat : null, lon: istZahl(lon) ? lon : null, ankerwache: offen['ankerwache'],
      ...(istZahl(offen['eintragT']) ? { eintragT: offen['eintragT'] } : {}),
      ...(istText(liegeart) && (LIEGEARTEN as readonly string[]).includes(liegeart) ? { liegeart: liegeart as Liegeart } : {}),
    };
  }
  return f;
}

export async function baueFahrtPayload(fahrt: Fahrt): Promise<FahrtPayload> {
  const [fixe, eintraege, orte] = await Promise.all([
    ladeFixe(fahrt.id),
    ladeEintraege(fahrt.id),
    ortsmarken(fahrt.id),
  ]);
  return { fahrt, fixe, eintraege, orte };
}
