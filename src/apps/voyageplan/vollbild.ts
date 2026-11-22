import L from 'leaflet';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { holeKandidatenknotenImGebiet } from '@/data/haefen';
import type { Hafenknoten } from '@/core/hafennetz';
import { escapeHtml } from '@/core/html';
import { app, wort, $, wunschlisteEins, wunschlisteZwei } from './kontext';
import { zeigeWochenReiter } from './automatik';
import { hebeTagHervor, setzeTagWahl, passeAusschnittAn, kartenRaender } from './karte';

type Ansicht = 'vorgaben' | 'plan';
type Abschnitt = 'rahmen' | 'ziele' | 'regeln';

const BREIT = window.matchMedia('(min-width: 900px)');
const SEITE_MIN = 380;
const SEITE_MAX = 720;
const SEITE_VORGABE = 460;
const KARTE_MIN = 220;

const PLAN_MIN = 140;
const TASTENSCHRITT = 24;

const LIEGEPLATZ_ZOOM = 9;

const LIEGEPLATZ_MAX_GRAD = 2;
const LIEGEPLATZ_HOECHSTENS = 300;

let karte: L.Map | null = null;
let planEbenen: L.LayerGroup | null = null;
let seezeichen: L.TileLayer | null = null;
const vorgabenEbene = L.layerGroup();

let ansicht: Ansicht = 'vorgaben';
let offen: Abschnitt | null = 'ziele';
let option: 1 | 2 = 1;
let rechnet = false;
let gewaehlt: number | null = null;
let letzteZeilenzahl = 0;

const plan = (): HTMLElement | null => $('vp-plan');
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string): void => { try { localStorage.setItem(k, v); } catch {  } };
const begrenze = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), Math.max(lo, hi));
const text = (id: string): string => $(id)?.textContent?.trim() ?? '';
const wert = (id: string): string => ($(id) as HTMLInputElement | null)?.value.trim() ?? '';

