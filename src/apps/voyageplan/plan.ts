import { sampleRoute } from '@/core/geo';
import { umfahreWegpunkte } from '@/data/umfahrung';
import { berechneTagesfenster } from '@/core/tagesfenster';
import { evaluateDeparture } from '@/core/evaluate';
import { polarSpeed } from '@/core/polar';
import { istUnfahrbarToern } from '@/briefing/verdict';
import { guenstigGrenze } from '@/briefing/window';
import { fetchWindForPoints, fetchDaylight } from '@/data/openMeteo';
import { GERECHNET_BIS_TAG, NORMALWIND_KN, NORMALWIND_TWA, LAGE_TEXT } from './konstanten';
import { tageszeileHtml, tabellenKopfHtml, wochentagAusIso, type Tageszeile } from './tageszeile';
import { OpenMeteoUeberlastet } from '@/data/openMeteoNetz';
import { nDate, nowInRevier, fmtTime, fmtDur, nf, uhrLt } from '@/core/time';
import { smText } from './einheit';
import type { SchiffConfig, Grenzwerte, Sprache, Ablegezeit } from '@/core/types';
import type { Daemmerungsstufe } from '@/core/sun';
import type { EtappenWegpunkt } from '@/data/toernApi';
import { escapeHtml } from '@/core/html';
import { anspruch, anspruchHtml, anspruchKompaktHtml, type Anspruch } from '@/briefing/anspruch';
import { faehrtDurchMessina } from '@/briefing/messina';
import { toernAnspruchHtml } from './wochenplanAutomatik';

import { lateinisch } from '@/core/umschrift';

export interface WochentabellenEtappe {
  id: string;
  vonName: string;
  nachName: string;

  datum: string;
  wegpunkte: EtappenWegpunkt[];

  hafentag?: boolean;

  abfahrtZeit?: string;

  ankunftDatum?: string;
}

export type WochentabellenRegime = 'gerechnet' | 'geruest' | 'fehler' | 'vorbei' | 'hafentag';

export interface WochentabellenZeile {
  id: string;
  datum: string;
  vonName: string;
  nachName: string;
  gesamtSm: number;
  regime: WochentabellenRegime;
  lage?: 'guenstig' | 'brauchbar' | 'unfahrbar';
  ablegen?: Date;
  dauerHrs?: number;
  maxWind?: number;
  maxGust?: number;
  istNachtschlag?: boolean;

  gewitter?: boolean;
  geschaetzteDauerHrs?: number;
  fehlertext?: string;

  geplantAb?: string;
  naechte?: number;

  anspruch?: Anspruch;

  geplant?: { ablegen: Date; ankunft: Date; dauerHrs: number; maxWind: number; maxGust: number; lage: 'guenstig' | 'brauchbar' | 'unfahrbar'; gewitter: boolean; jenseitsVorhersage?: boolean };
}

function lageVon(r: Ablegezeit, best: Ablegezeit): 'guenstig' | 'brauchbar' | 'unfahrbar' {
  return istUnfahrbarToern(r) ? 'unfahrbar' : (r.hasStorm || r.score > guenstigGrenze(best) ? 'brauchbar' : 'guenstig');
}

