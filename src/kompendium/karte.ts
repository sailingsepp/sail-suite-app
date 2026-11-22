import { KARTE_BREITE, KARTE_HOEHE, KUGEL, GRADNETZ, REGION_A, REGION_B, ANTARKTIS, MARKEN } from './karteDaten';
import type { Sprache } from '@/core/types';

export function weltkarte(sprache: Sprache): string {
  const label = sprache === 'en'
    ? 'World map: Region B (Americas, Japan, Korea, Philippines) and Region A (rest of the world)'
    : 'Weltkarte: Region B (Amerika, Japan, Korea, Philippinen) und Region A (übrige Welt)';
  const marken = MARKEN.map((m) => `<text x="${m.x}" y="${m.y + 14}" class="kp-m-lab kp-m-lab-${m.region.toLowerCase()}">${m.region}</text>`).join('');
  return `<svg viewBox="0 0 ${KARTE_BREITE} ${KARTE_HOEHE}" class="kp-weltkarte" role="img" aria-label="${label}">`
    + `<path d="${KUGEL}" class="kp-m-see"/><path d="${GRADNETZ}" class="kp-m-netz"/>`
    + `<path d="${REGION_A}" class="kp-m-a"/><path d="${REGION_B}" class="kp-m-b"/><path d="${ANTARKTIS}" class="kp-m-n"/>`
    + `${marken}</svg>`;
}
