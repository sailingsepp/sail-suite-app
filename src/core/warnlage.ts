export type WarnQuelle = 'dhmz' | 'hnms' | 'meteomar';

export type Teilgebiet =
  | { art: 'laenge'; seite: 'west' | 'ost'; grad: number }
  | { art: 'breite'; seite: 'nord' | 'sued'; grad: number }
  | { art: 'haelfte'; seite: 'nord' | 'sued' | 'west' | 'ost' };

export type Warnzeit =
  | { art: 'utc'; vonMs: number; bisMs: number }
  | { art: 'stunden'; von: number; bis: number }
  | { art: 'revier'; vonMs: number; bisMs: number }
  | { art: 'nacht' };

export interface Warnangabe {
  quelle: WarnQuelle;

  wortlaut: string;

  richtungen: number[];

  boeenKn: { von: number; bis: number } | null;

  bft: { von: number; bis: number } | null;

  gebiete: string[] | null;

  kasten: { name: string; s: number; w: number; n: number; o: number } | null;
  teil: Teilgebiet | null;

  offeneSee: boolean;

  zeit: Warnzeit | null;

  zeitText: string | null;

  ortText: string;
}

export const BFT_KN: Record<number, [number, number]> = {
  6: [22, 27], 7: [28, 33], 8: [34, 40], 9: [41, 47], 10: [48, 55], 11: [56, 63], 12: [64, 80],
};

const KOMPASS: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

const WORTE_EN: [RegExp, number][] = [
  [/north\s*-?\s*north\s*-?\s*west|nnw/i, 337.5], [/north\s*-?\s*north\s*-?\s*east|nne/i, 22.5],
  [/north\s*-?\s*west(erly)?/i, 315], [/north\s*-?\s*east(erly)?/i, 45],
  [/south\s*-?\s*west(erly)?/i, 225], [/south\s*-?\s*east(erly)?/i, 135],
  [/\bnortherly\b|\bnorth\b/i, 0], [/\bsoutherly\b|\bsouth\b/i, 180],
  [/\bwesterly\b|\bwest\b/i, 270], [/\beasterly\b|\beast\b/i, 90],
];

const WORTE_DE: [RegExp, number][] = [
  [/nordnordwest/i, 337.5], [/nordnordost/i, 22.5], [/nordwest/i, 315], [/nordost/i, 45],
  [/südwest|suedwest/i, 225], [/südost|suedost/i, 135], [/nordwind|nord-/i, 0], [/südwind|suedwind/i, 180],
  [/westwind/i, 270], [/ostwind/i, 90],
];

const REGIONALWINDE: [RegExp, number][] = [
  [/\bbora\b|\bbura\b/i, 45], [/\bjugo\b|\bsirocco\b|\bscirocco\b/i, 135], [/\bmaestral/i, 315],
  [/\btramontana\b/i, 0], [/\blebić|\blebic|\blibeccio/i, 225],
];

export function richtungenAus(text: string): number[] {
  const aus = new Set<number>();

  const kuerzel = text.match(/\b(?:[NSEW]{1,3})(?:\s+and\s+[NSEW]{1,3})*\s+winds?\b/g);
  if (kuerzel) {
    for (const k of kuerzel.join(' ').match(/\b[NSEW]{1,3}\b/g) ?? []) {
      if (k in KOMPASS) aus.add(KOMPASS[k]!);
    }
  }
  for (const [re, grad] of REGIONALWINDE) if (re.test(text)) aus.add(grad);

  if (!kuerzel) {
    const worte = /[äöüß]|wind|böe/i.test(text) && !/\bwinds?\b/.test(text) ? WORTE_DE : WORTE_EN;
    for (const [re, grad] of worte) {
      if (re.test(text)) { aus.add(grad); break; }
    }
  }
  return [...aus];
}

const DHMZ_GEBIET: [RegExp, string][] = [
  [/nördlich|noerdlich|\bnorth(ern)?\b/i, 'NORTH ADRIATIC'],
  [/mittler|\bcentral\b|\bmiddle\b/i, 'CENTRAL ADRIATIC'],
  [/südlich|suedlich|\bsouth(ern)?\b/i, 'SOUTH ADRIATIC'],
];

