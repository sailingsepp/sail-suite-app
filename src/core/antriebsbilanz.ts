import type { SpurPunkt, Luecke } from './spur';

export type Antrieb = 'segel' | 'motor';

export interface AntriebWechsel {
  t: number;
  antrieb: Antrieb;
}

export interface Antriebsbilanz {

  motorS: number;

  segelS: number;

  offenS: number;
  motorNM: number;
  segelNM: number;
  offenNM: number;
}

const LEER: Antriebsbilanz = {
  motorS: 0, segelS: 0, offenS: 0, motorNM: 0, segelNM: 0, offenNM: 0,
};

function antriebBei(wechsel: AntriebWechsel[], t: number): Antrieb | null {
  let gilt: Antrieb | null = null;
  for (const w of wechsel) {
    if (w.t > t) break;
    gilt = w.antrieb;
  }
  return gilt;
}

export function antriebsbilanz(
  punkte: SpurPunkt[],
  wechsel: AntriebWechsel[],
  luecken: Luecke[] = [],
): Antriebsbilanz {
  const b: Antriebsbilanz = { ...LEER };
  const sortiert = [...wechsel].sort((a, b2) => a.t - b2.t);

  for (let i = 1; i < punkte.length; i++) {
    const vor = punkte[i - 1]!;
    const p = punkte[i]!;

    if (luecken.some((l) => l.von >= vor.t && l.bis <= p.t)) continue;

    const dtS = (p.t - vor.t) / 1000;
    if (dtS <= 0) continue;
    const nm = Math.max(0, p.nm - vor.nm);

    const grenzen = [vor.t, ...sortiert.filter((w) => w.t > vor.t && w.t < p.t).map((w) => w.t), p.t];
    for (let k = 1; k < grenzen.length; k++) {
      const von = grenzen[k - 1]!;
      const bis = grenzen[k]!;
      const anteilS = (bis - von) / 1000;
      const anteilNM = nm * (anteilS / dtS);
      const a = antriebBei(sortiert, von);
      if (a === 'motor') {
        b.motorS += anteilS;
        b.motorNM += anteilNM;
      } else if (a === 'segel') {
        b.segelS += anteilS;
        b.segelNM += anteilNM;
      } else {
        b.offenS += anteilS;
        b.offenNM += anteilNM;
      }
    }
  }
  return b;
}

export function wechselAusEintraegen(
  eintraege: { art: string; t: number; text?: string | undefined }[],
): AntriebWechsel[] {
  return eintraege
    .filter((e) => e.art === 'antrieb' && (e.text === 'segel' || e.text === 'motor'))
    .map((e) => ({ t: e.t, antrieb: e.text as Antrieb }))
    .sort((a, b) => a.t - b.t);
}

export interface AntriebAbschnitt<P> {
  antrieb: Antrieb | null;
  punkte: P[];
}

export function antriebAbschnitte<P extends { t: number }>(punkte: readonly P[], wechsel: readonly AntriebWechsel[]): AntriebAbschnitt<P>[] {
  const raus: AntriebAbschnitt<P>[] = [];
  for (let i = 1; i < punkte.length; i++) {
    const a = punkte[i - 1]!;
    const b = punkte[i]!;
    const antrieb = antriebBei(wechsel as AntriebWechsel[], (a.t + b.t) / 2);
    const letzter = raus[raus.length - 1];
    if (letzter && letzter.antrieb === antrieb) letzter.punkte.push(b);
    else raus.push({ antrieb, punkte: [a, b] });
  }
  return raus;
}
