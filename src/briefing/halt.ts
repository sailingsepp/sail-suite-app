import { uhrLt, nf } from '@/core/time';
import { escapeHtml } from '@/core/html';
import type { HaltZeit, Sprache } from '@/core/types';

export const DUNKEL_AB_MIN = 15;

export function describeHalte(halte: readonly HaltZeit[] | undefined, sprache: Sprache = 'de'): string | null {
  if (!halte?.length) return null;
  const en = sprache === 'en';
  const dauer = (min: number) => (min >= 60
    ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')} min` : ''}`
    : `${nf(min, 0, sprache)} min`);
  const saetze = halte.map((h) => {
    const was = h.text ? ` (${escapeHtml(h.text)})` : '';

    const d = h.dunkelMin ?? 0;
    const dunkel = d < DUNKEL_AB_MIN ? ''
      : d >= h.min - 5 ? (en ? ' Entirely after dark.' : ' Ganz im Dunkeln.')
        : en ? ` Of that, ${dauer(d)} after dark.` : ` Davon ${dauer(d)} im Dunkeln.`;
    return (en
      ? `Stop at waypoint ${h.wp}${was}: ${dauer(h.min)}, from ${uhrLt(h.an)} to ${uhrLt(h.ab)}.`
      : `Aufenthalt an Wegpunkt ${h.wp}${was}: ${dauer(h.min)}, von ${uhrLt(h.an)} bis ${uhrLt(h.ab)}.`) + dunkel;
  });
  saetze.push(halte.length === 1
    ? (en ? 'Arrival and passage time include this stop.' : 'Ankunft und Fahrzeit enthalten diesen Aufenthalt.')
    : (en ? 'Arrival and passage time include these stops.' : 'Ankunft und Fahrzeit enthalten diese Aufenthalte.'));
  return saetze.join(' ');
}
