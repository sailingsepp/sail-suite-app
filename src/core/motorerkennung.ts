import { relAngle } from './geo';
import { polarSpeed, mastFaktorEffektiv, FARR_BAVARIA_50, type BoatPolar } from './polar';



export type Urteil = 'motor' | 'segel' | 'unklar';

export type Grund =
  | 'zu-spitz'              
  | 'schneller-als-polare'  
  | 'kein-wind'             
  | 'passt-zur-polare'      
  | 'zu-langsam'            
  | 'liegt'                 
  | 'manoever'              
  | 'hafennah'              
  | 'zu-wenig-segelwind'    
  | 'kein-kurs';            

export interface Lage {
  
  sog: number;
  
  cog: number | null;
  
  windAus: number;
  
  wind10: number;
  
  wind80?: number | null;
  boot?: BoatPolar;
  
  crewFaktor?: number;
  
  abstandStartNM?: number | null;
}

export interface Befund {
  urteil: Urteil;
  
  twa: number | null;
  
  moeglich: number | null;
  grund: Grund;
}

export interface Optionen {
  
  fahrtMinKn?: number;
  
  nichtSegelbarTwa?: number;
  
  ueberFaktor?: number;
  
  ueberAbsolutKn?: number;
  
  unterFaktor?: number;
  
  windMinKn?: number;
  
  segelWindMinKn?: number;
  
  manoeverKn?: number;
  
  spitzMinKn?: number;
  
  hafenNM?: number;
  
  ohneWindFahrtKn?: number;
  
  halteMinutenMotor?: number;
  
  halteMinutenSegel?: number;
  
  mindestBeobachtungen?: number;
}

export const VORGABEN: Required<Optionen> = {
  fahrtMinKn: 1.5,
  nichtSegelbarTwa: 30,
  ueberFaktor: 1.15,
  ueberAbsolutKn: 0.5,
  unterFaktor: 0.5,
  windMinKn: 3,
  ohneWindFahrtKn: 2.5,
  segelWindMinKn: 8,
  manoeverKn: 3,
  spitzMinKn: 4,
  hafenNM: 0.5,
  halteMinutenMotor: 4,
  halteMinutenSegel: 8,
  mindestBeobachtungen: 6,
};


export function beurteile(l: Lage, opt: Optionen = {}): Befund {
  const o = { ...VORGABEN, ...opt };
  const boot = l.boot ?? FARR_BAVARIA_50;

  if (l.cog === null) return { urteil: 'unklar', twa: null, moeglich: null, grund: 'kein-kurs' };
  if (l.sog < o.fahrtMinKn) return { urteil: 'unklar', twa: null, moeglich: null, grund: 'liegt' };

  const twa = relAngle(l.windAus, l.cog);

  
  
  
  
  
  
  
  
  if (l.sog < o.manoeverKn) {
    return { urteil: 'unklar', twa, moeglich: null, grund: 'manoever' };
  }

  
  
  
  if (l.wind10 < o.windMinKn) {
    return l.sog >= o.ohneWindFahrtKn
      ? { urteil: 'motor', twa, moeglich: null, grund: 'kein-wind' }
      : { urteil: 'unklar', twa, moeglich: null, grund: 'liegt' };
  }

  
  
  if (twa < o.nichtSegelbarTwa && l.sog >= o.spitzMinKn) {
    return { urteil: 'motor', twa, moeglich: null, grund: 'zu-spitz' };
  }

  
  
  
  const windFuerPolare = boot.referenceHeight === '10m'
    ? l.wind10
    : l.wind10 * mastFaktorEffektiv(l.wind10, l.wind80 ?? null);
  const moeglich = polarSpeed(windFuerPolare, twa, l.crewFaktor ?? 1, boot);

  if (l.sog > moeglich * o.ueberFaktor + o.ueberAbsolutKn) {
    return { urteil: 'motor', twa, moeglich, grund: 'schneller-als-polare' };
  }
  if (l.sog < moeglich * o.unterFaktor) {
    return { urteil: 'unklar', twa, moeglich, grund: 'zu-langsam' };
  }

  
  
  
  
  
  
  
  if (l.wind10 < o.segelWindMinKn) {
    return { urteil: 'unklar', twa, moeglich, grund: 'zu-wenig-segelwind' };
  }
  
  
  if (l.abstandStartNM != null && l.abstandStartNM < o.hafenNM) {
    return { urteil: 'unklar', twa, moeglich, grund: 'hafennah' };
  }
  return { urteil: 'segel', twa, moeglich, grund: 'passt-zur-polare' };
}

export interface Beobachtung {
  t: number;
  urteil: Urteil;
}



export function laufBeginn<B extends Beobachtung>(beobachtungen: readonly B[], ziel: 'motor' | 'segel'): B | null {
  let beginn: B | null = null;
  for (let i = beobachtungen.length - 1; i >= 0; i--) {
    const b = beobachtungen[i]!;
    if (b.urteil === ziel) beginn = b;
    else if (b.urteil !== 'unklar') break;
  }
  return beginn;
}

export function vorschlag(
  beobachtungen: Beobachtung[],
  jetzigerAntrieb: 'segel' | 'motor' | null,
  abgelehntBis: number,
  jetzt: number,
  opt: Optionen = {},
): 'motor' | 'segel' | null {
  const o = { ...VORGABEN, ...opt };
  if (jetzt < abgelehntBis) return null;

  const juengste = beobachtungen[beobachtungen.length - 1];
  if (!juengste || juengste.urteil === 'unklar') return null;
  const ziel = juengste.urteil;
  if (ziel === jetzigerAntrieb) return null;

  const haltenMs = (ziel === 'motor' ? o.halteMinutenMotor : o.halteMinutenSegel) * 60_000;
  const fensterAb = jetzt - haltenMs;
  const imFenster = beobachtungen.filter((b) => b.t >= fensterAb);

  
  
  
  
  
  
  
  
  
  
  if (imFenster.some((b) => b.urteil !== 'unklar' && b.urteil !== ziel)) return null;
  const treffer = imFenster.filter((b) => b.urteil === ziel);
  if (treffer.length < o.mindestBeobachtungen) return null;

  
  
  
  
  const erster = treffer[0]!;
  if (juengste.t - erster.t < haltenMs * 0.9) return null;

  return ziel;
}
