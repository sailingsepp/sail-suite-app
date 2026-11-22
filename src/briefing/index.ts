import { profilOhneLiegeplaetze, untiefen as untiefenAufStrecke } from '@/core/tiefe';
import { nf, uhrLt, fmtDur, localDateStr, tagKurz } from '@/core/time';
import { escapeHtml } from '@/core/html';
import { noetigeFahrt } from '@/core/ankunftszeit';
import type { Ablegezeit } from '@/core/types';
import { bestWindow, windowText, guenstigGrenze } from './window';
import { kernUndRest } from './kern';
import { describeZeitwahl } from './tradeoff';
import { istUnfahrbar, sturm } from './verdict';
import { describeWind, describeBoeenfaktor, anzeigeKn, beaufort } from './wind';
import { describeCourse } from './course';
import { describeSegelfuehrung, reffZeitpunkt } from './sails';
import { describeTrimm } from './trim';
import { describeAusweichziele, type AusweichzielText } from './alternatives';
import { describeMessina, describeMessinaAblegezeit } from './messina';
import { describeEngstellen } from './passages';
import { describeSchutzgebiete } from './parks';
import { describeNachtfahrt, nachtreffHinweis, nachtImFazit, type NachtfahrtEingabe } from './nightpassage';
import { describeSea } from './sea';
import { describePrecip, describeWarnings } from './weather';
import {
  describeAnkertiefe, describeUntiefen, describeFlachwasserSee, type Tiefenlage,
} from './tiefe';
import { describeSeegebiet, type Gebietsangabe } from './seegebiet';
import { abschiedsgruss, zielStaat } from './abschied';
import { localWind, describeBoraWetterlage, erkannterLokalwind, type WindKey } from './localWinds';
import { warnSaetze, warnFazit } from './warnungen';
import type { WarnTreffer } from '@/core/warnungen';
import { describeAmtlicherBericht, describeZweitfassung, amtlicheWarnung, amtlicheWarnungKurz, amtlicheWarnungAnderswo, amtlicheWarnungAnderswoSatz, amtlicheBoeen, amtlicheGewitter, amtlicherDienst, amtlicherVorbehalt, giltBisZusatz, amtlicheStaerke, douglasSpanne, type AmtlicherBericht, type AmtlicheBoeen, type AmtlicheTendenz } from './amtlich';
import type { Synoptik } from './synoptik';
import { verdict } from './verdict';
import { describeVerlauf, describeSeegangVerlauf, type VerlaufPunkt } from './profile';
import { describeNachtAmZiel, describeTagAmZiel, type SkipperGuideZitat } from './night';
import { describeHafensteckbrief, type HafensteckbriefEingabe } from './hafeninfo';
import { describeGezeiten, type GezeitenAbsatzEingabe } from './gezeiten';
import { describeAntrieb } from './antrieb';
import type { Antriebsphase } from '@/core/antrieb';
import type { Kuestenlinie } from '@/core/shelter';
import type { Druckanalyse } from '@/core/druckfeld';
import type { StundenWind, Tageslicht, AnkerplatzArt, Punkt, Gezeit, Sprache } from '@/core/types';
import type { KraftstoffAngabe } from '@/core/kraftstoff';
import { motorTagSatz } from './kraftstoff';
import type { KritischTexte } from './kritisch';
import type { Modellabgleich } from '@/core/modellabgleich';
import { warnungModellabgleich, SEGELWIND_SATZ } from './modellabgleich';
import { segelwindWaehrend } from '@/core/modellabgleich';
import { describeHalte, DUNKEL_AB_MIN } from './halt';

export type AbschnittLage = 'ok' | 'beachten' | 'kritisch';

export interface BriefingAbschnitt {
  titel: string;
  text: string;

  art?: string;

  lage?: AbschnittLage;

  kern?: string;

  eintraege?: { text: string; lage: AbschnittLage }[];
}

function mitKern(a: BriefingAbschnitt): BriefingAbschnitt {
  if (a.art === 'fazit' || a.art === 'warnungen') return a;
  const k = kernUndRest(a.text);
  return k ? { ...a, kern: k.kern } : a;
}

const ABSATZ = /\s*<div class="brief-absatz">[\s\S]*?<\/div>/;

export function ohneWiederholteRevierkunde(
  text: string | null, wetterlage: string | null, sprache: Sprache, name: string | null = null,
): string | null {
  if (!text || !wetterlage) return text;
  const absatz = /(<div class="brief-absatz">)([\s\S]*?)(<\/div>)/.exec(text);
  if (!absatz) return text;
  const saetze = absatz[2]!.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"<])/);
  const bleiben = saetze.filter((s) => s.trim().length < 40 || !wetterlage.includes(s.trim()));
  if (bleiben.length === saetze.length) return text;

  const artikel = name === 'Bora' || name === 'Tramontana' ? 'zur' : 'zum';
  const verweis = sprache === 'en'
    ? `${name ? `This fits the ${name}; what` : 'What'} the area knows about this wind is under Weather.`
    : `${name ? `Die Lage passt ${artikel} ${name}; was` : 'Was'} das Revier über diesen Wind weiß, steht unter Wetterlage.`;

  const neu = [verweis, ...bleiben.map((s) => s.trim()).filter(Boolean)].join(' ');
  return text.replace(absatz[0], `${absatz[1]}${neu}${absatz[3]}`);
}

function ohneDoppeltenAbsatz(text: string, vorheriger: string): string {
  const eigener = ABSATZ.exec(text)?.[0]?.trim();
  const anderer = ABSATZ.exec(vorheriger)?.[0]?.trim();
  return eigener && eigener === anderer ? text.replace(ABSATZ, '') : text;
}

export const HOHER_MOTORANTEIL = 0.5;