async function berechneZeile(
  e: WochentabellenEtappe, grenzTag: Date, heuteIso: string, cfg: SchiffConfig, limits: Grenzwerte,
  daemmerung: Daemmerungsstufe, stepMin: number, sampleStepNM: number, sprache: Sprache,
): Promise<WochentabellenZeile> {
  let points = sampleRoute(e.wegpunkte, sampleStepNM);
  let gesamtSm = points[points.length - 1]?.cum ?? 0;
  const naechte = e.ankunftDatum && e.ankunftDatum > e.datum
    ? Math.round((Date.parse(`${e.ankunftDatum}T00:00:00Z`) - Date.parse(`${e.datum}T00:00:00Z`)) / 86_400_000) : 0;
  const basis = {
    id: e.id, datum: e.datum, vonName: e.vonName, nachName: e.nachName, gesamtSm,
    ...(e.abfahrtZeit ? { geplantAb: e.abfahrtZeit } : {}), ...(naechte > 0 ? { naechte } : {}),
  };
  if (e.hafentag) return { ...basis, gesamtSm: 0, regime: 'hafentag' };

  const tagDatum = nDate(`${e.datum}T12:00:00`);
  if (e.datum < heuteIso) return { ...basis, regime: 'vorbei' };
  if (tagDatum > grenzTag) {
    const normalwindKn = Math.max(polarSpeed(NORMALWIND_KN, NORMALWIND_TWA, cfg.crewFactor, cfg.boat), cfg.motorSpeed);
    return { ...basis, regime: 'geruest', geschaetzteDauerHrs: gesamtSm / normalwindKn };
  }

  try {

    const umfahren = await umfahreWegpunkte(e.wegpunkte).catch(() => null);
    if (umfahren && umfahren.umfahreneAbschnitte.length > 0) {
      points = sampleRoute(umfahren.punkte, sampleStepNM);
      gesamtSm = points[points.length - 1]?.cum ?? 0;
      basis.gesamtSm = gesamtSm;
    }
    const { hourly: windData, utcOffsetSeconds } = await fetchWindForPoints(points);
    const zeitreihe = windData[0]?.time;
    if (!zeitreihe || zeitreihe.length === 0) {
      return { ...basis, regime: 'fehler', fehlertext: sprache === 'en' ? 'No wind data received.' : 'Keine Winddaten erhalten.' };
    }
    const forecastEnd = nDate(zeitreihe[zeitreihe.length - 1]!);
    const daylight = await fetchDaylight(points[points.length - 1]!.lat, points[points.length - 1]!.lon);
    const jetzt = nowInRevier(utcOffsetSeconds);
    const f = berechneTagesfenster(
      e.datum, daemmerung, stepMin, points[0]!, points, windData, null, cfg, limits, daylight,
      utcOffsetSeconds, forecastEnd, jetzt, sprache,
    );
    if (!f.best) {
      return { ...basis, regime: 'fehler', fehlertext: f.fehler ?? (sprache === 'en' ? 'Unknown error.' : 'Unbekannter Fehler.') };
    }
    const b = f.best;

    const lage = lageVon(b, b);

    let geplant: WochentabellenZeile['geplant'];
    if (e.abfahrtZeit && /^\d{2}:\d{2}$/.test(e.abfahrtZeit)) {
      const ab = nDate(`${e.datum}T${e.abfahrtZeit}:00`);

      if (e.datum > heuteIso || ab >= jetzt) {
        const r = evaluateDeparture(ab, points, windData, null, cfg, limits, daylight, utcOffsetSeconds);

        geplant = {
          ablegen: ab, ankunft: r.arrival, dauerHrs: r.totalHrs, maxWind: r.maxWind, maxGust: r.maxGust, lage: lageVon(r, b), gewitter: r.hasStorm,
          ...(r.beyondForecast ? { jenseitsVorhersage: true } : {}),
        };
      }
    }
    const tageVoraus = Math.max(0, Math.round((Date.parse(`${e.datum}T12:00:00Z`) - Date.parse(`${heuteIso}T12:00:00Z`)) / 86_400_000));
    const a = anspruch({
      dauerHrs: b.totalHrs, maxWindKn: b.maxWind, maxBoeKn: b.maxGust,
      maxHsM: b.seaValid ? b.maxHs : null, kreuzAnteil: cfg.model === 'polar' ? b.vmgShare : null,
      dunkelHrs: b.dunkelHrs, nachtfahrt: f.istNachtschlag, gewitter: b.events.some((ev) => ev.type === 'gewitter'),
      nichtFahrbar: lage === 'unfahrbar',
      zeitfenster: faehrtDurchMessina(points) ? (sprache === 'en' ? 'Strait of Messina' : 'Straße von Messina') : null,
      tageVoraus, jenseitsVorhersage: b.beyondForecast,
      crewZumutbarkeit: cfg.model === 'polar' ? (cfg.crewZumutbarkeit ?? null) : null,
    }, sprache);
    return {
      ...basis, regime: 'gerechnet', lage, ablegen: b.departure, dauerHrs: b.totalHrs,
      maxWind: b.maxWind, maxGust: b.maxGust, istNachtschlag: f.istNachtschlag,
      ...(b.hasStorm ? { gewitter: true } : {}), anspruch: a, ...(geplant ? { geplant } : {}),
    };
  } catch (err) {
    const text = err instanceof OpenMeteoUeberlastet
      ? (sprache === 'en'
        ? 'Weather service temporarily overloaded or unreachable.'
        : 'Wetterdienst gerade überlastet oder nicht erreichbar.')

      : istZeitOderNetz(err)
        ? (sprache === 'en' ? 'Weather service did not answer in time.' : 'Wetterdienst hat nicht rechtzeitig geantwortet.')
        : (err as Error).message;
    return { ...basis, regime: 'fehler', fehlertext: text };
  }
}