function zellText(el: Element | null): string {
  if (!el) return '';
  const kopie = el.cloneNode(true) as HTMLElement;
  kopie.querySelectorAll('.vp-sr-only, .vp-nur-karte').forEach((x) => x.remove());
  return kopie.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function aktiveListe(): HTMLElement | null {
  const hand = $('panel-woche-hand');
  if (hand && !hand.hidden) return $('vp-wochentabelle');
  return $('vp-woche-automatisch');
}
function zeilen(liste = aktiveListe()): HTMLElement[] {
  return liste ? [...liste.querySelectorAll<HTMLElement>('.vp-woche-zeile')] : [];
}

function hatHandEtappen(): boolean {
  return ($('vp-etappenliste')?.childElementCount ?? 0) > 0;
}
function hatPlan(): boolean {
  return zeilen($('vp-woche-automatisch')).length > 0 || zeilen($('vp-wochentabelle')).length > 0 || hatHandEtappen();
}

export function zeigeAnsicht(neu: Ansicht): void {
  ansicht = neu;
  aktualisiere();
}

function oeffneAbschnitt(neu: Abschnitt | null): void {
  offen = neu;
  for (const a of ['rahmen', 'ziele', 'regeln'] as const) {
    const knopf = $(`btn-abschnitt-${a}`);
    const inhalt = $(`vp-abschnitt-${a}-inhalt`);
    const auf = a === offen;
    knopf?.setAttribute('aria-expanded', String(auf));
    $(`vp-abschnitt-${a}`)?.classList.toggle('offen', auf);
    if (inhalt) inhalt.hidden = !auf;
  }
  aktualisiere();
}

function aktualisiere(): void {
  const p = plan();
  if (!p) return;
  const vorhanden = hatPlan();
  p.dataset['ansicht'] = ansicht;
  p.toggleAttribute('data-rechnet', rechnet);
  p.toggleAttribute('data-hat-plan', vorhanden);

  for (const [a, id] of [['vorgaben', 'vp-ansicht-vorgaben'], ['plan', 'vp-ansicht-plan']] as const) {
    $(`tab-ansicht-${a}`)?.setAttribute('aria-selected', String(a === ansicht));
    const feld = $(id);
    if (feld) feld.hidden = a !== ansicht;
  }
  const anzahl = zeilen().length;
  const unter = $('vp-reiter-plan-unter');
  if (unter) unter.textContent = anzahl === 0 ? '' : anzahl === 1 ? wort('ansicht.einTag') : wort('ansicht.tage', { n: String(anzahl) });

  const fussPlan = ansicht === 'plan' && vorhanden && !rechnet;
  const fv = $('vp-fuss-vorgaben');
  const fp = $('vp-fuss-plan');
  if (fv) fv.hidden = fussPlan;
  if (fp) fp.hidden = !fussPlan;
  const zumPlan = $('btn-zum-plan');
  if (zumPlan) zumPlan.hidden = !vorhanden || ansicht === 'plan';

  const rechnetFeld = $('vp-plan-rechnet');
  if (rechnetFeld) rechnetFeld.hidden = !rechnet;
  const leer = $('vp-plan-leer');
  if (leer) leer.hidden = rechnet || vorhanden;
  const auto = $('vp-woche-automatisch');
  const toernplanLeer = $('vp-toernplan-leer');
  if (toernplanLeer) toernplanLeer.hidden = rechnet || vorhanden || (auto?.childElementCount ?? 0) > 0;

  const tipp = ansicht === 'vorgaben' && offen === 'ziele' && !app.nurLesen;
  const tippBreit = $('vp-ziel-tipp');
  const tippSchmal = $('vp-karten-tipp');
  if (tippBreit) tippBreit.hidden = !tipp || !BREIT.matches;
  if (tippSchmal) tippSchmal.hidden = !tipp || BREIT.matches;

  zeichneLegende();
  zeigeTag();
  stelleKarteEin();
}

function kurzDatum(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}.${m[1]}.` : '';
}

function aktualisiereSummen(): void {
  const start = text('vp-start-wert');
  const rueckgabe = text('vp-rueckgabe-wert');
  const von = [kurzDatum(wert('in-plan-von')), wert('in-uebernahme-zeit')].filter(Boolean).join(' ');
  const bis = [kurzDatum(wert('in-plan-bis')), wert('in-rueckgabe-zeit')].filter(Boolean).join(' ');
  const rahmen = [start, von || bis ? `${von} → ${bis}` : '', start && start === rueckgabe ? wort('ansicht.rundtoern') : rueckgabe ? `→ ${rueckgabe}` : '']
    .filter(Boolean).join(' · ');
  const summeRahmen = $('vp-summe-rahmen');
  if (summeRahmen) summeRahmen.textContent = rahmen;

  const namen = [...document.querySelectorAll('#vp-chipliste > li > span:first-child')].map((e) => e.textContent?.trim()).filter(Boolean);
  const summeZiele = $('vp-summe-ziele');
  if (summeZiele) summeZiele.textContent = namen.length ? namen.join(', ') : wort('ansicht.zieleKeine');
  for (const s of ['', '-2']) {
    const leer = $(`vp-ziele-leer${s}`);
    if (leer) leer.hidden = (document.getElementById(`vp-chipliste${s}`)?.childElementCount ?? 0) > 0;
  }

  const art = ($('in-planungsart') as HTMLSelectElement | null)?.value ?? 'woche';
  for (const k of document.querySelectorAll<HTMLElement>('#vp-art-segment [data-art]')) {
    k.setAttribute('aria-pressed', String(k.dataset['art'] === art));
  }
  const summeRegeln = $('vp-summe-regeln');
  if (summeRegeln) {
    if (art === 'ueberstellung') {
      summeRegeln.textContent = wort('ansicht.summeUeberstellung', { n: wert('in-ueb-fahrt') || '?' });
    } else {
      const nacht = wert('in-nachtfahrt-budget');
      summeRegeln.textContent = [
        wert('in-max-stunden') ? wort('ansicht.summeStunden', { n: wert('in-max-stunden') }) : '',
        wert('in-grenz-mean') ? wort('ansicht.summeWind', { n: wert('in-grenz-mean') }) : '',
        nacht ? (nacht === '1' ? wort('ansicht.summeNacht1') : wort('ansicht.summeNacht', { n: nacht })) : '',
        wert('in-reserve-tage') ? wort('ansicht.summeReserve', { n: wert('in-reserve-tage') }) : '',
      ].filter(Boolean).join(' · ');
    }
  }
  zeigeOptionen();
}

function zweiteAktiv(): boolean {
  return !($('vp-wunschliste-2')?.hidden ?? true);
}

function zeigeOptionen(): void {
  const aktiv = zweiteAktiv();
  if (!aktiv) option = 1;
  const inhalt = $('vp-abschnitt-ziele-inhalt');
  if (inhalt) inhalt.dataset['option'] = String(option);
  const k1 = $('btn-option-1');
  const k2 = $('btn-option-2');
  const weg = $('btn-zweite-option-entfernen');
  if (k1) { k1.hidden = !aktiv; k1.textContent = wort('ansicht.option1'); k1.setAttribute('aria-pressed', String(option === 1)); }
  if (k2) {
    k2.hidden = !aktiv;
    const name = wert('in-options-name-2');
    k2.textContent = name ? `${wort('ansicht.option2')} · ${name}` : wort('ansicht.option2');
    k2.setAttribute('aria-pressed', String(option === 2));
  }
  if (weg) weg.hidden = !aktiv;
}

function waehleTag(tag: number | null, zuSehen = false): void {
  gewaehlt = tag;
  if (tag != null && ansicht !== 'plan') ansicht = 'plan';
  aktualisiere();
  if (zuSehen && !BREIT.matches) $('vp-seite')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function zeigeTag(): void {
  const liste = zeilen();
  for (const z of document.querySelectorAll<HTMLElement>('.vp-woche-zeile.vp-gewaehlt')) {
    z.classList.remove('vp-gewaehlt');
    z.querySelector('.vp-woche-waehlen')?.removeAttribute('aria-current');
  }
  const zeile = gewaehlt == null ? null : liste.find((z) => z.dataset['tag'] === String(gewaehlt)) ?? null;
  const artikel = $('vp-tag');
  const ohne = $('vp-plan-ohne-tag');
  if (artikel) artikel.hidden = !zeile || rechnet;
  if (ohne) ohne.hidden = !!zeile || rechnet || liste.length === 0;
  const istAuto = zeile?.closest('#vp-woche-automatisch') != null;
  hebeTagHervor(zeile && istAuto ? gewaehlt : null);
  if (!zeile || !artikel) return;

  zeile.classList.add('vp-gewaehlt');
  zeile.querySelector('.vp-woche-waehlen')?.setAttribute('aria-current', 'true');
  const nr = liste.indexOf(zeile) + 1;
  const wann = zeile.dataset['wann'] ?? '';
  const kopf = wort('ansicht.tagVon', { n: String(nr), m: String(liste.length) });

  $('vp-tag-wann')!.textContent = /^\D+ \d+$/.test(wann) ? kopf : `${kopf} · ${wann}`;
  $('vp-tag-route')!.textContent = zeile.dataset['route'] ?? '';
  const lage = zeile.querySelector('.vp-woche-lage');
  const lageZiel = $('vp-tag-lage')!;
  lageZiel.className = `vp-tag-lage ${[...(lage?.classList ?? [])].filter((c) => c.startsWith('vp-lage-')).join(' ')}`;
  lageZiel.innerHTML = lage?.innerHTML ?? '';
  lageZiel.hidden = !lage?.textContent?.trim();

  const hafentag = zeile.classList.contains('vp-woche-hafentag');
  const fakten: [string, string][] = hafentag
    ? [[wort('ansicht.faktLiegeplatz'), zeile.dataset['ort'] ?? ''], [wort('ansicht.faktWind'), zellText(zeile.querySelector('.vp-woche-wind'))]]
    : [
      [wort('ansicht.faktAblegen'), zellText(zeile.querySelector('.vp-woche-ablegen'))],
      [wort('ansicht.faktFahrzeit'), zellText(zeile.querySelector('.vp-woche-dauer'))],
      [wort('ansicht.faktDistanz'), zellText(zeile.querySelector('.vp-woche-sm'))],
      [wort('ansicht.faktWind'), zellText(zeile.querySelector('.vp-woche-wind'))],
    ];
  $('vp-tag-fakten')!.innerHTML = fakten
    .map(([t, v]) => `<div><dt>${escapeHtml(t)}</dt><dd>${escapeHtml(v || '–')}</dd></div>`).join('');

  const mehr = zeile.querySelector('.vp-woche-mehr');
  const warum = $('vp-tag-warum')!;
  warum.innerHTML = '';
  if (mehr) {
    for (const kind of mehr.children) {
      if (kind.matches('details.vp-woche-warum')) {
        for (const teil of kind.querySelectorAll(':scope > p, :scope > .vp-zitat')) warum.append(teil.cloneNode(true));
      } else if (!kind.matches('.vp-eingriff')) {
        warum.append(kind.cloneNode(true));
      }
    }
  }
  $('vp-tag-warum-block')!.hidden = warum.childElementCount === 0;

  const link = zeile.querySelector<HTMLAnchorElement>('a.vp-woche-coursecast');
  const tp = $('vp-tag-tagesplanung') as HTMLAnchorElement;
  tp.hidden = !link;
  if (link) tp.href = link.href;

  const eingriff = zeile.querySelector('.vp-eingriff');
  $('vp-tag-eingriff')!.hidden = !eingriff;
  const tauschen = $('btn-tag-tauschen')!;
  const kannTauschen = !!eingriff && eingriff.querySelectorAll('[data-aktion]').length > 1;
  tauschen.hidden = !kannTauschen;
  const feld = $('vp-tag-tauschen')!;
  if (!kannTauschen) { feld.hidden = true; tauschen.setAttribute('aria-expanded', 'false'); }
  if (eingriff && kannTauschen) {

    const kopie = eingriff.cloneNode(true) as HTMLElement;
    kopie.querySelector('[data-aktion="festlegen"]')?.remove();
    kopie.removeAttribute('class');
    feld.replaceChildren(...kopie.childNodes);
  }
  const handplan = $('btn-vorschlag-in-handplan');
  $('btn-tag-handplan')!.hidden = !istAuto || !handplan || handplan.hidden;
}

function loeseImOriginalAus(knopf: HTMLElement): void {
  const zeile = zeilen().find((z) => z.dataset['tag'] === String(gewaehlt));
  if (!zeile) return;
  const aktion = knopf.dataset['aktion'];
  const knoten = knopf.dataset['knoten'];
  const original = [...zeile.querySelectorAll<HTMLElement>(`.vp-eingriff [data-aktion="${aktion}"]`)]
    .find((o) => knoten == null || o.dataset['knoten'] === knoten);
  if (aktion === 'umlegen') {
    const auswahl = $('vp-tag-tauschen')?.querySelector<HTMLSelectElement>('select');
    const ziel = zeile.querySelector<HTMLSelectElement>('.vp-eingriff select');
    if (auswahl && ziel) ziel.value = auswahl.value;
  }
  original?.click();
}

function blaettere(richtung: 1 | -1): void {
  const liste = zeilen();
  const i = liste.findIndex((z) => z.dataset['tag'] === String(gewaehlt));
  const neu = liste[begrenze(i + richtung, 0, liste.length - 1)];
  if (neu) waehleTag(Number(neu.dataset['tag']));
}

function nachPlanAenderung(): void {
  const auto = $('vp-woche-automatisch');
  const kennzahlen = auto?.querySelector('.vp-woche-kennzahlen');
  const kopf = $('vp-toernplan-kennzahlen');
  if (kopf) {
    kopf.innerHTML = kennzahlen?.innerHTML ?? '';
    kopf.hidden = !kennzahlen || $('panel-woche-auto')?.hidden === true;
  }

  if (zeilen(auto).length === 0 && (zeilen($('vp-wochentabelle')).length > 0 || hatHandEtappen()) && $('panel-woche-hand')?.hidden && !rechnet) {
    zeigeWochenReiter('hand');
  }
  const anzahl = zeilen().length;
  if (anzahl > 0 && letzteZeilenzahl === 0 && (gewaehlt == null || !zeilen().some((z) => z.dataset['tag'] === String(gewaehlt)))) {
    gewaehlt = Number(zeilen()[0]!.dataset['tag']);
  }
  letzteZeilenzahl = anzahl;
  aktualisiere();
}

function beobachteRechnung(): void {
  const lade = $('vp-lade-anzeige');
  const status = $('vp-automatik-status');
  const spiegel = (): void => {
    const satz = status?.textContent ?? '';
    const a = $('vp-lade-stand');
    const b = $('vp-plan-rechnet-stand');
    if (a) a.textContent = satz;
    if (b) b.textContent = satz;
  };
  const pruefe = (): void => {
    const jetzt = !!lade && !lade.hidden;
    if (jetzt === rechnet) return;
    rechnet = jetzt;

    status?.classList.toggle('vp-sr-only', rechnet);
    if (rechnet) { ansicht = 'plan'; gewaehlt = null; letzteZeilenzahl = 0; }
    spiegel();
    aktualisiere();
  };
  if (lade) new MutationObserver(pruefe).observe(lade, { attributes: true, attributeFilter: ['hidden'] });
  if (status) new MutationObserver(spiegel).observe(status, { childList: true, characterData: true, subtree: true });
  pruefe();
}

const liegeplaetze = new Map<string, Hafenknoten>();
const geladeneGebiete = new Set<string>();
let ladeZeit = 0;

function aktuelleListe() { return option === 2 && zweiteAktiv() ? wunschlisteZwei : wunschlisteEins; }

function zeichneVorgaben(): void {
  vorgabenEbene.clearLayers();
  if (!karte || ansicht !== 'vorgaben') return;
  const groesse = karte.getSize();
  const seite = (ll: L.LatLng): 'left' | 'right' => (karte!.latLngToContainerPoint(ll).x > groesse.x * 0.62 ? 'left' : 'right');
  const tooltip = (m: L.Marker, name: string, dauerhaft: boolean): void => {
    const richtung = seite(m.getLatLng());
    m.bindTooltip(escapeHtml(name), { className: 'vp-tip', direction: richtung, offset: [richtung === 'left' ? -12 : 12, 0], permanent: dauerhaft });
  };
  const zustand = aktuelleListe().liesZustand();
  const ziele = [...zustand.wunschziele, ...(zustand.endziel ? [zustand.endziel] : [])];
  const istZiel = (lat: number, lon: number): boolean =>
    ziele.some((z) => Math.abs(z.ort.lat - lat) < 0.0008 && Math.abs(z.ort.lon - lon) < 0.0008);
  const darf = !app.nurLesen;
  const schalte = (ort: { lat: number; lon: number }, name: string): void => {
    if (!darf) return;
    aktuelleListe().schalteWunschziel(ort, name);
    if (offen !== 'ziele') oeffneAbschnitt('ziele');
  };

  const grenzen = karte.getBounds().pad(0.1);
  let n = 0;
  for (const k of liegeplaetze.values()) {
    if (n >= LIEGEPLATZ_HOECHSTENS) break;
    if (!grenzen.contains([k.ort.lat, k.ort.lon]) || istZiel(k.ort.lat, k.ort.lon)) continue;
    n++;
    const m = L.marker([k.ort.lat, k.ort.lon], {
      icon: L.divIcon({ className: 'vp-punkt-liegeplatz', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
      keyboard: false,
    }).addTo(vorgabenEbene);
    tooltip(m, k.name, false);
    m.on('click', () => schalte(k.ort, k.name));
  }
  for (const z of ziele) {
    const m = L.marker([z.ort.lat, z.ort.lon], {
      icon: L.divIcon({ className: 'vp-punkt-wunsch', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      zIndexOffset: 500, keyboard: false,
    }).addTo(vorgabenEbene);
    tooltip(m, z.name, true);
    m.on('click', () => schalte(z.ort, z.name));
  }
  const start = app.toern?.start_hafen;
  const rueck = app.toern?.rueckgabe_hafen;
  const gleich = !!start && !!rueck && Math.abs(start.lat - rueck.lat) < 0.0008 && Math.abs(start.lon - rueck.lon) < 0.0008;
  const quadrat = (h: { lat: number; lon: number }, buchstabe: string, name: string): void => {
    const m = L.marker([h.lat, h.lon], {
      icon: L.divIcon({ className: 'vp-punkt-start', html: `<span>${buchstabe}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      zIndexOffset: 1000, keyboard: false, interactive: true,
    }).addTo(vorgabenEbene);
    tooltip(m, name, true);
  };
  if (start) quadrat(start, 'S', wort(gleich || !rueck ? 'karte.startRueckgabe' : 'karte.start'));
  if (rueck && !gleich) quadrat(rueck, 'R', wort('karte.rueckgabe'));
}

