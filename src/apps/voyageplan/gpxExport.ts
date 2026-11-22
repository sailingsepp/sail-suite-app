import type { Punkt } from '@/core/types';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export interface EtappenkettenGlied {
  vonName: string;
  nachName: string;
  wegpunkte: readonly Punkt[];
}

export function baueEtappenkettenGpx(
  etappen: readonly EtappenkettenGlied[], toernName: string, beschreibung?: string,
): string | null {

  const strecken = etappen.filter((e) => e.wegpunkte.length >= 2);
  const gesamtPunkte = strecken.reduce((n, e) => n + e.wegpunkte.length, 0);
  if (gesamtPunkte < 2) return null;

  const rtept = strecken.flatMap((e) =>
    e.wegpunkte.map((p, i) => {
      const name = i === 0 ? e.vonName : i === e.wegpunkte.length - 1 ? e.nachName : '';
      return `    <rtept lat="${p.lat}" lon="${p.lon}">${name ? `<name>${esc(name)}</name>` : ''}</rtept>`;
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="VoyagePlan" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <rte>',
    `    <name>${esc(toernName)}</name>`,
    ...(beschreibung ? [`    <desc>${esc(beschreibung)}</desc>`] : []),
    ...rtept,
    '  </rte>',
    '</gpx>',
    '',
  ].join('\n');
}

export function gpxDateiname(toernName: string): string {
  const teil = toernName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `toernplan-${teil || 'toern'}.gpx`;
}
