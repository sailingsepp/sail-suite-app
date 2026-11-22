import { benenneRegion } from './grosswetterlage';
import { GRADIENT_FLACH, type Druckanalyse, type Druckzentrum } from '@/core/druckfeld';
import type { Sprache } from '@/core/types';

export type Druckmuster =

  | 'bora'

  | 'sued'

  | 'nordwest'

  | 'meltemi';

function imSektor(peilung: number, von: number, bis: number): boolean {
  const p = ((peilung % 360) + 360) % 360;
  return von <= bis ? (p >= von && p <= bis) : (p >= von || p <= bis);
}

const MUSTER: Record<Druckmuster, { hoch?: [number, number]; tief?: [number, number] }> = {

  bora: { hoch: [330, 90], tief: [110, 210] },

  sued: { hoch: [30, 130], tief: [230, 330] },

  nordwest: { hoch: [230, 340] },

  meltemi: { tief: [60, 170] },
};

export function gefaellePasstZuBora(druck: Druckanalyse | null): boolean {
  if (!druck || druck.anstiegNach === null || druck.gradient < GRADIENT_FLACH) return false;
  const [von, bis] = MUSTER.bora.hoch!;
  return imSektor(druck.anstiegNach, von, bis);
}

function passt(z: Druckzentrum | null, sektor: [number, number] | undefined): boolean {
  if (!sektor) return true;
  return !!z && imSektor(z.peilung, sektor[0], sektor[1]);
}

function ueber(z: Druckzentrum, sprache: Sprache = 'de'): string | null {
  const r = benenneRegion(z.lat, z.lon, sprache);
  if (!r) return null;
  return sprache === 'en' ? `over ${r}` : `über ${r}`;
}

export function bestaetigtDurchDruck(
  muster: Druckmuster, druck: Druckanalyse | null, sprache: Sprache = 'de',
): string | null {
  if (!druck) return null;
  const soll = MUSTER[muster];
  if (!passt(druck.hoch, soll.hoch) || !passt(druck.tief, soll.tief)) return null;

  const teile: string[] = [];
  if (sprache === 'en') {
    if (soll.hoch && druck.hoch) { const t = ueber(druck.hoch, 'en'); if (t) teile.push(`a high ${t}`); }
    if (soll.tief && druck.tief) { const t = ueber(druck.tief, 'en'); if (t) teile.push(`a low ${t}`); }
    if (teile.length === 0) return null;
    return ` <b>The pressure pattern supports this:</b> ${teile.join(' and ')}, `
      + 'exactly the constellation from which this wind arises.';
  }
  if (soll.hoch && druck.hoch) { const t = ueber(druck.hoch); if (t) teile.push(`ein Hoch ${t}`); }
  if (soll.tief && druck.tief) { const t = ueber(druck.tief); if (t) teile.push(`ein Tief ${t}`); }
  if (teile.length === 0) return null;

  return ` <b>Die Druckverteilung stützt das:</b> ${teile.join(' und ')}, `
    + 'genau die Konstellation, aus der dieser Wind entsteht.';
}

const MELTEMI_HOCH_NORDWEST: [number, number] = [285, 15];

export function starkerMeltemiVoraus(druck: Druckanalyse | null, sprache: Sprache = 'de'): string | null {
  if (!druck?.hoch || !druck.tief) return null;
  if (!imSektor(druck.tief.peilung, ...MUSTER.meltemi.tief!)) return null;
  if (!imSektor(druck.hoch.peilung, ...MELTEMI_HOCH_NORDWEST)) return null;
  if (sprache === 'en') {
    const h = ueber(druck.hoch, 'en');
    if (!h) return null;

    return ` <b>Additional warning sign from the pressure pattern:</b> alongside the heat low in the `
      + `east, a high ${h} is pushing in from the northwest, the constellation that precedes a `
      + 'strong Meltemi. It tightens the pressure gradient over the Aegean; the transition into the '
      + 'strong-wind phase then often takes just four to six hours.';
  }
  const h = ueber(druck.hoch);
  if (!h) return null;

  return ` <b>Zusätzliches Warnzeichen aus der Druckverteilung:</b> Zum Hitzetief im Osten kommt `
    + `ein Hoch ${h} von Nordwesten, die Konstellation, die einem starken Meltemi vorausgeht. `
    + 'Sie zieht den Druckgegensatz über der Ägäis zusammen; der Übergang in die Starkwindphase '
    + 'geht dann oft in vier bis sechs Stunden.';
}