function ladeLiegeplaetze(): void {
  if (!karte || ansicht !== 'vorgaben' || karte.getZoom() < LIEGEPLATZ_ZOOM) return;
  const b = karte.getBounds();
  if (b.getNorth() - b.getSouth() > LIEGEPLATZ_MAX_GRAD || b.getEast() - b.getWest() > LIEGEPLATZ_MAX_GRAD) return;
  const r = (x: number, auf: boolean): number => (auf ? Math.ceil(x * 4) : Math.floor(x * 4)) / 4;
  const box = { swLat: r(b.getSouth(), false), swLon: r(b.getWest(), false), neLat: r(b.getNorth(), true), neLon: r(b.getEast(), true) };
  const schluessel = `${box.swLat},${box.swLon},${box.neLat},${box.neLon}`;
  if (geladeneGebiete.has(schluessel)) return;
  geladeneGebiete.add(schluessel);
  const mitte = b.getCenter();
  const lauf = ++ladeZeit;
  void holeKandidatenknotenImGebiet(box, [{ lat: mitte.lat, lon: mitte.lng }]).then((knoten) => {
    for (const k of knoten) liegeplaetze.set(`${k.name}|${k.ort.lat.toFixed(4)}|${k.ort.lon.toFixed(4)}`, k);
    if (lauf === ladeZeit) zeichneVorgaben();
  }).catch(() => { geladeneGebiete.delete(schluessel); });
}

