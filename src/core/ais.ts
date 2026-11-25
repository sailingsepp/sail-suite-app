import { distNM, bearingDeg, toRad, destPoint } from './geo';

export interface AisZiel {

  mmsi: number;

  name?: string;
  lat: number;
  lon: number;

  sog?: number;

  cog?: number;

  typ?: number;

  ziel?: string;

  gemeldet: number;

  alterS?: number;
}

export const AIS_FAHRT_AB_KN = 1;

export const AIS_MAX_ALTER_FAHRT_S = 180;

export const AIS_ALTER_ZEIGEN_AB_S = 60;

export function fortgeschrieben(z: AisZiel, alterS: number): AisZiel | null {
  const faehrt = z.sog !== undefined && z.sog >= AIS_FAHRT_AB_KN;
  if (!faehrt) return z;
  if (alterS > AIS_MAX_ALTER_FAHRT_S) return null;
  if (z.cog === undefined || !(alterS > 0)) return z;
  const [lat, lon] = destPoint(z.lat, z.lon, z.cog, (z.sog! * alterS) / 3600);
  return { ...z, lat, lon };
}

export interface AisNaeherung {
  ziel: AisZiel;

  abstandNM: number;

  peilung: number;

  cpaNM: number | null;

  tcpaMin: number | null;

  alterS?: number;
  stufe: Naeherungsstufe;
}

export type Naeherungsstufe =

  | 'fern'

  | 'nah'

  | 'eng';

export interface AisSchwellen {

  cpaEngNM: number;

  tcpaEngMin: number;

  cpaNahNM: number;
  tcpaNahMin: number;

  sofortEngNM: number;

  minRelKn: number;
}

export const SCHWELLEN: AisSchwellen = {
  cpaEngNM: 0.5,
  tcpaEngMin: 15,
  cpaNahNM: 1.0,
  tcpaNahMin: 25,
  sofortEngNM: 0.25,
  minRelKn: 0.5,
};

export interface EigeneLage {
  lat: number;
  lon: number;

  sog: number;

  cog: number;
}

function vektor(sog: number, cog: number): { n: number; e: number } {
  const r = toRad(cog);
  return { n: sog * Math.cos(r), e: sog * Math.sin(r) };
}

export function relativFahrtKn(
  eigen: EigeneLage, ziel: { sog?: number; cog?: number },
): number {
  if (ziel.sog === undefined || ziel.cog === undefined) return Math.abs(eigen.sog);
  const ve = vektor(ziel.sog, ziel.cog);
  const vo = vektor(eigen.sog, eigen.cog);
  return Math.hypot(ve.n - vo.n, ve.e - vo.e);
}

export function cpaTcpa(
  eigen: EigeneLage, ziel: { lat: number; lon: number; sog?: number; cog?: number },
  s: AisSchwellen = SCHWELLEN,
): { cpaNM: number | null; tcpaMin: number | null } {
  if (ziel.sog === undefined || ziel.cog === undefined) return { cpaNM: null, tcpaMin: null };

  const k = Math.cos(toRad(eigen.lat));

  const rN = (ziel.lat - eigen.lat) * 60;
  const rE = (ziel.lon - eigen.lon) * 60 * k;

  const ve = vektor(ziel.sog, ziel.cog);
  const vo = vektor(eigen.sog, eigen.cog);
  const vN = ve.n - vo.n;
  const vE = ve.e - vo.e;

  const vQuadrat = vN * vN + vE * vE;

  if (vQuadrat < s.minRelKn * s.minRelKn) return { cpaNM: null, tcpaMin: null };

  const tcpaH = -(rN * vN + rE * vE) / vQuadrat;
  const cN = rN + vN * tcpaH;
  const cE = rE + vE * tcpaH;
  return { cpaNM: Math.hypot(cN, cE), tcpaMin: tcpaH * 60 };
}

export function naeherungsstufe(
  abstandNM: number, cpaNM: number | null, tcpaMin: number | null,
  s: AisSchwellen = SCHWELLEN,

  relKn?: number,
): Naeherungsstufe {

  const bewegt = relKn === undefined || relKn >= s.minRelKn;
  const laeuftWeg = tcpaMin !== null && tcpaMin < 0;
  if (abstandNM <= s.sofortEngNM && bewegt && !laeuftWeg) return 'eng';
  if (cpaNM === null || tcpaMin === null || tcpaMin < 0) return 'fern';
  if (cpaNM <= s.cpaEngNM && tcpaMin <= s.tcpaEngMin) return 'eng';
  if (cpaNM <= s.cpaNahNM && tcpaMin <= s.tcpaNahMin) return 'nah';
  return 'fern';
}

