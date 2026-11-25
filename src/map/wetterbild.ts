import type { Sprache } from '@/core/types';

export type Himmel = 'klar' | 'leichtBewoelkt' | 'bewoelkt' | 'nebel' | 'niesel' | 'regen' | 'schauer' | 'gewitter' | 'schnee';

export function himmelAus(code: number): Himmel {
  if (code === 0) return 'klar';
  if (code === 1 || code === 2) return 'leichtBewoelkt';
  if (code === 3) return 'bewoelkt';
  if (code === 45 || code === 48) return 'nebel';
  if (code >= 51 && code <= 57) return 'niesel';
  if (code >= 61 && code <= 67) return 'regen';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'schnee';
  if (code >= 80 && code <= 82) return 'schauer';
  if (code >= 95) return 'gewitter';
  return 'bewoelkt';
}

const HIMMEL_TEXT: Record<Himmel, { de: [string, string]; en: [string, string] }> = {

  klar: { de: ['Sonnig', 'Klar'], en: ['Sunny', 'Clear'] },
  leichtBewoelkt: { de: ['Teils sonnig', 'Teils bewölkt'], en: ['Partly sunny', 'Partly cloudy'] },
  bewoelkt: { de: ['Bewölkt', 'Bewölkt'], en: ['Cloudy', 'Cloudy'] },
  nebel: { de: ['Nebel', 'Nebel'], en: ['Fog', 'Fog'] },
  niesel: { de: ['Nieselregen', 'Nieselregen'], en: ['Drizzle', 'Drizzle'] },
  regen: { de: ['Regen', 'Regen'], en: ['Rain', 'Rain'] },
  schauer: { de: ['Regenschauer', 'Regenschauer'], en: ['Showers', 'Showers'] },
  gewitter: { de: ['Gewitter', 'Gewitter'], en: ['Thunderstorm', 'Thunderstorm'] },
  schnee: { de: ['Schnee', 'Schnee'], en: ['Snow', 'Snow'] },
};

export function himmelText(h: Himmel, tag: boolean, sprache: Sprache): string {
  return HIMMEL_TEXT[h][sprache][tag ? 0 : 1];
}

const RICHTUNG: Record<Sprache, string[]> = {
  de: ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'],
  en: ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'],
};

export function richtungAusgeschrieben(grad: number, sprache: Sprache): string {
  return RICHTUNG[sprache][Math.round((((grad % 360) + 360) % 360) / 45) % 8]!;
}

export function bftFarbe(bft: number): string {
  if (bft <= 3) return '#2DA8A0';
  if (bft <= 5) return '#E8C547';
  if (bft <= 7) return '#F2A93B';
  return '#E1584B';
}

const SONNE = (x: number, y: number, r: number) => {
  const strahlen = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const [c, s] = [Math.cos(a), Math.sin(a)];
    return `<line x1="${x + c * (r + 4)}" y1="${y + s * (r + 4)}" x2="${x + c * (r + 10)}" y2="${y + s * (r + 10)}"/>`;
  }).join('');
  return `<g stroke="#F5C542" stroke-width="3" stroke-linecap="round">${strahlen}</g><circle cx="${x}" cy="${y}" r="${r}" fill="#F5C542"/>`;
};
const MOND = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r}A${r} ${r} 0 1 0 ${x} ${y + r}A${r * 0.45} ${r} 0 1 1 ${x} ${y - r}z" fill="#E9E3C4"/>`;
const WOLKE = (dx: number, dy: number, farbe = '#E3E9EE') =>
  `<path transform="translate(${dx} ${dy})" d="M18 46h30a10 10 0 0 0 0-20a14 14 0 0 0-26-4a10 10 0 0 0-4 24z" fill="${farbe}" stroke="#9FB0BC" stroke-width="1.5"/>`;
const TROPFEN = (n: number, farbe = '#5AA9E6') => Array.from({ length: n }, (_, i) =>
  `<line x1="${24 + i * 9}" y1="52" x2="${21 + i * 9}" y2="60" stroke="${farbe}" stroke-width="3" stroke-linecap="round"/>`).join('');
const BLITZ = '<path d="M34 44l-7 11h6l-4 9 11-13h-6l4-7z" fill="#F5C542" stroke="#B8860B" stroke-width="1"/>';
const FLOCKEN = [24, 33, 42].map((x) => `<text x="${x}" y="61" font-size="10" text-anchor="middle" fill="#DDEBF5">✱</text>`).join('');
const NEBEL = [40, 47, 54].map((y, i) => `<line x1="${12 + i * 3}" y1="${y}" x2="${52 - i * 3}" y2="${y}" stroke="#B7C4CC" stroke-width="3" stroke-linecap="round"/>`).join('');

export function himmelBild(h: Himmel, tag: boolean): string {
  const gestirn = (x: number, y: number, r: number) => (tag ? SONNE(x, y, r) : MOND(x, y, r));
  let inhalt: string;
  switch (h) {
    case 'klar': inhalt = tag ? SONNE(32, 32, 13) : MOND(34, 32, 18); break;
    case 'leichtBewoelkt': inhalt = gestirn(24, 22, 10) + WOLKE(8, 6); break;
    case 'bewoelkt': inhalt = WOLKE(-2, -4, '#C9D3DA') + WOLKE(8, 4); break;
    case 'nebel': inhalt = WOLKE(2, -10) + NEBEL; break;
    case 'niesel': inhalt = WOLKE(2, -6) + TROPFEN(2); break;
    case 'regen': inhalt = WOLKE(2, -6, '#C9D3DA') + TROPFEN(3); break;
    case 'schauer': inhalt = gestirn(22, 18, 9) + WOLKE(6, -2) + TROPFEN(2); break;
    case 'gewitter': inhalt = WOLKE(2, -8, '#AEB9C2') + BLITZ; break;
    case 'schnee': inhalt = WOLKE(2, -6) + FLOCKEN; break;
  }
  return `<svg class="st-wetter-bild" viewBox="0 0 64 64" aria-hidden="true">${inhalt}</svg>`;
}

export function windBild(windAus: number, bft: number, sprache: Sprache): string {
  const nach = (windAus + 180) % 360;
  const f = bftFarbe(bft);
  const marken = (sprache === 'de' ? ['N', 'O', 'S', 'W'] : ['N', 'E', 'S', 'W']).map((m, i) => {
    const a = (i * Math.PI) / 2;
    return `<text x="${32 + Math.sin(a) * 25}" y="${32 - Math.cos(a) * 25 + 3.5}" font-size="9" text-anchor="middle" fill="currentColor" opacity=".7">${m}</text>`;
  }).join('');
  return `<svg class="st-wetter-wind-bild" viewBox="0 0 64 64" aria-hidden="true">`
    + `<circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>${marken}`
    + `<g transform="rotate(${Math.round(nach)} 32 32)"><path d="M32 12l9 14h-6v22h-6V26h-6z" fill="${f}" stroke="#0B1E2D" stroke-width="1"/></g></svg>`;
}

export function bftBalken(bft: number): string {
  return `<div class="st-wetter-bft" aria-hidden="true">${Array.from({ length: 13 }, (_, i) =>
    `<span style="background:${i <= bft ? bftFarbe(i) : 'transparent'}"></span>`).join('')}</div>`;
}
