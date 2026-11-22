import {
  pruefeMachbarkeit, type Wunschziel, type WunschzielArt, type Endziel, type MachbarkeitErgebnis,
} from '@/core/wunschziele';
import { bindeOrtsAutocomplete } from '@/ui/ortsAutocomplete';
import type { OrtsVorschlag } from '@/data/ortssuche';
import { aktuelleSprache } from '@/shell/sprache';
import { oeffneLiegeplatzWahl } from '@/ui/liegeplatzWahl';
import { STRINGS } from './strings';
import { baueMachbarkeitEingabe, fehlendeEingabeSchluessel, hatEtwasZuPlanen, istOffeneUeberstellung, type WunschlisteKontext } from './wunschliste';
import { nf } from '@/core/time';
import { escapeHtml } from '@/core/html';
import { distNM } from '@/core/geo';

const GLEICHER_ORT_SM = 0.05;

const NAECHSTE_ART: Record<WunschzielArt, WunschzielArt> = {
  uebernachtung: 'ruhetag', ruhetag: 'poi', poi: 'uebernachtung',
};
const ART_SCHLUESSEL: Record<WunschzielArt, 'wunschliste.artUebernachtung' | 'wunschliste.artRuhetag' | 'wunschliste.artPoi'> = {
  uebernachtung: 'wunschliste.artUebernachtung', ruhetag: 'wunschliste.artRuhetag', poi: 'wunschliste.artPoi',
};

function wort(schluessel: string, werte?: Record<string, string>): string {
  let text = STRINGS[aktuelleSprache()][schluessel] ?? schluessel;
  for (const [k, v] of Object.entries(werte ?? {})) text = text.replace(`{${k}}`, v);
  return text;
}

export interface WunschlisteZustand {
  wunschziele: readonly Wunschziel[];
  endziel: Endziel | null;
  obergrenzeSm: number | null;
}

export interface WunschlisteInstanz {
  initWunschliste(): void;

  setzeKontext(neu: WunschlisteKontext | null): void;

  liesZustand(): WunschlisteZustand;

  setzeZustand(neu: WunschlisteZustand): void;

  beiAenderung(rueckruf: () => void): void;

  schalteWunschziel(ort: { lat: number; lon: number }, name: string): void;
}

