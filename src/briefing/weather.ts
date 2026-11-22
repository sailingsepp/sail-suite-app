import { uhrLt, nf } from '@/core/time';
import type { Ablegezeit, WetterEreignis, Warnung, EreignisTyp, StundenWind, Sprache } from '@/core/types';
import { beaufort, anzeigeKn } from './wind';
import { describeGelaendeeffekte } from './terrain';
import { describeGewitterlage } from './gewitter';
import { meeresgebietAm } from '@/core/meeresgebiete';
import type { Synoptik } from './synoptik';

export const NEBEL_SPREAD_MAX = 3;

export function nebelSpread(hourly: StundenWind, idxs: number[]): number | null {
  if (!hourly.temperature_2m || !hourly.dew_point_2m) return null;
  let kleinster: number | null = null;
  for (const i of idxs) {
    if (hourly.weather_code[i] !== 45 && hourly.weather_code[i] !== 48) continue;
    const t = hourly.temperature_2m[i], td = hourly.dew_point_2m[i];
    if (t == null || td == null) continue;
    const spread = t - td;
    if (kleinster === null || spread < kleinster) kleinster = spread;
  }
  return kleinster === null ? null : Math.round(kleinster);
}

export function nebelUnstimmig(spread: number, sprache: Sprache = 'de'): string {
  if (sprache === 'en') {
    return ` The model reports fog, but with ${nf(spread, 0, 'en')} K between temperature and `
      + 'dew point the air is too dry for that. The two figures contradict each other.';
  }
  return ` Das Modell meldet Nebel, doch mit ${nf(spread, 0)} K zwischen Temperatur und `
    + 'Taupunkt ist die Luft dafür zu trocken. Die beiden Angaben widersprechen sich.';
}

export const NEBEL_SICHT_MAX_M = 5000;

export function sichtBeiNebel(hourly: StundenWind, idxs: number[]): number | null {
  if (!hourly.visibility) return null;
  let kleinste: number | null = null;
  for (const i of idxs) {
    if (hourly.weather_code[i] !== 45 && hourly.weather_code[i] !== 48) continue;
    const v = hourly.visibility[i];
    if (v == null) continue;
    if (kleinste === null || v < kleinste) kleinste = v;
  }
  return kleinste;
}

export function sichtUnstimmig(sichtM: number, sprache: Sprache = 'de'): string {
  if (sprache === 'en') {
    return ` The model reports fog, but shows around ${Math.round(sichtM / 100) * 100} m `
      + 'visibility for the same hour. The two figures contradict each other.';
  }
  return ` Das Modell meldet Nebel, zeigt für dieselbe Stunde aber rund ${Math.round(sichtM / 100) * 100} m `
    + 'Sicht. Die beiden Angaben widersprechen sich.';
}

function describePrecipEn(b: Ablegezeit): string | null {
  if (b.maxPrecip < 0.4) return null;
  const wo = !b.precipFirst ? ''
    : (b.precipFirst.nm < 1 ? ' from the start'
      : ` from ${uhrLt(b.precipFirst.time)}, around nautical mile ${nf(b.precipFirst.nm, 0, 'en')}`);
  const anteil = b.precipShare > 0.6 ? 'almost continuously'
    : b.precipShare > 0.25 ? `over roughly ${Math.round(b.precipShare * 100)} % of the passage` : 'intermittently';
  if (b.maxPrecip >= 10) return `Torrential rain ${anteil}${wo}, up to ${nf(b.maxPrecip, 0, 'en')} mm/h: visibility drops to a few hundred metres in it.`;
  if (b.maxPrecip >= 5) return `Heavy rain ${anteil}${wo}, up to ${nf(b.maxPrecip, 0, 'en')} mm/h. Visibility markedly reduced: adjust radar and lookout accordingly.`;
  if (b.maxPrecip >= 2) return `Rain ${anteil}${wo}, up to ${nf(b.maxPrecip, 1, 'en')} mm/h. Keep the oilskins to hand.`;
  return `Light rain ${anteil}${wo}: more of a nuisance than a hazard.`;
}

