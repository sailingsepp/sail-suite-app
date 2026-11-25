export interface SeitenText {

  handbuch: string;

  seite: number;
  text: string;
}

interface Dok {
  handbuch: string;
  seite: number;
  text: string;
  laenge: number;
}

interface Posting { dok: number; tf: number }

export interface Suchindex {
  doks: Dok[];
  woerter: Map<string, Posting[]>;
  mittelLaenge: number;
}

export interface Ausschnitt { text: string; treffer: boolean }

export interface Treffer {
  handbuch: string;
  seite: number;
  punkte: number;

  abgedeckt: number;

  begriffe: number;
  auszug: Ausschnitt[];

  markiere: string[];
}

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
export const GEWICHT = { gleich: 1, anfang: 0.85, stamm: 0.8, synonym: 0.75, enthalten: 0.6 } as const;
export const NAEHE_WOERTER = 12;
export const NAEHE_FAKTOR = 1.3;
export const AUSZUG_ZEICHEN = 220;

export function normalisiere(s: string): string {
  return s.toLowerCase().replace(/ß/g, 'ss').normalize('NFKD').replace(/\p{M}/gu, '');
}

const WORT = /[\p{L}\p{N}]+/gu;

function gueltig(w: string): boolean {
  return w.length >= 2 || /^\d$/.test(w);
}

export function woerter(text: string): string[] {
  const raus: string[] = [];
  for (const m of normalisiere(text).matchAll(WORT)) if (gueltig(m[0])) raus.push(m[0]);
  return raus;
}

export function seitenText(stuecke: ReadonlyArray<{ str?: string; hasEOL?: boolean }>): string {
  let t = '';
  for (const s of stuecke) {
    if (typeof s.str !== 'string') continue;
    t += s.str + (s.hasEOL ? '\n' : ' ');
  }
  return t
    .replace(/(\p{L})-[ \t]*\n[ \t]*(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

const FUELLWOERTER = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder',
  'ist', 'im', 'in', 'am', 'an', 'auf', 'aus', 'mit', 'von', 'zu', 'zum', 'zur', 'fur', 'wie', 'was',
  'ich', 'man', 'bei', 'nach', 'uber', 'unter', 'es', 'wo', 'wann', 'kann', 'soll',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'on', 'for', 'with', 'by', 'at', 'from', 'is', 'are', 'be',
  'how', 'what', 'do', 'does', 'can', 'my', 'your', 'it', 'this', 'that', 'into',
]);

export const SYNONYME: readonly (readonly string[])[] = [
  ['kanal', 'channel'],
  ['funkgerat', 'funk', 'radio', 'vhf', 'ukw'],
  ['notruf', 'notalarm', 'notfall', 'distress', 'mayday', 'emergency'],
  ['wegpunkt', 'waypoint'],
  ['kurs', 'course', 'heading'],
  ['ruder', 'rudder', 'helm'],
  ['einstellung', 'setting', 'setup', 'konfiguration', 'configuration'],
  ['menu', 'menue'],
  ['taste', 'knopf', 'button', 'key'],
  ['lautstarke', 'volume'],
  ['rauschsperre', 'squelch'],
  ['helligkeit', 'beleuchtung', 'brightness', 'backlight', 'dimmer'],
  ['batterie', 'akku', 'battery'],
  ['sicherung', 'fuse'],
  ['motor', 'maschine', 'engine'],
  ['ol', 'olstand', 'olwechsel', 'olfilter', 'oil'],
  ['wechsel', 'austausch', 'ersetzen', 'change', 'replace', 'replacement'],
  ['kraftstoff', 'diesel', 'treibstoff', 'fuel'],
  ['kuhlwasser', 'kuhlung', 'coolant', 'cooling'],
  ['anker', 'anchor'],
  ['ankerwinde', 'windlass'],
  ['tiefe', 'wassertiefe', 'depth'],
  ['echolot', 'tiefenmesser', 'sounder'],
  ['geschwindigkeit', 'fahrt', 'speed'],
  ['karte', 'seekarte', 'chart', 'map'],
  ['mob', 'overboard'],
  ['einschalten', 'ausschalten', 'power'],
  ['wassermacher', 'entsalzung', 'watermaker'],
  ['toilette', 'wc', 'toilet'],
  ['pumpe', 'pump'],
  ['bilge', 'bilgepumpe'],
  ['heizung', 'heater', 'heating'],
  ['kuhlschrank', 'kuhlbox', 'fridge', 'refrigerator'],
  ['landstrom', 'shore'],
  ['wechselrichter', 'inverter'],
  ['ladegerat', 'charger'],
  ['doppelwache', 'dual'],
  ['bildschirm', 'anzeige', 'display', 'screen'],
  ['uhrzeit', 'zeit', 'time', 'clock'],
  ['sprache', 'language'],
  ['werkseinstellung', 'zurucksetzen', 'reset', 'factory'],
  ['aktualisierung', 'update', 'firmware', 'software'],
  ['kalibrier', 'calibrat'],
  ['kompass', 'compass'],
  ['einbau', 'montage', 'installation', 'mounting'],
  ['anschluss', 'verkabelung', 'verbindung', 'connection', 'wiring'],
  ['fehler', 'storung', 'error', 'fault', 'troubleshooting'],
  ['wartung', 'service', 'maintenance'],
  ['alarm', 'warnung', 'warning'],
  ['lautsprecher', 'speaker'],
  ['mikrofon', 'microphone', 'mic'],
  ['antenne', 'antenna'],
  ['ziel', 'destination'],
  ['position', 'standort', 'location'],
];

export function stamm(w: string): string {
  for (const end of ['ungen', 'ung', 'en', 'er', 'es', 'e', 's', 'n']) {
    if (w.endsWith(end) && w.length - end.length >= 4) return w.slice(0, -end.length);
  }
  return w;
}

function synonymeVon(w: string): string[] {
  const s = stamm(w);
  const raus = new Set<string>();
  for (const gruppe of SYNONYME) {
    if (gruppe.some((g) => g === w || g === s
      || (g.length >= 4 && w.startsWith(g))
      || (s.length >= 5 && g.startsWith(s)))) {
      for (const g of gruppe) if (g !== w && g !== s) raus.add(g);
    }
  }
  return [...raus];
}

export function suchbegriffe(anfrage: string): string[] {
  const alle = woerter(anfrage);
  const ohne = alle.filter((w) => !FUELLWOERTER.has(w));
  return [...new Set(ohne.length ? ohne : alle)];
}

export function baueIndex(seiten: readonly SeitenText[]): Suchindex {
  const doks: Dok[] = [];
  const index = new Map<string, Posting[]>();
  let summe = 0;
  for (const s of seiten) {
    const ws = woerter(s.text);
    const nr = doks.length;
    doks.push({ handbuch: s.handbuch, seite: s.seite, text: s.text, laenge: ws.length });
    summe += ws.length;
    const tf = new Map<string, number>();
    for (const w of ws) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const [w, n] of tf) {
      let liste = index.get(w);
      if (!liste) { liste = []; index.set(w, liste); }
      liste.push({ dok: nr, tf: n });
    }
  }
  return { doks, woerter: index, mittelLaenge: doks.length ? summe / doks.length : 0 };
}

