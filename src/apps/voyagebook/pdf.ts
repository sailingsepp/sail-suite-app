import type { jsPDF } from 'jspdf';
import { ohneRevierkunde } from '@/briefing/overview';
import { tagesbericht } from '@/briefing/tagesbericht';
import { werteSpurAus, type Fix, type SpurPunkt, type Luecke } from '@/core/spur';
import { nachtBilanz } from '@/core/nacht';
import { durchschnittKn, fahrtagReihe, type Toernbilanz } from '@/core/toernbilanz';
import { ablegeOrtAusVorlauf } from '@/core/ortsmarken';
import { antriebsbilanz, wechselAusEintraegen, antriebAbschnitte, type AntriebWechsel, type Antrieb } from '@/core/antriebsbilanz';
import { anteil } from '@/core/navigatorbericht';
import { laufzeitSeitBeginn } from '@/core/motorstunden';
import { dieselJeStunde } from '@/core/dieselverbrauch';
import { nf, uhrzeitInZone, hhmmInZone, datumInZone, tagInZone } from '@/core/time';
import { sicher, sicherUnicode, PDF_COPYRIGHT, linkStellenJeZeile } from '@/core/pdfText';
import { bindeSchriftEin, SCHRIFT } from '@/data/pdfSchrift';
import { eintragArtName, eintragInhalt } from '@/core/logbuchText';
import type { Fahrt, LogEintrag, Ortsmarke, Toern } from '@/data/logdb';
import { bilderVon } from '@/data/logdb';
import { verkleinere } from '@/data/bild';
import type { Kartenbild } from '@/data/kartenbild';
import { waehleAusschnitt, imBild } from '@/core/kachelkarte';
import type { Sprache } from '@/core/types';
import type { ToernZeile, CrewEintrag } from '@/data/toernApi';
import { funktionWortKern } from '@/core/crewFunktion';
import { seeflagge, flaggeDesToerns, FLAGGE_B, FLAGGE_H } from '@/core/seeflaggen';

const TINTE: [number, number, number] = [11, 30, 45];
const GRAU: [number, number, number] = [96, 114, 124];
const TEAL: [number, number, number] = [26, 122, 116];
const TEAL_HELL: [number, number, number] = [45, 168, 160];
const AMBER: [number, number, number] = [176, 118, 24];
const AMBER_HELL: [number, number, number] = [242, 169, 59];
const HAARLINIE: [number, number, number] = [205, 214, 219];
const ZEILE_HELL: [number, number, number] = [243, 247, 248];
const KOPF_TEXT: [number, number, number] = [220, 230, 234];

const RAND = 18;
const BREITE = 210;
const SPALTE = BREITE - 2 * RAND;

type Texte = Record<string, string>;

const WORTE: Record<Sprache, Texte> = {
  de: {
    tagesblatt: 'Logbuchblatt', toernblatt: 'Törnbilanz', toernbericht: 'Törnbericht', fortsetzung: 'Fortsetzung',
    toernAbschnitt: 'Törn', zeitraum: 'Zeitraum', alleSchlaege: 'Alle Tagesschläge', gesamt: 'Der ganze Törn',
    sp_name: 'Name', sp_funktion: 'Funktion', sp_tag: 'Tag', startpunkt: 'Start', endpunkt: 'Ende',
    motorZaehler: 'Motorstunden (Zähler)', dieselGetankt: 'Diesel getankt',
    dieselJeStunde: 'Verbrauch unter Maschine',
    dieselHinweis: 'Verbrauch = getankte Liter geteilt durch die aufgezeichnete Zeit unter Maschine ({h} h), nicht durch die Zählerstunden. Getankt ist nicht verbraucht.',
    fahrtag: 'Fahrtag', ablegezeit: 'Ablegezeit', anlegezeit: 'Anlegezeit', ankerzeit: 'Ankerzeit',
    strecke: 'Strecke über Grund', fahrzeit: 'Fahrzeit', gesamtzeit: 'Gesamtzeit',
    schnitt: 'Ø Fahrt', maxSog: 'Höchste Fahrt', fahrtage: 'Fahrtage',
    segel: 'Unter Segeln', motor: 'Unter Maschine',
    nachtfahrten: 'Nachtfahrten', nachtansteuerungen: 'Nachtansteuerungen',
    etappen: 'Etappen', eintraege: 'Logbuch', pausen: 'Pausen', luecken: 'Aufzeichnungslücken', crewFotos: 'Fotos der Crew', ohneOrt: 'ohne Ortsangabe',
    von: 'von', nach: 'nach', schiff: 'Schiff', crew: 'Crew', revier: 'Revier',
    keineEintraege: 'Keine Einträge.',
    lueckeHinweis: 'In diesen Zeiträumen wurde nicht aufgezeichnet. Die dabei zurückgelegte Strecke fehlt in der Summe.',
    ohneAufzeichnung: 'nicht aufgezeichnet',
    unterschriftSkipper: 'Schiffsführerin / Schiffsführer',
    unterschriftCrew: 'Bewerberin / Bewerber',
    ortDatum: 'Ort, Datum',
    fuss: 'Aufgezeichnet mit TörnNavLog · Sail-Suite. Kein rechtsgültiges Logbuch: anerkannt wird die Unterschrift, nicht die Datei.',
    copyright: PDF_COPYRIGHT.de,
    strecken: 'Strecke über Grund aus GPS-Positionen, nicht Loggenstrecke durchs Wasser.',
    wetterkopf: 'Wetterlage am Ablegeort (Vorhersage beim Ablegen)',
    fotos: 'Fotos',
    nord: 'N',
    leg_segel: 'unter Segeln', leg_motor: 'unter Maschine', leg_offen: 'ohne Angabe', leg_luecke: 'Aufzeichnungslücke',
    hoheit: 'Hoheitsgewässer', awz: 'AWZ',
    kartenQuelle: '© OpenStreetMap-Mitwirkende',
    kartenQuelleSee: '© OpenStreetMap-Mitwirkende · Seezeichen © OpenSeaMap',
    toern: 'Törn',
    skipper: 'Skipper', 'co-skipper': 'Co-Skipper', navigator: 'Navigator',
    'skipper.w': 'Skipperin', 'skipper.m': 'Skipper', 'co-skipper.w': 'Co-Skipperin', 'co-skipper.m': 'Co-Skipper',
    'navigator.w': 'Navigatorin', 'navigator.m': 'Navigator',
    smutje: 'Smutje', deckshand: 'Deckshand', pax: 'Pax',
    sp_datum: 'Datum', sp_orte: 'von / nach', sp_sm: 'sm', sp_zeit: 'Fahrzeit', sp_nacht: 'Nacht',

    crewblatt: 'Crewliste',
    crewblattHinweis: 'Angaben aus den Profilen der Crewmitglieder bzw. vom Törnverwalter ergänzt: keine amtlich beglaubigte Liste.',
    geburtsdatum: 'Geburtsdatum', staatsbuergerschaft: 'Staatsbürgerschaft', passnummer: 'Passnummer',
    sp_vorname: 'Vorname', sp_nachname: 'Nachname', sp_rolle: 'Rolle',
  },
  en: {
    tagesblatt: 'Log sheet', toernblatt: 'Voyage summary', toernbericht: 'Voyage report',
    fortsetzung: 'continued',
    toernAbschnitt: 'Voyage', zeitraum: 'Period', alleSchlaege: 'All legs', gesamt: 'The whole voyage',
    sp_name: 'Name', sp_funktion: 'Role', sp_tag: 'Day', startpunkt: 'Start', endpunkt: 'End',
    motorZaehler: 'Engine hours (meter)', dieselGetankt: 'Diesel bunkered',
    dieselJeStunde: 'Consumption under engine',
    dieselHinweis: 'Consumption = litres bunkered divided by the recorded time under engine ({h} h), not by the hour meter. Bunkered is not burned.',
    fahrtag: 'Sailing day', ablegezeit: 'Cast off', anlegezeit: 'Moored', ankerzeit: 'Anchored',
    strecke: 'Distance over ground', fahrzeit: 'Time under way', gesamtzeit: 'Total time',
    schnitt: 'Avg. speed', maxSog: 'Max. speed', fahrtage: 'Sailing days',
    segel: 'Under sail', motor: 'Under engine',
    nachtfahrten: 'Night passages', nachtansteuerungen: 'Night approaches',
    etappen: 'Legs', eintraege: 'Logbook', pausen: 'Stops', luecken: 'Recording gaps', crewFotos: 'Crew photos', ohneOrt: 'no position',
    von: 'from', nach: 'to', schiff: 'Vessel', crew: 'Crew', revier: 'Sailing area',
    keineEintraege: 'No entries.',
    lueckeHinweis: 'Nothing was recorded during these periods. The distance covered then is missing from the sum.',
    ohneAufzeichnung: 'not recorded',
    unterschriftSkipper: 'Master',
    unterschriftCrew: 'Applicant',
    ortDatum: 'Place, date',
    fuss: 'Recorded with SailPilot · Sail-Suite. Not a legally valid logbook: the signature counts, not the file.',
    copyright: PDF_COPYRIGHT.en,
    strecken: 'Distance over ground from GPS positions, not log distance through the water.',
    wetterkopf: 'Weather at the departure point (forecast at cast-off)',
    fotos: 'Photos',
    nord: 'N',
    leg_segel: 'under sail', leg_motor: 'under engine', leg_offen: 'not stated', leg_luecke: 'recording gap',
    hoheit: 'Territorial waters', awz: 'EEZ',
    kartenQuelle: '© OpenStreetMap contributors',
    kartenQuelleSee: '© OpenStreetMap contributors · Seamarks © OpenSeaMap',
    toern: 'Voyage',
    skipper: 'Skipper', 'co-skipper': 'Co-skipper', navigator: 'Navigator',
    'skipper.w': 'Skipper', 'skipper.m': 'Skipper', 'co-skipper.w': 'Co-skipper', 'co-skipper.m': 'Co-skipper',
    'navigator.w': 'Navigator', 'navigator.m': 'Navigator',
    smutje: 'Cook', deckshand: 'Deckhand', pax: 'Pax',
    sp_datum: 'Date', sp_orte: 'from / to', sp_sm: 'NM', sp_zeit: 'Under way', sp_nacht: 'Night',
    crewblatt: 'Crew list',
    crewblattHinweis: 'Details from the crew members\' own profiles, or added by the voyage manager. Not an officially certified list.',
    geburtsdatum: 'Date of birth', staatsbuergerschaft: 'Nationality', passnummer: 'Passport number',
    sp_vorname: 'First name', sp_nachname: 'Last name', sp_rolle: 'Role',
  },
};

