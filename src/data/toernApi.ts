import { API_BASIS } from '@/shell/api';
import { merkeLesestand, lesestandRueckfall, vorlaeufigUnbekannt } from '@/shell/lesestand';

const ANFRAGE_TIMEOUT_MS = 15_000;

async function holeJson<T>(pfad: string, token: string | null): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANFRAGE_TIMEOUT_MS);
  try {
    const kopf: Record<string, string> = {};
    if (token) kopf.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASIS}${pfad}`, { headers: kopf, credentials: 'include', signal: controller.signal });

    if (vorlaeufigUnbekannt(res.status)) return lesestandRueckfall<T>(pfad);
    if (!res.ok) return null;
    const daten = (await res.json()) as T;
    merkeLesestand(pfad, daten);
    return daten;
  } catch {
    return lesestandRueckfall<T>(pfad);
  } finally {
    clearTimeout(timer);
  }
}

async function sendeJson<T>(
  pfad: string, methode: 'POST' | 'PUT' | 'PATCH' | 'DELETE', token: string | null, body?: unknown,
): Promise<{ ok: boolean; status: number; daten: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANFRAGE_TIMEOUT_MS);
  try {
    const kopf: Record<string, string> = {};
    if (token) kopf.Authorization = `Bearer ${token}`;
    const optionen: RequestInit = { method: methode, headers: kopf, credentials: 'include', signal: controller.signal };
    if (body !== undefined) {
      kopf['Content-Type'] = 'application/json';
      optionen.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASIS}${pfad}`, optionen);
    const daten = res.status === 204 ? null : await res.json().catch(() => null) as T | null;

    if (!res.ok) console.error(`${methode} ${pfad} → ${res.status}`, daten);
    return { ok: res.ok, status: res.status, daten };
  } catch (err) {
    console.error(`${methode} ${pfad} fehlgeschlagen:`, err);
    return { ok: false, status: 0, daten: null };
  } finally {
    clearTimeout(timer);
  }
}

export interface ProfilDaten {
  vorname?: string;
  nachname?: string;

  email?: string;
  geburtsdatum?: string;
  geburtsort?: string;
  adresse?: string;
  staatsbuergerschaft?: string;
  passnummer?: string;
  passGueltigBis?: string;
}

export async function holeEigenesProfil(token: string): Promise<ProfilDaten | null> {
  const j = await holeJson<{ profil: ProfilDaten | null }>('/api/profil', token);
  return j?.profil ?? null;
}

export async function schreibeEigenesProfil(token: string, profil: ProfilDaten): Promise<boolean> {
  const r = await sendeJson('/api/profil', 'PUT', token, profil);
  return r.ok;
}

export interface SchiffDaten {
  name?: string;
  typ?: string;

  mmsi?: string;

  flagge?: string;
  polarId?: string;
  polarGuete?: 'exakt' | 'aehnlich' | 'geschaetzt';
  segeljacht?: boolean;
  laengeM?: number;
  lwlM?: number;
  breiteM?: number;
  tiefgangM?: number;
  verdraengungT?: number;
  segelflaecheM2?: number;
  motorPS?: number;
  baujahr?: number;

  verbrauchLh?: number;

  tankL?: number;
}

export type ToernYachtnutzung = 'eigene-yacht' | 'bareboat-charter' | 'skippered-charter' | 'crewed-charter';

export interface ToernHafen {
  name: string;
  lat: number;
  lon: number;
}

export interface ToernZeile {
  id: string;
  besitzer: string;
  name: string;
  beschreibung: string | null;
  revier: string | null;
  von: string | null;
  bis: string | null;
  yachtnutzung: ToernYachtnutzung;
  schiff: SchiffDaten;
  angelegt: string;
  beendet: string | null;
  geloescht_am: string | null;
  archiviert_am: string | null;

  crew_faktor: number | null;

  crew_zumutbarkeit: number | null;

  start_hafen?: ToernHafen | null;
  rueckgabe_hafen?: ToernHafen | null;

  uebernahme_zeit?: string | null;
  rueckgabe_zeit?: string | null;

  planung?: Record<string, unknown> | null;
  version: number;

  toernbericht_gesendet_am?: string | null;

  istAktiv?: boolean;

  aktiv_seit?: string | null;

  status?: 'laeuft' | 'beendet' | null;
}

export async function holeToerne(token: string): Promise<ToernZeile[] | null> {
  return holeJson<ToernZeile[]>('/api/toerne', token);
}

