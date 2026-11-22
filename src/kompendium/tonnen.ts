import { TONNE, LICHT, type Lichtfarbe } from './farben';
import { flaggeEingebettet } from './flaggen';
import { neueId, rect, poly, esc } from './svg';

const { rot: R, gruen: G, gelb: Y, schwarz: K } = TONNE;
const KONTUR = 'stroke="var(--text)" stroke-opacity=".75" stroke-width="1"';

export type Band = readonly [number, string];
export type Toppzeichen = 'can_r' | 'cone_g' | 'can_g' | 'cone_r' | 'N' | 'S' | 'E' | 'W' | '2balls' | 'ball_r' | 'X' | 'cross';
export type Tonnenform = 'can' | 'cone' | 'pillar' | 'spar';

function baender(form: string, baender: readonly Band[], senkrecht: boolean, x0: number, x1: number, y0: number, y1: number): string {
  const id = neueId('tb');
  const out: string[] = [];
  if (senkrecht) {
    const w = (x1 - x0) / baender.length;
    baender.forEach(([, farbe], i) => out.push(rect(x0 + i * w, y0, w + 0.3, y1 - y0, farbe)));
  } else {
    const summe = baender.reduce((s, [f]) => s + f, 0);
    let y = y0;
    for (const [f, farbe] of baender) {
      const h = ((y1 - y0) * f) / summe;
      out.push(rect(x0, y, x1 - x0, h + 0.3, farbe));
      y += h;
    }
  }
  return `<clipPath id="${id}"><path d="${form}"/></clipPath><g clip-path="url(#${id})">${out.join('')}</g>`
    + `<path d="${form}" fill="none" ${KONTUR}/>`;
}

export function toppzeichen(art: Toppzeichen, cx = 50, y = 8): string {
  const k = `${KONTUR}`;
  const kegelOben = (yy: number) => poly([[cx, yy], [cx + 9, yy + 14], [cx - 9, yy + 14]], K, ` ${k}`);
  const kegelUnten = (yy: number) => poly([[cx - 9, yy], [cx + 9, yy], [cx, yy + 14]], K, ` ${k}`);
  switch (art) {
    case 'can_r': return `<rect x="${cx - 8}" y="${y + 4}" width="16" height="18" fill="${R}" ${k}/>`;
    case 'cone_g': return poly([[cx, y + 2], [cx + 10, y + 22], [cx - 10, y + 22]], G, ` ${k}`);
    case 'can_g': return `<rect x="${cx - 8}" y="${y + 4}" width="16" height="18" fill="${G}" ${k}/>`;
    case 'cone_r': return poly([[cx, y + 2], [cx + 10, y + 22], [cx - 10, y + 22]], R, ` ${k}`);
    case 'N': return kegelOben(y - 6) + kegelOben(y + 10);
    case 'S': return kegelUnten(y - 6) + kegelUnten(y + 10);
    case 'E': return kegelOben(y - 6) + kegelUnten(y + 10);
    case 'W': return kegelUnten(y - 6) + kegelOben(y + 10);
    case '2balls': return `<circle cx="${cx}" cy="${y}" r="7" fill="${K}" ${k}/><circle cx="${cx}" cy="${y + 17}" r="7" fill="${K}" ${k}/>`;
    case 'ball_r': return `<circle cx="${cx}" cy="${y + 12}" r="9" fill="${R}" ${k}/>`;
    case 'X': return `<path d="M${cx - 9} ${y + 4}L${cx + 9} ${y + 22}M${cx + 9} ${y + 4}L${cx - 9} ${y + 22}" stroke="${Y}" stroke-width="5" stroke-linecap="square"/>`;
    case 'cross': return `<path d="M${cx} ${y + 2}V${y + 24}M${cx - 10} ${y + 13}H${cx + 10}" stroke="${Y}" stroke-width="5"/>`;
    default: return '';
  }
}

export interface TonnenOptionen {
  top?: Toppzeichen;
  senkrecht?: boolean;
  licht?: Lichtfarbe;

