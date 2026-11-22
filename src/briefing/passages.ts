import { uhrLt } from '@/core/time';
import { distNM } from '@/core/geo';
import type { Sprache } from '@/core/types';
import type { VerlaufPunkt } from './profile';

interface Engstelle {
  name: string;
  la1: number; la2: number; lo1: number; lo2: number;

  achse: 'nord-sued' | 'ost-west';

  minDelta: number;

  nameEn: string;

  bezug?: { lat: number; lon: number };
  text: (vorwaerts: boolean, ankunft: Date, sprache?: Sprache) => string;
}

const ENGSTELLEN: Engstelle[] = [
  {

    name: 'Lefkas-Kanal', nameEn: 'Lefkas Canal',
    la1: 38.70, la2: 38.88, lo1: 20.64, lo2: 20.82,
    achse: 'nord-sued', minDelta: 0.03,

    bezug: { lat: 38.84698, lon: 20.7217 },
    text: (nachNorden, ankunft, sprache: Sprache = 'de') => {
      if (sprache === 'en') {
        const order = nachNorden
          ? 'Entering from the south: first the canal, with the bridge at the north end right at the finish.'
          : 'Entering from the north: the bridge sits right at the start, then the canal follows south.';
        return `<b>Lefkas Canal.</b> ${order} By the calculation the yacht will be there around `
          + `${uhrLt(ankunft)}. `
          + 'The Agia Mavra swing bridge opens between 0800 and 2200 LT <b>on the hour</b>, and '
          + 'between 2300 and 0700 LT on request. No fee applies. '
          + 'The time window therefore sets the pace of the whole day: half an hour late means a '
          + 'full hour of waiting. '
          + '<b class="warn-text">Check the operating status beforehand</b>. The bridge has '
          + 'recently been out of service for weeks at a stretch, most recently from July 2025 for '
          + 'an indefinite period; in that case the only option is the outside route around Lefkas. '
          + 'In the canal itself, depth is around 3.5 m, bounded by red and green buoys; keep as '
          + 'far to the right of the channel centreline as possible. The north entrance silts up '
          + 'heavily. '
          + '<b>Setting sail is prohibited in the canal</b>. The passage is made under engine.';
      }
      const reihenfolge = nachNorden
        ? 'Einfahrt von Süden: erst der Kanal, die Brücke kommt am Nordende zum Schluss.'
        : 'Einfahrt von Norden: die Brücke liegt gleich am Anfang, danach folgt der Kanal nach Süden.';
      return `<b>Lefkas-Kanal.</b> ${reihenfolge} Nach der Rechnung ist die Yacht gegen `
        + `${uhrLt(ankunft)} dort. `
        + 'Die Drehbrücke Agia Mavra öffnet zwischen 0800 und 2200 LT jeweils <b>zur vollen '
        + 'Stunde</b>, zwischen 2300 und 0700 LT auf Anforderung. Gebühr fällt keine an. '
        + 'Das Zeitfenster bestimmt also den Tag: Eine halbe Stunde zu spät heißt eine ganze '
        + 'Stunde warten. '
        + '<b class="warn-text">Vorher den Betriebsstatus prüfen</b>. Die Brücke war zuletzt '
        + 'mehrfach über Wochen außer Betrieb, zuletzt ab Juli 2025 auf unbestimmte Zeit; dann '
        + 'bleibt nur der Weg außen um Lefkas herum. '
        + 'Im Kanal selbst rund 3,5 m Wassertiefe, begrenzt durch rote und grüne Tonnen; so weit '
        + 'wie möglich rechts der Fahrwassermitte halten. Die Nordeinfahrt versandet stark. '
        + '<b>Segelsetzen ist im Kanal verboten</b>. Die Passage läuft unter Maschine.';
    },
  },
  {

    name: 'Rio-Andirrio-Brücke', nameEn: 'Rio-Antirrio Bridge',
    la1: 38.28, la2: 38.36, lo1: 21.70, lo2: 21.86,
    achse: 'ost-west', minDelta: 0.03,
    text: (nachOsten, ankunft, sprache: Sprache = 'de') => {
      if (sprache === 'en') {
        const direction = nachOsten
          ? 'Eastbound out of the Gulf of Patras into the Gulf of Corinth; '
            + 'eastbound yachts are usually assigned the <b>S Channel</b>.'
          : 'Westbound out of the Gulf of Corinth into the Gulf of Patras; '
            + 'westbound yachts are usually assigned the <b>N Channel</b>.';
        return `<b>Rio-Antirrio Bridge.</b> ${direction} By the calculation the yacht will be at the `
          + `strait around ${uhrLt(ankunft)}. `
          + '<b class="warn-text">Passage requires prior notification</b>: without clearance the '
          + 'coastguard consistently blocks it. '
          + '<b>What is required:</b> yachts up to 20 m call <b>"Rio Traffic" on VHF channel 14</b> '
          + 'at least <b>5 NM before the bridge</b> and pass their vessel name and mast height; '
          + 'alternatively, notification can be made by phone on +30 26340 32370. Vessels over 20 m '
          + 'length report in as early as 12 NM beforehand and additionally give draught, length, '
          + 'beam, cargo, and the number and nationality of crew, plus origin and destination. One '
          + 'nautical mile before the bridge you call again and receive final clearance for a '
          + 'specific bridge span. That is, the gap between two of the four pylons. Radio watch on '
          + 'channel 14 continues throughout the passage; you sign off at the agreed point beyond '
          + 'it, usually after 5 NM. The centre span is reserved for commercial shipping. '
          + 'No fee applies to yachts. The toll is for the road only. '
          + 'Clearance height is at most 45 m. No issue for a cruising yacht, though mast height is '
          + 'still asked for. '
          + 'Two things matter more en route than the bridge itself: the '
          + '<b>Rio–Antirrio ferry traffic</b>, which runs across your own course, and the '
          + '<b>funnelling effect in the strait</b>. The prevailing wind here is from northwest to '
          + 'southwest, and it freshens considerably between the bridge and Cape Drepano. '
          + 'Then there is the current: the strait is only around 2 km wide; the tidal range is '
          + 'small, but the tidal current through the constriction is strong, around 1 to 2 kn at '
          + 'the surface, more at peaks, and it reverses. Experience shows the inbound (eastward) '
          + 'current tends to run in the morning, the outbound (westward) one in the early '
          + 'afternoon. '
          + "<b>This app's current data does not resolve the strait</b>. The marine model's grid "
          + 'is coarser than the Rio strait is wide.';
      }
      const richtung = nachOsten
        ? 'Nach Osten aus dem Golf von Patras in den Golf von Korinth; '
          + 'ostgehende Yachten bekommen üblicherweise den <b>S-Kanal</b> zugewiesen.'
        : 'Nach Westen aus dem Golf von Korinth in den Golf von Patras; '
          + 'westgehende Yachten bekommen üblicherweise den <b>N-Kanal</b> zugewiesen.';
      return `<b>Rio-Andirrio-Brücke.</b> ${richtung} Nach der Rechnung ist die Yacht gegen `
        + `${uhrLt(ankunft)} an der Enge. `
        + '<b class="warn-text">Die Durchfahrt ist anmeldepflichtig</b>. Ohne Freigabe wird sie '
        + 'von der Küstenwache konsequent unterbunden. '
        + '<b>Was nötig ist:</b> Yachten bis 20 m rufen spätestens <b>5 sm vor der Brücke</b> '
        + '<b>„Rio Traffic" auf UKW-Kanal 14</b> und geben Schiffsnamen und Masthöhe durch; '
        + 'ersatzweise geht die Anmeldung telefonisch unter +30 26340 32370. Über 20 m Länge '
        + 'meldet man sich schon 12 sm vorher und nennt zusätzlich Tiefgang, Länge, Breite, '
        + 'Ladung, Anzahl und Nationalität der Crew sowie Herkunft und Ziel. Eine Seemeile vor '
        + 'der Brücke meldet man sich erneut und bekommt die endgültige Freigabe für ein '
        + 'bestimmtes Brückenfeld, also die Lücke zwischen zwei der vier Pylone. Während der '
        + 'ganzen Passage bleibt Funkwache auf 14; abgemeldet wird an dem vereinbarten Punkt '
        + 'dahinter, üblicherweise nach 5 sm. Das Mittelfeld ist der Großschifffahrt vorbehalten. '
        + 'Gebühr fällt für Yachten keine an, die Maut gilt nur der Straße. '
        + 'Die Durchfahrtshöhe beträgt höchstens 45 m. Für eine Fahrtenyacht kein Thema, '
        + 'gefragt wird die Masthöhe trotzdem. '
        + 'Zwei Dinge fallen unterwegs mehr ins Gewicht als die Brücke selbst: der '
        + '<b>Fährverkehr Rio–Andirrio</b>, der quer zum eigenen Kurs läuft, und der '
        + '<b>Düseneffekt in der Enge</b>. Vorherrschend weht es hier aus Nordwest bis Südwest, '
        + 'und zwischen Brücke und Kap Drepano frischt es dabei erheblich auf. '
        + 'Dazu der Strom: Die Enge ist nur rund 2 km breit, der Tidenhub zwar klein, der '
        + 'Gezeitenstrom durch die Verengung aber kräftig, an der Oberfläche rund 1 kn bis 2 kn, '
        + 'in Spitzen mehr, und er kentert. Einlaufend nach Osten setzt er erfahrungsgemäß eher '
        + 'vormittags, auslaufend nach Westen eher am frühen Nachmittag. '
        + '<b>Die Stromdaten dieser App lösen die Enge nicht auf</b>. Das Marine-Modell rechnet '
        + 'gröber, als die Rion-Enge breit ist.';
    },
  },
  {

    name: 'Kanal von Korinth', nameEn: 'Corinth Canal',
    la1: 37.88, la2: 37.98, lo1: 22.90, lo2: 23.06,
    achse: 'ost-west', minDelta: 0.03,
    text: (nachOsten, ankunft, sprache: Sprache = 'de') => {
      if (sprache === 'en') {
        const side = nachOsten
          ? 'Entering in the west from the Gulf of Corinth and leaving at Isthmia into the '
            + 'Saronic Gulf.'
          : 'Entering in the east at Isthmia and leaving into the Gulf of Corinth.';
        const waiting = nachOsten
          ? 'Waiting is done in the west, at anchor or in Corinth Marina; the fee is paid at the '
            + 'tower at the EAST end in Isthmia. For a longer wait, it is a roughly ten-minute '
            + 'taxi ride there.'
          : 'Waiting is done in the east, at anchor or alongside the pier by the tower in Isthmia '
            + '. Free berthing there for up to three hours, and the fee is also paid there.';
        return `<b>Corinth Canal.</b> ${side} By the calculation the yacht will be at the entrance around `
          + `${uhrLt(ankunft)}. `
          + 'The canal operates around the clock: <b class="warn-text">except on Tuesdays from '
          + '0600 to 1800 LT</b>, when it is closed for maintenance. This is the date that wrecks '
          + 'most passage plans. '
          + '<b>What is required:</b> on approach, call the canal authority on <b>VHF channel 11</b> '
          + 'and give nationality, vessel name, weight, beam and draught, plus method of payment '
          + '(cash or card). They will give you the expected waiting time and later the entry order '
          + `. The canal is <b>one-way</b> and worked in convoy, with commercial shipping having `
          + `priority. ${waiting} `
          + 'The fee is based on vessel length and for yachts runs roughly between 80 and 300 '
          + 'euros; current rates and operating notices are available from the canal authority '
          + '(aedik.gr). '
          + 'The passage: 6.3 km long, 25 m wide, around 8 m deep, maximum draught 7 m; the bridges '
          + 'at both ends submerge, so mast height is not an issue. Maximum speed 5 kn; the passage '
          + 'takes about an hour and a half. Depending on wind and tide, up to 3 kn of current can '
          + 'run in the canal.';
      }
      const seite = nachOsten
        ? 'Einfahrt im Westen aus dem Golf von Korinth, Ausfahrt bei Isthmia in den '
          + 'Saronischen Golf.'
        : 'Einfahrt im Osten bei Isthmia, Ausfahrt in den Golf von Korinth.';
      const warten = nachOsten
        ? 'Gewartet wird im Westen vor Anker oder in der Marina Korinth; die Gebühr wird am Turm '
          + 'am OSTende in Isthmia bezahlt, bei längerer Wartezeit fährt man dorthin mit dem Taxi '
          + '(rund zehn Minuten).'
        : 'Gewartet wird im Osten vor Anker oder am Pier beim Turm in Isthmia. Dort liegt man bis '
          + 'zu drei Stunden frei, und dort wird auch die Gebühr bezahlt.';
      return `<b>Kanal von Korinth.</b> ${seite} Nach der Rechnung ist die Yacht gegen `
        + `${uhrLt(ankunft)} an der Einfahrt. `
        + 'Der Kanal ist rund um die Uhr in Betrieb. <b class="warn-text">Außer dienstags von '
        + '0600 bis 1800 LT</b>, dann ist er wegen Wartung gesperrt. Das ist der Termin, an dem '
        + 'die meisten Törnplanungen scheitern. '
        + '<b>Was nötig ist:</b> Bei der Annäherung die Kanalverwaltung auf <b>UKW-Kanal 11</b> '
        + 'rufen und Nationalität, Schiffsnamen, Gewicht, Breite und Tiefgang durchgeben, dazu die '
        + 'Zahlungsart (bar oder Karte). Von dort kommt die voraussichtliche Wartezeit und später '
        + 'die Einfahrtsreihenfolge. Der Kanal ist <b>Einbahnverkehr</b> und wird im Konvoi '
        + `abgefertigt, Berufsschifffahrt hat Vorrang. ${warten} `
        + 'Die Gebühr richtet sich nach der Schiffslänge und liegt für Yachten grob zwischen 80 und '
        + '300 Euro; den aktuellen Tarif und Betriebsmeldungen gibt es bei der Kanalverwaltung '
        + '(aedik.gr). '
        + 'Die Passage: 6,3 km lang, 25 m breit, rund 8 m tief, höchstens 7 m Tiefgang; die Brücken '
        + 'an beiden Enden versenken sich, Masthöhe ist also kein Thema. Höchstens 5 kn fahren, '
        + 'die Durchfahrt dauert etwa anderthalb Stunden. Im Kanal können je nach Wind und Tide bis '
        + 'zu 3 kn Strom stehen.';
    },
  },
  {

    name: 'Euripos-Brücke bei Chalkida', nameEn: 'Euripus Bridge at Chalkida',
    la1: 38.42, la2: 38.50, lo1: 23.54, lo2: 23.64,
    achse: 'nord-sued', minDelta: 0.015,
    text: (nachNorden, ankunft, sprache: Sprache = 'de') => {
      if (sprache === 'en') {
        const direction = nachNorden
          ? 'Passage north into the Northern Euboean Gulf.'
          : 'Passage south out of the Northern Euboean Gulf.';
        return `<b>Euripus Bridge at Chalkida.</b> ${direction} By the calculation the yacht will be `
          + `there around ${uhrLt(ankunft)}. Though as far as arrival time goes, that is `
          + 'secondary here: '
          + '<b>the sliding bridge opens almost exclusively at night</b>, usually shortly after '
          + '2300 LT, and specifically <b>at slack water</b>. The exact time is not fixed in advance, '
          + 'because it depends on the current; the expected time is displayed digitally at the '
          + "bridge. A day's run therefore ends here at the waiting pier, for now. "
          + '<b>What is required:</b> report to the port authority. It sits in a small container '
          + 'at the "Yachts Berthing Pier" southeast of the bridge. The fee for a cruising yacht is '
          + 'in the region of 35 euros, with a surcharge on Sundays. From about 30 minutes before '
          + 'opening, <b>radio watch on VHF channel 12</b> is required; instructions for the '
          + 'passage come over that channel. Waiting is done around 500 m before the bridge at the '
          + 'Yacht Berthing Pier, or at anchor in the bay. '
          + '<b class="warn-text">Do not enter the strait too early.</b> Through the Euripus the '
          + 'current runs up to 6 kn and reverses roughly every six hours; the port authority '
          + 'explicitly warns against entering too early, because larger vessels regularly pass in '
          + 'the opposite direction. Clearance is reportedly slower at weekends, given the choice, '
          + 'schedule the passage on a weekday.';
      }
      const richtung = nachNorden
        ? 'Durchfahrt nach Norden in den Nördlichen Euböischen Golf.'
        : 'Durchfahrt nach Süden aus dem Nördlichen Euböischen Golf.';
      return `<b>Euripos-Brücke bei Chalkida.</b> ${richtung} Nach der Rechnung ist die Yacht gegen `
        + `${uhrLt(ankunft)} dort: was die Ankunftszeit angeht, ist das hier allerdings `
        + 'nebensächlich: '
        + '<b>Die Schiebebrücke öffnet fast ausschließlich nachts</b>, üblicherweise kurz nach '
        + '2300 LT, und zwar <b>zur Stillwasserzeit</b>. Der genaue Zeitpunkt steht vorher nicht '
        + 'fest, weil er vom Strom abhängt; die erwartete Zeit wird an der Brücke digital '
        + 'angezeigt. Ein Tagesschlag endet hier also erst einmal am Wartepier. '
        + '<b>Was nötig ist:</b> Anmeldung beim Hafenamt. Es sitzt in einem kleinen Container am '
        + '„Yachts Berthing Pier" südöstlich der Brücke. Die Gebühr liegt für eine Fahrtenyacht in '
        + 'der Größenordnung von 35 Euro, sonntags mit Aufschlag. Ab etwa 30 Minuten vor der '
        + 'Öffnung ist <b>Funkwache auf UKW-Kanal 12</b> nötig, darüber kommen die Anweisungen zur '
        + 'Passage. Gewartet wird rund 500 m vor der Brücke am Yacht Berthing Pier oder vor Anker '
        + 'in der Bucht. '
        + '<b class="warn-text">Nicht zu früh in die Enge einlaufen.</b> Durch den Euripos setzt '
        + 'der Strom bis zu 6 kn und kehrt etwa alle sechs Stunden um; das Hafenamt warnt '
        + 'ausdrücklich davor, zu früh hineinzufahren, weil regelmäßig größere Schiffe in der '
        + 'Gegenrichtung passieren. Am Wochenende ist die Abfertigung erfahrungsgemäß zäher. Wer '
        + 'die Wahl hat, legt die Passage auf einen Werktag.';
    },
  },
  {

    name: 'Kanal Sv. Ante', nameEn: 'Sv. Ante Channel',

    la1: 43.715, la2: 43.732, lo1: 15.84, lo2: 15.885,
    achse: 'ost-west', minDelta: 0.01,
    text: (nachOsten, ankunft, sprache: Sprache = 'de') => {
      if (sprache === 'en') {
        const direction = nachOsten
          ? 'Entering from the sea towards Šibenik.'
          : 'Leaving Šibenik for the open sea.';
        return `<b>Sv. Ante Channel.</b> ${direction} By the calculation the yacht will be in the channel `
          + `around ${uhrLt(ankunft)}. <b class="warn-text">Sailing in the channel has been `
          + 'prohibited since 25 April 2026</b> (NN 40/2026); the passage is made under engine, sails '
          + 'down. Ships of 500 GT and more and yachts of 1,000 GT and more need a pilot. Activities in '
          + 'the navigable part that hamper safe navigation are prohibited.';
      }
      const richtung = nachOsten
        ? 'Einfahrt vom Meer nach Šibenik.'
        : 'Ausfahrt aus Šibenik aufs offene Meer.';
      return `<b>Kanal Sv. Ante.</b> ${richtung} Nach der Rechnung ist die Yacht gegen `
        + `${uhrLt(ankunft)} im Kanal. <b class="warn-text">Segeln ist im Kanal seit dem `
        + '25. April 2026 verboten</b> (NN 40/2026); durchfahren wird unter Maschine mit geborgenen '
        + 'Segeln. Schiffe ab 500 BRZ und Yachten ab 1000 BRZ brauchen einen Lotsen. Untersagt ist '
        + 'im Fahrwasser alles, was die sichere Schifffahrt behindert.';
    },
  },
];

