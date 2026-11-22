import type { Strom, Seegang, Gezeit } from './types';
import { alsUtc, type UtcDate } from './time';
import { kreuzWinkel } from '@/data/marine';




export interface CopernicusGitter {
  lat: number[];
  lon: number[];
  
  zeiten: string[];
  
  u: (number | null)[][][];
  
  v: (number | null)[][][];
  
  hs: (number | null)[][][];
  
  richtung: (number | null)[][][];
  
  periode: (number | null)[][][];
  
  windseeHoehe?: (number | null)[][][];
  
  windseeRichtung?: (number | null)[][][];
  
  windseePeriode?: (number | null)[][][];
  
  duenungHoehe?: (number | null)[][][];
  
  duenungRichtung?: (number | null)[][][];
  
  duenungPeriode?: (number | null)[][][];
  
  maxHoehe?: (number | null)[][][];
  
  stokesU?: (number | null)[][][];
  
  stokesV?: (number | null)[][][];
  
  temperatur?: (number | null)[][][];
  
  wasserstand?: (number | null)[][][];
  
  wasserstandOhneGezeit?: (number | null)[][][];
  
  wasserstandOhneGezeitTakt?: 'PT1H' | 'P1D';
}


export function parseZeitpunkt(s: string): number {
  const gekuerzt = s.length > 23 ? s.slice(0, 23) : s;
  const mitZone = gekuerzt.endsWith('Z') ? gekuerzt : gekuerzt + 'Z';
  return new Date(mitZone).getTime();
}


function unterIndex(achse: number[], wert: number): number | null {
  if (achse.length < 2) return null;
  if (wert < achse[0]! || wert > achse[achse.length - 1]!) return null;
  let i = achse.findIndex((v, k) => k < achse.length - 1 && wert >= v && wert <= achse[k + 1]!);
  if (i === -1) i = achse.length - 2;
  return i;
}


function bilinear(lat: number[], lon: number[], werte: (number | null)[][], zielLat: number, zielLon: number): number | null {
  const i = unterIndex(lat, zielLat);
  const j = unterIndex(lon, zielLon);
  if (i == null || j == null) return null;
  const a = werte[i]?.[j], b = werte[i]?.[j + 1], c = werte[i + 1]?.[j], d = werte[i + 1]?.[j + 1];
  if (a == null || b == null || c == null || d == null) return null;
  const tLat = (zielLat - lat[i]!) / (lat[i + 1]! - lat[i]!);
  const tLon = (zielLon - lon[j]!) / (lon[j + 1]! - lon[j]!);
  return a * (1 - tLat) * (1 - tLon) + b * (1 - tLat) * tLon + c * tLat * (1 - tLon) + d * tLat * tLon;
}


function bilinearWinkel(lat: number[], lon: number[], werteGrad: (number | null)[][], zielLat: number, zielLon: number): number | null {
  const cosWerte = werteGrad.map((zeile) => zeile.map((v) => (v == null ? null : Math.cos((v * Math.PI) / 180))));
  const sinWerte = werteGrad.map((zeile) => zeile.map((v) => (v == null ? null : Math.sin((v * Math.PI) / 180))));
  const c = bilinear(lat, lon, cosWerte, zielLat, zielLon);
  const s = bilinear(lat, lon, sinWerte, zielLat, zielLon);
  if (c == null || s == null) return null;
  return ((Math.atan2(s, c) * 180) / Math.PI + 360) % 360;
}


function zeitBracket(zeitenMs: number[], zielMs: number): { i0: number; i1: number; frac: number } {
  let idx = zeitenMs.findIndex((t) => t > zielMs);
  if (idx === -1) idx = zeitenMs.length - 1;
  if (idx === 0) idx = 1;
  const i0 = idx - 1, i1 = idx;
  const t0 = zeitenMs[i0]!, t1 = zeitenMs[i1]!;
  const frac = t1 > t0 ? Math.min(1, Math.max(0, (zielMs - t0) / (t1 - t0))) : 0;
  return { i0, i1, frac };
}


