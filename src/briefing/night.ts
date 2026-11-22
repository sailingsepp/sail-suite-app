import { nf, nDate, localDateStr, uhrLt } from '@/core/time';
import { uv, bearingOf } from '@/core/geo';
import type { StundenWind, Tageslicht, AnkerplatzArt, Punkt, Gezeit, Sprache } from '@/core/types';
import { luvFetchNM, schutzStufe, type Schutzlage, type Kuestenlinie } from '@/core/shelter';
import type { Druckanalyse } from '@/core/druckfeld';
import { windName, boeenTeil, richtungsName, anzeigeKn, beaufort, EINGESCHLAFEN_UNTER_KN } from './wind';
import { describeLeeAmLiegeplatz } from './terrain';
import { localWind, boraWetterlage, type LokalwindLage } from './localWinds';
import { SCHUTZ_TEXT, SCHUTZ_TEXT_EN } from './alternatives';
import type { Synoptik } from './synoptik';
import { escapeHtml } from '@/core/html';

export interface SkipperGuideZitat {
  text: string;
  quelle: string;
  stand: string | null;

  textSprache?: Sprache;
}
import {
  nebelSpread, nebelUnstimmig, NEBEL_SPREAD_MAX,
  sichtBeiNebel, sichtUnstimmig, NEBEL_SICHT_MAX_M,
} from './weather';

const WASSERSTAND_SCHWELLE_M = 0.3;

export const RUHIGE_NACHT_BIS_BFT = 3;

function lageAmLiegeplatz(
  hourly: StundenWind, idxs: number[], ziel: Punkt | null, bezugszeit: Date,
): LokalwindLage | null {
  if (!ziel || idxs.length === 0) return null;
  const speed = idxs.map((i) => hourly.wind_speed_10m[i]!);
  const dir = idxs.map((i) => hourly.wind_direction_10m[i]!);
  const gust = idxs.map((i, k) => hourly.wind_gusts_10m[i] ?? speed[k]!);

  let dx = 0, dy = 0;
  for (let k = 0; k < speed.length; k++) {
    const [ux, uy] = uv(dir[k]!);
    dx += ux * speed[k]!; dy += uy * speed[k]!;
  }

  let gustFactor = 1;
  for (let k = 0; k < speed.length; k++) {
    if (speed[k]! >= 5) gustFactor = Math.max(gustFactor, gust[k]! / speed[k]!);
  }

  return {
    avgWindDir: bearingOf(dx, dy),
    maxWind: Math.max(...speed),
    gustFactor,
    midLat: ziel.lat,
    midLon: ziel.lon,
    beatShare: 0,
    departure: bezugszeit,
    maxGust: Math.max(...gust),
  };
}

function reviertextAmLiegeplatz(
  hourly: StundenWind, idxs: number[], ziel: Punkt | null, bezugszeit: Date,
  syn: Synoptik | null, druck: Druckanalyse | null = null, sprache: Sprache = 'de',
): string | null {
  const lage = lageAmLiegeplatz(hourly, idxs, ziel, bezugszeit);
  if (!lage) return null;
  return localWind(lage, bezugszeit.getUTCMonth() + 1, syn, 1, druck, sprache);
}

function boraAmLiegeplatz(
  hourly: StundenWind, idxs: number[], ziel: Punkt | null, druck: Druckanalyse | null,
): boolean {
  const lage = lageAmLiegeplatz(hourly, idxs, ziel, new Date(NaN));
  return !!lage && boraWetterlage(lage, druck);
}

const TAG_AM_ZIEL_AB_STUNDEN = 4;