const DHMZ_KASTEN: [RegExp, { name: string; s: number; w: number; n: number; o: number }][] = [
  [/velebit/i, { name: 'Velebit', s: 44.2, w: 14.8, n: 45.25, o: 15.7 }],
  [/kvarner/i, { name: 'Kvarner', s: 44.5, w: 14.0, n: 45.4, o: 14.9 }],
  [/istri/i, { name: 'Istrien', s: 44.75, w: 13.4, n: 45.6, o: 14.3 }],
];

export const DHMZ_BAND: Record<string, { s: number; n: number }> = {
  'NORTH ADRIATIC': { s: 43.75, n: 90 },
  'CENTRAL ADRIATIC': { s: 41.75, n: 44.25 },
  'SOUTH ADRIATIC': { s: -90, n: 42.25 },
};

export function imDhmzGebiet(gebiete: readonly string[], lat: number): boolean {
  return gebiete.some((g) => { const b = DHMZ_BAND[g]; return !b || (lat >= b.s && lat <= b.n); });
}

function dhmzZeit(teil: string, ausgabe: { datum: string | null; stunde: number | null }): { zeit: Warnzeit; text: string } | null {

  if (/ab dem morgen|ab morgens|from the morning|from morning/i.test(teil)) return { zeit: { art: 'stunden', von: 6, bis: 24 }, text: 'ab dem Morgen' };
  if (/ab der tagesmitte|ab mittag|ab dem mittag|from midday|from noon/i.test(teil)) return { zeit: { art: 'stunden', von: 12, bis: 24 }, text: 'ab Mittag' };
  if (/ab dem nachmittag|from the afternoon/i.test(teil)) return { zeit: { art: 'stunden', von: 12, bis: 24 }, text: 'ab dem Nachmittag' };
  if (/nachmittag|afternoon/i.test(teil)) return { zeit: { art: 'stunden', von: 12, bis: 18 }, text: 'am Nachmittag' };
  if (/vormittag|morgens|am morgen|\bmorning\b/i.test(teil)) return { zeit: { art: 'stunden', von: 6, bis: 12 }, text: 'am Vormittag' };
  if (/abends|am abend|\bevening\b/i.test(teil)) return { zeit: { art: 'stunden', von: 18, bis: 24 }, text: 'am Abend' };
  if (/nachts|in der nacht|at night|during the night|overnight/i.test(teil)) return { zeit: { art: 'nacht' }, text: 'nachts' };

  const ab = ausgabe.datum ? Date.UTC(+ausgabe.datum.slice(0, 4), +ausgabe.datum.slice(5, 7) - 1, +ausgabe.datum.slice(8, 10), ausgabe.stunde ?? 0) : null;
  if (/anfangs|zu beginn|zunächst|initially|at first/i.test(teil) && ab !== null) {
    return { zeit: { art: 'revier', vonMs: ab, bisMs: ab + 6 * 3600_000 }, text: 'anfangs' };
  }
  if (/später|im weiteren verlauf|\blater\b/i.test(teil) && ab !== null) {
    return { zeit: { art: 'revier', vonMs: ab + 6 * 3600_000, bisMs: ab + 24 * 3600_000 }, text: 'später' };
  }
  return null;
}

