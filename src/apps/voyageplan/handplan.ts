import L from 'leaflet';
import { aktuelleSprache } from '@/shell/sprache';
import type { WochentabellenZeile } from './plan';
import { liesSitzungsToken } from '@/shell/session';
import { bindeOrtsAutocomplete } from '@/ui/ortsAutocomplete';
import {
  schreibeEtappen, type EtappeDaten, type EtappenWegpunkt,
} from '@/data/toernApi';
import { berechneWochentabelle, renderWochentabelle, type WochentabellenEtappe } from './plan';
import { baueEtappenkettenGpx, gpxDateiname } from './gpxExport';
import {
  app, wort, $, aktualisiereWunschlistenKontext, toernBeschreibung, standardSchiffConfig, planungJetzt,
  type EtappeEntwurf,
} from './kontext';
import { escapeHtml } from '@/core/html';
import {
  ankunftsTag, naechteUnterwegs, sortiereEtappen, alsNeueEtappe, ausNeuerEtappe, hafentagVorschlag,
} from './handplanUmbau';

let gespeicherteSchicht: L.LayerGroup | null = null;
let zeichnenSchicht: L.LayerGroup | null = null;
let zeichnenPunkte: EtappenWegpunkt[] = [];

let bearbeiteId: string | null = null;

function bearbeiteIndex(): number | null {
  if (bearbeiteId === null) return null;
  const i = app.etappen.findIndex((x) => x.id === bearbeiteId);
  return i >= 0 ? i : null;
}
let amZeichnen = false;

let zeichnenArt: 'fahrt' | 'hafentag' = 'fahrt';
const mindestPunkte = (): number => (zeichnenArt === 'hafentag' ? 1 : 2);

