import { nf, fmtDur, anzeigeMinuten } from '@/core/time';
import type { WochenplanErgebnis } from '@/core/wochenplan';
import type { PlanKennzahlen } from '@/core/zielfunktion';
import type {
  TagesBegruendung, BindendeBedingung, EntscheidendeKennzahl, VerworfeneAlternative, UnbekannteStelle,
  BedingungsArt, Herkunft, Begruendungsspur,
} from '@/core/begruendung';
import type { Kandidatennetz } from '@/core/hafennetz';
import type { Sprache } from '@/core/types';
import type { BriefingAbschnitt } from '@/briefing';

const BEDINGUNGS_ART_SATZ: Record<Sprache, Record<BedingungsArt, string>> = {
  de: {
    termin: 'ein Termin legt diesen Tag fest',
    grenzwert: 'ein eingestellter Grenzwert legt diesen Tag fest',
    tagesgrenze: 'die Tagesgrenze (maximale Stunden) legt diesen Tag fest',
    nachtfahrtbudget: 'das Nachtfahrten-Budget legt diesen Tag fest',
    bereitschaft: 'eine eingestellte Bereitschaft legt diesen Tag fest',
    wunschziel: 'ein Wunschziel legt diesen Tag fest',
    fixierung: 'dieser Tag ist von Hand fixiert',
    ruhetag: 'dieser Tag ist als Ruhetag gesetzt',
    umkehrpunkt: 'der Umkehrpunkt legt diesen Tag fest',
    unfahrbar: 'dieser Tag wäre sonst nicht fahrbar gewesen',
    'kein-kostenkarten-eintrag': 'an diesem Tag ausgeschlossen: Grenzwerte, Tageslicht, Tagesstunden oder fehlende Wetterdaten',
  },
  en: {
    termin: 'a deadline fixes this day',
    grenzwert: 'a set limit fixes this day',
    tagesgrenze: 'the daily hour limit fixes this day',
    nachtfahrtbudget: 'the night-passage budget fixes this day',
    bereitschaft: 'a set preference fixes this day',
    wunschziel: 'a wishlist stop fixes this day',
    fixierung: 'this day is fixed by hand',
    ruhetag: 'this day is set as a rest day',
    umkehrpunkt: 'the turning point fixes this day',
    unfahrbar: 'this day would otherwise not have been sailable',
    'kein-kostenkarten-eintrag': 'ruled out on this day: limits, daylight, daily hours or missing weather data',
  },
};

const GRUND_SATZ: Record<Sprache, Record<'schlechter-score' | BedingungsArt, string>> = {
  de: { 'schlechter-score': 'schlechterer Plan', ...BEDINGUNGS_ART_SATZ.de },
  en: { 'schlechter-score': 'worse-scoring plan', ...BEDINGUNGS_ART_SATZ.en },
};

const ENTSCHEIDEND_SATZ: Record<Sprache, Record<string, (amTag: string) => string>> = {
  de: {
    gedeckte_naechte: () => 'Den Ausschlag gaben die Nächte: Dieser Plan hat weniger offene Liegeplätze als der nächstbeste.',
    kreuzanteil: (amTag) => `Den Ausschlag gab das Kreuzen: Dieser Plan kreuzt im Törn weniger als der nächstbeste, ${amTag}.`,
    motoranteil: (amTag) => `Den Ausschlag gab die Maschine: Dieser Plan läuft im Törn weniger unter Motor als der nächstbeste, ${amTag}.`,
    fahrzeit: (amTag) => `Den Ausschlag gab die Fahrzeit: Dieser Plan ist im Törn kürzer unterwegs als der nächstbeste, ${amTag}.`,
  },
  en: {
    gedeckte_naechte: () => 'The deciding factor was the nights: this plan has fewer exposed berths than the next best.',
    kreuzanteil: (amTag) => `The deciding factor was beating: this plan beats to windward less over the voyage than the next best, ${amTag}.`,
    motoranteil: (amTag) => `The deciding factor was the engine: this plan motors less over the voyage than the next best, ${amTag}.`,
    fahrzeit: (amTag) => `The deciding factor was passage time: this plan spends less time under way over the voyage than the next best, ${amTag}.`,
  },
};

