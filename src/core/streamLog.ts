export const STANDORT_ABSTAND_MS = 20 * 60_000;

const IMMER: ReadonlySet<string> = new Set([
  'start', 'ziel', 'anlegen', 'ankern', 'liegeplatz', 'ankerplatz', 'treiben', 'navigation', 'tanken', 'mob',
  'ankerwache', 'antrieb', 'tagesende', 'hand', 'foto',
]);

export function streamLogAuswahl<T extends { t: number; art: string }>(eintraege: readonly T[], abstandMs = STANDORT_ABSTAND_MS): T[] {

  const behalten = new Set<T>();
  let letzter = -Infinity;
  for (const e of [...eintraege].filter((x) => x.art === 'standort').sort((a, b) => a.t - b.t)) {
    if (e.t - letzter >= abstandMs) { behalten.add(e); letzter = e.t; }
  }
  return eintraege.filter((e) => IMMER.has(e.art) || behalten.has(e));
}