export function buildBriefing(
  best: Ablegezeit,
  results: Ablegezeit[],
  revierWetter?: string | null,
  track?: VerlaufPunkt[] | null,
  zielHourly?: StundenWind | null,
  tageslicht?: Tageslicht | null,
  ankerplatzArt?: AnkerplatzArt,
  ziel?: Punkt | null,
  ausweichziele?: AusweichzielText[] | null,
  nachtfahrt?: NachtfahrtEingabe | null,
  gezeitZiel?: Gezeit | null,
  syn?: Synoptik | null,
  motorSpeed?: number | null,

  crewZumutbarkeit?: number | null,

  empfohlen?: Ablegezeit | null,

  antrieb?: Antriebsphase[] | null,

  zielKueste?: Kuestenlinie | null,

  skipperGuide?: SkipperGuideZitat | null,

  skipperGuideLaedt = false,

  druckanalyse?: Druckanalyse | null,

  tiefe?: Tiefenlage | null,

  seegebiet?: Gebietsangabe | null,

  sprache: Sprache = 'de',

  skipperGuideLage: 'kein-eintrag' | 'fehlgeschlagen' | null = null,

  hafen: HafensteckbriefEingabe | null = null,

  amtlich: AmtlicherBericht | AmtlicherBericht[] | null = null,

  gezeiten: GezeitenAbsatzEingabe | null = null,

  boeGrenze: number | null = null,

  kritisch: KritischTexte | null = null,

  kraftstoff: KraftstoffAngabe | null = null,

  modellabgleich: Modellabgleich | null = null,

  unterwegs = false,

  ankunftSoll: { ziel: Date; zuSpaet: Date | null; heute?: string } | null = null,

  wetterwarnungen: { treffer: WarnTreffer[]; stand: string | null } | null = null,
): BriefingAbschnitt[] {
  const abschnitte: BriefingAbschnitt[] = [];

  const ref = empfohlen ?? best;
  const istEmpfehlung = ref === best;
  const en = sprache === 'en';

  const tagStr = localDateStr(best.departure);
  const amtlicheListe = amtlich ? (Array.isArray(amtlich) ? amtlich : [amtlich]) : [];

  const amtBoe = amtlicheListe.map((b) => amtlicheBoeen(b, tagStr, best.departure, track ?? null)).find((x) => x) ?? null;
  const amtDeutlichMehr = !!amtBoe && amtBoe.bis >= best.maxGust + 5;
  const amtVorspann = amtDeutlichMehr ? amtlicherBoeenSatz(amtBoe!, best, sprache) : '';
  const amtVorbehalt = boeGrenze != null ? amtlicherVorbehalt(amtlicheListe, tagStr, boeGrenze, best.departure, track ?? null) : null;

  const rechnungBft = beaufort(anzeigeKn(best.maxWind));
  const amtStaerkeRoh = amtlicheStaerke(amtlicheListe, best.departure, best.arrival);
  const amtStaerker = amtStaerkeRoh && amtStaerkeRoh.bft >= rechnungBft + 2 ? amtStaerkeRoh : null;

  const routeNM = best.waterNM - best.extraNM;
  const monat = best.departure.getUTCMonth() + 1;
  const lw = localWind(best, monat, syn ?? null, routeNM > 0 ? routeNM : null, druckanalyse ?? null, sprache);
  const lwKey = lw ? erkannterLokalwind(best, monat, syn ?? null) : null;

  const vorspann = kritisch?.wetterlage ?? amtVorspann;

  const modellWarn = warnungModellabgleich(modellabgleich, sprache, { ab: best.departure, an: best.arrival });

  const segelwindFahrt = !!modellabgleich && segelwindWaehrend(modellabgleich, best.departure, best.arrival);
  const wetterText = (modellWarn && segelwindFahrt) || !segelwindFahrt
    ? (revierWetter ?? '').replace(SEGELWIND_SATZ, '') : (revierWetter ?? '');
  const wetterTeile = [(vorspann ? `${vorspann} ` : '') + wetterText, lw ? ` <div class="brief-absatz">${lw}</div>` : '']
    .filter(Boolean).join('');
  if (wetterTeile) {
    abschnitte.push({
      titel: en ? 'Weather' : 'Wetterlage', text: wetterTeile, art: 'wetter',
      lage: kritisch?.wetterlage ? 'kritisch' : amtDeutlichMehr ? 'beachten' : 'ok',
    });
  }

  if (amtlicheListe.length) {
    const gewarnt = amtlicheListe.some((b) => amtlicheWarnung(b, tagStr, sprache, best.departure));
    abschnitte.push({
      titel: en ? 'Official marine forecast' : 'Amtlicher Seewetterbericht', art: 'amtlich',
      lage: amtDeutlichMehr ? 'kritisch' : gewarnt ? 'beachten' : 'ok',
      text: amtlicheListe.map((b, i) => (i === 0
        ? describeAmtlicherBericht(b, tagStr, sprache, best.departure)
        : describeZweitfassung(b, tagStr, sprache))).join(''),
    });
  }

  if (unterwegs) {
    const U: string[] = [];
    const unfahrbar = istUnfahrbar(best);
    U.push(en
      ? `Calculated from now, ${uhrLt(best.departure)}, from the start point. No departure time was searched.`
      : `Gerechnet ab jetzt, ${uhrLt(best.departure)}, vom Startpunkt aus. Eine Ablegezeit wurde nicht gesucht.`);

    if (ankunftSoll) U.push(ankunftUnterwegsSatz(best, ankunftSoll.ziel, sprache));
    if (amtVorbehalt && !unfahrbar && !best.hasStorm) U.push(vorbehaltSatz(amtVorbehalt, boeGrenze!, sprache));
    if (kritisch?.ablegezeit && !unfahrbar) U.push(kritisch.ablegezeit);
    if (best.hasStorm) {
      U.push(en ? 'A thunderstorm sits on the route.' : 'Auf der Route steht ein Gewitter.');
    } else if (unfahrbar) {
      U.push(en
        ? 'From now, the passage exceeds the configured limits. Check the alternative destinations.'
        : 'Ab jetzt überschreitet die Fahrt die eingestellten Grenzwerte. Die Ausweichziele prüfen.');
    }
    abschnitte.push({
      titel: en ? 'Underway' : 'Unterwegs', text: U.join(' '), art: 'ablegezeit',
      lage: unfahrbar || best.hasStorm ? 'kritisch' : amtVorbehalt || kritisch?.ablegezeit ? 'beachten' : 'ok',
    });
  }

  if (ankunftSoll && !unterwegs) {
    const T: string[] = [];
    const unfahrbar = istUnfahrbar(best);
    const tag = (d: Date) => {
      const tage = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        - Date.UTC(best.departure.getUTCFullYear(), best.departure.getUTCMonth(), best.departure.getUTCDate())) / 86_400_000);
      const zusatz = tage === 1 ? (en ? ' the next day' : ' am nächsten Tag') : tage === -1 ? (en ? ' the day before' : ' am Vortag') : '';
      return en ? `${uhrLt(d)}${zusatz}` : `${uhrLt(d)}${zusatz}`;
    };
    if (ankunftSoll.zuSpaet) {
      T.push(en
        ? `For arrival at ${tag(ankunftSoll.ziel)} you would have had to leave at ${tag(ankunftSoll.zuSpaet)}. Calculated from now, ${tag(best.departure)}, arrival is around ${tag(best.arrival)}.`
        : `Für die Ankunft um ${tag(ankunftSoll.ziel)} hätte um ${tag(ankunftSoll.zuSpaet)} abgelegt werden müssen. Gerechnet ab jetzt, ${tag(best.departure)}, ist die Ankunft gegen ${tag(best.arrival)}.`);
    } else {

      const ablegeTag = ankunftSoll.heute && localDateStr(best.departure) !== ankunftSoll.heute ? tagKurz(localDateStr(best.departure), sprache) : null;
      T.push(en
        ? `The departure time is calculated for arrival at ${tag(ankunftSoll.ziel)}: leave ${ablegeTag ? `on ${ablegeTag} ` : ''}at ${tag(best.departure)}, calculated with the forecast wind and stream and the time for manoeuvres.`
        : `Die Ablegezeit ist für die Ankunft um ${tag(ankunftSoll.ziel)} gerechnet: ablegen ${ablegeTag ? `am ${ablegeTag} ` : ''}um ${tag(best.departure)}, gerechnet mit Wind und Strom nach der Vorhersage und der Manöverzeit.`);
    }
    if (amtVorbehalt && !unfahrbar && !best.hasStorm) T.push(vorbehaltSatz(amtVorbehalt, boeGrenze!, sprache));
    if (kritisch?.ablegezeit && !unfahrbar) T.push(kritisch.ablegezeit);

    if (best.messinaEinfahrt && !best.messinaEinfahrt.imFenster) {
      T.push(en
        ? 'The entrance to the Strait of Messina is then reached outside a favourable window; see the section Strait of Messina.'
        : 'Die Einfahrt in die Straße von Messina erreicht die Yacht damit außerhalb eines günstigen Fensters; siehe den Abschnitt Straße von Messina.');
    }
    if (best.hasStorm) {
      T.push(en ? 'A thunderstorm sits on the route.' : 'Auf der Route steht ein Gewitter.');
    } else if (unfahrbar) {
      T.push(en
        ? 'At this time the passage exceeds the configured limits. Check the alternative destinations or another arrival time.'
        : 'Zu dieser Zeit überschreitet die Fahrt die eingestellten Grenzwerte. Die Ausweichziele oder eine andere Ankunftszeit prüfen.');
    }
    abschnitte.push({
      titel: en ? 'Departure time' : 'Ablegezeit', text: T.join(' '), art: 'ablegezeit',
      lage: unfahrbar || best.hasStorm ? 'kritisch'
        : ankunftSoll.zuSpaet || amtVorbehalt || kritisch?.ablegezeit || (best.messinaEinfahrt && !best.messinaEinfahrt.imFenster) ? 'beachten' : 'ok',
    });
  }

  const w = bestWindow(results, ref);
  const A: string[] = [];

  const ganztags = w.atStart && w.atEnd;
  const alleSchlecht = results.every(istUnfahrbar);
  const messinaZeit = istEmpfehlung && !unterwegs && !ankunftSoll ? describeMessinaAblegezeit(ref, results, sprache) : null;

  if (!istEmpfehlung) {
    A.push(en
      ? `<b>Looking at ${uhrLt(best.departure)}: a custom time you selected, not the recommendation.</b>`
      : `<b>Angesehen wird ${uhrLt(best.departure)}: eine selbst gewählte Zeit, nicht die Empfehlung.</b>`);
  }

  if (amtVorbehalt && !alleSchlecht && !ref.hasStorm) A.push(vorbehaltSatz(amtVorbehalt, boeGrenze!, sprache));
  if (kritisch?.ablegezeit && !alleSchlecht) A.push(kritisch.ablegezeit);
  if (alleSchlecht && !ref.hasStorm) {

    const absage = sturm(ref);
    if (en) {
      A.push((absage ? 'You should not set out on this day. ' : '')
        + `None of the ${results.length} tested departure times stays within the set limits.`);
      A.push(`The least unfavourable would be ${uhrLt(ref.departure)}, and only relatively so.`);
    } else {
      A.push((absage ? 'An diesem Tag sollte nicht ausgelaufen werden. ' : '')
        + `Keine der ${results.length} geprüften Ablegezeiten bleibt innerhalb der eingestellten Grenzwerte.`);
      A.push(`Am wenigsten ungünstig wäre ${uhrLt(ref.departure)}, und auch das nur relativ.`);
    }
  } else if (ref.hasStorm) {
    if (en) {
      A.push('No departure time can be recommended for this day. A thunderstorm sits on the route.');
      A.push(`The most favourable of the tested times would have been ${uhrLt(ref.departure)}.`);
    } else {
      A.push('Für diesen Tag ist keine Ablegezeit zu empfehlen. Auf der Route steht ein Gewitter.');
      A.push(`Die günstigste der geprüften Zeiten wäre ${uhrLt(ref.departure)} gewesen.`);
    }
  } else if (messinaZeit && ref.messinaEinfahrt?.imFenster) {

    messinaZeit.forEach((x) => A.push(x));
  } else if (ganztags) {

    messinaZeit?.forEach((x) => A.push(x));
    A.push(en
      ? 'Conditions are similar across the whole tested time window. You can depart any time between '
        + `${uhrLt(w.from)} and ${uhrLt(w.to)}, best by calculation at ${uhrLt(ref.departure)}.`
      : 'Die Bedingungen sind über das ganze geprüfte Zeitfenster ähnlich. Ablegen kann man jederzeit zwischen '
        + `${uhrLt(w.from)} und ${uhrLt(w.to)}, rechnerisch am besten um ${uhrLt(ref.departure)}.`);
  } else {

    messinaZeit?.forEach((x) => A.push(x));
    windowText(ref, w, sprache).forEach((x) => A.push(x));
  }

  const zeitwahl = ref.messinaEinfahrt?.imFenster && messinaZeit ? null : describeZeitwahl(ref, results, motorSpeed, sprache);
  if (zeitwahl) A.push(zeitwahl);

  if (!unterwegs && !ankunftSoll) abschnitte.push({
    titel: en ? 'Departure time' : 'Ablegezeit', text: A.join(' '), art: 'ablegezeit',
    lage: alleSchlecht || ref.hasStorm ? 'kritisch'
      : amtVorbehalt || kritisch?.ablegezeit || !istEmpfehlung || ref.score > guenstigGrenze(ref) ? 'beachten' : 'ok',
  });

  const V: string[] = [];
  const verlauf = track ? describeVerlauf(track, sprache) : null;
  if (verlauf) {
    V.push(verlauf);
    const bf = describeBoeenfaktor(best, sprache);
    if (bf) V.push(bf);
  } else {
    V.push(describeWind(best, sprache));
  }

  const halteText = describeHalte(best.halte, sprache);
  V.push(describeCourse(best, sprache));
  V.push(describeSea(best, sprache));

  const seeVerlauf = describeSeegangVerlauf(track ?? null, sprache);
  if (seeVerlauf) V.push(seeVerlauf);
  const rain = describePrecip(best, sprache);
  if (rain) V.push(rain);
  if (best.maxCurrent >= 0.3) {
    if (en) {
      V.push(`Current up to ${nf(best.maxCurrent, 1, 'en')} kn, `
        + (best.currentGainMin >= 0 ? `saves roughly ${Math.round(best.currentGainMin)} min.` : `costs roughly ${Math.round(-best.currentGainMin)} min.`));
    } else {
      V.push(`Strom bis ${nf(best.maxCurrent, 1)} kn, `
        + (best.currentGainMin >= 0 ? `spart rund ${Math.round(best.currentGainMin)} min.` : `kostet rund ${Math.round(-best.currentGainMin)} min.`));
    }
  }

  const antriebText = antrieb ? describeAntrieb(antrieb, sprache) : null;
  if (antriebText) {
    V.push(antriebText);
  } else if (best.motorShare > 0.05 && best.motorShare <= 0.7) {
    V.push(en
      ? `The engine runs for ${Math.round(best.motorShare * 100)} % of the route.`
      : `Auf ${Math.round(best.motorShare * 100)} % der Strecke läuft die Maschine.`);
  }

  if (kraftstoff && motorSpeed && motorSpeed > 0 && best.motorShare >= HOHER_MOTORANTEIL) {
    V.push(motorTagSatz(kraftstoff, best.motorShare * best.avgSpeed * best.sailHrs, motorSpeed, sprache));
  }

  const lwStrecke = lwKey ? revierwindAufStrecke(lwKey, best, sprache) : null;
  if (lwStrecke) V.push(lwStrecke);
  abschnitte.push({
    titel: en ? 'Progress' : 'Verlauf', text: V.join(' '), art: 'verlauf',
    lage: istUnfahrbar(best) ? 'kritisch' : best.score > guenstigGrenze(ref) ? 'beachten' : 'ok',
  });
  if (halteText) {
    const mehrere = (best.halte?.length ?? 0) > 1;
    abschnitte.push({
      titel: en ? (mehrere ? 'Stops' : 'Stop') : (mehrere ? 'Aufenthalte' : 'Aufenthalt'), text: halteText, art: 'aufenthalt',
      lage: best.halte?.some((h) => (h.dunkelMin ?? 0) >= DUNKEL_AB_MIN) ? 'beachten' : 'ok',
    });
  }

  const messina = describeMessina(track ?? null, best, sprache, unterwegs);
  if (messina) abschnitte.push({ titel: en ? 'Strait of Messina' : 'Straße von Messina', text: messina, art: 'messina', lage: 'beachten' });

  for (const e of describeEngstellen(track ?? null, sprache)) {
    abschnitte.push({ titel: e.titel, text: e.text, art: 'engstelle', lage: 'beachten' });
  }

  const nachtText = nachtfahrt ? describeNachtfahrt(nachtfahrt, sprache) : null;
  if (nachtText) abschnitte.push({ titel: en ? 'The night underway' : 'Die Nacht unterwegs', text: nachtText, art: 'nacht', lage: 'beachten' });

  const segelGanz = describeSegelfuehrung(best, sprache);
  const reffZeit = segelGanz ? reffZeitpunkt(track ?? null, sprache) : null;
  const segel = segelGanz && reffZeit ? `${segelGanz} ${reffZeit}` : segelGanz;

  const nachtreff = nachtfahrt ? nachtreffHinweis(nachtfahrt.dunkel, best, sprache, track ?? null) : null;
  const segelText = [segel, nachtreff].filter(Boolean).join(' ') || null;
  const trimm = describeTrimm(best, sprache);
  const segelTrimmText = segelText && trimm
    ? `${segelText} <div class="brief-absatz">${trimm}</div>`
    : segelText ?? trimm;
  if (segelTrimmText) {
    abschnitte.push({ titel: en ? 'Sail plan' : 'Segelführung', text: segelTrimmText, art: 'segel', lage: 'ok' });
  }

  for (const s of describeSchutzgebiete(ziel ?? null, track ?? null, sprache)) {
    abschnitte.push({ titel: s.titel, text: s.text, art: 'schutzgebiet', lage: 'beachten' });
  }

  const tagAmZielRoh = (zielHourly && tageslicht)
    ? describeTagAmZiel(zielHourly, best.arrival, tageslicht, ankerplatzArt ?? null, !!nachtfahrt, ziel ?? null, syn ?? null,
      druckanalyse ?? null, sprache) : null;
  const tagAmZiel = ohneWiederholteRevierkunde(tagAmZielRoh, lw, sprache, lwKey);

  const amtLiege = amtDeutlichMehr && !amtBoe!.giltBis ? amtlichAmLiegeplatz(amtBoe!, sprache, ankerplatzArt ?? null) : null;
  const nachtRoh = (zielHourly && tageslicht)
    ? describeNachtAmZiel(zielHourly, best.arrival, tageslicht, ankerplatzArt ?? null, ziel ?? null,
      gezeitZiel ?? null, syn ?? null, zielKueste ?? null, skipperGuide ?? null, skipperGuideLaedt,
      druckanalyse ?? null, sprache, skipperGuideLage, amtLiege) : null;

  const nachtOhne = ohneWiederholteRevierkunde(nachtRoh, lw, sprache, lwKey);
  const nacht = (nachtOhne && tagAmZiel) ? ohneDoppeltenAbsatz(nachtOhne, tagAmZiel) : nachtOhne;

  const liegeplatzText = tagAmZiel && nacht ? `${tagAmZiel} <div class="brief-absatz">${nacht}</div>`
    : tagAmZiel ?? nacht;

  const ankertiefe = tiefe ? describeAnkertiefe(tiefe, sprache, ankerplatzArt === 'marina') : null;
  const wo = describeSeegebiet(seegebiet ?? null, sprache);

  const steckbrief = hafen ? describeHafensteckbrief(hafen, sprache) : null;

  const gezeitenText = gezeiten ? describeGezeiten(gezeiten, sprache) : null;
  const liegeplatzTeile = [liegeplatzText, ankertiefe, gezeitenText, steckbrief, wo].filter(Boolean) as string[];
  const liegeplatzGanz = liegeplatzTeile.length > 1
    ? liegeplatzTeile[0] + liegeplatzTeile.slice(1)
      .map((t) => ` <div class="brief-absatz">${t}</div>`).join('')
    : liegeplatzTeile[0] ?? null;
  if (liegeplatzGanz) abschnitte.push({ titel: en ? 'Anchorage' : 'Liegeplatz', text: liegeplatzGanz, art: 'liegeplatz', lage: amtLiege ? 'kritisch' : 'ok' });

  const schwierigesWetter = istUnfahrbar(best) || best.maxGust >= 22
    || (best.seaValid && best.maxHs >= 1.5);
  const ausweich = ausweichziele?.length
    ? describeAusweichziele(ausweichziele, best.departure, schwierigesWetter, sprache) : null;
  if (ausweich) {

    const bezug = istEmpfehlung ? '' : en
      ? ` <i>This assessment is calculated for the recommended departure time `
        + `(${uhrLt(ref.departure)}). With strongly veering wind it may turn out differently for `
        + `${uhrLt(best.departure)}.</i>`
      : ` <i>Diese Einschätzung ist für die empfohlene Ablegezeit `
        + `(${uhrLt(ref.departure)}) gerechnet. Bei stark drehendem Wind kann sie für `
        + `${uhrLt(best.departure)} anders ausfallen.</i>`;
    abschnitte.push({ titel: en ? 'Alternative destinations' : 'Ausweichziele', text: ausweich + bezug, art: 'ausweich', lage: schwierigesWetter ? 'beachten' : 'ok' });
  }

  const amtGewitterBericht = amtlicheListe.find((ab) => amtlicheGewitter(ab, tagStr, track ?? null, best.departure)) ?? null;
  const warnTexte = describeWarnings(best, syn ?? null, sprache, amtGewitterBericht ? amtlicherDienst(amtGewitterBericht, sprache) : null);

  const amtAnderswo = amtlicheListe.filter((b) => amtlicheWarnungAnderswo(b, tagStr, best.departure, track ?? null));
  const amtWarnungen = amtlicheListe.filter((b) => !amtAnderswo.includes(b)).map((b) => (amtlicheWarnung(b, tagStr, sprache, best.departure)
    ? amtlicheWarnungKurz(b, tagStr, sprache, best.departure, track ?? null) ?? amtlicheWarnung(b, tagStr, sprache, best.departure)
    : null))
    .filter((w): w is string => !!w);

  const boraLage = describeBoraWetterlage(best, best.departure.getUTCMonth() + 1, syn ?? null,
    druckanalyse ?? null, sprache, amtWarnungen.length > 0);
  if (boraLage) warnTexte.unshift(boraLage);
  warnTexte.unshift(...amtWarnungen);

  const vig = wetterwarnungen?.treffer.length ? warnSaetze(wetterwarnungen.treffer, wetterwarnungen.stand, sprache) : null;
  if (vig?.kritisch) warnTexte.splice(amtWarnungen.length, 0, vig.kritisch);
  const kritischeWarnungen = (boraLage ? 1 : 0) + amtWarnungen.length + (vig?.kritisch ? 1 : 0);
  if (vig?.beachten) warnTexte.splice(kritischeWarnungen, 0, vig.beachten);
  if (amtAnderswo.length) warnTexte.splice(kritischeWarnungen, 0, ...amtAnderswo.map((b) => amtlicheWarnungAnderswoSatz(b, tagStr, sprache)));

  if (amtStaerker) warnTexte.splice(kritischeWarnungen, 0, amtStaerkerSatz(amtStaerker, rechnungBft, sprache));

  if (modellWarn) warnTexte.splice(kritischeWarnungen + (amtStaerker ? 1 : 0), 0, modellWarn);

  let untiefFazit = '';
  if (tiefe) {

    const strecke: Tiefenlage = { ...tiefe, profil: tiefe.profil ? profilOhneLiegeplaetze(tiefe.profil) : null };
    const untief = describeUntiefen(strecke, sprache);

    const zuFlach = strecke.profil ? untiefenAufStrecke(strecke.profil, strecke.tiefgangM).find((u) => u.stufe === 'zu-flach') : undefined;
    if (zuFlach) {
      const sm = en ? 'NM' : 'sm';
      untiefFazit = en
        ? `<b>Shoal on the route:</b> by the depth model ${nf(zuFlach.tiefeM, 1, sprache)} m after ${nf(zuFlach.cum, 1, sprache)} ${sm}, less than the draught. Check the spot on the chart before departure and move the route there.`
        : `<b>Untiefe auf der Route:</b> laut Tiefenmodell ${nf(zuFlach.tiefeM, 1, sprache)} m nach ${nf(zuFlach.cum, 1, sprache)} ${sm}, weniger als der Tiefgang. Die Stelle vor der Fahrt in der Seekarte prüfen und die Route dort verlegen.`;
    }

    const flachste = strecke.profil?.reduce<number | null>((min, p) =>
      p.tiefeM !== null && (min === null || p.tiefeM < min) ? p.tiefeM : min, null) ?? null;

    const see = describeFlachwasserSee(
      best.steepHs || best.maxHs, best.steepTp || best.hsTp, flachste, sprache);

    const vorbehalt = /\s*(Tiefenmodell, keine Seekarte|Depth model, not a chart)/;
    if (untief && see) warnTexte.push(vorbehalt.test(untief) ? untief.replace(vorbehalt, (m) => ` ${see}${m}`) : `${untief} ${see}`);
    else if (untief) warnTexte.push(untief);
    else if (see) warnTexte.push(see);
  }
  if (warnTexte.length) {
    abschnitte.push({
      titel: en ? 'Warnings' : 'Warnungen', text: warnTexte.join(' '), art: 'warnungen',
      lage: kritischeWarnungen ? 'kritisch' : 'beachten',
      eintraege: warnTexte.map((text, i) => ({ text, lage: i < kritischeWarnungen ? 'kritisch' : 'beachten' })),
    });
  }

  const fazit = verdict(best, crewZumutbarkeit, sprache);

  const spaeteresGewitter = !best.hasStorm && results.some((r) => r.hasStorm && r.departure > best.departure);

  const amtGewitter = !best.hasStorm && amtGewitterBericht != null;
  const labil = best.events.some((e) => e.type === 'cape');
  const amtDhmz = !amtGewitterBericht?.herkunft || amtGewitterBericht.herkunft === 'dhmz';
  const amtWo = amtDhmz
    ? (en ? 'this part of the Adriatic' : 'diesen Teil der Adria')
    : `${en ? 'these waters' : 'dieses Seegebiet'} (${amtGewitterBericht ? amtlicherDienst(amtGewitterBericht, sprache) : ''})`;
  const fazitGewitter = spaeteresGewitter
    ? (en ? 'Later in the day thunderstorms cross the route: keep to the departure window and do not let the arrival slip.'
      : 'Später am Tag ziehen Gewitter über die Route: das Ablegefenster einhalten und die Ankunft nicht verschleppen.')
    : amtGewitter
      ? (labil
        ? (en ? `Thunderstorms are forecast officially for ${amtWo}, and the model shows unstable air on the route: keep an eye on the sky under way.`
          : `Amtlich sind für ${amtWo} Gewitter angesagt, und das Modell zeigt labile Luft auf der Route: unterwegs den Himmel im Blick behalten.`)
        : (en ? `Thunderstorms are forecast officially for ${amtWo}: keep an eye on the sky under way.`
          : `Amtlich sind für ${amtWo} Gewitter angesagt: unterwegs den Himmel im Blick behalten.`))
      : '';

  const kritischZeile = kritisch?.fazit && !istUnfahrbar(best) ? kritisch.fazit : '';
  const fazitVorbehalt = amtVorbehalt && !istUnfahrbar(best) ? vorbehaltFazit(amtVorbehalt, sprache, kritischZeile || null) : '';
  const fazitKritisch = kritischZeile && !fazitVorbehalt
    ? (en ? `<b>Critical:</b> ${kritischZeile}.` : `<b>Kritisch:</b> ${kritischZeile}.`) : '';

  const fazitNacht = nachtfahrt && nachtText && !istUnfahrbar(best) && !best.hasStorm && !/Dunkeln|after dark/.test(fazit)
    ? nachtImFazit(nachtfahrt.dunkel, best.arrival, sprache) ?? '' : '';
  const schlagVor = !istUnfahrbar(best) && !best.hasStorm && !fazitVorbehalt && !fazitKritisch;
  const gruss = schlagVor ? `\n\n<div class="brief-absatz brief-gruss">${abschiedsgruss(zielStaat(seegebiet), sprache)}</div>` : '';

  const fazitAmt = amtStaerker && !fazitVorbehalt && !istUnfahrbar(best) ? amtStaerkerFazit(amtStaerker, sprache) : '';
  const fazitUntief = untiefFazit && !istUnfahrbar(best) ? untiefFazit : '';
  const fazitVig = wetterwarnungen && !istUnfahrbar(best) ? warnFazit(wetterwarnungen.treffer, sprache) ?? '' : '';
  abschnitte.push({
    titel: en ? 'Verdict' : 'Fazit', text: [fazitVorbehalt, fazitKritisch, fazitVig, fazitAmt, fazitUntief, fazit, fazitNacht, fazitGewitter].filter(Boolean).join(' ') + gruss, art: 'fazit',
    lage: istUnfahrbar(best) || best.hasStorm ? 'kritisch' : fazitVorbehalt || fazitKritisch || fazitVig || fazitAmt || fazitUntief || fazitNacht || fazitGewitter || best.score > guenstigGrenze(ref) ? 'beachten' : 'ok',
  });

  return abschnitte.map(mitKern);
}

