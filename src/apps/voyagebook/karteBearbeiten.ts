export type KartenArt = 'toern' | 'yacht';

const TEILE: Record<KartenArt, { felder: readonly string[]; aufklappen: readonly string[] }> = {
  toern: {
    felder: ['feld-toern-name', 'feld-punkte', 'vb-revier-abgeleitet', 'feld-zeitraum', 'vb-bis-hinweis', 'feld-yachtnutzung', 'feld-crew-erfahrung-huelle'],
    aufklappen: ['feld-crew-erfahrung-huelle'],
  },
  yacht: { felder: ['feld-schiff'], aufklappen: ['feld-schiff'] },
};
const LEISTE = ['toern-status', 'toern-aktionen'];

interface Platz { knoten: HTMLElement; eltern: Node; danach: Node | null; versteckt: boolean }

let offen: KartenArt | null = null;
let plaetze: Platz[] = [];

const $ = (id: string): HTMLElement | null => document.getElementById(id);

export function offeneKarte(): KartenArt | null {
  return offen;
}

function haengeUm(id: string, ziel: HTMLElement): void {
  const knoten = $(id);
  if (!knoten || !knoten.parentNode) return;
  plaetze.push({ knoten, eltern: knoten.parentNode, danach: knoten.nextSibling, versteckt: knoten.hidden });
  ziel.appendChild(knoten);
}

function zurueck(): void {
  for (const p of plaetze.reverse()) {
    p.eltern.insertBefore(p.knoten, p.danach);
    p.knoten.hidden = p.versteckt;
  }
  plaetze = [];
}

function zeigeKarte(art: KartenArt, an: boolean): void {
  const karte = $(art === 'toern' ? 'vb-karte-toerndaten' : 'vb-karte-yacht');
  const form = $(art === 'toern' ? 'vb-form-toern' : 'vb-form-yacht');
  const ansicht = karte?.querySelector<HTMLElement>('.vb-karte-ansicht');
  karte?.classList.toggle('vb-karte-bearbeiten', an);
  if (form) form.hidden = !an;
  if (ansicht) ansicht.hidden = an;
}

export function oeffneKarte(art: KartenArt): void {
  if (offen === art) return;
  if (offen) schliesseKarte();
  const raster = $(art === 'toern' ? 'vb-form-toern-felder' : 'vb-form-yacht-felder');
  const leiste = $(art === 'toern' ? 'vb-form-toern-leiste' : 'vb-form-yacht-leiste');
  if (!raster || !leiste) return;
  for (const id of TEILE[art].felder) haengeUm(id, raster);
  for (const id of LEISTE) haengeUm(id, leiste);
  for (const id of TEILE[art].aufklappen) { const el = $(id); if (el) el.hidden = false; }
  offen = art;
  zeigeKarte(art, true);
  const karte = $(art === 'toern' ? 'vb-karte-toerndaten' : 'vb-karte-yacht');
  karte?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  raster.querySelector<HTMLElement>('input:not([type="hidden"]), select, button')?.focus({ preventScroll: true });
}

export function wechsleKarte(art: KartenArt): void {
  oeffneKarte(art);
}

export function schliesseKarte(): void {
  if (!offen) return;
  const art = offen;
  zurueck();
  offen = null;
  zeigeKarte(art, false);
  $(art === 'toern' ? 'btn-toerndaten-bearbeiten' : 'btn-yacht-bearbeiten')?.focus({ preventScroll: true });
}
