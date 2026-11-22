import { fetchSeegebiet } from '@/data/seegebiete';
import { aendereToern, type Toern } from '@/data/logdb';
import { istOnline } from './netz';




const versucht = new Set<string>();


export function ergaenzeRevier(
  toern: Toern | null,
  position: { lat: number; lon: number } | null,
): void {
  if (!toern || !position || !istOnline()) return;
  
  if (toern.revier?.trim()) return;
  if (versucht.has(toern.id)) return;
  versucht.add(toern.id);

  void fetchSeegebiet(position.lat, position.lon)
    .then(async (g) => {
      const name = g?.gebiet;
      if (!name) return;
      
      
      
      if (toern.revier?.trim()) return;
      
      await aendereToern(toern.id, (jetzt) => (jetzt && !jetzt.revier?.trim() ? { ...jetzt, revier: name } : null));
      toern.revier = name;
    })
    .catch(() => {  });
}


export function revierZuruecksetzen(): void {
  versucht.clear();
}
