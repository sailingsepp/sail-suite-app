
import { liesSitzungsToken } from '@/shell/session';
import { aktuelleSprache } from '@/shell/sprache';
import { oeffneLiegeplatzWahl } from '@/ui/liegeplatzWahl';
import { aendereToern, type ToernHafen } from '@/data/toernApi';
import { toernRevierText, startRevierTeil } from '@/core/revierzonen';
import { revierFuerToern } from '@/data/toernRevier';
import { app, wort, $, aktualisiereWunschlistenKontext, setzeToern, merkeRahmenSpeichern } from './kontext';
import { liesRahmen, rahmenWeichtAb, RAHMEN_FELDER, type PlanRahmen } from './planRahmen';
import { verfuegbareFahrtage, rueckgabetagIstFahrtag } from './wunschliste';
import { lateinisch } from '@/core/umschrift';

function setzeRaenderStatus(schluessel: string): void {
  const el = $('vp-raender-status');
  if (el) el.textContent = wort(schluessel);
}


function speichereRaender(aenderung: PlanRahmen): Promise<boolean> {
  return merkeRahmenSpeichern(speichereRaenderJetzt(aenderung));
}

async function speichereRaenderJetzt(aenderung: PlanRahmen): Promise<boolean> {
  const roh = app.toernGespeichert;
  if (!roh) return false;
  if (app.nurLesen) { setzeRaenderStatus('raender.nurLesen'); return false; }
  const token = liesSitzungsToken();
  if (!token) { setzeRaenderStatus('raender.speicherFehler'); return false; }
  const rahmen: PlanRahmen = { ...liesRahmen(roh.planung), ...aenderung };
  for (const f of RAHMEN_FELDER) {
    if (f in rahmen && JSON.stringify(rahmen[f] ?? null) === JSON.stringify(roh[f] ?? null)) delete rahmen[f];
  }
  const planung: Record<string, unknown> = { ...(roh.planung ?? {}) };
  if (Object.keys(rahmen).length > 0) planung['rahmen'] = rahmen; else delete planung['rahmen'];
  const neu = await aendereToern(token, roh.id, { planung });
  if (!neu) { setzeRaenderStatus('raender.speicherFehler'); return false; }
  setzeToern(neu);
  setzeRaenderStatus(rahmenWeichtAb(neu) ? 'raender.gemerkt' : 'raender.wieImToern');
  zeigeRahmenAbweichung();
  
  
  aktualisiereWunschlistenKontext();
  return true;
}

function zeigeHafen(praefix: 'start' | 'rueckgabe', hafen: ToernHafen | null | undefined): void {
  const wert = $(`vp-${praefix}-wert`);
  if (wert) {
    wert.textContent = hafen ? lateinisch(hafen.name) : wort('raender.punktLeer');
    wert.classList.toggle('leer', !hafen);
  }
}


function zeigeRueckgabeHinweis(): void {
  const el = $('vp-rueckgabe-hinweis');
  if (!el || !app.toern) return;
  const tage = verfuegbareFahrtage(app.toern);
  const zeit = app.toern.rueckgabe_zeit ?? null;
  const p2 = (n: number) => String(n).padStart(2, '0');
  const bis = app.toern.bis ? (() => { const [, m, d] = app.toern!.bis!.split('-'); return `${p2(Number(d))}.${p2(Number(m))}.`; })() : '';
  const werte = { bis, zeit: zeit ?? '', n: String(tage ?? 0) };
  const schluessel = !app.toern.bis || tage == null ? null
    : !zeit ? 'raender.rueckgabeOhneZeit'
      : rueckgabetagIstFahrtag(zeit) ? 'raender.rueckgabeAbends' : 'raender.rueckgabeMorgens';
  el.textContent = schluessel ? wort(schluessel, werte) : '';
}


function zeigeRahmenAbweichung(): void {
  const box = $('vp-rahmen-abweichung');
  if (box) box.hidden = !app.toernGespeichert || !rahmenWeichtAb(app.toernGespeichert);
  for (const id of ['btn-rahmen-uebernehmen', 'btn-rahmen-verwerfen']) {
    const el = $(id) as HTMLButtonElement | null;
    if (el) el.disabled = app.nurLesen;
  }
}


async function rahmenInDenToern(): Promise<void> {
  const roh = app.toernGespeichert;
  const token = liesSitzungsToken();
  if (!roh || app.nurLesen || !token) return;
  const rahmen = liesRahmen(roh.planung);
  const planung: Record<string, unknown> = { ...(roh.planung ?? {}) };
  delete planung['rahmen'];
  const neu = await aendereToern(token, roh.id, { ...rahmen, planung });
  if (!neu) { setzeRaenderStatus('raender.uebernahmeFehler'); return; }
  setzeToern(neu);
  setzeRaenderStatus('raender.uebernommen');
  zeigeRaender();
  aktualisiereWunschlistenKontext();
}


