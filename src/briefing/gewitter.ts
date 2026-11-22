import { uhrLt } from '@/core/time';
import type { Ablegezeit, Sprache } from '@/core/types';
import { inBox, imMeer } from './localWinds';
import { type Synoptik, DRUCK_FALL_KALTFRONT } from './synoptik';

export type Gewitterrevier =
  | 'nordadria' | 'adria-mitte' | 'adria-sued'
  | 'ionisch-west' | 'ionisch-italien'
  | 'aegaeis-nord' | 'aegaeis'
  | 'levante-ost' | 'levante';

export function gewitterRevier(lat: number, lon: number): Gewitterrevier | null {

  if (inBox(lat, lon, 39.5, 46.0, 12.0, 20.5) && imMeer(lat, lon, '28g')) {

    if (lat >= 44.0) return 'nordadria';
    if (lat >= 42.85) return 'adria-mitte';
    return 'adria-sued';
  }

  if (inBox(lat, lon, 36.5, 40.0, 19.0, 21.6) && imMeer(lat, lon, '28f')) return 'ionisch-west';
  if (inBox(lat, lon, 35.0, 40.0, 12.0, 19.0) && imMeer(lat, lon, '28f')) return 'ionisch-italien';
  if (inBox(lat, lon, 34.5, 41.5, 22.5, 28.8)) return lat >= 38.6 ? 'aegaeis-nord' : 'aegaeis';
  if (inBox(lat, lon, 34.0, 37.6, 28.6, 36.5)) return lon >= 33.0 ? 'levante-ost' : 'levante';
  return null;
}

function seegewitterAb(revier: Gewitterrevier): number {
  if (revier === 'aegaeis' || revier === 'aegaeis-nord') return 10;
  if (revier === 'levante' || revier === 'levante-ost') return 11;
  return 9;
}

function describeGewitterneigungEn(lat: number, lon: number, monat: number): string | null {
  const revier = gewitterRevier(lat, lon);
  if (!revier) return null;
  const hochsaison = monat >= 6 && monat <= 8;
  const nachsaison = monat >= 9 && monat <= 11;
  const vorsaison = monat >= 4 && monat <= 5;

  switch (revier) {
    case 'nordadria':
      return hochsaison
        ? 'For the season: In peak season, the northern Adriatic is by far the most thunderstorm-prone '
          + 'sea area of the eastern Mediterranean. Cold fronts carrying polar air cross the Alps and meet '
          + 'very warm, humid air here. The cumulonimbus towers then grow 12 to 15 km high.'
        : nachsaison
          ? 'For the season: In the northern Adriatic, the cold-front thunderstorm risk stays the highest '
            + 'in the eastern Mediterranean even now, and from September onward sea thunderstorms add to it.'
          : 'For the season: The northern Adriatic has the highest cold-front thunderstorm risk in the '
            + 'eastern Mediterranean; on the Italian side, the focus lies between May and August.';
    case 'adria-mitte':
      return nachsaison
        ? 'For the season: On the eastern Adriatic coast, the thunderstorm focus falls in high and late '
          + 'season. From September onward the sea itself also becomes a thunderstorm source, and the '
          + 'eastern coast is affected by this more than the Italian side. The westerly upper winds steer '
          + 'the cells that way.'
        : hochsaison
          ? 'For the season: On the eastern Adriatic coast, the thunderstorm focus falls in high and late '
            + 'season; heat thunderstorms over the hinterland can drift as far as the coastal waters.'
          : null;
    case 'adria-sued':
      return nachsaison
        ? 'For the season: In the southern Adriatic, the thunderstorm tendency is markedly lower than in '
          + 'the north, but from September onward, sea thunderstorms form here too, preferring the night '
          + 'and morning hours.'
        : 'For the season: In the southern Adriatic, the thunderstorm tendency is markedly lower than in '
          + 'the north.';
    case 'ionisch-west':
      return nachsaison
        ? 'For the season: The western Greek waters stand out in autumn for a particularly high '
          + 'thunderstorm tendency. The storms mostly approach from west to southwest and have time over '
          + 'the sea to draw up warmth and moisture before reaching the archipelago. They arrive '
          + 'correspondingly violent.'
        : 'For the season: In the Ionian Sea, the thunderstorm tendency is low in peak season; the focus '
          + 'lies in autumn, and then especially along the western Greek coasts.';
    case 'ionisch-italien':
      return nachsaison
        ? 'For the season: In the Ionian Sea, the season of sea thunderstorms begins in September; the '
          + 'Greek eastern side is affected by this more than the Calabrian-Sicilian side.'
        : 'For the season: In the Ionian Sea, peak season brings a low tendency for thunder and lightning '
          + '. The air mass aloft is too dry and too warm for heat thunderstorms.';
    case 'aegaeis-nord':
      return vorsaison
        ? 'For the season: In the northern Aegean, most thunderstorms of the sailing season fall in spring '
          + 'and early summer; the Thermaic Gulf is struck comparatively often.'
        : 'For the season: The northern Aegean sees more thunderstorms than the rest of the sea area, '
          + 'especially the Thermaic Gulf.';
    case 'aegaeis':
      return monat >= seegewitterAb('aegaeis')
        ? 'For the season: The Aegean sees few thunderstorms; the handful that occur during the sailing '
          + 'season fall mostly in autumn, and from late September onward the sea itself becomes a '
          + 'thunderstorm source, preferring the night and morning hours.'
        : 'For the season: The Aegean sees few thunderstorms. As long as the Meltemi blows, the weather '
          + 'over the sea is decidedly sunny; showers and thunderstorms form almost only during its lulls, '
          + 'and then mainly over the mainland.';
    case 'levante-ost':
      return 'For the season: In the far east of the Turkish Riviera, most thunderstorms of the sailing '
        + 'season fall in spring and early summer.';
    case 'levante':
      return monat >= 10
        ? 'For the season: The Levantine waters see few thunderstorms, but from October onward the sea '
          + 'becomes an energy source to take seriously. Thunderstorms of this season call for real '
          + 'caution here.'
        : 'For the season: The Levantine waters see few thunderstorms. Summer heat thunderstorms over the '
          + 'Taurus rarely reach the coastal waters and weaken quickly over water, where they lack the '
          + 'thermal energy to sustain themselves.';
    default:
      return null;
  }
}

