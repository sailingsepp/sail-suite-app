import { ortsangabeLogbuch } from '@/data/places';
import { aktuelleSprache } from '@/shell/sprache';


export interface FotoOrt { name: string; endgueltig: boolean }

const gemerkt = new Map<string, Promise<FotoOrt | null>>();
let kette: Promise<unknown> = Promise.resolve();

const schluessel = (lat: number, lon: number) => `${lat.toFixed(5)},${lon.toFixed(5)}`;

export function fotoOrt(lat: number, lon: number): Promise<FotoOrt | null> {
  const k = schluessel(lat, lon);
  const da = gemerkt.get(k);
  if (da) return da;
  const lauf = kette.then(async (): Promise<FotoOrt | null> => {
    try {
      const r = await ortsangabeLogbuch({ lat, lon }, aktuelleSprache());
      return { name: r.name ?? '', endgueltig: r.vollstaendig };
    } catch {
      return null;
    }
  });
  kette = lauf;
  
  void lauf.then((x) => { if (!x || !x.endgueltig) gemerkt.delete(k); });
  gemerkt.set(k, lauf);
  return lauf;
}
