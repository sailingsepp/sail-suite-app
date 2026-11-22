import type { Ablegezeit, Punkt, Sprache } from '@/core/types';
import { inBox } from './localWinds';

export const MIN_WIND = 12;

export type Inselrevier = 'aegaeis' | 'adria' | 'ionisch' | 'bonifacio' | 'westmed';

export function istInselrevier(
  lat: number, lon: number,
): Inselrevier | null {
  if (inBox(lat, lon, 34.5, 41.5, 22.5, 30.0)) return 'aegaeis';
  if (inBox(lat, lon, 39.5, 46.0, 12.0, 20.5)) return 'adria';
  if (inBox(lat, lon, 35.5, 40.0, 17.5, 22.5)) return 'ionisch';

  if (inBox(lat, lon, 41.1, 41.6, 8.6, 9.7)) return 'bonifacio';

  if (inBox(lat, lon, 38.5, 44.5, 1.0, 10.5)) return 'westmed';
  return null;
}

export function describeLeeAmLiegeplatz(
  ziel: Punkt | null, maxGust: number, istMarina: boolean, sprache: Sprache = 'de',
): string | null {
  if (!ziel || maxGust < 20) return null;
  if (!istInselrevier(ziel.lat, ziel.lon)) return null;

  if (sprache === 'en') {
    if (istMarina) {
      return ' If the harbour sits under high coast, williwaws off the slopes can hit noticeably harder '
        + 'than the forecast shows, and from a shifting direction: consider lines on both sides, not just '
        + 'the expected weather side.';
    }

    return ' And the anchorage can be deceptive: in the lee of high coast, gusts fall over the ridge and '
      + 'hit the bay from a shifting direction. Behind steep cliffs the wind can reverse completely. '
      + 'That is exactly what breaks anchors out, because the boat swings and the load suddenly comes '
      + 'from the other side. So lay more chain than usual for this wind, set an anchor alarm and check '
      + 'every one to two hours; if the bow lies beam-on to the wind, the anchor is already dragging.';
  }

  if (istMarina) {
    return ' Liegt der Hafen unter hoher Küste, können Fallböen von den Hängen deutlich kräftiger '
      + 'einfallen als die Vorhersage zeigt, und das aus wechselnder Richtung: Leinen auf beiden '
      + 'Seiten bedenken, nicht nur auf der erwarteten Wetterseite.';
  }

  return ' Und der Platz kann trügerisch sein: Im Lee hoher Küste fallen Böen über den Kamm herunter '
    + 'und treffen die Bucht aus wechselnder Richtung. Hinter steilen Klippen dreht der Wind '
    + 'unter Umständen ganz um. Genau das bricht Anker aus, weil das Schiff schwoijt und der Zug '
    + 'plötzlich von der anderen Seite kommt. Deshalb hier eher mehr Kette als sonst bei diesem Wind, '
    + 'dazu Ankeralarm setzen und alle ein bis zwei Stunden nachsehen; steht der Bug quer zum Wind, '
    + 'slippt der Anker schon.';
}