export function describeGewitterneigung(
  lat: number, lon: number, monat: number, sprache: Sprache = 'de',
): string | null {
  if (sprache === 'en') return describeGewitterneigungEn(lat, lon, monat);
  const revier = gewitterRevier(lat, lon);
  if (!revier) return null;
  const hochsaison = monat >= 6 && monat <= 8;
  const nachsaison = monat >= 9 && monat <= 11;
  const vorsaison = monat >= 4 && monat <= 5;

  switch (revier) {
    case 'nordadria':
      return hochsaison
        ? 'Zur Jahreszeit: Die nördliche Adria ist in der Hochsaison das mit Abstand gewitterreichste '
          + 'Seegebiet des östlichen Mittelmeers. Kaltfronten mit Polarluft überqueren die Alpen und '
          + 'treffen hier auf sehr warme, feuchte Luft. Die Quellwolken wachsen dann 12 bis 15 km hoch.'
        : nachsaison
          ? 'Zur Jahreszeit: In der nördlichen Adria bleibt das Kaltfront-Gewitterrisiko auch jetzt das '
            + 'höchste im östlichen Mittelmeer, und ab September kommen Gewitter über See dazu.'
          : 'Zur Jahreszeit: Die nördliche Adria hat das höchste Kaltfront-Gewitterrisiko des östlichen '
            + 'Mittelmeers; an der italienischen Seite liegt der Schwerpunkt zwischen Mai und August.';
    case 'adria-mitte':
      return nachsaison
        ? 'Zur Jahreszeit: An der Ostküste der Adria liegt der Gewitterschwerpunkt in der Hoch- und der '
          + 'Nachsaison. Ab September wird zusätzlich die See zum Gewitterherd, und die Ostküste ist davon '
          + 'stärker betroffen als die italienische Seite. Die westlichen Höhenwinde führen die Zellen dorthin.'
        : hochsaison
          ? 'Zur Jahreszeit: An der Ostküste der Adria liegt der Gewitterschwerpunkt in der Hoch- und der '
            + 'Nachsaison; Wärmegewitter über dem Hinterland können bis in die Küstenreviere ziehen.'
          : null;
    case 'adria-sued':
      return nachsaison
        ? 'Zur Jahreszeit: Im Süden der Adria ist die Gewitterneigung deutlich geringer als im Norden. '
          + 'Ab September aber entstehen auch hier Gewitter über See, bevorzugt nachts und morgens.'
        : 'Zur Jahreszeit: Im Süden der Adria ist die Gewitterneigung deutlich geringer als im Norden.';
    case 'ionisch-west':
      return nachsaison
        ? 'Zur Jahreszeit: Die westgriechischen Reviere fallen im Herbst durch eine besonders hohe '
          + 'Gewitterneigung auf. Die Gewitter ziehen meist aus West bis Südwest heran und haben über See '
          + 'Zeit, Wärme und Feuchtigkeit aufzunehmen, bis sie das Archipel erreichen. Entsprechend heftig '
          + 'kommen sie an.'
        : 'Zur Jahreszeit: Im Ionischen Meer ist die Gewitterneigung in der Hochsaison gering; der '
          + 'Schwerpunkt liegt im Herbst, und dann besonders an den westgriechischen Küsten.';
    case 'ionisch-italien':
      return nachsaison
        ? 'Zur Jahreszeit: Im Ionischen Meer beginnt ab September die Zeit der Gewitter über See; die '
          + 'griechische Ostseite ist davon stärker betroffen als die kalabrisch-sizilianische.'
        : 'Zur Jahreszeit: Im Ionischen Meer herrscht in der Hochsaison eine geringe Neigung zu Blitz und '
          + 'Donner. Die Luftmasse in der Höhe ist zu trocken und zu warm für Wärmegewitter.';
    case 'aegaeis-nord':
      return vorsaison
        ? 'Zur Jahreszeit: Im Norden der Ägäis fallen die meisten Gewitter der Segelsaison in Frühjahr und '
          + 'Frühsommer; der Thermaische Golf wird verhältnismäßig häufig getroffen.'
        : 'Zur Jahreszeit: Der Norden der Ägäis ist gewitterreicher als der Rest des Seegebiets, '
          + 'besonders der Thermaische Golf.';
    case 'aegaeis':
      return monat >= seegewitterAb('aegaeis')
        ? 'Zur Jahreszeit: Die Ägäis ist arm an Gewittern; die wenigen der Segelsaison fallen überwiegend in '
          + 'den Herbst, und ab Ende September wird die See selbst zum Gewitterherd, bevorzugt nachts und '
          + 'in den Morgenstunden.'
        : 'Zur Jahreszeit: Die Ägäis ist arm an Gewittern. Solange der Meltemi weht, ist das Wetter über See '
          + 'ausgesprochen sonnig; Schauer und Gewitter entstehen fast nur in seinen Schwächephasen und dann '
          + 'in erster Linie über dem Festland.';
    case 'levante-ost':
      return 'Zur Jahreszeit: Im äußersten Osten der türkischen Riviera fallen die meisten Gewitter der '
        + 'Segelsaison in Frühjahr und Frühsommer.';
    case 'levante':
      return monat >= 10
        ? 'Zur Jahreszeit: Die levantinischen Gewässer sind arm an Gewittern, aber ab Oktober wird das Wasser '
          + 'zur ernst zu nehmenden Energiequelle. Vor Gewittern dieser Jahreszeit muss man hier auf der '
          + 'Hut sein.'
        : 'Zur Jahreszeit: Die levantinischen Gewässer sind arm an Gewittern. Sommerliche Wärmegewitter über '
          + 'dem Taurus erreichen die Küstenreviere selten und schwächen sich über Wasser rasch ab, weil '
          + 'ihnen dort die thermische Energie fehlt.';
    default:
      return null;
  }
}

