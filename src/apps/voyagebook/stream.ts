import { datumUhrLtVon } from '@/core/time';
import { initModal } from '@/shell/modal';
import { aktuelleSprache } from '@/shell/sprache';
import { holeEigenenStream, setzeEigenenStream, streamLink, type ToernZeile } from '@/data/toernApi';
import { STRINGS } from './strings';

const wort = (s: string): string => STRINGS[aktuelleSprache()][s] ?? s;
const $ = (id: string) => document.getElementById(id);

export function initStreamDialog(
  holeToken: () => string | null, holeToernAktuell: () => ToernZeile | null,
): void {
  const overlay = $('stream-overlay');
  const modalEl = $('stream-modal');
  const schalter = $('in-stream-aktiv') as HTMLInputElement | null;
  const linkFeld = $('in-stream-link') as HTMLInputElement | null;
  const linkBereich = $('stream-link-bereich');
  const ausHinweis = $('stream-aus-hinweis');
  const status = $('stream-status');
  const frist = $('stream-frist');
  if (!overlay || !modalEl || !schalter || !linkFeld || !linkBereich || !ausHinweis || !status) return;

  const schliesse = () => { overlay.hidden = true; modal.beimSchliessen(); };
  const modal = initModal(modalEl, schliesse);

  function zeigeFrist(gueltigBis: string | null | undefined): void {
    if (!frist) return;
    const bis = gueltigBis ? new Date(gueltigBis) : null;
    frist.hidden = !bis || Number.isNaN(bis.getTime());
    if (!bis || frist.hidden) return;
    const zeit = datumUhrLtVon(bis.getTime(), aktuelleSprache() === 'de' ? 'de' : 'en', { weekday: 'short', day: 'numeric', month: 'numeric' });
    frist.textContent = wort(Date.now() < bis.getTime() ? 'stream.fristBis' : 'stream.fristVorbei').replace('{zeit}', zeit);
  }

  function zeige(token: string | null, aktiv: boolean): void {
    schalter!.checked = aktiv;
    linkBereich!.hidden = !aktiv || !token;
    ausHinweis!.hidden = aktiv || !token;
    linkFeld!.value = token ? streamLink(token) : '';
  }

  async function oeffne(): Promise<void> {
    const token = holeToken();
    const toern = holeToernAktuell();
    if (!token || !toern) return;
    status!.textContent = wort('stream.laedt');
    schalter!.disabled = true;
    zeige(null, false);
    zeigeFrist(null);
    overlay!.hidden = false;
    modal.beimOeffnen(undefined, schalter);
    const s = await holeEigenenStream(token, toern.id);
    schalter!.disabled = false;
    status!.textContent = s ? '' : wort('stream.fehler');
    if (s) { zeige(s.token, s.aktiv); zeigeFrist(s.gueltigBis); }
  }

  schalter.addEventListener('change', () => {
    void (async () => {
      const token = holeToken();
      const toern = holeToernAktuell();
      if (!token || !toern) return;
      const gewuenscht = schalter.checked;
      schalter.disabled = true;
      const s = await setzeEigenenStream(token, toern.id, gewuenscht);
      schalter.disabled = false;
      if (!s) {
        schalter.checked = !gewuenscht;
        status.textContent = wort('stream.fehler');
        return;
      }
      status.textContent = '';
      zeige(s.token, s.aktiv);
      zeigeFrist(s.gueltigBis);
    })();
  });

  async function kopiere(): Promise<void> {
    if (!navigator.clipboard) { linkFeld!.select(); return; }
    await navigator.clipboard.writeText(linkFeld!.value).catch(() => linkFeld!.select());
    status!.textContent = wort('stream.kopiert');
  }

  $('btn-stream-teilen')?.addEventListener('click', () => {
    void (async () => {
      const titel = holeToernAktuell()?.name ?? wort('stream.titel');
      try {
        if (typeof navigator.share === 'function') await navigator.share({ url: linkFeld.value, title: titel, text: titel });
        else await kopiere();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') await kopiere();
      }
    })();
  });
  $('btn-stream-kopieren')?.addEventListener('click', () => void kopiere());
  linkFeld.addEventListener('focus', () => linkFeld.select());
  $('stream-schliessen')?.addEventListener('click', schliesse);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) schliesse(); });
  $('btn-toern-stream')?.addEventListener('click', () => void oeffne());
}
