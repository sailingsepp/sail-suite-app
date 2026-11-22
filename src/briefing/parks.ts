import type { Punkt, Sprache } from '@/core/types';
import type { VerlaufPunkt } from './profile';

type Parkart = 'nationalpark' | 'naturpark' | 'reservat' | 'bergpark';

interface Schutzgebiet {
  name: string;
  art: Parkart;
  la1: number; la2: number; lo1: number; lo2: number;

  ankern: string;

  ankernEn: string;

  transit?: string;

  transitEn?: string;

  karte?: boolean;

  gemeinsamesTicket?: boolean;
}

const ART_WORT: Record<Parkart, string> = {
  nationalpark: 'Nationalpark',
  naturpark: 'Naturpark',
  reservat: 'besonderes Meeresreservat',
  bergpark: 'Schutzgebiet an Land',
};

const ART_WORT_EN: Record<Parkart, string> = {
  nationalpark: 'national park',
  naturpark: 'nature park',
  reservat: 'special marine reserve',
  bergpark: 'protected area on land',
};

const MUENDUNG =
  'Seit 25. April 2026 gilt von der Linie zwischen dem Hafenfeuer Martinska und der Bucht Crnica bis zum Hafen Skradin: '
  + '<b>höchstens 8 kn</b>, Boote weichen Schiffen und Yachten aus und halten sich rechts, '
  + 'überholt wird nur links und ohne schädlichen Wellenschlag. <b class="warn-text">Ankern ist '
  + 'im Kanal Sv. Josip und im Skradinski kanal von Rt Oštrica bis Skradin verboten</b>; '
  + 'geankert, gebadet und getaucht wird nur in den Buchten bis zu deren äußerem Rand '
  + '(NN 40/2026).';
const MUENDUNG_EN =
  'Since 25 April 2026, from the line between the Martinska harbour light and Crnica cove up to the port of Skradin: <b>8 kn '
  + 'maximum</b>, boats give way to ships and yachts and keep to the right, overtaking only on the '
  + 'left and without harmful wash. <b class="warn-text">Anchoring is prohibited in the Sv. Josip '
  + 'channel and in the Skradinski kanal from Rt Oštrica to Skradin</b>; anchoring, swimming and '
  + 'diving only in the coves, up to their outer edge (NN 40/2026).';

