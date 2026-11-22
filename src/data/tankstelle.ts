import type { Punkt } from '@/core/types';
import { elementeImUmkreis } from '@/core/umgebung';
import { naechsteTankstelle, TANKSTELLE_NAH_M, TANKSTELLE_SUCHE_M, type Tankstelle } from '@/core/tankstelle';
import { umgebungLokal } from './umgebung';
import { queryOverpass } from './overpass';


export async function tankstelleNeben(punkt: Punkt): Promise<Tankstelle | null | undefined> {
  const paket = await umgebungLokal(punkt, TANKSTELLE_SUCHE_M).catch(() => null);
  const ausPaket = paket ? naechsteTankstelle(elementeImUmkreis(paket, punkt, TANKSTELLE_SUCHE_M), punkt) : undefined;
  if (ausPaket) return ausPaket;
  const um = `(around:${TANKSTELLE_SUCHE_M},${punkt.lat},${punkt.lon})`;
  const ql = '[out:json][timeout:8];('
    
    
    + `nwr["seamark:small_craft_facility:category"~"fuel_station"]${um};`
    + `nwr["waterway"="fuel"]${um};`
    + `nwr["amenity"="fuel"]["boat"~"^(yes|designated)$"]${um};`
    + ');out tags center;';
  try {
    const el = await queryOverpass(ql, 10_000);
    const punkte = el.flatMap((e) => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      return lat !== undefined && lon !== undefined ? [{ lat, lon, tags: e.tags ?? {} }] : [];
    });
    return naechsteTankstelle(punkte, punkt, TANKSTELLE_NAH_M);
  } catch {
    return ausPaket;
  }
}
