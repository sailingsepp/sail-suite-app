

export interface ModalHandle {
  
  beimOeffnen(ausloeser?: HTMLElement | null, initialFokus?: HTMLElement | null): void;
  
  beimSchliessen(): void;
}

const FOKUSSIERBAR = 'a[href], button:not([disabled]), textarea:not([disabled]), '
  + 'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function fokussierbareElemente(modal: HTMLElement): HTMLElement[] {
  return Array.from(modal.querySelectorAll<HTMLElement>(FOKUSSIERBAR))
    
    
    .filter((el) => el.offsetParent !== null);
}


function iosZoomZuruecksetzen(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  const original = meta?.getAttribute('content');
  if (!meta || !original) return;
  meta.setAttribute('content', `${original}, maximum-scale=1`);
  setTimeout(() => meta.setAttribute('content', original), 300);
}


export function initModal(modal: HTMLElement, schliessen: () => void): ModalHandle {
  let letzterAusloeser: HTMLElement | null = null;

  function keydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      schliessen();
      return;
    }
    if (ev.key !== 'Tab') return;
    const elemente = fokussierbareElemente(modal);
    if (elemente.length === 0) return;
    const erstes = elemente[0]!;
    const letztes = elemente[elemente.length - 1]!;
    if (ev.shiftKey && document.activeElement === erstes) {
      ev.preventDefault();
      letztes.focus();
    } else if (!ev.shiftKey && document.activeElement === letztes) {
      ev.preventDefault();
      erstes.focus();
    }
  }

  return {
    beimOeffnen(ausloeser, initialFokus) {
      letzterAusloeser = ausloeser ?? (document.activeElement as HTMLElement | null);
      modal.addEventListener('keydown', keydown);
      
      
      
      requestAnimationFrame(() => {
        const ziel = initialFokus ?? fokussierbareElemente(modal)[0];
        (ziel ?? modal).focus();
      });
    },
    beimSchliessen() {
      modal.removeEventListener('keydown', keydown);
      letzterAusloeser?.focus();
      letzterAusloeser = null;
      iosZoomZuruecksetzen();
    },
  };
}