const GEBIETE: Schutzgebiet[] = [
  {
    name: 'Brijuni',
    art: 'nationalpark',
    la1: 44.86, la2: 44.98, lo1: 13.70, lo2: 13.85,
    karte: true,
    ankern:
      '14 Inseln auf 33,95 km², davon 26,5 km² Meer; von allen kroatischen Meeresparks der '
      + 'strengste. Das Fahren im Parkgewässer ist '
      + '<b>ausschließlich zum Zweck des Anlaufens von Veliki Brijun</b> erlaubt; gelegen wird im '
      + 'dortigen Hafen oder an einer Boje beziehungsweise in der ausgewiesenen Ankerzone davor. '
      + '<b class="warn-text">Sonst nirgends im Park ankern</b>: einzige Ausnahme ist die Insel '
      + 'Kozada. Nach dem Festmachen meldet man sich an der Hotelrezeption an; ohne Crewliste ist '
      + 'ein Formular mit Crew und Gästen auszufüllen. Die Karte gilt vom Einlaufen bis 1400 LT '
      + 'des Folgetags. Abwasser darf im Hafen und im ganzen Parkgewässer nicht abgegeben werden. '
      + 'Hafen und Parkeintritt kassiert die Hafenbehörde Pula (UKW-Kanal 9), Preise 2026: '
      + 'Liegeplatz für 6 bis 19,99 m 5 € je Meter und Tag mit Strom und Wasser, Mehrrumpfboote '
      + 'das Doppelte; dazu der Parkeintritt, für 7 bis 10,99 m mit vier Personenkarten 80 €, vom '
      + '1. Juni bis 31. August 120 €, für 11 bis 17,99 m mit sechs Personenkarten 120 € bzw. 180 €, '
      + 'ab dem zweiten Tag 20 % weniger. Wer hier eine spontane Ankernacht einplant, plant falsch.',
    ankernEn:
      '14 islands across 33.95 km², 26.5 km² of it sea; the strictest of all Croatian marine '
      + 'parks. Sailing within the park waters is permitted '
      + '<b>only for the purpose of calling at Veliki Brijun</b>; berth in the harbour there or on a '
      + 'buoy, or in the designated anchoring zone in front of it. <b class="warn-text">Anchor nowhere '
      + 'else in the park</b>: the sole exception is the island of Kozada. After making fast, check '
      + 'in at the hotel reception; without a crew list, a form with crew and guests must be filled '
      + 'in. The ticket is valid from entry until 1400 LT the following day. Sewage may not be '
      + 'discharged in the harbour or anywhere in the park waters. The Pula port '
      + 'authority collects harbour dues and the park entry (VHF channel 9), prices for 2026: berth '
      + 'for 6 to 19.99 m €5 per metre and day including power and water, multihulls double; plus '
      + 'the park entry, for 7 to 10.99 m with four personal tickets €80, from 1 June to 31 August '
      + '€120, for 11 to 17.99 m with six personal tickets €120 or €180, 20 % less from the second '
      + 'day. Anyone planning a spontaneous night at anchor here '
      + 'is planning wrong.',
    transit:
      'Achtung: Das Fahren im Parkgewässer ist nur erlaubt, um Veliki Brijun anzulaufen. Eine '
      + 'Durchfahrt „im Vorbeigehen" ist nicht vorgesehen. Außen herum ist der richtige Weg.',
    transitEn:
      'Warning: sailing within the park waters is permitted only to call at Veliki Brijun. Passing '
      + 'through "on the way" is not provided for. Going around the outside is the right route.',
  },
  {
    name: 'Kornati',
    art: 'nationalpark',
    la1: 43.66, la2: 43.87, lo1: 15.12, lo2: 15.45,
    karte: true, gemeinsamesTicket: true,
    ankern:
      'Nationalpark seit 1980: 89 Inseln, Inselchen und Riffe auf rund 224 km², davon 173 km² '
      + 'Meer; die Inselketten Sit und Žut gehören nicht dazu. Fahren ist überall erlaubt außer in '
      + 'den Zonen strengen Schutzes. <b>Ankern und Übernachten nur in den Buchten</b> Stiniva, '
      + 'Statival, Lupeška, Tomasovac/Suha punta, Šipnate, Lučica, Kravjačica, Strižnja, Vruje, '
      + 'Gujak, Opat, Smokica, Ravni Žakan, Lavsa, Piškera/Vela Panitula, Anica auf Levrnaka, '
      + 'Podbižanj und Koromašna. '
      + 'Der Park hält an 16 Stellen rund 164 Bojen vor, unter anderem bei Lojena, Levrnaka und '
      + 'Piškera; sie sind für Schiffe bis 16 m ausgelegt, an einigen Plätzen bis 26 m. '
      + '<b>Mit gültiger Eintrittskarte kostet die Boje nichts extra</b>. Sie ist damit fast '
      + 'immer die bessere Wahl als der Anker. Die Bojen hängen am „Earthanchor": Der Anker '
      + 'steckt im Fels unter dem Sediment, die Kette berührt den Grund nicht, das schont die '
      + 'Seegraswiesen. Bootskarte 2026, Tageskarte vor dem Besuch außerhalb des Parks gekauft: '
      + '7 bis 10,99 m 30 €, von Juni bis September 65 €; 11 bis 17,99 m 50 € bzw. 95 €. <b>Im Park '
      + 'gekauft kostet sie das Doppelte</b> (65/130 € bzw. 95/190 €). Dreitageskarte außerhalb '
      + 'gekauft 65/130 € bzw. 95/190 €. Angelerlaubnis 20 € für einen Tag, 40 € für drei. '
      + '<b class="warn-text">Harpunen und Schusswaffen dürfen nicht in den Park</b>; Gerätetauchen '
      + 'nur in organisierten Gruppen mit Genehmigung des Parks.',
    ankernEn:
      'National park since 1980: 89 islands, islets and reefs across roughly 224 km², 173 km² of it '
      + 'sea; the Sit and Žut island chains are not part of it. Navigation is permitted everywhere '
      + 'except in the zones of strict protection. <b>Anchoring and overnight stays only in the '
      + 'coves</b> Stiniva, Statival, Lupeška, Tomasovac/Suha punta, Šipnate, Lučica, Kravjačica, '
      + 'Strižnja, Vruje, Gujak, Opat, Smokica, Ravni Žakan, Lavsa, Piškera/Vela Panitula, Anica on '
      + 'Levrnaka, Podbižanj and Koromašna. '
      + 'The park maintains around 164 buoys at 16 sites, including at Lojena, Levrnaka and Piškera; '
      + 'they are rated for boats up to 16 m, up to 26 m at some spots. <b>With a valid entry ticket '
      + 'the buoy costs nothing extra</b>, making it almost always the better choice over the '
      + 'anchor. The buoys hang from an "earth anchor": the anchor is set into the rock beneath the '
      + 'sediment, the chain never touches the bottom, sparing the seagrass meadows. Vessel ticket '
      + '2026, day ticket bought before the visit outside the park: 7 to 10.99 m €30, June to '
      + 'September €65; 11 to 17.99 m €50 or €95. <b>Bought in the park it costs double</b> (€65/130 '
      + 'or €95/190). Three-day ticket bought outside €65/130 or €95/190. Fishing permit €20 for one '
      + 'day, €40 for three. <b class="warn-text">Spearguns and firearms may not be brought into the '
      + 'park</b>; scuba diving only in organised groups with a park permit.',
  },
  {
    name: 'Telašćica',
    art: 'naturpark',
    la1: 43.87, la2: 43.95, lo1: 15.12, lo2: 15.26,
    karte: true, gemeinsamesTicket: true,
    ankern:
      'Liegt direkt nordwestlich der Kornaten und wird oft mit ihnen verwechselt. Es ist ein '
      + 'eigener Park mit eigener Karte. Geankert werden darf in Magrovica, Pod Dugo polje, '
      + 'Pasjak, Jaz, Kruševica, Mir, Tripuljak, Buhaj und Pod Katina. Bojen liegen in Mir, '
      + 'Tripuljak, Kruševica und Kučinmul; <b>für die Boje wird nichts gesondert verlangt</b>. '
      + 'Tempolimit: ab der Linie zwischen Rt Pod Poljica und Rt Gubac in die Telašćica hinein '
      + 'höchstens 10 kn, in den belegten Buchten höchstens 5 kn. Verboten sind Müll über Bord, '
      + 'das Sammeln von Muscheln und anderen Meeresorganismen sowie das Speerfischen. Naturpark seit '
      + '1988: der Südosten von Dugi Otok mit Meeresstreifen und Inselchen, 70,5 km², davon 44,55 km² '
      + 'Meer. Bootskarte laut Preisliste des Parks (zuletzt mit 2025 überschrieben), Tageskarte bis '
      + '1200 LT des Folgetags, online spätestens am Vortag gekauft: 7 bis 10,99 m 25 €, von Juni bis '
      + 'September 60 €; 11 bis 17,99 m 40 € bzw. 90 €. Im Park gekauft 35/70 € bzw. 50/100 €.',
    ankernEn:
      'Lies directly north-west of the Kornati and is often confused with them. It is a separate '
      + 'park with its own ticket. Anchoring is permitted at Magrovica, Pod Dugo polje, Pasjak, Jaz, '
      + 'Kruševica, Mir, Tripuljak, Buhaj and Pod Katina. Buoys lie at Mir, Tripuljak, Kruševica and '
      + 'Kučinmul; <b>no separate charge applies for the buoy</b>. Speed limit: from the line between '
      + 'Rt Pod Poljica and Rt Gubac into Telašćica, at most 10 kn, at most 5 kn in the occupied bays. '
      + 'Prohibited are throwing waste overboard, collecting shellfish and other marine life, and '
      + 'spearfishing. Nature park since 1988: the south-east of Dugi Otok with a strip of sea and '
      + 'islets, 70.5 km², 44.55 km² of it sea. Vessel ticket according to the park\'s price list '
      + '(last headed 2025), day ticket valid until 1200 LT the next day, bought online by the day '
      + 'before at the latest: 7 to 10.99 m €25, June to September €60; 11 to 17.99 m €40 or €90. '
      + 'Bought in the park €35/70 or €50/100.',
  },
  {

    name: 'Krka',
    art: 'nationalpark',
    la1: 43.745, la2: 43.84, lo1: 15.83, lo2: 15.96,
    ankern:
      'Von der Einfahrt in den Kanal Sv. Ante sind es rund 12 sm bis Skradin: durch den Kanal und '
      + 'die Bucht von Šibenik, unter der Krka-Brücke durch, über den Prukljan-See und den '
      + 'Skradinski kanal. <b>In Skradin endet die eigene Schifffahrt</b>. Gelegen wird in der '
      + 'ACI-Marina Skradin; weiter flussauf zum Skradinski buk fahren nur die Parkboote. '
      + MUENDUNG
      + ' Eintritt 2026 für Erwachsene, alle Landbereiche samt Parkboot von Skradin zum '
      + 'Skradinski buk und zurück (1. April bis 31. Oktober): Juni bis September 40 €, ab 1500 LT 30 €; April, Mai '
      + 'und Oktober 20 €; sonst 7 €. Kinder von 7 bis 18 Jahren 15, 12 bzw. 4 €, unter 7 Jahren frei. '
      + 'Der Bootsausflug vom Skradinski buk zum Kloster Visovac kostet 15 € (2 h). Baden unmittelbar '
      + 'unterhalb des Wasserfalls ist seit dem 1. Januar 2021 nicht mehr erlaubt. Aktuelle Preise und '
      + 'Karten: npkrka.hr.',
    ankernEn:
      'From the entrance to the Sv. Ante Channel it is roughly 12 NM to Skradin: through the channel '
      + 'and the bay of Šibenik, under the Krka bridge, across Lake Prukljan and along the Skradinski '
      + 'kanal. <b>Private boating ends at Skradin</b>. Berth in ACI Marina Skradin; further upriver to '
      + 'Skradinski buk, travel is by the park\'s own boats only. '
      + MUENDUNG_EN
      + ' Entry in 2026 for adults, all land sites including the park boat from Skradin to '
      + 'Skradinski buk and back (1 April to 31 October): June to September €40, from 1500 LT €30; April, May and October '
      + '€20; otherwise €7. Children aged 7 to 18 €15, €12 or €4, under 7 free. The boat trip from '
      + 'Skradinski buk to Visovac monastery costs €15 (2 h). Swimming immediately below the waterfall '
      + 'has not been permitted since 1 January 2021. Current prices and tickets: npkrka.hr.',
    transit: MUENDUNG,
    transitEn: MUENDUNG_EN,
  },
  {
    name: 'Mljet',
    art: 'nationalpark',
    la1: 42.74, la2: 42.82, lo1: 17.29, lo2: 17.45,
    karte: true, gemeinsamesTicket: true,
    ankern:
      'Geankert wird <b>nur in Polače und Pomena</b>: dort allerdings großzügig, in Polače über '
      + 'die ganze Bucht von Lunđina bis Rt Lenga und im Gewässer davor, in Pomena in der Bucht '
      + 'Lokva und westwärts bis Pomeštak. <b class="warn-text">Anderswo im Park ist Ankern '
      + 'untersagt</b>, ausdrücklich in Križice, Zaklopita und Bijela, rund um die Inselchen '
      + 'Pomeštak, Glavat und Borovac sowie in Male und Velike Blace und Gonoturska; die Zone II.c '
      + 'ist ganz gesperrt. Innerhalb von 150 m vom Ufer und in den Häfen gilt 5 kn. '
      + 'Ins Veliko jezero kommt man nur mit '
      + 'Genehmigung, ins Malo jezero überhaupt nur rudernd. Verboten sind außerdem '
      + 'Unterwasser-Ambientebeleuchtung, jede Abgabe von Abwasser und Öl sowie Angeln ohne '
      + 'schriftliche Erlaubnis. Nationalpark seit 1960: der Westteil der Insel mit beiden Seen, '
      + 'der Bucht Soline und einem 500 m breiten Meeresstreifen, 53,75 km². Bootskarte 2026, '
      + 'Tageskarte bis 1200 LT des Folgetags: 7 bis 10,99 m im Park 35 €, von Juni bis September '
      + '70 €, im Webshop 25 € bzw. 60 €; 11 bis 17,99 m im Park 50 € bzw. 100 €, im Webshop 40 € '
      + 'bzw. 90 €. <b>Die Bootskarte gilt nicht für die Landbereiche und die Seen</b>, dafür '
      + 'braucht jede Person die Besucherkarte.',
    ankernEn:
      'Anchoring is permitted <b>only in Polače and Pomena</b>: generously so there, in Polače '
      + 'across the whole bay from Lunđina to Rt Lenga and in the water in front of it, in Pomena in '
      + 'Lokva bay and westward to Pomeštak. <b class="warn-text">Anchoring is prohibited everywhere '
      + 'else in the park</b>, explicitly in Križice, Zaklopita and Bijela, around the islets of '
      + 'Pomeštak, Glavat and Borovac, and in Male and Velike Blace and Gonoturska; zone II.c is '
      + 'closed entirely. Within 150 m of shore and in the harbours, 5 kn applies. Veliko jezero (the '
      + 'Great Lake) may only be entered with a permit, Malo jezero (the Small Lake) only under oars '
      + 'at all. Also prohibited are underwater ambient lighting, any discharge of sewage or oil, and '
      + 'fishing without written permission. National park since 1960: the western part of the '
      + 'island with both lakes, Soline bay and a 500 m wide strip of sea, 53.75 km². Vessel ticket '
      + '2026, day ticket valid until 1200 LT the next day: 7 to 10.99 m in the park €35, June to '
      + 'September €70, in the web shop €25 or €60; 11 to 17.99 m in the park €50 or €100, in the '
      + 'web shop €40 or €90. <b>The vessel ticket does not cover the land sites and the lakes</b>; '
      + 'for those everyone needs a visitor ticket.',
  },
  {

    name: 'Lastovsko otočje',
    art: 'naturpark',
    la1: 42.68, la2: 42.85, lo1: 16.45, lo2: 17.17,
    karte: true, gemeinsamesTicket: true,
    ankern:
      'Der Park reicht bis zu den Leuchtfeuern von Sušac, Tajan, Glavat und Struga: 196 km², davon '
      + '143 km² Meer, 46 Inseln, Inselchen und Riffe, Sušac im Westen eingeschlossen. Die Karte '
      + 'kassieren die Ranger auf dem Wasser; laut Preisliste des Parks kostet eine Tageskarte (gültig '
      + 'bis 1200 LT des Folgetags) für 7 bis 10,99 m 15 €, von Juni bis September 28 €, für 11 bis '
      + '17,99 m 19 € bzw. 36 €; dazu gibt es Dreitageskarten und im Webshop Fünftageskarten. '
      + 'Festmachen und Ankern sind <b>außerhalb der ausgewiesenen Plätze untersagt</b>. Die '
      + 'Bojenfelder des Parks: Saplun (12 Bojen), Skrivena Luka (15), beim Škoj von Zaklopatica (15) '
      + 'und Vejo Lago (15), für Yachten bis 20 m, in Skrivena Luka und Vejo Lago je zwei bis 30 m. Eine '
      + 'Nacht kostet bis 10 m 20 €, bis 20 m 40 €, bis 30 m 60 €, gültig bis 1200 LT des Folgetags; '
      + 'festgemacht wird mit Einweisung der Ranger (+385 20 801 252), und eine Crew bleibt an Bord. '
      + '<b class="warn-text">Bei vorhergesagten Böen über 20 m/s (rund 39 kn) sind die Bojen zu '
      + 'räumen.</b> <b class="warn-text">Die Parkkarte ist keine Liegegebühr</b>: Rivagebühren im Ort '
      + 'und die Konzessionsbojen etwa in Zaklopatica oder Pasadur werden getrennt kassiert, meist bar. '
      + 'Angeln nur mit Erlaubnis des Parks und bis 5 kg am Tag; Speerfischen nur tagsüber, ab 16 '
      + 'Jahren, mit Signalboje und nur bei Kopište, Bijelac und den Riffen Mrkjenta; Gerätetauchen '
      + 'braucht eine Genehmigung des Ministeriums.',
    ankernEn:
      'The park extends to the lights of Sušac, Tajan, Glavat and Struga: 196 km², 143 km² of it sea, '
      + '46 islands, islets and reefs, Sušac in the west included. Rangers collect the ticket on the '
      + 'water; according to the park\'s price list a day ticket (valid until 1200 LT the next day) costs '
      + '€15 for 7 to 10.99 m, €28 from June to September, and €19 or €36 for 11 to 17.99 m; there are '
      + 'also three-day tickets and, in the web shop, five-day tickets. Mooring and anchoring are '
      + '<b>prohibited outside the designated places</b>. The park\'s buoy fields: Saplun (12 buoys), '
      + 'Skrivena Luka (15), off the islet of Zaklopatica (15) and Vejo Lago (15), for yachts up to 20 m, '
      + 'with two each up to 30 m in Skrivena Luka and Vejo Lago. A night costs €20 up to 10 m, €40 up '
      + 'to 20 m, €60 up to 30 m, valid until 1200 LT the next day; mooring is done with a ranger\'s '
      + 'assistance (+385 20 801 252), and a crew stays aboard. <b class="warn-text">With forecast '
      + 'gusts above 20 m/s (about 39 kn), the buoys must be vacated.</b> <b class="warn-text">The '
      + 'park ticket is not a mooring fee</b>: harbour dues in town and the concession buoys, for '
      + 'instance at Zaklopatica or Pasadur, are charged separately, usually in cash. Fishing only with '
      + 'a park permit and up to 5 kg a day; spearfishing only in daylight, from age 16, with a marker '
      + 'buoy and only at Kopište, Bijelac and the Mrkjenta reefs; scuba diving needs a permit from the '
      + 'ministry.',
    transit:
      'Die Parkkarte gilt auch für die bloße Durchfahrt; die Grenze reicht bis zu den Leuchtfeuern '
      + 'von Sušac, Tajan, Glavat und Struga, Sušac im Westen eingeschlossen. Festmachen und Ankern '
      + 'nur an den ausgewiesenen Plätzen.',
    transitEn:
      'The park ticket applies to a mere transit as well; the boundary extends to the lights of Sušac, '
      + 'Tajan, Glavat and Struga, Sušac in the west included. Mooring and anchoring only at the '
      + 'designated places.',
  },
  {
    name: 'Limski kanal',
    art: 'reservat',
    la1: 45.11, la2: 45.16, lo1: 13.59, lo2: 13.75,
    ankern:
      '<b class="warn-text">Als Ankerbucht fällt der Limski kanal aus.</b> Er steht seit 1964 als '
      + 'Landschaft und seit 1980 zusätzlich als besonderes Meeresreservat unter Schutz; '
      + 'Befahren und Ankern sind darin verboten, ausgenommen die Muschel- und '
      + 'Fischzucht. Der Einschnitt sieht auf der Karte aus wie der ideale geschützte Platz für '
      + 'eine Nacht. Er ist keiner, jedenfalls nicht legal. Wo Befahren im Randbereich geduldet '
      + 'wird, gilt 5 kn.',
    ankernEn:
      '<b class="warn-text">As an anchoring bay, the Limski kanal is out.</b> It has been protected '
      + 'as a landscape since 1964 and additionally as a special marine reserve since 1980; sailing '
      + 'and anchoring within it are prohibited, except for mussel and fish farming. On '
      + 'the chart the inlet looks like the ideal sheltered spot for a night. It is not one, at '
      + 'least not legally. Where sailing through the fringe is tolerated, 5 kn applies.',
  },

  {
    name: 'Velebit',
    art: 'bergpark',
    la1: 44.20, la2: 45.05, lo1: 14.75, lo2: 15.55,
    ankern:
      'An Land zieht sich hier der Naturpark Velebit hin, mit dem Nationalpark Nordvelebit im '
      + 'Norden und dem Nationalpark Paklenica im Süden. Fürs Ankern folgt daraus nichts. Für '
      + 'den Wind alles: Es ist genau dieser Gebirgszug, an dem die Bora entsteht. Im '
      + 'Velebitkanal fällt sie am härtesten ein, mit Böen weit über dem, was die Vorhersage '
      + 'für die freie See zeigt.',
    ankernEn:
      'On land, the Velebit Nature Park runs along here, with North Velebit National Park to the '
      + 'north and Paklenica National Park to the south. For anchoring, none of this matters. For '
      + 'the wind, everything: this is exactly the mountain range where the Bora originates. It hits '
      + 'hardest in the Velebit Channel, with gusts well above what the forecast shows for the open '
      + 'sea.',
  },
  {
    name: 'Biokovo',
    art: 'bergpark',
    la1: 43.20, la2: 43.42, lo1: 16.90, lo2: 17.35,
    ankern:
      'Hinter der Makarska-Riviera steht der Naturpark Biokovo. Ankerregeln bringt er keine mit, '
      + 'aber die Steilkante fällt aus über 1700 m fast direkt ins Meer. Bei nordöstlichem Wind '
      + 'ist die Küste davor Fallböengebiet, und ein Liegeplatz unter der Wand ist bei Bora '
      + 'keiner.',
    ankernEn:
      'Behind the Makarska Riviera stands Biokovo Nature Park. It brings no anchoring rules with it, '
      + 'but the escarpment drops from over 1700 m almost straight into the sea. In a north-easterly '
      + 'wind, the coast in front of it is williwaw territory, and a berth under the wall is no '
      + 'berth at all in a Bora.',
  },
];