const UNBEKANNT_SATZ: Record<Sprache, Record<UnbekannteStelle['art'], string>> = {
  de: {
    'jenseits-vorhersagehorizont': 'Für diesen Tag gibt es noch keine Vorhersage: nur Distanz und eine Fahrzeitschätzung bei Revier-Normalwind.',
    'modell-blind': 'Diese Strecke gilt laut Reviersegelliteratur als modellblind, ein lokaler Effekt, den die Vorhersage nicht auflöst.',
    'kennzahl-nicht-angebunden': 'Die Schutzlage der Nacht ließ sich für diesen Tag nicht bestimmen.',
  },
  en: {
    'jenseits-vorhersagehorizont': 'There is no forecast for this day yet: only distance and an estimated passage time at regional normal wind.',
    'modell-blind': 'Regional sailing literature flags this stretch as model-blind. A local effect the forecast does not resolve.',
    'kennzahl-nicht-angebunden': 'The shelter for that night could not be determined for this day.',
  },
};

function unbekanntSatz(u: UnbekannteStelle, sprache: Sprache): string {
  return UNBEKANNT_SATZ[sprache][u.art];
}

function herkunftKlausel(h: Herkunft, sprache: Sprache): string | null {
  const en = sprache === 'en';
  switch (h.art) {
    case 'vorhersage': return en ? ` (per forecast, ${h.modell})` : ` (laut Vorhersage, ${h.modell})`;
    case 'reviersegelliteratur': return en ? ' (per regional sailing literature)' : ' (laut Reviersegelliteratur)';
    case 'toernfuehrer': return en ? ` (per ${h.werk}, p. ${h.seite})` : ` (laut ${h.werk}, S. ${h.seite})`;
    case 'eigene-erfahrung': return en ? ` (from own log, ${h.datumIso})` : ` (aus eigener Erfahrung, ${h.datumIso})`;
    case 'modell-blind': return en ? ' (no current model sees this)' : ' (das sieht kein Strommodell dieser Vorhersage)';
    case 'nutzervorgabe': return null;
  }
}

function bindendSatz(b: BindendeBedingung, sprache: Sprache): string {
  const satz = BEDINGUNGS_ART_SATZ[sprache][b.art];
  const klausel = herkunftKlausel(b.herkunft, sprache) ?? '';
  return `${satz.charAt(0).toUpperCase()}${satz.slice(1)}${klausel}.`;
}

function entscheidendSatz(k: EntscheidendeKennzahl, sprache: Sprache): string | null {
  if (k.kennzahl === 'langer_tag') {

    const sm = sprache === 'en' ? k.wert.toFixed(1) : nf(k.wert, 1, 'de');
    return sprache === 'en'
      ? `A long day: ${sm} NM, more than your standard day. None of the calculated plans managed the voyage without it.`
      : `Ein langer Tag: ${sm} sm, mehr als dein Regelmaß. Keiner der gerechneten Pläne kam ohne ihn durch den Törn.`;
  }

  const satz = ENTSCHEIDEND_SATZ[sprache][k.kennzahl];
  if (!satz) return null;
  const en = sprache === 'en';
  const amTag = anzeigeMinuten(k.wert) === 0
    ? (en ? 'none on this day' : 'an diesem Tag gar nicht')
    : `${en ? 'on this day' : 'an diesem Tag'} ${fmtDur(k.wert)}`;
  return satz(amTag);
}

function verworfenSatz(verworfen: readonly VerworfeneAlternative[], netz: Kandidatennetz, sprache: Sprache): string | null {
  if (verworfen.length === 0) return null;
  const erster = verworfen[0]!;
  const ort = netz.knoten[erster.nachIndex]?.name ?? (sprache === 'en' ? 'an alternative' : 'eine Alternative');
  const grund = GRUND_SATZ[sprache][erster.grundArt];
  const rest = verworfen.length - 1;
  if (sprache === 'en') {
    return rest > 0
      ? `Also considered and rejected: ${ort} (${grund}), among ${rest} further alternative${rest === 1 ? '' : 's'}.`
      : `Also considered and rejected: ${ort} (${grund}).`;
  }
  const weitereAlternativen = rest === 1 ? 'weiterer Alternative' : 'weiteren Alternativen';
  return rest > 0
    ? `Verworfen wurde auch ${ort} (${grund}), neben ${rest} ${weitereAlternativen}.`
    : `Verworfen wurde auch ${ort} (${grund}).`;
}