const anzeigeZehntel = (nm: number): number => Math.round(nm * 10) / 10;

export function naeherungen(
  eigen: EigeneLage, ziele: AisZiel[], radiusNM = 3, s: AisSchwellen = SCHWELLEN,

  seitAbrufS = 0,
): AisNaeherung[] {
  const raus: AisNaeherung[] = [];
  for (const roh of ziele) {
    const alterS = roh.alterS === undefined ? undefined : roh.alterS + seitAbrufS;
    const z = fortgeschrieben(roh, alterS ?? 0);
    if (!z) continue;
    const abstandNM = distNM(eigen.lat, eigen.lon, z.lat, z.lon);
    if (abstandNM > radiusNM) continue;
    const { cpaNM, tcpaMin } = cpaTcpa(eigen, z, s);
    const n: AisNaeherung = {
      ziel: z,
      abstandNM,
      peilung: bearingDeg(eigen.lat, eigen.lon, z.lat, z.lon),
      cpaNM,
      tcpaMin,

      stufe: naeherungsstufe(anzeigeZehntel(abstandNM), cpaNM === null ? null : anzeigeZehntel(cpaNM),
        tcpaMin === null ? null : (tcpaMin < 0 ? tcpaMin : Math.round(tcpaMin)), s, relativFahrtKn(eigen, z)),
    };
    if (alterS !== undefined) n.alterS = alterS;
    raus.push(n);
  }
  const rang: Record<Naeherungsstufe, number> = { eng: 0, nah: 1, fern: 2 };
  return raus.sort((a, b) => rang[a.stufe] - rang[b.stufe] || a.abstandNM - b.abstandNM);
}

export function schiffstyp(typ: number | undefined, sprache: 'de' | 'en' = 'de'): string | null {
  if (typ === undefined || !Number.isFinite(typ) || typ <= 0 || typ > 99) return null;
  const en = sprache === 'en';
  if (typ >= 20 && typ <= 29) return en ? 'wing-in-ground craft' : 'Bodeneffektfahrzeug';
  if (typ === 30) return en ? 'fishing vessel' : 'Fischereifahrzeug';
  if (typ === 31 || typ === 32) return en ? 'towing vessel' : 'Schlepper';
  if (typ === 33) return en ? 'dredger' : 'Bagger';
  if (typ === 34) return en ? 'diving operations' : 'Taucherboot';
  if (typ === 35) return en ? 'military vessel' : 'Militärfahrzeug';
  if (typ === 36) return en ? 'sailing vessel' : 'Segelfahrzeug';
  if (typ === 37) return en ? 'pleasure craft' : 'Sportboot';
  if (typ >= 40 && typ <= 49) return en ? 'high-speed craft' : 'Hochgeschwindigkeitsfahrzeug';
  if (typ === 50) return en ? 'pilot vessel' : 'Lotsenboot';
  if (typ === 51) return en ? 'search and rescue' : 'Seenotrettung';
  if (typ === 52) return en ? 'tug' : 'Schlepper';
  if (typ === 53) return en ? 'port tender' : 'Hafenboot';
  if (typ === 55) return en ? 'law enforcement' : 'Behördenfahrzeug';
  if (typ === 58) return en ? 'medical transport' : 'Sanitätstransport';
  if (typ >= 60 && typ <= 69) return en ? 'passenger ship' : 'Fahrgastschiff';
  if (typ >= 70 && typ <= 79) return en ? 'cargo ship' : 'Frachtschiff';
  if (typ >= 80 && typ <= 89) return en ? 'tanker' : 'Tanker';
  if (typ >= 90 && typ <= 99) return en ? 'other vessel' : 'sonstiges Fahrzeug';
  return null;
}

export const VORSCHLAG_MAX = 3;

export function vorschlagsZiele(alle: AisNaeherung[], max = VORSCHLAG_MAX): AisNaeherung[] {
  return alle.slice(0, max);
}