export function erstelleWunschlisteInstanz(idSuffix: string): WunschlisteInstanz {
  const $ = (id: string) => document.getElementById(`${id}${idSuffix}`);

  let wunschziele: Wunschziel[] = [];
  let endziel: Endziel | null = null;
  let kontext: WunschlisteKontext | null = null;

  let aenderungsRueckruf: (() => void) | null = null;

  function liesObergrenzeSm(): number | null {
    const input = $('in-wunschliste-tagesmeilen') as HTMLInputElement | null;
    const wert = input?.value.trim();
    if (!wert) return null;
    const n = Number(wert);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function renderErgebnis(ergebnis: MachbarkeitErgebnis | null): void {
    const box = $('vp-machbarkeit');
    if (!box) return;
    if (!ergebnis) {
      box.className = 'vp-machbarkeit';
      box.textContent = wort(fehlendeEingabeSchluessel(kontext));
      return;
    }

    const verfuegbar = ergebnis.mindestFahrtage + ergebnis.reserveTage;

    const teile: string[] = [
      wort('wunschliste.vorpruefung', { start: kontext?.startName || '?', sm: nf(ergebnis.gesamtSm, 1, aktuelleSprache()) }),
    ];

    if (kontext && istOffeneUeberstellung(kontext.toern)) {
      teile.push(wort('wunschliste.ueberstellung', {
        ziel: kontext.toern.rueckgabe_hafen?.name ?? '', n: String(verfuegbar),
      }));
    } else if (ergebnis.befund === 'gehtNicht') {
      teile.push(wort('wunschliste.gehtNicht', { n: String(ergebnis.grund?.fehlendeTage ?? 0) }));
      if (ergebnis.grund?.teurerWunsch) {
        teile.push(wort('wunschliste.teurerWunsch', {
          name: ergebnis.grund.teurerWunsch.name, tage: String(ergebnis.grund.teurerWunsch.ersparnisTage),
        }));
      }
    } else {
      teile.push(wort(ergebnis.befund === 'gehtKnapp' ? 'wunschliste.gehtKnapp' : 'wunschliste.gehtMitLuft', {
        n: String(ergebnis.mindestFahrtage), verfuegbar: String(verfuegbar), rest: String(ergebnis.reserveTage),
      }));
    }

    const gesehen = new Set<string>();
    for (const e of ergebnis.zuLangeEtappen) {
      const schluessel = [e.vonName, e.nachName].sort().join('|');
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      const beideRichtungen = ergebnis.zuLangeEtappen.some((x) => x.vonName === e.nachName && x.nachName === e.vonName);
      teile.push(wort(beideRichtungen ? 'wunschliste.zuLangeEtappeBeide' : 'wunschliste.zuLangeEtappe', {
        von: e.vonName, nach: e.nachName, sm: nf(e.sm, 1, aktuelleSprache()),
      }));
    }

    box.className = `vp-machbarkeit vp-machbarkeit-${ergebnis.befund}`;
    box.innerHTML = teile.map((t) => `<span>${escapeHtml(t)}</span>`).join('<br>');
  }

  function geaendert(): void {
    aktualisiere();
    aenderungsRueckruf?.();
  }

  function aktualisiere(): void {
    const eingabe = baueMachbarkeitEingabe(wunschziele, endziel, kontext, liesObergrenzeSm());

    const box = $('vp-machbarkeit');
    if (box) box.hidden = !!eingabe && !hatEtwasZuPlanen(wunschziele, endziel);
    if (box?.hidden) return;
    renderErgebnis(eingabe ? pruefeMachbarkeit(eingabe) : null);
  }

  function renderChips(): void {
    const liste = $('vp-chipliste');
    if (!liste) return;
    liste.innerHTML = '';
    wunschziele.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'vp-chip';
      const name = document.createElement('span');
      name.textContent = w.name;

      const art = document.createElement('button');
      art.type = 'button';
      art.className = 'vp-chip-art';
      const artText = wort(ART_SCHLUESSEL[w.art]);
      art.textContent = artText;
      art.setAttribute('aria-label', wort('wunschliste.artUmschalten', { name: w.name, art: artText }));
      art.addEventListener('click', () => {
        wunschziele = wunschziele.map((z, j) => (j === i ? { ...z, art: NAECHSTE_ART[z.art] } : z));
        renderChips();
        geaendert();
      });

      const entfernen = document.createElement('button');
      entfernen.type = 'button';
      entfernen.setAttribute('aria-label', wort('wunschliste.chipEntfernen', { name: w.name }));
      entfernen.textContent = '×';
      entfernen.addEventListener('click', () => {
        wunschziele = wunschziele.filter((_, j) => j !== i);
        renderChips();
        geaendert();
      });
      li.append(name, art, entfernen);
      liste.appendChild(li);
    });
  }

  function renderEndziel(): void {
    const chip = $('chip-endziel');
    const nameEl = $('chip-endziel-name');
    const input = $('in-wunschliste-endziel') as HTMLInputElement | null;
    if (!chip || !nameEl || !input) return;
    chip.hidden = !endziel;
    nameEl.textContent = endziel?.name ?? '';
    input.hidden = !!endziel;
    if (!endziel) input.value = '';
  }

  function setzeKontext(neu: WunschlisteKontext | null): void {
    kontext = neu;
    aktualisiere();
  }

  function liesZustand(): WunschlisteZustand {
    return { wunschziele, endziel, obergrenzeSm: liesObergrenzeSm() };
  }

  function setzeZustand(neu: WunschlisteZustand): void {
    wunschziele = [...neu.wunschziele];
    endziel = neu.endziel;
    const tagesmeilen = $('in-wunschliste-tagesmeilen') as HTMLInputElement | null;
    if (tagesmeilen) tagesmeilen.value = neu.obergrenzeSm == null ? '' : String(neu.obergrenzeSm);
    renderChips();
    renderEndziel();
    aktualisiere();
  }

  function beiAenderung(rueckruf: () => void): void {
    aenderungsRueckruf = rueckruf;
  }

  function schalteWunschziel(ort: { lat: number; lon: number }, name: string): void {
    const da = wunschziele.findIndex((w) => distNM(w.ort.lat, w.ort.lon, ort.lat, ort.lon) < GLEICHER_ORT_SM);
    wunschziele = da >= 0
      ? wunschziele.filter((_, j) => j !== da)
      : [...wunschziele, { ort: { lat: ort.lat, lon: ort.lon }, name, art: 'uebernachtung' }];
    renderChips();
    geaendert();
  }

  function initWunschliste(): void {
    const ortInput = $('in-wunschliste-ort') as HTMLInputElement | null;
    const endzielInput = $('in-wunschliste-endziel') as HTMLInputElement | null;
    const tagesmeilenInput = $('in-wunschliste-tagesmeilen') as HTMLInputElement | null;

    if (ortInput) {
      bindeOrtsAutocomplete(ortInput, (v: OrtsVorschlag) => {
        wunschziele = [...wunschziele, {
          ort: { lat: v.lat, lon: v.lon }, name: v.anzeige, art: 'uebernachtung',

          ...(v.istOrt ? { ungenauerOrt: true } : {}),
        }];
        ortInput.value = '';
        renderChips();
        geaendert();
      });
    }
    if (endzielInput) {
      bindeOrtsAutocomplete(endzielInput, (v: OrtsVorschlag) => {
        endziel = {
          ort: { lat: v.lat, lon: v.lon }, name: v.anzeige,
          ...(v.istOrt ? { ungenauerOrt: true } : {}),
        };
        renderEndziel();
        geaendert();
      });
    }

    $('btn-wunschziel-karte')?.addEventListener('click', () => {
      void (async () => {
        const letztes = wunschziele[wunschziele.length - 1]?.ort;
        const wahl = await oeffneLiegeplatzWahl({
          titel: wort('wunschliste.karteTitel'),
          sprache: aktuelleSprache(),
          mitte: letztes ?? kontext?.start ?? null,
        });
        if (!wahl) return;
        wunschziele = [...wunschziele, { ort: { lat: wahl.lat, lon: wahl.lon }, name: wahl.name, art: 'uebernachtung' }];
        renderChips();
        geaendert();
      })();
    });
    $('btn-endziel-entfernen')?.addEventListener('click', () => {
      endziel = null;
      renderEndziel();
      geaendert();
    });

    tagesmeilenInput?.addEventListener('change', geaendert);

    renderChips();
    renderEndziel();
    aktualisiere();
  }

  return { initWunschliste, setzeKontext, liesZustand, setzeZustand, beiAenderung, schalteWunschziel };
}