export function dhmzWarnungen(
  text: string | null | undefined, ausgabe: { datum: string | null; stunde: number | null },
): Warnangabe[] {
  if (!text) return [];
  const aus: Warnangabe[] = [];
  for (const satz of text.split(/(?<=\.)\s+/)) {
    if (!/b(ö|oe)|gust/i.test(satz)) continue;
    let richtungen: number[] = [];
    let gebiete: string[] | null = null;
    let kasten: Warnangabe['kasten'] = null;

    const adriaSatz = /adri/i.test(satz);
    type Vorgemerkt = { teil: string; richtungen: number[]; gebiete: string[] | null; kasten: Warnangabe['kasten'] };
    let vorgemerkt: Vorgemerkt[] = [];
    const eintrag = (teil: string, r: number[], g: string[] | null, k: Warnangabe['kasten'], zahlen: number[]): Warnangabe => {
      const z = dhmzZeit(teil, ausgabe);
      const offen = /offene[nrs]? see|seewärts|in the open|open sea|offshore|seaward/i.test(teil);
      const adriaText = g ? `der ${g.map(gebietDeutsch).join(' und ')} Adria` : 'der Adria';

      const stellenweise = !g && !k && !offen && /stellenweise|örtlich|in places|\blocally\b|occasional|mjestimi/i.test(teil);
      const ortTeile = [k ? `um ${k.name}` : offen ? `auf offener See ${adriaText}` : `${stellenweise ? 'stellenweise ' : ''}in ${adriaText}`];
      return {
        quelle: 'dhmz', wortlaut: teil.trim(), richtungen: r, boeenKn: { von: Math.min(...zahlen), bis: Math.max(...zahlen) },
        bft: null, gebiete: g, kasten: k, teil: null, offeneSee: offen, zeit: z?.zeit ?? null, zeitText: z?.text ?? null,
        ortText: ortTeile.filter(Boolean).join(' '),
      };
    };
    for (const teil of satz.split(/,\s+/)) {
      const r = richtungenAus(teil);
      if (r.length) richtungen = r;
      const g = adriaSatz ? DHMZ_GEBIET.filter(([re]) => re.test(teil)).map(([, n]) => n) : [];
      const k = DHMZ_KASTEN.find(([re]) => re.test(teil))?.[1] ?? null;
      if (g.length) { gebiete = g; kasten = null; } else if (k) { kasten = k; gebiete = null; }
      const zahlen = [...teil.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n >= 10 && n <= 150);
      if (!zahlen.length) {
        if (r.length || g.length || k) vorgemerkt.push({ teil, richtungen: r.length ? r : richtungen, gebiete, kasten });
        continue;
      }
      if (/\bauch\b|\balso\b/i.test(teil)) {
        for (const v of vorgemerkt) aus.push(eintrag(v.teil, v.richtungen, v.gebiete, v.kasten, zahlen));
      }
      vorgemerkt = [];
      aus.push(eintrag(teil, richtungen, gebiete, kasten, zahlen));
    }
  }
  return aus;
}

export function ohneOrtsangabe(w: Warnangabe): boolean {
  return !w.gebiete && !w.kasten && !w.teil && !w.offeneSee
    && /stellenweise|örtlich|lokal|\blocally\b|in places|\boccasional\b|mjestimice|mjestimično|lokalno/i.test(w.wortlaut);
}

function gebietDeutsch(n: string): string {
  return ({ 'NORTH ADRIATIC': 'nördlichen', 'CENTRAL ADRIATIC': 'mittleren', 'SOUTH ADRIATIC': 'südlichen' } as Record<string, string>)[n] ?? n;
}

function teilgebietAus(zeile: string): Teilgebiet | null {
  const l = zeile.match(/\b(WEST|EAST) OF (\d{1,3}(?:\.\d+)?)/i);
  if (l) return { art: 'laenge', seite: l[1]!.toUpperCase() === 'WEST' ? 'west' : 'ost', grad: Number(l[2]) };
  const b = zeile.match(/\b(NORTH|SOUTH) OF (\d{1,2}(?:\.\d+)?)/i);
  if (b) return { art: 'breite', seite: b[1]!.toUpperCase() === 'NORTH' ? 'nord' : 'sued', grad: Number(b[2]) };
  const h = zeile.match(/^OVER (NORTH|SOUTH|WEST|EAST)\b/i) ?? zeile.match(/\b(NORTH|SOUTH|WEST|EAST) SECTOR\b/i);
  if (h) return { art: 'haelfte', seite: ({ NORTH: 'nord', SOUTH: 'sued', WEST: 'west', EAST: 'ost' } as const)[h[1]!.toUpperCase() as 'NORTH'] };
  return null;
}

function tagStundeUtc(tag: number, stunde: number, datum: string): number {
  const j = +datum.slice(0, 4), m = +datum.slice(5, 7) - 1, d = +datum.slice(8, 10);
  const monat = tag < d - 15 ? m + 1 : m;
  return Date.UTC(j, monat, tag, stunde);
}

