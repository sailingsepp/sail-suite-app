import type { Sprache } from '@/core/types';

export interface Gebietsangabe {
  gebiet?: string;
  hoheit?: string;
  awz?: string;
}

const NATIONALITAETEN: Record<string, string> = {
  croatian: 'kroatische',
  montenegrin: 'montenegrinische',
  slovenian: 'slowenische',
  'bosnian and herzegovinian': 'bosnisch-herzegowinische',
  bosnian: 'bosnische',
  italian: 'italienische',
  albanian: 'albanische',
  greek: 'griechische',
  turkish: 'türkische',
  cypriot: 'zypriotische',
  maltese: 'maltesische',
  french: 'französische',
  spanish: 'spanische',
  libyan: 'libysche',
  egyptian: 'ägyptische',
  israeli: 'israelische',
  lebanese: 'libanesische',
  syrian: 'syrische',
  tunisian: 'tunesische',
  algerian: 'algerische',
};

interface Zonentyp {
  muster: RegExp;

  neutrum: boolean;
  de: string;
}

const ZONEN: Zonentyp[] = [
  { muster: /\bInternal Waters\b/i, neutrum: false, de: 'Hoheitsgewässer (innere Gewässer)' },
  { muster: /\bArchipelagic Waters\b/i, neutrum: false, de: 'Archipelgewässer' },
  { muster: /\bExclusive Economic Zone\b/i, neutrum: false, de: 'Ausschließliche Wirtschaftszone' },
  { muster: /\bEEZ\b/i, neutrum: false, de: 'Ausschließliche Wirtschaftszone' },

  { muster: /\b12\s*NM\b/i, neutrum: true, de: 'Küstenmeer' },
  { muster: /\bTerritorial Sea\b/i, neutrum: true, de: 'Küstenmeer' },
];

export function eindeutschen(name: string): string {
  for (const zone of ZONEN) {
    const treffer = name.match(zone.muster);
    if (!treffer || treffer.index === undefined) continue;
    const praefix = name.slice(0, treffer.index).trim().toLowerCase();
    const adjektiv = NATIONALITAETEN[praefix];
    if (!adjektiv) return name;
    const form = zone.neutrum ? adjektiv.replace(/e$/, 'es') : adjektiv;
    return `${form} ${zone.de}`;
  }
  return name;
}

export function hoheitsStaat(name: string): string | null {
  for (const zone of ZONEN) {
    const treffer = name.match(zone.muster);
    if (!treffer || treffer.index === undefined) continue;
    const praefix = name.slice(0, treffer.index).trim().toLowerCase();
    return praefix in NATIONALITAETEN ? praefix : null;
  }
  return null;
}

const GEBIETE_DE: Record<string, string> = {
  'Adriatic Sea': 'Adria',
  'Northern Adriatic Sea': 'Nördliche Adria',
  'Central Adriatic Sea': 'Mittlere Adria',
  'Southern Adriatic Sea': 'Südliche Adria',
  'Ionian Sea': 'Ionisches Meer',
  'Aegean Sea': 'Ägäis',
  'Sea of Crete': 'Kretisches Meer',
  'Levantine Sea': 'Levantisches Meer',
  'Tyrrhenian Sea': 'Tyrrhenisches Meer',
  'Ligurian Sea': 'Ligurisches Meer',
  'Balearic Sea': 'Balearenmeer',
  'Alboran Sea': 'Alborán-Meer',
  'Sea of Marmara': 'Marmarameer',
  'Mediterranean Sea - Eastern Basin': 'Östliches Mittelmeer',
  'Mediterranean Sea - Western Basin': 'Westliches Mittelmeer',
};

export function gebietDeutsch(name: string): string {
  return GEBIETE_DE[name] ?? name;
}

export function describeSeegebiet(g: Gebietsangabe | null, sprache: Sprache = 'de'): string | null {
  if (!g) return null;
  const en = sprache === 'en';
  const teile: string[] = [];

  if (g.gebiet) {
    teile.push(en ? `Sea area: ${g.gebiet}.` : `Seegebiet: ${gebietDeutsch(g.gebiet)}.`);
  }
  const zone = g.hoheit ?? g.awz;
  if (zone) {
    teile.push(en ? `Jurisdiction: ${zone}.` : `Zuständigkeit: ${eindeutschen(zone)}.`);
  }
  if (!teile.length) return null;
  return teile.join(' ');
}

export const STAATSNAMEN: Record<string, { de: string; en: string }> = {
  croatian: { de: 'Kroatien', en: 'Croatia' },
  montenegrin: { de: 'Montenegro', en: 'Montenegro' },
  slovenian: { de: 'Slowenien', en: 'Slovenia' },
  'bosnian and herzegovinian': { de: 'Bosnien und Herzegowina', en: 'Bosnia and Herzegovina' },
  bosnian: { de: 'Bosnien und Herzegowina', en: 'Bosnia and Herzegovina' },
  italian: { de: 'Italien', en: 'Italy' },
  albanian: { de: 'Albanien', en: 'Albania' },
  greek: { de: 'Griechenland', en: 'Greece' },
  turkish: { de: 'Türkei', en: 'Türkiye' },
  cypriot: { de: 'Zypern', en: 'Cyprus' },
  maltese: { de: 'Malta', en: 'Malta' },
  french: { de: 'Frankreich', en: 'France' },
  spanish: { de: 'Spanien', en: 'Spain' },
  libyan: { de: 'Libyen', en: 'Libya' },
  egyptian: { de: 'Ägypten', en: 'Egypt' },
  israeli: { de: 'Israel', en: 'Israel' },
  lebanese: { de: 'Libanon', en: 'Lebanon' },
  syrian: { de: 'Syrien', en: 'Syria' },
  tunisian: { de: 'Tunesien', en: 'Tunisia' },
  algerian: { de: 'Algerien', en: 'Algeria' },
};

export function gewaesserStaaten(
  gebiete: readonly (Gebietsangabe | null)[], sprache: Sprache,
): { hoheit: string[]; awz: string[] } {
  const hoheit: string[] = [];
  const awz: string[] = [];
  for (const g of gebiete) {
    const h = g?.hoheit ? hoheitsStaat(g.hoheit) : null;
    if (h && STAATSNAMEN[h] && !hoheit.includes(h)) hoheit.push(h);
    const a = g?.awz ? hoheitsStaat(g.awz) : null;
    if (a && STAATSNAMEN[a] && !awz.includes(a)) awz.push(a);
  }
  const name = (k: string) => STAATSNAMEN[k]![sprache];
  return {
    hoheit: [...new Set(hoheit.map(name))],
    awz: [...new Set(awz.filter((k) => !hoheit.includes(k)).map(name))],
  };
}
