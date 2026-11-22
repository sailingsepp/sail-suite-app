import { uhrLt, nf } from '@/core/time';
import { GEZEIT_BEACHTLICH_M, type Gezeitenform, type SpringNippLage, type Tidenextrem } from '@/core/gezeiten';
import type { GezeitenLage } from '@/core/gezeitenLage';
import type { Sprache } from '@/core/types';
import { escapeHtml } from '@/core/html';

const r1 = (x: number) => Math.round(x * 10) / 10;

function hubAngezeigt(extreme: readonly Tidenextrem[]): number {
  let max = 0;
  for (let i = 1; i < extreme.length; i++) max = Math.max(max, Math.abs(r1(extreme[i]!.hoeheM) - r1(extreme[i - 1]!.hoeheM)));
  return r1(max);
}

const MONATE_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function datum(d: Date, sprache: Sprache): string {
  return sprache === 'en'
    ? `${d.getUTCDate()} ${MONATE_EN[d.getUTCMonth()]}`
    : `${d.getUTCDate()}. ${MONATE_DE[d.getUTCMonth()]}`;
}

const KM_JE_SM = 1.852;

const MAX_SM = Math.round(50 / KM_JE_SM);

export function pegelAbstand(entfernungKm: number, sprache: Sprache): string {
  const sm = entfernungKm / KM_JE_SM;
  if (!(sm >= 0.5)) return '';
  return sprache === 'en' ? `, ${nf(sm, 0, sprache)} NM away` : `, ${nf(sm, 0, sprache)} sm entfernt`;
}

export function formText(form: Gezeitenform, sprache: Sprache): string {
  if (sprache === 'en') {
    return form === 'halbtaegig' ? 'semi-diurnal tide'
      : form === 'gemischt-halbtaegig' ? 'mixed, mainly semi-diurnal tide'
        : form === 'gemischt-eintaegig' ? 'mixed, mainly diurnal tide' : 'diurnal tide';
  }
  return form === 'halbtaegig' ? 'halbtägige Gezeit'
    : form === 'gemischt-halbtaegig' ? 'gemischte, überwiegend halbtägige Gezeit'
      : form === 'gemischt-eintaegig' ? 'gemischte, überwiegend eintägige Gezeit' : 'eintägige Gezeit';
}

export function springNippText(l: SpringNippLage, sprache: Sprache): string {
  const en = sprache === 'en';
  const nS = l.naechsteSpring, nN = l.naechsteNipp;
  switch (l.phase) {
    case 'springzeit':
      return en
        ? `Springs: the range is near the largest of the cycle${nN ? `; neaps around ${datum(nN, sprache)}` : ''}.`
        : `Springzeit: der Hub liegt nahe am Größten des Zyklus${nN ? `; Nippzeit um den ${datum(nN, sprache)}` : ''}.`;
    case 'nippzeit':
      return en
        ? `Neaps: the range is near the smallest of the cycle${nS ? `; springs around ${datum(nS, sprache)}` : ''}.`
        : `Nippzeit: der Hub liegt nahe am Kleinsten des Zyklus${nS ? `; Springzeit um den ${datum(nS, sprache)}` : ''}.`;
    case 'mittzeit-zunehmend':
      return en
        ? `Between neaps and springs, range increasing${nS ? `; springs around ${datum(nS, sprache)}` : ''}.`
        : `Mittzeit, der Hub nimmt zu${nS ? `; Springzeit um den ${datum(nS, sprache)}` : ''}.`;
    default:
      return en
        ? `Between springs and neaps, range decreasing${nN ? `; neaps around ${datum(nN, sprache)}` : ''}.`
        : `Mittzeit, der Hub nimmt ab${nN ? `; Nippzeit um den ${datum(nN, sprache)}` : ''}.`;
  }
}

function extremListe(extreme: readonly Tidenextrem[], sprache: Sprache, einheit: string): string {
  const en = sprache === 'en';
  return extreme.map((e) => `${e.art === 'HW' ? 'HW' : en ? 'LW' : 'NW'} ${uhrLt(e.zeit)} ${nf(r1(e.hoeheM), 1, sprache)} m`)
    .join(', ') + ` (${en ? 'heights in' : 'Höhen in'} ${einheit})`;
}

export interface GezeitenAbsatzEingabe {
  lage: GezeitenLage;

