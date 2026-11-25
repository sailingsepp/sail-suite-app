export type Staatsnamen = readonly string[] | null;

export const STAATEN_REGEL = 2;

const STAAT_KANON: Readonly<Record<string, string>> = Object.fromEntries(([
  ['Greece', 'greek', 'hellas', 'ελλάδα'],
  ['Turkey', 'türkiye', 'turkiye', 'turkish'],
  ['Croatia', 'croatian', 'hrvatska'],
  ['Italy', 'italian', 'italia'],
  ['Slovenia', 'slovenian', 'slovene', 'slovenija'],
  ['Montenegro', 'montenegrin', 'crna gora'],
  ['Albania', 'albanian', 'shqipëri', 'shqipëria'],
  ['Bosnia and Herzegovina', 'bosnian', 'bosnia-herzegovina'],
  ['France', 'french', 'frankrijk', 'frankreich'],
  ['Spain', 'spanish', 'españa', 'espana', 'spanje'],
  ['Malta', 'maltese'],
  ['Cyprus', 'cypriot', 'cypriote', 'cyprian'],
  ['Monaco', 'monegasque'],
  ['Tunisia', 'tunisian'],
  ['Libya', 'libyan'],
  ['Egypt', 'egyptian'],
  ['Israel', 'israeli'],
  ['Lebanon', 'lebanese'],
  ['Syria', 'syrian'],
  ['Algeria', 'algerian'],
  ['Morocco', 'moroccan'],
  ['Portugal', 'portuguese'],
  ['Bulgaria', 'bulgarian'],
  ['Romania', 'romanian'],
  ['Ukraine', 'ukrainian'],
  ['Georgia', 'georgian'],
] as const).flatMap(([staat, ...andere]) => [[staat.toLowerCase(), staat], ...andere.map((n) => [n, staat])]));

export function kanon(name: string): string {
  const n = name.trim().toLowerCase();
  return STAAT_KANON[n] ?? n;
}

export function staatenAusGazetteer(eintraege: readonly { name: string; art: string }[]): string[] {
  const out: string[] = [];
  const dazu = (s: string | undefined): void => { if (s && !out.includes(s)) out.push(s); };
  for (const { name, art } of eintraege) {
    const a = art.trim().toLowerCase();
    if (a === 'nation') dazu(kanon(name));
    else if (a === 'territorial sea') dazu(STAAT_KANON[name.replace(/\s*12\s*NM\s*$/i, '').trim().toLowerCase()]);
    else if (a === 'eez') dazu(STAAT_KANON[name.replace(/\s*Exclusive Economic Zone\s*$/i, '').trim().toLowerCase()]);
  }
  return out;
}

const SCHENGEN = new Set(['Croatia', 'Slovenia', 'Italy', 'Greece', 'Malta', 'France', 'Spain', 'Portugal', 'Bulgaria', 'Romania']);

export function schengenGrenze(a: string, b: string): 'binnen' | 'aussen' | 'ohne' {
  const x = SCHENGEN.has(kanon(a)), y = SCHENGEN.has(kanon(b));
  return x && y ? 'binnen' : x || y ? 'aussen' : 'ohne';
}

export function istGrenzuebertritt(a: Staatsnamen, b: Staatsnamen): boolean {
  if (!a || !b || a.length === 0 || b.length === 0) return false;
  const staaten = new Set(a.map(kanon));
  return !b.some((n) => staaten.has(kanon(n)));
}

export function istKlarierGrenze(a: Staatsnamen, b: Staatsnamen): boolean {
  if (!istGrenzuebertritt(a, b)) return false;
  const imSchengen = (s: Staatsnamen) => !!s && s.some((n) => SCHENGEN.has(kanon(n)));
  return !(imSchengen(a) && imSchengen(b));
}

export function einklarierStunden(maxStundenProTag: number): number {
  return maxStundenProTag / 2;
}