export function describePrecip(b: Ablegezeit, sprache: Sprache = 'de'): string | null {
  if (sprache === 'en') return describePrecipEn(b);
  if (b.maxPrecip < 0.4) return null;
  const wo = !b.precipFirst ? ''
    : (b.precipFirst.nm < 1 ? ' von Anfang an'
      : ` ab ${uhrLt(b.precipFirst.time)}, etwa ab Seemeile ${nf(b.precipFirst.nm, 0)}`);
  const anteil = b.precipShare > 0.6 ? 'nahezu durchgehend'
    : b.precipShare > 0.25 ? `auf rund ${Math.round(b.precipShare * 100)} % der Strecke` : 'zeitweise';
  if (b.maxPrecip >= 10) return `Heftiger Regen ${anteil}${wo}, bis ${nf(b.maxPrecip, 0)} mm/h: die Sicht geht dabei auf wenige hundert Meter zurück.`;
  if (b.maxPrecip >= 5) return `Starkregen ${anteil}${wo}, bis ${nf(b.maxPrecip, 0)} mm/h. Sicht deutlich herabgesetzt, Radar und Ausguck entsprechend.`;
  if (b.maxPrecip >= 2) return `Regen ${anteil}${wo}, bis ${nf(b.maxPrecip, 1)} mm/h. Ölzeug griffbereit.`;
  return `Leichter Regen ${anteil}${wo}: mehr lästig als hinderlich.`;
}

const WMO_TEXT: Partial<Record<number, string>> = {
  45: 'Nebel', 48: 'gefrierender Nebel',
  55: 'dichter Spruehregen', 65: 'starker Regen', 67: 'starker gefrierender Regen',
  75: 'starker Schneefall', 82: 'heftige Regenschauer', 86: 'starke Schneeschauer',
  95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'schweres Gewitter mit Hagel',
};

const WMO_TEXT_EN: Partial<Record<number, string>> = {
  45: 'fog', 48: 'freezing fog',
  55: 'dense drizzle', 65: 'heavy rain', 67: 'heavy freezing rain',
  75: 'heavy snowfall', 82: 'violent rain showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'severe thunderstorm with hail',
};