  ankunft: Date;
}

const MODELL_ZYKLUS_MS = 13 * 3600_000;

export function describeGezeiten(e: GezeitenAbsatzEingabe, sprache: Sprache = 'de'): string | null {
  const { lage } = e;
  const en = sprache === 'en';

  const letzte = lage.kurve[lage.kurve.length - 1]?.zeit.getTime() ?? 0;
  if (lage.quelle === 'modell' && letzte < e.ankunft.getTime() + MODELL_ZYKLUS_MS) {
    return en
      ? `Tides according to the Copernicus model (no tide gauge within ${MAX_SM} NM): the model series ends too soon after arrival to give the tidal range during the stay.`
      : `Gezeiten laut Copernicus-Modell (kein Pegel innerhalb von ${MAX_SM} sm): Die Modellreihe endet zu bald nach der Ankunft, um den Tidenhub der Liegezeit zu nennen.`;
  }

  const ab = lage.extreme.findIndex((x) => x.zeit.getTime() >= e.ankunft.getTime());
  if (ab === -1) return null;
  const extreme = lage.extreme.slice(ab);

  const hub = hubAngezeigt(lage.extreme.slice(Math.max(0, ab - 1)));
  const k = lage.kennwerte;
  const st = lage.station;

  const weg = st ? pegelAbstand(st.entfernungKm, sprache) : '';
  const herkunft = lage.quelle === 'pegel' && st
    ? (en ? `Tides (gauge ${st.daten.name}${weg})` : `Gezeiten (Pegel ${st.daten.name}${weg})`)
    : (en ? `Tides according to the Copernicus model (no tide gauge within ${MAX_SM} NM)`
      : `Gezeiten laut Copernicus-Modell (kein Pegel innerhalb von ${MAX_SM} sm)`);
  const einheit = lage.bezug === 'ngzw'
    ? (en ? 'm above LAT' : 'm über NGzW')
    : (en ? 'm relative to mean level' : 'm zum Mittelwasser');

  if (hub < GEZEIT_BEACHTLICH_M) {
    const phase = lage.springNipp && k && k.form !== 'gemischt-eintaegig' && k.form !== 'eintaegig'
      ? (lage.springNipp.phase === 'springzeit' ? (en ? ', springs' : ', Springzeit')
        : lage.springNipp.phase === 'nippzeit' ? (en ? ', neaps' : ', Nippzeit') : '')
      : '';
    return en
      ? `${herkunft}: small. Tidal range during the stay at most ${nf(hub, 1, sprache)} m${phase}. `
        + 'Of no consequence for lines and depth; the water level here depends more on the weather than on moon and sun.'
      : `${herkunft}: klein. Tidenhub während der Liegezeit höchstens ${nf(hub, 1, sprache)} m${phase}. `
        + 'Für Leinen und Tiefe ohne Belang; der Wasserstand hängt hier stärker am Wetter als an Mond und Sonne.';
  }

  const S: string[] = [];
  if (k) {

    const ungleich = k.form === 'gemischt-halbtaegig' && k.formzahl >= 0.5
      ? (en ? ' with a marked diurnal inequality' : ' mit deutlicher täglicher Ungleichheit') : '';
    S.push(en
      ? `${herkunft}: ${formText(k.form, sprache)}${ungleich} (form factor ${nf(k.formzahl, 2, sprache)}).`
      : `${herkunft}: ${formText(k.form, sprache)}${ungleich} (Formzahl ${nf(k.formzahl, 2, sprache)}).`);
  } else {
    S.push(`${herkunft}.`);
  }
  S.push(en
    ? `During the stay: ${extremListe(extreme, sprache, einheit)}; tidal range up to ${nf(hub, 1, sprache)} m.`
    : `Während der Liegezeit: ${extremListe(extreme, sprache, einheit)}; Tidenhub bis ${nf(hub, 1, sprache)} m.`);

  if (k && (k.form === 'gemischt-eintaegig' || k.form === 'eintaegig')) {
    S.push(en
      ? 'The tide here is mainly diurnal: its range follows the moon’s declination (large when the moon stands far north or south, small near the equator) rather than full and new moon.'
      : 'Die Gezeit ist hier überwiegend eintägig: Ihr Hub folgt der Monddeklination (groß bei hoher Deklination, klein, wenn der Mond nahe dem Äquator steht), weniger Voll- und Neumond.');
  } else if (lage.springNipp) {
    S.push(springNippText(lage.springNipp, sprache));
  }

  if (k && lage.bezug === 'ngzw') {
    const ueber = (x: number) => nf(r1(x - k.lat), 1, sprache);
    S.push(en
      ? `Mean levels above LAT: MHWS ${ueber(k.mspHW)} m, MLWS ${ueber(k.mspNW)} m, MHWN ${ueber(k.mnpHW)} m, MLWN ${ueber(k.mnpNW)} m.`
      : `Mittlere Wasserstände über NGzW: MSpHW ${ueber(k.mspHW)} m, MSpNW ${ueber(k.mspNW)} m, MNpHW ${ueber(k.mnpHW)} m, MNpNW ${ueber(k.mnpNW)} m.`);
  }

  S.push(en
    ? `Leave lines slack enough for about ${nf(hub, 1, sprache)} m of rise and fall, and check the depth at pontoon and pier head for low water. The chart datum of a Mediterranean chart is not necessarily LAT; the chart says which it is.`
    : `Leinen auf rund ${nf(hub, 1, sprache)} m Tidenstieg und -fall belegen, bei Niedrigwasser die Tiefe an Steg und Molenkopf nachrechnen. Das Kartennull einer Mittelmeer-Seekarte ist nicht zwingend NGzW, welches es ist, steht in der Karte.`);

  const erster = extreme[0]!;
  const wetter = lage.modell.length
    ? lage.modell.reduce((best, m) => (Math.abs(m.zeit.getTime() - erster.zeit.getTime())
      < Math.abs(best.zeit.getTime() - erster.zeit.getTime()) ? m : best))
    : null;
  if (lage.quelle === 'pegel' && wetter && Math.abs(wetter.zeit.getTime() - erster.zeit.getTime()) <= 90 * 60000
    && Math.abs(r1(wetter.wetterM)) >= 0.1) {
    const mit = nf(r1(erster.hoeheM + wetter.wetterM), 1, sprache);
    const w = nf(Math.abs(r1(wetter.wetterM)), 1, sprache);
    const art = erster.art === 'HW' ? (en ? 'high water' : 'Hochwasser') : (en ? 'low water' : 'Niedrigwasser');
    S.push(en
      ? `With the weather-driven part from the Copernicus model (${wetter.wetterM > 0 ? '+' : '−'}${w} m), the ${art} at ${uhrLt(erster.zeit)} comes out at about ${mit} m.`
      : `Mit dem Wetteranteil laut Copernicus-Modell (${wetter.wetterM > 0 ? '+' : '−'}${w} m) läge das ${art} um ${uhrLt(erster.zeit)} bei rund ${mit} m.`);
  }

  S.push(lage.quelle === 'pegel'
    ? (en ? `Astronomical prediction from TICON-4 constants (${lizenzKurz(st?.daten.lizenz)}), without wind and air pressure. No substitute for the official tide tables.`
      : `Astronomische Vorausberechnung aus TICON-4-Konstanten (${lizenzKurz(st?.daten.lizenz)}), ohne Wind und Luftdruck. Kein Ersatz für die amtliche Gezeitentafel.`)
    : (en ? 'Model values (Copernicus Marine, eight tidal constituents): no substitute for the official tide tables.'
      : 'Modellwerte (Copernicus Marine, acht Partialtiden): kein Ersatz für die amtliche Gezeitentafel.'));
  return S.join(' ');
}