export function describeTagAmZiel(
  hourly: StundenWind, ankunft: Date, tageslicht: Tageslicht, art: AnkerplatzArt = null,
  nachNachtfahrt = false, ziel: Punkt | null = null, syn: Synoptik | null = null,

  druck: Druckanalyse | null = null,
  sprache: Sprache = 'de',
): string | null {
  if (sprache === 'en') {
    return describeTagAmZielEn(hourly, ankunft, tageslicht, art, nachNachtfahrt, ziel, syn, druck);
  }
  const heuteIdx = tageslicht.time.indexOf(localDateStr(ankunft));
  if (heuteIdx < 0) return null;
  const sunset = nDate(tageslicht.sunset[heuteIdx]!);
  const stunden = (sunset.getTime() - ankunft.getTime()) / 3600_000;
  if (stunden < TAG_AM_ZIEL_AB_STUNDEN) return null;

  const idxs: number[] = [];
  hourly.time.forEach((t, i) => {
    const z = nDate(t).getTime();
    if (z >= ankunft.getTime() && z <= sunset.getTime()) idxs.push(i);
  });
  if (idxs.length < 2) return null;

  const speed = idxs.map((i) => hourly.wind_speed_10m[i]!);
  const gust = idxs.map((i) => hourly.wind_gusts_10m[i] ?? hourly.wind_speed_10m[i]!);
  const dir = idxs.map((i) => hourly.wind_direction_10m[i]!);
  const maxSpeed = Math.max(...speed), maxGust = Math.max(...gust);
  const n = idxs.length, viertel = Math.max(1, Math.floor(n / 4));
  const mittel = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const trend = mittel(speed.slice(n - viertel)) - mittel(speed.slice(0, viertel));

  let dx = 0, dy = 0;
  for (let k = 0; k < n; k++) { const [ux, uy] = uv(dir[k]!); dx += ux * speed[k]!; dy += uy * speed[k]!; }
  const gesamtDir = bearingOf(dx, dy);

  let spitzeIdx = 0;
  gust.forEach((g, k) => { if (g > gust[spitzeIdx]!) spitzeIdx = k; });
  const spitzeZeit = nDate(hourly.time[idxs[spitzeIdx]!]!);

  const istMarina = art === 'marina';
  const T: string[] = [];
  T.push(`Von der Ankunft bis Sonnenuntergang um ${uhrLt(sunset)} liegen noch `
    + `<b>${stunden < 1.5 ? `${Math.round(stunden * 60)} Minuten` : `${nf(stunden, 0)} Stunden`}</b> `

    + `am Liegeplatz. In dieser Zeit ${windName(maxSpeed, maxGust)} aus ${richtungsName(gesamtDir)}, `
    + `bis ${nf(anzeigeKn(maxSpeed), 0)} kn${boeenTeil(maxSpeed, maxGust)}.`);

  if (trend > 4) {
    T.push(`Der Wind frischt über den Tag auf, am kräftigsten gegen ${uhrLt(spitzeZeit)}.`);
  } else if (trend < -4) {
    T.push(mittel(speed.slice(n - viertel)) < EINGESCHLAFEN_UNTER_KN ? 'Der Wind schläft über den Tag ein.' : 'Der Wind nimmt über den Tag ab.');
  }

  const hatGewitter = idxs.some((i) => (hourly.weather_code[i] ?? 0) >= 95);
  const maxCape = Math.max(0, ...idxs.map((i) => hourly.cape[i] ?? 0));
  if (hatGewitter) T.push('<b class="warn-text">Gewitter im Tagesverlauf möglich.</b>');
  else if (maxCape >= 1000) T.push('Labile Luftmasse, einzelne Schauer am Nachmittag möglich.');

  if (nachNachtfahrt) {

    const lage = hatGewitter
      ? '<b class="warn-text">und ausgerechnet dann kann ein Gewitter durchziehen.</b>'
      : trend > 4
        ? '<b class="warn-text">und genau dann frischt es auf.</b>'
        : maxGust >= 20
          ? `<b class="warn-text">und es bleibt dabei böig, bis ${nf(maxGust, 0)} kn.</b>`
          : '';
    T.push('<b>Nach der Nachtfahrt wird die Crew tagsüber schlafen</b>, '
      + (lage
        ? `${lage} Bevor sich jemand hinlegt, gehört der Liegeplatz für ${nf(maxGust, 0)} kn Böen `
          + 'hergerichtet, nicht für die Bedingungen im Moment der Ankunft'
        : 'der Liegeplatz gehört deshalb gleich bei der Ankunft für den ganzen Tag hergerichtet, '
          + 'nicht nur für die Bedingungen in diesem Moment')
      + (istMarina
        ? '. Leinen lang genug für den Schwell, Fender auf beiden Seiten, Landstrom und Steg gecheckt.'
        : '. Anker sorgfältig eingraben und die Position peilen, reichlich Kette stecken, '
          + 'Ankeralarm setzen. Wer nach durchfahrener Nacht schläft, merkt ein Vertreiben sonst nicht.'));
    T.push('Und: Wer die Nacht durchgefahren ist, sollte den Landgang auf den Abend legen. '
      + 'Die ersten Stunden nach einem Nachtschlag sind zum Schlafen da, nicht zum Aufräumen.');
  } else if (maxGust >= 22) {
    T.push(istMarina
      ? `Bei Böen bis ${nf(maxGust, 0)} kn schon am Nachmittag die Festmacher prüfen, nicht erst abends.`
      : `Bei Böen bis ${nf(maxGust, 0)} kn den Ankerplatz gleich für den Nachmittag wählen, `
        + 'nicht für die ruhige Lage bei der Ankunft.');
  }

  const revier = reviertextAmLiegeplatz(hourly, idxs, ziel, spitzeZeit, syn, druck);
  if (revier) return `${T.join(' ')} <div class="brief-absatz">${revier}</div>`;

  return T.join(' ');
}