let letzterAusschnitt = '';

function modus(): 'plan' | 'vorgaben' {
  return ansicht === 'plan' && !rechnet && (planEbenen?.getLayers().length ?? 0) > 0 ? 'plan' : 'vorgaben';
}

function stelleKarteEin(): void {
  if (!karte) return;
  const zeigtPlan = ansicht === 'plan';
  if (planEbenen) {
    if (zeigtPlan && !karte.hasLayer(planEbenen)) planEbenen.addTo(karte);
    if (!zeigtPlan && karte.hasLayer(planEbenen)) karte.removeLayer(planEbenen);
  }
  if (!zeigtPlan && !karte.hasLayer(vorgabenEbene)) vorgabenEbene.addTo(karte);
  if (zeigtPlan && karte.hasLayer(vorgabenEbene)) karte.removeLayer(vorgabenEbene);
  zeichneVorgaben();
  passeEin(false);
}

export function passeEin(erzwingen: boolean): void {
  if (!karte) return;
  const g = karte.getSize();
  if (g.x < 50 || g.y < 50) return;
  const m = modus();
  const schluessel = `${m}|${g.x}x${g.y}`;
  if (!erzwingen && schluessel === letzterAusschnitt) return;
  letzterAusschnitt = schluessel;
  if (m === 'plan' && planEbenen) { passeAusschnittAn(karte, planEbenen); return; }
  const punkte: [number, number][] = [];
  const t = app.toern;
  if (t?.start_hafen) punkte.push([t.start_hafen.lat, t.start_hafen.lon]);
  if (t?.rueckgabe_hafen) punkte.push([t.rueckgabe_hafen.lat, t.rueckgabe_hafen.lon]);
  const z = aktuelleListe().liesZustand();
  for (const w of z.wunschziele) punkte.push([w.ort.lat, w.ort.lon]);
  if (z.endziel) punkte.push([z.endziel.ort.lat, z.endziel.ort.lon]);
  if (punkte.length === 0) return;
  const grenzen = L.latLngBounds(punkte);
  if (punkte.length === 1 || grenzen.getNorthEast().distanceTo(grenzen.getSouthWest()) < 2000) {
    karte.setView(grenzen.getCenter(), 11, { animate: false });
  } else {
    karte.fitBounds(grenzen, { ...kartenRaender(karte), maxZoom: 12, animate: false });
  }
}