export type Gewittertyp = 'front' | 'waerme' | 'see';

export function gewittertyp(
  zeit: Date, monat: number, revier: Gewitterrevier | null, syn?: Synoptik | null,
): Gewittertyp {
  if ((syn?.druckFall3h ?? 0) >= DRUCK_FALL_KALTFRONT) return 'front';
  const h = zeit.getUTCHours();
  const nachtOderMorgen = h >= 20 || h < 10;
  if (revier && monat >= seegewitterAb(revier) && monat <= 12 && nachtOderMorgen) return 'see';

  if (monat >= 4 && monat <= 8 && h >= 13 && h < 21) return 'waerme';
  return 'front';
}

function describeGewittertypEn(typ: Gewittertyp, zeit: Date, monat: number): string {
  switch (typ) {
    case 'front':
      return `Timing and circumstances match a <b>frontal thunderstorm</b>. This is the least favourable `
        + `of the three types: frontal thunderstorms line up into a squall line that cannot be dodged, and `
        + `they move fast. The heaviest gusts always come out of the western quadrant, regardless of what `
        + `wind blew before. Anyone mooring or anchoring should therefore prepare for southwest to `
        + `northwest, not for the current wind direction. `
        + `Most of the damaging storms in the eastern Mediterranean are associated with cold fronts.`;
    case 'waerme':
      return `The time of day (${uhrLt(zeit)}) and the season match a <b>heat thunderstorm</b>: these `
        + `form over land from the early afternoon onward, preferably over the mountains, and dissipate in `
        + `the course of the evening. They occur singly, surrounded by fine weather, approach comparatively `
        + `slowly, and weaken as soon as they reach the coastal waters; over the sea, gusts usually stay `
        + `within 6 to 7 Beaufort. `
        + `That does not make them harmless, but it does mean: you can see them coming and dodge them. `
        + `Judge the direction of travel and keep your distance in good time, rather than waiting it out.`;
    case 'see':
      return `Season and time of day (${uhrLt(zeit)}) match a <b>thunderstorm over the sea</b>, typical `
        + `from autumn onward: the warm water supplies the energy while cold air pushes in aloft. Such `
        + `thunderstorms favour the night and morning hours, both in frequency <i>and</i> in intensity. `
        + `They move slowly and irregularly, and their gust structure is highly inconsistent: from `
        + `shifting light winds to hurricane-force gusts, especially near a rain shaft. They weaken over `
        + `land, but strengthen along mountainous windward coasts.`
        + (monat >= 9
          ? ` This is exactly the season for it.`
          : '');
  }
}