export function buildWarnings(ev: WetterEreignis[], sprache: Sprache = 'de'): Warnung[] {
  const out: Warnung[] = [];
  const first = (t: EreignisTyp) => [...ev].filter((e) => e.type === t).sort((a, b) => a.t - b.t)[0];
  const worst = <K extends keyof WetterEreignis>(t: EreignisTyp, key: K) =>
    [...ev].filter((e) => e.type === t).sort((a, b) => (b[key] as number) - (a[key] as number))[0];
  const wo = (e: WetterEreignis) => sprache === 'en'
    ? `from ${uhrLt(e.time)}, around nautical mile ${e.nm.toFixed(0)} of the route`
    : `ab ${uhrLt(e.time)}, etwa ab Seemeile ${e.nm.toFixed(0)} der Strecke`;
  const wmoText = (code: number | null) => code !== null
    ? (sprache === 'en' ? WMO_TEXT_EN[code] : WMO_TEXT[code]) : undefined;

  const g = first('gewitter');
  if (g) {
    const w = worst('gewitter', 'code')!;
    if (sprache === 'en') {
      out.push({
        lvl: 'rot', text: `<b>${wmoText(w.code) || 'Thunderstorm'}</b>: ${wo(g)}. `
          + `Thunderstorm gusts reach several times the forecast mean wind and can shift direction abruptly; `
          + `they are not reliably captured in the model's gust figures. Avoid open water, get sail down in good time.`,
      });
    } else {
      out.push({
        lvl: 'rot', text: `<b>${wmoText(w.code) || 'Gewitter'}</b>: ${wo(g)}. `
          + `Gewitterböen erreichen ein Vielfaches des vorhergesagten Mittelwinds und drehen sprunghaft; `
          + `sie sind in den Böenwerten des Modells nicht verlässlich enthalten. Freies Wasser meiden, Segel rechtzeitig bergen.`,
      });
    }
  }
  const c = first('cape');
  if (!g && c) {
    const w = worst('cape', 'cape')!;
    if (sprache === 'en') {
      out.push({
        lvl: 'gelb', text: `<b>Thunderstorm potential</b>: unstable air along the route `
          + `(CAPE up to ${w.cape.toFixed(0)} J/kg, highest value ${wo(w)}). `
          + `The model does not forecast a thunderstorm, but the air mass would support one.`,
      });
    } else {
      out.push({
        lvl: 'gelb', text: `<b>Gewitterneigung</b>: labile Schichtung entlang der Route `
          + `(CAPE bis ${w.cape.toFixed(0)} J/kg, höchster Wert ${wo(w)}). `
          + `Das Modell sagt kein Gewitter vorher, die Luftmasse wäre aber dafür geeignet.`,
      });
    }
  }
  const r = first('regen');
  if (r) {
    const w = worst('regen', 'precip')!;
    if (sprache === 'en') {
      out.push({
        lvl: 'gelb', text: `<b>Heavy rain</b>: up to ${nf(w.precip, 1, 'en')} mm/h, ${wo(r)}. `
          + `Visibility markedly reduced in rain; adjust radar returns and lookout accordingly.`,
      });
    } else {
      out.push({
        lvl: 'gelb', text: `<b>Starkregen</b>: bis ${nf(w.precip, 1)} mm/h, ${wo(r)}. `
          + `Sicht unter Regen deutlich herabgesetzt; Radarreflexe und Ausguck entsprechend anpassen.`,
      });
    }
  }
  const st = first('sturm');
  if (st) {
    const w = worst('sturm', 'gust')!;

    const gust = anzeigeKn(w.gust);
    if (sprache === 'en') {
      out.push({ lvl: 'rot', text: `<b>Strong wind up to Force ${beaufort(gust)}</b>: gusts to ${gust} kn, ${wo(st)}.` });
    } else {
      out.push({ lvl: 'rot', text: `<b>Starkwind bis ${beaufort(gust)} Beaufort</b>: Böen bis ${gust} kn, ${wo(st)}.` });
    }
  }
  const n = first('nebel');
  if (n) {

    const unstimmig = n.visibility !== null && n.visibility >= NEBEL_SICHT_MAX_M;
    if (sprache === 'en') {
      out.push({
        lvl: 'gelb',
        text: `<b>Fog</b>: ${wo(n)}. `
          + (unstimmig
            ? `Caution: for the same hour the model computes around ${Math.round(n.visibility! / 100) * 100} m `
              + `visibility. The two figures contradict each other, this is not an all-clear.`
            : 'Tricky without radar and AIS.'),
      });
    } else {
      out.push({
        lvl: 'gelb',
        text: `<b>Nebel</b>: ${wo(n)}. `
          + (unstimmig
            ? `Achtung: Für dieselbe Stunde rechnet das Modell rund ${Math.round(n.visibility! / 100) * 100} m `
              + `Sicht. Die beiden Angaben widersprechen sich, das ist keine Entwarnung.`
            : 'Ohne Radar und AIS heikel.'),
      });
    }
  }
  return out;
}

const NEBELARM_OST = new Set(['28f', '28g', '28h', '28B']);

