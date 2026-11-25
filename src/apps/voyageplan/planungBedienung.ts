import { aktuelleSprache } from '@/shell/sprache';
import { liesSitzungsToken } from '@/shell/session';
import { aendereToern } from '@/data/toernApi';
import type { Bereitschaft } from '@/core/bereitschaft';
import { reserveTage } from '@/core/rueckkehr';
import { revierVonPunkt } from '@/core/revierzonen';
import { reserveVorschlag, type PlanungEinstellungen } from './planung';
import type { WunschlisteZustand } from './wunschlisteBedienung';
import {
  app, wort, $, planungJetzt, wunschlisteKontext, wunschlisteEins, wunschlisteZwei, setzeToern,
  tankVorschlag, standardSchiffConfig,
} from './kontext';

async function speicherePlanung(
  aenderung: Partial<PlanungEinstellungen> & {
    wunschlisten?: readonly WunschlisteZustand[]; fixierungen?: readonly PlanFixierung[];
  },
): Promise<void> {
  if (!app.toern) return;
  if (app.nurLesen) { const el = $('vp-planung-status'); if (el) el.textContent = wort('raender.nurLesen'); return; }
  const token = liesSitzungsToken();
  if (!token) return;

  const neu = await aendereToern(token, app.toern.id, {
    planung: { ...(app.toern.planung ?? {}), ...aenderung },
  });
  const el = $('vp-planung-status');
  if (!neu) { if (el) el.textContent = wort('planung.speicherFehler'); return; }
  setzeToern(neu);
  if (el) el.textContent = wort('planung.gespeichert');
  zeigeReserveHinweis();
}

const BEREITSCHAFT_STUFEN: readonly { wert: Bereitschaft; schluessel: string }[] = [
  { wert: 'nie', schluessel: 'bereitschaft.nie' },
  { wert: 'wenn noetig', schluessel: 'bereitschaft.wennNoetig' },
  { wert: 'gern', schluessel: 'bereitschaft.gern' },
];

function baueStufenKnoepfe(
  feldId: string,
  feld: 'ablegenBeiDunkelheit' | 'anlegenBeiDunkelheit' | 'langeTage' | 'kreuzen' | 'motoren' | 'grenzuebertritt',
): void {
  const fs = $(feldId);
  if (!fs) return;
  for (const stufe of BEREITSCHAFT_STUFEN) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'btn ghost vp-stufe';
    knopf.dataset.wert = stufe.wert;
    knopf.dataset.feld = feld;
    knopf.textContent = wort(stufe.schluessel);
    knopf.addEventListener('click', () => {
      void speicherePlanung({ [feld]: stufe.wert });
      zeigeStufen(feldId, stufe.wert);
    });
    fs.appendChild(knopf);
  }
}

function zeigeStufen(feldId: string, aktiv: Bereitschaft): void {
  for (const knopf of $(feldId)?.querySelectorAll('button.vp-stufe') ?? []) {
    const el = knopf as HTMLButtonElement;
    el.setAttribute('aria-pressed', String(el.dataset.wert === aktiv));
    el.disabled = app.nurLesen;
  }
}

function zeigeReserveHinweis(): void {
  const el = $('vp-reserve-hinweis');
  if (!el || !app.toern) return;
  const start = wunschlisteKontext()?.start;
  if (!start || !app.toern.von) { el.textContent = ''; return; }
  const revierwert = reserveTage(
    revierVonPunkt(start.lat, start.lon),
    new Date(`${app.toern.von}T00:00:00`).getMonth() + 1,
  );
  const vorschlag = reserveVorschlag(planungJetzt().reserveTage, revierwert);
  el.textContent = vorschlag == null ? '' : wort('planung.reserveHinweis', { n: String(vorschlag) });
}