function feldAn(
  g: { lat: number[]; lon: number[] }, feld: (number | null)[][][],
  bracket: { i0: number; i1: number; frac: number }, lat: number, lon: number,
): number | null {
  const w0 = bilinear(g.lat, g.lon, feld[bracket.i0] ?? [], lat, lon);
  const w1 = bilinear(g.lat, g.lon, feld[bracket.i1] ?? [], lat, lon);
  if (w0 == null || w1 == null) return null;
  return w0 + (w1 - w0) * bracket.frac;
}


function winkelAn(
  g: { lat: number[]; lon: number[] }, feld: (number | null)[][][],
  bracket: { i0: number; i1: number; frac: number }, lat: number, lon: number,
): number | null {
  const w0 = bilinearWinkel(g.lat, g.lon, feld[bracket.i0] ?? [], lat, lon);
  const w1 = bilinearWinkel(g.lat, g.lon, feld[bracket.i1] ?? [], lat, lon);
  if (w0 == null || w1 == null) return null;
  const diff = ((w1 - w0 + 540) % 360) - 180;
  return (w0 + diff * bracket.frac + 360) % 360;
}

let zeitenCache: WeakMap<CopernicusGitter, number[]> | null = null;
function geparsteZeiten(g: CopernicusGitter): number[] {
  zeitenCache ??= new WeakMap();
  let t = zeitenCache.get(g);
  if (!t) { t = g.zeiten.map(parseZeitpunkt); zeitenCache.set(g, t); }
  return t;
}


export function gitterFrisch(g: CopernicusGitter, zeitpunkt: UtcDate): boolean {
  const zeiten = geparsteZeiten(g);
  if (zeiten.length === 0) return false;
  return zeitpunkt.getTime() <= zeiten[zeiten.length - 1]!;
}

const MS_ZU_KN = 3600 / 1852;


export function stromAusGitter(g: CopernicusGitter, lat: number, lon: number, zeitpunkt: UtcDate): Strom {
  const bracket = zeitBracket(geparsteZeiten(g), zeitpunkt.getTime());
  const u = feldAn(g, g.u, bracket, lat, lon);
  const v = feldAn(g, g.v, bracket, lat, lon);
  if (u == null || v == null) return { speed: 0, dir: 0, valid: false };
  const speedMs = Math.hypot(u, v);
  
  
  
  const dir = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
  return { speed: speedMs * MS_ZU_KN, dir, valid: true };
}


export function seegangAusGitter(g: CopernicusGitter, lat: number, lon: number, zeitpunkt: UtcDate): Seegang {
  const none: Seegang = {
    hs: 0, tp: 0, dir: 0, swellHs: 0, swellTp: 0, swellDir: 0,
    windWaveHs: 0, windWaveTp: 0, windWaveDir: 0, steep: 0, kreuzWinkel: 0, valid: false,
  };
  const bracket = zeitBracket(geparsteZeiten(g), zeitpunkt.getTime());
  const hs = feldAn(g, g.hs, bracket, lat, lon);
  if (hs == null) return none;
  const tp = feldAn(g, g.periode, bracket, lat, lon) ?? 0;
  const dir = winkelAn(g, g.richtung, bracket, lat, lon) ?? 0;

  const windWaveHsG = g.windseeHoehe ? feldAn(g, g.windseeHoehe, bracket, lat, lon) : null;
  const windWaveDirG = g.windseeRichtung ? winkelAn(g, g.windseeRichtung, bracket, lat, lon) : null;
  const windWaveTpG = g.windseePeriode ? feldAn(g, g.windseePeriode, bracket, lat, lon) : null;
  const swellHsG = g.duenungHoehe ? feldAn(g, g.duenungHoehe, bracket, lat, lon) : null;
  const swellDirG = g.duenungRichtung ? winkelAn(g, g.duenungRichtung, bracket, lat, lon) : null;
  const swellTpG = g.duenungPeriode ? feldAn(g, g.duenungPeriode, bracket, lat, lon) : null;

  
  
  
  const getrennt = windWaveDirG != null && swellDirG != null;
  const windWaveHs = windWaveHsG ?? hs;
  const windWaveTp = windWaveTpG ?? tp;
  const windWaveDir = windWaveDirG ?? dir;
  const swellHs = swellHsG ?? 0;
  const swellTp = swellTpG ?? 0;
  const swellDir = swellDirG ?? 0;
  
  
  const L = windWaveTp > 0 ? (9.81 * windWaveTp * windWaveTp) / (2 * Math.PI) : 0;

  const maxIndividualHs = g.maxHoehe ? feldAn(g, g.maxHoehe, bracket, lat, lon) : null;
  const stokesU = g.stokesU ? feldAn(g, g.stokesU, bracket, lat, lon) : null;
  const stokesV = g.stokesV ? feldAn(g, g.stokesV, bracket, lat, lon) : null;
  let stokesSpeed: number | undefined, stokesDir: number | undefined;
  if (stokesU != null && stokesV != null) {
    stokesSpeed = Math.hypot(stokesU, stokesV) * MS_ZU_KN;
    stokesDir = ((Math.atan2(stokesU, stokesV) * 180) / Math.PI + 360) % 360;
  }

  return {
    hs, tp, dir,
    swellHs, swellTp, swellDir,
    windWaveHs, windWaveTp, windWaveDir,
    steep: L > 0 ? windWaveHs / L : 0,
    kreuzWinkel: kreuzWinkel(windWaveHs, windWaveDir, swellHs, swellDir, getrennt),
    valid: true,
    
    
    
    ...(maxIndividualHs != null ? { maxIndividualHs } : {}),
    ...(stokesSpeed != null && stokesDir != null ? { stokesSpeed, stokesDir } : {}),
  };
}


