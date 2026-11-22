import type { BoatPolar } from './polar';
import { ALL_BOATS } from './boats';

export type PolarQuelle = 'name' | 'werft' | 'groesse' | 'referenz';

export type PolarGuete = 'exakt' | 'aehnlich' | 'geschaetzt';

export interface PolarVorschlag {
  boot: BoatPolar;
  quelle: PolarQuelle;
  guete: PolarGuete;

  werft?: string;

  laengeFt?: number;

  abweichungFt?: number;
}

export interface PolarEingabe {

  typ?: string;

  laengeM?: number;

  katamaran?: boolean;
}

const FT_JE_M = 3.280839895;

const WERFT_MAX_ABWEICHUNG_FT = 4;

function normal(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function modellLaengeFt(name: string): number | undefined {
  const treffer = normal(name).match(/\b(\d{2,3})(?:\.(\d))?\b/);
  if (!treffer) return undefined;
  const zahl = Number(treffer[1]);
  if (treffer[2]) return zahl + Number(treffer[2]) / 10;
  if (zahl >= 100) return zahl / 10;
  return zahl;
}

export function klassenBereich(name: string): { lo: number; hi: number } | undefined {
  const n = normal(name);
  if (!n.endsWith(' ft')) return undefined;
  const zahlen = n.split(/[^0-9]+/).filter(Boolean).map(Number);
  if (zahlen.length < 2) return undefined;
  const lo = zahlen[zahlen.length - 2]!;
  const hi = zahlen[zahlen.length - 1]!;
  return hi > lo ? { lo, hi } : undefined;
}

function klasseFuer(katalog: readonly BoatPolar[], laengeFt: number | undefined): BoatPolar | undefined {
  if (!laengeFt) return undefined;
  const klassen = katalog
    .map((b) => ({ b, k: klassenBereich(b.name) }))
    .filter((x): x is { b: BoatPolar; k: { lo: number; hi: number } } => !!x.k && x.b.id.startsWith('fahrtenyacht-'));
  const halboffen = klassen.find(({ k }) => laengeFt >= k.lo && laengeFt < k.hi);
  if (halboffen) return halboffen.b;
  return klassen.find(({ k }) => laengeFt >= k.lo && laengeFt <= k.hi)?.b;
}

function werftAus(name: string): string | undefined {
  const wort = normal(name).split(' ').find((w) => /^[a-zäöüß][a-zäöüß.-]{2,}$/.test(w));
  return wort;
}

function istKatamaran(text: string): boolean {
  return /\bkat(amaran)?\b|\bcat(amaran)?\b/.test(normal(text));
}

export function waehlePolare(
  eingabe: PolarEingabe,
  katalog: readonly BoatPolar[] = ALL_BOATS,
): PolarVorschlag {
  const typ = (eingabe.typ ?? '').trim();
  const laengeFt = eingabe.laengeM ? eingabe.laengeM * FT_JE_M : modellLaengeFt(typ);
  const katamaran = eingabe.katamaran || (typ ? istKatamaran(typ) : false);

  const kandidaten = katalog.filter((b) => istKatamaran(b.name) === katamaran);

  const suchraum = kandidaten.length ? kandidaten : katalog;

  if (typ) {
    const gesucht = normal(typ);

    const exakt = suchraum.find((b) => {
      const n = normal(b.name);
      return n === gesucht || n.startsWith(gesucht + ' ') || gesucht.startsWith(n + ' ');
    });
    if (exakt) {
      const raus: PolarVorschlag = { boot: exakt, quelle: 'name', guete: 'exakt' };
      if (laengeFt) raus.laengeFt = laengeFt;
      return raus;
    }

    const werft = werftAus(typ);
    if (werft && !klasseFuer(suchraum, laengeFt)) {
      const gleicheWerft = suchraum.filter((b) => normal(b.name).startsWith(werft));
      if (gleicheWerft.length && laengeFt) {
        const naechstes = gleicheWerft.reduce((best, b) => {
          const d = Math.abs((modellLaengeFt(b.name) ?? 0) - laengeFt);
          const dBest = Math.abs((modellLaengeFt(best.name) ?? 0) - laengeFt);
          return d < dBest ? b : best;
        });
        const abweichung = Math.abs((modellLaengeFt(naechstes.name) ?? 0) - laengeFt);

        if (abweichung <= WERFT_MAX_ABWEICHUNG_FT) {
          return {
            boot: naechstes, quelle: 'werft', guete: 'aehnlich',
            werft, laengeFt, abweichungFt: abweichung,
          };
        }
      }

      if (gleicheWerft.length === 1 && !laengeFt) {
        return { boot: gleicheWerft[0]!, quelle: 'werft', guete: 'aehnlich', werft };
      }
    }
  }

  if (laengeFt) {
    const generisch = suchraum.filter((b) => b.id.startsWith('fahrtenyacht-'));
    const auswahl = generisch.length ? generisch : suchraum;

    const enthaltend = klasseFuer(auswahl, laengeFt);
    if (enthaltend) {
      return { boot: enthaltend, quelle: 'groesse', guete: 'geschaetzt', laengeFt, abweichungFt: 0 };
    }

    const abstand = (b: BoatPolar): number => {
      const k = klassenBereich(b.name);
      if (k) return laengeFt < k.lo ? k.lo - laengeFt : laengeFt - k.hi;
      const m = modellLaengeFt(b.name);
      return m === undefined ? Number.POSITIVE_INFINITY : Math.abs(m - laengeFt);
    };
    const naechstes = auswahl.reduce((best, b) => (abstand(b) < abstand(best) ? b : best));
    return {
      boot: naechstes, quelle: 'groesse', guete: 'geschaetzt', laengeFt,
      abweichungFt: abstand(naechstes),
    };
  }

  return { boot: katalog[0]!, quelle: 'referenz', guete: 'geschaetzt' };
}

export function polareFuerSchiff(
  schiff: { typ?: string | null | undefined; laengeM?: number | null | undefined },
  katalog: readonly BoatPolar[] = ALL_BOATS,
): PolarVorschlag | null {
  const typ = schiff.typ?.trim() || null;
  const laengeM = schiff.laengeM || null;
  if (!typ && !laengeM) return null;
  return waehlePolare({ ...(typ ? { typ } : {}), ...(laengeM ? { laengeM } : {}) }, katalog);
}
