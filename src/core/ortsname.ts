import { distNM } from './geo';
import { nf } from './time';



function wort(muster: string): RegExp {
  return new RegExp(`(?<!\\p{L})(${muster})(?!\\p{L})`, 'iu');
}

const ART_WOERTER: Record<'marina' | 'hafen' | 'bucht', RegExp> = {
  marina: wort('marina'),
  hafen: wort('hafen|harbou?r|port|porto|porticciolo|luka|lučica|lucica|limani|limanaki|limanı'),
  
  
  bucht: wort('bucht|bay|cove|uvala|zaljev|ormos|koyu|cala|baia|draga|luka|lučica|lucica|porto|port'),
};

export function mitArtwort(art: 'marina' | 'hafen' | 'bucht', praefix: string, name: string): string {
  return ART_WOERTER[art].test(name) || wort(praefix).test(name) ? name : `${praefix} ${name}`;
}


export function logbuchOrtsname(teile: {
  liegeplatz?: string | null;
  art?: 'marina' | 'bucht' | null;
  ort?: string | null;
  
  ortNahe?: boolean;
  
  ortAbstand?: { sm: number; richtung: string } | null;
  insel?: string | null;
  
  hauptinsel?: string | null;
  sprache?: 'de' | 'en';
}): string | null {
  const klein = (a: string) => a.toLocaleLowerCase('hr');
  const enthalten = (a: string, b: string) => klein(a).includes(klein(b));
  const lp = teile.liegeplatz?.trim() || null;
  const ort = teile.ort?.trim() || null;
  const insel = teile.insel?.trim() || null;
  const reihe: (string | null)[] = [];
  if (lp && teile.art === 'bucht') {
    if (insel) reihe.push(lp, insel);
    else if (ort && !enthalten(lp, ort)) reihe.push(lp, `${teile.sprache === 'en' ? 'near' : 'nahe'} ${ort}`);
    else reihe.push(lp);
  } else {
    reihe.push(lp, ort && teile.ortNahe ? naheText(ort, teile.ortAbstand ?? null, teile.sprache ?? 'de') : ort, insel);
  }
  const raus: string[] = [];
  let inselDrin = false;
  
  reihe.forEach((t, i) => {
    if (!t || raus.some((r) => enthalten(r, t))) return;
    raus.push(t);
    if (insel && t === insel && i === reihe.length - 1) inselDrin = true;
  });
  if (insel && !inselDrin) {
    
    raus.push(teile.sprache === 'en' ? `${insel} Island` : `Insel ${insel}`);
  }
  
  
  const haupt = teile.hauptinsel?.trim() || null;
  if (insel && haupt && klein(haupt) !== klein(insel) && raus.length) {
    raus[raus.length - 1] = `${raus[raus.length - 1]} (${haupt})`;
  }
  return raus.length ? raus.join(', ') : null;
}


export const ORT_FERN_SM = 1;

function naheText(ort: string, abstand: { sm: number; richtung: string } | null, sprache: 'de' | 'en'): string {
  if (!abstand || abstand.sm < ORT_FERN_SM) return `${sprache === 'en' ? 'near' : 'nahe'} ${ort}`;
  
  
  const sm = abstand.sm < 2 ? nf(abstand.sm, 1, sprache) : nf(Math.round(abstand.sm), 0, sprache);
  return sprache === 'en' ? `${sm} NM ${abstand.richtung} of ${ort}` : `${sm} sm ${abstand.richtung} von ${ort}`;
}

const RICHTUNG_EN: Record<string, string> = { N: 'N', NO: 'NE', O: 'E', SO: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };


export function ortsnameAufEnglisch(name: string): string {
  return name.split(', ').map((teil) => {
    const fern = /^(\d+(?:,\d+)?) sm (NO|NW|SO|SW|N|O|S|W) von (.+)$/.exec(teil);
    if (fern) return `${fern[1]!.replace(',', '.')} NM ${RICHTUNG_EN[fern[2]!]} of ${fern[3]}`;
    const nahe = /^nahe (.+)$/.exec(teil);
    if (nahe) return `near ${nahe[1]}`;
    const insel = /^Insel (.+?)( \(.+\))?$/.exec(teil);
    if (insel) return `${insel[1]} Island${insel[2] ?? ''}`;
    return teil;
  }).join(', ');
}


export function osmNameInSprache(tags: Readonly<Record<string, string>> | undefined, sprache: 'de' | 'en'): string | null {
  const name = tags?.['name']?.trim();
  if (!name) return null;
  if (!name.includes('/')) return name;
  return tags?.[`name:${sprache}`]?.trim() || name.split('/')[0]!.trim() || name;
}


export interface OrtKandidat {
  lat: number;
  lon: number;
  place: string;
  name: string;
  
  nameSprache?: string | undefined;
}

const SIEDLUNG = new Set(['city', 'town', 'village']);


export function ortInDerNaehe(
  punkt: { lat: number; lon: number }, orte: readonly OrtKandidat[],
): string | null {
  const o = ortKandidatInDerNaehe(punkt, orte);
  return o ? (o.nameSprache ?? o.name) : null;
}


export function ortKandidatInDerNaehe(
  punkt: { lat: number; lon: number }, orte: readonly OrtKandidat[],
): OrtKandidat | null {
  const wahl = (liste: readonly OrtKandidat[]) => {
    let best: OrtKandidat | null = null;
    let d = Infinity;
    for (const o of liste) {
      const x = distNM(punkt.lat, punkt.lon, o.lat, o.lon);
      if (x < d) { d = x; best = o; }
    }
    return best;
  };
  return wahl(orte.filter((k) => SIEDLUNG.has(k.place))) ?? wahl(orte.filter((k) => k.place === 'hamlet'));
}


export function ortGegenUmgebung(
  punkt: { lat: number; lon: number }, ort: string, orte: readonly OrtKandidat[],
): { ort: string | null; ortNahe: boolean; kandidat: OrtKandidat | null } {
  const klein = (a: string) => a.trim().toLocaleLowerCase('hr');
  const gleich = orte.filter((o) => klein(o.name) === klein(ort) || (o.nameSprache && klein(o.nameSprache) === klein(ort)));
  const nah = gleich.some((o) => distNM(punkt.lat, punkt.lon, o.lat, o.lon) < ORT_FERN_SM);
  if (nah) return { ort, ortNahe: false, kandidat: null };
  const k = ortKandidatInDerNaehe(punkt, orte);
  return k ? { ort: k.nameSprache ?? k.name, ortNahe: true, kandidat: k } : { ort: null, ortNahe: false, kandidat: null };
}

