import { ohneVerwaltungswort } from './geocode';
import { holeUeberServer } from './fremdProxy';



export interface OrtsVorschlag {
  
  anzeige: string;
  lat: number;
  lon: number;
  
  istOrt: boolean;
  
  land: string | null;
}

interface NominatimAdresse {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  city_district?: string;
  municipality?: string;
  country?: string;
}

interface NominatimVorwaertsTreffer {
  lat: string;
  lon: string;
  addresstype: string;
  name?: string;
  display_name: string;
  address?: NominatimAdresse;
}


const ORT_ADRESSTYPEN = new Set([
  'city', 'town', 'village', 'hamlet', 'island', 'suburb', 'city_district', 'municipality', 'county', 'state',
]);

function ortAusAdresse(a: NominatimAdresse | undefined): string | null {
  if (!a) return null;
  return a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? a.city_district
    ?? (a.municipality ? ohneVerwaltungswort(a.municipality) : null);
}

function eigenerName(t: NominatimVorwaertsTreffer): string {
  const name = t.name?.trim();
  if (name) return name;
  return t.display_name.split(',')[0]!.trim();
}

const MIN_ZEICHEN = 3;


export async function sucheOrtsvorschlaege(
  query: string, signal?: AbortSignal, limit = 8, sprache: 'de' | 'en' = 'de',
): Promise<OrtsVorschlag[]> {
  if (query.trim().length < MIN_ZEICHEN) return [];
  try {
    
    
    
    
    
    
    
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1`
      + `&accept-language=${sprache}`
      + `&q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await holeUeberServer(url, {
      signal: signal ?? null,
      headers: { 'User-Agent': 'sail-suite-voyageplan (privates, nicht-kommerzielles Segelprojekt)' },
    });
    if (!res.ok) return [];
    const treffer = await res.json() as NominatimVorwaertsTreffer[];
    return treffer
      .filter((t) => Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lon)))
      .map((t): OrtsVorschlag => {
        const istOrt = ORT_ADRESSTYPEN.has(t.addresstype);
        const eigener = eigenerName(t);
        let anzeige = eigener;
        if (!istOrt) {
          const ort = ortAusAdresse(t.address);
          if (ort && !eigener.toLowerCase().includes(ort.toLowerCase())) anzeige = `${ort}, ${eigener}`;
        }
        return {
          anzeige, lat: Number(t.lat), lon: Number(t.lon), istOrt,
          land: t.address?.country?.trim() || null,
        };
      });
  } catch {
    return []; 
  }
}
