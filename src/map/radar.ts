import L from 'leaflet';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { icon } from '@/shell/icons';
import { nf, uhrLtVon } from '@/core/time';
import { RADAR_OHNE_RGB, RADAR_STUFEN, RADAR_TAKT_MS, naechstesBild, regenrateMmH, type RadarDaten } from '@/core/radar';
import { holeRadar, radarBildUrl } from '@/data/radar';

export type RadarStandArt = 'aus' | 'laedt' | 'an' | 'fehlt' | 'offline';

export interface RadarEbene {
  stand(): RadarStandArt;
  an(): boolean;
  daten(): RadarDaten | null;
  setze(an: boolean): Promise<void>;

  spielt(): boolean;
  setzeSpiel(an: boolean): void;

  bildZeit(): number | null;
  beiWechsel(f: () => void): void;
}

const TEXT = {
  de: {
    radar: 'Regenradar', laedt: 'Regenradar lädt', fehlt: 'Regenradar nicht verfügbar', offline: 'Regenradar nur mit Netz',
    stand: 'Radar {zeit}', ohne: 'ohne Radar', ab: 'ab', quelle: 'EUMETNET OPERA, Radar-DPC (CC BY-SA 4.0)',
    start: 'Animation starten', stopp: 'Animation anhalten',
  },
  en: {
    radar: 'Rain radar', laedt: 'Rain radar loading', fehlt: 'Rain radar unavailable', offline: 'Rain radar needs network',
    stand: 'Radar {zeit}', ohne: 'no radar', ab: 'from', quelle: 'EUMETNET OPERA, Radar-DPC (CC BY-SA 4.0)',
    start: 'Play animation', stopp: 'Stop animation',
  },
} as const;
const sprache = (): 'de' | 'en' => (aktuelleSprache() === 'en' ? 'en' : 'de');
const t = () => TEXT[sprache()];

export function radarUhrzeit(ms: number): string {
  return uhrLtVon(ms);
}

export function radarLegende(s: 'de' | 'en'): { farbe: string; text: string }[] {
  return [
    ...RADAR_STUFEN.map(({ dbz, rgb: [r, g, b] }) => {
      const mm = regenrateMmH(dbz);
      return { farbe: `rgb(${r},${g},${b})`, text: nf(mm, mm < 1 ? 1 : 0, s) };
    }),
    { farbe: `rgba(${RADAR_OHNE_RGB.join(',')},0.55)`, text: TEXT[s].ohne },
  ];
}

export const RADAR_EINHEIT = 'mm/h';
export const radarQuelle = (s: 'de' | 'en'): string => TEXT[s].quelle;