function amtStaerkerSatz(roh: AmtlicheTendenz, rechnungBft: number, sprache: Sprache): string {

  const t = { ...roh, gebiet: escapeHtml(roh.gebiet), text: escapeHtml(roh.text) };
  const m = t.see != null ? douglasSpanne(t.see, sprache) : null;
  if (sprache === 'en') {
    return `The official forecast (Meteomar) gives “${t.text}” for ${t.gebiet} during the passage: force ${t.bft}`
      + `${t.see != null ? `, sea state ${t.see}${m ? ` (${m})` : ''}` : ''}. The calculation sees at most force ${rechnungBft} along the route. `
      + 'The forecast covers the whole sea area, the calculation the route at each hour. Read the next report before casting off and prepare the boat for '
      + `force ${t.bft}.`;
  }
  return `Der amtliche Seewetterbericht (Meteomar) sagt für die Fahrtzeit im Gebiet ${t.gebiet} „${t.text}“: ${t.bft} Bft`
    + `${t.see != null ? `, Seegang ${t.see}${m ? ` (${m})` : ''}` : ''}. Die Rechnung sieht auf der Strecke höchstens ${rechnungBft} Bft. `
    + 'Der Bericht gilt für das ganze Seegebiet, die Rechnung für die Strecke zur jeweiligen Stunde. Vor dem Ablegen den nächsten Bericht lesen '
    + `und das Schiff auf ${t.bft} Bft vorbereiten.`;
}