function imGebiet(p: Punkt | { lat?: number; lon?: number }, g: Schutzgebiet): boolean {
  if (p.lat === undefined || p.lon === undefined) return false;
  return p.lat >= g.la1 && p.lat <= g.la2 && p.lon >= g.lo1 && p.lon <= g.lo2;
}

const KARTE_ALLGEMEIN =
  '<b>Eine Eintrittskarte fürs Schiff ist immer nötig</b>, auch für die bloße '
  + 'Durchfahrt; sie gilt pro Tag und richtet sich nach der Schiffslänge. Ranger kontrollieren.';

const TICKET_GEMEINSAM =
  'Für Kornati und Telašćica gibt es 2026 eine <b>gemeinsame Dreitageskarte fürs Schiff</b>, '
  + 'nur über mySea: 7 bis 10,99 m 100 €, von Juni bis September 200 €; 11 bis 17,99 m 150 € bzw. '
  + '300 €. Mehrtageskarten für alle vier Meeresparks (mit Mljet und Lastovsko otočje) bot '
  + 'Parkovi Hrvatske seit 2024 an; ob es sie noch gibt, beim Kauf im Webshop prüfen.';

const STAND =
  '<i>Eintrittspreise, Bojenzahlen und Ankerzonen ändern sich jährlich; die Parkgrenzen sind hier '
  + 'nur grob abgegrenzt. Verbindlich ist die jeweilige Parkverwaltung beziehungsweise '
  + 'parkovihrvatske.hr.</i>';

