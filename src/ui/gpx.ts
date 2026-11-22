import type { Punkt } from '@/core/types';


export function parseGpx(xml: string): Punkt[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Die Datei ist kein gültiges GPX/XML.');

  const punkte = (selector: string): Punkt[] =>
    [...doc.querySelectorAll(selector)]
      .map((el) => ({ lat: parseFloat(el.getAttribute('lat') ?? ''), lon: parseFloat(el.getAttribute('lon') ?? '') }))
      .filter((p) => !isNaN(p.lat) && !isNaN(p.lon));

  let pts = punkte('rte rtept');
  if (pts.length === 0) pts = punkte('wpt');
  if (pts.length === 0) pts = punkte('trk trkseg trkpt');
  if (pts.length < 2) throw new Error('In der Datei wurde keine Route mit mindestens zwei Punkten gefunden.');
  return pts;
}


export function buildGpx(route: Punkt[], name = 'CourseCast Route'): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rtept = route.map((p, i) =>
    `    <rtept lat="${p.lat}" lon="${p.lon}"><name>${i === 0 ? 'START' : (i === route.length - 1 ? 'ZIEL' : 'WP' + i)}</name></rtept>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<gpx version="1.1" creator="CourseCast" xmlns="http://www.topografix.com/GPX/1/1">\n`
    + `  <rte>\n    <name>${esc(name)}</name>\n${rtept}\n  </rte>\n</gpx>\n`;
}
