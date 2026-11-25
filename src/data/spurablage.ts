import { tankvorgaengeAus, nurSumme, type Tankvorgang } from '@/core/tankvorgaenge';
import type { Fahrt, Toern, LogEintrag, Ortsmarke } from './logdb';
import {
  anzahlFixe, ladeEintraege, ortsmarken, bildIdsVon, holeBild, aendereToern,
} from './logdb';
import { baueFahrtPayload, type FahrtPayload } from './logSync';
import type { Motorablesung } from '@/core/motorstunden';
import { API_BASIS } from '@/shell/api';
import { merkeLesestand, lesestandRueckfall, vorlaeufigUnbekannt } from '@/shell/lesestand';

const ZEITSCHRANKE_MS = 120_000;
const SIGNATUR_PRAEFIX = 'sailwise:spurablage:';

const SIGNATUR_FASSUNG = 'v2';

export interface SpurMeta {
  fahrtId: string;

  vonUserId: string;
  eigene: boolean;
  anzahlFixe: number;
  aktualisiertAm: string;

  beginn: number | null;
  ende: number | null;
}

export interface BildMeta {
  id: string;
  t: number;
  breite: number;
  hoehe: number;
}

export interface GeholteSpur {
  payload: FahrtPayload;
  vonUserId: string;
  bilder: BildMeta[];
}

export interface Motordaten {
  motorstunden: Motorablesung[];

  dieselGetanktL: number | null;

  tankvorgaenge?: Tankvorgang[];
}

