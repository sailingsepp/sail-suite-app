import { nf } from '@/core/time';
import { mitArtwort } from '@/core/ortsname';
import { escapeHtml } from '@/core/html';
import type { SchutzStufe } from '@/core/shelter';
import type { Sprache } from '@/core/types';
import { saisonLage, istCrewwechseltag, istAugustspitze, marinaVermutlichVoll } from '@/core/season';
import { richtungsName } from './wind';

export interface AusweichzielText {
  name: string;
  art: 'marina' | 'hafen' | 'bucht';
  distanzNM: number;
  peilung: number;
  fetchNM: number | null;
  schutz: SchutzStufe | null;
}

const ART_NAME: Record<AusweichzielText['art'], string> = {
  marina: 'Marina', hafen: 'Hafen', bucht: 'Bucht',
};
const ART_NAME_EN: Record<AusweichzielText['art'], string> = {
  marina: 'Marina', hafen: 'Harbour', bucht: 'Bay',
};

export const SCHUTZ_TEXT: Record<SchutzStufe, string> = {
  geschuetzt: 'geschützt gegen die aktuelle Windrichtung',
  teilweise: 'nur teilweise gedeckt',
  offen: 'offen gegen den Wind',
};

export const SCHUTZ_TEXT_EN: Record<SchutzStufe, string> = {
  geschuetzt: 'sheltered from the current wind direction',
  teilweise: 'only partly sheltered',
  offen: 'exposed to the wind',
};

function saisonHinweis(datum: Date, sprache: Sprache = 'de'): string {
  const lage = saisonLage(datum);
  if (sprache === 'en') {
    const crewEn = istCrewwechseltag(datum)
      ? ' It is also a crew-change day. Expect the charter marinas to be correspondingly busy.' : '';
    if (lage === 'spitze') {
      const augustEn = istAugustspitze(datum)
        ? ' On top of that, 15 August falls in this stretch: a public holiday in Italy, Spain, France, '
          + 'Croatia and Greece. That is the peak crush of the year, because locals take to the water too.'
        : '';
      return 'It is peak season: berths in the marinas are often gone by 1200 to 1300 LT, popular anchorages '
        + 'full by early afternoon. Anyone arriving only in the evening should have picked an alternative '
        + 'destination beforehand, rather than searching for one then.' + augustEn + crewEn;
    }
    if (lage === 'haupt') {
      return 'It is high season. In these waters that runs from mid-June to mid-September. A berth is '
        + 'therefore not guaranteed; in the well-known bays it pays to arrive early.' + crewEn;
    }
    if (lage === 'rand') {
      return 'At the edge of the season the crowds are manageable. Before mid-June and after '
        + 'mid-September, harbours and bays are usually not yet overrun. But marina offices and '
        + 'services are not everywhere open yet; when in doubt, call ahead.';
    }
    return 'Outside the season, expect closed marina offices, reduced service and unstaffed pontoons, '
      + 'call ahead rather than relying on finding a berth.';
  }

  const crew = istCrewwechseltag(datum)
    ? ' Dazu ist an diesem Tag Crewwechseltag. In den Charterhäfen ist entsprechend viel los.' : '';

  if (lage === 'spitze') {

    const august = istAugustspitze(datum)
      ? ' Dazu liegt der 15. August in diesen Tagen: Feiertag in Italien, Spanien, Frankreich, '
        + 'Kroatien und Griechenland. Das ist der Andrangsgipfel des Jahres, weil dann auch die '
        + 'Einheimischen aufs Wasser gehen.' : '';
    return 'Es ist Hochsaison: Liegeplätze in den Marinas sind vielfach schon ab 1200 bis 1300 LT vergeben, '
      + 'beliebte Ankerbuchten am frühen Nachmittag voll. Wer erst am Abend ankommt, sollte das '
      + 'Ausweichziel vorher festgelegt haben, statt es dann zu suchen.' + august + crew;
  }
  if (lage === 'haupt') {
    return 'Es ist Hochsaison. Die reicht in diesen Revieren von Mitte Juni bis Mitte September. '
      + 'Ein Liegeplatz ist damit nicht sicher; in den bekannten Buchten lohnt es, früh dort zu sein.' + crew;
  }
  if (lage === 'rand') {
    return 'Am Rand der Saison ist der Andrang überschaubar. Bis Mitte Juni und ab Mitte September sind '
      + 'Häfen und Buchten meist noch nicht überlaufen. Dafür haben nicht überall Marinabüro und Versorgung '
      + 'geöffnet, im Zweifel vorher anrufen.';
  }
  return 'Außerhalb der Saison ist mit geschlossenen Marinabüros, reduziertem Service und '
    + 'unbesetzten Stegen zu rechnen. Vorher anrufen, statt sich auf einen Liegeplatz zu verlassen.';
}

