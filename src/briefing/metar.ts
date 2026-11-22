import { nf, kursGrad } from '@/core/time';
import type { Sprache } from '@/core/types';
import { beaufort } from './wind';

export interface MetarZeile {

  titel: string;
  text: string;
}

export interface MetarKlartext {
  icao: string | null;

  zeit: { tag: number; stunde: number; minute: number } | null;
  zeilen: MetarZeile[];

  unbekannt: string[];
}

const MS_ZU_KN = 1.943844;
const FT_ZU_M = 0.3048;
const INHG_ZU_HPA = 33.8639;

type T = { de: string; en: string };
const t = (x: T, s: Sprache) => x[s];

const TITEL = {
  art: { de: 'Meldung', en: 'Report' },
  wind: { de: 'Wind', en: 'Wind' },
  sicht: { de: 'Sicht', en: 'Visibility' },
  rvr: { de: 'Pistensichtweite', en: 'Runway visual range' },
  wetter: { de: 'Wetter', en: 'Weather' },
  wolken: { de: 'Wolken', en: 'Cloud' },
  temp: { de: 'Temperatur', en: 'Temperature' },
  qnh: { de: 'Luftdruck (QNH)', en: 'Pressure (QNH)' },
  vorher: { de: 'Zuvor', en: 'Recent' },
  scherung: { de: 'Windscherung', en: 'Wind shear' },
  trend: { de: 'Trend (2 h)', en: 'Trend (2 h)' },
  piste: { de: 'Pistenzustand', en: 'Runway state' },
  bemerkung: { de: 'Bemerkung', en: 'Remark' },
} satisfies Record<string, T>;

const INTENSITAET: Record<string, T> = {
  '-': { de: 'leicht', en: 'light' }, '+': { de: 'stark', en: 'heavy' }, VC: { de: 'in der Umgebung', en: 'in the vicinity' },
};
const BESCHREIBUNG: Record<string, T> = {
  MI: { de: 'flach', en: 'shallow' }, BC: { de: 'Schwaden', en: 'patches' }, PR: { de: 'teilweise', en: 'partial' },
  DR: { de: 'fegend', en: 'drifting' }, BL: { de: 'treibend', en: 'blowing' }, SH: { de: 'Schauer', en: 'showers' },
  TS: { de: 'Gewitter', en: 'thunderstorm' }, FZ: { de: 'gefrierend', en: 'freezing' },
};
const ERSCHEINUNG: Record<string, T> = {
  DZ: { de: 'Sprühregen', en: 'drizzle' }, RA: { de: 'Regen', en: 'rain' }, SN: { de: 'Schnee', en: 'snow' },
  SG: { de: 'Schneegriesel', en: 'snow grains' }, IC: { de: 'Eiskristalle', en: 'ice crystals' },
  PL: { de: 'Eiskörner', en: 'ice pellets' }, GR: { de: 'Hagel', en: 'hail' },
  GS: { de: 'Graupel', en: 'small hail or snow pellets' }, UP: { de: 'Niederschlag unbekannter Art', en: 'unidentified precipitation' },
  BR: { de: 'feuchter Dunst', en: 'mist' }, FG: { de: 'Nebel', en: 'fog' }, FU: { de: 'Rauch', en: 'smoke' },
  VA: { de: 'Vulkanasche', en: 'volcanic ash' }, DU: { de: 'Staub', en: 'widespread dust' }, SA: { de: 'Sand', en: 'sand' },
  HZ: { de: 'trockener Dunst', en: 'haze' }, PO: { de: 'Staubwirbel', en: 'dust devils' }, SQ: { de: 'Böenwalze', en: 'squalls' },
  FC: { de: 'Trichterwolke', en: 'funnel cloud' }, SS: { de: 'Sandsturm', en: 'sandstorm' }, DS: { de: 'Staubsturm', en: 'duststorm' },
};
const BEDECKUNG: Record<string, T> = {
  FEW: { de: 'gering (1–2/8)', en: 'few (1–2/8)' }, SCT: { de: 'aufgelockert (3–4/8)', en: 'scattered (3–4/8)' },
  BKN: { de: 'durchbrochen (5–7/8)', en: 'broken (5–7/8)' }, OVC: { de: 'bedeckt (8/8)', en: 'overcast (8/8)' },
};
const WOLKENART: Record<string, T> = {
  CB: { de: 'Cumulonimbus', en: 'cumulonimbus' }, TCU: { de: 'aufquellende Cumulus', en: 'towering cumulus' },
};
const RICHTUNG: Record<string, T> = {
  N: { de: 'Nord', en: 'north' }, NE: { de: 'Nordost', en: 'north-east' }, E: { de: 'Ost', en: 'east' },
  SE: { de: 'Südost', en: 'south-east' }, S: { de: 'Süd', en: 'south' }, SW: { de: 'Südwest', en: 'south-west' },
  W: { de: 'West', en: 'west' }, NW: { de: 'Nordwest', en: 'north-west' },
};