export function temperaturAusGitter(g: CopernicusGitter, lat: number, lon: number, zeitpunkt: UtcDate): number | null {
  if (!g.temperatur) return null;
  const bracket = zeitBracket(geparsteZeiten(g), zeitpunkt.getTime());
  return feldAn(g, g.temperatur, bracket, lat, lon);
}


export function temperaturTagAusGitter(g: CopernicusGitter, lat: number, lon: number, dateStr: string): number[] {
  if (!g.temperatur) return [];
  const werte: number[] = [];
  g.zeiten.forEach((iso, i) => {
    if (!iso.startsWith(dateStr)) return;
    const v = bilinear(g.lat, g.lon, g.temperatur![i] ?? [], lat, lon);
    if (v != null) werte.push(v);
  });
  return werte;
}


let mittelfeldCache: WeakMap<CopernicusGitter, (number | null)[][]> | null = null;
function wasserstandMittelfeld(g: CopernicusGitter): (number | null)[][] {
  mittelfeldCache ??= new WeakMap();
  const cached = mittelfeldCache.get(g);
  if (cached) return cached;
  const feld = mittelfeld(g, g.wasserstand ?? []);
  mittelfeldCache.set(g, feld);
  return feld;
}


export function wasserstandAusGitter(g: CopernicusGitter, lat: number, lon: number, zeitpunkt: UtcDate): Gezeit {
  const none: Gezeit = { hoeheM: 0, valid: false };
  if (!g.wasserstand) return none;
  const bracket = zeitBracket(geparsteZeiten(g), zeitpunkt.getTime());
  const roh = feldAn(g, g.wasserstand, bracket, lat, lon);
  if (roh == null) return none;
  const mittel = bilinear(g.lat, g.lon, wasserstandMittelfeld(g), lat, lon);
  if (mittel == null) return none;
  return { hoeheM: roh - mittel, valid: true };
}



let mittelOhneGezeitCache: WeakMap<CopernicusGitter, (number | null)[][]> | null = null;
function mittelfeldOhneGezeit(g: CopernicusGitter): (number | null)[][] {
  mittelOhneGezeitCache ??= new WeakMap();
  const cached = mittelOhneGezeitCache.get(g);
  if (cached) return cached;
  const feld = mittelfeld(g, g.wasserstandOhneGezeit ?? []);
  mittelOhneGezeitCache.set(g, feld);
  return feld;
}

function mittelfeld(g: CopernicusGitter, schichten: (number | null)[][][]): (number | null)[][] {
  return g.lat.map((_, i) => g.lon.map((_, j) => {
    let summe = 0, n = 0;
    for (const zeitschicht of schichten) {
      const v = zeitschicht[i]?.[j];
      if (v != null) { summe += v; n++; }
    }
    return n > 0 ? summe / n : null;
  }));
}


