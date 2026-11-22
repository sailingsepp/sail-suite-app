


type Reiter = 'uebersicht' | 'crew' | 'statistik' | 'kasse' | 'technik';
const REITER: readonly Reiter[] = ['uebersicht', 'crew', 'statistik', 'kasse', 'technik'];

function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}


export function zeigeReiter(name: Reiter): void {
  for (const r of REITER) {
    const knopf = document.querySelector<HTMLButtonElement>(`.vb-reiter [data-reiter="${r}"]`);
    const feld = el(`vb-reiter-${r}`);
    const an = r === name;
    knopf?.setAttribute('aria-selected', String(an));
    if (feld) feld.hidden = !an;
  }
}


export function fuelleToerndaten(werte: {
  revier?: string | null; zeitraum?: string | null; nutzung?: string | null;
  start?: string | null; ende?: string | null; schiff?: string | null;
  erfahrung?: string | null; rolle?: string | null;
}, wortKeineAngabe = 'keine Angabe'): void {
  const setze = (id: string, wert?: string | null) => {
    const ziel = el(id);
    if (!ziel) return;
    const leer = !(wert && wert.trim());
    ziel.textContent = leer ? wortKeineAngabe : (wert as string);
    ziel.classList.toggle('vb-wert-leer', leer);
  };
  setze('vb-wert-revier', werte.revier);
  setze('vb-wert-zeitraum', werte.zeitraum);
  setze('vb-wert-nutzung', werte.nutzung);
  setze('vb-wert-start', werte.start);
  setze('vb-wert-ende', werte.ende);
  setze('vb-wert-schiff', werte.schiff);
  setze('vb-wert-erfahrung', werte.erfahrung);
  setze('vb-wert-rolle', werte.rolle);
}


export function fuelleEinladung(werte: {
  name: string; revier?: string | null; zeitraum?: string | null;
  start?: string | null; nutzung?: string | null;
}, wortKeineAngabe = 'keine Angabe'): void {
  const name = el('vb-einladung-toernname');
  if (name) name.textContent = werte.name;
  const karte = el('vb-einladung-karte');
  if (karte) karte.hidden = false;
  const setze = (id: string, wert?: string | null) => {
    const ziel = el(id);
    if (!ziel) return;
    const leer = !(wert && wert.trim());
    ziel.textContent = leer ? wortKeineAngabe : (wert as string);
    ziel.classList.toggle('vb-wert-leer', leer);
  };
  setze('vb-einladung-revier', werte.revier);
  setze('vb-einladung-zeitraum', werte.zeitraum);
  setze('vb-einladung-start', werte.start);
  setze('vb-einladung-nutzung', werte.nutzung);
}





function spiegleZusammen(vonId: string, nachId: string): void {
  const von = el(vonId);
  const nach = el(nachId);
  if (!von || !nach) return;
  nach.textContent = (von.dataset['zusammen'] ?? von.textContent ?? '').trim();
}

function spiegleText(vonId: string, nachId: string): void {
  const von = el(vonId);
  const nach = el(nachId);
  if (!von || !nach) return;
  nach.textContent = (von.dataset['kurz'] ?? von.textContent ?? '').trim();
}

function zeigeRevierKarte(): void {
  const liste = el('vb-revier-hinweise');
  const karte = el('vb-revier-karte');
  if (!liste || !karte) return;
  karte.hidden = liste.hidden || liste.children.length === 0;
}


export function initUmbau(): void {
  
  document.querySelectorAll<HTMLButtonElement>('[data-reiter]').forEach((b) => {
    b.addEventListener('click', () => zeigeReiter(b.dataset['reiter'] as Reiter));
  });

  
  document.querySelectorAll<HTMLButtonElement>('[data-klapp]').forEach((b) => {
    b.addEventListener('click', () => {
      const feld = el(b.dataset['klapp'] as string);
      if (!feld) return;
      const oeffnen = feld.hidden;
      feld.hidden = !oeffnen;
      b.setAttribute('aria-expanded', String(oeffnen));
    });
  });

  
  
  
  const zwilling: Array<[string, string]> = [
    ['btn-crew-einladen-2', 'btn-crew-einladen'],
  ];
  for (const [kopie, original] of zwilling) {
    const k = el<HTMLButtonElement>(kopie);
    const o = el<HTMLButtonElement>(original);
    if (k && o) k.addEventListener('click', () => o.click());
  }

  
  const beobachte = (id: string, fn: () => void) => {
    const knoten = el(id);
    if (!knoten) return;
    new MutationObserver(fn).observe(knoten, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'data-kurz', 'data-zusammen'],
    });
    fn();
  };
  beobachte('vb-statistik', () => spiegleText('vb-statistik', 'vb-statistik-kurz'));
  beobachte('vb-briefing', () => { spiegleText('vb-briefing', 'vb-briefing-kurz'); spiegleZusammen('vb-briefing', 'vb-briefing-zusammen'); });
  beobachte('vb-toernplan', () => { spiegleText('vb-toernplan', 'vb-toernplan-kurz'); spiegleZusammen('vb-toernplan', 'vb-toernplan-zusammen'); });
  beobachte('vb-revier-hinweise', zeigeRevierKarte);

  zeigeReiter('uebersicht');
}
