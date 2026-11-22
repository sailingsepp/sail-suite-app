import { distNM, bearingDeg } from '@/core/geo';
import { luvFetchNM, schutzStufe, type SchutzStufe, type Kuestenlinie } from '@/core/shelter';
import type { Punkt } from '@/core/types';
import { findAusweichziele, kuestenlinienUmPunkt, type Ausweichziel } from './overpass';


export interface BewertetesZiel {
  name: string;
  art: Ausweichziel['art'];
  lat: number;
  lon: number;
  
  distanzNM: number;
  peilung: number;
  
  fetchNM: number | null;
  schutz: SchutzStufe | null;
  woher: 'ziel' | 'route';
}


export function istDublette(a: Pick<BewertetesZiel, 'name' | 'art' | 'lat' | 'lon'>, b: Pick<BewertetesZiel, 'name' | 'art' | 'lat' | 'lon'>): boolean {
  const d = distNM(a.lat, a.lon, b.lat, b.lon);
  if (d > 0.5) return false;
  if (d <= 0.3 && a.art !== 'bucht' && b.art !== 'bucht') return true;
  const na = a.name.toLowerCase(), nb = b.name.toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
}


export const ART_RANG: Record<Ausweichziel['art'], number> = { marina: 0, hafen: 1, bucht: 2 };

interface GebietsErgebnis {
  kandidaten: BewertetesZiel[];
  
  zielKueste: Kuestenlinie | null;
}

async function sucheGebiet(
  mitte: Punkt, radiusNM: number, ziel: Punkt, windVonDeg: number, woher: 'ziel' | 'route',
): Promise<GebietsErgebnis> {
  const [kandidaten, kueste] = await Promise.all([
    findAusweichziele(mitte, radiusNM),
    kuestenlinienUmPunkt(mitte, [radiusNM + 4]),
  ]);
  const bewertet = kandidaten.map((k) => {
    const fetchNM = kueste.length ? luvFetchNM({ lat: k.lat, lon: k.lon }, windVonDeg, kueste) : null;
    return {
      ...k,
      distanzNM: distNM(ziel.lat, ziel.lon, k.lat, k.lon),
      peilung: bearingDeg(ziel.lat, ziel.lon, k.lat, k.lon),
      fetchNM,
      schutz: fetchNM === null ? null : schutzStufe(fetchNM),
      woher,
    };
  });
  const zielKueste = woher === 'ziel' ? kueste : null;
  return { kandidaten: bewertet, zielKueste };
}

const SCHUTZ_RANG: Record<SchutzStufe, number> = { geschuetzt: 0, teilweise: 1, offen: 2 };


export interface AusweichzielSuche {
  ziele: BewertetesZiel[];
  
  zielKueste: Kuestenlinie | null;
}

export async function findeAusweichziele(
  ziel: Punkt, streckenPunkt: Punkt | null, windVonDeg: number,
  marinaVoll = false, maxAnzahl = 3,
): Promise<AusweichzielSuche> {
  const gebiete = [sucheGebiet(ziel, 8, ziel, windVonDeg, 'ziel')];
  
  
  if (streckenPunkt && distNM(ziel.lat, ziel.lon, streckenPunkt.lat, streckenPunkt.lon) > 6) {
    gebiete.push(sucheGebiet(streckenPunkt, 5, ziel, windVonDeg, 'route'));
  }

  const ergebnisse = await Promise.all(gebiete);
  
  const zielKueste = ergebnisse[0]!.zielKueste;
  const alle = ergebnisse.flatMap((e) => e.kandidaten);

  
  
  const eindeutig: BewertetesZiel[] = [];
  for (const k of alle) {
    if (k.distanzNM < 0.5) continue;
    const vorhanden = eindeutig.findIndex((e) => istDublette(e, k));
    if (vorhanden === -1) eindeutig.push(k);
    else if (ART_RANG[k.art] < ART_RANG[eindeutig[vorhanden]!.art]) eindeutig[vorhanden] = k;
  }

  
  
  
  
  
  const artWert = (art: Ausweichziel['art']) =>
    marinaVoll
      ? (art === 'bucht' ? 0 : 1)   
      : (art === 'bucht' ? 1 : 0);  
  eindeutig.sort((a, b) => {
    const ra = a.schutz ? SCHUTZ_RANG[a.schutz] : 1, rb = b.schutz ? SCHUTZ_RANG[b.schutz] : 1;
    if (ra !== rb) return ra - rb;
    const aa = artWert(a.art), ab = artWert(b.art);
    if (aa !== ab) return aa - ab;
    return a.distanzNM - b.distanzNM;
  });
  return { ziele: eindeutig.slice(0, maxAnzahl), zielKueste };
}
