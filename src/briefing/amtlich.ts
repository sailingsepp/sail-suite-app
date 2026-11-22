import type { Sprache } from '@/core/types';
import { escapeHtml } from '@/core/html';
import { nDate, datumKurz } from '@/core/time';
import { dhmzWarnungen, imDhmzGebiet, ohneOrtsangabe, type Warnangabe } from '@/core/warnlage';

type StreckenOrt = { lat?: number; lon?: number; time?: Date };

function trifftStrecke(t: Warnangabe, strecke: readonly StreckenOrt[] | null | undefined): boolean {
  if (!strecke?.length) return true;

  const zurZeit = strecke.filter((p) => zurWarnzeit(t, p.time));
  if (!zurZeit.length) return false;
  const k = t.kasten;
  if (k) return zurZeit.some((p) => p.lat != null && p.lon != null && p.lat >= k.s && p.lat <= k.n && p.lon >= k.w && p.lon <= k.o);
  const g = t.gebiete;
  if (g) return zurZeit.some((p) => p.lat != null && imDhmzGebiet(g, p.lat));
  return true;
}

function zurWarnzeit(t: Warnangabe, zeit: Date | undefined): boolean {
  const z = t.zeit;
  if (!zeit || !z) return true;
  if (z.art === 'stunden') {
    const h = zeit.getUTCHours() + zeit.getUTCMinutes() / 60;
    return h >= z.von && h <= z.bis;
  }
  if (z.art === 'revier') return zeit.getTime() >= z.vonMs && zeit.getTime() <= z.bisMs;
  return true;
}

export interface AmtlicherBericht {

  sprache: 'de' | 'en' | 'es';
  kopf: string;

  datum: string | null;

  stunde?: number | null;

  warnung: string | null;
  abschnitte: { titel: string | null; text: string }[];
  url: string;

  herkunft?: 'dhmz' | GebietsHerkunft;

  tendenz?: AmtlicheTendenz[];

  gebiete?: string[];
}

export interface AmtlicheTendenz { gebiet: string; von: number; bis: number; text: string; bft: number; see: number | null }

export type GebietsHerkunft = 'hnms' | 'meteomar' | 'mgm' | 'aemet' | 'dom';

export interface GebietsBericht {

  herkunft?: GebietsHerkunft;

  sprache?: 'en' | 'es';
  kopf: string;

  datum: string;
  url: string;
  hinweise: string;
  synopsis: { titel: string; text: string } | null;
  vorhersageTitel: string | null;

  gebiete: { name: string; text: string; tendenz?: string; gruppe?: string }[];
  ausblick: { titel: string; text: string } | null;
  tendenzTitel?: string | null;

  warnung: { kopf: string; gebiete: { name: string; zeilen: string[]; gruppe?: string }[] } | null;
}

export type HnmsBericht = GebietsBericht;

const GEWITTER_WORT = /THUNDER|\bTSTMS?\b|\btorment(?:a|as|oso|osa|osos|osas)\b/i;
export function nenntGewitter(text: string): boolean {
  return GEWITTER_WORT.test(text.replace(/\b(?:VERY POOR|POOR|MODERATE)\s+IN\s+ANY\s+THUNDERSTORMS?\b/gi, ''));
}

function gebietsGewitter(b: AmtlicherBericht, dateStr: string, ab: Date | null): boolean {
  if (!b.datum || !giltFuer(b, dateStr, ab)) return false;
  if (b.warnung && nenntGewitter(b.warnung.replace(/<[^>]+>/g, ' '))) return true;
  const eigene = new Set(b.gebiete ?? []);
  return b.abschnitte.some((a) => a.titel !== null && eigene.has(a.titel) && nenntGewitter(a.text));
}

export function amtlicherDienst(b: AmtlicherBericht, sprache: Sprache = 'de'): string {
  return b.herkunft && b.herkunft !== 'dhmz' ? DIENST[b.herkunft][sprache === 'en' ? 'en' : 'de'] : 'DHMZ Split';
}