const WETTER_RE = /^(-|\+|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)*)$/;

export function wetterKlartext(g: string, s: Sprache): string | null {
  const m = WETTER_RE.exec(g);
  if (!m || (!m[2] && !m[3])) return null;
  const ers = ((m[3] ?? '').match(/.{2}/g) ?? []).map((e) => t(ERSCHEINUNG[e]!, s)).join(s === 'de' ? ' und ' : ' and ');

  let text = m[2] ? (ers ? `${t(BESCHREIBUNG[m[2]]!, s)} ${s === 'de' ? 'mit' : 'with'} ${ers}` : t(BESCHREIBUNG[m[2]]!, s)) : ers;
  if (m[1] === 'VC') text += ` ${t(INTENSITAET['VC']!, s)}`;
  else if (m[1]) text += `, ${t(INTENSITAET[m[1]]!, s)}`;

  return text;
}

const hoehe = (hundertFt: number, s: Sprache) => `${hundertFt * 100} ft (${Math.round((hundertFt * 100 * FT_ZU_M) / 10) * 10} m)`
  .replace(/^(\d+)(\d{3}) ft/, s === 'de' ? '$1$2 ft' : '$1,$2 ft');
const grad = (x: string) => kursGrad(Number(x));
const temp = (x: string) => (x.startsWith('M') ? -Number(x.slice(1)) : Number(x));

function sichtText(m: number, s: Sprache): string {
  if (m >= 9999) return s === 'de' ? '10 km oder mehr' : '10 km or more';
  if (m === 0) return s === 'de' ? 'unter 50 m' : 'less than 50 m';
  return m >= 5000 ? `${nf(m / 1000, 0, s)} km` : m >= 1000 ? `${nf(m / 1000, 1, s)} km` : `${m} m`;
}

function windText(g: RegExpExecArray, s: Sprache): string {
  const [, dir, spd, , gust, einheit] = g;
  const ms = einheit === 'MPS';
  const kn = (x: string) => (ms ? Math.round(Number(x) * MS_ZU_KN) : Number(x));
  if (dir === '000' && Number(spd) === 0) return s === 'de' ? 'Windstille' : 'calm';
  const v = kn(spd!);
  const woher = dir === 'VRB' ? (s === 'de' ? 'umlaufend' : 'variable') : `${s === 'de' ? 'aus' : 'from'} ${grad(dir!)}`;
  const staerke = `${v} kn (${s === 'de' ? 'Bft' : 'Force'} ${beaufort(v)})${ms ? ` = ${Number(spd)} m/s` : ''}`;
  const boe = gust ? `, ${s === 'de' ? 'Böen' : 'gusts'} ${kn(gust)} kn` : '';
  return `${woher}, ${staerke}${boe}`;
}

