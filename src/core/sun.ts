import { toRad, toDeg } from './geo';

const J2000 = 2451545.0009;

const SCHIEFE_DER_EKLIPTIK = 23.4397;

export type Daemmerungsstufe = 'sonne' | 'buergerlich' | 'nautisch' | 'astronomisch';

export const DAEMMERUNG_NAME: Record<Daemmerungsstufe, string> = {
  sonne: 'Sonnenuntergang',
  buergerlich: 'bürgerliche Dämmerung',
  nautisch: 'nautische Dämmerung',
  astronomisch: 'astronomische Dämmerung',
};

export const DAEMMERUNGSWINKEL: Record<Daemmerungsstufe, number> = {
  sonne: -0.833,
  buergerlich: -6,
  nautisch: -12,
  astronomisch: -18,
};

function julianischeTageszahl(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

function julianischesDatumZuDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

export interface Sonnenzeit {
  auf: Date;
  unter: Date;
}

export function tageSeitJ2000(d: Date): number {
  return d.getTime() / 86400000 - 10957.5;
}

export function sonnenOrt(d: Date): { ra: number; dec: number } {
  const n = tageSeitJ2000(d);
  const m = norm360(357.5291 + 0.98560028 * n);
  const mRad = toRad(m);
  const c = 1.9148 * Math.sin(mRad) + 0.0200 * Math.sin(2 * mRad) + 0.0003 * Math.sin(3 * mRad);
  const lambda = toRad(norm360(m + 102.9372 + c + 180));
  const eps = toRad(SCHIEFE_DER_EKLIPTIK);
  return {
    ra: toDeg(Math.atan2(Math.sin(lambda) * Math.cos(eps), Math.cos(lambda))),
    dec: toDeg(Math.asin(Math.sin(lambda) * Math.sin(eps))),
  };
}

export function sternzeit(d: Date): number {
  return norm360(280.16 + 360.9856235 * tageSeitJ2000(d));
}

export function hoeheAusStundenwinkel(stundenwinkelDeg: number, decDeg: number, lat: number): number {
  const h = toRad(stundenwinkelDeg), dec = toRad(decDeg), phi = toRad(lat);
  return toDeg(Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)));
}

export function sonnenhoehe(lat: number, lon: number, d: Date): number {
  const { ra, dec } = sonnenOrt(d);
  return hoeheAusStundenwinkel(sternzeit(d) + lon - ra, dec, lat);
}

export function sonnenzeiten(lat: number, lon: number, dateStr: string, elevationDeg: number): Sonnenzeit | null {
  const jd = julianischeTageszahl(dateStr);
  const lw = -lon;

  const nStern = jd - J2000 - lw / 360;
  const n = Math.round(nStern);
  const jStern = J2000 + lw / 360 + n;

  const m = norm360(357.5291 + 0.98560028 * (jStern - 2451545));
  const mRad = toRad(m);
  const c = 1.9148 * Math.sin(mRad) + 0.0200 * Math.sin(2 * mRad) + 0.0003 * Math.sin(3 * mRad);
  const lambda = norm360(m + 102.9372 + c + 180);
  const lambdaRad = toRad(lambda);

  const jTransit = jStern + 0.0053 * Math.sin(mRad) - 0.0069 * Math.sin(2 * lambdaRad);

  const delta = Math.asin(Math.sin(lambdaRad) * Math.sin(toRad(SCHIEFE_DER_EKLIPTIK)));

  const phi = toRad(lat);
  const h0 = toRad(elevationDeg);
  const cosOmega = (Math.sin(h0) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
  if (cosOmega > 1 || cosOmega < -1) return null;

  const omega0 = toDeg(Math.acos(cosOmega));
  return {
    auf: julianischesDatumZuDate(jTransit - omega0 / 360),
    unter: julianischesDatumZuDate(jTransit + omega0 / 360),
  };
}
