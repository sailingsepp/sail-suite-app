

export type Tagesurteil = 'ganztag' | 'teilweise' | 'zu';

export interface OeffnungszeitenUrteil {
  urteil: Tagesurteil;
  
  intervalle: string[];
}

interface Intervall { vonMin: number; bisMin: number }

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];




const TAG = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const MON_ALT = MON.join('|');
const TAG_ALT = TAG.join('|');
const MON_LISTE_RE = `(?:${MON_ALT})(?:-(?:${MON_ALT}))?(?:,(?:${MON_ALT})(?:-(?:${MON_ALT}))?)*`;
const TAG_LISTE_RE = `(?:${TAG_ALT})(?:-(?:${TAG_ALT}))?(?:,(?:${TAG_ALT})(?:-(?:${TAG_ALT}))?)*`;
const ZEIT_RE = '\\d{2}:\\d{2}-\\d{2}:\\d{2}';
const ZEIT_LISTE_RE = `${ZEIT_RE}(?:,${ZEIT_RE})*`;

const SEGMENT_RE = new RegExp(
  `^(?:(${MON_LISTE_RE})\\s+)?(?:(${TAG_LISTE_RE})\\s+)?(24/7|off|closed|${ZEIT_LISTE_RE})(?:\\s+(off|closed))?$`,
);

interface Regel {
  monate: Set<number> | null; 
  tage: Set<number> | null; 
  ganzerTagZu: boolean;
  offenIntervalle: Intervall[];
  zuIntervalle: Intervall[];
}

function parseListe(text: string, alphabet: readonly string[], basis1: boolean): Set<number> | null {
  const werte = new Set<number>();
  for (const teil of text.split(',')) {
    const [a, b] = teil.split('-');
    const ia = alphabet.indexOf(a!);
    if (ia === -1) return null;
    const von = ia + (basis1 ? 1 : 0);
    if (b === undefined) { werte.add(von); continue; }
    const ib = alphabet.indexOf(b);
    if (ib === -1) return null;
    const bis = ib + (basis1 ? 1 : 0);
    
    
    
    if (bis < von) return null;
    for (let i = von; i <= bis; i++) werte.add(i);
  }
  return werte;
}

function parseZeitListe(text: string): Intervall[] | null {
  const ergebnis: Intervall[] = [];
  for (const teil of text.split(',')) {
    const [von, bis] = teil.split('-');
    const vonMin = zeitZuMinuten(von!);
    const bisMin = zeitZuMinuten(bis!);
    if (vonMin === null || bisMin === null || bisMin <= vonMin) return null;
    ergebnis.push({ vonMin, bisMin });
  }
  return ergebnis;
}

function zeitZuMinuten(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number);
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h === 24 && m === 0) return 1440; 
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}


function parseRegeln(tagRoh: string): Regel[] | null {
  
  
  const ohneKommentare = tagRoh.replace(/"[^"]*"/g, '').trim();
  if (ohneKommentare.length === 0) return null;
  const segmente = ohneKommentare.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  if (segmente.length === 0) return null;
  const regeln: Regel[] = [];
  for (const segment of segmente) {
    const treffer = SEGMENT_RE.exec(segment);
    if (!treffer) return null;
    const [, monateText, tageText, hauptteil, trailingZu] = treffer;
    const monate = monateText ? parseListe(monateText, MON, true) : null;
    if (monateText && monate === null) return null;
    const tage = tageText ? parseListe(tageText, TAG, false) : null;
    if (tageText && tage === null) return null;
    if (hauptteil === '24/7') {
      regeln.push({ monate, tage, ganzerTagZu: false, offenIntervalle: [{ vonMin: 0, bisMin: 1440 }], zuIntervalle: [] });
      continue;
    }
    if (hauptteil === 'off' || hauptteil === 'closed') {
      regeln.push({ monate, tage, ganzerTagZu: true, offenIntervalle: [], zuIntervalle: [] });
      continue;
    }
    const zeiten = parseZeitListe(hauptteil!);
    if (zeiten === null) return null;
    if (trailingZu) {
      regeln.push({ monate, tage, ganzerTagZu: false, offenIntervalle: [], zuIntervalle: zeiten });
    } else {
      regeln.push({ monate, tage, ganzerTagZu: false, offenIntervalle: zeiten, zuIntervalle: [] });
    }
  }
  return regeln;
}


function subtrahiere(a: readonly Intervall[], b: readonly Intervall[]): Intervall[] {
  let ergebnis = a.slice();
  for (const weg of b) {
    const naechste: Intervall[] = [];
    for (const stueck of ergebnis) {
      if (weg.bisMin <= stueck.vonMin || weg.vonMin >= stueck.bisMin) { naechste.push(stueck); continue; }
      if (weg.vonMin > stueck.vonMin) naechste.push({ vonMin: stueck.vonMin, bisMin: Math.min(weg.vonMin, stueck.bisMin) });
      if (weg.bisMin < stueck.bisMin) naechste.push({ vonMin: Math.max(weg.bisMin, stueck.vonMin), bisMin: stueck.bisMin });
    }
    ergebnis = naechste;
  }
  return ergebnis;
}


function schneide(a: readonly Intervall[], fenster: Intervall): Intervall[] {
  const ergebnis: Intervall[] = [];
  for (const stueck of a) {
    const von = Math.max(stueck.vonMin, fenster.vonMin);
    const bis = Math.min(stueck.bisMin, fenster.bisMin);
    if (von < bis) ergebnis.push({ vonMin: von, bisMin: bis });
  }
  return ergebnis;
}

function minutenZuText(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}


export function werteOeffnungszeiten(
  tagRoh: string, wochentag: number, monat: number, fensterVonUhr: number, fensterBisUhr: number,
): OeffnungszeitenUrteil | null {
  const regeln = parseRegeln(tagRoh);
  if (regeln === null) return null;
  const wochentagMoBasiert = (wochentag + 6) % 7;
  const fenster: Intervall = { vonMin: fensterVonUhr * 60, bisMin: fensterBisUhr * 60 };
  let offen: Intervall[] = [];
  for (const regel of regeln) {
    if (regel.monate && !regel.monate.has(monat)) continue;
    if (regel.tage && !regel.tage.has(wochentagMoBasiert)) continue;
    if (regel.ganzerTagZu) { offen = []; continue; }
    if (regel.offenIntervalle.length > 0) { offen = regel.offenIntervalle; continue; }
    if (regel.zuIntervalle.length > 0) offen = subtrahiere(offen, regel.zuIntervalle);
  }
  const imFenster = schneide(offen, fenster);
  const fensterMin = fenster.bisMin - fenster.vonMin;
  const abgedeckt = imFenster.reduce((s, i) => s + (i.bisMin - i.vonMin), 0);
  if (abgedeckt === 0) return { urteil: 'zu', intervalle: [] };
  if (abgedeckt >= fensterMin) return { urteil: 'ganztag', intervalle: [] };
  return {
    urteil: 'teilweise',
    intervalle: imFenster.map((i) => `${minutenZuText(i.vonMin)}–${minutenZuText(i.bisMin)}`),
  };
}