export function gitterTeiltGezeit(g: CopernicusGitter): boolean {
  return !!g.wasserstand && !!g.wasserstandOhneGezeit;
}


export function modellGezeitAusGitter(g: CopernicusGitter, lat: number, lon: number, zeitpunkt: UtcDate): number | null {
  if (!g.wasserstand || !g.wasserstandOhneGezeit) return null;
  if (g.wasserstandOhneGezeitTakt === 'P1D') return null;
  const bracket = zeitBracket(geparsteZeiten(g), zeitpunkt.getTime());
  const mit = feldAn(g, g.wasserstand, bracket, lat, lon);
  const ohne = feldAn(g, g.wasserstandOhneGezeit, bracket, lat, lon);
  return mit == null || ohne == null ? null : mit - ohne;
}


export function wetteranteilAusGitter(g: CopernicusGitter, lat: number, lon: number, zeitpunkt: UtcDate): Gezeit {
  const none: Gezeit = { hoeheM: 0, valid: false };
  if (!g.wasserstandOhneGezeit) return none;
  const bracket = zeitBracket(geparsteZeiten(g), zeitpunkt.getTime());
  const roh = feldAn(g, g.wasserstandOhneGezeit, bracket, lat, lon);
  if (roh == null) return none;
  const mittel = bilinear(g.lat, g.lon, mittelfeldOhneGezeit(g), lat, lon);
  if (mittel == null) return none;
  return { hoeheM: roh - mittel, valid: true, anteil: 'wetter' };
}

export interface ModellWasserstand {
  
  zeit: Date;
  
  gezeitM: number | null;
  
  wetterM: number;
}


export function modellWasserstandReihe(g: CopernicusGitter, lat: number, lon: number): ModellWasserstand[] {
  if (!gitterTeiltGezeit(g)) return [];
  const out: ModellWasserstand[] = [];
  for (const ms of geparsteZeiten(g)) {
    
    const zeit = alsUtc(new Date(ms));
    const gezeit = modellGezeitAusGitter(g, lat, lon, zeit);
    const wetter = wetteranteilAusGitter(g, lat, lon, zeit);
    if (wetter.valid) out.push({ zeit, gezeitM: gezeit, wetterM: wetter.hoeheM });
  }
  return out;
}


export function extremeAusReihe(reihe: readonly { zeit: Date; hoeheM: number }[]): { zeit: Date; hoeheM: number; art: 'HW' | 'NW' }[] {
  const out: { zeit: Date; hoeheM: number; art: 'HW' | 'NW' }[] = [];
  for (let i = 1; i < reihe.length - 1; i++) {
    const a = reihe[i - 1]!.hoeheM, b = reihe[i]!.hoeheM, c = reihe[i + 1]!.hoeheM;
    const hoch = b > a && b >= c, tief = b < a && b <= c;
    if (!hoch && !tief) continue;
    const nenner = a - 2 * b + c;
    const versatz = nenner !== 0 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * nenner))) : 0;
    const dt = reihe[i + 1]!.zeit.getTime() - reihe[i]!.zeit.getTime();
    out.push({
      zeit: new Date(reihe[i]!.zeit.getTime() + versatz * dt),
      hoeheM: b - ((a - c) * versatz) / 4,
      art: hoch ? 'HW' : 'NW',
    });
  }
  return out;
}


export function revierDeckt(bbox: [number, number, number, number], lat: number, lon: number): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}