function describeNebeltypEn(zeit: Date, monat: number, lat: number, lon: number): string | null {
  const h = zeit.getUTCHours();
  const frueh = h < 11;
  const nordadria = lat >= 44.5 && lon >= 12.0 && lon <= 14.6;
  const vorsaison = monat >= 4 && monat <= 6;
  const nachsaison = monat >= 9;

  if (frueh && nachsaison) {
    return 'Timing and season fit <b>radiation fog</b>: it forms during the long, clear nights over '
      + 'the hinterland and is carried out to the coastal waters on the land breeze. That means two '
      + 'things. It sits <i>close to shore</i>, and it is temporary. Point the bow out to open water '
      + 'and it clears within a few miles; in harbour or at anchor, waiting until around 1000 LT is '
      + 'usually enough for even the most stubborn morning fog to burn off.';
  }
  if (frueh && vorsaison && nordadria) {
    return 'Timing, season and area fit early-season <b>sea fog</b>: warm air drifts over the still-cold '
      + 'water of the northern Adriatic and cools at the surface. Unlike autumn\'s radiation fog, this '
      + 'is <i>not</i> a coastal phenomenon. Visibility can still be fine on leaving harbour, with the '
      + 'fog bank only closing in further out. The layer is sometimes so shallow that sun and blue sky '
      + 'show through it; for navigation, that glimpse of light helps not at all.';
  }
  if (!NEBELARM_OST.has(meeresgebietAm(lat, lon)?.id ?? '')) return null;
  return 'In the sailing season, the eastern Mediterranean is one of the least fog-prone waters in '
    + 'Europe. The coastal mountains dry the air out as it flows over them, and local mountain winds '
    + 'mix it. A fog report here is more the exception than routine, which is exactly why it is worth '
    + 'taking seriously rather than dismissing. The areas most prone to fog are the northern Gulf of '
    + 'Venice, the Gulf of Trieste and the coastal waters of Istria, plus low-lying coasts with river '
    + 'mouths.';
}

export function describeNebeltyp(zeit: Date, monat: number, lat: number, lon: number, sprache: Sprache = 'de'): string | null {
  if (sprache === 'en') return describeNebeltypEn(zeit, monat, lat, lon);
  const h = zeit.getUTCHours();
  const frueh = h < 11;

  const nordadria = lat >= 44.5 && lon >= 12.0 && lon <= 14.6;
  const vorsaison = monat >= 4 && monat <= 6;
  const nachsaison = monat >= 9;

  if (frueh && nachsaison) {
    return 'Zeitpunkt und Jahreszeit passen zum <b>Strahlungsnebel</b>: Er entsteht in den langen, '
      + 'klaren Nächten über dem Hinterland und wird mit der Landbrise auf die Küstengewässer '
      + 'hinausgetragen. Das heißt zweierlei. Er liegt <i>dicht unter Land</i>, und er ist '
      + 'vorübergehend. Wer den Bug auf die freie See richtet, hat ihn nach wenigen Seemeilen hinter '
      + 'sich; im Hafen oder in der Ankerbucht reicht es meist, bis etwa 1000 LT zu warten, dann löst '
      + 'sich auch der hartnäckigste Morgennebel auf.';
  }
  if (frueh && vorsaison && nordadria) {
    return 'Zeitpunkt, Jahreszeit und Revier passen zum <b>Kaltwassernebel</b> der Vorsaison: Warme Luft '
      + 'sickert über das noch kühle Wasser der nördlichen Adria und kühlt an der Oberfläche ab. '
      + 'Anders als der herbstliche Strahlungsnebel ist er <i>kein</i> Küstenphänomen. Es kann '
      + 'passieren, dass die Sicht beim Auslaufen noch reicht und man erst weiter draußen in die '
      + 'Nebelsuppe eintaucht. Die Nebeldecke ist dabei mitunter so flach, dass Sonne und blauer '
      + 'Himmel durchschimmern; für die Navigation hilft dieser Lichtblick nichts.';
  }
  if (!NEBELARM_OST.has(meeresgebietAm(lat, lon)?.id ?? '')) return null;
  return 'Das östliche Mittelmeer zählt in der Segelsaison zu den nebelärmsten Gewässern Europas. '
    + 'Die Küstenberge trocknen die Luft beim Überströmen aus, und lokale Bergwinde durchmischen sie. '
    + 'Eine Nebelmeldung ist hier eher die Ausnahme, und genau deshalb lohnt es, sie ernst zu nehmen '
    + 'statt sie für Routine zu halten. Nebelanfällig sind vor allem der nördliche Golf von Venedig, '
    + 'der Golf von Triest und die Küstengewässer Istriens, dazu Flachküsten mit Flussmündungen.';
}

