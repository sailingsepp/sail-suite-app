
import { beurteile, type Urteil, type Optionen } from './motorerkennung';
import { OBERTON_MIN } from './motorklang';
import type { BoatPolar } from './polar';

export interface KlangMessung {
  
  treffer: number;
  
  h: number;
  
  f0: number;
  
  pegel: number;
}

export interface KlangLage {
  
  klang: KlangMessung | null;
  
  sog: number | null;
  
  cog: number | null;
  
  wind?: { aus: number; kn: number; kn80?: number | null } | null;
  boot?: BoatPolar;
  abstandStartNM?: number | null;
}

export type KlangGrund =
  | 'kein-ton' | 'zu-leise' | 'grenzfall'
  | 'klang-motor' | 'motor-liegt'
  | 'klang-still' | 'langsam' | 'zu-spitz' | 'schneller-als-polare' | 'kein-wind';

export interface KlangBefund {
  urteil: Urteil;
  grund: KlangGrund;
}

export const KLANG = {
  
  stummDbfs: -90,
  
  stillMaxTreffer: 1,
  
  motorFahrtKn: 0.8,
  
  segelFahrtKn: 1.5,
  
  taktMs: 5000,
} as const;


export const EINSPRUCH: Optionen = {
  fahrtMinKn: KLANG.segelFahrtKn,
  nichtSegelbarTwa: 30,
  spitzMinKn: 4,
  ueberFaktor: 1.4,
  ueberAbsolutKn: 1,
  windMinKn: 3,
  ohneWindFahrtKn: 3,
  segelWindMinKn: 0,
  manoeverKn: 0,
  hafenNM: 0,
};


export const KLANG_HALTEN: Optionen = {
  halteMinutenMotor: 1,
  halteMinutenSegel: 2,
  mindestBeobachtungen: 8,
};

export function beurteileKlang(l: KlangLage): KlangBefund {
  const k = l.klang;
  if (!k) return { urteil: 'unklar', grund: 'kein-ton' };
  if (!(k.pegel > KLANG.stummDbfs)) return { urteil: 'unklar', grund: 'zu-leise' };

  if (k.treffer >= OBERTON_MIN) {
    if (l.sog === null || l.sog < KLANG.motorFahrtKn) return { urteil: 'unklar', grund: 'motor-liegt' };
    return { urteil: 'motor', grund: 'klang-motor' };
  }
  if (k.treffer > KLANG.stillMaxTreffer) return { urteil: 'unklar', grund: 'grenzfall' };

  
  if (l.sog === null || l.sog < KLANG.segelFahrtKn) return { urteil: 'unklar', grund: 'langsam' };
  if (l.wind && l.cog !== null) {
    const b = beurteile({
      sog: l.sog, cog: l.cog, windAus: l.wind.aus, wind10: l.wind.kn, wind80: l.wind.kn80 ?? null,
      ...(l.boot ? { boot: l.boot } : {}), abstandStartNM: null,
    }, EINSPRUCH);
    if (b.urteil === 'motor') {
      const grund = b.grund === 'zu-spitz' || b.grund === 'schneller-als-polare' || b.grund === 'kein-wind'
        ? b.grund : 'zu-spitz';
      return { urteil: 'unklar', grund };
    }
  }
  return { urteil: 'segel', grund: 'klang-still' };
}