export function metarKlartext(roh: string, s: Sprache): MetarKlartext {
  const gruppen = roh.trim().replace(/=$/, '').split(/\s+/).filter(Boolean);
  const zeilen: MetarZeile[] = [];
  const unbekannt: string[] = [];
  let icao: string | null = null;
  let zeit: MetarKlartext['zeit'] = null;
  const art: string[] = [];
  const add = (titel: T, text: string) => {
    const tt = t(titel, s);
    const da = zeilen.find((z) => z.titel === tt);
    if (da) da.text += `; ${text}`; else zeilen.push({ titel: tt, text });
  };
  let i = 0;

  for (; i < gruppen.length; i++) {
    const g = gruppen[i]!;
    if (g === 'METAR' || g === 'SPECI') { if (g === 'SPECI') art.push(s === 'de' ? 'Sondermeldung (SPECI)' : 'special report (SPECI)'); continue; }
    if (g === 'COR') { art.push(s === 'de' ? 'berichtigt' : 'corrected'); continue; }
    if (g === 'AUTO') { art.push(s === 'de' ? 'automatisch, ohne Beobachter' : 'automatic, no observer'); continue; }
    if (!icao && /^[A-Z]{4}$/.test(g)) { icao = g; continue; }
    const z = /^(\d{2})(\d{2})(\d{2})Z$/.exec(g);
    if (z && !zeit) { zeit = { tag: Number(z[1]), stunde: Number(z[2]), minute: Number(z[3]) }; continue; }
    break;
  }
  if (art.length) add(TITEL.art, art.join(', '));

  let trend: string[] | null = null;
  const trendTeile: string[] = [];
  const schliesseTrend = () => { if (trend && trend.length) trendTeile.push(trend.join(' ')); trend = null; };

  for (; i < gruppen.length; i++) {
    const g = gruppen[i]!;
    if (g === 'RMK') { add(TITEL.bemerkung, gruppen.slice(i + 1).join(' ')); break; }

    if (g === 'NOSIG') { schliesseTrend(); trendTeile.push(s === 'de' ? 'keine wesentliche Änderung (NOSIG)' : 'no significant change (NOSIG)'); continue; }
    if (g === 'BECMG' || g === 'TEMPO') {
      schliesseTrend();
      trend = [g === 'BECMG' ? (s === 'de' ? 'allmählich' : 'becoming') : (s === 'de' ? 'zeitweise' : 'temporarily')];
      continue;
    }
    if (trend) {
      const tz = /^(FM|TL|AT)(\d{2})(\d{2})$/.exec(g);
      if (tz) { trend.push(`${{ FM: s === 'de' ? 'ab' : 'from', TL: s === 'de' ? 'bis' : 'until', AT: s === 'de' ? 'um' : 'at' }[tz[1] as 'FM']} ${tz[2]}:${tz[3]} UTC`); continue; }
      if (g === 'NSW') { trend.push(s === 'de' ? 'keine signifikanten Wettererscheinungen mehr' : 'no significant weather'); continue; }
      const st = beschreibeGruppe(g, s);
      trend.push(st ? st.text : g);
      continue;
    }

    if (g === 'WS') {
      const rest = gruppen[i + 1] === 'ALL' ? (i += 2, s === 'de' ? 'alle Pisten' : 'all runways') : (i += 1, (gruppen[i] ?? '').replace(/^R(WY)?/, s === 'de' ? 'Piste ' : 'runway '));
      add(TITEL.scherung, rest);
      continue;
    }
    const st = beschreibeGruppe(g, s);
    if (st) add(st.titel, st.text); else unbekannt.push(g);
  }
  schliesseTrend();
  if (trendTeile.length) add(TITEL.trend, trendTeile.join('; '));
  return { icao, zeit, zeilen, unbekannt };
}