export function zeigePlanung(): void {
  const p = planungJetzt();
  const setze = (id: string, wert: number | string): void => {
    const el = $(id) as HTMLInputElement | null;
    if (el) { el.value = String(wert); el.disabled = app.nurLesen; }
  };
  setze('in-nachtfahrt-budget', p.nachtfahrtBudget);
  setze('in-reserve-tage', p.reserveTage);
  setze('in-max-stunden', p.maxStundenProTag);
  setze('in-grenz-mean', p.grenzwerte.mean);
  setze('in-grenz-gust', p.grenzwerte.gust);
  setze('in-grenz-wave', p.grenzwerte.wave);
  setze('in-regelmass', p.regelmassSm);
  setze('in-freie-ruhetage', p.freieRuhetage);
  const amStueck = $('in-lange-tage-am-stueck') as HTMLInputElement | null;
  if (amStueck) { amStueck.checked = p.hoechstensEinLangerTagAmStueck; amStueck.disabled = app.nurLesen; }
  const buchten = $('in-buchten-bevorzugt') as HTMLInputElement | null;
  if (buchten) { buchten.checked = p.buchtenBevorzugt; buchten.disabled = app.nurLesen; }
  const anker = $('in-ankerbuchten') as HTMLInputElement | null;
  if (anker) { anker.checked = p.ankerbuchtenGleichwertig; anker.disabled = app.nurLesen; }

  const art = $('in-planungsart') as HTMLSelectElement | null;
  if (art) { art.value = p.planungsart; art.disabled = app.nurLesen; }
  setze('in-ueb-fahrt', p.ueberstellungFahrtKn);

  const tankFeld = $('in-ueb-tank') as HTMLInputElement | null;
  const fahrtKn = p.ueberstellungFahrtKn || (app.toern ? standardSchiffConfig(app.toern).motorSpeed : 0) || 6;
  const vorschlag = app.toern ? tankVorschlag(app.toern, fahrtKn) : null;
  setze('in-ueb-tank', p.tankReichweiteSm ?? vorschlag?.reichweiteSm ?? '');
  if (tankFeld) tankFeld.placeholder = vorschlag ? wort('planung.uebTankVorschlag', { n: String(vorschlag.reichweiteSm) }) : '';
  const tankHerkunft = $('vp-ueb-tank-herkunft');
  if (tankHerkunft) {
    const sp = aktuelleSprache();
    const z = (n: number, d: number): string => n.toLocaleString(sp === 'en' ? 'en-GB' : 'de-AT', { maximumFractionDigits: d });
    tankHerkunft.textContent = !vorschlag ? ''
      : p.tankReichweiteSm != null
        ? wort('planung.uebTankEigen', { n: String(vorschlag.reichweiteSm), kn: z(fahrtKn, 1) })
        : wort('planung.uebTankHerkunft', { tank: z(vorschlag.angabe.tankL, 0), lh: z(vorschlag.angabe.verbrauchLh, 1), kn: z(fahrtKn, 1) });
  }
  setze('in-ueb-naechte', p.maxHafennaechte ?? '');
  const ueb = p.planungsart === 'ueberstellung';
  for (const id of ['vp-ueberstellung-felder', 'vp-ueberstellung-hinweis']) { const el = $(id); if (el) el.hidden = !ueb; }

  for (const el of document.querySelectorAll<HTMLElement>('#vp-planung [data-nur-woche]')) el.hidden = ueb;

  zeigeStufen('fs-ablegen-dunkel', p.ablegenBeiDunkelheit);
  zeigeStufen('fs-anlegen-dunkel', p.anlegenBeiDunkelheit);
  zeigeStufen('fs-lange-tage', p.langeTage);
  zeigeStufen('fs-kreuzen', p.kreuzen);
  zeigeStufen('fs-motoren', p.motoren);
  zeigeStufen('fs-grenzuebertritt', p.grenzuebertritt);
  zeigeReserveHinweis();
}

