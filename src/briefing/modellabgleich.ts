import { nf } from '@/core/time';

const hm = (s: string): string => `${s.replace(':', '')} LT`;
import type { Sprache } from '@/core/types';
import { segelwindWaehrend, abstandWaehrend, ABWEICHUNG_DEUTLICH_KN, type Modellabgleich } from '@/core/modellabgleich';
import { anzeigeKn } from './wind';

const RECHNUNG = { de: 'ECMWF', en: 'ECMWF' };

const VERGLEICH = { de: 'das Standardmodell von Open-Meteo', en: 'the Open-Meteo default model' };

const SEGELWIND_KLASSE = 'ma-segelwind';

export const SEGELWIND_SATZ = new RegExp(`\\s*<span class="${SEGELWIND_KLASSE}">[^<]*</span>`);

export function describeModellabgleich(a: Modellabgleich | null | undefined, sprache: Sprache = 'de'): string | null {
  if (!a) return null;
  if (a.stufe === 'gering' && !a.segelwindUneins) return null;
  const en = sprache === 'en';
  const mehrWeniger = (mehr: boolean) => (en ? (mehr ? 'more' : 'less') : (mehr ? 'mehr' : 'weniger'));
  const teile: string[] = [en
    ? `Model check: the route is computed with ${RECHNUNG.en}.`
    : `Modellabgleich: Gerechnet wird mit ${RECHNUNG.de}.`];

  const mittel = anzeigeKn(Math.abs(a.mittelKn)), spitze = anzeigeKn(a.maxKn);
  const vergleichMehr = a.mittelKn < 0;
  if (a.stufe !== 'gering') {
    teile.push(en
      ? `From 0600 to 2100 LT ${VERGLEICH.en} shows on average ${nf(mittel, 0, 'en')} kn ${mehrWeniger(vergleichMehr)} wind, at ${hm(a.maxUhrzeit)} up to ${nf(spitze, 0, 'en')} kn ${mehrWeniger(!a.maxRechnungMehr)}.`
      : `Von 0600 bis 2100 LT sieht ${VERGLEICH.de} im Mittel ${nf(mittel, 0)} kn ${mehrWeniger(vergleichMehr)} Wind, um ${hm(a.maxUhrzeit)} bis zu ${nf(spitze, 0)} kn ${mehrWeniger(!a.maxRechnungMehr)}.`);
  } else {

    teile.push(en
      ? `At ${hm(a.maxUhrzeit)} ${VERGLEICH.en} shows up to ${nf(spitze, 0, 'en')} kn ${mehrWeniger(!a.maxRechnungMehr)} wind.`
      : `Um ${hm(a.maxUhrzeit)} sieht ${VERGLEICH.de} bis zu ${nf(spitze, 0)} kn ${mehrWeniger(!a.maxRechnungMehr)} Wind.`);
  }
  if (a.richtungGrad >= 45) {
    teile.push(en
      ? `The two models also differ in direction by about ${nf(Math.round(a.richtungGrad / 5) * 5, 0, 'en')}°.`
      : `Auch die Richtung weicht um rund ${nf(Math.round(a.richtungGrad / 5) * 5, 0)}° ab.`);
  }
  if (a.segelwindUneins) {
    const u = a.segelwindUneins;
    const spanne = u.von === u.bis ? (en ? `at ${hm(u.von)}` : `um ${hm(u.von)}`) : (en ? `between ${hm(u.von)} and ${hm(u.bis)}` : `zwischen ${hm(u.von)} und ${hm(u.bis)}`);

    teile.push(`<span class="${SEGELWIND_KLASSE}">` + (en
      ? (u.rechnungSegelt
        ? `${spanne.charAt(0).toUpperCase()}${spanne.slice(1)} ${VERGLEICH.en} stays below the minimum sailing wind while ${RECHNUNG.en} is above it: whether this stretch is sailed or motored is open between the models.`
        : `${spanne.charAt(0).toUpperCase()}${spanne.slice(1)} ${RECHNUNG.en} stays below the minimum sailing wind while ${VERGLEICH.en} is above it: whether this stretch is sailed or motored is open between the models.`)
      : (u.rechnungSegelt
        ? `${spanne.charAt(0).toUpperCase()}${spanne.slice(1)} liegt ${VERGLEICH.de} unter dem Mindestwind zum Segeln, ${RECHNUNG.de} darüber: Ob dann gesegelt oder motort wird, ist zwischen den Modellen offen.`
        : `${spanne.charAt(0).toUpperCase()}${spanne.slice(1)} liegt ${RECHNUNG.de} unter dem Mindestwind zum Segeln, ${VERGLEICH.de} darüber: Ob dann gesegelt oder motort wird, ist zwischen den Modellen offen.`)) + '</span>');
  }
  if (a.stufe === 'stark') {
    teile.push(en
      ? 'Both describe the model field, not a measurement: compare with a station or the own anemometer before casting off.'
      : 'Beide beschreiben das Modellfeld, keine Messung: vor dem Ablegen mit einer Station oder dem eigenen Windmesser vergleichen.');
  }
  return teile.join(' ');
}

