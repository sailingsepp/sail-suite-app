

export type Form =
  | { r: [number, number, number, number]; f: string }
  | { p: [number, number][]; f: string }
  | { c: [number, number, number]; f: string };

export interface Seeflagge {
  name: { de: string; en: string };
  formen: Form[];
  
  vereinfacht?: boolean;
}

export const FLAGGE_B = 30;
export const FLAGGE_H = 20;

const quer = (farben: string[], anteile = farben.map(() => 1)): Form[] => {
  const summe = anteile.reduce((a, b) => a + b, 0);
  let y = 0;
  return farben.map((f, i) => {
    const h = (FLAGGE_H * anteile[i]!) / summe;
    const form: Form = { r: [0, y, FLAGGE_B, h], f };
    y += h;
    return form;
  });
};
const senkrecht = (farben: string[]): Form[] =>
  farben.map((f, i) => ({ r: [(FLAGGE_B * i) / farben.length, 0, FLAGGE_B / farben.length, FLAGGE_H], f }));

const kreuz = (feld: string, f: string, x0: number, x1: number, y0: number, y1: number): Form[] => [
  { r: [0, 0, FLAGGE_B, FLAGGE_H], f: feld },
  { r: [x0, 0, x1 - x0, FLAGGE_H], f },
  { r: [0, y0, FLAGGE_B, y1 - y0], f },
];

const schild = (x: number, y: number, b: number, h: number, f: string): Form => ({
  p: [[x, y], [x + b, y], [x + b, y + h * 0.62], [x + b / 2, y + h], [x, y + h * 0.62]], f,
});

const stern = (cx: number, cy: number, r: number, f: string, winkel = 0): Form => {
  const p: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((winkel + i * 36) * Math.PI) / 180;
    const rr = i % 2 ? r * 0.382 : r;
    p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return { p, f };
};

const ROT = '#C8102E';
const WEISS = '#FFFFFF';


function union(b: number, h: number): Form[] {
  const d = 1.2; 
  const diag = (f: string, s: number): Form[] => [
    { p: [[0, 0], [s, 0], [b, h - s * (h / b)], [b, h], [b - s, h], [0, s * (h / b)]], f },
    { p: [[b, 0], [b, s * (h / b)], [s, h], [0, h], [0, h - s * (h / b)], [b - s, 0]], f },
  ];
  return [
    { r: [0, 0, b, h], f: '#012169' },
    ...diag(WEISS, d * 1.5), ...diag(ROT, d * 0.6),
    { r: [b / 2 - h / 6, 0, h / 3, h], f: WEISS }, { r: [0, h / 3, b, h / 3], f: WEISS },
    { r: [b / 2 - h / 10, 0, h / 5, h], f: ROT }, { r: [0, h * 0.4, b, h / 5], f: ROT },
  ];
}


