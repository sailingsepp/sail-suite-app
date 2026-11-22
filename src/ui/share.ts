import type { BriefingAbschnitt } from '@/briefing';
import { briefingPlaintext } from '@/briefing/plaintext';
import { aktuelleSprache } from '@/shell/sprache';

export function initShare(abschnitte: BriefingAbschnitt[]): void {
  const btn = document.getElementById('btn-share') as HTMLButtonElement | null;
  if (!btn) return;

  const kannTeilen = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const kannKopieren = typeof navigator !== 'undefined' && !!navigator.clipboard;
  btn.disabled = !kannTeilen && !kannKopieren;
  const en = aktuelleSprache() === 'en';
  btn.title = kannTeilen
    ? (en ? "Forward the briefing to the crew (the device's share dialog)" : 'Briefing an die Crew weiterleiten (Teilen-Dialog des Geräts)')
    : (kannKopieren
      ? (en ? 'Copy the briefing as text to the clipboard' : 'Briefing als Text in die Zwischenablage kopieren')
      : (en ? 'Sharing is not supported by this browser' : 'Teilen wird von diesem Browser nicht unterstützt'));

  btn.onclick = async () => {
    const titel = document.getElementById('brief-titel')?.textContent?.trim()
      || (aktuelleSprache() === 'en' ? 'CourseCast: Briefing' : 'Tagesplanung: Briefing');
    const text = briefingPlaintext(titel, abschnitte);
    try {
      if (kannTeilen) {
        await navigator.share({ title: titel, text });
      } else if (kannKopieren) {
        await navigator.clipboard.writeText(text);
        const alt = btn.innerHTML;
        btn.textContent = aktuelleSprache() === 'en' ? '✓ Copied' : '✓ Kopiert';
        window.setTimeout(() => { btn.innerHTML = alt; }, 2000);
      }
    } catch (err) {

      if ((err as Error).name !== 'AbortError') console.error('Teilen fehlgeschlagen', err);
    }
  };
}
