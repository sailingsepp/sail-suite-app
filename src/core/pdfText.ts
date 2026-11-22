



const UMSCHRIFT: Record<string, string> = {
  
  'č': 'c', 'Č': 'C', 'ć': 'c', 'Ć': 'C', 'đ': 'd', 'Đ': 'D',
  
  'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S',
  
  'ā': 'a', 'ē': 'e', 'ī': 'i', 'ō': 'o', 'ū': 'u',
  'ł': 'l', 'Ł': 'L', 'ń': 'n', 'ś': 's', 'ź': 'z', 'ż': 'z',
  
  '→': '–', '←': '–', '⟶': '–', '☾': '', '⚓': '', '⛵': '', '⚙': '',
  
  
  
  '−': '-', '≈': '~', '≥': '>=', '≤': '<=', '′': "'", '″': '"',
  '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ', '\u2011': '-',
};


const ERLAUBT = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿'
  + 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ';


export function sicher(text: string): string {
  let raus = '';
  for (const z of text) {
    if (z in UMSCHRIFT) { raus += UMSCHRIFT[z]; continue; }
    
    
    if (z.charCodeAt(0) < 128 || ERLAUBT.includes(z)) raus += z;
  }
  return raus;
}


export function briefingDateiname(titel: string, datum: Date): string {
  const tag = `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}-`
    + String(datum.getUTCDate()).padStart(2, '0');
  const orte = titel
    .replace(/^(Tagesbriefing( für eine Fahrt)?|Daily briefing( for a passage)?)\s*/i, '')
    .replace(/^(von|from)\s+/i, '')
    .replace(/[đĐ]/g, (z) => (z === 'đ' ? 'd' : 'D'))
    .replace(/[ıİ]/g, (z) => (z === 'ı' ? 'i' : 'I'))
    .replace(/[łŁ]/g, (z) => (z === 'ł' ? 'l' : 'L'))
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return `Briefing_${tag}${orte ? `_${orte}` : ''}.pdf`;
}


export function sicherUnicode(text: string): string {
  return text
    
    
    .replace(/(?![©®™])\p{Extended_Pictographic}/gu, '')
    .replace(/[☀-➿️]/g, '')
    .replace(/[\u{10000}-\u{10FFFF}]/gu, '');
}


export function briefingTextFuerPdf(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((z) => z.trim()).filter(Boolean).join('\n');
}


export const PDF_COPYRIGHT: Record<'de' | 'en', string> = {
  de: '© 2026 Sail-Suite · Alle Rechte vorbehalten. Entwickelt von Sepp · Österreich',
  en: '© 2026 Sail-Suite · All rights reserved. Developed by Sepp · Austria',
};


const URL_TEIL = String.raw`https?:\/\/[^\s<>"“”„]+[^\s<>"“”„.,;:!?)\]]`;

export const ADRESS_ENDUNGEN = ['com', 'org', 'net', 'de', 'at', 'ch', 'hr', 'gr', 'it', 'es', 'fr', 'eu', 'io', 'app', 'int', 'me', 'cy', 'tr', 'uk', 'si', 'info'];
const DOMAIN_TEIL = String.raw`(?<![@\w./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${ADRESS_ENDUNGEN.join('|')})\b(?:\/[^\s<>"“”„]*[^\s<>"“”„.,;:!?)\]])?`;
const URL_MUSTER = new RegExp(`${URL_TEIL}|${DOMAIN_TEIL}`, 'gi');


function ziel(adresse: string): string {
  return /^https?:\/\//i.test(adresse) ? adresse : `https://${adresse}`;
}


export function adressenIn(text: string): { start: number; ende: number; url: string }[] {
  return [...text.matchAll(URL_MUSTER)].map((m) => ({ start: m.index, ende: m.index + m[0].length, url: ziel(m[0]) }));
}


export function linkStellenJeZeile(zeilen: readonly string[], quelle: string): { zeile: number; start: number; ende: number; url: string }[] {
  const adressen = adressenIn(quelle);
  const raus: { zeile: number; start: number; ende: number; url: string }[] = [];
  let pos = 0;
  zeilen.forEach((z, i) => {
    const ab = quelle.indexOf(z, pos);
    if (ab < 0 || !z) {
      for (const l of linkStellen(z, z)) raus.push({ zeile: i, ...l });
      return;
    }
    const bis = ab + z.length;
    pos = bis;
    for (const a of adressen) {
      const s = Math.max(a.start, ab), e = Math.min(a.ende, bis);
      if (e > s) raus.push({ zeile: i, start: s - ab, ende: e - ab, url: a.url });
    }
  });
  return raus;
}

export function linkStellen(zeile: string, absatz: string): { start: number; ende: number; url: string }[] {
  const volle = absatz.match(URL_MUSTER) ?? [];
  const stellen: { start: number; ende: number; url: string }[] = [];
  for (const m of zeile.matchAll(URL_MUSTER)) {
    const url = volle.find((v) => v.startsWith(m[0])) ?? m[0];
    stellen.push({ start: m.index, ende: m.index + m[0].length, url: ziel(url) });
  }
  return stellen;
}