function amtStaerkerFazit(t: AmtlicheTendenz, sprache: Sprache): string {
  return sprache === 'en'
    ? `<b>Officially stronger:</b> Meteomar gives force ${t.bft} for the sea area during the passage. By the calculation alone:`
    : `<b>Amtlich stärker:</b> Meteomar sagt für das Seegebiet während der Fahrt ${t.bft} Bft an. Nach der Rechnung allein:`;
}

function amtlicherBoeenSatz(amt: AmtlicheBoeen, b: Ablegezeit, sprache: Sprache): string {
  const spanne = amt.von === amt.bis ? `${amt.bis}` : `${amt.von} bis ${amt.bis}`;
  const gerechnet = Math.round(b.maxGust);
  if (sprache === 'en') {
    const span = amt.von === amt.bis ? `${amt.bis}` : `${amt.von} to ${amt.bis}`;
    return `<p class="brief-amtlich"><b>Official warning (DHMZ Split${giltBisZusatz(amt.giltBis, 'en')}): ${amt.offeneSee ? 'on the open sea, ' : ''}gusts of ${span} kn.</b> `
      + `The calculation here sees at most ${gerechnet} kn along the route. Under the mountains and in the `
      + 'channels the gusts strike considerably harder than calculated. For the decision, the official warning counts.</p>';
  }
  return `<p class="brief-amtlich"><b>Amtlich gewarnt (DHMZ Split${giltBisZusatz(amt.giltBis, 'de')}): ${amt.offeneSee ? 'auf offener See ' : ''}Böen ${spanne} kn.</b> `
    + `Die Rechnung hier sieht auf der Strecke höchstens ${gerechnet} kn. Unter Land und in den Kanälen `
    + 'fallen die Böen deutlich härter ein als gerechnet. Für die Entscheidung zählt die amtliche Warnung.</p>';
}

