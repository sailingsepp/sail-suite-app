import { nf, uhrLt } from '@/core/time';
import { bestaetigtDurchDruck, starkerMeltemiVoraus, gefaellePasstZuBora, type Druckmuster } from './druckmuster';
import { richtungsName } from './wind';
import type { Druckanalyse } from '@/core/druckfeld';
import type { Sprache } from '@/core/types';
import { meeresgebietAm } from '@/core/meeresgebiete';

import {
  type Synoptik,
  DRUCK_ANSTIEG_STARKWIND, DRUCK_NIVEAU_MELTEMI_STARK,
  DRUCK_FALL_KALTFRONT, DRUCK_FALL_JUGO_FALLE, SICHT_DIESIG_M,
} from './synoptik';

export function imMeer(lat: number, lon: number, id: string): boolean {
  const g = meeresgebietAm(lat, lon);
  return !g || g.id === id;
}

export function inBox(lat: number, lon: number, la1: number, la2: number, lo1: number, lo2: number): boolean {
  return lat >= la1 && lat <= la2 && lon >= lo1 && lon <= lo2;
}

function inArc(dir: number, from: number, to: number): boolean {
  const d = (dir + 360) % 360;
  return from <= to ? (d >= from && d <= to) : (d >= from || d <= to);
}

function druckSatz(syn: Synoptik | null | undefined, richtung: 'anstieg' | 'fall', schwelle: number, sprache: Sprache = 'de'): string {
  if (!syn) return '';
  const wert = richtung === 'anstieg' ? syn.druckAnstieg3h : syn.druckFall3h;
  if (wert === null || wert < schwelle) return '';
  if (sprache === 'en') {
    return ` This matches the forecast's pressure trend: a ${richtung === 'anstieg' ? 'rise' : 'fall'} `
      + `of ${nf(wert, 1, 'en')} hPa in three hours.`;
  }
  return ` Dazu passt die Drucktendenz der Vorhersage: ${richtung === 'anstieg' ? 'Anstieg' : 'Fall'} `
    + `um ${nf(wert, 1)} hPa in drei Stunden.`;
}

function hellDunkel(syn: Synoptik | null | undefined): 'hell' | 'dunkel' | null {
  if (!syn || syn.wolken === null) return null;
  return syn.wolken < 35 ? 'hell' : syn.wolken > 65 ? 'dunkel' : null;
}

function ohneFrontanzeichen(syn: Synoptik | null | undefined): boolean {
  return !!syn && syn.druckFall3h !== null && syn.druckFall3h < 1 && hellDunkel(syn) === 'hell';
}

const VOLLTEXT_AB_KN = 18;
const VOLLTEXT_AB_NM = 40;

export function kuerzeReviertext(text: string, saetze = 2): string {
  const teile = text.split(/(?<=\.)\s+/);
  if (teile.length <= saetze) return text;
  for (let n = saetze; n < teile.length; n++) {
    const kurz = teile.slice(0, n).join(' ');
    const auf = (kurz.match(/<b>/g) ?? []).length;
    const zu = (kurz.match(/<\/b>/g) ?? []).length;
    if (auf === zu) return kurz;
  }
  return text;
}

export interface LokalwindLage {

  avgWindDir: number;
  maxWind: number;

  gustFactor: number;
  midLat: number;
  midLon: number;

  beatShare: number;

  departure: Date;

  maxGust?: number;
}

const BORA_BOE_MIN_KN = 22;
const BORA_BOEENFAKTOR_MIN = 1.8;
function boraNurAusBoeen(b: LokalwindLage): boolean {
  const ueberMittelwind = inArc(b.avgWindDir, 20, 90) && b.maxWind >= 14
    && (b.gustFactor >= 1.45 || b.maxWind >= 22);
  return !ueberMittelwind && b.maxGust != null && b.maxGust >= BORA_BOE_MIN_KN
    && b.gustFactor >= BORA_BOEENFAKTOR_MIN && inArc(b.avgWindDir, 349, 79);
}

const MUSTER_JE_WIND: Record<string, Druckmuster> = {
  Bora: 'bora',
  Jugo: 'sued',
  Notos: 'sued',
  Loddos: 'sued',
  Maestral: 'nordwest',
  Maistro: 'nordwest',
  Meltemi: 'meltemi',
};

export type WindKey = 'Bora' | 'Jugo' | 'Libeccio' | 'Maestral' | 'Tramontana' | 'Loddos'
  | 'Meltemi' | 'Notos' | 'Imbat' | 'Mistral' | 'Gregale' | 'Maistro';

interface LokalwindErgebnis {
  key: WindKey;
  text: string;
}

export function localWind(
  b: LokalwindLage, monat: number, syn?: Synoptik | null, gesamtNM?: number | null,
  druck?: Druckanalyse | null, sprache: Sprache = 'de',
): string | null {
  const ergebnis = localWindVoll(b, monat, syn, sprache);
  if (ergebnis === null) return null;
  const langeStrecke = gesamtNM != null && gesamtNM >= VOLLTEXT_AB_NM;

  const kraeftig = b.maxWind >= VOLLTEXT_AB_KN || boraNurAusBoeen(b);
  const text = (gesamtNM == null || langeStrecke || kraeftig) ? ergebnis.text : kuerzeReviertext(ergebnis.text);

  const muster = MUSTER_JE_WIND[ergebnis.key];
  if (!muster) return text;
  const beleg = bestaetigtDurchDruck(muster, druck ?? null, sprache) ?? '';
  const meltemiWarnung = muster === 'meltemi' ? (starkerMeltemiVoraus(druck ?? null, sprache) ?? '') : '';
  return text + beleg + meltemiWarnung;
}

export function erkannterLokalwind(b: LokalwindLage, monat: number, syn?: Synoptik | null): WindKey | null {
  return localWindVoll(b, monat, syn, 'de')?.key ?? null;
}

export function boraWetterlage(b: LokalwindLage, druck: Druckanalyse | null | undefined): boolean {
  return (inBox(b.midLat, b.midLon, 39.5, 46.0, 12.0, 20.5) && imMeer(b.midLat, b.midLon, '28g'))
    && inArc(b.avgWindDir, 304, 79)
    && gefaellePasstZuBora(druck ?? null);
}

export function describeBoraWetterlage(
  b: LokalwindLage, monat: number, syn: Synoptik | null | undefined,
  druck: Druckanalyse | null | undefined, sprache: Sprache = 'de',

  amtlichDa = false,
): string | null {
  if (!boraWetterlage(b, druck)) return null;
  if (erkannterLokalwind(b, monat, syn) === 'Bora') return null;
  const en = sprache === 'en';
  const boe = b.maxGust != null && b.maxGust > b.maxWind + 0.5;
  const modell = en
    ? `The model shows only ${nf(b.maxWind, 0, 'en')} kn${boe ? `, gusts to ${nf(b.maxGust!, 0, 'en')} kn` : ''}`
    : `Das Modell zeigt dazu nur ${nf(b.maxWind, 0)} kn${boe ? `, Böen bis ${nf(b.maxGust!, 0)} kn` : ''}`;
  const anstieg = syn?.druckAnstieg3h != null && syn.druckAnstieg3h >= DRUCK_ANSTIEG_STARKWIND
    ? syn.druckAnstieg3h : null;
  const hell = hellDunkel(syn) === 'hell';
  const saison = monat === 5 || monat === 9 || monat === 10;

  if (en) {
    return `<b>Bora situation</b>: the pressure pattern matches it: pressure is higher to the north `
      + `and lower to the south, with the wind from ${richtungsName(b.avgWindDir, 'en')}. `
      + `${modell}. The Bora is a fall wind off the coastal mountains; close under the coast it can blow `
      + `markedly harder and gustier than the model shows, and in a Bora situation the wind can freshen `
      + `from Force 1 to Force 7 in under an hour.`
      + (saison ? ` In ${monat === 10 ? 'October, longer Bora spells with severe gale or even hurricane-force gusts'
        : `${monat === 5 ? 'May' : 'September'}, longer Bora spells with severe gale-force gusts`} are possible.` : '')
      + (anstieg !== null ? ` One of the warning signs is in the forecast: pressure rising `
        + `${nf(anstieg, 1, 'en')} hPa in three hours.` : '')
      + (hell ? ' The largely clear sky fits the anticyclonic Bora chiara.' : '')
      + (amtlichDa ? '' : ` Check the official marine forecast for a Bora warning before leaving: for Croatian waters the `
      + `Marine Meteorological Centre in Split (DHMZ), also broadcast on NAVTEX.`);
  }
  return `<b>Bora-Wetterlage</b>: die Druckverteilung passt dazu: höherer Luftdruck im Norden, `
    + `tieferer im Süden, und der Wind kommt aus ${richtungsName(b.avgWindDir)}. `
    + `${modell}. Die Bora ist ein Fallwind von den Küstengebirgen; unter Land kann sie deutlich `
    + `kräftiger und böiger wehen, als das Modell zeigt, und bei Bora-Wetterlage kann der Wind in weniger `
    + `als einer Stunde von 1 auf 7 Beaufort auffrischen.`
    + (saison ? ` Im ${monat === 5 ? 'Mai' : monat === 9 ? 'September' : 'Oktober'} sind länger anhaltende `
      + `Bora-Perioden mit schweren Sturmböen${monat === 10 ? ' oder sogar Orkanböen' : ''} möglich.` : '')
    + (anstieg !== null ? ` Eines der Warnzeichen steht in der Vorhersage: Der Luftdruck steigt um `
      + `${nf(anstieg, 1)} hPa in drei Stunden.` : '')
    + (hell ? ' Der weitgehend wolkenfreie Himmel passt zur antizyklonalen Bora chiara.' : '')
    + (amtlichDa ? '' : ` Vor dem Ablegen den amtlichen Seewetterbericht auf eine Bora-Warnung prüfen: für kroatische `
    + `Gewässer der Seewetterdienst in Split (DHMZ), auch über NAVTEX.`);
}

