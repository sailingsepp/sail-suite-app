import type { Sprache } from '@/core/types';
import type { AmtlicherBericht } from '@/briefing/amtlich';
import { API_BASIS } from '@/shell/api';




async function eine(sprache: 'de' | 'en', basis: string): Promise<AmtlicherBericht | null> {
  try {
    const res = await fetch(`${basis}/api/dhmz?sprache=${sprache}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<AmtlicherBericht>;
    if (typeof j.kopf !== 'string' || !Array.isArray(j.abschnitte)) return null;
    return {
      sprache: sprache,
      kopf: j.kopf,
      datum: typeof j.datum === 'string' ? j.datum : null,
      stunde: typeof j.stunde === 'number' ? j.stunde : null,
      warnung: typeof j.warnung === 'string' ? j.warnung : null,
      abschnitte: j.abschnitte
        .filter((a) => a && typeof a.text === 'string')
        .map((a) => ({ titel: typeof a.titel === 'string' ? a.titel : null, text: a.text })),
      url: typeof j.url === 'string' ? j.url : '',
    };
  } catch {
    return null;
  }
}

export async function holeDhmzBericht(sprache: Sprache, basis = API_BASIS): Promise<AmtlicherBericht | null> {
  const erster = await eine(sprache === 'de' ? 'de' : 'en', basis);
  if (erster || sprache !== 'de') return erster;
  return eine('en', basis);
}