export { sicher };

let FONT = 'helvetica';
let tx: (t: string) => string = sicher;

async function schriftFuer(d: jsPDF): Promise<void> {
  const ok = await bindeSchriftEin(d);
  FONT = ok ? SCHRIFT : 'helvetica';
  tx = ok ? sicherUnicode : sicher;
}

function setz(d: jsPDF, f: [number, number, number]): void {
  d.setTextColor(f[0], f[1], f[2]);
}
function strich(d: jsPDF, f: [number, number, number]): void {
  d.setDrawColor(f[0], f[1], f[2]);
}

function zeichneFlagge(d: jsPDF, code: string | undefined, x: number, y: number, h: number): number {
  const fl = seeflagge(code);
  if (!fl) return 0;
  const m = h / FLAGGE_H;
  const farbe = (hex: string) => d.setFillColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  for (const f of fl.formen) {
    farbe(f.f);
    if ('r' in f) d.rect(x + f.r[0] * m, y + f.r[1] * m, f.r[2] * m, f.r[3] * m, 'F');
    else if ('c' in f) d.circle(x + f.c[0] * m, y + f.c[1] * m, f.c[2] * m, 'F');
    else {
      const [a, ...rest] = f.p;
      const schritte = rest.map(([px, py], i) => {
        const [vx, vy] = i === 0 ? a! : rest[i - 1]!;
        return [(px - vx) * m, (py - vy) * m];
      });
      d.lines(schritte, x + a![0] * m, y + a![1] * m, [1, 1], 'F', true);
    }
  }
  d.setDrawColor(150, 150, 150);
  d.setLineWidth(0.1);
  d.rect(x, y, FLAGGE_B * m, h, 'S');
  return FLAGGE_B * m;
}

function schreib(
  d: jsPDF, s: string | string[], x: number, y: number, opt?: Parameters<jsPDF['text']>[3],

  quelle?: string,
): void {
  const zeilen = Array.isArray(s) ? s.map(tx) : tx(s);
  d.text(zeilen, x, y, opt);
  const liste = Array.isArray(zeilen) ? zeilen : [zeilen];
  const hoehe = d.getFontSize() * 0.3528;
  verlinke(d, liste, x, y, hoehe * (opt?.lineHeightFactor ?? d.getLineHeightFactor()), opt, quelle);
}

function verlinke(
  d: jsPDF, zeilen: string[], x: number, y: number, zeilenabstand: number, opt?: Parameters<jsPDF['text']>[3], quelle?: string,
): void {
  if (opt?.align && opt.align !== 'left') return;
  if (opt?.charSpace) return;
  const hoehe = d.getFontSize() * 0.3528;
  for (const l of linkStellenJeZeile(zeilen, quelle ?? zeilen.join(' '))) {
    const z = zeilen[l.zeile]!;
    const links = x + d.getTextWidth(z.slice(0, l.start));
    d.link(links, y + l.zeile * zeilenabstand - hoehe * 0.8, d.getTextWidth(z.slice(l.start, l.ende)), hoehe, { url: l.url });
  }
}

let zone: string | undefined;

function smEinheit(sprache: Sprache): string {
  return sprache === 'en' ? 'NM' : 'sm';
}

