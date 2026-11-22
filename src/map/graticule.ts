import type L from 'leaflet';

const NICE_STEPS_DEG = [1 / 60, 1 / 30, 1 / 12, 1 / 6, 1 / 3, 0.5, 1, 2, 5, 10, 20, 30, 45, 90];
const ZIEL_LINIEN = 6;

function passendeSchrittweite(spanDeg: number): number {
  for (const step of NICE_STEPS_DEG) {
    if (spanDeg / step <= ZIEL_LINIEN) return step;
  }
  return NICE_STEPS_DEG[NICE_STEPS_DEG.length - 1]!;
}

function fmtGrad(wert: number, step: number, achse: 'lat' | 'lon'): string {
  const suffix = achse === 'lat' ? (wert >= 0 ? 'N' : 'S') : (wert >= 0 ? 'E' : 'W');
  const abs = Math.abs(wert);
  if (step >= 1) return `${Math.round(abs)}°${suffix}`;
  let deg = Math.floor(abs + 1e-9);
  let min = Math.round((abs - deg) * 60);
  if (min === 60) { min = 0; deg += 1; }
  return `${deg}°${String(min).padStart(2, '0')}'${suffix}`;
}

export function addGraticule(map: L.Map): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'graticule');
  map.getContainer().appendChild(svg);

  const linie = (x1: number, y1: number, x2: number, y2: number): string =>
    `<line class="graticule-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const label = (x: number, y: number, text: string, anchor: string): string =>
    `<text class="graticule-label" x="${x}" y="${y}" text-anchor="${anchor}">${text}</text>`;

  function update(): void {
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    svg.setAttribute('width', String(size.x));
    svg.setAttribute('height', String(size.y));

    const bounds = map.getBounds();
    const latSpan = bounds.getNorth() - bounds.getSouth();
    const lonSpan = bounds.getEast() - bounds.getWest();
    const step = passendeSchrittweite(Math.max(latSpan, lonSpan));

    let inhalt = '';
    const latVon = Math.ceil(bounds.getSouth() / step) * step;
    for (let lat = latVon; lat <= bounds.getNorth() + 1e-9; lat += step) {
      const y = map.latLngToContainerPoint([lat, 0]).y;
      const text = fmtGrad(lat, step, 'lat');
      inhalt += linie(0, y, size.x, y) + label(6, y - 4, text, 'start') + label(size.x - 6, y - 4, text, 'end');
    }
    const lonVon = Math.ceil(bounds.getWest() / step) * step;
    for (let lon = lonVon; lon <= bounds.getEast() + 1e-9; lon += step) {
      const x = map.latLngToContainerPoint([0, lon]).x;
      const text = fmtGrad(lon, step, 'lon');
      inhalt += linie(x, 0, x, size.y) + label(x, 13, text, 'middle') + label(x, size.y - 5, text, 'middle');
    }
    svg.innerHTML = inhalt;
  }

  map.on('move zoom viewreset resize', update);
  update();
}
