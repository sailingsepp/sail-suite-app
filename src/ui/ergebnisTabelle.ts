import { nf, uhrLt, fmtDur, datumUhrLt } from '@/core/time';
import type { Ablegezeit, SchiffConfig, Sprache } from '@/core/types';
import { guenstigGrenze } from '@/briefing/window';
import { istUnfahrbar } from '@/briefing/verdict';
import { buildWarnings } from '@/briefing/weather';

export type Lage = 'guenstig' | 'brauchbar' | 'unfahrbar';

export type Vorbehalt = boolean | ((r: Ablegezeit) => boolean);

export function empfehlungMitVorbehalt(ergebnisse: readonly Ablegezeit[], rechnerisch: Ablegezeit, vorbehalt: (r: Ablegezeit) => boolean): Ablegezeit {
  if (!vorbehalt(rechnerisch)) return rechnerisch;
  const grenze = guenstigGrenze(rechnerisch);
  const t0 = rechnerisch.departure.getTime();
  const frei = ergebnisse.filter((r) => !istUnfahrbar(r) && !vorbehalt(r) && r.score <= grenze);
  frei.sort((a, b) => Math.abs(a.departure.getTime() - t0) - Math.abs(b.departure.getTime() - t0)
    || a.departure.getTime() - b.departure.getTime());
  return frei[0] ?? rechnerisch;
}

export function bewertung(r: Ablegezeit, empfohlen: Ablegezeit, vorbehalt: Vorbehalt = false): Lage {
  if (istUnfahrbar(r)) return 'unfahrbar';
  if (typeof vorbehalt === 'function' ? vorbehalt(r) : vorbehalt) return 'brauchbar';
  return r.score > guenstigGrenze(empfohlen) ? 'brauchbar' : 'guenstig';
}

export const LAGE_TEXT: Record<Sprache, Record<Lage, string>> = {
  de: { guenstig: 'günstig', brauchbar: 'brauchbar', unfahrbar: 'nicht fahrbar' },
  en: { guenstig: 'favourable', brauchbar: 'workable', unfahrbar: 'not sailable' },
};

export const LAGE_ZEICHEN: Record<Lage, string> = { guenstig: '✓', brauchbar: '～', unfahrbar: '✗' };

export function zeichenMitText(zeichen: string, text: string): string {
  return `<span aria-hidden="true">${zeichen}</span><span class="sr-only">${text}</span>`;
}

export function ankunftLabel(r: Ablegezeit): string {
  const gleicherTag = r.departure.getUTCFullYear() === r.arrival.getUTCFullYear()
    && r.departure.getUTCMonth() === r.arrival.getUTCMonth()
    && r.departure.getUTCDate() === r.arrival.getUTCDate();
  return gleicherTag ? uhrLt(r.arrival) : datumUhrLt(r.arrival);
}

export function tabelleHtml(
  results: Ablegezeit[], empfohlen: Ablegezeit, cfg: SchiffConfig, hatStromdaten: boolean,
  gewaehlt: Ablegezeit, sprache: Sprache, vorbehalt: Vorbehalt = false,
): string {
  const en = sprache === 'en';
  const koepfe = en
    ? ['Rating', 'Depart', 'Arrival', 'Duration', 'Motor', 'Beat/gybe', 'Current', 'Wind / gusts (kn)', 'Sea (m)', 'Weather', 'Daylight', 'Score']
    : ['Lage', 'Ablegen', 'Ankunft', 'Dauer', 'Motor', 'Kreuz/Hals', 'Strom', 'Wind / Böen (kn)', 'See (m)', 'Wetter', 'Tageslicht', 'Score'];
  const beschriftung = en
    ? 'All departure times checked, in time order. Rating: favourable, workable or not sailable.'
    : 'Alle geprüften Ablegezeiten in zeitlicher Folge. Lage: günstig, brauchbar oder nicht fahrbar.';
  const kopf = `<caption class="sr-only">${beschriftung}</caption>`
    + `<thead><tr>${koepfe.map((k) => `<th scope="col">${k}</th>`).join('')}</tr></thead>`;
  const byTime = [...results].sort((a, b) => a.departure.getTime() - b.departure.getTime());
  const zeilen = byTime.map((r) => {
    const lage = bewertung(r, empfohlen, vorbehalt);
    let klasse = lage;
    if (r === empfohlen) klasse += ' best';

    if (r === gewaehlt && r !== empfohlen) klasse += ' gewaehlt';
    const marke = r === empfohlen
      ? ` <span class="sr-only">${en ? '(recommended)' : '(empfohlen)'}</span>`
      : r === gewaehlt ? ` <span class="sr-only">${en ? '(selected)' : '(gewählt)'}</span>` : '';
    const wetter = r.hasStorm
      ? zeichenMitText('⚡', en ? 'thunderstorm' : 'Gewitter')
      : buildWarnings(r.events, sprache).length ? zeichenMitText('!', en ? 'warning' : 'Warnung') : '–';
    const grenzwert = r.safetyFail ? ' ' + zeichenMitText('⚠', en ? 'limit exceeded' : 'Grenzwert überschritten') : '';
    const strom = (cfg.useCurrent && hatStromdaten)
      ? (r.currentGainMin >= 0 ? '+' : '−') + Math.abs(r.currentGainMin).toFixed(0) + ' min' : '–';
    const licht = r.isDaylight === null ? '–' : (en ? (r.isDaylight ? 'yes' : 'no') : (r.isDaylight ? 'ja' : 'nein'));
    return `<tr class="${klasse}">`
      + `<td class="lage-zeichen" title="${LAGE_TEXT[sprache][lage]}">${zeichenMitText(LAGE_ZEICHEN[lage], LAGE_TEXT[sprache][lage])}</td>`
      + `<th scope="row">${uhrLt(r.departure)}${marke}</th><td>${datumUhrLt(r.arrival)}</td><td>${fmtDur(r.totalHrs)}</td>`
      + `<td>${(r.motorShare * 100).toFixed(0)}%</td><td>${(r.beatShare * 100).toFixed(0)}/${(r.gybeShare * 100).toFixed(0)}%</td>`
      + `<td>${strom}</td>`
      + `<td>${r.maxWind.toFixed(0)} / ${r.maxGust.toFixed(0)}</td><td>${r.seaValid ? nf(r.maxHs, 1, sprache) : '–'}${grenzwert}</td>`
      + `<td>${wetter}</td><td>${licht}</td><td>${nf(r.score, 1, sprache)}</td></tr>`;
  });
  return `${kopf}<tbody>${zeilen.join('')}</tbody>`;
}

export function stripWerttext(gewaehlt: Ablegezeit, empfohlen: Ablegezeit, sprache: Sprache, vorbehalt: Vorbehalt = false): string {
  const lage = LAGE_TEXT[sprache][bewertung(gewaehlt, empfohlen, vorbehalt)];
  const empf = gewaehlt === empfohlen;
  return sprache === 'en'
    ? `Depart ${uhrLt(gewaehlt.departure)}, ${lage}${empf ? ', recommended' : ''}, arrival ${ankunftLabel(gewaehlt)}, duration ${fmtDur(gewaehlt.totalHrs)}`
    : `${uhrLt(gewaehlt.departure)} ablegen, ${lage}${empf ? ', empfohlen' : ''}, Ankunft ${ankunftLabel(gewaehlt)}, Fahrtdauer ${fmtDur(gewaehlt.totalHrs)}`;
}
