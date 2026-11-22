import { kursRw, nf } from '@/core/time';
import type { AnkerwacheBefund } from '@/core/ankerwache';
import type { Sprache } from '@/core/types';

function grad(v: number, sprache: Sprache): string {
  return kursRw(v, sprache);
}

export function ankerwacheEintragText(b: AnkerwacheBefund, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const abstand = nf(b.abstandM, 0, sprache);
  return en
    ? `Drifted ${abstand} m from the anchor, bearing ${grad(b.peilung, sprache)}.`
    : `Abdrift: ${abstand} m vom Anker, Peilung ${grad(b.peilung, sprache)}.`;
}

export function ankerwacheAlarmText(b: AnkerwacheBefund, sprache: Sprache = 'de'): string {
  const en = sprache === 'en';
  const abstand = nf(b.abstandM, 0, sprache);
  return en
    ? `${abstand} m from the anchor, bearing ${grad(b.peilung, sprache)}.`
    : `${abstand} m vom Anker entfernt, Peilung ${grad(b.peilung, sprache)}.`;
}
