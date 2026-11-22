import { revierFuer, ueberlappung, vereinePakete, type Box, type VorrechnungManifest, type VorrechnungPaket } from '@/core/vorrechnung';
import { API_BASIS } from '@/shell/api';

export async function holeVorrechnung(box: Box, teilweise = false): Promise<VorrechnungPaket | null> {
  try {
    const m = await fetch(`${API_BASIS}/api/vorrechnung/manifest`, { signal: AbortSignal.timeout(10_000) });
    if (!m.ok) return null;
    const manifest = (await m.json()) as VorrechnungManifest;
    const ganz = revierFuer(manifest, box, false);

    const reviere = ganz ? [ganz] : teilweise
      ? manifest.reviere.filter((r) => ueberlappung(r.bbox, box) > 0)
        .sort((a, b) => ueberlappung(b.bbox, box) - ueberlappung(a.bbox, box)).slice(0, 4)
      : [];
    const pakete = (await Promise.all(reviere.map(async (revier) => {
      const r = await fetch(`${API_BASIS}/api/vorrechnung/${encodeURIComponent(revier.id)}`, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) return null;
      const paket = (await r.json()) as VorrechnungPaket;
      return Array.isArray(paket.kandidaten) ? paket : null;
    }))).filter((p): p is VorrechnungPaket => p != null);
    return vereinePakete(pakete);
  } catch {
    return null;
  }
}
