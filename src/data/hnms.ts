import type { GebietsBericht } from '@/briefing/amtlich';
import { pruefeGebietsBericht, holeGebietsBericht } from './seebericht';

export const pruefeHnmsAntwort = pruefeGebietsBericht;

export function holeHnmsBericht(basis?: string): Promise<GebietsBericht | null> {
  return holeGebietsBericht('hnms', basis);
}

export async function ladeHnmsSeegebiete() {
  return (await import('@/core/hnmsSeegebieteDaten')).HNMS_SEEGEBIETE;
}
