const G = 9.80665;

export type Tiefenguete =

  | 'vermessen'

  | 'gitter'

  | 'land'

  | 'unbekannt';

export interface Tiefenpunkt {

  tiefeM: number | null;
  guete: Tiefenguete;

  quelle?: string;

  spanneM?: number;

  versatzM?: number;
}

export function deuteTiefe(antwort: {
  avg?: number | null;
  min?: number | null;
  max?: number | null;
  reference?: { identifier?: string } | null;
} | null): Tiefenpunkt {
  const avg = antwort?.avg;
  if (avg === undefined || avg === null || !Number.isFinite(avg)) {
    return { tiefeM: null, guete: 'unbekannt' };
  }
  if (avg >= 0) return { tiefeM: null, guete: 'land' };

  const kennung = antwort?.reference?.identifier;
  const guete: Tiefenguete = !kennung ? 'unbekannt'
    : /^GEBCO/i.test(kennung) ? 'gitter' : 'vermessen';

  const punkt: Tiefenpunkt = { tiefeM: -avg, guete };
  if (kennung) punkt.quelle = kennung;
  if (Number.isFinite(antwort?.min) && Number.isFinite(antwort?.max)) {
    punkt.spanneM = Math.abs((antwort!.max as number) - (antwort!.min as number));
  }
  return punkt;
}

export const KLARWASSER_MIN_M = 3;

export function ersteKlareTiefe(
  werte: readonly unknown[],
  schrittM: number,
  mindestensM = KLARWASSER_MIN_M,
): { tiefeM: number; versatzM: number } | null {

  for (let i = 1; i < werte.length; i++) {
    const v = werte[i];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;

    if (-v < mindestensM) continue;
    return { tiefeM: -v, versatzM: Math.round(i * schrittM) };
  }
  return null;
}

export function marge(tiefgangM: number): number {
  return 0.5 + 0.1 * Math.max(0, tiefgangM);
}

export type Untiefenstufe = 'frei' | 'knapp' | 'zu-flach';

export function unterkiel(
  tiefeM: number | null, tiefgangM: number, margeM = marge(tiefgangM),
): { stufe: Untiefenstufe; freiM: number | null } {
  if (tiefeM === null || !Number.isFinite(tiefeM)) return { stufe: 'frei', freiM: null };
  const frei = tiefeM - tiefgangM;
  if (frei < 0) return { stufe: 'zu-flach', freiM: frei };
  return { stufe: frei < margeM ? 'knapp' : 'frei', freiM: frei };
}

export interface Untiefe {

  cum: number;
  tiefeM: number;
  stufe: Untiefenstufe;
}

export function untiefen(
  profil: { cum: number; tiefeM: number | null }[], tiefgangM: number, margeM = marge(tiefgangM),
): Untiefe[] {
  const raus: Untiefe[] = [];
  let lauf: Untiefe | null = null;
  for (const p of profil) {
    const { stufe } = unterkiel(p.tiefeM, tiefgangM, margeM);
    if (stufe === 'frei' || p.tiefeM === null) {
      if (lauf) { raus.push(lauf); lauf = null; }
      continue;
    }
    if (!lauf || p.tiefeM < lauf.tiefeM) {
      lauf = { cum: p.cum, tiefeM: p.tiefeM, stufe };
    }

    if (stufe === 'zu-flach') lauf.stufe = 'zu-flach';
  }
  if (lauf) raus.push(lauf);
  return raus;
}

export interface Ankerrechnung {

  ketteM: number;

  schwojkreisM: number;

  verhaeltnis: number;

  senkrechtM: number;
}

export function ankerkette(
  tiefeM: number,
  opt: {

    bugM?: number;

    hubM?: number;

    laengeM?: number;

    verhaeltnis?: number;
  } = {},
): Ankerrechnung {
  const verhaeltnis = opt.verhaeltnis ?? 5;
  const senkrecht = Math.max(0, tiefeM) + (opt.bugM ?? 1.5) + Math.max(0, opt.hubM ?? 0);
  const ketteM = senkrecht * verhaeltnis;
  return {
    ketteM,

    schwojkreisM: ketteM + (opt.laengeM ?? 12),
    verhaeltnis,
    senkrechtM: senkrecht,
  };
}

export function wellenlaenge(periodeS: number, tiefeM: number): number {
  if (!(periodeS > 0)) return 0;
  const L0 = (G * periodeS * periodeS) / (2 * Math.PI);
  if (!(tiefeM > 0)) return 0;
  if (tiefeM >= L0 / 2) return L0;

  const omega = (2 * Math.PI) / periodeS;
  let k = omega / Math.sqrt(G * tiefeM);
  for (let i = 0; i < 40; i++) {
    const t = Math.tanh(k * tiefeM);
    const f = G * k * t - omega * omega;
    const df = G * t + G * k * tiefeM * (1 - t * t);
    const schritt = f / df;
    k -= schritt;
    if (!Number.isFinite(k) || k <= 0) return L0;
    if (Math.abs(schritt) < 1e-10) break;
  }
  return (2 * Math.PI) / k;
}