export function describeGelaendeeffekte(b: Ablegezeit, sprache: Sprache = 'de'): string | null {
  const v = b.maxWind, lat = b.midLat, lon = b.midLon;
  if (v < MIN_WIND) return null;
  const revier = istInselrevier(lat, lon);
  if (!revier) return null;

  const kraeftig = v >= 20;

  const leeReichweite = (hoeheM: number) => Math.round((hoeheM * 30) / 1852);

  if (sprache === 'en') return describeGelaendeeffekteEn(b, revier, kraeftig, leeReichweite);

  const UMKEHR = 'Im Lee bleibt es nicht bei „böig": Hinter einem hohen Inselberg bilden sich Wirbel, '
    + 'in denen die Strömung am Wasser gegen den Grundwind läuft. Wer um eine Inselspitze ins Lee biegt '
    + 'und in die Bucht dahinter einläuft, kann dort strammen Wind aus der Gegenrichtung vorfinden. Damit ist zu rechnen. ';

  const LEITPLANKE = 'Dazu ein Effekt, der ohne Enge und ohne Lee auskommt: Läuft der Wind <b>parallel '
    + 'zu einem küstennahen Bergzug</b>, wird er an dessen Flanke geführt und dabei beschleunigt, der '
    + 'Leitplankeneffekt. Er trifft also gerade die Kurse, die man wählt, um an der Küste entlangzufahren, '
    + 'und ist im Flächenmodell so wenig enthalten wie Düse und Fallbö. ';

  if (revier === 'aegaeis') {
    return '<b>Fallböen im Inselschatten.</b> Im Lee der hohen Ägäisinseln fällt der Wind über den Kamm '
      + 'und schlägt als Fallbö nach unten durch, ausgerechnet dort, wo man Deckung erwartet. '
      + 'Berüchtigt sind Tinos (in wenigen Jahren über 30 Seenotfälle), Andros, Kea, Euböa, Amorgos und Ios. '
      + `Die Störung reicht nach Faustregel etwa das 30-Fache der Inselhöhe ins Lee, bei 500 m Gipfel also rund ${leeReichweite(500)} sm. `
      + 'Berüchtigt sind außerdem die Fallböen im Archipel zwischen Naxos und Amorgos (die Steilküste '
      + 'reicht dort stellenweise über 800 m) sowie hinter Folegandros, Sifnos, Serifos und den steilen '
      + 'Kliffs des Dodekanes. '
      + 'Dazu die Düsen zwischen den Inseln und an den Kaps: 50 bis 100 % mehr Wind, spürbar 1 bis 2 sm vor '
      + `und 2 bis 5 sm hinter der Enge. ${kraeftig ? 'Bei diesem Grundwind heißt das Böen jenseits der 30 kn im Düsenbereich. ' : ''}`
      + UMKEHR
      + LEITPLANKE
      + 'In der Ägäis trifft das die Nordseite von Amorgos, die Westseite von Ikaria, die Nordwestseite '
      + 'von Karpathos und die Nordseite von Kythnos. '
      + 'Nichts davon steht im Flächenmodell dieser Vorhersage: unter Land und in Engen also früher reffen, '
      + 'als die Zahlen oben nahelegen.';
  }

  if (revier === 'adria') {
    const bora = b.gustFactor >= 1.45 && ((b.avgWindDir + 360) % 360 >= 20) && ((b.avgWindDir + 360) % 360 <= 90);
    return '<b>Fallböen und Düsenwirkung zwischen den Inseln.</b> Die Kanäle der Adria liegen zwischen hohen '
      + 'Inseln und dem Küstengebirge und wirken als Düse: in der Enge 50 bis 100 % mehr Wind, spürbar 1 bis 2 sm '
      + 'davor und 2 bis 5 sm dahinter. Im Lee der Inselkämme kommen Fallböen dazu, die dort einschlagen, wo man '
      + `Deckung vermutet. Die Störung reicht rund das 30-Fache der Kammhöhe ins Lee, bei 500 m also gut ${leeReichweite(500)} sm. `
      + UMKEHR

      + (nahKomiza(b)
        ? 'Ein bekanntes Beispiel ist Komiža auf Vis: der Ort liegt am Fuß des Hum (587 m), das Hafenhandbuch '
          + 'warnt dort ausdrücklich vor starken Fallwinden von den Bergen. '
        : '')
      + (bora
        ? 'Bei der aktuellen Wetterlage ist das besonders ernst zu nehmen: Bora-Böen übersteigen den Mittelwind '
          + 'bei Weitem, im Velebitkanal wurden schon 90 kn gemessen. '

          + 'Die berüchtigten Bora-Düsen von Nord nach Süd: Südteil des Golfs von Triest, Golf von Rijeka '
          + 'mit dem Kvarner, die Küste von Senj mit der Meerenge zwischen Krk und Prvić, der '
          + 'Velebitski-Kanal zwischen der Ostküste von Rab und Jablanac, die Strecke von Šibenik bis '
          + 'Kap Ploča, die Vrulje-Bucht zwischen Omiš und Makarska und der Nordwestausgang des '

          + 'Mljetski-Kanals. Der Velebitkanal ist bei Bora zu meiden; '
          + 'Schutz bietet eher die Leeseite der äußeren Inseln als die Festlandsküste. '
        : '')
      + 'Das Flächenmodell dieser Vorhersage löst nichts davon auf: unter Land und in den Kanälen kann es '
      + 'deutlich kräftiger wehen als angegeben.';
  }

  if (revier === 'ionisch') {

    return '<b>Fallböen im Inselschatten.</b> Im Lee der hohen Ionischen Inseln (Kefalonia reicht mit dem Ainos '
      + 'auf 1628 m, Lefkada auf 1158 m) fällt der Wind über den Kamm und schlägt als Fallbö nach unten durch. '
      + `Die Störung reicht nach Faustregel etwa das 30-Fache der Kammhöhe ins Lee, bei 1000 m also rund ${leeReichweite(1000)} sm. `
      + 'Bekannt dafür ist das Fahrwasser zwischen Kalamos und Kastos. '
      + 'In den Engen zwischen den Inseln kommen 50 bis 100 % mehr Wind dazu, im Kanal von Korfu und '
      + 'zwischen Lefkas, Ithaka und Kefalonia. '
      + UMKEHR
      + LEITPLANKE
      + 'Im Ionischen Meer ist die Südwestküste von Lefkas dafür bekannt. Bei einer Schirokko-Lage darf '
      + 'man auf all diese topografischen Effekte rund 2 Beaufort aufschlagen: Die thermische Struktur '
      + 'der Schirokko-Atmosphäre lässt sie besonders stark werden. '
      + 'Das Flächenmodell dieser Vorhersage zeigt davon nichts.';
  }

  if (revier === 'bonifacio') {
    return '<b>Düse Straße von Bonifacio.</b> Die Enge zwischen Korsika und Sardinien gilt als eine der '
      + 'ausgeprägtesten Winddüsen des Mittelmeers: In der Verengung ist mit einer Verdopplung der '
      + 'Windgeschwindigkeit zu rechnen, spürbar 1 bis 2 sm davor und 2 bis 5 sm dahinter. '
      + `Dazu Fallböen von den Bergen beider Inseln: die Störung reicht rund das 30-Fache der Kammhöhe `
      + `ins Lee, bei 800 m also gut ${leeReichweite(800)} sm. `
      + UMKEHR
      + 'Das Flächenmodell dieser Vorhersage löst die Enge nicht auf; die Zahlen oben sind hier eine '
      + 'Untergrenze, keine Vorhersage.';
  }

  if (revier === 'westmed') {

    return '<b>Fallböen im Inselschatten.</b> Korsika (Monte Cinto, 2706 m), Sardinien (Punta La Marmora, '
      + '1834 m) und Mallorca (Puig Major, 1445 m) sind Gebirge im Meer. Im Lee fällt der Wind über den '
      + 'Kamm und schlägt als Fallbö nach unten durch, dort wo man Deckung erwartet. '
      + `Bei 1000 m Kammhöhe reicht die Störung nach Faustregel rund ${leeReichweite(1000)} sm ins Lee, `
      + `bei den korsischen Gipfeln entsprechend weiter. In den Engen zwischen den Inseln und an den Kaps `
      + `kommen 50 bis 100 % mehr Wind dazu. `
      + UMKEHR
      + 'Das Flächenmodell dieser Vorhersage zeigt davon nichts.';
  }

  return null;
}