function revierwindAufStrecke(key: WindKey, b: Ablegezeit, sprache: Sprache): string {
  const boeig = b.gustFactor >= 1.45 && b.maxGust >= 15;
  const boe = nf(anzeigeKn(b.maxGust), 0, sprache), mittel = nf(anzeigeKn(b.maxWind), 0, sprache);
  if (sprache === 'en') {
    return `Wind and gusts on this route fit the ${key}`
      + (boeig ? `: gusts to ${boe} kn on ${mittel} kn mean wind, and they hit suddenly.` : '.')
      + ' What the area knows about this wind is under Weather.';
  }

  const artikel = key === 'Bora' || key === 'Tramontana' ? 'zur' : 'zum';
  return `Wind und Böen auf dieser Strecke passen ${artikel} ${key}`

    + (boeig ? `: Böen bis ${boe} kn bei ${mittel} kn Mittelwind, und sie kommen schlagartig.` : '.')
    + ' Was das Revier über diesen Wind weiß, steht unter Wetterlage.';
}

function spanneKn(amt: AmtlicheBoeen, sprache: Sprache): string {
  if (amt.von === amt.bis) return `${amt.bis}`;
  return sprache === 'en' ? `${amt.von} to ${amt.bis}` : `${amt.von} bis ${amt.bis}`;
}