const ruhig = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function radarAuf(karte: L.Map, opt: { pane: string; zIndex?: number; speicher?: string; feld: boolean }): RadarEbene {
  if (!karte.getPane(opt.pane)) {
    const p = karte.createPane(opt.pane);
    p.style.zIndex = String(opt.zIndex ?? 230);
    p.style.pointerEvents = 'none';
  }
  let bild: L.ImageOverlay | null = null;
  let zustand: RadarStandArt = 'aus';
  let daten: RadarDaten | null = null;
  let takt = 0;
  let index = 0;
  let spielAn = !ruhig();
  let spielUhr = 0;
  const vorrat = new Map<string, HTMLImageElement>();
  let feld: L.Control | null = null;
  let feldTeile: { knopf: HTMLButtonElement; stand: HTMLElement; stufen: HTMLElement; quelle: HTMLElement } | null = null;
  const rueckrufe: (() => void)[] = [];
  const melde = () => { zeigeFeld(); for (const f of rueckrufe) f(); };

  const gezeigt = () => (daten ? daten.bilder[Math.min(index, daten.bilder.length - 1)] ?? null : null);

  function baueFeld(el: HTMLElement): void {
    el.innerHTML = '';
    const kopf = L.DomUtil.create('span', 'radar-kopf', el);
    const knopf = L.DomUtil.create('button', 'radar-spiel', kopf) as HTMLButtonElement;
    knopf.type = 'button';
    knopf.addEventListener('click', (e) => { e.stopPropagation(); setzeSpiel(!spielAn); });
    const stand = L.DomUtil.create('span', 'radar-stand', kopf);
    const stufen = L.DomUtil.create('span', 'radar-stufen', el);
    const quelle = L.DomUtil.create('span', 'radar-quelle', el);
    feldTeile = { knopf, stand, stufen, quelle };
  }

  function zeigeFeld(): void {
    if (!opt.feld) return;
    const b = gezeigt();
    if (zustand !== 'an' || !b) { feld?.remove(); return; }
    if (!feld) {
      const Feld = L.Control.extend({
        onAdd: () => {
          const el = L.DomUtil.create('div', 'leaflet-control-attribution leaflet-control radar-feld');
          L.DomEvent.disableClickPropagation(el);
          baueFeld(el);
          return el;
        },
      });
      feld = new Feld({ position: 'bottomleft' });
    }
    if (!feld.getContainer()?.isConnected) feld.addTo(karte);
    if (!feldTeile) return;
    const s = sprache();
    const { knopf, stand, stufen, quelle } = feldTeile;
    const knopfText = spielAn ? t().stopp : t().start;
    knopf.innerHTML = icon(spielAn ? 'pause' : 'start');
    knopf.setAttribute('aria-label', knopfText);
    knopf.title = knopfText;
    knopf.setAttribute('aria-pressed', String(spielAn));
    stand.textContent = t().stand.replace('{zeit}', radarUhrzeit(b.zeit));
    const html = `<span class="radar-ab">${t().ab}</span>` + radarLegende(s)
      .map((x) => `<span class="radar-stufe"><i style="background:${x.farbe}"></i>${x.text}</span>`).join('')
      + `<span class="radar-einheit">${RADAR_EINHEIT}</span>`;
    if (stufen.dataset['html'] !== html) { stufen.innerHTML = html; stufen.dataset['html'] = html; }
    quelle.textContent = t().quelle;
  }

  function zeige(i: number): boolean {
    const b = daten?.bilder[i];
    if (!b || !bild) return false;
    const url = radarBildUrl({ ...daten!, bild: b.bild });
    const img = vorrat.get(url);
    if (!img?.complete || img.naturalWidth === 0) return false;
    index = i;
    bild.setUrl(url);
    zeigeFeld();
    return true;
  }

  function halteSpiel(): void {
    if (spielUhr) window.clearTimeout(spielUhr);
    spielUhr = 0;
  }

  function spiele(): void {
    halteSpiel();
    if (!spielAn || zustand !== 'an' || !daten) return;
    const { i, warte } = naechstesBild(index, daten.bilder.length);
    spielUhr = window.setTimeout(() => {
      spielUhr = 0;
      if (!spielAn || zustand !== 'an' || !daten) return;

      if (!zeige(i)) index = i;
      spiele();
    }, warte);
  }

  function setzeSpiel(an: boolean): void {
    spielAn = an;
    halteSpiel();
    if (!daten) { melde(); return; }
    if (an) spiele();
    else zeige(daten.bilder.length - 1);
    melde();
  }

  function ladeVorrat(d: RadarDaten): Promise<void> {
    const urls = d.bilder.map((b) => radarBildUrl({ ...d, bild: b.bild }));
    for (const u of [...vorrat.keys()]) if (!urls.includes(u)) vorrat.delete(u);
    const juengstes = urls.at(-1)!;
    let fertig: Promise<void> = Promise.resolve();
    for (const u of urls) {
      if (vorrat.has(u)) continue;
      const img = new Image();
      img.decoding = 'async';
      const p = new Promise<void>((ok, fehler) => { img.onload = () => ok(); img.onerror = () => fehler(new Error('Radarbild')); });
      img.src = u;
      vorrat.set(u, img);
      if (u === juengstes) fertig = p;
      else p.catch(() => vorrat.delete(u));
    }
    return fertig;
  }

  async function lade(): Promise<void> {
    if (!navigator.onLine) {
      if (!bild) { zustand = 'offline'; melde(); }
      return;
    }

    const aus = (): boolean => zustand === 'aus';
    try {
      const d = await holeRadar();
      if (aus()) return;
      if (daten && d.zeit === daten.zeit && bild) { zustand = 'an'; melde(); return; }
      await ladeVorrat(d);
      if (aus()) return;
      const neuesteUrl = radarBildUrl(d);
      if (!bild) {
        bild = L.imageOverlay(neuesteUrl, d.grenzen, { pane: opt.pane, className: 'radar-bild', interactive: false }).addTo(karte);
      }
      daten = d;
      zustand = 'an';

      if (spielAn) {
        index = 0;
        if (!zeige(0)) zeige(d.bilder.length - 1);
        spiele();
      } else zeige(d.bilder.length - 1);
    } catch {
      if (aus()) return;

      if (!bild) zustand = navigator.onLine ? 'fehlt' : 'offline';
    }
    melde();
  }

  async function setze(an: boolean): Promise<void> {
    if (opt.speicher) { try { localStorage.setItem(opt.speicher, an ? '1' : '0'); } catch {  } }
    if (!an) {
      if (takt) clearInterval(takt);
      takt = 0;
      halteSpiel();
      bild?.remove(); bild = null; daten = null;
      zustand = 'aus';
      melde();
      return;
    }
    if (zustand === 'an' || zustand === 'laedt') return;
    zustand = 'laedt';
    spielAn = !ruhig();
    melde();
    if (!takt) takt = window.setInterval(() => { if (zustand !== 'aus') void lade(); }, RADAR_TAKT_MS);
    await lade();
  }

  aufSprachwechsel(() => zeigeFeld());
  window.addEventListener('online', () => { if (zustand === 'offline' || zustand === 'fehlt') void lade(); });
  if (opt.speicher) {
    let gemerkt = false;
    try { gemerkt = localStorage.getItem(opt.speicher) === '1'; } catch {  }
    if (gemerkt) void setze(true);
  }

  return {
    stand: () => zustand,

    an: () => zustand === 'an' || zustand === 'laedt',
    daten: () => daten,
    setze,
    spielt: () => spielAn,
    setzeSpiel,
    bildZeit: () => gezeigt()?.zeit ?? null,
    beiWechsel: (f) => { rueckrufe.push(f); },
  };
}

export function radarKnopf(r: RadarEbene, klasse: string): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = `luftbild-knopf radar-knopf ${klasse}`;
  k.innerHTML = `${icon('radar')}<span class="luftbild-strich" aria-hidden="true"></span>`;
  const beschrifte = () => {
    const s = r.stand();
    const text = s === 'laedt' ? t().laedt : s === 'fehlt' ? t().fehlt : s === 'offline' ? t().offline : t().radar;
    k.title = text;
    k.setAttribute('aria-label', text);
    k.setAttribute('aria-pressed', String(s === 'an'));
    k.dataset['stand'] = s === 'offline' ? 'fehlt' : s;
  };
  k.addEventListener('click', (e) => { e.stopPropagation(); void r.setze(!r.an()); });
  r.beiWechsel(beschrifte);
  aufSprachwechsel(beschrifte);
  beschrifte();
  return k;
}