export function zuschneiden(g: CopernicusGitter, sued: number, west: number, nord: number, ost: number): CopernicusGitter {
  const bereich = (achse: number[], von: number, bis: number): [number, number] => {
    let a = 0, b = achse.length - 1;
    while (a < achse.length - 1 && achse[a + 1]! <= von) a++;
    while (b > 0 && achse[b - 1]! >= bis) b--;
    return a <= b ? [a, b] : [0, -1];
  };
  const [i0, i1] = bereich(g.lat, sued, nord);
  const [j0, j1] = bereich(g.lon, west, ost);
  if (i0 === 0 && j0 === 0 && i1 === g.lat.length - 1 && j1 === g.lon.length - 1) return g;
  const nLat = g.lat.length, nLon = g.lon.length;
  const aus: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(g)) {
    const istFeld = Array.isArray(v) && Array.isArray(v[0]) && (v[0] as unknown[]).length === nLat
      && Array.isArray((v[0] as unknown[])[0]) && ((v[0] as unknown[][])[0]!).length === nLon;
    aus[k] = istFeld
      ? (v as (number | null)[][][]).map((t) => t.slice(i0, i1 + 1).map((zeile) => zeile.slice(j0, j1 + 1)))
      : v;
  }
  aus['lat'] = g.lat.slice(i0, i1 + 1);
  aus['lon'] = g.lon.slice(j0, j1 + 1);
  return aus as unknown as CopernicusGitter;
}


export function zuschneidenUm(g: CopernicusGitter, punkte: readonly { lat: number; lon: number }[], randGrad: number): CopernicusGitter {
  if (!punkte.length) return g;
  const lats = punkte.map((p) => p.lat), lons = punkte.map((p) => p.lon);
  return zuschneiden(g, Math.min(...lats) - randGrad, Math.min(...lons) - randGrad, Math.max(...lats) + randGrad, Math.max(...lons) + randGrad);
}


export interface KachelRaster { zeilen: number[]; spalten: number[]; zb: number; sb: number; nLat: number; nLon: number }


export function kachelnFuer(
  r: KachelRaster, sued: number, west: number, nord: number, ost: number,
): { r0: number; r1: number; c0: number; c1: number } | null {
  const block = (achse: number[], wert: number) => {
    let k = 0;
    while (k < achse.length - 1 && achse[k + 1]! <= wert) k++;
    return k;
  };
  if (!r.zeilen.length || !r.spalten.length) return null;
  const r0 = block(r.zeilen, sued), r1 = block(r.zeilen, nord);
  const c0 = block(r.spalten, west), c1 = block(r.spalten, ost);
  return r1 >= r0 && c1 >= c0 ? { r0, r1, c0, c1 } : null;
}


export function fuegeKachelnZusammen(
  kachel: (r: number, c: number) => CopernicusGitter | undefined, b: { r0: number; r1: number; c0: number; c1: number },
): CopernicusGitter | null {
  const raster: CopernicusGitter[][] = [];
  for (let r = b.r0; r <= b.r1; r++) {
    const zeile: CopernicusGitter[] = [];
    for (let c = b.c0; c <= b.c1; c++) {
      const k = kachel(r, c);
      if (!k) return null;
      zeile.push(k);
    }
    raster.push(zeile);
  }
  const erste = raster[0]![0]!;
  const aus: Record<string, unknown> = {};
  const istFeld = (g: CopernicusGitter, v: unknown) => Array.isArray(v) && Array.isArray(v[0]) && (v[0] as unknown[]).length === g.lat.length
    && Array.isArray((v[0] as unknown[])[0]) && ((v[0] as unknown[][])[0]!).length === g.lon.length;
  for (const [k, v] of Object.entries(erste)) {
    if (k === 'lat' || k === 'lon') continue;
    if (!istFeld(erste, v)) { aus[k] = v; continue; }
    const zeiten = (v as unknown[]).length;
    const feld: (number | null)[][][] = [];
    for (let t = 0; t < zeiten; t++) {
      const schicht: (number | null)[][] = [];
      for (const zeile of raster) {
        const n = zeile[0]!.lat.length;
        for (let i = 0; i < n; i++) {
          const z: (number | null)[] = [];
          for (const g of zeile) z.push(...((g as unknown as Record<string, (number | null)[][][]>)[k]?.[t]?.[i] ?? []));
          schicht.push(z);
        }
      }
      feld.push(schicht);
    }
    aus[k] = feld;
  }
  aus['lat'] = raster.flatMap((zeile) => zeile[0]!.lat);
  aus['lon'] = raster[0]!.flatMap((g) => g.lon);
  return aus as unknown as CopernicusGitter;
}
