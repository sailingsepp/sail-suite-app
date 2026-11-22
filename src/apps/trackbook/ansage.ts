import { ANSAGE, PROBE_A, probeB } from '@/core/ansagen';
import { ladeStimme, sprich, stimmeMoeglich } from '@/data/stimme';
import { ersatzton, spieleSprache } from './ton';

type Ersatz = Parameters<typeof ersatzton>[0];
interface Eintrag { text: string; ersatz: Ersatz | null; bis: number }

const warteschlange: Eintrag[] = [];
const gehalten = new Map<string, Blob>();
let spricht = false;
let bereit = false;

const GELADEN = Date.now();
const RUHE_NACH_START_MS = 45_000;

const VORRECHNEN = [ANSAGE.logGestartet, ANSAGE.logWeiter, ANSAGE.logPause, ANSAGE.logStopp, ANSAGE.ziel];

export function initAnsage(): void {
  if (!stimmeMoeglich()) return;
  void ladeStimme()
    .then(async () => {
      bereit = true;
      for (const t of VORRECHNEN) {
        if (!gehalten.has(t)) gehalten.set(t, await sprich(t));
      }
    })
    .catch((e: unknown) => { console.warn('Ansage: Stimme nicht geladen', e); });
}

export function stimmeBereit(): boolean { return bereit; }

export function sage(text: string, ersatz: Ersatz | null = 'bestaetigung', gueltigMs = 60_000, immer = false): void {
  if (!bereit) {
    if (ersatz && (immer || Date.now() - GELADEN > RUHE_NACH_START_MS)) ersatzton(ersatz);

    return;
  }

  if (warteschlange.some((e) => e.text === text)) return;
  warteschlange.push({ text, ersatz, bis: Date.now() + gueltigMs });
  void weiter();
}

export async function probe(): Promise<boolean> {
  if (!stimmeMoeglich()) return false;
  try { await ladeStimme(); } catch { return false; }
  bereit = true;
  sage(PROBE_A, null);
  sage(probeB(Math.random()), null);
  return true;
}

export function verwirf(pruefe: (text: string) => boolean): void {
  for (let i = warteschlange.length - 1; i >= 0; i--) if (pruefe(warteschlange[i]!.text)) warteschlange.splice(i, 1);
}

async function weiter(): Promise<void> {
  if (spricht) return;
  spricht = true;
  try {
    while (warteschlange.length) {
      const e = warteschlange.shift()!;
      if (Date.now() > e.bis) continue;
      try {
        const wav = gehalten.get(e.text) ?? await sprich(e.text);
        if (Date.now() > e.bis) continue;

        const dauerMs = Math.round(((wav.size - 44) / 2 / 22_050) * 1000);
        const ok = await spieleSprache(wav, dauerMs);
        if (!ok && e.ersatz) ersatzton(e.ersatz);
      } catch (err) {
        console.warn('Ansage fehlgeschlagen', err);
        if (e.ersatz) ersatzton(e.ersatz);
      }
    }
  } finally {
    spricht = false;
  }
}