function zeichneLegende(): void {
  const eintraege: [string, string][] = modus() === 'plan'
    ? [['uebernachtung', 'legende.uebernachtung'], ['gewaehlt', 'legende.gewaehlt'], ['route', 'legende.route']]
    : [['start', 'legende.start'], ['wunsch', 'legende.wunschziel'], ['liegeplatz', 'legende.liegeplatz']];
  const html = eintraege.map(([k, s]) => `<span class="vp-legende-eintrag"><span class="vp-legende-zeichen vp-legende-${k}"></span>${escapeHtml(wort(s))}</span>`).join('');
  for (const id of ['vp-legende-karte', 'vp-legende-zeile']) {
    const el = $(id);
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }
}

function initGriffe(): void {
  const p = plan();
  const links = $('vp-links');
  const feld = $('vp-kartenfeld');
  const spalte = $('vp-griff-spalte');
  const zeile = $('vp-griff-zeile');
  if (!p || !links || !feld || !spalte || !zeile) return;

  const seiteLinks = (): boolean => p.classList.contains('vp-seite-links');
  const setzeBreite = (b: number, speichern: boolean): void => {
    const w = begrenze(Math.round(b), SEITE_MIN, Math.min(SEITE_MAX, window.innerWidth - 360));
    p.style.setProperty('--vp-seite-breite', `${w}px`);
    spalte.setAttribute('aria-valuenow', String(w));
    if (speichern) merke(SCHLUESSEL.planSeitenbreite, String(w));
  };
  const maxHoehe = (): number => links.clientHeight - PLAN_MIN;
  const setzeHoehe = (h: number, speichern: boolean): void => {
    const v = begrenze(Math.round(h), KARTE_MIN, maxHoehe());
    p.style.setProperty('--vp-karten-hoehe', `${v}px`);
    p.dataset['kartenHoehe'] = '';
    zeile.setAttribute('aria-valuenow', String(v));
    zeile.setAttribute('aria-valuemax', String(Math.max(KARTE_MIN, Math.round(maxHoehe()))));
    if (speichern) merke(SCHLUESSEL.planKartenhoehe, String(v));
  };
  setzeBreite(Number(lies(SCHLUESSEL.planSeitenbreite)) || SEITE_VORGABE, false);
  const h0 = Number(lies(SCHLUESSEL.planKartenhoehe));
  if (h0 > 0) requestAnimationFrame(() => setzeHoehe(h0, false));

  const ziehen = (griff: HTMLElement, art: 'breite' | 'hoehe'): void => {
    let raf = 0;
    const bewegen = (e: PointerEvent): void => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (art === 'breite') {
          const r = p.getBoundingClientRect();
          setzeBreite(seiteLinks() ? e.clientX - r.left : r.right - e.clientX, false);
        } else {
          setzeHoehe(e.clientY - feld.getBoundingClientRect().top, false);
        }
      });
    };
    const ende = (): void => {
      griff.classList.remove('dragging');
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
      if (art === 'breite') merke(SCHLUESSEL.planSeitenbreite, griff.getAttribute('aria-valuenow') ?? '');
      else merke(SCHLUESSEL.planKartenhoehe, griff.getAttribute('aria-valuenow') ?? '');
    };
    griff.addEventListener('pointerdown', (e) => {
      if (!BREIT.matches || (e.button !== 0 && e.pointerType === 'mouse')) return;
      e.preventDefault();
      griff.classList.add('dragging');
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', bewegen);
      window.addEventListener('pointerup', ende);
      window.addEventListener('pointercancel', ende);
    });

    griff.addEventListener('keydown', (e) => {
      const d = art === 'breite'
        ? (e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0) * (seiteLinks() ? -1 : 1)
        : (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      if (art === 'breite') setzeBreite(Number(griff.getAttribute('aria-valuenow')) + d * TASTENSCHRITT, true);
      else setzeHoehe(feld.getBoundingClientRect().height + d * TASTENSCHRITT, true);
    });
  };
  ziehen(spalte, 'breite');
  ziehen(zeile, 'hoehe');
  window.addEventListener('resize', () => {
    if (p.dataset['kartenHoehe'] !== undefined) setzeHoehe(feld.getBoundingClientRect().height, false);
  });
}

