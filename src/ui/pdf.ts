import type { BriefingAbschnitt } from '@/briefing';
import { pad } from '@/core/time';
import { sicher, sicherUnicode, briefingDateiname, briefingTextFuerPdf, linkStellen, PDF_COPYRIGHT } from '@/core/pdfText';
import { bindeSchriftEin, SCHRIFT } from '@/data/pdfSchrift';
import { aktuelleSprache } from '@/shell/sprache';
import { icon } from '@/shell/icons';
import { biete, pdfZiel, verwirfZiel } from './pdfAnzeige';

const RAND_MM = 18;
const WOCHENTAG: Record<'de' | 'en', string[]> = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

function datumLang(d: Date, sprache: 'de' | 'en'): string {
  return `${WOCHENTAG[sprache][d.getUTCDay()]} ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export function initPdf(abschnitte: BriefingAbschnitt[], datum: Date, abgerufenText: string | null): void {
  const btn = document.getElementById('btn-pdf') as HTMLButtonElement | null;
  if (!btn) return;

  const beschriftung = btn.innerHTML || icon('dokument') + 'PDF';
  const en = aktuelleSprache() === 'en';
  btn.title = en ? 'Open or share the briefing as a PDF' : 'Briefing als PDF öffnen oder teilen';

  btn.addEventListener('pointerdown', () => { void import('jspdf'); }, { once: true });

  btn.onclick = async () => {

    const ziel = pdfZiel(en ? 'Generating PDF …' : 'PDF wird erstellt …');
    btn.disabled = true;
    btn.innerHTML = icon('dokument') + (en ? 'Generating PDF …' : 'PDF wird erstellt …');
    try {
      const { jsPDF } = await import('jspdf');
      const titel = document.getElementById('brief-titel')?.textContent?.trim()
        || (en ? 'CourseCast: Briefing' : 'Tagesplanung: Briefing');

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      const unicode = await bindeSchriftEin(doc);
      const FONT = unicode ? SCHRIFT : 'helvetica';
      const tx = unicode ? sicherUnicode : sicher;

      doc.setProperties({ title: tx(titel), subject: datumLang(datum, en ? 'en' : 'de') });
      const dateiname = briefingDateiname(titel, datum);
      const seitenhoehe = doc.internal.pageSize.getHeight();
      const textbreite = doc.internal.pageSize.getWidth() - RAND_MM * 2;
      let y = RAND_MM;

      let laufenderTitel: string | null = null;
      const neueSeite = (): void => {
        doc.addPage();
        y = RAND_MM;
        if (!laufenderTitel) return;
        doc.setFont(FONT, 'bold');
        doc.setFontSize(12);
        y += 7;
        doc.text(tx(`${laufenderTitel} (${en ? 'continued' : 'Fortsetzung'})`), RAND_MM, y);
        doc.setFont(FONT, 'normal');
        doc.setFontSize(10.5);
      };
      const neueZeile = (hoehe: number): void => {
        if (y + hoehe > seitenhoehe - RAND_MM) neueSeite();
        y += hoehe;
      };

      doc.setFont(FONT, 'bold');
      doc.setFontSize(15);
      for (const zeile of doc.splitTextToSize(tx(titel), textbreite) as string[]) {
        neueZeile(6);
        doc.text(zeile, RAND_MM, y);
      }

      doc.setFont(FONT, 'normal');
      doc.setFontSize(10.5);
      neueZeile(6);
      doc.text(datumLang(datum, en ? 'en' : 'de'), RAND_MM, y);
      if (abgerufenText) {
        doc.setFontSize(9);
        doc.setTextColor(110);
        neueZeile(5);
        doc.text(en ? `Data retrieved at ${abgerufenText}` : `Datenabruf um ${abgerufenText}`, RAND_MM, y);
        doc.setTextColor(0);
      }
      y += 4;

      const ZEILE = 5, TITEL = 7;
      const unten = seitenhoehe - RAND_MM;
      const seite = unten - RAND_MM;
      const umbruchFuer = (hoehe: number): void => {
        if (hoehe <= seite && y + hoehe > unten) neueSeite();
      };
      for (const a of abschnitte) {

        const text = tx(briefingTextFuerPdf(a.text));
        doc.setFont(FONT, 'normal');
        doc.setFontSize(10.5);
        const absaetze = text.split('\n').map((p) => doc.splitTextToSize(p, textbreite) as string[]);
        const erster = absaetze[0]?.length ?? 0;
        const ersterH = (erster * ZEILE <= seite - TITEL ? erster : Math.min(erster, 3)) * ZEILE;
        laufenderTitel = null;
        umbruchFuer(TITEL + ersterH);

        doc.setFont(FONT, 'bold');
        doc.setFontSize(12);
        neueZeile(TITEL);
        doc.text(tx(a.titel), RAND_MM, y);
        laufenderTitel = a.titel;

        doc.setFont(FONT, 'normal');
        doc.setFontSize(10.5);
        absaetze.forEach((zeilen, i) => {
          if (i > 0) umbruchFuer(zeilen.length * ZEILE);
          for (const zeile of zeilen) {
            neueZeile(ZEILE);

            let x = RAND_MM, bis = 0;
            for (const l of linkStellen(zeile, text)) {
              const vor = zeile.slice(bis, l.start);
              doc.text(vor, x, y);
              x += doc.getTextWidth(vor);
              const sichtbar = zeile.slice(l.start, l.ende);
              const breite = doc.getTextWidth(sichtbar);
              doc.setTextColor(20, 90, 170);
              doc.text(sichtbar, x, y);
              doc.setTextColor(0);
              doc.link(x, y - 3.6, breite, 4.6, { url: l.url });
              x += breite;
              bis = l.ende;
            }
            doc.text(zeile.slice(bis), x, y);
          }
        });
        y += 4;
      }

      laufenderTitel = null;
      doc.setFont(FONT, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110);
      neueZeile(6);
      doc.text(tx(PDF_COPYRIGHT[en ? 'en' : 'de']), RAND_MM, y);
      doc.setTextColor(0);

      const blob = doc.output('blob');

      await biete(blob, dateiname, ziel);
      btn.innerHTML = beschriftung;
    } catch (err) {
      console.error('PDF-Erstellung fehlgeschlagen', err);
      verwirfZiel(ziel);
      btn.innerHTML = icon('warnung') + (en ? 'Failed' : 'Fehlgeschlagen');
      window.setTimeout(() => { btn.innerHTML = beschriftung; }, 2500);
    } finally {
      btn.disabled = false;
    }
  };
}