export async function holeToern(token: string, id: string): Promise<ToernZeile | null> {
  return holeJson<ToernZeile>(`/api/toerne/${encodeURIComponent(id)}`, token);
}

export interface NeuerToern {
  id: string;
  name: string;
  beschreibung?: string;
  revier?: string;
  von?: string;
  bis?: string;
  yachtnutzung?: ToernYachtnutzung;
  schiff?: SchiffDaten;
  crew_faktor?: number | null;
  crew_zumutbarkeit?: number | null;

  meineFunktion?: ToernFunktion;

  meineForm?: FunktionForm | null;

  start_hafen?: ToernHafen | null;
  rueckgabe_hafen?: ToernHafen | null;

  skipper?: { vorname: string; nachname: string | null; form?: FunktionForm | null };
}

export async function legeToernAn(token: string, toern: NeuerToern): Promise<{ toern: ToernZeile | null; status: number }> {
  const r = await sendeJson<ToernZeile>('/api/toerne', 'POST', token, toern);
  return { toern: r.ok ? r.daten : null, status: r.status };
}

export interface KontoSpeicher { belegt: number; grenze: number; toerne: number; toerneMax: number }
export async function holeKontoSpeicher(token: string): Promise<KontoSpeicher | null> {
  return holeJson<KontoSpeicher>('/api/toerne/speicher', token);
}

export interface ToernAenderung {
  name?: string;
  beschreibung?: string | null;
  revier?: string | null;
  von?: string | null;
  bis?: string | null;
  yachtnutzung?: ToernYachtnutzung;
  schiff?: SchiffDaten;
  beendet?: string | null;
  crew_faktor?: number | null;
  crew_zumutbarkeit?: number | null;
  start_hafen?: ToernHafen | null;
  rueckgabe_hafen?: ToernHafen | null;
  uebernahme_zeit?: string | null;
  rueckgabe_zeit?: string | null;
  planung?: Record<string, unknown> | null;
}

export async function aendereToern(token: string, id: string, aenderung: ToernAenderung): Promise<ToernZeile | null> {
  const r = await sendeJson<ToernZeile>(`/api/toerne/${encodeURIComponent(id)}`, 'PATCH', token, aenderung);
  return r.ok ? r.daten : null;
}

export async function loescheToern(token: string, id: string): Promise<boolean> {
  const r = await sendeJson(`/api/toerne/${encodeURIComponent(id)}`, 'DELETE', token);
  return r.ok;
}

export async function archiviereToern(token: string, id: string): Promise<boolean> {
  const r = await sendeJson(`/api/toerne/${encodeURIComponent(id)}/archivieren`, 'POST', token);
  return r.ok;
}

export type AktivToernAbfrage =
  | { lage: 'geliefert'; toern: ToernZeile | null }
  | { lage: 'fehlgeschlagen' };

export async function holeAktivenToern(token: string): Promise<AktivToernAbfrage> {
  try {
    const res = await fetch(`${API_BASIS}/api/toerne/aktiv`, {
      headers: { Authorization: `Bearer ${token}` }, credentials: 'include',
    });
    if (res.status >= 502) return ausLesestand();
    if (!res.ok) return { lage: 'fehlgeschlagen' };
    const toern = (await res.json()) as ToernZeile | null;
    merkeLesestand('/api/toerne/aktiv', { toern });
    return { lage: 'geliefert', toern };
  } catch {
    return ausLesestand();
  }
}

async function ausLesestand(): Promise<AktivToernAbfrage> {
  const alt = await lesestandRueckfall<{ toern: ToernZeile | null }>('/api/toerne/aktiv');
  return alt ? { lage: 'geliefert', toern: alt.toern } : { lage: 'fehlgeschlagen' };
}

export async function aktiviereToern(token: string, id: string): Promise<ToernZeile | null> {
  const r = await sendeJson<ToernZeile>(`/api/toerne/${encodeURIComponent(id)}/aktivieren`, 'POST', token);
  return r.ok ? r.daten : null;
}

export async function deaktiviereToern(token: string, id: string): Promise<ToernZeile | null> {
  const r = await sendeJson<ToernZeile>(`/api/toerne/${encodeURIComponent(id)}/deaktivieren`, 'POST', token);
  return r.ok ? r.daten : null;
}

export type ToernFunktion = 'skipper' | 'co-skipper' | 'navigator' | 'smutje' | 'deckshand' | 'pax';