export function describeGewittertyp(
  typ: Gewittertyp, zeit: Date, monat: number, sprache: Sprache = 'de',
): string {
  if (sprache === 'en') return describeGewittertypEn(typ, zeit, monat);
  switch (typ) {
    case 'front':
      return `Zeitpunkt und Begleitumstände passen zu einem <b>Frontgewitter</b>. Das ist der ungünstigste `
        + `der drei Typen: Frontgewitter ordnen sich zu einer Linie, der man nicht entkommt, und sie ziehen `
        + `rasch. Die heftigsten Böen fallen dabei stets aus dem westlichen Quadranten ein, gleichgültig, `
        + `welcher Wind zuvor wehte. Wer festmacht oder ankert, richtet die Vorbereitung also nach Südwest `
        + `bis Nordwest aus, nicht nach der aktuellen Windrichtung. `
        + `Die meisten schadensträchtigen Unwetter des östlichen Mittelmeers stehen im Zusammenhang mit `
        + `Kaltfronten.`;
    case 'waerme':
      return `Die Uhrzeit (${uhrLt(zeit)}) und die Jahreszeit passen zu einem <b>Wärmegewitter</b>: `
        + `Diese bilden sich ab den frühen Nachmittagsstunden über Land, bevorzugt über den Bergen, und `
        + `lösen sich im Laufe des Abends wieder auf. Sie treten vereinzelt auf, umgeben von schönem Wetter, `
        + `ziehen verhältnismäßig langsam heran und schwächen sich ab, sobald sie das Küstenrevier erreichen; `
        + `über See überschreiten die Böen meist 6 bis 7 Beaufort nicht. `
        + `Das macht sie nicht harmlos, aber es heißt: Man sieht sie kommen und kann ihnen ausweichen. `
        + `Zugrichtung abschätzen und rechtzeitig Abstand nehmen, statt abzuwarten.`;
    case 'see':
      return `Jahreszeit und Uhrzeit (${uhrLt(zeit)}) passen zu einem <b>Gewitter über See</b>, wie es `
        + `ab dem Herbst typisch ist: Das warme Wasser liefert die Energie, während in der Höhe Kaltluft `
        + `vordringt. Solche Gewitter bevorzugen die Nacht- und Morgenstunden, und zwar in Häufigkeit `
        + `<i>und</i> Heftigkeit. Sie ziehen langsam und unregelmäßig, ihre Böenstruktur ist sehr `
        + `uneinheitlich: von wechselnden schwachen Winden bis zu orkanartigen Böen, besonders im Bereich `
        + `eines Regenvorhangs. Über Land schwächen sie sich ab, an gebirgigen Luvküsten dagegen verstärken `
        + `sie sich.`
        + (monat >= 9
          ? ` Das ist genau die Jahreszeit dafür.`
          : '');
  }
}

