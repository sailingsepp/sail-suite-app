import L from 'leaflet';
import { karteGedeckt } from '@/core/kartenKacheln';
import { dreheVektor } from '@/core/kursoben';
import { ohneUeberlappung, sichtbarAb, vorrang, type Kasten, type KartenName, type NamenArt } from '@/core/seekartenObjekte';
import { escapeHtml } from '@/core/html';
import { aktuelleSprache, aufSprachwechsel } from '@/shell/sprache';
import { kartenIndexJetzt } from '@/data/landKacheln';
import { ladeSeekartenObjekte, namenJetzt } from '@/data/seekartenObjekte';
import { oeffneMetar } from './metarFenster';
import { SEEKARTEN_NAMEN_PANE, type Seekarte } from './seekarte';


const PANE = SEEKARTEN_NAMEN_PANE;
const HOECHSTENS = 160;

const NEU_AB_GRAD = 8;


const GROESSE: Record<NamenArt, number> = {
  stadt: 16, marina: 13, hafen: 13, anker: 12, insel: 14, inselchen: 12, gipfel: 12, ort: 14, dorf: 12, kap: 12, flugplatz: 12, windrad: 12,
};

const NUR_SYMBOL_AB_ZOOM = 9;
const liegeplatz = (a: NamenArt) => a === 'marina' || a === 'hafen' || a === 'anker';

const SYMBOL: Partial<Record<NamenArt, string>> = {
  
  
  hafen: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--kn-akzent)" stroke="var(--kn-halo)" stroke-width="1.5"/><path d="M8 4.6v6.4M6.2 6.2h3.6M4.9 9c.4 1.4 1.6 2.2 3.1 2.2s2.7-.8 3.1-2.2" fill="none" stroke="var(--kn-glyph)" stroke-width="1.3" stroke-linecap="round"/></svg>',
  marina: '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--kn-akzent)" stroke="var(--kn-halo)" stroke-width="1.5"/><path d="M5 11 8 4v7ZM9 5l3 5H9Z" fill="var(--kn-glyph)"/></svg>',
  
  anker: '<svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--kn-halo)" stroke="var(--kn-anker)" stroke-width="1.5"/><path d="M8 4.4v7M6 6.1h4M4.6 8.9c.4 1.5 1.8 2.4 3.4 2.4s3-.9 3.4-2.4" fill="none" stroke="var(--kn-anker)" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="3.8" r=".9" fill="var(--kn-anker)"/></svg>',
  gipfel: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 1.2 11 10.6H1Z" fill="var(--kn-berg)"/></svg>',
  
  flugplatz: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--kn-halo)" stroke="currentColor" stroke-width="1.3"/><path d="M8 2.8c.5 0 .8.5.8 1.1v2.7l3.6 2.1v1.1L8.8 8.7v2.4l1.1.9v.9L8 12.4l-1.9.5v-.9l1.1-.9V8.7L3.6 9.8V8.7l3.6-2.1V3.9c0-.6.3-1.1.8-1.1Z" fill="currentColor"/></svg>',
  
  windrad: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M8 15V7M8 7V1.6M8 7 3.3 9.7M8 7l4.7 2.7" stroke="var(--kn-halo)" stroke-width="3.4"/><path d="M8 15V7M8 7V1.6M8 7 3.3 9.7M8 7l4.7 2.7" stroke="currentColor" stroke-width="1.4"/></g><circle cx="8" cy="7" r="1.5" fill="currentColor" stroke="var(--kn-halo)" stroke-width=".8"/></svg>',
  stadt: '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="3.8" fill="currentColor" stroke="var(--kn-halo)" stroke-width="1.4"/></svg>',
  ort: '<svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true"><circle cx="4" cy="4" r="3" fill="currentColor" stroke="var(--kn-halo)" stroke-width="1.2"/></svg>',
  dorf: '<svg viewBox="0 0 6 6" width="6" height="6" aria-hidden="true"><circle cx="3" cy="3" r="2.3" fill="currentColor"/></svg>',
};
const SYMBOL_PX: Partial<Record<NamenArt, number>> = { hafen: 18, marina: 18, anker: 17, gipfel: 12, stadt: 10, ort: 8, dorf: 6, flugplatz: 16, windrad: 16 };