function localWindVoll(b: LokalwindLage, monat: number, syn: Synoptik | null | undefined, sprache: Sprache): LokalwindErgebnis | null {
  return sprache === 'en' ? localWindVollEn(b, monat, syn) : localWindVollDe(b, monat, syn);
}

function localWindVollDe(b: LokalwindLage, monat: number, syn?: Synoptik | null): LokalwindErgebnis | null {
  const d = b.avgWindDir, v = b.maxWind, gf = b.gustFactor;
  const lat = b.midLat, lon = b.midLon;

  const hatZeit = b.departure instanceof Date && !Number.isNaN(b.departure.getTime());
  const stunde = hatZeit ? b.departure.getUTCHours() : 12;

  if (v < 8 && !(boraNurAusBoeen(b) && (inBox(lat, lon, 39.5, 46.0, 12.0, 20.5) && imMeer(lat, lon, '28g')))) return null;

  if ((inBox(lat, lon, 39.5, 46.0, 12.0, 20.5) && imMeer(lat, lon, '28g'))) {

    const boraBoeen = boraNurAusBoeen(b);
    if ((inArc(d, 20, 90) && v >= 14 && (gf >= 1.45 || v >= 22)) || boraBoeen) {
      const heftig = gf >= 1.5;

      const boeenVorsatz = boraBoeen
        ? `Das Modell zeigt im Mittel nur ${nf(v, 0)} kn, aber Böen bis ${nf(b.maxGust!, 0)} kn `
          + `(Böenfaktor ${nf(gf, 1)}) aus Nord bis Ostnordost. Genau diese Böigkeit ist das Kennzeichen `
          + `der Bora, und unter Land kann sie deutlich kräftiger wehen, als das Modell zeigt. `
        : '';

      const ausserhalbFenster = hatZeit && (stunde < 11 || stunde >= 17);
      return { key: 'Bora', text: boeenVorsatz + `<b>Bora</b>: Richtung${heftig ? ' und Böigkeit' : ''} passen zum katabatischen Fallwind, `
        + `der kalte Luft von den Dinariden in die Adria stürzen lässt. Sie setzt schlagartig ein und weht in `
        + `heftigen Stößen${heftig ? ` (Böenfaktor ${nf(gf, 1)})` : ''}, meist bei klarem Himmel. `
        + `Bei Bora-Wetterlage kann der Wind in weniger als einer Stunde von 1 auf 7 Beaufort auffrischen `
        + `und ebenso rasch wieder abflauen. `
        + `Sie baut kurze, steile Wellen auf und reißt Gischt in die Luft, was die Sicht nimmt. `
        + `Am stärksten ist sie unter Land (Velebitkanal, Kvarner, Makarska), nach Süden hin nimmt sie ab. `
        + `Küstennah kann sie deutlich kräftiger sein, als das Modell auf seinem groben Gitter zeigt.`

        + ` <b>Die Zwickmühle:</b> Dicht unter der Küste sind die Böen am heftigsten, dafür bleibt die `
        + `ablandige Bora dort ohne nennenswerten Seegang. Weiter draußen weht es schwächer und `
        + `gleichmäßiger, aber die See wird mit jeder Meile seewärts ruppiger. Vor der Bora bis zur `
        + `italienischen Küste zu fliehen, lohnt nicht: dort steht grobe See mit Legerwall-Gefahr bei `
        + `lebhaftem Nordwind.`
        + ` Typische Dauer zwei, höchstens drei Tage; im Sommer bleibt es manchmal bei einem Tag und `
        + `kaum mehr als 5 Beaufort (Borino). In Mai, September und Oktober sind längere Perioden mit `
        + `schweren Sturmböen möglich.`
        + (ausserhalbFenster
          ? ` Zur Tageszeit: Die Bora weht zu Beginn des Ausbruchs am stärksten, vor allem in der `
            + `folgenden Nacht und am Morgen darauf; zwischen 1100 und 1700 LT lässt sie oft nach. `
            + `Wer bei ${uhrLt(b.departure)} verholen will, liegt außerhalb dieses ruhigeren Fensters.`
          : ` Zur Tageszeit passt es: Zwischen 1100 und 1700 LT weht die Bora oft weniger stark als sonst. `
            + `Deshalb wird in diesem Fenster verholt.`)
        + ` Zwei Nebenwirkungen, die das Modell nicht zeigt: Der starke ablandige Wind senkt den `
        + `Wasserspiegel örtlich um mehr als einen halben Meter, bei knapper Tiefe am Liegeplatz `
        + `mitrechnen, und in den Meerengen wird auch das Wasser beschleunigt; im Kvarner sind bei `
        + `starker Bora bis zu 4 kn Strömung möglich.`
        + ` Zum Ankern eignen sich Buchten mit freiem Raum nach Westen und Süden; klassische `
        + `Bora-Asyle sind die Kanäle von Zadar und Srednji, die Leeseiten von Unije, Lošinj, Premuda, `
        + `Dugi Otok, Kornat und Mljet, die Westseite von Hvar und die Westküste Istriens.`
        + druckSatz(syn, 'anstieg', DRUCK_ANSTIEG_STARKWIND)
        + (hellDunkel(syn) === 'hell'
          ? ' Der weitgehend wolkenfreie Himmel passt zur antizyklonalen Bora chiara: schönes Wetter, '
            + 'brillante Fernsicht, aber kühler als sonst.'
          : hellDunkel(syn) === 'dunkel'
            ? ' Die starke Bewölkung passt eher zur zyklonalen Bora scura, im Süden der Adria mit teils '
              + 'gewittrigen Regenfällen.'
            : '') };
    }

    if (inArc(d, 200, 290) && v >= 14 && ohneFrontanzeichen(syn)) {

      return { key: 'Libeccio', text: `Südwest bis West ist die Richtung des <b>Libeccio</b> (kroatisch Garbin, `
        + `in Dalmatien auch Nevera oder Neverin genannt). Die Lage passt heute aber nicht dazu: kein `
        + `nennenswerter Druckfall, weitgehend klarer Himmel. Der Libeccio kommt mit einer gewittrigen `
        + `Kaltfront und bricht dann unvermittelt mit 6 bis 8 Beaufort herein. Die Vorzeichen im Blick `
        + `behalten: Der Wind dreht auf Nordost bis Südost, ohne nennenswert aufzufrischen, es wird schwül, `
        + `über der Küste stehen große Quellwolken, und aus Westen schiebt sich eine blauschwarze Wolkenwand `
        + `heran. Viele kroatische Schutzhäfen sind auf Bora hin angelegt und bieten gegen Südwest bis West `
        + `keinen Schutz.` };
    }

    if (inArc(d, 200, 290) && v >= 14) {
      const sued = lat < 43.0;
      return { key: 'Libeccio', text: `<b>Libeccio</b> (kroatisch Garbin, in Dalmatien auch Nevera oder Neverin genannt). `
        + `Südwest bis West passt zum Wind der gewittrigen `
        + `Kaltfrontpassage. Er bricht in der Regel unvermittelt mit 6 bis 8 Beaufort herein und wird `
        + `unter leichter Rechtsdrehung wieder schwächer; selten weht er länger als zwei bis drei Stunden. `
        + `Geht der Front ein starker Luftdruckfall voraus, sind Böen von 9 Beaufort und mehr zu erwarten.`
        + ` <b>Der entscheidende Punkt:</b> Viele kroatische Schutzhäfen sind auf Bora hin angelegt, also `
        + `auf Nordost. Gegen einen Sturm aus Südwest bis West bieten sie keinen Schutz. Wer erst beim `
        + `Losbrechen sucht, findet nichts.`
        + (sued
          ? ` Südlich von Dubrovnik gilt der Libeccio als der gefährlichste Wind überhaupt: Dort gehen ihm `
            + `oft schönes Wetter und eine besonders ruhige See voraus, und die Küste bietet kaum tief `
            + `eingeschnittene Buchten als Zuflucht. Das Seegebiet kann in weniger als einer Stunde `
            + `umschlagen.`
          : ` In der zweiten Hälfte der Segelsaison sind besonders heftige Libeccio-Ereignisse in der `
            + `östlichen Adria beobachtet worden.`)
        + ` Die Vorzeichen: Der Wind dreht auf Nordost bis Südost, ohne nennenswert aufzufrischen, `
        + `es wird schwül, über der Küste stehen große Quellwolken, und darüber ziehen hohe Wolkenfelder `
        + `rasch aus Südwest heran. Zuletzt schiebt sich aus Westen eine blauschwarze Wolkenwand heran.`
        + druckSatz(syn, 'fall', DRUCK_FALL_KALTFRONT)
        + ` Eine Stundenvorhersage glättet eine so kurze Front weg: die Böenwerte oben sind hier keine `
        + `Obergrenze.` };
    }

    if (inArc(d, 100, 165) && v >= 12) {
      const nord = lat >= 44.0;

      const gleichmaessig = gf < 1.4;
      return { key: 'Jugo', text: `<b>Jugo</b> (Scirocco): Südost passt zum warmen, feuchten Wind aus Nordafrika. `
        + `Er baut sich langsamer auf als die Bora und kündigt sich über fallenden Luftdruck, `
        + `aufziehende Bewölkung und Regen an. Es bleibt also Zeit, einen Hafen zu suchen. `
        + `Typisch ist ein Aufbau über Tage: am ersten Tag kaum mehr als ein Hauch aus Südost, am `
        + `zweiten eine schwache, am dritten eine mäßige Brise, die allmählich von Südost auf Süd dreht. `
        + `Eine Jugo-Lage hält zwei bis vier Tage.`
        + (gleichmaessig
          ? ` Der gleichmäßige Wind ohne ausgeprägte Böen (Böenfaktor ${nf(gf, 1)}) passt dazu.`
          : ` Der hohe Böenfaktor (${nf(gf, 1)}) passt allerdings nicht zum Jugo, der sehr gleichmäßig `
            + `weht. Das deutet eher auf eine bereits gewittrig durchsetzte Lage hin.`)
        + ` <b>Der Seegang ist das eigentliche Thema:</b> Der Windweg entspricht genau der Achse der `
        + `Adria, der maximale Fetch von 420 sm wird bei Jugo ausgereizt. Die See wird nach `
        + `Norden hin immer höher, und in der nördlichen Adria steigen zugleich die Wasserstände weit `
        + `über das normale Niveau.`
        + (nord
          ? ` Im Golf von Venedig weht es bei Jugo selten mehr als 3 bis 4 Beaufort, aber die Dünung hat `
            + `es in sich: An den Flachküsten zwischen Grado und Chioggia steht bei Legerwall eine bis zu `
            + `4 m hohe Grundsee.`
          : '')
        + ` Die italienische Seite meiden: sehr schlechte Sicht, hohe Dünung mit Legerwall-Risiko, und `
        + `an der Ostküste des Gargano sowie zwischen Marcelli und Ancona frischt der Jugo durch den `
        + `Leitplankeneffekt der Berge auf 5 bis 6 Beaufort auf. Die klassische Route bei schwerem Jugo `
        + `führt stattdessen dicht unter der Festlandsküste durch die Kanäle: Kvarner, Kanäle von Zadar `
        + `und Pašman bis Kap Ploča, dann Vis oder Pakleni, Korčula und Mljet.`

        + ((syn?.druckFall3h ?? 0) >= DRUCK_FALL_JUGO_FALLE
          ? ` <b>Achtung, diese Route trägt heute nicht:</b> Der Luftdruck fällt um ${nf(syn!.druckFall3h!, 1)} hPa `
            + `in drei Stunden. Das deutet auf einen nahenden Tiefdruckkern; nach dessen Passage dreht der `
            + `Wind meist auf Nord bis Ost und frischt böig auf. Das Jugo-Asyl in den Kanälen wird dann `
            + `zur Bora-Falle.`
          : ` Eine Einschränkung dazu: Fällt der Luftdruck stark (ab etwa 2 bis 3 hPa in drei Stunden), `
            + `nähert sich der Tiefdruckkern. Nach dessen Passage dreht der Wind auf Nord bis Ost und `
            + `frischt böig auf. Dann wird das Jugo-Asyl in den Kanälen zur Bora-Falle.`)
        + ` Am Ende einer Jugo-Lage stehen oft Schauer oder heftige Gewitter mit der Kaltfront; zieht das `
        + `Tief mit seinem Kern über die Adria hinweg, folgt nicht selten eine kräftige Bora.`
        + ((syn?.sichtMin ?? Infinity) < SICHT_DIESIG_M
          ? ` Zur Sicht passt es: Die Vorhersage kommt entlang der Route auf bis zu `
            + `${Math.round(syn!.sichtMin! / 100) * 100} m herunter. Bei Jugo trägt zusätzlich Saharastaub `
            + `zur Trübung bei.`
          : ` Rechnet mit diesigem Wetter und Saharastaub. Der Wüstensand landet regelmäßig auf dem Deck.`)
        + ((syn?.taupunkt ?? 0) >= 17
          ? ` Der Taupunkt von ${nf(syn!.taupunkt!, 0)} °C passt zur bekannten Begleiterscheinung: Die `
            + `Kleidung wird feucht-klamm, es tropft von Segel und Takelage, an Deck wird es rutschig.`
          : '') };
    }

    if (inArc(d, 280, 340) && v >= 7 && v <= 20 && gf < 1.5) {
      const frueh = hatZeit && stunde < 10;
      const sued = lat < 43.0;
      return { key: 'Maestral', text: `<b>Maestral</b>: der thermische Nordwestwind, der nachmittags einsetzt, wenn sich die `
        + `Küste stärker erwärmt als das Meer. Der angenehmste Wind des Reviers: verlässlich, `
        + `mäßig, bei schönem Wetter, und er schläft am Abend wieder ein. `
        + `Von Ende Juni bis August ist er an der Ostküste so beständig, dass man den Törn nach ihm plant: `
        + `tagsüber West bis Nordwest um 4 Beaufort, mittags und nachmittags auch einmal 5.`
        + (frueh
          ? ` Zur gewählten Ablegezeit um ${uhrLt(b.departure)} steht er noch nicht: Morgens weht `
            + `nur eine schwache Brise, direkt unter der Küste sogar ablandig als thermischer Landwind. `
            + `Wer früh los will, legt unter Segeln ab und nutzt die Landbrise, statt sie zu vermotoren. `
            + `Der Maestral setzt sich erst am späten Vormittag durch.`
          : ` Der Tagesrhythmus: morgens schwach oder ablandig, am späten Vormittag setzt sich der `
            + `Seewind durch, nachmittags das Maximum, abends schläft er wieder ein.`)
        + (sued
          ? ` Im Süden der Adria ist bei anhaltender Maestral-Lage mit höherem Seegang zu rechnen als im `
            + `Norden. Der Wind hat den längeren Weg hinter sich.`
          : '')
        + (b.beatShare > 0.4
          ? ` Weil hier gekreuzt wird: Auf der freien Adria fernab der Ostküste weht der Maestral rund `
            + `1 Beaufort schwächer, und an der italienischen Küste kommt der Wind dank thermischer `
            + `Seebrise sogar aus östlichen Richtungen. Wer unter Zeitdruck nach Norden muss, sollte `
            + `durchrechnen, ob der Wechsel auf die italienische Seite nicht das schnellere Bein ist.`
          : '')
        + ` Dass die Schönwetterlage hält, erkennt man abends daran, dass der Dunst bleibt, die `
        + `Quellwolken über Land in sich zusammenfallen und der Seewind schläfrig wird oder dicht unter `
        + `der Küste von einer Landbrise abgelöst wird.` };
    }

    if (inArc(d, 340, 25) && v >= 12) {
      return { key: 'Tramontana', text: `<b>Tramontana</b>: kühler Nordwind über der Adria, „von jenseits der Berge kommend". `
        + `Das Absinken der kühlen Luftmasse auf der Leeseite des Gebirges macht sie außerordentlich `
        + `trocken: meist sonniges Wetter und brillante Sicht. Genau das ist aber auch der Haken: die `
        + `subtropische Sonne schichtet die Luft labil, und der ohnehin turbulente ablandige Wind wird `
        + `dadurch noch böiger, als die Mittelwerte vermuten lassen. `
        + `Adriatische Tramontana-Lagen halten nur wenige Tage, dann kehrt die Maestral-Sommerlage zurück.` };
    }
  }

  const loddosSaison = monat === 4 || monat === 5 || monat === 10 || monat === 11;
  if (inBox(lat, lon, 36.0, 37.5, 27.0, 29.6) && inArc(d, 130, 210) && loddosSaison && v >= 14) {
    return { key: 'Loddos', text: `<b>Loddos</b> („Schwalbensturm"): Süd bis Südost an der Südwestecke Kleinasiens zwischen `
        + `Oktober und Mai passt zu einer der übelsten Lagen dieses Reviers. Ein kleines, oft `
        + `unscheinbares Tief brandet gegen das Hoch über Anatolien, kommt kurz vor der türkischen `
        + `Küste nicht mehr voran, und das Druckgefälle dazwischen verschärft sich. Betroffen ist die `
        + `Küste vom Golf von Mandalya bis zwischen Kaş und Kastelorizo.`
        + ` Ein bis zwei Tage mit 6 bis 8 Beaufort, Böen über 50 kn, vereinzelt orkanartig. `
        + `Die Küstengebirge trimmen den Süd auf Südost und beschleunigen ihn zusätzlich.`
        + ` <b>Das Heimtückische:</b> Der Luftdruck fällt nur leicht bis mäßig, 1 bis 2 hPa in drei `
        + `Stunden. Die Lage sieht harmlos aus. Dann dreht der Wind zurück auf Südost, eine Richtung, `
        + `mit der man an diesen Küsten nicht rechnet, und frischt sehr rasch auf Sturmstärke auf.`
        + ` <b>Und die Häfen helfen nicht:</b> Die vielen meltemisicheren Buchten und Häfen im Norden `
        + `dieser Zone bieten gegen den Loddos keinerlei Schutz. Zu den wenigen, die es tun, zählen `
        + `Palamut und Körmen auf der Datça-Halbinsel, Bozburun und die Milta Marina bei Bodrum.`
        + ` An der ganzen Küste herrscht dabei Legerwall mit grober, durch Reflexionen an Kaps und `
        + `Inseln wild durcheinanderlaufender See; 4 bis 5 m hohe Wellen sind keine Seltenheit.`
        + ` Weitere Vorzeichen: Die thermischen Winde bleiben aus, die Sicht verschlechtert sich, die `
        + `Berggipfel hüllen sich in Wolkenhauben, und die Dünung nimmt erst aus westlicher, später aus `
        + `südlicher Richtung zu.` };
  }

  if (inBox(lat, lon, 34.5, 41.5, 22.5, 28.8)) {

    const dodekanes = inBox(lat, lon, 35.8, 36.95, 26.6, 28.6);
    const sektor: [number, number] = dodekanes ? [260, 340]
      : (lat >= 39 ? [15, 75] : (lat >= 37 ? [335, 45] : [290, 360]));
    if (monat >= 5 && monat <= 10 && inArc(d, sektor[0], sektor[1]) && v >= 12) {
      const lage = dodekanes ? 'aus West bis Nordwest'
        : lat >= 39 ? 'nordöstlich' : (lat >= 37 ? 'nördlich' : 'nordwestlich');
      const hochsaison = monat >= 6 && monat <= 9;
      const nachts = hatZeit && (stunde >= 20 || stunde < 6);
      return { key: 'Meltemi', text: `<b>Meltemi</b> (Etesien): Richtung, Stärke und Jahreszeit passen zum Sommerwind der Ägäis, `
        + `der hier ${lage} einsetzt. Er entsteht zwischen einem Hoch über dem Balkan und einem `
        + `Hitzetief über Kleinasien${hochsaison ? ' und weht von Ende Juni bis Mitte September am stärksten' : ''}. `
        + `Er bringt klare Sicht und trockene Luft, baut aber im offenen Wasser rasch kurze, steile Wellen auf. `
        + `Zwischen den Inseln und an Kaps düst er deutlich stärker, als die Fläche vermuten lässt; `
        + `auf ablandigen Ankerplätzen ist Slippen der Anker ein bekanntes Problem.`
        + (dodekanes
          ? ` Im Dodekanes weht er am kräftigsten: 4 bis 6 Beaufort, wobei 6 häufiger gemessen wird als 4. `
            + `Bekommt er eine mehr östliche Komponente, gerät die Region in den Windschatten des `
            + `anatolischen Hochlands und es weht deutlich schwächer.`
          : '')

        + ` <b>Nachts weht er schwächer</b>, auf freier See um 1 bis 2 Beaufort. In der Nähe größerer `
        + `Landflächen kann ein 5er zur Nacht auf eine schwache Brise schrumpfen oder ganz dem Landwind `
        + `weichen, besonders in der türkischen Ägäis, daher der alte Name Somniculares, „der Schläfrige".`
        + (nachts ? ` Die gewählte Ablegezeit um ${uhrLt(b.departure)} liegt genau in diesem ruhigeren Fenster.` : '')
        + ` Typisch sind seine Pulsationen: eine Zeit lang schwächer als normal, dann wieder besonders `
        + `lebhaft. Der Übergang von der moderaten in die Starkwindphase geht oft abrupt. Vier bis sechs `
        + `Stunden reichen. Eine solche Phase hält ein bis maximal drei Tage.`
        + ((syn?.druckNiveau ?? 0) >= DRUCK_NIVEAU_MELTEMI_STARK
          ? ` <b>Achtung:</b> Der Luftdruck steht bei ${nf(syn!.druckNiveau!, 0)} hPa. Ein anhaltender `
            + `Anstieg auf ein für die Jahreszeit ungewöhnlich hohes Niveau, 1018 hPa und mehr, gilt als `
            + `Zeichen einer mehrtägigen starken Meltemi-Phase mit Sturmpotenzial.`
          : '')
        + druckSatz(syn, 'anstieg', DRUCK_ANSTIEG_STARKWIND)
        + ` Wo es zuerst stürmisch wird: in den Kykladen und im Dodekanes, wobei die Kykladen oft 12 bis `
        + `24 Stunden früher dran sind, und auf der Strecke Kap Sounion, Kea, Andros. `
        + `Düsen mit 2 bis 3 Beaufort Zugabe liegen zwischen Euböa und Andros (Doro-Kanal), Kea und `
        + `Kythnos, Paros und Naxos (diese Düse reicht bis Ios) sowie zwischen Chios und Çeşme. `
        + `Im Doro-Kanal kann die Driftströmung bei starkem Meltemi bis zu 7 kn erreichen; das steht in `
        + `keinem Strommodell dieser Vorhersage.`
        + ` Zum Ankern: Fjordähnliche Buchten mit Nord-Süd-Ausrichtung sind bei aufziehendem `
        + `Starkwind-Meltemi zu meiden, ebenso Buchten, auf die Täler von Norden oder Osten zulaufen. `
        + `Sie können in kürzester Zeit vom Windloch zur Starkwind-Düse werden, gerade nachts.`
        + ` Der Seegang bleibt dank der Inseln als Wellenbrecher verhältnismäßig moderat für diesen Wind, `
        + `dafür kurz und steil. Am höchsten läuft die See zwischen Limnos, Chios, Ikaria, Andros und `
        + `Skyros, vor der Nordküste Kretas sowie zwischen Kreta, Karpathos und Rhodos.` };
    }

    if (inArc(d, 130, 200) && v >= 10) {
      const randsaison = monat === 5 || monat === 10;
      return { key: 'Notos', text: `<b>Notos</b> (Sirokos): südlicher, warmer und feuchter Wind. In der Ägäis steht er `
        + `typischerweise im Vorfeld eines herannahenden Tiefausläufers: Der Meltemi schläft ein, der `
        + `Wind dreht auf südliche Richtungen, es wird ausgesprochen diesig, und Deck und Takelage `
        + `werden durch Taubildung feucht. Er weht gleichmäßig ohne nennenswerte Böen, meist mit `
        + `2 bis 4 Beaufort.`
        + ` <b>Er ist unangenehmer, als die Zahlen aussehen.</b> Der einsetzende Südwind läuft gegen den `
        + `alten Meltemi-Seegang und wühlt die See auf, teils mit durcheinanderlaufenden Wellenzügen. `
        + `Die See wird bockig. Dazu kommt: Auf der Meltemi-Seite der Küsten und Inseln gibt es weniger `
        + `Häfen als auf deren Südseite, also steht bei Süd vor vielen Hafeneinfahrten eine hohe See und `
        + `im Becken ein entsprechender Schwell.`
        + (randsaison
          ? ` Im Mai und Oktober kann es kräftiger wehen. Dann werden die klassischen Norddüsen, etwa `
            + `die Straße zwischen Naxos und Paros, zu Süddüsen, die man besser meidet.`
          : '')
        + ` Als kritisch bei Süd gelten Besike Liman im Nordosten der Ägäis, die Kapsáli- und die `
        + `Agios-Nikolaos-Bucht von Kythira sowie das Innere des Lakonischen Golfs.`
        + ` Das Drehbuch danach ist immer dasselbe: Mit kräftigen, teils gewittrigen Schauern und Böen `
        + `aus Südwest bis West überquert die Kaltfront das Revier, die Sicht bessert sich schlagartig, `
        + `dann dreht der Wind über Nordwest auf Nord bis Nordost und frischt auf. Der Meltemi ist zurück.`
        + druckSatz(syn, 'fall', DRUCK_FALL_KALTFRONT)
        + ((syn?.sichtMin ?? Infinity) < SICHT_DIESIG_M
          ? ` Die diesige Sicht steht schon in der Vorhersage: bis auf rund `
            + `${Math.round(syn!.sichtMin! / 100) * 100} m herunter.`
          : '') };
    }
  }

  if (inBox(lat, lon, 34.0, 37.6, 28.6, 36.5)) {
    const westlichFinike = lon < 30.2;
    const imbatSaison = monat >= 5 && monat <= 10;

    if (imbatSaison && inArc(d, 135, 300) && v >= 8 && v <= 24) {
      return { key: 'Imbat', text: `<b>Imbat</b>: der thermische Seewind der türkischen Riviera, einer der zuverlässigsten `
        + `des Mittelmeers. Er erhebt sich am frühen bis mittleren Vormittag mit dem Sog des Hitzetiefs `
        + `über dem anatolischen Hinterland, weht mit 2 bis 4 Beaufort, in großen Buchten wie den Golfen `
        + `von Antalya und Mersin nachmittags auch einmal mit 5, und schläft in den späten Abendstunden `
        + `ein. Die Richtung bestimmt der örtliche Küstenverlauf; meist kommt er aus südlichen Richtungen.`
        + ` <b>Fürs Routenlegen entscheidend ist seine Reichweite:</b> je nach Zusammenspiel von See- und `
        + `Talwinden 5 bis 20 sm. Weiter draußen auf See weht es schwächer und variabler. Hier ist der `
        + `küstennahe Weg der windsichere, nicht der freie.`
        + (westlichFinike
          ? ` Westlich der Bucht von Finike macht sich die Nähe zum Meltemi-Revier bemerkbar: tagsüber `
            + `3 bis 4 Beaufort aus West bis Westsüdwest, bei starkem Meltemi vorübergehend 5 bis 6. `
            + `Im Golf von Fethiye und nördlich von Rhodos kann es dann dicht unter der Küste zu `
            + `heftigen Fallböen aus West bis Nordwest kommen.`
          : '')
        + ` Nachts und morgens weht es deutlich schwächer; in geschützter Lage entwickelt sich eine `
        + `Landbrise von 1 bis 2 Beaufort, wo Taleinschnitte an die Küste reichen auch 3. Wehen starke `
        + `nördliche Höhenwinde über das Gebirge, schmuggeln sich Fallböen von 5 bis 7 Beaufort in die `
        + `gleichmäßige Landbrise. Bekannt aus der Bucht von Finike, dem Inneren des Golfs von Antalya `
        + `und dem Golf von İskenderun, wo der Fallwind Ragne heißt.` };
    }
  }

  if (inBox(lat, lon, 38.0, 43.9, 2.0, 10.0)) {
    if (inArc(d, 290, 20) && v >= 14) {

      const winterhalb = monat <= 4 || monat >= 10;
      return { key: 'Mistral', text: `<b>Mistral</b>: Nord bis Nordwest passt zum kalten Fallwind, den ein Genuatief `
        + `zusammen mit hohem Druck über der Biskaya durch das Rhonetal auf das Meer hinausdrückt. `
        + `Er hält typischerweise zwei bis drei Tage an, gelegentlich bis zu zwei Wochen. `
        + `Mit einem Abflauen über Nacht ist also nicht zu rechnen. `
        + `${winterhalb ? 'In der kalten Jahreshälfte erreicht er 40 bis 50 kn in den Böen, in Spitzen über 60 kn. '
          : 'Im Sommer liegen die Böen bei 28 bis 40 kn. '}`
        + `<b>Entscheidend ist, wo er am stärksten weht:</b> nicht unter Land, sondern draußen. `
        + `Die Zone extremer Stärke zieht als schmale Zunge von Marseille nach Südosten Richtung `
        + `Nordsardinien und Balearen, oft nur wenige bis einige Dutzend Meilen breit, dafür über `
        + `100 Meilen lang, mit dem Maximum in der Mitte des Golfs. Vom Golfe du Lion weit ab der `
        + `Küste zu queren, ist deshalb der klassische Fehler. Wer vor dem Wind nach Südosten `
        + `abläuft, bleibt unter Umständen genau in dieser Zone. `
        + `Nach Süden reichen die Ausläufer bis zu den Balearen; die Welle steht im ganzen `
        + `Seegebiet nördlich davon, auch wenn der Wind dort schon nachlässt.` };
    }
  }

  if ((inBox(lat, lon, 34.5, 40.0, 12.0, 22.5) && imMeer(lat, lon, '28f'))) {
    if (inArc(d, 20, 100) && v >= 12) {
      const westen = lon < 17.5;
      return { key: 'Gregale', text: `<b>Gregale</b>: Nordost passt zu einer Schlechtwetterlage mit hohem Druck über `
        + `Mitteleuropa und dem Balkan und tiefem Druck weiter im Süden des Mittelmeers. Typisch sind `
        + `4 bis 5 Beaufort über zwei bis drei Tage, und es ist verhältnismäßig kühl für die Jahreszeit.`
        + (westen
          ? ` <b>Im Westen und Süden dieses Seegebiets ist er ernst zu nehmen:</b> hoher Seegang, `
            + `anhaltende Regenfälle, außerordentlich schlechte Sicht, dazu Legerwall-Gefahr und Schwell `
            + `in den italienischen Häfen. Berüchtigt sind der äußerste Süden der kalabrischen Küste, die `
            + `Straße von Messina (dort steht ein voller Nordoststurm) und die sizilianische Küste von `
            + `Messina bis Taormina, wo Bergkette und Ätna als Leitplanke wirken. Wer diese Küstendüse `
            + `mit Südkurs hinter sich hat, verliert die Abschattung durch Kalabrien und läuft in eine `
            + `zunehmend grobe See. In den Gewässern um Malta zählt der Gregale zu den am meisten `
            + `gefürchteten Wetterlagen überhaupt.`
          : ` Im Norden und Osten des Ionischen Meeres bleibt es dabei teils sonnig bei mäßiger bis guter `
            + `Sicht, und außer Fallböen bei einigen westgriechischen Inseln birgt die Lage hier keine `
            + `besonderen Gefahren. Im Westen und Süden dagegen stehen hoher Seegang, Regen und sehr `
            + `schlechte Sicht.`) };
    }
  }

  if ((inBox(lat, lon, 35.5, 40.0, 17.5, 22.5) && imMeer(lat, lon, '28f'))) {
    if (inArc(d, 290, 350) && v >= 8 && v <= 22) {
      const nachsaison = monat >= 9;
      return { key: 'Maistro', text: `<b>Maistro</b>: der Nordwestwind des Ionischen Meeres, benannt seit venezianischer Zeit `
        + `nach dem „Meister" der Sommerwinde. Auf freier See weht er vorherrschend aus Nord bis Nordwest `
        + `mit 3 bis 4 Beaufort, sehr zuverlässig und gleichmäßig. `
        + `In Landnähe übernimmt ein gut entwickeltes Land-Seewindsystem die Regie: nachts und morgens `
        + `ablandig, ab dem Vormittag bis zum Abend auflandig, der Grund, warum man dort früh ablegt und `
        + `früh festmacht. An den griechischen Ostküsten verstärken diese Seewinde den Maistro; sie haben `
        + `dort einen eigenen Namen: Emvatis.`
        + ` Gut entwickelt sind sie im Süden des Ambrakischen Golfes und in den Golfen von Kyparissia `
        + `und Messenien.`
        + ` Auffrischen kann der Schönwetterwind auf 5 bis 6 Beaufort durch Kanalisierung (im Kanal von `
        + `Korfu und in den Engen zwischen Lefkas, Ithaka und Kefalonia), durch den Leitplankeneffekt `
        + `an der Südwestküste von Lefkas und durch Fallböen im Lee der gebirgigen Inseln, etwa zwischen `
        + `Kalamos und Kastos.`
        + (nachsaison
          ? ` Zur Nachsaison hin wird die Luftbewegung unruhiger, das Böenrisiko steigt.`
          : ` Bei normaler sommerlicher Maistro-Lage ist der Seegang in diesem Revier kein Thema; `
            + `gröber wird es allenfalls an der westlichen Peloponnes-Küste, die den längeren Windweg `
            + `abbekommt.`) };
    }
  }

  return null;
}