export function initPlanung(): void {
  baueStufenKnoepfe('fs-ablegen-dunkel', 'ablegenBeiDunkelheit');
  baueStufenKnoepfe('fs-anlegen-dunkel', 'anlegenBeiDunkelheit');
  baueStufenKnoepfe('fs-lange-tage', 'langeTage');
  baueStufenKnoepfe('fs-kreuzen', 'kreuzen');
  baueStufenKnoepfe('fs-motoren', 'motoren');
  baueStufenKnoepfe('fs-grenzuebertritt', 'grenzuebertritt');

  const zahlenfeld = (id: string, uebernehmen: (n: number) => Partial<PlanungEinstellungen>): void => {
    const el = $(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      const n = Number(el.value);

      if (el.value === '' || !Number.isFinite(n)) return;
      void speicherePlanung(uebernehmen(n));
    });
  };
  zahlenfeld('in-nachtfahrt-budget', (n) => ({ nachtfahrtBudget: n }));
  zahlenfeld('in-reserve-tage', (n) => ({ reserveTage: n }));
  zahlenfeld('in-max-stunden', (n) => ({ maxStundenProTag: n }));
  zahlenfeld('in-regelmass', (n) => ({ regelmassSm: n }));
  zahlenfeld('in-freie-ruhetage', (n) => ({ freieRuhetage: n }));

  const art = $('in-planungsart') as HTMLSelectElement | null;
  art?.addEventListener('change', () => {
    void speicherePlanung({ planungsart: art.value === 'ueberstellung' ? 'ueberstellung' : 'woche' }).then(() => zeigePlanung());
  });

  const fahrt = $('in-ueb-fahrt') as HTMLInputElement | null;
  fahrt?.addEventListener('change', () => {
    const n = Number(fahrt.value);
    if (fahrt.value === '' || !Number.isFinite(n)) return;
    void speicherePlanung({ ueberstellungFahrtKn: n }).then(() => zeigePlanung());
  });
  for (const [id, feld] of [['in-ueb-tank', 'tankReichweiteSm'], ['in-ueb-naechte', 'maxHafennaechte']] as const) {
    const el = $(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      const n = Number(el.value);
      void speicherePlanung({ [feld]: el.value === '' || !Number.isFinite(n) ? null : n }).then(() => { if (feld === 'tankReichweiteSm') zeigePlanung(); });
    });
  }
  const amStueck = $('in-lange-tage-am-stueck') as HTMLInputElement | null;
  amStueck?.addEventListener('change', () => {
    void speicherePlanung({ hoechstensEinLangerTagAmStueck: amStueck.checked });
  });
  const buchten = $('in-buchten-bevorzugt') as HTMLInputElement | null;
  buchten?.addEventListener('change', () => {
    void speicherePlanung({ buchtenBevorzugt: buchten.checked });
  });
  for (const [id, feld] of [['in-grenz-mean', 'mean'], ['in-grenz-gust', 'gust'], ['in-grenz-wave', 'wave']] as const) {
    zahlenfeld(id, (n) => ({ grenzwerte: { ...planungJetzt().grenzwerte, [feld]: n } }));
  }

  const anker = $('in-ankerbuchten') as HTMLInputElement | null;
  anker?.addEventListener('change', () => {
    void speicherePlanung({ ankerbuchtenGleichwertig: anker.checked });
  });

  wunschlisteEins.beiAenderung(speichereWunschlisten);
  wunschlisteZwei.beiAenderung(speichereWunschlisten);
}

export interface PlanFixierung {
  tag: number;
  ort: { lat: number; lon: number };
  name: string;
}

export function liesPlanFixierungen(): PlanFixierung[] {
  const roh = (app.toern?.planung as { fixierungen?: unknown } | null)?.fixierungen;
  if (!Array.isArray(roh)) return [];
  return roh.flatMap((f) => {
    const x = f as { tag?: unknown; ort?: { lat?: unknown; lon?: unknown }; name?: unknown };
    if (typeof x.tag !== 'number' || !Number.isInteger(x.tag) || x.tag < 1) return [];
    if (typeof x.ort?.lat !== 'number' || typeof x.ort?.lon !== 'number' || typeof x.name !== 'string') return [];
    return [{ tag: x.tag, ort: { lat: x.ort.lat, lon: x.ort.lon }, name: x.name }];
  });
}

