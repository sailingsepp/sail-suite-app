import type L from 'leaflet';
import { app, wort, $, planungJetzt, standardSchiffConfig, schreibeAnkunftAlsBis, tankVorschlag } from './kontext';
import { tankZeile, bedarfSatz } from '@/briefing/kraftstoff';
import { aktuelleSprache } from '@/shell/sprache';
import { liesSitzungsToken } from '@/shell/session';
import { schreibeEtappen, type NeueEtappeDaten } from '@/data/toernApi';
import { istUeberstellung } from '@/core/ueberstellung';
import { escapeHtml } from '@/core/html';
import { fmtDur, nf } from '@/core/time';
import { smText } from './einheit';
import { UEBERSTELLUNG_VORGABEN, type HaltArt, type UeberstellungsSchlag } from '@/core/ueberstellungsplan';
import { rechneUeberstellung, wegStueck } from './ueberstellungRechner';
import { zeichneUeberstellung, passeAusschnittAn } from './karte';
import { OPTION_SCHLUESSEL_1 } from './rechnerProtokoll';
import { istOffeneUeberstellung } from './wunschliste';

const STUNDE = 3_600_000;

function zeitText(t: number): string {
  const d = new Date(t);
  const tage = aktuelleSprache() === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${tage[d.getUTCDay()]} ${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}. ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
const datumStr = (t: number): string => new Date(t).toISOString().slice(0, 10);

const HALT_SCHLUESSEL: Record<HaltArt, string> = {
  tanken: 'ueb.haltTanken', nacht: 'ueb.haltNacht', ruhetag: 'ueb.haltRuhetag', ziel: 'ueb.haltZiel',
};

function haltText(x: { halt: keyof typeof HALT_SCHLUESSEL; ruhetage?: number }): string {
  return x.halt === 'ruhetag' && (x.ruhetage ?? 1) > 1 ? wort('ueb.haltRuhetage', { n: String(x.ruhetage) }) : wort(HALT_SCHLUESSEL[x.halt]);
}

function engeText(x: UeberstellungsSchlag): string | null {
  const d = x.enge;
  if (!d) return null;
  const sp = aktuelleSprache();
  const strom = d.mitlaufend
    ? wort(d.strom === 'montante' ? 'ueb.engeNordstrom' : 'ueb.engeSuedstrom', { kn: nf(Math.max(1, d.kn), 0, sp) })
    : wort('ueb.engeStauwasser');

  const name = sp === 'en' && d.name === 'Straße von Messina' ? 'Strait of Messina' : d.name;
  const teile = [`${name} ${zeitText(d.zeit)} ${strom}`];
  if (d.wartenMs >= 10 * 60_000) {
    teile.push(wort('ueb.engeWarten', { dauer: fmtDur(d.wartenMs / STUNDE) }));

    if (d.langsamKn != null) {
      teile.push(wort('ueb.engeLangsam', {
        ab: zeitText(x.abfahrt - d.wartenMs), sm: nf(d.vorlaufSm, 0, sp), kn: nf(d.langsamKn, 1, sp),
      }));
    }
  }
  return teile.join(' · ');
}

function neueEtappeId(): string {
  return `etappe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function ueberstellungVorschlagen(karte: L.Map | null, ebenen: L.LayerGroup | null): Promise<boolean> {
  const toern = app.toern;
  if (!toern || planungJetzt().planungsart !== 'ueberstellung') return false;
  const status = $('vp-automatik-status');
  const box = $('vp-woche-automatisch');
  const s = toern.start_hafen, z = toern.rueckgabe_hafen;
  if (!s || !z || !istUeberstellung(s, z) || !toern.von) {
    if (status) status.textContent = wort('ueb.rundtoern');
    return true;
  }
  const p = planungJetzt();
  const cfg = standardSchiffConfig(toern);
  const fahrtKn = p.ueberstellungFahrtKn || cfg.motorSpeed || 6;

  const kraft = tankVorschlag(toern, fahrtKn);
  const tankSm = p.tankReichweiteSm ?? kraft?.reichweiteSm ?? null;
  if (status) status.textContent = wort('ueb.rechnet');
  const ladeanzeige = $('vp-lade-anzeige');
  if (ladeanzeige) ladeanzeige.hidden = false;
  try {
    const r = await rechneUeberstellung({
      start: { ort: { lat: s.lat, lon: s.lon }, name: s.name },
      ziel: { ort: { lat: z.lat, lon: z.lon }, name: z.name },
      abfahrtIso: `${toern.von}T${toern.uebernahme_zeit || '10:00'}`,
      minSegelKn: cfg.minSailWind,
      vorgaben: {
        ...UEBERSTELLUNG_VORGABEN, fahrtKn, tankReichweiteSm: tankSm,
        maxHafennaechte: p.maxHafennaechte, ruhetage: p.freieRuhetage,
      },
    });
    if (!r.plan) {
      const tank = tankSm != null ? wort('ueb.keinPlanTank', { n: String(tankSm) }) : wort('ueb.keinPlanTankFrei');
      const naechte = p.maxHafennaechte != null ? wort('ueb.keinPlanNaechte', { n: String(p.maxHafennaechte) }) : wort('ueb.keinPlanNaechteFrei');
      const text = wort('ueb.keinPlan', { tank, naechte, ziel: z.name });
      if (box) box.innerHTML = `<p class="vp-hinweis">${escapeHtml(text)}</p>`;
      if (status) status.textContent = text;
      ebenen?.clearLayers();
      return true;
    }
    const plan = r.plan;
    const start = plan.schlaege[0]!.abfahrt;
    const tagVon = (t: number): number => Math.floor((Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate())
      - Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth(), new Date(start).getUTCDate())) / (24 * STUNDE)) + 1;
    const sp = aktuelleSprache();
    const ueberblick = wort('ueb.ueberblick', {
      von: s.name, ziel: z.name, sm: nf(plan.gesamtSm, 0, sp), motor: nf(plan.motorSm, 0, sp), dauer: fmtDur((plan.ankunft - start) / STUNDE),
      ankunft: zeitText(plan.ankunft), tankstopps: String(plan.schlaege.length - 1), naechte: String(plan.hafennaechte), kn: nf(fahrtKn, 1, sp),
    });
    const offen = istOffeneUeberstellung(toern);
    const zuSpaet = !offen && toern.bis && datumStr(plan.ankunft) > toern.bis ? wort('ueb.ueberEnde', { bis: toern.bis }) : '';
    const zeilen = plan.schlaege.map((x) => {
      const von = r.halte[x.vonIndex]!, nach = r.halte[x.nachIndex]!;
      return `<div role="listitem"><div class="vp-woche-zeile vp-ueb-zeile">
        <span class="vp-woche-tag">${escapeHtml(wort('ueb.ab'))} ${escapeHtml(zeitText(x.abfahrt))}</span>
        <span class="vp-woche-namen">${escapeHtml(von.name)} → ${escapeHtml(nach.name)}</span>
        <span class="vp-woche-sm">${smText(x.sm, 0, sp)}</span>
        <span class="vp-woche-dauer">${escapeHtml(fmtDur((x.ankunft - x.abfahrt) / STUNDE))}</span>
        <span class="vp-woche-ablegen">${escapeHtml(wort('ueb.an'))} ${escapeHtml(zeitText(x.ankunft))}</span>
        <span class="vp-woche-info">${escapeHtml([haltText(x), wort('ueb.motorSchlag', { n: nf(x.motorSm, 0, sp) }),
          ...(tankSm != null && x.motorSm > tankSm ? [wort('ueb.ueberReichweite')] : []),
          ...(engeText(x) ? [engeText(x)!] : [])].join(' · '))}</span>
      </div></div>`;
    }).join('');

    const dieselText = kraft
      ? [tankZeile(kraft.angabe, fahrtKn, sp),
        bedarfSatz(kraft.angabe, plan.motorSm, fahrtKn, sp, r.vorhersageBis != null && plan.ankunft > r.vorhersageBis),
        ...(p.tankReichweiteSm == null ? [wort('ueb.tankAusYacht', { n: String(kraft.reichweiteSm) })] : [])].join(' ')
      : '';
    const mitEnge = plan.schlaege.some((x) => x.enge);
    if (box) {
      box.innerHTML = `<p class="vp-woche-ueberblick">${escapeHtml(ueberblick)}</p>`
        + (r.wegGerade ? `<p class="vp-hinweis">${escapeHtml(wort('ueb.wegGerade'))}</p>` : '')
        + (tankSm != null ? `<p class="vp-hinweis">${escapeHtml(r.vorhersageBis != null
          ? wort('ueb.vorhersageBis', { bis: zeitText(r.vorhersageBis) }) : wort('ueb.ohneVorhersage'))}</p>` : '')
        + (dieselText ? `<p class="vp-hinweis">${escapeHtml(dieselText)}</p>` : '')
        + (mitEnge ? `<p class="vp-hinweis">${escapeHtml(wort('ueb.engeHinweis'))}</p>` : '')
        + (zuSpaet ? `<p class="vp-hinweis">${escapeHtml(zuSpaet)}</p>` : '')
        + (plan.ruhetageOhneHalt > 0 ? `<p class="vp-hinweis">${escapeHtml(wort('ueb.ruhetageOhneHalt', { n: String(plan.ruhetageOhneHalt) }))}</p>` : '')
        + `<div class="vp-woche-liste" role="list">${zeilen}</div>`;
    }

    const schlagPunkte = plan.schlaege.map((x) => {
      const von = r.halte[x.vonIndex]!, nach = r.halte[x.nachIndex]!;
      return [von.ort, ...wegStueck(r.weg, von.s, nach.s), nach.ort];
    });
    if (ebenen) {
      zeichneUeberstellung(
        ebenen,
        plan.schlaege.map((x, i) => ({
          punkte: schlagPunkte[i]!, tag: tagVon(x.ankunft),
          titel: `${r.halte[x.vonIndex]!.name} → ${r.halte[x.nachIndex]!.name}`,
        })),
        plan.schlaege.map((x, i) => ({
          ort: r.halte[x.nachIndex]!.ort, text: String(i + 1), tag: tagVon(x.ankunft),
          titel: `${i + 1}: ${r.halte[x.nachIndex]!.name}, ${zeitText(x.ankunft)}`,
        })),
      );
      if (karte) passeAusschnittAn(karte, ebenen);
    }

    const token = liesSitzungsToken();
    let gespeichert = false;
    if (token && !app.nurLesen) {
      const etappen: NeueEtappeDaten[] = plan.schlaege.map((x, i) => ({
        id: neueEtappeId(), nummer: i, gewaehlt: false, datum: datumStr(x.abfahrt),

        abfahrtZeit: new Date(x.abfahrt).toISOString().slice(11, 16),
        ankunftDatum: datumStr(x.ankunft) !== datumStr(x.abfahrt) ? datumStr(x.ankunft) : null,
        ankunftZeit: new Date(x.ankunft).toISOString().slice(11, 16),
        vonName: r.halte[x.vonIndex]!.name, nachName: r.halte[x.nachIndex]!.name,
        wegpunkte: schlagPunkte[i]!.map((q) => ({ lat: q.lat, lon: q.lon })), fixiert: false,
        notiz: `${wort('ueb.ab')} ${zeitText(x.abfahrt)}, ${wort('ueb.an')} ${zeitText(x.ankunft)}: ${haltText(x)}`
          + (engeText(x) ? `. ${engeText(x)}` : ''),
      }));
      gespeichert = await schreibeEtappen(token, toern.id, etappen, OPTION_SCHLUESSEL_1, null);
      const ankunft = datumStr(plan.ankunft);
      if (gespeichert && offen && toern.bis !== ankunft) {
        await schreibeAnkunftAlsBis(token, ankunft);
      }
    }
    if (status) {
      status.textContent = [
        gespeichert ? wort('ueb.gespeichert') : '',
        offen ? wort('automatik.ankunftUeberstellung', {
          ziel: z.name, datum: zeitText(plan.ankunft).slice(3, 9), tag: String(tagVon(plan.ankunft)),
        }) : '',
      ].filter(Boolean).join(' ');
    }
    return true;
  } finally {
    if (ladeanzeige) ladeanzeige.hidden = true;
  }
}
