import { nf, uhrLt, fmtDur } from '@/core/time';
import { htmlZuText } from '@/core/html';
import { steilStufe } from '@/core/polar';
import type { Ablegezeit, Sprache } from '@/core/types';
import { anzeigeKn, beaufort } from './wind';
import { kernUndRest } from './kern';
import type { BriefingAbschnitt } from './index';

export function kurzfassung(b: Ablegezeit, abschnitte: readonly BriefingAbschnitt[], sprache: Sprache = 'de'): string[] {
  const en = sprache === 'en';
  const ersterSatz = (html: string): string => {
    const k = kernUndRest(html);
    return htmlZuText(k ? k.kern : html).replace(/\s+/g, ' ').trim();
  };
  const wind = anzeigeKn(b.maxWind), boe = anzeigeKn(b.maxGust);
  const saetze: string[] = [];
  saetze.push(en
    ? `Cast off ${uhrLt(b.departure)}, arrival ${uhrLt(b.arrival)}, ${fmtDur(b.totalHrs)} under way.`
    : `Ablegen ${uhrLt(b.departure)}, Ankunft ${uhrLt(b.arrival)}, ${fmtDur(b.totalHrs)} unterwegs.`);
  saetze.push(en
    ? `Wind up to ${nf(wind, 0, 'en')} kn (${beaufort(wind)} Bft), gusts up to ${nf(boe, 0, 'en')} kn.`
    : `Wind bis ${nf(wind, 0)} kn (${beaufort(wind)} Bft), Böen bis ${nf(boe, 0)} kn.`);
  if (!b.seaValid) {
    saetze.push(en ? 'No sea state from the wave model.' : 'Kein Seegang aus dem Wellenmodell.');
  } else {
    const stufe = steilStufe(b.maxSteep);
    const steil = stufe === 3 ? (en ? ', extremely steep' : ', extrem steil') : stufe === 2 ? (en ? ', very steep' : ', sehr steil')
      : stufe === 1 ? (en ? ', short and steep' : ', kurz und steil') : '';
    saetze.push(en
      ? `Sea up to ${nf(b.maxHs, 1, 'en')} m at ${nf(b.hsTp, 0, 'en')} s${steil}.`
      : `See bis ${nf(b.maxHs, 1)} m bei ${nf(b.hsTp, 0)} s${steil}.`);
  }
  const warnungen = abschnitte.find((a) => a.art === 'warnungen');
  const eintraege = warnungen?.eintraege?.length ? warnungen.eintraege.map((e) => e.text) : warnungen ? [warnungen.text] : [];
  if (eintraege.length) {
    const erste = ersterSatz(eintraege[0]!).replace(/[.!]$/, '');
    const mehr = eintraege.length - 1;
    saetze.push(en
      ? `Warning: ${erste}${mehr > 0 ? ` (${mehr} more in the briefing)` : ''}.`
      : `Warnung: ${erste}${mehr > 0 ? ` (${mehr} weitere im Briefing)` : ''}.`);
  } else {
    saetze.push(en ? 'No warnings from the models.' : 'Keine Warnungen aus den Modellen.');
  }
  const fazit = abschnitte.find((a) => a.art === 'fazit');
  if (fazit) saetze.push(ersterSatz(fazit.text));
  return saetze;
}
