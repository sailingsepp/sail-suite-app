

export const ABTASTRATE = 8000;


export interface Note { f: number; ab: number }


const OKTAVE = 0.25;

const EINSATZ_S = 0.008;

const AUS_S = 0.03;

const PEGEL = 0.7;


export function glockenKlang(noten: readonly Note[], dauerS: number, tauS: number, rate = ABTASTRATE): Int16Array {
  const n = Math.round(rate * dauerS);
  const roh = new Float64Array(n);
  let spitze = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    for (const no of noten) {
      const u = t - no.ab;
      if (u < 0) continue;
      const huelle = Math.min(1, u / EINSATZ_S) * Math.exp(-u / tauS);
      s += huelle * (Math.sin(2 * Math.PI * no.f * u) + OKTAVE * Math.sin(4 * Math.PI * no.f * u));
    }
    s *= Math.min(1, (dauerS - t) / AUS_S);
    roh[i] = s;
    spitze = Math.max(spitze, Math.abs(s));
  }
  const faktor = spitze > 0 ? PEGEL / spitze : 0;
  const aus = new Int16Array(n);
  for (let i = 0; i < n; i++) aus[i] = Math.max(-32768, Math.min(32767, Math.round(roh[i]! * faktor * 32767)));
  return aus;
}


export const KLANG_BESTAETIGUNG = { noten: [{ f: 880, ab: 0 }, { f: 1175, ab: 0.11 }], dauerS: 0.6, tauS: 0.12 } as const;

export const KLANG_FRAGE = { noten: [{ f: 1047, ab: 0 }, { f: 784, ab: 0.32 }], dauerS: 1.3, tauS: 0.28 } as const;

export const KLANG_WEGPUNKT = { noten: [{ f: 1175, ab: 0 }], dauerS: 0.7, tauS: 0.18 } as const;

export const KLANG_ANNAEHERUNG = { noten: [{ f: 1319, ab: 0 }], dauerS: 0.15, tauS: 0.035 } as const;

export const KLANG_TIMER = {
  noten: [0, 1.5, 3].flatMap((g) => [0, 0.25, 0.5].map((s) => ({ f: 1047, ab: g + s }))),
  dauerS: 4.1, tauS: 0.16,
} as const;

export const KLANG_ZIEL = { noten: [{ f: 784, ab: 0 }, { f: 988, ab: 0.16 }, { f: 1175, ab: 0.32 }], dauerS: 1.2, tauS: 0.22 } as const;
