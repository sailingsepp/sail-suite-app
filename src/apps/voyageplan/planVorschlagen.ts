import type { WochenplanErgebnis } from '@/core/wochenplan';
import { kantenWeg, type Kandidatennetz } from '@/core/hafennetz';
import { schreibeEtappen, type NeueEtappeDaten } from '@/data/toernApi';
import { liesSitzungsToken } from '@/shell/session';
import { lateinisch } from '@/core/umschrift';
import {
  OPTION_SCHLUESSEL_1, istFortschritt,
  type RechnerAnfrage, type RechnerAntwort, type RechnerFortschritt, type RechnerNachricht,
} from './rechnerProtokoll';

let rechner: Worker | null = null;
let anfrageLaeuft = false;

function oeffneRechner(): Worker {
  if (!rechner) {
    rechner = new Worker(new URL('./rechner.worker.ts', import.meta.url), { type: 'module' });
  }
  return rechner;
}

function mitLateinischenNamen(a: RechnerAntwort): RechnerAntwort {
  if (a.lage !== 'gefunden') return a;
  return {
    ...a,
    netz: { ...a.netz, knoten: a.netz.knoten.map((k) => ({ ...k, name: lateinisch(k.name) })) },
    ...(a.grenzuebertritte ? {
      grenzuebertritte: a.grenzuebertritte.map((g) => ({ ...g, vonName: lateinisch(g.vonName), nachName: lateinisch(g.nachName) })),
    } : {}),
  };
}

export function schlagePlanVor(
  anfrage: RechnerAnfrage,

  beiFortschritt: (f: RechnerFortschritt) => void = () => {},
): Promise<RechnerAntwort> {
  if (anfrageLaeuft) {

    return Promise.resolve({ lage: 'fehler', text: englisch() ? 'A calculation is already running.' : 'Es läuft bereits eine Berechnung.' });
  }
  anfrageLaeuft = true;
  const worker = oeffneRechner();
  return new Promise((resolve) => {
    const fertig = (antwort: RechnerAntwort): void => {
      anfrageLaeuft = false;
      laufenderAbbruch = null;
      worker.removeEventListener('message', aufNachricht);
      worker.removeEventListener('error', aufFehler);
      resolve(antwort);
    };
    laufenderAbbruch = () => fertig({ lage: 'abgebrochen' });
    const aufNachricht = (e: MessageEvent<RechnerNachricht>): void => {
      if (istFortschritt(e.data)) { beiFortschritt(e.data); return; }
      fertig(mitLateinischenNamen(e.data));
    };

    const aufFehler = (e: ErrorEvent): void => {
      rechner?.terminate();
      rechner = null;
      fertig({
        lage: 'fehler',

        text: e.message || (document.documentElement.lang === 'en'
          ? 'The calculation could not be started. The page is probably from before an update: please reload it.'
          : 'Die Rechnung ließ sich nicht starten. Die Seite stammt vermutlich noch von vor einem Update: bitte neu laden.'),
      });
    };
    worker.addEventListener('message', aufNachricht);
    worker.addEventListener('error', aufFehler);
    worker.postMessage({ ...anfrage, proxyToken: liesSitzungsToken() });
  });
}

let laufenderAbbruch: (() => void) | null = null;

export function brichPlanVorschlagAb(): void {
  if (!laufenderAbbruch) return;
  rechner?.terminate();
  rechner = null;
  laufenderAbbruch();
}

function alsDatumStr(basis: Date, tageSeitTag1: number): string {
  const d = new Date(basis.getFullYear(), basis.getMonth(), basis.getDate() + tageSeitTag1);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function neueEtappeId(): string {
  return `automatik-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function baueEtappenDaten(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz, startDatum: Date,
): NeueEtappeDaten[] {
  return ergebnis.etappen.map((e, i) => {
    const von = netz.knoten[e.vonIndex]!, nach = netz.knoten[e.nachIndex]!;
    return {
      id: neueEtappeId(), nummer: i, gewaehlt: false,
      datum: alsDatumStr(startDatum, e.tag - 1),
      vonName: von.name, nachName: nach.name,

      wegpunkte: e.istHafentag ? [von.ort] : kantenWeg(netz, e.vonIndex, e.nachIndex),
      fixiert: false, notiz: null,
      art: e.istHafentag ? 'hafentag' : 'fahrt',
    };
  });
}

export function baueHandplanEtappen(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz, startDatum: Date,
): NeueEtappeDaten[] {
  return baueEtappenDaten(ergebnis, netz, startDatum).map((d, i) => {
    const e = ergebnis.etappen[i]!;
    const id = d.id.replace(/^automatik-/, 'etappe-');
    if (!e.istNachtschlag) return { ...d, id };
    return { ...d, id, datum: alsDatumStr(startDatum, e.tag - 2), ankunftDatum: d.datum ?? null };
  });
}

export async function speicherePlanAlsEtappen(
  token: string, toernId: string, ergebnis: WochenplanErgebnis, netz: Kandidatennetz, startDatum: Date,
  optionSchluessel: string = OPTION_SCHLUESSEL_1, anzeigename: string | null = null,
): Promise<boolean> {
  return schreibeEtappen(
    token, toernId, baueEtappenDaten(ergebnis, netz, startDatum), optionSchluessel, anzeigename,
  );
}

function englisch(): boolean {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en';
}