function describeWasserhosenEn(
  lat: number, lon: number, monat: number, hatGewitterOderCape: boolean,
): string | null {
  if (!hatGewitterOderCape) return null;
  const revier = gewitterRevier(lat, lon);
  if (!revier) return null;

  const adria = revier === 'nordadria' || revier === 'adria-mitte' || revier === 'adria-sued';
  const ionisch = revier === 'ionisch-west' || revier === 'ionisch-italien';
  const levante = revier === 'levante' || revier === 'levante-ost';
  const saison = adria ? (monat >= 8 && monat <= 10)
    : ionisch ? (monat >= 9 && monat <= 11)
      : levante ? (monat >= 9 && monat <= 12) : false;
  if (!saison) return null;

  const wo = adria ? 'In the Adriatic, most waterspouts are observed from August to October'
    : ionisch ? 'Numerous waterspout sightings come from the archipelago of the western Greek islands'
      : 'Along the Turkish Riviera, waterspouts are observed comparatively often';

  return `<b>Waterspouts</b>: the situation matches: thunderstorm tendency in the season typical for it. `
    + `${wo}. They form preferentially where the wind changes direction over a short distance, so at `
    + `headlands and capes, along cold fronts and in veering winds, and they favour the <i>edge</i> of a `
    + `rain shaft rather than its centre. In the core, expect 9 to 11 Beaufort, and after `
    + `15 to 20 minutes the spectacle is usually over. `
    + `No model predicts them; they are only ever caught by observation. `
    + `So: scan not just the sky for a funnel cloud, but also the water surface for the spray ring at its `
    + `foot. Some are recognisable only by that. If one is more than three miles away, calmly judge its `
    + `direction of travel and move off at right angles to its path; if it stands threateningly close, `
    + `douse sail, put on lifejackets and oilskins, motor away from the funnel and put out a warning over `
    + `the radio.`;
}

export function describeWasserhosen(
  lat: number, lon: number, monat: number, hatGewitterOderCape: boolean, sprache: Sprache = 'de',
): string | null {
  if (sprache === 'en') return describeWasserhosenEn(lat, lon, monat, hatGewitterOderCape);
  if (!hatGewitterOderCape) return null;
  const revier = gewitterRevier(lat, lon);
  if (!revier) return null;

  const adria = revier === 'nordadria' || revier === 'adria-mitte' || revier === 'adria-sued';
  const ionisch = revier === 'ionisch-west' || revier === 'ionisch-italien';
  const levante = revier === 'levante' || revier === 'levante-ost';
  const saison = adria ? (monat >= 8 && monat <= 10)
    : ionisch ? (monat >= 9 && monat <= 11)
      : levante ? (monat >= 9 && monat <= 12) : false;
  if (!saison) return null;

  const wo = adria ? 'In der Adria werden die meisten Wasserhosen von August bis Oktober beobachtet'
    : ionisch ? 'Vom Archipel der westgriechischen Inseln stammen zahlreiche Wasserhosen-Sichtungen'
      : 'An der türkischen Riviera werden Wasserhosen verhältnismäßig häufig beobachtet';

  return `<b>Wasserhosen</b>: die Lage passt dazu: Gewitterneigung in der dafür typischen Jahreszeit. `
    + `${wo}. Sie entstehen bevorzugt dort, wo der Wind auf kurzer Distanz die Richtung ändert, also an `
    + `Landvorsprüngen und Kaps, an Kaltfronten und bei umlaufenden Winden, und zwar eher am <i>Rand</i> `
    + `des Regenvorhangs als mitten darin. Im Zentrum ist mit 9 bis 11 Beaufort zu rechnen, nach `
    + `15 bis 20 Minuten ist der Spuk in der Regel vorbei. `
    + `Kein Modell sagt sie vorher; sie werden nur durch Beobachtung erfasst. `
    + `Deshalb: nicht nur den Himmel auf Wolkenschläuche absuchen, sondern auch die Wasseroberfläche nach `
    + `dem Gischtfuß. Manche erkennt man nur daran. Ist eine mehr als drei Meilen entfernt, in Ruhe die `
    + `Zugrichtung abschätzen und sich im rechten Winkel zur Bahn entfernen; steht sie bedrohlich nah, `
    + `Segel bergen, Schwimmwesten und Ölzeug anlegen, vom Rüssel wegmotoren und eine Warnung über Funk `
    + `absetzen.`;
}

export function describeGewitterlage(
  b: Ablegezeit, monat: number, syn?: Synoptik | null, sprache: Sprache = 'de',
): string | null {
  const gewitter = b.events.filter((e) => e.type === 'gewitter').sort((x, y) => x.t - y.t)[0];
  const cape = b.events.some((e) => e.type === 'cape');
  const revier = gewitterRevier(b.midLat, b.midLon);
  const teile: string[] = [];

  if (gewitter) {
    const typ = gewittertyp(gewitter.time, monat, revier, syn);
    teile.push(describeGewittertyp(typ, gewitter.time, monat, sprache));
  }
  const hosen = describeWasserhosen(b.midLat, b.midLon, monat, !!gewitter || cape, sprache);
  if (hosen) teile.push(hosen);
  return teile.length ? teile.join(' ') : null;
}
