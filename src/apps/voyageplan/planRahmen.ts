import type { ToernZeile, ToernHafen } from '@/data/toernApi';

export interface PlanRahmen {
  von?: string | null;
  bis?: string | null;
  start_hafen?: ToernHafen | null;
  rueckgabe_hafen?: ToernHafen | null;
  uebernahme_zeit?: string | null;
  rueckgabe_zeit?: string | null;
  revier?: string | null;
}

export const RAHMEN_FELDER = [
  'von', 'bis', 'start_hafen', 'rueckgabe_hafen', 'uebernahme_zeit', 'rueckgabe_zeit', 'revier',
] as const satisfies readonly (keyof PlanRahmen & keyof ToernZeile)[];

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT = /^\d{2}:\d{2}$/;

function gueltigerHafen(h: unknown): h is ToernHafen {
  if (!h || typeof h !== 'object') return false;
  const x = h as Record<string, unknown>;
  return typeof x['name'] === 'string' && Number.isFinite(x['lat']) && Number.isFinite(x['lon']);
}

export function liesRahmen(planung: Record<string, unknown> | null | undefined): PlanRahmen {
  const roh = planung?.['rahmen'];
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {};
  const r = roh as Record<string, unknown>;
  const out: PlanRahmen = {};
  for (const f of ['von', 'bis'] as const) {
    if (f in r && (r[f] === null || (typeof r[f] === 'string' && DATUM.test(r[f] as string)))) out[f] = r[f] as string | null;
  }
  for (const f of ['uebernahme_zeit', 'rueckgabe_zeit'] as const) {
    if (f in r && (r[f] === null || (typeof r[f] === 'string' && ZEIT.test(r[f] as string)))) out[f] = r[f] as string | null;
  }
  for (const f of ['start_hafen', 'rueckgabe_hafen'] as const) {
    if (f in r && gueltigerHafen(r[f])) out[f] = r[f] as ToernHafen;
  }
  if ('revier' in r && (r['revier'] === null || typeof r['revier'] === 'string')) out.revier = r['revier'] as string | null;

  if (out.von && out.bis && out.bis < out.von) { delete out.von; delete out.bis; }
  return out;
}

export function mitRahmen(toern: ToernZeile): ToernZeile {
  const r = liesRahmen(toern.planung);
  return Object.keys(r).length === 0 ? toern : { ...toern, ...r };
}

export function rahmenWeichtAb(toern: ToernZeile): boolean {
  const r = liesRahmen(toern.planung);
  return RAHMEN_FELDER.some((f) => f in r && JSON.stringify(r[f] ?? null) !== JSON.stringify(toern[f] ?? null));
}