function describeTagAmZielEn(
  hourly: StundenWind, ankunft: Date, tageslicht: Tageslicht, art: AnkerplatzArt,
  nachNachtfahrt: boolean, ziel: Punkt | null, syn: Synoptik | null,
  druck: Druckanalyse | null,
): string | null {
  const heuteIdx = tageslicht.time.indexOf(localDateStr(ankunft));
  if (heuteIdx < 0) return null;
  const sunset = nDate(tageslicht.sunset[heuteIdx]!);
  const stunden = (sunset.getTime() - ankunft.getTime()) / 3600_000;
  if (stunden < TAG_AM_ZIEL_AB_STUNDEN) return null;

  const idxs: number[] = [];
  hourly.time.forEach((t, i) => {
    const z = nDate(t).getTime();
    if (z >= ankunft.getTime() && z <= sunset.getTime()) idxs.push(i);
  });
  if (idxs.length < 2) return null;

  const speed = idxs.map((i) => hourly.wind_speed_10m[i]!);
  const gust = idxs.map((i) => hourly.wind_gusts_10m[i] ?? hourly.wind_speed_10m[i]!);
  const dir = idxs.map((i) => hourly.wind_direction_10m[i]!);
  const maxSpeed = Math.max(...speed), maxGust = Math.max(...gust);
  const n = idxs.length, viertel = Math.max(1, Math.floor(n / 4));
  const mittel = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const trend = mittel(speed.slice(n - viertel)) - mittel(speed.slice(0, viertel));

  let dx = 0, dy = 0;
  for (let k = 0; k < n; k++) { const [ux, uy] = uv(dir[k]!); dx += ux * speed[k]!; dy += uy * speed[k]!; }
  const gesamtDir = bearingOf(dx, dy);

  let spitzeIdx = 0;
  gust.forEach((g, k) => { if (g > gust[spitzeIdx]!) spitzeIdx = k; });
  const spitzeZeit = nDate(hourly.time[idxs[spitzeIdx]!]!);

  const istMarina = art === 'marina';
  const T: string[] = [];
  T.push(`From arrival until sunset at ${uhrLt(sunset)}, `
    + `<b>${stunden < 1.5 ? `${Math.round(stunden * 60)} minutes` : `${nf(stunden, 0, 'en')} hours`}</b> `
    + `remain at the berth. During this time ${windName(maxSpeed, maxGust, 'en')} from `
    + `${richtungsName(gesamtDir, 'en')}, up to ${nf(anzeigeKn(maxSpeed), 0, 'en')} kn`
    + `${boeenTeil(maxSpeed, maxGust, 'en')}.`);

  if (trend > 4) {
    T.push(`The wind freshens over the course of the day, strongest around ${uhrLt(spitzeZeit)}.`);
  } else if (trend < -4) {
    T.push(mittel(speed.slice(n - viertel)) < EINGESCHLAFEN_UNTER_KN ? 'The wind dies down over the course of the day.' : 'The wind eases over the course of the day.');
  }

  const hatGewitter = idxs.some((i) => (hourly.weather_code[i] ?? 0) >= 95);
  const maxCape = Math.max(0, ...idxs.map((i) => hourly.cape[i] ?? 0));
  if (hatGewitter) T.push('<b class="warn-text">Thunderstorms possible during the day.</b>');
  else if (maxCape >= 1000) T.push('Unstable air mass, isolated showers possible in the afternoon.');

  if (nachNachtfahrt) {
    const lage = hatGewitter
      ? '<b class="warn-text">and a thunderstorm could pass through at exactly that time.</b>'
      : trend > 4
        ? '<b class="warn-text">and that is exactly when it freshens.</b>'
        : maxGust >= 20
          ? `<b class="warn-text">and it stays gusty, up to ${nf(maxGust, 0, 'en')} kn.</b>`
          : '';
    T.push('<b>After the night passage the crew will sleep during the day</b>, '
      + (lage
        ? `${lage} Before anyone lies down, the berth needs to be readied for ${nf(maxGust, 0, 'en')} kn `
          + 'gusts, not for conditions at the moment of arrival'
        : 'the berth should therefore be readied for the whole day right at arrival, not just for the '
          + 'conditions at that moment')
      + (istMarina
        ? '. Lines long enough for the swell, fenders on both sides, shore power and pontoon checked.'
        : '. Dig the anchor in carefully and take a bearing on the position, pay out plenty of chain, '
          + 'set an anchor alarm. Anyone asleep after a night passage will not notice dragging otherwise.'));
    T.push('And: anyone who has sailed through the night should save going ashore for the evening. '
      + 'The first hours after a night passage are for sleeping, not for tidying up.');
  } else if (maxGust >= 22) {
    T.push(istMarina
      ? `With gusts up to ${nf(maxGust, 0, 'en')} kn, check the mooring lines in the afternoon already, not just in the evening.`
      : `With gusts up to ${nf(maxGust, 0, 'en')} kn, choose the anchorage for the afternoon straight away, `
        + 'not for the calm conditions at arrival.');
  }

  const revier = reviertextAmLiegeplatz(hourly, idxs, ziel, spitzeZeit, syn, druck, 'en');
  if (revier) return `${T.join(' ')} <div class="brief-absatz">${revier}</div>`;

  return T.join(' ');
}

