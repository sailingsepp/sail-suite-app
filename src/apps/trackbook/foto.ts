import { darfBildSpeichern, bildKennung, aufnahmeZeit } from '@/core/bild';
import { verkleinere } from '@/data/bild';
import {
  speichereBild, holeBild, speicherZustand, type Bild, type LogEintrag,
} from '@/data/logdb';
import { aktuelleSprache } from '@/shell/sprache';
import { initModal, type ModalHandle } from '@/shell/modal';
import { STRINGS } from './strings';

const $ = (id: string) => document.getElementById(id);
const wort = (schluessel: string): string =>
  STRINGS[aktuelleSprache()][schluessel] ?? schluessel;

const urls = new Map<string, string>();

let fotoGrossModal: ModalHandle | null = null;
function schliesseFotoGross(): void {
  $('tb-foto-gross')?.setAttribute('hidden', '');
  fotoGrossModal?.beimSchliessen();
}

async function bildUrl(id: string): Promise<string | null> {
  const da = urls.get(id);
  if (da) return da;
  const b = await holeBild(id);
  if (!b) return null;
  const url = URL.createObjectURL(b.blob);
  urls.set(id, url);
  return url;
}

export function zeigeVorschau(behaelter: HTMLElement, eintrag: LogEintrag): void {
  const id = eintrag.bild;
  if (!id) return;
  const el = document.createElement('img');
  el.className = 'tb-foto';
  el.loading = 'lazy';
  el.alt = eintrag.text || wort('foto.alt');
  behaelter.appendChild(el);
  void bildUrl(id).then((url) => {
    if (!url) {

      el.remove();
      const hinweis = document.createElement('span');
      hinweis.className = 'tb-hinweis';
      hinweis.textContent = wort('foto.fehlt');
      behaelter.appendChild(hinweis);
      return;
    }
    el.src = url;
    el.addEventListener('click', () => void zeigeGross(id, eintrag));
  });
}

async function zeigeGross(id: string, eintrag: LogEintrag): Promise<void> {
  const modal = $('tb-foto-gross');
  const el = $('tb-foto-gross-bild') as HTMLImageElement | null;
  const zeile = $('tb-foto-gross-text');
  if (!modal || !el) return;
  const url = await bildUrl(id);
  if (!url) return;
  el.src = url;
  el.alt = eintrag.text || wort('foto.alt');
  if (zeile) zeile.textContent = eintrag.text ?? '';
  modal.removeAttribute('hidden');
  fotoGrossModal?.beimOeffnen();
}

let offenerEintrag: LogEintrag | null = null;

export function initFoto(
  fahrtJetzt: () => { id: string; position: { lat: number; lon: number } | null } | null,

  ortZu: (t: number) => { lat: number; lon: number } | null,
  eintragen: (e: LogEintrag) => void,

  textNachtragen: (e: LogEintrag, text: string) => void,
): void {
  const feld = $('in-foto') as HTMLInputElement | null;
  const fotoModalEl = $('tb-foto-modal') as HTMLElement | null;
  const grossModalEl = $('tb-foto-gross') as HTMLElement | null;
  if (grossModalEl) fotoGrossModal = initModal(grossModalEl, schliesseFotoGross);

  $('btn-foto')?.addEventListener('click', () => {

    if (feld) feld.value = '';
    feld?.click();
  });

  feld?.addEventListener('change', () => {
    const datei = feld.files?.[0];
    if (!datei) return;
    void nimmAuf(datei);
    feld.value = '';
  });

  async function nimmAuf(datei: File): Promise<void> {
    const ziel = fahrtJetzt();
    if (!ziel) return;
    const stand = $('tb-foto-stand');
    const zeigeStand = (text: string, warnung = false) => {
      if (!stand) return;
      stand.textContent = text;
      stand.className = warnung ? 'tb-hinweis warn' : 'tb-hinweis';
    };

    try {
      const { blob, breite, hoehe } = await verkleinere(datei);
      const speicher = await speicherZustand();
      const platz = darfBildSpeichern(speicher.belegt, speicher.kontingent, blob.size);
      if (!platz.ok) {

        meldung(wort('foto.speicherVoll'), true);
        return;
      }

      const t = aufnahmeZeit(datei.lastModified, Date.now());
      const ort = ortZu(t) ?? ziel.position;
      const bild: Bild = {
        id: bildKennung(t), fahrt: ziel.id, t, blob, breite, hoehe, bytes: blob.size,
      };
      await speichereBild(bild);

      const eintrag: LogEintrag = {
        fahrt: ziel.id, t, art: 'foto',
        lat: ort?.lat ?? null, lon: ort?.lon ?? null,
        bild: bild.id,
      };
      eintragen(eintrag);
      offenerEintrag = eintrag;

      const vorschau = $('tb-foto-vorschau') as HTMLImageElement | null;
      if (vorschau) {
        const url = await bildUrl(bild.id);
        if (url) vorschau.src = url;
      }
      zeigeStand(`${breite} × ${hoehe} · ${Math.round(blob.size / 1024)} kB`,
        platz.lage === 'knapp');
      const textfeld = $('in-foto-text') as HTMLTextAreaElement | null;
      if (textfeld) textfeld.value = '';
      fotoModalEl?.removeAttribute('hidden');
      fotoModal?.beimOeffnen();
    } catch {
      meldung(wort('foto.fehler'), true);
    }
  }

  const schliesse = () => {
    offenerEintrag = null;
    fotoModalEl?.setAttribute('hidden', '');
    fotoModal?.beimSchliessen();
  };
  const fotoModal = fotoModalEl ? initModal(fotoModalEl, schliesse) : null;

  $('btn-foto-ok')?.addEventListener('click', () => {
    const text = ($('in-foto-text') as HTMLTextAreaElement | null)?.value.trim() ?? '';
    if (offenerEintrag && text) textNachtragen(offenerEintrag, text);
    schliesse();
  });

  $('btn-foto-weg')?.addEventListener('click', schliesse);
  $('btn-foto-gross-weg')?.addEventListener('click', schliesseFotoGross);
}

function meldung(text: string, warnung = false): void {
  const zeile = $('tb-foto-meldung') as HTMLElement | null;
  if (!zeile) return;
  zeile.hidden = false;
  zeile.className = warnung ? 'tb-hinweis warn' : 'tb-hinweis';
  zeile.textContent = text;
  window.setTimeout(() => { zeile.hidden = true; }, 8000);
}
