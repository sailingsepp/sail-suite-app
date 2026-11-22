
export type SeeberichtLand = 'hr' | 'gr' | 'it' | 'tr' | 'es' | 'cy';


export const ZYPERN_KUESTE = 'Cyprus coast';


export function inAdriaBox(lat: number, lon: number): boolean {
  return lat >= 39.5 && lat <= 46 && lon >= 12 && lon <= 20.5;
}


export function beiZypern(lat: number, lon: number): boolean {
  return lat >= 34.3624 && lat <= 35.896 && lon >= 32.0692 && lon <= 34.7885;
}

export function seeberichtLand(l: {
  griechisch: boolean; zypern?: boolean; tuerkisch: boolean; spanisch?: boolean; adria: boolean; italienisch: boolean;
  
  staat?: string | null;
}): SeeberichtLand | null {
  if (l.italienisch && l.staat === 'italian') return 'it';
  if (l.griechisch) return 'gr';
  if (l.zypern) return 'cy';
  if (l.tuerkisch) return 'tr';
  if (l.spanisch) return 'es';
  if (l.adria) return 'hr';
  if (l.italienisch) return 'it';
  return null;
}



export function warnlageUnklar(l: { adria: boolean; italienisch: boolean; staat?: string | null }): boolean {
  return l.adria && l.italienisch && !l.staat;
}


export function staatGefragt(l: { adria: boolean; griechisch: boolean }): boolean {
  return l.adria || l.griechisch;
}

export function passendeGebiete(
  gebiete: { name: string; gruppe?: string }[],
  l: { namen?: string[]; gruppen?: string[]; hnms?: string[] },
): string[] {
  return gebiete.filter((g) => (l.namen ?? []).includes(g.name)
    || (!!g.gruppe && (l.gruppen ?? []).includes(g.gruppe))
    || (!g.gruppe && (l.hnms ?? []).some((h) => h.startsWith(g.name.toUpperCase()))))
    .map((g) => g.name);
}


export function gewaesserStaat(
  a: { hoheit?: string; awz?: string } | null, staat: (name: string) => string | null,
): string | null {
  if (!a) return null;
  return (a.hoheit ? staat(a.hoheit) : null) ?? (a.awz ? staat(a.awz) : null);
}