async function mitZeitschranke(url: string, optionen: RequestInit = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZEITSCHRANKE_MS);
  try {
    return await fetch(url, { ...optionen, credentials: 'include', signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function packe(text: string): Promise<{ rumpf: BodyInit; gzip: boolean }> {
  if (typeof CompressionStream === 'undefined') return { rumpf: text, gzip: false };
  try {
    const strom = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return { rumpf: await new Response(strom).blob(), gzip: true };
  } catch {
    return { rumpf: text, gzip: false };
  }
}

type Ergebnis = 'ok' | 'abgelehnt' | 'netz';

function bewerte(res: Response | null): Ergebnis {
  if (!res) return 'netz';
  if (res.ok) return 'ok';
  return res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429
    ? 'abgelehnt' : 'netz';
}

export async function ladeSpurHoch(token: string, toernId: string, payload: FahrtPayload): Promise<Ergebnis> {
  const { rumpf, gzip } = await packe(JSON.stringify({ toernId, payload }));
  const kopf: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (gzip) kopf['Content-Encoding'] = 'gzip';
  return bewerte(await mitZeitschranke(`${API_BASIS}/api/spuren/${encodeURIComponent(payload.fahrt.id)}`, {
    method: 'PUT', headers: kopf, body: rumpf,
  }));
}

async function ladeBildHoch(
  token: string, toernId: string, b: { id: string; fahrt: string; t: number; blob: Blob; breite: number; hoehe: number },
): Promise<Ergebnis> {
  const q = new URLSearchParams({
    toern: toernId, t: String(b.t), breite: String(b.breite), hoehe: String(b.hoehe),
  });
  return bewerte(await mitZeitschranke(
    `${API_BASIS}/api/spuren/${encodeURIComponent(b.fahrt)}/bilder/${encodeURIComponent(b.id)}?${q}`,
    {
      method: 'PUT', body: b.blob,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': b.blob.type || 'image/jpeg' },
    },
  ));
}

export async function holeSpurListe(token: string, toernId: string): Promise<SpurMeta[] | null> {
  const schluessel = `spuren?toern=${toernId}`;
  const res = await mitZeitschranke(`${API_BASIS}/api/spuren?toern=${encodeURIComponent(toernId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res || vorlaeufigUnbekannt(res.status)) return lesestandRueckfall<SpurMeta[]>(schluessel);
  if (!res.ok) return null;
  const liste = (await res.json().catch(() => null)) as SpurMeta[] | null;
  merkeLesestand(schluessel, liste);
  return liste;
}

const geholt = new Map<string, GeholteSpur>();

export async function holeSpur(token: string, meta: SpurMeta): Promise<GeholteSpur | null> {
  const schluessel = `${meta.vonUserId}/${meta.fahrtId}@${meta.aktualisiertAm}`;
  const vorhanden = geholt.get(schluessel);
  if (vorhanden) return vorhanden;
  const res = await mitZeitschranke(
    `${API_BASIS}/api/spuren/${encodeURIComponent(meta.fahrtId)}?von=${encodeURIComponent(meta.vonUserId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  type Roh = { payload?: FahrtPayload; bilder?: BildMeta[] };
  let daten: Roh | null;
  if (!res || res.status >= 502) {
    daten = await lesestandRueckfall<Roh>(`spur:${schluessel}`);
  } else {
    if (!res.ok) return null;
    daten = (await res.json().catch(() => null)) as Roh | null;
    merkeLesestand(`spur:${schluessel}`, daten);
  }
  const p = daten?.payload;
  if (!p || !p.fahrt || !Array.isArray(p.fixe)) return null;
  const sauber: GeholteSpur = {
    vonUserId: meta.vonUserId,
    payload: {
      fahrt: p.fahrt, fixe: p.fixe,
      eintraege: Array.isArray(p.eintraege) ? (p.eintraege as LogEintrag[]) : [],
      orte: Array.isArray(p.orte) ? (p.orte as Ortsmarke[]) : [],
    },
    bilder: Array.isArray(daten?.bilder) ? daten.bilder : [],
  };
  geholt.set(schluessel, sauber);
  return sauber;
}

export async function holeBildBlob(
  token: string, fahrtId: string, vonUserId: string, bildId: string,
): Promise<Blob | null> {
  const res = await mitZeitschranke(
    `${API_BASIS}/api/spuren/${encodeURIComponent(fahrtId)}/bilder/${encodeURIComponent(bildId)}`

    + `?von=${encodeURIComponent(vonUserId)}&c=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res?.ok) return null;
  return res.blob().catch(() => null);
}

export function kurzHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function fahrtSignatur(anzahl: number, rest: { fahrt: Fahrt; eintraege: unknown[]; orte: unknown[] }): string {
  return `${SIGNATUR_FASSUNG}|${anzahl}|${kurzHash(JSON.stringify(rest))}`;
}

export const ABGELEHNT_RUHE_MS = 24 * 3600_000;

export function mussSichern(gemerkt: string | null, signatur: string, jetzt: number): boolean {
  if (gemerkt === signatur) return false;
  const abgelehnt = gemerkt?.match(/^(.*)\|abgelehnt\|(\d+)$/);
  if (abgelehnt && abgelehnt[1] === signatur) return jetzt - Number(abgelehnt[2]) >= ABGELEHNT_RUHE_MS;
  return true;
}

export interface Kandidat {
  fahrtId: string;

  lokal: boolean;
  anzahl: number;
  beginn: number | null;
  ende: number | null;

  meta?: SpurMeta;
}

export const DOPPELT_AB = 0.5;

export function waehleFahrten(kandidaten: Kandidat[]): Kandidat[] {
  const besser = (a: Kandidat, b: Kandidat) => a.anzahl > b.anzahl || (a.anzahl === b.anzahl && a.lokal && !b.lokal);
  const jeId = new Map<string, Kandidat>();
  for (const k of kandidaten) {
    const bisher = jeId.get(k.fahrtId);
    if (!bisher || besser(k, bisher)) jeId.set(k.fahrtId, k);
  }
  const reihe = [...jeId.values()].sort((a, b) => (besser(a, b) ? -1 : besser(b, a) ? 1 : 0));
  const gewaehlt: Kandidat[] = [];
  for (const k of reihe) {
    const doppelt = gewaehlt.some((g) => {
      if (k.beginn === null || k.ende === null || g.beginn === null || g.ende === null) return false;
      const gemeinsam = Math.min(k.ende, g.ende) - Math.max(k.beginn, g.beginn);
      const kuerzer = Math.min(k.ende - k.beginn, g.ende - g.beginn);
      return gemeinsam > 0 && kuerzer > 0 && gemeinsam / kuerzer > DOPPELT_AB;
    });
    if (!doppelt) gewaehlt.push(k);
  }
  return gewaehlt;
}

export function motordatenAus(t: Pick<Toern, 'motorstunden' | 'dieselGetanktL' | 'tankvorgaenge'> | null): Motordaten {
  return {
    motorstunden: t?.motorstunden ?? [], dieselGetanktL: t?.dieselGetanktL ?? null,
    ...(t?.tankvorgaenge ? { tankvorgaenge: t.tankvorgaenge } : {}),
  };
}

export function setzeDieselInToern(t: Toern, m: Pick<Motordaten, 'dieselGetanktL' | 'tankvorgaenge'>): Toern {
  const neu: Toern = { ...t };
  if (m.dieselGetanktL === null) delete neu.dieselGetanktL;
  else neu.dieselGetanktL = m.dieselGetanktL;
  if (m.tankvorgaenge && !nurSumme(m.tankvorgaenge)) neu.tankvorgaenge = m.tankvorgaenge;
  else delete neu.tankvorgaenge;
  return neu;
}

const tankMerkmal = (v: Tankvorgang): unknown[] => (v.motorstand != null ? [v.datum, v.liter, v.ort, v.motorstand] : [v.datum, v.liter, v.ort]);

export function motorHash(m: Motordaten): string {

  const tv = tankvorgaengeAus(m);
  const basis: unknown[] = [m.motorstunden.map((a) => [a.t, a.stand]), m.dieselGetanktL];
  if (!nurSumme(tv)) basis.push(tv.map(tankMerkmal));
  return kurzHash(JSON.stringify(basis));
}

export function motordatenLeer(m: Motordaten): boolean {
  return m.motorstunden.length === 0 && m.dieselGetanktL === null;
}

function lies(schluessel: string): string | null {
  try {
    return localStorage.getItem(schluessel);
  } catch {
    return null;
  }
}

function merke(schluessel: string, wert: string): void {
  try {
    localStorage.setItem(schluessel, wert);
  } catch {

  }
}

async function sichereBilder(token: string, nutzerId: string, toernId: string, fahrtId: string): Promise<boolean> {
  return sichereBilderMitId(token, nutzerId, toernId, await bildIdsVon(fahrtId));
}

export async function sichereBilderMitId(token: string, nutzerId: string, toernId: string, ids: readonly string[]): Promise<boolean> {
  for (const id of ids) {
    const merker = `${SIGNATUR_PRAEFIX}${nutzerId}:bild:${id}`;
    if (lies(merker)) continue;
    const b = await holeBild(id);
    if (!b) continue;
    const ergebnis = await ladeBildHoch(token, toernId, b);
    if (ergebnis === 'netz') return false;
    if (ergebnis === 'ok') merke(merker, '1');
  }
  return true;
}

let laeuft = false;

export async function merkeAlsGesichert(nutzerId: string, fahrt: Fahrt): Promise<void> {
  const anzahl = await anzahlFixe(fahrt.id);
  if (!anzahl) return;
  const [eintraege, orte] = await Promise.all([ladeEintraege(fahrt.id), ortsmarken(fahrt.id)]);
  merke(`${SIGNATUR_PRAEFIX}${nutzerId}:${fahrt.id}`, fahrtSignatur(anzahl, { fahrt, eintraege, orte }));
}

export interface EigenerLive {
  fahrt: { id: string; begonnen: number; beendet: number | null; zeitzone?: string; name?: string; ziel?: string; antrieb?: string };
  punkte: [number, number, number][];
  eintraege: unknown[];
  stand: { t: number; lat: number; lon: number; betriebsart?: string };
}

export async function holeEigenenLiveStand(token: string, toernId: string): Promise<EigenerLive[] | null> {
  const res = await mitZeitschranke(`${API_BASIS}/api/toerne/${encodeURIComponent(toernId)}/live/eigene`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res?.ok) return null;
  const liste = (await res.json().catch(() => null)) as EigenerLive[] | null;
  return Array.isArray(liste) ? liste : null;
}

export async function sichereFahrten(
  token: string, nutzerId: string, fahrten: Fahrt[], nurBeendete = false,
): Promise<number> {
  if (laeuft) return 0;
  laeuft = true;
  let gesichert = 0;
  try {
    for (const fahrt of fahrten) {
      if (!fahrt.toern || (nurBeendete && fahrt.beendet === null)) continue;
      const anzahl = await anzahlFixe(fahrt.id);
      if (!anzahl) continue;
      const [eintraege, orte] = await Promise.all([ladeEintraege(fahrt.id), ortsmarken(fahrt.id)]);
      const signatur = fahrtSignatur(anzahl, { fahrt, eintraege, orte });
      const schluessel = `${SIGNATUR_PRAEFIX}${nutzerId}:${fahrt.id}`;
      const gemerkt = lies(schluessel);
      if (gemerkt?.includes('|abgelehnt|') && !mussSichern(gemerkt, signatur, Date.now())) continue;
      if (mussSichern(gemerkt, signatur, Date.now())) {
        const ergebnis = await ladeSpurHoch(token, fahrt.toern, await baueFahrtPayload(fahrt));
        if (ergebnis === 'netz') break;
        merke(schluessel, ergebnis === 'ok' ? signatur : `${signatur}|abgelehnt|${Date.now()}`);
        if (ergebnis !== 'ok') continue;
        gesichert++;
      }
      if (!(await sichereBilder(token, nutzerId, fahrt.toern, fahrt.id))) break;
    }
  } catch {

  } finally {
    laeuft = false;
  }
  return gesichert;
}

export async function holeMotordaten(token: string, toernId: string): Promise<Motordaten | null | 'netz'> {
  const res = await mitZeitschranke(`${API_BASIS}/api/spuren/motordaten/${encodeURIComponent(toernId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res?.ok) return 'netz';
  const d = (await res.json().catch(() => undefined)) as Motordaten | null | undefined;
  if (d === undefined) return 'netz';
  return d ? {
    motorstunden: d.motorstunden ?? [], dieselGetanktL: d.dieselGetanktL ?? null,
    ...(Array.isArray(d.tankvorgaenge) ? { tankvorgaenge: d.tankvorgaenge } : {}),
  } : null;
}

export async function schreibeMotordaten(token: string, toernId: string, m: Motordaten): Promise<boolean> {
  const res = await mitZeitschranke(`${API_BASIS}/api/spuren/motordaten/${encodeURIComponent(toernId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(m),
  });
  return Boolean(res?.ok);
}

export function motordatenMerker(nutzerId: string, toernId: string): string {
  return `${SIGNATUR_PRAEFIX}${nutzerId}:motor:${toernId}`;
}

export function merkeMotordaten(nutzerId: string, toernId: string, m: Motordaten): void {
  const k = motordatenMerker(nutzerId, toernId);
  merke(k, motorHash(m));
  merke(`${k}:stunden`, stundenHash(m));
  merke(`${k}:diesel`, dieselHash(m));
}

export function stundenHash(m: Motordaten): string {
  return kurzHash(JSON.stringify(m.motorstunden.map((a) => [a.t, a.stand])));
}
export function dieselHash(m: Motordaten): string {
  const tv = tankvorgaengeAus(m);
  return kurzHash(JSON.stringify([m.dieselGetanktL, nurSumme(tv) ? null : tv.map(tankMerkmal)]));
}

export function geaenderteFelder(
  hier: Motordaten, merker: { ganz: string | null; stunden: string | null; diesel: string | null },
): { stunden: boolean; diesel: boolean } {
  const ganzGleich = merker.ganz !== null && merker.ganz === motorHash(hier);
  const stunden = hier.motorstunden.length > 0 && (merker.stunden !== null
    ? merker.stunden !== stundenHash(hier)
    : !ganzGleich);
  const diesel = merker.diesel !== null
    ? merker.diesel !== dieselHash(hier)
    : hier.dieselGetanktL !== null && !ganzGleich;
  return { stunden, diesel };
}

export function vereinigeAblesungen(andere: Motorablesung[], vorrang: Motorablesung[]): Motorablesung[] {
  const nachZeit = new Map<number, Motorablesung>();
  for (const a of andere) nachZeit.set(a.t, a);
  for (const a of vorrang) nachZeit.set(a.t, a);
  const reihe = [...nachZeit.values()].sort((a, b) => a.t - b.t);
  return reihe.every((a, i) => i === 0 || a.stand >= reihe[i - 1]!.stand) ? reihe : vorrang;
}

export function mischeMotordaten(
  hier: Motordaten | null, server: Motordaten | null, geaendert: { stunden: boolean; diesel: boolean },
): Motordaten {
  const leer: Motordaten = { motorstunden: [], dieselGetanktL: null };
  const h = hier ?? leer, s = server ?? leer;
  const motorstunden = geaendert.stunden
    ? vereinigeAblesungen(s.motorstunden, h.motorstunden)
    : s.motorstunden.length ? s.motorstunden : h.motorstunden;
  const dieselQuelle = geaendert.diesel ? h : s.dieselGetanktL !== null ? s : h;
  return {
    motorstunden, dieselGetanktL: dieselQuelle.dieselGetanktL,
    ...(dieselQuelle.tankvorgaenge ? { tankvorgaenge: dieselQuelle.tankvorgaenge } : {}),
  };
}

const abgleichLaeuft = new Map<string, Promise<Motordaten | null>>();

export function gleicheMotordatenAb(
  token: string, nutzerId: string, toernId: string, lokal: Toern | null,
): Promise<Motordaten | null> {
  const laufend = abgleichLaeuft.get(toernId);
  if (laufend) return laufend;
  const lauf = (async (): Promise<Motordaten | null> => {
    const merker = motordatenMerker(nutzerId, toernId);
    const hier = lokal ? motordatenAus(lokal) : null;
    const server = await holeMotordaten(token, toernId);
    if (server === 'netz') return hier && !motordatenLeer(hier) ? hier : null;
    const geaendert = hier
      ? geaenderteFelder(hier, { ganz: lies(merker), stunden: lies(`${merker}:stunden`), diesel: lies(`${merker}:diesel`) })
      : { stunden: false, diesel: false };
    const ziel = mischeMotordaten(hier, server, geaendert);
    if (motordatenLeer(ziel)) return null;
    let gesichert = Boolean(server) && motorHash(server!) === motorHash(ziel);
    if (!gesichert) gesichert = await schreibeMotordaten(token, toernId, ziel);
    if (gesichert) merkeMotordaten(nutzerId, toernId, ziel);

    if (lokal && hier && motorHash(hier) !== motorHash(ziel)) {
      await aendereToern(lokal.id, (jetzt) => (jetzt && motorHash(motordatenAus(jetzt)) === motorHash(hier)
        ? setzeDieselInToern({ ...jetzt, motorstunden: ziel.motorstunden }, ziel) : null)).catch(() => null);
    }
    return ziel;
  })().finally(() => abgleichLaeuft.delete(toernId));
  abgleichLaeuft.set(toernId, lauf);
  return lauf;
}
