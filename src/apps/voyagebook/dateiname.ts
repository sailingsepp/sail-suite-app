
import type { Sprache } from '@/core/types';

export type PdfArt = 'bericht' | 'nachweis' | 'blatt' | 'crewliste' | 'bordkassa';

const ART: Record<PdfArt, Record<Sprache, string>> = {
  bericht: { de: 'Toernbericht', en: 'Voyage-report' },
  nachweis: { de: 'Meilennachweis', en: 'Mileage-record' },
  blatt: { de: 'Logbuchblatt', en: 'Log-sheet' },
  crewliste: { de: 'Crewliste', en: 'Crew-list' },
  bordkassa: { de: 'Bordkassa', en: 'Kitty' },
};


export function dateinamenTeil(text: string, max = 50): string {
  const umgeschrieben = text
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return umgeschrieben.replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, max);
}


export function pdfDateiname(
  art: PdfArt, toernName: string, sprache: Sprache,
  zeit: { von?: string | null; bis?: string | null; tag?: string | null } = {},
): string {
  const teile = [ART[art][sprache], dateinamenTeil(toernName) || (sprache === 'en' ? 'Voyage' : 'Toern')];
  if (zeit.tag) teile.push(zeit.tag);
  else if (zeit.von && zeit.bis && zeit.von !== zeit.bis) teile.push(`${zeit.von}-${sprache === 'en' ? 'to' : 'bis'}-${zeit.bis}`);
  else if (zeit.von) teile.push(zeit.von);
  return `${teile.join('_')}.pdf`;
}