function zeilen(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

export function kopfMitUhrzeit(kopf: string): string {
  return kopf
    .replace(/(\bum \d{1,2})\s*$/, '$1 Uhr')
    .replace(/(\bat \d{1,2})\s*$/, '$1:00');
}

export function amtlicheBoeen(
  b: AmtlicherBericht | null | undefined, dateStr: string, ab: Date | null = null,

  strecke: readonly StreckenOrt[] | null = null,

  nurMitOrt = false,
): AmtlicheBoeen | null {
  if (!b || !b.warnung || !giltFuer(b, dateStr, ab)) return null;
  if (b.herkunft && b.herkunft !== 'dhmz') return null;

  const teile = dhmzWarnungen(b.warnung, { datum: b.datum, stunde: b.stunde ?? null }).filter((t) => trifftStrecke(t, strecke) && !(nurMitOrt && ohneOrtsangabe(t)));
  const zahlen = teile.flatMap((t) => (t.boeenKn ? [t.boeenKn.von, t.boeenKn.bis] : []));
  const nachts = teile.some((t) => t.zeit?.art === 'nacht');
  const alleOffeneSee = teile.length > 0 && teile.every((t) => t.offeneSee);
  if (!zahlen.length) return null;
  return {
    von: Math.min(...zahlen), bis: Math.max(...zahlen), nachts, offeneSee: alleOffeneSee,
    giltBis: passtZumTag(b, dateStr) ? null : gueltigBis(b),
  };
}

export function amtlicheGewitter(
  b: AmtlicherBericht | null | undefined, dateStr: string,
  strecke: readonly StreckenOrt[] | null = null,

  ab: Date | null = null,
): boolean {
  if (b && b.herkunft && b.herkunft !== 'dhmz') return gebietsGewitter(b, dateStr, ab);
  if (!b || !b.warnung || !b.datum) return false;
  const versatz = Math.round((Date.parse(`${dateStr}T12:00:00Z`) - Date.parse(`${b.datum}T12:00:00Z`)) / 86_400_000);
  if (versatz !== 0 && versatz !== 1) return false;
  const gebietAus = (t: string): string[] | null => {
    const g = [
      /nördlich|noerdlich|\bnorth(ern)?\b/i.test(t) ? 'NORTH ADRIATIC' : null,
      /mittler|\bcentral\b|\bmiddle\b/i.test(t) ? 'CENTRAL ADRIATIC' : null,
      /südlich|suedlich|\bsouth(ern)?\b(?!\s*(-|–)?\s*(west|east|wind))/i.test(t) ? 'SOUTH ADRIATIC' : null,
    ].filter((x): x is string => x !== null);
    return g.length ? g : null;
  };
  const tageAus = (roh: string): Set<number> | null => {

    const t = roh.replace(/\b[Aa]m Morgen\b/g, 'vormittag')
      .replace(/\btomorrow\s+(morning|afternoon|evening|night)\b/gi, 'tomorrow');
    const morgen = /\bmorgen\b|tomorrow/i.test(t);
    const heute = /tagesende|heute|nachts|nacht|abend|vormittag|nachmittag|anfangs|today|tonight|evening|night|morning|afternoon|initially/i.test(t);
    if (!morgen && !heute) return null;
    const s = new Set<number>();
    if (morgen) s.add(1);
    if (heute || !morgen) s.add(0);
    return s;
  };
  const breiten = (strecke ?? []).map((p) => p.lat).filter((x): x is number => x != null);
  for (const satz of b.warnung.split(/(?<=\.)\s+/)) {
    if (!/gewitter|thunderstorm/i.test(satz)) continue;
    let gebiet: string[] | null = null;
    let tage: Set<number> = new Set([0]);
    for (const teil of satz.split(/,\s+/)) {
      gebiet = gebietAus(teil) ?? gebiet;
      tage = tageAus(teil) ?? tage;
      if (!tage.has(versatz)) continue;
      if (!gebiet || !breiten.length || breiten.some((lat) => imDhmzGebiet(gebiet!, lat))) return true;
    }
  }
  return false;
}

export interface AmtlicheBoeen { von: number; bis: number; nachts: boolean; offeneSee: boolean; giltBis: Date | null }

export function amtlicherVorbehalt(
  amtlich: AmtlicherBericht | AmtlicherBericht[] | null | undefined, dateStr: string, boeGrenze: number,
  ab: Date | null = null, strecke: readonly StreckenOrt[] | null = null,
): AmtlicheBoeen | null {
  const liste = amtlich ? (Array.isArray(amtlich) ? amtlich : [amtlich]) : [];
  const amt = liste.map((b) => amtlicheBoeen(b, dateStr, ab, strecke)).find((x) => x) ?? null;
  return amt && amt.bis > boeGrenze ? amt : null;
}

function passtZumTag(b: AmtlicherBericht, dateStr: string): boolean {
  return b.datum === dateStr;
}

function ausgabe(b: AmtlicherBericht): Date | null {
  if (!b.datum || b.stunde == null) return null;
  return nDate(`${b.datum}T${String(b.stunde).padStart(2, '0')}:00`);
}

export function gueltigBis(b: AmtlicherBericht): Date | null {
  const a = ausgabe(b);
  return a ? new Date(a.getTime() + 24 * 3600_000) : null;
}

export function giltFuer(b: AmtlicherBericht, dateStr: string, ab: Date | null): boolean {
  if (passtZumTag(b, dateStr)) return true;
  const bis = gueltigBis(b);
  return !!(bis && ab && b.datum && b.datum < dateStr && ab.getTime() < bis.getTime());
}

export function abgelaufenFuer(b: AmtlicherBericht, dateStr: string, ab: Date): boolean {
  const bis = gueltigBis(b);
  return !giltFuer(b, dateStr, ab) && b.datum != null && b.datum < dateStr && bis != null && ab.getTime() >= bis.getTime();
}

export function abgelaufenOhneOrt(
  b: AmtlicherBericht, dateStr: string, ab: Date, strecke: readonly StreckenOrt[] | null = null,
): boolean {
  if (!b.datum || !abgelaufenFuer(b, dateStr, ab)) return false;

  return amtlicheBoeen(b, b.datum, null, strecke) != null && amtlicheBoeen(b, b.datum, null, strecke, true) == null;
}

export function tagUndStunde(d: Date, sprache: Sprache): string {
  const h = String(d.getUTCHours()).padStart(2, '0');
  return `${datumKurz(d, sprache === 'en' ? 'en' : 'de')}, ${String(h).padStart(2, '0')}00 LT`;
}

export function giltBisZusatz(giltBis: Date | null, sprache: Sprache): string {
  if (!giltBis) return '';
  return sprache === 'en' ? `, report valid until ${tagUndStunde(giltBis, 'en')}` : `, Bericht gilt bis ${tagUndStunde(giltBis, 'de')}`;
}

function quelle(b: AmtlicherBericht, sprache: Sprache): string {

  const url = b.url
    ? (/^https?:\/\//i.test(b.url)
      ? ` <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.url)}</a>`
      : ` ${escapeHtml(b.url)}`)
    : '';
  if (b.herkunft && b.herkunft !== 'dhmz') return quelleGebiet(b.herkunft, url, sprache);
  const andereSprache = sprache === 'de' && b.sprache === 'en';
  return sprache === 'en'
    ? `Source: Croatian Meteorological and Hydrological Service (DHMZ), Marine Meteorological Centre Split. Quoted in the original wording, Open Licence of the Republic of Croatia.${url}`
    : `Quelle: Državni hidrometeorološki zavod (DHMZ), Seewetterdienst Split, im Originalwortlaut wiedergegeben${andereSprache ? ', englische Fassung (die deutsche war nicht abrufbar)' : ''}, Offene Lizenz der Republik Kroatien.${url}`;
}

export function douglasHinweis(b: AmtlicherBericht, sprache: Sprache): string {
  if (b.herkunft && b.herkunft !== 'dhmz') return '';
  const text = [b.warnung ?? '', ...b.abschnitte.map((a) => a.text)].join(' ');
  if (!/(seegang|the sea|\bsea\b|\bmore\b)[^.]{0,60}?\b[1-9]\b/i.test(text)) return '';
  if (sprache === 'en') {
    return 'Sea state in degrees of the Douglas scale, as in the DHMZ legend: 2 = 0.1–0.5 m, 3 = 0.5–1.2 m, '
      + '4 = 1.25–2.5 m, 5 = 2.5–4 m, 6 = 4–6 m.';
  }
  const meter = /seegang[^.]*\b[1-9]\b(\s*bis\s*[1-9])?\s*meter/i.test(text);
  return 'Seegang in Stufen der Douglas-Skala, wie in der Legende des DHMZ: 2 = 0,1–0,5 m, 3 = 0,5–1,2 m, '
    + '4 = 1,25–2,5 m, 5 = 2,5–4 m, 6 = 4–6 m.'
    + (meter ? ' Die deutsche Fassung schreibt dazu „Meter“, die kroatische und die englische nennen die Stufe.' : '');
}

export function describeAmtlicherBericht(b: AmtlicherBericht, dateStr: string, sprache: Sprache = 'de', ab: Date | null = null): string {
  const hinweis = passtZumTag(b, dateStr) ? '' : `<p><i>${escapeHtml(gueltigkeitsHinweis(b, ab, sprache))}</i></p>`;
  const teile = b.abschnitte.map((a) => a.titel
    ? (a.text ? `<p><b>${escapeHtml(a.titel)}</b><br>${zeilen(a.text)}</p>` : `<p><b>${escapeHtml(a.titel)}</b></p>`)
    : `<p>${zeilen(a.text)}</p>`).join('');
  const douglas = douglasHinweis(b, sprache);
  return `<p><i>${escapeHtml(kopfMitUhrzeit(b.kopf))}</i></p>${hinweis}${teile}`
    + (douglas ? `<p class="brief-douglas">${escapeHtml(douglas)}</p>` : '')
    + `<div class="brief-src">${quelle(b, sprache)}</div>`;
}

function gueltigkeitsHinweis(b: AmtlicherBericht, ab: Date | null, sprache: Sprache): string {
  const en = sprache === 'en';
  const a = ausgabe(b), bis = gueltigBis(b);

  const tEnde = b.tendenz?.length ? Math.max(...b.tendenz.map((t) => t.bis)) : null;
  if ((!a || !bis) && tEnde !== null && b.datum) {
    const ende = new Date(tEnde);
    const datum = `${Number(b.datum.slice(8, 10))}.${Number(b.datum.slice(5, 7))}.`;
    const deckt = ab && ab.getTime() < tEnde;
    return en
      ? `Issued on ${datum}; its forecast in 12-hour steps runs until ${tagUndStunde(ende, 'en')} local time${deckt ? ' and covers this passage' : ''}. Read the next report before casting off.`
      : `Ausgegeben am ${datum}; die Vorhersage in 12-Stunden-Schritten darin reicht bis ${tagUndStunde(ende, 'de')} Ortszeit${deckt ? ' und deckt diese Fahrt' : ''}. Vor dem Ablegen den nächsten Bericht lesen.`;
  }
  if (!a || !bis) {
    return en
      ? `This report was issued on ${b.datum ?? '?'} and covers the 24 hours after issue, not necessarily the planned day.`
      : `Dieser Bericht wurde am ${b.datum ?? '?'} ausgegeben und gilt für die 24 Stunden danach, nicht unbedingt für den geplanten Tag.`;
  }
  const deckt = ab && ab.getTime() < bis.getTime();
  if (en) {
    return `Issued ${tagUndStunde(a, 'en')}, valid until ${tagUndStunde(bis, 'en')}. `
      + (deckt
        ? 'For this passage it covers only the time until then; the service issues the report for the day of the passage on that day. Read the new report before casting off.'
        : 'It no longer covers this passage and is shown only to place the situation. Read the report of the day before casting off.');
  }
  return `Ausgegeben am ${tagUndStunde(a, 'de')}, gilt bis ${tagUndStunde(bis, 'de')}. `
    + (deckt
      ? 'Für diese Fahrt deckt er nur die Zeit bis dahin; den Bericht für den Fahrtag gibt der Wetterdienst erst an diesem Tag heraus. Vor dem Ablegen den neuen Bericht lesen.'
      : 'Für diese Fahrt gilt er nicht mehr und steht nur zur Einordnung der Lage da. Vor dem Ablegen den Bericht des Tages lesen.');
}

export function describeZweitfassung(b: AmtlicherBericht, dateStr: string, sprache: Sprache = 'de'): string {
  const titel = sprache === 'en'
    ? 'English-language official bulletin for these waters: METEOMAR (Italian Air Force Meteorological Service), coarser sea areas than AEMET'
    : 'Englischsprachiger amtlicher Bericht für dieselben Gewässer: METEOMAR (Aeronautica Militare, Italien), gröbere Seegebiete als AEMET';
  return `<p class="brief-zweitfassung"><b>${escapeHtml(titel)}</b></p>${describeAmtlicherBericht(b, dateStr, sprache)}`;
}

export function amtlicheWarnung(b: AmtlicherBericht | null | undefined, dateStr: string, sprache: Sprache = 'de', ab: Date | null = null): string | null {
  if (!b || !b.warnung || !giltFuer(b, dateStr, ab)) return null;
  const zusatz = giltBisZusatz(passtZumTag(b, dateStr) ? null : gueltigBis(b), sprache);
  if (b.herkunft && b.herkunft !== 'dhmz') {

    const d = DIENST[b.herkunft];
    const sturm = b.herkunft === 'hnms' || b.herkunft === 'mgm';
    const es = b.sprache === 'es';
    return sprache === 'en'
      ? `<b>Official ${sturm ? 'gale ' : ''}warning (${d.en})</b>: ${b.warnung}${es ? ' (Spanish wording)' : ''}`
      : `<b>Amtliche ${sturm ? 'Sturmwarnung' : 'Warnung'} (${d.de})</b>: ${b.warnung} (${es ? 'spanischer' : 'englischer'} Wortlaut)`;
  }
  return sprache === 'en'
    ? `<b>Official warning (DHMZ Split${zusatz})</b>: ${escapeHtml(b.warnung)}`
    : `<b>Amtliche Warnung (DHMZ Split${zusatz})</b>: ${b.sprache === 'en' ? '„' : ''}${escapeHtml(b.warnung)}${b.sprache === 'en' ? '" (englischer Wortlaut)' : ''}`;
}

export function amtlicheWarnungAnderswo(
  b: AmtlicherBericht | null | undefined, dateStr: string, ab: Date | null,
  strecke: readonly StreckenOrt[] | null,
): boolean {
  if (!b || !strecke?.length || (b.herkunft && b.herkunft !== 'dhmz')) return false;
  if (!amtlicheWarnung(b, dateStr, 'de', ab) || !amtlicheBoeen(b, dateStr, ab, null)) return false;
  return !amtlicheBoeen(b, dateStr, ab, strecke) && !amtlicheGewitter(b, dateStr, strecke, ab);
}

export function amtlicheWarnungAnderswoSatz(b: AmtlicherBericht, dateStr: string, sprache: Sprache): string {
  const zusatz = giltBisZusatz(passtZumTag(b, dateStr) ? null : gueltigBis(b), sprache);
  const unwetter = /unwetter|severe weather|nevrijem/i.test(b.warnung ?? '');
  return sprache === 'en'
    ? `<b>Official warning (DHMZ Split${zusatz})</b> for other parts of the Adriatic; the gusts it names do not concern this route.${unwetter ? ' Severe weather possible in places.' : ''} Full wording under “Official marine forecast”.`
    : `<b>Amtliche Warnung (DHMZ Split${zusatz})</b> für andere Teile der Adria; die genannten Böen betreffen diese Strecke nicht.${unwetter ? ' Stellenweise Unwettergefahr.' : ''} Wortlaut unter „Amtlicher Seewetterbericht“.`;
}

export function amtlicheWarnungKurz(
  b: AmtlicherBericht | null | undefined, dateStr: string, sprache: Sprache = 'de', ab: Date | null = null,
  strecke: readonly StreckenOrt[] | null = null,
): string | null {
  if (!b || (b.herkunft && b.herkunft !== 'dhmz')) return null;
  const boe = amtlicheBoeen(b, dateStr, ab, strecke);
  if (!boe) return null;
  const gewitter = amtlicheGewitter(b, dateStr, strecke);
  const en = sprache === 'en';
  const spanne = boe.von === boe.bis ? `${boe.bis}` : en ? `${boe.von} to ${boe.bis}` : `${boe.von} bis ${boe.bis}`;
  const zusatz = giltBisZusatz(boe.giltBis, sprache);
  return en
    ? `<b>Official warning (DHMZ Split${zusatz})</b> for this route: gusts of ${spanne} kn${boe.offeneSee ? ' on the open sea' : ''}${boe.nachts ? ', also at night' : ''}${gewitter ? ', thunderstorms possible' : ''}. Full wording under “Official marine forecast”.`
    : `<b>Amtliche Warnung (DHMZ Split${zusatz})</b> für diese Strecke: Böen ${spanne} kn${boe.offeneSee ? ' auf offener See' : ''}${boe.nachts ? ', auch nachts' : ''}${gewitter ? ', Gewitter möglich' : ''}. Wortlaut unter „Amtlicher Seewetterbericht“.`;
}

export function ausgegebenAm(datum: string | null | undefined, sprache: Sprache): string {
  const m = datum ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum) : null;
  const d = m ? (sprache === 'en' ? `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}` : `${m[3]}.${m[2]}.${m[1]}`) : (datum ?? '?');
  return `<p class="tb-sw-stand">${sprache === 'en' ? 'Issued' : 'Ausgegeben am'}: ${escapeHtml(d)}</p>`;
}

