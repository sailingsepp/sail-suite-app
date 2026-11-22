import { KRAFTSTOFF_KLASSEN, KRAFTSTOFF_MODELLE, NUTZBARER_TANKANTEIL, type KraftstoffKlasse } from './kraftstoffDaten';
import { typFinden } from './yachttypen';

export interface KraftstoffAngabe {
  tankL: number;

  tankQuelle: 'eigen' | 'modell' | 'klasse';

  verbrauchQuelle: 'eigen' | 'modell' | 'klasse';

  modellName: string | null;
  klasse: KraftstoffKlasse;

  verbrauchLh: number;
  verbrauchMinLh: number;
  verbrauchMaxLh: number;
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function modellZu(typ: string): (typeof KRAFTSTOFF_MODELLE)[number] | null {
  const t = ` ${norm(typ)} `;
  return KRAFTSTOFF_MODELLE.find((m) => [m.modell, ...(m.namen ?? [])].some((n) => {
    const name = norm(n);
    return t.includes(` ${name} `) && (t.includes(norm(m.hersteller)) || name.includes(' '));
  })) ?? null;
}

export function kraftstoffKlasse(laengeM: number, motorPS: number | null = null): KraftstoffKlasse {
  const abstand = (k: KraftstoffKlasse) => Math.max(0, k.laengeM[0] - laengeM, laengeM - k.laengeM[1]);
  const passend = motorPS != null ? KRAFTSTOFF_KLASSEN.filter((k) => motorPS >= k.motorPS[0] && motorPS <= k.motorPS[1]) : [];
  const auswahl = passend.length ? passend : KRAFTSTOFF_KLASSEN;
  return auswahl.reduce((a, b) => (abstand(b) < abstand(a) ? b : a));
}

export function kraftstoffFuerSchiff(
  schiff: {
    typ?: string | null | undefined; laengeM?: number | null | undefined; motorPS?: number | null | undefined;

    verbrauchLh?: number | null | undefined; tankL?: number | null | undefined;
  } | null | undefined,
): KraftstoffAngabe | null {
  if (!schiff) return null;
  const typ = schiff.typ?.trim() || null;
  const modell = typ ? modellZu(typ) : null;
  const typDaten = typ ? typFinden(typ) : undefined;
  const eigenLh = schiff.verbrauchLh != null && schiff.verbrauchLh > 0 ? schiff.verbrauchLh : null;
  const eigenTank = schiff.tankL != null && schiff.tankL > 0 ? schiff.tankL : null;

  const modellLh = modell?.verbrauchLh ?? null;
  const laenge = schiff.laengeM || modell?.loaM || typDaten?.loaM;

  if (!laenge && !(eigenLh && eigenTank)) return null;
  const klasse = kraftstoffKlasse(laenge || 12.5, schiff.motorPS ?? typDaten?.motorPS ?? null);
  return {
    tankL: eigenTank ?? modell?.tankL ?? klasse.tankL.typisch,
    tankQuelle: eigenTank ? 'eigen' : modell ? 'modell' : 'klasse',
    verbrauchQuelle: eigenLh ? 'eigen' : modellLh ? 'modell' : 'klasse',
    modellName: modell ? `${modell.hersteller} ${modell.modell}` : null,
    klasse,
    verbrauchLh: eigenLh ?? modellLh ?? klasse.verbrauchLh.reise.typisch,
    verbrauchMinLh: eigenLh ?? modellLh ?? klasse.verbrauchLh.reise.min,
    verbrauchMaxLh: eigenLh ?? modellLh ?? klasse.verbrauchLh.reise.max,
  };
}

export function nutzbareLiter(k: KraftstoffAngabe): number {
  return k.tankL * NUTZBARER_TANKANTEIL;
}

export function reichweiteSm(k: KraftstoffAngabe, fahrtKn: number): number {
  return Math.floor(((nutzbareLiter(k) / k.verbrauchLh) * fahrtKn) / 10) * 10;
}

export function dieselLiter(k: KraftstoffAngabe, motorSm: number, fahrtKn: number): number {
  return (motorSm / fahrtKn) * k.verbrauchLh;
}