function flugplatzZusatz(n: KartenName): string {
  const metar = n[4] === 1 ? 'METAR' : n[4] === 0 ? (aktuelleSprache() === 'en' ? 'no METAR' : 'ohne METAR') : '';
  return [n[5] ?? '', metar].filter(Boolean).join(' · ');
}

function text(n: KartenName): string {
  if (n[2] === 'flugplatz') { const z = flugplatzZusatz(n); return z ? `${n[3]} ${z}` : n[3]; }
  return n[2] === 'gipfel' && n[4] != null ? `${n[3]} ${Math.round(n[4])}` : n[3];
}


export interface BelegterPlatz { lat: number; lon: number; text: string | null; seite: 'rechts' | 'links' | null }

export interface NamenOptionen {
  
  netz: () => boolean;
  
  winkel?: () => number;
  
  belegt?: () => readonly BelegterPlatz[];
}


export function seekartenNamen(k: L.Map, sk: Seekarte, o: NamenOptionen): { neu: () => void } {
  const winkelVon = o.winkel ?? (() => 0);
  if (!k.getPane(PANE)) k.createPane(PANE).style.zIndex = '240';
  const gruppe = L.layerGroup().addTo(k);
  let winkelZuletzt = 0;

  function zeichne(): void {
    gruppe.clearLayers();
    const idx = kartenIndexJetzt();
    if (!idx) return;
    const z = k.getZoom();
    if (z < 8) return;
    const b = k.getBounds().pad(0.15);
    const box = { swLat: b.getSouth(), swLon: b.getWest(), neLat: b.getNorth(), neLon: b.getEast() };
    const kandidaten = namenJetzt(box)
      .filter((n) => z >= sichtbarAb(n[2], n[4]) && karteGedeckt(idx, n[0], n[1]))
      .sort((a, c) => vorrang(a[2], a[4], z) - vorrang(c[2], c[4], z));
    
    const winkel = winkelVon();
    winkelZuletzt = winkel;
    const mitte = k.getSize().divideBy(2);
    const bild = (n: Pick<KartenName, 0 | 1>): [number, number] => {
      const p = k.latLngToContainerPoint([n[0], n[1]]);
      const [x, y] = dreheVektor(p.x - mitte.x, p.y - mitte.y, winkel);
      return [mitte.x + x, mitte.y + y];
    };
    const lagen = kandidaten.map((n) => {
      const [x, y] = bild(n);
      const insel = n[2] === 'insel' || n[2] === 'inselchen';
      
      const zeilen = n[2] === 'flugplatz' && flugplatzZusatz(n) ? [n[3], flugplatzZusatz(n)] : [text(n)];
      
      const g = GROESSE[n[2]], h = g * 1.25 * zeilen.length;
      const br = Math.max(...zeilen.map((t) => t.length)) * g * (insel ? 0.95 : 0.56) + 6;
      const sym = SYMBOL_PX[n[2]] ?? 0;
      const punkt: Kasten = { x0: x - sym / 2 - 1, y0: y - sym / 2 - 1, x1: x + sym / 2 + 1, y1: y + sym / 2 + 1 };
      
      if (insel || n[2] === 'kap') return [{ x0: x - br / 2, y0: y - h / 2, x1: x + br / 2, y1: y + h / 2 }];
      
      if (!text(n)) return z >= NUR_SYMBOL_AB_ZOOM ? [punkt] : [];
      const rechts: Kasten = { x0: punkt.x0, y0: Math.min(punkt.y0, y - h / 2), x1: x + sym / 2 + 3 + br, y1: Math.max(punkt.y1, y + h / 2) };
      const links: Kasten = { x0: x - sym / 2 - 3 - br, y0: rechts.y0, x1: punkt.x1, y1: rechts.y1 };
      return liegeplatz(n[2]) && z >= NUR_SYMBOL_AB_ZOOM ? [rechts, links, punkt] : [rechts, links];
    });
    
    const belegt: Kasten[] = (o.belegt?.() ?? []).flatMap((f) => {
      const [x, y] = bild([f.lat, f.lon]);
      const ks: Kasten[] = [{ x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 }];
      const br = (f.text?.length ?? 0) * 8.6 + 12;
      if (f.seite === 'rechts') ks.push({ x0: x + 10, y0: y - 10, x1: x + 10 + br, y1: y + 10 });
      if (f.seite === 'links') ks.push({ x0: x - 10 - br, y0: y - 10, x1: x - 10, y1: y + 10 });
      return ks;
    });
    const wahl = ohneUeberlappung(lagen, belegt);
    let gesetzt = 0;
    kandidaten.forEach((n, i) => {
      const l = wahl[i]!;
      if (l < 0 || gesetzt >= HOECHSTENS) return;
      gesetzt++;
      const insel = n[2] === 'insel' || n[2] === 'inselchen';
      const zusatz = n[2] === 'flugplatz' ? flugplatzZusatz(n) : '';
      const hoehe = n[2] === 'gipfel' && n[4] != null ? ` <small>${Math.round(n[4])}</small>`
        : zusatz ? ` <small>${escapeHtml(zusatz)}</small>` : '';
      
      const nurSymbol = !text(n) || l === 2;
      
      const metar = n[2] === 'flugplatz' && n[4] === 1 && !!n[5];
      
      const ort = liegeplatz(n[2]) ? ` data-lat="${n[0]}" data-lon="${n[1]}"` : '';
      const html = `<div class="tb-kn ${n[2]}${metar ? ' metar' : ''}${l === 1 ? ' links' : ''}"${ort}>${metar ? '<i class="tb-kn-tipp"></i>' : ''}${SYMBOL[n[2]] ?? ''}`
        + (nurSymbol ? '' : `<span>${escapeHtml(n[3])}${hoehe}</span>`) + '</div>';
      const marke = L.marker([n[0], n[1]], {
        pane: PANE, interactive: metar, keyboard: metar, bubblingMouseEvents: false,
        title: metar ? `METAR ${n[5]}` : '',
        icon: L.divIcon({ className: `tb-kn-icon${insel ? ' insel' : ''}${metar ? ' metar' : ''}`, iconSize: [0, 0], iconAnchor: [0, 0], html }),
      }).addTo(gruppe);
      if (metar) {
        marke.on('click', (e) => { L.DomEvent.stop(e); void oeffneMetar(n[5]!, n[3]); });
        marke.on('keypress', (e) => { if ((e as unknown as { originalEvent: KeyboardEvent }).originalEvent.key === 'Enter') void oeffneMetar(n[5]!, n[3]); });
      }
    });
  }

  let geplant = 0;
  function bald(): void {
    if (geplant) return;
    geplant = window.setTimeout(() => {
      geplant = 0;
      zeichne();
      if (k.getZoom() < 8) return;
      const b = k.getBounds().pad(0.15);
      void ladeSeekartenObjekte({ swLat: b.getSouth(), swLon: b.getWest(), neLat: b.getNorth(), neLon: b.getEast() }, o.netz())
        .then((neu) => { if (neu) zeichne(); }, () => undefined);
    }, 120);
  }

  k.on('moveend zoomend', bald);
  
  sk.ebene.on('load', bald);
  window.addEventListener('online', bald);
  
  aufSprachwechsel(() => bald());
  
  if (o.winkel) window.setInterval(() => { if (Math.abs(winkelVon() - winkelZuletzt) > NEU_AB_GRAD) bald(); }, 4000);
  bald();
  return { neu: zeichne };
}