export function hnmsWarnungen(
  gebiete: { name: string; zeilen: string[] }[] | null | undefined, ausgabe: { datum: string; stundeUtc: number | null },
): Warnangabe[] {
  if (!gebiete) return [];
  const aus: Warnangabe[] = [];
  for (const g of gebiete) {
    const alle = g.zeilen.join(' / ');
    let teil: Teilgebiet | null = null;
    let zeit: Warnzeit | null = null;
    let zeitText: string | null = null;
    for (const z of g.zeilen) {
      teil ??= teilgebietAus(z);
      const fenster = z.match(/(?:FROM (\d{1,2})\/(\d{1,2})(?: UTC)?\s+)?(?:CONTINUING\s+)?(?:AT LEAST\s+)?TO (\d{1,2})\/(\d{1,2}) UTC/i);
      if (fenster && !zeit) {
        const von = fenster[1] ? tagStundeUtc(+fenster[1], +fenster[2]!, ausgabe.datum)
          : Date.UTC(+ausgabe.datum.slice(0, 4), +ausgabe.datum.slice(5, 7) - 1, +ausgabe.datum.slice(8, 10), ausgabe.stundeUtc ?? 0);
        const bis = tagStundeUtc(+fenster[3]!, +fenster[4]!, ausgabe.datum);
        zeit = { art: 'utc', vonMs: von, bisMs: bis };
        zeitText = `${fenster[1] ? `ab ${fenster[2]} UTC ` : ''}bis ${fenster[4]} UTC${/AT LEAST/i.test(z) ? ' oder länger' : ''}`;
      }
    }
    const grade = [...alle.matchAll(/\b(\d{1,2})\b(?!\.\d)(?!\/)/g)].map((m) => Number(m[1])).filter((n) => n >= 6 && n <= 12);
    if (!grade.length) continue;

    const staerke = g.zeilen[g.zeilen.length - 1]!;
    aus.push({
      quelle: 'hnms', wortlaut: `${g.name}: ${alle}`, richtungen: richtungenAus(staerke.split(/\b\d/)[0] ?? ''),
      boeenKn: null, bft: { von: Math.min(...grade), bis: Math.max(...grade) }, gebiete: [g.name], kasten: null, teil,
      offeneSee: false, zeit, zeitText, ortText: `im Seegebiet ${g.name}${teil ? ` (${teilText(teil)})` : ''}`,
    });
  }
  return aus;
}

function teilText(t: Teilgebiet): string {
  if (t.art === 'laenge') return `${t.seite === 'west' ? 'westlich' : 'östlich'} von ${t.grad}° O`;
  if (t.art === 'breite') return `${t.seite === 'nord' ? 'nördlich' : 'südlich'} von ${t.grad}° N`;
  return `${({ nord: 'nördlicher', sued: 'südlicher', west: 'westlicher', ost: 'östlicher' } as const)[t.seite]} Teil`;
}

function meteomarGebiete(text: string, bekannte: readonly string[]): string[] {
  const roh = text.toUpperCase().replace(/^.*?\bIN THE\b/, '').replace(/\.$/, '');
  const teile = roh.split(/,|\bAND\b/).map((s) => s.replace(/^\s*THE\s+/, '').trim()).filter(Boolean);
  return teile.flatMap((t) => bekannte.filter((b) => b === t || b.startsWith(`${t} `) || t.startsWith(b)));
}

export function meteomarWarnungen(
  gruppen: { name: string; zeilen: string[] }[] | null | undefined,
  bekannteGebiete: readonly string[], gueltig: { vonMs: number; bisMs: number } | null,
): Warnangabe[] {
  if (!gruppen) return [];
  const aus: Warnangabe[] = [];
  for (const gr of gruppen) {
    if (!/GALE|STORM/i.test(gr.name)) continue;
    for (const zeile of gr.zeilen) {
      const m = zeile.match(/([A-Z ]+?)\s+(\d{1,2})(?:\s+OR\s+(\d{1,2}))?\s+IN THE\b/i);
      if (!m) continue;
      const gebiete = meteomarGebiete(zeile, bekannteGebiete);
      if (!gebiete.length) continue;
      const b1 = Number(m[2]), b2 = m[3] ? Number(m[3]) : b1;
      aus.push({
        quelle: 'meteomar', wortlaut: `${gr.name}: ${zeile.replace(/^-\s*/, '')}`, richtungen: richtungenAus(m[1]!),
        boeenKn: null, bft: { von: Math.min(b1, b2), bis: Math.max(b1, b2) }, gebiete, kasten: null, teil: teilgebietAus(zeile),
        offeneSee: false, zeit: gueltig ? { art: 'utc', ...gueltig } : null,
        zeitText: /IN PROGRESS/i.test(gr.name) ? 'laufend' : 'erwartet',
        ortText: `im Seegebiet ${gebiete.join(', ')}`,
      });
    }
  }
  return aus;
}

