export const istKachelspeicher = (name: string): boolean => /-kacheln-v\d+$/.test(name);

let laeuft: Promise<number> | null = null;

export function opakeKachelnRaeumen(): Promise<number> {
  if (laeuft) return laeuft;
  laeuft = (async () => {
    if (typeof caches === 'undefined') return 0;
    let geloescht = 0;
    for (const name of (await caches.keys()).filter(istKachelspeicher)) {
      const cache = await caches.open(name);
      const schluessel = await cache.keys();
      const antworten = await cache.matchAll();
      if (antworten.length !== schluessel.length) continue;
      const opak = schluessel.filter((_, i) => antworten[i]!.type === 'opaque');
      if (!opak.length) continue;
      if (opak.length * 2 >= schluessel.length) {
        if (await caches.delete(name)) geloescht += opak.length;
        continue;
      }
      for (const k of opak) if (await cache.delete(k)) geloescht++;
    }
    return geloescht;
  })().catch(() => 0);
  return laeuft;
}
