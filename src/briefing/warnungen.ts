import type { Sprache } from '@/core/types';
import { LAND_ZONE, type WarnStufe, type WarnTreffer, type WarnTyp } from '@/core/warnungen';
import { uhrLtVon, datumUhrLtVon } from '@/core/time';

const STUFE: Record<WarnStufe, { de: string; en: string }> = {
  2: { de: 'Gelb', en: 'yellow' }, 3: { de: 'Orange', en: 'orange' }, 4: { de: 'Rot', en: 'red' },
};

const WARNUNG: Record<WarnTyp, { de: string; en: string }> = {
  wind: { de: 'Windwarnung', en: 'wind warning' },
  gewitter: { de: 'Gewitterwarnung', en: 'thunderstorm warning' },
  nebel: { de: 'Nebelwarnung', en: 'fog warning' },
  kueste: { de: 'Warnung vor Seegang und Küstenhochwasser', en: 'warning of high seas and coastal flooding' },
  see: { de: 'Warnung vor Gefahren auf See', en: 'marine hazard warning' },
};

export const WARNART: Record<WarnTyp, { de: string; en: string }> = {
  wind: { de: 'Wind', en: 'wind' },
  gewitter: { de: 'Gewitter', en: 'thunderstorms' },
  nebel: { de: 'Nebel', en: 'fog' },
  kueste: { de: 'Seegang und Küstenhochwasser', en: 'high seas and coastal flooding' },
  see: { de: 'Gefahren auf See', en: 'marine hazards' },
};

export function warnName(t: Pick<WarnTreffer, 'typ' | 'stufe'>, sprache: Sprache): string {
  return sprache === 'en'
    ? `${STUFE[t.stufe].en} ${WARNUNG[t.typ].en}`
    : `${WARNUNG[t.typ].de}, Warnstufe ${STUFE[t.stufe].de}`;
}

const loc = (s: Sprache) => (s === 'en' ? 'en-GB' : 'de-AT');
const zone = (land: string) => LAND_ZONE[land] ?? 'UTC';

export function warnZeit(iso: string, land: string, sprache: Sprache): string {
  const t = Date.parse(iso);
  const tag = new Intl.DateTimeFormat(loc(sprache), { timeZone: zone(land), weekday: 'short' }).format(new Date(t));

  return `${sprache === 'en' || tag.endsWith('.') ? tag : `${tag}.`} ${uhrLtVon(t, zone(land))}`;
}

const liste = (namen: string[], sprache: Sprache): string =>
  namen.length < 2 ? namen.join('') : `${namen.slice(0, -1).join(', ')} ${sprache === 'en' ? 'and' : 'und'} ${namen.at(-1)}`;

const dienst = (a: string) => a.split(' - ')[0]!.trim();

export function warnZeitraum(t: WarnTreffer, sprache: Sprache): string {
  return `${warnZeit(t.von, t.land, sprache)} ${sprache === 'en' ? 'to' : 'bis'} ${warnZeit(t.bis, t.land, sprache)}`;
}

export const warnDienste = (t: WarnTreffer): string => [...new Set(t.absender.map(dienst))].join(', ');

export function warnTeil(t: WarnTreffer, sprache: Sprache): string {
  const en = sprache === 'en';
  const wer = warnDienste(t);
  return `${warnName(t, sprache)}${en ? '' : ','} ${en ? 'for' : 'für'} ${liste(t.gebiete, sprache)} (${warnZeitraum(t, sprache)}${wer ? `, ${wer}` : ''})`;
}

export const warnGebiete = (t: WarnTreffer, sprache: Sprache): string => liste(t.gebiete, sprache);

function stand(iso: string | null, sprache: Sprache): string {
  if (!iso) return '';
  const d = datumUhrLtVon(Date.parse(iso), sprache === 'en' ? 'en' : 'de', { day: '2-digit', month: '2-digit' });
  return sprache === 'en' ? `, as of ${d}` : `, Stand ${d}`;
}

export function warnSaetze(
  treffer: readonly WarnTreffer[], standIso: string | null, sprache: Sprache,
): { kritisch: string | null; beachten: string | null } {
  const satz = (ts: readonly WarnTreffer[]): string | null => {
    if (!ts.length) return null;
    const teile = ts.map((t) => warnTeil(t, sprache)).join('; ');
    return sprache === 'en'
      ? `Official weather warnings for the coast along the route (MeteoAlarm${stand(standIso, sprache)}): ${teile}.`
      : `Amtliche Wetterwarnungen für die Küste der Route (MeteoAlarm${stand(standIso, sprache)}): ${teile}.`;
  };
  return { kritisch: satz(treffer.filter((t) => t.stufe >= 3)), beachten: satz(treffer.filter((t) => t.stufe === 2)) };
}

export function warnFazit(treffer: readonly WarnTreffer[], sprache: Sprache): string | null {
  const stark = treffer.filter((t) => t.stufe >= 3);
  if (!stark.length) return null;
  const l = sprache === 'en' ? 'en' : 'de';
  const hoechste = Math.max(...stark.map((t) => t.stufe)) as 3 | 4;
  const was = [...new Set(stark.filter((t) => t.stufe === hoechste).map((t) => WARNART[t.typ][l]))];
  return sprache === 'en'
    ? `An official ${STUFE[hoechste].en} warning for ${liste(was, sprache)} applies to the coast along the route: check the current level before casting off.`
    : `Für die Küste der Route gilt eine amtliche Warnung der Warnstufe ${STUFE[hoechste].de} vor ${liste(was, sprache)}: vor dem Ablegen den aktuellen Stand prüfen.`;
}

export function warnQuelle(sprache: Sprache): string {
  return sprache === 'en' ? 'Source: MeteoAlarm, data provided by EUMETNET members (CC BY 4.0)'
    : 'Quelle: MeteoAlarm, Daten der EUMETNET-Mitglieder (CC BY 4.0)';
}