function neueEtappeId(): string {
  return `etappe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function zeichneGespeicherteEtappen(): void {
  if (!gespeicherteSchicht) return;
  const schicht = gespeicherteSchicht;
  schicht.clearLayers();
  app.etappen.forEach((e) => {
    if (e.id === bearbeiteId) return;
    const latlngs = e.wegpunkte.map((p) => [p.lat, p.lon] as [number, number]);
    L.polyline(latlngs, { color: 'var(--teal, #2a7f7a)', weight: 3 }).addTo(schicht);
    latlngs.forEach((ll, j) => {
      L.circleMarker(ll, { radius: 5, color: 'var(--teal, #2a7f7a)', fillOpacity: 1 })

        .bindTooltip(escapeHtml(j === latlngs.length - 1 ? e.nachName || '·' : j === 0 ? e.vonName || '·' : ''))
        .addTo(schicht);
    });
  });
}

function zeichneEntwurf(): void {
  if (!zeichnenSchicht) return;
  const schicht = zeichnenSchicht;
  schicht.clearLayers();
  if (zeichnenPunkte.length === 0) return;
  const latlngs = zeichnenPunkte.map((p) => [p.lat, p.lon] as [number, number]);
  if (latlngs.length > 1) {
    L.polyline(latlngs, { color: 'var(--amber, #c8862a)', weight: 3, dashArray: '6 6' }).addTo(schicht);
  }
  latlngs.forEach((ll) => {
    L.circleMarker(ll, { radius: 5, color: 'var(--amber, #c8862a)', fillOpacity: 1 }).addTo(schicht);
  });
}

export function setzeZeichenWerkzeuge(): void {
  const neu = $('btn-neue-etappe') as HTMLButtonElement | null;
  const zurueck = $('btn-punkt-zurueck');
  const abbrechen = $('btn-zeichnen-abbrechen');
  const hinweis = $('vp-zeichnen-hinweis');
  const formular = $('vp-etappen-formular');
  const hafentag = $('btn-neuer-hafentag');
  const istHafentag = zeichnenArt === 'hafentag';
  if (neu) neu.hidden = amZeichnen || app.nurLesen;
  if (hafentag) hafentag.hidden = amZeichnen || app.nurLesen;
  if (zurueck) zurueck.hidden = !amZeichnen || istHafentag;
  if (abbrechen) abbrechen.hidden = !amZeichnen;
  if (hinweis) {
    hinweis.hidden = !amZeichnen || zeichnenPunkte.length >= mindestPunkte();
    hinweis.textContent = wort(istHafentag ? 'karte.hinweisHafentag' : 'karte.hinweisZeichnen');
  }
  if (formular) formular.hidden = !amZeichnen || zeichnenPunkte.length < mindestPunkte();
  const nurFahrt = $('vp-formular-fahrt');
  if (nurFahrt) nurFahrt.hidden = istHafentag;
  const vonFeld = $('vp-formular-von');
  if (vonFeld) vonFeld.hidden = istHafentag;
  const titel = $('vp-formular-titel');
  if (titel) titel.textContent = wort(istHafentag ? 'formular.titelHafentag' : 'formular.titel');
  const nachLabel = $('vp-formular-nach-label');
  if (nachLabel) nachLabel.textContent = wort(istHafentag ? 'formular.ort' : 'formular.nach');
  if (amZeichnen && zeichnenPunkte.length >= mindestPunkte()) {
    const wegpunkteText = $('vp-formular-wegpunkte');
    if (wegpunkteText) {
      wegpunkteText.textContent = istHafentag ? wort('formular.hafentagOrt') : wort('formular.wegpunkte', { n: String(zeichnenPunkte.length) });
    }
  }
}

function feld(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}

function beginneZeichnen(vorbefuellung?: EtappeEntwurf): void {
  amZeichnen = true;
  zeichnenArt = vorbefuellung?.art ?? 'fahrt';
  for (const [id, wert] of [
    ['in-etappe-ablegen', vorbefuellung?.abfahrtZeit], ['in-etappe-ankunft-datum', vorbefuellung?.ankunftDatum],
    ['in-etappe-ankunft-zeit', vorbefuellung?.ankunftZeit],
  ] as const) {
    const el = feld(id);
    if (el) el.value = wert ?? '';
  }
  const fehler = $('vp-formular-fehler');
  if (fehler) fehler.textContent = '';
  zeichnenPunkte = vorbefuellung ? [...vorbefuellung.wegpunkte] : [];
  (document.getElementById('in-etappe-von') as HTMLInputElement | null)!.value = vorbefuellung?.vonName ?? '';
  (document.getElementById('in-etappe-nach') as HTMLInputElement | null)!.value = vorbefuellung?.nachName ?? '';
  (document.getElementById('in-etappe-datum') as HTMLInputElement | null)!.value = vorbefuellung?.datum ?? '';
  (document.getElementById('in-etappe-notiz') as HTMLInputElement | null)!.value = vorbefuellung?.notiz ?? '';
  const fixiertBox = document.getElementById('in-etappe-fixiert') as HTMLInputElement | null;
  if (fixiertBox) fixiertBox.checked = vorbefuellung?.fixiert ?? false;
  zeichneEntwurf();
  zeichneGespeicherteEtappen();
  setzeZeichenWerkzeuge();
}

function beendeZeichnen(): void {
  amZeichnen = false;
  bearbeiteId = null;
  zeichnenPunkte = [];
  zeichneEntwurf();
  zeichneGespeicherteEtappen();
  setzeZeichenWerkzeuge();
}

function kurzDatum(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(aktuelleSprache() === 'en' ? 'en-GB' : 'de-AT', {
    weekday: 'short', day: '2-digit', month: '2-digit',
  });
}

function etappenDetail(e: EtappeEntwurf): string {
  if (!e.datum) return `${wort('liste.ohneDatum')} · ${wort('liste.wegpunkte', { n: String(e.wegpunkte.length) })}`;
  if (e.art === 'hafentag') return `${kurzDatum(e.datum)} · ${wort('liste.hafentag')}`;
  const teile = [kurzDatum(e.datum)];
  if (e.abfahrtZeit) teile.push(wort('liste.ablegen', { zeit: e.abfahrtZeit }));
  const n = naechteUnterwegs(e);
  if (n > 0 || e.ankunftZeit) {
    teile.push(wort('liste.ankunft', { tag: n > 0 ? kurzDatum(e.ankunftDatum!) : '', zeit: e.ankunftZeit ?? '' }).replace(/\s+/g, ' ').trim());
  }
  if (n === 1) teile.push(wort('liste.nachtfahrt'));
  else if (n > 1) teile.push(wort('liste.naechteUnterwegs', { n: String(n) }));
  teile.push(wort('liste.wegpunkte', { n: String(e.wegpunkte.length) }));
  return teile.join(' · ');
}

export function setzeHandplan(etappen: readonly EtappeEntwurf[]): void {
  app.etappen = sortiereEtappen(etappen);
  renderListe();
}

export async function speichereHandplan(): Promise<boolean> {
  const token = liesSitzungsToken();
  const toernId = app.toern?.id;
  if (!token || !toernId || app.nurLesen) return false;
  const status = $('vp-plan-status');
  if (status) status.textContent = wort('plan.speichertGerade');
  const ok = await schreibeEtappen(token, toernId, app.etappen.map((e, i) => alsNeueEtappe(e, i)));
  if (status) status.textContent = wort(ok ? 'plan.gespeichert' : 'plan.fehler');
  return ok;
}

export function renderListe(): void {
  const liste = $('vp-etappenliste');
  const leer = $('vp-liste-leer');
  if (!liste) return;
  liste.innerHTML = '';
  if (leer) leer.hidden = app.etappen.length > 0;
  app.etappen.forEach((e, i) => {
    const li = document.createElement('li');
    li.className = 'vp-etappen-zeile';
    const namen = [e.vonName || '?', e.nachName || '?'].join(' → ');
    li.innerHTML = `
      <span class="vp-etappen-nummer">${i + 1}</span>
      <span class="vp-etappen-info">
        <span class="vp-etappen-namen">${escapeHtml(e.art === 'hafentag' ? wort('liste.hafentagIn', { ort: e.nachName || '?' }) : namen)}</span>
        <span class="vp-etappen-detail">${escapeHtml(etappenDetail(e))}</span>
      </span>
    `;
    if (!app.nurLesen) {
      const bearbeiten = document.createElement('button');
      bearbeiten.type = 'button';
      bearbeiten.className = 'btn';
      bearbeiten.textContent = wort('liste.bearbeiten');
      bearbeiten.addEventListener('click', () => { bearbeiteId = e.id; beginneZeichnen(e); });
      const loeschen = document.createElement('button');
      loeschen.type = 'button';
      loeschen.className = 'btn danger';
      loeschen.textContent = wort('liste.loeschen');
      loeschen.addEventListener('click', () => {
        app.etappen.splice(i, 1);
        renderListe();
        zeichneGespeicherteEtappen();
      });
      li.append(bearbeiten, loeschen);
    }
    liste.appendChild(li);
  });
  zeichneGespeicherteEtappen();
  aktualisiereWunschlistenKontext();
  setzeGpxExportKnopf();
}

function setzeGpxExportKnopf(): void {
  const knopf = $('btn-plan-gpx-export') as HTMLButtonElement | null;
  if (!knopf) return;
  const gesamtPunkte = app.etappen.reduce((n, e) => n + e.wegpunkte.length, 0);
  knopf.disabled = gesamtPunkte < 2;
}

export function fixierungenFuerRechner(startDatumIso: string): { tag: number; ort: EtappenWegpunkt; name: string }[] {
  const start = new Date(`${startDatumIso}T00:00:00`).getTime();
  return app.etappen.flatMap((e) => {
    const ziel = e.wegpunkte[e.wegpunkte.length - 1];
    const ende = ankunftsTag(e);
    if (!e.fixiert || !ende || !ziel) return [];

    const tag = Math.round((new Date(`${ende}T00:00:00`).getTime() - start) / 86_400_000) + 1;
    if (tag < 1) return [];
    return [{ tag, ort: ziel, name: e.nachName || e.vonName || '?' }];
  });
}

export function ausServerdaten(e: EtappeDaten): EtappeEntwurf {
  return ausNeuerEtappe({
    id: e.id, nummer: e.nummer, vonName: e.von_name, nachName: e.nach_name, datum: e.datum,
    notiz: e.notiz, wegpunkte: e.wegpunkte, fixiert: e.fixiert, gewaehlt: e.gewaehlt,
    ...(e.art ? { art: e.art } : {}),
    abfahrtZeit: e.abfahrt_zeit ?? null, ankunftDatum: e.ankunft_datum ?? null, ankunftZeit: e.ankunft_zeit ?? null,
  });
}

let letzteWochenzeilen: readonly WochentabellenZeile[] | null = null;
export function wochentabelleNeuZeichnen(): void {
  if (letzteWochenzeilen) renderWochentabelle(letzteWochenzeilen, aktuelleSprache());
}

async function wochentabelleNeuBerechnen(): Promise<void> {
  if (!app.toern) return;
  const box = $('vp-wochentabelle');
  const status = $('vp-woche-status');
  const datiert: WochentabellenEtappe[] = app.etappen
    .filter((e): e is EtappeEntwurf & { datum: string } => e.datum != null)
    .map((e) => ({
      id: e.id, vonName: e.vonName, nachName: e.nachName, datum: e.datum, wegpunkte: e.wegpunkte,
      ...(e.art === 'hafentag' ? { hafentag: true } : {}),
      ...(e.abfahrtZeit ? { abfahrtZeit: e.abfahrtZeit } : {}),
      ...(e.ankunftDatum ? { ankunftDatum: e.ankunftDatum } : {}),
    }));

  if (datiert.length === 0) {
    letzteWochenzeilen = [];
    if (box) renderWochentabelle([], aktuelleSprache());
    return;
  }
  if (status) status.textContent = wort('woche.rechnet');
  if (box) box.setAttribute('aria-busy', 'true');
  try {
    const zeilen = await berechneWochentabelle(
      datiert, standardSchiffConfig(app.toern), planungJetzt().grenzwerte,
      'buergerlich', 30, 1, aktuelleSprache(),
    );
    letzteWochenzeilen = zeilen;
    renderWochentabelle(zeilen, aktuelleSprache());
  } finally {
    if (box) box.removeAttribute('aria-busy');
    if (status) status.textContent = '';
  }
}

export function zeichnetGerade(): boolean { return amZeichnen; }

export function initHandplan(karte: L.Map | null): void {
  gespeicherteSchicht = karte ? L.layerGroup().addTo(karte) : null;
  zeichnenSchicht = karte ? L.layerGroup().addTo(karte) : null;

  const vonInput = $('in-etappe-von') as HTMLInputElement | null;
  const nachInput = $('in-etappe-nach') as HTMLInputElement | null;
  if (vonInput) bindeOrtsAutocomplete(vonInput);
  if (nachInput) bindeOrtsAutocomplete(nachInput);

  karte?.on('click', (ev: L.LeafletMouseEvent) => {
    if (!amZeichnen || app.nurLesen) return;

    if (zeichnenArt === 'hafentag') zeichnenPunkte = [];
    zeichnenPunkte.push({ lat: ev.latlng.lat, lon: ev.latlng.lng });
    zeichneEntwurf();
    setzeZeichenWerkzeuge();
  });

  $('btn-neue-etappe')?.addEventListener('click', () => beginneZeichnen());

  $('btn-neuer-hafentag')?.addEventListener('click', () => {
    const s = app.toern?.start_hafen;
    const v = hafentagVorschlag(app.etappen, s ? { ort: { lat: s.lat, lon: s.lon }, name: s.name } : null, app.toern?.von ?? null);
    beginneZeichnen({
      id: '', vonName: v.nachName, nachName: v.nachName, datum: v.datum, notiz: null,
      wegpunkte: v.wegpunkte, fixiert: false, gewaehlt: false, art: 'hafentag',
    });
  });
  $('btn-punkt-zurueck')?.addEventListener('click', () => {
    zeichnenPunkte.pop();
    zeichneEntwurf();
    setzeZeichenWerkzeuge();
  });
  $('btn-zeichnen-abbrechen')?.addEventListener('click', beendeZeichnen);

  $('btn-etappe-uebernehmen')?.addEventListener('click', () => {
    if (zeichnenPunkte.length < mindestPunkte()) return;
    const istHafentag = zeichnenArt === 'hafentag';
    const datum = feld('in-etappe-datum')?.value || null;
    const ankunftDatum = istHafentag ? null : (feld('in-etappe-ankunft-datum')?.value || null);
    const fehler = $('vp-formular-fehler');
    if (ankunftDatum && datum && ankunftDatum < datum) {
      if (fehler) fehler.textContent = wort('formular.ankunftVorAbfahrt');
      return;
    }
    const nachName = feld('in-etappe-nach')?.value.trim() ?? '';
    const idx = bearbeiteIndex();
    const entwurf: EtappeEntwurf = {
      id: idx !== null ? app.etappen[idx]!.id : neueEtappeId(),
      vonName: istHafentag ? nachName : (feld('in-etappe-von')?.value.trim() ?? ''),
      nachName,
      datum,
      notiz: feld('in-etappe-notiz')?.value.trim() || null,
      wegpunkte: [...zeichnenPunkte],
      fixiert: feld('in-etappe-fixiert')?.checked ?? false,
      gewaehlt: idx !== null ? app.etappen[idx]!.gewaehlt : false,
      art: zeichnenArt,
      abfahrtZeit: istHafentag ? null : (feld('in-etappe-ablegen')?.value || null),

      ankunftDatum: ankunftDatum && ankunftDatum !== datum ? ankunftDatum : null,
      ankunftZeit: istHafentag ? null : (feld('in-etappe-ankunft-zeit')?.value || null),
    };
    const liste = [...app.etappen];
    if (idx !== null) liste[idx] = entwurf;
    else liste.push(entwurf);
    beendeZeichnen();
    setzeHandplan(liste);
  });
  $('btn-etappe-verwerfen')?.addEventListener('click', beendeZeichnen);

  $('btn-plan-gpx-export')?.addEventListener('click', () => {
    if (!app.toern) return;
    const gpx = baueEtappenkettenGpx(app.etappen, app.toern.name, toernBeschreibung(app.toern) || undefined);
    if (!gpx) return;
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = gpxDateiname(app.toern.name);
    a.click();
    URL.revokeObjectURL(url);
    const status = $('vp-plan-status');
    if (status) status.textContent = wort('plan.gpxExportiert');
  });

  $('btn-plan-speichern')?.addEventListener('click', () => {
    void speichereHandplan();
  });

  $('btn-woche-berechnen')?.addEventListener('click', () => { void wochentabelleNeuBerechnen(); });
}
