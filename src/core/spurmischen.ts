import { werteSpurAus, type Fix, type Luecke } from './spur';
import { distNM } from './geo';

const DECKUNG_S = 30;

const ORTS_ABWEICHUNG_M = 200;

export interface MischErgebnis {

  fixe: Fix[];

  neue: Fix[];
  bericht: MischBericht;
}

export interface MischBericht {

  uebernommen: number;

  verworfen: number;

  gefuellt: Luecke[];

  offen: Luecke[];

  zusatzNM: number;

  frueherS: number;
  spaeterS: number;

  ortsAbgleichM: number | null;
  passtOertlich: boolean;

  passtZeitlich: boolean;
}

function naechster(sortiert: Fix[], t: number): Fix | null {
  if (!sortiert.length) return null;
  let lo = 0;
  let hi = sortiert.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (sortiert[m]!.t < t) lo = m + 1;
    else hi = m;
  }
  const a = sortiert[lo]!;
  const b = sortiert[Math.max(0, lo - 1)]!;
  return Math.abs(a.t - t) <= Math.abs(b.t - t) ? a : b;
}

function median(werte: number[]): number | null {
  if (!werte.length) return null;
  const s = [...werte].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function mischeSpur(eigene: Fix[], fremde: Fix[]): MischErgebnis {
  const eigen = [...eigene].sort((a, b) => a.t - b.t);
  const fremd = [...fremde].sort((a, b) => a.t - b.t);

  if (!fremd.length) {
    const a = werteSpurAus(eigen);
    return {
      fixe: eigen,
      neue: [],
      bericht: {
        uebernommen: 0, verworfen: 0, gefuellt: [], offen: a.luecken, zusatzNM: 0,
        frueherS: 0, spaeterS: 0, ortsAbgleichM: null, passtOertlich: false,
        passtZeitlich: false,
      },
    };
  }
  if (!eigen.length) {

    const a = werteSpurAus(fremd);
    return {
      fixe: fremd,
      neue: fremd,
      bericht: {
        uebernommen: fremd.length, verworfen: 0, gefuellt: [], offen: a.luecken,
        zusatzNM: a.streckeNM, frueherS: 0, spaeterS: 0,
        ortsAbgleichM: null, passtOertlich: true, passtZeitlich: true,
      },
    };
  }

  const vorher = werteSpurAus(eigen);
  const eigenVon = eigen[0]!.t;
  const eigenBis = eigen[eigen.length - 1]!.t;
  const fremdVon = fremd[0]!.t;
  const fremdBis = fremd[fremd.length - 1]!.t;
  const passtZeitlich = fremdVon <= eigenBis && fremdBis >= eigenVon;

  const uebernommene: Fix[] = [];
  const abstaende: number[] = [];
  let verworfen = 0;

  for (const f of fremd) {
    const nah = naechster(eigen, f.t);
    const luecke = nah ? Math.abs(nah.t - f.t) / 1000 : Infinity;
    if (luecke <= DECKUNG_S) {

      verworfen++;
      if (nah) abstaende.push(distNM(nah.lat, nah.lon, f.lat, f.lon) * 1852);
      continue;
    }
    uebernommene.push({ ...f, quelle: 'import' });
  }

  const ortsAbgleichM = median(abstaende);

  const passtOertlich = ortsAbgleichM !== null && ortsAbgleichM <= ORTS_ABWEICHUNG_M;

  const fixe = [...eigen, ...uebernommene].sort((a, b) => a.t - b.t);
  const nachher = werteSpurAus(fixe);

  const gefuellt = vorher.luecken.filter((l) =>
    uebernommene.some((f) => f.t > l.von && f.t < l.bis));

  return {
    fixe,
    neue: uebernommene,
    bericht: {
      uebernommen: uebernommene.length,
      verworfen,
      gefuellt,
      offen: nachher.luecken,

      zusatzNM: Math.max(0, nachher.streckeNM - vorher.streckeNM),
      frueherS: Math.max(0, (eigenVon - (fixe[0]?.t ?? eigenVon)) / 1000),
      spaeterS: Math.max(0, ((fixe[fixe.length - 1]?.t ?? eigenBis) - eigenBis) / 1000),
      ortsAbgleichM,
      passtOertlich,
      passtZeitlich,
    },
  };
}