function describeGelaendeeffekteEn(
  b: Ablegezeit, revier: Inselrevier, kraeftig: boolean, leeReichweite: (hoeheM: number) => number,
): string | null {

  const UMKEHR = 'In the lee it does not stop at "gusty": behind a high island peak, eddies form in which '
    + 'the surface flow runs against the prevailing wind. Round a headland into the lee and enter the bay '
    + 'behind it, and you may find a stiff wind from the opposite direction waiting there. Expect it. ';

  const LEITPLANKE = 'Add an effect that needs neither a strait nor a lee: when the wind runs <b>parallel '
    + 'to a coastal mountain range</b>, it gets channelled and accelerated along its flank, the corner-jet '
    + 'effect. It catches exactly the courses chosen to run along the coast, and the area model captures '
    + 'it as little as funnelling or williwaws. ';

  if (revier === 'aegaeis') {
    return '<b>Williwaws in the lee of the islands.</b> In the lee of the high Aegean islands the wind '
      + 'falls over the ridge and slams down as a williwaw. Exactly where you would expect shelter. '
      + 'Notorious are Tinos (over 30 maritime distress calls in a few years), Andros, Kea, Euboea, '
      + 'Amorgos and Ios. '
      + `As a rule of thumb the disturbance reaches roughly 30 times the island height downwind, so a `
      + `500 m summit gives about ${leeReichweite(500)} NM. `
      + 'Also notorious are the williwaws in the archipelago between Naxos and Amorgos (the steep coast '
      + 'there rises over 800 m in places) as well as behind Folegandros, Sifnos, Serifos and the steep '
      + 'cliffs of the Dodecanese. '
      + 'Add the funnelling between the islands and off the headlands: 50 to 100 % more wind, felt 1 to '
      + `2 NM before and 2 to 5 NM past the strait. ${kraeftig ? 'At this base wind that means gusts beyond 30 kn in the funnelling zone. ' : ''}`
      + UMKEHR
      + LEITPLANKE
      + 'In the Aegean this hits the north side of Amorgos, the west side of Ikaria, the north-west side '
      + 'of Karpathos and the north side of Kythnos. '
      + "None of this shows up in this forecast's area model. Reef earlier under land and in straits "
      + 'than the figures above suggest.';
  }

  if (revier === 'adria') {
    const bora = b.gustFactor >= 1.45 && ((b.avgWindDir + 360) % 360 >= 20) && ((b.avgWindDir + 360) % 360 <= 90);
    return '<b>Williwaws and funnelling between the islands.</b> The channels of the Adriatic run between '
      + 'high islands and the coastal mountains and act as a funnel: 50 to 100 % more wind in the strait, '
      + 'felt 1 to 2 NM before and 2 to 5 NM after. In the lee of the island ridges, williwaws add to this, '
      + 'striking exactly where shelter is expected. The disturbance reaches roughly 30 times the ridge '
      + `height downwind, so 500 m gives a good ${leeReichweite(500)} NM. `
      + UMKEHR

      + (nahKomiza(b)
        ? 'A well-known example is Komiža on Vis: the town sits at the foot of the Hum (587 m), and the '
          + 'harbour guide explicitly warns of strong katabatic gusts off the mountains there. '
        : '')
      + (bora
        ? 'Given the current weather pattern this is especially serious: Bora gusts far exceed the mean '
          + 'wind, and 90 kn has been measured in the Velebit Channel. '

          + 'The notorious Bora funnels from north to south: the southern Gulf of Trieste, the Gulf of '
          + 'Rijeka with the Kvarner, the coast off Senj with the strait between Krk and Prvić, the '
          + 'Velebit Channel between the east coast of Rab and Jablanac, the stretch from Šibenik to Cape '
          + 'Ploča, Vrulje Bay between Omiš and Makarska, and the north-west exit of the Mljet Channel. '
          + 'Avoid the '
          + 'Velebit Channel in a Bora; the lee side of the outer islands offers better shelter than the '
          + 'mainland coast. '
        : '')
      + "This forecast's area model resolves none of this: expect noticeably stronger wind under land "
      + 'and in the channels than shown.';
  }

  if (revier === 'ionisch') {

    return '<b>Williwaws in the lee of the islands.</b> In the lee of the high Ionian islands (Kefalonia '
      + 'rises to 1628 m at Mount Ainos, Lefkada to 1158 m) the wind falls over the ridge and slams down '
      + 'as a williwaw. '
      + `As a rule of thumb the disturbance reaches roughly 30 times the ridge height downwind, so 1000 m `
      + `gives about ${leeReichweite(1000)} NM. `
      + 'The passage between Kalamos and Kastos is known for this. '
      + 'In the straits between the islands add 50 to 100 % more wind, in the Corfu Channel and between '
      + 'Lefkas, Ithaca and Kefalonia. '
      + UMKEHR
      + LEITPLANKE
      + 'In the Ionian Sea the south-west coast of Lefkas is known for it. In a Sirocco pattern you can '
      + 'add roughly 2 Beaufort to all these topographic effects: the thermal structure of the Sirocco '
      + 'atmosphere makes them especially strong. '
      + "This forecast's area model shows none of it.";
  }

  if (revier === 'bonifacio') {
    return '<b>Funnelling in the Strait of Bonifacio.</b> The strait between Corsica and Sardinia counts '
      + 'as one of the most pronounced wind funnels in the Mediterranean: expect the wind speed to roughly '
      + 'double in the narrows, felt 1 to 2 NM before and 2 to 5 NM after. '
      + `Add williwaws off the mountains of both islands: the disturbance reaches roughly 30 times the `
      + `ridge height downwind, so 800 m gives a good ${leeReichweite(800)} NM. `
      + UMKEHR
      + "This forecast's area model does not resolve the strait; the figures above are a lower bound "
      + 'here, not a forecast.';
  }

  if (revier === 'westmed') {

    return '<b>Williwaws in the lee of the islands.</b> Corsica (Monte Cinto, 2706 m), Sardinia (Punta La '
      + 'Marmora, 1834 m) and Mallorca (Puig Major, 1445 m) are mountains in the sea. In their lee the '
      + 'wind falls over the ridge and slams down as a williwaw, exactly where shelter is expected. '
      + `At a 1000 m ridge height the rule-of-thumb disturbance reaches about ${leeReichweite(1000)} NM `
      + `downwind, correspondingly further off the Corsican peaks. In the straits between the islands and `
      + `off the headlands add 50 to 100 % more wind. `
      + UMKEHR
      + "This forecast's area model shows none of it.";
  }

  return null;
}

function nahKomiza(b: Ablegezeit): boolean {
  const dLat = (b.midLat - 43.045) * 60;
  const dLon = (b.midLon - 16.09) * 60 * Math.cos((43.045 * Math.PI) / 180);
  return Math.hypot(dLat, dLon) <= 15;
}
