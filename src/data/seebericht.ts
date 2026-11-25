import type { GebietsBericht, GebietsHerkunft } from '@/briefing/amtlich';
import { API_BASIS } from '@/shell/api';

const PFAD: Record<GebietsHerkunft, string> = {
  hnms: '/api/hnms', meteomar: '/api/meteomar', mgm: '/api/mgm', aemet: '/api/aemet', dom: '/api/dom',
};
const HERKUNFT = new Set<string>(Object.keys(PFAD));

const text = (x: unknown): x is string => typeof x === 'string';
const titelText = (x: unknown): { titel: string; text: string } | null => {
  const o = x as { titel?: unknown; text?: unknown } | null;
  return o && text(o.titel) && text(o.text) ? { titel: o.titel, text: o.text } : null;
};

export function pruefeGebietsBericht(j: unknown): GebietsBericht | null {
  const o = j as Partial<Record<keyof GebietsBericht, unknown>> | null;
  if (!o || !text(o.kopf) || !text(o.datum) || !Array.isArray(o.gebiete)) return null;
  const gebiete = o.gebiete
    .filter((g): g is { name: string; text: string; tendenz?: unknown; gruppe?: unknown } => !!g && text(g.name) && text(g.text))
    .map((g) => ({
      name: g.name, text: g.text,
      ...(text(g.tendenz) ? { tendenz: g.tendenz } : {}),
      ...(text(g.gruppe) ? { gruppe: g.gruppe } : {}),
    }));
  if (!gebiete.length) return null;
  const w = o.warnung as { kopf?: unknown; gebiete?: unknown } | null | undefined;
  const warnung = w && text(w.kopf) && Array.isArray(w.gebiete)
    ? {
      kopf: w.kopf,
      gebiete: w.gebiete
        .filter((g): g is { name: string; zeilen: string[]; gruppe?: unknown } => !!g && text(g.name) && Array.isArray(g.zeilen))
        .map((g) => ({ name: g.name, zeilen: g.zeilen.filter(text), ...(text(g.gruppe) ? { gruppe: g.gruppe } : {}) })),
    }
    : null;
  return {
    herkunft: text(o.herkunft) && HERKUNFT.has(o.herkunft) ? (o.herkunft as GebietsHerkunft) : 'hnms',
    sprache: o.sprache === 'es' ? 'es' : 'en',
    kopf: o.kopf,
    datum: o.datum,
    url: text(o.url) ? o.url : '',
    hinweise: text(o.hinweise) ? o.hinweise : '',
    synopsis: titelText(o.synopsis),
    vorhersageTitel: text(o.vorhersageTitel) ? o.vorhersageTitel : null,
    gebiete,
    ausblick: titelText(o.ausblick),
    tendenzTitel: text(o.tendenzTitel) ? o.tendenzTitel : null,
    warnung: warnung && warnung.gebiete.length ? warnung : null,
  };
}

export async function holeGebietsBericht(herkunft: GebietsHerkunft, basis = API_BASIS): Promise<GebietsBericht | null> {
  try {
    const res = await fetch(`${basis}${PFAD[herkunft]}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return pruefeGebietsBericht(await res.json());
  } catch {
    return null;
  }
}

export async function ladeMeteomarSeegebiete() {
  return (await import('@/core/meteomarSeegebieteDaten')).METEOMAR_SEEGEBIETE;
}
