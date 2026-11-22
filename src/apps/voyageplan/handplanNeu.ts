import { app, wort, $, wunschlisteKontext, datumIso } from './kontext';
import type { WunschlisteKontext } from './wunschliste';
import { planVorschlagenKlick, planLaufNummer, letzterGerechneterPlan, zeigeWochenReiter } from './automatik';
import { baueHandplanEtappen } from './planVorschlagen';
import { setzeHandplan, speichereHandplan } from './handplan';
import { teileAbTag, mitFestenEtappen, ausNeuerEtappe } from './handplanUmbau';

function status(text: string): void {
  const el = $('vp-ab-tag-status');
  if (el) el.textContent = text;
}

export function zeigeAbTag(): void {
  const el = $('in-ab-tag') as HTMLInputElement | null;
  const knopf = $('btn-ab-tag-rechnen') as HTMLButtonElement | null;
  if (knopf) knopf.disabled = app.nurLesen;
  if (!el || !app.toern) return;
  el.disabled = app.nurLesen;
  if (el.value) return;
  const heute = datumIso(new Date());
  const { von, bis } = app.toern;
  el.value = von && heute > von && (!bis || heute <= bis) ? heute : (von ?? '');
  el.min = von ?? '';
  el.max = bis ?? '';
}

async function abTagNeuPlanen(): Promise<void> {
  const x = ($('in-ab-tag') as HTMLInputElement | null)?.value;
  const k = wunschlisteKontext();
  if (!app.toern || !k || app.nurLesen) return;
  if (!x) { status(wort('abTag.fehlt')); return; }
  const teil = teileAbTag(app.etappen, x);
  if (app.toern.bis && teil.vonIso > app.toern.bis) { status(wort('abTag.nachEnde', { bis: app.toern.bis })); return; }
  const kontext: WunschlisteKontext = {
    ...k,

    toern: { ...k.toern, von: teil.vonIso, uebernahme_zeit: teil.vonIso === k.toern.von ? k.toern.uebernahme_zeit ?? null : teil.abZeit },
    ...(teil.start ? { start: teil.start.ort, startName: teil.start.name } : {}),
  };
  status(wort('abTag.rechnet', { datum: teil.vonIso }));
  const vorher = planLaufNummer();
  zeigeWochenReiter('auto');
  await planVorschlagenKlick(kontext);
  const plan = letzterGerechneterPlan();
  zeigeWochenReiter('hand');
  if (planLaufNummer() === vorher || !plan) { status(wort('abTag.keinPlan')); return; }
  const neu = baueHandplanEtappen(plan.ergebnis, plan.netz, new Date(`${plan.startDatumIso}T00:00:00`)).map(ausNeuerEtappe);
  setzeHandplan([...teil.behalten, ...mitFestenEtappen(neu, teil.fest)]);
  const ok = await speichereHandplan();
  status(wort(ok ? 'abTag.fertig' : 'abTag.nichtGespeichert', { datum: teil.vonIso, n: String(neu.length) }));
}

async function vorschlagInHandplan(): Promise<void> {
  const plan = letzterGerechneterPlan();
  if (!plan || app.nurLesen) return;
  if (app.etappen.length > 0 && !window.confirm(wort('handplan.ersetzenFrage', { n: String(app.etappen.length) }))) return;
  const neu = baueHandplanEtappen(plan.ergebnis, plan.netz, new Date(`${plan.startDatumIso}T00:00:00`)).map(ausNeuerEtappe);
  setzeHandplan(neu);
  zeigeWochenReiter('hand');
  const ok = await speichereHandplan();
  status(ok ? wort('handplan.uebernommen', { n: String(neu.length) }) : wort('plan.fehler'));
}

export function initHandplanNeu(): void {
  $('btn-ab-tag-rechnen')?.addEventListener('click', () => void abTagNeuPlanen());
  $('btn-vorschlag-in-handplan')?.addEventListener('click', () => void vorschlagInHandplan());
}