export function tagesBegruendung(tag: TagesBegruendung, netz: Kandidatennetz, sprache: Sprache = 'de'): string | null {
  const saetze: string[] = [];
  for (const b of tag.bindend) saetze.push(bindendSatz(b, sprache));
  for (const k of tag.entscheidend) { const e = entscheidendSatz(k, sprache); if (e) saetze.push(e); }
  const verworfen = verworfenSatz(tag.verworfen, netz, sprache);
  if (verworfen) saetze.push(verworfen);
  for (const u of tag.unbekannt) saetze.push(unbekanntSatz(u, sprache));
  return saetze.length > 0 ? saetze.join(' ') : null;
}

function verworfenEinzelSatz(v: VerworfeneAlternative, netz: Kandidatennetz, sprache: Sprache): string {
  const ort = netz.knoten[v.nachIndex]?.name ?? (sprache === 'en' ? 'an alternative' : 'eine Alternative');
  const grund = GRUND_SATZ[sprache][v.grundArt];
  return sprache === 'en' ? `Rejected: ${ort} (${grund}).` : `Verworfen: ${ort} (${grund}).`;
}

export function vollstaendigeTagesSpur(tag: TagesBegruendung, netz: Kandidatennetz, sprache: Sprache = 'de'): string | null {
  const saetze: string[] = [];
  for (const b of tag.bindend) saetze.push(bindendSatz(b, sprache));
  for (const k of tag.entscheidend) { const e = entscheidendSatz(k, sprache); if (e) saetze.push(e); }
  for (const v of tag.verworfen) saetze.push(verworfenEinzelSatz(v, netz, sprache));
  for (const u of tag.unbekannt) saetze.push(unbekanntSatz(u, sprache));
  return saetze.length > 0 ? saetze.join(' ') : null;
}

