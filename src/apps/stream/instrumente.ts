import { kursGrad, nf } from '@/core/time';
import type { Sprache } from '@/core/types';

export const FAHRT_MAX_KN = 12;

const BOGEN_VON = -120;
const BOGEN_BIS = 120;

const k = (n: number) => Number(n.toFixed(2)).toString();

function auf(cx: number, cy: number, r: number, grad: number): [number, number] {
  const a = (grad * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

export function zeigerWinkel(kn: number): number {
  const v = Math.min(FAHRT_MAX_KN, Math.max(0, kn));
  return BOGEN_VON + (v / FAHRT_MAX_KN) * (BOGEN_BIS - BOGEN_VON);
}

export function roseDrehung(kurs: number): number {
  return -(((kurs % 360) + 360) % 360);
}

function bogen(cx: number, cy: number, r: number, von: number, bis: number): string {
  const [x0, y0] = auf(cx, cy, r, von);
  const [x1, y1] = auf(cx, cy, r, bis);
  return `M${k(x0)} ${k(y0)} A${r} ${r} 0 ${bis - von > 180 ? 1 : 0} 1 ${k(x1)} ${k(y1)}`;
}

export function fahrtmesser(sog: number | null, sprache: Sprache): string {
  const cx = 100;
  const cy = 100;
  const en = sprache === 'en';
  const o: string[] = [
    `<circle cx="${cx}" cy="${cy}" r="94" fill="var(--panel)" stroke="var(--line)" stroke-width="2"/>`,
    `<circle cx="${cx}" cy="${cy}" r="86" fill="none" stroke="color-mix(in srgb, var(--text) 10%, transparent)" stroke-width="1"/>`,
    `<path d="${bogen(cx, cy, 78, BOGEN_VON, BOGEN_BIS)}" fill="none" stroke="color-mix(in srgb, var(--teal) 30%, transparent)" stroke-width="6" stroke-linecap="round"/>`,
  ];
  if (sog != null) {
    o.push(`<path d="${bogen(cx, cy, 78, BOGEN_VON, Math.max(BOGEN_VON + 0.5, zeigerWinkel(sog)))}" fill="none" stroke="var(--teal)" stroke-width="6" stroke-linecap="round"/>`);
  }
  for (let v = 0; v <= FAHRT_MAX_KN * 2; v++) {
    const kn = v / 2;
    const w = zeigerWinkel(kn);
    const gross = Number.isInteger(kn);
    const [x0, y0] = auf(cx, cy, gross ? 66 : 70, w);
    const [x1, y1] = auf(cx, cy, 74, w);
    o.push(`<line x1="${k(x0)}" y1="${k(y0)}" x2="${k(x1)}" y2="${k(y1)}" stroke="var(--text)" stroke-width="${gross ? 2 : 1}" stroke-opacity="${gross ? 0.9 : 0.5}"/>`);
    if (gross && kn % 2 === 0) {
      const [tx, ty] = auf(cx, cy, 54, w);
      o.push(`<text x="${k(tx)}" y="${k(ty + 5)}" text-anchor="middle" class="st-instr-skala">${kn}</text>`);
    }
  }
  const wert = sog == null ? '–' : nf(sog, 1, sprache);
  o.push(`<text x="${cx}" y="${cy + 40}" text-anchor="middle" class="st-instr-wert">${wert}</text>`,
    `<text x="${cx}" y="${cy + 58}" text-anchor="middle" class="st-instr-einheit">kn</text>`,
    `<text x="${cx}" y="${cy + 80}" text-anchor="middle" class="st-instr-name">${en ? 'SOG' : 'FüG'}</text>`);
  if (sog != null) {
    const w = zeigerWinkel(sog);
    o.push(`<g transform="rotate(${k(w)} ${cx} ${cy})">`
      + `<path d="M${cx - 3.5} ${cy + 12} L${cx - 1.2} ${cy - 76} L${cx + 1.2} ${cy - 76} L${cx + 3.5} ${cy + 12} Z" fill="var(--akzent)"/></g>`);
  }
  o.push(`<circle cx="${cx}" cy="${cy}" r="8" fill="var(--text)"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--panel)"/>`);
  const label = sog == null
    ? (en ? 'Speed over ground: no value' : 'Fahrt über Grund: kein Wert')
    : (en ? `Speed over ground ${wert} knots` : `Fahrt über Grund ${wert} Knoten`);
  return `<svg class="st-instr" viewBox="0 0 200 200" role="img" aria-label="${label}">${o.join('')}</svg>`;
}

export function kompass(cog: number | null, sprache: Sprache): string {
  const cx = 100;
  const cy = 100;
  const en = sprache === 'en';
  const rose: string[] = [];
  for (let g = 0; g < 360; g += 5) {
    const gross = g % 30 === 0;
    const mittel = g % 10 === 0;
    const [x0, y0] = auf(cx, cy, gross ? 70 : mittel ? 74 : 77, g);
    const [x1, y1] = auf(cx, cy, 82, g);
    rose.push(`<line x1="${k(x0)}" y1="${k(y0)}" x2="${k(x1)}" y2="${k(y1)}" stroke="var(--text)" stroke-width="${gross ? 2 : 1}" stroke-opacity="${gross ? 0.95 : 0.55}"/>`);
    if (gross) {
      const [tx, ty] = auf(cx, cy, 59, g);
      const haupt: Record<number, string> = { 0: 'N', 90: en ? 'E' : 'O', 180: 'S', 270: 'W' };
      const text = haupt[g] ?? String(g / 10).padStart(2, '0');
      rose.push(`<text x="${k(tx)}" y="${k(ty)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${g} ${k(tx)} ${k(ty)})" `
        + `class="${haupt[g] ? 'st-instr-haupt' : 'st-instr-skala'}"${g === 0 ? ' fill="var(--red)"' : ''}>${text}</text>`);
    }
  }

  const [nx, ny] = auf(cx, cy, 46, 0);
  rose.push(`<path d="M${k(nx)} ${k(ny)} L${k(nx + 7)} ${k(ny + 16)} L${k(nx)} ${k(ny + 12)} L${k(nx - 7)} ${k(ny + 16)} Z" fill="var(--red)"/>`);
  const drehung = cog == null ? 0 : roseDrehung(cog);
  const wert = cog == null ? '–' : kursGrad(cog);
  const o = [
    `<circle cx="${cx}" cy="${cy}" r="94" fill="var(--panel)" stroke="var(--line)" stroke-width="2"/>`,
    `<g class="st-instr-rose" transform="rotate(${k(drehung)} ${cx} ${cy})">`
      + `<circle cx="${cx}" cy="${cy}" r="84" fill="none" stroke="color-mix(in srgb, var(--text) 25%, transparent)" stroke-width="1"/>${rose.join('')}</g>`,

    `<path d="M${cx} 4 L${cx + 9} 18 L${cx - 9} 18 Z" fill="var(--akzent)"/>`,
    `<line x1="${cx}" y1="18" x2="${cx}" y2="34" stroke="var(--akzent)" stroke-width="3" stroke-linecap="round"/>`,
    `<rect x="${cx - 36}" y="${cy - 14}" width="72" height="40" rx="8" fill="var(--bg)" stroke="var(--line)"/>`,
    `<text x="${cx}" y="${cy + 13}" text-anchor="middle" class="st-instr-kurs">${wert}</text>`,
    `<text x="${cx}" y="${cy + 46}" text-anchor="middle" class="st-instr-name">${en ? 'COG' : 'KüG'}</text>`,
  ];
  const label = cog == null
    ? (en ? 'Course over ground: no value' : 'Kurs über Grund: kein Wert')
    : (en ? `Course over ground ${wert}` : `Kurs über Grund ${wert}`);
  return `<svg class="st-instr" viewBox="0 0 200 200" role="img" aria-label="${label}">${o.join('')}</svg>`;
}