export type { FunktionForm } from '@/core/crewFunktion';
import type { FunktionForm } from '@/core/crewFunktion';

export interface CrewEintrag {
  id: string;
  funktion: ToernFunktion;

  funktionForm?: FunktionForm | null;
  status: 'platzhalter' | 'eingeladen' | 'mitglied';
  rolle: 'besitzer' | 'mitglied';
  anBordSeit: string | null;
  anBordBis: string | null;

  profil: ProfilDaten | { vorname: string | null; nachname?: string | null } | null;
  quelle: 'live' | 'schnappschuss' | 'platzhalter';

  userId: string | null;

  istIchSelbst: boolean;
}

export async function holeCrew(token: string, toernId: string): Promise<CrewEintrag[] | null> {
  return holeJson<CrewEintrag[]>(`/api/toerne/${encodeURIComponent(toernId)}/crew`, token);
}

export async function legePlatzhalterAn(
  token: string, toernId: string, vorname: string, nachname: string | null, funktion: ToernFunktion,
  form: FunktionForm | null = null,
): Promise<{ id: string } | null> {
  const r = await sendeJson<{ id: string }>(
    `/api/toerne/${encodeURIComponent(toernId)}/mitglieder`, 'POST', token, { vorname, nachname, funktion, form },
  );
  return r.ok ? r.daten : null;
}

export async function entferneMitglied(token: string, toernId: string, mitgliedId: string): Promise<boolean> {
  const r = await sendeJson(
    `/api/toerne/${encodeURIComponent(toernId)}/mitglieder/${encodeURIComponent(mitgliedId)}`, 'DELETE', token,
  );
  return r.ok;
}

export async function aendereMitglied(
  token: string, toernId: string, mitgliedId: string,
  aenderung: { funktion?: ToernFunktion; form?: FunktionForm | null; vorname?: string; nachname?: string | null },
): Promise<CrewEintrag | null> {
  const r = await sendeJson<CrewEintrag>(
    `/api/toerne/${encodeURIComponent(toernId)}/mitglieder/${encodeURIComponent(mitgliedId)}`,
    'PATCH', token, aenderung,
  );
  return r.ok ? r.daten : null;
}

export async function schreibeAnlage9(
  token: string, toernId: string, mitgliedId: string,
  daten: { geburtsdatum?: string; staatsbuergerschaft?: string; passnummer?: string },
): Promise<boolean> {
  const r = await sendeJson(
    `/api/toerne/${encodeURIComponent(toernId)}/mitglieder/${encodeURIComponent(mitgliedId)}/anlage9`,
    'PUT', token, daten,
  );
  return r.ok;
}

export function schiffFotoUrl(toernId: string): string {
  return `${API_BASIS}/api/toerne/${encodeURIComponent(toernId)}/schiff-foto`;
}

