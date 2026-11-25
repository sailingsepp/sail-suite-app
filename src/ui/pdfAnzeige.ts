import { aktuelleSprache } from '@/shell/sprache';

export function amRechner(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: fine) and (hover: hover)').matches;
}

export function pdfZiel(wartetext: string): Window | null {
  if (!amRechner()) return null;
  const w = window.open('', '_blank');
  if (!w) return null;
  try {
    w.document.title = wartetext;
    w.document.body.style.font = '16px system-ui, sans-serif';
    w.document.body.style.margin = '2rem';
    w.document.body.textContent = wartetext;
  } catch {

  }
  return w;
}

export function verwirfZiel(w: Window | null): void {
  try {
    w?.close();
  } catch {

  }
}

function herunterladen(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

function zeigeImTab(ziel: Window, url: string, name: string): boolean {
  try {
    const d = ziel.document;
    d.title = name;
    d.body.textContent = '';
    d.body.style.cssText = 'margin:0;font:15px system-ui,sans-serif;background:#0f2236;color:#fff;display:flex;flex-direction:column;height:100vh';
    const leiste = d.createElement('div');
    leiste.style.cssText = 'padding:10px 16px;display:flex;gap:12px;align-items:center;flex:none';
    const link = d.createElement('a');
    link.href = url;
    link.download = name;
    link.textContent = `⬇ ${name}`;
    link.style.cssText = 'color:#f5a623;font-weight:600;text-decoration:underline';
    leiste.append(link);
    const rahmen = d.createElement('iframe');
    rahmen.src = url;
    rahmen.title = name;
    rahmen.style.cssText = 'flex:1;width:100%;border:0;background:#fff';
    d.body.append(leiste, rahmen);
    return true;
  } catch {
    return false;
  }
}

export async function biete(blob: Blob, name: string, ziel: Window | null = null): Promise<void> {
  const pdf = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  if (ziel && !ziel.closed) {
    const url = URL.createObjectURL(pdf);

    if (!zeigeImTab(ziel, url, name)) ziel.location.href = url;

    herunterladen(pdf, name);

    setTimeout(() => URL.revokeObjectURL(url), 3_600_000);
    return;
  }
  if (!amRechner()) {
    const datei = new File([pdf], name, { type: 'application/pdf' });
    const teilen = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (navigator.share && teilen.canShare?.({ files: [datei] })) {

      if (aktivierungVerfallen()) { teilenLeiste(datei, pdf, name); return; }
      try {
        await navigator.share({ files: [datei], title: name });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotAllowedError') { teilenLeiste(datei, pdf, name); return; }

      }
    }
  }
  herunterladen(pdf, name);
}

export function aktivierungVerfallen(nav: { userActivation?: { isActive: boolean } } = navigator as Navigator & { userActivation?: { isActive: boolean } }): boolean {
  return nav.userActivation !== undefined && !nav.userActivation.isActive;
}

const LEISTE_TEXT = {
  de: { fertig: 'PDF fertig', teilen: 'Teilen', speichern: 'Speichern', zu: 'Schließen' },
  en: { fertig: 'PDF ready', teilen: 'Share', speichern: 'Save', zu: 'Close' },
} as const;

function teilenLeiste(datei: File, pdf: Blob, name: string): void {
  const w = LEISTE_TEXT[aktuelleSprache()];
  document.getElementById('pdf-teilen-leiste')?.remove();
  const leiste = document.createElement('div');
  leiste.id = 'pdf-teilen-leiste';
  leiste.className = 'pdf-teilen-leiste';
  leiste.setAttribute('role', 'dialog');
  leiste.setAttribute('aria-label', w.fertig);
  const text = document.createElement('p');
  text.textContent = `${w.fertig}: ${name}`;
  const knoepfe = document.createElement('div');
  const knopf = (beschriftung: string, primaer: boolean, tun: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = primaer ? 'btn primary' : 'btn';
    b.textContent = beschriftung;
    b.addEventListener('click', tun);
    knoepfe.appendChild(b);
    return b;
  };
  const teilen = knopf(w.teilen, true, () => {
    navigator.share({ files: [datei], title: name })
      .then(() => leiste.remove())
      .catch(() => {  });
  });
  knopf(w.speichern, false, () => { herunterladen(pdf, name); leiste.remove(); });
  knopf(w.zu, false, () => leiste.remove());
  leiste.append(text, knoepfe);
  document.body.appendChild(leiste);
  teilen.focus();
}
