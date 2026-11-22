

import { staatenAusGazetteer } from '@/core/grenzen';
import { meeresgebietAm } from '@/core/meeresgebiete';

const BASIS = 'https://marineregions.org/rest';
const RUHE_MS = 5 * 60_000;
let ruheBis = 0;


const ARTEN = {
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  seegebiet: ['IHO Sea Area', 'General Sea Area', 'Marine Region'],
  hoheit: ['Internal waters', 'Territorial Sea', 'Archipelagic waters'],
  awz: ['EEZ', 'Exclusive Economic Zone'],
} as const;





const GROSSREGIONEN = /^(Mediterranean Region|Mediterranean Sea|Mediterranean|Amphiatlantic|European Marine Waters)$/i;

export interface Seegebiet {
  
  gebiet?: string;
  
  hoheit?: string;
  
  awz?: string;
  
  alle: { name: string; art: string }[];
}

interface RohEintrag {
  preferredGazetteerName?: string;
  placeType?: string;
}


export async function fetchSeegebiet(
  lat: number, lon: number, umkreisGrad = 5,
): Promise<Seegebiet | null> {
  if (Date.now() < ruheBis) return null;
  try {
    const res = await fetch(
      `${BASIS}/getGazetteerRecordsByLatLong.json/${lat.toFixed(4)}/${lon.toFixed(4)}/`
      + `?radius=${umkreisGrad}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      
      
      if (res.status !== 404) ruheBis = Date.now() + RUHE_MS;
      return null;
    }
    const roh = (await res.json()) as RohEintrag[];
    if (!Array.isArray(roh) || !roh.length) return null;

    const alle = roh
      .filter((e) => e.preferredGazetteerName && e.placeType)
      .map((e) => ({ name: e.preferredGazetteerName!, art: e.placeType! }));

    
    
    
    
    const erster = (arten: readonly string[]): string | undefined => {
      for (const a of arten) {
        const treffer = alle.find((e) => e.art.toLowerCase() === a.toLowerCase());
        if (treffer) return treffer.name;
      }
      return undefined;
    };

    const gebiet: Seegebiet = { alle };
    const g0 = erster(ARTEN.seegebiet);
    const g1 = g0 && GROSSREGIONEN.test(g0) ? undefined : g0;
    
    
    const teil = !g1 || /Basin$/i.test(g1) ? meeresgebietAm(lat, lon) : null;
    const g = teil && /^28[a-h]$/.test(teil.id) ? teil.en : g1;
    const h = erster(ARTEN.hoheit);
    const a = erster(ARTEN.awz);
    if (g) gebiet.gebiet = g;
    if (h) gebiet.hoheit = h;
    if (a) gebiet.awz = a;
    return gebiet;
  } catch {
    ruheBis = Date.now() + RUHE_MS;
    return null;
  }
}


export async function fetchStaatsnamen(lat: number, lon: number, umkreisGrad: number): Promise<string[]> {
  const res = await fetch(
    `${BASIS}/getGazetteerRecordsByLatLong.json/${lat.toFixed(4)}/${lon.toFixed(4)}/`
    + `?radius=${umkreisGrad}`,
    
    
    
    
    { signal: AbortSignal.timeout(10_000) },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Marine Regions: HTTP ${res.status}`);
  const roh = (await res.json()) as RohEintrag[];
  if (!Array.isArray(roh)) return [];
  return staatenAusGazetteer(roh
    .filter((e) => e.preferredGazetteerName && e.placeType)
    .map((e) => ({ name: e.preferredGazetteerName!, art: e.placeType! })));
}
