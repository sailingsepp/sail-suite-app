import type { BriefingAbschnitt } from './index';
import { htmlZuText } from '@/core/html';

export function briefingPlaintext(titel: string, abschnitte: BriefingAbschnitt[]): string {
  const teile = abschnitte.map((a) =>
    `${a.titel.toUpperCase()}\n${htmlZuText(a.text).replace(/[ \t]+/g, ' ').trim()}`);
  return `${titel}\n\n${teile.join('\n\n')}`;
}