function uhr(t: number, _sprache: Sprache): string {
  return uhrzeitInZone(t, _sprache, zone);
}
function datum(t: number, sprache: Sprache): string {
  return datumInZone(t, sprache, { day: '2-digit', month: 'long', year: 'numeric' }, zone);
}
const tagMonat = (t: number, sprache: Sprache): string => datumInZone(t, sprache, { day: '2-digit', month: '2-digit' }, zone);
function dauer(s: number): string {
  const g = Math.max(0, Math.round(s));
  const h = Math.floor(g / 3600);
  const m = Math.floor((g % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')} h` : `${m} min`;
}

function kompass(d: jsPDF, x: number, y: number, r: number): void {
  strich(d, AMBER);
  d.setLineWidth(0.4);
  d.circle(x, y, r);
  d.setFillColor(TEAL[0], TEAL[1], TEAL[2]);

  d.triangle(x, y - r * 0.85, x + r * 0.22, y, x, y + r * 0.85, 'F');
  d.setFillColor(AMBER[0], AMBER[1], AMBER[2]);
  d.circle(x, y, r * 0.11, 'F');
}

function kopf(d: jsPDF, titel: string, unter: string, rechts: string, toern?: string): number {
  const hoehe = toern ? 38 : 32;
  d.setFillColor(TINTE[0], TINTE[1], TINTE[2]);
  d.rect(0, 0, BREITE, hoehe, 'F');
  kompass(d, RAND + 6, 15, 6);

  d.setFont(FONT, 'bold');
  d.setFontSize(20);
  setz(d, [255, 255, 255]);
  schreib(d, titel, RAND + 17, 17);

  d.setFont(FONT, 'normal');
  d.setFontSize(9);
  setz(d, KOPF_TEXT);
  schreib(d, rechts, BREITE - RAND, 17, { align: 'right' });

  let y = 24;
  if (toern) {
    d.setFont(FONT, 'bold');
    d.setFontSize(11.5);
    setz(d, AMBER_HELL);
    schreib(d, toern, RAND + 17, y);
    y += 6;
  }
  if (unter) {
    d.setFont(FONT, 'normal');
    d.setFontSize(9);
    setz(d, KOPF_TEXT);
    const zeilen = d.splitTextToSize(tx(unter), SPALTE - 17) as string[];
    schreib(d, zeilen.slice(0, 2), RAND + 17, y);
  }

  d.setFillColor(TEAL_HELL[0], TEAL_HELL[1], TEAL_HELL[2]);
  d.rect(0, hoehe, BREITE, 1.1, 'F');
  return hoehe + 11;
}

function tagesTitel(d: jsPDF, y: number, titel: string, strecke: string, absatz = ''): number {
  d.setFont(FONT, 'bold');
  d.setFontSize(22);
  setz(d, TINTE);
  schreib(d, titel, RAND, y + 2);
  y += 10;
  if (strecke) {
    d.setFont(FONT, 'normal');
    d.setFontSize(14);
    setz(d, TEAL);
    const zeilen = d.splitTextToSize(tx(strecke), SPALTE) as string[];
    schreib(d, zeilen.slice(0, 2), RAND, y);
    y += zeilen.slice(0, 2).length * 6.5;
  }

  if (absatz) {
    y += 1;
    d.setFont(FONT, 'normal');
    d.setFontSize(9.5);
    setz(d, TINTE);
    const zeilen = d.splitTextToSize(tx(absatz), SPALTE) as string[];
    schreib(d, zeilen, RAND, y, { lineHeightFactor: 1.4 }, tx(absatz));
    y += (zeilen.length - 1) * 9.5 * 1.4 * 0.3528 + 5;
  }
  return y + 5;
}

const UNTEN = 268;
const OBEN = 24;
const SEITE_NUTZBAR = UNTEN - OBEN;

function platz(d: jsPDF, y: number, noetig: number): number {
  if (noetig > SEITE_NUTZBAR || y + noetig <= UNTEN) return y;
  d.addPage();
  return OBEN;
}

function platzFortgesetzt(d: jsPDF, y: number, noetig: number, fortsetzung: string): number {
  const neu = platz(d, y, noetig);
  return neu !== y ? abschnitt(d, neu, fortsetzung, noetig) : neu;
}

function fliesstext(
  d: jsPDF, y: number, text: string | string[], groesse: number, faktor = 1.4, abstand = 0,
): number {
  const zeilen = Array.isArray(text) ? text : d.splitTextToSize(tx(text), SPALTE) as string[];
  const quelle = Array.isArray(text) ? undefined : tx(text);
  const zh = groesse * faktor * 0.3528;
  if (zeilen.length * zh <= SEITE_NUTZBAR) {
    y = platz(d, y, zeilen.length * zh);
    schreib(d, zeilen, RAND, y, { lineHeightFactor: faktor }, quelle);
    return y + (zeilen.length - 1) * zh + abstand;
  }
  zeilen.forEach((z, i) => {
    if (i > 0) y += zh;
    if (y > UNTEN) { d.addPage(); y = OBEN; }
    schreib(d, z, RAND, y);
  });
  return y + abstand;
}

function abschnitt(d: jsPDF, y: number, text: string, danach = 18): number {
  y = platz(d, y, 8.5 + Math.min(danach, SEITE_NUTZBAR - 8.5));
  d.setFillColor(TEAL_HELL[0], TEAL_HELL[1], TEAL_HELL[2]);
  d.rect(RAND, y - 2.9, 1.2, 3.6, 'F');
  d.setFont(FONT, 'bold');
  d.setFontSize(8.5);
  setz(d, TEAL);
  schreib(d, text.toUpperCase(), RAND + 3.2, y, { charSpace: 0.6 });
  strich(d, HAARLINIE);
  d.setLineWidth(0.2);
  d.line(RAND, y + 2.2, BREITE - RAND, y + 2.2);
  return y + 8.5;
}

function kennzahlen(d: jsPDF, y: number, werte: [string, string][], spaltenVorgabe?: number, flach = false): number {
  const spalten = spaltenVorgabe ?? Math.min(werte.length, werte.length > 4 ? 3 : 4);
  const luft = flach ? 2.5 : 3;
  const breite = (SPALTE - (spalten - 1) * luft) / spalten;
  const hoehe = flach ? 13 : 15;

  y = platz(d, y, Math.ceil(werte.length / spalten) * (hoehe + luft));
  werte.forEach(([label, wert], i) => {
    const zeile = Math.floor(i / spalten);
    const x = RAND + (i % spalten) * (breite + luft);
    const yy = y + zeile * (hoehe + luft);
    d.setFillColor(ZEILE_HELL[0], ZEILE_HELL[1], ZEILE_HELL[2]);
    d.roundedRect(x, yy, breite, hoehe, 2, 2, 'F');
    d.setFont(FONT, 'bold');
    setz(d, TINTE);

    const platzW = breite - 7;
    let gw = flach ? 12.5 : 14;
    d.setFontSize(gw);
    while (d.getTextWidth(tx(wert)) > platzW && gw > 9) { gw -= 0.5; d.setFontSize(gw); }
    if (d.getTextWidth(tx(wert)) <= platzW) schreib(d, wert, x + 3.5, yy + (flach ? 6.2 : 7.2));
    else {
      gw = 8; d.setFontSize(gw);
      const zeilen = (d.splitTextToSize(tx(wert), platzW) as string[]).slice(0, 2);
      zeilen.forEach((z, k) => d.text(z, x + 3.5, yy + 4.4 + k * gw * 0.42));
    }

    d.setFont(FONT, 'normal');
    setz(d, TEAL);
    const text = tx(label.toUpperCase());
    const sperrung = flach ? 0.3 : 0.4;
    let groesse = flach ? 6.2 : 6.8;
    const passt = (): boolean => {
      d.setFontSize(groesse);
      return d.getTextWidth(text) + sperrung * text.length <= breite - 6;
    };
    while (!passt() && groesse > 4.8) groesse -= 0.2;
    schreib(d, label.toUpperCase(), x + 3.5, yy + (flach ? 10.6 : 12), { charSpace: sperrung });
  });
  return y + Math.ceil(werte.length / spalten) * (hoehe + luft) + 5;
}

export const KARTE_HOEHE_MM = 120;
export const KARTE_PX_PRO_MM = 5;
export const KARTE_PX = { breite: Math.round(SPALTE * KARTE_PX_PRO_MM), hoehe: KARTE_HOEHE_MM * KARTE_PX_PRO_MM };

function spurzeichnung(
  d: jsPDF, y: number, hoehe: number,
  spuren: { punkte: SpurPunkt[]; luecken: Luecke[]; nr?: number; wechsel?: readonly AntriebWechsel[] }[], w: Texte,
  karte?: Kartenbild | null,
): number {
  const alle = spuren.flatMap((sp) => sp.punkte);
  if (alle.length < 2) return y;
  const a = karte?.ausschnitt
    ?? waehleAusschnitt(alle, SPALTE * KARTE_PX_PRO_MM, hoehe * KARTE_PX_PRO_MM);
  if (!a) return y;

  y = platz(d, y, hoehe + 10);
  const mmProPx = SPALTE / a.breitePx;
  const px = (p: { lat: number; lon: number }): [number, number] => {
    const b = imBild(a, p.lat, p.lon);
    return [RAND + b.x * mmProPx, y + b.y * mmProPx];
  };

  if (karte) {
    d.addImage(karte.datenUri, 'JPEG', RAND, y, SPALTE, hoehe, undefined, 'FAST');
  } else {
    d.setFillColor(ZEILE_HELL[0], ZEILE_HELL[1], ZEILE_HELL[2]);
    d.rect(RAND, y, SPALTE, hoehe, 'F');
  }

  const segmente: { von: [number, number]; bis: [number, number]; luecke: boolean; antrieb: Antrieb | null }[] = [];
  for (const { punkte, luecken, wechsel } of spuren) {
    for (const ab of antriebAbschnitte(punkte, wechsel ?? [])) {
      for (let i = 1; i < ab.punkte.length; i++) {
        const v = ab.punkte[i - 1]!;
        const p = ab.punkte[i]!;
        segmente.push({ von: px(v), bis: px(p), luecke: luecken.some((l) => l.von >= v.t && l.bis <= p.t), antrieb: ab.antrieb });
      }
    }
  }
  strich(d, [255, 255, 255]);
  d.setLineWidth(1.8);
  d.setLineCap('round');
  for (const g of segmente) if (!g.luecke) d.line(g.von[0], g.von[1], g.bis[0], g.bis[1]);
  for (const g of segmente) {
    if (g.luecke) {
      strich(d, GRAU);
      d.setLineWidth(0.5);
      d.setLineDashPattern([1.2, 1.2], 0);
      d.line(g.von[0], g.von[1], g.bis[0], g.bis[1]);
      d.setLineDashPattern([], 0);
    } else {
      strich(d, g.antrieb === 'motor' ? AMBER : g.antrieb === 'segel' ? TEAL : GRAU);
      d.setLineWidth(0.9);
      d.line(g.von[0], g.von[1], g.bis[0], g.bis[1]);
    }
  }

  const mitSpur = spuren.filter((sp) => sp.punkte.length >= 2);
  const letzte = mitSpur[mitSpur.length - 1]!.punkte;
  const [ex, ey] = px(letzte[letzte.length - 1]!);
  d.setFillColor(TINTE[0], TINTE[1], TINTE[2]);
  d.circle(ex, ey, 1.7, 'F');
  for (const sp of mitSpur) {
    const [ax, ay] = px(sp.punkte[0]!);
    const nummer = mitSpur.length > 1 && sp.nr !== undefined;
    const r = nummer ? 2.6 : 1.8;
    d.setFillColor(255, 255, 255);
    d.circle(ax, ay, r, 'F');
    strich(d, TINTE);
    d.setLineWidth(nummer ? 0.4 : 0.6);
    d.circle(ax, ay, r - 0.2);
    if (nummer) {
      d.setFont(FONT, 'bold');
      d.setFontSize(6.5);
      setz(d, TINTE);
      schreib(d, String(sp.nr), ax, ay + 0.85, { align: 'center' });
    }
  }

  const nx = BREITE - RAND - 7;
  const ny = y + 9;
  d.setFillColor(255, 255, 255);
  d.roundedRect(nx - 3.5, ny - 7, 7, 15, 1.5, 1.5, 'F');
  strich(d, TINTE);
  d.setLineWidth(0.4);
  d.line(nx, ny + 3.5, nx, ny - 3);
  d.setFillColor(TINTE[0], TINTE[1], TINTE[2]);
  d.triangle(nx, ny - 5.5, nx - 1.4, ny - 2.2, nx + 1.4, ny - 2.2, 'F');
  d.setFont(FONT, 'bold');
  d.setFontSize(6.5);
  setz(d, TINTE);
  schreib(d, w['nord']!, nx, ny + 6.8, { align: 'center' });

  strich(d, HAARLINIE);
  d.setLineWidth(0.25);
  d.rect(RAND, y, SPALTE, hoehe);
  if (karte) {
    const nennung = karte.seezeichen ? w['kartenQuelleSee']! : w['kartenQuelle']!;
    d.setFont(FONT, 'normal');
    d.setFontSize(6);
    const b = d.getTextWidth(tx(nennung)) + 3;
    d.setFillColor(255, 255, 255);
    d.rect(BREITE - RAND - b, y + hoehe - 4, b, 4, 'F');
    setz(d, GRAU);
    schreib(d, nennung, BREITE - RAND - 1.5, y + hoehe - 1.2, { align: 'right' });
  }

  const posten: [string, [number, number, number], boolean][] = [];
  const mit = (f: (g: (typeof segmente)[number]) => boolean) => segmente.some(f);
  if (mit((g) => !g.luecke && g.antrieb === 'segel')) posten.push([w['leg_segel']!, TEAL, false]);
  if (mit((g) => !g.luecke && g.antrieb === 'motor')) posten.push([w['leg_motor']!, AMBER, false]);
  if (mit((g) => !g.luecke && g.antrieb === null)) posten.push([w['leg_offen']!, GRAU, false]);
  if (mit((g) => g.luecke)) posten.push([w['leg_luecke']!, GRAU, true]);
  if (posten.length) {
    let lx = RAND;
    const ly = y + hoehe + 4;
    d.setFont(FONT, 'normal');
    d.setFontSize(7.5);
    for (const [text, farbe, gestrichelt] of posten) {
      strich(d, farbe);
      d.setLineWidth(gestrichelt ? 0.5 : 0.9);
      if (gestrichelt) d.setLineDashPattern([1.2, 1.2], 0);
      d.line(lx, ly - 1, lx + 7, ly - 1);
      d.setLineDashPattern([], 0);
      setz(d, GRAU);
      schreib(d, text, lx + 9, ly);
      lx += 9 + d.getTextWidth(tx(text)) + 7;
    }
    return y + hoehe + 10;
  }
  return y + hoehe + 8;
}

type TabellenOpt = {
  alleLinks?: boolean;
  spaltenStil?: ('zeit' | 'art' | 'text')[];

  fortsetzung?: string;
};

function zeilenHoehe(d: jsPDF, spalten: number[], werte: string[], fett: boolean, opt: TabellenOpt = {}): number {
  const rechts = (v: string, i: number): boolean => !opt.alleLinks && i > 0 && /^[\d(]/.test(v);
  let zeilenZahl = 1;
  werte.forEach((v, i) => {
    const stil = opt.spaltenStil?.[i];
    d.setFont(FONT, fett || stil === 'art' ? 'bold' : 'normal');
    d.setFontSize(fett ? 7.2 : 8.8);
    if (!rechts(v, i)) {
      const n = (d.splitTextToSize(tx(fett ? v.toUpperCase() : v), (spalten[i] ?? 20) - 2) as string[]).length;
      zeilenZahl = Math.max(zeilenZahl, n);
    }
  });
  return (fett ? 5 : 6.2) + (zeilenZahl - 1) * 4;
}

function tabellenAnfang(d: jsPDF, spalten: number[], zeilen: string[][], kopfzeile?: string[], opt: TabellenOpt = {}): number {
  const kopf = kopfzeile ? zeilenHoehe(d, spalten, kopfzeile, true, opt) : 0;
  const hoehen = zeilen.map((z) => zeilenHoehe(d, spalten, z, false, opt));
  const ganz = kopf + hoehen.reduce((a, b) => a + b, 0);
  return ganz <= 90 ? ganz : kopf + hoehen.slice(0, 3).reduce((a, b) => a + b, 0);
}

function tabelle(
  d: jsPDF, y: number, spalten: number[], zeilen: string[][], kopfzeile?: string[],
  opt: TabellenOpt = {},
): number {
  let yy = y;
  let nr = 0;
  const ZEILENABSTAND = 4;
  const rechts = (v: string, i: number): boolean => !opt.alleLinks && i > 0 && /^[\d(]/.test(v);
  const setzeSchrift = (fett: boolean, i = 0): void => {
    const stil = opt.spaltenStil?.[i];
    d.setFont(FONT, fett || stil === 'art' ? 'bold' : 'normal');
    d.setFontSize(fett ? 7.2 : 8.8);
    setz(d, fett ? TEAL : stil === 'zeit' ? GRAU : stil === 'art' ? TEAL : TINTE);
  };

  const umbrechen = (werte: string[], fett: boolean): string[][] => werte.map((v, i) => {
    setzeSchrift(fett, i);
    const breite = spalten[i] ?? 20;
    const s2 = tx(fett ? v.toUpperCase() : v);
    return rechts(v, i) ? [s2] : (d.splitTextToSize(s2, breite - 2) as string[]);
  });
  const zeichne = (werte: string[], fett: boolean): void => {
    const zellen = umbrechen(werte, fett);
    const zeilenZahl = Math.max(1, ...zellen.map((z) => z.length));
    const hoehe = (fett ? 5 : 6.2) + (zeilenZahl - 1) * ZEILENABSTAND;
    if (!fett && nr++ % 2 === 1) {
      d.setFillColor(ZEILE_HELL[0], ZEILE_HELL[1], ZEILE_HELL[2]);
      d.rect(RAND, yy - 4.1, SPALTE, hoehe, 'F');
    }
    let x = RAND;
    werte.forEach((v, i) => {
      setzeSchrift(fett, i);
      const breite = spalten[i] ?? 20;
      const r = rechts(v, i);
      const teile = zellen[i] ?? [];
      teile.forEach((teil, k) => {
        d.text(tx(teil), r ? x + breite - 2 : x + 1.5, yy + k * ZEILENABSTAND, r ? { align: 'right' } : {});
      });

      if (!r) verlinke(d, teile.map(tx), x + 1.5, yy, ZEILENABSTAND, {}, tx(fett ? v.toUpperCase() : v));
      x += breite;
    });
    yy += hoehe;
    strich(d, HAARLINIE);
    d.setLineWidth(0.12);
    d.line(RAND, yy - 4.1, BREITE - RAND, yy - 4.1);
  };

  const ersteHoehe = zeilen[0] ? zeilenHoehe(d, spalten, zeilen[0], false, opt) : 0;
  if (kopfzeile) yy = platz(d, yy, zeilenHoehe(d, spalten, kopfzeile, true, opt) + ersteHoehe);
  if (kopfzeile) zeichne(kopfzeile, true);
  for (const z of zeilen) {
    const hoehe = 6.2 + (Math.max(1, ...umbrechen(z, false).map((x) => x.length)) - 1) * ZEILENABSTAND;
    if (yy + hoehe > UNTEN) {
      d.addPage();
      yy = OBEN;

      if (opt.fortsetzung) yy = abschnitt(d, yy, opt.fortsetzung);
      if (kopfzeile) zeichne(kopfzeile, true);
    }
    zeichne(z, false);
  }
  return yy + 3;
}

function fuss(d: jsPDF, w: Texte): void {
  const seiten = d.getNumberOfPages();
  for (let i = 1; i <= seiten; i++) {
    d.setPage(i);
    strich(d, HAARLINIE);
    d.setLineWidth(0.2);
    d.line(RAND, 280, BREITE - RAND, 280);
    d.setFont(FONT, 'normal');
    d.setFontSize(6.8);
    setz(d, GRAU);
    schreib(d, w['fuss']!, RAND, 284.5);
    if (seiten > 1) schreib(d, `${i} / ${seiten}`, BREITE - RAND, 284.5, { align: 'right' });

    if (i === seiten) schreib(d, w['copyright']!, RAND, 288.5);
  }
}

const DRUCK_KANTE = 900;

export async function bilderFuerBlatt(
  fahrt: string, fremde?: { id: string; blob: Blob }[],
): Promise<{ id: string; datenUri: string; breite: number; hoehe: number }[]> {
  const alle = fremde ?? await bilderVon(fahrt);
  const fertig: { id: string; datenUri: string; breite: number; hoehe: number }[] = [];
  for (const b of alle) {
    try {
      const klein = await verkleinere(b.blob, DRUCK_KANTE);
      fertig.push({
        id: b.id, datenUri: await alsDatenUri(klein.blob),
        breite: klein.breite, hoehe: klein.hoehe,
      });
    } catch {

    }
  }
  return fertig;
}

function alsDatenUri(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const leser = new FileReader();
    leser.onload = () => res(String(leser.result));
    leser.onerror = () => rej(leser.error);
    leser.readAsDataURL(blob);
  });
}

function unterschrift(d: jsPDF, bild: string | undefined, x: number, linie: number, maxBreite: number): void {
  if (!bild) return;
  const hoehe = 14;
  let breite = hoehe * 3;
  try {
    const eig = d.getImageProperties(bild);
    if (eig.width && eig.height) breite = Math.min((eig.width / eig.height) * hoehe, maxBreite);
  } catch {

  }
  d.addImage(bild, 'PNG', x + 2, linie - hoehe - 1, breite, hoehe, undefined, 'FAST');
}

export interface TagesblattEingabe {
  fahrt: Fahrt;
  fixe: Fix[];
  eintraege: LogEintrag[];
  orte: Ortsmarke[];
  toern?: Toern | null;
  sprache: Sprache;

  bilder?: { id: string; datenUri: string; breite: number; hoehe: number }[];

  crewFotos?: { id: string; datenUri: string; breite: number; hoehe: number; t: number; ort: string | null; von: string | null; text: string | null }[];

  toernName?: string;

  karte?: Kartenbild | null;

  tag?: {
    nr: number;
    vonOrt?: string;
    nachOrt?: string;
    ablegen?: number;
    anlegen?: number;
    anlegenArt?: string;
  };
}

function unterschriftsZeile(
  d: jsPDF, x: number, y: number, breite: number, label: string, bild?: string,
): void {
  unterschrift(d, bild, x, y, breite);
  strich(d, TINTE);
  d.setLineWidth(0.3);
  d.line(x, y, x + breite, y);
  d.setFont(FONT, 'normal');
  d.setFontSize(7.5);
  setz(d, GRAU);
  schreib(d, label.toUpperCase(), x, y + 4, { charSpace: 0.5 });
}

export async function tagesblatt(e: TagesblattEingabe): Promise<Blob> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const d = new JsPDF({ unit: 'mm', format: 'a4' });
  await schriftFuer(d);
  zeichneTagesblatt(d, e);
  fuss(d, WORTE[e.sprache]);
  return d.output('blob');
}

function zeichneTagesblatt(d: jsPDF, e: TagesblattEingabe): void {
  zone = e.fahrt.zeitzone;
  const w = WORTE[e.sprache];
  const a = werteSpurAus(e.fixe, {}, e.fahrt.manuellePausen ?? []);
  const n = nachtBilanz(a.punkte, a.luecken, a.pausen,
    a.punkte.length ? [{ t: a.punkte[a.punkte.length - 1]!.t, lat: a.punkte[a.punkte.length - 1]!.lat, lon: a.punkte[a.punkte.length - 1]!.lon }] : []);

  const ab = antriebsbilanz(a.punkte, wechselAusEintraegen(e.eintraege), a.luecken);
  const segelAnteil = anteil(ab.segelNM, ab.segelS, a.streckeNM);
  const motorAnteil = anteil(ab.motorNM, ab.motorS, a.streckeNM);

  const start = e.orte.find((o) => o.art === 'start')?.name;
  const ziel = e.orte.find((o) => o.art === 'ziel')?.name;
  const strecke = [start, ziel].every(Boolean) ? `${start} → ${ziel}` : (e.fahrt.name ?? '');

  const toernName = e.toernName ?? e.toern?.name;

  const tagT = e.eintraege.filter((x) => x.art === 'start').map((x) => x.t).sort((p, q) => p - q)[0]
    ?? e.fixe[0]?.t ?? e.fahrt.begonnen;
  let y = kopf(d, w['tagesblatt']!, e.tag ? '' : strecke, datum(tagT, e.sprache), toernName);
  const kennzahlenWerte: [string, string][] = [];
  if (e.tag) {
    const t = e.tag;
    const von = t.vonOrt ?? start;
    const nach = t.nachOrt ?? ziel;

    const zeitMitTag = (z: number): string => tagInZone(z, zone) === tagInZone(tagT, zone)
      ? uhr(z, e.sprache)
      : `${tagMonat(z, e.sprache)} ${uhr(z, e.sprache)}`;
    const pausenOrte = e.orte.filter((o) => o.art === 'pause');
    const absatz = tagesbericht({
      ...(t.ablegen !== undefined ? { ablegen: t.ablegen } : {}),
      ...(t.anlegen !== undefined ? { anlegen: t.anlegen } : {}),
      ...(t.anlegenArt !== undefined ? { anlegenArt: t.anlegenArt } : {}),
      streckeNM: a.streckeNM, fahrzeitS: a.fahrzeitS, maxSog: a.maxSog,
      segel: segelAnteil, motor: motorAnteil, offen: anteil(ab.offenNM, ab.offenS, a.streckeNM),
      wechsel: wechselAusEintraegen(e.eintraege),
      pausen: a.pausen.map((pa) => {
        const ort = pausenOrte.find((o) => Math.abs(o.t - pa.von) < 120_000)?.name;
        return { von: pa.von, bis: pa.bis, ...(ort ? { ort } : {}) };
      }),
      eintraege: e.eintraege,
      nachtfahrten: n.nachtfahrten.length,
      nachtansteuerung: n.nachtansteuerungen.length > 0,
      lueckenAnzahl: a.luecken.length,
      lueckenS: a.luecken.reduce((sum, l) => sum + l.dauer, 0),
      uhr: (z) => zeitMitTag(z),
    }, e.sprache);
    y = tagesTitel(d, y, `${w['fahrtag']} ${t.nr}`, von || nach ? `${von ?? '?'} → ${nach ?? '?'}` : strecke, absatz);
    kennzahlenWerte.push(
      [w['ablegezeit']!, t.ablegen !== undefined ? zeitMitTag(t.ablegen) : '–'],
      [w[t.anlegenArt === 'ankern' ? 'ankerzeit' : 'anlegezeit']!, t.anlegen !== undefined ? zeitMitTag(t.anlegen) : '–'],
    );
  }
  kennzahlenWerte.push(
    [w['strecke']!, nf(a.streckeNM, 1, e.sprache) + ` ${smEinheit(e.sprache)}`],
    [w['fahrzeit']!, dauer(a.fahrzeitS)],
    [w['schnitt']!, nf(a.fahrzeitS > 0 ? a.streckeNM / (a.fahrzeitS / 3600) : 0, 1, e.sprache) + ' kn'],
    [w['maxSog']!, nf(a.maxSog, 1, e.sprache) + ' kn'],
  );

  if (a.streckeNM > 0.05) {
    kennzahlenWerte.push(
      [w['segel']!, nf(segelAnteil.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`],
      [w['motor']!, nf(motorAnteil.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`],
    );
  }
  y = kennzahlen(d, y, kennzahlenWerte);

  y = spurzeichnung(d, y, KARTE_HOEHE_MM, [{ punkte: a.punkte, luecken: a.luecken, wechsel: wechselAusEintraegen(e.eintraege) }], w, e.karte);

  if (e.fahrt.wetterkopf) {

    const roh = ohneRevierkunde(e.fahrt.wetterkopf.text)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    d.setFont(FONT, 'normal');
    d.setFontSize(9);
    const zeilen = d.splitTextToSize(tx(roh), SPALTE) as string[];
    y = abschnitt(d, y, w['wetterkopf']!, zeilen.length * 9 * 1.4 * 0.3528);

    d.setFont(FONT, 'normal');
    setz(d, TINTE);
    d.setFontSize(9);
    y = fliesstext(d, y, zeilen, 9, 1.4, 10);
  }

  const pausen = e.orte.filter((o) => o.art === 'pause');
  if (a.pausen.length) {
    const pausenZeilen = a.pausen.map((p) => {
      const marke = pausen.find((o) => Math.abs(o.t - p.von) < 120_000);
      return [`${hhmmInZone(p.von, zone)}–${uhr(p.bis, e.sprache)}`, dauer(p.dauer), marke?.name ?? ''];
    });
    y = abschnitt(d, y, w['pausen']!, tabellenAnfang(d, [30, 30, 100], pausenZeilen));
    y = tabelle(d, y, [30, 30, 100], pausenZeilen, undefined, { fortsetzung: `${w['pausen']!} (${w['fortsetzung']!})` });
  }

  if (e.crewFotos?.length) {

    y = abschnitt(d, y, w['crewFotos']!, 80);
    const SPALTEN_BREITE = (SPALTE - 6) / 2;
    const sortiertF = [...e.crewFotos].sort((p, q) => p.t - q.t);
    for (let i = 0; i < sortiertF.length; i += 2) {
      const paar = sortiertF.slice(i, i + 2).map((f) => {
        let bb = SPALTEN_BREITE, bh = bb * (f.hoehe / f.breite);
        if (bh > 70) { bh = 70; bb = bh * (f.breite / f.hoehe); }
        const zeilen = [`${uhr(f.t, e.sprache)} · ${f.ort ?? w['ohneOrt']!}`, ...(f.von ? [f.von] : []), ...(f.text ? d.splitTextToSize(tx(f.text), SPALTEN_BREITE) as string[] : [])];
        return { f, bb, bh, zeilen };
      });
      const hoehe = Math.max(...paar.map((x) => x.bh + x.zeilen.length * 3.6)) + 6;
      y = platzFortgesetzt(d, y, hoehe, `${w['crewFotos']!} (${w['fortsetzung']!})`);
      paar.forEach((x, k) => {
        const bx = RAND + k * (SPALTEN_BREITE + 6);
        d.addImage(x.f.datenUri, 'JPEG', bx, y - 3.2, x.bb, x.bh);
        d.setFont(FONT, 'normal');
        d.setFontSize(8);
        setz(d, GRAU);
        schreib(d, x.zeilen.map((z) => tx(z)), bx, y + x.bh + 0.8, { lineHeightFactor: 1.3 });
      });
      y += hoehe;
    }
  }

  const zuBild = new Map((e.bilder ?? []).map((b) => [b.id, b]));
  const tag = tagInZone(tagT, zone);

  const zeit = (t: number): string => tagInZone(t, zone) === tag ? uhr(t, e.sprache)
    : `${tagMonat(t, e.sprache)} ${uhr(t, e.sprache)}`;
  const LOG_SPALTEN = [21, 36, SPALTE - 57];
  const LOG_STIL: ('zeit' | 'art' | 'text')[] = ['zeit', 'art', 'text'];
  const sortiert = [...e.eintraege].sort((x, z) => x.t - z.t);

  const ersteEintraege = sortiert.slice(0, 3).filter((x) => !(x.art === 'foto' && x.bild && zuBild.has(x.bild)))
    .map((x) => [zeit(x.t), eintragArtName(x.art, e.sprache, x.liegeart), eintragInhalt(x.art, x.text, e.sprache)]);
  const erstesFoto = sortiert[0]?.art === 'foto' && sortiert[0].bild && zuBild.has(sortiert[0].bild);
  y = abschnitt(d, y, w['eintraege']!, erstesFoto ? 60
    : Math.max(8, tabellenAnfang(d, LOG_SPALTEN, ersteEintraege, undefined, { alleLinks: true, spaltenStil: LOG_STIL })));
  if (!sortiert.length) {
    d.setFont(FONT, 'normal');
    d.setFontSize(9.5);
    setz(d, GRAU);
    schreib(d, w['keineEintraege']!, RAND, y);
    y += 8;
  }
  let stapel: string[][] = [];
  const leere = (): void => {
    if (stapel.length) y = tabelle(d, y, LOG_SPALTEN, stapel, undefined, { alleLinks: true, spaltenStil: LOG_STIL, fortsetzung: `${w['eintraege']!} (${w['fortsetzung']!})` });
    stapel = [];
  };
  for (const x of sortiert) {
    const bild = x.art === 'foto' && x.bild ? zuBild.get(x.bild) : undefined;
    if (!bild) {

      const text = x.text || ablegeOrtAusVorlauf(sortiert, sortiert.indexOf(x)) || x.text;
      stapel.push([zeit(x.t), eintragArtName(x.art, e.sprache, x.liegeart), eintragInhalt(x.art, text, e.sprache)]);
      continue;
    }
    leere();

    const maxB = LOG_SPALTEN[2]! - 1.5;
    let bb = maxB;
    let bh = bb * (bild.hoehe / bild.breite);
    if (bh > 100) { bh = 100; bb = bh * (bild.breite / bild.hoehe); }
    const text = x.text ? d.splitTextToSize(tx(x.text), maxB) as string[] : [];
    const noetig = bh + 8 + text.length * 4;
    y = platzFortgesetzt(d, y, noetig, `${w['eintraege']!} (${w['fortsetzung']!})`);
    d.setFont(FONT, 'normal');
    d.setFontSize(8.8);
    setz(d, GRAU);
    schreib(d, zeit(x.t), RAND + 1.5, y);
    d.setFont(FONT, 'bold');
    setz(d, TEAL);
    schreib(d, eintragArtName('foto', e.sprache), RAND + LOG_SPALTEN[0]! + 1.5, y);
    const bx = RAND + LOG_SPALTEN[0]! + LOG_SPALTEN[1]! + 1.5;
    d.addImage(bild.datenUri, 'JPEG', bx, y - 3.2, bb, bh);
    y += bh;
    if (text.length) {
      d.setFont(FONT, 'normal');
      setz(d, TINTE);
      schreib(d, text, bx, y + 1.5);
      y += text.length * 4;
    }
    y += 6;
    strich(d, HAARLINIE);
    d.setLineWidth(0.12);
    d.line(RAND, y - 4.1, BREITE - RAND, y - 4.1);
  }
  leere();

  if (a.luecken.length) {
    const lueckenZeilen = a.luecken.map((l) => [
      `${hhmmInZone(l.von, zone)}–${uhr(l.bis, e.sprache)}`, dauer(l.dauer),
      `${nf(l.sehneNM, 1, e.sprache)} ${smEinheit(e.sprache)} (${e.sprache === 'en' ? 'straight line' : 'Luftlinie'})`,
    ]);
    y = abschnitt(d, y, w['luecken']!, tabellenAnfang(d, [46, 30, 90], lueckenZeilen) + 8);
    y = tabelle(d, y, [46, 30, 90], lueckenZeilen, undefined, { fortsetzung: `${w['luecken']!} (${w['fortsetzung']!})` });
    d.setFont(FONT, 'italic');
    d.setFontSize(8.5);
    setz(d, AMBER);
    y = fliesstext(d, y, w['lueckeHinweis']!, 8.5, 1.15, 8);
  }
  if (n.nachtfahrten.length) {
    const nachtZeilen = n.nachtfahrten.map((f) => [
      `${hhmmInZone(f.von, zone)}–${uhr(f.bis, e.sprache)}`, dauer(f.dauer), nf(f.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`,
    ]);
    y = abschnitt(d, y, w['nachtfahrten']!, tabellenAnfang(d, [46, 30, 90], nachtZeilen));
    y = tabelle(d, y, [46, 30, 90], nachtZeilen, undefined, { fortsetzung: `${w['nachtfahrten']!} (${w['fortsetzung']!})` });
  }

  y = platz(d, y, 28);
  const linie = Math.max(y + 16, 250);
  unterschriftsZeile(d, RAND, linie, SPALTE / 2 - 6,
    w['unterschriftSkipper']!, e.toern?.unterschriften?.skipper);

  d.setFont(FONT, 'italic');
  d.setFontSize(8);
  setz(d, GRAU);
  schreib(d, w['strecken']!, RAND, 274);
}

export interface ToernblattEingabe {
  toern: Toern;
  bilanz: Toernbilanz;
  sprache: Sprache;

  zeitzone?: string;
}

export async function toernblatt(e: ToernblattEingabe): Promise<Blob> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const d = new JsPDF({ unit: 'mm', format: 'a4' });
  await schriftFuer(d);
  zone = e.zeitzone;
  const w = WORTE[e.sprache];
  const b = e.bilanz;

  const zeitraum = b.von && b.bis
    ? `${datum(b.von, e.sprache)}–${datum(b.bis, e.sprache)}`
    : (e.toern.von ?? '');
  let y = kopf(d, w['toernblatt']!, '', zeitraum, e.toern.name);

  y = kennzahlen(d, y, [
    [w['strecke']!, nf(b.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`],
    [w['fahrtage']!, String(b.fahrtage)],
    [w['nachtfahrten']!, String(b.nachtfahrten)],
    [w['nachtansteuerungen']!, String(b.nachtansteuerungen)],
    [w['fahrzeit']!, dauer(b.fahrzeitS)],
    [w['schnitt']!, nf(durchschnittKn(b), 1, e.sprache) + ' kn'],
    [w['maxSog']!, nf(b.maxSog, 1, e.sprache) + ' kn'],
    [w['revier']!, e.toern.revier ?? '–'],
  ]);

  y = abschnitt(d, y, w['schiff']!, 9);
  const s = e.toern.schiff;
  const schiffzeile = [
    s?.name, s?.typ,
    s?.laengeM ? `${nf(s.laengeM, 2, e.sprache)} m` : undefined,
    s?.breiteM ? `${nf(s.breiteM, 2, e.sprache)} m` : undefined,
    s?.tiefgangM ? `${nf(s.tiefgangM, 2, e.sprache)} m` : undefined,
  ].filter(Boolean).join(' · ');
  d.setFont(FONT, 'normal');
  d.setFontSize(10);
  setz(d, TINTE);
  const flaggeB = zeichneFlagge(d, flaggeDesToerns(s, e.toern.revier), RAND, y - 3, 3.4);
  schreib(d, schiffzeile || '–', RAND + (flaggeB ? flaggeB + 2 : 0), y);
  y += 9;

  if (e.toern.crew.length) {
    const crewZeilen = e.toern.crew.map((c) => [
      `${c.vorname} ${c.nachname}`.trim(),
      w[funktionWortKern(c.funktion, c.funktionForm)] ?? c.funktion,
    ]);
    y = abschnitt(d, y, w['crew']!, tabellenAnfang(d, [90, 84], crewZeilen));
    y = tabelle(d, y, [90, 84], crewZeilen, undefined, { fortsetzung: `${w['crew']!} (${w['fortsetzung']!})` });
  }

  const ETAPPEN_SP = [10, 20, 76, 24, 26, 18];
  const etappenZeilen = b.etappen.map((et, i) => [
    String(i + 1),
    tagMonat(et.von, e.sprache),
    `${et.vonOrt ?? '–'} → ${et.nachOrt ?? '–'}`,
    nf(et.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`,
    dauer(et.fahrzeitS),
    et.nachtfahrten ? `${et.nachtfahrten}×` : (et.nachtansteuerung ? 'A' : ''),
  ]);
  const etappenKopf = ['', w['sp_datum']!, w['sp_orte']!, w['sp_sm']!, w['sp_zeit']!, w['sp_nacht']!];
  y = abschnitt(d, y, w['etappen']!, tabellenAnfang(d, ETAPPEN_SP, etappenZeilen, etappenKopf));
  y = tabelle(d, y, ETAPPEN_SP, etappenZeilen, etappenKopf, { fortsetzung: `${w['etappen']!} (${w['fortsetzung']!})` });

  if (b.lueckenAnzahl) {
    d.setFont(FONT, 'italic');
    d.setFontSize(8.5);
    setz(d, AMBER);
    y = fliesstext(d, y, w['lueckeHinweis']!, 8.5, 1.15, 9);
  }

  y = platz(d, y, 50);
  const linie = Math.max(y + 16, 236);
  const spalte = SPALTE / 2 - 6;
  unterschriftsZeile(d, RAND, linie, spalte,
    w['unterschriftSkipper']!, e.toern.unterschriften?.skipper);
  unterschriftsZeile(d, RAND + spalte + 12, linie, spalte,
    w['unterschriftCrew']!, e.toern.unterschriften?.bewerber);
  unterschriftsZeile(d, RAND, linie + 22, spalte, w['ortDatum']!);

  d.setFont(FONT, 'italic');
  d.setFontSize(8);
  setz(d, GRAU);
  schreib(d, w['strecken']!, RAND, 274);

  fuss(d, w);
  return d.output('blob');
}

const KARTE_TOERN_MAX_MM = 120;
const KARTE_TOERN_MIN_MM = 65;
const KARTE_TOERN_SEITE2_MM = 160;

export interface ToernberichtEingabe {

  toern: Toern;
  bilanz: Toernbilanz;
  sprache: Sprache;

  fahrtag: number[];

  spuren: { fixe: Fix[]; manuellePausen?: { von: number; bis: number }[]; nr: number; wechsel?: AntriebWechsel[] }[];

  gewaesser?: { hoheit: string[]; awz: string[] };

  schiffFoto?: { datenUri: string; breite: number; hoehe: number };

  karteFuer?: (breitePx: number, hoehePx: number) => Promise<Kartenbild | null>;

  tage: TagesblattEingabe[];

  startpunkt?: string;
  endpunkt?: string;
}

export function paarZeile(a: [string, string], b: [string, string]): string[][] {
  if (!a[1] && !b[1]) return [];
  return [[a[1] ? a[0] : '', a[1], b[1] ? b[0] : '', b[1]]];
}

export async function toernbericht(e: ToernberichtEingabe): Promise<Blob> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const d = new JsPDF({ unit: 'mm', format: 'a4' });
  await schriftFuer(d);

  zone = e.tage.find((t) => t.fahrt.zeitzone)?.fahrt.zeitzone;
  const w = WORTE[e.sprache];
  const b = e.bilanz;
  const t = e.toern;

  const zeitraum = b.von && b.bis
    ? `${datum(b.von, e.sprache)}–${datum(b.bis, e.sprache)}`
    : [t.von, t.bis].filter(Boolean).join('–');
  let y = kopf(d, w['toernbericht']!, '', zeitraum, t.name);

  y = abschnitt(d, y, w['toernAbschnitt']!);
  const yToern = y;

  const FOTO_B = e.schiffFoto ? 50 : 0;
  const W = SPALTE - (FOTO_B ? FOTO_B + 4 : 0);
  const s = t.schiff;
  const schiffzeile = [
    s?.name, s?.typ,
    s?.laengeM ? `${nf(s.laengeM, 2, e.sprache)} m` : undefined,
    s?.breiteM ? `${nf(s.breiteM, 2, e.sprache)} m` : undefined,
    s?.tiefgangM ? `${nf(s.tiefgangM, 2, e.sprache)} m` : undefined,
  ].filter(Boolean).join(' · ');

  const daten = paarZeile(
    [w['revier']!, t.revier ?? ''], [w['zeitraum']!, zeitraum],
  );
  const breit: string[][] = [];
  if (e.gewaesser?.hoheit.length) breit.push([w['hoheit']!, e.gewaesser.hoheit.join(', ')]);
  if (e.gewaesser?.awz.length) breit.push([w['awz']!, e.gewaesser.awz.join(', ')]);
  const randzeile = paarZeile(
    [w['startpunkt']!, e.startpunkt ?? ''], [w['endpunkt']!, e.endpunkt ?? ''],
  );

  d.setFont(FONT, 'bold');
  d.setFontSize(8.8);
  const LB = Math.max(22, Math.ceil(Math.max(...[w['revier']!, w['hoheit']!, w['awz']!, w['startpunkt']!]
    .map((x) => d.getTextWidth(tx(x)))) + 4));
  const HALB = Math.round(W / 2);
  const VIER = [LB, HALB - LB, 22, W - HALB - 22];
  const VIER_STIL: ('art' | 'text')[] = ['art', 'text', 'art', 'text'];
  if (daten.length) y = tabelle(d, y, VIER, daten, undefined, { alleLinks: true, spaltenStil: VIER_STIL });
  if (breit.length) y = tabelle(d, y, [LB, W - LB], breit, undefined, { alleLinks: true, spaltenStil: ['art', 'text'] });
  if (randzeile.length) y = tabelle(d, y, VIER, randzeile, undefined, { alleLinks: true, spaltenStil: VIER_STIL });

  if (s?.name || schiffzeile) {
    const rest = [s?.typ,
      s?.laengeM ? `${nf(s.laengeM, 2, e.sprache)} m` : undefined,
      s?.breiteM ? `${nf(s.breiteM, 2, e.sprache)} m` : undefined,
      s?.tiefgangM ? `${nf(s.tiefgangM, 2, e.sprache)} m` : undefined,
    ].filter(Boolean).join(' · ');
    y += 2;
    d.setFont(FONT, 'bold');
    d.setFontSize(7.2);
    setz(d, TEAL);
    schreib(d, w['schiff']!.toUpperCase(), RAND + 1.5, y, { charSpace: 0.5 });
    let x = RAND + LB + 1.5;
    let mehrzeilen = 0;

    const flaggeB = zeichneFlagge(d, flaggeDesToerns(s, t.revier), x, y - 3.9, 4.2);
    if (flaggeB) x += flaggeB + 2.5;
    if (s?.name) {
      d.setFont(FONT, 'bold');
      d.setFontSize(14);
      setz(d, TINTE);
      schreib(d, s.name, x, y + 0.6);
      x += d.getTextWidth(tx(s.name)) + 3;
    }
    if (rest) {
      d.setFont(FONT, 'normal');
      d.setFontSize(9.5);
      setz(d, GRAU);
      const platz = RAND + W - x;
      const zeile = d.splitTextToSize(tx(rest), platz) as string[];

      zeile.forEach((z, k) => schreib(d, z, x, y + 0.6 + k * 4.2));
      mehrzeilen = (zeile.length - 1) * 4.2;
    }
    y += 9 + mehrzeilen;
  }
  if (e.schiffFoto) {
    const f = e.schiffFoto;

    let fh = Math.min(45, Math.max(24, y - yToern - 4));
    let fb = fh * (f.breite / f.hoehe);
    if (fb > FOTO_B) { fb = FOTO_B; fh = fb * (f.hoehe / f.breite); }
    d.addImage(f.datenUri, 'JPEG', BREITE - RAND - fb, yToern - 1, fb, fh);
    y = Math.max(y, yToern - 1 + fh + 5);
  }

  if (t.crew.length) {
    const zeilen = t.crew.map((c) => [`${c.vorname} ${c.nachname}`.trim() || '–', w[funktionWortKern(c.funktion, c.funktionForm)] ?? c.funktion]);
    y = abschnitt(d, y, w['crew']!, 6 + Math.ceil(zeilen.length / (zeilen.length <= 3 ? 1 : 2)) * 6.2);
    if (zeilen.length <= 3) {
      y = tabelle(d, y, [100, SPALTE - 100], zeilen, [w['sp_name']!, w['sp_funktion']!], { alleLinks: true, fortsetzung: `${w['crew']!} (${w['fortsetzung']!})` });
    } else {

      const paare: string[][] = [];
      for (let i = 0; i < zeilen.length; i += 2) paare.push([...zeilen[i]!, ...(zeilen[i + 1] ?? ['', ''])]);
      y = tabelle(d, y, [52, 35, 52, SPALTE - 139], paare,
        [w['sp_name']!, w['sp_funktion']!, w['sp_name']!, w['sp_funktion']!], { alleLinks: true, fortsetzung: `${w['crew']!} (${w['fortsetzung']!})` });
    }
  }

  y = abschnitt(d, y, w['gesamt']!, 40);

  const werte: [string, string][] = [
    [w['strecke']!, nf(b.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`],
    [w['fahrtage']!, String(b.fahrtage)],
    [w['fahrzeit']!, dauer(b.fahrzeitS)],
    [w['schnitt']!, nf(durchschnittKn(b), 1, e.sprache) + ' kn'],
    [w['maxSog']!, nf(b.maxSog, 1, e.sprache) + ' kn'],
  ];
  if (b.nm > 0.05) {
    werte.push(
      [w['segel']!, `${nf(b.segel.nm, 1, e.sprache)} ${smEinheit(e.sprache)} · ${nf(b.segel.prozent, 0, e.sprache)} %`],
      [w['motor']!, `${nf(b.motor.nm, 1, e.sprache)} ${smEinheit(e.sprache)} · ${nf(b.motor.prozent, 0, e.sprache)} %`],
    );
  }
  if (b.nachtfahrten) werte.push([w['nachtfahrten']!, String(b.nachtfahrten)]);
  if (b.nachtansteuerungen) werte.push([w['nachtansteuerungen']!, String(b.nachtansteuerungen)]);

  const zaehler = laufzeitSeitBeginn(t.motorstunden ?? []);
  if (zaehler !== null) werte.push([w['motorZaehler']!, nf(zaehler, 1, e.sprache) + ' h']);
  const liter = t.dieselGetanktL;
  if (liter !== undefined) werte.push([w['dieselGetankt']!, nf(liter, 0, e.sprache) + ' l']);
  const jeStunde = dieselJeStunde(liter, b.motor.stunden);
  if (jeStunde !== null) werte.push([w['dieselJeStunde']!, nf(jeStunde, 1, e.sprache) + ' l/h']);
  y = kennzahlen(d, y, werte, 4, true);
  if (jeStunde !== null) {
    d.setFont(FONT, 'italic');
    d.setFontSize(7.5);
    setz(d, GRAU);
    const zeilen = d.splitTextToSize(tx(w['dieselHinweis']!.replace('{h}', nf(b.motor.stunden, 1, e.sprache))), SPALTE) as string[];
    schreib(d, zeilen, RAND, y - 2);
    y += zeilen.length * 3.2 + 1;
  }

  const spuren = e.spuren.map((sp) => {
    const a = werteSpurAus(sp.fixe, {}, sp.manuellePausen ?? []);
    return { punkte: a.punkte, luecken: a.luecken, nr: sp.nr, ...(sp.wechsel ? { wechsel: sp.wechsel } : {}) };
  });
  if (spuren.some((sp) => sp.punkte.length >= 2)) {

    let hoehe = Math.min(KARTE_TOERN_MAX_MM, Math.floor(268 - y - 10));
    if (hoehe < KARTE_TOERN_MIN_MM) {
      d.addPage();
      y = 24;
      hoehe = KARTE_TOERN_SEITE2_MM;
    }
    y = abschnitt(d, y, w['alleSchlaege']!, hoehe);
    const karte = e.karteFuer
      ? await e.karteFuer(Math.round(SPALTE * KARTE_PX_PRO_MM), Math.round(hoehe * KARTE_PX_PRO_MM)).catch(() => null)
      : null;
    y = spurzeichnung(d, y, hoehe, spuren, w, karte);
  }

  const ohne = b.tageOhneAufzeichnung ?? [];
  const reihe = fahrtagReihe(b.etappen, ohne.map((t) => t.tag));
  const zeilen: string[][] = [];
  b.etappen.forEach((et, i) => {
    for (const t of ohne.filter((o) => o.vor === i)) {
      zeilen.push([
        String(reihe.indexOf(t.tag) + 1),
        tagMonat(Date.parse(`${t.tag}T12:00:00Z`), e.sprache),
        `${t.vonOrt ?? '–'} → ${t.nachOrt ?? '–'} (${w['ohneAufzeichnung']!})`,
        `~${nf(t.sehneNM, 1, e.sprache)} ${smEinheit(e.sprache)}`,

        '–',
      ]);
    }
    zeilen.push([
      String(e.fahrtag[i] ?? i + 1),
      tagMonat(et.von, e.sprache),
      `${et.vonOrt ?? '–'} → ${et.nachOrt ?? '–'}`,
      nf(et.nm, 1, e.sprache) + ` ${smEinheit(e.sprache)}`,
      dauer(et.fahrzeitS),
    ]);
  });
  const etappenKopf = [w['sp_tag']!, w['sp_datum']!, w['sp_orte']!, w['sp_sm']!, w['sp_zeit']!];
  y = abschnitt(d, y, w['etappen']!, tabellenAnfang(d, [14, 22, 92, 24, 22], zeilen, etappenKopf));
  y = tabelle(d, y, [14, 22, 92, 24, 22], zeilen, etappenKopf, { fortsetzung: `${w['etappen']!} (${w['fortsetzung']!})` });

  if (b.lueckenAnzahl) {
    d.setFont(FONT, 'italic');
    d.setFontSize(8.5);
    setz(d, AMBER);
    y = fliesstext(d, y, w['lueckeHinweis']!, 8.5, 1.15);
  }

  for (const tag of e.tage) {
    d.addPage();
    zeichneTagesblatt(d, tag);
  }

  fuss(d, w);
  return d.output('blob');
}

function crewFeld(profil: CrewEintrag['profil'], feld: string): string {
  if (!profil || !(feld in profil)) return '–';
  return (profil as Record<string, string | undefined>)[feld] || '–';
}

export async function crewblatt(toern: ToernZeile, crew: CrewEintrag[], sprache: Sprache): Promise<Blob> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const d = new JsPDF({ unit: 'mm', format: 'a4' });
  await schriftFuer(d);
  const w = WORTE[sprache];

  let y = kopf(d, w['crewblatt']!, '', datum(Date.now(), sprache), toern.name);
  y = tabelle(d, y, [30, 30, 24, 24, 32, 26],
    crew.map((m) => [
      crewFeld(m.profil, 'vorname'),
      crewFeld(m.profil, 'nachname'),
      w[funktionWortKern(m.funktion, m.funktionForm)] ?? m.funktion,
      crewFeld(m.profil, 'geburtsdatum'),
      crewFeld(m.profil, 'staatsbuergerschaft'),
      crewFeld(m.profil, 'passnummer'),
    ]),
    [w['sp_vorname']!, w['sp_nachname']!, w['sp_rolle']!, w['geburtsdatum']!, w['staatsbuergerschaft']!, w['passnummer']!],
    { fortsetzung: `${w['crewblatt']!} (${w['fortsetzung']!})` });

  d.setFont(FONT, 'italic');
  d.setFontSize(8);
  setz(d, GRAU);
  fliesstext(d, y + 4, w['crewblattHinweis']!, 8, 1.15);

  fuss(d, w);
  return d.output('blob');
}

const KASSE_WORTE: Record<Sprache, Texte> = {
  de: {
    titel: 'Bordkassa', wem: 'Wer zahlt wem', stand: 'Stand je Person', arten: 'Ausgaben je Art', ausgaben: 'Alle Ausgaben',
    zahlungen: 'Ausgleichszahlungen', von: 'Von', an: 'An', betrag: 'Betrag', name: 'Name', saldo: 'Saldo', art: 'Art',
    datum: 'Datum', wofuer: 'Wofür', zahler: 'Bezahlt von', fuer: 'Für', inEur: 'In Euro', quitt: 'Alle sind quitt.',
    ohneKurs: 'ohne Kurs', fuerAlle: 'alle',
    hinweis: 'Fremde Währungen zum Mittelkurs vom Tag der Ausgabe (Frankfurter, gemittelt aus Referenzkursen mehrerer Zentralbanken, ohne Gewähr). Positiver Saldo: bekommt, negativer: schuldet.',
    fuss: 'Bordkassa im TörnBuch · Sail-Suite. Stand beim Erstellen des Blattes.',
  },
  en: {
    titel: 'Kitty', wem: 'Who pays whom', stand: 'Balance per person', arten: 'Expenses by type', ausgaben: 'All expenses',
    zahlungen: 'Settlements', von: 'From', an: 'To', betrag: 'Amount', name: 'Name', saldo: 'Balance', art: 'Type',
    datum: 'Date', wofuer: 'What for', zahler: 'Paid by', fuer: 'For', inEur: 'In euro', quitt: 'Everyone is square.',
    ohneKurs: 'no rate', fuerAlle: 'everyone',
    hinweis: 'Foreign currencies at the mid rate of the day of the expense (Frankfurter, averaged from several central banks\' reference rates, without guarantee). Positive balance: is owed, negative: owes.',
    fuss: 'Kitty in VoyageBook · Sail-Suite. As of the time the sheet was created.',
  },
};

export interface BordkassenEingabe {
  toernName: string;
  sprache: Sprache;

  waehrungen: { waehrung: string; saldo: [string, number][]; zahlungen: { von: string; an: string; betrag: number }[] }[];

  arten: [string, string][];

  zeilen: { datum: string; text: string; art: string; zahler: string; fuer: string; betrag: string; inEur: string }[];
  name: (id: string) => string;
  geld: (betrag: number, waehrung: string, vorzeichen?: boolean) => string;
}

export async function bordkassenblatt(e: BordkassenEingabe): Promise<Blob> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const d = new JsPDF({ unit: 'mm', format: 'a4' });
  await schriftFuer(d);
  const k = KASSE_WORTE[e.sprache];
  const w: Texte = { ...WORTE[e.sprache], fuss: k['fuss']! };
  const fort = (t: string) => `${t} (${w['fortsetzung']!})`;
  let y = kopf(d, k['titel']!, '', datum(Date.now(), e.sprache), e.toernName);

  const mehrere = e.waehrungen.length > 1;
  for (const wa of e.waehrungen) {
    const titel = mehrere ? `${k['wem']!} · ${wa.waehrung}${wa.waehrung === 'EUR' ? '' : ` · ${k['ohneKurs']!}`}` : k['wem']!;
    const zeilen = wa.zahlungen.map((z) => [e.name(z.von), e.name(z.an), e.geld(z.betrag, wa.waehrung)]);
    const spalten = [62, 62, 50];
    y = abschnitt(d, y, titel, zeilen.length ? tabellenAnfang(d, spalten, zeilen, [k['von']!, k['an']!, k['betrag']!]) : 8);
    if (!zeilen.length) {
      d.setFont(FONT, 'normal'); d.setFontSize(9.5); setz(d, TINTE);
      y = fliesstext(d, y, k['quitt']!, 9.5, 1.4, 6);
    } else {
      y = tabelle(d, y, spalten, zeilen, [k['von']!, k['an']!, k['betrag']!], { fortsetzung: fort(titel) });
    }
    const stand = wa.saldo.filter(([, v]) => v !== 0).sort(([, a], [, b]) => b - a).map(([p, v]) => [e.name(p), e.geld(v, wa.waehrung, true)]);
    if (stand.length) {
      const t = mehrere ? `${k['stand']!} · ${wa.waehrung}` : k['stand']!;
      y = abschnitt(d, y + 2, t, tabellenAnfang(d, [124, 50], stand, [k['name']!, k['saldo']!]));
      y = tabelle(d, y, [124, 50], stand, [k['name']!, k['saldo']!], { fortsetzung: fort(t) });
    }
  }

  if (e.arten.length) {
    const zeilen = e.arten.map(([a, b]) => [a, b]);
    y = abschnitt(d, y + 2, k['arten']!, tabellenAnfang(d, [124, 50], zeilen, [k['art']!, k['betrag']!]));
    y = tabelle(d, y, [124, 50], zeilen, [k['art']!, k['betrag']!], { fortsetzung: fort(k['arten']!) });
  }

  if (e.zeilen.length) {
    const spalten = [17, 38, 22, 25, 34, 20, 18];
    const kopfzeile = [k['datum']!, k['wofuer']!, k['art']!, k['zahler']!, k['fuer']!, k['betrag']!, k['inEur']!];
    const zeilen = e.zeilen.map((z) => [z.datum, z.text, z.art, z.zahler, z.fuer, z.betrag, z.inEur]);
    y = abschnitt(d, y + 2, k['ausgaben']!, tabellenAnfang(d, spalten, zeilen, kopfzeile, { alleLinks: true }));
    y = tabelle(d, y, spalten, zeilen, kopfzeile, { fortsetzung: fort(k['ausgaben']!), alleLinks: true });
  }

  d.setFont(FONT, 'italic'); d.setFontSize(8); setz(d, GRAU);
  fliesstext(d, y + 2, k['hinweis']!, 8, 1.15);
  fuss(d, w);
  return d.output('blob');
}