function vorbehaltSatz(amt: AmtlicheBoeen, grenze: number, sprache: Sprache): string {
  return sprache === 'en'
    ? `<b>Only with reservation:</b> the official warning${giltBisZusatz(amt.giltBis, 'en') ? ` (${giltBisZusatz(amt.giltBis, 'en').slice(2)})` : ''} gives gusts of ${spanneKn(amt, 'en')} kn${amt.offeneSee ? ' on the open sea' : ''}, above your gust limit of ${grenze} kn. `
      + 'What follows is the best window by calculation, and the calculation does not see these gusts.'
    : `<b>Nur mit Vorbehalt:</b> Amtlich gewarnt${giltBisZusatz(amt.giltBis, 'de') ? ` (${giltBisZusatz(amt.giltBis, 'de').slice(2)})` : ''} sind ${amt.offeneSee ? 'auf offener See ' : ''}Böen ${spanneKn(amt, 'de')} kn, über deiner Böen-Grenze von ${grenze} kn. `
      + 'Was folgt, ist das rechnerisch beste Fenster, und die Rechnung sieht diese Böen nicht.';
}

function vorbehaltFazit(amt: AmtlicheBoeen, sprache: Sprache, kritisch: string | null = null): string {
  const zusatzEn = giltBisZusatz(amt.giltBis, 'en') ? ` (${giltBisZusatz(amt.giltBis, 'en').slice(2)})` : '';
  const zusatzDe = giltBisZusatz(amt.giltBis, 'de') ? ` (${giltBisZusatz(amt.giltBis, 'de').slice(2)})` : '';
  return sprache === 'en'
    ? `<b>Only with reservation:</b> ${kritisch ? `critical is ${kritisch}${zusatzEn}` : `officially, gusts of up to ${amt.bis} kn${amt.offeneSee ? ' on the open sea' : ''} are warned${zusatzEn}`}. Set out only if the view over the water `
      + 'and the next marine forecast do not bear the warning out for your own route. By the calculation alone:'
    : `<b>Nur mit Vorbehalt:</b> ${kritisch ? `Kritisch ist ${kritisch}${zusatzDe}` : `Amtlich gewarnt sind ${amt.offeneSee ? 'auf offener See ' : ''}Böen bis ${amt.bis} kn${zusatzDe}`}. Auslaufen nur, wenn der Blick aufs Wasser `
      + 'und der nächste Seewetterbericht die Warnung für die eigene Strecke nicht bestätigen. Nach der Rechnung allein:';
}