function inBox(p: VerlaufPunkt, e: Engstelle): boolean {
  if (p.lat === undefined || p.lon === undefined) return false;
  return p.lat >= e.la1 && p.lat <= e.la2 && p.lon >= e.lo1 && p.lon <= e.lo2;
}

export interface EngstellenAbschnitt {
  titel: string;
  text: string;
}

export function describeEngstellen(
  track: VerlaufPunkt[] | null,
  sprache: Sprache = 'de',
): EngstellenAbschnitt[] {
  if (!track?.length) return [];
  const out: (EngstellenAbschnitt & { an: number })[] = [];

  for (const e of ENGSTELLEN) {
    const drin = track.filter((p) => inBox(p, e));
    if (drin.length < 2) continue;
    const erste = drin[0]!, letzte = drin[drin.length - 1]!;
    const delta = e.achse === 'nord-sued'
      ? letzte.lat! - erste.lat!
      : letzte.lon! - erste.lon!;

    if (Math.abs(delta) < e.minDelta) continue;

    const bezug = e.bezug;
    const zeit = bezug
      ? drin.reduce((a, p) => (distNM(p.lat!, p.lon!, bezug.lat, bezug.lon) < distNM(a.lat!, a.lon!, bezug.lat, bezug.lon) ? p : a)).time
      : erste.time;
    out.push({
      titel: sprache === 'en' ? e.nameEn : e.name,
      text: e.text(delta > 0, zeit, sprache),
      an: zeit.getTime(),
    });
  }

  return out.sort((a, b) => a.an - b.an).map(({ titel, text }) => ({ titel, text }));
}
