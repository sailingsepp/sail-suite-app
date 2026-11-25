import type { Punkt } from '@/core/types';
import { naechsterWasserpunkt, kreuzungsZahl, istLandSeite } from '@/core/geo';
import { kuestenlinienUmPunkt, kuestenlinienUmStrecke, BUDGET_INTERAKTIV } from './overpass';

export interface WegpunktPruefung {
  aufLand: boolean;

  korrektur: Punkt | null;

  geprueft: boolean;
}

export async function pruefeWegpunkt(punkt: Punkt): Promise<WegpunktPruefung> {

  const kueste = await kuestenlinienUmPunkt(punkt, undefined, BUDGET_INTERAKTIV);

  if (kueste.length === 0) return { aufLand: false, korrektur: null, geprueft: false };
  const aufLand = istLandSeite(punkt, kueste);
  if (aufLand !== true) return { aufLand: false, korrektur: null, geprueft: true };
  return { aufLand: true, korrektur: naechsterWasserpunkt(punkt, kueste), geprueft: true };
}

export async function pruefeStrecke(a: Punkt, b: Punkt): Promise<boolean> {
  const kueste = await kuestenlinienUmStrecke(a, b, undefined, BUDGET_INTERAKTIV);
  if (!kueste.length) return false;
  return kreuzungsZahl(a, b, kueste) > 0;
}

export async function liegtImWasser(punkt: Punkt): Promise<boolean> {
  const kueste = await kuestenlinienUmPunkt(punkt, [1.5, 4, 10, 25], BUDGET_INTERAKTIV);
  return kueste.length > 0 && istLandSeite(punkt, kueste) === false;
}