export function describeNachtAmZiel(
  hourly: StundenWind, ankunft: Date, tageslicht: Tageslicht, art: AnkerplatzArt = null,
  ziel: Punkt | null = null, gezeit: Gezeit | null = null, syn: Synoptik | null = null,

  zielKueste: Kuestenlinie | null = null,

  skipperGuide: SkipperGuideZitat | null = null,

  skipperGuideLaedt = false,

  druck: Druckanalyse | null = null,
  sprache: Sprache = 'de',

  skipperGuideLage: 'kein-eintrag' | 'fehlgeschlagen' | null = null,

  amtlicheNachtwarnung: string | null = null,
): string | null {
  if (sprache === 'en') {
    return describeNachtAmZielEn(hourly, ankunft, tageslicht, art, ziel, gezeit, syn,
      zielKueste, skipperGuide, skipperGuideLaedt, druck, skipperGuideLage, amtlicheNachtwarnung);
  }
  const heuteIdx = tageslicht.time.indexOf(localDateStr(ankunft));
  const sunset = heuteIdx >= 0 ? nDate(tageslicht.sunset[heuteIdx]!) : null;
  const start = sunset && sunset.getTime() > ankunft.getTime() ? sunset : ankunft;

  const wartezeitH = (start.getTime() - ankunft.getTime()) / 3600_000;

  let ende: Date | null = null;
  for (let i = 0; i < tageslicht.time.length; i++) {
    const sr = nDate(tageslicht.sunrise[i]!);
    if (sr.getTime() > start.getTime()) { ende = sr; break; }
  }
  if (!ende) ende = new Date(start.getTime() + 10 * 3600_000);

  const idxs: number[] = [];
  hourly.time.forEach((t, i) => {
    const zeit = nDate(t).getTime();
    if (zeit >= start.getTime() && zeit <= ende!.getTime()) idxs.push(i);
  });
  if (idxs.length < 2) return null;

  const speed = idxs.map((i) => hourly.wind_speed_10m[i]!);
  const dir = idxs.map((i) => hourly.wind_direction_10m[i]!);
  const gust = idxs.map((i) => hourly.wind_gusts_10m[i] ?? hourly.wind_speed_10m[i]!);

  const vecDir = (von: number, bis: number): number => {
    let dx = 0, dy = 0;
    for (let k = von; k < bis; k++) {
      const [ux, uy] = uv(dir[k]!);
      dx += ux * speed[k]!; dy += uy * speed[k]!;
    }
    return bearingOf(dx, dy);
  };
  const n = idxs.length;
  const viertel = Math.max(1, Math.floor(n / 4));
  const dirFrueh = vecDir(0, viertel);
  const dirSpaet = vecDir(n - viertel, n);

  const drehung = Math.abs(((dirSpaet - dirFrueh + 540) % 360) - 180);

  const avg = (arr: number[]): number => arr.reduce((a, b) => a + b, 0) / arr.length;
  const trend = avg(speed.slice(n - viertel)) - avg(speed.slice(0, viertel));
  const maxSpeed = Math.max(...speed), minSpeed = Math.min(...speed), maxGust = Math.max(...gust);
  const gesamtDir = vecDir(0, n);

  const platzWort = art === 'marina' ? 'Marina/Hafen' : art === 'bucht' ? 'Ankerplatz' : '';
  const einstieg = wartezeitH >= TAG_AM_ZIEL_AB_STUNDEN
    ? `In der Nacht darauf, ab etwa ${uhrLt(start)}${platzWort ? ` (${platzWort})` : ''}: `
    : platzWort ? `${platzWort}: ` : '';

  const windSatzteil = `${windName(maxSpeed, maxGust)} aus ${richtungsName(gesamtDir)}`
    + `${maxSpeed - minSpeed > 3
      ? `, ${nf(anzeigeKn(minSpeed), 0)} bis ${nf(anzeigeKn(maxSpeed), 0)} kn`
      : `, um ${nf(anzeigeKn(maxSpeed), 0)} kn`}`
    + `${boeenTeil(maxSpeed, maxGust)}.`;

  const anlege = anlegeWind(hourly, ankunft, start, maxGust);
  const kopf = anlege
    ? `Beim Anlegen gegen ${uhrLt(ankunft)} weht es noch bis ${nf(anzeigeKn(anlege.speed), 0)} kn, `
      + `Böen bis ${nf(anzeigeKn(anlege.gust), 0)} kn. In der Nacht${platzWort ? ` (${platzWort})` : ''}: `
    : einstieg;
  let satz = kopf
    ? kopf + windSatzteil
    : windSatzteil.charAt(0).toUpperCase() + windSatzteil.slice(1);

  let zielSchutz: Schutzlage | null = null;
  if (ziel && zielKueste && zielKueste.length) {
    const fetchNM = luvFetchNM(ziel, gesamtDir, zielKueste);
    zielSchutz = { fetchNM, schutz: schutzStufe(fetchNM) };
  }
  if (zielSchutz?.schutz && art !== 'marina') {
    const anlauf = zielSchutz.fetchNM! >= 12 ? 'über 12' : nf(zielSchutz.fetchNM!, 1);
    satz += ` Der Liegeplatz ist laut Küstenlinie ${SCHUTZ_TEXT[zielSchutz.schutz]} `
      + `(Wellenanlauf ${anlauf} sm). Bewertet ist dabei nur der Anlauf, keine Fallböen.`;
  }

  if (drehung >= 40)
    satz += ` Der Wind dreht im Lauf der Nacht von ${richtungsName(dirFrueh)} auf ${richtungsName(dirSpaet)}.`;

  const frischtAuf = trend > 4, schlaeftEin = trend < -4;
  if (frischtAuf) satz += ` Der Wind frischt dabei auf.`;

  else if (schlaeftEin) satz += avg(speed.slice(n - viertel)) < EINGESCHLAFEN_UNTER_KN ? ` Der Wind schläft dabei ein.` : ` Der Wind nimmt dabei ab.`;

  if (gezeit?.valid && Math.abs(gezeit.hoeheM) >= WASSERSTAND_SCHWELLE_M) {

    const wetter = gezeit.anteil === 'wetter';
    const wer = wetter ? 'Wetterbedingt (Wind, Luftdruck, ohne Gezeit) liegt der Wasserstand' : 'Der Wasserstand liegt';
    satz += gezeit.hoeheM > 0
      ? ` ${wer} rund ${nf(gezeit.hoeheM, 1)} m über dem Mittel: Leinen und Fender auf mehr Spiel einstellen.`
      : ` ${wer} rund ${nf(-gezeit.hoeheM, 1)} m unter dem Mittel: in flachen Buchten und an Stegen die Tiefe im Auge behalten.`;
  }

  const hatGewitter = idxs.some((i) => (hourly.weather_code[i] ?? 0) >= 95);
  const maxCape = Math.max(0, ...idxs.map((i) => hourly.cape[i] ?? 0));
  const hatNebel = idxs.some((i) => hourly.weather_code[i] === 45 || hourly.weather_code[i] === 48);

  if (hatGewitter) satz += ' Gewitter in der Nacht möglich.';
  else if (maxCape >= 1000) satz += ' Labile Luftmasse, einzelne nächtliche Schauer möglich.';

  const sichtNebel = sichtBeiNebel(hourly, idxs);
  const spreadNebel = nebelSpread(hourly, idxs);
  if (hatNebel && sichtNebel !== null) {
    satz += sichtNebel >= NEBEL_SICHT_MAX_M
      ? sichtUnstimmig(sichtNebel)
      : ` Zeitweise Nebel, Sicht bis auf rund ${Math.round(sichtNebel / 100) * 100} m herab.`;
  } else if (hatNebel && spreadNebel !== null && spreadNebel > NEBEL_SPREAD_MAX) {
    satz += nebelUnstimmig(spreadNebel);
  } else if (hatNebel) {
    satz += ' Zeitweise Nebel.';
  }

  const istMarina = art === 'marina';
  if (hatGewitter) {
    satz += istMarina
      ? ' Im Hafen aufpassen: Gewitterböen kommen aus wechselnden Richtungen. Leinen und Fender nochmal prüfen.'
      : ' Beim Ankern aufpassen: Gewitterböen kommen aus wechselnden Richtungen (Wache halten).';
  } else if (drehung >= 60) {

    satz += istMarina
      ? ` Das kann Schwell in den Liegeplatz bringen. Festmacher und Fender auf der neuen Wetterseite (${richtungsName(dirSpaet)}) prüfen.`
      : ` Beim Ankern aufpassen: Der Platz sollte auch aus ${richtungsName(dirSpaet)} Schutz bieten, sonst umlegen oder Wache halten.`;
  } else if (amtlicheNachtwarnung) {
    satz += ` ${amtlicheNachtwarnung}`;
  } else if (boraAmLiegeplatz(hourly, idxs, ziel, druck)) {

    satz += ' Ruhig ist die Nacht trotzdem nicht sicher: Die Druckverteilung passt zu einer Bora, und die weht '
      + 'zu Beginn eines Ausbruchs vor allem in der folgenden Nacht und am Morgen darauf am stärksten'
      + (istMarina
        ? '. Leinen und Fender auf kräftige Böen vorbereiten, Seewetterbericht vor dem Schlafengehen prüfen.'
        : '. Der Ankerplatz sollte freien Raum nach Westen und Süden bieten, ausreichend Kette stecken.');
  } else if (maxGust >= 20) {
    satz += istMarina
      ? ' Im Hafen aufpassen: Leinen und Fender für die Böen nochmal prüfen, Vorhersage vor dem Schlafengehen checken.'
      : ' Beim Ankern aufpassen: ausreichend Kettenlänge stecken, Vorhersage vor dem Schlafengehen nochmal prüfen.';
  } else if (!frischtAuf && !schlaeftEin && drehung < 40) {

    satz += beaufort(anzeigeKn(maxSpeed)) <= RUHIGE_NACHT_BIS_BFT
      ? ' Die Nacht wird ruhig, Wind und Richtung bleiben stabil.'
      : ' Wind und Richtung bleiben über die Nacht stabil.';
  }

  if (amtlicheNachtwarnung && !satz.includes(amtlicheNachtwarnung)) satz += ` ${amtlicheNachtwarnung}`;

  const lee = describeLeeAmLiegeplatz(ziel, maxGust, istMarina);
  if (lee) satz += lee;

  const revier = reviertextAmLiegeplatz(hourly, idxs, ziel, start, syn, druck);
  if (revier) satz += ` <div class="brief-absatz">${revier}</div>`;

  if (skipperGuide) {

    const standText = skipperGuide.stand ? ` · Stand ${escapeHtml(skipperGuide.stand)}` : '';
    satz += ` <div class="brief-absatz sg-card">`
      + `<div class="sg-card-kopf">Revierführer <span>SkipperGuide.de</span>${standText}</div> `
      + `<div class="sg-card-text">„${escapeHtml(skipperGuide.text)}“</div> `

      + `<div class="sg-card-quelle"><a href="${escapeHtml(skipperGuide.quelle)}" target="_blank" rel="noopener noreferrer">${escapeHtml(skipperGuide.quelle)}</a></div>`
      + `</div>`;
  } else if (skipperGuideLaedt) {
    satz += ' <div class="brief-absatz brief-hinweis">SkipperGuide.de wird noch nach einem Eintrag zu diesem Ziel durchsucht. Das kann '
      + 'bis zu einer Minute dauern, hier ergänzt sich der Text von selbst.</div>';
  } else if (skipperGuideLage === 'fehlgeschlagen') {
    satz += ' <div class="brief-absatz brief-hinweis">SkipperGuide.de-Abfrage fehlgeschlagen: es kann trotzdem ein Eintrag '
      + 'zu diesem Ziel geben. Erneut berechnen versucht es noch einmal.</div>';
  } else if (skipperGuideLage === 'kein-eintrag') {
    satz += ' <div class="brief-absatz brief-hinweis">Kein SkipperGuide.de-Eintrag zu diesem Ziel gefunden.</div>';
  }

  return satz;
}