export async function ladeSchiffFotoHoch(token: string, toernId: string, datei: Blob): Promise<boolean> {
  try {
    const form = new FormData();
    form.append('foto', datei, 'yacht.jpg');
    const res = await fetch(`${API_BASIS}/api/toerne/${encodeURIComponent(toernId)}/schiff-foto`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, credentials: 'include', body: form,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type ToernberichtVersand =
  | { lage: 'gesendet'; empfaenger: number; am: string }
  | { lage: 'keine-adresse' }
  | { lage: 'fehlgeschlagen' };

export async function sendeToernbericht(
  token: string, toernId: string, pdf: Blob, sprache: 'de' | 'en',
): Promise<ToernberichtVersand> {
  try {
    const form = new FormData();
    form.append('sprache', sprache);
    form.append('pdf', pdf, 'toernbericht.pdf');
    const res = await fetch(`${API_BASIS}/api/toerne/${encodeURIComponent(toernId)}/toernbericht`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, credentials: 'include', body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status === 400) return { lage: 'keine-adresse' };
    if (!res.ok) return { lage: 'fehlgeschlagen' };
    const j = (await res.json()) as { empfaengerAnzahl: number; gesendetAm: string };
    return { lage: 'gesendet', empfaenger: j.empfaengerAnzahl, am: j.gesendetAm };
  } catch {
    return { lage: 'fehlgeschlagen' };
  }
}

export async function loescheSchiffFoto(token: string, toernId: string): Promise<boolean> {
  const r = await sendeJson(`/api/toerne/${encodeURIComponent(toernId)}/schiff-foto`, 'DELETE', token);
  return r.ok;
}

export async function teileFahrt(
  token: string, toernId: string, mitgliedId: string, payload: unknown,
): Promise<boolean> {
  const r = await sendeJson(
    `/api/toerne/${encodeURIComponent(toernId)}/mitglieder/${encodeURIComponent(mitgliedId)}/fahrt-teilen`,
    'POST', token, payload,
  );
  return r.ok;
}

export interface UebergabeMeta {
  id: string;
  toernId: string;
  vonUserId: string;
  erstelltAm: string;
}

export async function holeUebergaben(token: string): Promise<UebergabeMeta[] | null> {
  return holeJson<UebergabeMeta[]>('/api/uebergaben', token);
}

export interface AngenommeneUebergabe {
  toernId: string;
  vonUserId: string;
  payload: unknown;
}

export async function nehmeUebergabeAn(token: string, uebergabeId: string): Promise<AngenommeneUebergabe | null> {
  const r = await sendeJson<AngenommeneUebergabe>(
    `/api/uebergaben/${encodeURIComponent(uebergabeId)}/annehmen`, 'POST', token,
  );
  return r.ok ? r.daten : null;
}

export interface BriefingAbschnittDaten {
  titel: string;
  text: string;
}

export interface GeteiltesBriefing {
  titel: string;
  abschnitte: BriefingAbschnittDaten[];
  fuer_datum: string | null;
  erstellt_von: string;
  erstellt_am: string;

  quelle?: BriefingQuelle | null;

  schluessel?: string;
}

export type BriefingQuelle = 'coursecast' | 'voyageplan';

export async function holeBriefing(token: string, toernId: string): Promise<GeteiltesBriefing | null> {
  const r = await holeJson<{ briefing: GeteiltesBriefing | null }>(
    `/api/toerne/${encodeURIComponent(toernId)}/briefing`, token,
  );
  return r?.briefing ?? null;
}

export async function holeBriefings(token: string, toernId: string): Promise<GeteiltesBriefing[] | null> {
  const r = await holeJson<{ briefing: GeteiltesBriefing | null; briefings?: GeteiltesBriefing[] }>(
    `/api/toerne/${encodeURIComponent(toernId)}/briefing`, token,
  );
  if (!r) return null;
  return r.briefings ?? (r.briefing ? [r.briefing] : []);
}

export async function schreibeBriefing(
  token: string, toernId: string, titel: string, abschnitte: BriefingAbschnittDaten[], fuerDatum: string | null,
  quelle: BriefingQuelle,
): Promise<boolean> {
  const r = await sendeJson(
    `/api/toerne/${encodeURIComponent(toernId)}/briefing`, 'PUT', token, { titel, abschnitte, fuerDatum, quelle },
  );
  return r.ok;
}

export async function loescheBriefing(token: string, toernId: string): Promise<boolean> {
  const r = await sendeJson(`/api/toerne/${encodeURIComponent(toernId)}/briefing`, 'DELETE', token);
  return r.ok;
}

export interface EtappenWegpunkt {
  lat: number;
  lon: number;
}

export interface EtappeDaten {
  id: string;
  gewaehlt: boolean;
  nummer: number;
  datum: string | null;
  von_name: string | null;
  nach_name: string | null;
  wegpunkte: EtappenWegpunkt[];
  fixiert: boolean;
  notiz: string | null;

  anzeigename?: string | null;

  art?: 'fahrt' | 'hafentag';
  abfahrt_zeit?: string | null;
  ankunft_datum?: string | null;
  ankunft_zeit?: string | null;
  geaendert_am: string;
}

export interface NeueEtappeDaten {
  id: string;
  gewaehlt?: boolean;
  nummer: number;
  datum?: string | null;
  vonName?: string | null;
  nachName?: string | null;
  wegpunkte: EtappenWegpunkt[];
  fixiert?: boolean;
  notiz?: string | null;

  art?: 'fahrt' | 'hafentag';
  abfahrtZeit?: string | null;
  ankunftDatum?: string | null;
  ankunftZeit?: string | null;
}

const STANDARD_OPTION = 'plan';

const OPTION_MUSTER = /^[A-Za-z0-9_-]{1,40}$/;

export function istGueltigeOption(o: string): boolean {
  return OPTION_MUSTER.test(o);
}

export async function holeEtappen(
  token: string, toernId: string, option = STANDARD_OPTION,
): Promise<EtappeDaten[] | null> {
  const r = await holeJson<{ etappen: EtappeDaten[] }>(
    `/api/toerne/${encodeURIComponent(toernId)}/etappen?option=${encodeURIComponent(option)}`, token,
  );
  return r?.etappen ?? null;
}

export async function holeOptionen(token: string, toernId: string): Promise<string[]> {
  const r = await holeJson<{ optionen: string[] }>(
    `/api/toerne/${encodeURIComponent(toernId)}/etappen/optionen`, token,
  );
  return r?.optionen ?? [];
}

export async function schreibeEtappen(
  token: string, toernId: string, etappen: NeueEtappeDaten[], option = STANDARD_OPTION,
  anzeigename?: string | null,
): Promise<boolean> {
  const suffix = anzeigename ? `&anzeigename=${encodeURIComponent(anzeigename)}` : '';
  const r = await sendeJson(
    `/api/toerne/${encodeURIComponent(toernId)}/etappen?option=${encodeURIComponent(option)}${suffix}`,
    'PUT', token, etappen,
  );
  return r.ok;
}

export async function loescheOption(
  token: string, toernId: string, option = STANDARD_OPTION,
): Promise<boolean> {
  const r = await sendeJson(
    `/api/toerne/${encodeURIComponent(toernId)}/etappen?option=${encodeURIComponent(option)}`, 'DELETE', token,
  );
  return r.ok;
}

export interface ErzeugteEinladung {
  token: string;
  laeuftAbAm: string;

  mitgliedId?: string;
}

export async function erzeugeEinladung(
  token: string, toernId: string, mitgliedId?: string, funktion?: ToernFunktion, form?: FunktionForm | null,
): Promise<ErzeugteEinladung | null> {
  const r = await sendeJson<ErzeugteEinladung>(
    `/api/toerne/${encodeURIComponent(toernId)}/einladung`, 'POST', token,
    { ...(mitgliedId ? { mitgliedId } : {}), ...(funktion ? { funktion } : {}), ...(funktion && form ? { form } : {}) },
  );
  return r.ok ? r.daten : null;
}

export interface EinladungsVorschau {

  toernId: string;
  toernName: string;
  revier: string | null;
  funktion: ToernFunktion;
  funktionForm?: FunktionForm | null;
  bereitsEingeloest: boolean;

  von: string | null;
  bis: string | null;
  yachtnutzung: ToernYachtnutzung;
  startpunkt: string | null;
}

export async function holeEinladungsVorschau(einladungsToken: string): Promise<EinladungsVorschau | null> {
  return holeJson<EinladungsVorschau>(`/api/einladung/${encodeURIComponent(einladungsToken)}`, null);
}

export async function loeseEinladungEin(
  sitzungsToken: string, einladungsToken: string,
): Promise<{ toernId: string } | null> {
  const r = await sendeJson<{ toernId: string }>(
    `/api/einladung/${encodeURIComponent(einladungsToken)}`, 'POST', sitzungsToken,
  );
  return r.ok ? r.daten : null;
}

export interface NotfallkontaktDaten {
  email: string | null;
  aktiv: boolean;

  bestaetigt?: boolean;

  linkGesendetAm?: string | null;
}

export async function holeNotfallkontakt(token: string): Promise<NotfallkontaktDaten | null> {
  return holeJson<NotfallkontaktDaten>('/api/ankeralarm', token);
}

export async function schreibeNotfallkontakt(
  token: string, email: string | null, aktiv: boolean,
): Promise<{ ok: boolean; bestaetigungGesendet: boolean | null }> {
  const r = await sendeJson<{ bestaetigungGesendet?: boolean | null }>('/api/ankeralarm', 'PUT', token, { email, aktiv });
  const b = r.daten?.bestaetigungGesendet;
  return { ok: r.ok, bestaetigungGesendet: typeof b === 'boolean' ? b : null };
}

export async function sendeNotfallkontaktBestaetigung(token: string): Promise<'gesendet' | 'fehlgeschlagen' | 'zu-frueh'> {
  const r = await sendeJson<{ bestaetigungGesendet?: boolean; grund?: string }>('/api/ankeralarm/bestaetigung-senden', 'POST', token);
  if (r.ok) return r.daten?.bestaetigungGesendet === true ? 'gesendet' : 'fehlgeschlagen';
  return r.status === 429 && r.daten?.grund === 'zu_frueh' ? 'zu-frueh' : 'fehlgeschlagen';
}

export interface AnkeralarmFelder {
  abstandM: number;
  radiusM: number;
  peilungGrad: number;
  lat: number;
  lon: number;

  zeitpunkt: string;
  sprache: 'de' | 'en';
}

export type AnkeralarmErgebnis = 'gesendet' | 'unbestaetigt' | 'fehlgeschlagen';

export async function sendeAnkeralarm(token: string, felder: AnkeralarmFelder): Promise<AnkeralarmErgebnis> {
  const r = await sendeJson<{ grund?: string }>('/api/ankeralarm/senden', 'POST', token, felder);
  if (r.ok) return 'gesendet';
  return r.status === 409 && r.daten?.grund === 'unbestaetigt' ? 'unbestaetigt' : 'fehlgeschlagen';
}

export type CrewNachrichtErgebnis =
  | { ok: true; empfaengerAnzahl: number }
  | { ok: false; grund: 'keine-empfaenger' | 'fehler' };

export async function sendeCrewNachricht(
  token: string, toernId: string, text: string, sprache: 'de' | 'en',
): Promise<CrewNachrichtErgebnis> {
  const r = await sendeJson<{ gesendet: boolean; empfaengerAnzahl: number }>(
    `/api/toerne/${encodeURIComponent(toernId)}/nachricht`, 'POST', token, { text, sprache },
  );
  if (r.ok && r.daten) return { ok: true, empfaengerAnzahl: r.daten.empfaengerAnzahl };
  return { ok: false, grund: r.status === 400 ? 'keine-empfaenger' : 'fehler' };
}

export async function meldeWarnlage(
  token: string, toernId: string, lage: { land: string; gebiete: string[]; gruppen: string[] },
): Promise<boolean> {
  const r = await sendeJson(`/api/toerne/${encodeURIComponent(toernId)}/warnlage`, 'PUT', token, lage);
  return r.ok;
}

export interface EigenerStream { token: string | null; aktiv: boolean; gueltigBis?: string | null }

export function streamLink(token: string): string {
  return `https://sail-suite.app/stream/?t=${encodeURIComponent(token)}`;
}

export async function holeEigenenStream(token: string, toernId: string): Promise<EigenerStream | null> {
  return holeJson<EigenerStream>(`/api/toerne/${encodeURIComponent(toernId)}/stream`, token);
}

export async function setzeEigenenStream(token: string, toernId: string, aktiv: boolean): Promise<EigenerStream | null> {
  const r = await sendeJson<EigenerStream>(`/api/toerne/${encodeURIComponent(toernId)}/stream`, 'PUT', token, { aktiv });
  return r.ok ? r.daten : null;
}

export async function streamBedarf(token: string, toernId: string): Promise<boolean | null> {
  const r = await holeJson<{ aktiv: boolean }>(`/api/toerne/${encodeURIComponent(toernId)}/stream/bedarf`, token);
  return r ? r.aktiv : null;
}

export interface LiveSendung {
  fahrt: { id: string; begonnen: number; beendet: number | null; zeitzone?: string; name?: string; ziel?: string; antrieb?: string };

  punkte: [number, number, number][];

  eintraege?: unknown[];

  ersetzen?: true;
  stand: {
    t: number; lat: number; lon: number; sog: number | null; cog: number | null;
    streckeNM: number | null; fahrzeitS: number | null; betriebsart: string; antrieb: string | null;
  };
}

export async function sendeLive(token: string, toernId: string, s: LiveSendung): Promise<'ok' | 'ersetzt' | 'kein-stream' | 'ungueltig' | 'fehler'> {
  const r = await sendeJson<{ ersetzt?: boolean } | null>(`/api/toerne/${encodeURIComponent(toernId)}/live`, 'POST', token, s);
  if (r.ok && r.daten?.ersetzt === true) return 'ersetzt';
  return r.ok ? 'ok' : r.status === 409 ? 'kein-stream' : r.status === 400 ? 'ungueltig' : 'fehler';
}

export async function holeBordkasse<T = unknown>(token: string, toernId: string): Promise<T[] | null> {
  return holeJson<T[]>(`/api/bordkasse/${encodeURIComponent(toernId)}`, token);
}

export async function schreibeBuchung(
  token: string, toernId: string, b: { id: string },
): Promise<{ ok: boolean; status: number }> {
  const r = await sendeJson<null>(
    `/api/bordkasse/${encodeURIComponent(toernId)}/${encodeURIComponent(b.id)}`, 'PUT', token, b,
  );
  return { ok: r.ok, status: r.status };
}