export function varianten(index: Suchindex, begriff: string): Map<string, number> {
  const raus = new Map<string, number>();
  const setze = (w: string, g: number) => { if ((raus.get(w) ?? 0) < g) raus.set(w, g); };
  const st = stamm(begriff);
  const syn = synonymeVon(begriff);
  for (const w of index.woerter.keys()) {
    if (w === begriff) setze(w, GEWICHT.gleich);
    else if (begriff.length >= 3 && w.startsWith(begriff)) setze(w, GEWICHT.anfang);
    else if (st !== begriff && w.startsWith(st)) setze(w, GEWICHT.stamm);
    else if (syn.some((s) => w === s || (s.length >= 3 && w.startsWith(s)))) setze(w, GEWICHT.synonym);
    else if (begriff.length >= 5 && w.includes(begriff)) setze(w, GEWICHT.enthalten);
    else if (syn.some((s) => s.length >= 5 && w.includes(s))) setze(w, GEWICHT.enthalten);
  }
  return raus;
}

export interface SuchOptionen {

  handbuecher?: ReadonlySet<string>;
  max?: number;
}

export function suche(index: Suchindex, anfrage: string, opt: SuchOptionen = {}): Treffer[] {
  const begriffe = suchbegriffe(anfrage);
  if (!begriffe.length || !index.doks.length) return [];
  const erlaubt = (d: number) => !opt.handbuecher?.size || opt.handbuecher.has(index.doks[d]!.handbuch);
  const n = index.doks.length;

  const punkte = new Map<number, number>();
  const abgedeckt = new Map<number, number>();
  const getroffen = new Map<number, Set<string>>();
  const jeBegriff: Map<string, number>[] = [];

  for (const b of begriffe) {
    const vars = varianten(index, b);
    jeBegriff.push(vars);
    const tf = new Map<number, number>();
    for (const [w, g] of vars) {
      for (const p of index.woerter.get(w) ?? []) {
        if (!erlaubt(p.dok)) continue;
        tf.set(p.dok, (tf.get(p.dok) ?? 0) + g * p.tf);
        let set = getroffen.get(p.dok);
        if (!set) { set = new Set(); getroffen.set(p.dok, set); }
        set.add(w);
      }
    }
    const df = tf.size;
    if (!df) continue;
    const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
    for (const [d, f] of tf) {
      const len = index.doks[d]!.laenge;
      const norm = 1 - BM25_B + BM25_B * (index.mittelLaenge ? len / index.mittelLaenge : 1);
      punkte.set(d, (punkte.get(d) ?? 0) + idf * (f * (BM25_K1 + 1)) / (f + BM25_K1 * norm));
      abgedeckt.set(d, (abgedeckt.get(d) ?? 0) + 1);
    }
  }

  const ordne = (a: number, b: number) =>
    (abgedeckt.get(b)! - abgedeckt.get(a)!) || (punkte.get(b)! - punkte.get(a)!) || (a - b);
  const kandidaten = [...punkte.keys()].sort(ordne);

  if (begriffe.length > 1) {
    for (const d of kandidaten.slice(0, 80)) {
      if ((abgedeckt.get(d) ?? 0) < 2) continue;
      if (naheBeieinander(woerter(index.doks[d]!.text), jeBegriff)) punkte.set(d, punkte.get(d)! * NAEHE_FAKTOR);
    }
    kandidaten.sort(ordne);
  }

  return kandidaten.slice(0, opt.max ?? 30).map((d) => {
    const dok = index.doks[d]!;
    const markiere = [...(getroffen.get(d) ?? [])];
    return {
      handbuch: dok.handbuch,
      seite: dok.seite,
      punkte: punkte.get(d)!,
      abgedeckt: abgedeckt.get(d)!,
      begriffe: begriffe.length,
      auszug: auszug(dok.text, new Set(markiere)),
      markiere,
    };
  });
}

