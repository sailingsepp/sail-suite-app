import { kanon } from './grenzen';

export const WAEHRUNG_JE_STAAT: Readonly<Record<string, string>> = {
  Croatia: 'EUR', Montenegro: 'EUR', Slovenia: 'EUR', Italy: 'EUR', Greece: 'EUR', Cyprus: 'EUR',
  Malta: 'EUR', France: 'EUR', Spain: 'EUR', Monaco: 'EUR', Portugal: 'EUR',
  'Bosnia and Herzegovina': 'BAM', Albania: 'ALL', Turkey: 'TRY', Libya: 'LYD', Egypt: 'EGP',
  Israel: 'ILS', Lebanon: 'LBP', Syria: 'SYP', Tunisia: 'TND', Algeria: 'DZD', Morocco: 'MAD',
  Gibraltar: 'GIP', Bulgaria: 'EUR', Romania: 'RON', Ukraine: 'UAH', Georgia: 'GEL',
};

const NACHKOMMA: Readonly<Record<string, number>> = { LYD: 3, TND: 3 };
export const nachkomma = (w: string): number => NACHKOMMA[w] ?? 2;

const KLEIN = new Map(Object.entries(WAEHRUNG_JE_STAAT).map(([k, v]) => [k.toLowerCase(), v]));
export function waehrungAusStaaten(staaten: readonly string[]): string | null {
  for (const s of staaten) {
    const w = KLEIN.get(kanon(s).toLowerCase());
    if (w) return w;
  }
  return null;
}

export type BuchungsArt = 'ausgabe' | 'zahlung';

export interface Kurs { eurJe: number; datum: string }
export interface Buchung {
  id: string;
  art: BuchungsArt;

  datum: string;
  text: string;

  betrag: number;
  waehrung: string;

  zahler: string;

  fuer: string[];

  namen: Record<string, string>;
  angelegt: number;
  geaendert: number;
  geloescht?: boolean;

  kurs?: Kurs;

  kategorie?: Kategorie;

  gewichte?: Record<string, number>;
}

export const KATEGORIEN = ['verpflegung', 'liegeplatz', 'treibstoff', 'ausflug', 'sonstiges'] as const;
export type Kategorie = typeof KATEGORIEN[number];
export const istKategorie = (x: unknown): x is Kategorie => typeof x === 'string' && (KATEGORIEN as readonly string[]).includes(x);

export const GEWICHT_MAX = 9;

export function gewichtVon(b: Pick<Buchung, 'gewichte'>, m: string): number {
  const g = b.gewichte?.[m];
  return typeof g === 'number' && Number.isInteger(g) && g >= 1 && g <= GEWICHT_MAX ? g : 1;
}

const gueltigerKurs = (k: Kurs | undefined): k is Kurs => !!k && Number.isFinite(k.eurJe) && k.eurJe > 0;

export function inEur(b: Pick<Buchung, 'betrag' | 'waehrung' | 'kurs'>): number | null {
  if (b.waehrung === 'EUR') return b.betrag;
  if (!gueltigerKurs(b.kurs)) return null;
  return Math.round((alsZahl(b.betrag, b.waehrung) / b.kurs.eurJe) * 100);
}

export function ausEur(eurCent: number, waehrung: string, eurJe: number): number {
  return Math.round((eurCent / 100) * eurJe * 10 ** nachkomma(waehrung));
}

export function anteile(b: Pick<Buchung, 'betrag' | 'fuer' | 'gewichte'>): Map<string, number> {
  const fuer = [...new Set(b.fuer)];
  const aus = new Map<string, number>();
  if (!fuer.length || b.betrag <= 0) return aus;
  const g = fuer.map((m) => gewichtVon(b, m));
  const summe = g.reduce((x, y) => x + y, 0);

  const teile = fuer.map((m, i) => ({ m, i, grund: Math.floor((b.betrag * g[i]!) / summe), rest: (b.betrag * g[i]!) % summe }));
  let uebrig = b.betrag - teile.reduce((x, t) => x + t.grund, 0);
  const reihe = [...teile].sort((a, c) => c.rest - a.rest || a.i - c.i);
  for (const t of reihe) { if (uebrig <= 0) break; t.grund += 1; uebrig -= 1; }
  for (const t of teile) aus.set(t.m, t.grund);
  return aus;
}