export function describeSeewetterbericht(b: AmtlicherBericht, _heute: string, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const stand = ausgegebenAm(b.datum, sprache);
  const warnung = b.warnung
    ? `<div class="tb-sw-warnung" role="alert"><b>${en ? 'Official warning' : 'Amtliche Warnung'}</b><br>${escapeHtml(b.warnung)}</div>`
    : '';
  const teile = b.abschnitte
    .filter((a) => !(b.warnung && a.text === b.warnung))
    .map((a) => a.titel
      ? `<p><b>${escapeHtml(a.titel)}</b><br>${escapeHtml(a.text)}</p>`
      : `<p>${escapeHtml(a.text)}</p>`).join('');
  const douglas = douglasHinweis(b, sprache);
  return `${stand}${warnung}<p class="tb-sw-kopf"><i>${escapeHtml(kopfMitUhrzeit(b.kopf))}</i></p>${teile}`
    + (douglas ? `<p class="tb-sw-douglas">${escapeHtml(douglas)}</p>` : '')
    + `<p class="tb-sw-quelle">${quelle(b, sprache)}</p>`;
}

const DIENST: Record<GebietsHerkunft, { de: string; en: string }> = {
  hnms: { de: 'HNMS Athen', en: 'HNMS Athens' },
  meteomar: { de: 'Meteomar, Aeronautica Militare', en: 'Meteomar, Italian Air Force' },
  mgm: { de: 'MGM Türkei', en: 'Turkish State Met. Service' },
  aemet: { de: 'AEMET Spanien', en: 'AEMET Spain' },
  dom: { de: 'Wetterdienst Zypern', en: 'Cyprus Dept. of Meteorology' },
};

