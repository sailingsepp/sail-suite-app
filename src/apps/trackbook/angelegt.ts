import { stillstandAmEndeS, type SpurAuswertung } from '@/core/spur';
import { angelegtFrageFaellig, ANGELEGT_RUHE_NACH_NEIN_MS } from '@/core/tagesende';
import { initModal, type ModalHandle } from '@/shell/modal';
import { sage, verwirf } from './ansage';
import { ANSAGE } from '@/core/ansagen';
import type { Zustand } from './aufzeichnung';

const $ = (id: string) => document.getElementById(id);
let ruheBis = 0;
let offen = false;
let modal: ModalHandle | null = null;
let fahrtId: string | null = null;

function schliesse(): void {
  offen = false;
  verwirf((t) => t === ANSAGE.angelegt);
  $('tb-angelegt-modal')?.setAttribute('hidden', '');
  modal?.beimSchliessen();
}

export function pruefeAngelegt(z: Zustand, a: SpurAuswertung): void {

  if (z.fahrt?.id !== fahrtId) { fahrtId = z.fahrt?.id ?? null; ruheBis = 0; }
  const laeuft = z.betriebsart === 'laeuft';
  if (!laeuft && offen) { schliesse(); return; }
  if (!angelegtFrageFaellig({ laeuft, stillstandS: stillstandAmEndeS(a.punkte), jetzt: Date.now(), ruheBis, frageOffen: offen })) return;
  offen = true;
  $('tb-angelegt-modal')?.removeAttribute('hidden');
  modal?.beimOeffnen();
  sage(ANSAGE.angelegt, 'frage', 5 * 60_000);
}

export function initAngelegt(): void {
  const el = $('tb-angelegt-modal');
  if (el) modal = initModal(el, () => { schliesse(); ruheBis = Date.now() + ANGELEGT_RUHE_NACH_NEIN_MS; });
  $('btn-angelegt-ja')?.addEventListener('click', () => {
    schliesse();

    $('btn-pause')?.click();
  });
  $('btn-angelegt-nein')?.addEventListener('click', () => {
    schliesse();
    ruheBis = Date.now() + ANGELEGT_RUHE_NACH_NEIN_MS;
  });
}
