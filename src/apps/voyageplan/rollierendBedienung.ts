import { nf } from '@/core/time';
import { verfuegbareFahrtage, type WunschlisteKontext } from './wunschliste';
import {
  holeGefahreneTage, tagAusPlanDatum, vergleichePlanMitWirklichkeit, neuerStartpunkt, gefahrenArt,
  type GefahrenerTag, type GeplanteZeile, type VergleichsZeile,
} from './rollierend';
import { planVorschlagenKlick } from './automatik';
import { app, wort, $, datumIso, standardSchiffConfig, type EtappeEntwurf } from './kontext';

let rollierendGefahren: GefahrenerTag[] = [];

function gefahrenText(g: { von: string | null; nach: string | null; nm: number }): string {
  const nm = nf(g.nm, 1);
  const art = gefahrenArt(g);
  if (art === 'ohneOrt') return wort('rollierend.gefahrenOhneOrt', { nm });
  if (art === 'amOrt') return wort('rollierend.amOrt', { nach: g.nach! });
  return art === 'vonNach' ? wort('rollierend.gefahren', { von: g.von!, nach: g.nach!, nm }) : wort('rollierend.gefahrenNach', { nach: g.nach!, nm });
}

function renderRollierendListe(zeilen: readonly VergleichsZeile[]): void {
  const liste = $('vp-rollierend-liste');
  if (!liste) return;
  liste.innerHTML = '';
  for (const z of zeilen) {
    const li = document.createElement('li');
    li.className = z.weicht ? 'vp-rollierend-zeile vp-rollierend-weicht' : 'vp-rollierend-zeile';
    const tag = document.createElement('div');
    tag.className = 'vp-rollierend-tag';
    tag.textContent = wort('rollierend.tag', { n: String(z.tag) });
    li.appendChild(tag);
    if (z.geplant) {
      const g = document.createElement('div');
      g.textContent = wort('rollierend.geplant', { von: z.geplant.von, nach: z.geplant.nach });
      li.appendChild(g);
    }
    if (z.gefahren) {
      const f = document.createElement('div');
      f.textContent = gefahrenText(z.gefahren);
      li.appendChild(f);
    } else if (z.geplant) {
      const n = document.createElement('div');
      n.className = 'vp-hinweis';
      n.textContent = wort('rollierend.nichtGefahren');
      li.appendChild(n);
    }
    if (z.weicht) {
      const w = document.createElement('div');
      w.className = 'vp-rollierend-abweichung';
      w.textContent = wort('rollierend.abweichung');
      li.appendChild(w);
    }
    liste.appendChild(li);
  }
}

export async function zeigeRollierend(): Promise<void> {
  const box = $('vp-rollierend');
  if (!box) return;
  if (!app.toern?.von) { box.hidden = true; return; }
  const gefahren = await holeGefahreneTage(app.toern.id, app.toern.von);
  rollierendGefahren = gefahren;
  if (gefahren.length === 0) { box.hidden = true; return; }
  const toernVon = app.toern.von;
  const geplant: GeplanteZeile[] = app.etappen
    .filter((e): e is EtappeEntwurf & { datum: string } => e.datum != null)
    .map((e) => ({ tag: tagAusPlanDatum(toernVon, e.datum), vonName: e.vonName || '?', nachName: e.nachName || '?' }));
  renderRollierendListe(vergleichePlanMitWirklichkeit(geplant, gefahren));
  box.hidden = false;
}

async function rollierendNeuRechnenKlick(): Promise<void> {
  if (!app.toern?.bis) return;
  const status = $('vp-rollierend-status');
  const punkt = neuerStartpunkt(rollierendGefahren);
  if (!punkt) return;
  const heuteIso = datumIso(new Date());
  if (verfuegbareFahrtage({ von: heuteIso, bis: app.toern.bis, rueckgabe_zeit: app.toern.rueckgabe_zeit }) == null) {
    if (status) status.textContent = wort('rollierend.zuEnde');
    return;
  }
  if (status) status.textContent = '';
  const kontext: WunschlisteKontext = {

    toern: { ...app.toern, von: heuteIso, uebernahme_zeit: heuteIso === app.toern.von ? app.toern.uebernahme_zeit ?? null : null },
    cfg: standardSchiffConfig(app.toern),
    start: punkt.ort,
    startName: punkt.name ?? wort('rollierend.aktuellePosition'),
  };
  await planVorschlagenKlick(kontext);
}

export function initRollierend(): void {
  $('btn-rollierend-neu-rechnen')?.addEventListener('click', () => { void rollierendNeuRechnenKlick(); });
}