async function rahmenVerwerfen(): Promise<void> {
  const roh = app.toernGespeichert;
  if (!roh) return;
  const ohne: PlanRahmen = {};
  for (const f of RAHMEN_FELDER) (ohne as Record<string, unknown>)[f] = roh[f] ?? null;
  if (await speichereRaender(ohne)) zeigeRaender();
}


export function zeigeRaender(): void {
  if (!app.toern) return;
  zeigeHafen('start', app.toern.start_hafen);
  zeigeHafen('rueckgabe', app.toern.rueckgabe_hafen);
  const uebernahme = $('in-uebernahme-zeit') as HTMLInputElement | null;
  const rueckgabe = $('in-rueckgabe-zeit') as HTMLInputElement | null;
  if (uebernahme) uebernahme.value = app.toern.uebernahme_zeit ?? '';
  if (rueckgabe) rueckgabe.value = app.toern.rueckgabe_zeit ?? '';
  const von = $('in-plan-von') as HTMLInputElement | null;
  const bis = $('in-plan-bis') as HTMLInputElement | null;
  if (von) von.value = app.toern.von ?? '';
  if (bis) { bis.value = app.toern.bis ?? ''; bis.min = app.toern.von ?? ''; }
  zeigeRueckgabeHinweis();
  zeigeRahmenAbweichung();
  
  
  for (const id of [
    'btn-start-waehlen', 'btn-rueckgabe-waehlen',
    'in-uebernahme-zeit', 'in-rueckgabe-zeit', 'in-plan-von', 'in-plan-bis',
  ]) {
    const el = $(id) as HTMLInputElement | HTMLButtonElement | null;
    if (el) el.disabled = app.nurLesen;
  }
}

async function waehleHafen(praefix: 'start' | 'rueckgabe'): Promise<void> {
  const feld = praefix === 'start' ? 'start_hafen' : 'rueckgabe_hafen';
  const bisher = praefix === 'start' ? app.toern?.start_hafen : app.toern?.rueckgabe_hafen;
  const wahl = await oeffneLiegeplatzWahl({
    titel: wort(praefix === 'start' ? 'raender.startTitel' : 'raender.rueckgabeTitel'),
    sprache: aktuelleSprache(),
    vorbelegung: bisher ?? null,
  });
  if (!wahl) return;
  const hafen: ToernHafen = { name: wahl.name, lat: wahl.lat, lon: wahl.lon };
  
  
  
  
  const revier = await revierFuerToern({
    start: praefix === 'start' ? hafen : app.toern?.start_hafen ?? null,
    ziel: praefix === 'rueckgabe' ? hafen : app.toern?.rueckgabe_hafen ?? null,
    startText: praefix === 'start'
      ? (wahl.land ? toernRevierText(wahl.land, wahl.lat, wahl.lon, aktuelleSprache()) : null)
      : startRevierTeil(app.toern?.revier),
    ...(praefix === 'rueckgabe' && wahl.land ? { landZiel: wahl.land } : {}),
  }, aktuelleSprache());
  
  
  
  
  await speichereRaender({ [feld]: hafen, ...(revier ? { revier } : {}) });
  zeigeHafen(praefix, praefix === 'start' ? app.toern?.start_hafen : app.toern?.rueckgabe_hafen);
}

export function initRaender(): void {
  for (const praefix of ['start', 'rueckgabe'] as const) {
    
    
    $(`btn-${praefix}-waehlen`)?.addEventListener('click', () => void waehleHafen(praefix));
  }

  for (const [id, feld] of [['in-uebernahme-zeit', 'uebernahme_zeit'], ['in-rueckgabe-zeit', 'rueckgabe_zeit']] as const) {
    const el = $(id) as HTMLInputElement | null;
    
    
    
    el?.addEventListener('change', () => {
      void speichereRaender({ [feld]: el.value || null }).then(() => zeigeRueckgabeHinweis());
    });
  }

  
  
  for (const [id, feld] of [['in-plan-von', 'von'], ['in-plan-bis', 'bis']] as const) {
    const el = $(id) as HTMLInputElement | null;
    el?.addEventListener('change', () => {
      const wert = el.value || null;
      const von = feld === 'von' ? wert : app.toern?.von ?? null;
      const bis = feld === 'bis' ? wert : app.toern?.bis ?? null;
      if (von && bis && bis < von) { setzeRaenderStatus('raender.bisVorVon'); zeigeRaender(); return; }
      void speichereRaender({ [feld]: wert }).then(() => zeigeRaender());
    });
  }
  $('btn-rahmen-uebernehmen')?.addEventListener('click', () => void rahmenInDenToern());
  $('btn-rahmen-verwerfen')?.addEventListener('click', () => void rahmenVerwerfen());
}