export async function berechneWochentabelle(
  etappen: readonly WochentabellenEtappe[],
  cfg: SchiffConfig, limits: Grenzwerte, daemmerung: Daemmerungsstufe, stepMin: number,
  sampleStepNM: number, sprache: Sprache,

  heute: Date = new Date(),
): Promise<WochentabellenZeile[]> {
  const grenzTag = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + GERECHNET_BIS_TAG, 23, 59);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const heuteIso = `${heute.getFullYear()}-${p2(heute.getMonth() + 1)}-${p2(heute.getDate())}`;
  const sortiert = [...etappen].sort((a, b) => a.datum.localeCompare(b.datum));
  return Promise.all(sortiert.map((e) => berechneZeile(
    e, grenzTag, heuteIso, cfg, limits, daemmerung, stepMin, sampleStepNM, sprache,
  )));
}

export function renderWochentabelle(zeilen: readonly WochentabellenZeile[], sprache: Sprache): void {
  const box = document.getElementById('vp-wochentabelle');
  if (!box) return;
  const en = sprache === 'en';

  if (zeilen.length === 0) {
    box.innerHTML = `<p class="vp-hinweis">${en
      ? 'No dated leg yet: set a date on a leg to see it here.'
      : 'Noch keine datierte Etappe: einer Etappe ein Datum geben, um sie hier zu sehen.'}</p>`;
    return;
  }

  const ansprueche = zeilen.flatMap((z, i) => (z.anspruch ? [{ tag: i + 1, a: z.anspruch }] : []));
  box.innerHTML = toernAnspruchHtml(ansprueche, sprache)
    + `<div class="vp-woche-liste" role="list" aria-label="${en ? 'Dated legs' : 'Datierte Etappen'}">`
    + tabellenKopfHtml(sprache) + zeilen.map((z, i) => {
    const route = `${lateinisch(z.vonName)} → ${lateinisch(z.nachName)}`;
    const wann = wochentagAusIso(z.datum, sprache) ?? z.datum;

    const geplant = [
      z.geplantAb ? (en ? `planned dep. ${z.geplantAb}` : `geplant ab ${z.geplantAb}`) : '',
      z.naechte ? (z.naechte === 1 ? (en ? 'night passage' : 'Nachtfahrt') : (en ? `${z.naechte} nights at sea` : `${z.naechte} Nächte unterwegs`)) : '',
    ].filter(Boolean).join(', ');
    const geplantHtml = geplant ? `<p class="vp-woche-info">${escapeHtml(geplant)}</p>` : '';
    const info = (t: string): string => `<p class="vp-woche-info">${escapeHtml(t)}</p>`;
    const zeile = (x: Omit<Tageszeile, 'tag' | 'wann'>): string =>
      `<div role="listitem">${tageszeileHtml({ tag: i + 1, wann, ...x }, sprache)}</div>`;

    if (z.regime === 'hafentag') {
      return zeile({
        route: en ? `Day in port: ${lateinisch(z.nachName)}` : `Hafentag in ${lateinisch(z.nachName)}`, ort: lateinisch(z.nachName),
        klassen: ['vp-woche-hafentag'], lage: { klasse: 'hafentag', text: en ? 'Day in port' : 'Hafentag' },
      });
    }

    if (z.regime === 'vorbei') {
      return zeile({
        route, klassen: ['vp-woche-vorbei'],
        lage: { klasse: 'vorbei', text: en ? 'past' : 'vorbei' },
        mehr: info(en ? 'In the past: what counts now is what was sailed' : 'Vorbei: hier zählt, was gefahren wurde'),
      });
    }

    if (z.regime === 'fehler') {
      return zeile({
        route, klassen: ['vp-woche-fehler'],
        lage: { klasse: 'fehler', text: en ? 'not calculated' : 'nicht berechnet' },
        mehr: info(z.fehlertext ?? (en ? 'Could not be calculated.' : 'Konnte nicht berechnet werden.')),
      });
    }

    if (z.regime === 'geruest') {
      return zeile({
        route, klassen: ['vp-woche-geruest'],
        sm: smText(z.gesamtSm, 1, sprache),
        dauer: `~${fmtDur(z.geschaetzteDauerHrs ?? 0)}`,
        lage: { klasse: 'geruest', text: en ? 'estimated' : 'geschätzt' },
        mehr: info(en ? 'No forecast yet: passage time estimated' : 'Noch keine Vorhersage: Fahrzeit geschätzt') + geplantHtml,
      });
    }

    const lage = z.lage ?? 'brauchbar';
    const gewitter = en ? 'Thunderstorms possible' : 'Gewitter möglich';

    const g = z.geplant;
    const geplantGerechnet = g ? `<p class="vp-woche-info vp-woche-geplant"><span class="vp-woche-badge vp-lage-${g.lage}" aria-hidden="true"></span> ${escapeHtml(
      (en ? `Planned ${uhrLt(g.ablegen)}: ${fmtDur(g.dauerHrs)}, arrival ${uhrLt(g.ankunft)}, wind ${nf(g.maxWind, 0, sprache)}/${nf(g.maxGust, 0, sprache)} kn, `
        : `Geplant ${uhrLt(g.ablegen)}: ${fmtDur(g.dauerHrs)}, Ankunft ${uhrLt(g.ankunft)}, Wind ${nf(g.maxWind, 0, sprache)}/${nf(g.maxGust, 0, sprache)} kn, `)
      + LAGE_TEXT[sprache][g.lage] + (g.gewitter ? (en ? ', thunderstorms possible' : ', Gewitter möglich') : '')
      + (g.jenseitsVorhersage ? (en ? ', runs beyond the end of the forecast' : ', reicht über das Vorhersageende') : ''))}</p>` : '';
    return zeile({
      route, klassen: ['vp-woche-gerechnet', `vp-lage-${lage}`],
      sm: smText(z.gesamtSm, 1, sprache),
      ablegen: z.ablegen ? fmtTime(z.ablegen) : null,
      dauer: fmtDur(z.dauerHrs ?? 0),
      wind: `${nf(z.maxWind ?? 0, 0, sprache)}/${nf(z.maxGust ?? 0, 0, sprache)} kn`,

      lage: { klasse: lage, text: LAGE_TEXT[sprache][lage] },
      routeZusatz: (z.istNachtschlag ? `<span class="vp-woche-nacht" aria-hidden="true">🌙</span><span class="vp-sr-only">${en ? 'Night passage' : 'Nachtfahrt'}</span>` : '')
        + (z.gewitter ? `<span class="vp-woche-gewitter"><span aria-hidden="true">⚡</span><span class="vp-sr-only">${gewitter}</span></span>` : '')
        + (z.anspruch ? anspruchKompaktHtml(z.anspruch, sprache) : ''),
      mehr: (z.anspruch ? anspruchHtml(z.anspruch, sprache) : '') + (geplantGerechnet || geplantHtml) + (z.gewitter ? `<p class="vp-woche-gewitter-text"><span aria-hidden="true">⚡</span> ${gewitter}</p>` : ''),
    });
  }).join('') + '</div>';
}

function istZeitOderNetz(err: unknown): boolean {
  const name = (err as { name?: unknown } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError' || (err instanceof TypeError && /fetch|network|load failed/i.test(err.message));
}

