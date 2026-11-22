import { escapeHtml } from '@/core/html';
import { nf } from '@/core/time';
import type { Sprache } from '@/core/types';
import { anzeigeKn, beaufort, windBand } from '@/briefing/wind';
import { stundenIndex, type Stundenwetter } from '@/core/zielwetter';

export interface WetterJetzt {

  zeit: string;
  temperatur: number;
  code: number;
  tag: boolean;
  windKn: number;

  windAus: number;
  boeenKn: number | null;
}

export {
  himmelAus, himmelText, richtungAusgeschrieben, bftFarbe, himmelBild, windBild, bftBalken, type Himmel,
} from '@/map/wetterbild';
import { himmelAus, himmelText, richtungAusgeschrieben, himmelBild, windBild, bftBalken } from '@/map/wetterbild';

const T = {
  de: { titel: 'Wetter an der Yacht', vorhersage: 'Vorhersage', quelle: 'Quelle', aus: 'aus', boeen: 'Böen bis' },
  en: { titel: 'Weather at the yacht', vorhersage: 'Forecast', quelle: 'Source', aus: 'from', boeen: 'gusts up to' },
} as const;

export function wetterKachel(w: WetterJetzt, sprache: Sprache): string {
  const t = T[sprache];
  const h = himmelAus(w.code);

  const kn = anzeigeKn(w.windKn);
  const bft = beaufort(kn);
  const kmh = Math.round(w.windKn * 1.852);
  const name = windBand(kn, sprache).name;
  const richtung = kn >= 1 ? `${t.aus} ${richtungAusgeschrieben(w.windAus, sprache)}` : '';
  const boeen = w.boeenKn != null && Math.round(w.boeenKn) > kn + 2 ? `${t.boeen} ${Math.round(w.boeenKn)} kn` : '';

  const uhr = `${w.zeit.slice(11, 13)}${w.zeit.slice(14, 16)} LT`;
  const himmel = himmelText(h, w.tag, sprache);
  const temp = `${nf(Math.round(w.temperatur), 0, sprache)} °C`;
  const zeileWind = [name.charAt(0).toUpperCase() + name.slice(1), richtung].filter(Boolean).join(' ');
  const label = [himmel, temp, `${zeileWind}, ${kn} kn (${kmh} km/h, ${bft} Bft)`, boeen].filter(Boolean).join('. ');
  return `<h2>${escapeHtml(t.titel)}</h2>`
    + `<p class="st-unter st-wetter-stand">${escapeHtml(`${t.vorhersage} · ${uhr}`)}</p>`
    + `<div class="st-wetter" role="img" aria-label="${escapeHtml(label)}">`
    + `<div class="st-wetter-teil">${himmelBild(h, w.tag)}<div><b class="st-wetter-gross">${escapeHtml(temp)}</b>`
    + `<span>${escapeHtml(himmel)}</span></div></div>`
    + `<div class="st-wetter-teil">${windBild(w.windAus, bft, sprache)}<div><b class="st-wetter-gross">${kn} <small>kn</small></b>`
    + `<span>${kmh} km/h</span><span>${bft} Bft</span></div></div></div>`
    + bftBalken(bft)
    + `<p class="st-wetter-satz">${escapeHtml([zeileWind, boeen].filter(Boolean).join(' · '))}</p>`
    + `<p class="st-wetter-quelle">${escapeHtml(t.quelle)}: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>, ECMWF (CC BY 4.0)</p>`;
}

export function wetterZurStunde(w: Stundenwetter, t: number): WetterJetzt | null {
  const i = stundenIndex(w, t);
  return i < 0 ? null : w.stunden[i]!;
}