export function describeWarnings(
  b: Ablegezeit, syn?: Synoptik | null, sprache: Sprache = 'de',

  amtGewitter: string | null = null,
): string[] {

  const hat = (t: EreignisTyp) => b.events.some((e) => e.type === t);
  const out: string[] = [];
  if (sprache === 'en') {
    if (hat('gewitter'))
      out.push('There is a thunderstorm on the route. This is not a scoring penalty, it is a reason to stay in port.');
    else if (hat('cape') && amtGewitter)
      out.push(`The air mass is unstable, and thunderstorms are forecast officially for these waters (${amtGewitter}). The model does not yet place one on the route. Keep an eye on the sky.`);
    else if (hat('cape'))
      out.push('The air mass is unstable. The model does not yet forecast a thunderstorm, but the ingredients are there. Keep an eye on the sky.');
  } else {
    if (hat('gewitter'))
      out.push('Auf der Route steht ein Gewitter. Das ist kein Rechenabschlag, sondern ein Grund, im Hafen zu bleiben.');
    else if (hat('cape') && amtGewitter)
      out.push(`Die Luftmasse ist labil, und amtlich sind für dieses Seegebiet Gewitter angesagt (${amtGewitter}). Das Modell setzt noch keines auf die Route. Himmel im Auge behalten.`);
    else if (hat('cape'))
      out.push('Die Luftmasse ist labil. Das Modell setzt noch kein Gewitter, aber die Zutaten sind da. Himmel im Auge behalten.');
  }

  const gewitterlage = describeGewitterlage(b, b.departure.getUTCMonth() + 1, syn, sprache);
  if (gewitterlage) out.push(gewitterlage);
  if (hat('sturm')) {
    out.push(sprache === 'en'
      ? 'The gusts are above the set limit.'
      : 'Die Böen liegen über dem eingestellten Grenzwert.');
  }
  if (hat('nebel')) {
    const n = b.events.filter((e) => e.type === 'nebel').sort((x, y) => x.t - y.t)[0]!;

    if (n.visibility !== null && n.visibility >= NEBEL_SICHT_MAX_M) {
      if (sprache === 'en') {
        out.push(`The model reports fog on the route but computes around `
          + `${Math.round(n.visibility / 100) * 100} m visibility for the same hour. The two figures `
          + `contradict each other. Treat this as an open question, not an all-clear: check what the `
          + `official sea forecast says for the area.`);
      } else {
        out.push(`Das Modell meldet Nebel auf der Route, rechnet für dieselbe Stunde aber rund `
          + `${Math.round(n.visibility / 100) * 100} m Sicht. Die beiden Angaben widersprechen sich. `
          + `Das ist eine offene Frage, keine Entwarnung: nachsehen, was der amtliche `
          + `Seewetterbericht für das Revier sagt.`);
      }
    } else if (sprache === 'en') {
      out.push('Fog along the route: tricky without radar and AIS.');
      const typ = describeNebeltyp(n.time, b.departure.getUTCMonth() + 1, b.midLat, b.midLon, 'en');
      if (typ) out.push(typ);
    } else {
      out.push('Nebel entlang der Route: ohne Radar und AIS heikel.');
      const typ = describeNebeltyp(n.time, b.departure.getUTCMonth() + 1, b.midLat, b.midLon);
      if (typ) out.push(typ);
    }
  }

  const gelaende = describeGelaendeeffekte(b, sprache);
  if (gelaende) out.push(gelaende);
  return out;
}