export interface SpurPunkt {
  lat: number; lon: number; nm: number;

  time: Date;
  speed: number; gust: number;
}

export interface WarnKontext {

  gebieteAn: (lat: number, lon: number) => string[];

  gebietsBox: (name: string) => [number, number, number, number] | null;

  anlaufSm: (lat: number, lon: number, vonDeg: number) => number | null;

  utcVersatzMs: number;

  istDunkel: (p: SpurPunkt) => boolean;
}

export const OFFENE_SEE_SM = 20;

export const LEE_SM = 5;

export interface KritischerAbschnitt {
  warnung: Warnangabe;
  vonIdx: number;
  bisIdx: number;
  von: Date;
  bis: Date;

  punkt: SpurPunkt;

  anlaufSm: number | null;
  richtung: number | null;

  offenAnteil: number | null;
  modellBoeKn: number;
  modellWindKn: number;
}

export interface Warnlage {
  abschnitte: KritischerAbschnitt[];

  ausserhalbDerZeit: { warnung: Warnangabe; punkt: SpurPunkt; vorher: boolean } | null;

  nichtGetroffen: Warnangabe[];
}

function imKasten(p: SpurPunkt, k: NonNullable<Warnangabe['kasten']>): boolean {
  return p.lat >= k.s && p.lat <= k.n && p.lon >= k.w && p.lon <= k.o;
}

function imTeil(p: SpurPunkt, t: Teilgebiet | null, gebiete: string[] | null, ctx: WarnKontext): boolean {
  if (!t) return true;
  if (t.art === 'laenge') return t.seite === 'west' ? p.lon <= t.grad : p.lon >= t.grad;
  if (t.art === 'breite') return t.seite === 'nord' ? p.lat >= t.grad : p.lat <= t.grad;
  const box = gebiete?.map((g) => ctx.gebietsBox(g)).find(Boolean);
  if (!box) return true;
  const [w, s, o, n] = box;
  const mLat = (s + n) / 2, mLon = (w + o) / 2;
  return t.seite === 'nord' ? p.lat >= mLat : t.seite === 'sued' ? p.lat <= mLat : t.seite === 'west' ? p.lon <= mLon : p.lon >= mLon;
}

function zurZeit(p: SpurPunkt, z: Warnzeit | null, ctx: WarnKontext): boolean {
  if (!z) return true;
  if (z.art === 'nacht') return ctx.istDunkel(p);
  if (z.art === 'revier') return p.time.getTime() >= z.vonMs && p.time.getTime() < z.bisMs;
  if (z.art === 'stunden') {
    const h = p.time.getUTCHours() + p.time.getUTCMinutes() / 60;
    return h >= z.von && h < z.bis;
  }
  const utc = p.time.getTime() - ctx.utcVersatzMs;
  return utc >= z.vonMs && utc <= z.bisMs;
}