export function warnungModellabgleich(
  a: Modellabgleich | null | undefined, sprache: Sprache = 'de', fahrt?: { ab: Date; an: Date },
): string | null {
  if (!a) return null;
  if (a.stufe !== 'stark' && !a.segelwindUneins) return null;
  if (fahrt) {
    const segel = segelwindWaehrend(a, fahrt.ab, fahrt.an);
    const stark = a.stufe === 'stark' && (abstandWaehrend(a, fahrt.ab, fahrt.an) ?? 0) >= ABWEICHUNG_DEUTLICH_KN;
    if (!segel && !stark) return null;

    if (!segel) a = { ...a, segelwindUneins: null };
  }
  const en = sprache === 'en';
  const mittel = anzeigeKn(Math.abs(a.mittelKn));
  const vergleichMehr = a.mittelKn < 0;
  const u = a.segelwindUneins;

  const kopf = a.stufe === 'gering' && u
    ? (en
      ? `The weather models disagree on whether to sail or motor: ${u.von === u.bis ? `at ${hm(u.von)}` : `between ${hm(u.von)} and ${hm(u.bis)}`} ${u.rechnungSegelt ? VERGLEICH.en : RECHNUNG.en} stays below the minimum sailing wind, ${u.rechnungSegelt ? RECHNUNG.en : VERGLEICH.en} above it.`
      : `Die Wettermodelle sind sich uneinig, ob gesegelt oder motort wird: ${u.von === u.bis ? `um ${hm(u.von)}` : `zwischen ${hm(u.von)} und ${hm(u.bis)}`} liegt ${u.rechnungSegelt ? VERGLEICH.de : RECHNUNG.de} unter dem Mindestwind zum Segeln, ${u.rechnungSegelt ? RECHNUNG.de : VERGLEICH.de} darüber.`)
    : (en
      ? `The weather models disagree: ${VERGLEICH.en} shows on average ${nf(mittel, 0, 'en')} kn ${vergleichMehr ? 'more' : 'less'} wind than ${RECHNUNG.en}, which the route is computed with.`
      : `Die Wettermodelle sind sich uneinig: ${VERGLEICH.de} sieht im Mittel ${nf(mittel, 0)} kn ${vergleichMehr ? 'mehr' : 'weniger'} Wind als ${RECHNUNG.de}, mit dem gerechnet wird.`);
  const folge = a.segelwindUneins
    ? (en
      ? ' The departure window and the share under engine can shift with the model: read the recommendation as one of two readings.'
      : ' Ablegefenster und Motoranteil können mit dem Modell kippen: die Empfehlung als eine von zwei Lesarten nehmen.')
    : '';
  return kopf + folge;
}
