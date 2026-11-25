export function windBarbSVG(dirFrom: number, speedKn: number, lat: number, colour: string, px?: number): string {
  const L = 34, STEP = 7, BW = 14, BH = 5.5, sign = lat < 0 ? -1 : 1;
  const v = Math.round(speedKn / 5) * 5;
  const halo = '#0B1E2D';
  let body = '';

  function wrap(inner: string, rot: number): string {

    const S = px || 52;
    return `<svg viewBox="-42 -42 84 84" width="${S}" height="${S}" style="overflow:visible">`
      + `<g transform="rotate(${rot.toFixed(1)})">${inner}</g></svg>`;
  }

  if (v < 2.5) {
    body = `<circle cx="0" cy="0" r="6" fill="none" stroke="${halo}" stroke-width="4"/>`
      + `<circle cx="0" cy="0" r="6" fill="none" stroke="${colour}" stroke-width="1.8"/>`;
    return wrap(body, 0);
  }

  const pen = Math.floor(v / 50), rest = v % 50;
  const full = Math.floor(rest / 10), half = Math.floor((rest % 10) / 5);
  let y = -L;
  const seg: string[] = [];

  for (let i = 0; i < pen; i++) {
    seg.push(`<polygon points="0,${y} ${sign * BW},${(y + BH).toFixed(1)} 0,${y + 2 * BH}" fill="FILL" stroke="FILL" stroke-width="1"/>`);
    y += 2 * BH + 2;
  }
  for (let i = 0; i < full; i++) {
    seg.push(`<line x1="0" y1="${y}" x2="${sign * BW}" y2="${(y + BH).toFixed(1)}"/>`);
    y += STEP;
  }
  if (half) {

    if (!pen && !full) y += STEP;
    seg.push(`<line x1="0" y1="${y}" x2="${(sign * BW / 2).toFixed(1)}" y2="${(y + BH / 2).toFixed(1)}"/>`);
  }

  const shaft = `<line x1="0" y1="0" x2="0" y2="${-L}"/>`;
  const draw = (col: string, w: number) => `<g stroke="${col}" stroke-width="${w}" stroke-linecap="round" fill="none">`
    + shaft + seg.join('').replace(/FILL/g, col) + `</g>`;
  body = draw(halo, 4.5) + draw(colour, 1.9);
  return wrap(body, dirFrom);
}
