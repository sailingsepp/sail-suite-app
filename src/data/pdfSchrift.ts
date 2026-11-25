import type { jsPDF } from 'jspdf';
import regularUrl from '@/assets/fonts/Inter-Regular.ttf?url';
import boldUrl from '@/assets/fonts/Inter-Bold.ttf?url';
import italicUrl from '@/assets/fonts/Inter-Italic.ttf?url';

export const SCHRIFT = 'Inter';

type Daten = { normal: string; bold: string; italic: string };
let laden: Promise<Daten | null> | null = null;

async function alsBase64(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Schrift ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let s = '';

  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function holeDaten(): Promise<Daten | null> {
  laden ??= Promise.all([alsBase64(regularUrl), alsBase64(boldUrl), alsBase64(italicUrl)])
    .then(([normal, bold, italic]) => ({ normal, bold, italic }))
    .catch(() => { laden = null; return null; });
  return laden;
}

export async function bindeSchriftEin(d: jsPDF): Promise<boolean> {
  const daten = await holeDaten();
  if (!daten) return false;
  try {
    for (const stil of ['normal', 'bold', 'italic'] as const) {
      const datei = `Inter-${stil}.ttf`;
      d.addFileToVFS(datei, daten[stil]);
      d.addFont(datei, SCHRIFT, stil);
    }
    return true;
  } catch {
    return false;
  }
}