export function auflaufbeiwert(periodeS: number, tiefeM: number): number {
  if (!(periodeS > 0) || !(tiefeM > 0)) return 1;
  const L = wellenlaenge(periodeS, tiefeM);
  if (!(L > 0)) return 1;
  const k = (2 * Math.PI) / L;
  const kd = k * tiefeM;
  const c = L / periodeS;
  const n = 0.5 * (1 + (2 * kd) / Math.sinh(2 * kd));
  const cg = n * c;
  const cg0 = (G * periodeS) / (4 * Math.PI);
  if (!(cg > 0)) return 1;
  return Math.sqrt(cg0 / cg);
}

export interface Flachwasserlage {

  wirkt: boolean;

  spuertGrund: boolean;

  laengeM: number;

  steilheit: number;

  steilheitTief: number;

  brecherHoeheM: number;

  bricht: boolean;
}

export function flachwasser(hsM: number, periodeS: number, tiefeM: number | null): Flachwasserlage {
  const L0 = (G * periodeS * periodeS) / (2 * Math.PI);
  const steilTief = hsM > 0 ? L0 / hsM : Infinity;
  if (tiefeM === null || !(tiefeM > 0) || !(periodeS > 0) || !(hsM > 0)) {
    return {
      wirkt: false, spuertGrund: false, laengeM: L0,
      steilheit: steilTief, steilheitTief: steilTief,
      brecherHoeheM: Infinity, bricht: false,
    };
  }
  const L = wellenlaenge(periodeS, tiefeM);
  const hs = hsM * auflaufbeiwert(periodeS, tiefeM);
  const brecher = 0.78 * tiefeM;
  return {
    wirkt: tiefeM < L0 / 5,
    spuertGrund: tiefeM < L0 / 2,
    laengeM: L,
    steilheit: L / hs,
    steilheitTief: steilTief,
    brecherHoeheM: brecher,
    bricht: hs >= brecher,
  };
}

export type Ankertauglichkeit = 'gut' | 'flach' | 'tief' | 'zu-tief' | 'unbekannt';

export function ankertauglich(
  tiefeM: number | null, tiefgangM: number, ketteM = 60,
): Ankertauglichkeit {
  if (tiefeM === null || !Number.isFinite(tiefeM)) return 'unbekannt';
  if (tiefeM < tiefgangM + marge(tiefgangM)) return 'flach';

  const maxTiefe = ketteM / 4 - 1.5;
  if (tiefeM > maxTiefe) return 'zu-tief';
  if (tiefeM > ketteM / 5 - 1.5) return 'tief';
  return 'gut';
}

export const LIEGEPLATZ_RAND_NM = 0.2;

export const ZUFAHRT_MAX_NM = 1.0;

export function profilOhneLiegeplaetze<T extends { cum: number; tiefeM?: number | null }>(profil: T[]): T[] {
  if (!profil.length) return profil;
  const ende = profil[profil.length - 1]!.cum;
  const klar = (p: T) => typeof p.tiefeM === 'number' && p.tiefeM >= KLARWASSER_MIN_M;
  const ersteKlar = profil.find(klar)?.cum ?? 0;
  const letzteKlar = [...profil].reverse().find(klar)?.cum ?? ende;
  const von = Math.max(LIEGEPLATZ_RAND_NM, Math.min(ersteKlar, ZUFAHRT_MAX_NM));
  const bis = Math.min(ende - LIEGEPLATZ_RAND_NM, Math.max(letzteKlar, ende - ZUFAHRT_MAX_NM));
  return profil.filter((p) => p.cum >= von && p.cum <= bis);
}

export const UFERZELLE_UNTER_M = 1;

export function braucheSuche(amPunkt: Tiefenpunkt): boolean {
  return amPunkt.guete === 'land'
    || (amPunkt.tiefeM !== null && amPunkt.tiefeM < KLARWASSER_MIN_M && amPunkt.guete !== 'vermessen');
}

export function zieltiefe(amPunkt: Tiefenpunkt, nahe: Tiefenpunkt | null): Tiefenpunkt {
  if (nahe && nahe.tiefeM !== null && (amPunkt.guete === 'land' || nahe.tiefeM >= KLARWASSER_MIN_M)) return nahe;
  if (amPunkt.guete === 'vermessen') return amPunkt;
  if (amPunkt.tiefeM !== null && amPunkt.tiefeM < UFERZELLE_UNTER_M) return { tiefeM: null, guete: 'land' };
  return amPunkt;
}