function quelleGebiet(h: GebietsHerkunft, url: string, sprache: Sprache): string {
  const en = sprache === 'en';
  if (h === 'meteomar') {
    return `<b>Informazioni elaborate dal Servizio Meteorologico dell’Aeronautica Militare e pubblicate sul sito www.meteoam.it</b>: ${en
      ? 'METEOMAR bulletin (C.N.M.C.A.), English version, quoted in the original wording (excerpt).'
      : 'Bulletin METEOMAR (C.N.M.C.A.), englische Fassung, im Originalwortlaut wiedergegeben (Auszug).'}${url}`;
  }
  if (h === 'aemet') {

    return en
      ? `Source: Agencia Estatal de Meteorología (AEMET), Spain, coastal and high-seas bulletins, quoted in the original Spanish (excerpt). © AEMET. Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma.${url}`
      : `Quelle: Agencia Estatal de Meteorología (AEMET), Spanien, Küsten- und Hochseebulletins, im spanischen Originalwortlaut (Auszug). © AEMET. Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma.${url}`;
  }
  if (h === 'dom') {
    return en
      ? `Source: Cyprus Department of Meteorology, NAVTEX and coastal forecast, quoted in the original wording. Licence unknown: the service’s terms contain no rule on reproduction.${url}`
      : `Quelle: Cyprus Department of Meteorology (Wetterdienst Zypern), NAVTEX und Küstenbericht, im englischen Originalwortlaut. Lizenz unbekannt: Die Nutzungsbedingungen des Dienstes regeln die Wiedergabe nicht.${url}`;
  }
  if (h === 'mgm') {
    return en
      ? `Source: Turkish State Meteorological Service (Meteoroloji Genel Müdürlüğü, MGM), Daily Marine Forecast Report, cell text quoted in the original wording, arranged as lines. Licence unknown: MGM’s legal notice requires the source and mentions prior permission.${url}`
      : `Quelle: Meteoroloji Genel Müdürlüğü (MGM), türkischer Wetterdienst, Daily Marine Forecast Report, Zellen im englischen Originalwortlaut, als Zeilen angeordnet. Lizenz unbekannt: Der Rechtshinweis von MGM verlangt die Quellenangabe und spricht von vorheriger Erlaubnis.${url}`;
  }
  return en
    ? `Source: Hellenic National Meteorological Service (HNMS), Athens, METAREA III bulletin, quoted in the original wording (excerpt). HNMS does not guarantee that the electronic text is an exact copy of the official forecast.${url}`
    : `Quelle: Hellenic National Meteorological Service (HNMS/EMY), Athen, Bulletin METAREA III, im englischen Originalwortlaut (Auszug). HNMS weist darauf hin, dass der elektronische Text keine garantiert exakte Kopie der amtlichen Vorhersage ist.${url}`;
}

