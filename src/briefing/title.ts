import type { Sprache } from '@/core/types';

export function briefTitel(start: string | null, ziel: string | null, sprache: Sprache = 'de'): string {
  if (sprache === 'en') {
    if (start && ziel) return `Daily briefing for a passage from ${start} to ${ziel}`;
    if (start) return `Daily briefing for a passage from ${start}`;
    if (ziel) return `Daily briefing for a passage to ${ziel}`;
    return 'Daily briefing';
  }
  if (start && ziel) return `Tagesbriefing für eine Fahrt von ${start} nach ${ziel}`;
  if (start) return `Tagesbriefing für eine Fahrt ab ${start}`;
  if (ziel) return `Tagesbriefing für eine Fahrt nach ${ziel}`;
  return 'Tagesbriefing';
}
