import type { Fix, SpurPunkt } from '@/core/spur';
import { werteSpurAus } from '@/core/spur';
import type { Fahrt, LogEintrag, Toern } from '@/data/logdb';

const ent = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const iso = (t: number): string => new Date(t).toISOString();

const grad = (n: number): string => n.toFixed(7);

export interface GpxEingabe {
  fahrt: Fahrt;
  fixe: Fix[];
  eintraege?: LogEintrag[];
  toern?: Toern | null;
}

export function baueGpx({ fahrt, fixe, eintraege = [], toern }: GpxEingabe): string {

  const a = werteSpurAus(fixe);
  const grenzen = a.luecken.map((l) => l.bis);

  const name = fahrt.name ?? toern?.name ?? 'SailPilot';
  const zeilen: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="SailPilot" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata>',
    `    <name>${ent(name)}</name>`,
    `    <time>${iso(fahrt.begonnen)}</time>`,
  ];
  if (toern) {
    const teile = [toern.name, toern.revier, toern.schiff?.name].filter(Boolean);
    zeilen.push(`    <desc>${ent(teile.join(' · '))}</desc>`);
  }
  zeilen.push('  </metadata>');

  for (const e of eintraege) {
    if (e.lat === null || e.lon === null) continue;
    zeilen.push(
      `  <wpt lat="${grad(e.lat)}" lon="${grad(e.lon)}">`,
      `    <time>${iso(e.t)}</time>`,
      `    <name>${ent(e.text ?? e.art)}</name>`,
      `    <type>${ent(e.art)}</type>`,
      '  </wpt>',
    );
  }

  zeilen.push('  <trk>', `    <name>${ent(name)}</name>`, '    <trkseg>');
  let vorher: Fix | null = null;
  for (const f of [...fixe].sort((x, y) => x.t - y.t)) {
    if (vorher && grenzen.some((g) => g > vorher!.t && g <= f.t)) {
      zeilen.push('    </trkseg>', '    <trkseg>');
    }
    zeilen.push(`      <trkpt lat="${grad(f.lat)}" lon="${grad(f.lon)}">`);
    zeilen.push(`        <time>${iso(f.t)}</time>`);

    if (Number.isFinite(f.acc)) zeilen.push(`        <hdop>${(f.acc / 5).toFixed(1)}</hdop>`);
    zeilen.push('      </trkpt>');
    vorher = f;
  }
  zeilen.push('    </trkseg>', '  </trk>', '</gpx>', '');
  return zeilen.join('\n');
}

export function gpxDateiname(fahrt: Fahrt, toern?: Toern | null): string {
  const datum = new Date(fahrt.begonnen).toISOString().slice(0, 10);
  const teil = (toern?.name ?? fahrt.name ?? 'toernlog')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${datum}-${teil || 'toernlog'}.gpx`;
}

export async function biete(
  inhalt: string | Blob, dateiname: string, typ = 'application/gpx+xml',
): Promise<'geteilt' | 'geladen'> {
  const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: typ });
  const datei = new File([blob], dateiname, { type: blob.type || typ });

  const teilen = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (navigator.share && teilen.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: dateiname });
      return 'geteilt';
    } catch {

    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  return 'geladen';
}

export function gpxUmfang(fixe: Fix[]): { punkte: number; segmente: number; verdichtet: SpurPunkt[] } {
  const a = werteSpurAus(fixe);
  return { punkte: fixe.length, segmente: a.luecken.length + 1, verdichtet: a.punkte };
}