function naheBeieinander(ws: string[], jeBegriff: Map<string, number>[]): boolean {
  const zuBegriff = ws.map((w) => jeBegriff.findIndex((m) => m.has(w)));
  const vorhanden = new Set(zuBegriff.filter((i) => i >= 0));
  if (vorhanden.size < 2) return false;
  const zaehl = new Map<number, number>();
  let links = 0;
  for (let r = 0; r < ws.length; r++) {
    const b = zuBegriff[r]!;
    if (b >= 0) zaehl.set(b, (zaehl.get(b) ?? 0) + 1);
    while (r - links + 1 > NAEHE_WOERTER) {
      const bl = zuBegriff[links]!;
      if (bl >= 0) { const c = zaehl.get(bl)! - 1; if (c) zaehl.set(bl, c); else zaehl.delete(bl); }
      links++;
    }
    if (zaehl.size === vorhanden.size) return true;
  }
  return false;
}

export function auszug(text: string, markiere: ReadonlySet<string>): Ausschnitt[] {
  const flach = text.replace(/\s+/g, ' ').trim();
  if (!flach) return [];
  const stellen: { von: number; bis: number; treffer: boolean }[] = [];
  for (const m of flach.matchAll(WORT)) {
    const w = normalisiere(m[0]);
    stellen.push({ von: m.index!, bis: m.index! + m[0].length, treffer: markiere.has(w) });
  }

  let bester = 0, besteZahl = -1;
  for (let i = 0; i < stellen.length; i++) {
    if (!stellen[i]!.treffer) continue;
    let zahl = 0;
    for (let j = i; j < stellen.length && stellen[j]!.von - stellen[i]!.von < AUSZUG_ZEICHEN * 0.7; j++) {
      if (stellen[j]!.treffer) zahl++;
    }
    if (zahl > besteZahl) { besteZahl = zahl; bester = i; }
  }
  const mitte = besteZahl >= 0 ? stellen[bester]!.von : 0;
  let von = Math.max(0, mitte - Math.round(AUSZUG_ZEICHEN * 0.25));
  let bis = Math.min(flach.length, von + AUSZUG_ZEICHEN);

  if (von > 0) { const l = flach.lastIndexOf(' ', von); von = l >= 0 ? l + 1 : 0; }
  if (bis < flach.length) { const r = flach.indexOf(' ', bis); bis = r >= 0 ? r : flach.length; }

  const raus: Ausschnitt[] = [];
  const dazu = (t: string, treffer: boolean) => {
    if (!t) return;
    const letzt = raus[raus.length - 1];
    if (letzt && letzt.treffer === treffer) letzt.text += t;
    else raus.push({ text: t, treffer });
  };
  if (von > 0) dazu('… ', false);
  let pos = von;
  for (const s of stellen) {
    if (s.bis <= von || s.von >= bis) continue;
    if (!s.treffer) continue;
    dazu(flach.slice(pos, s.von), false);
    dazu(flach.slice(s.von, s.bis), true);
    pos = s.bis;
  }
  dazu(flach.slice(pos, bis), false);
  if (bis < flach.length) dazu(' …', false);
  return raus;
}

export function ohneTextAnteil(seiten: readonly { text: string }[]): number {
  if (!seiten.length) return 1;
  return seiten.filter((s) => woerter(s.text).length < 5).length / seiten.length;
}

export function titelAusDateiname(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || name;
}