const KARTE_ALLGEMEIN_EN =
  '<b>An entry ticket for the boat is always required</b>, even for a mere transit; it applies '
  + 'per day and is based on the length of the boat. Rangers do check.';

const TICKET_GEMEINSAM_EN =
  'For Kornati and Telašćica there is a <b>joint three-day vessel ticket</b> in 2026, only '
  + 'through mySea: 7 to 10.99 m €100, June to September €200; 11 to 17.99 m €150 or €300. '
  + 'Parkovi Hrvatske has offered multi-day tickets for all four marine parks (with Mljet and '
  + 'Lastovsko otočje) since 2024; check in the web shop whether they are still available.';

const STAND_EN =
  '<i>Entry fees, buoy numbers and anchoring zones change yearly; the park boundaries here are only '
  + 'roughly outlined. The relevant park authority, or parkovihrvatske.hr, is authoritative.</i>';

export interface SchutzgebietAbschnitt {
  titel: string;
  text: string;
}

export function describeSchutzgebiete(
  ziel: Punkt | null | undefined,
  track: VerlaufPunkt[] | null | undefined,
  sprache: Sprache = 'de',
): SchutzgebietAbschnitt[] {
  const out: SchutzgebietAbschnitt[] = [];
  let gemeinsam = false;
  let karte = false;
  let letzterMeerespark = -1;

  for (const g of GEBIETE) {
    const amZiel = !!ziel && imGebiet(ziel, g);
    const aufStrecke = !!track?.some((p) => imGebiet(p, g));
    if (!amZiel && !aufStrecke) continue;

    let text: string;
    if (sprache === 'en') {
      const kernEn = (!amZiel && g.transitEn) ? g.transitEn : g.ankernEn;
      const einstiegEn = g.art === 'bergpark'
        ? ''
        : amZiel
          ? 'Your destination lies within the park. '
          : 'The route runs through the park. ';
      text = `<b>${g.name} (${ART_WORT_EN[g.art]}).</b> ${einstiegEn}${kernEn}`;
    } else {
      const kern = (!amZiel && g.transit) ? g.transit : g.ankern;
      const einstieg = g.art === 'bergpark'
        ? ''
        : amZiel
          ? 'Euer Ziel liegt im Bereich des Parks. '
          : 'Die Route führt durch den Park. ';
      text = `<b>${g.name} (${ART_WORT[g.art]}).</b> ${einstieg}${kern}`;
    }
    if (g.art !== 'bergpark') {
      letzterMeerespark = out.length;
      if (g.karte) karte = true;
      if (g.gemeinsamesTicket) gemeinsam = true;
    }
    out.push({ titel: sprache === 'en' ? `Protected area: ${g.name}` : `Schutzgebiet ${g.name}`, text });
  }

  if (letzterMeerespark >= 0) {
    const l = out[letzterMeerespark]!;
    const schluss = sprache === 'en'
      ? [karte ? KARTE_ALLGEMEIN_EN : '', gemeinsam ? TICKET_GEMEINSAM_EN : '', STAND_EN]
      : [karte ? KARTE_ALLGEMEIN : '', gemeinsam ? TICKET_GEMEINSAM : '', STAND];
    l.text += ` ${schluss.filter(Boolean).join(' ')}`;
  }
  return out;
}