export function wochenUeberblick(
  ergebnis: WochenplanErgebnis, kennzahlen: PlanKennzahlen, sprache: Sprache = 'de',
): string {
  const en = sprache === 'en';
  const fahrtage = ergebnis.etappen.filter((e) => !e.istHafentag).length;
  const hafentage = ergebnis.etappen.length - fahrtage;
  const nachtschlaege = ergebnis.etappen.filter((e) => e.istNachtschlag).length;
  const ersterGeruestTag = ergebnis.etappen.find((e) => e.regime === 'geruest')?.tag ?? null;

  const saetze: string[] = [];

  if (en) {
    const teile = [`${fahrtage} sailing day${fahrtage === 1 ? '' : 's'} over ${nf(kennzahlen.gesamtSm, 1, 'en')} NM`];
    if (hafentage > 0) teile.push(`${hafentage} day${hafentage === 1 ? '' : 's'} in port`);
    if (nachtschlaege > 0) teile.push(`${nachtschlaege} night passage${nachtschlaege === 1 ? '' : 's'}`);
    saetze.push(`The voyage has ${teile.join(', ')}.`);
  } else {
    const teile = [`${fahrtage} Fahrtag${fahrtage === 1 ? '' : 'e'} über ${nf(kennzahlen.gesamtSm, 1, 'de')} sm`];
    if (hafentage > 0) teile.push(`${hafentage} Hafentag${hafentage === 1 ? '' : 'e'}`);
    if (nachtschlaege > 0) teile.push(`${nachtschlaege} Nachtfahrt${nachtschlaege === 1 ? '' : 'en'}`);
    saetze.push(`Der Törn hat ${teile.join(', ')}.`);
  }

  if (kennzahlen.gesamtFahrzeitHrs > 0) {
    const kreuzProzent = Math.round((kennzahlen.kreuzanteilHrs / kennzahlen.gesamtFahrzeitHrs) * 100);
    const motorProzent = Math.round((kennzahlen.motoranteilHrs / kennzahlen.gesamtFahrzeitHrs) * 100);
    if (kreuzProzent > 0 || motorProzent > 0) {
      saetze.push(en
        ? `${kreuzProzent} % of the sailing time is spent beating, ${motorProzent} % under engine.`
        : `${kreuzProzent} % der Fahrzeit geht kreuzend drauf, ${motorProzent} % unter Maschine.`);
    }
  }

  if (kennzahlen.offeneNaechte > 0 || kennzahlen.ungeschuetzteNaechte > 0) {
    const teile: string[] = [];
    if (kennzahlen.offeneNaechte > 0) {
      const nachtWort = kennzahlen.offeneNaechte === 1 ? 'Nacht liegt' : 'Nächte liegen';
      teile.push(en
        ? `${kennzahlen.offeneNaechte} night${kennzahlen.offeneNaechte === 1 ? '' : 's'} lie${kennzahlen.offeneNaechte === 1 ? 's' : ''} exposed`
        : `${kennzahlen.offeneNaechte} ${nachtWort} offen`);
    }
    if (kennzahlen.ungeschuetzteNaechte > 0) {
      teile.push(en
        ? `the shelter is unknown for ${kennzahlen.ungeschuetzteNaechte} night${kennzahlen.ungeschuetzteNaechte === 1 ? '' : 's'}`

        : `bei ${kennzahlen.ungeschuetzteNaechte} ${kennzahlen.ungeschuetzteNaechte === 1 ? 'Nacht' : 'Nächten'} ist die Schutzlage nicht bekannt`);
    }
    const satz = teile.join('; ');
    saetze.push(`${satz.charAt(0).toUpperCase()}${satz.slice(1)}.`);
  } else if (kennzahlen.gedeckteNaechte > 0) {
    saetze.push(en
      ? 'All nights currently lie sheltered.'
      : 'Alle Nächte liegen nach heutigem Stand geschützt.');
  }

  if (ersterGeruestTag != null) {
    saetze.push(en
      ? `From day ${ersterGeruestTag} there is no forecast yet: only distance and an estimated passage time at regional normal wind.`
      : `Ab Tag ${ersterGeruestTag} gibt es noch keine Vorhersage: nur Distanz und eine Fahrzeitschätzung bei Revier-Normalwind.`);
  }

  return saetze.join(' ');
}

export function wochenBriefingAbschnitte(
  ergebnis: WochenplanErgebnis, netz: Kandidatennetz, kennzahlen: PlanKennzahlen,
  begruendung: Begruendungsspur | null, sprache: Sprache = 'de', revierwetterText: string | null = null,
): BriefingAbschnitt[] {
  const en = sprache === 'en';
  const abschnitte: BriefingAbschnitt[] = [
    { titel: en ? 'Overview' : 'Überblick', text: wochenUeberblick(ergebnis, kennzahlen, sprache) },
  ];
  if (revierwetterText) {
    abschnitte.push({ titel: en ? 'Weather' : 'Wetterlage', text: revierwetterText });
  }

  for (const etappe of ergebnis.etappen) {
    const von = netz.knoten[etappe.vonIndex]?.name ?? (en ? 'unknown' : 'unbekannt');
    let kopf: string;
    if (etappe.istHafentag) {
      kopf = en ? `Day in port at ${von}.` : `Hafentag in ${von}.`;
    } else {
      const nach = netz.knoten[etappe.nachIndex]?.name ?? (en ? 'unknown' : 'unbekannt');
      const sm = `${nf(etappe.sm, 1, sprache)} sm`;
      kopf = en ? `${von} to ${nach} (${sm}).` : `${von} nach ${nach} (${sm}).`;
    }
    const tag = begruendung?.tage.find((t) => t.tag === etappe.tag) ?? null;
    const begruendungText = tag ? tagesBegruendung(tag, netz, sprache) : null;
    abschnitte.push({
      titel: en ? `Day ${etappe.tag}` : `Tag ${etappe.tag}`,
      text: begruendungText ? `${kopf} ${begruendungText}` : kopf,
    });
  }

  return abschnitte;
}
