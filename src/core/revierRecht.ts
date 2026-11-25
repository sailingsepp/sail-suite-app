export type RevierRechtshinweis = 'kroatien-seefunk' | 'griechenland-coskipper';

const KROATIEN_MUSTER = /\b(kroatien|croatia|hrvatska)\b/i;
const GRIECHENLAND_MUSTER = /\b(griechenland|greece|ellada|hellas)\b/i;

export function erkenneRevierRechtshinweise(revier: string | null | undefined): RevierRechtshinweis[] {
  if (!revier) return [];
  const treffer: RevierRechtshinweis[] = [];
  if (KROATIEN_MUSTER.test(revier)) treffer.push('kroatien-seefunk');
  if (GRIECHENLAND_MUSTER.test(revier)) treffer.push('griechenland-coskipper');
  return treffer;
}
