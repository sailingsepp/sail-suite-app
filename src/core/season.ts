export type SaisonLage = 'spitze' | 'haupt' | 'rand' | 'ausserhalb';

export function saisonLage(datum: Date): SaisonLage {
  const monat = datum.getUTCMonth() + 1, tag = datum.getUTCDate();

  if (monat === 8 || (monat === 7 && tag >= 15)) return 'spitze';

  if ((monat === 6 && tag >= 15) || (monat === 7 && tag < 15) || (monat === 9 && tag <= 15)) return 'haupt';

  if (monat === 4 || monat === 5 || monat === 10
    || (monat === 6 && tag < 15) || (monat === 9 && tag > 15)) return 'rand';
  return 'ausserhalb';
}

export function istAugustspitze(datum: Date): boolean {
  return datum.getUTCMonth() + 1 === 8 && datum.getUTCDate() >= 10 && datum.getUTCDate() <= 20;
}

export function istCrewwechseltag(datum: Date): boolean {
  const tag = datum.getUTCDay();
  return tag === 5 || tag === 6;
}

export function marinaVermutlichVoll(lage: SaisonLage): boolean {
  return lage === 'spitze' || lage === 'haupt';
}