function describeNachtAmZielEn(
  hourly: StundenWind, ankunft: Date, tageslicht: Tageslicht, art: AnkerplatzArt,
  ziel: Punkt | null, gezeit: Gezeit | null, syn: Synoptik | null,
  zielKueste: Kuestenlinie | null, skipperGuide: SkipperGuideZitat | null,
  skipperGuideLaedt: boolean, druck: Druckanalyse | null,
  skipperGuideLage: 'kein-eintrag' | 'fehlgeschlagen' | null = null,
  amtlicheNachtwarnung: string | null = null,
): string | null {
  const heuteIdx = tageslicht.time.indexOf(localDateStr(ankunft));
  const sunset = heuteIdx >= 0 ? nDate(tageslicht.sunset[heuteIdx]!) : null;
  const start = sunset && sunset.getTime() > ankunft.getTime() ? sunset : ankunft;
  const wartezeitH = (start.getTime() - ankunft.getTime()) / 3600_000;

  let ende: Date | null = null;
  for (let i = 0; i < tageslicht.time.length; i++) {
    const sr = nDate(tageslicht.sunrise[i]!);
    if (sr.getTime() > start.getTime()) { ende = sr; break; }
  }
  if (!ende) ende = new Date(start.getTime() + 10 * 3600_000);

  const idxs: number[] = [];
  hourly.time.forEach((t, i) => {
    const zeit = nDate(t).getTime();
    if (zeit >= start.getTime() && zeit <= ende!.getTime()) idxs.push(i);
  });
  if (idxs.length < 2) return null;

  const speed = idxs.map((i) => hourly.wind_speed_10m[i]!);
  const dir = idxs.map((i) => hourly.wind_direction_10m[i]!);
  const gust = idxs.map((i) => hourly.wind_gusts_10m[i] ?? hourly.wind_speed_10m[i]!);

  const vecDir = (von: number, bis: number): number => {
    let dx = 0, dy = 0;
    for (let k = von; k < bis; k++) {
      const [ux, uy] = uv(dir[k]!);
      dx += ux * speed[k]!; dy += uy * speed[k]!;
    }
    return bearingOf(dx, dy);
  };
  const n = idxs.length;
  const viertel = Math.max(1, Math.floor(n / 4));
  const dirFrueh = vecDir(0, viertel);
  const dirSpaet = vecDir(n - viertel, n);
  const drehung = Math.abs(((dirSpaet - dirFrueh + 540) % 360) - 180);

  const avg = (arr: number[]): number => arr.reduce((a, b) => a + b, 0) / arr.length;
  const trend = avg(speed.slice(n - viertel)) - avg(speed.slice(0, viertel));
  const maxSpeed = Math.max(...speed), minSpeed = Math.min(...speed), maxGust = Math.max(...gust);
  const gesamtDir = vecDir(0, n);

  const platzWort = art === 'marina' ? 'marina/harbour' : art === 'bucht' ? 'anchorage' : '';
  const einstieg = wartezeitH >= TAG_AM_ZIEL_AB_STUNDEN
    ? `The following night, from around ${uhrLt(start)}${platzWort ? ` (${platzWort})` : ''}: `
    : platzWort ? `${platzWort}: ` : '';
  const windSatzteil = `${windName(maxSpeed, maxGust, 'en')} from ${richtungsName(gesamtDir, 'en')}`
    + `${maxSpeed - minSpeed > 3
      ? `, ${nf(anzeigeKn(minSpeed), 0, 'en')} to ${nf(anzeigeKn(maxSpeed), 0, 'en')} kn`
      : `, around ${nf(anzeigeKn(maxSpeed), 0, 'en')} kn`}`
    + `${boeenTeil(maxSpeed, maxGust, 'en')}.`;
  const anlege = anlegeWind(hourly, ankunft, start, maxGust);
  const kopf = anlege
    ? `When berthing around ${uhrLt(ankunft)} it still blows up to ${nf(anzeigeKn(anlege.speed), 0, 'en')} kn, `
      + `gusting to ${nf(anzeigeKn(anlege.gust), 0, 'en')} kn. During the night${platzWort ? ` (${platzWort})` : ''}: `
    : einstieg;
  let satz = kopf
    ? kopf + windSatzteil
    : windSatzteil.charAt(0).toUpperCase() + windSatzteil.slice(1);

  let zielSchutz: Schutzlage | null = null;
  if (ziel && zielKueste && zielKueste.length) {
    const fetchNM = luvFetchNM(ziel, gesamtDir, zielKueste);
    zielSchutz = { fetchNM, schutz: schutzStufe(fetchNM) };
  }
  if (zielSchutz?.schutz && art !== 'marina') {
    const anlauf = zielSchutz.fetchNM! >= 12 ? 'over 12' : nf(zielSchutz.fetchNM!, 1, 'en');
    satz += ` By the coastline, the berth is ${SCHUTZ_TEXT_EN[zielSchutz.schutz]} `
      + `(fetch ${anlauf} NM). Only the fetch is assessed here, not williwaws.`;
  }

  if (drehung >= 40)
    satz += ` The wind turns during the night from ${richtungsName(dirFrueh, 'en')} to ${richtungsName(dirSpaet, 'en')}.`;
  const frischtAuf = trend > 4, schlaeftEin = trend < -4;
  if (frischtAuf) satz += ` The wind freshens over that time.`;
  else if (schlaeftEin) satz += avg(speed.slice(n - viertel)) < EINGESCHLAFEN_UNTER_KN ? ` The wind dies down over that time.` : ` The wind eases over that time.`;

  if (gezeit?.valid && Math.abs(gezeit.hoeheM) >= WASSERSTAND_SCHWELLE_M) {
    const wer = gezeit.anteil === 'wetter'
      ? 'Driven by the weather (wind, air pressure, tide excluded), the water level runs' : 'The water level runs';
    satz += gezeit.hoeheM > 0
      ? ` ${wer} around ${nf(gezeit.hoeheM, 1, 'en')} m above the mean. Allow more slack on lines and fenders.`
      : ` ${wer} around ${nf(-gezeit.hoeheM, 1, 'en')} m below the mean. Keep an eye on depth in shallow bays and at pontoons.`;
  }

  const hatGewitter = idxs.some((i) => (hourly.weather_code[i] ?? 0) >= 95);
  const maxCape = Math.max(0, ...idxs.map((i) => hourly.cape[i] ?? 0));
  const hatNebel = idxs.some((i) => hourly.weather_code[i] === 45 || hourly.weather_code[i] === 48);
  if (hatGewitter) satz += ' Thunderstorms possible during the night.';
  else if (maxCape >= 1000) satz += ' Unstable air mass, isolated overnight showers possible.';
  const sichtNebel = sichtBeiNebel(hourly, idxs);
  const spreadNebel = nebelSpread(hourly, idxs);
  if (hatNebel && sichtNebel !== null) {
    satz += sichtNebel >= NEBEL_SICHT_MAX_M
      ? sichtUnstimmig(sichtNebel, 'en')
      : ` Patchy fog, visibility down to around ${Math.round(sichtNebel / 100) * 100} m.`;
  } else if (hatNebel && spreadNebel !== null && spreadNebel > NEBEL_SPREAD_MAX) {
    satz += nebelUnstimmig(spreadNebel, 'en');
  } else if (hatNebel) {
    satz += ' Patchy fog at times.';
  }

  const istMarina = art === 'marina';
  if (hatGewitter) {
    satz += istMarina
      ? ' Watch out in harbour: thunderstorm gusts come from shifting directions. Check lines and fenders again.'
      : ' Watch out at anchor: thunderstorm gusts come from shifting directions (keep watch).';
  } else if (drehung >= 60) {
    satz += istMarina
      ? ` That can bring swell into the berth. Check mooring lines and fenders on the new weather side (${richtungsName(dirSpaet, 'en')}).`
      : ` Watch out at anchor: the spot should also offer shelter from ${richtungsName(dirSpaet, 'en')}, otherwise move or keep watch.`;
  } else if (amtlicheNachtwarnung) {
    satz += ` ${amtlicheNachtwarnung}`;
  } else if (boraAmLiegeplatz(hourly, idxs, ziel, druck)) {
    satz += ' A calm night is not assured, though: the pressure pattern matches a Bora, which blows hardest '
      + 'at the start of an outbreak, especially the following night and next morning'
      + (istMarina
        ? '. Prepare lines and fenders for strong gusts, check the marine forecast before turning in.'
        : '. The anchorage should have open water to the west and south; pay out enough chain.');
  } else if (maxGust >= 20) {
    satz += istMarina
      ? ' Watch out in harbour: check lines and fenders for the gusts again, check the forecast before turning in.'
      : ' Watch out at anchor: pay out enough chain, check the forecast again before turning in.';
  } else if (!frischtAuf && !schlaeftEin && drehung < 40) {
    satz += beaufort(anzeigeKn(maxSpeed)) <= RUHIGE_NACHT_BIS_BFT
      ? ' The night will be calm, wind and direction stay steady.'
      : ' Wind and direction stay steady through the night.';
  }
  if (amtlicheNachtwarnung && !satz.includes(amtlicheNachtwarnung)) satz += ` ${amtlicheNachtwarnung}`;

  const lee = describeLeeAmLiegeplatz(ziel, maxGust, istMarina, 'en');
  if (lee) satz += lee;

  const revier = reviertextAmLiegeplatz(hourly, idxs, ziel, start, syn, druck, 'en');
  if (revier) satz += ` <div class="brief-absatz">${revier}</div>`;

  if (skipperGuide) {

    const standText = skipperGuide.stand ? ` · as of ${escapeHtml(skipperGuide.stand)}` : '';

    const sprachHinweis = (skipperGuide.textSprache ?? 'de') === 'en'
      ? ' · machine-translated from German'
      : ' · German original, translation unavailable';
    satz += ` <div class="brief-absatz sg-card">`
      + `<div class="sg-card-kopf">Pilot guide <span>SkipperGuide.de</span>${standText}${sprachHinweis}</div> `
      + `<div class="sg-card-text">“${escapeHtml(skipperGuide.text)}”</div> `
      + `<div class="sg-card-quelle">${escapeHtml(skipperGuide.quelle)}</div>`
      + `</div>`;
  } else if (skipperGuideLaedt) {
    satz += ' <div class="brief-absatz brief-hinweis">SkipperGuide.de is still being searched for an entry on this '
      + 'destination. This can take up to a minute; the text here will fill in on its own.</div>';
  } else if (skipperGuideLage === 'fehlgeschlagen') {
    satz += ' <div class="brief-absatz brief-hinweis">SkipperGuide.de lookup failed: there may well be an entry for this '
      + 'destination all the same. Recalculating tries again.</div>';
  } else if (skipperGuideLage === 'kein-eintrag') {
    satz += ' <div class="brief-absatz brief-hinweis">No SkipperGuide.de entry found for this destination.</div>';
  }

  return satz;
}

function anlegeWind(hourly: StundenWind, ankunft: Date, start: Date, nachtBoe: number): { speed: number; gust: number } | null {
  const wartezeitH = (start.getTime() - ankunft.getTime()) / 3600_000;
  if (wartezeitH <= 0 || wartezeitH >= TAG_AM_ZIEL_AB_STUNDEN) return null;
  let speed = 0, gust = 0;
  hourly.time.forEach((t, i) => {
    const zeit = nDate(t).getTime();
    if (zeit >= ankunft.getTime() - 1800_000 && zeit < start.getTime()) {
      speed = Math.max(speed, hourly.wind_speed_10m[i]!);
      gust = Math.max(gust, hourly.wind_gusts_10m[i] ?? hourly.wind_speed_10m[i]!);
    }
  });
  return gust >= nachtBoe + 5 ? { speed, gust } : null;
}