export function lizenzKurz(lizenz: string | undefined): string {
  return lizenz === 'cc-by-nc-4.0' ? 'CC BY-NC 4.0' : lizenz === 'cc-by-4.0' ? 'CC BY 4.0' : (lizenz ?? '');
}

const TAGE_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const TAGE_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface GezeitenTafelEingabe {

  lage: GezeitenLage;

  jetzt: Date;
}

export function describeGezeitenTafel(e: GezeitenTafelEingabe, sprache: Sprache = 'de'): string {
  const { lage, jetzt } = e;
  const en = sprache === 'en';
  const k = lage.kennwerte;
  const st = lage.station;
  const teile: string[] = [];
  const einheit = lage.bezug === 'ngzw' ? (en ? 'm above LAT' : 'm über NGzW') : (en ? 'm rel. to mean level' : 'm zum Mittelwasser');

  if (st) {
    const weit = st.entfernungKm > 50;
    teile.push(`<p class="tb-gz-kopf"><b>${en ? 'Tide gauge' : 'Pegel'} ${escapeHtml(st.daten.name)}</b> (${st.daten.land})`
      + `${pegelAbstand(st.entfernungKm, sprache)}${weit
        ? (en ? ', far from here; the times and heights are only a rough guide for this position.'
          : ', weit weg; Zeiten und Höhen sind für diese Position nur ein grober Anhalt.')
        : '.'}</p>`);
  } else {
    teile.push(`<p class="tb-gz-kopf"><b>${en ? 'Copernicus model' : 'Copernicus-Modell'}</b>: `
      + `${en ? `no tide gauge within ${MAX_SM} NM.` : `kein Pegel innerhalb von ${MAX_SM} sm.`}</p>`);
  }

  const kommend = lage.extreme.filter((x) => x.zeit.getTime() >= jetzt.getTime()).slice(0, 6);
  if (kommend.length) {
    const tag = (d: Date) => `${(en ? TAGE_EN : TAGE_DE)[d.getUTCDay()]} ${en ? d.getUTCDate() : `${d.getUTCDate()}.`}`;
    const zeilen = kommend.map((x) => `<tr><th scope="row">${x.art === 'HW' ? (en ? 'HW' : 'HW') : (en ? 'LW' : 'NW')}</th>`
      + `<td>${tag(x.zeit)}</td><td>${uhrLt(x.zeit)}</td><td class="tb-gz-zahl">${nf(r1(x.hoeheM), 1, sprache)}</td></tr>`).join('');
    teile.push(`<table class="tb-gz-tabelle"><caption>${en ? 'Next high and low waters (local time)' : 'Nächste Hoch- und Niedrigwasser (Ortszeit)'}</caption>`
      + `<thead><tr><th></th><th>${en ? 'Day' : 'Tag'}</th><th>${en ? 'Time' : 'Zeit'}</th><th>${einheit}</th></tr></thead>`
      + `<tbody>${zeilen}</tbody></table>`);
  }

  const zeilen: [string, string][] = [];
  if (k) {
    zeilen.push([en ? 'Type of tide' : 'Gezeitenform', `${formText(k.form, sprache)} (${en ? 'form factor' : 'Formzahl'} ${nf(k.formzahl, 2, sprache)})`]);
    if (k.form === 'gemischt-eintaegig' || k.form === 'eintaegig') {
      zeilen.push([en ? 'Range' : 'Hub', en ? 'follows the moon’s declination rather than full and new moon'
        : 'folgt der Monddeklination, weniger Voll- und Neumond']);
    } else if (lage.springNipp) {
      zeilen.push([en ? 'Springs / neaps' : 'Spring-/Nippzeit', springNippText(lage.springNipp, sprache)]);
      if (k.springverspaetungH != null && Math.abs(k.springverspaetungH) >= 1) {
        zeilen.push([en ? 'Age of the tide' : 'Springverspätung', en
          ? `about ${nf(Math.round(k.springverspaetungH), 0, sprache)} h after full and new moon`
          : `rund ${nf(Math.round(k.springverspaetungH), 0, sprache)} h nach Voll- und Neumond`]);
      }
    }
  }
  if (lage.tidenhub > 0) {
    zeilen.push([en ? 'Largest tidal range shown' : 'Größter Tidenhub im Bild', `${nf(r1(lage.tidenhub), 1, sprache)} m`]);
  }
  const wetterJetzt = lage.modell.length
    ? lage.modell.reduce((b, m) => (Math.abs(m.zeit.getTime() - jetzt.getTime()) < Math.abs(b.zeit.getTime() - jetzt.getTime()) ? m : b))
    : null;
  if (wetterJetzt && Math.abs(wetterJetzt.zeit.getTime() - jetzt.getTime()) <= 90 * 60000) {
    const w = r1(wetterJetzt.wetterM);
    zeilen.push([en ? 'Weather-driven part now' : 'Wetteranteil jetzt', `${w > 0 ? '+' : w < 0 ? '−' : '±'}${nf(Math.abs(w), 1, sprache)} m `
      + (en ? '(wind, air pressure; Copernicus model)' : '(Wind, Luftdruck; Copernicus-Modell)')]);
  }
  if (zeilen.length) {
    teile.push(`<dl class="tb-gz-liste">${zeilen.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`);
  }

  if (k && lage.bezug === 'ngzw') {
    const u = -k.lat;
    const w = (h: number | null) => (h == null ? null : nf(r1(h + u), 1, sprache));
    const pegel: [string, string, number | null][] = en ? [
      ['HAT', 'highest astronomical tide', k.hat], ['MHWS', 'mean high water springs', k.mspHW],
      ['MHWN', 'mean high water neaps', k.mnpHW], ['MHW', 'mean high water', k.mhw], ['MSL', 'mean sea level', 0],
      ['MLW', 'mean low water', k.mnw], ['MLWN', 'mean low water neaps', k.mnpNW],
      ['MLWS', 'mean low water springs', k.mspNW], ['LAT', 'lowest astronomical tide', k.lat],
    ] : [
      ['HGzW', 'höchster Gezeitenwasserstand', k.hat], ['MSpHW', 'mittleres Springhochwasser', k.mspHW],
      ['MNpHW', 'mittleres Nipphochwasser', k.mnpHW], ['MHW', 'mittleres Hochwasser', k.mhw], ['MW', 'Mittelwasser', 0],
      ['MNW', 'mittleres Niedrigwasser', k.mnw], ['MNpNW', 'mittleres Nippniedrigwasser', k.mnpNW],
      ['MSpNW', 'mittleres Springniedrigwasser', k.mspNW], ['NGzW', 'niedrigster Gezeitenwasserstand', k.lat],
    ];
    const zeilenW = pegel.filter(([, , h]) => h != null)
      .map(([kurz, lang, h]) => `<tr><th scope="row">${kurz}</th><td>${lang}</td><td class="tb-gz-zahl">${w(h)}</td></tr>`).join('');
    teile.push(`<table class="tb-gz-tabelle"><caption>${en ? 'Mean levels at the gauge (m above LAT)' : 'Mittlere Wasserstände am Pegel (m über NGzW)'}</caption>`
      + `<tbody>${zeilenW}</tbody></table>`

      + `<p class="tb-hinweis">${en
        ? 'Spring and neap levels: harmonic approximation from M2 and S2 (semi-diurnal part only); HAT, MHW, MLW and LAT from the measured water levels. Where the diurnal tide is strong, the measured means can lie outside the spring/neap values.'
        : 'Spring- und Nippwerte: harmonische Näherung aus M2 und S2 (nur der halbtägige Anteil); HGzW, MHW, MNW und NGzW aus den gemessenen Wasserständen. Wo die eintägige Gezeit kräftig ist, können die gemessenen Mittel außerhalb der Spring-/Nippwerte liegen.'}</p>`);
  }

  if (st) {
    const [von, bis] = st.daten.epoche;
    const jahre = von && bis ? `${von.slice(0, 4)}–${bis.slice(0, 4)}` : null;
    teile.push(`<p class="tb-hinweis">${en
? `Astronomical prediction from harmonic constants${jahre ? ` (tide-gauge record ${jahre})` : ''}: moon and sun only, without wind and air pressure; in the Mediterranean these are often larger than the tide itself. The chart datum of your chart is not necessarily LAT. No substitute for the official tide tables.`
: `Astronomische Vorausberechnung aus harmonischen Konstanten${jahre ? ` (Pegelreihe ${jahre})` : ''}. Nur Mond und Sonne, ohne Wind und Luftdruck; beides ist im Mittelmeer oft größer als die Gezeit selbst. Das Kartennull der eigenen Seekarte ist nicht zwingend NGzW. Kein Ersatz für die amtliche Gezeitentafel.`}</p>`
      + `<p class="tb-hinweis tb-gz-quelle">${escapeHtml(st.daten.namensnennung)}</p>`);
  } else {
    teile.push(`<p class="tb-hinweis">${en
      ? 'Model values (Copernicus Marine, eight tidal constituents, 48 h). No substitute for the official tide tables.'
      : 'Modellwerte (Copernicus Marine, acht Partialtiden, 48 h). Kein Ersatz für die amtliche Gezeitentafel.'}</p>`);
  }
  return teile.join('');
}
