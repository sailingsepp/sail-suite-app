import type { Sprache } from '@/core/types';
import { nf } from '@/core/time';
import { summeLiter, sortiereTankvorgaenge, verbrauchJeIntervall, ORT_MAX, MAX_TANKVORGAENGE, type Tankvorgang } from '@/core/tankvorgaenge';
import { VERBRAUCH_MIN_STUNDEN } from '@/core/dieselverbrauch';
import './tankliste.css';

const TEXTE: Record<Sprache, Record<string, string>> = {
  de: {
    titel: 'Tankvorgänge', datum: 'Datum', liter: 'Liter', ort: 'Tankstelle oder Hafen', stand: 'Motorstunden',
    verbrauch: '{v} l/h seit dem Tanken davor ({l} l in {h} h, voll bis voll)',
    neu: '+ Tankvorgang', weg: 'Tankvorgang entfernen', summe: 'Getankt gesamt: {l} l', keine: 'Noch kein Tankvorgang eingetragen.',
    ortSucht: 'Ort wird ermittelt …',
  },
  en: {
    titel: 'Refuelling', datum: 'Date', liter: 'Litres', ort: 'Fuel dock or harbour', stand: 'Engine hours',
    verbrauch: '{v} l/h since the previous refuelling ({l} l in {h} h, full to full)',
    neu: '+ Refuelling', weg: 'Remove refuelling', summe: 'Bunkered in total: {l} l', keine: 'No refuelling entered yet.',
    ortSucht: 'Finding the place …',
  },
};

function feldZahl(n: number, sprache: Sprache): string {
  return sprache === 'de' ? String(n).replace('.', ',') : String(n);
}

export function leseLiter(roh: string): number | undefined {
  const t = roh.trim().replace(/\s*(l|ltr|liter|litre|liters|litres)\.?$/i, '');
  const n = Number(t.replace(',', '.'));
  return t && Number.isFinite(n) ? n : undefined;
}