function anlaufZusatz(fetchNM: number | null, sprache: 'de' | 'en'): string {
  if (fetchNM == null || fetchNM < 0.05) return '';
  const zahl = fetchNM >= 12 ? (sprache === 'en' ? 'over 12' : 'über 12') : nf(fetchNM, 1, sprache);
  return sprache === 'en' ? ` (fetch ${zahl} NM)` : ` (Anlauf ${zahl} sm)`;
}

export function ausweichzieleSinnvoll(schwierigesWetter: boolean, abfahrt: Date): boolean {
  return schwierigesWetter || marinaVermutlichVoll(saisonLage(abfahrt));
}

export function describeAusweichziele(
  ziele: AusweichzielText[], abfahrt: Date, schwierigesWetter: boolean, sprache: Sprache = 'de',
): string | null {
  if (ziele.length === 0) return null;
  if (!ausweichzieleSinnvoll(schwierigesWetter, abfahrt)) return null;

  if (sprache === 'en') {
    const plaeneEn = ['Plan B', 'Plan C', 'Plan D'];
    const teileEn = ziele.map((z, i) => {
      const wo = `${nf(z.distanzNM, 1, 'en')} NM ${richtungsName(z.peilung, 'en')}`;
      const urteil = z.schutz
        ? `${SCHUTZ_TEXT_EN[z.schutz]}${anlaufZusatz(z.fetchNM, 'en')}`
        : 'not assessed: no coastline data was available for this spot';

      return `<b>${plaeneEn[i] ?? 'Further'}: ${escapeHtml(mitArtwort(z.art, ART_NAME_EN[z.art], z.name))}</b>: ${wo}, ${urteil}.`;
    });

    const keinSchutzEn = ziele.every((z) => z.schutz === 'offen')
      ? 'None of the spots found is sheltered from this wind direction. If that matters, the '
        + 'search needs to range further than this list.'
      : null;

    const grenzeEn = 'The assessment covers windward fetch from the current wind direction only. '
      + 'Holding ground, water depth, swell round the corner and how busy a spot is are not in the '
      + 'data, and above all, no williwaws: a spot tucked close under high land has a short fetch '
      + 'and can still be hammered by gusts pouring over the ridge. So check against the chart and '
      + 'pilot book.';

    return [...teileEn, keinSchutzEn, grenzeEn, saisonHinweis(abfahrt, 'en')].filter(Boolean).join(' ');
  }

  const plaene = ['Plan B', 'Plan C', 'Plan D'];
  const teile = ziele.map((z, i) => {
    const wo = `${nf(z.distanzNM, 1)} sm ${richtungsName(z.peilung)}`;
    const urteil = z.schutz
      ? `${SCHUTZ_TEXT[z.schutz]}${anlaufZusatz(z.fetchNM, 'de')}`
      : 'ohne Bewertung, für diesen Platz lagen keine Küstenlinien vor';

    return `<b>${plaene[i] ?? 'Weiter'}: ${escapeHtml(mitArtwort(z.art, ART_NAME[z.art], z.name))}</b>: ${wo}, ${urteil}.`;
  });

  const keinSchutz = ziele.every((z) => z.schutz === 'offen')
    ? 'Keiner der gefundenen Plätze liegt bei dieser Windrichtung gedeckt. Wenn es darauf ankommt, '
      + 'ist die Suche weiter zu ziehen, als diese Liste reicht.'
    : null;

  const grenze = 'Bewertet ist allein der Wellenanlauf aus der aktuellen Windrichtung. '
    + 'Ankergrund, Wassertiefe, Schwell um die Ecke und die Belegung stecken nicht in den Daten, '
    + 'und vor allem keine Fallböen: Ein Platz dicht unter hohem Land hat kurzen Anlauf und kann '
    + 'trotzdem von Böen über den Kamm zusammengeschlagen werden. Also gegen Seekarte und '
    + 'Hafenhandbuch prüfen.';

  return [...teile, keinSchutz, grenze, saisonHinweis(abfahrt)].filter(Boolean).join(' ');
}
