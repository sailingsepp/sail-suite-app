import { wischStufe, type WischStufe } from '@/core/logbuchBearbeiten';
import { escapeHtml } from '@/core/html';
import { icon } from './icons';



export const WISCH_KNOPF_PX = 64;


export function wischZeile(id: string, inhalt: string, loeschen: string, klasse = ''): string {
  return `<div class="wisch-zeile${klasse ? ` ${klasse}` : ''}" data-id="${escapeHtml(id)}">`
    + `<div class="wisch-aktion"><button type="button" class="wisch-loeschen" data-id="${escapeHtml(id)}" aria-label="${escapeHtml(loeschen)}" title="${escapeHtml(loeschen)}">${icon('papierkorb')}</button></div>`
    + `<div class="wisch-inhalt">${inhalt}</div></div>`;
}

export interface Wischliste {
  
  beschaeftigt(): boolean;
  
  schliesse(): void;
}


export function macheWischbar(
  liste: HTMLElement, loesche: (id: string, knopf: HTMLButtonElement) => boolean | Promise<boolean>,
): Wischliste {
  let offen: HTMLElement | null = null;
  let fragt = false;
  const inhaltVon = (z: HTMLElement) => z.querySelector<HTMLElement>('.wisch-inhalt');
  const setze = (z: HTMLElement, px: number) => {
    const inhalt = inhaltVon(z), aktion = z.querySelector<HTMLElement>('.wisch-aktion');
    if (inhalt) inhalt.style.transform = px > 0 ? `translateX(${-px}px)` : '';
    if (aktion) aktion.style.width = `${Math.max(WISCH_KNOPF_PX, px)}px`;
  };
  const schliesse = () => {
    if (!offen) return;
    setze(offen, 0);
    offen.classList.remove('wisch-voll-rot', 'wisch-offen', 'wisch-auf');
    offen = null;
  };
  const knopfVon = (z: HTMLElement) => z.querySelector<HTMLButtonElement>('.wisch-loeschen');
  const fuehreAus = (id: string, knopf: HTMLButtonElement) => {
    const r = loesche(id, knopf);
    
    
    if (typeof r === 'boolean') { if (!r) schliesse(); else if (offen && !liste.contains(offen)) offen = null; return; }
    fragt = true;
    void r.then((ja) => { if (!ja) schliesse(); }).finally(() => { fragt = false; });
  };

  let zeile: HTMLElement | null = null;
  let startX = 0, startY = 0, basis = 0, dx = 0;
  let richtung: 'offen' | 'waagrecht' | 'senkrecht' = 'offen';
  let stufe: WischStufe = 'zu';

  liste.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    const z = (ev.target as HTMLElement).closest<HTMLElement>('.wisch-zeile');
    if (!z || !liste.contains(z) || (ev.target as HTMLElement).closest('.wisch-aktion')) return;
    if (offen && offen !== z) schliesse();
    zeile = z;
    startX = ev.clientX; startY = ev.clientY;
    basis = offen === z ? WISCH_KNOPF_PX : 0;
    dx = basis;
    richtung = 'offen';
    stufe = basis ? 'offen' : 'zu';
  });
  liste.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'touch' || !zeile) return;
    const mx = startX - ev.clientX, my = ev.clientY - startY;
    if (richtung === 'offen') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      richtung = Math.abs(mx) > Math.abs(my) ? 'waagrecht' : 'senkrecht';
      if (richtung === 'waagrecht') {
        zeile.classList.add('wisch-zieht');
        try { inhaltVon(zeile)?.setPointerCapture(ev.pointerId); } catch {  }
      }
    }
    if (richtung !== 'waagrecht') return;
    dx = Math.max(0, basis + mx);
    stufe = wischStufe(dx, zeile.clientWidth, WISCH_KNOPF_PX);
    zeile.classList.toggle('wisch-voll-rot', stufe === 'loeschen');
    setze(zeile, dx);
  });
  const ende = () => {
    const z = zeile;
    zeile = null;
    if (!z || richtung !== 'waagrecht') { richtung = 'offen'; return; }
    richtung = 'offen';
    z.classList.remove('wisch-zieht');
    if (stufe === 'loeschen') {
      const knopf = knopfVon(z), id = knopf?.dataset['id'];
      setze(z, z.clientWidth);
      z.classList.add('wisch-auf');
      offen = z;
      if (knopf && id) fuehreAus(id, knopf);
    } else if (stufe === 'offen') {
      setze(z, WISCH_KNOPF_PX);
      z.classList.remove('wisch-voll-rot');
      z.classList.add('wisch-auf');
      offen = z;
    } else {
      setze(z, 0);
      z.classList.remove('wisch-voll-rot', 'wisch-auf');
      if (offen === z) offen = null;
    }
  };
  liste.addEventListener('pointerup', ende);
  liste.addEventListener('pointercancel', ende);

  liste.addEventListener('click', (ev) => {
    const ziel = ev.target as HTMLElement;
    const knopf = ziel.closest<HTMLButtonElement>('.wisch-loeschen');
    if (knopf && liste.contains(knopf)) {
      ev.stopPropagation();
      const id = knopf.dataset['id'];
      if (id) fuehreAus(id, knopf);
      return;
    }
    
    if ((ev as PointerEvent).pointerType === 'touch') return;
    const z = ziel.closest<HTMLElement>('.wisch-zeile');
    if (!z || !liste.contains(z)) return;
    if (offen === z) { schliesse(); return; }
    schliesse();
    z.classList.add('wisch-offen');
    setze(z, WISCH_KNOPF_PX);
    offen = z;
  });

  return {
    
    beschaeftigt: () => fragt || zeile !== null || (offen !== null && liste.contains(offen)),
    schliesse,
  };
}
