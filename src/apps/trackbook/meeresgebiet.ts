import type { LogEintrag } from '@/data/logdb';
import type { Zustand } from './aufzeichnung';
import { SCHLUESSEL } from '@/shell/speicherschluessel';
import { aktuelleSprache } from '@/shell/sprache';
import { nf, uhrLtVon, hhmmInZone } from '@/core/time';
import type { GebietStand } from '@/core/meeresgebiete';
import type { EngenStand, EngenEreignis } from '@/core/meerengen';
import { engeText, gebietText } from '@/core/ansagen';
import { sage } from './ansage';

const PRUEF_MS = 10_000;

type GebietModul = typeof import('@/core/meeresgebiete');
type EngenModul = typeof import('@/core/meerengen');
let gebiete: GebietModul | null = null;
let engen: EngenModul | null = null;
let laedt = false;
let zuletztMs = 0;
let eintragen: ((e: Omit<LogEintrag, 'fahrt'>) => void) | null = null;

function lies<T>(k: string, leer: T, pruefe: (x: unknown) => boolean): T {
  try {
    const s = JSON.parse(localStorage.getItem(k) ?? 'null') as unknown;
    return s && typeof s === 'object' && pruefe(s) ? (s as T) : leer;
  } catch { return leer; }
}
function schreibe(k: string, s: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(s)); } catch {  }
}

export function initMeeresgebiet(eintrag: (e: Omit<LogEintrag, 'fahrt'>) => void): void {
  eintragen = eintrag;
}

const uhr = (t: number) => uhrLtVon(t);

export function engenText(e: EngenEreignis, name: { de: string; en: string }): string {
  const en = aktuelleSprache() === 'en';
  const n = en ? name.en : name.de;

  const von = e.bis ? hhmmInZone(e.ort.t) : uhr(e.ort.t), bis = e.bis ? uhr(e.bis) : '';
  switch (e.art) {
    case 'einfahrt': return en ? `Entered ${n}` : `Einfahrt ${n}`;
    case 'ausfahrt': return en ? `Left ${n}` : `Ausfahrt ${n}`;
    case 'querung': return en ? `Crossed ${n}, ${von}–${bis}` : `Querung ${n}, ${von}–${bis}`;
    case 'entlang': {
      const sm = nf(e.sm ?? 0, 1, en ? 'en' : 'de');
      return en ? `Along ${n}, ${sm} NM, ${von}–${bis}` : `Entlang ${n}, ${sm} sm, ${von}–${bis}`;
    }
  }
}

export function pruefeMeeresgebiet(z: Zustand): void {
  if (z.betriebsart !== 'laeuft' || z.wartetAufFix || !z.position) return;
  if (!gebiete || !engen) {
    if (!laedt) {
      laedt = true;
      void Promise.all([import('@/core/meeresgebiete'), import('@/core/meerengen')])
        .then(([g, m]) => { gebiete = g; engen = m; })
        .catch(() => { laedt = false; });
    }
    return;
  }
  const jetzt = Date.now();
  if (jetzt - zuletztMs < PRUEF_MS) return;
  zuletztMs = jetzt;
  const { lat, lon } = z.position;
  const ort = { t: jetzt, lat, lon };

  const gStand = lies<GebietStand>(SCHLUESSEL.meeresgebiet, gebiete.LEERER_STAND, (s) => 'gebiet' in (s as object));
  const g = gebiete.gebietSchritt(gStand, gebiete.meeresgebietAm(lat, lon)?.id ?? null, ort);
  schreibe(SCHLUESSEL.meeresgebiet, g.stand);
  if (g.uebergang) {
    const u = g.uebergang;

    if (!u.meerenge) {
      const m = engen.meerengeAm(u.ort.lat, u.ort.lon);
      if (m) u.meerenge = { de: m.de, en: m.en, deDurch: m.de.startsWith('Straße') ? `durch die ${m.de}` : `durch die Meerenge ${m.de}` };
    }
    const text = gebiete.uebergangText(u, aktuelleSprache());
    if (text) eintragen?.({ t: u.ort.t, art: 'navigation', lat: u.ort.lat, lon: u.ort.lon, text });
    const von = gebiete.gebietNachId(u.von), nach = gebiete.gebietNachId(u.nach);
    if (von && nach) sage(gebietText(nach.en, von.en, u.meerenge?.en), null, 5 * 60_000);
  }

  const eStand = lies<EngenStand>(SCHLUESSEL.meerengen, engen.LEERER_ENGEN_STAND, (s) => Array.isArray((s as EngenStand).aktiv));
  const e = engen.engenSchritt(eStand, ort);
  schreibe(SCHLUESSEL.meerengen, e.stand);
  for (const ev of e.ereignisse) {
    const name = engen.meerengeNachId(ev.id);
    if (name) {
      eintragen?.({ t: ev.ort.t, art: 'navigation', lat: ev.ort.lat, lon: ev.ort.lon, text: engenText(ev, name) });
      sage(engeText(ev.art, name.en, ev.sm), null, 5 * 60_000);
    }
  }
}