export function jeKategorie(buchungen: readonly Buchung[]): Map<string, Map<Kategorie, number>> {
  const aus = new Map<string, Map<Kategorie, number>>();
  for (const b of buchungen) {
    if (b.geloescht || b.art !== 'ausgabe' || b.betrag <= 0) continue;
    const eur = inEur(b);
    const w = eur === null ? b.waehrung : 'EUR';
    const k: Kategorie = istKategorie(b.kategorie) ? b.kategorie : 'sonstiges';
    const m = aus.get(w) ?? new Map<Kategorie, number>();
    aus.set(w, m);
    m.set(k, (m.get(k) ?? 0) + (eur ?? b.betrag));
  }
  return aus;
}

export function salden(buchungen: readonly Buchung[]): Map<string, Map<string, number>> {
  const aus = new Map<string, Map<string, number>>();
  for (const b of buchungen) {
    if (b.geloescht || b.betrag <= 0 || !b.fuer.length) continue;
    const eur = inEur(b);
    const betrag = eur ?? b.betrag;
    if (betrag <= 0) continue;
    const w = eur === null ? b.waehrung : 'EUR';
    const s = aus.get(w) ?? new Map<string, number>();
    aus.set(w, s);
    s.set(b.zahler, (s.get(b.zahler) ?? 0) + betrag);
    for (const [m, a] of anteile({ betrag, fuer: b.fuer, ...(b.gewichte ? { gewichte: b.gewichte } : {}) })) s.set(m, (s.get(m) ?? 0) - a);
  }
  return aus;
}

export interface Ausgleich { von: string; an: string; betrag: number }

export function ausgleich(saldo: ReadonlyMap<string, number>): Ausgleich[] {
  const schuld = [...saldo].filter(([, v]) => v < 0).map(([k, v]) => ({ k, v: -v }));
  const guthaben = [...saldo].filter(([, v]) => v > 0).map(([k, v]) => ({ k, v }));
  const aus: Ausgleich[] = [];

  for (const s of schuld) {
    const g = guthaben.find((x) => x.v === s.v && x.v > 0);
    if (g && s.v > 0) { aus.push({ von: s.k, an: g.k, betrag: s.v }); g.v = 0; s.v = 0; }
  }

  const ordne = (a: { k: string; v: number }, b: { k: string; v: number }) => b.v - a.v || a.k.localeCompare(b.k);
  for (;;) {
    schuld.sort(ordne); guthaben.sort(ordne);
    const s = schuld[0], g = guthaben[0];
    if (!s || !g || s.v <= 0 || g.v <= 0) break;
    const x = Math.min(s.v, g.v);
    aus.push({ von: s.k, an: g.k, betrag: x });
    s.v -= x; g.v -= x;
  }
  return aus;
}

export const alsZahl = (betrag: number, waehrung: string): number => betrag / 10 ** nachkomma(waehrung);

export function ausEingabe(text: string, waehrung: string): number | null {
  const t = text.trim().replace(/\s/g, '').replace(',', '.');
  const d = nachkomma(waehrung);
  if (!new RegExp(`^\\d+(\\.\\d{1,${d}})?$`).test(t)) return null;
  const [ganz, teil = ''] = t.split('.');
  const n = Number(ganz) * 10 ** d + Number((teil + '0'.repeat(d)).slice(0, d));
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

export function zusammenfuehren(...staende: readonly Buchung[][]): Buchung[] {
  const m = new Map<string, Buchung>();
  for (const liste of staende) for (const b of liste) {
    const da = m.get(b.id);
    if (!da || b.geaendert > da.geaendert) m.set(b.id, b);
  }
  return [...m.values()].sort((a, b) => b.datum.localeCompare(a.datum) || b.angelegt - a.angelegt);
}

export function kursNachzuholen(buchungen: readonly Buchung[]): Buchung[] {
  const offen = buchungen.filter((b) => !b.geloescht && b.waehrung !== 'EUR' && !gueltigerKurs(b.kurs));
  const beglichen = new Set(offen.filter((b) => b.art === 'zahlung').map((b) => b.waehrung));
  return offen.filter((b) => !beglichen.has(b.waehrung));
}