function amtlichAmLiegeplatz(amt: AmtlicheBoeen, sprache: Sprache, art: string | null = null): string {
  const anker = art !== 'marina';
  if (sprache === 'en') {
    return `The official warning (DHMZ Split) gives gusts of up to ${amt.bis} kn${amt.offeneSee ? ' on the open sea' : ''}${amt.nachts ? ', explicitly for the night as well' : ''}, `
      + 'and these figures do not show them. Under the land the gusts drop from the slopes into the bays: '
      + `double the mooring lines, rig snubbers${anker ? ', plan an anchor watch' : ''}.`;
  }
  return `Die amtliche Warnung (DHMZ Split) nennt Böen bis ${amt.bis} kn${amt.offeneSee ? ' auf offener See' : ''}${amt.nachts ? ', ausdrücklich auch für die Nacht' : ''}, `
    + 'und diese Zahlen zeigen davon nichts. Unter Land fallen die Böen von den Hängen in die Buchten: '
    + `Festmacher doppelt, Ruckdämpfer einsetzen${anker ? ', Ankerwache einplanen' : ''}.`;
}

const ANKUNFT_SCHNELL_MAX_KN = 12;

export function ankunftUnterwegsSatz(b: Ablegezeit, ziel: Date, sprache: Sprache): string {
  const en = sprache === 'en';
  const sp = en ? 'en' : 'de';
  const tag = (d: Date) => {
    const tage = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      - Date.UTC(b.departure.getUTCFullYear(), b.departure.getUTCMonth(), b.departure.getUTCDate())) / 86_400_000);
    const zusatz = tage === 1 ? (en ? ' the next day' : ' am nächsten Tag') : tage > 1 ? (en ? ` in ${tage} days` : ` in ${tage} Tagen`) : '';
    return en ? `${uhrLt(d)}${zusatz}` : `${uhrLt(d)}${zusatz}`;
  };
  const v = noetigeFahrt(b, ziel);
  const diffMin = Math.round((b.arrival.getTime() - ziel.getTime()) / 60_000);
  const dauer = Math.abs(diffMin) < 60 ? `${Math.abs(diffMin)} min` : fmtDur(Math.abs(diffMin) / 60);
  const gerechnet = Math.abs(diffMin) < 5
    ? (en ? `with the calculated speed (mean ${nf(b.avgSpeed, 1, sp)} kn) the yacht arrives around ${tag(b.arrival)}, on time`
      : `mit der gerechneten Fahrt (Ø ${nf(b.avgSpeed, 1, sp)} kn) ist die Yacht gegen ${tag(b.arrival)} da, rechtzeitig`)
    : (en ? `with the calculated speed (mean ${nf(b.avgSpeed, 1, sp)} kn) the yacht arrives around ${tag(b.arrival)}, ${dauer} ${diffMin < 0 ? 'early' : 'late'}`
      : `mit der gerechneten Fahrt (Ø ${nf(b.avgSpeed, 1, sp)} kn) ist die Yacht gegen ${tag(b.arrival)} da, ${dauer} ${diffMin < 0 ? 'früher' : 'später'}`);
  if (v == null) {
    return en
      ? `Arrival at ${tag(ziel)} is no longer possible from now; ${gerechnet}.`
      : `Die Ankunft um ${tag(ziel)} geht sich ab jetzt nicht mehr aus; ${gerechnet}.`;
  }
  if (v > ANKUNFT_SCHNELL_MAX_KN) {
    return en
      ? `Arrival at ${tag(ziel)} would need a mean ${nf(v, 1, sp)} kn over ground, out of reach; ${gerechnet}.`
      : `Für die Ankunft um ${tag(ziel)} bräuchte es im Schnitt ${nf(v, 1, sp)} kn über Grund, das geht sich nicht aus; ${gerechnet}.`;
  }
  return en
    ? `Arrival at ${tag(ziel)} needs a mean ${nf(v, 1, sp)} kn over ground; ${gerechnet}.`
    : `Für die Ankunft um ${tag(ziel)} braucht es im Schnitt ${nf(v, 1, sp)} kn über Grund; ${gerechnet}.`;
}