function localWindVollEn(b: LokalwindLage, monat: number, syn?: Synoptik | null): LokalwindErgebnis | null {
  const d = b.avgWindDir, v = b.maxWind, gf = b.gustFactor;
  const lat = b.midLat, lon = b.midLon;
  const hatZeit = b.departure instanceof Date && !Number.isNaN(b.departure.getTime());
  const stunde = hatZeit ? b.departure.getUTCHours() : 12;

  if (v < 8 && !(boraNurAusBoeen(b) && (inBox(lat, lon, 39.5, 46.0, 12.0, 20.5) && imMeer(lat, lon, '28g')))) return null;

  if ((inBox(lat, lon, 39.5, 46.0, 12.0, 20.5) && imMeer(lat, lon, '28g'))) {
    const boraBoeen = boraNurAusBoeen(b);
    if ((inArc(d, 20, 90) && v >= 14 && (gf >= 1.45 || v >= 22)) || boraBoeen) {
      const heftig = gf >= 1.5;
      const ausserhalbFenster = hatZeit && (stunde < 11 || stunde >= 17);
      const boeenVorsatz = boraBoeen
        ? `The model shows only ${nf(v, 0, 'en')} kn mean wind, but gusts to ${nf(b.maxGust!, 0, 'en')} kn `
          + `(gust factor ${nf(gf, 1, 'en')}) from north to east-north-east. Exactly this gustiness is the `
          + `hallmark of the Bora, and close to land it can blow markedly harder than the model shows. `
        : '';
      return { key: 'Bora', text: boeenVorsatz + `<b>Bora</b>: direction${heftig ? ' and gustiness' : ''} match the katabatic wind `
        + `that sends cold air plunging off the Dinaric Alps into the Adriatic. It sets in abruptly and blows in `
        + `fierce squalls${heftig ? ` (gust factor ${nf(gf, 1, 'en')})` : ''}, usually under a clear sky. `
        + `In a Bora situation the wind can freshen from Force 1 to Force 7 in under an hour `
        + `and ease just as fast. `
        + `It builds a short, steep sea and tears spray into the air, cutting visibility. `
        + `It is strongest close to land (the Velebit Channel, the Kvarner, Makarska) and eases further south. `
        + `Close to shore it can blow markedly harder than the model's coarse grid shows.`
        + ` <b>The dilemma:</b> close under the coast the gusts are fiercest, but the offshore Bora there `
        + `leaves no notable sea. Further out it blows weaker and steadier, but the sea gets rougher mile by `
        + `mile offshore. Fleeing the Bora toward the Italian coast is not worth it: a rough sea with `
        + `lee-shore danger awaits there in brisk northerlies.`
        + ` Typical duration two, at most three days; in summer it sometimes stays at just one day and `
        + `barely more than Force 5 (borino). In May, September and October, longer spells with severe `
        + `storm gusts are possible.`
        + (ausserhalbFenster
          ? ` On timing: the Bora blows strongest at the start of the outbreak, especially the following `
            + `night and the next morning; between 1100 and 1700 LT it often eases. Shifting berth at `
            + `${uhrLt(b.departure)} falls outside this calmer window.`
          : ` The timing works in your favour: between 1100 and 1700 LT the Bora often blows less strongly `
            + `than usual, which is why this window is chosen for shifting berth.`)
        + ` Two side effects the model does not show: the strong offshore wind locally lowers the `
        + `water level by more than half a metre (factor that in where the berth is shallow), and it `
        + `also accelerates the water in the straits; in the Kvarner, currents of up to 4 kn are possible `
        + `in a strong Bora.`
        + ` Good anchorages have open water to the west and south; classic Bora refuges are the channels `
        + `of Zadar and Srednji, the lee sides of Unije, Lošinj, Premuda, Dugi Otok, Kornat and Mljet, the `
        + `west side of Hvar, and Istria's west coast.`
        + druckSatz(syn, 'anstieg', DRUCK_ANSTIEG_STARKWIND, 'en')
        + (hellDunkel(syn) === 'hell'
          ? ' The largely clear sky matches the anticyclonic Bora chiara: fine weather, brilliant '
            + 'visibility, but cooler than usual.'
          : hellDunkel(syn) === 'dunkel'
            ? ' The heavy cloud cover matches the cyclonic Bora scura instead, bringing occasionally '
              + 'thundery rain in the southern Adriatic.'
            : '') };
    }

    if (inArc(d, 200, 290) && v >= 14 && ohneFrontanzeichen(syn)) {
      return { key: 'Libeccio', text: `South-west to west is the direction of the <b>Libeccio</b> (Croatian `
        + `Garbin, also called Nevera or Neverin in Dalmatia), but today's situation does not match: no `
        + `notable pressure fall, largely clear sky. The Libeccio comes with a thundery cold front and then `
        + `breaks in without warning at Force 6 to 8. Keep an eye on the warning signs: the wind backs to `
        + `north-east through south-east without freshening notably, the air turns humid, tall cumulus builds `
        + `over the coast, and a blue-black wall of cloud pushes in from the west. Many Croatian ports of `
        + `refuge are built for the Bora and offer no shelter from the south-west to west.` };
    }

    if (inArc(d, 200, 290) && v >= 14) {
      const sued = lat < 43.0;
      return { key: 'Libeccio', text: `<b>Libeccio</b> (Croatian Garbin, also called Nevera or Neverin in `
        + `Dalmatia), south-west to west matches the wind of a thundery `
        + `cold-front passage. It typically breaks in without warning at Force 6 to 8 and eases again while `
        + `backing slightly right; it rarely blows longer than two to three hours. `
        + `If a strong pressure fall precedes the front, gusts of Force 9 and above are to be expected.`
        + ` <b>The critical point:</b> many Croatian ports of refuge are built for the Bora, that is, for `
        + `the north-east. They offer no shelter against a storm from the south-west to west. Looking for `
        + `one only once it breaks finds nothing.`
        + (sued
          ? ` South of Dubrovnik the Libeccio is considered the most dangerous wind of all: it is often `
            + `preceded by fine weather and an unusually calm sea, and the coast offers hardly any deeply `
            + `cut bays as refuge. The sea area can turn in under an hour.`
          : ` In the second half of the sailing season, especially violent Libeccio events have been `
            + `observed in the eastern Adriatic.`)
        + ` The warning signs: the wind backs to north-east through south-east without freshening `
        + `notably, the air turns humid, tall cumulus builds over the coast, and high cloud fields race `
        + `in from the south-west above it. Finally a blue-black wall of cloud pushes in from the west.`
        + druckSatz(syn, 'fall', DRUCK_FALL_KALTFRONT, 'en')
        + ` An hourly forecast smooths a front this short away. The gust figures above are not an `
        + `upper limit here.` };
    }

    if (inArc(d, 100, 165) && v >= 12) {
      const nord = lat >= 44.0;
      const gleichmaessig = gf < 1.4;
      return { key: 'Jugo', text: `<b>Jugo</b> (Sirocco): south-east matches the warm, humid wind out of `
        + `North Africa. It builds more slowly than the Bora and announces itself through falling `
        + `pressure, thickening cloud and rain. So there is time to find a harbour. It typically builds `
        + `over several days: barely more than a breath from the south-east on the first day, a light `
        + `breeze on the second, a moderate breeze on the third, gradually backing from south-east to `
        + `south. A Jugo situation lasts two to four days.`
        + (gleichmaessig
          ? ` The steady wind without pronounced gusts (gust factor ${nf(gf, 1, 'en')}) fits this.`
          : ` The high gust factor (${nf(gf, 1, 'en')}), however, does not fit the Jugo, which blows very `
            + `steadily. This points instead to a situation already laced with thunderstorms.`)
        + ` <b>The sea state is the real issue:</b> the wind's fetch runs exactly along the Adriatic's `
        + `axis, and the Jugo uses the full fetch of 420 NM. The sea grows steadily `
        + `higher toward the north, and the northern Adriatic's water levels rise well above normal at `
        + `the same time.`
        + (nord
          ? ` In the Gulf of Venice the Jugo rarely blows more than Force 3 to 4, but the swell has `
            + `teeth: on the shallow coasts between Grado and Chioggia, a ground sea up to 4 m high `
            + `builds against the lee shore.`
          : '')
        + ` Avoid the Italian side: very poor visibility, high swell with lee-shore risk, and off the `
        + `east coast of the Gargano and between Marcelli and Ancona the Jugo freshens to Force 5 to 6 `
        + `through the corner-jet effect of the mountains. The classic route in a heavy Jugo instead runs `
        + `close under the mainland coast through the channels: the Kvarner, the channels of Zadar and `
        + `Pašman to Cape Ploča, then Vis or the Pakleni Islands, Korčula and Mljet.`
        + ((syn?.druckFall3h ?? 0) >= DRUCK_FALL_JUGO_FALLE
          ? ` <b>Warning, this route does not hold today:</b> air pressure is falling by `
            + `${nf(syn!.druckFall3h!, 1, 'en')} hPa in three hours. That points to an approaching `
            + `low-pressure core; after it passes, the wind usually backs to north through east and `
            + `freshens in gusts. The Jugo refuge in the channels then turns into a Bora trap.`
          : ` One caveat: if pressure falls sharply (from roughly 2 to 3 hPa in three hours), a `
            + `low-pressure core is approaching. After it passes, the wind backs to north through east `
            + `and freshens in gusts. The Jugo refuge in the channels then turns into a Bora trap.`)
        + ` A Jugo situation often ends in showers or violent thunderstorms with the cold front; if the `
        + `low's core tracks right across the Adriatic, a strong Bora not infrequently follows.`
        + ((syn?.sichtMin ?? Infinity) < SICHT_DIESIG_M
          ? ` This matches the visibility: the forecast drops to as low as `
            + `${Math.round(syn!.sichtMin! / 100) * 100} m along the route. In a Jugo, Saharan dust adds `
            + `to the haze as well.`
          : ` Expect hazy weather and Saharan dust. Desert sand regularly settles on deck.`)
        + ((syn?.taupunkt ?? 0) >= 17
          ? ` The dew point of ${nf(syn!.taupunkt!, 0, 'en')} °C matches the well-known side effect: `
            + `clothing turns damp and clammy, sail and rigging drip, the deck gets slippery.`
          : '') };
    }

    if (inArc(d, 280, 340) && v >= 7 && v <= 20 && gf < 1.5) {
      const frueh = hatZeit && stunde < 10;
      const sued = lat < 43.0;
      return { key: 'Maestral', text: `<b>Maestral</b>: the thermal north-westerly that sets in during `
        + `the afternoon, once the coast warms more than the sea. The most pleasant wind in the region: `
        + `reliable, moderate, under fine weather, and it dies down again in the evening. `
        + `From late June to August it is so consistent along the eastern coast that trips are planned `
        + `around it: west to north-west around Force 4 during the day, occasionally Force 5 around `
        + `midday and in the afternoon.`
        + (frueh
          ? ` At the chosen departure time of ${uhrLt(b.departure)} it is not up yet: only a light `
            + `breeze blows in the morning, right under the coast even offshore as a thermal land breeze. `
            + `Anyone leaving early departs under sail and uses the land breeze rather than motoring `
            + `through it. The Maestral only takes hold from late morning onward.`
          : ` The daily rhythm: light or offshore in the morning, the sea breeze takes hold in late `
            + `morning, peaks in the afternoon, and dies down again in the evening.`)
        + (sued
          ? ` In the southern Adriatic, a sustained Maestral situation brings higher seas than in the `
            + `north. The wind has covered the longer fetch.`
          : '')
        + (b.beatShare > 0.4
          ? ` Because you are beating here: out on the open Adriatic, away from the eastern coast, the `
            + `Maestral blows around Force 1 weaker, and off the Italian coast the wind, thanks to the `
            + `thermal sea breeze, even comes from easterly directions. Anyone under time pressure heading `
            + `north should work out whether switching to the Italian side is not in fact the faster leg.`
          : '')
        + ` That the fine-weather pattern is holding shows in the evening: the haze stays, the cumulus `
        + `over land collapses in on itself, and the sea breeze either grows drowsy or is replaced close `
        + `under the coast by a land breeze.` };
    }

    if (inArc(d, 340, 25) && v >= 12) {
      return { key: 'Tramontana', text: `<b>Tramontana</b>: a cool north wind over the Adriatic, `
        + `"coming from beyond the mountains". The cool air mass sinking on the mountains' lee side makes `
        + `it exceptionally dry: mostly sunny weather and brilliant visibility. That, however, is also the `
        + `catch: the subtropical sun destabilises the air, and the already-turbulent offshore wind grows `
        + `gustier as a result than the mean figures suggest. `
        + `Adriatic Tramontana situations last only a few days before the summer Maestral pattern returns.` };
    }
  }

  const loddosSaison = monat === 4 || monat === 5 || monat === 10 || monat === 11;
  if (inBox(lat, lon, 36.0, 37.5, 27.0, 29.6) && inArc(d, 130, 210) && loddosSaison && v >= 14) {
    return { key: 'Loddos', text: `<b>Loddos</b> ("swallow storm"): south to south-east at the `
        + `south-west corner of Asia Minor between October and May matches one of the nastiest situations in `
        + `this region. A small, often unremarkable low pushes against the high over Anatolia, stalls `
        + `just short of the Turkish coast, and the pressure gradient between them sharpens. Affected is `
        + `the coast from the Gulf of Mandalya to between Kaş and Kastellorizo.`
        + ` One to two days of Force 6 to 8, gusts over 50 kn, occasionally hurricane-force. `
        + `The coastal mountains trim the south wind to south-east and accelerate it further.`
        + ` <b>The insidious part:</b> pressure falls only slightly to moderately, 1 to 2 hPa in three `
        + `hours. The situation looks harmless. Then the wind backs to south-east, a direction not `
        + `expected on these coasts, and freshens very quickly to storm force.`
        + ` <b>And the harbours do not help:</b> the many Meltemi-safe bays and harbours in the north of `
        + `this zone offer no shelter at all against the Loddos. Among the few that do are Palamut and `
        + `Körmen on the Datça peninsula, Bozburun and Milta Marina near Bodrum.`
        + ` A lee shore prevails along the whole coast, with a rough sea running wildly confused from `
        + `reflections off headlands and islands; waves of 4 to 5 m are not unusual.`
        + ` Further warning signs: the thermal winds fail to appear, visibility worsens, the mountain `
        + `summits wrap themselves in cloud caps, and swell picks up first from the west, later from the `
        + `south.` };
  }

  if (inBox(lat, lon, 34.5, 41.5, 22.5, 28.8)) {
    const dodekanes = inBox(lat, lon, 35.8, 36.95, 26.6, 28.6);
    const sektor: [number, number] = dodekanes ? [260, 340]
      : (lat >= 39 ? [15, 75] : (lat >= 37 ? [335, 45] : [290, 360]));
    if (monat >= 5 && monat <= 10 && inArc(d, sektor[0], sektor[1]) && v >= 12) {
      const lage = dodekanes ? 'from west to north-west'
        : lat >= 39 ? 'from the north-east' : (lat >= 37 ? 'from the north' : 'from the north-west');
      const hochsaison = monat >= 6 && monat <= 9;
      const nachts = hatZeit && (stunde >= 20 || stunde < 6);
      return { key: 'Meltemi', text: `<b>Meltemi</b> (Etesian winds): direction, strength and season `
        + `match the Aegean's summer wind, which sets in here ${lage}. It forms between a high over the `
        + `Balkans and a heat low over Asia Minor${hochsaison ? ', and blows strongest from late June to '
          + 'mid-September' : ''}. It brings clear visibility and dry air, but quickly builds a short, `
        + `steep sea in open water. Between the islands and off headlands it funnels noticeably stronger `
        + `than the open sea suggests; on offshore-facing anchorages, dragging anchor is a well-known `
        + `problem.`
        + (dodekanes
          ? ` In the Dodecanese it blows strongest: Force 4 to 6, with Force 6 measured more often than `
            + `Force 4. Once it picks up more of an easterly component, the region falls into the lee of `
            + `the Anatolian plateau and blows markedly weaker.`
          : '')
        + ` <b>At night it blows weaker</b>, around Force 1 to 2 in the open sea. Near larger landmasses, `
        + `a Force 5 can shrink to a light breeze overnight or give way entirely to the land breeze, `
        + `especially in the Turkish Aegean, hence the old name Somniculares, "the sleepy one".`
        + (nachts ? ` The chosen departure time of ${uhrLt(b.departure)} falls right within this calmer window.` : '')
        + ` Its pulsations are typical: weaker than normal for a while, then especially lively again. `
        + `The transition from the moderate into the strong-wind phase is often abrupt. Four to six `
        + `hours is enough. Such a phase lasts one to at most three days.`
        + ((syn?.druckNiveau ?? 0) >= DRUCK_NIVEAU_MELTEMI_STARK
          ? ` <b>Warning:</b> pressure stands at ${nf(syn!.druckNiveau!, 0, 'en')} hPa. A sustained rise `
            + `to a level unusually high for the season, 1018 hPa and above, is considered a sign of a `
            + `multi-day strong Meltemi phase with storm potential.`
          : '')
        + druckSatz(syn, 'anstieg', DRUCK_ANSTIEG_STARKWIND, 'en')
        + ` Where it turns stormy first: in the Cyclades and the Dodecanese, with the Cyclades often 12 `
        + `to 24 hours ahead, and on the stretch Cape Sounion–Kea–Andros. Funnels adding Force 2 to 3 lie `
        + `between Evia and Andros (the Doro Channel), Kea and Kythnos, Paros and Naxos (this funnel `
        + `reaches as far as Ios) and between Chios and Çeşme. In the Doro Channel the drift current can `
        + `reach up to 7 kn in a strong Meltemi; no current model in this forecast shows that.`
        + ` For anchoring: fjord-like bays running north–south should be avoided as a strong Meltemi `
        + `builds, as should bays with valleys running down to them from the north or east. They can turn `
        + `from a wind hole into a strong-wind funnel in very little time, especially at night.`
        + ` Thanks to the islands acting as breakwaters, the sea state stays comparatively moderate for `
        + `this wind, if short and steep. The sea runs highest between Limnos, Chios, Ikaria, Andros and `
        + `Skyros, off the north coast of Crete, and between Crete, Karpathos and Rhodes.` };
    }

    if (inArc(d, 130, 200) && v >= 10) {
      const randsaison = monat === 5 || monat === 10;
      return { key: 'Notos', text: `<b>Notos</b> (Sirokos): a southerly, warm and humid wind. In the `
        + `Aegean it typically appears ahead of an approaching trough: the Meltemi dies down, the wind `
        + `backs to southerly directions, it turns distinctly hazy, and dew forms on deck and rigging. `
        + `It blows steadily with no notable gusts, mostly Force 2 to 4.`
        + ` <b>It is more unpleasant than the numbers suggest.</b> The onset of the southerly runs `
        + `against the old Meltemi sea and churns it up, at times with wave trains running confused `
        + `against each other. The sea turns choppy and awkward. On top of that: the Meltemi-facing side `
        + `of the coasts and islands has fewer harbours than their southern side, so in a southerly a `
        + `heavy sea often stands right off many harbour entrances, with matching swell inside the basin.`
        + (randsaison
          ? ` In May and October it can blow harder. The classic north-facing funnels, such as the `
            + `strait between Naxos and Paros, then turn into south-facing funnels that are better `
            + `avoided.`
          : '')
        + ` Considered critical in a southerly are Besike Liman in the north-east Aegean, the Kapsali `
        + `and Agios Nikolaos bays of Kythira, and the interior of the Laconian Gulf.`
        + ` What follows afterward is always the same script: the cold front crosses the region with `
        + `strong, at times thundery showers and gusts from south-west to west, visibility improves `
        + `abruptly, then the wind backs through north-west to north through north-east and freshens. `
        + `The Meltemi is back.`
        + druckSatz(syn, 'fall', DRUCK_FALL_KALTFRONT, 'en')
        + ((syn?.sichtMin ?? Infinity) < SICHT_DIESIG_M
          ? ` The hazy visibility already shows in the forecast: down to as low as roughly `
            + `${Math.round(syn!.sichtMin! / 100) * 100} m.`
          : '') };
    }
  }

  if (inBox(lat, lon, 34.0, 37.6, 28.6, 36.5)) {
    const westlichFinike = lon < 30.2;
    const imbatSaison = monat >= 5 && monat <= 10;
    if (imbatSaison && inArc(d, 135, 300) && v >= 8 && v <= 24) {
      return { key: 'Imbat', text: `<b>Imbat</b>: the thermal sea breeze of the Turkish Riviera, one of `
        + `the most reliable in the Mediterranean. It rises in the early to mid-morning, drawn by the heat `
        + `low over the Anatolian hinterland, blows Force 2 to 4, occasionally Force 5 in the afternoon in `
        + `large bays such as the Gulfs of Antalya and Mersin, and dies down in the late evening. `
        + `Direction is set by the local coastline; it mostly comes from southerly directions.`
        + ` <b>What matters for route-planning is its reach:</b> 5 to 20 NM depending on the interplay of `
        + `sea and valley winds. Further out to sea it blows weaker and more variable. Here the `
        + `coast-hugging route is the wind-reliable one, not the open one.`
        + (westlichFinike
          ? ` West of the Bay of Finike, the proximity to the Meltemi's territory makes itself felt: `
            + `Force 3 to 4 from west to west-south-west during the day, temporarily Force 5 to 6 in a `
            + `strong Meltemi. In the Gulf of Fethiye and north of Rhodes, fierce williwaws from west to `
            + `north-west can then strike close under the coast.`
          : '')
        + ` At night and in the morning it blows noticeably weaker; in sheltered spots a land breeze of `
        + `Force 1 to 2 develops, Force 3 where valleys reach the coast. When strong northerly upper winds `
        + `blow over the mountains, williwaws of Force 5 to 7 smuggle themselves into the otherwise `
        + `steady land breeze. Known from the Bay of Finike, the interior of the Gulf of Antalya, and `
        + `the Gulf of İskenderun, where the katabatic wind is called the Ragne.` };
    }
  }

  if (inBox(lat, lon, 38.0, 43.9, 2.0, 10.0)) {
    if (inArc(d, 290, 20) && v >= 14) {
      const winterhalb = monat <= 4 || monat >= 10;
      return { key: 'Mistral', text: `<b>Mistral</b>: north to north-west matches the cold katabatic `
        + `wind that a low over Genoa, together with high pressure over the Bay of Biscay, drives out to `
        + `sea through the Rhône valley. It typically lasts two to three days, occasionally up to two `
        + `weeks. So an overnight let-up is not to be expected. `
        + `${winterhalb ? 'In the cold half of the year it reaches 40 to 50 kn in gusts, with peaks above 60 kn. '
          : 'In summer, gusts run 28 to 40 kn. '}`
        + `<b>What matters is where it blows strongest:</b> not close to land, but out at sea. The zone `
        + `of extreme strength runs as a narrow tongue from Marseille south-east toward northern Sardinia `
        + `and the Balearics, often only a few to some dozen miles wide, but over 100 miles long, with its `
        + `maximum in the middle of the gulf. Crossing the Gulf of Lion well offshore is therefore the `
        + `classic mistake. Running downwind to the south-east can, under some circumstances, keep you `
        + `right inside this zone. `
        + `Its reach extends south to the Balearics; the sea state stands throughout the whole area north `
        + `of there, even where the wind itself is already easing.` };
    }
  }

  if ((inBox(lat, lon, 34.5, 40.0, 12.0, 22.5) && imMeer(lat, lon, '28f'))) {
    if (inArc(d, 20, 100) && v >= 12) {
      const westen = lon < 17.5;
      return { key: 'Gregale', text: `<b>Gregale</b>: north-east matches a spell of bad weather with `
        + `high pressure over central Europe and the Balkans and low pressure further south in the `
        + `Mediterranean. Typical is Force 4 to 5 over two to three days, and it runs comparatively cool `
        + `for the season.`
        + (westen
          ? ` <b>In the west and south of this sea area it must be taken seriously:</b> a heavy sea, `
            + `sustained rain, exceptionally poor visibility, plus lee-shore danger and swell in the `
            + `Italian harbours. Notorious are the extreme south of the Calabrian coast, the Strait of `
            + `Messina (a full north-easterly gale stands there) and the Sicilian coast from Messina to `
            + `Taormina, where the mountain range and Etna act as a corner-jet. Once past this coastal `
            + `funnel on a southerly course, you lose the shelter of Calabria and run into an increasingly `
            + `rough sea. In the waters around Malta, the Gregale ranks among the most feared weather `
            + `situations of all.`
          : ` In the north and east of the Ionian Sea it stays at times sunny with moderate to good `
            + `visibility, and apart from williwaws off a few western Greek islands, the situation holds `
            + `no particular dangers here. In the west and south, by contrast, a heavy sea, rain and very `
            + `poor visibility prevail.`) };
    }
  }

  if ((inBox(lat, lon, 35.5, 40.0, 17.5, 22.5) && imMeer(lat, lon, '28f'))) {
    if (inArc(d, 290, 350) && v >= 8 && v <= 22) {
      const nachsaison = monat >= 9;
      return { key: 'Maistro', text: `<b>Maistro</b>: the north-westerly of the Ionian Sea, named since `
        + `Venetian times after the "master" of the summer winds. Out at sea it prevails from north to `
        + `north-west at Force 3 to 4, very reliable and steady. `
        + `Close to land, a well-developed land/sea-breeze system takes over: offshore at night and in `
        + `the morning, onshore from mid-morning until evening. The reason boats depart early and make `
        + `fast early there. Along the Greek east coasts these sea breezes reinforce the Maistro; there `
        + `they carry their own name: Emvatis.`
        + ` Well developed in the south of the Ambracian Gulf and in the Gulfs of Kyparissia and `
        + `Messenia.`
        + ` This fine-weather wind can freshen to Force 5 to 6 through funnelling (in the Corfu Channel `
        + `and the narrows between Lefkas, Ithaka and Kefalonia), through the corner-jet effect off the `
        + `south-west coast of Lefkas, and through williwaws in the lee of the mountainous islands, for `
        + `instance between Kalamos and Kastos.`
        + (nachsaison
          ? ` Toward the end of the season, the airflow turns more unsettled and the gust risk rises.`
          : ` In a normal summer Maistro situation, sea state is not an issue in this region; it turns `
            + `rougher at most off the western Peloponnese coast, which catches the longer fetch.`) };
    }
  }

  return null;
}
