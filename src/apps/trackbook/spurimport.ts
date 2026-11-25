import { leseFremdspur, ImportFehler } from '@/core/spurimport';
import { mischeSpur, type MischBericht } from '@/core/spurmischen';
import { nf } from '@/core/time';
import { schreibeFixe, type LogEintrag } from '@/data/logdb';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal } from '@/shell/modal';
import { STRINGS } from './strings';
import type { Fix } from '@/core/spur';

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
const sm = () => (aktuelleSprache() === 'en' ? 'NM' : 'sm');

function dauer(sekunden: number): string {

  const min = Math.round(Math.max(0, sekunden) / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

function text(schluessel: string, werte: Record<string, string | number>): string {
  let s = wort(schluessel);
  for (const [k, v] of Object.entries(werte)) s = s.replace(`{${k}}`, String(v));
  return s;
}

let offen: { fahrt: string; neue: Fix[]; bericht: MischBericht } | null = null;

function zeigeBericht(gelesen: number, b: MischBericht): void {
  const kasten = $('tb-import-bericht');
  const warnung = $('tb-import-warnung') as HTMLElement | null;
  if (!kasten) return;

  const zeilen: string[] = [
    text('import.gelesen', { n: gelesen }),
    `<b>${text('import.uebernommen', { n: b.uebernommen })}</b>`,
    text('import.schonDa', { n: b.verworfen }),
    `<b>${text('import.zusatz', { nm: `${nf(b.zusatzNM, 1, aktuelleSprache())} ${sm()}` })}</b>`,
    text('import.gefuellt', { n: b.gefuellt.length }),
    text('import.offen', { n: b.offen.length }),
  ];
  if (b.spaeterS > 60) zeilen.push(text('import.spaeter', { d: dauer(b.spaeterS) }));
  if (b.frueherS > 60) zeilen.push(text('import.frueher', { d: dauer(b.frueherS) }));
  if (b.ortsAbgleichM !== null) {
    zeilen.push(text('import.abgleich', { m: Math.round(b.ortsAbgleichM) }));
  }
  kasten.innerHTML = zeilen.map((z) => `<div>${z}</div>`).join('');

  if (warnung) {
    const w = !b.passtZeitlich
      ? wort('import.warnZeit')
      : (b.ortsAbgleichM !== null && !b.passtOertlich
        ? text('import.warnOrt', { m: Math.round(b.ortsAbgleichM) })
        : '');
    warnung.hidden = !w;
    warnung.textContent = w;
  }

  const ok = $('btn-import-ok') as HTMLButtonElement | null;
  if (ok) ok.disabled = b.uebernommen === 0;
  if (b.uebernommen === 0) kasten.innerHTML += `<div>${wort('import.nichtsZuTun')}</div>`;
}

export function initSpurimport(

  zielFahrt: () => Promise<{ id: string; fixe: Fix[] } | null>,

  uebernimm: (fixe: Fix[]) => void,
  eintragen: (e: LogEintrag) => void,
  melde: (nachricht: string) => void,
): void {
  const feld = $('in-spurimport') as HTMLInputElement | null;
  const importModalEl = $('tb-import-modal') as HTMLElement | null;
  const schliesseImportModal = (): void => {
    offen = null;
    importModalEl?.setAttribute('hidden', '');
    importModal?.beimSchliessen();
  };
  const importModal = importModalEl ? initModal(importModalEl, schliesseImportModal) : null;

  $('btn-spurimport')?.addEventListener('click', () => {
    if (feld) feld.value = '';
    feld?.click();
  });

  feld?.addEventListener('change', () => {
    const datei = feld.files?.[0];
    feld.value = '';
    if (datei) void lies(datei);
  });

  async function lies(datei: File): Promise<void> {
    const ziel = await zielFahrt();
    if (!ziel) {
      melde(wort('import.keineFahrt'));
      return;
    }
    try {
      const roh = await datei.text();
      const gelesen = leseFremdspur(roh);
      const { neue, bericht } = mischeSpur(ziel.fixe, gelesen.fixe);

      offen = { fahrt: ziel.id, neue, bericht };
      zeigeBericht(gelesen.fixe.length, bericht);
      importModalEl?.removeAttribute('hidden');
      importModal?.beimOeffnen();
    } catch (err) {

      const art = err instanceof ImportFehler ? err.art : 'unbekannt';
      melde(text('import.fehler', { grund: wort(`import.grund.${art}`) }));
    }
  }

  $('btn-import-ok')?.addEventListener('click', () => {
    const jetzt = offen;
    schliesseImportModal();
    if (!jetzt || !jetzt.neue.length) return;
    void (async () => {
      await schreibeFixe(jetzt.fahrt, jetzt.neue);
      uebernimm(jetzt.neue);

      eintragen({
        fahrt: jetzt.fahrt, t: Date.now(), art: 'import',
        lat: null, lon: null,
        text: text('import.eintrag', {
          n: jetzt.neue.length,
          nm: `${nf(jetzt.bericht.zusatzNM, 1, aktuelleSprache())} ${sm()}`,
        }),
      });
    })();
  });

  $('btn-import-weg')?.addEventListener('click', schliesseImportModal);
}