export function warnlageEntlang(spur: readonly SpurPunkt[], warnungen: readonly Warnangabe[], ctx: WarnKontext): Warnlage {
  const abschnitte: KritischerAbschnitt[] = [];
  let ausserhalb: Warnlage['ausserhalbDerZeit'] = null;
  const nichtGetroffen: Warnangabe[] = [];
  for (const w of warnungen) {
    const anlauf = (p: SpurPunkt): { sm: number | null; dir: number | null } => {
      if (!w.richtungen.length) return { sm: null, dir: null };
      let best: { sm: number | null; dir: number | null } = { sm: null, dir: w.richtungen[0]! };
      for (const d of w.richtungen) {
        const sm = ctx.anlaufSm(p.lat, p.lon, d);
        if (sm !== null && (best.sm === null || sm > best.sm)) best = { sm, dir: d };
      }
      return best;
    };
    const ort = (p: SpurPunkt): boolean => {
      if (w.kasten) return imKasten(p, w.kasten);
      if (w.gebiete) {
        const hier = ctx.gebieteAn(p.lat, p.lon);
        if (!w.gebiete.some((g) => hier.includes(g))) return false;
      }
      return imTeil(p, w.teil, w.gebiete, ctx);
    };
    const lage = (p: SpurPunkt): boolean => {
      if (!w.offeneSee) return true;
      const a = anlauf(p);

      return a.sm !== null && a.sm >= OFFENE_SEE_SM;
    };
    const getroffen = spur.map((p) => ort(p) && lage(p));
    const treffer = spur.map((p, i) => getroffen[i]! && zurZeit(p, w.zeit, ctx));
    if (!getroffen.some(Boolean)) { nichtGetroffen.push(w); continue; }
    let i = 0;
    let gefunden = false;
    while (i < spur.length) {
      if (!treffer[i]) { i++; continue; }
      let j = i;
      while (j + 1 < spur.length && treffer[j + 1]) j++;
      const teil = spur.slice(i, j + 1);

      let punkt = teil[0]!, a = anlauf(punkt);
      let offen = 0, bekannt = true;
      for (const p of teil) {
        const ap = anlauf(p);
        if (ap.sm === null) bekannt = false; else if (ap.sm >= OFFENE_SEE_SM) offen++;
        if ((ap.sm ?? -1) > (a.sm ?? -1) || ((ap.sm ?? -1) === (a.sm ?? -1) && p.gust > punkt.gust)) { punkt = p; a = ap; }
      }
      abschnitte.push({
        warnung: w, vonIdx: i, bisIdx: j, von: spur[i]!.time, bis: spur[j]!.time, punkt, anlaufSm: a.sm, richtung: a.dir,
        offenAnteil: bekannt ? offen / teil.length : null,
        modellBoeKn: Math.max(...teil.map((p) => p.gust)), modellWindKn: Math.max(...teil.map((p) => p.speed)),
      });
      gefunden = true;
      i = j + 1;
    }
    if (!gefunden && !ausserhalb && w.zeit) {
      const k = getroffen.indexOf(true);
      const p = spur[k]!;

      const vorher = w.zeit.art === 'stunden'
        ? p.time.getUTCHours() < w.zeit.von
        : w.zeit.art === 'utc' ? p.time.getTime() - ctx.utcVersatzMs < w.zeit.vonMs
          : w.zeit.art === 'revier' ? p.time.getTime() < w.zeit.vonMs : false;
      ausserhalb = { warnung: w, punkt: p, vorher };
    }
  }

  const schwere = (w: Warnangabe) => w.boeenKn?.bis ?? (w.bft ? BFT_KN[w.bft.bis]?.[1] ?? 0 : 0);
  abschnitte.sort((a, b) => schwere(b.warnung) - schwere(a.warnung) || a.von.getTime() - b.von.getTime());

  const eindeutig = abschnitte.filter((a, i) => abschnitte.findIndex((b) => b.vonIdx <= a.vonIdx && b.bisIdx >= a.bisIdx) === i);
  return { abschnitte: eindeutig, ausserhalbDerZeit: ausserhalb, nichtGetroffen };
}

export function hnmsAusgabeStunde(kopf: string): number | null {
  const m = kopf.match(/\b(\d{2})(\d{2})\s*UTC\b/i);
  return m ? Number(m[1]) : null;
}

export function meteomarGueltigkeit(kopf: string, datum: string): { vonMs: number; bisMs: number } | null {
  const ab = kopf.match(/ISSUED AT (\d{1,2}):(\d{2})/i);
  const bis = kopf.match(/VALID UP TO (\d{1,2}):(\d{2})\/?UTC OF (TODAY|TOMORROW)/i);
  if (!ab || !bis) return null;
  const tag = Date.UTC(+datum.slice(0, 4), +datum.slice(5, 7) - 1, +datum.slice(8, 10));
  return {
    vonMs: tag + (+ab[1]! * 60 + +ab[2]!) * 60_000,
    bisMs: tag + (/TOMORROW/i.test(bis[3]!) ? 86_400_000 : 0) + (+bis[1]! * 60 + +bis[2]!) * 60_000,
  };
}
