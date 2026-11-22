import { mitNetzlage } from './netz';




export const MAX_KACHELN = 2500;


const GLEICHZEITIG = 4;


const PAUSE_MS = 120;


export const ZOOM_VON = 9;
export const ZOOM_BIS = 13;

export interface Ausschnitt {
  sued: number;
  west: number;
  nord: number;
  ost: number;
}

export interface Fortschritt {
  geladen: number;
  gesamt: number;
  fehlgeschlagen: number;
  
  bytes: number;
}




const KACHEL_CACHE = 'trackbook-kacheln-v1';


export async function vorladePlan(
  a: Ausschnitt, von = ZOOM_VON, bis = ZOOM_BIS,
): Promise<{ neu: string[]; schonDa: number }> {
  const liste = kachelListe(a, von, bis).slice(0, MAX_KACHELN);
  if (typeof caches === 'undefined') return { neu: liste, schonDa: 0 };
  try {
    const cache = await caches.open(KACHEL_CACHE);
    const da = await Promise.all(liste.map((u) => cache.match(u).then((t) => !!t)));
    const neu = liste.filter((_, i) => !da[i]);
    return { neu, schonDa: liste.length - neu.length };
  } catch {
    return { neu: liste, schonDa: 0 };
  }
}


export function kachelX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}


export function kachelY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}


export function kachelZahl(a: Ausschnitt, von = ZOOM_VON, bis = ZOOM_BIS): number {
  let summe = 0;
  for (let z = von; z <= bis; z++) {
    const x1 = kachelX(a.west, z);
    const x2 = kachelX(a.ost, z);
    const y1 = kachelY(a.nord, z);
    const y2 = kachelY(a.sued, z);
    summe += (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1);
  }
  return summe;
}


export function kachelListe(a: Ausschnitt, von = ZOOM_VON, bis = ZOOM_BIS): string[] {
  const raus: string[] = [];
  for (let z = von; z <= bis; z++) {
    const x1 = Math.min(kachelX(a.west, z), kachelX(a.ost, z));
    const x2 = Math.max(kachelX(a.west, z), kachelX(a.ost, z));
    const y1 = Math.min(kachelY(a.nord, z), kachelY(a.sued, z));
    const y2 = Math.max(kachelY(a.nord, z), kachelY(a.sued, z));
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        
        raus.push(`https://tiles.openseamap.org/seamark/${z}/${x}/${y}.png`);
      }
    }
  }
  return raus;
}

let abbrechen = false;


export function brichVorladenAb(): void {
  abbrechen = true;
}


export async function ladeRevierVor(
  liste: readonly string[],
  melde: (f: Fortschritt) => void,
): Promise<Fortschritt> {
  abbrechen = false;
  const f: Fortschritt = { geladen: 0, gesamt: liste.length, fehlgeschlagen: 0, bytes: 0 };
  melde(f);

  for (let i = 0; i < liste.length && !abbrechen; i += GLEICHZEITIG) {
    await Promise.all(liste.slice(i, i + GLEICHZEITIG).map(async (url) => {
      try {
        
        
        
        
        let antwort: Response;
        try {
          antwort = await mitNetzlage(() => fetch(url, { mode: 'cors', cache: 'no-store' }));
          const laenge = Number(antwort.headers.get('content-length'));
          f.bytes += laenge > 0 ? laenge : (await antwort.blob()).size;
        } catch {
          await mitNetzlage(() => fetch(url, { mode: 'no-cors', cache: 'no-store' }));
        }
        f.geladen++;
      } catch {
        f.fehlgeschlagen++;
      }
    }));
    melde({ ...f });
    if (!abbrechen) await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  return f;
}