function warnGebietHtml(g: { name: string; zeilen: string[] }): string {
  return `<b>${escapeHtml(g.name)}</b><br>${g.zeilen.map((z) => escapeHtml(z)).join('<br>')}`;
}

function betrifft(w: { name: string; zeilen: string[]; gruppe?: string }, gebiete: string[], gruppen: string[] = []): boolean {
  if (w.gruppe) return gruppen.includes(w.gruppe);

  const text = w.zeilen.join(' ').toUpperCase();
  return gebiete.some((n) => w.name === n || text.includes(n.toUpperCase()) || ohneSeite(n, text));
}

function ohneSeite(name: string, text: string): boolean {
  const m = /^(.*\S)\s+(?:WEST|EAST)\s+SIDE$/i.exec(name.trim());
  if (!m) return false;
  const basis = m[1]!.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${basis}\\b(?!\\s+(?:WEST|EAST)\\s+SIDE)`).test(text);
}

function gruppenVon(b: GebietsBericht, gebiete: string[]): string[] {
  return [...new Set(b.gebiete.filter((g) => g.gruppe && gebiete.includes(g.name)).map((g) => g.gruppe!))];
}

function gebietHtml(g: { name: string; text: string; tendenz?: string }, tendenzTitel?: string | null): string {
  const tendenz = g.tendenz ? `<br><i>${escapeHtml(tendenzTitel ?? '')}</i>${tendenzTitel ? ': ' : ''}${escapeHtml(g.tendenz)}` : '';
  return `<p><b>${escapeHtml(g.name)}</b><br>${zeilen(g.text)}${tendenz}</p>`;
}

export function gebietsBerichtAlsAmtlich(b: GebietsBericht, gebiete: string[]): AmtlicherBericht | null {
  const eigene = gebiete
    .map((n) => b.gebiete.find((g) => g.name === n))
    .filter((g): g is GebietsBericht['gebiete'][number] => !!g);
  if (!eigene.length) return null;
  const abschnitte: { titel: string | null; text: string }[] = [];

  if (b.hinweise) abschnitte.push({ titel: null, text: b.hinweise });
  if (b.synopsis) abschnitte.push({ titel: b.synopsis.titel, text: b.synopsis.text });
  if (b.vorhersageTitel) abschnitte.push({ titel: b.vorhersageTitel, text: '' });
  for (const g of eigene) {
    abschnitte.push({ titel: g.name, text: g.tendenz ? `${g.text}\n${b.tendenzTitel ? `${b.tendenzTitel}: ` : ''}${g.tendenz}` : g.text });
  }
  if (b.ausblick) abschnitte.push({ titel: b.ausblick.titel, text: b.ausblick.text });
  const gruppen = gruppenVon(b, gebiete);
  const warn = (b.warnung?.gebiete ?? []).filter((w) => betrifft(w, gebiete, gruppen));
  const tendenz = b.herkunft === 'meteomar' ? eigene.flatMap((g) => meteomarTendenz(g.name, g.tendenz, b.tendenzTitel, b.datum)) : [];
  return {
    ...(tendenz.length ? { tendenz } : {}),
    gebiete: eigene.map((g) => g.name),
    herkunft: b.herkunft ?? 'hnms',
    sprache: b.sprache ?? 'en',
    kopf: b.kopf,
    datum: b.datum,

    warnung: warn.length ? warn.map(warnGebietHtml).join('<br>') : null,
    abschnitte,
    url: b.url,
  };
}

export const hnmsAlsAmtlich = gebietsBerichtAlsAmtlich;

export function meteomarTendenz(gebiet: string, text: string | undefined, titel: string | null | undefined, datum: string): AmtlicheTendenz[] {
  if (!text || !titel) return [];
  const m = /FROM\s+(?:TOMORROW|TODAY)?\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*\/?\s*UTC.*?BY\s+(\d{1,2})-HOURS?\s+INTERVAL/i.exec(titel);
  const jahr = Number(datum.slice(0, 4)), monatAus = Number(datum.slice(5, 7));
  if (!m || !jahr) return [];
  const monat = Number(m[2]);
  const start = Date.UTC(monat < monatAus ? jahr + 1 : jahr, monat - 1, Number(m[1]), Number(m[3]), Number(m[4]));
  const schritt = Number(m[5]) * 3600_000;
  const raus: AmtlicheTendenz[] = [];
  text.replace(/\.\s*$/, '').split('/').forEach((teil, i) => {
    const w = /(\d{1,2})(?:\s*(?:TO|-)\s*(\d{1,2}))?\s+SEA\s+(\d)(?:\s*(?:TO|-)\s*(\d))?/i.exec(teil);
    if (!w) return;
    const von = start + i * schritt;
    raus.push({
      gebiet, text: teil.trim(), bft: Number(w[2] ?? w[1]), see: Number(w[4] ?? w[3]),
      von: von + romOffsetMs(von), bis: von + schritt + romOffsetMs(von + schritt),
    });
  });
  return raus;
}

function romOffsetMs(t: number): number {
  try {
    const teile = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
    return Date.UTC(Number(teile['year']), Number(teile['month']) - 1, Number(teile['day']), Number(teile['hour']), Number(teile['minute'])) - t;
  } catch {
    return 3600_000;
  }
}

export function douglasSpanne(stufe: number, sprache: Sprache): string | null {
  const s: Record<number, [string, string]> = { 2: ['0,1', '0,5'], 3: ['0,5', '1,25'], 4: ['1,25', '2,5'], 5: ['2,5', '4'], 6: ['4', '6'] };
  const r = s[stufe];
  if (!r) return null;
  return sprache === 'en' ? `${r[0].replace(',', '.')}–${r[1].replace(',', '.')} m` : `${r[0]}–${r[1]} m`;
}

export function amtlicheStaerke(liste: readonly AmtlicherBericht[], ab: Date, an: Date): AmtlicheTendenz | null {
  let best: AmtlicheTendenz | null = null;
  for (const b of liste) {
    for (const t of b.tendenz ?? []) {
      if (t.bis <= ab.getTime() || t.von >= an.getTime()) continue;
      if (!best || t.bft > best.bft || (t.bft === best.bft && (t.see ?? 0) > (best.see ?? 0))) best = t;
    }
  }
  return best;
}

export function describeGebietsSeewetterbericht(b: GebietsBericht, eigene: string[], _heute: string, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const herkunft = b.herkunft ?? 'hnms';
  const stand = ausgegebenAm(b.datum, sprache);
  const gruppen = gruppenVon(b, eigene);

  const alleWarn = b.warnung?.gebiete ?? [];
  const eigeneWarn = eigene.length ? alleWarn.filter((g) => betrifft(g, eigene, gruppen)) : [...alleWarn];
  const andereWarn = eigene.length ? alleWarn.filter((g) => !betrifft(g, eigene, gruppen)) : [];
  const titelWarnung = herkunft !== 'hnms' && herkunft !== 'mgm'
    ? (en ? 'Official warnings' : 'Amtliche Warnungen')
    : (en ? 'Official gale warning' : 'Amtliche Sturmwarnung');
  const warnung = eigeneWarn.length
    ? `<div class="tb-sw-warnung" role="alert"><b>${titelWarnung}</b>`
      + eigeneWarn.map((g) => `<p>${warnGebietHtml(g)}</p>`).join('')
      + '</div>'
    : '';
  const andere = andereWarn.length
    ? `<div class="tb-sw-andere"><b>${en ? 'Warnings for other sea areas' : 'Warnungen anderer Seegebiete'}</b>`
      + andereWarn.map((g) => `<p>${warnGebietHtml(g)}</p>`).join('')
      + '</div>'
    : '';
  const eigeneGebiete = eigene
    .map((n) => b.gebiete.find((g) => g.name === n))
    .filter((g): g is GebietsBericht['gebiete'][number] => !!g);
  const eigenesHtml = eigeneGebiete.length
    ? `<div class="tb-sw-eigen">${b.vorhersageTitel ? `<p class="tb-sw-marke">${escapeHtml(b.vorhersageTitel)}</p>` : ''}`
      + eigeneGebiete.map((g) => gebietHtml(g, b.tendenzTitel)).join('') + '</div>'
    : (eigene.length === 0
      ? `<p class="tb-hinweis">${en
        ? 'Position unknown or outside the sea areas of this report. All areas follow below.'
        : 'Position unbekannt oder außerhalb der Seegebiete dieses Berichts. Alle Gebiete folgen unten.'}</p>`
      : '');
  const synopsis = b.synopsis ? `<p><b>${escapeHtml(b.synopsis.titel)}</b><br>${escapeHtml(b.synopsis.text)}</p>` : '';
  const ausblick = b.ausblick ? `<p><b>${escapeHtml(b.ausblick.titel)}</b><br>${zeilen(b.ausblick.text)}</p>` : '';

  const alle = eigeneGebiete.length ? ''
    : (b.vorhersageTitel ? `<p><i>${escapeHtml(b.vorhersageTitel)}</i></p>` : '') + b.gebiete.map((g) => gebietHtml(g, b.tendenzTitel)).join('');
  const hinweise = b.hinweise ? `<p class="tb-sw-stand">${zeilen(b.hinweise)}</p>` : '';
  return `${stand}${warnung}<p class="tb-sw-kopf"><i>${escapeHtml(b.kopf)}</i></p>${hinweise}${eigenesHtml}${andere}${synopsis}${ausblick}${alle}`
    + `<p class="tb-sw-quelle">${quelleGebiet(herkunft, b.url ? ` ${escapeHtml(b.url)}` : '', sprache)}</p>`;
}

export const describeHnmsSeewetterbericht = describeGebietsSeewetterbericht;

export function amtlicheAbdeckung(
  amtlich: AmtlicherBericht | AmtlicherBericht[] | null | undefined, sprache: Sprache = 'de',
): string | null {
  const b = (amtlich ? (Array.isArray(amtlich) ? amtlich : [amtlich]) : [])[0];
  if (!b || !b.datum) return null;
  const en = sprache === 'en';
  const dienst = b.herkunft && b.herkunft !== 'dhmz' ? DIENST[b.herkunft][en ? 'en' : 'de'] : 'DHMZ Split';
  const a = ausgabe(b), bis = gueltigBis(b);
  if (a && bis) {
    return en
      ? `Official marine forecast (${dienst}): issued ${tagUndStunde(a, 'en')}, valid until ${tagUndStunde(bis, 'en')}. `
        + 'Its warning is taken into account up to then (⚠); for later days there is no official report yet, only the forecast.'
      : `Amtlicher Seewetterbericht (${dienst}): ausgegeben am ${tagUndStunde(a, 'de')}, gilt bis ${tagUndStunde(bis, 'de')}. `
        + 'Bis dahin ist seine Warnung berücksichtigt (⚠); für spätere Tage gibt es noch keinen, dort zählt nur die Vorhersage.';
  }
  const tag = datumKurz(nDate(`${b.datum}T12:00`), en ? 'en' : 'de');
  return en
    ? `Official marine forecast (${dienst}) of ${tag}: taken into account for that day only (⚠); for later days only the forecast counts.`
    : `Amtlicher Seewetterbericht (${dienst}) vom ${tag}: nur für diesen Tag berücksichtigt (⚠); für spätere Tage zählt nur die Vorhersage.`;
}