  einbettung?: { x: number; y: number; w: number; h: number };
}

export function tonne(form: Tonnenform, bd: readonly Band[], label: string, opt: TonnenOptionen = {}): string {
  const out: string[] = [];
  let tmy: number;
  if (form === 'can') {
    out.push(baender('M30 62 H70 V122 H30 Z', bd, !!opt.senkrecht, 30, 70, 62, 122));
    tmy = 34;
  } else if (form === 'cone') {
    out.push(baender('M50 52 L72 122 H28 Z', bd, !!opt.senkrecht, 28, 72, 52, 122));
    tmy = 26;
  } else if (form === 'pillar') {
    out.push('<line x1="50" y1="50" x2="50" y2="34" stroke="var(--muted)" stroke-width="2"/>');
    out.push(baender('M41 50 H59 L61 100 H74 L78 122 H22 L26 100 H39 Z', bd, !!opt.senkrecht, 22, 78, 50, 122));
    tmy = 12;
  } else {
    out.push('<line x1="50" y1="30" x2="50" y2="22" stroke="var(--muted)" stroke-width="2"/>');
    out.push(baender('M45 30 H55 L57 122 H43 Z', bd, !!opt.senkrecht, 43, 57, 30, 122));
    tmy = 0;
  }
  const tm = opt.top ? toppzeichen(opt.top, 50, tmy) : '';
  let lt = '';
  if (opt.licht) {
    const ly = { pillar: 44, spar: 26, can: 58, cone: 50 }[form];
    lt = `<circle cx="50" cy="${ly}" r="3.2" fill="${LICHT[opt.licht]}" stroke="var(--bg)" stroke-width=".8"/>`;
  }
  const wasser = '<path d="M8 121 q8 -5 16 0 t16 0 t16 0 t16 0 t16 0" fill="none" stroke="var(--muted)" stroke-width="2"/>';
  const e = opt.einbettung;
  const kopf = e
    ? `<svg x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" viewBox="0 -12 100 142" role="img" aria-label="${esc(label)}">`
    : `<svg class="kp-tonne kp-fach" viewBox="0 -12 100 142" role="img" aria-label="${esc(label)}">`;
  return `${kopf}${out.join('')}${tm}${lt}${wasser}</svg>`;
}

export type Koerper = 'ball' | 'cone_up' | 'cone_down' | 'diamond' | 'cyl' | 'hourglass' | 'flagA';

export function signalkoerper(teile: readonly Koerper[], label: string): string {
  let y = 6;
  const out: string[] = [];
  const f = 'var(--text)';
  for (const t of teile) {
    if (t === 'ball') { out.push(`<circle cx="30" cy="${y + 12}" r="12" fill="${f}"/>`); y += 30; }
    else if (t === 'cone_up') { out.push(poly([[30, y], [43, y + 24], [17, y + 24]], f)); y += 30; }
    else if (t === 'cone_down') { out.push(poly([[17, y], [43, y], [30, y + 24]], f)); y += 30; }
    else if (t === 'diamond') { out.push(poly([[30, y], [43, y + 15], [30, y + 30], [17, y + 15]], f)); y += 36; }
    else if (t === 'cyl') { out.push(`<rect x="20" y="${y}" width="20" height="30" fill="${f}"/>`); y += 36; }
    else if (t === 'hourglass') { out.push(poly([[17, y], [43, y], [30, y + 22]], f) + poly([[30, y + 22], [43, y + 44], [17, y + 44]], f)); y += 50; }
    else if (t === 'flagA') { out.push(flaggeEingebettet('A', 3, y, 0.9)); y += 42; }
  }
  const h = Math.max(y, 40);
  const linie = `<line x1="30" y1="0" x2="30" y2="${h}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="2 3"/>`;
  return `<svg class="kp-tag${teile.includes('flagA') ? ' kp-fach' : ''}" viewBox="0 0 60 ${h}" width="60" role="img" aria-label="${esc(label)}">${linie}${out.join('')}</svg>`;
}