function heute(): string {
  const d = new Date();
  const zwei = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

function position(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((fertig) => {
    if (!('geolocation' in navigator)) { fertig(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => fertig({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => fertig(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5 * 60_000 },
    );
  });
}

async function ortHier(sprache: Sprache): Promise<string | null> {
  const p = await position();
  if (!p) return null;
  try {
    const { ortsangabeLogbuch } = await import('@/data/places');
    return (await ortsangabeLogbuch(p, sprache)).name;
  } catch {
    return null;
  }
}

export interface Tankliste {

  setze(vorgaenge: readonly Tankvorgang[]): void;

  lies(): { vorgaenge: Tankvorgang[]; fehler: boolean };

  sperre(gesperrt: boolean): void;
}

export function baueTankliste(behaelter: HTMLElement, sprache: () => Sprache, idPraefix: string): Tankliste {
  const t = (k: string): string => TEXTE[sprache()][k] ?? k;
  behaelter.classList.add('tank-liste');
  behaelter.replaceChildren();
  const titel = document.createElement('span');
  titel.className = 'tank-titel';
  const zeilen = document.createElement('div');
  zeilen.className = 'tank-zeilen';
  const fuss = document.createElement('div');
  fuss.className = 'tank-fuss';
  const neu = document.createElement('button');
  neu.type = 'button';
  neu.className = 'tank-neu';
  const summe = document.createElement('span');
  summe.className = 'tank-summe';
  summe.setAttribute('aria-live', 'polite');
  fuss.append(neu, summe);
  behaelter.append(titel, zeilen, fuss);
  let zaehler = 0;
  let gesperrt = false;

  function wendeSperreAn(): void {
    behaelter.classList.toggle('tank-gesperrt', gesperrt);
    for (const i of behaelter.querySelectorAll<HTMLInputElement>('input')) i.readOnly = gesperrt;
    for (const b of behaelter.querySelectorAll<HTMLButtonElement>('button')) b.hidden = gesperrt;
  }

  function zeigeSumme(): void {
    const { vorgaenge } = lies();
    const s = summeLiter(vorgaenge);
    summe.textContent = s === null ? '' : t('summe').replace('{l}', nf(s, s % 1 ? 1 : 0, sprache()));
    zeigeVerbrauch();
  }

  function zeigeVerbrauch(): void {
    const reihe = [...zeilen.querySelectorAll<HTMLElement>('.tank-zeile')];
    const daten = reihe.map(zeilenWert);
    const gueltig = daten.map((d, i) => ({ d, i })).filter((x): x is { d: Tankvorgang; i: number } => x.d !== null);
    const werte = verbrauchJeIntervall(gueltig.map((x) => x.d), VERBRAUCH_MIN_STUNDEN);

    const geordnet = sortiereTankvorgaenge(gueltig.map((x) => x.d));
    for (const z of reihe) z.querySelector('.tank-verbrauch')?.remove();
    geordnet.forEach((v, k) => {
      const w = werte[k];
      if (!w) return;
      const zeile = reihe[gueltig.find((x) => x.d === v)!.i]!;
      const el = document.createElement('span');
      el.className = 'tank-verbrauch';
      const sp = sprache();
      el.textContent = t('verbrauch').replace('{v}', nf(w.literJeStunde, 1, sp)).replace('{l}', nf(w.liter, w.liter % 1 ? 1 : 0, sp))
        .replace('{h}', nf(w.stunden, w.stunden % 1 ? 1 : 0, sp));
      zeile.append(el);
    });
  }

  function zeilenWert(z: HTMLElement): Tankvorgang | null {
    const wert = (art: string): string => (z.querySelector<HTMLInputElement>(`[data-tank="${art}"]`)?.value ?? '').trim();
    const roh = { datum: wert('datum'), liter: wert('liter'), ort: wert('ort'), stand: wert('stand') };
    if (!roh.liter) return null;
    const liter = leseLiter(roh.liter);
    const datumOk = !roh.datum || /^\d{4}-\d{2}-\d{2}$/.test(roh.datum);
    const stand = roh.stand ? leseLiter(roh.stand) : undefined;
    if (liter === undefined || liter < 0 || liter >= 100_000 || !datumOk) return null;
    if (roh.stand && (stand === undefined || stand < 0 || stand >= 1_000_000)) return null;
    return { datum: roh.datum || null, liter, ort: roh.ort || null, ...(stand !== undefined ? { motorstand: stand } : {}) };
  }

  function zeile(v: Tankvorgang | null): HTMLElement {
    const nr = ++zaehler;
    const z = document.createElement('div');
    z.className = 'tank-zeile';
    const feld = (art: 'datum' | 'liter' | 'ort' | 'stand'): HTMLInputElement => {
      const label = document.createElement('label');
      label.className = `tank-${art}`;
      const span = document.createElement('span');
      span.textContent = t(art);
      const input = document.createElement('input');
      input.id = `${idPraefix}-${art}-${nr}`;
      input.dataset['tank'] = art;
      if (art === 'datum') input.type = 'date';
      else if (art === 'liter' || art === 'stand') { input.type = 'text'; input.inputMode = 'decimal'; }
      else { input.type = 'text'; input.maxLength = ORT_MAX; }
      input.addEventListener('input', zeigeSumme);
      label.append(span, input);
      z.append(label);
      return input;
    };
    const datum = feld('datum');
    const liter = feld('liter');
    const ort = feld('ort');
    const stand = feld('stand');
    if (v) {
      datum.value = v.datum ?? '';
      liter.value = feldZahl(v.liter, sprache());
      ort.value = v.ort ?? '';
      stand.value = typeof v.motorstand === 'number' ? feldZahl(v.motorstand, sprache()) : '';
    } else {

      let vorbelegt = false;
      const vorbelegen = (): void => {
        if (vorbelegt || gesperrt) return;
        vorbelegt = true;
        if (!datum.value) datum.value = heute();
        if (ort.value) return;
        const platzhalter = ort.placeholder;
        ort.placeholder = t('ortSucht');
        void ortHier(sprache()).then((name) => {
          ort.placeholder = platzhalter;

          if (name && !ort.value) {
            ort.value = name.slice(0, ORT_MAX);

            ort.dispatchEvent(new Event('input', { bubbles: true }));
            ort.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      };
      for (const f of [datum, liter, ort, stand]) f.addEventListener('focus', vorbelegen);
    }
    const weg = document.createElement('button');
    weg.type = 'button';
    weg.className = 'tank-weg';
    weg.textContent = '✕';
    weg.setAttribute('aria-label', t('weg'));
    weg.title = t('weg');
    weg.addEventListener('click', () => {
      z.remove();
      if (!zeilen.childElementCount) zeilen.append(zeile(null));
      zeigeSumme();
    });
    z.append(weg);
    return z;
  }

  function lies(): { vorgaenge: Tankvorgang[]; fehler: boolean } {
    const vorgaenge: Tankvorgang[] = [];
    let fehler = false;
    for (const z of zeilen.querySelectorAll<HTMLElement>('.tank-zeile')) {

      if (!(z.querySelector<HTMLInputElement>('[data-tank="liter"]')?.value ?? '').trim()) continue;
      const v = zeilenWert(z);
      if (!v) {
        fehler = true;
        z.querySelector('[data-tank="liter"]')?.setAttribute('aria-invalid', 'true');
        continue;
      }
      z.querySelector('[data-tank="liter"]')?.removeAttribute('aria-invalid');
      vorgaenge.push(v);
    }
    return { vorgaenge, fehler };
  }

  neu.addEventListener('click', () => {
    if (zeilen.childElementCount >= MAX_TANKVORGAENGE) return;
    const z = zeile(null);
    zeilen.append(z);
    z.querySelector<HTMLInputElement>('[data-tank="datum"]')?.focus();
  });

  function beschrifte(): void {
    titel.textContent = t('titel');
    neu.textContent = t('neu');
  }

  return {
    setze(vorgaenge) {
      beschrifte();
      zeilen.replaceChildren();
      const geordnet = sortiereTankvorgaenge(vorgaenge);
      for (const v of geordnet) zeilen.append(zeile(v));
      if (!geordnet.length) zeilen.append(zeile(null));
      zeigeSumme();
      wendeSperreAn();
    },
    lies,
    sperre(g) {
      gesperrt = g;
      wendeSperreAn();
    },
  };
}