function beschreibeGruppe(g: string, s: Sprache): { titel: T; text: string } | null {
  let m: RegExpExecArray | null;
  if ((m = /^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/.exec(g))) return { titel: TITEL.wind, text: windText(m, s) };
  if ((m = /^(\d{3})V(\d{3})$/.exec(g))) return { titel: TITEL.wind, text: `${s === 'de' ? 'Richtung wechselnd' : 'direction varying'} ${grad(m[1]!)}–${grad(m[2]!)}` };
  if (g === 'CAVOK') {
    return { titel: TITEL.sicht, text: s === 'de'
      ? 'CAVOK: 10 km oder mehr, keine Wolken unter 5000 ft (1520 m), keine signifikanten Wettererscheinungen'
      : 'CAVOK: 10 km or more, no cloud below 5,000 ft (1,520 m), no significant weather' };
  }
  if ((m = /^(\d{4})(NDV)?$/.exec(g))) return { titel: TITEL.sicht, text: sichtText(Number(m[1]), s) };
  if ((m = /^(\d{4})(N|NE|E|SE|S|SW|W|NW)$/.exec(g))) {
    return { titel: TITEL.sicht, text: `${s === 'de' ? 'Mindestsicht' : 'minimum'} ${sichtText(Number(m[1]), s)} ${s === 'de' ? 'Richtung' : 'to the'} ${t(RICHTUNG[m[2]!]!, s)}` };
  }
  if ((m = /^R(\d{2}[LCR]?)\/([PM]?)(\d{4})(?:V([PM]?)(\d{4}))?(?:FT)?\/?([UDN])?$/.exec(g))) {
    const wert = (pm: string | undefined, x: string) => `${pm === 'P' ? (s === 'de' ? 'über ' : 'above ') : pm === 'M' ? (s === 'de' ? 'unter ' : 'below ') : ''}${Number(x)} m`;
    const tendenz = m[6] ? `, ${{ U: s === 'de' ? 'zunehmend' : 'increasing', D: s === 'de' ? 'abnehmend' : 'decreasing', N: s === 'de' ? 'gleichbleibend' : 'no change' }[m[6] as 'U']}` : '';
    return { titel: TITEL.rvr, text: `${s === 'de' ? 'Piste' : 'runway'} ${m[1]}: ${wert(m[2], m[3]!)}${m[5] ? `–${wert(m[4], m[5])}` : ''}${tendenz}` };
  }
  if ((m = /^R\d{2}[LCR]?\/[\d/]{6}$/.exec(g)) || /^R\d{2}[LCR]?\/CLRD\d{2}$/.test(g)) return { titel: TITEL.piste, text: g };
  if ((m = /^(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU|\/\/\/)?$/.exec(g))) {
    const h = m[2] === '///' ? (s === 'de' ? 'Höhe unbekannt' : 'height unknown') : hoehe(Number(m[2]), s);
    const arten = m[3] && m[3] !== '///' ? `, ${t(WOLKENART[m[3]]!, s)}` : '';
    return { titel: TITEL.wolken, text: `${t(BEDECKUNG[m[1]!]!, s)} ${s === 'de' ? 'in' : 'at'} ${h}${arten}` };
  }
  if (g === 'NSC') return { titel: TITEL.wolken, text: s === 'de' ? 'keine signifikanten Wolken (NSC)' : 'no significant cloud (NSC)' };
  if (g === 'NCD') return { titel: TITEL.wolken, text: s === 'de' ? 'keine Wolken erkannt (NCD, automatisch)' : 'no cloud detected (NCD, automatic)' };
  if (g === 'SKC' || g === 'CLR') return { titel: TITEL.wolken, text: s === 'de' ? 'wolkenlos' : 'sky clear' };
  if ((m = /^VV(\d{3}|\/\/\/)$/.exec(g))) {
    return { titel: TITEL.wolken, text: `${s === 'de' ? 'Vertikalsicht' : 'vertical visibility'} ${m[1] === '///' ? (s === 'de' ? 'unbekannt' : 'unknown') : hoehe(Number(m[1]), s)}` };
  }
  if ((m = /^(M?\d{2})\/(M?\d{2}|\/\/)?$/.exec(g))) {
    const tc = temp(m[1]!);
    const td = m[2] && m[2] !== '//' ? temp(m[2]) : null;
    return { titel: TITEL.temp, text: `${tc} °C${td !== null ? `, ${s === 'de' ? 'Taupunkt' : 'dew point'} ${td} °C` : ''}` };
  }
  if ((m = /^Q(\d{4})$/.exec(g))) return { titel: TITEL.qnh, text: `${Number(m[1])} hPa` };
  if ((m = /^A(\d{4})$/.exec(g))) return { titel: TITEL.qnh, text: `${Math.round((Number(m[1]) / 100) * INHG_ZU_HPA)} hPa (${nf(Number(m[1]) / 100, 2, 'en')} inHg)` };
  if ((m = /^RE([A-Z]+)$/.exec(g))) { const w = wetterKlartext(m[1]!, s); return w ? { titel: TITEL.vorher, text: w } : null; }
  const w = wetterKlartext(g, s);
  return w ? { titel: TITEL.wetter, text: w } : null;
}
