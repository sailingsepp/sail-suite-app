import { deuteTiefe, ersteKlareTiefe, type Tiefenpunkt } from '@/core/tiefe';
import { bearingDeg, destPoint } from '@/core/geo';
import type { Punkt, StreckenPunkt } from '@/core/types';
import { ausCache, inCache, schluessel } from './tiefeCache';



const BASIS = 'https://rest.emodnet-bathymetry.eu';

const RUHE_MS = 5 * 60_000;
let ruheBis = 0;


const wkt = (p: Punkt) => `${p.lon.toFixed(6)} ${p.lat.toFixed(6)}`;

interface RohAntwort {
  avg?: number | null;
  min?: number | null;
  max?: number | null;
  stdev?: number | null;
  elementarySurfaces?: number | null;
  reference?: { identifier?: string; type?: string } | null;
}

async function hole(pfad: string): Promise<unknown> {
  if (Date.now() < ruheBis) throw new Error('EMODnet: Ruhezeit nach Fehlschlag');
  const res = await fetch(BASIS + pfad);
  if (!res.ok) {
    ruheBis = Date.now() + RUHE_MS;
    throw new Error('EMODnet Bathymetry ' + res.status);
  }
  return res.json();
}


export async function fetchTiefe(punkt: { lat: number; lon: number }): Promise<Tiefenpunkt> {
  const geom = `POINT(${wkt(punkt)})`;
  const id = schluessel(geom);
  const gemerkt = await ausCache<Tiefenpunkt>(id);
  if (gemerkt) return gemerkt;
  try {
    const j = (await hole(`/depth_sample?geom=${geom}`)) as RohAntwort;
    const gedeutet = deuteTiefe(j);
    
    
    
    
    void inCache(id, gedeutet).catch(() => {  });
    return gedeutet;
  } catch {
    return { tiefeM: null, guete: 'unbekannt' };
  }
}


const AUSWEICH_MAX_NM = 0.27;   


const NAHE_DEUTUNG_VERSION = 2; 

export async function fetchTiefeNahe(
  punkt: { lat: number; lon: number },
  richtung: { lat: number; lon: number },
  maxNM = AUSWEICH_MAX_NM,
): Promise<Tiefenpunkt> {
  const peilung = bearingDeg(punkt.lat, punkt.lon, richtung.lat, richtung.lon);
  const [endLat, endLon] = destPoint(punkt.lat, punkt.lon, peilung, maxNM);
  const linie = [punkt, { lat: endLat, lon: endLon }].map(wkt).join(',');
  const id = schluessel(`nahe:v${NAHE_DEUTUNG_VERSION}:${linie}`);
  const gemerkt = await ausCache<Tiefenpunkt>(id);
  if (gemerkt) return gemerkt;
  try {
    const roh = (await hole(`/depth_profile?geom=LINESTRING(${linie})`)) as unknown;
    if (!Array.isArray(roh) || roh.length < 2) return { tiefeM: null, guete: 'land' };
    
    
    const klar = ersteKlareTiefe(roh, (maxNM * 1852) / (roh.length - 1));
    if (klar) {
      const gefunden: Tiefenpunkt = {
        tiefeM: klar.tiefeM,
        
        
        
        guete: 'unbekannt',
        versatzM: klar.versatzM,
      };
      void inCache(id, gefunden).catch(() => {  });
      return gefunden;
    }
    const nichts: Tiefenpunkt = { tiefeM: null, guete: 'land' };
    void inCache(id, nichts).catch(() => {  });
    return nichts;
  } catch {
    return { tiefeM: null, guete: 'unbekannt' };
  }
}

export interface Tiefenprofil {
  
  punkte: { cum: number; tiefeM: number | null }[];
  
  flachsteM: number | null;
  
  werte: number;
}


export async function fetchTiefenprofil(strecke: StreckenPunkt[]): Promise<Tiefenprofil | null> {
  if (strecke.length < 2) return null;
  const tiefe = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v < 0) ? -v : null;
  try {
    const stuecke = geradeStuecke(strecke);
    const reihen: unknown[][] = [];
    
    for (let k = 0; k < stuecke.length; k += 4) {
      reihen.push(...await Promise.all(stuecke.slice(k, k + 4).map(([i0, i1]) => profilDerLinie(strecke[i0]!, strecke[i1]!))));
    }
    if (reihen.some((r) => r.length < 2)) return null;
    const punkte = strecke.map((p) => ({ cum: p.cum ?? 0, tiefeM: null as number | null }));
    stuecke.forEach(([i0, i1], k) => {
      const werte = reihen[k]!.map(tiefe);
      const von = strecke[i0]!.cum ?? 0, laenge = (strecke[i1]!.cum ?? 0) - von;
      for (let j = i0; j <= i1; j++) {
        const anteil = laenge > 0 ? ((strecke[j]!.cum ?? 0) - von) / laenge : 0;
        punkte[j]!.tiefeM = werte[Math.min(werte.length - 1, Math.max(0, Math.round(anteil * (werte.length - 1))))] ?? null;
      }
    });
    const alle = reihen.flat().map(tiefe).filter((v): v is number => v !== null);
    return { punkte, flachsteM: alle.length ? Math.min(...alle) : null, werte: reihen.reduce((n, r) => n + r.length, 0) };
  } catch {
    return null;
  }
}


async function profilDerLinie(a: Punkt, b: Punkt): Promise<unknown[]> {
  const linie = `${wkt(a)},${wkt(b)}`;
  const id = schluessel(linie);
  const gemerkt = await ausCache<number[]>(id);
  if (gemerkt) return gemerkt;
  const roh = (await hole(`/depth_profile?geom=LINESTRING(${linie})`)) as unknown;
  if (!Array.isArray(roh)) return [];
  void inCache(id, roh as number[]).catch(() => {  });
  return roh;
}


export function geradeStuecke(strecke: readonly Punkt[]): [number, number][] {
  const KNICK_GRAD = 1;
  const kurs = (i: number) => bearingDeg(strecke[i]!.lat, strecke[i]!.lon, strecke[i + 1]!.lat, strecke[i + 1]!.lon);
  const aus: [number, number][] = [];
  let start = 0, bezug = kurs(0);
  for (let i = 1; i < strecke.length - 1; i++) {
    const k = kurs(i);
    if (Math.abs(((k - bezug + 540) % 360) - 180) > KNICK_GRAD) { aus.push([start, i]); start = i; bezug = k; }
  }
  aus.push([start, strecke.length - 1]);
  return aus;
}