export async function legeTagFest(f: PlanFixierung): Promise<void> {
  const liste = [...liesPlanFixierungen().filter((x) => x.tag !== f.tag), f].sort((a, b) => a.tag - b.tag);
  await speicherePlanung({ fixierungen: liste });
  zeigePlanFixierungen();
}

export function zeigePlanFixierungen(): void {
  const box = $('vp-fixierungen');
  const liste = $('vp-fixierungen-liste');
  if (!box || !liste) return;
  const fixierungen = liesPlanFixierungen();
  box.hidden = fixierungen.length === 0;
  liste.innerHTML = '';
  for (const f of fixierungen) {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = wort('fixierung.eintrag', { tag: String(f.tag), name: f.name });
    li.appendChild(text);
    if (!app.nurLesen) {
      const weg = document.createElement('button');
      weg.type = 'button';
      weg.className = 'btn ghost';
      weg.textContent = '×';
      weg.setAttribute('aria-label', wort('fixierung.entfernen', { tag: String(f.tag), name: f.name }));
      weg.addEventListener('click', () => {
        void speicherePlanung({ fixierungen: liesPlanFixierungen().filter((x) => x.tag !== f.tag) })
          .then(() => {
            zeigePlanFixierungen();
            const status = $('vp-automatik-status');
            if (status) status.textContent = wort('fixierung.entfernt');
          });
      });
      li.appendChild(weg);
    }
    liste.appendChild(li);
  }
}

interface GespeicherteWunschliste {
  wunschziele?: { ort?: { lat?: number; lon?: number }; name?: string; art?: string }[];
  endziel?: { ort?: { lat?: number; lon?: number }; name?: string } | null;
  obergrenzeSm?: number | null;
}

function alsWunschlistenZustand(roh: unknown): WunschlisteZustand | null {
  if (!roh || typeof roh !== 'object') return null;
  const g = roh as GespeicherteWunschliste;
  const punkt = (p: { lat?: number; lon?: number } | undefined): { lat: number; lon: number } | null =>
    typeof p?.lat === 'number' && typeof p.lon === 'number' ? { lat: p.lat, lon: p.lon } : null;

  const wunschziele = (g.wunschziele ?? []).flatMap((w) => {
    const ort = punkt(w.ort);
    if (!ort || !w.name) return [];
    const art = w.art === 'ruhetag' || w.art === 'poi' ? w.art : 'uebernachtung';
    return [{ ort, name: w.name, art } as const];
  });
  const endzielOrt = punkt(g.endziel?.ort);
  return {
    wunschziele,
    endziel: endzielOrt && g.endziel?.name ? { ort: endzielOrt, name: g.endziel.name } : null,
    obergrenzeSm: typeof g.obergrenzeSm === 'number' ? g.obergrenzeSm : null,
  };
}

export function speichereWunschlisten(): void {
  void speicherePlanung({
    wunschlisten: [wunschlisteEins.liesZustand(), wunschlisteZwei.liesZustand()],
  });
}

export function zeigeWunschlisten(): boolean {
  const listen = (app.toern?.planung as { wunschlisten?: unknown[] } | null)?.wunschlisten;
  if (!Array.isArray(listen)) return false;
  const eins = alsWunschlistenZustand(listen[0]);
  const zwei = alsWunschlistenZustand(listen[1]);
  if (eins) wunschlisteEins.setzeZustand(eins);
  if (!zwei) return false;
  wunschlisteZwei.setzeZustand(zwei);
  return zwei.wunschziele.length > 0 || zwei.endziel != null;
}