export const SEEFLAGGEN: Record<string, Seeflagge> = {
  AT: { name: { de: 'Österreich', en: 'Austria' }, formen: quer(['#C8102E', WEISS, '#C8102E']) },
  DE: { name: { de: 'Deutschland', en: 'Germany' }, formen: quer(['#000000', '#DD0000', '#FFCE00']) },
  CH: {
    name: { de: 'Schweiz', en: 'Switzerland' },
    formen: [{ r: [0, 0, 30, 20], f: '#DA291C' }, { r: [13, 4, 4, 12], f: WEISS }, { r: [9, 8, 12, 4], f: WEISS }],
  },
  HR: {
    name: { de: 'Kroatien', en: 'Croatia' }, vereinfacht: true,
    formen: [
      ...quer(['#FF0000', WEISS, '#171796']),
      schild(12.4, 5.2, 5.2, 7.8, WEISS),
      ...[0, 1, 2, 3, 4].flatMap((zeile) => [0, 1, 2, 3, 4]
        .filter((sp) => (zeile + sp) % 2 === 0)
        .map((sp): Form => ({ r: [12.4 + sp * 1.04, 5.2 + zeile * 1.04, 1.04, 1.04], f: '#FF0000' }))),
    ],
  },
  SI: {
    name: { de: 'Slowenien', en: 'Slovenia' }, vereinfacht: true,
    formen: [...quer([WEISS, '#0000FF', '#FF0000']), schild(5.2, 3.2, 4.6, 6.4, '#DD0000'), schild(5.6, 3.5, 3.8, 5.6, '#0000FF')],
  },
  ME: {
    name: { de: 'Montenegro', en: 'Montenegro' }, vereinfacht: true,
    formen: [{ r: [0, 0, 30, 20], f: '#D3AE3B' }, { r: [1, 1, 28, 18], f: '#C40308' }, { c: [15, 10, 4.2], f: '#D3AE3B' }],
  },
  IT: {
    name: { de: 'Italien', en: 'Italy' }, vereinfacht: true,
    formen: [
      ...senkrecht(['#009246', WEISS, '#CE2B37']),
      schild(11.8, 5.6, 6.4, 8.8, '#D4AF37'),
      { r: [12.2, 6, 2.8, 3.1], f: '#CE2B37' }, { r: [15, 6, 2.8, 3.1], f: WEISS },
      { r: [12.2, 9.1, 2.8, 3.1], f: '#0B3D91' }, { r: [15, 9.1, 2.8, 3.1], f: '#CE2B37' },
    ],
  },
  GR: {
    name: { de: 'Griechenland', en: 'Greece' },
    formen: [
      ...quer(['#0D5EAF', WEISS, '#0D5EAF', WEISS, '#0D5EAF', WEISS, '#0D5EAF', WEISS, '#0D5EAF']),
      { r: [0, 0, (20 * 5) / 9, (20 * 5) / 9], f: '#0D5EAF' },
      { r: [(20 * 2) / 9, 0, 20 / 9, (20 * 5) / 9], f: WEISS },
      { r: [0, (20 * 2) / 9, (20 * 5) / 9, 20 / 9], f: WEISS },
    ],
  },
  TR: {
    name: { de: 'Türkei', en: 'Türkiye' },
    formen: [
      { r: [0, 0, 30, 20], f: '#E30A17' }, { c: [10.5, 10, 5], f: WEISS }, { c: [11.75, 10, 4], f: '#E30A17' },
      stern(17.4, 10, 2.5, WEISS, 180),
    ],
  },
  ES: { name: { de: 'Spanien', en: 'Spain' }, formen: quer(['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]) },
  FR: { name: { de: 'Frankreich', en: 'France' }, formen: senkrecht(['#002654', WEISS, '#CE1126']) },
  PT: {
    name: { de: 'Portugal', en: 'Portugal' }, vereinfacht: true,
    formen: [
      { r: [0, 0, 12, 20], f: '#046A38' }, { r: [12, 0, 18, 20], f: '#DA291C' },
      { c: [12, 10, 4.4], f: '#FFE900' }, schild(10.2, 7.6, 3.6, 4.8, WEISS),
    ],
  },
  GB: { name: { de: 'Vereinigtes Königreich', en: 'United Kingdom' }, formen: [{ r: [0, 0, 30, 20], f: ROT }, ...union(15, 10)] },
  IE: { name: { de: 'Irland', en: 'Ireland' }, formen: senkrecht(['#169B62', WEISS, '#FF883E']) },
  NL: { name: { de: 'Niederlande', en: 'Netherlands' }, formen: quer(['#AE1C28', WEISS, '#21468B']) },
  BE: { name: { de: 'Belgien', en: 'Belgium' }, formen: senkrecht(['#000000', '#FDDA24', '#EF3340']) },
  DK: { name: { de: 'Dänemark', en: 'Denmark' }, formen: kreuz('#C8102E', WEISS, 9.7, 12.9, 8.57, 11.43) },
  SE: { name: { de: 'Schweden', en: 'Sweden' }, formen: kreuz('#006AA7', '#FECC02', 9.375, 13.125, 8, 12) },
  NO: {
    name: { de: 'Norwegen', en: 'Norway' },
    formen: [...kreuz('#BA0C2F', WEISS, 8.18, 13.64, 7.5, 12.5), { r: [9.55, 0, 2.73, 20], f: '#00205B' }, { r: [0, 8.75, 30, 2.5], f: '#00205B' }],
  },
  FI: { name: { de: 'Finnland', en: 'Finland' }, formen: kreuz(WEISS, '#002F6C', 8.33, 13.33, 7.27, 12.73) },
  PL: {
    name: { de: 'Polen', en: 'Poland' }, vereinfacht: true,
    formen: [...quer([WEISS, '#DC143C']), schild(13.2, 1.6, 3.6, 5.6, '#DC143C')],
  },
  CZ: {
    name: { de: 'Tschechien', en: 'Czechia' },
    formen: [...quer([WEISS, '#D7141A']), { p: [[0, 0], [15, 10], [0, 20]], f: '#11457E' }],
  },
  SK: {
    name: { de: 'Slowakei', en: 'Slovakia' }, vereinfacht: true,
    formen: [...quer([WEISS, '#0B4EA2', '#EE1C25']), schild(6.4, 4.4, 6, 9, WEISS), schild(6.8, 4.8, 5.2, 8.1, '#EE1C25')],
  },
  HU: { name: { de: 'Ungarn', en: 'Hungary' }, formen: quer(['#CE2939', WEISS, '#477050']) },
};


export function normLandcode(x: string | null | undefined): string | null {
  const c = (x ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

export function seeflagge(code: string | null | undefined): Seeflagge | null {
  const c = normLandcode(code);
  return c ? SEEFLAGGEN[c] ?? null : null;
}

const zahl = (x: number) => String(Math.round(x * 100) / 100);


export function seeflaggeSvg(code: string | null | undefined, hoehe = 16, sprache: 'de' | 'en' = 'de'): string | null {
  const fl = seeflagge(code);
  if (!fl) return null;
  const teile = fl.formen.map((f) => {
    if ('r' in f) return `<rect x="${zahl(f.r[0])}" y="${zahl(f.r[1])}" width="${zahl(f.r[2])}" height="${zahl(f.r[3])}" fill="${f.f}"/>`;
    if ('c' in f) return `<circle cx="${zahl(f.c[0])}" cy="${zahl(f.c[1])}" r="${zahl(f.c[2])}" fill="${f.f}"/>`;
    return `<polygon points="${f.p.map(([x, y]) => `${zahl(x)},${zahl(y)}`).join(' ')}" fill="${f.f}"/>`;
  }).join('');
  const titel = `${fl.name[sprache]} (${normLandcode(code)})`;
  return `<svg class="seeflagge" viewBox="0 0 ${FLAGGE_B} ${FLAGGE_H}" width="${zahl((hoehe * FLAGGE_B) / FLAGGE_H)}" height="${hoehe}" role="img" aria-label="${titel}">`
    + `<title>${titel}</title>${teile}<rect x=".25" y=".25" width="${FLAGGE_B - 0.5}" height="${FLAGGE_H - 0.5}" fill="none" stroke="#888" stroke-width=".5"/></svg>`;
}


const NAMEN: Record<string, string> = {
  kroatien: 'HR', croatia: 'HR', hrvatska: 'HR',
  griechenland: 'GR', greece: 'GR', 'ελλάδα': 'GR', 'ελλάς': 'GR', hellas: 'GR',
  italien: 'IT', italy: 'IT', italia: 'IT',
  slowenien: 'SI', slovenia: 'SI', slovenija: 'SI',
  montenegro: 'ME', 'crna gora': 'ME', 'црна гора': 'ME',
  'türkei': 'TR', turkey: 'TR', 'türkiye': 'TR', turkiye: 'TR',
  spanien: 'ES', spain: 'ES', 'españa': 'ES', espana: 'ES',
  frankreich: 'FR', france: 'FR',
  portugal: 'PT',
  zypern: 'CY', cyprus: 'CY', 'κύπρος': 'CY', 'kıbrıs': 'CY',
  malta: 'MT',
  albanien: 'AL', albania: 'AL', 'shqipëria': 'AL', shqiperia: 'AL',
  'österreich': 'AT', austria: 'AT', deutschland: 'DE', germany: 'DE',
  niederlande: 'NL', netherlands: 'NL', nederland: 'NL',
  'dänemark': 'DK', denmark: 'DK', danmark: 'DK',
  schweden: 'SE', sweden: 'SE', sverige: 'SE',
  norwegen: 'NO', norway: 'NO', norge: 'NO',
  finnland: 'FI', finland: 'FI', suomi: 'FI',
  'vereinigtes königreich': 'GB', 'united kingdom': 'GB', england: 'GB', schottland: 'GB', scotland: 'GB',
  irland: 'IE', ireland: 'IE',
};


export function landcodeAusRevier(revier: string | null | undefined): string | null {
  for (const teil of (revier ?? '').split(/[·,/]/)) {
    const c = NAMEN[teil.trim().toLowerCase()];
    if (c) return c;
  }
  return null;
}


export function flaggeDesToerns(schiff: { flagge?: string } | null | undefined, revier: string | null | undefined): string | undefined {
  return normLandcode(schiff?.flagge) ?? landcodeAusRevier(revier) ?? undefined;
}