function initEinstellungen(): void {
  const p = plan();
  const links = $('in-menu-seite-links') as HTMLInputElement | null;
  const marken = $('in-menu-seezeichen') as HTMLInputElement | null;
  const setzeSeite = (an: boolean): void => { p?.classList.toggle('vp-seite-links', an); };
  const setzeMarken = (an: boolean): void => {
    if (!karte || !seezeichen) return;
    if (an && !karte.hasLayer(seezeichen)) seezeichen.addTo(karte);
    if (!an && karte.hasLayer(seezeichen)) karte.removeLayer(seezeichen);
  };
  const seite = lies(SCHLUESSEL.planSeiteLinks) === '1';
  const zeichen = lies(SCHLUESSEL.planSeezeichen) !== '0';
  if (links) links.checked = seite;
  if (marken) marken.checked = zeichen;
  setzeSeite(seite);
  setzeMarken(zeichen);
  links?.addEventListener('change', () => { setzeSeite(links.checked); merke(SCHLUESSEL.planSeiteLinks, links.checked ? '1' : '0'); });
  marken?.addEventListener('change', () => { setzeMarken(marken.checked); merke(SCHLUESSEL.planSeezeichen, marken.checked ? '1' : '0'); });
}

export function toernGeladen(mitEtappen: boolean): void {
  if (mitEtappen) ansicht = 'plan';
  aktualisiereSummen();
  aktualisiere();
  zeichneVorgaben();
  passeEin(true);
}

