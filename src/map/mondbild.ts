

const R = 14;
const M = 20;
const HELL = '#f5e6a8';
const DUNKEL = '#46507a';
const RAND = 'rgba(245,230,168,.7)';


export function lichtPfad(k: number): string {
  const b = Math.min(1, Math.max(0, k));
  const rx = Math.abs(1 - 2 * b) * R;
  const f = (x: number) => Math.round(x * 100) / 100;
  return `M${M} ${M - R}A${R} ${R} 0 0 1 ${M} ${M + R}A${f(rx)} ${R} 0 0 ${b > 0.5 ? 1 : 0} ${M} ${M - R}Z`;
}


export function drehung(randZenit: number): number {
  const z = (randZenit * Math.PI) / 180;
  const grad = (Math.atan2(-Math.cos(z), -Math.sin(z)) * 180) / Math.PI;
  return Math.round(((grad % 360) + 360) % 360);
}

export function mondSvg(beleuchtung: number, randZenit: number, ueberHorizont: boolean, px = 40): string {
  const scheibe = `<g transform="rotate(${drehung(randZenit)} ${M} ${M})">`
    + `<circle class="mb-dunkel" cx="${M}" cy="${M}" r="${R}" fill="${DUNKEL}" stroke="${RAND}" stroke-width="1"/>`
    + (beleuchtung >= 0.01 ? `<path class="mb-hell" d="${lichtPfad(beleuchtung)}" fill="${HELL}"/>` : '')
    + '</g>';
  const kopf = `<svg viewBox="0 0 40 40" width="${px}" height="${px}" aria-hidden="true">`;
  if (ueberHorizont) return `${kopf}${scheibe}</svg>`;
  
  return kopf
    + '<defs><clipPath id="mb-kimm"><rect x="0" y="0" width="40" height="31"/></clipPath></defs>'
    + `<g clip-path="url(#mb-kimm)" opacity=".6"><g transform="translate(0 6)">${scheibe}</g></g>`
    + `<line class="mb-rand" x1="2" y1="31" x2="38" y2="31" stroke="${HELL}" stroke-width="1.5" stroke-linecap="round"/>`
    + '</svg>';
}