export function initVollbild(k: L.Map | null, ebenen: L.LayerGroup | null, seekarte: L.TileLayer | null): void {
  karte = k;
  planEbenen = ebenen;
  seezeichen = seekarte;
  const p = plan();
  if (!p) return;

  new MutationObserver(() => document.body.classList.toggle('vp-plan-offen', !p.hidden))
    .observe(p, { attributes: true, attributeFilter: ['hidden'] });

  $('tab-ansicht-vorgaben')?.addEventListener('click', () => zeigeAnsicht('vorgaben'));
  $('tab-ansicht-plan')?.addEventListener('click', () => zeigeAnsicht('plan'));
  $('btn-zum-plan')?.addEventListener('click', () => zeigeAnsicht('plan'));
  $('btn-neu-vorschlagen')?.addEventListener('click', () => $('btn-plan-vorschlagen')?.click());
  for (const id of ['btn-neue-etappe', 'btn-neuer-hafentag']) $(id)?.addEventListener('click', () => zeigeAnsicht('plan'));

  for (const a of ['rahmen', 'ziele', 'regeln'] as const) {
    $(`btn-abschnitt-${a}`)?.addEventListener('click', () => oeffneAbschnitt(offen === a ? null : a));
  }
  p.querySelectorAll<HTMLElement>('[data-oeffne]').forEach((k) => k.addEventListener('click', () => {
    const ziel = k.dataset['oeffne'] as Abschnitt;
    oeffneAbschnitt(ziel);
    $(`btn-abschnitt-${ziel}`)?.focus();
  }));

  $('btn-option-1')?.addEventListener('click', () => { option = 1; aktualisiereSummen(); zeichneVorgaben(); });
  $('btn-option-2')?.addEventListener('click', () => { option = 2; aktualisiereSummen(); zeichneVorgaben(); });
  const zweite = $('vp-wunschliste-2');
  if (zweite) {
    new MutationObserver(() => { option = zweiteAktiv() ? 2 : 1; aktualisiereSummen(); zeichneVorgaben(); })
      .observe(zweite, { attributes: true, attributeFilter: ['hidden'] });
  }

  const art = $('in-planungsart') as HTMLSelectElement | null;
  for (const k of document.querySelectorAll<HTMLButtonElement>('#vp-art-segment [data-art]')) {
    k.addEventListener('click', () => {
      if (!art || art.disabled || art.value === k.dataset['art']) return;
      art.value = k.dataset['art']!;
      art.dispatchEvent(new Event('change', { bubbles: true }));
      aktualisiereSummen();
    });
  }

  p.addEventListener('click', (e) => {
    const knopf = (e.target as HTMLElement).closest<HTMLButtonElement>('.vp-stepper button[data-schritt]');
    if (!knopf) return;
    const feld = knopf.parentElement?.querySelector<HTMLInputElement>('input[type="number"]');
    if (!feld || feld.disabled) return;
    if (knopf.dataset['schritt'] === '1') feld.stepUp(); else feld.stepDown();
    feld.dispatchEvent(new Event('input', { bubbles: true }));
    feld.dispatchEvent(new Event('change', { bubbles: true }));
  });

  $('vp-automatik')?.addEventListener('click', (e) => {
    const ziel = e.target as HTMLElement;
    if (ziel.closest('a, .vp-woche-mehr, select, input')) return;
    const zeile = ziel.closest<HTMLElement>('.vp-woche-zeile');
    if (zeile?.closest('#vp-woche-automatisch, #vp-wochentabelle')) waehleTag(Number(zeile.dataset['tag']), true);
  });
  setzeTagWahl((tag) => { if ($('panel-woche-auto')?.hidden === false) waehleTag(tag, true); });
  $('btn-tag-zurueck')?.addEventListener('click', () => blaettere(-1));
  $('btn-tag-weiter')?.addEventListener('click', () => blaettere(1));
  $('btn-tag-fest')?.addEventListener('click', () => {
    const zeile = zeilen().find((z) => z.dataset['tag'] === String(gewaehlt));
    zeile?.querySelector<HTMLElement>('.vp-eingriff [data-aktion="festlegen"]')?.click();
  });
  $('btn-tag-tauschen')?.addEventListener('click', () => {
    const feld = $('vp-tag-tauschen');
    const knopf = $('btn-tag-tauschen');
    if (!feld || !knopf) return;
    feld.hidden = !feld.hidden;
    knopf.setAttribute('aria-expanded', String(!feld.hidden));
  });
  $('vp-tag-tauschen')?.addEventListener('click', (e) => {
    const knopf = (e.target as HTMLElement).closest<HTMLElement>('[data-aktion]');
    if (knopf) loeseImOriginalAus(knopf);
  });
  $('btn-tag-handplan')?.addEventListener('click', () => $('btn-vorschlag-in-handplan')?.click());

  const summen = new MutationObserver(() => { aktualisiereSummen(); zeichneVorgaben(); });
  for (const id of ['vp-start-wert', 'vp-rueckgabe-wert', 'vp-chipliste', 'vp-chipliste-2', 'chip-endziel-name', 'chip-endziel-name-2']) {
    const el = $(id);
    if (el) summen.observe(el, { childList: true, characterData: true, subtree: true });
  }
  p.addEventListener('input', aktualisiereSummen);
  p.addEventListener('change', aktualisiereSummen);
  const planBeobachter = new MutationObserver(nachPlanAenderung);
  for (const id of ['vp-woche-automatisch', 'vp-wochentabelle', 'vp-etappenliste']) {
    const el = $(id);
    if (el) planBeobachter.observe(el, { childList: true });
  }
  for (const id of ['panel-woche-auto', 'panel-woche-hand', 'btn-vorschlag-in-handplan']) {
    const el = $(id);
    if (el) planBeobachter.observe(el, { attributes: true, attributeFilter: ['hidden'] });
  }

  const briefing = $('vp-briefing-aktionen');
  const teilen = $('btn-share');
  if (briefing && teilen) {
    const sync = (): void => { teilen.hidden = briefing.hidden; };
    new MutationObserver(sync).observe(briefing, { attributes: true, attributeFilter: ['hidden'] });
    sync();
  }

  beobachteRechnung();
  initGriffe();
  initEinstellungen();
  BREIT.addEventListener('change', () => aktualisiere());

  if (karte) {

    const feld = $('vp-kartenfeld');
    if (feld) {
      new ResizeObserver(() => requestAnimationFrame(() => {
        karte?.invalidateSize({ animate: false });
        passeEin(false);
      })).observe(feld);
    }
    let warte = 0;
    karte.on('moveend', () => {
      zeichneVorgaben();
      window.clearTimeout(warte);
      warte = window.setTimeout(ladeLiegeplaetze, 600);
    });
  }

  oeffneAbschnitt(offen);
  aktualisiereSummen();
}
